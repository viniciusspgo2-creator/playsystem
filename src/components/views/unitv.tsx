"use client";

import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-primitives/page-header";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { useFetch, useRefresh, apiPost, apiDelete } from "@/lib/api-hooks";
import { formatCurrency } from "@/lib/format";
import {
  PLAN_OPTIONS,
  computeNewExpiry,
  daysLabel,
  daysUntil,
  fillTemplate,
  fmtBR,
  parseDateInput,
  parseMoney,
  statusOf,
  todayBR,
  whatsappLink,
  ymd,
  DEFAULT_WHATSAPP_TEMPLATE,
  type UnitvStatus,
} from "@/lib/unitv";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tv,
  Plus,
  Search,
  RefreshCw,
  MessageCircle,
  History,
  Pencil,
  Upload,
  Users,
  BellRing,
  AlertTriangle,
  Wallet as WalletIcon,
  Loader2,
  Trash2,
  User as UserIcon,
  Phone,
} from "lucide-react";

interface IptvClient {
  id: string;
  name: string;
  phone?: string | null;
  username?: string | null;
  notes?: string | null;
  expiresAt: string;
  lastAmount: number | string;
  active: boolean;
}

interface Summary {
  alertDays: number;
  activeCount: number;
  soonCount: number;
  expiredCount: number;
  monthRevenue: number;
  alertCount: number;
  alerts: { id: string; name: string; phone: string | null; expiresAt: string; days: number; lastAmount: number }[];
}

interface WalletLite {
  id: string;
  name: string;
}

interface Renewal {
  id: string;
  kind: string;
  planMonths: number;
  amount: number | string;
  paidAt: string;
  newExpiry: string;
}

type Row = IptvClient & { days: number; status: UnitvStatus };

