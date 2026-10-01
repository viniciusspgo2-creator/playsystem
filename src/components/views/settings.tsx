"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/ui-primitives/page-header";
import { useFetch, useRefresh } from "@/lib/api-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Bot,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Search,
  Zap,
  Tv,
  ExternalLink,
  Trash2,
  Save,
} from "lucide-react";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/unitv";

interface PublicSettings {
  geminiKeySet: boolean;
  geminiKeyHint: string;
  geminiKeyFromEnv: boolean;
  gemini_model: string;
  ai_extra_instructions: string;
  unitv_alert_days: string;
  unitv_whatsapp_template: string;
}

export function SettingsView() {
  const { data, loading, reload } = useFetch<PublicSettings>("/api/settings");
  const refresh = useRefresh();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  // Campos editados (null = ainda não mexeu; mostra o valor salvo)
  const [modelEdit, setModelEdit] = useState<string | null>(null);
  const [extraEdit, setExtraEdit] = useState<string | null>(null);
  const [alertDaysEdit, setAlertDaysEdit] = useState<string | null>(null);
  const [templateEdit, setTemplateEdit] = useState<string | null>(null);
  const model = modelEdit ?? data?.gemini_model ?? "";
  const extra = extraEdit ?? data?.ai_extra_instructions ?? "";
  const alertDays = alertDaysEdit ?? data?.unitv_alert_days ?? "5";
  const template = templateEdit ?? data?.unitv_whatsapp_template ?? "";
  const setModel = setModelEdit;
  const setExtra = setExtraEdit;
  const setAlertDays = setAlertDaysEdit;
  const setTemplate = setTemplateEdit;

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [listing, setListing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(url: string, method: string, body: any) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro na requisição");
    return json.data;
  }

  async function save() {
    setSaving(true);
    try {
      await call("/api/settings", "PUT", {
        geminiApiKey: apiKey,
        gemini_model: model,
        ai_extra_instructions: extra,
        unitv_alert_days: alertDays,
        unitv_whatsapp_template: template,
      });
      setApiKey("");
      setModelEdit(null);
      setExtraEdit(null);
      setAlertDaysEdit(null);
      setTemplateEdit(null);
      toast.success("Configurações salvas!");
      reload();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    if (!confirm("Remover a chave do Gemini salva no sistema?")) return;
    try {
      await call("/api/settings", "PUT", { clearGeminiKey: true });
      toast.success("Chave removida.");
      setTestResult(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function listModels() {
    setListing(true);
    try {
      const list = await call("/api/settings/gemini", "POST", { action: "models", apiKey });
      setModels(list);
      if (!list.length) toast.info("Nenhum modelo Gemini 3+ encontrado para essa chave.");
      else toast.success(`${list.length} modelos encontrados. Escolha na lista.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setListing(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await call("/api/settings/gemini", "POST", { action: "test", apiKey, model });
      setTestResult({ ok: true, text: `Conectado! Modelo ${r.model} respondeu: "${r.reply}"` });
    } catch (e: any) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Configurações"
        description="Ajustes do sistema, inteligência artificial e alertas"
        icon={<SettingsIcon className="h-5 w-5" />}
        action={{
          label: saving ? "Salvando..." : "Salvar tudo",
          onClick: save,
          icon: saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />,
        }}
      />

      {/* GEMINI */}
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent-blue/15 text-accent-blue flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Inteligência Artificial (Gemini)</h2>
            <p className="text-xs text-muted-foreground">
              Usada no Assistente IA. A chave fica salva no seu banco de dados.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-key" className="text-xs font-medium flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Chave de API (Google AI Studio)
          </Label>
          <div className="flex gap-2">
            <Input
              id="gemini-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                data?.geminiKeySet
                  ? `Chave salva (${data.geminiKeyHint}) — deixe vazio para manter`
                  : data?.geminiKeyFromEnv
                    ? "Usando GEMINI_API_KEY do ambiente — cole aqui para substituir"
                    : "Cole aqui a chave (começa com AIza...)"
              }
              autoComplete="off"
              className="h-10 font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Gerar chave no Google AI Studio <ExternalLink className="h-3 w-3" />
            </a>
            {data?.geminiKeySet && (
              <button type="button" onClick={clearKey} className="inline-flex items-center gap-1 text-destructive hover:underline">
                <Trash2 className="h-3 w-3" /> Remover chave salva
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-model" className="text-xs font-medium">
            Modelo
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="gemini-model"
              list="gemini-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-3-flash-preview"
              className="h-10 font-mono text-sm"
            />
            <datalist id="gemini-models">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </datalist>
            <Button type="button" variant="outline" onClick={listModels} disabled={listing} className="h-10 shrink-0">
              {listing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar modelos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O botão lista os modelos Gemini 3 em diante liberados na sua chave. Digite ou escolha um da lista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={testConnection} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          {testResult && (
            <span
              className={`text-xs inline-flex items-start gap-1.5 ${
                testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {testResult.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {testResult.text}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Para testar uma chave nova, cole e clique em Testar antes de salvar.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="ai-extra" className="text-xs font-medium">
            Instruções extras para a IA (opcional)
          </Label>
          <Textarea
            id="ai-extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={3}
            placeholder="Ex.: Responda sempre curto. Trate meus clientes UNITV pelo primeiro nome."
          />
        </div>
      </Card>

      {/* UNITV */}
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Tv className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">UNITV</h2>
            <p className="text-xs text-muted-foreground">Alertas de vencimento e mensagem de cobrança</p>
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="alert-days" className="text-xs font-medium">
            Avisar quando faltarem (dias)
          </Label>
          <Input
            id="alert-days"
            type="number"
            min={0}
            max={60}
            value={alertDays}
            onChange={(e) => setAlertDays(e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Clientes a esse número de dias (ou menos) do vencimento aparecem em alerta.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="wa-template" className="text-xs font-medium">
              Mensagem do WhatsApp
            </Label>
            <button
              type="button"
              onClick={() => setTemplate(DEFAULT_WHATSAPP_TEMPLATE)}
              className="text-xs text-primary hover:underline"
            >
              Restaurar padrão
            </button>
          </div>
          <Textarea id="wa-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} />
          <p className="text-xs text-muted-foreground">
            Pode usar: <code>{"{nome}"}</code> <code>{"{vencimento}"}</code> <code>{"{dias}"}</code> <code>{"{valor}"}</code>
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar tudo
        </Button>
      </div>
    </div>
  );
}
