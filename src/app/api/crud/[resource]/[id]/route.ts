import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getModel, INCLUDES, sanitizeForeignKeys, friendlyError } from "@/lib/crud-helpers";

// Remove o lançamento vinculado ESTORNANDO carteira/cartão antes de apagar
// (o handler HTTP de transactions faz isso; aqui replicamos para uso interno)
async function removeLinkedTransaction(transactionId: string) {
  const t = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!t) return;
  const amt = Number(t.amount);
  if (t.walletId) {
    const w = await db.wallet.findUnique({ where: { id: t.walletId } });
    if (w) {
      const delta = t.type === "income" ? -amt : amt;
      await db.wallet.update({ where: { id: t.walletId }, data: { balance: Number(w.balance) + delta } });
    }
  }
  if (t.creditCardId) {
    const c = await db.creditCard.findUnique({ where: { id: t.creditCardId } });
    if (c) {
      const delta = t.type === "expense" ? -amt : amt;
      await db.creditCard.update({
        where: { id: t.creditCardId },
        data: { usedLimit: Math.max(0, Number(c.usedLimit) + delta) },
      });
    }
  }
  await db.transaction.delete({ where: { id: transactionId } });
}

// GET /api/crud/[resource]/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { resource, id } = await params;
    const model = getModel(resource);
    if (!model)
      return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

    const item = await model.findUnique({
      where: { id },
      include: INCLUDES[resource],
    });
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ data: item });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}

