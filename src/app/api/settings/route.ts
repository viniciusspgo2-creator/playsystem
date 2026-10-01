import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, setSetting, SETTING_DEFAULTS } from "@/lib/settings";

function publicView(s: Record<string, string>) {
  const key = s.gemini_api_key;
  return {
    geminiKeySet: !!key,
    geminiKeyHint: key ? `••••${key.slice(-4)}` : "",
    geminiKeyFromEnv: !key && !!process.env.GEMINI_API_KEY,
    gemini_model: s.gemini_model,
    ai_extra_instructions: s.ai_extra_instructions,
    unitv_alert_days: s.unitv_alert_days,
    unitv_whatsapp_template: s.unitv_whatsapp_template,
  };
}

// GET /api/settings  (nunca devolve a chave completa)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    return NextResponse.json({ data: publicView(await getSettings()) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("cookie"));
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();

    // Chave: só troca se vier preenchida; "clearGeminiKey" apaga.
    if (body.clearGeminiKey) {
      await setSetting("gemini_api_key", "");
    } else if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
      await setSetting("gemini_api_key", body.geminiApiKey.trim());
    }

    if (typeof body.gemini_model === "string") {
      await setSetting("gemini_model", body.gemini_model.trim() || SETTING_DEFAULTS.gemini_model);
    }
    if (typeof body.ai_extra_instructions === "string") {
      await setSetting("ai_extra_instructions", body.ai_extra_instructions.slice(0, 4000));
    }
    if (body.unitv_alert_days !== undefined) {
      const n = parseInt(String(body.unitv_alert_days), 10);
      if (!Number.isFinite(n) || n < 0 || n > 60) {
        return NextResponse.json({ error: "Dias de alerta deve ser entre 0 e 60." }, { status: 400 });
      }
      await setSetting("unitv_alert_days", String(n));
    }
    if (typeof body.unitv_whatsapp_template === "string") {
      await setSetting(
        "unitv_whatsapp_template",
        body.unitv_whatsapp_template.trim() || SETTING_DEFAULTS.unitv_whatsapp_template
      );
    }

    return NextResponse.json({ data: publicView(await getSettings()) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
