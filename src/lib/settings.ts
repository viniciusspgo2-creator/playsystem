import { db } from "@/lib/db";
import { DEFAULT_ALERT_DAYS, DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/unitv";

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

export const SETTING_DEFAULTS: Record<string, string> = {
  gemini_api_key: "",
  gemini_model: DEFAULT_GEMINI_MODEL,
  ai_extra_instructions: "",
  unitv_alert_days: String(DEFAULT_ALERT_DAYS),
  unitv_whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
};

/** Lê todas as configurações, preenchendo o que faltar com os padrões. */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.key in SETTING_DEFAULTS && r.value !== "") out[r.key] = r.value;
  }
  return out;
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAlertDays(): Promise<number> {
  const s = await getSettings();
  const n = parseInt(s.unitv_alert_days, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ALERT_DAYS;
}

/** Chave do Gemini: a salva em Configurações tem prioridade; senão usa GEMINI_API_KEY do ambiente. */
export function resolveGeminiKey(settings: Record<string, string>): string {
  return settings.gemini_api_key || process.env.GEMINI_API_KEY || "";
}
