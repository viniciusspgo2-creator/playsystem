"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui-primitives/metric-card";
import { PageHeader, Card, EmptyState } from "@/components/ui-primitives/page-header";
import { FormModal, type Field } from "@/components/ui-primitives/form-modal";
import { useFetch } from "@/lib/api-hooks";
import { formatCurrency } from "@/lib/format";
import {
  Wallet as WalletIcon,
  CreditCard as CreditCardIcon,
  Plus,
  Landmark,
  Smartphone,
  Banknote,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number | string;
  color: string;
  icon?: string | null;
  active: boolean;
  _count?: { transactions: number };
  creditCards?: CreditCard[];
}

interface CreditCard {
  id: string;
  name: string;
  walletId?: string | null;
  totalLimit: number | string;
  usedLimit: number | string;
  closingDay?: number | null;
  dueDay?: number | null;
  color: string;
  active: boolean;
  wallet?: { id: string; name: string } | null;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; bg: string }> = {
  bank: { label: "Banco", icon: <Landmark className="h-3 w-3" />, bg: "bg-accent-blue/15 text-accent-blue" },
  digital: { label: "Digital", icon: <Smartphone className="h-3 w-3" />, bg: "bg-primary/15 text-primary" },
  cash: { label: "Dinheiro", icon: <Banknote className="h-3 w-3" />, bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

export function WalletsView() {
  const { data: walletsData, loading: wl } = useFetch<Wallet[]>("/api/crud/wallets");
  const { data: cardsData, loading: cl } = useFetch<CreditCard[]>("/api/crud/credit-cards");

  const [walletModal, setWalletModal] = useState<{ open: boolean; id?: string; data?: Partial<Wallet> }>({ open: false });
  const [cardModal, setCardModal] = useState<{ open: boolean; id?: string; data?: Partial<CreditCard> }>({ open: false });

  const wallets = walletsData || [];
  const cards = cardsData || [];

  const totals = useMemo(() => {
    const balance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);
    const used = cards.reduce((s, c) => s + (Number(c.usedLimit) || 0), 0);
    const totalLimit = cards.reduce((s, c) => s + (Number(c.totalLimit) || 0), 0);
    return { balance, used, available: totalLimit - used, totalLimit };
  }, [wallets, cards]);

  const walletFields: Field[] = [
    { name: "name", label: "Nome", type: "text", placeholder: "Ex: Nubank", required: true },
    {
      name: "type",
      label: "Tipo",
      type: "select",
      options: [
        { value: "bank", label: "Banco" },
        { value: "digital", label: "Digital" },
        { value: "cash", label: "Dinheiro" },
      ],
      required: true,
      default: "bank",
    },
    { name: "balance", label: "Saldo", type: "number", step: "0.01", default: 0 },
    { name: "color", label: "Cor", type: "color", default: "#FF6B00" },
    { name: "icon", label: "Ícone (lucide)", type: "text", placeholder: "Ex: Landmark" },
    { name: "active", label: "Ativa", type: "switch", default: true },
  ];

  const cardFields: Field[] = [
    { name: "name", label: "Nome do Cartão", type: "text", placeholder: "Ex: Credicard", required: true },
    {
      name: "walletId",
      label: "Carteira Vinculada",
      type: "select",
      options: wallets.map((w) => ({ value: w.id, label: w.name })),
      placeholder: "Selecione...",
    },
    { name: "totalLimit", label: "Limite Total", type: "number", step: "0.01", default: 0, required: true },
    { name: "usedLimit", label: "Limite Usado", type: "number", step: "0.01", default: 0 },
    { name: "closingDay", label: "Dia Fechamento", type: "number", default: 1 },
    { name: "dueDay", label: "Dia Vencimento", type: "number", default: 10 },
    { name: "color", label: "Cor", type: "color", default: "#FF6B00" },
    { name: "active", label: "Ativo", type: "switch", default: true },
  ];

  if (wl || cl) {
    return (
      <div className="space-y-4">
        <PageHeader title="Carteiras & Cartões" description="Carregando..." icon={<WalletIcon className="h-5 w-5" />} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteiras & Cartões"
        description="Gerencie contas bancárias, digitais e cartões de crédito"
        icon={<WalletIcon className="h-5 w-5" />}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Saldo Total"
          value={formatCurrency(totals.balance)}
          subtitle={`${wallets.filter((w) => w.active).length} carteiras ativas`}
          icon={<WalletIcon className="h-5 w-5" />}
          variant="brand"
          delay={0}
        />
        <MetricCard
          title="Crédito Disponível"
          value={formatCurrency(totals.available)}
          subtitle={`de ${formatCurrency(totals.totalLimit)} de limite`}
          icon={<CreditCardIcon className="h-5 w-5" />}
          variant="blue"
          delay={0.05}
        />
        <MetricCard
          title="Crédito Usado"
          value={formatCurrency(totals.used)}
          subtitle={`${totals.totalLimit > 0 ? ((totals.used / totals.totalLimit) * 100).toFixed(0) : 0}% do limite total`}
          icon={<CreditCardIcon className="h-5 w-5" />}
          variant="warning"
          delay={0.1}
        />
      </div>

      {/* Wallets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Carteiras</h2>
            <p className="text-sm text-muted-foreground">Contas bancárias, digitais e dinheiro físico</p>
          </div>
          <Button onClick={() => setWalletModal({ open: true })} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Carteira
          </Button>
        </div>

        {wallets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<WalletIcon className="h-6 w-6" />}
              title="Nenhuma carteira"
              description="Cadastre suas contas para começar"
              action={{ label: "Nova Carteira", onClick: () => setWalletModal({ open: true }) }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((w, i) => {
              const meta = TYPE_META[w.type] ?? TYPE_META.bank;
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ y: -3 }}
                >
                  <Card className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full w-1.5" style={{ background: w.color }} />
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow shrink-0" style={{ background: w.color }}>
                          <WalletIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{w.name}</p>
                          <Badge className={cn("mt-0.5", meta.bg)} variant="secondary">
                            {meta.icon}
                            <span className="ml-1">{meta.label}</span>
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setWalletModal({ open: true, id: w.id, data: w })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(w.balance)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{w._count?.transactions ?? 0} transações</span>
                      {!w.active && <Badge variant="secondary" className="bg-muted text-muted-foreground">Inativa</Badge>}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Credit Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Cartões de Crédito</h2>
            <p className="text-sm text-muted-foreground">Limites, uso e vencimentos</p>
          </div>
          <Button onClick={() => setCardModal({ open: true })} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Cartão
          </Button>
        </div>

        {cards.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CreditCardIcon className="h-6 w-6" />}
              title="Nenhum cartão"
              description="Cadastre seus cartões de crédito"
              action={{ label: "Novo Cartão", onClick: () => setCardModal({ open: true }) }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c, i) => {
              const used = Number(c.usedLimit) || 0;
              const total = Number(c.totalLimit) || 0;
              const available = Math.max(0, total - used);
              const pct = total > 0 ? (used / total) * 100 : 0;
              const lastFour = c.id.slice(-4).padStart(4, "0");
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ y: -3 }}
                >
                  <Card>
                    {/* Credit card visual */}
                    <motion.div
                      whileHover={{ rotateZ: -1 }}
                      className="relative rounded-2xl p-5 shadow-lg overflow-hidden text-white"
                      style={{
                        aspectRatio: "1.586 / 1",
                        background: `linear-gradient(135deg, ${c.color} 0%, ${c.color} 55%, rgba(0,0,0,0.30) 100%)`,
                      }}
                    >
                      {/* Decoration */}
                      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-white/10" />
                      <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/5" />
                      <div className="relative flex flex-col h-full justify-between">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-xs opacity-80 uppercase tracking-wide truncate">{c.name}</p>
                            {c.wallet?.name && <p className="text-[10px] opacity-70 mt-0.5 truncate">{c.wallet.name}</p>}
                          </div>
                          <CreditCardIcon className="h-6 w-6 opacity-90 shrink-0" />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-400 border border-yellow-500/30 relative overflow-hidden">
                            <div className="absolute inset-1 grid grid-cols-3 gap-px">
                              {Array.from({ length: 9 }).map((_, j) => <div key={j} className="bg-yellow-700/15" />)}
                            </div>
                          </div>
                          <div className="h-1.5 w-6 rounded-full bg-white/40" />
                        </div>
                        <div>
                          <p className="font-mono text-sm tracking-widest opacity-90">•••• {lastFour}</p>
                        </div>
                        <div className="flex items-end justify-between text-xs">
                          <div>
                            <p className="opacity-70 text-[10px] uppercase tracking-wide">Limite</p>
                            <p className="font-semibold tabular-nums">{formatCurrency(total)}</p>
                          </div>
                          <div className="text-right">
                            <p className="opacity-70 text-[10px] uppercase tracking-wide">Disponível</p>
                            <p className="font-semibold tabular-nums">{formatCurrency(available)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Progress + meta */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Limite usado</span>
                        <span className="font-medium tabular-nums">{formatCurrency(used)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: pct > 80 ? "#f43f5e" : pct > 50 ? "#f59e0b" : c.color }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>Fechamento: dia {c.closingDay ?? "—"}</span>
                        <span>Vencimento: dia {c.dueDay ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        {!c.active ? (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">Inativo</Badge>
                        ) : (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setCardModal({ open: true, id: c.id, data: c })}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Wallet modal */}
      <FormModal
        open={walletModal.open}
        onOpenChange={(v) => setWalletModal((prev) => ({ ...prev, open: v }))}
        title={walletModal.id ? "Editar Carteira" : "Nova Carteira"}
        description="Preencha os dados da carteira"
        fields={walletFields}
        initialData={
          walletModal.data
            ? {
                name: walletModal.data.name,
                type: walletModal.data.type,
                balance: Number(walletModal.data.balance) || 0,
                color: walletModal.data.color,
                icon: walletModal.data.icon ?? "",
                active: walletModal.data.active,
              }
            : undefined
        }
        endpoint="/api/crud/wallets"
        id={walletModal.id}
      />

      {/* Card modal */}
      <FormModal
        open={cardModal.open}
        onOpenChange={(v) => setCardModal((prev) => ({ ...prev, open: v }))}
        title={cardModal.id ? "Editar Cartão" : "Novo Cartão"}
        description="Preencha os dados do cartão de crédito"
        fields={cardFields}
        initialData={
          cardModal.data
            ? {
                name: cardModal.data.name,
                walletId: cardModal.data.walletId ?? "",
                totalLimit: Number(cardModal.data.totalLimit) || 0,
                usedLimit: Number(cardModal.data.usedLimit) || 0,
                closingDay: Number(cardModal.data.closingDay) || 1,
                dueDay: Number(cardModal.data.dueDay) || 10,
                color: cardModal.data.color,
                active: cardModal.data.active,
              }
            : undefined
        }
        endpoint="/api/crud/credit-cards"
        id={cardModal.id}
      />
    </div>
  );
}
