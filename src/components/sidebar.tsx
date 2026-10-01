"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Wrench,
  ArrowLeftRight,
  CalendarClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  Wallet,
  Factory,
  FileText,
  FileSpreadsheet,
  Target,
  Bot,
  X,
  Sparkles,
  Tv,
  Settings,
} from "lucide-react";
import { useAppStore, type ViewKey } from "@/lib/store";
import { useFetch } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";

const NAV_GROUPS: {
  label: string;
  items: { key: ViewKey; label: string; icon: any; desc?: string }[];
}[] = [
  {
    label: "Visão Geral",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "assistant", label: "Assistente IA", icon: Bot, desc: "Gemini" },
    ],
  },
  {
    label: "Assinaturas",
    items: [{ key: "unitv", label: "UNITV", icon: Tv }],
  },
  {
    label: "Cadastros",
    items: [
      { key: "clients", label: "Clientes", icon: Users },
      { key: "services", label: "Serviços & Catálogo", icon: Wrench },
      { key: "monthly", label: "Mensalistas", icon: Repeat },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { key: "transactions", label: "Entradas & Saídas", icon: ArrowLeftRight },
      { key: "fixed", label: "Contas Fixas", icon: CalendarClock },
      { key: "payable", label: "A Pagar", icon: ArrowDownToLine },
      { key: "receivable", label: "A Receber", icon: ArrowUpFromLine },
    ],
  },
  {
    label: "Carteira & Crédito",
    items: [{ key: "wallets", label: "Carteiras & Cartões", icon: Wallet }],
  },
  {
    label: "Produção & Geradores",
    items: [
      { key: "production", label: "Produção (Kanban)", icon: Factory },
      { key: "receipt", label: "Comprovantes", icon: FileText },
      { key: "budget", label: "Orçamentos", icon: FileSpreadsheet },
      { key: "goals", label: "Metas de Depósito", icon: Target },
    ],
  },
  {
    label: "Sistema",
    items: [{ key: "settings", label: "Configurações", icon: Settings }],
  },
];

export function Sidebar({
  current,
  onChange,
}: {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}) {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const { data: unitvSummary } = useFetch<{ alertCount: number }>("/api/unitv/summary");
  const unitvAlerts = unitvSummary?.alertCount ?? 0;

  const SidebarContent = (
    <nav className="flex flex-col gap-5 p-4 h-full overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between px-2 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold">PlayMedia</span>
        </div>
        <button onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = current === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-primary"
                  />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    active && "scale-110"
                  )}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === "unitv" && unitvAlerts > 0 && (
                  <span className="min-w-5 text-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                    {unitvAlerts}
                  </span>
                )}
                {item.desc && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-semibold">
                    {item.desc}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-auto p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent-blue/5 border border-border/50">
        <p className="text-[10px] text-muted-foreground text-center">
          Powered by <span className="font-semibold gradient-text">Gemini AI</span>
        </p>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border/50 bg-sidebar/50 backdrop-blur-sm">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-sidebar border-r border-border shadow-2xl"
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
