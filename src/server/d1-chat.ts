import fs from "fs";
import path from "path";

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

function getD1(env: unknown): D1Database | null {
  if (
    env &&
    typeof env === "object" &&
    "DB" in env &&
    Boolean(env.DB) &&
    typeof (env.DB as D1Database).prepare === "function"
  ) {
    return env.DB as D1Database;
  }
  return null;
}

// Local persistent fallback file for local development when D1 is not in environment
const LOCAL_DB_PATH = path.resolve(process.cwd(), ".local-chat-db.json");

interface LocalStore {
  sessions: Record<string, ChatSession>;
  messages: ChatMessageItem[];
}

function loadLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("[D1 Fallback] Error reading local store:", e);
  }
  return { sessions: {}, messages: [] };
}

function saveLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.warn("[D1 Fallback] Error saving local store:", e);
  }
}

export async function initD1Tables(env: unknown) {
  const d1 = getD1(env);
  if (d1) {
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
      } catch {}
      try {
        await d1.exec("ALTER TABLE chat_messages ADD COLUMN audio_url TEXT");
      } catch {}
      try {
        await d1.exec("ALTER TABLE chat_messages ADD COLUMN duration INTEGER DEFAULT 0");
      } catch {}
    } catch (e) {
      console.warn("[D1] init tables warning:", e);
    }
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
  const safeName = userName || "Müşteri / Bayi";
  const safePhone = userPhone || "";
  const d1 = getD1(env);

  if (d1) {
    try {
      const existing = await d1
        .prepare("SELECT * FROM chat_sessions WHERE id = ?")
        .bind(sessionId)
        .first<ChatSession>();
      if (existing) {
        return existing;
      }
      await d1
        .prepare(
          "INSERT INTO chat_sessions (id, user_id, user_name, user_phone, status, last_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(sessionId, userId || null, safeName, safePhone, "bot", "", now, now)
        .run();

      return {
        id: sessionId,
        user_id: userId || null,
        user_name: safeName,
        user_phone: safePhone,
        status: "bot",
        last_message: "",
        created_at: now,
        updated_at: now,
      };
    } catch (e) {
      console.warn("[D1 getOrCreateSession] error:", e);
    }
  }

  // Local fallback
  const store = loadLocalStore();
  if (store.sessions[sessionId]) {
    return store.sessions[sessionId];
  }
  const newSession: ChatSession = {
    id: sessionId,
    user_id: userId || null,
    user_name: safeName,
    user_phone: safePhone,
    status: "bot",
    last_message: "",
    created_at: now,
    updated_at: now,
  };
  store.sessions[sessionId] = newSession;
  saveLocalStore(store);
  return newSession;
}

export async function listAllSessions(env: unknown): Promise<ChatSession[]> {
  const d1 = getD1(env);
  if (d1) {
    try {
      const res = await d1
        .prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC")
        .all<ChatSession>();
      return res.results || [];
    } catch (e) {
      console.warn("[D1 listAllSessions] error:", e);
    }
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
  const d1 = getD1(env);
  if (d1) {
    try {
      const session = await d1
        .prepare("SELECT * FROM chat_sessions WHERE id = ?")
        .bind(sessionId)
        .first<ChatSession>();
      const messagesRes = await d1
        .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC")
        .bind(sessionId)
        .all<ChatMessageItem>();

      return {
        session: session || null,
        messages: messagesRes.results || [],
      };
    } catch (e) {
      console.warn("[D1 getSessionDetails] error:", e);
    }
  }

  const store = loadLocalStore();
  const session = store.sessions[sessionId] || null;
  const messages = store.messages
    .filter((m) => m.session_id === sessionId)
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
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const msgItem: ChatMessageItem = {
    id,
    session_id: sessionId,
    sender,
    sender_name: senderName,
    content,
    type,
    audio_url: audioUrl,
    duration: duration || 0,
    created_at: now,
  };

  const previewSnippet = type === "voice" ? "🎤 Sesli Mesaj" : content.slice(0, 100);

  const d1 = getD1(env);
  if (d1) {
    try {
      await d1
        .prepare(
          "INSERT INTO chat_messages (id, session_id, sender, sender_name, content, type, audio_url, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, sessionId, sender, senderName, content, type, audioUrl || null, duration || 0, now)
        .run();

      await d1
        .prepare("UPDATE chat_sessions SET last_message = ?, updated_at = ? WHERE id = ?")
        .bind(previewSnippet, now, sessionId)
        .run();

      return msgItem;
    } catch (e) {
      console.warn("[D1 addChatMessage] error:", e);
    }
  }

  const store = loadLocalStore();
  store.messages.push(msgItem);
  if (store.sessions[sessionId]) {
    store.sessions[sessionId].last_message = previewSnippet;
    store.sessions[sessionId].updated_at = now;
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
  const d1 = getD1(env);

  if (d1) {
    try {
      await d1
        .prepare("UPDATE chat_sessions SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status, now, sessionId)
        .run();
      return true;
    } catch (e) {
      console.warn("[D1 updateSessionStatus] error:", e);
    }
  }

  const store = loadLocalStore();
  if (store.sessions[sessionId]) {
    store.sessions[sessionId].status = status;
    store.sessions[sessionId].updated_at = now;
    saveLocalStore(store);
    return true;
  }
  return false;
}
