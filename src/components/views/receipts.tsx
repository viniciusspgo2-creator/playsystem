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
  Receipt as ReceiptIcon,
  Plus,
  Printer,
  FileText,
  Trash2,
  Eye,
  Loader2,
  User,
  Users,
  Wallet,
  Calendar,
  Hash,
  ShieldCheck,
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
interface Receipt {
  id: string;
  number: string;
  payer: string;
  recipient: string;
  amount: number;
  description: string;
  paymentMethod: string;
  date: string;
  notes?: string | null;
  clientId?: string | null;
  orderId?: string | null;
  client?: { id: string; name: string } | null;
  order?: { id: string; title: string; number: string } | null;
  createdAt: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "card", label: "Cartão" },
  { value: "check", label: "Cheque" },
];

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  transfer: "Transferência Bancária",
  card: "Cartão",
  check: "Cheque",
};

function genAuthCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function ReceiptsView() {
  const [form, setForm] = useState({
    payer: "",
    recipient: "",
    amount: "",
    description: "",
    paymentMethod: "pix",
    date: new Date().toISOString().slice(0, 10),
    clientId: "",
    orderId: "",
    notes: "",
  });
  const [authCode, setAuthCode] = useState<string>(genAuthCode());
  const [creating, setCreating] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const refresh = useRefresh();
  const printRef = useRef<HTMLDivElement | null>(null);

  const { data: clients } = useFetch<Client[]>("/api/crud/clients");
  const { data: orders } = useFetch<Order[]>("/api/crud/orders");
  const { data: receipts, loading } = useFetch<Receipt[]>("/api/crud/receipts");

  // Selected receipt (preview one) — either a freshly created one or picked from list
  const previewReceipt = useMemo(() => {
    if (!receipts) return null;
    if (previewId) return receipts.find((r) => r.id === previewId) || null;
    return null;
  }, [receipts, previewId]);

  // When form changes refresh auth code occasionally to feel "live" (only when no print yet)
  useEffect(() => {
    setAuthCode(genAuthCode());
  }, [form.amount, form.paymentMethod, form.payer, form.recipient]);

  function setField<K extends keyof typeof form>(name: K, val: string) {
    setForm((prev) => ({ ...prev, [name]: val }));
  }

  const previewData = {
    payer: form.payer || "[Pagador]",
    recipient: form.recipient || "[Beneficiário]",
    amount: parseFloat(form.amount) || 0,
    description: form.description || "[Descrição do pagamento]",
    paymentMethod: form.paymentMethod,
    date: form.date,
    notes: form.notes,
    number: "REC-XXXXXX",
    authCode,
  };

  async function handleGenerate() {
    if (!form.payer || !form.recipient || !form.amount || !form.description) {
      toast.error("Preencha pagador, beneficiário, valor e descrição");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, any> = {
        payer: form.payer,
        recipient: form.recipient,
        amount: Number(form.amount),
        description: form.description,
        paymentMethod: form.paymentMethod,
        date: form.date ? new Date(form.date) : new Date(),
        notes: form.notes || null,
        clientId: form.clientId || null,
        orderId: form.orderId || null,
      };
      const res = await apiPost("/api/crud/receipts", body);
      toast.success("Comprovante gerado!");
      setPrintId(res.data.id);
      setPreviewId(res.data.id);
      refresh();
      // reset partial form so user can keep payer/recipient
      setForm((p) => ({ ...p, amount: "", description: "", notes: "" }));
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar comprovante");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este comprovante?")) return;
    try {
      const res = await fetch(`/api/crud/receipts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Excluído");
      if (previewId === id) setPreviewId(null);
      if (printId === id) setPrintId(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function handlePrint(receipt: Receipt | null) {
    if (!receipt) return;
    setPreviewId(receipt.id);
    setPrintId(receipt.id);
    // wait for the print node to be visible then trigger print
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
        <title>${receipt.number}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #000; }
          .receipt { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #ddd; padding: 32px; }
          .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #FF6B00; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #FF6B00, #0066FF); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; }
          .brand-name { font-size: 20px; font-weight: 800; }
          .brand-sub { font-size: 11px; color: #666; }
          .title-area { text-align: right; }
          .doc-title { font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #FF6B00; }
          .doc-num { font-size: 12px; color: #333; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; margin-bottom: 16px; }
          .row { display: flex; flex-direction: column; }
          .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
          .value { font-size: 14px; font-weight: 600; color: #000; }
          .amount-box { margin: 24px 0 20px; border: 2px dashed #FF6B00; border-radius: 12px; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; background: #fff8f3; }
          .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #FF6B00; font-weight: 700; }
          .amount-val { font-size: 32px; font-weight: 800; color: #000; }
          .section-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.6px; margin-bottom: 4px; }
          .section-text { font-size: 13px; color: #222; line-height: 1.5; }
          .auth-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ddd; padding-top: 14px; margin-top: 20px; }
          .auth-label { font-size: 10px; color: #888; }
          .auth-code { font-family: 'Courier New', monospace; font-size: 12px; color: #000; font-weight: 700; letter-spacing: 2px; }
          .signature { margin-top: 36px; padding-top: 18px; border-top: 1px solid #000; text-align: center; }
          .sign-line { font-size: 12px; color: #000; }
          .sign-sub { font-size: 10px; color: #666; margin-top: 2px; }
          .footer-note { margin-top: 18px; font-size: 10px; color: #999; text-align: center; }
        </style>
        </head><body><div class="receipt">${html}</div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
        </body></html>
      `);
      w.document.close();
    }, 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerador de Comprovante de Pagamento"
        description="Crie comprovantes oficiais em segundos — pronto para imprimir"
        icon={<ReceiptIcon className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: FORM */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Dados do Comprovante</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Pagador <span className="text-destructive">*</span></Label>
              <Input
                value={form.payer}
                onChange={(e) => setField("payer", e.target.value)}
                placeholder="Quem pagou"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Beneficiário <span className="text-destructive">*</span></Label>
              <Input
                value={form.recipient}
                onChange={(e) => setField("recipient", e.target.value)}
                placeholder="Quem recebeu"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) => setField("paymentMethod", v)}
              >
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Descrição <span className="text-destructive">*</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Ex.: Pagamento de serviço de edição de vídeo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente (opcional)</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setField("clientId", v)}
              >
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Observações extras"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleGenerate} disabled={creating} className="flex-1">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? "Gerando..." : "Gerar Comprovante"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePrint(previewReceipt)}
              disabled={!previewReceipt}
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
            key={`${form.payer}-${form.recipient}-${form.amount}-${form.paymentMethod}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ReceiptDocument
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
            <h3 className="font-semibold">Comprovantes Anteriores</h3>
            <p className="text-xs text-muted-foreground">
              Clique em um item para visualizar e reimprimir
            </p>
          </div>
          {receipts && receipts.length > 0 && (
            <Badge variant="secondary">{receipts.length} registrado(s)</Badge>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !receipts || receipts.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon className="h-6 w-6" />}
            title="Nenhum comprovante ainda"
            description="Preencha o formulário acima e gere o primeiro"
          />
        ) : (
          <ScrollArea className="max-h-96">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-2">
              <AnimatePresence>
                {receipts.map((r, i) => {
                  const selected = previewId === r.id;
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ y: -2 }}
                      className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                      }`}
                      onClick={() => setPreviewId(r.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                            <ReceiptIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-mono font-semibold">{r.number}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(r.date)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px]">
                          {METHOD_LABEL[r.paymentMethod] || r.paymentMethod}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{r.payer} → {r.recipient}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-base font-bold tabular-nums">
                          {formatCurrency(r.amount)}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handlePrint(r); }}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
