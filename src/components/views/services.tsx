"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, EmptyState, Card } from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, useRefresh } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import {
  Palette,
  Video,
  Globe,
  Code2,
  Zap,
  Mic,
  Volume2,
  Plus,
  Pencil,
  Factory,
  Wrench,
  Image,
  Music,
  Camera,
  PenTool,
  Layout,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Icon lookup table — service types store icon name as string
const ICON_MAP: Record<string, LucideIcon> = {
  Palette,
  Video,
  Globe,
  Code2,
  Zap,
  Mic,
  Volume2,
  Wrench,
  Image,
  Music,
  Camera,
  PenTool,
  Layout,
  ShoppingCart,
  Factory,
};

const ICON_OPTIONS = Object.keys(ICON_MAP).map((name) => ({
  value: name,
  label: name,
}));

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  basePrice?: number | string | null;
  active: boolean;
  orders?: any[];
}

interface ServiceOrder {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  price: number | string;
  deadline?: string | Date | null;
  paid: boolean;
  client?: { id: string; name: string } | null;
  serviceType?: { id: string; name: string; color: string; icon?: string | null } | null;
}

const FIELDS: Field[] = [
  { name: "name", label: "Nome do serviço", type: "text", required: true, placeholder: "Ex: Vídeo" },
  { name: "description", label: "Descrição", type: "textarea", placeholder: "O que está incluído neste serviço?" },
  {
    name: "color",
    label: "Cor de destaque",
    type: "color",
    default: "#FF6B00",
  },
  {
    name: "icon",
    label: "Ícone",
    type: "select",
    options: ICON_OPTIONS,
    default: "Palette",
  },
  { name: "basePrice", label: "Preço base (R$)", type: "number", step: "0.01", placeholder: "0,00" },
  { name: "active", label: "Tipo ativo (disponível para novas ordens)", type: "switch", default: true },
];

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  todo: { label: "A fazer", color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-500/15" },
  doing: { label: "Fazendo", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  done: { label: "Concluído", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  delivered: { label: "Entregue", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/15" },
};

function getIcon(name?: string | null): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name];
  return Wrench;
}

export function ServicesView() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const refresh = useRefresh();
  const setView = useAppStore((s) => s.setView);

  const { data: types, loading: loadingTypes } = useFetch<ServiceType[]>(
    "/api/crud/service-types"
  );
  const { data: orders, loading: loadingOrders } = useFetch<ServiceOrder[]>(
    "/api/crud/orders?limit=10"
  );

  const safeTypes = useMemo(() => types ?? [], [types]);
  const safeOrders = useMemo(() => orders ?? [], [orders]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: ServiceType) {
    setEditing({
      ...t,
      basePrice:
        t.basePrice !== null && t.basePrice !== undefined
          ? Number(t.basePrice)
          : "",
    } as any);
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Serviços"
        description="Catálogo de tipos de serviço e ordens de produção"
        icon={<Wrench className="h-5 w-5" />}
      />

      {/* =====================================================
          SECTION A — Service Types catalog (full CRUD)
         ===================================================== */}
      <section aria-labelledby="types-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="types-heading"
              className="text-lg font-semibold flex items-center gap-2"
            >
              <Palette className="h-4 w-4 text-primary" />
              Catálogo de Serviços
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tipos disponíveis para criação de ordens de serviço
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Tipo
          </button>
        </div>

        {loadingTypes ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : safeTypes.length === 0 ? (
          <EmptyState
            icon={<Palette className="h-7 w-7" />}
            title="Nenhum tipo cadastrado"
            description="Crie seu primeiro tipo de serviço para começar a emitir ordens."
            action={{ label: "Novo Tipo", onClick: openCreate }}
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            {safeTypes.map((t) => {
              const Icon = getIcon(t.icon);
              const orderCount = t.orders?.length ?? 0;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => openEdit(t)}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
                  aria-label={`Editar tipo ${t.name}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ background: t.color || "#FF6B00" }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  </div>

                  <h3 className="font-semibold mt-3 truncate">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                      {t.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Preço base
                      </p>
                      <p className="font-bold tabular-nums">
                        {formatCurrency(Number(t.basePrice ?? 0))}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={orderCount > 0 ? "border-primary/30 text-primary" : ""}
                    >
                      {orderCount} {orderCount === 1 ? "ordem" : "ordens"}
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: t.color || "#FF6B00" }}
                      />
                      <span className="text-muted-foreground">{t.icon || "Wrench"}</span>
                    </span>
                    {t.active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* =====================================================
          SECTION B — Service Orders list (recent orders)
         ===================================================== */}
      <section aria-labelledby="orders-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="orders-heading"
              className="text-lg font-semibold flex items-center gap-2"
            >
              <Factory className="h-4 w-4 text-accent-blue" />
              Ordens de Serviço Recentes
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Últimas 10 ordens cadastradas — gerencie pelo Kanban de Produção
            </p>
          </div>
          <button
            onClick={() => setView("production")}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <Factory className="h-4 w-4" />
            Kanban
          </button>
        </div>

        <Card className="p-0 overflow-hidden">
          {loadingOrders ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : safeOrders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Factory className="h-6 w-6" />}
                title="Nenhuma ordem cadastrada"
                description="Crie ordens na aba de Produção para vê-las aqui."
                action={{
                  label: "Ir para Produção",
                  onClick: () => setView("production"),
                }}
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {safeOrders.map((o, i) => {
                const st = o.serviceType;
                const statusMeta =
                  STATUS_META[o.status] ?? STATUS_META.todo;
                const Icon = getIcon(st?.icon);
                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setView("production")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setView("production");
                      }
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: st?.color || "#94a3b8" }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {o.number}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {st?.name ?? "Sem tipo"}
                        </span>
                      </div>
                      <p className="font-medium truncate text-sm">{o.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.client?.name ?? "Sem cliente"}
                        {o.deadline ? ` • Prazo ${formatDate(o.deadline)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-semibold tabular-nums text-sm">
                        {formatCurrency(Number(o.price))}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${statusMeta.bg} ${statusMeta.color}`}
                      >
                        {statusMeta.label}
                      </span>
                      {o.paid && (
                        <Badge
                          variant="outline"
                          className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                        >
                          Pago
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <FormModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
        description="Defina nome, cor, ícone e preço base. Você pode desativar tipos que não estão mais disponíveis."
        fields={FIELDS}
        initialData={editing ?? undefined}
        endpoint="/api/crud/service-types"
        id={editing?.id}
        onSaved={() => {
          refresh();
          toast.success(
            editing ? "Tipo atualizado" : "Tipo criado",
            {
              description: editing
                ? "Catálogo atualizado com sucesso."
                : "Novo tipo de serviço disponível.",
            }
          );
        }}
      />
    </div>
  );
}
