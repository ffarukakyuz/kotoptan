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
        try {
          // Resolve environment / DB binding across all Cloudflare Pages / Workers variations
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = typeof globalThis !== "undefined" ? (globalThis as any) : {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reqAny = request as any;
          const safeEnv =
            env || g.__env__ || reqAny?.runtime?.cloudflare?.env || reqAny?.env || g.env || g || {};

          try {
            await initD1Tables(safeEnv);
          } catch (initErr) {
            console.warn("[Server] D1 init error, continuing with fallback:", initErr);
          }

          if (request.method === "GET") {
            const action = url.searchParams.get("action");
            const sessionId = url.searchParams.get("sessionId");

            if (action === "list_sessions") {
              const sessions = await listAllSessions(safeEnv);
              return new Response(JSON.stringify({ ok: true, sessions }), {
                headers: { "content-type": "application/json" },
              });
            }

            if (action === "get_session" && sessionId) {
              const details = await getSessionDetails(safeEnv, sessionId);
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
              const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
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
                  safeEnv,
                  sessionId,
                  "admin",
                  adminName || "Yönetici",
                  content || (type === "voice" ? "🎤 Sesli Mesaj" : ""),
                  type === "voice" ? "voice" : "text",
                  audio_url,
                  duration,
                );
                await updateSessionStatus(safeEnv, sessionId, "active_admin");
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
                await updateSessionStatus(safeEnv, sessionId, "transferred");
                const transferMsg = await addChatMessage(
                  safeEnv,
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
                await updateSessionStatus(safeEnv, sessionId, "closed");
                const closedMsg = await addChatMessage(
                  safeEnv,
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

              // 4. Saf AI Asistan Mesajı (Yöneticiye veya oturum tablosuna aktarılmaz, alarm çalmaz)
              if (action === "ai_chat") {
                const { messages, content, isAdmin: userIsAdmin, userMeta } = body;
                const chatMessages =
                  messages && messages.length > 0
                    ? messages
                    : [{ role: "user", content: content || "" }];
                const result = await processChat(chatMessages, Boolean(userIsAdmin), userMeta);
                return new Response(
                  JSON.stringify({
                    ok: true,
                    reply: result.reply,
                    status: "bot",
                  }),
                  { headers: { "content-type": "application/json" } },
                );
              }

              // 5. Canlı Destek / Müşteri Yönetici Mesajı ("Yönetici ile Konuş" veya Aktarım)
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
                isAdmin: userIsAdmin,
                userMeta,
              } = body;

              // Eğer yönetici kendi paneli içinden konuşuyorsa müşteri kuyruğuna eklenmesin
              if (userIsAdmin && !transferRequested) {
                const chatMessages =
                  messages && messages.length > 0
                    ? messages
                    : [{ role: "user", content: content || "" }];
                const result = await processChat(chatMessages, true, userMeta);
                return new Response(
                  JSON.stringify({
                    ok: true,
                    reply: result.reply,
                    status: "bot",
                  }),
                  { headers: { "content-type": "application/json" } },
                );
              }

              const safeSessionId = sessionId || `session_${userId || "guest"}_${Date.now()}`;
              const session = await getOrCreateSession(
                safeEnv,
                safeSessionId,
                userId,
                userName,
                userPhone,
              );

              // Kullanıcı mesajı varsa kaydet
              if (content || audio_url) {
                await addChatMessage(
                  safeEnv,
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
                  await updateSessionStatus(safeEnv, safeSessionId, "transferred");
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

              // AI sekmesinde yazılan mesaj
              const chatMessages =
                messages && messages.length > 0
                  ? messages
                  : [{ role: "user", content: content || "" }];
              const result = await processChat(chatMessages, Boolean(userIsAdmin), userMeta);

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
              return new Response(
                JSON.stringify({
                  ok: false,
                  error: errMsg,
                  reply:
                    "Sistemimizde anlık bir yoğunluk yaşanıyor. Lütfen doğrudan 'Yönetici ile Konuş' sekmesinden yetkili yöneticimize yazınız.",
                }),
                {
                  status: 200,
                  headers: { "content-type": "application/json" },
                },
              );
            }
          }
        } catch (chatApiErr) {
          console.error("[api/chat Global Error]:", chatApiErr);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Sohbet servisi yanıt veremedi.",
              reply: "Teknik bir aksaklık oluştu. Lütfen tekrar deneyiniz.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
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
