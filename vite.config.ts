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
      server.middlewares.use("/api/products", async (req: any, res: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === "GET") {
          try {
            const { FALLBACK_PRODUCTS } = await import("./src/data/products");
            res.setHeader("Content-Type", "application/json");
            return res.end(JSON.stringify(FALLBACK_PRODUCTS));
          } catch {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: "Failed to load products" }));
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
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, product }));
            } catch {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid product data" }));
            }
          });
          return;
        }

        if (req.method === "DELETE") {
          const url = new URL(req.url || "", "http://localhost");
          const id = url.searchParams.get("id");
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ ok: true, id }));
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
  },
  vite: {
    plugins: [apiGeminiPlugin()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
