"use client";

import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { useFetch } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Bot,
  Sparkles,
  Factory,
  Repeat,
  Plus,
  Bell,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiPost, useRefresh } from "@/lib/api-hooks";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DashboardData {
  totals: {
    balance: number;
    income: number;
    expense: number;
    profit: number;
    lastIncome: number;
    lastExpense: number;
    toPay: number;
    toReceive: number;
    overdueToPay: number;
    overdueToReceive: number;
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    monthlyRevenue: number;
    pendingPaymentCount: number;
    pendingPaymentTotal: number;
  };
  counts: Record<string, number>;
  production: {
    todo: any[];
    doing: any[];
    done: any[];
    delivered: any[];
    pendingPayment: any[];
  };
  wallets: { id: string; name: string; type: string; balance: number; color: string }[];
  creditCards: { id: string; name: string; totalLimit: number; usedLimit: number; available: number; color: string }[];
  recentTx: any[];
  monthlyChart: { month: string; income: number; expense: number }[];
  serviceTypes: { name: string; color: string; count: number }[];
  overdueReceivables: any[];
  overduePayables: any[];
  focus: {
    reminders: {
      id: string;
      title: string;
      priority: string;
      dueDate: string | null;
      overdue: boolean;
    }[];
    receivablesToday: {
      id: string;
      description: string;
      amount: number;
      person: string;
    }[];
    payablesToday: {
      id: string;
      description: string;
      amount: number;
      supplier: string;
    }[];
    overdueReceivablesCount: number;
    overduePayablesCount: number;
  };
  goal: { id: string; name: string; target: number; current: number; minDeposit: number; wallet?: string } | null;
}

