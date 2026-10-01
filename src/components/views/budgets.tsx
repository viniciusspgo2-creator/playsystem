"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { useFetch, apiPost } from "@/lib/api-hooks";
import { useRefresh } from "@/lib/api-hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  Eye,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Hash,
  StickyNote,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}
interface Order {
  id: string;
  number: string;
  title: string;
}
interface BudgetItem {
  description: string;
  quantity: number;
  unitPrice: number;
}
interface Budget {
  id: string;
  number: string;
  title: string;
  items: string; // JSON string
  total: number;
  discount: number;
  finalTotal: number;
  validUntil?: string | null;
  status: string;
  notes?: string | null;
  clientId?: string | null;
  orderId?: string | null;
  client?: { id: string; name: string } | null;
  order?: { id: string; title: string; number: string } | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_META: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  draft: {
    label: "Rascunho",
    cls: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  sent: {
    label: "Enviado",
    cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  approved: {
    label: "Aprovado",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejeitado",
    cls: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function parseItems(raw: string | undefined | null): BudgetItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as BudgetItem[];
    return [];
  } catch {
    return [];
  }
}

export function BudgetsView() {
  const [form, setForm] = useState({
    title: "",
    clientId: "",
    orderId: "",
    validUntil: "",
    notes: "",
    discount: "0",
  });
  const [items, setItems] = useState<BudgetItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const refresh = useRefresh();
  const printRef = useRef<HTMLDivElement | null>(null);

  const { data: clients } = useFetch<Client[]>("/api/crud/clients");
  const { data: orders } = useFetch<Order[]>("/api/crud/orders");
  const { data: budgets, loading } = useFetch<Budget[]>("/api/crud/budgets");

  function setField<K extends keyof typeof form>(name: K, val: string) {
    setForm((prev) => ({ ...prev, [name]: val }));
  }

  function setItem(idx: number, key: keyof BudgetItem, val: string | number) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it))
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
        0
      ),
    [items]
  );
  const discount = useMemo(() => parseFloat(form.discount) || 0, [form.discount]);
  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const previewData = {
    title: form.title || "[Título do orçamento]",
    number: "ORC-XXXXXX",
    items: items.filter((i) => i.description || i.unitPrice > 0),
    subtotal,
    discount,
    total,
    validUntil: form.validUntil,
    notes: form.notes,
    status: "draft",
  };

  async function handleGenerate() {
    if (!form.title) {
      toast.error("Informe um título");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description && !i.unitPrice)) {
      toast.error("Adicione ao menos um item");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, any> = {
        title: form.title,
        items: JSON.stringify(items),
        total: subtotal,
        discount,
        finalTotal: total,
        validUntil: form.validUntil ? new Date(form.validUntil) : null,
        notes: form.notes || null,
        clientId: form.clientId || null,
        orderId: form.orderId || null,
        status: "draft",
      };
      const res = await apiPost("/api/crud/budgets", body);
      toast.success("Orçamento gerado!");
      setPreviewId(res.data.id);
      refresh();
      // soft reset
      setForm({ title: "", clientId: "", orderId: "", validUntil: "", notes: "", discount: "0" });
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar orçamento");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(b: Budget, status: string) {
    try {
      await apiPost(`/api/crud/budgets/${b.id}`, { status }, "PUT");
      toast.success(`Status atualizado: ${STATUS_META[status]?.label || status}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este orçamento?")) return;
    try {
      const res = await fetch(`/api/crud/budgets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Excluído");
      if (previewId === id) setPreviewId(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const selectedBudget = useMemo(() => {
    if (!budgets || !previewId) return null;
    return budgets.find((b) => b.id === previewId) || null;
  }, [budgets, previewId]);

  function handlePrint(b: Budget | null) {
    if (!b) return;
    setPreviewId(b.id);
    setTimeout(() => {
      const node = printRef.current;
      if (!node) {
        window.print();
        return;
      }
      const html = node.innerHTML;
      const w = window.open("", "_blank", "width=820,height=900");
      if (!w) {
        window.print();
        return;
      }
      w.document.write(`
        <!doctype html><html><head><meta charset="utf-8"/>
        <title>${b.number}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #000; }
          .doc { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #ddd; padding: 32px; }
          .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #FF6B00; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #FF6B00, #0066FF); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; }
          .brand-name { font-size: 20px; font-weight: 800; color: #000; }
          .brand-sub { font-size: 11px; color: #666; }
          .title-area { text-align: right; }
          .doc-title { font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #FF6B00; text-transform: uppercase; }
          .doc-num { font-size: 12px; color: #333; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
          .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
          .val { font-size: 14px; font-weight: 600; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ddd; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; color: #000; }
          .num-col { text-align: right; }
          .totals { margin-left: auto; width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .total-row.grand { border-top: 2px solid #FF6B00; padding-top: 12px; margin-top: 6px; font-size: 18px; font-weight: 800; }
          .sign { margin-top: 40px; padding-top: 18px; border-top: 1px solid #000; text-align: center; }
          .sign-line { font-size: 13px; color: #000; }
          .sign-sub { font-size: 10px; color: #666; margin-top: 2px; }
          .footer-note { margin-top: 18px; font-size: 10px; color: #999; text-align: center; }
        </style>
        </head><body><div class="doc">${html}</div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
        </body></html>
      `);
      w.document.close();
    }, 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerador de Orçamento"
        description="Monte propostas profissionais com itens dinâmicos e totals automáticos"
        icon={<FileText className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: FORM */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Dados do Orçamento</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {items.length} item(ns)
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Título <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Ex.: Orçamento para produção de vídeo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente (opcional)</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setField("clientId", v)}
              >
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Válido até</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setField("validUntil", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Ordem de Serviço (opcional)</Label>
              <Select
                value={form.orderId}
                onValueChange={(v) => setField("orderId", v)}
              >
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Selecione a OS" /></SelectTrigger>
                <SelectContent>
                  {(orders || []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.number} — {o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ITEMS */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_100px_100px_40px] gap-2 px-3 py-2 bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Descrição</div>
              <div className="text-center">Qtd</div>
              <div className="text-right">Preço Unit.</div>
              <div className="text-right">Subtotal</div>
              <div></div>
            </div>
            <div className="divide-y divide-border/40">
              <AnimatePresence>
                {items.map((it, idx) => {
                  const sub = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                  return (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className="grid grid-cols-[1fr_70px_100px_100px_40px] gap-2 px-3 py-2 items-center"
                    >
                      <Input
                        value={it.description}
                        onChange={(e) => setItem(idx, "description", e.target.value)}
                        placeholder="Item / serviço"
                        className="h-8"
                      />
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, "quantity", Number(e.target.value) || 0)}
                        className="h-8 text-center"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => setItem(idx, "unitPrice", Number(e.target.value) || 0)}
                        className="h-8 text-right"
                      />
                      <div className="text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(sub)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <button
              onClick={addItem}
              className="w-full px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 border-t border-border/40"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </button>
          </div>

          {/* Totals + discount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.discount}
                onChange={(e) => setField("discount", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total Final</Label>
              <div className="h-9 px-3 rounded-md border border-border/60 bg-muted/30 flex items-center justify-end text-base font-bold tabular-nums">
                {formatCurrency(total)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Condições de pagamento, prazos, etc."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleGenerate} disabled={creating} className="flex-1">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? "Gerando..." : "Gerar Orçamento"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePrint(selectedBudget)}
              disabled={!selectedBudget}
            >
              <Printer className="h-4 w-4 mr-2" />
              Baixar/Imprimir
            </Button>
          </div>
        </Card>

        {/* RIGHT: PREVIEW */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent-blue" />
              <h3 className="font-semibold">Pré-visualização</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">Tempo real</Badge>
          </div>

          <motion.div
            key={`${form.title}-${items.length}-${form.discount}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BudgetDocument
              ref={printRef}
              data={previewData}
              client={(() => {
                if (!form.clientId || !clients) return null;
                return clients.find((c) => c.id === form.clientId) || null;
              })()}
              order={(() => {
                if (!form.orderId || !orders) return null;
                return orders.find((o) => o.id === form.orderId) || null;
              })()}
            />
          </motion.div>
        </Card>
      </div>

      {/* LIST */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Orçamentos Anteriores</h3>
            <p className="text-xs text-muted-foreground">
              Atualize o status enviando, aprovando ou rejeitando
            </p>
          </div>
          {budgets && budgets.length > 0 && (
            <Badge variant="secondary">{budgets.length} orçamento(s)</Badge>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !budgets || budgets.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Nenhum orçamento ainda"
            description="Preencha o formulário e gere o primeiro"
          />
        ) : (
          <ScrollArea className="max-h-96">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
              <AnimatePresence>
                {budgets.map((b, i) => {
                  const selected = previewId === b.id;
                  const meta = STATUS_META[b.status] || STATUS_META.draft;
                  const itemsList = parseItems(b.items);
                  return (
                    <motion.div
                      key={b.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ y: -2 }}
                      className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                      }`}
                      onClick={() => setPreviewId(b.id)}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-semibold">{b.number}</p>
                            <p className="text-sm font-medium truncate">{b.title}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${meta.cls} text-[10px] shrink-0`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span>{itemsList.length} item(ns)</span>
                        {b.client && <span>• {b.client.name}</span>}
                        {b.validUntil && <span>• válido até {formatDate(b.validUntil)}</span>}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="text-right">
                          {b.discount > 0 && (
                            <p className="text-[10px] text-muted-foreground line-through">
                              {formatCurrency(Number(b.total))}
                            </p>
                          )}
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(Number(b.finalTotal))}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); handlePrint(b); }}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-blue-600"
                          disabled={b.status === "sent"}
                          onClick={(e) => { e.stopPropagation(); updateStatus(b, "sent"); }}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" /> Marcar enviado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-600"
                          disabled={b.status === "approved"}
                          onClick={(e) => { e.stopPropagation(); updateStatus(b, "approved"); }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-rose-600"
                          disabled={b.status === "rejected"}
                          onClick={(e) => { e.stopPropagation(); updateStatus(b, "rejected"); }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs ml-auto text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// BudgetDocument (printable + on-screen preview)
// ============================================================

interface BudgetDocumentProps {
  data: {
    title: string;
    number: string;
    items: BudgetItem[];
    subtotal: number;
    discount: number;
    total: number;
    validUntil?: string;
    notes?: string;
    status: string;
  };
  client?: Client | null;
  order?: Order | null;
}

const BudgetDocument = forwardRef<HTMLDivElement, BudgetDocumentProps>(
  ({ data, client, order }, ref) => {
    const validUntil = data.validUntil ? new Date(data.validUntil) : null;
    return (
      <div
        ref={ref}
        className="bg-white text-black rounded-xl border border-neutral-300 p-6 sm:p-8 shadow-sm"
        style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-[#FF6B00] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: "linear-gradient(135deg, #FF6B00, #0066FF)" }}
            >
              PM
            </div>
            <div>
              <div className="text-xl font-extrabold text-black">PlayMedia System</div>
              <div className="text-[11px] text-neutral-600">
                Proposta comercial
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-extrabold tracking-wider text-[#FF6B00] uppercase">
              Orçamento
            </div>
            <div className="text-xs text-neutral-700 mt-0.5 font-mono">{data.number}</div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-5">
          <Field label="Título" value={data.title} icon={<FileText className="h-3 w-3" />} />
          {client && (
            <Field label="Cliente" value={client.name} icon={<Users className="h-3 w-3" />} />
          )}
          {order && (
            <Field
              label="Ordem de Serviço"
              value={`${order.number} — ${order.title}`}
              icon={<Hash className="h-3 w-3" />}
            />
          )}
          <Field
            label="Data de Emissão"
            value={formatDate(new Date())}
            icon={<Calendar className="h-3 w-3" />}
          />
          {validUntil && (
            <Field
              label="Válido até"
              value={formatDate(validUntil)}
              icon={<Calendar className="h-3 w-3" />}
            />
          )}
        </div>

        {/* Items table */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className="text-left text-[10px] uppercase tracking-wider text-neutral-500 py-2 px-2 border-b border-neutral-300 bg-neutral-50">
                Descrição
              </th>
              <th className="text-center text-[10px] uppercase tracking-wider text-neutral-500 py-2 px-2 border-b border-neutral-300 bg-neutral-50">
                Qtd
              </th>
              <th className="text-right text-[10px] uppercase tracking-wider text-neutral-500 py-2 px-2 border-b border-neutral-300 bg-neutral-50">
                Preço Unit.
              </th>
              <th className="text-right text-[10px] uppercase tracking-wider text-neutral-500 py-2 px-2 border-b border-neutral-300 bg-neutral-50">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-neutral-400">
                  Nenhum item adicionado
                </td>
              </tr>
            ) : (
              data.items.map((it, idx) => {
                const sub = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                return (
                  <tr key={idx}>
                    <td className="py-2.5 px-2 text-sm text-black border-b border-neutral-100">
                      {it.description || <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-sm text-center text-black border-b border-neutral-100 tabular-nums">
                      {Number(it.quantity) || 0}
                    </td>
                    <td className="py-2.5 px-2 text-sm text-right text-black border-b border-neutral-100 tabular-nums">
                      {formatCurrency(Number(it.unitPrice) || 0)}
                    </td>
                    <td className="py-2.5 px-2 text-sm text-right font-semibold text-black border-b border-neutral-100 tabular-nums">
                      {formatCurrency(sub)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-full max-w-xs space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-600">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-600">Desconto</span>
                <span className="tabular-nums text-rose-600">- {formatCurrency(data.discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t-2 border-[#FF6B00] mt-1">
              <span className="text-[11px] uppercase tracking-wider text-[#FF6B00] font-bold">
                Total
              </span>
              <span className="text-2xl font-extrabold tabular-nums text-black">
                {formatCurrency(data.total)}
              </span>
            </div>
          </div>
        </div>

        {data.notes && (
          <div className="mb-5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
              <StickyNote className="h-3 w-3" /> Observações
            </div>
            <div className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap bg-neutral-50 rounded-md p-2.5 border border-neutral-200">
              {data.notes}
            </div>
          </div>
        )}

        {/* Signature */}
        <div className="mt-10 pt-4 border-t border-black text-center">
          <div className="text-sm text-black">Aprovo o orçamento acima</div>
          <div className="text-[10px] text-neutral-600 mt-1">
            Assinatura do cliente — {client?.name || "_______"}
          </div>
        </div>

        <div className="mt-4 text-[10px] text-neutral-500 text-center">
          Orçamento gerado pelo PlayMedia System em {formatDate(new Date())}.
          {validUntil && ` Válido até ${formatDate(validUntil)}.`}
        </div>
      </div>
    );
  }
);
BudgetDocument.displayName = "BudgetDocument";

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-black truncate">{value}</div>
    </div>
  );
}
