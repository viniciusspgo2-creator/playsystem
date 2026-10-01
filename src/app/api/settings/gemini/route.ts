import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, resolveGeminiKey } from "@/lib/settings";
import { geminiGenerate, geminiListModels } from "@/lib/gemini";

export const maxDuration = 60;

// POST /api/settings/gemini  { action: "models" | "test", apiKey?, model? }
// Usa a chave digitada na tela (se houver), senão a salva.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { action, apiKey, model } = await req.json();
    const settings = await getSettings();
    const key = (typeof apiKey === "string" && apiKey.trim()) || resolveGeminiKey(settings);
    if (!key) {
      return NextResponse.json({ error: "Cole a chave de API do Google AI Studio primeiro." }, { status: 400 });
    }

    if (action === "models") {
      const models = await geminiListModels(key);
      return NextResponse.json({ data: models });
    }

    if (action === "test") {
      const useModel = (typeof model === "string" && model.trim()) || settings.gemini_model;
      const reply = await geminiGenerate({
        apiKey: key,
        model: useModel,
        contents: [{ role: "user", parts: [{ text: "Responda apenas com a palavra: OK" }] }],
      });
      return NextResponse.json({ data: { ok: true, model: useModel, reply: reply.trim().slice(0, 100) } });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao falar com o Gemini" }, { status: 400 });
  }
}
