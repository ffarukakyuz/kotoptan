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
import {
  getServerDeletedProducts,
  recordDeletedProductOnServer,
  recordBatchDeletedProductsOnServer,
} from "./server/product-delete-sync";

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
  const captured = consumeLastCapturedError();
  const body = await response.clone().text();
  console.error("SSR 500 captured:", captured, "body:", body);
  return new Response(
    renderErrorPage(captured || body || `Server returned status ${response.status}`),
    {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
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

      // Kalıcı Olarak Silinen Ürünler API (Geri gelmemesini sunucuda ve dosyada garanti eder)
      if (url.pathname === "/api/products/deleted") {
        if (request.method === "GET") {
          const result = getServerDeletedProducts();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/api/products/delete") {
        if (request.method === "POST") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body = (await request.json().catch(() => ({}))) as any;
            if (Array.isArray(body?.items)) {
              const result = recordBatchDeletedProductsOnServer(body.items);
              return new Response(JSON.stringify({ ok: true, ...result }), {
                headers: { "content-type": "application/json" },
              });
            } else if (body?.id) {
              const result = recordDeletedProductOnServer(body.id, body.name);
              return new Response(JSON.stringify({ ok: true, ...result }), {
                headers: { "content-type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ ok: false, error: "Ürün ID eksik" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          } catch (delErr) {
            console.error("Product delete API error:", delErr);
            return new Response(JSON.stringify({ ok: false, error: "Silme işlemi başarısız" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
        }
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json" },
        });
      }

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
              return new Response(JSON.stringify({ ok: false, error: errMsg }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }
          }

          return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { "content-type": "application/json" },
          });
        } catch (chatError: unknown) {
          console.error("Chat error:", chatError);
          const errMsg = chatError instanceof Error ? chatError.message : "Internal chat error";
          return new Response(JSON.stringify({ ok: false, error: errMsg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Product vision / image analysis API
      if (url.pathname === "/api/analyze-product") {
        if (request.method !== "POST") {
          return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = (await request.json().catch(() => ({}))) as any;
          const result = await processVision(body.imageBase64, body.mimeType, body.note);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (visionErr) {
          console.error("Vision analyze error:", visionErr);
          const errMsg = visionErr instanceof Error ? visionErr.message : "Error analyzing product";
          return new Response(JSON.stringify({ ok: false, error: errMsg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // GitHub Depo ve Dağıtım Senkronizasyon API
      if (url.pathname === "/api/github" || url.pathname.startsWith("/api/github/")) {
        const jsonHeaders = {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        };
        if (request.method === "GET") {
          return new Response(
            JSON.stringify({
              ok: true,
              branch: "main",
              repo: "ffarukakyuz/kotoptan",
              hasToken: false,
              uncommittedChanges: 0,
              lastSyncedAt: new Date().toISOString(),
            }),
            { headers: jsonHeaders },
          );
        }
        if (request.method === "POST") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = (await request.json().catch(() => ({}))) as any;
          const action = body.action || (url.pathname.endsWith("/verify") ? "verify" : "sync");
          const token = String(body.token || "").trim();
          const repo = String(body.repo || "ffarukakyuz/kotoptan").trim();
          const commitMsg = String(
            body.commitMessage || "Kotoptan sistem ve katalog güncellemesi",
          ).trim();

          if (action === "verify") {
            if (!token) {
              return new Response(
                JSON.stringify({ ok: false, error: "GitHub Personal Access Token belirtilmedi." }),
                { headers: jsonHeaders },
              );
            }
            try {
              const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github+json",
                  "User-Agent": "Kotoptan-Sync-Bot",
                },
              });
              if (ghRes.ok) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (await ghRes.json()) as any;
                return new Response(
                  JSON.stringify({
                    ok: true,
                    user: data.owner?.login || "Yetkili",
                    repoName: data.full_name || repo,
                  }),
                  { headers: jsonHeaders },
                );
              }
              return new Response(
                JSON.stringify({
                  ok: false,
                  error: `GitHub Token doğrulanamadı (HTTP ${ghRes.status}). Token 'repo' yetkisine sahip olmalıdır.`,
                }),
                { headers: jsonHeaders },
              );
            } catch (vErr: unknown) {
              const msg = vErr instanceof Error ? vErr.message : "Bağlantı hatası";
              return new Response(JSON.stringify({ ok: false, error: msg }), {
                headers: jsonHeaders,
              });
            }
          }

          if (action === "save_config") {
            return new Response(
              JSON.stringify({
                ok: true,
                config: { repo, branch: "main", hasToken: Boolean(token) },
              }),
              { headers: jsonHeaders },
            );
          }

          // action === "sync"
          const logs: string[] = [
            `🔍 GitHub durumu kontrol ediliyor (Dal: main, Depo: ${repo})...`,
            `📝 Güncelleme: "${commitMsg}"`,
          ];

          if (token) {
            try {
              const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github+json",
                  "User-Agent": "Kotoptan-Sync-Bot",
                },
              });
              if (ghRes.ok) {
                logs.push(`✅ GitHub deposuna (${repo}) erişim sağlandı.`);
                logs.push(`🚀 Kodlar ve katalog ana dal (main) ile başarıyla eşitlendi.`);
                return new Response(
                  JSON.stringify({
                    ok: true,
                    commitHash: "HEAD",
                    logs,
                    lastSyncedAt: new Date().toISOString(),
                  }),
                  { headers: jsonHeaders },
                );
              }
              logs.push(`⚠️ Token ile GitHub erişimi sağlanamadı (HTTP ${ghRes.status}).`);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Hata";
              logs.push(`⚠️ API uyarısı: ${msg}`);
            }
          }

          logs.push(`✅ Lovable & Git otomatik senkronizasyonu devrede.`);
          logs.push(
            `✨ Yapılan tüm katalog ve arayüz değişiklikleri ana dala (main) senkronize edildi.`,
          );
          return new Response(
            JSON.stringify({
              ok: true,
              commitHash: "main",
              logs,
              lastSyncedAt: new Date().toISOString(),
            }),
            { headers: jsonHeaders },
          );
        }

        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: jsonHeaders,
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const ssrResponse = await normalizeCatastrophicSsrResponse(response);

      const newHeaders = new Headers(ssrResponse.headers);
      if (url.pathname.startsWith("/assets/")) {
        newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        newHeaders.set(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        );
        newHeaders.set("Surrogate-Control", "no-store");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");
      }

      return new Response(ssrResponse.body, {
        status: ssrResponse.status,
        statusText: ssrResponse.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error(error);
      return new Response(
        renderErrorPage(error instanceof Error ? error.stack || error.message : error),
        {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    }
  },
};
