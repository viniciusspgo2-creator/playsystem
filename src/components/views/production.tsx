"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, useRefresh, apiPost } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Factory,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  GripVertical,
  Pencil,
  Calendar,
  Loader2,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  price: number | string;
  cost: number | string;
  deadline?: string | Date | null;
  paid: boolean;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  client?: { id: string; name: string } | null;
  serviceType?: { id: string; name: string; color: string; icon?: string | null } | null;
}

interface Client {
  id: string;
  name: string;
}

interface ServiceType {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
}

const COLUMNS = [
  { id: "todo", title: "A Fazer", color: "var(--muted-foreground)" },
  { id: "doing", title: "Fazendo", color: "#f59e0b" },
  { id: "done", title: "Concluído", color: "#10b981" },
  { id: "delivered", title: "Entregue", color: "var(--primary)" },
] as const;

const PRIORITY_META: Record<string, { label: string; className: string; dot: string }> = {
  low: { label: "Baixa", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  medium: { label: "Média", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  high: { label: "Alta", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  urgent: { label: "Urgente", className: "bg-primary/15 text-primary", dot: "bg-primary" },
};

export function ProductionView() {
  const { data: ordersData, loading: ol } = useFetch<Order[]>("/api/crud/orders");
  const { data: clientsData } = useFetch<Client[]>("/api/crud/clients");
  const { data: serviceTypesData } = useFetch<ServiceType[]>("/api/crud/service-types");
  const refresh = useRefresh();

  const [orders, setOrders] = useState<Order[]>([]);
  const [lastOrdersData, setLastOrdersData] = useState<Order[] | null | undefined>(undefined);
  // Sync local orders with fetched data (render-time pattern — see React docs)
  if (ordersData !== lastOrdersData) {
    setLastOrdersData(ordersData);
    setOrders(ordersData ?? []);
  }

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const { data: wallets } = useFetch<{ id: string; name: string }[]>("/api/crud/wallets");

  const clients = clientsData || [];
  const serviceTypes = serviceTypesData || [];

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filterType !== "all" && o.serviceType?.id !== filterType) return false;
      if (filterPriority !== "all" && o.priority !== filterPriority) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.title.toLowerCase().includes(q) && !o.number.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterType, filterPriority, search]);

  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = { todo: [], doing: [], done: [], delivered: [] };
    for (const o of filtered) {
      if (map[o.status]) map[o.status].push(o);
    }
    return map;
  }, [filtered]);

  const summary = useMemo(() => {
    const totalProduction = orders.filter((o) => o.status !== "delivered").length;
    const pendingValue = orders
      .filter((o) => o.status !== "delivered" || !o.paid)
      .reduce((s, o) => s + (Number(o.price) || 0), 0);
    const deliveredUnpaid = orders.filter((o) => o.status === "delivered" && !o.paid);
    return {
      totalProduction,
      pendingValue,
      deliveredUnpaidCount: deliveredUnpaid.length,
      deliveredUnpaidTotal: deliveredUnpaid.reduce((s, o) => s + (Number(o.price) || 0), 0),
      deliveredCount: orders.filter((o) => o.status === "delivered").length,
    };
  }, [orders]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const o = orders.find((x) => x.id === String(event.active.id));
    setActiveOrder(o ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const orderId = String(active.id);
    const newStatus = over ? String(over.id) : null;
    setActiveOrder(null);
    if (!newStatus) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;
    // optimistic update
    const prev = orders;
    setOrders((items) => items.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    try {
      await apiPost(`/api/crud/orders/${orderId}`, { status: newStatus }, "PUT");
      toast.success(`Movido para "${COLUMNS.find((c) => c.id === newStatus)?.title}"`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
      setOrders(prev);
    }
  }

  async function togglePaid(order: Order) {
    // Desmarcar: só tira a marcação; a entrada no caixa continua (estorno é em A Receber)
    if (order.paid) {
      const prev = orders;
      setOrders((items) => items.map((o) => (o.id === order.id ? { ...o, paid: false } : o)));
      try {
        await apiPost(`/api/crud/orders/${order.id}`, { paid: false }, "PUT");
        toast.info("Marcação de pagamento removida", {
          description:
            "A entrada no caixa continua. Para estornar, exclua a conta a receber correspondente em A Receber.",
        });
        refresh();
      } catch (e: any) {
        toast.error(e.message);
        setOrders(prev);
      }
      return;
    }
    // Marcar pago: se a OS já tem recebimento no caixa, só marca;
    // senão abre o recebimento (carteira + lançamento) antes de marcar
    try {
      const res = await fetch(
        `/api/crud/receivables?where=${encodeURIComponent(
          JSON.stringify({ orderId: order.id, received: true })
        )}`
      );
      const json = await res.json();
      if ((json.data ?? []).length > 0) {
        await apiPost(`/api/crud/orders/${order.id}`, { paid: true }, "PUT");
        toast.success("Marcado como pago", {
          description: "O recebimento desta OS já estava registrado no caixa.",
        });
        refresh();
      } else {
        setPayOrder(order);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function openNew() {
    setEditingOrder(null);
    setModalOpen(true);
  }

  function openEdit(order: Order) {
    setEditingOrder(order);
    setModalOpen(true);
  }

  const orderFields: Field[] = [
    { name: "title", label: "Título", type: "text", placeholder: "Ex: Logo + Identidade", required: true },
    { name: "clientId", label: "Cliente", type: "select", options: clients.map((c) => ({ value: c.id, label: c.name })), required: true },
    { name: "serviceTypeId", label: "Tipo de Serviço", type: "select", options: serviceTypes.map((s) => ({ value: s.id, label: s.name })), required: true },
    { name: "description", label: "Descrição", type: "textarea", placeholder: "Detalhes do serviço..." },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: COLUMNS.map((c) => ({ value: c.id, label: c.title })),
      default: "todo",
      required: true,
    },
    {
      name: "priority",
      label: "Prioridade",
      type: "select",
      options: [
        { value: "low", label: "Baixa" },
        { value: "medium", label: "Média" },
        { value: "high", label: "Alta" },
        { value: "urgent", label: "Urgente" },
      ],
      default: "medium",
      required: true,
    },
    { name: "price", label: "Preço", type: "number", step: "0.01", default: 0, required: true },
    { name: "cost", label: "Custo", type: "number", step: "0.01", default: 0 },
    { name: "deadline", label: "Prazo", type: "date" },
  ];

  if (ol) {
    return (
      <div className="space-y-4">
        <PageHeader title="Produção" description="Carregando..." icon={<Factory className="h-5 w-5" />} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produção"
        description="Kanban de ordens de serviço"
        icon={<Factory className="h-5 w-5" />}
        action={{ label: "Nova Ordem", onClick: openNew, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Em Produção"
          value={summary.totalProduction}
          subtitle="ordens não entregues"
          icon={<Factory className="h-5 w-5" />}
          variant="brand"
          delay={0}
        />
        <MetricCard
          title="Valor Pendente"
          value={formatCurrency(summary.pendingValue)}
          subtitle="a produzir / receber"
          icon={<DollarSign className="h-5 w-5" />}
          variant="warning"
          delay={0.05}
        />
        <MetricCard
          title="Aguardando Pgto"
          value={summary.deliveredUnpaidCount}
          subtitle={formatCurrency(summary.deliveredUnpaidTotal)}
          icon={<Clock className="h-5 w-5" />}
          variant="expense"
          delay={0.1}
        />
        <MetricCard
          title="Entregues"
          value={summary.deliveredCount}
          subtitle="no total"
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="income"
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Todos os tipos</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Todas as prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
      </Card>

      {/* Kanban board */}
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Factory className="h-6 w-6" />}
            title="Nenhuma ordem"
            description="Crie sua primeira ordem de serviço"
            action={{ label: "Nova Ordem", onClick: openNew }}
          />
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {COLUMNS.map((col, i) => (
              <KanbanColumn
                key={col.id}
                column={col}
                orders={byStatus[col.id] || []}
                delay={i * 0.05}
                onEdit={openEdit}
                onTogglePaid={togglePaid}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOrder ? (
              <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xl rotate-2 cursor-grabbing w-[280px]">
                <OrderCardContent order={activeOrder} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Form modal */}
      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingOrder ? `Editar Ordem ${editingOrder.number}` : "Nova Ordem"}
        description="Preencha os dados da ordem de serviço"
        fields={orderFields}
        initialData={
          editingOrder
            ? {
                title: editingOrder.title,
                clientId: editingOrder.client?.id ?? "",
                serviceTypeId: editingOrder.serviceType?.id ?? "",
                description: editingOrder.description ?? "",
                status: editingOrder.status,
                priority: editingOrder.priority,
                price: Number(editingOrder.price) || 0,
                cost: Number(editingOrder.cost) || 0,
                deadline: editingOrder.deadline
                  ? new Date(editingOrder.deadline).toISOString().slice(0, 10)
                  : "",
              }
            : undefined
        }
        endpoint="/api/crud/orders"
        id={editingOrder?.id}
      />

      {payOrder && (
        <OrderPayDialog
          order={payOrder}
          wallets={wallets ?? []}
          onClose={() => setPayOrder(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Receber pagamento da OS ao marcar "pago" no Kanban                  */
/* ------------------------------------------------------------------ */

function parseMoneyBR(v: string): number {
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const OS_PAY_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão de Débito" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

function OrderPayDialog({
  order,
  wallets,
  onClose,
}: {
  order: Order;
  wallets: { id: string; name: string }[];
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const price = Number(order.price) || 0;
  const [amount, setAmount] = useState(price > 0 ? String(price).replace(".", ",") : "");
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
      await apiPost("/api/crud/receivables", {
        clientId: order.client?.id ?? null,
        orderId: order.id,
        description: `OS ${order.number} — ${order.title}`,
        amount: amt,
        dueDate: new Date().toISOString(),
        received: true,
        receivedAt: new Date(`${paidAt}T12:00:00`).toISOString(),
        paymentMethod: method,
        walletId,
        notes: "Recebimento registrado pelo Kanban de Produção.",
      });
      await apiPost(`/api/crud/orders/${order.id}`, { paid: true }, "PUT");
      toast.success(`OS ${order.number} paga • ${formatCurrency(amt)} no caixa`, {
        description: walletName
          ? `Entrada lançada na carteira ${walletName} e em Entradas & Saídas.`
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
          <DialogTitle>Receber — {order.number}</DialogTitle>
          <DialogDescription>
            {order.title}
            {order.client?.name ? ` • ${order.client.name}` : ""}
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
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data do recebimento</Label>
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
                  {OS_PAY_METHODS.map((m) => (
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
              <WalletIcon className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-sm min-w-0">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Entrada de {formatCurrency(parseMoneyBR(amount))} no caixa
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {walletName ? `Carteira ${walletName}` : "escolha a carteira"} • cria conta a receber já quitada
                  e lançamento em Entradas & Saídas
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
            Confirmar {parseMoneyBR(amount) > 0 ? formatCurrency(parseMoneyBR(amount)) : "recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KanbanColumn({
  column,
  orders,
  delay,
  onEdit,
  onTogglePaid,
}: {
  column: { id: string; title: string; color: string };
  orders: Order[];
  delay: number;
  onEdit: (o: Order) => void;
  onTogglePaid: (o: Order) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border bg-card/60 p-3 flex flex-col min-w-[280px] flex-shrink-0 lg:min-w-0 lg:flex-shrink max-h-[calc(100vh-280px)]",
        isOver ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border/60"
      )}
    >
      <header className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.color }} />
          {column.title}
        </h3>
        <Badge variant="secondary" className="tabular-nums text-xs">
          {orders.length}
        </Badge>
      </header>
      <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[80px]">
        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Solte ordens aqui</p>
        ) : (
          orders.map((o) => (
            <OrderCard key={o.id} order={o} onEdit={() => onEdit(o)} onTogglePaid={() => onTogglePaid(o)} />
          ))
        )}
      </div>
    </motion.div>
  );
}

function OrderCard({
  order,
  onEdit,
  onTogglePaid,
}: {
  order: Order;
  onEdit: () => void;
  onTogglePaid: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border/60 bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <OrderCardContent order={order} onEdit={onEdit} onTogglePaid={onTogglePaid} />
    </motion.div>
  );
}

function OrderCardContent({
  order,
  onEdit,
  onTogglePaid,
}: {
  order: Order;
  onEdit?: () => void;
  onTogglePaid?: () => void;
}) {
  const priority = PRIORITY_META[order.priority] ?? PRIORITY_META.medium;
  const st = order.serviceType;
  const deadline = order.deadline ? new Date(order.deadline) : null;
  const overdue =
    deadline && deadline < new Date() && order.status !== "delivered";

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {st && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: st.color }} />}
          <p className="text-sm font-semibold truncate">{order.title}</p>
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge variant="secondary" className="text-[10px] tabular-nums">
          {order.number}
        </Badge>
        {st && (
          <Badge variant="secondary" className="text-[10px]" style={{ background: `${st.color}20`, color: st.color }}>
            {st.name}
          </Badge>
        )}
        <Badge variant="secondary" className={cn("text-[10px]", priority.className)}>
          <span className={cn("h-1.5 w-1.5 rounded-full mr-1", priority.dot)} />
          {priority.label}
        </Badge>
      </div>
      {order.client?.name && (
        <p className="text-xs text-muted-foreground truncate mb-2">{order.client.name}</p>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums">{formatCurrency(order.price)}</span>
        {deadline && (
          <span
            className={cn(
              "flex items-center gap-1",
              overdue ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(deadline)}
          </span>
        )}
      </div>
      {order.status === "delivered" && onTogglePaid && (
        <div
          className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground">Pago</span>
          <Switch checked={order.paid} onCheckedChange={onTogglePaid} />
        </div>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3 mr-1" /> Editar
        </Button>
      )}
    </>
  );
}
