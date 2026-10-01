import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getModel, INCLUDES } from "@/lib/crud-helpers";

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
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } }
        );
      if (resource === "service-types")
        fields.push({ name: { contains: search, mode: "insensitive" } });
      if (resource === "orders")
        fields.push(
          { title: { contains: search, mode: "insensitive" } },
          { number: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
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
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    if (resource === "orders") {
      const number = `OS-${Date.now().toString().slice(-6)}`;
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
      const item = await model.create({
        data: { ...body, number, amount: Number(body.amount) || 0 },
        include: INCLUDES[resource],
      });
      return NextResponse.json({ data: item });
    }
    if (resource === "budgets") {
      const number = `ORC-${Date.now().toString().slice(-6)}`;
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

    const item = await model.create({
      data: body,
      include: INCLUDES[resource],
    });
    return NextResponse.json({ data: item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Helper: create transaction and update wallet/credit card balances
async function createTransaction(body: any) {
  const {
    type,
    category,
    description,
    amount,
    date,
    paymentMethod,
    walletId,
    creditCardId,
    clientId,
    orderId,
  } = body;

  const amt = Number(amount) || 0;
  const tx = await db.transaction.create({
    data: {
      type,
      category,
      description,
      amount: amt,
      date: date ? new Date(date) : new Date(),
      paymentMethod,
      walletId: walletId || null,
      creditCardId: creditCardId || null,
      clientId: clientId || null,
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
