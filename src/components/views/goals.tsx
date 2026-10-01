"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, useRefresh, apiPost } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Target,
  Plus,
  TrendingUp,
  Trophy,
  Wallet as WalletIcon,
  Lock,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Goal {
  id: string;
  name: string;
  targetAmount: number | string;
  currentAmount: number | string;
  minDeposit: number | string;
  deadline?: string | Date | null;
  walletId?: string | null;
  wallet?: { id: string; name: string } | null;
  active: boolean;
  createdAt: string | Date;
}

interface Wallet {
  id: string;
  name: string;
}

export function GoalsView() {
  const { data: goalsData, loading } = useFetch<Goal[]>("/api/crud/goals");
  const { data: walletsData } = useFetch<Wallet[]>("/api/crud/wallets");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);

  const goals = goalsData || [];
  const wallets = walletsData || [];

  const activeGoals = useMemo(() => goals.filter((g) => g.active), [goals]);
  const pastGoals = useMemo(() => goals.filter((g) => !g.active), [goals]);
  const activeGoal = activeGoals[0] ?? null;
  const otherActiveGoals = activeGoals.slice(1);

  const summary = useMemo(() => {
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    const completed = goals.filter((g) => Number(g.currentAmount) >= Number(g.targetAmount) && Number(g.targetAmount) > 0).length;
    return { totalSaved, completed, total: goals.length, activeCount: activeGoals.length };
  }, [goals, activeGoals.length]);

  const goalFields: Field[] = [
    { name: "name", label: "Nome da Meta", type: "text", placeholder: "Ex: Reserva de Emergência", required: true },
    { name: "targetAmount", label: "Valor Alvo", type: "number", step: "0.01", required: true },
    { name: "currentAmount", label: "Valor Atual", type: "number", step: "0.01", default: 0 },
    { name: "minDeposit", label: "Depósito Mínimo (obrigatório)", type: "number", step: "0.01", default: 80, required: true },
    { name: "deadline", label: "Prazo", type: "date" },
    {
      name: "walletId",
      label: "Carteira Vinculada",
      type: "select",
      options: wallets.map((w) => ({ value: w.id, label: w.name })),
      placeholder: "Selecione...",
    },
    { name: "active", label: "Ativa", type: "switch", default: true },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Metas" description="Carregando..." icon={<Target className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas de Depósito"
        description="Acompanhe seus objetivos com depósito mínimo obrigatório"
        icon={<Target className="h-5 w-5" />}
        action={{
          label: "Nova Meta",
          onClick: () => {
            setEditingGoal(null);
            setModalOpen(true);
          },
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Poupado"
          value={formatCurrency(summary.totalSaved)}
          subtitle="entre todas as metas"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="income"
          delay={0}
        />
        <MetricCard
          title="Metas Concluídas"
          value={summary.completed}
          subtitle={`de ${summary.total} totais`}
          icon={<Trophy className="h-5 w-5" />}
          variant="brand"
          delay={0.05}
        />
        <MetricCard
          title="Metas Ativas"
          value={summary.activeCount}
          subtitle="em andamento"
          icon={<Target className="h-5 w-5" />}
          variant="blue"
          delay={0.1}
        />
      </div>

      {/* Active goal prominent display */}
      {activeGoal ? (
        <ActiveGoalDisplay
          goal={activeGoal}
          onDeposit={() => setDepositGoal(activeGoal)}
          onEdit={() => {
            setEditingGoal(activeGoal);
            setModalOpen(true);
          }}
        />
      ) : (
        <Card>
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Nenhuma meta ativa"
            description="Crie sua primeira meta de depósito para começar a poupar"
            action={{
              label: "Criar Meta",
              onClick: () => {
                setEditingGoal(null);
                setModalOpen(true);
              },
            }}
          />
        </Card>
      )}

      {/* Other active goals */}
      {otherActiveGoals.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">Outras Metas Ativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherActiveGoals.map((g, i) => (
              <GoalCard
                key={g.id}
                goal={g}
                onDeposit={() => setDepositGoal(g)}
                onEdit={() => {
                  setEditingGoal(g);
                  setModalOpen(true);
                }}
                delay={i * 0.05}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past / inactive goals */}
      {pastGoals.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">Metas Concluídas / Inativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastGoals.map((g, i) => (
              <GoalCard
                key={g.id}
                goal={g}
                onDeposit={() => setDepositGoal(g)}
                onEdit={() => {
                  setEditingGoal(g);
                  setModalOpen(true);
                }}
                delay={i * 0.05}
              />
            ))}
          </div>
        </section>
      )}

      {/* Form modal */}
      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingGoal ? "Editar Meta" : "Nova Meta"}
        description="Defina um objetivo com depósito mínimo obrigatório"
        fields={goalFields}
        initialData={
          editingGoal
            ? {
                name: editingGoal.name,
                targetAmount: Number(editingGoal.targetAmount) || 0,
                currentAmount: Number(editingGoal.currentAmount) || 0,
                minDeposit: Number(editingGoal.minDeposit) || 0,
                deadline: editingGoal.deadline
                  ? new Date(editingGoal.deadline).toISOString().slice(0, 10)
                  : "",
                walletId: editingGoal.walletId ?? "",
                active: editingGoal.active,
              }
            : undefined
        }
        endpoint="/api/crud/goals"
        id={editingGoal?.id}
      />

      {/* Deposit dialog */}
      <DepositDialog
        open={!!depositGoal}
        onOpenChange={(v) => !v && setDepositGoal(null)}
        goal={depositGoal}
      />
    </div>
  );
}

