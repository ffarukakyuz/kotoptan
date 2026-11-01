export async function authenticateCronRequest(request: Request): Promise<Response | null> {
  const g = globalThis as unknown as { __env__?: Record<string, string | undefined> };
  const currentSecret =
    (typeof process !== "undefined" && process.env && process.env["CRON_SECRET"]) ||
    g.__env__?.CRON_SECRET;
  const previousSecret =
    (typeof process !== "undefined" && process.env && process.env["CRON_SECRET_PREVIOUS"]) ||
    g.__env__?.CRON_SECRET_PREVIOUS;

  if (!currentSecret) {
    return new Response("Server configuration error", { status: 500 });
  }

  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  const providedDigest = digest(token);
  const currentMatches = timingSafeEqual(providedDigest, digest(currentSecret));
  const previousMatches = timingSafeEqual(providedDigest, digest(previousSecret ?? currentSecret));

  if (!currentMatches && !previousMatches) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
