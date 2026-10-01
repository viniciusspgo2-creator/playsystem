"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, EmptyState, Card } from "@/components/ui-primitives/page-header";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { useFetch, apiPost, apiDelete, useRefresh } from "@/lib/api-hooks";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  Repeat,
  Wallet,
  CheckCircle2,
  Clock,
  Loader2,
  CalendarDays,
  Check,
  Undo2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MonthlyClient {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isMonthly: boolean;
  monthlyFee?: number | string | null;
  monthlyDay?: number | string | null;
}

interface Receivable {
  id: string;
  clientId?: string | null;
  description: string;
  amount: number | string;
  received: boolean;
  receivedAt?: string | Date | null;
}

interface WalletLite {
  id: string;
  name: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type FilterKey = "all" | "paid" | "unpaid";

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stringToHue(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export function MonthlyView() {
  const refresh = useRefresh();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [payFor, setPayFor] = useState<MonthlyClient | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthLabel = `${MONTH_NAMES_PT[now.getMonth()]} ${now.getFullYear()}`;

  // Fetch only monthly clients
  const clientsUrl =
    "/api/crud/clients?where=" +
    encodeURIComponent(JSON.stringify({ isMonthly: true }));
  // Fetch received receivables for the current month
  const receivablesUrl =
    "/api/crud/receivables?where=" +
    encodeURIComponent(
      JSON.stringify({
        received: true,
        receivedAt: {
          gte: monthStart.toISOString(),
          lt: nextMonthStart.toISOString(),
        },
      })
    );

  const { data: clients, loading: loadingClients } = useFetch<MonthlyClient[]>(clientsUrl);
  const { data: receivables, loading: loadingReceivables } = useFetch<Receivable[]>(receivablesUrl);
  const { data: wallets } = useFetch<WalletLite[]>("/api/crud/wallets");

  // Recebível do mês por cliente (para poder desfazer o "Marcar pago")
  // Só considera a MENSALIDADE — não pega outros recebimentos do mesmo cliente (ex.: OS)
  const paidReceivableByClient = useMemo(() => {
    const map = new Map<string, Receivable>();
    for (const r of receivables ?? []) {
      if (!r.clientId || !r.description?.startsWith("Mensalidade")) continue;
      const cur = map.get(r.clientId);
      if (!cur || new Date(r.receivedAt ?? 0) > new Date(cur.receivedAt ?? 0)) map.set(r.clientId, r);
    }
    return map;
  }, [receivables]);

  async function unmarkPaid(client: MonthlyClient) {
    const r = paidReceivableByClient.get(client.id);
    if (!r) return;
    if (
      !confirm(
        `Desmarcar o pagamento de ${client.name}? Os ${formatCurrency(
          Number(r.amount)
        )} saem da carteira e o mensalista volta para pendente.`
      )
    )
      return;
    setUndoingId(client.id);
    try {
      await apiDelete(`/api/crud/receivables/${r.id}`);
      toast.success("Pagamento desmarcado", {
        description: `${formatCurrency(Number(r.amount))} saíram do caixa — tudo reconciliado.`,
      });
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUndoingId(null);
    }
  }

  const safeClients = useMemo(() => clients ?? [], [clients]);

  // Set of client IDs that paid this month
  const paidClientIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of receivables ?? []) {
      if (r.clientId) set.add(r.clientId);
    }
    return set;
  }, [receivables]);

  const summary = useMemo(() => {
    const totalRevenue = safeClients.reduce(
      (sum, c) => sum + Number(c.monthlyFee ?? 0),
      0
    );
    const paidCount = safeClients.filter((c) => paidClientIds.has(c.id)).length;
    const unpaidCount = safeClients.length - paidCount;
    const paidRevenue = safeClients
      .filter((c) => paidClientIds.has(c.id))
      .reduce((sum, c) => sum + Number(c.monthlyFee ?? 0), 0);
    const pendingRevenue = totalRevenue - paidRevenue;
    return {
      totalRevenue,
      paidCount,
      unpaidCount,
      paidRevenue,
      pendingRevenue,
      total: safeClients.length,
    };
  }, [safeClients, paidClientIds]);

  const filteredClients = useMemo(() => {
    const list = [...safeClients].sort((a, b) => {
      const dayA = Number(a.monthlyDay ?? 1);
      const dayB = Number(b.monthlyDay ?? 1);
      if (dayA !== dayB) return dayA - dayB;
      return a.name.localeCompare(b.name);
    });
    if (filter === "paid")
      return list.filter((c) => paidClientIds.has(c.id));
    if (filter === "unpaid")
      return list.filter((c) => !paidClientIds.has(c.id));
    return list;
  }, [safeClients, filter, paidClientIds]);

  const loading = loadingClients || loadingReceivables;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensalistas"
        description={`Receita recorrente — ${monthLabel}`}
        icon={<Repeat className="h-5 w-5" />}
      />

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Receita Mensal"
          value={formatCurrency(summary.totalRevenue)}
          subtitle={`${formatNumber(summary.total)} mensalistas`}
          icon={<Wallet className="h-5 w-5" />}
          variant="brand"
          delay={0}
        />
        <MetricCard
          title="Recebido no Mês"
          value={formatCurrency(summary.paidRevenue)}
          subtitle={`${summary.paidCount} pagos`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="income"
          delay={0.05}
        />
        <MetricCard
          title="A Receber no Mês"
          value={formatCurrency(summary.pendingRevenue)}
          subtitle={`${summary.unpaidCount} pendentes`}
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          delay={0.1}
        />
        <MetricCard
          title="Taxa de Adesão"
          value={
            summary.total > 0
              ? `${((summary.paidCount / summary.total) * 100).toFixed(0)}%`
              : "0%"
          }
          subtitle={`${summary.paidCount}/${summary.total} em dia`}
          icon={<Repeat className="h-5 w-5" />}
          variant="blue"
          delay={0.15}
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "all", label: "Todos", count: summary.total },
            { key: "paid", label: "Pagos", count: summary.paidCount },
            { key: "unpaid", label: "Pendentes", count: summary.unpaidCount },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as FilterKey)}
            aria-pressed={filter === f.key}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-medium transition-colors border",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-foreground border-border hover:bg-muted"
            )}
          >
            {f.label}
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                filter === f.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </Card>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-7 w-7" />}
          title={
            summary.total === 0
              ? "Nenhum mensalista"
              : filter === "paid"
              ? "Nenhum pagamento registrado"
              : filter === "unpaid"
              ? "Nenhum pagamento pendente"
              : "Nada para mostrar"
          }
          description={
            summary.total === 0
              ? "Marque clientes como mensalistas na aba Clientes para vê-los aqui."
              : filter === "paid"
              ? `Nenhum mensalista pagou em ${monthLabel} ainda.`
              : filter === "unpaid"
              ? `Todos os mensalistas já pagaram em ${monthLabel}. Parabéns!`
              : undefined
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c, i) => {
                  const isPaid = paidClientIds.has(c.id);
                  const hue = stringToHue(c.name);
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        isPaid ? "bg-emerald-500/[0.04]" : "hover:bg-muted/40"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback
                              className="text-xs font-bold text-white"
                              style={{
                                background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${
                                  (hue + 30) % 360
                                } 70% 45%))`,
                              }}
                            >
                              {getInitials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.email && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {c.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatCurrency(Number(c.monthlyFee ?? 0))}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          Dia {String(Number(c.monthlyDay ?? 1)).padStart(2, "0")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                            <Check className="h-3 w-3" /> Pago
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30"
                          >
                            <Clock className="h-3 w-3" /> Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPaid ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-muted-foreground italic">
                              Registrado em {monthLabel}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              title="Desmarcar pagamento (estorna do caixa)"
                              onClick={() => unmarkPaid(c)}
                              disabled={undoingId === c.id}
                            >
                              {undoingId === c.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setPayFor(c)} className="h-8">
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Marcar pago
                          </Button>
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/60">
            {filteredClients.map((c, i) => {
              const isPaid = paidClientIds.has(c.id);
              const hue = stringToHue(c.name);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "p-4",
                    isPaid && "bg-emerald-500/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${
                            (hue + 30) % 360
                          } 70% 45%))`,
                        }}
                      >
                        {getInitials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence dia{" "}
                        {String(Number(c.monthlyDay ?? 1)).padStart(2, "0")}
                        {c.phone ? ` • ${c.phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums">
                        {formatCurrency(Number(c.monthlyFee ?? 0))}
                      </p>
                      {isPaid ? (
                        <Badge className="mt-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check className="h-3 w-3" /> Pago
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="mt-1 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        >
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isPaid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unmarkPaid(c)}
                      disabled={undoingId === c.id}
                      className="w-full mt-3 h-9"
                    >
                      {undoingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Desmarcar pagamento
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setPayFor(c)} className="w-full mt-3 h-9">
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Marcar como pago
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Helpful footer note */}
      {summary.unpaidCount > 0 && filter !== "paid" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3"
        >
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {summary.unpaidCount} mensalista{summary.unpaidCount > 1 ? "s" : ""} pendente
              {summary.unpaidCount > 1 ? "s" : ""} em {monthLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(summary.pendingRevenue)} em receita a receber. Use o
              botão <span className="font-medium text-foreground">“Marcar pago”</span>{" "}
              para registrar o pagamento e o valor cai direto na carteira.
            </p>
          </div>
        </motion.div>
      )}

      {payFor && (
        <MarkPaidDialog
          client={payFor}
          wallets={wallets ?? []}
          monthLabel={monthLabel}
          onClose={() => setPayFor(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marcar pago: carteira obrigatória + lançamento no caixa             */
/* ------------------------------------------------------------------ */

function parseMoneyBR(v: string): number {
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function MarkPaidDialog({
  client,
  wallets,
  monthLabel,
  onClose,
}: {
  client: MonthlyClient;
  wallets: WalletLite[];
  monthLabel: string;
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const fee = Number(client.monthlyFee ?? 0);
  const [amount, setAmount] = useState(fee > 0 ? String(fee).replace(".", ",") : "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [method, setMethod] = useState("pix");
  const [loading, setLoading] = useState(false);

  const walletName = wallets.find((w) => w.id === walletId)?.name;

  async function save() {
    const amt = parseMoneyBR(amount);
    if (amt <= 0) return toast.error("Informe o valor recebido (maior que zero).");
    if (wallets.length === 0)
      return toast.error(
        "Você ainda não tem carteiras. Crie uma na aba Carteiras para o dinheiro entrar no caixa."
      );
    if (!walletId)
      return toast.error("Escolha a carteira que recebeu o dinheiro — o valor precisa entrar no caixa.");
    setLoading(true);
    try {
      const today = new Date();
      const dueDay = Number(client.monthlyDay ?? 1);
      const dueDate = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
      await apiPost("/api/crud/receivables", {
        clientId: client.id,
        description: `Mensalidade ${monthLabel} — ${client.name}`,
        amount: amt,
        dueDate: dueDate.toISOString(),
        received: true,
        receivedAt: new Date(`${paidAt}T12:00:00`).toISOString(),
        paymentMethod: method,
        walletId,
        notes: "Recebimento registrado pela visão de Mensalistas.",
      });
      toast.success(`${client.name} pagou • ${formatCurrency(amt)} no caixa`, {
        description: walletName
          ? `Entrada lançada na carteira ${walletName} e em Entradas & Saídas (Mensalidade).`
          : "Entrada lançada no caixa.",
      });
      refresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar pago — {client.name}</DialogTitle>
          <DialogDescription>
            Mensalidade de {monthLabel} • vence dia{" "}
            {String(Number(client.monthlyDay ?? 1)).padStart(2, "0")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Valor recebido (R$)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
                placeholder="500,00"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Carteira que recebeu</Label>
              <Select value={walletId || "__none__"} onValueChange={(v) => setWalletId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {parseMoneyBR(amount) > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <Wallet className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-sm min-w-0">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Entrada de {formatCurrency(parseMoneyBR(amount))} no caixa
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {walletName ? `Carteira ${walletName}` : "escolha a carteira"} • vira lançamento
                  "Mensalidade" em Entradas & Saídas
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar {parseMoneyBR(amount) > 0 ? formatCurrency(parseMoneyBR(amount)) : "pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
