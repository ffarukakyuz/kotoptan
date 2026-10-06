import { useEffect, useRef, useState, useCallback } from "react";
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
  Sparkles,
  CheckCheck,
  Shield,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { analyzeProductPhoto } from "@/lib/gemini";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/catalog";
import { saveCustomProduct } from "@/lib/custom-products";
import { isInvalidProductInput } from "@/lib/fmcg-knowledge";
import {
  getOrCreateCustomerSessionId,
  fetchCustomerChat,
  sendCustomerChatMessage,
  requestAdminTransfer,
} from "@/lib/chat-service";
import { playCustomerNotificationChime } from "@/lib/sound-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function formatMsgTime(iso?: string) {
  if (!iso) {
    return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function SupportChat() {
  const { user, isAdmin, profile } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  // İki AYRI mod: "ai" (AI Asistan ile Konuş) ve "admin" (Yönetici ile Konuş)
  const [chatMode, setChatMode] = useState<"ai" | "admin">("ai");

  // AI Asistan Mesajları (Yerel + AI etkileşimi)
  const [aiMessages, setAiMessages] = useState<Msg[]>([]);

  // Yönetici Mesajları (Doğrudan D1 veritabanı ile senkron)
  const [adminMessages, setAdminMessages] = useState<Msg[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // Müşteriye özel benzersiz oturum ID'si
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<
    "bot" | "transferred" | "active_admin" | "closed"
  >("bot");
  const [unreadAdminCount, setUnreadAdminCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  const lastKnownAdminMsgIdRef = useRef<string | null>(null);
  const isFirstCheckRef = useRef<boolean>(true);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Oturum ID'sini hazırla
  useEffect(() => {
    const sId = getOrCreateCustomerSessionId(user?.id);
    setSessionId(sId);
  }, [user?.id]);

  // AI Mesajlarını Yerel Depolamadan Yükle veya Karşılama Mesajı Kur
  useEffect(() => {
    if (!sessionId) return;
    const storageKey = `kasimogullari_ai_chat_${sessionId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAiMessages(parsed);
          return;
        }
      }
    } catch {
      // LocalStorage hatası olursa devam et
    }

    // İlk Karşılama Mesajı
    if (isAdmin) {
      setAiMessages([
        {
          role: "assistant",
          content: `Merhaba Yönetici 👋\nBen Ko, KasımOğulları Tatvan şirket asistanıyım. ⚡\n\nÜrün ekleme ve firma operasyonlarınızda size yardımcı olmak için buradayım. Bir ürünün fotoğrafını yüklerseniz ürün adını, kategorisini, koli içi adedini ve toptan birimini otomatik analiz edip şirket kataloğumuza ekleyebilirim!`,
        },
      ]);
    } else {
      setAiMessages([
        {
          role: "assistant",
          content:
            "Merhaba, ben Ko 👋 KasımOğulları Tatvan toptan asistanıyım.\n\nŞirketimizdeki 197 çeşit toptan ürünümüz, koli bilgileri ve teslimat süreçleri hakkında bana dilediğinizi sorabilirsiniz.\n\nYetkili yönetici ile doğrudan görüşmek için yukarıdaki '👤 Yönetici ile Konuş' sekmesine geçebilirsiniz.",
        },
      ]);
    }
  }, [sessionId, isAdmin]);

  // AI Mesajları değiştikçe yerel hafızaya kaydet
  useEffect(() => {
    if (!sessionId || aiMessages.length === 0) return;
    try {
      localStorage.setItem(`kasimogullari_ai_chat_${sessionId}`, JSON.stringify(aiMessages));
    } catch {
      // Storage dolu veya kısıtlı
    }
  }, [sessionId, aiMessages]);

  // D1 Veritabanından Yönetici Mesajlarını ve Oturum Durumunu Çek
  const loadAdminChatHistory = useCallback(async () => {
    if (!sessionId) return;
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

        // Yeni yönetici yanıtı kontrolü ve bildirim zili
        const adminReplies = mappedAdminMsgs.filter((m) => m.role === "admin");
        if (adminReplies.length > 0) {
          const latestAdmin = adminReplies[adminReplies.length - 1];
          if (
            !isFirstCheckRef.current &&
            latestAdmin.id &&
            latestAdmin.id !== lastKnownAdminMsgIdRef.current
          ) {
            lastKnownAdminMsgIdRef.current = latestAdmin.id;
            playCustomerNotificationChime();
            if (!open || chatMode !== "admin") {
              setUnreadAdminCount((c) => c + 1);
              toast.info("🔔 KasımOğulları Yetkilisinden Yanıt Geldi!", {
                description: latestAdmin.content.slice(0, 90),
              });
            }
          } else if (isFirstCheckRef.current) {
            lastKnownAdminMsgIdRef.current = latestAdmin.id || null;
          }
        }
        isFirstCheckRef.current = false;
        setAdminMessages(mappedAdminMsgs);
      }
    } catch (e) {
      console.warn("[SupportChat] Error loading admin chat history:", e);
    }
  }, [sessionId, open, chatMode]);

  // Panel açıldığında yönetici geçmişini çek
  useEffect(() => {
    if (open && sessionId) {
      void loadAdminChatHistory();
    }
  }, [open, sessionId, loadAdminChatHistory]);

  // D1 Anlık Mesaj Kontrolü (Polling: her 3.5 saniyede bir)
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      void loadAdminChatHistory();
    }, 3500);

    return () => clearInterval(interval);
  }, [sessionId, loadAdminChatHistory]);

  // Mesaj listesi değişince en alta kaydır
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [aiMessages, adminMessages, open, loading, analyzingImage, chatMode]);

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

  // Yöneticiye aktar butonuna basıldığında
  const handleTransferToAdmin = async () => {
    setChatMode("admin");
    setUnreadAdminCount(0);
    try {
      await requestAdminTransfer(sessionId);
      setSessionStatus("transferred");
      toast.success("Sohbet yöneticiye aktarıldı");
      void loadAdminChatHistory();
    } catch (e) {
      console.warn("Transfer error:", e);
    }
  };

  // MESAJ GÖNDERME İŞLEMİ
  const handleSend = async () => {
    const text = input.trim();
    if (!text && !selectedImage && !pendingImage) return;

    // --- DURUM 1: AI ASİSTAN MODUNDA FOTOĞRAFLI ÜRÜN EKLEME ---
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

    // --- DURUM 2: YÖNETİCİ İLE KONUŞ MODU (CANLI DESTEK) ---
    if (chatMode === "admin") {
      setInput("");
      const userMsg: Msg = {
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setAdminMessages((prev) => [...prev, userMsg]);
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

    // --- DURUM 3: AI ASİSTAN İLE KONUŞ MODU (YAPAY ZEKA) ---
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setAiMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...aiMessages, userMsg].slice(-12).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

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
        history,
        transferRequested: false,
      });

      if (res.ok) {
        if (res.transferred) {
          // Kullanıcı metinde temsilciye bağlanmak istemiş
          setChatMode("admin");
          setSessionStatus("transferred");
          setAdminMessages((prev) => [
            ...prev,
            {
              role: "user",
              content: text,
              created_at: new Date().toISOString(),
            },
          ]);
          toast.info("Talebiniz üzerine Yönetici Canlı Destek sekmesine aktarıldınız.");
        } else if (res.reply) {
          setAiMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.reply,
              productPreview: res.productPreview,
            },
          ]);
        }
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
            "Yapay zeka asistanı şu anda yanıt veremedi. Dilerseniz hemen yukarıdaki '👤 Yönetici ile Konuş' sekmesine geçerek doğrudan şirket yöneticimizle görüşebilirsiniz.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  const isTransferred = sessionStatus === "transferred";
  const isActiveAdmin = sessionStatus === "active_admin";
  const isClosed = sessionStatus === "closed";

  if (!mounted) {
    return null;
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[36rem] w-[min(27rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b141a] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {/* HEADER: WHATSAPP YEŞİL / KOYU TEMA BAŞLIK */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-white/10 text-white transition-colors">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm shadow">
                {chatMode === "admin" ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Bot className="h-5 w-5 text-emerald-400" />
                )}
              </div>
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-[#202c33] ${
                  chatMode === "admin"
                    ? isTransferred
                      ? "bg-amber-400 animate-ping"
                      : "bg-emerald-400"
                    : "bg-emerald-400 animate-pulse"
                }`}
              />
            </div>

            <div className="leading-tight flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate text-white">
                  {chatMode === "admin" ? "KasımOğulları Yetkili Yönetici" : "Ko Depo Asistanı"}
                </p>
                {chatMode === "admin" ? (
                  isActiveAdmin ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Canlı
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                      Bekleniyor
                    </span>
                  )
                ) : (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                    AI Asistan
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 truncate mt-0.5">
                {chatMode === "admin"
                  ? isActiveAdmin
                    ? "Yönetici sizinle canlı yazışıyor"
                    : isTransferred
                      ? "Yetkili yanıtı bekleniyor..."
                      : "çevrimiçi • Tatvan Depo"
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

          {/* İKİ AYRI BÖLÜM: AI ASİSTAN İLE KONUŞ vs YÖNETİCİ İLE KONUŞ */}
          <div className="grid grid-cols-2 p-1.5 bg-[#111b21] border-b border-white/10 gap-1.5">
            {/* 1. BÖLÜM: AI ASİSTAN İLE KONUŞ */}
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

            {/* 2. BÖLÜM: YÖNETİCİ İLE KONUŞ */}
            <button
              type="button"
              onClick={() => {
                setChatMode("admin");
                setUnreadAdminCount(0);
                if (sessionStatus === "bot") {
                  void handleTransferToAdmin();
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                chatMode === "admin"
                  ? "bg-[#00a884] text-white shadow-md ring-1 ring-emerald-400/50"
                  : "bg-white/5 text-emerald-300 hover:bg-emerald-950/40 hover:text-white"
              }`}
            >
              <Headphones className="h-4 w-4 text-emerald-300" />
              <span>Yönetici ile Konuş</span>
              {unreadAdminCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white animate-pulse">
                  {unreadAdminCount}
                </span>
              )}
            </button>
          </div>

          {/* YÖNETİCİ MODUNDA DURUM BİLGİLENDİRME ŞERİDİ */}
          {chatMode === "admin" && (
            <div className="border-b border-white/10 bg-[#182229] px-3 py-1.5 text-[11px] text-emerald-300/90 flex items-center justify-between">
              {isActiveAdmin ? (
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Yetkili yönetici canlı hatta • Doğrudan yazışıyorsunuz</span>
                </div>
              ) : isTransferred ? (
                <div className="flex items-center gap-1.5 font-medium text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>Yöneticiye aktarıldı • KasımOğulları yetkilisi bekleniyor...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-medium text-white/70">
                  <Clock className="h-3.5 w-3.5 text-white/50 shrink-0" />
                  <span>Mesajınız doğrudan yönetim havuzuna iletilir.</span>
                </div>
              )}
            </div>
          )}

          {/* MESAJLAR ALANI: WHATSAPP ARKA PLANI */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
            {/* YÖNETİCİ MODUNDA BOŞ MESAJ KUTUSU GİRİŞ BİLGİSİ */}
            {chatMode === "admin" && adminMessages.length === 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-[#182229] p-3.5 text-xs text-white/90 leading-relaxed shadow-sm">
                <p className="font-bold mb-1.5 flex items-center gap-1.5 text-emerald-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  KasımOğulları Yönetici Canlı Destek
                </p>
                <p className="text-white/70 leading-relaxed">
                  Tatvan depomuzdaki yetkili yöneticimize doğrudan mesaj gönderebilirsiniz.
                  Mesajınız anında yönetim paneline iletilir ve yetkili yönetici canlı yanıt verir.
                </p>
              </div>
            )}

            {/* SEÇİLEN MODA GÖRE MESAJLARI LİSTELE */}
            {(chatMode === "ai" ? aiMessages : adminMessages).map((m, i) => {
              const isUser = m.role === "user";
              const isAdminReply = m.role === "admin";

              return (
                <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
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
                    {/* Fotoğraf varsa göster */}
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

                    {/* WhatsApp Zaman & Çift Tik */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono ${
                        isUser ? "text-emerald-200/70" : "text-white/40"
                      }`}
                    >
                      <span>{formatMsgTime(m.created_at)}</span>
                      {isUser && <CheckCheck className="h-3 w-3 text-sky-400" />}
                    </div>

                    {/* Eğer AI tarafından ürün başarıyla eklendiyse kart önizlemesi */}
                    {m.productPreview && (
                      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-[#182229] p-3 text-white">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>Kataloğa Eklendi</span>
                        </div>
                        <p className="font-extrabold text-sm text-white">{m.productPreview.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded bg-black/40 px-2 py-0.5 font-semibold text-emerald-300 border border-emerald-500/30">
                            {categoryLabel(m.productPreview.category)}
                          </span>
                          <span className="rounded bg-black/40 px-2 py-0.5 font-semibold text-white/80 border border-white/10">
                            {m.productPreview.unit}
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                          <Link
                            to="/urun/$id"
                            params={{ id: m.productPreview.id }}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer"
                          >
                            <span>Ürünü Vitrinde İncele / Sipariş Ver</span>
                          </Link>
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

          {/* AI MODUNDA HIZLI ÖNERİLER & YÖNETİCİYE AKTAR BUTONU */}
          {chatMode === "ai" && (
            <div className="border-t border-white/10 bg-[#111b21] px-2 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar items-center">
              <button
                type="button"
                onClick={handleTransferToAdmin}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer"
              >
                <Headphones className="h-3 w-3 text-emerald-400" />
                <span>Yöneticiye Bağlan</span>
              </button>

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
              <button
                type="button"
                onClick={() => handlePromptClick("Koli ve paket bazlı sipariş kuralları nelerdir?")}
                className="shrink-0 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors cursor-pointer"
              >
                ⚖️ Koli/Paket Kuralları
              </button>
            </div>
          )}

          {/* SEÇİLİ FOTOĞRAF ÖNİZLEME ÇİPİ (SADECE AI MODUNDA) */}
          {selectedImage && chatMode === "ai" && (
            <div className="bg-[#182229] border-t border-white/10 px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={selectedImage}
                  alt="Önizleme"
                  className="h-8 w-8 rounded-lg object-cover border border-emerald-500/40"
                />
                <span className="text-xs font-semibold text-emerald-300">
                  {isAdmin ? "Fotoğraf eklendi (Otomatik ürün analizi)" : "Fotoğraf eklendi"}
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

          {/* FORM & INPUT: WHATSAPP TARZI ALT ÇUBUK */}
          <form
            className="flex items-center gap-2 border-t border-white/10 bg-[#202c33] p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            {/* Fotoğraf Seçici (Yalnızca AI modunda) */}
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
                  ? "İsteğe bağlı bir not yazın (Örn: Çaykur Rize Çay 1000g)..."
                  : chatMode === "admin"
                    ? "Yöneticiye doğrudan mesajınızı yazın..."
                    : "Ko'ya toptan ürünler veya teslimat hakkında bir şey sorun..."
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
        </div>
      )}

      {/* SAĞ ALTTTAKİ YÜZEN BUTON (WHATSAPP YEŞİLİ) */}
      <button
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) setUnreadAdminCount(0);
            return next;
          });
        }}
        aria-label="Canlı Destek ve AI Asistanı"
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/50 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-[#060b08]/80 group ${
          unreadAdminCount > 0 ? "animate-chat-shake ring-4 ring-emerald-400" : ""
        }`}
      >
        <MessageCircle className="h-7 w-7 transition-transform group-hover:rotate-12" />
        {unreadAdminCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-600 text-white font-extrabold text-[11px] shadow-lg animate-pulse ring-2 ring-white">
            {unreadAdminCount}
          </span>
        ) : isTransferred ? (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] font-extrabold text-white items-center justify-center">
              !
            </span>
          </span>
        ) : (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-white"></span>
          </span>
        )}
      </button>
    </>
  );
}
