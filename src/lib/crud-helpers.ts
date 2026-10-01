import { db } from "@/lib/db";

// SQLite (sandbox/dev local) não suporta `mode: "insensitive"` no Prisma;
// Postgres (Vercel/Neon) precisa dele para busca case-insensitive.
export const isSqlite = (process.env.DATABASE_URL || "").startsWith("file:");
export function ciContains(value: string) {
  return isSqlite
    ? { contains: value }
    : { contains: value, mode: "insensitive" as const };
}

// Resource -> Prisma model mapping
const MODEL_MAP: Record<string, string> = {
  clients: "client",
  "service-types": "serviceType",
  services: "serviceType",
  orders: "serviceOrder",
  transactions: "transaction",
  "fixed-accounts": "fixedAccount",
  fixed: "fixedAccount",
  payables: "payable",
  receivables: "receivable",
  wallets: "wallet",
  "credit-cards": "creditCard",
  goals: "goal",
  receipts: "receipt",
  budgets: "budget",
  reminders: "reminder",
  "quick-notes": "quickNote",
};

export function getModel(resource: string) {
  const key = MODEL_MAP[resource];
  if (!key) return null;
  return (db as any)[key] as any;
}

export const INCLUDES: Record<string, any> = {
  clients: {
    orders: { select: { id: true, title: true, status: true, price: true } },
  },
  orders: {
    client: { select: { id: true, name: true } },
    serviceType: { select: { id: true, name: true, color: true, icon: true } },
  },
  transactions: {
    client: { select: { id: true, name: true } },
    order: { select: { id: true, title: true, number: true } },
    wallet: { select: { id: true, name: true } },
    creditCard: { select: { id: true, name: true } },
  },
  payables: {
    wallet: { select: { id: true, name: true } },
    creditCard: { select: { id: true, name: true } },
  },
  receivables: {
    client: { select: { id: true, name: true } },
    wallet: { select: { id: true, name: true } },
    order: { select: { id: true, title: true, number: true } },
  },
  wallets: {
    _count: { select: { transactions: true } },
    creditCards: true,
  },
  "credit-cards": {
    wallet: { select: { id: true, name: true } },
  },
  "fixed-accounts": {
    wallet: { select: { id: true, name: true } },
    creditCard: { select: { id: true, name: true } },
  },
  goals: {
    wallet: { select: { id: true, name: true } },
  },
  receipts: {
    client: { select: { id: true, name: true } },
    order: { select: { id: true, title: true, number: true } },
  },
  budgets: {
    client: { select: { id: true, name: true } },
    order: { select: { id: true, title: true, number: true } },
  },
};

// ============================================================
// INTEGRIDADE DE VÍNCULOS (FKs) — evita "Foreign key constraint violated"
// Formulários flexíveis (pessoa avulsa, campo de ordem, carteiras) podem
// enviar vínculos vazios ("") ou inválidos (id digitado/excluído). O servidor
// valida: "" ou id inexistente → null (sem vínculo), nunca explode.
// ============================================================
export const FK_FIELDS: Record<
  string,
  { field: string; model: string }[]
> = {
  transactions: [
    { field: "clientId", model: "client" },
    { field: "orderId", model: "serviceOrder" },
    { field: "walletId", model: "wallet" },
    { field: "creditCardId", model: "creditCard" },
  ],
  receivables: [
    { field: "clientId", model: "client" },
    { field: "orderId", model: "serviceOrder" },
    { field: "walletId", model: "wallet" },
  ],
  payables: [
    { field: "walletId", model: "wallet" },
    { field: "creditCardId", model: "creditCard" },
  ],
  "fixed-accounts": [
    { field: "walletId", model: "wallet" },
    { field: "creditCardId", model: "creditCard" },
  ],
  receipts: [
    { field: "clientId", model: "client" },
    { field: "orderId", model: "serviceOrder" },
  ],
  budgets: [
    { field: "clientId", model: "client" },
    { field: "orderId", model: "serviceOrder" },
  ],
  orders: [
    { field: "clientId", model: "client" },
    { field: "serviceTypeId", model: "serviceType" },
  ],
  "credit-cards": [{ field: "walletId", model: "wallet" }],
  goals: [{ field: "walletId", model: "wallet" }],
};

