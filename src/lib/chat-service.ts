export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "admin" | "bot";
  content: string;
  sender_name?: string;
  created_at?: string;
  image?: string;
  productPreview?: {
    id: string;
    name: string;
    category: string;
    unit: string;
    description: string;
    image_url?: string | null;
  };
}

export interface ChatSessionData {
  id: string;
  user_id: string | null;
  user_name: string;
  user_phone: string;
  status: "bot" | "transferred" | "active_admin" | "closed";
  last_message: string;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_SESSION_KEY = "ko_customer_chat_session_id";

/**
 * Müşteriye özel benzersiz sohbet kimliği üretir veya mevcut olanı döner.
 */
export function getOrCreateCustomerSessionId(userId?: string | null): string {
  if (typeof window === "undefined") return "session_guest";

  if (userId) {
    return `session_user_${userId}`;
  }

  let stored = localStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!stored) {
    stored = `session_guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CUSTOMER_SESSION_KEY, stored);
  }
  return stored;
}

/**
 * Müşteri sohbet geçmişini ve durumunu çeker
 */
export async function fetchCustomerChat(sessionId: string): Promise<{
  session: ChatSessionData | null;
  messages: ChatMessage[];
}> {
  try {
    const res = await fetch(
      `/api/chat?action=get_session&sessionId=${encodeURIComponent(sessionId)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedMessages: ChatMessage[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.sender === "admin" ? "admin" : m.sender === "user" ? "user" : "assistant",
          content: m.content,
          sender_name: m.sender_name,
          created_at: m.created_at,
        }));
        return {
          session: data.session || null,
          messages: mappedMessages,
        };
      }
    }
  } catch (err) {
    console.warn("[fetchCustomerChat] error:", err);
  }
  return { session: null, messages: [] };
}

/**
 * Müşterinin mesaj göndermesi (AI veya Yöneticiye aktarım)
 */
export async function sendCustomerChatMessage(params: {
  sessionId: string;
  userId?: string | null;
  userName?: string;
  userPhone?: string;
  content: string;
  history?: { role: "user" | "assistant"; content: string }[];
  transferRequested?: boolean;
}): Promise<{
  ok: boolean;
  reply?: string;
  status: "bot" | "transferred" | "active_admin" | "closed";
  transferred?: boolean;
  waitingAdmin?: boolean;
  productPreview?: ChatMessage["productPreview"];
  error?: string;
}> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "customer_message",
        sessionId: params.sessionId,
        userId: params.userId || null,
        userName: params.userName || "Müşteri / Bayi",
        userPhone: params.userPhone || "",
        content: params.content,
        messages: params.history || [],
        transferRequested: Boolean(params.transferRequested),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        reply: data.reply,
        status: data.status || "bot",
        transferred: Boolean(data.transferred),
        waitingAdmin: Boolean(data.waitingAdmin),
        productPreview: data.productPreview,
      };
    }
    const errData = await res.json().catch(() => ({}));
    return { ok: false, status: "bot", error: errData.error || "Sunucu hatası" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mesaj gönderilemedi";
    return { ok: false, status: "bot", error: msg };
  }
}

/**
 * Müşteri doğrudan "Temsilciye Bağlan" butonuna bastığında
 */
export async function requestAdminTransfer(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer_to_admin",
        sessionId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------- YÖNETİCİ METOTLARI ---------------------- //

/**
 * Yönetici için tüm oturumları listeler
 */
export async function listAdminChatSessions(): Promise<ChatSessionData[]> {
  try {
    const res = await fetch("/api/chat?action=list_sessions");
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.sessions)) {
        return data.sessions;
      }
    }
  } catch (err) {
    console.warn("[listAdminChatSessions] error:", err);
  }
  return [];
}

/**
 * Yönetici için seçilen oturumun detayını ve mesajlarını çeker
 */
export async function getAdminChatSession(sessionId: string): Promise<{
  session: ChatSessionData | null;
  messages: ChatMessage[];
}> {
  return fetchCustomerChat(sessionId);
}

/**
 * Yönetici müşteriye yanıt gönderir
 */
export async function sendAdminReply(
  sessionId: string,
  adminName: string,
  content: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admin_reply",
        sessionId,
        adminName,
        content,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Yönetici sohbeti sonlandırır
 */
export async function closeAdminChatSession(
  sessionId: string,
  adminName: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close_session",
        sessionId,
        adminName,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
