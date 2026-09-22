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
  const result = await askSupport({
    data: {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      isAdmin,
      userMeta,
    },
  });
  return result.ok ? result.reply : result.reply;
}

export async function analyzeProductPhoto(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  note?: string,
) {
  return await analyzeProductImage({
    data: {
      imageBase64,
      mimeType,
      note,
    },
  });
}