// ReceiptDocument (printable + on-screen preview)
// ============================================================

interface ReceiptDocumentProps {
  data: {
    payer: string;
    recipient: string;
    amount: number;
    description: string;
    paymentMethod: string;
    date: string;
    notes?: string;
    number: string;
    authCode: string;
  };
  client?: Client | null;
  order?: Order | null;
}

const ReceiptDocument = forwardRef<HTMLDivElement, ReceiptDocumentProps>(
  ({ data, client, order }, ref) => {
    const dt = data.date ? new Date(data.date) : new Date();
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
                Gestão financeira & produção criativa
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-extrabold tracking-wider text-[#FF6B00] uppercase">
              Comprovante de Pagamento
            </div>
            <div className="text-xs text-neutral-700 mt-0.5 font-mono">{data.number}</div>
          </div>
        </div>

        {/* Grid of fields */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-4">
          <Field label="Pagador" value={data.payer} icon={<User className="h-3 w-3" />} />
          <Field label="Beneficiário" value={data.recipient} icon={<User className="h-3 w-3" />} />
          <Field
            label="Forma de Pagamento"
            value={METHOD_LABEL[data.paymentMethod] || data.paymentMethod}
            icon={<Wallet className="h-3 w-3" />}
          />
          <Field
            label="Data"
            value={formatDate(dt)}
            icon={<Calendar className="h-3 w-3" />}
          />
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
        </div>

        {/* Amount */}
        <div className="my-5 border-2 border-dashed border-[#FF6B00] rounded-xl p-4 flex justify-between items-center bg-[#fff8f3]">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#FF6B00] font-bold">
              Valor Pago
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Pagamento confirmado</div>
          </div>
          <div className="text-3xl font-extrabold text-black tabular-nums">
            {formatCurrency(data.amount)}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Descrição
          </div>
          <div className="text-sm text-neutral-800 leading-relaxed">{data.description}</div>
        </div>

        {data.notes && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
              Observações
            </div>
            <div className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {data.notes}
            </div>
          </div>
        )}

        {/* Auth code */}
        <div className="flex items-center justify-between border-t border-neutral-300 pt-3 mt-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <div className="text-[10px] text-neutral-600">
              Documento autenticado eletronicamente
            </div>
          </div>
          <div className="font-mono text-xs text-black font-bold tracking-widest">
            {data.authCode}
          </div>
        </div>

        {/* Signature */}
        <div className="mt-10 pt-4 border-t border-black text-center">
          <div className="text-sm text-black">Assinatura do Beneficiário</div>
          <div className="text-[10px] text-neutral-600 mt-1">
            Declaro ter recebido o valor acima descrito
          </div>
        </div>

        <div className="mt-4 text-[10px] text-neutral-500 text-center">
          Este comprovante foi gerado eletronicamente pelo PlayMedia System em{" "}
          {formatDate(new Date())}.
        </div>
      </div>
    );
  }
);
ReceiptDocument.displayName = "ReceiptDocument";

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
