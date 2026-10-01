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
import { useFetch } from "@/lib/api-hooks";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Scale,
  Pencil,
  Wallet as WalletIcon,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type TxType = "income" | "expense";
type Category =
  | "service"
  | "fixed"
  | "variable"
  | "salary"
  | "investment"
  | "other";

interface Tx {
  id: string;
  type: TxType;
  category: Category | string;
  description: string;
  amount: number | string;
  date: string;
  paymentMethod?: string;
  walletId?: string | null;
  creditCardId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  orderId?: string | null;
  recurring?: boolean;
  client?: { id: string; name: string } | null;
  order?: { id: string; title: string; number: string } | null;
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
interface Client {
  id: string;
  name: string;
}
interface Order {
  id: string;
  number: string;
  title: string;
}
interface CreditCard {
  id: string;
  name: string;
  totalLimit: number;
  usedLimit: number;
  color: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  service: "Serviço",
  fixed: "Fixa",
  variable: "Variável",
  salary: "Salário",
  investment: "Investimento",
  other: "Outro",
};

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

function categoryBadgeClass(category: string): string {
  switch (category) {
    case "service":
      return "bg-accent-blue/15 text-accent-blue border-accent-blue/20";
    case "fixed":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "variable":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "salary":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "investment":
      return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function paymentLabel(method?: string): string {
  if (!method) return "-";
  return PAYMENT_METHODS.find((p) => p.value === method)?.label ?? method;
}

export function TransactionsView() {
  const [tab, setTab] = useState<"all" | "income" | "expense">("all");
  const [category, setCategory] = useState<string>("all");
  const [walletFilter, setWalletFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const { data: txs, loading } = useFetch<Tx[]>("/api/crud/transactions");
  const { data: wallets } = useFetch<Wallet[]>("/api/crud/wallets");
  const { data: clients } = useFetch<Client[]>("/api/crud/clients");
  const { data: cards } = useFetch<CreditCard[]>("/api/crud/credit-cards");
  const { data: orders } = useFetch<Order[]>("/api/crud/orders");

  const walletOptions = useMemo(
    () => (wallets ?? []).map((w) => ({ value: w.id, label: w.name })),
    [wallets]
  );
  const clientOptions = useMemo(
    () => (clients ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clients]
  );
  const cardOptions = useMemo(
    () => (cards ?? []).map((c) => ({ value: c.id, label: c.name })),
    [cards]
  );
  const orderOptions = useMemo(
    () =>
      (orders ?? []).map((o) => ({
        value: o.id,
        label: o.number ? `${o.number} — ${o.title}` : o.title,
      })),
    [orders]
  );

  const filtered = useMemo(() => {
    if (!txs) return [];
    return txs.filter((t) => {
      if (tab !== "all" && t.type !== tab) return false;
      if (category !== "all" && t.category !== category) return false;
      if (walletFilter !== "all" && t.walletId !== walletFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const desc = t.description?.toLowerCase().includes(s);
        const clientName = t.client?.name?.toLowerCase().includes(s);
        const freeName = t.clientName?.toLowerCase().includes(s);
        if (!desc && !clientName && !freeName) return false;
      }
      if (dateFrom) {
        if (new Date(t.date) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        // include the whole end day
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.date) > end) return false;
      }
      return true;
    });
  }, [txs, tab, category, walletFilter, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(t: Tx) {
    setEditing(t);
    setModalOpen(true);
  }

  function buildFields(): Field[] {
    const editDate = editing?.date
      ? new Date(editing.date).toISOString().slice(0, 16)
      : "";
    return [
      {
        name: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          { value: "income", label: "Entrada" },
          { value: "expense", label: "Saída" },
        ],
        default: editing?.type ?? "expense",
      },
      {
        name: "category",
        label: "Categoria",
        type: "select",
        required: true,
        options: [
          { value: "service", label: "Serviço" },
          { value: "fixed", label: "Conta Fixa" },
          { value: "variable", label: "Despesa Variável" },
          { value: "salary", label: "Salário" },
          { value: "investment", label: "Investimento" },
          { value: "other", label: "Outro" },
        ],
        default: editing?.category ?? "other",
      },
      {
        name: "description",
        label: "Descrição",
        type: "text",
        required: true,
        placeholder: "Ex: Pagamento de cliente X",
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
        name: "date",
        label: "Data",
        type: "datetime-local",
        default: editDate,
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
        name: "person",
        label: "Cliente / Pessoa",
        type: "person",
        options: clientOptions,
        idField: "clientId",
        nameField: "clientName",
        placeholder: "Digite um nome livre ou escolha um cliente cadastrado",
        hint: "Flexível: pode ser um cliente cadastrado ou qualquer pessoa avulsa — sem precisar cadastrar.",
        default: editing?.client?.name ?? editing?.clientName ?? "",
      },
      {
        name: "orderId",
        label: "Ordem de Serviço",
        type: "select",
        options: orderOptions,
        placeholder: "Nenhuma (opcional)",
        default: editing?.orderId ?? "",
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transações"
        description="Todas as entradas e saídas do seu financeiro"
        icon={<ArrowLeftRight className="h-5 w-5" />}
        action={{
          label: "Nova Transação",
          onClick: openNew,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Entradas"
          value={formatCurrency(totals.income)}
          subtitle={`${filtered.filter((t) => t.type === "income").length} lançamentos`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="income"
          delay={0}
        />
        <MetricCard
          title="Saídas"
          value={formatCurrency(totals.expense)}
          subtitle={`${filtered.filter((t) => t.type === "expense").length} lançamentos`}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="expense"
          delay={0.05}
        />
        <MetricCard
          title="Saldo Líquido"
          value={formatCurrency(totals.net)}
          subtitle={totals.net >= 0 ? "Positivo" : "Negativo"}
          icon={<Scale className="h-5 w-5" />}
          variant={totals.net >= 0 ? "income" : "expense"}
          delay={0.1}
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="income">Entradas</TabsTrigger>
                <TabsTrigger value="expense">Saídas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Categoria
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  <SelectItem value="service">Serviço</SelectItem>
                  <SelectItem value="fixed">Conta Fixa</SelectItem>
                  <SelectItem value="variable">Despesa Variável</SelectItem>
                  <SelectItem value="salary">Salário</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Carteira
              </label>
              <Select value={walletFilter} onValueChange={setWalletFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas carteiras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas carteiras</SelectItem>
                  {walletOptions.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                De
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Até
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions list */}
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
            icon={<ArrowLeftRight className="h-7 w-7" />}
            title="Nenhuma transação encontrada"
            description="Ajuste os filtros ou cadastre uma nova transação."
            action={{ label: "Nova Transação", onClick: openNew }}
          />
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-1 -mr-1 space-y-2">
            <AnimatePresence initial={false}>
              {filtered.map((t, i) => {
                const isIncome = t.type === "income";
                const amt = Number(t.amount) || 0;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                    whileHover={{ y: -1 }}
                    className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpFromLine className="h-5 w-5" />
                      ) : (
                        <ArrowDownToLine className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {t.description}
                        </p>
                        <Badge
                          variant="outline"
                          className={categoryBadgeClass(t.category)}
                        >
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </Badge>
                        {!t.client && t.clientName && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]"
                          >
                            Avulso
                          </Badge>
                        )}
                        {t.recurring && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Recorrente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {formatDateTime(t.date)}
                        {t.client
                          ? ` • ${t.client.name}`
                          : t.clientName
                          ? ` • ${t.clientName}`
                          : ""}
                        {t.wallet ? ` • ${t.wallet.name}` : ""}
                        {t.creditCard ? ` • ${t.creditCard.name}` : ""}
                        {t.paymentMethod
                          ? ` • ${paymentLabel(t.paymentMethod)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className={`font-semibold tabular-nums ${
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(amt)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(t.date)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={() => openEdit(t)}
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

      {/* Empty hint when no wallets/clients */}
      {(!wallets || wallets.length === 0) && !loading && (
        <div className="rounded-xl border border-dashed border-border/60 p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <WalletIcon className="h-5 w-5" />
          <span>
            Dica: cadastre carteiras na seção "Carteiras" para vincular às
            transações.
          </span>
        </div>
      )}

      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar Transação" : "Nova Transação"}
        description="Lançamentos de entrada ou saída. Pode ser de um cliente cadastrado ou de qualquer pessoa avulsa — só digitar o nome. Para compras no crédito, selecione um cartão."
        fields={buildFields()}
        initialData={editing ?? undefined}
        endpoint="/api/crud/transactions"
        id={editing?.id}
      />
    </div>
  );
}