const STATUS_STYLE: Record<UnitvStatus, string> = {
  expired: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  today: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  soon: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

function planName(months: number) {
  return PLAN_OPTIONS.find((p) => p.months === months)?.label ?? `${months} meses`;
}

function moneyStr(v: number | string | null | undefined) {
  const n = Number(v);
  return n > 0 ? String(n).replace(".", ",") : "";
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

type Filter = "all" | "soon" | "expired" | "ok" | "inactive";

export function UnitvView() {
  const { data: clients, loading } = useFetch<IptvClient[]>("/api/unitv/clients");
  const { data: summary } = useFetch<Summary>("/api/unitv/summary");
  const { data: settings } = useFetch<{ unitv_whatsapp_template: string }>("/api/settings");
  const { data: wallets } = useFetch<WalletLite[]>("/api/crud/wallets");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [clientDialog, setClientDialog] = useState<{ client: IptvClient | null } | null>(null);
  const [renewFor, setRenewFor] = useState<IptvClient | null>(null);
  const [historyFor, setHistoryFor] = useState<IptvClient | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const alertDays = summary?.alertDays ?? 5;
  const template = settings?.unitv_whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE;
  const today = todayBR();

  const rows: Row[] = useMemo(
    () =>
      (clients ?? []).map((c) => {
        const days = daysUntil(c.expiresAt, today);
        return { ...c, days, status: statusOf(days, alertDays, c.active) };
      }),
    [clients, alertDays, today]
  );

  const counts = useMemo(() => {
    const k = { all: 0, soon: 0, expired: 0, ok: 0, inactive: 0 };
    for (const r of rows) {
      if (r.status === "inactive") k.inactive++;
      else {
        k.all++;
        if (r.status === "expired") k.expired++;
        else if (r.status === "ok") k.ok++;
        else k.soon++;
      }
    }
    return k;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "all" && r.status === "inactive") return false;
      if (filter === "soon" && !(r.status === "soon" || r.status === "today")) return false;
      if (filter === "expired" && r.status !== "expired") return false;
      if (filter === "ok" && r.status !== "ok") return false;
      if (filter === "inactive" && r.status !== "inactive") return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000") ||
        (r.username || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  function waLink(c: { name: string; phone?: string | null; expiresAt: string; days: number; lastAmount: number | string }) {
    const text = fillTemplate(template, {
      nome: c.name.split(" ")[0],
      vencimento: fmtBR(c.expiresAt),
      dias: c.days,
      valor: Number(c.lastAmount),
    });
    return whatsappLink(c.phone, text);
  }

  const alerts = summary?.alerts ?? [];
  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "soon", label: "A vencer", count: counts.soon },
    { key: "expired", label: "Vencidos", count: counts.expired },
    { key: "ok", label: "Em dia", count: counts.ok },
    { key: "inactive", label: "Inativos", count: counts.inactive },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="UNITV"
        description="Clientes do painel IPTV, renovações e vencimentos"
        icon={<Tv className="h-5 w-5" />}
        action={{
          label: "Novo cliente",
          onClick: () => setClientDialog({ client: null }),
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Clientes ativos"
          value={summary?.activeCount ?? counts.all}
          icon={<Users className="h-5 w-5" />}
          variant="blue"
        />
        <MetricCard
          title={`Vencem em ${alertDays} dias`}
          value={summary?.soonCount ?? counts.soon}
          icon={<BellRing className="h-5 w-5" />}
          variant="warning"
          delay={0.05}
        />
        <MetricCard
          title="Vencidos"
          value={summary?.expiredCount ?? counts.expired}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="expense"
          delay={0.1}
        />
        <MetricCard
          title="Recebido no mês"
          value={formatCurrency(summary?.monthRevenue ?? 0)}
          icon={<WalletIcon className="h-5 w-5" />}
          variant="income"
          delay={0.15}
        />
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
            <BellRing className="h-4 w-4" />
            {alerts.length} cliente{alerts.length > 1 ? "s" : ""} para renovar (até {alertDays} dias ou vencido
            {alerts.length > 1 ? "s" : ""})
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 6).map((a) => {
              const link = waLink({ ...a });
              const st = statusOf(a.days, alertDays);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-background/70 px-3 py-2 text-sm"
                >
                  <span className="font-medium truncate max-w-[14rem]">{a.name}</span>
                  <Badge variant="outline" className={cn("border", STATUS_STYLE[st])}>
                    {daysLabel(a.days)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmtBR(a.expiresAt)}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {link && (
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <a href={link} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Avisar
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const c = (clients ?? []).find((x) => x.id === a.id);
                        if (c) setRenewFor(c);
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renovar
                    </Button>
                  </div>
                </div>
              );
            })}
            {alerts.length > 6 && (
              <button
                type="button"
                onClick={() => setFilter("soon")}
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
              >
                + {alerts.length - 6} outros — ver na lista abaixo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de busca e filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou usuário..."
            className="pl-9 h-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
        <Button variant="outline" className="lg:ml-auto h-10" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Importar lista
        </Button>
      </div>

      {/* Lista */}
      {loading && !clients ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Tv className="h-7 w-7" />}
          title={rows.length === 0 ? "Nenhum cliente UNITV cadastrado" : "Nada encontrado"}
          description={
            rows.length === 0
              ? "Cadastre um por um ou cole a lista inteira do seu painel em Importar lista."
              : "Tente outro filtro ou outra busca."
          }
          action={rows.length === 0 ? { label: "Importar lista", onClick: () => setImportOpen(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const link = waLink(r);
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-2xl border border-border/60 bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4",
                  !r.active && "opacity-60"
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="text-sm font-bold bg-primary/15 text-primary">
                      {initials(r.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {r.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </span>
                      )}
                      {r.username && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> {r.username}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:w-72 shrink-0">
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{fmtBR(r.expiresAt)}</p>
                    <Badge variant="outline" className={cn("border mt-1", STATUS_STYLE[r.status])}>
                      {r.status === "inactive" ? "Inativo" : daysLabel(r.days)}
                    </Badge>
                  </div>
                  {Number(r.lastAmount) > 0 && (
                    <div className="text-right ml-auto">
                      <p className="text-[10px] uppercase text-muted-foreground">Último valor</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(r.lastAmount))}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => setRenewFor(r)} className="h-9">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Renovar
                  </Button>
                  {link && (
                    <Button asChild size="icon" variant="outline" className="h-9 w-9" title="Chamar no WhatsApp">
                      <a href={link} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button size="icon" variant="outline" className="h-9 w-9" title="Histórico" onClick={() => setHistoryFor(r)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" title="Editar" onClick={() => setClientDialog({ client: r })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {clientDialog && (
        <ClientDialog
          client={clientDialog.client}
          wallets={wallets ?? []}
          onClose={() => setClientDialog(null)}
        />
      )}
      {renewFor && <RenewDialog client={renewFor} wallets={wallets ?? []} onClose={() => setRenewFor(null)} />}
      {historyFor && <HistoryDialog client={historyFor} onClose={() => setHistoryFor(null)} />}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pedaços reutilizáveis                                               */
/* ------------------------------------------------------------------ */

function PlanPicker({ months, onChange }: { months: number; onChange: (m: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Plano</Label>
      <div className="flex flex-wrap items-center gap-2">
        {PLAN_OPTIONS.map((p) => (
          <button
            key={p.months}
            type="button"
            onClick={() => onChange(p.months)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              months === p.months
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <Input
            type="number"
            min={1}
            max={60}
            value={months}
            onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-8 w-16 text-center"
            aria-label="Meses"
          />
          <span className="text-xs text-muted-foreground">{months === 1 ? "mês" : "meses"}</span>
        </div>
      </div>
    </div>
  );
}

function WalletMethod({
  wallets,
  walletId,
  setWalletId,
  method,
  setMethod,
}: {
  wallets: WalletLite[];
  walletId: string;
  setWalletId: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
}) {
  return (
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
  );
}

/* ------------------------------------------------------------------ */
/* Cliente: novo / editar                                              */
/* ------------------------------------------------------------------ */

function ClientDialog({
  client,
  wallets,
  onClose,
}: {
  client: IptvClient | null;
  wallets: WalletLite[];
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const isEdit = !!client;

  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [username, setUsername] = useState(client?.username ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [active, setActive] = useState(client?.active ?? true);
  const [lastAmount, setLastAmount] = useState(moneyStr(client?.lastAmount));
  const [expiryManual, setExpiryManual] = useState<string | null>(null);

  const [activation, setActivation] = useState(false);
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayBR());
  const [walletId, setWalletId] = useState("");
  const [method, setMethod] = useState("pix");
  const [loading, setLoading] = useState(false);

  // Vencimento: o que o usuário digitou, senão calculado pelo plano (ativação), senão o atual do cliente
  const expiry =
    expiryManual ?? (activation && !isEdit ? computeNewExpiry(null, paidAt, months) : client ? ymd(client.expiresAt) : "");

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome do cliente.");
    if (!parseDateInput(expiry)) return toast.error("Informe um vencimento válido.");
    setLoading(true);
    try {
      const base = { name, phone, username, notes, expiresAt: expiry };
      if (isEdit) {
        await apiPost(`/api/unitv/clients/${client!.id}`, { ...base, lastAmount, active }, "PUT");
        toast.success("Cliente atualizado");
      } else if (activation) {
        await apiPost("/api/unitv/clients", {
          ...base,
          activation: { planMonths: months, amount, paidAt, walletId, paymentMethod: method },
        });
        toast.success("Cliente ativado e pagamento lançado");
      } else {
        await apiPost("/api/unitv/clients", { ...base, lastAmount });
        toast.success("Cliente cadastrado");
      }
      refresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!client) return;
    if (!confirm(`Excluir ${client.name}? O histórico de renovações dele será apagado (as entradas em Entradas & Saídas continuam).`)) return;
    setLoading(true);
    try {
      await apiDelete(`/api/unitv/clients/${client.id}`);
      toast.success("Cliente excluído");
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente UNITV" : "Novo cliente UNITV"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste os dados. Para registrar pagamento, use o botão Renovar."
              : "Cadastre um cliente que já está no painel ou ative um cliente novo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder="João Silva" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10" placeholder="(62) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Usuário no painel</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-10" placeholder="opcional" />
          </div>

          {!isEdit && (
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Cliente novo (ativação paga agora)</p>
                <p className="text-xs text-muted-foreground">Lança o pagamento e calcula o vencimento.</p>
              </div>
              <Switch checked={activation} onCheckedChange={setActivation} />
            </div>
          )}

          {activation && !isEdit && (
            <>
              <div className="sm:col-span-2">
                <PlanPicker months={months} onChange={(m) => { setMonths(m); setExpiryManual(null); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor pago (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10"
                  placeholder="25,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data do pagamento</Label>
                <Input
                  type="date"
                  value={paidAt}
                  onChange={(e) => { setPaidAt(e.target.value); setExpiryManual(null); }}
                  className="h-10"
                />
              </div>
              <div className="sm:col-span-2">
                <WalletMethod
                  wallets={wallets}
                  walletId={walletId}
                  setWalletId={setWalletId}
                  method={method}
                  setMethod={setMethod}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{activation && !isEdit ? "Vence em" : "Vencimento atual *"}</Label>
            <Input
              type="date"
              value={expiry}
              onChange={(e) => setExpiryManual(e.target.value)}
              className="h-10"
            />
          </div>
          {!activation && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Valor que ele costuma pagar (R$)</Label>
              <Input
                inputMode="decimal"
                value={lastAmount}
                onChange={(e) => setLastAmount(e.target.value)}
                className="h-10"
                placeholder="25,00"
              />
            </div>
          )}

          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex.: 2 telas, usa na TV da sala" />
          </div>

          {isEdit && (
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Cliente ativo</p>
                <p className="text-xs text-muted-foreground">Desative quem parou de pagar para sair dos alertas.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={remove} disabled={loading} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar" : activation ? "Ativar cliente" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Renovação                                                           */
/* ------------------------------------------------------------------ */

function RenewDialog({
  client,
  wallets,
  onClose,
}: {
  client: IptvClient;
  wallets: WalletLite[];
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const current = ymd(client.expiresAt);

  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(moneyStr(client.lastAmount));
  const [paidAt, setPaidAt] = useState(todayBR());
  const [expiryManual, setExpiryManual] = useState<string | null>(null);
  const [walletId, setWalletId] = useState("");
  const [method, setMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Novo vencimento: o que o usuário digitou, senão calculado (soma no atual se ainda ativo; senão a partir do pagamento)
  const newExpiry = expiryManual ?? computeNewExpiry(current, paidAt, months);

  async function save() {
    if (!parseDateInput(newExpiry)) return toast.error("Informe um novo vencimento válido.");
    setLoading(true);
    try {
      await apiPost("/api/unitv/renewals", {
        clientId: client.id,
        planMonths: months,
        amount,
        paidAt,
        newExpiry,
        walletId,
        paymentMethod: method,
        notes,
      });
      toast.success(`Renovado até ${fmtBR(newExpiry)}`, {
        description: parseMoney(amount) > 0 ? `${formatCurrency(parseMoney(amount))} lançado em Entradas.` : undefined,
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renovar — {client.name}</DialogTitle>
          <DialogDescription>
            Vencimento atual: <strong>{fmtBR(current)}</strong> ({daysLabel(daysUntil(current))})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <PlanPicker months={months} onChange={(m) => { setMonths(m); setExpiryManual(null); }} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Valor pago (R$)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
                placeholder="25,00"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Livre: use o valor do plano que ele pagou.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data do pagamento</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => { setPaidAt(e.target.value); setExpiryManual(null); }}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Novo vencimento</Label>
            <Input
              type="date"
              value={newExpiry}
              onChange={(e) => setExpiryManual(e.target.value)}
              className="h-10 max-w-[14rem]"
            />
            <p className="text-[11px] text-muted-foreground">
              Se ainda não venceu, soma em cima do vencimento atual; se já venceu, conta a partir do pagamento. Você pode ajustar.
            </p>
          </div>

          <WalletMethod wallets={wallets} walletId={walletId} setWalletId={setWalletId} method={method} setMethod={setMethod} />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Observação</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10" placeholder="opcional" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar renovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

function HistoryDialog({ client, onClose }: { client: IptvClient; onClose: () => void }) {
  const refresh = useRefresh();
  const { data, loading, reload } = useFetch<Renewal[]>(`/api/unitv/renewals?clientId=${client.id}`);

  async function undo(r: Renewal) {
    if (!confirm("Desfazer este lançamento? A entrada financeira também será removida e o vencimento volta ao anterior.")) return;
    try {
      await apiDelete(`/api/unitv/renewals/${r.id}`);
      toast.success("Lançamento desfeito");
      reload();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const list = data ?? [];
  const total = list.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {client.name}</DialogTitle>
          <DialogDescription>
            {list.length} lançamento{list.length !== 1 ? "s" : ""} • total {formatCurrency(total)}
          </DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma renovação registrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {r.kind === "activation" ? "Ativação" : "Renovação"} • {planName(r.planMonths)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pago em {fmtBR(r.paidAt)} • vence até {fmtBR(r.newExpiry)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatCurrency(Number(r.amount))}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Desfazer" onClick={() => undo(r)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Importar lista                                                      */
/* ------------------------------------------------------------------ */

interface ImportRow {
  name: string;
  phone: string;
  expiresAt: string;
  lastAmount: string;
  username: string;
}

function parseImport(text: string): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const sep = line.includes("\t") ? "\t" : ";";
    const [name = "", phone = "", date = "", value = "", username = ""] = line.split(sep).map((s) => s.trim());
    const exp = parseDateInput(date);
    if (i === 0 && !exp && /^nome$/i.test(name)) return; // cabeçalho
    if (!name) return errors.push(`Linha ${i + 1}: sem nome`);
    if (!exp) return errors.push(`Linha ${i + 1} (${name}): vencimento inválido "${date}"`);
    rows.push({ name, phone, expiresAt: exp, lastAmount: value, username });
  });
  return { rows, errors };
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const refresh = useRefresh();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const parsed = useMemo(() => parseImport(text), [text]);

  async function run() {
    if (!parsed.rows.length) return toast.error("Nenhum cliente válido para importar.");
    setLoading(true);
    try {
      const res = await apiPost("/api/unitv/import", { rows: parsed.rows });
      const { created, skipped } = res.data;
      toast.success(`${created} cliente${created !== 1 ? "s" : ""} importado${created !== 1 ? "s" : ""}`, {
        description: skipped ? `${skipped} ignorado(s) (já cadastrados ou inválidos).` : undefined,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lista de clientes</DialogTitle>
          <DialogDescription>
            Cole uma linha por cliente, no formato:{" "}
            <code className="text-xs">nome; whatsapp; vencimento; valor; usuário</code>. Só nome e vencimento são
            obrigatórios. Dá para colar direto de uma planilha.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="font-mono text-xs"
          placeholder={"João Silva; 62999990000; 15/10/2026; 25,00; joao123\nMaria Souza; 62988880000; 03/11/2026; 70,00\nPedro; ; 20/10/2026"}
        />

        <div className="text-sm space-y-1">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            {parsed.rows.length} cliente{parsed.rows.length !== 1 ? "s" : ""} pronto{parsed.rows.length !== 1 ? "s" : ""} para importar
          </p>
          {parsed.errors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5 max-h-24 overflow-y-auto">
              {parsed.errors.slice(0, 8).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
              {parsed.errors.length > 8 && <p>... e mais {parsed.errors.length - 8} linhas com erro</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={loading || parsed.rows.length === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importar {parsed.rows.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
