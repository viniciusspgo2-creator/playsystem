// Cliente mínimo para a API do Google Gemini (Google AI Studio), via REST.
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

async function readError(res: Response): Promise<string> {
  let msg = `Erro ${res.status}`;
  try {
    const j = await res.json();
    if (j?.error?.message) msg = j.error.message;
  } catch {}
  if (res.status === 400 && /api key/i.test(msg)) return "Chave de API inválida. Gere uma nova no Google AI Studio.";
  if (res.status === 403) return `Acesso negado pelo Google: ${msg}`;
  if (res.status === 404) return `Modelo não encontrado. Use "Buscar modelos" em Configurações. (${msg})`;
  if (res.status === 429) return "Limite de uso do Gemini atingido. Aguarde um pouco ou verifique sua cota no AI Studio.";
  return msg;
}

export async function geminiGenerate(opts: {
  apiKey: string;
  model: string;
  system?: string;
  contents: GeminiContent[];
}): Promise<string> {
  const model = opts.model.replace(/^models\//, "");
  const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: opts.contents,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p: any) => typeof p.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("");
  if (!text) {
    const reason = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason;
    throw new Error(reason ? `O Gemini não retornou resposta (${reason}).` : "O Gemini não retornou resposta.");
  }
  return text;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
}

/** Lista modelos que aceitam generateContent, só da geração 3 em diante. */
export async function geminiListModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const res = await fetch(`${BASE}/models?pageSize=1000`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  const out: GeminiModelInfo[] = [];
  for (const m of json?.models ?? []) {
    const id = String(m.name || "").replace(/^models\//, "");
    const gen = (m.supportedGenerationMethods ?? []).includes("generateContent");
    const ver = id.match(/^gemini-(\d+(?:\.\d+)?)/);
    if (!gen || !ver || parseFloat(ver[1]) < 3) continue;
    // fora modelos que não são de texto (imagem, áudio, etc.)
    if (/image|tts|audio|live|embedding|robotics|computer-use/i.test(id)) continue;
    out.push({ id, name: m.displayName || id });
  }
  return out.sort((a, b) => b.id.localeCompare(a.id));
}
