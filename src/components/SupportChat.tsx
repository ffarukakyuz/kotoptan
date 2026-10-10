import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Camera,
  ShieldCheck,
  CheckCircle2,
  Headphones,
  Bot,
  User,
  Clock,
  CheckCheck,
  Shield,
  Phone,
  ArrowLeft,
  ExternalLink,
  Search,
  MessageSquare,
  AlertCircle,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { analyzeProductPhoto } from "@/lib/gemini";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, type Product } from "@/lib/catalog";
import { saveCustomProduct } from "@/lib/custom-products";
import { isInvalidProductInput } from "@/lib/fmcg-knowledge";
import {
  getOrCreateCustomerSessionId,
  fetchCustomerChat,
  sendCustomerChatMessage,
  requestAdminTransfer,
  listAdminChatSessions,
  getAdminChatSession,
  sendAdminReply,
  closeAdminChatSession,
  sendAiChatMessage,
  type ChatSessionData,
} from "@/lib/chat-service";
import { playCustomerNotificationChime, playAdminAlertChime } from "@/lib/sound-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatState, chatState } from "@/lib/chat-state";
import { CustomerProfileModal } from "@/components/CustomerProfileModal";

type Msg = {
  id?: string;
  role: "user" | "assistant" | "admin";
  sender_name?: string;
  content: string;
  image?: string;
  created_at?: string;
  productPreview?: {
    id: string;
    name: string;
    category: string;
    unit: string;
    description: string;
    image_url?: string | null;
  };
};

/**
 * Sayfa kaydırma işlemini güvenle yürütür (Asla hata fırlatmaz)
 */
function safeScrollToBottom(ref: React.RefObject<HTMLDivElement | null>) {
  if (typeof window === "undefined" || !ref || !ref.current) return;
  try {
    if (typeof ref.current.scrollIntoView === "function") {
      ref.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  } catch {
    try {
      ref.current?.scrollIntoView?.();
    } catch {
      // sessizce geç
    }
  }
}

/**
 * Kullanıcının yüklediği görseli canvas üzerinde sıkıştırıp küçültür
 */
async function compressImage(file: File, maxDim = 1200, quality = 0.8): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("compressImage can only run in browser");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas başlatılamadı");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

function formatMsgTime(iso?: unknown): string {
  if (!iso || typeof iso !== "string") {
    return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function cleanPhoneForWhatsApp(phone?: unknown): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

const ADMIN_QUICK_TEMPLATES = [
  "✅ Siparişinizi aldık, depoda hazırlanıyor.",
  "🚚 Servis aracımız bugün marketinize teslim edecek.",
  "📞 Sizi telefonla arıyoruz, lütfen bekleyin.",
  "💰 Toptan fiyat ve iskonto teyit edildi.",
  "📦 Ürünler depomuzda mevcut, ayrıldı.",
];

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[SupportChat] ErrorBoundary handled chat error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#202c33] p-4 text-xs text-white border border-emerald-500/40 shadow-2xl flex flex-col gap-2 max-w-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Bot className="h-4 w-4" />
            <span>Ko AI Asistan</span>
          </div>
          <p className="text-white/80">Sohbet paneli sıfırlandı. Asistanı açmak için tıklayın.</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                chatState.open("ai");
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white cursor-pointer hover:bg-emerald-500 transition-colors"
            >
              Asistanı Aç
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("kotoptan_ai_chat_session_guest");
                  const keys = Object.keys(localStorage);
                  for (const k of keys) {
                    if (k.startsWith("kotoptan_ai_chat_")) localStorage.removeItem(k);
                  }
                } catch {
                  // ignore
                }
                this.setState({ hasError: false, error: null });
                chatState.open("ai");
              }}
              className="rounded-lg bg-white/10 px-2.5 py-1.5 font-medium text-white/70 cursor-pointer hover:bg-white/20 transition-colors"
            >
              Sıfırla
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SupportChat() {
  return (
    <ChatErrorBoundary>
      <SupportChatInner />
    </ChatErrorBoundary>
  );
}

