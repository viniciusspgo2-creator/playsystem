// Helpers puros da aba UNITV (usados no servidor e no navegador).
// Datas de vencimento são "só dia" (YYYY-MM-DD), guardadas como 00:00 UTC
// para não "andar" um dia por causa de fuso horário.

export const DEFAULT_ALERT_DAYS = 5;

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Olá {nome}! Sua assinatura UNITV vence em {vencimento} ({dias}). Quer renovar? Me avise por aqui 😊";

export const PLAN_OPTIONS = [
  { months: 1, label: "Mensal" },
  { months: 3, label: "Trimestral" },
  { months: 6, label: "Semestral" },
  { months: 12, label: "Anual" },
] as const;

/** Data de hoje (YYYY-MM-DD) no horário de Brasília. */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Extrai YYYY-MM-DD de um ISO string ou Date. */
export function ymd(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function ymdToDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Meio-dia UTC: usado para a data do pagamento (evita virar o dia no Brasil). */
export function ymdToNoon(s: string): Date {
  return new Date(`${s}T12:00:00.000Z`);
}

function parts(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** Dias entre hoje e o vencimento. Negativo = já venceu. */
export function daysUntil(expires: string | Date, today: string = todayBR()): number {
  const a = parts(ymd(expires));
  const b = parts(today);
  const ms = Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d);
  return Math.round(ms / 86400000);
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28/02). */
export function addMonths(s: string, months: number): string {
  const { y, m, d } = parts(s);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Regra da renovação: se o cliente ainda está ativo, soma em cima do vencimento atual;
 * se já venceu, conta a partir da data do pagamento.
 */
export function computeNewExpiry(
  currentExpiry: string | null | undefined,
  paidAt: string,
  months: number
): string {
  const cur = ymd(currentExpiry);
  const base = cur && cur >= paidAt ? cur : paidAt;
  return addMonths(base, months);
}

export function fmtBR(s: string | Date | null | undefined): string {
  const v = ymd(s);
  if (!v) return "-";
  const { y, m, d } = parts(v);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Aceita "25", "25,50", "25.50", "1.250,00". */
export function parseMoney(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Aceita "25/12/2026", "25/12/26" ou "2026-12-25". Retorna YYYY-MM-DD ou null. */
export function parseDateInput(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type UnitvStatus = "expired" | "today" | "soon" | "ok" | "inactive";

export function statusOf(days: number, alertDays: number, active = true): UnitvStatus {
  if (!active) return "inactive";
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= alertDays) return "soon";
  return "ok";
}

export function daysLabel(days: number): string {
  if (days < 0) return `venceu há ${Math.abs(days)} dia${Math.abs(days) > 1 ? "s" : ""}`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  return `vence em ${days} dias`;
}

export function fillTemplate(
  tpl: string,
  data: { nome: string; vencimento: string; dias: number; valor?: number }
): string {
  return tpl
    .replace(/\{nome\}/gi, data.nome)
    .replace(/\{vencimento\}/gi, data.vencimento)
    .replace(/\{dias\}/gi, daysLabel(data.dias))
    .replace(
      /\{valor\}/gi,
      data.valor
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.valor)
        : ""
    );
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
