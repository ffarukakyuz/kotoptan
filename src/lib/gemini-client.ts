import { type ChatMessage } from "./gemini";

export const OPENROUTER_API_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_OPENROUTER_API_KEY) ||
  "";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function getGeminiApiKey(): string {
  return OPENROUTER_API_KEY;
}

export async function callGeminiAI(
  messages: ChatMessage[],
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, isAdmin, userMeta }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) return { ok: true, reply: data.reply };
    }
  } catch (err) {
    console.warn("[OpenRouterClient] /api/chat error:", err);
  }

  return {
    ok: true,
    reply:
      "Merhaba! Kotoptan toptan şirketimize hoş geldiniz. Ürünlerimiz, koli bilgileri ve sipariş süreçleri için yardımcı olabilirim.",
  };
}
