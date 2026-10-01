import { db } from "@/lib/db";

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
  settings: "setting",
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
