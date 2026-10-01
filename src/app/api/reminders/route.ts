import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { groupReminders } from "@/lib/reminder-group";

// GET /api/reminders?from=ISO&to=ISO  -> lembretes agrupados por urgência
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
    return NextResponse.json({ data: grouped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/reminders -> criar lembrete
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const title = (body.title || "").trim();
    if (!title) return NextResponse.json({ error: "O lembrete precisa de um título" }, { status: 400 });

    const item = await db.reminder.create({
      data: {
        title,
        notes: body.notes || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        priority: body.priority || "normal",
        category: body.category || "general",
        repeat: body.repeat || "none",
      },
    });
    return NextResponse.json({ data: item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
