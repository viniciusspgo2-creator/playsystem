import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getModel, INCLUDES, sanitizeForeignKeys, friendlyError } from "@/lib/crud-helpers";

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

    // Payable marking as paid
    if (resource === "payables" && body.paid === true) {
      const existing = await db.payable.findUnique({ where: { id } });
      if (existing && !existing.paid) {
        const amt = Number(existing.amount);
        const walletId = body.walletId || existing.walletId;
        const creditCardId = body.creditCardId || existing.creditCardId;
        const updated = await db.payable.update({
          where: { id },
          data: {
            ...body,
            paid: true,
            paidAt: new Date(),
            walletId,
            creditCardId,
          },
          include: INCLUDES.payables,
        });
        if (walletId) {
          const w = await db.wallet.findUnique({ where: { id: walletId } });
          if (w)
            await db.wallet.update({
              where: { id: walletId },
              data: { balance: Number(w.balance) - amt },
            });
        }
        if (creditCardId) {
          const c = await db.creditCard.findUnique({ where: { id: creditCardId } });
          if (c)
            await db.creditCard.update({
              where: { id: creditCardId },
              data: { usedLimit: Math.max(0, Number(c.usedLimit) + amt) },
            });
        }
        return NextResponse.json({ data: updated });
      }
    }

    // Receivable marking as received
    if (resource === "receivables" && body.received === true) {
      const existing = await db.receivable.findUnique({ where: { id } });
      if (existing && !existing.received) {
        const amt = Number(existing.amount);
        const walletId = body.walletId || existing.walletId;
        const updated = await db.receivable.update({
          where: { id },
          data: {
            ...body,
            received: true,
            receivedAt: new Date(),
            walletId,
            ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
          },
          include: INCLUDES.receivables,
        });
        if (walletId) {
          const w = await db.wallet.findUnique({ where: { id: walletId } });
          if (w)
            await db.wallet.update({
              where: { id: walletId },
              data: { balance: Number(w.balance) + amt },
            });
        }
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
