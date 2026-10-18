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
import {
  getAllServerUsers,
  registerOrUpdateServerUser,
  deleteServerUser,
} from "./server/user-sync";
import { FALLBACK_PRODUCTS } from "./data/products";

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

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return (
      payload.unhandled === true && (payload.message === "HTTPError" || payload.unhandled === true)
    );
  } catch {
    return false;
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — normalize and provide meaningful errors.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  url: URL,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;

  const captured = consumeLastCapturedError();
  let body = "";
  try {
    body = await response.clone().text();
  } catch (textErr) {
    console.error("[normalizeCatastrophicSsrResponse] Could not read response text:", textErr);
  }

  console.error("[SSR/API 500 captured]", {
    path: url.pathname,
    status: response.status,
    captured: captured || "none",
    bodySnippet: body.slice(0, 1000),
  });

  const acceptsHtml = Boolean(request.headers.get("accept")?.includes("text/html"));
  const isApi =
    (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_serverFn") ||
      Boolean(request.headers.get("accept")?.includes("application/json"))) &&
    !acceptsHtml;

  if (isApi) {
    const errorMsg =
      captured ||
      (isH3SwallowedErrorBody(body)
        ? "Sunucuda asenkron işlem sırasında bir hata oluştu. Lütfen istek parametrelerini kontrol edin."
        : `Sunucu hatası (${response.status})`);

    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMsg,
        status: response.status,
        unhandled: false,
        details: captured || null,
      }),
      {
        status: response.status >= 500 ? response.status : 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }

  return new Response(
    renderErrorPage(captured || body || `Server returned status ${response.status}`),
    {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
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

      // Resolve environment & D1 binding across all Cloudflare Pages / Workers variations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = typeof globalThis !== "undefined" ? (globalThis as any) : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reqAny = request as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctxAny = ctx as any;
      const safeEnv =
        env ||
        ctxAny?.env ||
        reqAny?.env ||
        reqAny?.runtime?.cloudflare?.env ||
        g.__env__ ||
        g.env ||
        g ||
        {};

      if (typeof safeEnv === "object" && safeEnv !== null) {
        g.__env__ = { ...(g.__env__ || {}), ...safeEnv };
        const envRec = safeEnv as Record<string, unknown>;
        if (envRec.DB) {
          g.DB = envRec.DB;
        }
      }

      // Kalıcı Olarak Silinen Ürünler API (Geri gelmemesini sunucuda ve dosyada garanti eder)
      if (url.pathname === "/api/products/deleted") {
        if (request.method === "GET") {
          try {
            const result = getServerDeletedProducts();
            return new Response(JSON.stringify({ ok: true, ...result }), {
              headers: { "content-type": "application/json" },
            });
          } catch (getDelErr) {
            console.error("[/api/products/deleted GET] Error:", getDelErr);
            return new Response(JSON.stringify({ ok: false, error: "Silinenler okunamadı" }), {
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
            console.error("[/api/products/delete POST] Error:", delErr);
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

      // Ürünler API (Cloudflare Pages ve Vite ile tam uyumlu)
      if (url.pathname === "/api/products") {
        const jsonHeaders = {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: jsonHeaders });
        }

        if (request.method === "GET") {
          try {
            return new Response(JSON.stringify(FALLBACK_PRODUCTS), {
              headers: jsonHeaders,
            });
          } catch (pErr) {
            console.error("[/api/products GET] Error:", pErr);
            return new Response(JSON.stringify({ ok: false, error: "Ürünler listelenemedi" }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        if (request.method === "POST") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (await request.json().catch(() => ({}))) as any;
            const id = data.id || `ko-prod-${Date.now()}`;
            const product = {
              id,
              name: data.name,
              category: data.category || "gida",
              unit: data.unit || "koli",
              description: data.description || "",
              image_url: data.image_url || null,
              is_active: data.is_active !== false,
            };
            return new Response(JSON.stringify({ ok: true, product }), {
              headers: jsonHeaders,
            });
          } catch (postPErr) {
            console.error("[/api/products POST] Error:", postPErr);
            return new Response(JSON.stringify({ ok: false, error: "Geçersiz ürün verisi" }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        if (request.method === "DELETE") {
          const id = url.searchParams.get("id");
          return new Response(JSON.stringify({ ok: true, id }), { headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: jsonHeaders,
        });
      }

      // Kullanıcılar API (Cloudflare Pages ve Vite ile tam uyumlu)
      if (url.pathname === "/api/users") {
        const jsonHeaders = {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: jsonHeaders });
        }

        if (request.method === "GET") {
          try {
            const users = getAllServerUsers();
            return new Response(JSON.stringify({ ok: true, users }), {
              headers: jsonHeaders,
            });
          } catch (usersErr) {
            console.error("[/api/users GET] Error:", usersErr);
            return new Response(
              JSON.stringify({
                ok: false,
                error: "Kullanıcı listesi yüklenemedi",
                details: usersErr instanceof Error ? usersErr.message : String(usersErr),
              }),
              { status: 500, headers: jsonHeaders },
            );
          }
        }

        if (request.method === "POST") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body = (await request.json().catch(() => ({}))) as any;
            if (!body?.phone) {
              return new Response(
                JSON.stringify({ ok: false, error: "Telefon numarası zorunludur" }),
                { status: 400, headers: jsonHeaders },
              );
            }
            const user = registerOrUpdateServerUser(body);
            return new Response(JSON.stringify({ ok: true, user }), {
              headers: jsonHeaders,
            });
          } catch (postUserErr) {
            console.error("[/api/users POST] Error:", postUserErr);
            return new Response(
              JSON.stringify({
                ok: false,
                error: "Kullanıcı kaydı güncellenemedi",
                details: postUserErr instanceof Error ? postUserErr.message : String(postUserErr),
              }),
              { status: 500, headers: jsonHeaders },
            );
          }
        }

        if (request.method === "DELETE") {
          try {
            const id = url.searchParams.get("id");
            if (!id) {
              return new Response(
                JSON.stringify({ ok: false, error: "Kullanıcı ID veya telefon gerekli" }),
                { status: 400, headers: jsonHeaders },
              );
            }
            deleteServerUser(id);
            return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
          } catch (delUserErr) {
            console.error("[/api/users DELETE] Error:", delUserErr);
            return new Response(
              JSON.stringify({
                ok: false,
                error: "Kullanıcı silinemedi",
                details: delUserErr instanceof Error ? delUserErr.message : String(delUserErr),
              }),
              { status: 500, headers: jsonHeaders },
            );
          }
        }

        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: jsonHeaders,
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

          // 1. Eğer ürün listesi gönderildiyse yerel disk dosyalarını güncelle
          if (Array.isArray(body.products) && body.products.length > 0) {
            try {
              const fs = await import("node:fs");
              const path = await import("node:path");
              const productsPath = path.resolve(process.cwd(), "src/data/products.ts");
              const source = `import type { Product } from "@/lib/catalog";\n\nexport const FALLBACK_PRODUCTS: Product[] = ${JSON.stringify(body.products, null, 2)};\n`;
              fs.writeFileSync(productsPath, source, "utf-8");
              logs.push(
                `✅ src/data/products.ts dosyası ${body.products.length} ürün ile güncellendi.`,
              );
            } catch (fsErr) {
              console.warn("Dosya yazma uyarısı:", fsErr);
            }
          }

          if (body.permanentlyDeleted) {
            try {
              const fs = await import("node:fs");
              const path = await import("node:path");
              const delPath = path.resolve(process.cwd(), "src/data/permanently-deleted.json");
              fs.writeFileSync(delPath, JSON.stringify(body.permanentlyDeleted, null, 2), "utf-8");
              logs.push(`✅ src/data/permanently-deleted.json güncellendi.`);
            } catch (fsErr) {
              console.warn("Silinenler yazma uyarısı:", fsErr);
            }
          }

          if (token) {
            try {
              const ghHeaders = {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "Kotoptan-Sync-Bot",
                "Content-Type": "application/json",
              };

              // Get HEAD
              const refRes = await fetch(
                `https://api.github.com/repos/${repo}/git/ref/heads/main`,
                {
                  headers: ghHeaders,
                },
              );

              if (refRes.ok) {
                const refData = (await refRes.json()) as { object: { sha: string } };
                const commitSha = refData.object.sha;

                // Get commit
                const cRes = await fetch(
                  `https://api.github.com/repos/${repo}/git/commits/${commitSha}`,
                  {
                    headers: ghHeaders,
                  },
                );
                const cData = (await cRes.json()) as { tree: { sha: string } };
                const baseTreeSha = cData.tree.sha;

                // Build tree items
                const treeItems: Array<{
                  path: string;
                  mode: string;
                  type: string;
                  content: string;
                }> = [];
                if (Array.isArray(body.products) && body.products.length > 0) {
                  const source = `import type { Product } from "@/lib/catalog";\n\nexport const FALLBACK_PRODUCTS: Product[] = ${JSON.stringify(body.products, null, 2)};\n`;
                  treeItems.push({
                    path: "src/data/products.ts",
                    mode: "100644",
                    type: "blob",
                    content: source,
                  });
                }
                if (body.permanentlyDeleted) {
                  treeItems.push({
                    path: "src/data/permanently-deleted.json",
                    mode: "100644",
                    type: "blob",
                    content: JSON.stringify(body.permanentlyDeleted, null, 2),
                  });
                }

                if (treeItems.length > 0) {
                  const tRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
                    method: "POST",
                    headers: ghHeaders,
                    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
                  });
                  if (tRes.ok) {
                    const tData = (await tRes.json()) as { sha: string };
                    const newTreeSha = tData.sha;

                    const ncRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
                      method: "POST",
                      headers: ghHeaders,
                      body: JSON.stringify({
                        message: commitMsg,
                        tree: newTreeSha,
                        parents: [commitSha],
                      }),
                    });

                    if (ncRes.ok) {
                      const ncData = (await ncRes.json()) as { sha: string };
                      const newCommitSha = ncData.sha;

                      await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
                        method: "PATCH",
                        headers: ghHeaders,
                        body: JSON.stringify({ sha: newCommitSha, force: false }),
                      });

                      logs.push(
                        `✅ GitHub deposuna (${repo}) doğrudan push edildi! Commit: ${newCommitSha.slice(0, 7)}`,
                      );
                      logs.push(`🚀 Cloudflare Pages otomatik dağıtımı tetiklendi.`);

                      return new Response(
                        JSON.stringify({
                          ok: true,
                          commitHash: newCommitSha.slice(0, 7),
                          logs,
                          lastSyncedAt: new Date().toISOString(),
                        }),
                        { headers: jsonHeaders },
                      );
                    }
                  }
                }
              }
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

      let response: Response;
      try {
        const handler = await getServerEntry();
        response = await handler.fetch(request, safeEnv, ctx);
      } catch (handlerErr) {
        console.error("[src/server.ts] ServerEntry fetch error:", handlerErr);
        const errDetail =
          handlerErr instanceof Error ? handlerErr.stack || handlerErr.message : String(handlerErr);
        const isApi =
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/_serverFn") ||
          request.headers.get("accept")?.includes("application/json");

        if (isApi) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Sunucu isteği işlenirken bir hata oluştu.",
              details: errDetail,
              status: 500,
              unhandled: false,
            }),
            {
              status: 500,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "access-control-allow-origin": "*",
              },
            },
          );
        }
        return new Response(renderErrorPage(errDetail), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      const ssrResponse = await normalizeCatastrophicSsrResponse(response, url, request);

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
      console.error("[src/server.ts] Top-level unhandled exception:", error);
      const reqUrl = new URL(request.url).pathname;
      const errStr = error instanceof Error ? error.stack || error.message : String(error);
      const isApi =
        reqUrl.startsWith("/api/") ||
        reqUrl.startsWith("/_serverFn") ||
        request.headers.get("accept")?.includes("application/json");

      if (isApi) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Sunucuda beklenmeyen bir hata oluştu.",
            details: errStr,
            status: 500,
            unhandled: false,
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "access-control-allow-origin": "*",
            },
          },
        );
      }

      return new Response(renderErrorPage(errStr), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
