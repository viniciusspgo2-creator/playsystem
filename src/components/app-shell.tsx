"use client";

import { useEffect, useState } from "react";
import { useAppStore, type ViewKey } from "@/lib/store";
import { useFetch } from "@/lib/api-hooks";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { AppHeader } from "@/components/app-header";
import { DashboardView } from "@/components/views/dashboard";
import { ClientsView } from "@/components/views/clients";
import { ServicesView } from "@/components/views/services";
import { TransactionsView } from "@/components/views/transactions";
import { FixedAccountsView } from "@/components/views/fixed-accounts";
import { PayablesView } from "@/components/views/payables";
import { ReceivablesView } from "@/components/views/receivables";
import { MonthlyView } from "@/components/views/monthly";
import { WalletsView } from "@/components/views/wallets";
import { ProductionView } from "@/components/views/production";
import { ReceiptsView } from "@/components/views/receipts";
import { BudgetsView } from "@/components/views/budgets";
import { GoalsView } from "@/components/views/goals";
import { AssistantView } from "@/components/views/assistant";
import { UnitvView } from "@/components/views/unitv";
import { SettingsView } from "@/components/views/settings";
import { toast } from "sonner";
import { Footer } from "@/components/footer";
import { Sparkles } from "lucide-react";

export function AppShell() {
  const { view, setView, authed, setAuthed } = useAppStore();
  const { data: authData, reload } = useFetch<{
    hasUser: boolean;
    authed: boolean;
    user: { id: string; email: string; name: string } | null;
  }>(authed ? null : "/api/auth");

  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (authData) {
      setAuthed(authData.authed);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBooted(true);
    }
  }, [authData, setAuthed]);

  // Auto-seed on first login (if no service types yet)
  useEffect(() => {
    if (authed) {
      fetch("/api/crud/service-types?limit=1")
        .then((r) => r.json())
        .then((d) => {
          if (!d.data || d.data.length === 0) {
            fetch("/api/seed", { method: "POST" }).then(() =>
              useAppStore.getState().triggerRefresh()
            );
          }
        })
        .catch(() => {});
    }
  }, [authed]);

  // Alerta de vencimentos UNITV ao abrir o sistema
  useEffect(() => {
    if (!authed) return;
    fetch("/api/unitv/summary")
      .then((r) => r.json())
      .then((d) => {
        const sum = d?.data;
        if (!sum || !sum.alertCount) return;
        const parts: string[] = [];
        if (sum.soonCount) parts.push(`${sum.soonCount} vencendo em até ${sum.alertDays} dias`);
        if (sum.expiredCount) parts.push(`${sum.expiredCount} já vencido${sum.expiredCount > 1 ? "s" : ""}`);
        toast.warning("UNITV: clientes para renovar", {
          description: parts.join(" • "),
          duration: 12000,
          action: { label: "Ver", onClick: () => useAppStore.getState().setView("unitv") },
        });
      })
      .catch(() => {});
  }, [authed]);

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse" />
            <Sparkles className="relative h-12 w-12 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            Carregando PlayMedia System...
          </p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return <AuthGate hasUser={authData?.hasUser ?? false} onAuthed={() => { setAuthed(true); reload(); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex flex-1 w-full">
        <Sidebar current={view} onChange={(v) => setView(v as ViewKey)} />
        <main className="flex-1 min-w-0">
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto pb-12">
            {view === "dashboard" && <DashboardView />}
            {view === "clients" && <ClientsView />}
            {view === "services" && <ServicesView />}
            {view === "transactions" && <TransactionsView />}
            {view === "fixed" && <FixedAccountsView />}
            {view === "payable" && <PayablesView />}
            {view === "receivable" && <ReceivablesView />}
            {view === "monthly" && <MonthlyView />}
            {view === "wallets" && <WalletsView />}
            {view === "production" && <ProductionView />}
            {view === "receipt" && <ReceiptsView />}
            {view === "budget" && <BudgetsView />}
            {view === "goals" && <GoalsView />}
            {view === "assistant" && <AssistantView />}
            {view === "unitv" && <UnitvView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
