import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAlertDays } from "@/lib/settings";
import { daysUntil, todayBR, ymd } from "@/lib/unitv";

// GET /api/unitv/summary -> contadores, receita do mês e lista de alertas (vencendo / vencidos)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const alertDays = await getAlertDays();
    const today = todayBR();
    const monthStart = `${today.slice(0, 7)}-01`;

    const [clients, renewals] = await Promise.all([
      db.iptvClient.findMany({ where: { active: true }, orderBy: { expiresAt: "asc" } }),
      db.iptvRenewal.findMany({
        where: { paidAt: { gte: new Date(`${monthStart}T00:00:00.000Z`) } },
        select: { amount: true },
      }),
    ]);

    let expired = 0;
    let soon = 0;
    const alerts: { id: string; name: string; phone: string | null; expiresAt: string; days: number; lastAmount: number }[] = [];
    for (const c of clients) {
      const days = daysUntil(ymd(c.expiresAt), today);
      if (days < 0) expired++;
      else if (days <= alertDays) soon++;
      if (days <= alertDays) {
        alerts.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          expiresAt: ymd(c.expiresAt),
          days,
          lastAmount: Number(c.lastAmount),
        });
      }
    }

    return NextResponse.json({
      data: {
        alertDays,
        activeCount: clients.length,
        soonCount: soon,
        expiredCount: expired,
        monthRevenue: renewals.reduce((s, r) => s + Number(r.amount), 0),
        alerts: alerts.slice(0, 60),
        alertCount: soon + expired,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
