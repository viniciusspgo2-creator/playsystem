import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput, parseMoney, ymdToDate } from "@/lib/unitv";

// POST /api/unitv/import  { rows: [{ name, phone, username, expiresAt, lastAmount }] }
// Cadastra vários clientes de uma vez. Pula quem já existe com o mesmo nome (e mesmo telefone, se houver).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhum cliente para importar" }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json({ error: "Máximo de 2000 clientes por importação" }, { status: 400 });
    }

    const existing = await db.iptvClient.findMany({ select: { name: true, phone: true } });
    const seen = new Set(existing.map((c) => `${c.name.trim().toLowerCase()}|${(c.phone || "").replace(/\D/g, "")}`));

    const toCreate: any[] = [];
    let skipped = 0;
    for (const r of rows) {
      const name = String(r.name || "").trim();
      const exp = parseDateInput(String(r.expiresAt || ""));
      if (!name || !exp) {
        skipped++;
        continue;
      }
      const k = `${name.toLowerCase()}|${String(r.phone || "").replace(/\D/g, "")}`;
      if (seen.has(k)) {
        skipped++;
        continue;
      }
      seen.add(k);
      toCreate.push({
        name,
        phone: r.phone?.trim() || null,
        username: r.username?.trim() || null,
        expiresAt: ymdToDate(exp),
        lastAmount: parseMoney(r.lastAmount),
      });
    }

    if (toCreate.length) await db.iptvClient.createMany({ data: toCreate });
    return NextResponse.json({ data: { created: toCreate.length, skipped } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
