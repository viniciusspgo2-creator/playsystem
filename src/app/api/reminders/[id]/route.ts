import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { advanceRepeat } from "@/lib/reminder-group";

// PATCH /api/reminders/[id]
// body: { action: "complete" | "reopen" | "snooze", hours?, days?, until? }
//   ou campos diretos: { title?, notes?, dueDate?, priority?, category?, repeat? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const existing = await db.reminder.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Lembrete não encontrado" }, { status: 404 });

    // ===== Concluir (com repetição automática) =====
    if (body.action === "complete") {
      const completed = await db.reminder.update({
        where: { id },
        data: { done: true, doneAt: new Date() },
      });

      let next = null;
      if (existing.repeat && existing.repeat !== "none") {
        const now = new Date();
        let base = existing.dueDate ? new Date(existing.dueDate) : new Date();
        let nextDue = advanceRepeat(base, existing.repeat);
        // se a data já passou, avança até ficar no futuro (lembrete esquecido continua valendo)
        let guard = 0;
        while (nextDue && nextDue < now && guard < 500) {
          base = nextDue;
          nextDue = advanceRepeat(base, existing.repeat);
          guard++;
        }
        if (nextDue) {
          next = await db.reminder.create({
            data: {
              title: existing.title,
              notes: existing.notes,
              dueDate: nextDue,
              priority: existing.priority,
              category: existing.category,
              repeat: existing.repeat,
            },
          });
        }
      }
      return NextResponse.json({ data: completed, next });
    }

    // ===== Reabrir (desmarcar concluído) =====
    if (body.action === "reopen") {
      const updated = await db.reminder.update({
        where: { id },
        data: { done: false, doneAt: null },
      });
      return NextResponse.json({ data: updated });
    }

    // ===== Adiar (snooze) =====
    if (body.action === "snooze") {
      const now = new Date();
      let newDue: Date;
      if (body.until) {
        newDue = new Date(body.until);
      } else if (body.days) {
        newDue = new Date(now.getTime() + Number(body.days) * 24 * 60 * 60 * 1000);
      } else {
        newDue = new Date(now.getTime() + Number(body.hours ?? 1) * 60 * 60 * 1000);
      }
      const updated = await db.reminder.update({
        where: { id },
        data: { dueDate: newDue },
      });
      return NextResponse.json({ data: updated });
    }

    // ===== Edição direta de campos =====
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.category !== undefined) data.category = body.category;
    if (body.repeat !== undefined) data.repeat = body.repeat;

    const updated = await db.reminder.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/reminders/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;
    await db.reminder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Alias: o FormModal genérico usa PUT para edições
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return PATCH(req, ctx);
}
