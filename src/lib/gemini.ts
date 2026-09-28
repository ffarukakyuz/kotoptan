import { askSupport, analyzeProductImage } from "./support-chat.functions";
import { callGeminiAI, getGeminiApiKey } from "./gemini-client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

export async function askGemini(
  messages: ChatMessage[],
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<string> {
  // 1. Primary: Direct Google Gemini SDK / REST client with dynamic Supabase products context and local search fallback
  try {
    const geminiResult = await callGeminiAI(messages, isAdmin, userMeta);
    if (geminiResult.reply && geminiResult.reply.trim().length > 0) {
      return geminiResult.reply;
    }
  } catch (clientErr) {
    console.warn("[askGemini] Direct Gemini client call failed, trying server routes:", clientErr);
  }

  // 2. Direct REST endpoint call to /api/chat (Node/Express or Dev server proxy)
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        isAdmin,
        userMeta,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
      if (data && typeof data.reply === "string" && data.reply.trim().length > 0) {
        return data.reply;
      }
    }
  } catch (apiErr) {
    console.warn("[askGemini] Direct /api/chat fetch error, falling back to serverFn:", apiErr);
  }

  // 3. Server function fallback (TanStack Start serverFn)
  try {
    const result = await askSupport({
      data: {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        isAdmin,
        userMeta,
      },
    });
    if (result && result.reply && result.reply.trim().length > 0) {
      return result.reply;
    }
  } catch (fnErr) {
    console.warn("[askGemini] serverFn fallback failed:", fnErr);
  }

  // 4. Safe fallback message ensuring UI never freezes
  return "Şu an Google Gemini servisiyle bağlantı kurulamadı veya kota sınırına ulaşıldı. Lütfen sorunuzu birazdan tekrar iletin ya da siparişleriniz için bizi doğrudan arayın.";
}

export async function analyzeProductPhoto(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  note?: string,
) {
  // 1. Direct REST endpoint call to /api/analyze-product
  try {
    const res = await fetch("/api/analyze-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        note,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        ok: boolean;
        product?: { name: string; category: string; unit: string; description: string };
        error?: string;
      };
      if (data && data.ok && data.product) {
        return data;
      }
    }
  } catch (apiErr) {
    console.warn(
      "[analyzeProductPhoto] Direct /api/analyze-product error, falling back to serverFn:",
      apiErr,
    );
  }

  // 2. Server function fallback
  try {
    return await analyzeProductImage({
      data: {
        imageBase64,
        mimeType,
        note,
      },
    });
  } catch (err) {
    console.error("[analyzeProductPhoto] Fallback failed:", err);
    return {
      ok: false as const,
      error: "Görsel analiz edilemedi, lütfen tekrar deneyin.",
    };
  }
}
