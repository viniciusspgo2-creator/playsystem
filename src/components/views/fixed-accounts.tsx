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
import { formatCurrency } from "@/lib/format";
import {
  Repeat,
  Plus,
  Pencil,
  CalendarClock,
  Wallet as WalletIcon,
  CreditCard as CardIcon,
  Zap,
  Home,
  Wifi,
  ShieldCheck,
  Tag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FixedAccount {
  id: string;
  name: string;
  category: string;
  amount: number | string;
  dueDay: number;
  paymentMethod?: string;
  walletId?: string | null;
  creditCardId?: string | null;
  active?: boolean;
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

const CATEGORIES = [
  { value: "housing", label: "Moradia", icon: Home },
  { value: "utility", label: "Utilidade", icon: Zap },
  { value: "internet", label: "Internet", icon: Wifi },
  { value: "subscription", label: "Assinatura", icon: Tag },
  { value: "insurance", label: "Seguro", icon: ShieldCheck },
  { value: "other", label: "Outro", icon: Repeat },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

function categoryLabel(v: string): string {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function categoryIcon(v: string) {
  const C = CATEGORIES.find((c) => c.value === v)?.icon ?? Repeat;
  return <C className="h-4 w-4" />;
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case "housing":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "utility":
      return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
    case "internet":
      return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    case "subscription":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "insurance":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function paymentLabel(method?: string): string {
  if (!method) return "-";
  return PAYMENT_METHODS.find((p) => p.value === method)?.label ?? method;
}

export function FixedAccountsView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAccount | null>(null);
  const [spinningId, setSpinningId] = useState<string | null>(null);

  const { data: accounts, loading } = useFetch<FixedAccount[]>(
    "/api/crud/fixed-accounts"
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

  const monthlyTotal = useMemo(() => {
    if (!accounts) return 0;
    return accounts
      .filter((a) => a.active !== false)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  }, [accounts]);

  const activeCount = useMemo(
    () => (accounts ?? []).filter((a) => a.active !== false).length,
    [accounts]
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(a: FixedAccount) {
    setEditing(a);
    setModalOpen(true);
  }

  async function launchThisMonth(a: FixedAccount) {
    setSpinningId(a.id);
    try {
      const body: Record<string, any> = {
        type: "expense",
        category: "fixed",
        description: `${a.name} (conta fixa)`,
        amount: Number(a.amount) || 0,
        date: new Date().toISOString(),
        paymentMethod: a.paymentMethod ?? null,
        walletId: a.walletId ?? null,
        creditCardId: a.creditCardId ?? null,
      };
      await apiPost("/api/crud/transactions", body);
      toast.success(`Lançado: ${a.name}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao lançar conta fixa");
    } finally {
      setSpinningId(null);
    }
  }

  async function toggleActive(a: FixedAccount, value: boolean) {
    try {
      await apiPost(`/api/crud/fixed-accounts/${a.id}`, { active: value }, "PUT");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function buildFields(): Field[] {
    return [
      {
        name: "name",
        label: "Nome da Conta",
        type: "text",
        required: true,
        placeholder: "Ex: Aluguel, Internet, Netflix...",
        default: editing?.name ?? "",
      },
      {
        name: "category",
        label: "Categoria",
        type: "select",
        required: true,
        options: CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
        default: editing?.category ?? "other",
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
        name: "dueDay",
        label: "Dia de Vencimento (1-31)",
        type: "number",
        required: true,
        default: editing?.dueDay ? String(editing.dueDay) : "10",
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
        name: "active",
        label: "Conta ativa",
        type: "switch",
        default: editing?.active ?? true,
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Fixas"
        description="Catálogo de contas recorrentes mensais"
        icon={<Repeat className="h-5 w-5" />}
        action={{
          label: "Nova Conta Fixa",
          onClick: openNew,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Mensal Fixo"
          value={formatCurrency(monthlyTotal)}
          subtitle={`${activeCount} contas ativas`}
          icon={<Repeat className="h-5 w-5" />}
          variant="warning"
          delay={0}
        />
        <MetricCard
          title="Contas Cadastradas"
          value={accounts?.length ?? 0}
          subtitle="Total no catálogo"
          icon={<CalendarClock className="h-5 w-5" />}
          variant="brand"
          delay={0.05}
        />
        <MetricCard
          title="Média por Conta"
          value={formatCurrency(
            activeCount > 0 ? monthlyTotal / activeCount : 0
          )}
          subtitle="Valor médio mensal"
          icon={<Tag className="h-5 w-5" />}
          variant="blue"
          delay={0.1}
        />
      </div>

      {loading ? (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </Card>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat className="h-7 w-7" />}
            title="Nenhuma conta fixa cadastrada"
            description="Cadastre suas contas recorrentes (aluguel, internet, assinaturas) para lançar com 1 clique a cada mês."
            action={{ label: "Cadastrar Conta", onClick: openNew }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {accounts.map((a, i) => {
              const amt = Number(a.amount) || 0;
              const inactive = a.active === false;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                  whileHover={{ y: -3 }}
                  className={`rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-4 ${
                    inactive ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent-blue/10 flex items-center justify-center text-primary shrink-0">
                        {categoryIcon(a.category)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{a.name}</p>
                        <Badge
                          variant="outline"
                          className={`mt-1 ${categoryBadgeClass(a.category)}`}
                        >
                          {categoryLabel(a.category)}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      checked={a.active !== false}
                      onCheckedChange={(v) => toggleActive(a, v)}
                      aria-label="Ativo"
                    />
                  </div>

                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatCurrency(amt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vence todo dia {a.dueDay} •{" "}
                      {paymentLabel(a.paymentMethod)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.wallet ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
                        <WalletIcon className="h-3 w-3" />
                        {a.wallet.name}
                      </span>
                    ) : null}
                    {a.creditCard ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
                        <CardIcon className="h-3 w-3" />
                        {a.creditCard.name}
                      </span>
                    ) : null}
                    {!a.wallet && !a.creditCard ? (
                      <span className="text-muted-foreground/70">
                        Sem vínculo de pagamento
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => launchThisMonth(a)}
                      disabled={spinningId === a.id}
                    >
                      {spinningId === a.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      Lançar este mês
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(a)}
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

      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar Conta Fixa" : "Nova Conta Fixa"}
        description="Contas recorrentes que você pode lançar com 1 clique a cada mês."
        fields={buildFields()}
        initialData={editing ?? undefined}
        endpoint="/api/crud/fixed-accounts"
        id={editing?.id}
      />
    </div>
  );
}
