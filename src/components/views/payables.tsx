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
  ReceiptText,
  Plus,
  Pencil,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wallet as WalletIcon,
  CreditCard as CardIcon,
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

interface Payable {
  id: string;
  description: string;
  amount: number | string;
  dueDate: string;
  paid: boolean;
  paidAt?: string | null;
  paymentMethod?: string;
  walletId?: string | null;
  creditCardId?: string | null;
  category?: string | null;
  supplier?: string | null;
  notes?: string | null;
  wallet?: { id: string; name: string } | null;
  creditCard?: { id: string; name: string } | null;
}

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
}
interface CreditCard {
  id: string;
  name: string;
  totalLimit: number;
  usedLimit: number;
  color: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

const CATEGORIES = [
  { value: "supplier", label: "Fornecedor" },
  { value: "tax", label: "Imposto" },
  { value: "service", label: "Serviço" },
  { value: "rent", label: "Aluguel" },
  { value: "equipment", label: "Equipamento" },
  { value: "other", label: "Outro" },
];

function isOverdue(p: Payable): boolean {
  if (p.paid) return false;
  const due = new Date(p.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function statusBadge(p: Payable) {
  if (p.paid) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Paga
      </Badge>
    );
  }
  if (isOverdue(p)) {
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
      className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
    >
      <Clock className="h-3 w-3 mr-1" />
      Pendente
    </Badge>
  );
}

export function PayablesView() {
  const [tab, setTab] = useState<"pending" | "paid" | "overdue">("pending");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payable | null>(null);
  const [payTarget, setPayTarget] = useState<Payable | null>(null);
  const [payWallet, setPayWallet] = useState<string>("");
  const [payCard, setPayCard] = useState<string>("");
  const [paying, setPaying] = useState(false);

  const { data: payables, loading } = useFetch<Payable[]>(
    "/api/crud/payables"
  );
  const { data: wallets } = useFetch<Wallet[]>("/api/crud/wallets");
  const { data: cards } = useFetch<CreditCard[]>("/api/crud/credit-cards");
  const refresh = useRefresh();

  const walletOptions = useMemo(
    () => (wallets ?? []).map((w) => ({ value: w.id, label: w.name })),
    [wallets]
  );
  const cardOptions = useMemo(
    () => (cards ?? []).map((c) => ({ value: c.id, label: c.name })),
    [cards]
  );

  const stats = useMemo(() => {
    if (!payables) return { pending: 0, overdue: 0, paidMonth: 0 };
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    let pending = 0;
    let overdue = 0;
    let paidMonth = 0;
    for (const p of payables) {
      const amt = Number(p.amount) || 0;
      if (p.paid) {
        if (p.paidAt) {
          const d = new Date(p.paidAt);
          if (d.getMonth() === month && d.getFullYear() === year) {
            paidMonth += amt;
          }
        }
      } else if (isOverdue(p)) {
        overdue += amt;
        pending += amt;
      } else {
        pending += amt;
      }
    }
    return { pending, overdue, paidMonth };
  }, [payables]);

  const filtered = useMemo(() => {
    if (!payables) return [];
    return payables
      .filter((p) => {
        if (tab === "paid") return p.paid;
        if (tab === "overdue") return !p.paid && isOverdue(p);
        return !p.paid && !isOverdue(p);
      })
      .filter((p) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          p.description?.toLowerCase().includes(s) ||
          p.supplier?.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payables, tab, search]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Payable) {
    setEditing(p);
    setModalOpen(true);
  }

  function openPay(p: Payable) {
    setPayTarget(p);
    setPayWallet(p.walletId ?? "");
    setPayCard(p.creditCardId ?? "");
  }

  async function confirmPay() {
    if (!payTarget) return;
    if (!payWallet && !payCard) {
      toast.error("Selecione uma carteira ou cartão para pagar.");
      return;
    }
    setPaying(true);
    try {
      await apiPost(`/api/crud/payables/${payTarget.id}`, {
        paid: true,
        walletId: payWallet || null,
        creditCardId: payCard || null,
      }, "PUT");
      toast.success("Conta marcada como paga!");
      refresh();
      setPayTarget(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPaying(false);
    }
  }

  function buildFields(): Field[] {
    const due = editing?.dueDate
      ? new Date(editing.dueDate).toISOString().slice(0, 10)
      : "";
    return [
      {
        name: "description",
        label: "Descrição",
        type: "text",
        required: true,
        placeholder: "Ex: Compra de insumos",
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
        name: "category",
        label: "Categoria",
        type: "select",
        options: CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
        default: editing?.category ?? "other",
      },
      {
        name: "supplier",
        label: "Fornecedor",
        type: "text",
        placeholder: "Nome do fornecedor",
        default: editing?.supplier ?? "",
      },
      {
        name: "paymentMethod",
        label: "Forma de Pagamento",
        type: "select",
        options: PAYMENT_METHODS,
        default: editing?.paymentMethod ?? "",
      },
      {
        name: "walletId",
        label: "Carteira",
        type: "select",
        options: walletOptions,
        default: editing?.walletId ?? "",
      },
      {
        name: "creditCardId",
        label: "Cartão de Crédito",
        type: "select",
        options: cardOptions,
        default: editing?.creditCardId ?? "",
      },
      {
        name: "notes",
        label: "Observações",
        type: "textarea",
        placeholder: "Notas internas...",
        default: editing?.notes ?? "",
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        description="Acompanhe e quite suas contas pendentes"
        icon={<ReceiptText className="h-5 w-5" />}
        action={{
          label: "Nova Conta a Pagar",
          onClick: openNew,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="A Pagar (Pendentes)"
          value={formatCurrency(stats.pending - stats.overdue)}
          subtitle="Apenas não vencidas"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          delay={0}
        />
        <MetricCard
          title="Vencidas"
          value={formatCurrency(stats.overdue)}
          subtitle="Quitar urgente"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="expense"
          delay={0.05}
        />
        <MetricCard
          title="Pagas (mês)"
          value={formatCurrency(stats.paidMonth)}
          subtitle="Total quitado no mês"
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
              <TabsTrigger value="paid">Pagas</TabsTrigger>
              <TabsTrigger value="overdue">Vencidas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou fornecedor..."
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
            icon={<ReceiptText className="h-7 w-7" />}
            title="Nenhuma conta encontrada"
            description={
              tab === "pending"
                ? "Você não tem contas pendentes. Parabéns!"
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
              {filtered.map((p, i) => {
                const amt = Number(p.amount) || 0;
                const overdue = isOverdue(p);
                return (
                  <motion.div
                    key={p.id}
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
                          p.paid
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : overdue
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {p.description}
                          </p>
                          {statusBadge(p)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p.supplier ? `Fornecedor: ${p.supplier} • ` : ""}
                          Vence:{" "}
                          <span
                            className={
                              overdue && !p.paid
                                ? "text-rose-600 dark:text-rose-400 font-medium"
                                : ""
                            }
                          >
                            {formatDate(p.dueDate)}
                          </span>
                          {p.paid && p.paidAt
                            ? ` • Paga em ${formatDate(p.paidAt)}`
                            : ""}
                          {p.wallet ? ` • ${p.wallet.name}` : ""}
                          {p.creditCard ? ` • ${p.creditCard.name}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(amt)}
                      </p>
                      {!p.paid && (
                        <Button
                          size="sm"
                          onClick={() => openPay(p)}
                          className="h-8"
                        >
                          Marcar paga
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={() => openEdit(p)}
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
        title={editing ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}
        description="Cadastre uma conta a pagar. Ao marcar como paga, o valor será deduzido da carteira ou cartão selecionado."
        fields={buildFields()}
        initialData={editing ?? undefined}
        endpoint="/api/crud/payables"
        id={editing?.id}
      />

      {/* Pay dialog */}
      <Dialog
        open={!!payTarget}
        onOpenChange={(v) => !v && setPayTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar conta</DialogTitle>
            <DialogDescription>
              {payTarget
                ? `${payTarget.description} — ${formatCurrency(
                    Number(payTarget.amount) || 0
                  )}`
                : ""}
              <br />
              Escolha de onde o valor será deduzido.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label className="block mb-1.5 text-xs font-medium">
                <WalletIcon className="h-3 w-3 inline mr-1" />
                Carteira
              </Label>
              <Select
                value={payWallet}
                onValueChange={(v) => setPayWallet(v === "__none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha a carteira" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhuma —</SelectItem>
                  {walletOptions.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block mb-1.5 text-xs font-medium">
                <CardIcon className="h-3 w-3 inline mr-1" />
                Cartão de Crédito
              </Label>
              <Select
                value={payCard}
                onValueChange={(v) => setPayCard(v === "__none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha o cartão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhum —</SelectItem>
                  {cardOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              O valor será deduzido automaticamente da carteira ou adicionado ao
              limite usado do cartão.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmPay} disabled={paying}>
              {paying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
