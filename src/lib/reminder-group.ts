// Agrupamento de lembretes por urgência (usado pelas rotas de API)
// from = início do "hoje" do usuário, to = fim do "hoje" do usuário (ISO vindos do client,
// assim respeitamos o fuso do navegador em vez do fuso do servidor).

export interface ReminderLike {
  id: string;
  title: string;
  notes: string | null;
  dueDate: Date | null;
  priority: string;
  category: string;
  repeat: string;
  done: boolean;
  doneAt: Date | null;
  createdAt: Date;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

function byUrgency(a: ReminderLike, b: ReminderLike): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 1;
  const pb = PRIORITY_ORDER[b.priority] ?? 1;
  if (pa !== pb) return pa - pb;
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  return da - dbb;
}

export function groupReminders(
  open: ReminderLike[],
  done: ReminderLike[],
  from: Date,
  to: Date
) {
  const overdue: ReminderLike[] = [];
  const today: ReminderLike[] = [];
  const upcoming: ReminderLike[] = [];
  const noDate: ReminderLike[] = [];

  for (const r of open) {
    if (!r.dueDate) noDate.push(r);
    else if (new Date(r.dueDate) < from) overdue.push(r);
    else if (new Date(r.dueDate) <= to) today.push(r);
    else upcoming.push(r);
  }

  overdue.sort(byUrgency);
  today.sort(byUrgency);
  upcoming.sort(byUrgency);
  noDate.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    overdue,
    today,
    upcoming,
    noDate,
    done,
    badge: overdue.length + today.length,
  };
}

// Avança uma data de acordo com a repetição do lembrete
export function advanceRepeat(
  base: Date,
  repeat: string
): Date | null {
  const d = new Date(base);
  switch (repeat) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return d;
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    default:
      return null;
  }
}
