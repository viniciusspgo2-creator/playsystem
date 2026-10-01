import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getModel, INCLUDES, ciContains, sanitizeForeignKeys, friendlyError } from "@/lib/crud-helpers";

// GET /api/crud/[resource] -> list with optional filters
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { resource } = await params;
    const model = getModel(resource);
    if (!model)
      return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

    const url = new URL(req.url);
    const whereRaw = url.searchParams.get("where");
    const orderBy = url.searchParams.get("orderBy");
    const limit = url.searchParams.get("limit");
    const search = url.searchParams.get("search");

    const where: any = whereRaw ? JSON.parse(whereRaw) : {};
    if (search && ["clients", "service-types", "orders"].includes(resource)) {
      const fields: any[] = [];
      if (resource === "clients")
        fields.push(
          { name: ciContains(search) },
          { email: ciContains(search) },
          { phone: ciContains(search) }
        );
      if (resource === "service-types")
        fields.push({ name: ciContains(search) });
      if (resource === "orders")
        fields.push(
          { title: ciContains(search) },
          { number: ciContains(search) },
          { description: ciContains(search) }
        );
      where.OR = fields;
    }

    const items = await model.findMany({
      where,
      include: INCLUDES[resource],
      orderBy: orderBy ? JSON.parse(orderBy) : { createdAt: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json({ data: items });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}

// POST /api/crud/[resource] -> create
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { resource } = await params;
    const model = getModel(resource);
    if (!model)
      return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

    const body = await req.json();

    if (resource === "transactions") {
      return await createTransaction(body);
    }
    if (resource === "receivables") {
      // Contas a receber podem ser de clientes cadastrados OU de pessoa avulsa (nome livre)
      // Vínculos inválidos (ordem/carteira/cliente inexistente) são descartados sem travar o fluxo
      await sanitizeForeignKeys(resource, body);
      const willReceive = body.received === true;
      const amt = Number(body.amount) || 0;
      if (willReceive) {
        // Regra de ouro: dinheiro recebido precisa entrar numa carteira
        if (amt <= 0)
          return NextResponse.json(
            { error: "O valor precisa ser maior que zero para registrar o recebimento." },
            { status: 400 }
          );
        if (!body.walletId)
          return NextResponse.json(
            { error: "Escolha a carteira que recebeu o dinheiro — o valor precisa entrar no caixa." },
            { status: 400 }
          );
      }
      const item = await model.create({
        data: {
          ...body,
          clientId: body.clientId || null,
          clientName: body.clientName || null,
          walletId: body.walletId || null,
          orderId: body.orderId || null,
          paymentMethod: body.paymentMethod || null,
          notes: body.notes || null,
          amount: amt,
          ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
        },
        include: INCLUDES[resource],
      });
      if (willReceive) {
        // Lançamento vinculado em Entradas & Saídas (a carteira se move junto)
        const t = await db.transaction.create({
          data: {
            type: "income",
            category: String(item.description || "").startsWith("Mensalidade") ? "monthly" : "service",
            description: item.description,
            amount: amt,
            date: item.receivedAt ?? new Date(),
            paymentMethod: item.paymentMethod,
            walletId: item.walletId,
            clientId: item.clientId,
            clientName: item.clientName,
            orderId: item.orderId,
          },
        });
        if (item.walletId) {
          const w = await db.wallet.findUnique({ where: { id: item.walletId } });
          if (w)
            await db.wallet.update({
              where: { id: item.walletId },
              data: { balance: Number(w.balance) + amt },
            });
        }
        const linked = await db.receivable.update({ where: { id: item.id }, data: { transactionId: t.id }, include: INCLUDES[resource] });
        return NextResponse.json({ data: linked });
      }
      return NextResponse.json({ data: item });
    }
    if (resource === "payables") {
      await sanitizeForeignKeys(resource, body);
      const willPay = body.paid === true;
      const amt = Number(body.amount) || 0;
      if (willPay) {
        if (amt <= 0)
          return NextResponse.json(
            { error: "O valor precisa ser maior que zero para registrar o pagamento." },
            { status: 400 }
          );
        if (!body.walletId && !body.creditCardId)
          return NextResponse.json(
            { error: "Escolha a carteira (ou o cartão) que pagou — o dinheiro precisa sair de algum lugar." },
            { status: 400 }
          );
      }
      const item = await model.create({
        data: {
          ...body,
          walletId: body.walletId || null,
          creditCardId: body.creditCardId || null,
          paymentMethod: body.paymentMethod || null,
          category: body.category || null,
          supplier: body.supplier || null,
          notes: body.notes || null,
          amount: amt,
          paid: willPay,
          ...(willPay ? { paidAt: new Date() } : {}),
          ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
        },
        include: INCLUDES[resource],
      });
      if (willPay) {
        // Lançamento vinculado em Entradas & Saídas (carteira/cartão se movem junto)
        const knownCats = ["fixed", "variable", "other", "card_payment"];
        const t = await db.transaction.create({
          data: {
            type: "expense",
            category: body.category && knownCats.includes(body.category) ? body.category : "other",
            description: item.description,
            amount: amt,
            date: item.paidAt ?? new Date(),
            paymentMethod: item.paymentMethod ?? (item.creditCardId ? "credit" : null),
            walletId: item.walletId,
            creditCardId: item.creditCardId,
          },
        });
        if (item.walletId) {
          const w = await db.wallet.findUnique({ where: { id: item.walletId } });
          if (w)
            await db.wallet.update({
              where: { id: item.walletId },
              data: { balance: Number(w.balance) - amt },
            });
        }
        if (item.creditCardId) {
          const c = await db.creditCard.findUnique({ where: { id: item.creditCardId } });
          if (c)
            await db.creditCard.update({
              where: { id: item.creditCardId },
              data: { usedLimit: Math.max(0, Number(c.usedLimit) + amt) },
            });
        }
        const linked = await db.payable.update({ where: { id: item.id }, data: { transactionId: t.id }, include: INCLUDES[resource] });
        return NextResponse.json({ data: linked });
      }
      return NextResponse.json({ data: item });
    }
    if (resource === "orders") {
      const number = `OS-${Date.now().toString().slice(-6)}`;
      await sanitizeForeignKeys(resource, body);
      const item = await model.create({
        data: {
          ...body,
          number,
          price: Number(body.price) || 0,
          cost: Number(body.cost) || 0,
        },
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: item });
    }
    if (resource === "receipts") {
      const number = `REC-${Date.now().toString().slice(-6)}`;
      await sanitizeForeignKeys(resource, body);
      const item = await model.create({
        data: { ...body, number, amount: Number(body.amount) || 0 },
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: item });
    }
    if (resource === "budgets") {
      const number = `ORC-${Date.now().toString().slice(-6)}`;
      await sanitizeForeignKeys(resource, body);
      const itemsStr =
        typeof body.items === "string"
          ? body.items
          : JSON.stringify(body.items || []);
      const item = await model.create({
        data: {
          ...body,
          number,
          items: itemsStr,
          total: Number(body.total) || 0,
          discount: Number(body.discount) || 0,
          finalTotal: Number(body.finalTotal) || 0,
        },
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: item });
    }

    await sanitizeForeignKeys(resource, body);
    const item = await model.create({
      data: body,
      include: INCLUDES[resource],
    });
    return NextResponse.json({ data: item });
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}

// Helper: soma N meses a uma data, ajustando o dia quando o mês destino é mais curto
// (ex: 31 jan + 1 mês → 28/29 fev, nunca "pula" para março)
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

// Helper: create transaction and update wallet/credit card balances.
// Se for despesa no cartão de crédito com parcelamento (installments > 1),
// cria N lançamentos mensais (1 por mês) agrupados por installmentGroup:
// - cada parcela tem o mesmo dia da compra, meses seguintes
// - o limite do cartão é consumido pelo valor TOTAL na hora (padrão dos bancos)
// - o saldo da carteira não é afetado (só quando a fatura for paga)
async function createTransaction(body: any) {
  const { type, category, description } = body;

  // Validações humanas antes de tocar no banco (nada de erro críptico)
  if (type !== "income" && type !== "expense")
    return NextResponse.json({ error: "Escolha se é entrada ou saída." }, { status: 400 });
  if (!description || !String(description).trim())
    return NextResponse.json({ error: "Escreva uma descrição para o lançamento." }, { status: 400 });

  // Valida vínculos ANTES de usar: "" / id inexistente → null (nunca explode FK)
  await sanitizeForeignKeys("transactions", body);
  const {
    walletId,
    creditCardId,
    clientId,
    clientName,
    orderId,
  } = body;

  const amt = Number(body.amount) || 0;
  if (amt <= 0)
    return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });

  const when = body.date ? new Date(body.date) : new Date();
  if (isNaN(when.getTime()))
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  // ===== Compra parcelada no cartão de crédito =====
  let installments = Math.floor(Number(body.installments) || 1);
  if (installments < 1) installments = 1;
  if (installments > 24) installments = 24;
  const isInstallment = installments > 1 && type === "expense" && !!creditCardId;

  if (isInstallment) {
    // divide em centavos para não perder dinheiro no arredondamento;
    // a sobra de centavos vai para a 1ª parcela (ex: R$ 100 em 3x = 33.33 + 33.33 + 33.34)
    const totalCents = Math.round(amt * 100);
    const base = Math.floor(totalCents / installments);
    const remainder = totalCents - base * installments;
    const group = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const created: any[] = [];
    for (let i = 1; i <= installments; i++) {
      const cents = base + (i === 1 ? remainder : 0);
      const tx = await db.transaction.create({
        data: {
          type,
          category,
          description,
          amount: cents / 100,
          date: addMonths(when, i - 1),
          paymentMethod: body.paymentMethod ?? "credit",
          walletId: null, // compra no crédito não sai do saldo; sai quando pagar a fatura
          creditCardId: creditCardId || null,
          clientId: clientId || null,
          clientName: clientName || null,
          orderId: orderId || null,
          installments,
          installmentNo: i,
          installmentGroup: group,
        },
        include: INCLUDES.transactions,
      });
      created.push(tx);
    }

    // limite usado recebe o valor total da compra imediatamente
    const card = await db.creditCard.findUnique({ where: { id: creditCardId } });
    if (card) {
      await db.creditCard.update({
        where: { id: creditCardId },
        data: { usedLimit: Math.max(0, Number(card.usedLimit) + amt) },
      });
    }

    return NextResponse.json({
      data: created[0],
      meta: { installments, created: created.length, total: amt },
    });
  }

  // ===== Lançamento simples =====
  const tx = await db.transaction.create({
    data: {
      type,
      category,
      description: String(description).trim(),
      amount: amt,
      date: when,
      paymentMethod: body.paymentMethod || null,
      walletId: walletId || null,
      creditCardId: creditCardId || null,
      clientId: clientId || null,
      clientName: clientName || null,
      orderId: orderId || null,
    },
    include: INCLUDES.transactions,
  });

  if (walletId) {
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    if (wallet) {
      const delta = type === "income" ? amt : -amt;
      await db.wallet.update({
        where: { id: walletId },
        data: { balance: Number(wallet.balance) + delta },
      });
    }
  }

  if (creditCardId) {
    const card = await db.creditCard.findUnique({ where: { id: creditCardId } });
    if (card) {
      const delta = type === "expense" ? amt : -amt;
      await db.creditCard.update({
        where: { id: creditCardId },
        data: { usedLimit: Math.max(0, Number(card.usedLimit) + delta) },
      });
    }
  }

  return NextResponse.json({ data: tx });
}
