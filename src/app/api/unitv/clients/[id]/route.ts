import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput, parseMoney, ymdToDate } from "@/lib/unitv";

// PUT /api/unitv/clients/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
      data.name = n;
    }
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.username !== undefined) data.username = body.username?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.active !== undefined) data.active = !!body.active;
    if (body.lastAmount !== undefined) data.lastAmount = parseMoney(body.lastAmount);
    if (body.expiresAt !== undefined) {
      const e = parseDateInput(body.expiresAt);
      if (!e) return NextResponse.json({ error: "Vencimento inválido" }, { status: 400 });
      data.expiresAt = ymdToDate(e);
    }

    const item = await db.iptvClient.update({ where: { id }, data });
    return NextResponse.json({ data: item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/unitv/clients/[id]  (o histórico financeiro em Entradas & Saídas é mantido)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id } = await params;
    await db.iptvClient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