function ActiveGoalDisplay({
  goal,
  onDeposit,
  onEdit,
}: {
  goal: Goal;
  onDeposit: () => void;
  onEdit: () => void;
}) {
  const target = Number(goal.targetAmount) || 0;
  const current = Number(goal.currentAmount) || 0;
  const min = Number(goal.minDeposit) || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);
  const deadline = goal.deadline ? new Date(goal.deadline) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Radial chart */}
          <div className="flex flex-col items-center">
            <div className="relative h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  data={[{ value: pct }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={20}
                    fill="var(--primary)"
                    background={{ fill: "var(--muted)" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold tabular-nums">{pct.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">concluído</p>
              </div>
            </div>
          </div>
          {/* Details */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <Badge className="bg-primary/15 text-primary">
                  <Target className="h-3 w-3 mr-1" /> Meta Ativa
                </Badge>
                <h2 className="text-2xl font-bold mt-2 truncate">{goal.name}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onEdit} className="shrink-0">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium">Valor Atual</span>
                </div>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(current)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                <span className="text-sm font-medium">Objetivo</span>
                <span className="font-bold tabular-nums">{formatCurrency(target)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Depósito Mínimo</span>
                </div>
                <span className="font-bold tabular-nums text-primary">{formatCurrency(min)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                <span className="text-sm text-muted-foreground">Faltam</span>
                <span className="font-bold tabular-nums">{formatCurrency(remaining)}</span>
              </div>
              {deadline && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">{formatDate(deadline)}</span>
                </div>
              )}
              {goal.wallet?.name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Carteira</span>
                  <span className="font-medium">{goal.wallet.name}</span>
                </div>
              )}
            </div>
            <Button className="w-full mt-4" size="lg" onClick={onDeposit}>
              <TrendingUp className="h-4 w-4 mr-2" /> Depositar
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function GoalCard({
  goal,
  onDeposit,
  onEdit,
  delay,
}: {
  goal: Goal;
  onDeposit: () => void;
  onEdit: () => void;
  delay: number;
}) {
  const target = Number(goal.targetAmount) || 0;
  const current = Number(goal.currentAmount) || 0;
  const min = Number(goal.minDeposit) || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const completed = current >= target && target > 0;
  const deadline = goal.deadline ? new Date(goal.deadline) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -3 }}
    >
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {completed ? (
              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : (
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{goal.name}</p>
              {deadline && <p className="text-[10px] text-muted-foreground">Prazo: {formatDate(deadline)}</p>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              {formatCurrency(current)}
            </span>
            <span className="text-muted-foreground tabular-nums">{formatCurrency(target)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Mín: {formatCurrency(min)}
            </span>
            {goal.wallet?.name && (
              <span className="flex items-center gap-1">
                <WalletIcon className="h-3 w-3" /> {goal.wallet.name}
              </span>
            )}
          </div>
        </div>
        <Button
          variant={completed ? "outline" : "default"}
          size="sm"
          className="w-full mt-3"
          onClick={onDeposit}
        >
          <TrendingUp className="h-3.5 w-3.5 mr-1" /> {completed ? "Depositar mesmo assim" : "Depositar"}
        </Button>
      </Card>
    </motion.div>
  );
}

function DepositDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: Goal | null;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useRefresh();

  const minDeposit = goal ? Number(goal.minDeposit) : 0;
  const amountNum = parseFloat(amount.replace(",", ".")) || 0;
  const valid = amountNum >= minDeposit && amountNum > 0;

  // Reset amount when dialog closes
  useEffect(() => {
    if (!open) setAmount("");
  }, [open, goal?.id]);

  async function submit() {
    if (!goal) return;
    if (!valid) {
      toast.error(`Depósito mínimo: ${formatCurrency(minDeposit)}`);
      return;
    }
    setLoading(true);
    try {
      const current = Number(goal.currentAmount) || 0;
      const newCurrent = current + amountNum;
      // Update goal currentAmount (backend sets to new total)
      await apiPost(`/api/crud/goals/${goal.id}`, { currentAmount: newCurrent }, "PUT");
      // Create income transaction in linked wallet (backend auto-updates wallet balance)
      if (goal.walletId) {
        try {
          await apiPost("/api/crud/transactions", {
            type: "income",
            category: "Meta",
            description: `Depósito para meta: ${goal.name}`,
            amount: amountNum,
            walletId: goal.walletId,
            date: new Date().toISOString(),
          });
        } catch (e) {
          // Best effort — the goal update already succeeded
          console.warn("Income transaction failed", e);
        }
      }
      toast.success("Depósito registrado com sucesso!");
      refresh();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Depositar na Meta</DialogTitle>
          <DialogDescription>
            {goal?.name} • Depósito mínimo obrigatório: {formatCurrency(minDeposit)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="amount" className="block mb-1.5 text-xs font-medium">
              Valor do Depósito
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Mínimo: ${formatCurrency(minDeposit)}`}
              className="h-10"
              autoFocus
            />
            {amount !== "" && !valid && (
              <p className="text-xs text-destructive mt-1.5">
                O valor deve ser no mínimo {formatCurrency(minDeposit)}.
              </p>
            )}
            {valid && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
                Novo saldo: {formatCurrency((Number(goal?.currentAmount) || 0) + amountNum)}
              </p>
            )}
          </div>
          {goal?.wallet?.name && (
            <div className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/50 border border-border/40">
              Será criada uma entrada de renda na carteira{" "}
              <strong className="text-foreground">{goal.wallet.name}</strong>.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Depositar {formatCurrency(amountNum)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
