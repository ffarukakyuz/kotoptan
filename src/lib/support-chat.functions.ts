import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { processChat, processVision } from "@/server/gemini-handler";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(3000),
});

const inputSchema = z.object({
  messages: z.array(chatMessageSchema),
  isAdmin: z.boolean().optional(),
  userMeta: z
    .object({
      fullName: z.string().optional(),
      businessName: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

const visionInputSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Destek ve Sohbet Asistanı (OpenRouter tabanlı)
 */
export const askSupport = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      return await processChat(data.messages, data.isAdmin, data.userMeta);
    } catch (err) {
      console.error("[askSupport] Error in serverFn handler:", err);
      return {
        ok: false,
        reply: "Asistan servisi şu anda yanıt veremiyor. Lütfen biraz sonra tekrar deneyin.",
        error: err instanceof Error ? err.message : "Bilinmeyen asistan hatası",
      };
    }
  });

/**
 * Fotoğraftan Ürün Bilgisi Çıkarma (OpenRouter Vision tabanlı)
 */
export const analyzeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data) => visionInputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      return await processVision(data.imageBase64, data.mimeType, data.note);
    } catch (err) {
      console.error("[analyzeProductImage] Error in serverFn handler:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Görsel analiz edilirken bir hata oluştu.",
      };
    }
  });
