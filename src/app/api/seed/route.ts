import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_SERVICE_TYPES,
  DEFAULT_WALLETS,
  DEFAULT_CREDIT_CARDS,
} from "@/lib/crud-helpers";

// POST /api/seed -> populate default catalogs (service types, wallets, credit cards)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const created = { serviceTypes: 0, wallets: 0, creditCards: 0 };

    for (const st of DEFAULT_SERVICE_TYPES) {
      const exists = await db.serviceType.findUnique({ where: { name: st.name } });
      if (!exists) {
        await db.serviceType.create({ data: st });
        created.serviceTypes++;
      }
    }

    for (const w of DEFAULT_WALLETS) {
      const exists = await db.wallet.findFirst({ where: { name: w.name } });
      if (!exists) {
        await db.wallet.create({ data: w });
        created.wallets++;
      }
    }

    for (const c of DEFAULT_CREDIT_CARDS) {
      const exists = await db.creditCard.findFirst({ where: { name: c.name } });
      if (!exists) {
        await db.creditCard.create({
          data: { ...c, usedLimit: 0 },
        });
        created.creditCards++;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
