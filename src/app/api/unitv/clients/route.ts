import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordPayment } from "@/lib/unitv-server";
import { computeNewExpiry, parseDateInput, parseMoney, todayBR, ymdToDate } from "@/lib/unitv";

// GET /api/unitv/clients
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const items = await db.iptvClient.findMany({ orderBy: { expiresAt: "asc" } });
    return NextResponse.json({ data: items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/unitv/clients
// Cliente já existente no painel: { name, phone, username, notes, expiresAt, lastAmount }
// Cliente novo (ativação):       { ..., activation: { planMonths, amount, paidAt, walletId, paymentMethod } }
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const act = body.activation;
    const base = {
      name,
      phone: body.phone?.trim() || null,
      username: body.username?.trim() || null,
      notes: body.notes?.trim() || null,
    };

    if (act) {
      const months = Math.max(1, parseInt(act.planMonths, 10) || 1);
      const amount = parseMoney(act.amount);
      const paidAt = parseDateInput(act.paidAt || "") || todayBR();
      const expiry = parseDateInput(body.expiresAt || "") || computeNewExpiry(null, paidAt, months);

      const client = await db.$transaction(async (tx) => {
        const c = await tx.iptvClient.create({
          data: { ...base, expiresAt: ymdToDate(expiry), lastAmount: amount },
        });
        await recordPayment(tx, {
          clientId: c.id,
          clientName: c.name,
          kind: "activation",
          planMonths: months,
          amount,
          paidAt,
          previousExpiry: null,
          newExpiry: expiry,
          walletId: act.walletId || null,
          paymentMethod: act.paymentMethod || null,
        });
        return c;
      });
      return NextResponse.json({ data: client });
    }

    const expiry = parseDateInput(body.expiresAt || "");
    if (!expiry) return NextResponse.json({ error: "Informe o vencimento atual do cliente." }, { status: 400 });

    const client = await db.iptvClient.create({
      data: { ...base, expiresAt: ymdToDate(expiry), lastAmount: parseMoney(body.lastAmount) },
    });
    return NextResponse.json({ data: client });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
