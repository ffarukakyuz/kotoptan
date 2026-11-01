export interface ChatSession {
  id: string;
  user_id: string | null;
  user_name: string;
  user_phone: string;
  status: "bot" | "transferred" | "active_admin" | "closed";
  last_message: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageItem {
  id: string;
  session_id: string;
  sender: "user" | "bot" | "admin";
  sender_name: string;
  content: string;
  type?: "text" | "voice";
  audio_url?: string;
  duration?: number;
  created_at: string;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

export function getD1(env: unknown): D1Database | null {
  try {
    if (env && typeof env === "object") {
      const e = env as Record<string, unknown>;
      // Direct env.DB binding
      if (e.DB && typeof (e.DB as D1Database).prepare === "function") {
        return e.DB as D1Database;
      }
      // Nested env.env.DB
      const nested = e.env as Record<string, unknown> | undefined;
      if (nested?.DB && typeof (nested.DB as D1Database).prepare === "function") {
        return nested.DB as D1Database;
      }
      // Cloudflare Pages context: env.context.env.DB or env.context.DB
      const ctx = e.context as Record<string, unknown> | undefined;
      if (ctx?.DB && typeof (ctx.DB as D1Database).prepare === "function") {
        return ctx.DB as D1Database;
      }
      if (ctx?.env && typeof (ctx.env as Record<string, unknown>).DB === "object") {
        const ctxDb = (ctx.env as Record<string, unknown>).DB;
        if (ctxDb && typeof (ctxDb as D1Database).prepare === "function") {
          return ctxDb as D1Database;
        }
      }
      if (ctx?.cloudflare && typeof (ctx.cloudflare as Record<string, unknown>).env === "object") {
        const cfDb = (ctx.cloudflare as Record<string, unknown>).env as Record<string, unknown>;
        if (cfDb?.DB && typeof (cfDb.DB as D1Database).prepare === "function") {
          return cfDb.DB as D1Database;
        }
      }
      // env.bindings.DB
      const bindings = e.bindings as Record<string, unknown> | undefined;
      if (bindings?.DB && typeof (bindings.DB as D1Database).prepare === "function") {
        return bindings.DB as D1Database;
      }
      // platform.env.DB
      const platform = e.platform as Record<string, unknown> | undefined;
      if (platform?.env && typeof (platform.env as Record<string, unknown>).DB === "object") {
        const pDb = (platform.env as Record<string, unknown>).DB as D1Database;
        if (pDb && typeof pDb.prepare === "function") {
          return pDb;
        }
      }
    }

    // Global fallbacks for Cloudflare Workers / Pages context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = typeof globalThis !== "undefined" ? (globalThis as any) : undefined;
    if (g?.__env__?.DB && typeof g.__env__.DB.prepare === "function") {
      return g.__env__.DB as D1Database;
    }
    if (g?.DB && typeof g.DB.prepare === "function") {
      return g.DB as D1Database;
    }
    if (g?.env?.DB && typeof g.env.DB.prepare === "function") {
      return g.env.DB as D1Database;
    }
    if (g?.__CF_PAGES_ENV__?.DB && typeof g.__CF_PAGES_ENV__.DB.prepare === "function") {
      return g.__CF_PAGES_ENV__.DB as D1Database;
    }

    // Process env fallback for Node context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = typeof process !== "undefined" ? (process as any) : undefined;
    if (p?.env?.DB && typeof p.env.DB.prepare === "function") {
      return p.env.DB as D1Database;
    }
  } catch (probingErr) {
    console.error("[getD1] Environment probing error:", probingErr);
  }
  return null;
}

/**
 * Sanitizes parameters for D1 queries.
 * In Cloudflare D1, passing `undefined` to `.bind()` throws an unhandled error.
 */
export function safeBind(stmt: D1PreparedStatement, ...values: unknown[]): D1PreparedStatement {
  const sanitized = values.map((val) => (val === undefined ? null : val));
  return stmt.bind(...sanitized);
}

interface LocalStore {
  sessions: Record<string, ChatSession>;
  messages: ChatMessageItem[];
}

// In-memory fallback (guaranteed to never fail or throw in any runtime)
const inMemoryStore: LocalStore = { sessions: {}, messages: [] };

function canUseNodeFs(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = typeof globalThis !== "undefined" ? (globalThis as any) : {};
    // Do NOT attempt require in Cloudflare Workers / Edge environments
    if (g.__env__ || g.WebSocketPair || g.caches?.default) {
      return false;
    }
    return (
      typeof g.require === "function" &&
      typeof process !== "undefined" &&
      typeof process.cwd === "function" &&
      process.release?.name === "node"
    );
  } catch {
    return false;
  }
}

function loadLocalStore(): LocalStore {
  try {
    if (canUseNodeFs()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeRequire = (globalThis as any).require;
      const fs = nodeRequire("fs");
      const path = nodeRequire("path");
      const localDbPath = path.resolve(process.cwd(), ".local-chat-db.json");
      if (fs.existsSync(localDbPath)) {
        const data = fs.readFileSync(localDbPath, "utf8");
        return JSON.parse(data);
      }
    }
  } catch (_e) {
    // Edge/serverless fallback: use memory store
  }
  return inMemoryStore;
}

function saveLocalStore(store: LocalStore) {
  try {
    inMemoryStore.sessions = store.sessions;
    inMemoryStore.messages = store.messages;
    if (canUseNodeFs()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeRequire = (globalThis as any).require;
      const fs = nodeRequire("fs");
      const path = nodeRequire("path");
      const localDbPath = path.resolve(process.cwd(), ".local-chat-db.json");
      fs.writeFileSync(localDbPath, JSON.stringify(store, null, 2), "utf8");
    }
  } catch (_e) {
    // Edge/serverless fallback
  }
}

export async function initD1Tables(env: unknown) {
  try {
    const d1 = getD1(env);
    if (!d1) return;
    try {
      await d1.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          user_name TEXT,
          user_phone TEXT,
          status TEXT DEFAULT 'bot',
          last_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          sender_name TEXT,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          audio_url TEXT,
          duration INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await d1.exec("ALTER TABLE chat_messages ADD COLUMN type TEXT DEFAULT 'text'");
      } catch (_e) {
        // column may already exist
      }
      try {
        await d1.exec("ALTER TABLE chat_messages ADD COLUMN audio_url TEXT");
      } catch (_e) {
        // column may already exist
      }
      try {
        await d1.exec("ALTER TABLE chat_messages ADD COLUMN duration INTEGER DEFAULT 0");
      } catch (_e) {
        // column may already exist
      }
    } catch (e) {
      console.error("[D1 initD1Tables] SQL execution error:", e);
    }
  } catch (err) {
    console.error("[D1 initD1Tables] Unexpected initialization error:", err);
  }
}

