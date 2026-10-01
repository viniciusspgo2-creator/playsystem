"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/ui-primitives/page-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  Send,
  Sparkles,
  User,
  Wallet,
  Clock,
  AlertTriangle,
  TrendingUp,
  Factory,
  Trash2,
  Loader2,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Olá! 👋 Sou o **Assistente PlayMedia**, conectado ao **Gemini AI**.\n\nEu tenho acesso a *todo* o seu sistema financeiro em tempo real:\n\n- 💰 Carteiras, transações e metas de depósito\n- 👥 Clientes (incluindo mensalistas)\n- 🏭 Ordens de serviço / pipeline de produção\n- 💳 Cartões de crédito e limites\n- 📅 Contas a pagar e a receber (inclusive vencidas)\n\nMe pergunte qualquer coisa — **seu saldo, quem tá te devendo, contas vencidas, status da produção, resumo do mês** — e eu respondo com base nos seus dados atuais. 🚀",
};

const SUGGESTIONS = [
  {
    label: "Qual meu saldo total?",
    icon: <Wallet className="h-3.5 w-3.5" />,
    color: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    label: "Quem tá me devendo?",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    label: "Quais contas vencidas tenho?",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  {
    label: "Como está a produção?",
    icon: <Factory className="h-3.5 w-3.5" />,
    color: "from-accent-blue/15 to-accent-blue/5 text-accent-blue border-accent-blue/30",
  },
  {
    label: "Resumo financeiro do mês",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    color: "from-primary/15 to-primary/5 text-primary border-primary/30",
  },
] as const;

export function AssistantView() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: message },
    ];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na resposta");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.reply || "Sem resposta." },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao falar com o assistente");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Não consegui responder agora: ${e.message || "erro desconhecido"}. Tente novamente.`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([WELCOME]);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)] min-h-[560px]">
      <PageHeader
        title="Assistente PlayMedia"
        description="Pergunte sobre seu dinheiro, clientes, contas e produção"
        icon={<Bot className="h-5 w-5" />}
      />

      {/* Chat card */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Gradient header */}
        <div className="relative overflow-hidden border-b border-border/60 px-4 py-3 bg-gradient-to-r from-primary via-primary to-accent-blue">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-white/30 shadow-md">
                <AvatarFallback className="bg-white/20 text-white">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-white font-semibold text-sm flex items-center gap-2">
                  Assistente PlayMedia
                  <Badge className="bg-white/20 text-white border-white/30 text-[9px] py-0 px-1.5">
                    Gemini AI
                  </Badge>
                </div>
                <div className="text-white/80 text-[10px]">
                  {loading ? "digitando..." : "online · conectado aos seus dados"}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-white/90 hover:text-white hover:bg-white/10 h-8"
              title="Limpar conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Limpar</span>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div
            ref={scrollRef}
            className="p-4 space-y-4 max-w-3xl mx-auto"
          >
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-border/40">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent-blue text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <Dot delay={0} />
                  <Dot delay={0.15} />
                  <Dot delay={0.3} />
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-3 flex flex-wrap gap-2 max-w-3xl mx-auto w-full"
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => send(s.label)}
                disabled={loading}
                className={`text-xs rounded-full border px-3 py-1.5 flex items-center gap-1.5 bg-gradient-to-br ${s.color} hover:scale-[1.03] active:scale-95 transition-transform`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Input */}
        <div className="border-t border-border/60 p-3 bg-background/50">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte sobre seu dinheiro, clientes, contas..."
              disabled={loading}
              className="flex-1 h-11"
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 bg-gradient-to-br from-primary to-accent-blue"
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Enter para enviar • O assistente conhece seus dados em tempo real
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 border border-border/40">
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent-blue text-white text-xs font-bold">
            PM
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-muted-foreground/10 prose-pre:text-foreground prose-strong:text-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="my-1">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 my-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-1">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {children}
                  </a>
                ),
                code: ({ children, className }) =>
                  className ? (
                    <code className="bg-muted-foreground/10 rounded px-1 py-0.5 text-xs">
                      {children}
                    </code>
                  ) : (
                    <code className="bg-muted-foreground/10 rounded px-1 py-0.5 text-xs">
                      {children}
                    </code>
                  ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/40 pl-3 my-1 text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 shrink-0 border border-border/40">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}