function SupportChatInner() {
  const { user, isAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const chatStore = useChatState();

  const open = chatStore.isOpen;
  const setOpen = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof val === "function" ? val(chatStore.isOpen) : val;
      if (nextVal) {
        chatStore.open(chatStore.mode);
      } else {
        chatStore.close();
      }
    },
    [chatStore],
  );

  const chatMode = chatStore.mode;
  const setChatMode = useCallback(
    (mode: "ai" | "admin") => {
      chatStore.setMode(mode);
    },
    [chatStore],
  );

  // MÜŞTERİ MODU DURUMLARI
  const [aiMessages, setAiMessages] = useState<Msg[]>([]);
  const [customerAdminMessages, setCustomerAdminMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [, setSelectedFileName] = useState<string>("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // Müşteriye özel benzersiz oturum ID'si
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<
    "bot" | "transferred" | "active_admin" | "closed"
  >("bot");
  const [unreadCustomerAdminCount, setUnreadCustomerAdminCount] = useState<number>(0);

  // YÖNETİCİ MODU DURUMLARI ("Müşteri ile Konuş" WhatsApp Çoklu Müşteri Alanı)
  const [adminSessions, setAdminSessions] = useState<ChatSessionData[]>([]);
  const [adminSelectedSessionId, setAdminSelectedSessionId] = useState<string | null>(null);
  const [adminActiveSession, setAdminActiveSession] = useState<ChatSessionData | null>(null);
  const [adminActiveMessages, setAdminActiveMessages] = useState<Msg[]>([]);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState<"all" | "transferred" | "active">("all");
  const [sendingAdminReply, setSendingAdminReply] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<ChatSessionData | null>(null);

  const [mounted, setMounted] = useState(false);

  const lastKnownAdminMsgIdRef = useRef<string | null>(null);
  const isFirstCustomerCheckRef = useRef<boolean>(true);
  const prevAdminSessionsRef = useRef<Record<string, { updatedAt: string; lastMessage: string }>>(
    {},
  );
  const isFirstAdminLoadRef = useRef<boolean>(true);

  const endRef = useRef<HTMLDivElement>(null);
  const adminMsgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Güvenli mesaj listeleri (asla render hatası vermez)
  const safeAiMessages = useMemo(() => {
    return (aiMessages || []).filter((m): m is Msg =>
      Boolean(m && typeof m === "object" && typeof m.content === "string"),
    );
  }, [aiMessages]);

  const safeCustomerAdminMessages = useMemo(() => {
    return (customerAdminMessages || []).filter((m): m is Msg =>
      Boolean(m && typeof m === "object" && typeof m.content === "string"),
    );
  }, [customerAdminMessages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global "open_support_chat" olayını dinle (harici tetikleyiciler için)
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      try {
        const custom = e as CustomEvent<{ mode?: "ai" | "admin" }>;
        chatStore.open(custom.detail?.mode || "ai");
      } catch {
        chatStore.open("ai");
      }
    };
    window.addEventListener("open_support_chat", handleOpenChat);
    return () => window.removeEventListener("open_support_chat", handleOpenChat);
  }, [chatStore]);

  // Admin durumuna göre başlangıç modunu ayarla (yalnızca ilk yüklemede kapalıyken)
  useEffect(() => {
    if (isAdmin && !chatStore.isOpen && chatStore.mode !== "admin") {
      chatStore.setMode("admin");
    }
  }, [isAdmin, chatStore]);

  // Müşteri Oturum ID'sini hazırla
  useEffect(() => {
    const sId = getOrCreateCustomerSessionId(user?.id);
    setSessionId(sId);
  }, [user?.id]);

  // AI Mesajlarını Yerel Depolamadan Yükle veya Karşılama Mesajı Kur
  useEffect(() => {
    if (!sessionId) return;
    const storageKey = `kotoptan_ai_chat_${sessionId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.filter((m): m is Msg =>
            Boolean(m && typeof m === "object" && typeof m.content === "string"),
          );
          if (sanitized.length > 0) {
            setAiMessages(sanitized);
            return;
          }
        }
      }
    } catch {
      // Devam et
    }

    if (isAdmin) {
      setAiMessages([
        {
          role: "assistant",
          content: `Merhaba Yönetici 👋\nBen Ko, Kotoptan şirket asistanıyım. ⚡\n\nÜrün ekleme ve operasyonlarınızda size yardımcı olmak için buradayım. Bir ürünün fotoğrafını yüklerseniz ürün adını, kategorisini, koli içi adedini ve toptan birimini otomatik analiz edip doğrudan şirket kataloğumuza ekleyebilirim!`,
        },
      ]);
    } else {
      setAiMessages([
        {
          role: "assistant",
          content:
            "Merhaba, ben Ko 👋 Kotoptan toptan asistanıyım.\n\nŞirketimizdeki toptan ürünlerimiz, koli bilgileri ve teslimat süreçleri hakkında bana dilediğinizi sorabilirsiniz.\n\nYetkili yönetici ile doğrudan görüşmek için yukarıdaki '👤 Yönetici ile Konuş' sekmesine geçebilirsiniz.",
        },
      ]);
    }
  }, [sessionId, isAdmin]);

  // AI Mesajları değiştikçe yerel hafızaya kaydet
  useEffect(() => {
    if (!sessionId || aiMessages.length === 0) return;
    try {
      localStorage.setItem(`kotoptan_ai_chat_${sessionId}`, JSON.stringify(aiMessages));
    } catch {
      // Storage dolu
    }
  }, [sessionId, aiMessages]);

  // --- MÜŞTERİ TARAFI: D1 Veritabanından Yönetici Mesajlarını ve Oturum Durumunu Çek ---
  const loadCustomerChatHistory = useCallback(async () => {
    if (!sessionId || isAdmin) return;
    try {
      const data = await fetchCustomerChat(sessionId);
      if (data.session) {
        setSessionStatus(data.session.status);
      }
      if (data.messages && data.messages.length > 0) {
        const mappedAdminMsgs: Msg[] = data.messages
          .filter((m) => m.role === "admin" || m.role === "user")
          .map((m) => ({
            id: m.id,
            role: m.role === "admin" ? "admin" : "user",
            sender_name: m.sender_name,
            content: m.content,
            created_at: m.created_at,
          }));

        const adminReplies = mappedAdminMsgs.filter((m) => m.role === "admin");
        if (adminReplies.length > 0) {
          const latestAdmin = adminReplies[adminReplies.length - 1];
          if (
            !isFirstCustomerCheckRef.current &&
            latestAdmin &&
            latestAdmin.id &&
            latestAdmin.id !== lastKnownAdminMsgIdRef.current
          ) {
            lastKnownAdminMsgIdRef.current = latestAdmin.id;
            playCustomerNotificationChime();
            if (!open || chatMode !== "admin") {
              setUnreadCustomerAdminCount((c) => c + 1);
              toast.info("🔔 Kotoptan Yetkilisinden Yanıt Geldi!", {
                description: latestAdmin.content.slice(0, 90),
              });
            }
          } else if (isFirstCustomerCheckRef.current && latestAdmin) {
            lastKnownAdminMsgIdRef.current = latestAdmin.id || null;
          }
        }
        isFirstCustomerCheckRef.current = false;
        setCustomerAdminMessages(mappedAdminMsgs);
      }
    } catch (e) {
      console.warn("[SupportChat] Error loading customer chat:", e);
    }
  }, [sessionId, isAdmin, open, chatMode]);

  // Müşteri için polling
  useEffect(() => {
    if (!sessionId || isAdmin) return;
    void loadCustomerChatHistory();
    const interval = setInterval(() => {
      void loadCustomerChatHistory();
    }, 3500);
    return () => clearInterval(interval);
  }, [sessionId, isAdmin, loadCustomerChatHistory]);

  // --- YÖNETİCİ TARAFI: Tüm Müşteri Sohbet Oturumlarını Çek ve Canlı Dinle ---
  const loadAdminSessionsList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const sessions = await listAdminChatSessions();
      setAdminSessions(sessions);

      // Yeni müşteri mesajı veya aktarım kontrolü
      if (!isFirstAdminLoadRef.current) {
        let hasNewInquiry = false;
        let incomingSession: ChatSessionData | null = null;

        for (const s of sessions) {
          const prev = prevAdminSessionsRef.current[s.id];
          if (!prev) {
            hasNewInquiry = true;
            incomingSession = s;
            break;
          } else if (
            prev.updatedAt !== s.updated_at &&
            (s.status === "transferred" || s.last_message !== prev.lastMessage)
          ) {
            hasNewInquiry = true;
            incomingSession = s;
            break;
          }
        }

        if (hasNewInquiry && incomingSession) {
          playAdminAlertChime();
          toast.warning(`🔔 Yeni Müşteri Mesajı: ${incomingSession.user_name || "Müşteri"}`, {
            description: incomingSession.last_message || "Yöneticiye mesaj gönderdi",
          });
        }
      }

      const map: Record<string, { updatedAt: string; lastMessage: string }> = {};
      for (const s of sessions) {
        map[s.id] = { updatedAt: s.updated_at, lastMessage: s.last_message };
      }
      prevAdminSessionsRef.current = map;
      isFirstAdminLoadRef.current = false;
    } catch (err) {
      console.warn("[SupportChat] Admin sessions load error:", err);
    }
  }, [isAdmin]);

  // Yönetici seçili oturumun mesajlarını çek
  const loadAdminActiveSessionMessages = useCallback(
    async (sId: string) => {
      if (!isAdmin || !sId) return;
      try {
        const data = await getAdminChatSession(sId);
        setAdminActiveSession(data.session);
        if (data.messages) {
          const mapped: Msg[] = data.messages.map((m) => ({
            id: m.id,
            role: m.role === "admin" ? "admin" : m.role === "user" ? "user" : "assistant",
            sender_name: m.sender_name,
            content: m.content,
            created_at: m.created_at,
          }));
          setAdminActiveMessages(mapped);
        }
      } catch (err) {
        console.warn("[SupportChat] Error loading active session messages:", err);
      }
    },
    [isAdmin],
  );

  // Yönetici için oturum listesini polling ile tazele
  useEffect(() => {
    if (!isAdmin) return;
    void loadAdminSessionsList();
    const interval = setInterval(() => {
      void loadAdminSessionsList();
    }, 3500);
    return () => clearInterval(interval);
  }, [isAdmin, loadAdminSessionsList]);

  // Seçili oturumun mesajlarını polling ile tazele
  useEffect(() => {
    if (!isAdmin || !adminSelectedSessionId) return;
    void loadAdminActiveSessionMessages(adminSelectedSessionId);
    const interval = setInterval(() => {
      void loadAdminActiveSessionMessages(adminSelectedSessionId);
    }, 2500);
    return () => clearInterval(interval);
  }, [isAdmin, adminSelectedSessionId, loadAdminActiveSessionMessages]);

  // Scroll to bottom
  useEffect(() => {
    safeScrollToBottom(endRef);
  }, [aiMessages, customerAdminMessages, open, loading, analyzingImage, chatMode]);

  useEffect(() => {
    safeScrollToBottom(adminMsgEndRef);
  }, [adminActiveMessages, adminSelectedSessionId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir fotoğraf dosyası seçin");
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      setSelectedImage(dataUrl);
      setSelectedFileName(file.name);
      toast.info("Fotoğraf seçildi. Göndermek için gönder butonuna basın.");
    } catch (err) {
      console.error("Görsel okuma hatası:", err);
      toast.error("Fotoğraf işlenemedi, lütfen tekrar deneyin.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Müşteri: Yöneticiye aktar butonuna basıldığında
  const handleCustomerTransferToAdmin = async () => {
    setChatMode("admin");
    setUnreadCustomerAdminCount(0);
    try {
      await requestAdminTransfer(sessionId);
      setSessionStatus("transferred");
      toast.success("Sohbet yöneticiye aktarıldı");
      void loadCustomerChatHistory();
    } catch (e) {
      console.warn("Transfer error:", e);
    }
  };

  // Yönetici: Müşteriye Yanıt Gönder
  const handleAdminSendReply = async () => {
    if (!adminSelectedSessionId || !adminReplyText.trim()) return;
    const text = adminReplyText.trim();
    setAdminReplyText("");
    setSendingAdminReply(true);

    try {
      const ok = await sendAdminReply(
        adminSelectedSessionId,
        profile?.full_name || "Kotoptan Yönetici",
        text,
      );
      if (ok) {
        toast.success("Yanıtınız müşteriye iletildi");
        await loadAdminActiveSessionMessages(adminSelectedSessionId);
        await loadAdminSessionsList();
      } else {
        toast.error("Yanıt gönderilemedi");
        setAdminReplyText(text);
      }
    } catch {
      toast.error("İletişim hatası");
      setAdminReplyText(text);
    } finally {
      setSendingAdminReply(false);
    }
  };

  // Yönetici: Sohbeti Sonlandır
  const handleAdminCloseChat = async () => {
    if (!adminSelectedSessionId) return;
    try {
      const ok = await closeAdminChatSession(
        adminSelectedSessionId,
        profile?.full_name || "Yönetici",
      );
      if (ok) {
        toast.success("Sohbet sonlandırıldı");
        await loadAdminActiveSessionMessages(adminSelectedSessionId);
        await loadAdminSessionsList();
      }
    } catch {
      toast.error("İşlem tamamlanamadı");
    }
  };

  // Müşteri / AI Mesaj Gönderme
  const handleSend = async () => {
    const text = input.trim();
    if (!text && !selectedImage && !pendingImage) return;

    // AI ASİSTAN MODUNDA FOTOĞRAFLI ÜRÜN EKLEME
    if (chatMode === "ai" && (selectedImage || pendingImage)) {
      const currentImg = selectedImage || pendingImage!;
      const promptText =
        text ||
        "Bu toptan ürünün adını, kategorisini, koli/paket içeriğini ve toptan birimini analiz et.";

      setInput("");
      setSelectedImage(null);
      setSelectedFileName("");
      setPendingImage(null);

      setAiMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: text || "📷 Ürün fotoğrafı yüklendi, ürün analizi talep ediliyor.",
          image: currentImg,
        },
      ]);

      setAnalyzingImage(true);

      try {
        const extracted = await analyzeProductPhoto(currentImg, promptText);

        if (isInvalidProductInput(extracted.name) || isInvalidProductInput(extracted.description)) {
          setAiMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Fotoğraftaki ürün net anlaşılamadı. Lütfen ürünün etiketini veya ambalajını daha yakından ve net çekerek tekrar deneyin.",
            },
          ]);
          return;
        }

        const newId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newProduct: Product = {
          id: newId,
          name: extracted.name,
          category: extracted.category,
          unit: extracted.unit,
          description: extracted.description,
          image_url: currentImg,
          is_active: true,
        };

        saveCustomProduct(newProduct);

        try {
          await supabase.from("products").insert({
            id: newProduct.id,
            name: newProduct.name,
            category: newProduct.category,
            unit: newProduct.unit,
            description: newProduct.description,
            image_url: currentImg,
            is_active: true,
          });
        } catch (supabaseErr) {
          console.warn("[SupportChat] Supabase background sync:", supabaseErr);
        }

        void qc.invalidateQueries({ queryKey: ["admin-products"] });
        void qc.invalidateQueries({ queryKey: ["products"] });
        void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
        window.dispatchEvent(new Event("catalog_updated"));

        toast.success(`"${extracted.name}" şirket kataloğumuza eklendi!`);

        setAiMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ Harika! Ürünü analiz ettim, kategori ve toptan koli içi bilgilerini belirleyerek şirket kataloğumuza ekledim:\n\n📦 **${extracted.name}**\n📂 Kategori: **${categoryLabel(extracted.category)}**\n⚖️ Toptan Birim: **${extracted.unit}**\n📝 Koli / Paket Bilgisi: **${extracted.description}**\n\nÜrün şu anda şirket toptan vitrinimizde ve yönetim panelinde canlı yayında!`,
            productPreview: {
              id: newId,
              name: extracted.name,
              category: extracted.category,
              unit: extracted.unit,
              description: extracted.description,
              image_url: currentImg,
            },
          },
        ]);
      } catch (err) {
        console.error("Photo analysis error:", err);
        setAiMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Fotoğraftaki ürünü incelerken bir aksaklık oldu. Lütfen ürünün etiket ve ambalajını daha net gösteren bir fotoğraf çekip tekrar deneyin.",
          },
        ]);
      } finally {
        setAnalyzingImage(false);
      }
      return;
    }

    if (!text) return;

    // MÜŞTERİ HESABINDA: YÖNETİCİ İLE KONUŞ MODU
    if (!isAdmin && chatMode === "admin") {
      setInput("");
      const userMsg: Msg = {
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setCustomerAdminMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await sendCustomerChatMessage({
          sessionId,
          userId: user?.id,
          userName:
            profile?.full_name ||
            profile?.business_name ||
            user?.email?.split("@")[0] ||
            "Müşteri / Bayi",
          userPhone: profile?.phone || "",
          content: text,
          transferRequested: true,
        });

        if (res.ok) {
          setSessionStatus(res.status);
          toast.success("Mesajınız şirket yönetimine iletildi");
        } else {
          toast.error("Mesaj iletilemedi, lütfen tekrar deneyin.");
        }
      } catch (err) {
        console.error("[SupportChat] Admin send error:", err);
        toast.error("Bağlantı hatası");
      } finally {
        setLoading(false);
      }
      return;
    }

    // AI ASİSTAN İLE KONUŞ MODU (Yöneticiye bildirim gitmez, oturum kuyruğuna yazılmaz)
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setAiMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...aiMessages, userMsg].slice(-12).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

      const res = await sendAiChatMessage({
        content: text,
        history,
        isAdmin,
        userMeta: {
          fullName: profile?.full_name || user?.email?.split("@")[0],
          businessName: profile?.business_name,
          phone: profile?.phone,
        },
      });

      if (res.ok && res.reply) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.reply,
          },
        ]);
      } else {
        throw new Error(res.error || "Yanıt alınamadı");
      }
    } catch (chatError) {
      console.error("[SupportChat] AI chat error:", chatError);
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Yapay zeka asistanı şu anda yanıt veremedi. Dilerseniz hemen yukarıdaki sekmeden doğrudan şirket yöneticimizle canlı görüşebilirsiniz.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  // Yönetici: Bekleyen toplam müşteri mesajı sayısı
  const adminWaitingCount = adminSessions.filter((s) => s.status === "transferred").length;

  // Filtrelenmiş Yönetici Müşteri Listesi
  const filteredAdminSessions = adminSessions.filter((s) => {
    if (adminFilter === "transferred" && s.status !== "transferred") return false;
    if (adminFilter === "active" && s.status !== "active_admin") return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      const matchName = (s.user_name || "").toLowerCase().includes(q);
      const matchPhone = (s.user_phone || "").toLowerCase().includes(q);
      const matchMsg = (s.last_message || "").toLowerCase().includes(q);
      return matchName || matchPhone || matchMsg;
    }
    return true;
  });

  const isCustomerTransferred = sessionStatus === "transferred";
  const isCustomerActiveAdmin = sessionStatus === "active_admin";

  if (!mounted) {
    return null;
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[38rem] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b141a] shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all">
          {/* HEADER: WHATSAPP YEŞİL / KOYU TEMA BAŞLIK */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-white/10 text-white transition-colors">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm shadow">
                {isAdmin ? (
                  chatMode === "admin" ? (
                    <Users className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Bot className="h-5 w-5 text-emerald-400" />
                  )
                ) : chatMode === "admin" ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Bot className="h-5 w-5 text-emerald-400" />
                )}
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#202c33] animate-pulse" />
            </div>

            <div className="leading-tight flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate text-white">
                  {isAdmin
                    ? chatMode === "admin"
                      ? adminSelectedSessionId && adminActiveSession
                        ? `${adminActiveSession.user_name || "Müşteri"}`
                        : "Müşteri Mesajlaşma Merkezi"
                      : "Ko Asistan (Ürün & Firma)"
                    : chatMode === "admin"
                      ? "Kotoptan Yetkili Yönetici"
                      : "Ko Depo Asistanı"}
                </p>
                {isAdmin &&
                  chatMode === "admin" &&
                  adminWaitingCount > 0 &&
                  !adminSelectedSessionId && (
                    <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-500/40 animate-pulse">
                      {adminWaitingCount} Bekliyor
                    </span>
                  )}
                {!isAdmin && chatMode === "admin" && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                      isCustomerActiveAdmin
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {isCustomerActiveAdmin ? "Canlı" : "Bekleniyor"}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 truncate mt-0.5">
                {isAdmin
                  ? chatMode === "admin"
                    ? adminSelectedSessionId && adminActiveSession
                      ? adminActiveSession.user_phone || "Gelen Müşteri Mesajı"
                      : `${adminSessions.length} Kayıtlı Müşteri Sohbeti`
                    : "197 toptan ürün danışmanı & Görsel analiz"
                  : chatMode === "admin"
                    ? isCustomerActiveAdmin
                      ? "Yönetici sizinle canlı hatta"
                      : isCustomerTransferred
                        ? "Yetkili yanıtı bekleniyor..."
                        : "Tatvan Depo Yönetimi"
                    : "çevrimiçi • 197 çeşit toptan ürün danışmanı"}
              </p>
            </div>

            <button
              onClick={() => setOpen(false)}
              aria-label="Sohbeti kapat"
              className="ml-auto rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* İKİ AYRI BÖLÜM BUTONU */}
          <div className="grid grid-cols-2 p-1.5 bg-[#111b21] border-b border-white/10 gap-1.5">
            {isAdmin ? (
              <>
                {/* YÖNETİCİ HESABI: 1. SEKME: "MÜŞTERİ İLE KONUŞ" */}
                <button
                  type="button"
                  onClick={() => setChatMode("admin")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                    chatMode === "admin"
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40"
                      : "bg-white/10 text-emerald-100 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Headphones className="h-4 w-4 text-white" />
                  <span>Müşteri ile Konuş</span>
                  {adminWaitingCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white animate-pulse">
                      {adminWaitingCount}
                    </span>
                  )}
                </button>

                {/* YÖNETİCİ HESABI: 2. SEKME: "AI ASİSTAN" */}
                <button
                  type="button"
                  onClick={() => setChatMode("ai")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    chatMode === "ai"
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40"
                      : "bg-white/10 text-emerald-100 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Bot className="h-4 w-4 text-emerald-300" />
                  <span>Ko AI Asistan</span>
                </button>
              </>
            ) : (
              <>
                {/* MÜŞTERİ HESABI: 1. SEKME: "AI ASİSTAN" */}
                <button
                  type="button"
                  onClick={() => setChatMode("ai")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    chatMode === "ai"
                      ? "bg-emerald-700 text-white shadow-md ring-1 ring-emerald-500/50"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Bot className="h-4 w-4 text-emerald-300" />
                  <span>AI Asistan</span>
                </button>

                {/* MÜŞTERİ HESABI: 2. SEKME: "YÖNETİCİ İLE KONUŞ" */}
                <button
                  type="button"
                  onClick={() => {
                    setChatMode("admin");
                    setUnreadCustomerAdminCount(0);
                    if (sessionStatus === "bot") {
                      void handleCustomerTransferToAdmin();
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                    chatMode === "admin"
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40"
                      : "bg-white/10 text-emerald-100 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Headphones className="h-4 w-4 text-emerald-300" />
                  <span>Yönetici ile Konuş</span>
                  {unreadCustomerAdminCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white animate-pulse">
                      {unreadCustomerAdminCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* YÖNETİCİ MODU: "MÜŞTERİ İLE KONUŞ" (WHATSAPP ÇOKLU MÜŞTERİ MESAJ ALANI) */}
          {/* ========================================================================= */}
          {isAdmin && chatMode === "admin" ? (
            adminSelectedSessionId && adminActiveSession ? (
              /* --- 1. SEÇİLİ MÜŞTERİNİN WHATSAPP SOHBET EKRANI --- */
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0b141a]">
                {/* Müşteri Sohbet Üst Barı */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#182229] border-b border-white/10 text-white text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setAdminSelectedSessionId(null)}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer py-1 pr-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileModalTarget(adminActiveSession)}
                      className="flex items-center gap-1.5 truncate text-left group cursor-pointer"
                      title="Müşteri ve bölge bilgilerini görüntüle"
                    >
                      <span className="font-bold text-white group-hover:text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 truncate">
                        {adminActiveSession.user_name || "Müşteri / Bayi"}
                      </span>
                      <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                        Üye Detayı
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {adminActiveSession.user_phone && (
                      <a
                        href={`https://wa.me/90${cleanPhoneForWhatsApp(adminActiveSession.user_phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-300 font-semibold"
                        title="Doğrudan WhatsApp'ta Aç"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>WhatsApp</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {adminActiveSession.status !== "closed" && (
                      <button
                        type="button"
                        onClick={handleAdminCloseChat}
                        className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 rounded px-2 py-1 bg-red-950/40 cursor-pointer"
                      >
                        Sonlandır
                      </button>
                    )}
                  </div>
                </div>

                {/* Mesaj Akışı (WhatsApp Arka Plan) */}
                <div className="flex-1 space-y-3 overflow-y-auto p-3.5 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                  {adminActiveMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-white/40">
                      Bu müşteriden henüz mesaj gelmedi.
                    </div>
                  ) : (
                    adminActiveMessages.map((m, idx) => {
                      const isCustomer = m.role === "user";
                      const isAdminReply = m.role === "admin";

                      return (
                        <div
                          key={m.id || idx}
                          className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-white/50 mb-1 px-1">
                            {isCustomer ? (
                              <>
                                <User className="h-2.5 w-2.5 text-emerald-400" />
                                <span className="font-semibold text-emerald-300">
                                  {m.sender_name || "Müşteri"}
                                </span>
                              </>
                            ) : isAdminReply ? (
                              <>
                                <Shield className="h-2.5 w-2.5 text-emerald-400" />
                                <span className="font-bold text-emerald-300">
                                  {m.sender_name || "Yönetici"}
                                </span>
                              </>
                            ) : (
                              <>
                                <Bot className="h-2.5 w-2.5 text-sky-400" />
                                <span className="text-sky-300">Ko AI Asistan</span>
                              </>
                            )}
                          </div>

                          <div
                            className={
                              isCustomer
                                ? "max-w-[85%] rounded-2xl rounded-tl-xs bg-[#202c33] text-[#e9edef] px-3.5 py-2 text-xs sm:text-sm shadow-sm border border-white/10 leading-relaxed"
                                : isAdminReply
                                  ? "max-w-[85%] rounded-2xl rounded-tr-xs bg-[#005c4b] text-[#e9edef] px-3.5 py-2 text-xs sm:text-sm shadow-sm border border-emerald-600/30 leading-relaxed"
                                  : "max-w-[85%] rounded-2xl rounded-tl-xs bg-[#182229] text-sky-100 px-3.5 py-2 text-xs sm:text-sm shadow-sm border border-sky-500/30 leading-relaxed"
                            }
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>

                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono ${
                                isAdminReply ? "text-emerald-200/70" : "text-white/40"
                              }`}
                            >
                              <span>{formatMsgTime(m.created_at)}</span>
                              {isAdminReply && <CheckCheck className="h-3 w-3 text-sky-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={adminMsgEndRef} />
                </div>

                {/* Hızlı Yanıt Şablonları */}
                <div className="border-t border-white/10 bg-[#111b21] px-2 py-1 flex gap-1.5 overflow-x-auto no-scrollbar items-center">
                  {ADMIN_QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAdminReplyText(tmpl)}
                      className="shrink-0 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {tmpl.split(" ")[0]} {tmpl.slice(tmpl.indexOf(" ") + 1, 32)}...
                    </button>
                  ))}
                </div>

                {/* Yönetici Yanıt Yazma Formu */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdminSendReply();
                  }}
                  className="flex items-center gap-2 border-t border-white/10 bg-[#202c33] p-2.5"
                >
                  <Input
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder="Müşteriye doğrudan yanıt yazın..."
                    className="h-9 flex-1 text-xs sm:text-sm bg-[#2a3942] border-0 text-white placeholder:text-white/40 rounded-full px-4 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sendingAdminReply || !adminReplyText.trim()}
                    className="h-9 w-9 shrink-0 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white cursor-pointer shadow-md disabled:opacity-50 transition-colors"
                  >
                    {sendingAdminReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              /* --- 2. YÖNETİCİ MÜŞTERİ LİSTESİ (WHATSAPP SOHBETLER LİSTESİ) --- */
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0b141a]">
                {/* Arama ve Filtreleme */}
                <div className="p-2.5 bg-[#111b21] border-b border-white/10 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                    <Input
                      placeholder="Müşteri adı, telefon veya mesaj ara..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="h-8 pl-8 text-xs bg-[#202c33] border-white/10 text-white placeholder:text-white/40 rounded-xl"
                    />
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAdminFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        adminFilter === "all"
                          ? "bg-emerald-600 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      Tümü ({adminSessions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminFilter("transferred")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        adminFilter === "transferred"
                          ? "bg-amber-500 text-black font-extrabold"
                          : "bg-white/5 text-amber-300 hover:bg-white/10"
                      }`}
                    >
                      <span>Bekleyenler</span>
                      {adminWaitingCount > 0 && <span>({adminWaitingCount})</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminFilter("active")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        adminFilter === "active"
                          ? "bg-emerald-700 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      Aktif
                    </button>
                  </div>
                </div>

                {/* Müşteri Sohbet Kartları */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {filteredAdminSessions.length === 0 ? (
                    <div className="py-16 text-center text-xs text-white/40">
                      <AlertCircle className="mx-auto mb-2 h-7 w-7 text-white/30" />
                      Henüz eşleşen müşteri mesajı yok
                    </div>
                  ) : (
                    filteredAdminSessions.map((s) => {
                      const isWaiting = s.status === "transferred";
                      const isActive = s.status === "active_admin";

                      return (
                        <div
                          key={s.id}
                          onClick={() => setAdminSelectedSessionId(s.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isWaiting
                              ? "bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/50"
                              : "bg-[#182229]/60 border-white/5 hover:bg-[#202c33] hover:border-white/15"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                                {s.user_name ? s.user_name.charAt(0).toUpperCase() : "M"}
                              </div>
                              <span className="font-bold text-xs text-white truncate">
                                {s.user_name || "Müşteri / Bayi"}
                              </span>
                            </div>

                            {isWaiting && (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                                BEKLİYOR
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                                Aktif
                              </span>
                            )}
                          </div>

                          {s.user_phone && (
                            <p className="text-[11px] text-white/60 flex items-center gap-1 mb-1 font-mono">
                              <Phone className="h-2.5 w-2.5 text-white/40" />
                              {s.user_phone}
                            </p>
                          )}

                          <p className="text-xs text-white/80 line-clamp-2 leading-relaxed bg-black/20 p-1.5 rounded-lg border border-white/5">
                            {s.last_message || "Mesaj yok"}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-white/40 mt-1.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {formatMsgTime(s.updated_at)}
                            </span>
                            <span className="text-emerald-400 font-semibold hover:underline">
                              Mesajı Aç →
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )
          ) : (
            /* ========================================================================= */
            /* MÜŞTERİ HESABI VEYA YÖNETİCİ AI ASİSTAN MODU                              */
            /* ========================================================================= */
            <>
              {/* Müşteri modunda "Yönetici ile Konuş" durumu */}
              {!isAdmin && chatMode === "admin" && (
                <div className="border-b border-white/10 bg-[#182229] px-3 py-1.5 text-[11px] text-emerald-300/90 flex items-center justify-between">
                  {isCustomerActiveAdmin ? (
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>Yetkili yönetici canlı hatta • Doğrudan yazışıyorsunuz</span>
                    </div>
                  ) : isCustomerTransferred ? (
                    <div className="flex items-center gap-1.5 font-medium text-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      <span>Yöneticiye iletildi • KasımOğulları yetkilisi bekleniyor...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-medium text-white/70">
                      <Clock className="h-3.5 w-3.5 text-white/50 shrink-0" />
                      <span>Mesajınız doğrudan yönetim havuzuna iletilir.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mesaj Akışı */}
              <div className="flex-1 space-y-3 overflow-y-auto p-3.5 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                {!isAdmin && chatMode === "admin" && safeCustomerAdminMessages.length === 0 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-[#182229] p-3.5 text-xs text-white/90 leading-relaxed shadow-sm">
                    <p className="font-bold mb-1.5 flex items-center gap-1.5 text-emerald-300">
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      KasımOğulları Yönetici Canlı Destek
                    </p>
                    <p className="text-white/70 leading-relaxed">
                      Tatvan depomuzdaki yetkili yöneticimize doğrudan mesaj gönderebilirsiniz.
                      Mesajınız anında yönetim paneline iletilir ve yetkili yönetici canlı yanıt
                      verir.
                    </p>
                  </div>
                )}

                {(chatMode === "ai" ? safeAiMessages : safeCustomerAdminMessages).map((m, i) => {
                  const isUser = m.role === "user";
                  const isAdminReply = m.role === "admin";

                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1 text-[10px] text-white/50 mb-1 px-1">
                          {isAdminReply ? (
                            <>
                              <Shield className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="font-bold text-emerald-300">
                                {m.sender_name || "Yetkili Yönetici"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Bot className="h-2.5 w-2.5 text-sky-400" />
                              <span className="font-semibold text-sky-300">Ko AI Asistan</span>
                            </>
                          )}
                        </div>
                      )}

                      <div
                        className={
                          isUser
                            ? "max-w-[85%] rounded-2xl rounded-tr-xs bg-[#005c4b] text-[#e9edef] px-3.5 py-2.5 text-xs sm:text-sm shadow-sm border border-emerald-600/30 leading-relaxed"
                            : isAdminReply
                              ? "max-w-[88%] rounded-2xl rounded-tl-xs bg-[#202c33] text-[#e9edef] px-3.5 py-2.5 text-xs sm:text-sm shadow-sm border border-white/10 leading-relaxed"
                              : "max-w-[88%] rounded-2xl rounded-tl-xs bg-[#202c33] text-[#e9edef] px-3.5 py-2.5 text-xs sm:text-sm shadow-sm border border-sky-500/30 leading-relaxed"
                        }
                      >
                        {m.image && (
                          <div className="mb-2 overflow-hidden rounded-xl border border-black/20">
                            <img
                              src={m.image}
                              alt="Yüklenen görsel"
                              className="max-h-48 w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{m.content}</div>

                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono ${
                            isUser ? "text-emerald-200/70" : "text-white/40"
                          }`}
                        >
                          <span>{formatMsgTime(m.created_at)}</span>
                          {isUser && <CheckCheck className="h-3 w-3 text-sky-400" />}
                        </div>

                        {m.productPreview &&
                          typeof m.productPreview === "object" &&
                          Boolean(m.productPreview.name) && (
                            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-[#182229] p-3 text-white">
                              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                <span>Kataloğa Eklendi</span>
                              </div>
                              <p className="font-extrabold text-sm text-white">
                                {m.productPreview.name}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                                <span className="rounded bg-black/40 px-2 py-0.5 font-semibold text-emerald-300 border border-emerald-500/30">
                                  {categoryLabel(m.productPreview.category || "")}
                                </span>
                                <span className="rounded bg-black/40 px-2 py-0.5 font-semibold text-white/80 border border-white/10">
                                  {m.productPreview.unit || "Adet"}
                                </span>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                                <a
                                  href={`/urun/${m.productPreview.id || ""}`}
                                  onClick={() => setOpen(false)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer"
                                >
                                  <span>Ürünü Vitrinde İncele / Sipariş Ver</span>
                                </a>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}

                {analyzingImage && (
                  <div className="mr-auto flex items-center gap-2.5 rounded-2xl bg-[#202c33] border border-emerald-500/30 px-3.5 py-2.5 text-xs font-medium text-emerald-300 shadow-sm animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Fotoğraf yapay zeka ile taranıyor ve ürün kataloğa ekleniyor...</span>
                  </div>
                )}

                {loading && !analyzingImage && (
                  <div className="mr-auto flex items-center gap-2 rounded-2xl bg-[#202c33] border border-white/10 px-3 py-2 text-xs text-white/60 shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    <span>{chatMode === "admin" ? "İletiliyor..." : "Ko yazıyor..."}</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Hızlı Öneriler & Yöneticiye Aktar Butonu (AI Modu) */}
              {chatMode === "ai" && (
                <div className="border-t border-white/10 bg-[#111b21] px-2 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar items-center">
                  {!isAdmin && (
                    <button
                      type="button"
                      onClick={handleCustomerTransferToAdmin}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer"
                    >
                      <Headphones className="h-3 w-3 text-emerald-400" />
                      <span>Yöneticiye Bağlan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handlePromptClick("Şirketinizde hangi toptan ürünler var?")}
                    className="shrink-0 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors cursor-pointer"
                  >
                    📦 Hangi ürünler var?
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick("Teslimat hangi ilçelere yapılıyor?")}
                    className="shrink-0 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors cursor-pointer"
                  >
                    🚚 Teslimat Bölgeleri
                  </button>
                </div>
              )}

              {/* Seçili Fotoğraf Çipi */}
              {selectedImage && chatMode === "ai" && (
                <div className="bg-[#182229] border-t border-white/10 px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedImage}
                      alt="Önizleme"
                      className="h-8 w-8 rounded-lg object-cover border border-emerald-500/40"
                    />
                    <span className="text-xs font-semibold text-emerald-300">
                      Fotoğraf eklendi (Otomatik ürün analizi)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Kaldır
                  </button>
                </div>
              )}

              {/* Müşteri / AI Giriş Formu */}
              <form
                className="flex items-center gap-2 border-t border-white/10 bg-[#202c33] p-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                {chatMode === "ai" && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      title="Fotoğraf yükle ve yapay zeka ile kataloğa ekle"
                      className="h-9 w-9 shrink-0 rounded-full cursor-pointer text-emerald-400 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </>
                )}

                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedImage
                      ? "İsteğe bağlı bir not yazın..."
                      : !isAdmin && chatMode === "admin"
                        ? "Yöneticiye doğrudan mesajınızı yazın..."
                        : "Ko'ya toptan ürünler veya teslimat hakkında sorun..."
                  }
                  className="h-9 flex-1 text-xs sm:text-sm bg-[#2a3942] border-0 text-white placeholder:text-white/40 rounded-full px-4 focus-visible:ring-1 focus-visible:ring-emerald-500"
                />

                <Button
                  type="submit"
                  size="icon"
                  disabled={loading || analyzingImage || (!input.trim() && !selectedImage)}
                  className="h-9 w-9 shrink-0 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white cursor-pointer shadow-md disabled:opacity-50 transition-colors"
                >
                  {loading || analyzingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      )}

      {/* SAĞ ALTTTAKİ YÜZEN BUTON (WHATSAPP YEŞİLİ) */}
      <button
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              setUnreadCustomerAdminCount(0);
            }
            return next;
          });
        }}
        aria-label={isAdmin ? "Müşteri ile Konuş" : "Canlı Destek ve AI Asistanı"}
        title={isAdmin ? "Müşteri ile Konuş (Canlı Destek)" : "Canlı Destek ve AI Asistanı"}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/50 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-[#060b08]/80 group ${
          (isAdmin && adminWaitingCount > 0) || (!isAdmin && unreadCustomerAdminCount > 0)
            ? "animate-chat-shake ring-4 ring-emerald-400"
            : ""
        }`}
      >
        <MessageCircle className="h-7 w-7 transition-transform group-hover:rotate-12" />

        {/* YÖNETİCİ İÇİN BEKLEYEN MÜŞTERİ BİLDİRİMİ */}
        {isAdmin && adminWaitingCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-600 text-white font-extrabold text-[11px] shadow-lg animate-pulse ring-2 ring-white">
            {adminWaitingCount}
          </span>
        )}

        {/* MÜŞTERİ İÇİN YÖNETİCİ YANITI BİLDİRİMİ */}
        {!isAdmin && unreadCustomerAdminCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-600 text-white font-extrabold text-[11px] shadow-lg animate-pulse ring-2 ring-white">
            {unreadCustomerAdminCount}
          </span>
        )}
      </button>
    </>
  );
}
