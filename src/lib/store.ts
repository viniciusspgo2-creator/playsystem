"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewKey =
  | "dashboard"
  | "reminders"
  | "clients"
  | "services"
  | "transactions"
  | "fixed"
  | "payable"
  | "receivable"
  | "monthly"
  | "wallets"
  | "production"
  | "receipt"
  | "budget"
  | "goals"
  | "assistant"
  | "unitv"
  | "settings";

interface AppState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  authed: boolean;
  setAuthed: (v: boolean) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: "dashboard",
      setView: (v) => set({ view: v, sidebarOpen: false }),
      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      authed: false,
      setAuthed: (v) => set({ authed: v }),
      refreshKey: 0,
      triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
    }),
    {
      name: "playmedia-store",
      partialize: (s) => ({ view: s.view, authed: s.authed }),
    }
  )
);
