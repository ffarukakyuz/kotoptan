// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function apiGeminiPlugin() {
  return {
    name: "api-gemini-plugin",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use("/api/chat", (req: any, res: any) => {
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
            const { processChat } = await import("./src/server/gemini-handler");
            const result = await processChat(data.messages || [], data.isAdmin, data.userMeta);
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
