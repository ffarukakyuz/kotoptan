import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { processChat, processVision } from "./server/gemini-handler";
import {
  initD1Tables,
  getOrCreateSession,
  listAllSessions,
  getSessionDetails,
  addChatMessage,
  updateSessionStatus,
} from "./server/d1-chat";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

interface ChatRequestBody {
  action?: string;
  sessionId?: string;
  adminName?: string;
  content?: string;
  userId?: string | null;
  userName?: string;
  userPhone?: string;
  messages?: { role: "user" | "assistant"; content: string }[];
  transferRequested?: boolean;
  isAdmin?: boolean;
  userMeta?: { fullName?: string; businessName?: string; phone?: string };
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // D1 Chat & Messaging API
      if (url.pathname === "/api/chat") {
        await initD1Tables(env);

        if (request.method === "GET") {
          const action = url.searchParams.get("action");
          const sessionId = url.searchParams.get("sessionId");

          if (action === "list_sessions") {
            const sessions = await listAllSessions(env);
            return new Response(JSON.stringify({ ok: true, sessions }), {
              headers: { "content-type": "application/json" },
            });
          }

          if (action === "get_session" && sessionId) {
            const details = await getSessionDetails(env, sessionId);
            return new Response(JSON.stringify({ ok: true, ...details }), {
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ ok: false, error: "Geçersiz işlem" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await request.json()) as ChatRequestBody;
            const action = body.action || "chat";

            // 1. Yönetici yanıtı
            if (action === "admin_reply") {
              const { sessionId, adminName, content, type, audio_url, duration } = body;
              if (!sessionId || (!content && !audio_url)) {
                return new Response(JSON.stringify({ ok: false, error: "Eksik parametre" }), {
                  status: 400,
                  headers: { "content-type": "application/json" },
                });
              }
              const msg = await addChatMessage(
                env,
                sessionId,
                "admin",
                adminName || "Yönetici",
                content || (type === "voice" ? "🎤 Sesli Mesaj" : ""),
                type === "voice" ? "voice" : "text",
                audio_url,
                duration,
              );
              await updateSessionStatus(env, sessionId, "active_admin");
              return new Response(JSON.stringify({ ok: true, message: msg }), {
                headers: { "content-type": "application/json" },
              });
            }

            // 2. Temsilciye aktar
            if (action === "transfer_to_admin") {
              const { sessionId } = body;
              if (!sessionId) {
                return new Response(JSON.stringify({ ok: false, error: "Eksik sessionId" }), {
                  status: 400,
                  headers: { "content-type": "application/json" },
                });
              }
              await updateSessionStatus(env, sessionId, "transferred");
              const transferMsg = await addChatMessage(
                env,
                sessionId,
                "bot",
                "Ko Şirket Asistanı",
                "Sohbetiniz müşteri temsilcisine / yetkili yöneticiye aktarıldı. Yetkili yöneticimiz birazdan size doğrudan buradan yanıt verecektir.",
              );
              return new Response(
                JSON.stringify({ ok: true, status: "transferred", message: transferMsg }),
                {
                  headers: { "content-type": "application/json" },
                },
              );
            }

            // 3. Sohbeti sonlandır
            if (action === "close_session") {
              const { sessionId, adminName } = body;
              if (!sessionId) {
                return new Response(JSON.stringify({ ok: false, error: "Eksik sessionId" }), {
                  status: 400,
                  headers: { "content-type": "application/json" },
                });
              }
              await updateSessionStatus(env, sessionId, "closed");
              const closedMsg = await addChatMessage(
                env,
                sessionId,
                "admin",
                adminName || "Yönetici",
                "Sohbet yetkili yönetici tarafından sonlandırıldı. İyi günler dileriz!",
              );
              return new Response(
                JSON.stringify({ ok: true, status: "closed", message: closedMsg }),
                {
                  headers: { "content-type": "application/json" },
                },
              );
            }

            // 4. Müşteri mesajı (AI + Temsilciye Aktarım)
            const {
              sessionId,
              userId,
              userName,
              userPhone,
              messages,
              content,
              type,
              audio_url,
              duration,
              transferRequested,
              isAdmin,
              userMeta,
            } = body;

            const safeSessionId = sessionId || `session_${userId || "guest"}_${Date.now()}`;
            const session = await getOrCreateSession(
              env,
              safeSessionId,
              userId,
              userName,
              userPhone,
            );

            // Kullanıcı mesajı varsa kaydet
            if (content || audio_url) {
              await addChatMessage(
                env,
                safeSessionId,
                "user",
                userName || "Müşteri",
                content || (type === "voice" ? "🎤 Sesli Mesaj" : ""),
                type === "voice" ? "voice" : "text",
                audio_url,
                duration,
              );
            }

            // Doğrudan Yönetici sekmesinden ("Yönetici ile Konuş") gelen mesajlar
            if (transferRequested === true) {
              if (session.status !== "active_admin") {
                await updateSessionStatus(env, safeSessionId, "transferred");
              }
              return new Response(
                JSON.stringify({
                  ok: true,
                  sessionId: safeSessionId,
                  status: session.status === "active_admin" ? "active_admin" : "transferred",
                  waitingAdmin: true,
                  transferred: true,
                }),
                { headers: { "content-type": "application/json" } },
              );
            }

            // AI sekmesinde yazılan metinde "temsilciye aktar" talebi var mı?
            const lowerContent = (content || "").toLowerCase();
            const wantsHuman =
              lowerContent.includes("temsilci") ||
              lowerContent.includes("yetkili") ||
              lowerContent.includes("yonetici") ||
              lowerContent.includes("canli destek") ||
              lowerContent.includes("aktar") ||
              lowerContent.includes("temsilciye baglan") ||
              lowerContent.includes("yetkiliye baglan");

            if (wantsHuman && session.status !== "active_admin") {
              await updateSessionStatus(env, safeSessionId, "transferred");
              const botNotice = await addChatMessage(
                env,
                safeSessionId,
                "bot",
                "Ko Şirket Asistanı",
                "Talebiniz alındı. Sohbet yetkili yöneticiye aktarıldı. Yetkili yöneticimiz birazdan size doğrudan buradan yazacaktır. Dilerseniz yukarıdaki 'Yönetici ile Konuş' sekmesine geçebilirsiniz.",
              );
              return new Response(
                JSON.stringify({
                  ok: true,
                  sessionId: safeSessionId,
                  status: "transferred",
                  reply: botNotice.content,
                  transferred: true,
                }),
                { headers: { "content-type": "application/json" } },
              );
            }

            // AI Asistan ile yanıt üret (AI sekmesi)
            const chatMessages =
              messages && messages.length > 0 ? messages : [{ role: "user", content }];
            const result = await processChat(chatMessages, isAdmin, userMeta);

            if (result.reply) {
              await addChatMessage(env, safeSessionId, "bot", "Ko Şirket Asistanı", result.reply);
            }

            return new Response(
              JSON.stringify({
                ...result,
                sessionId: safeSessionId,
                status: session.status,
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : "Error processing chat";
            return new Response(JSON.stringify({ ok: false, error: errMsg }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
        }
      }

      if (url.pathname === "/api/analyze-product" && request.method === "POST") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = (await request.json()) as any;
          const result = await processVision(body.imageBase64, body.mimeType, body.note);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : "Error analyzing product";
          return new Response(JSON.stringify({ ok: false, error: errMsg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
