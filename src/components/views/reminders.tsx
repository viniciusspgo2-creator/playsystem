"use client";

// ============================================================
// LEMBRETES — modo TDAH
// Memória externa: captura rápida, prioridade visual, adiar sem
// culpa, repetição automática e "despejo mental" para ideias soltas.
// ============================================================

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch, apiPost, apiDelete, useRefresh } from "@/lib/api-hooks";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Bell,
  Plus,
  Check,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  Timer,
  Repeat as RepeatIcon,
  CalendarDays,
  Lightbulb,
  Brain,
  ChevronDown,
  Zap,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority: string; // low | normal | high
  category: string;
  repeat: string; // none | daily | weekly | monthly
  done: boolean;
  doneAt?: string | null;
  createdAt: string;
}

interface RemindersData {
  overdue: Reminder[];
  today: Reminder[];
  upcoming: Reminder[];
  noDate: Reminder[];
  done: Reminder[];
  badge: number;
}

interface QuickNote {
  id: string;
  content: string;
  cleared: boolean;
  createdAt: string;
}

const PRIORITY_META: Record<string, { label: string; dot: string; chip: string }> = {
  high: {
    label: "Alta",
    dot: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  normal: {
    label: "Normal",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  low: {
    label: "Baixa",
    dot: "bg-slate-400",
    chip: "bg-muted text-muted-foreground border-border",
  },
};

const REPEAT_LABELS: Record<string, string> = {
  none: "",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

function dayRange() {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date();
  e.setHours(23, 59, 59, 999);
  return { from: s.toISOString(), to: e.toISOString() };
}

// Converte Date para o formato aceito por <input type="datetime-local"> (hora local)
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function dueChip(r: Reminder): { label: string; className: string } {
  if (!r.dueDate)
    return {
      label: "Sem data",
      className: "bg-muted text-muted-foreground border-border",
    };
  const d = new Date(r.dueDate);
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(tomorrow0.getDate() + 1);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (d < today0) {
    const days = Math.max(1, Math.floor((today0.getTime() - d.getTime()) / 86400000));
    return {
      label: days === 1 ? "Atrasado 1 dia" : `Atrasado ${days} dias`,
      className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold",
    };
  }
  if (d < tomorrow0)
    return {
      label: `Hoje ${time}`,
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold",
    };
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" });
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return {
    label: `${weekday} ${date}${r.dueDate.includes("T") ? ` ${time}` : ""}`,
    className: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  };
}

export function RemindersView() {
  const range = useMemo(dayRange, []);
  const { data, loading } = useFetch<RemindersData>(
    `/api/reminders?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
  );
  const { data: notesData, loading: notesLoading } = useFetch<QuickNote[]>("/api/crud/quick-notes");
  const refresh = useRefresh();

  const [tab, setTab] = useState<"reminders" | "brain">("reminders");

  // quick add
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDue, setQuickDue] = useState<"today" | "tomorrow" | "week" | "none">("today");
  const [quickPriority, setQuickPriority] = useState<"low" | "normal" | "high">("normal");
  const [adding, setAdding] = useState(false);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [prefill, setPrefill] = useState<{ title?: string; notes?: string } | null>(null);

  // brain dump
  const [noteText, setNoteText] = useState("");

  const notes = useMemo(
    () => (notesData ?? []).filter((n) => !n.cleared),
    [notesData]
  );

  const doneTodayCount = useMemo(() => {
    if (!data?.done) return 0;
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime();
    return data.done.filter((d) => {
      if (!d.doneAt) return false;
      const t = new Date(d.doneAt).getTime();
      return t >= from && t <= to;
    }).length;
  }, [data, range]);

  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title) {
      toast.error("Escreva o que você não pode esquecer :)");
      return;
    }
    setAdding(true);
    try {
      let dueDate: string | null = null;
      if (quickDue === "today") {
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        dueDate = e.toISOString();
      } else if (quickDue === "tomorrow") {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        dueDate = d.toISOString();
      } else if (quickDue === "week") {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        d.setHours(9, 0, 0, 0);
        dueDate = d.toISOString();
      }
      await apiPost("/api/reminders", { title, dueDate, priority: quickPriority });
      toast.success("Lembrete salvo — fora da cabeça, no sistema 🧠");
      setQuickTitle("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function complete(r: Reminder) {
    try {
      const res = await apiPost(`/api/reminders/${r.id}`, { action: "complete" }, "PATCH");
      if (res?.next) {
        toast.success("Feito! E a repetição já está agendada 🔁");
      } else {
        toast.success("Feito! 🎉");
      }
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reopen(r: Reminder) {
    try {
      await apiPost(`/api/reminders/${r.id}`, { action: "reopen" }, "PATCH");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function snooze(r: Reminder, opts: { hours?: number; days?: number; label?: string }) {
    try {
      await apiPost(`/api/reminders/${r.id}`, { action: "snooze", ...opts }, "PATCH");
      toast.success(`Adiado: ${opts.label ?? "ok"}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function removeReminder(r: Reminder) {
    if (!confirm(`Excluir o lembrete "${r.title}"?`)) return;
    try {
      await apiDelete(`/api/reminders/${r.id}`);
      toast.success("Lembrete excluído");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function saveNote() {
    const content = noteText.trim();
    if (!content) return;
    try {
      await apiPost("/api/crud/quick-notes", { content });
      setNoteText("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteNote(n: QuickNote) {
    try {
      await apiDelete(`/api/crud/quick-notes/${n.id}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function convertNote(n: QuickNote) {
    setEditing(null);
    setPrefill({
      title: n.content.split("\n")[0].slice(0, 90),
      notes: n.content,
    });
    setModalOpen(true);
  }

  function openEdit(r: Reminder) {
    setPrefill(null);
    setEditing(r);
    setModalOpen(true);
  }

  function openNewFull() {
    setPrefill(null);
    setEditing(null);
    setModalOpen(true);
  }

  function buildFields(): Field[] {
    const dueLocal = editing?.dueDate
      ? toLocalInput(new Date(editing.dueDate))
      : "";
    return [
      {
        name: "title",
        label: "O que é?",
        type: "text",
        required: true,
        placeholder: "Ex: Cobrar o João pelo pix da arte",
        default: editing?.title ?? prefill?.title ?? "",
      },
      {
        name: "dueDate",
        label: "Quando (opcional)",
        type: "datetime-local",
        default: dueLocal,
      },
      {
        name: "priority",
        label: "Prioridade",
        type: "select",
        options: [
          { value: "high", label: "🔴 Alta — me atrapalha se esquecer" },
          { value: "normal", label: "🟡 Normal" },
          { value: "low", label: "⚪ Baixa — quando der" },
        ],
        default: editing?.priority ?? "normal",
      },
      {
        name: "repeat",
        label: "Repetir",
        type: "select",
        options: [
          { value: "none", label: "Não repete" },
          { value: "daily", label: "Todos os dias" },
          { value: "weekly", label: "Toda semana" },
          { value: "monthly", label: "Todo mês" },
        ],
        default: editing?.repeat ?? "none",
      },
      {
        name: "notes",
        label: "Detalhes (opcional)",
        type: "textarea",
        placeholder: "Contexto, telefone, link, o combinado...",
        default: editing?.notes ?? prefill?.notes ?? "",
      },
    ];
  }

  const modalInitial = editing ?? undefined;

  function ReminderItem({
    r,
    tone,
    delay = 0,
  }: {
    r: Reminder;
    tone: "overdue" | "today" | "upcoming" | "nodate" | "done";
    delay?: number;
  }) {
    const chip = dueChip(r);
    const prio = PRIORITY_META[r.priority] ?? PRIORITY_META.normal;
    const isDone = tone === "done";
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, delay: Math.min(delay * 0.03, 0.25) }}
        className={cn(
          "group flex items-start gap-3 p-3 rounded-xl border transition-colors",
          tone === "overdue"
            ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
            : tone === "today"
            ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
            : "border-border/50 hover:border-border hover:bg-accent/30",
          isDone && "opacity-60"
        )}
      >
        {/* Complete / reopen */}
        <button
          onClick={() => (isDone ? reopen(r) : complete(r))}
          title={isDone ? "Reabrir" : "Concluir"}
          className={cn(
            "mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
            isDone
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-muted-foreground/40 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={cn(
                "font-medium text-sm leading-snug",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {r.title}
            </p>
            <span className={cn("h-2 w-2 rounded-full shrink-0", prio.dot)} title={`Prioridade ${prio.label}`} />
            <Badge variant="outline" className={cn("text-[10px]", chip.className)}>
              {tone === "overdue" ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
              {chip.label}
            </Badge>
            {r.repeat && r.repeat !== "none" && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                <RepeatIcon className="h-3 w-3 mr-1" />
                {REPEAT_LABELS[r.repeat]}
              </Badge>
            )}
          </div>
          {r.notes && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
              {r.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isDone && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Adiar">
                  <Timer className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => snooze(r, { hours: 1, label: "+1 hora" })}>
                  Daqui a 1 hora
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => snooze(r, { hours: 3, label: "+3 horas" })}>
                  Daqui a 3 horas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => snooze(r, { days: 1, label: "amanhã" })}>
                  Amanhã
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => snooze(r, { days: 7, label: "+1 semana" })}>
                  Daqui a 1 semana
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => openEdit(r)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => removeReminder(r)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  function Section({
    title,
    icon,
    count,
    tone,
    items,
    emptyText,
  }: {
    title: string;
    icon: React.ReactNode;
    count: number;
    tone: "overdue" | "today" | "upcoming" | "nodate" | "done";
    items: Reminder[];
    emptyText: string;
  }) {
    if (items.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-1.5">
          {icon}
          <span className="font-medium">{title}:</span>
          <span>{emptyText}</span>
        </div>
      );
    }
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              tone === "overdue" &&
                "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
              tone === "today" &&
                "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}
          >
            {count}
          </Badge>
        </div>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((r, i) => (
              <ReminderItem key={r.id} r={r} tone={tone} delay={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const [showDone, setShowDone] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lembretes"
        description="Sua memória externa: se está na cabeça, está no lugar errado. Solte aqui."
        icon={<Bell className="h-5 w-5" />}
        action={{
          label: "Lembrete detalhado",
          onClick: openNewFull,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Quick add — captura sem fricção */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Captura rápida</h3>
          <span className="text-[10px] text-muted-foreground">
            Enter salva. Preencher detalhe é opcional.
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                quickAdd();
              }
            }}
            placeholder="O que você não pode esquecer?"
            className="h-11 text-base flex-1"
            autoFocus
          />
          <Button onClick={quickAdd} disabled={adding} className="h-11 sm:w-36">
            {adding ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mr-1">
            Quando:
          </span>
          {(
            [
              { key: "today", label: "Hoje" },
              { key: "tomorrow", label: "Amanhã" },
              { key: "week", label: "1 semana" },
              { key: "none", label: "Sem data" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setQuickDue(opt.key)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all min-h-[32px]",
                quickDue === opt.key
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground ml-2 mr-1">
            Prioridade:
          </span>
          {(["high", "normal", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setQuickPriority(p)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all min-h-[32px] flex items-center gap-1.5",
                quickPriority === p
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", PRIORITY_META[p].dot)} />
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Atrasados"
          value={String(data?.overdue.length ?? 0)}
          subtitle={data && data.overdue.length > 0 ? "Comece por aqui" : "Nada atrasado 👏"}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="expense"
          delay={0}
        />
        <MetricCard
          title="Para hoje"
          value={String(data?.today.length ?? 0)}
          subtitle="Foco do dia"
          icon={<CalendarDays className="h-5 w-5" />}
          variant="warning"
          delay={0.05}
        />
        <MetricCard
          title="Concluídos hoje"
          value={String(doneTodayCount)}
          subtitle="Progresso é progresso"
          icon={<Check className="h-5 w-5" />}
          variant="income"
          delay={0.1}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="reminders">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            Lembretes
          </TabsTrigger>
          <TabsTrigger value="brain">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Despejo mental
            {notes.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {notes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "reminders" ? (
        <Card>
          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <Section
                title="Atrasados"
                icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
                count={data.overdue.length}
                tone="overdue"
                items={data.overdue}
                emptyText="nada atrasado, seu cérebro agradece 🧠💚"
              />
              <Section
                title="Hoje"
                icon={<CalendarDays className="h-4 w-4 text-amber-500" />}
                count={data.today.length}
                tone="today"
                items={data.today}
                emptyText="nada marcado para hoje"
              />
              <Section
                title="Próximos"
                icon={<Clock className="h-4 w-4 text-accent-blue" />}
                count={data.upcoming.length}
                tone="upcoming"
                items={data.upcoming}
                emptyText="nada agendado"
              />
              <Section
                title="Ideias (sem data)"
                icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />}
                count={data.noDate.length}
                tone="nodate"
                items={data.noDate}
                emptyText="sem ideias soltas"
              />

              {/* Done collapsible */}
              <div>
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Check className="h-4 w-4 text-emerald-500" />
                  Concluídos recentemente
                  <Badge variant="outline" className="text-[10px]">
                    {data.done.length}
                  </Badge>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")}
                  />
                </button>
                {showDone && (
                  <div className="space-y-2 mt-2">
                    {data.done.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">
                        Nada concluído ainda — bora começar.
                      </p>
                    ) : (
                      <AnimatePresence initial={false}>
                        {data.done.map((r, i) => (
                          <ReminderItem key={r.id} r={r} tone="done" delay={i} />
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Despejo mental</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Ideia, nome, número, "não posso esquecer isso" — joga aqui agora,
            organiza depois. Guardar na cabeça é tarefa para o sistema, não pra
            você.
          </p>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                saveNote();
              }
            }}
            placeholder="Escreva qualquer coisa... (Ctrl+Enter salva)"
            rows={3}
            className="mb-2"
          />
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={saveNote} disabled={!noteText.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Salvar nota
            </Button>
          </div>

          {notesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<Brain className="h-7 w-7" />}
              title="Cabeça limpa"
              description="Nenhuma nota pendente. Aproveite o silêncio."
            />
          ) : (
            <div className="max-h-96 overflow-y-auto pr-1 -mr-1 space-y-2">
              <AnimatePresence initial={false}>
                {notes.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
                    className="group flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <CornerDownRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-line break-words">
                        {n.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDateTime(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => convertNote(n)}
                        title="Transformar em lembrete com data/prioridade"
                      >
                        <Bell className="h-3 w-3 mr-1" />
                        Virar lembrete
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteNote(n)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      )}

      {/* Modal criar/editar lembrete */}
      <FormModal
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (!v) {
            setEditing(null);
            setPrefill(null);
          }
        }}
        title={editing ? "Editar lembrete" : prefill ? "Novo lembrete (da nota)" : "Novo lembrete"}
        description={
          editing
            ? "Ajuste o que precisar."
            : "Só o título é obrigatório — data, prioridade e repetição são opcionais."
        }
        fields={buildFields()}
        initialData={modalInitial}
        endpoint="/api/reminders"
        id={editing?.id}
        onSaved={() => {
          // nota convertida em lembrete: remove a nota original
          if (prefill) {
            const found = notes.find((n) => n.content === prefill.notes);
            if (found) apiDelete(`/api/crud/quick-notes/${found.id}`).catch(() => {});
          }
          setPrefill(null);
        }}
      />
    </div>
  );
}
