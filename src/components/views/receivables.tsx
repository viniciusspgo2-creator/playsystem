"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import {
  PageHeader,
  Card,
  EmptyState,
} from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, apiPost, useRefresh } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  HandCoins,
  Plus,
  Pencil,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Wallet as WalletIcon,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Receivable {
  id: string;
  clientId?: string | null;
  clientName?: string | null;
  description: string;
  amount: number | string;
  dueDate: string;
  received: boolean;
  receivedAt?: string | null;
  paymentMethod?: string;
  walletId?: string | null;
  orderId?: string | null;
  notes?: string | null;
  client?: { id: string; name: string } | null;
  wallet?: { id: string; name: string } | null;
  order?: { id: string; title: string; number: string } | null;
}

interface Client {
  id: string;
  name: string;
}
interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
}
interface Order {
  id: string;
  number: string;
  title: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

function isOverdue(r: Receivable): boolean {
  if (r.received) return false;
  const due = new Date(r.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function statusBadge(r: Receivable) {
  if (r.received) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Recebida
      </Badge>
    );
  }
  if (isOverdue(r)) {
    return (
      <Badge
        variant="outline"
        className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Vencida
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-accent-blue/15 text-accent-blue border-accent-blue/20"
    >
      <Clock className="h-3 w-3 mr-1" />
      Pendente
    </Badge>
  );
}

export function ReceivablesView() {
  const [tab, setTab] = useState<"pending" | "received" | "overdue">("pending");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [recvTarget, setRecvTarget] = useState<Receivable | null>(null);
  const [recvWallet, setRecvWallet] = useState<string>("");
  const [receiving, setReceiving] = useState(false);

  const { data: receivables, loading } = useFetch<Receivable[]>(
    "/api/crud/receivables"
  );
  const { data: clients } = useFetch<Client[]>("/api/crud/clients");
  const { data: wallets } = useFetch<Wallet[]>("/api/crud/wallets");
  const { data: orders } = useFetch<Order[]>("/api/crud/orders");
  const refresh = useRefresh();

  const clientOptions = useMemo(
    () => (clients ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clients]
  );
  const walletOptions = useMemo(
    () => (wallets ?? []).map((w) => ({ value: w.id, label: w.name })),
    [wallets]
  );
  const orderOptions = useMemo(
    () =>
      (orders ?? []).map((o) => ({
        value: o.id,
        label: o.number ? `${o.number} — ${o.title}` : o.title,
      })),
    [orders]
  );

  const stats = useMemo(() => {
    if (!receivables)
      return { pending: 0, overdue: 0, receivedMonth: 0 };
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    let pending = 0;
    let overdue = 0;
    let receivedMonth = 0;
    for (const r of receivables) {
      const amt = Number(r.amount) || 0;
      if (r.received) {
        if (r.receivedAt) {
          const d = new Date(r.receivedAt);
          if (d.getMonth() === month && d.getFullYear() === year) {
            receivedMonth += amt;
          }
        }
      } else if (isOverdue(r)) {
        overdue += amt;
        pending += amt;
      } else {
        pending += amt;
      }
    }
    return { pending, overdue, receivedMonth };
  }, [receivables]);

  const filtered = useMemo(() => {
    if (!receivables) return [];
    return receivables
      .filter((r) => {
        if (tab === "received") return r.received;
        if (tab === "overdue") return !r.received && isOverdue(r);
        return !r.received && !isOverdue(r);
      })
      .filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          r.description?.toLowerCase().includes(s) ||
          r.client?.name?.toLowerCase().includes(s) ||
          r.clientName?.toLowerCase().includes(s) ||
          r.notes?.toLowerCase().includes(s)
        );
      })
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
  }, [receivables, tab, search]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(r: Receivable) {
    setEditing(r);
    setModalOpen(true);
  }

  function openReceive(r: Receivable) {
    setRecvTarget(r);
    setRecvWallet(r.walletId ?? "");
  }

