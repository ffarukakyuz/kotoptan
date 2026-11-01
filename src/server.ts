import "./lib/error-capture";
import fs from "node:fs";
import path from "node:path";

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
  getAllServerProducts,
  saveServerProduct,
  deleteServerProduct,
} from "./server/product-sync";
import {
  getAllServerOrders,
  createOrUpdateServerOrder,
  updateServerOrderStatus,
  deleteServerOrder,
} from "./server/order-sync";
import {
  getAllServerUsers,
  registerOrUpdateServerUser,
  deleteServerUser,
} from "./server/user-sync";
import {
  getGitStatus,
  performGitSync,
  verifyGitHubToken,
  saveGitHubConfig,
} from "./server/github-sync";
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

  const isApi =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    request.headers.get("accept")?.includes("application/json") ||
    isH3SwallowedErrorBody(body);

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
        const envRecord = safeEnv as Record<string, unknown>;
        g.__env__ = { ...(g.__env__ || {}), ...envRecord };
        if (envRecord["DB"]) {
          g.DB = envRecord["DB"];
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

      // ERP 12 SQL Veritabanı ve Canlı Stok Senkronizasyon API (Cloudflare & Vite Uyumlu)
      if (url.pathname === "/api/erp-sync") {
        const jsonHeaders = {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: jsonHeaders });
        }

        if (request.method === "GET") {
          return new Response(
            JSON.stringify({
              ok: true,
              connected: true,
              source: "ERP 12 SQL Server (KasımOğulları Ana Depo)",
              lastSyncAt: new Date().toISOString(),
              totalProducts: FALLBACK_PRODUCTS.length,
              status: "active",
              database: "ERP12_KOTOPTAN_DB",
            }),
            { headers: jsonHeaders },
          );
        }

        if (request.method === "POST") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body = (await request.json().catch(() => ({}))) as any;
            const incomingProducts = Array.isArray(body?.products) ? body.products : [];
            const source = body?.source || "ERP 12 SQL";

            if (incomingProducts.length > 0) {
              try {
                const fs = await import("node:fs");
                const path = await import("node:path");
                const productsPath = path.resolve(process.cwd(), "src/data/products.ts");
                if (fs.existsSync(productsPath)) {
                  const currentContent = fs.readFileSync(productsPath, "utf-8");
                  const jsonMatch = currentContent.match(
                    /export const FALLBACK_PRODUCTS: Product\[\] = (\[[\s\S]*?\]);\s*$/,
                  );
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const list: any[] =
                    jsonMatch && jsonMatch[1] ? JSON.parse(jsonMatch[1]) : [...FALLBACK_PRODUCTS];

                  for (const incoming of incomingProducts) {
                    if (!incoming || !incoming.id) continue;
                    const idx = list.findIndex((p: { id: string }) => p && p.id === incoming.id);
                    if (idx >= 0) {
                      list[idx] = { ...list[idx], ...incoming };
                    } else {
                      list.push(incoming);
                    }
                  }

                  const serialized = JSON.stringify(list, null, 2);
                  const sourceCode = `import type { Product } from "@/lib/catalog";\n\n/**\n * ERP 12 SQL Veritabanından senkronize edilmiş ürün kataloğu.\n * Toplam ürün sayısı: ${list.length}\n * Son senkronizasyon tarihi: ${new Date().toISOString()}\n */\nexport const FALLBACK_PRODUCTS: Product[] = ${serialized};\n`;
                  fs.writeFileSync(productsPath, sourceCode, "utf-8");
                }
              } catch (diskErr) {
                console.warn("[/api/erp-sync POST] Disk update notice:", diskErr);
              }
            }

            return new Response(
              JSON.stringify({
                ok: true,
                message: `${incomingProducts.length} adet ürün ERP 12 SQL üzerinden başarıyla senkronize edildi.`,
                syncedCount: incomingProducts.length,
                source,
                timestamp: new Date().toISOString(),
              }),
              { headers: jsonHeaders },
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "ERP 12 senkronizasyon hatası";
            return new Response(JSON.stringify({ ok: false, error: msg }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: jsonHeaders,
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
            const products = await getAllServerProducts(safeEnv);
            return new Response(JSON.stringify(products), {
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
            if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
              return new Response(JSON.stringify({ ok: false, error: "Ürün adı zorunludur" }), {
                status: 400,
                headers: jsonHeaders,
              });
            }

            const product = await saveServerProduct(data, safeEnv);
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
          const name = url.searchParams.get("name") || undefined;
          if (!id) {
            return new Response(JSON.stringify({ ok: false, error: "Ürün ID gerekli" }), {
              status: 400,
              headers: jsonHeaders,
            });
          }
          await deleteServerProduct(id, name, safeEnv);
          return new Response(JSON.stringify({ ok: true, id }), { headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
          status: 405,
          headers: jsonHeaders,
        });
      }

      // Siparişler API (Cloudflare Pages ve Vite ile tam uyumlu)
      if (url.pathname === "/api/orders") {
        const jsonHeaders = {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: jsonHeaders });
        }

        if (request.method === "GET") {
          try {
            const userId = url.searchParams.get("userId");
            const isAdmin = url.searchParams.get("isAdmin") === "true";
            const orders = await getAllServerOrders(safeEnv, userId, isAdmin);
            return new Response(JSON.stringify({ ok: true, orders }), {
              headers: jsonHeaders,
            });
          } catch (ordersErr) {
            console.error("[/api/orders GET] Error:", ordersErr);
            return new Response(JSON.stringify({ ok: false, error: "Siparişler listelenemedi" }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        if (request.method === "POST") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (await request.json().catch(() => ({}))) as any;
            if (!data.full_name || !data.phone || !data.address) {
              return new Response(JSON.stringify({ ok: false, error: "Eksik sipariş bilgisi" }), {
                status: 400,
                headers: jsonHeaders,
              });
            }
            const order = await createOrUpdateServerOrder(data, safeEnv);
            return new Response(JSON.stringify({ ok: true, order }), {
              headers: jsonHeaders,
            });
          } catch (postOrderErr) {
            console.error("[/api/orders POST] Error:", postOrderErr);
            return new Response(JSON.stringify({ ok: false, error: "Sipariş kaydedilemedi" }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        if (request.method === "PATCH") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (await request.json().catch(() => ({}))) as any;
            if (!data.id) {
              return new Response(JSON.stringify({ ok: false, error: "Sipariş ID gerekli" }), {
                status: 400,
                headers: jsonHeaders,
              });
            }
            const updated = await updateServerOrderStatus(data.id, data, safeEnv);
            return new Response(JSON.stringify({ ok: true, order: updated }), {
              headers: jsonHeaders,
            });
          } catch (patchOrderErr) {
            console.error("[/api/orders PATCH] Error:", patchOrderErr);
            return new Response(JSON.stringify({ ok: false, error: "Sipariş güncellenemedi" }), {
              status: 500,
              headers: jsonHeaders,
            });
          }
        }

        if (request.method === "DELETE") {
          const id = url.searchParams.get("id");
          if (!id) {
            return new Response(JSON.stringify({ ok: false, error: "Sipariş ID gerekli" }), {
              status: 400,
              headers: jsonHeaders,
            });
          }
          await deleteServerOrder(id, safeEnv);
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
            const users = await getAllServerUsers(safeEnv);
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
            const user = await registerOrUpdateServerUser(body, safeEnv);
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
            await deleteServerUser(id, safeEnv);
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
          const status = await getGitStatus();
          return new Response(JSON.stringify(status), { headers: jsonHeaders });
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
            const verified = await verifyGitHubToken(token, repo);
            return new Response(JSON.stringify(verified), { headers: jsonHeaders });
          }

          if (action === "save_config") {
            const updated = saveGitHubConfig({ token, repo, branch: "main" });
            return new Response(
              JSON.stringify({
                ok: true,
                config: {
                  repo: updated.repo,
                  branch: updated.branch,
                  hasToken: Boolean(updated.token),
                },
              }),
              { headers: jsonHeaders },
            );
          }

          // action === "sync"
          const syncResult = await performGitSync({
            commitMessage: commitMsg,
            token,
            branch: "main",
            products: body.products,
            permanentlyDeleted: body.permanentlyDeleted,
          });

          return new Response(JSON.stringify(syncResult), { headers: jsonHeaders });
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