// PUT /api/crud/[resource]/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { resource, id } = await params;
    const model = getModel(resource);
    if (!model)
      return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

    const body = await req.json();
    // Valida vínculos ANTES de tudo: "" / id inexistente → null, sem explodir FK
    // (corrigindo o bug `Foreign key constraint violated ... Receivable_orderId_fkey`)
    await sanitizeForeignKeys(resource, body);

    // Transaction edit: reconcile wallet / credit card balances so "editar lançamento" never desynca saldos
    if (resource === "transactions") {
      // uma parcela não pode ser "re-parcelada" por edit: mantém o grupo original
      delete body.installments;
      delete body.installmentNo;
      delete body.installmentGroup;
      if (body.amount !== undefined && body.amount !== "" && Number(body.amount) <= 0) {
        return NextResponse.json({ error: "O valor precisa ser maior que zero." }, { status: 400 });
      }
      const existing = await db.transaction.findUnique({ where: { id } });
      if (existing) {
        const oldAmt = Number(existing.amount);
        const newType = body.type ?? existing.type;
        const newAmt = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : oldAmt;
        const newWalletId = body.walletId !== undefined ? body.walletId || null : existing.walletId;
        const newCardId = body.creditCardId !== undefined ? body.creditCardId || null : existing.creditCardId;

        // 1) desfaz efeito antigo
        if (existing.walletId) {
          const w = await db.wallet.findUnique({ where: { id: existing.walletId } });
          if (w) {
            const revert = existing.type === "income" ? -oldAmt : oldAmt;
            await db.wallet.update({ where: { id: existing.walletId }, data: { balance: Number(w.balance) + revert } });
          }
        }
        if (existing.creditCardId) {
          const c = await db.creditCard.findUnique({ where: { id: existing.creditCardId } });
          if (c) {
            const revert = existing.type === "expense" ? -oldAmt : oldAmt;
            await db.creditCard.update({ where: { id: existing.creditCardId }, data: { usedLimit: Math.max(0, Number(c.usedLimit) + revert) } });
          }
        }
        // 2) aplica efeito novo
        if (newWalletId) {
          const w = await db.wallet.findUnique({ where: { id: newWalletId } });
          if (w) {
            const delta = newType === "income" ? newAmt : -newAmt;
            await db.wallet.update({ where: { id: newWalletId }, data: { balance: Number(w.balance) + delta } });
          }
        }
        if (newCardId) {
          const c = await db.creditCard.findUnique({ where: { id: newCardId } });
          if (c) {
            const delta = newType === "expense" ? newAmt : -newAmt;
            await db.creditCard.update({ where: { id: newCardId }, data: { usedLimit: Math.max(0, Number(c.usedLimit) + delta) } });
          }
        }
      }
    }

    // Helper local: aplica delta no saldo de uma carteira (se existir)
    const walletDelta = async (walletId: string | null | undefined, delta: number) => {
      if (!walletId) return;
      const w = await db.wallet.findUnique({ where: { id: walletId } });
      if (w)
        await db.wallet.update({ where: { id: walletId }, data: { balance: Number(w.balance) + delta } });
    };
    // Helper local: aplica delta no limite usado de um cartão (se existir)
    const cardDelta = async (cardId: string | null | undefined, delta: number) => {
      if (!cardId) return;
      const c = await db.creditCard.findUnique({ where: { id: cardId } });
      if (c)
        await db.creditCard.update({
          where: { id: cardId },
          data: { usedLimit: Math.max(0, Number(c.usedLimit) + delta) },
        });
    };

    // ===== Recebível: receber / estornar / editar — com lançamento vinculado em Entradas & Saídas =====
    // Regra de ouro: receber cria um lançamento de entrada (que move a carteira);
    // estornar/editar sempre sincroniza o lançamento. Registros antigos (sem vínculo) reconciliam direto.
    if (resource === "receivables") {
      const existing = await db.receivable.findUnique({ where: { id } });
      if (existing) {
        const was = existing.received;
        const will = body.received === undefined ? was : !!body.received;
        const oldAmt = Number(existing.amount);
        const newAmt = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : oldAmt;
        const oldWalletId = existing.walletId;
        const newWalletId = body.walletId !== undefined ? body.walletId || null : oldWalletId;
        const finalDescription =
          body.description !== undefined
            ? String(body.description || "").trim() || existing.description
            : existing.description;
        const finalMethod = body.paymentMethod !== undefined ? body.paymentMethod || null : existing.paymentMethod;

        if (!was && will) {
          if (newAmt <= 0)
            return NextResponse.json(
              { error: "O valor precisa ser maior que zero para registrar o recebimento." },
              { status: 400 }
            );
          if (!newWalletId)
            return NextResponse.json(
              { error: "Escolha a carteira que recebeu o dinheiro — o valor precisa entrar no caixa." },
              { status: 400 }
            );
        }

        let transactionId = existing.transactionId ?? null;
        const receivedAt = will ? (body.receivedAt ? new Date(body.receivedAt) : existing.receivedAt ?? new Date()) : null;

        if (was && transactionId) {
          // remove o lançamento antigo (estornando a carteira); recria abaixo com os valores novos
          await removeLinkedTransaction(transactionId);
          transactionId = null;
        } else if (was && !transactionId) {
          // registro antigo recebido sem vínculo: reconcilia a carteira direto
          if (oldWalletId) await walletDelta(oldWalletId, -oldAmt);
        }
        if (will) {
          const t = await db.transaction.create({
            data: {
              type: "income",
              category: finalDescription.startsWith("Mensalidade") ? "monthly" : "service",
              description: finalDescription,
              amount: newAmt,
              date: receivedAt ?? new Date(),
              paymentMethod: finalMethod,
              walletId: newWalletId,
              clientId: existing.clientId,
              clientName: existing.clientName,
              orderId: existing.orderId,
            },
          });
          transactionId = t.id;
        }

        const data: any = { ...body };
        data.received = will;
        data.receivedAt = receivedAt;
        data.walletId = newWalletId;
        data.transactionId = transactionId;
        if (body.amount !== undefined) data.amount = newAmt;
        if (body.dueDate) data.dueDate = new Date(body.dueDate);
        const updated = await db.receivable.update({ where: { id }, data, include: INCLUDES.receivables });
        return NextResponse.json({ data: updated });
      }
    }

    // ===== Pagável: pagar / estornar / editar — com lançamento vinculado em Entradas & Saídas =====
    if (resource === "payables") {
      const existing = await db.payable.findUnique({ where: { id } });
      if (existing) {
        const was = existing.paid;
        const will = body.paid === undefined ? was : !!body.paid;
        const oldAmt = Number(existing.amount);
        const newAmt = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : oldAmt;
        const newWalletId = body.walletId !== undefined ? body.walletId || null : existing.walletId;
        const newCardId = body.creditCardId !== undefined ? body.creditCardId || null : existing.creditCardId;
        const finalDescription =
          body.description !== undefined
            ? String(body.description || "").trim() || existing.description
            : existing.description;
        const finalMethod = body.paymentMethod !== undefined ? body.paymentMethod || null : existing.paymentMethod;

        if (!was && will) {
          if (newAmt <= 0)
            return NextResponse.json(
              { error: "O valor precisa ser maior que zero para registrar o pagamento." },
              { status: 400 }
            );
          if (!newWalletId && !newCardId)
            return NextResponse.json(
              { error: "Escolha a carteira (ou o cartão) que pagou — o dinheiro precisa sair de algum lugar." },
              { status: 400 }
            );
        }

        let transactionId = existing.transactionId ?? null;
        if (was && transactionId) {
          await removeLinkedTransaction(transactionId);
          transactionId = null;
        } else if (was && !transactionId) {
          // legado: estorna direto
          if (existing.walletId) await walletDelta(existing.walletId, oldAmt);
          if (existing.creditCardId) await cardDelta(existing.creditCardId, -oldAmt);
        }
        if (will) {
          const knownCats = ["fixed", "variable", "other", "card_payment"];
          const t = await db.transaction.create({
            data: {
              type: "expense",
              category: existing.category && knownCats.includes(existing.category) ? existing.category : "other",
              description: finalDescription,
              amount: newAmt,
              date: existing.paidAt ?? new Date(),
              paymentMethod: finalMethod ?? (newCardId ? "credit" : null),
              walletId: newWalletId,
              creditCardId: newCardId,
            },
          });
          transactionId = t.id;
        }

        const data: any = { ...body };
        data.paid = will;
        data.paidAt = will ? existing.paidAt ?? new Date() : null;
        data.walletId = newWalletId;
        data.creditCardId = newCardId;
        data.transactionId = transactionId;
        if (body.amount !== undefined) data.amount = newAmt;
        const updated = await db.payable.update({ where: { id }, data, include: INCLUDES.payables });
        return NextResponse.json({ data: updated });
      }
    }

    // Order status update with timestamps
    if (resource === "orders" && body.status) {
      const existing = await db.serviceOrder.findUnique({ where: { id } });
      const updates: any = { ...body };
      if (existing) {
        if (body.status === "doing" && !existing.startedAt)
          updates.startedAt = new Date();
        if (body.status === "done" && !existing.finishedAt)
          updates.finishedAt = new Date();
        if (body.status === "delivered" && !existing.deliveredAt)
          updates.deliveredAt = new Date();
      }
      const updated = await model.update({
        where: { id },
        data: updates,
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: updated });
    }

    // Deposit-only update on a goal (when currentAmount is the ONLY field being changed)
    if (
      resource === "goals" &&
      body.currentAmount !== undefined &&
      Object.keys(body).length === 1
    ) {
      const updated = await model.update({
        where: { id },
        data: { currentAmount: Number(body.currentAmount) },
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: updated });
    }

    // Generic update — coerce numeric / decimal fields for known resources
    const sanitized: any = { ...body };
    if (resource === "transactions") {
      if (sanitized.amount !== undefined) sanitized.amount = Number(sanitized.amount) || 0;
      if (sanitized.clientName !== undefined) sanitized.clientName = sanitized.clientName || null;
    }
    if (resource === "receivables") {
      if (sanitized.amount !== undefined) sanitized.amount = Number(sanitized.amount) || 0;
      if (sanitized.clientName !== undefined) sanitized.clientName = sanitized.clientName || null;
    }
    if (resource === "goals") {
      if (sanitized.targetAmount !== undefined) sanitized.targetAmount = Number(sanitized.targetAmount);
      if (sanitized.currentAmount !== undefined) sanitized.currentAmount = Number(sanitized.currentAmount);
      if (sanitized.minDeposit !== undefined) sanitized.minDeposit = Number(sanitized.minDeposit);
    }
    if (resource === "credit-cards") {
      if (sanitized.totalLimit !== undefined) sanitized.totalLimit = Number(sanitized.totalLimit);
      if (sanitized.usedLimit !== undefined) sanitized.usedLimit = Number(sanitized.usedLimit);
      if (sanitized.closingDay !== undefined) sanitized.closingDay = Number(sanitized.closingDay);
      if (sanitized.dueDay !== undefined) sanitized.dueDay = Number(sanitized.dueDay);
    }
    if (resource === "wallets" && sanitized.balance !== undefined) {
      sanitized.balance = Number(sanitized.balance);
    }
    if (resource === "orders") {
      if (sanitized.price !== undefined) sanitized.price = Number(sanitized.price);
      if (sanitized.cost !== undefined) sanitized.cost = Number(sanitized.cost);
    }

    const updated = await model.update({
      where: { id },
      data: sanitized,
      include: INCLUDES[resource],
    });
    return NextResponse.json({ data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}

// DELETE /api/crud/[resource]/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { resource, id } = await params;
    const model = getModel(resource);
    if (!model)
      return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

    // Estorno automático ao excluir: apaga o lançamento vinculado (reverte carteira/cartão);
    // registros antigos sem vínculo reconciliam direto.
    if (resource === "receivables") {
      const r = await db.receivable.findUnique({ where: { id } });
      if (r?.received) {
        if (r.transactionId) {
          await removeLinkedTransaction(r.transactionId);
        } else if (r.walletId) {
          const w = await db.wallet.findUnique({ where: { id: r.walletId } });
          if (w)
            await db.wallet.update({
              where: { id: r.walletId },
              data: { balance: Number(w.balance) - Number(r.amount) },
            });
        }
      }
    }
    if (resource === "payables") {
      const p = await db.payable.findUnique({ where: { id } });
      if (p?.paid) {
        if (p.transactionId) {
          await removeLinkedTransaction(p.transactionId);
        } else {
          if (p.walletId) {
            const w = await db.wallet.findUnique({ where: { id: p.walletId } });
            if (w)
              await db.wallet.update({
                where: { id: p.walletId },
                data: { balance: Number(w.balance) + Number(p.amount) },
              });
          }
          if (p.creditCardId) {
            const c = await db.creditCard.findUnique({ where: { id: p.creditCardId } });
            if (c)
              await db.creditCard.update({
                where: { id: p.creditCardId },
                data: { usedLimit: Math.max(0, Number(c.usedLimit) - Number(p.amount)) },
              });
          }
        }
      }
    }

    if (resource === "transactions") {
      const tx = await db.transaction.findUnique({ where: { id } });
      if (tx) {
        const amt = Number(tx.amount);
        if (tx.walletId) {
          const w = await db.wallet.findUnique({ where: { id: tx.walletId } });
          if (w) {
            const delta = tx.type === "income" ? -amt : amt;
            await db.wallet.update({
              where: { id: tx.walletId },
              data: { balance: Number(w.balance) + delta },
            });
          }
        }
        if (tx.creditCardId) {
          const c = await db.creditCard.findUnique({ where: { id: tx.creditCardId } });
          if (c) {
            const delta = tx.type === "expense" ? -amt : amt;
            await db.creditCard.update({
              where: { id: tx.creditCardId },
              data: { usedLimit: Math.max(0, Number(c.usedLimit) + delta) },
            });
          }
        }
      }
    }

    await model.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2003" || (e?.message || "").includes("Foreign key constraint")) {
      return NextResponse.json(
        { error: "Não dá para excluir: ainda existem lançamentos vinculados a este registro. Exclua ou desvincule eles primeiro." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
