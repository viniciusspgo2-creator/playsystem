import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getModel, INCLUDES } from "@/lib/crud-helpers";

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
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    if (resource === "goals") {
      if (sanitized.targetAmount !== undefined) sanitized.targetAmount = Number(sanitized.targetAmount);
      if (sanitized.currentAmount !== undefined) sanitized.currentAmount = Number(sanitized.currentAmount);
      if (sanitized.minDeposit !== undefined) sanitized.minDeposit = Number(sanitized.minDeposit);
      if (sanitized.walletId === "") sanitized.walletId = null;
    }
    if (resource === "credit-cards") {
      if (sanitized.totalLimit !== undefined) sanitized.totalLimit = Number(sanitized.totalLimit);
      if (sanitized.usedLimit !== undefined) sanitized.usedLimit = Number(sanitized.usedLimit);
      if (sanitized.closingDay !== undefined) sanitized.closingDay = Number(sanitized.closingDay);
      if (sanitized.dueDay !== undefined) sanitized.dueDay = Number(sanitized.dueDay);
      if (sanitized.walletId === "") sanitized.walletId = null;
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
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
