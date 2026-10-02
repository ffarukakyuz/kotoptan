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
    return await processChat(data.messages, data.isAdmin, data.userMeta);
  });

/**
 * Fotoğraftan Ürün Bilgisi Çıkarma (OpenRouter Vision tabanlı)
 */
export const analyzeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data) => visionInputSchema.parse(data))
  .handler(async ({ data }) => {
    return await processVision(data.imageBase64, data.mimeType, data.note);
  });