// Valida e limpa referências no objeto `data` (mutando-o) conforme o resource.
// - undefined: campo não foi enviado → não mexe (update parcial seguro)
// - "" / "__none__" / null → null
// - id que não existe no banco → null (solta o vínculo em vez de travar o fluxo)
export async function sanitizeForeignKeys(
  resource: string,
  data: any
): Promise<any> {
  const refs = FK_FIELDS[resource];
  if (!data || !refs) return data;
  for (const { field, model } of refs) {
    if (data[field] === undefined) continue;
    const v = data[field];
    if (v === null || v === "" || v === "__none__") {
      data[field] = null;
      continue;
    }
    try {
      const exists = await (db as any)[model].findUnique({
        where: { id: String(v) },
      });
      if (!exists) data[field] = null;
    } catch {
      data[field] = null;
    }
  }
  return data;
}

// Traduz erros do Prisma para mensagens curtas e humanas — nada de parede
// de texto técnica vermelha para o usuário.
export function friendlyError(e: any): string {
  const code = e?.code;
  const msg: string = e?.message || "";
  if (code === "P2003" || msg.includes("Foreign key constraint")) {
    // constraint no formato `Tabela_campo_fkey`, ex: Receivable_orderId_fkey
    const m = msg.match(/constraint:\s*`?\w+_([A-Za-z]+)_fkey`?/);
    const col = m ? m[1] : "";
    const labels: Record<string, string> = {
      clientId: "cliente",
      orderId: "ordem de serviço",
      walletId: "carteira",
      creditCardId: "cartão de crédito",
      serviceTypeId: "tipo de serviço",
    };
    const what = labels[col] || col || "referência";
    return `O vínculo com ${what} aponta para um registro que não existe. O campo foi liberado — revise e salve de novo.`;
  }
  if (code === "P2002" || msg.includes("Unique constraint"))
    return "Já existe um registro com esse valor.";
  if (code === "P2025") return "Registro não encontrado — ele pode ter sido excluído.";
  if (code === "P2023" || msg.includes("Malformed")) return "Identificador inválido.";
  // mensagem do Prisma vem multi-linha; mostra só a linha final legível
  const last = msg.split("\n").map((l) => l.trim()).filter(Boolean).pop();
  return last || "Algo deu errado. Tente novamente.";
}

// Common service types seed
export const DEFAULT_SERVICE_TYPES = [
  { name: "Arte", color: "#FF6B00", icon: "Palette", basePrice: 150, description: "Criação de arte, design gráfico, logos" },
  { name: "Vídeo", color: "#0066FF", icon: "Video", basePrice: 500, description: "Edição e produção de vídeos" },
  { name: "Site", color: "#10B981", icon: "Globe", basePrice: 1500, description: "Desenvolvimento de sites" },
  { name: "Sistemas PHP", color: "#8B5CF6", icon: "Code2", basePrice: 3000, description: "Sistemas web em PHP" },
  { name: "Automações", color: "#F59E0B", icon: "Zap", basePrice: 800, description: "Automação de processos" },
  { name: "Dublagem de Vídeos", color: "#EC4899", icon: "Mic", basePrice: 200, description: "Dublagem e locução" },
  { name: "Text-to-Speech", color: "#06B6D4", icon: "Volume2", basePrice: 50, description: "Conversão de texto em áudio" },
];

export const DEFAULT_WALLETS = [
  { name: "Nubank", type: "bank", color: "#8A05BE", icon: "Landmark", balance: 0 },
  { name: "PicPay", type: "digital", color: "#21C9A0", icon: "Wallet", balance: 0 },
  { name: "Mercado Pago", type: "digital", color: "#00B1EA", icon: "ShoppingBag", balance: 0 },
];

export const DEFAULT_CREDIT_CARDS = [
  { name: "Credicard", totalLimit: 5000, color: "#E11D48" },
  { name: "Banco BV", totalLimit: 3000, color: "#1E40AF" },
  { name: "Mercado Pago Crédito", totalLimit: 2000, color: "#00B1EA" },
  { name: "PicPay Crédito", totalLimit: 1500, color: "#21C9A0" },
  { name: "Wise", totalLimit: 1000, color: "#16A34A" },
  { name: "PayPal", totalLimit: 800, color: "#1E3A8A" },
  { name: "Nubank Crédito", totalLimit: 4500, color: "#8A05BE" },
];