export async function getOrCreateSession(
  env: unknown,
  sessionId: string,
  userId?: string | null,
  userName?: string,
  userPhone?: string,
): Promise<ChatSession> {
  const now = new Date().toISOString();
  const safeSessionId = String(sessionId || `session_${Date.now()}`);
  const safeName = String(userName || "Müşteri / Bayi");
  const safePhone = String(userPhone || "");
  const safeUserId = userId ? String(userId) : null;

  try {
    const d1 = getD1(env);
    if (d1) {
      try {
        const existing = await safeBind(
          d1.prepare("SELECT * FROM chat_sessions WHERE id = ?"),
          safeSessionId,
        ).first<ChatSession>();

        if (existing) {
          return existing;
        }

        await safeBind(
          d1.prepare(
            "INSERT INTO chat_sessions (id, user_id, user_name, user_phone, status, last_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          ),
          safeSessionId,
          safeUserId,
          safeName,
          safePhone,
          "bot",
          "",
          now,
          now,
        ).run();

        return {
          id: safeSessionId,
          user_id: safeUserId,
          user_name: safeName,
          user_phone: safePhone,
          status: "bot",
          last_message: "",
          created_at: now,
          updated_at: now,
        };
      } catch (e) {
        console.error("[D1 getOrCreateSession] Database error:", e);
      }
    }
  } catch (err) {
    console.error("[getOrCreateSession] Unexpected error:", err);
  }

  // Local memory / fallback
  const store = loadLocalStore();
  if (store.sessions[safeSessionId]) {
    return store.sessions[safeSessionId];
  }
  const newSession: ChatSession = {
    id: safeSessionId,
    user_id: safeUserId,
    user_name: safeName,
    user_phone: safePhone,
    status: "bot",
    last_message: "",
    created_at: now,
    updated_at: now,
  };
  store.sessions[safeSessionId] = newSession;
  saveLocalStore(store);
  return newSession;
}

export async function listAllSessions(env: unknown): Promise<ChatSession[]> {
  try {
    const d1 = getD1(env);
    if (d1) {
      try {
        const res = await d1
          .prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC")
          .all<ChatSession>();
        return res.results || [];
      } catch (e) {
        console.error("[D1 listAllSessions] Database error:", e);
      }
    }
  } catch (err) {
    console.error("[listAllSessions] Unexpected error:", err);
  }

  const store = loadLocalStore();
  return Object.values(store.sessions).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function getSessionDetails(
  env: unknown,
  sessionId: string,
): Promise<{ session: ChatSession | null; messages: ChatMessageItem[] }> {
  const safeSessionId = String(sessionId || "");
  try {
    const d1 = getD1(env);
    if (d1 && safeSessionId) {
      try {
        const session = await safeBind(
          d1.prepare("SELECT * FROM chat_sessions WHERE id = ?"),
          safeSessionId,
        ).first<ChatSession>();

        const messagesRes = await safeBind(
          d1.prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC"),
          safeSessionId,
        ).all<ChatMessageItem>();

        return {
          session: session || null,
          messages: messagesRes.results || [],
        };
      } catch (e) {
        console.error("[D1 getSessionDetails] Database error:", e);
      }
    }
  } catch (err) {
    console.error("[getSessionDetails] Unexpected error:", err);
  }

  const store = loadLocalStore();
  const session = store.sessions[safeSessionId] || null;
  const messages = store.messages
    .filter((m) => m.session_id === safeSessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return { session, messages };
}

export async function addChatMessage(
  env: unknown,
  sessionId: string,
  sender: "user" | "bot" | "admin",
  senderName: string,
  content: string,
  type: "text" | "voice" = "text",
  audioUrl?: string,
  duration?: number,
): Promise<ChatMessageItem> {
  const safeSessionId = String(sessionId || `session_${Date.now()}`);
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const safeSender = sender || "user";
  const safeSenderName = String(
    senderName || (sender === "bot" ? "Ko Asistan" : sender === "admin" ? "Yönetici" : "Müşteri"),
  );
  const safeContent = String(content || "");
  const safeType = type === "voice" ? "voice" : "text";
  const safeAudioUrl = audioUrl ? String(audioUrl) : null;
  const safeDuration = typeof duration === "number" ? duration : 0;

  const msgItem: ChatMessageItem = {
    id,
    session_id: safeSessionId,
    sender: safeSender,
    sender_name: safeSenderName,
    content: safeContent,
    type: safeType,
    audio_url: safeAudioUrl || undefined,
    duration: safeDuration,
    created_at: now,
  };

  const previewSnippet = safeType === "voice" ? "🎤 Sesli Mesaj" : safeContent.slice(0, 100);

  try {
    const d1 = getD1(env);
    if (d1) {
      try {
        await safeBind(
          d1.prepare(
            "INSERT INTO chat_messages (id, session_id, sender, sender_name, content, type, audio_url, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          ),
          id,
          safeSessionId,
          safeSender,
          safeSenderName,
          safeContent,
          safeType,
          safeAudioUrl,
          safeDuration,
          now,
        ).run();

        await safeBind(
          d1.prepare("UPDATE chat_sessions SET last_message = ?, updated_at = ? WHERE id = ?"),
          previewSnippet,
          now,
          safeSessionId,
        ).run();

        return msgItem;
      } catch (e) {
        console.error("[D1 addChatMessage] Database error:", e);
      }
    }
  } catch (err) {
    console.error("[addChatMessage] Unexpected error:", err);
  }

  const store = loadLocalStore();
  store.messages.push(msgItem);
  if (store.sessions[safeSessionId]) {
    store.sessions[safeSessionId].last_message = previewSnippet;
    store.sessions[safeSessionId].updated_at = now;
  }
  saveLocalStore(store);
  return msgItem;
}

export async function updateSessionStatus(
  env: unknown,
  sessionId: string,
  status: "bot" | "transferred" | "active_admin" | "closed",
): Promise<boolean> {
  const now = new Date().toISOString();
  const safeSessionId = String(sessionId || "");
  const safeStatus = status || "bot";

  try {
    const d1 = getD1(env);
    if (d1 && safeSessionId) {
      try {
        await safeBind(
          d1.prepare("UPDATE chat_sessions SET status = ?, updated_at = ? WHERE id = ?"),
          safeStatus,
          now,
          safeSessionId,
        ).run();
        return true;
      } catch (e) {
        console.error("[D1 updateSessionStatus] Database error:", e);
      }
    }
  } catch (err) {
    console.error("[updateSessionStatus] Unexpected error:", err);
  }

  const store = loadLocalStore();
  if (store.sessions[safeSessionId]) {
    store.sessions[safeSessionId].status = safeStatus;
    store.sessions[safeSessionId].updated_at = now;
    saveLocalStore(store);
    return true;
  }
  return false;
}