  async function confirmReceive() {
    if (!recvTarget) return;
    if (!recvWallet) {
      toast.error("Selecione uma carteira para depositar.");
      return;
    }
    setReceiving(true);
    try {
      await apiPost(`/api/crud/receivables/${recvTarget.id}`, {
        received: true,
        walletId: recvWallet || null,
      }, "PUT");
      toast.success("Recebimento confirmado!");
      refresh();
      setRecvTarget(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReceiving(false);
    }
  }

  function buildFields(): Field[] {
    const due = editing?.dueDate
      ? new Date(editing.dueDate).toISOString().slice(0, 10)
      : "";
    return [
      {
        name: "person",
        label: "Quem vai pagar?",
        type: "person",
        options: clientOptions,
        idField: "clientId",
        nameField: "clientName",
        placeholder: "Nome de quem deve — cadastrado ou avulso",
        hint: "Não precisa cadastrar cliente: digite o nome da pessoa avulsa e pronto. Use as observações para lembrar quem é.",
        default: editing?.client?.name ?? editing?.clientName ?? "",
      },
      {
        name: "description",
        label: "Descrição",
        type: "text",
        required: true,
        placeholder: "Ex: Pagamento do serviço de vídeo",
        default: editing?.description ?? "",
      },
      {
        name: "amount",
        label: "Valor (R$)",
        type: "number",
        required: true,
        step: "0.01",
        placeholder: "0.00",
        default: editing?.amount ? String(editing.amount) : "",
      },
      {
        name: "dueDate",
        label: "Data de Vencimento",
        type: "date",
        required: true,
        default: due,
      },
      {
        name: "paymentMethod",
        label: "Forma de Recebimento",
        type: "select",
        options: PAYMENT_METHODS,
        default: editing?.paymentMethod ?? "",
      },
      {
        name: "walletId",
        label: "Carteira (depósito)",
        type: "select",
        options: walletOptions,
        default: editing?.walletId ?? "",
      },
      {
        name: "orderId",
        label: "Ordem de Serviço",
        type: "select",
        options: orderOptions,
        placeholder: "Nenhuma (opcional)",
        default: editing?.orderId ?? "",
      },
      {
        name: "notes",
        label: "Observações",
        type: "textarea",
        placeholder: "Quem é? Contexto, combinado, telefone... (importante para avulsos)",
        default: editing?.notes ?? "",
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        description="Acompanhe valores que clientes te devem"
        icon={<HandCoins className="h-5 w-5" />}
        action={{
          label: "Nova Conta a Receber",
          onClick: openNew,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="A Receber (Pendentes)"
          value={formatCurrency(stats.pending - stats.overdue)}
          subtitle="Apenas não vencidas"
          icon={<Clock className="h-5 w-5" />}
          variant="blue"
          delay={0}
        />
        <MetricCard
          title="Vencidas"
          value={formatCurrency(stats.overdue)}
          subtitle="Cobrar urgente"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="expense"
          delay={0.05}
        />
        <MetricCard
          title="Recebidas (mês)"
          value={formatCurrency(stats.receivedMonth)}
          subtitle="Total entradas no mês"
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="income"
          delay={0.1}
        />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="received">Recebidas</TabsTrigger>
              <TabsTrigger value="overdue">Vencidas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            Lançamentos{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<HandCoins className="h-7 w-7" />}
            title="Nenhuma conta encontrada"
            description={
              tab === "pending"
                ? "Você não tem contas a receber pendentes."
                : "Nenhuma conta nesta categoria."
            }
            action={
              tab === "pending"
                ? { label: "Nova Conta", onClick: openNew }
                : undefined
            }
          />
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-1 -mr-1 space-y-2">
            <AnimatePresence initial={false}>
              {filtered.map((r, i) => {
                const amt = Number(r.amount) || 0;
                const overdue = isOverdue(r);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                    whileHover={{ y: -1 }}
                    className={`group flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border transition-colors ${
                      overdue
                        ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
                        : "border-border/50 hover:border-border hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          r.received
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : overdue
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-accent-blue/15 text-accent-blue"
                        }`}
                      >
                        <HandCoins className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {r.description}
                          </p>
                          {statusBadge(r)}
                          {!r.client && r.clientName && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]"
                            >
                              Avulso
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {r.client ? (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {r.client.name} •{" "}
                            </span>
                          ) : r.clientName ? (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {r.clientName} •{" "}
                            </span>
                          ) : null}
                          Vence:{" "}
                          <span
                            className={
                              overdue && !r.received
                                ? "text-rose-600 dark:text-rose-400 font-medium"
                                : ""
                            }
                          >
                            {formatDate(r.dueDate)}
                          </span>
                          {r.received && r.receivedAt
                            ? ` • Recebido em ${formatDate(r.receivedAt)}`
                            : ""}
                          {r.wallet ? ` • ${r.wallet.name}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(amt)}
                      </p>
                      {!r.received && (
                        <Button
                          size="sm"
                          onClick={() => openReceive(r)}
                          className="h-8"
                        >
                          Marcar recebido
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={() => openEdit(r)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>

      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar Conta a Receber" : "Nova Conta a Receber"}
        description="Pode ser de um cliente cadastrado OU de pessoa avulsa — só digitar o nome, sem precisar cadastrar. Ao marcar como recebido, o valor entra na carteira selecionada."
        fields={buildFields()}
        initialData={editing ?? undefined}
        endpoint="/api/crud/receivables"
        id={editing?.id}
      />

      {/* Receive dialog */}
      <Dialog
        open={!!recvTarget}
        onOpenChange={(v) => !v && setRecvTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receber valor</DialogTitle>
            <DialogDescription>
              {recvTarget
                ? `${recvTarget.description} — ${formatCurrency(
                    Number(recvTarget.amount) || 0
                  )}`
                : ""}
              <br />
              Escolha a carteira onde o valor será depositado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label className="block mb-1.5 text-xs font-medium">
                <WalletIcon className="h-3 w-3 inline mr-1" />
                Carteira para depósito
              </Label>
              <Select value={recvWallet} onValueChange={setRecvWallet}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha a carteira" />
                </SelectTrigger>
                <SelectContent>
                  {walletOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhuma carteira cadastrada
                    </SelectItem>
                  ) : (
                    walletOptions.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              O valor será adicionado automaticamente ao saldo da carteira
              selecionada.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecvTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmReceive} disabled={receiving}>
              {receiving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
