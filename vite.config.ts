// Vite TanStack Config for Kotoptan
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function apiGeminiPlugin() {
  return {
    name: "api-gemini-plugin",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/chat", async (req: any, res: any) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);

        const {
          initD1Tables,
          getOrCreateSession,
          listAllSessions,
          getSessionDetails,
          addChatMessage,
          updateSessionStatus,
        } = await import("./src/server/d1-chat");
        const { processChat } = await import("./src/server/gemini-handler");

        await initD1Tables(null);

        if (req.method === "GET") {
          const action = url.searchParams.get("action");
          const sessionId = url.searchParams.get("sessionId");

          res.setHeader("Content-Type", "application/json");

          if (action === "list_sessions") {
            const sessions = await listAllSessions(null);
            return res.end(JSON.stringify({ ok: true, sessions }));
          }

          if (action === "get_session" && sessionId) {
            const details = await getSessionDetails(null, sessionId);
            return res.end(JSON.stringify({ ok: true, ...details }));
          }

          res.statusCode = 400;
          return res.end(JSON.stringify({ ok: false, error: "Geçersiz işlem" }));
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const action = data.action || "chat";
              res.setHeader("Content-Type", "application/json");

              // 1. Yönetici yanıtı
              if (action === "admin_reply") {
                const { sessionId, adminName, content } = data;
                if (!sessionId || !content) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ ok: false, error: "Eksik parametre" }));
                }
                const msg = await addChatMessage(
                  null,
                  sessionId,
                  "admin",
                  adminName || "Yönetici",
                  content,
                );
                await updateSessionStatus(null, sessionId, "active_admin");
                return res.end(JSON.stringify({ ok: true, message: msg }));
              }

              // 2. Temsilciye aktar
              if (action === "transfer_to_admin") {
                const { sessionId } = data;
                if (!sessionId) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ ok: false, error: "Eksik sessionId" }));
                }
                await updateSessionStatus(null, sessionId, "transferred");
                const transferMsg = await addChatMessage(
                  null,
                  sessionId,
                  "bot",
                  "Ko Depo Asistanı",
                  "Sohbetiniz müşteri temsilcisine / yetkili yöneticiye aktarıldı. Yetkili yöneticimiz birazdan size doğrudan buradan yanıt verecektir.",
                );
                return res.end(
                  JSON.stringify({ ok: true, status: "transferred", message: transferMsg }),
                );
              }

              // 3. Sohbeti sonlandır
              if (action === "close_session") {
                const { sessionId, adminName } = data;
                if (!sessionId) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ ok: false, error: "Eksik sessionId" }));
                }
                await updateSessionStatus(null, sessionId, "closed");
                const closedMsg = await addChatMessage(
                  null,
                  sessionId,
                  "admin",
                  adminName || "Yönetici",
                  "Sohbet yetkili yönetici tarafından sonlandırıldı. İyi günler dileriz!",
                );
                return res.end(JSON.stringify({ ok: true, status: "closed", message: closedMsg }));
              }

              // 4. Müşteri mesajı (AI + Temsilciye Aktarım)
              const {
                sessionId,
                userId,
                userName,
                userPhone,
                messages,
                content,
                transferRequested,
                isAdmin,
                userMeta,
              } = data;

              const safeSessionId = sessionId || `session_${userId || "guest"}_${Date.now()}`;
              const session = await getOrCreateSession(
                null,
                safeSessionId,
                userId,
                userName,
                userPhone,
              );

              if (content) {
                await addChatMessage(null, safeSessionId, "user", userName || "Müşteri", content);
              }

              const lowerContent = (content || "").toLowerCase();
              const wantsHuman =
                transferRequested === true ||
                lowerContent.includes("temsilci") ||
                lowerContent.includes("yetkili") ||
                lowerContent.includes("yonetici") ||
                lowerContent.includes("insan") ||
                lowerContent.includes("canli destek") ||
                lowerContent.includes("aktar") ||
                lowerContent.includes("baglan");

              if (wantsHuman && session.status !== "active_admin") {
                await updateSessionStatus(null, safeSessionId, "transferred");
                const botNotice = await addChatMessage(
                  null,
                  safeSessionId,
                  "bot",
                  "Ko Depo Asistanı",
                  "Talebiniz alındı. Sohbet müşteri temsilcisine / yetkili yöneticiye aktarıldı. Yetkili yöneticimiz birazdan size doğrudan buradan yazacaktır. Lütfen bekleyin...",
                );
                return res.end(
                  JSON.stringify({
                    ok: true,
                    sessionId: safeSessionId,
                    status: "transferred",
                    reply: botNotice.content,
                    transferred: true,
                  }),
                );
              }

              if (session.status === "transferred" || session.status === "active_admin") {
                return res.end(
                  JSON.stringify({
                    ok: true,
                    sessionId: safeSessionId,
                    status: session.status,
                    waitingAdmin: true,
                    reply: null,
                  }),
                );
              }

              const chatMessages =
                messages && messages.length > 0 ? messages : [{ role: "user", content }];
              const result = await processChat(chatMessages, isAdmin, userMeta);

              if (result.reply) {
                await addChatMessage(null, safeSessionId, "bot", "Ko Depo Asistanı", result.reply);
              }

              return res.end(
                JSON.stringify({
                  ...result,
                  sessionId: safeSessionId,
                  status: session.status,
                }),
              );
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              const msg = err instanceof Error ? err.message : "Error";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        res.statusCode = 405;
        return res.end();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/analyze-product", (req: any, res: any) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.on("data", (chunk: any) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const data = JSON.parse(body || "{}");
            const { processVision } = await import("./src/server/gemini-handler");
            const result = await processVision(data.imageBase64, data.mimeType, data.note);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err: unknown) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            const msg = err instanceof Error ? err.message : "Error";
            res.end(JSON.stringify({ ok: false, error: msg }));
          }
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/erp-sync", async (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === "GET") {
          const { FALLBACK_PRODUCTS } = await import("./src/data/products");
          return res.end(
            JSON.stringify({
              ok: true,
              connected: true,
              source: "ERP 12 SQL Server (KasımOğulları Ana Depo)",
              lastSyncAt: new Date().toISOString(),
              totalProducts: FALLBACK_PRODUCTS.length,
              status: "active",
            }),
          );
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const incoming = Array.isArray(data.products) ? data.products : [];
              if (incoming.length > 0) {
                const fs = await import("node:fs");
                const path = await import("node:path");
                const pPath = path.resolve(process.cwd(), "src/data/products.ts");
                if (fs.existsSync(pPath)) {
                  const content = fs.readFileSync(pPath, "utf-8");
                  const match = content.match(
                    /export const FALLBACK_PRODUCTS: Product\[\] = (\[[\s\S]*?\]);\s*$/,
                  );
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const list: any[] = match && match[1] ? JSON.parse(match[1]) : [];
                  for (const p of incoming) {
                    if (!p || !p.id) continue;
                    const idx = list.findIndex((item: { id: string }) => item && item.id === p.id);
                    if (idx >= 0) list[idx] = { ...list[idx], ...p };
                    else list.push(p);
                  }
                  const source = `import type { Product } from "@/lib/catalog";\n\nexport const FALLBACK_PRODUCTS: Product[] = ${JSON.stringify(list, null, 2)};\n`;
                  fs.writeFileSync(pPath, source, "utf-8");
                }
              }
              return res.end(
                JSON.stringify({
                  ok: true,
                  message: `${incoming.length} adet ERP 12 ürünü senkronize edildi.`,
                  count: incoming.length,
                }),
              );
            } catch (postErr) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ ok: false, error: String(postErr) }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/products", async (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        const { getAllServerProducts, saveServerProduct, deleteServerProduct } =
          await import("./src/server/product-sync");

        if (req.method === "GET") {
          try {
            const products = await getAllServerProducts(null);
            return res.end(JSON.stringify(products));
          } catch (pErr) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ ok: false, error: "Ürünler yüklenemedi" }));
          }
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ ok: false, error: "Ürün adı zorunludur" }));
              }
              const product = await saveServerProduct(data, null);
              res.end(JSON.stringify({ ok: true, product }));
            } catch (err: unknown) {
              res.statusCode = 500;
              const msg = err instanceof Error ? err.message : "Ürün kaydedilemedi";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        if (req.method === "DELETE") {
          const url = new URL(req.url || "", `http://${req.headers.host || "localhost:3000"}`);
          const id = url.searchParams.get("id");
          const name = url.searchParams.get("name") || undefined;
          if (!id) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: "ID gerekli" }));
          }
          await deleteServerProduct(id, name, null);
          return res.end(JSON.stringify({ ok: true, id }));
        }

        res.statusCode = 405;
        res.end();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/orders", async (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
        const {
          getAllServerOrders,
          createOrUpdateServerOrder,
          updateServerOrderStatus,
          deleteServerOrder,
        } = await import("./src/server/order-sync");

        if (req.method === "GET") {
          try {
            const userId = url.searchParams.get("userId");
            const isAdmin = url.searchParams.get("isAdmin") === "true";
            const orders = await getAllServerOrders(null, userId, isAdmin);
            return res.end(JSON.stringify({ ok: true, orders }));
          } catch (ordersErr) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ ok: false, error: "Siparişler yüklenemedi" }));
          }
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              if (!data.full_name || !data.phone || !data.address) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ ok: false, error: "Eksik sipariş bilgileri" }));
              }
              const order = await createOrUpdateServerOrder(data, null);
              res.end(JSON.stringify({ ok: true, order }));
            } catch (err: unknown) {
              res.statusCode = 500;
              const msg = err instanceof Error ? err.message : "Sipariş kaydedilemedi";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        if (req.method === "PATCH") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              if (!data.id) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ ok: false, error: "Sipariş ID gerekli" }));
              }
              const updated = await updateServerOrderStatus(data.id, data, null);
              res.end(JSON.stringify({ ok: true, order: updated }));
            } catch (err: unknown) {
              res.statusCode = 500;
              const msg = err instanceof Error ? err.message : "Sipariş güncellenemedi";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        if (req.method === "DELETE") {
          const id = url.searchParams.get("id");
          if (!id) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: "Sipariş ID gerekli" }));
          }
          await deleteServerOrder(id, null);
          return res.end(JSON.stringify({ ok: true }));
        }

        res.statusCode = 405;
        res.end();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/github", async (req: any, res: any) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
        const { getGitStatus, performGitSync, verifyGitHubToken, saveGitHubConfig } =
          await import("./src/server/github-sync");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "GET") {
          const status = await getGitStatus();
          return res.end(JSON.stringify(status));
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const action = data.action || (url.pathname.endsWith("/verify") ? "verify" : "sync");

              if (action === "verify") {
                const verifyRes = await verifyGitHubToken(data.token, data.repo);
                return res.end(JSON.stringify(verifyRes));
              }

              if (action === "save_config") {
                const saved = saveGitHubConfig({
                  token: data.token,
                  repo: data.repo,
                  branch: data.branch,
                });
                return res.end(JSON.stringify({ ok: true, config: saved }));
              }

              const syncRes = await performGitSync({
                commitMessage: data.commitMessage,
                token: data.token,
                branch: data.branch,
                authorName: data.authorName,
                authorEmail: data.authorEmail,
                products: data.products,
                permanentlyDeleted: data.permanentlyDeleted,
              });

              return res.end(JSON.stringify(syncRes));
            } catch (err: unknown) {
              res.statusCode = 500;
              const msg = err instanceof Error ? err.message : "GitHub sync error";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/users", async (req: any, res: any) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
        const { getAllServerUsers, registerOrUpdateServerUser, deleteServerUser } =
          await import("./src/server/user-sync");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "GET") {
          try {
            const users = await getAllServerUsers(null);
            return res.end(JSON.stringify({ ok: true, users }));
          } catch (err: unknown) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ ok: false, error: "Kullanıcılar okunamadı" }));
          }
        }

        if (req.method === "POST") {
          let body = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              if (!data.phone) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ ok: false, error: "Telefon numarası zorunludur" }));
              }
              const user = await registerOrUpdateServerUser(data, null);
              return res.end(JSON.stringify({ ok: true, user }));
            } catch (err: unknown) {
              res.statusCode = 500;
              const msg = err instanceof Error ? err.message : "User sync error";
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
          return;
        }

        if (req.method === "DELETE") {
          const id = url.searchParams.get("id");
          if (!id) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, error: "ID gerekli" }));
          }
          await deleteServerUser(id, null);
          return res.end(JSON.stringify({ ok: true }));
        }

        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  },
  nitro: {
    preset: "cloudflare-pages",
  },
  vite: {
    base: "/",
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
    plugins: [apiGeminiPlugin()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
    },
    esbuild: {
      target: "es2018",
    },
    build: {
      target: ["es2018", "chrome78", "edge79", "firefox68", "safari12"],
      cssTarget: ["chrome78", "firefox68", "safari12"],
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
