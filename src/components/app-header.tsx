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
import { Sparkles, Menu, LogOut, User as UserIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/api-hooks";
import { apiDelete } from "@/lib/api-hooks";
import { toast } from "sonner";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
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
  const { view, setSidebarOpen } = useAppStore();
  const { data: auth } = useFetch<{
    user: { name: string; email: string } | null;
  }>("/api/auth");
  const [now, setNow] = useState(new Date());

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
