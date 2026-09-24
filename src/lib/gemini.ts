import { askSupport, analyzeProductImage } from "./support-chat.functions";

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
  // 1. Direct REST endpoint call to /api/chat
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
      const data = (await res.json()) as { ok?: boolean; reply?: string };
      if (data && typeof data.reply === "string" && data.reply.trim().length > 0) {
        return data.reply;
      }
    }
  } catch (apiErr) {
    console.warn("[askGemini] Direct /api/chat fetch error, falling back to serverFn:", apiErr);
  }

  // 2. Server function fallback
  try {
    const result = await askSupport({
      data: {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        isAdmin,
        userMeta,
      },
    });
    return result.reply;
  } catch (fnErr) {
    console.error("[askGemini] Both /api/chat and serverFn failed:", fnErr);
    return "Şu an bağlantıda kısa bir yoğunluk var, lütfen bir saniye sonra tekrar deneyin.";
  }
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
