"use client";

import { Sparkles, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/50 glass">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="font-semibold">PlayMedia System</span>
          <span className="hidden sm:inline">— Gestão Financeira Inteligente</span>
        </div>
        <div className="flex items-center gap-1">
          Feito com <Heart className="h-3 w-3 text-primary fill-primary" /> + IA Gemini
        </div>
      </div>
    </footer>
  );
}
