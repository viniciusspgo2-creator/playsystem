import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/dashboard -> aggregated metrics
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total balances across wallets
    const wallets = await db.wallet.findMany({ where: { active: true } });
    const totalBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    // Income & expense this month
    const incomeTx = await db.transaction.findMany({
      where: { type: "income", date: { gte: startOfMonth } },
    });
    const expenseTx = await db.transaction.findMany({
      where: { type: "expense", date: { gte: startOfMonth } },
    });
    const income = incomeTx.reduce((s, t) => s + Number(t.amount), 0);
    const expense = expenseTx.reduce((s, t) => s + Number(t.amount), 0);

    // Last month for comparison
    const lastIncomeTx = await db.transaction.findMany({
      where: { type: "income", date: { gte: startOfLastMonth, lte: endOfLastMonth } },
    });
    const lastExpenseTx = await db.transaction.findMany({
      where: { type: "expense", date: { gte: startOfLastMonth, lte: endOfLastMonth } },
    });
    const lastIncome = lastIncomeTx.reduce((s, t) => s + Number(t.amount), 0);
    const lastExpense = lastExpenseTx.reduce((s, t) => s + Number(t.amount), 0);

    // Payables & receivables
    const pendingPayables = await db.payable.findMany({
      where: { paid: false },
    });
    const pendingReceivables = await db.receivable.findMany({
      where: { received: false },
      include: { client: { select: { name: true } } },
    });
    const totalToPay = pendingPayables.reduce(
      (s, p) => s + Number(p.amount),
      0
    );
    const totalToReceive = pendingReceivables.reduce(
      (s, r) => s + Number(r.amount),
      0
    );

    // Overdue
    const overduePayables = pendingPayables.filter(
      (p) => new Date(p.dueDate) < now
    );
    const overdueReceivables = pendingReceivables.filter(
      (r) => new Date(r.dueDate) < now
    );

    // Credit cards
    const creditCards = await db.creditCard.findMany({ where: { active: true } });
    const totalCreditLimit = creditCards.reduce(
      (s, c) => s + Number(c.totalLimit),
      0
    );
    const totalUsedLimit = creditCards.reduce(
      (s, c) => s + Number(c.usedLimit),
      0
    );

    // Production pipeline
    const orders = await db.serviceOrder.findMany({
      include: {
        client: { select: { name: true } },
        serviceType: { select: { name: true, color: true } },
      },
    });
    const byStatus = {
      todo: orders.filter((o) => o.status === "todo"),
      doing: orders.filter((o) => o.status === "doing"),
      done: orders.filter((o) => o.status === "done"),
      delivered: orders.filter((o) => o.status === "delivered"),
    };
    const pendingPayment = orders.filter(
      (o) => o.status === "delivered" && !o.paid
    );

    // Monthly clients
    const monthlyClients = await db.client.findMany({
      where: { isMonthly: true },
    });
    const monthlyRevenue = monthlyClients.reduce(
      (s, c) => s + Number(c.monthlyFee || 0),
      0
    );

    // Recent transactions (last 6)
    const recentTx = await db.transaction.findMany({
      take: 6,
      orderBy: { date: "desc" },
      include: {
        client: { select: { name: true } },
        wallet: { select: { name: true } },
      },
    });

    // Chart: last 6 months income vs expense
    const monthlyChart: { month: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const inc = await db.transaction.findMany({
        where: { type: "income", date: { gte: start, lte: end } },
      });
      const exp = await db.transaction.findMany({
        where: { type: "expense", date: { gte: start, lte: end } },
      });
      monthlyChart.push({
        month: start.toLocaleDateString("pt-BR", { month: "short" }),
        income: inc.reduce((s, t) => s + Number(t.amount), 0),
        expense: exp.reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    // Service type distribution
    const serviceTypes = await db.serviceType.findMany({
      include: { _count: { select: { orders: true } } },
    });

    // Goal
    const goal = await db.goal.findFirst({
      where: { active: true },
      include: { wallet: { select: { name: true } } },
    });

    // ===== FOCO DE HOJE (modo TDAH: o que importa agora) =====
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    const openReminders = await db.reminder.findMany({ where: { done: false } });
    const focusReminders = openReminders
      .filter((r) => r.dueDate && new Date(r.dueDate) <= endToday)
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, normal: 1, low: 2 };
        const pa = order[a.priority] ?? 1;
        const pb = order[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return (
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
        );
      })
      .slice(0, 8);

    const receivablesToday = pendingReceivables
      .filter((r) => {
        const d = new Date(r.dueDate);
        return d >= startToday && d <= endToday;
      })
      .slice(0, 6);
    const payablesToday = pendingPayables
      .filter((p) => {
        const d = new Date(p.dueDate);
        return d >= startToday && d <= endToday;
      })
      .slice(0, 6);

    return NextResponse.json({
      totals: {
        balance: totalBalance,
        income,
        expense,
        profit: income - expense,
        lastIncome,
        lastExpense,
        toPay: totalToPay,
        toReceive: totalToReceive,
        overdueToPay: overduePayables.length,
        overdueToReceive: overdueReceivables.length,
        creditLimit: totalCreditLimit,
        creditUsed: totalUsedLimit,
        creditAvailable: totalCreditLimit - totalUsedLimit,
        monthlyRevenue,
        pendingPaymentCount: pendingPayment.length,
        pendingPaymentTotal: pendingPayment.reduce(
          (s, o) => s + Number(o.price),
          0
        ),
      },
      counts: {
        clients: await db.client.count(),
        orders: orders.length,
        pendingPayables: pendingPayables.length,
        pendingReceivables: pendingReceivables.length,
        monthlyClients: monthlyClients.length,
        wallets: wallets.length,
        creditCards: creditCards.length,
      },
      production: {
        todo: byStatus.todo,
        doing: byStatus.doing,
        done: byStatus.done,
        delivered: byStatus.delivered,
        pendingPayment,
      },
      wallets: wallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        balance: Number(w.balance),
        color: w.color,
        icon: w.icon,
      })),
      creditCards: creditCards.map((c) => ({
        id: c.id,
        name: c.name,
        totalLimit: Number(c.totalLimit),
        usedLimit: Number(c.usedLimit),
        available: Number(c.totalLimit) - Number(c.usedLimit),
        color: c.color,
      })),
      recentTx,
      monthlyChart,
      serviceTypes: serviceTypes.map((st) => ({
        name: st.name,
        color: st.color,
        count: st._count.orders,
      })),
      overdueReceivables: overdueReceivables.map((r) => ({
        id: r.id,
        client: r.client?.name || "-",
        amount: Number(r.amount),
        dueDate: r.dueDate,
        description: r.description,
      })),
      overduePayables: overduePayables.map((p) => ({
        id: p.id,
        description: p.description,
        amount: Number(p.amount),
        dueDate: p.dueDate,
        supplier: p.supplier,
      })),
      focus: {
        reminders: focusReminders.map((r) => ({
          id: r.id,
          title: r.title,
          priority: r.priority,
          dueDate: r.dueDate,
          overdue: r.dueDate ? new Date(r.dueDate) < startToday : false,
        })),
        receivablesToday: receivablesToday.map((r) => ({
          id: r.id,
          description: r.description,
          amount: Number(r.amount),
          person: r.client?.name || r.clientName || "Avulso",
        })),
        payablesToday: payablesToday.map((p) => ({
          id: p.id,
          description: p.description,
          amount: Number(p.amount),
          supplier: p.supplier || "",
        })),
        overdueReceivablesCount: overdueReceivables.length,
        overduePayablesCount: overduePayables.length,
      },
      goal: goal
        ? {
            id: goal.id,
            name: goal.name,
            target: Number(goal.targetAmount),
            current: Number(goal.currentAmount),
            minDeposit: Number(goal.minDeposit),
            wallet: goal.wallet?.name,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