export function DashboardView() {
  const { data, loading } = useFetch<DashboardData>("/api/dashboard");
  const setView = useAppStore((s) => s.setView);
  const refresh = useRefresh();

  // Quick-add de lembrete direto do Foco de Hoje
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  async function quickAddReminder() {
    const title = quickTitle.trim();
    if (!title) {
      toast.error("Escreva o que você não pode esquecer :)");
      return;
    }
    setQuickSaving(true);
    try {
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      await apiPost("/api/reminders", { title, dueDate: e.toISOString(), priority: "high" });
      toast.success("Lembrete adicionado para hoje 🧠");
      setQuickTitle("");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setQuickSaving(false);
    }
  }

  async function completeFocusReminder(id: string) {
    try {
      await apiPost(`/api/reminders/${id}`, { action: "complete" }, "PATCH");
      toast.success("Feito! 🎉");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Carregando métricas..." icon={<Sparkles className="h-5 w-5" />} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const t = data.totals;
  const incomeTrend = t.lastIncome > 0 ? ((t.income - t.lastIncome) / t.lastIncome) * 100 : 0;
  const expenseTrend = t.lastExpense > 0 ? ((t.expense - t.lastExpense) / t.lastExpense) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua gestão financeira"
        icon={<Sparkles className="h-5 w-5" />}
        action={{ label: "Abrir Assistente IA", onClick: () => setView("assistant"), icon: <Bot className="h-4 w-4 mr-2" /> }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Saldo nas Carteiras" value={formatCurrency(t.balance)} subtitle={`${data.counts.wallets} carteiras ativas`} icon={<Wallet className="h-5 w-5" />} variant="brand" delay={0} />
        <MetricCard title="Entradas (mês)" value={formatCurrency(t.income)} subtitle="Receitas do mês atual" icon={<TrendingUp className="h-5 w-5" />} trend={incomeTrend} trendLabel="vs mês anterior" variant="income" delay={0.05} />
        <MetricCard title="Saídas (mês)" value={formatCurrency(t.expense)} subtitle="Despesas do mês atual" icon={<TrendingDown className="h-5 w-5" />} trend={expenseTrend} trendLabel="vs mês anterior" variant="expense" delay={0.1} />
        <MetricCard title="Lucro Líquido" value={formatCurrency(t.profit)} subtitle={t.profit >= 0 ? "Positivo" : "Negativo"} icon={<PiggyBank className="h-5 w-5" />} variant={t.profit >= 0 ? "income" : "expense"} delay={0.15} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="A Receber" value={formatCurrency(t.toReceive)} subtitle={`${data.counts.pendingReceivables} pendências`} icon={<ArrowUpFromLine className="h-5 w-5" />} variant="blue" delay={0.2} />
        <MetricCard title="A Pagar" value={formatCurrency(t.toPay)} subtitle={`${data.counts.pendingPayables} contas pendentes`} icon={<ArrowDownToLine className="h-5 w-5" />} variant="warning" delay={0.25} />
        <MetricCard title="Crédito Disponível" value={formatCurrency(t.creditAvailable)} subtitle={`${formatCurrency(t.creditUsed)} em uso`} icon={<CreditCard className="h-5 w-5" />} variant="blue" delay={0.3} />
        <MetricCard title="Receita Mensal Fixa" value={formatCurrency(t.monthlyRevenue)} subtitle={`${data.counts.monthlyClients} mensalistas`} icon={<Repeat className="h-5 w-5" />} variant="brand" delay={0.35} />
      </div>

      {/* ===== FOCO DE HOJE (modo TDAH) ===== */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-accent-blue/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Foco de Hoje
            </h3>
            <p className="text-xs text-muted-foreground">
              O que precisa de você agora — nada mais.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") quickAddReminder();
              }}
              placeholder="+ lembrete rápido para hoje..."
              className="h-9 text-xs sm:w-56"
            />
            <Button
              size="sm"
              className="h-9"
              onClick={quickAddReminder}
              disabled={quickSaving}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lembretes */}
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-primary" />
                Lembretes
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setView("reminders")}
              >
                Ver todos
              </Button>
            </div>
            {data.focus.reminders.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">
                Nada atrasado ou para hoje. Cabeça livre 🧘
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {data.focus.reminders.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg p-1.5 text-xs",
                      r.overdue ? "bg-rose-500/10" : "bg-amber-500/10"
                    )}
                  >
                    <button
                      onClick={() => completeFocusReminder(r.id)}
                      title="Concluir"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 hover:border-emerald-500 hover:bg-emerald-500/20 transition-colors"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{r.title}</span>
                      <span
                        className={cn(
                          "block text-[10px] font-semibold",
                          r.overdue
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {r.overdue
                          ? "Atrasado"
                          : r.dueDate
                          ? new Date(r.dueDate).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Hoje"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* A receber hoje */}
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-500" />
                A receber hoje
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setView("receivable")}
              >
                {data.focus.overdueReceivablesCount > 0
                  ? `${data.focus.overdueReceivablesCount} vencidas`
                  : "Ver"}
              </Button>
            </div>
            {data.focus.receivablesToday.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">
                Nenhum recebível vence hoje.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {data.focus.receivablesToday.map((r) => (
                  <div key={r.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{r.description}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {r.person}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* A pagar hoje */}
          <div className="rounded-xl border border-border/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <ArrowDownToLine className="h-3.5 w-3.5 text-rose-500" />
                A pagar hoje
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setView("payable")}
              >
                {data.focus.overduePayablesCount > 0
                  ? `${data.focus.overduePayablesCount} vencidas`
                  : "Ver"}
              </Button>
            </div>
            {data.focus.payablesToday.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">
                Nenhuma conta vence hoje.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {data.focus.payablesToday.map((p) => (
                  <div key={p.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{p.description}</span>
                      {p.supplier && (
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {p.supplier}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {(t.overdueToReceive > 0 || t.overdueToPay > 0 || t.pendingPaymentCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.overdueToReceive > 0 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.overdueToReceive} recebíveis vencidos</p>
                <p className="text-xs text-muted-foreground">Quem tá devendo — cobrar urgente</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("receivable")}>Ver</Button>
            </motion.div>
          )}
          {t.overdueToPay > 0 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.overdueToPay} contas vencidas</p>
                <p className="text-xs text-muted-foreground">Quite para evitar juros</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("payable")}>Pagar</Button>
            </motion.div>
          )}
          {t.pendingPaymentCount > 0 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-accent-blue/30 bg-accent-blue/5 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-blue/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-accent-blue" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.pendingPaymentCount} entregues aguardando pgto</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(t.pendingPaymentTotal)} a receber</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("production")}>Ver</Button>
            </motion.div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Entradas vs Saídas</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Entradas</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Saídas</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-1">Carteiras</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição do saldo</p>
          {data.wallets.length === 0 ? (
            <EmptyState title="Nenhuma carteira" description="Cadastre suas contas" />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.wallets} dataKey="balance" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                      {data.wallets.map((w, i) => (<Cell key={i} fill={w.color} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                {data.wallets.map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: w.color }} />{w.name}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(w.balance)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold">Limite de Crédito</h3><p className="text-xs text-muted-foreground">Uso por cartão</p></div>
            <Button variant="ghost" size="sm" onClick={() => setView("wallets")}>Gerenciar</Button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {data.creditCards.map((c) => {
              const pct = c.totalLimit > 0 ? (c.usedLimit / c.totalLimit) * 100 : 0;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(c.usedLimit)} / {formatCurrency(c.totalLimit)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full" style={{ background: pct > 80 ? "#f43f5e" : pct > 50 ? "#f59e0b" : c.color }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% usado • {formatCurrency(c.available)} disponível</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold">Pipeline de Produção</h3><p className="text-xs text-muted-foreground">Status das ordens</p></div>
            <Button variant="ghost" size="sm" onClick={() => setView("production")}><Factory className="h-4 w-4 mr-1" /> Kanban</Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[{ label: "A fazer", items: data.production.todo, color: "#94a3b8" }, { label: "Fazendo", items: data.production.doing, color: "#3b82f6" }, { label: "Concluído", items: data.production.done, color: "#10b981" }, { label: "Entregue", items: data.production.delivered, color: "#8b5cf6" }].map((col, i) => (
              <motion.div key={col.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-xl border border-border/50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums" style={{ color: col.color }}>{col.items.length}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{col.label}</p>
              </motion.div>
            ))}
          </div>
          {data.production.pendingPayment.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{data.production.pendingPayment.length} serviço(s) entregue(s) aguardando pagamento</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(t.pendingPaymentTotal)}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-1">Meta de Depósito</h3>
          <p className="text-xs text-muted-foreground mb-4">Depósito mínimo obrigatório</p>
          {data.goal ? (
            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">{data.goal.name}</span><Target className="h-4 w-4 text-primary" /></div>
              <div className="relative h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: Math.min(100, (data.goal.current / data.goal.target) * 100) }]} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={20} fill="var(--primary)" background={{ fill: "var(--muted)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold">{((data.goal.current / data.goal.target) * 100).toFixed(0)}%</span></div>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Atual</span><span className="font-semibold">{formatCurrency(data.goal.current)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Objetivo</span><span className="font-semibold">{formatCurrency(data.goal.target)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Depósito mínimo</span><span className="font-semibold text-primary">{formatCurrency(data.goal.minDeposit)}</span></div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setView("goals")}>Depositar</Button>
            </div>
          ) : (
            <EmptyState icon={<Target className="h-6 w-6" />} title="Sem meta ativa" description="Crie sua meta de depósito" action={{ label: "Criar meta", onClick: () => setView("goals") }} />
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-1">Serviços por Tipo</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição do catálogo</p>
          {data.serviceTypes.length === 0 ? (<EmptyState title="Sem serviços" />) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.serviceTypes.sort((a, b) => b.count - a.count).map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-semibold">{s.count} ordens</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-1">Atividade Recente</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimas transações</p>
          {data.recentTx.length === 0 ? (<EmptyState title="Sem transações" description="Cadastre entradas e saídas" />) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2 text-xs">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "income" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                    {tx.type === "income" ? <ArrowUpFromLine className="h-3.5 w-3.5" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(tx.date)}{tx.client ? ` • ${tx.client.name}` : ""}{tx.wallet ? ` • ${tx.wallet.name}` : ""}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
