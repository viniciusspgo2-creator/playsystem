import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordPayment } from "@/lib/unitv-server";
import { computeNewExpiry, parseDateInput, parseMoney, todayBR, ymd } from "@/lib/unitv";

// GET /api/unitv/renewals?clientId=...  -> histórico do cliente
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const clientId = new URL(req.url).searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
    const items = await db.iptvRenewal.findMany({
      where: { clientId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ data: items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/unitv/renewals -> dar entrada em uma renovação
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const client = await db.iptvClient.findUnique({ where: { id: String(body.clientId || "") } });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const months = Math.max(1, parseInt(body.planMonths, 10) || 1);
    const amount = parseMoney(body.amount);
    const paidAt = parseDateInput(body.paidAt || "") || todayBR();
    const newExpiry =
      parseDateInput(body.newExpiry || "") || computeNewExpiry(ymd(client.expiresAt), paidAt, months);

    const renewal = await db.$transaction((tx) =>
      recordPayment(tx, {
        clientId: client.id,
        clientName: client.name,
        kind: "renewal",
        planMonths: months,
        amount,
        paidAt,
        previousExpiry: client.expiresAt,
        newExpiry,
        walletId: body.walletId || null,
        paymentMethod: body.paymentMethod || null,
        notes: body.notes?.trim() || null,
      })
    );
    return NextResponse.json({ data: renewal });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
