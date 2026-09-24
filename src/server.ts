import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { processChat, processVision } from "./server/gemini-handler";

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/chat" && request.method === "POST") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = (await request.json()) as any;
          const result = await processChat(body.messages || [], body.isAdmin, body.userMeta);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : "Error processing chat";
          return new Response(JSON.stringify({ ok: false, error: errMsg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
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
