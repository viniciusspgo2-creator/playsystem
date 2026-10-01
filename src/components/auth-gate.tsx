"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, Mail, User, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api-hooks";
import { toast } from "sonner";

export function AuthGate({
  hasUser,
  onAuthed,
}: {
  hasUser: boolean;
  onAuthed: () => void;
}) {
  const [mode, setMode] = useState<"setup" | "login">(
    hasUser ? "login" : "setup"
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "setup" && password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const body: any =
        mode === "setup"
          ? { action: "setup", email, name, password }
          : { action: "login", email, password };
      await apiPost("/api/auth", body);
      toast.success(
        mode === "setup"
          ? "Conta criada! Bem-vindo ao PlayMedia System."
          : "Login realizado com sucesso!"
      );
      onAuthed();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-accent-blue/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="glass border border-border/50 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <motion.div
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative mb-4"
            >
              <div className="absolute inset-0 blur-xl bg-primary/40 rounded-full" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center shadow-lg glow-orange">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text">PlayMedia System</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão financeira inteligente com IA
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "setup" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "setup" ? -20 : 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex gap-2 mb-6 p-1 bg-muted/50 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode("setup")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === "setup"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Primeiro acesso
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === "login"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Entrar
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "setup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Nome
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vo@email.com"
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                {mode === "setup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm" className="flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" /> Confirmar senha
                    </Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                )}

                {mode === "setup" && (
                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Esta senha será gerada agora no seu primeiro acesso e protegida com hash (scrypt).
                      Use uma senha segura — ela será a única credencial do sistema.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl text-base font-semibold group"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Processando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === "setup" ? "Criar conta" : "Entrar"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  )}
                </Button>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} PlayMedia System — Feito com IA
        </p>
      </motion.div>
    </div>
  );
}
