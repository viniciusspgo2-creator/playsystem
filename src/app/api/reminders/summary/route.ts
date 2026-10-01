import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { groupReminders } from "@/lib/reminder-group";

// GET /api/reminders/summary?from=ISO&to=ISO
// Resumo leve para sino do header / sidebar / avisos de abertura.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const now = new Date();
    const from = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from")!)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to")!)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const open = await db.reminder.findMany({ where: { done: false } });
    const done = await db.reminder.findMany({
      where: { done: true },
      orderBy: { doneAt: "desc" },
      take: 30,
    });

    const grouped = groupReminders(open as any, done as any, from, to);

    // Top itens para o popover do sino: atrasados + hoje, mais urgentes primeiro
    const items = [...grouped.overdue, ...grouped.today].slice(0, 6).map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.dueDate,
      priority: r.priority,
      overdue: r.dueDate ? new Date(r.dueDate) < from : false,
    }));

    return NextResponse.json({
      data: {
        badge: grouped.badge,
        overdue: grouped.overdue.length,
        today: grouped.today.length,
        upcoming: grouped.upcoming.length,
        noDate: grouped.noDate.length,
        doneToday: grouped.done.filter(
          (d) => d.doneAt && new Date(d.doneAt) >= from && new Date(d.doneAt) <= to
        ).length,
        items,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
