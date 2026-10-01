"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Menu, LogOut, User as UserIcon, Bell, AlarmClock } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/api-hooks";
import { apiDelete } from "@/lib/api-hooks";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  reminders: "Lembretes",
  clients: "Clientes",
  services: "Serviços & Catálogo",
  transactions: "Entradas & Saídas",
  fixed: "Contas Fixas",
  payable: "Contas a Pagar",
  receivable: "Contas a Receber",
  monthly: "Mensalistas",
  wallets: "Carteiras & Cartões",
  production: "Produção (Kanban)",
  receipt: "Comprovantes",
  budget: "Orçamentos",
  goals: "Metas de Depósito",
  assistant: "Assistente IA",
  unitv: "UNITV",
  settings: "Configurações",
};

export function AppHeader() {
  const { view, setView, setSidebarOpen } = useAppStore();
  const { data: auth } = useFetch<{
    user: { name: string; email: string } | null;
  }>("/api/auth");
  const [now, setNow] = useState(new Date());

  // Lembretes para o sino (atrasados + hoje)
  const range = (() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    return { from: s.toISOString(), to: e.toISOString() };
  })();
  const { data: remSummary } = useFetch<{
    badge: number;
    overdue: number;
    today: number;
    items: {
      id: string;
      title: string;
      dueDate: string | null;
      priority: string;
      overdue: boolean;
    }[];
  }>(
    `/api/reminders/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const userName = auth?.user?.name || "Usuário";
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    try {
      await apiDelete("/api/auth");
      toast.success("Sessão encerrada.");
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/50">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 blur-md bg-primary/40 rounded-lg" />
              <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center shadow-md">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold leading-tight">
                PlayMedia <span className="gradient-text">System</span>
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {VIEW_TITLES[view] || "Painel"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block text-right">
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {now.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Sino de lembretes */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-full hover:bg-accent"
                title="Lembretes"
              >
                <Bell className="h-5 w-5" />
                {!!remSummary?.badge && remSummary.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background animate-pulse">
                    {remSummary.badge > 9 ? "9+" : remSummary.badge}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                <AlarmClock className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold flex-1">Foco de agora</p>
                {!!remSummary?.badge && remSummary.badge > 0 && (
                  <Badge className="bg-rose-500 text-white text-[10px]">
                    {remSummary.badge} pendente{remSummary.badge > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {!remSummary || remSummary.items.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm font-medium">Tudo tranquilo 🧘</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhum lembrete atrasado ou para hoje.
                    </p>
                  </div>
                ) : (
                  remSummary.items.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setView("reminders");
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-accent/50 transition-colors flex items-start gap-2",
                        r.overdue && "bg-rose-500/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 rounded-full shrink-0",
                          r.overdue
                            ? "bg-rose-500"
                            : r.priority === "high"
                            ? "bg-rose-400"
                            : "bg-amber-400"
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium truncate">
                          {r.title}
                        </span>
                        <span
                          className={cn(
                            "block text-[10px]",
                            r.overdue
                              ? "text-rose-600 dark:text-rose-400 font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {r.overdue
                            ? "Atrasado"
                            : r.dueDate
                            ? new Date(r.dueDate).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Hoje"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setView("reminders")}
                className="w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 border-t border-border/60 transition-colors"
              >
                Abrir todos os lembretes →
              </button>
            </PopoverContent>
          </Popover>

          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 px-2 rounded-full hover:bg-accent">
                <Avatar className="h-8 w-8 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{userName}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {auth?.user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
