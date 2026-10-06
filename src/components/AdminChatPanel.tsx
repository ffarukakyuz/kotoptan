import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  User,
  Phone,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Bot,
  Shield,
  MessageCircleQuestion,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdminChatSessions,
  getAdminChatSession,
  sendAdminReply,
  closeAdminChatSession,
  type ChatSessionData,
  type ChatMessage,
} from "@/lib/chat-service";
import {
  playAdminAlertChime,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from "@/lib/sound-notifications";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function AdminChatPanel() {
  const adminName = "Yönetici";

  const [sessions, setSessions] = useState<ChatSessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [filter, setFilter] = useState<"all" | "transferred" | "active" | "closed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Bildirim Ayarları
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(false);

  const prevSessionsRef = useRef<
    Record<string, { updatedAt: string; lastMessage: string; status: string }>
  >({});
  const isFirstAdminLoadRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tarayıcı bildirim izni durumunu kontrol et
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestBrowserNotificationPermission();
    setBrowserNotifEnabled(granted);
    if (granted) {
      toast.success("Masaüstü bildirimleri aktif edildi! Yeni talepler ekranda belirecek.");
      sendBrowserNotification("KasımOğulları Yönetici Bildirimleri", {
        body: "Canlı destek bildirimleri başarıyla etkinleştirildi.",
      });
    } else {
      toast.error("Bildirim izni verilmedi");
    }
  };

  // Oturumları çek ve yeni talep / mesaj varsa sesli ve masaüstü bildirimi gönder
  const loadSessions = async (showToast = false) => {
    setLoadingList(true);
    try {
      const data = await listAdminChatSessions();
      setSessions(data);

      if (!isFirstAdminLoadRef.current) {
        let hasNewRequest = false;
        let alertSession: ChatSessionData | null = null;

        for (const s of data) {
          const prev = prevSessionsRef.current[s.id];
          if (!prev) {
            // Tamamen yeni oturum
            hasNewRequest = true;
            alertSession = s;
            break;
          } else if (
            prev.updatedAt !== s.updated_at &&
            (prev.status !== s.status || prev.lastMessage !== s.last_message)
          ) {
            // Durum veya mesaj değişmiş
            if (s.status === "transferred" || s.last_message !== prev.lastMessage) {
              hasNewRequest = true;
              alertSession = s;
              break;
            }
          }
        }

        if (hasNewRequest && alertSession) {
          if (soundEnabled) {
            playAdminAlertChime();
          }
          sendBrowserNotification("🔔 Yeni Müşteri Canlı Destek Talebi!", {
            body: `${alertSession.user_name || "Müşteri"}: ${alertSession.last_message || "Temsilciye bağlanmak istiyor"}`,
          });
          toast.warning(`🔔 Yeni Talep: ${alertSession.user_name || "Müşteri"}`, {
            description: alertSession.last_message || "Canlı destek talebi iletildi",
          });
        }
      }

      // Harita kaydet
      const newMap: Record<string, { updatedAt: string; lastMessage: string; status: string }> = {};
      for (const s of data) {
        newMap[s.id] = {
          updatedAt: s.updated_at,
          lastMessage: s.last_message,
          status: s.status,
        };
      }
      prevSessionsRef.current = newMap;
      isFirstAdminLoadRef.current = false;

      if (showToast) toast.success("Sohbet listesi güncellendi");
    } catch {
      if (showToast) toast.error("Sohbet listesi yüklenemedi");
    } finally {
      setLoadingList(false);
    }
  };

  // Seçilen oturumun mesajlarını çek
  const loadSessionMessages = async (sessionId: string) => {
    try {
      const data = await getAdminChatSession(sessionId);
      setCurrentSession(data.session);
      setMessages(data.messages);
    } catch {
      toast.error("Mesajlar yüklenemedi");
    }
  };

  useEffect(() => {
    void loadSessions();
    // Oturum listesini her 4 saniyede bir otomatik yenile (canlı bildirim havuzu)
    const interval = setInterval(() => {
      void loadSessions();
    }, 4000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Seçili oturumun mesajlarını düzenli aralıklarla yokla
  useEffect(() => {
    if (!selectedSessionId) return;
    void loadSessionMessages(selectedSessionId);
    const interval = setInterval(() => {
      void loadSessionMessages(selectedSessionId);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Yanıt Gönderme
  const handleSendReply = async () => {
    if (!selectedSessionId || !replyText.trim()) return;
    setSendingReply(true);
    const text = replyText.trim();
    setReplyText("");

    try {
      const ok = await sendAdminReply(selectedSessionId, adminName, text);
      if (ok) {
        toast.success("Yanıtınız müşteriye iletildi");
        await loadSessionMessages(selectedSessionId);
        await loadSessions();
      } else {
        toast.error("Yanıt gönderilemedi");
        setReplyText(text);
      }
    } catch {
      toast.error("İletişim hatası oluştu");
      setReplyText(text);
    } finally {
      setSendingReply(false);
    }
  };

  // Sohbeti Sonlandırma
  const handleCloseSession = async () => {
    if (!selectedSessionId) return;
    setClosingSession(true);
    try {
      const ok = await closeAdminChatSession(selectedSessionId, adminName);
      if (ok) {
        toast.success("Sohbet başarıyla sonlandırıldı");
        await loadSessionMessages(selectedSessionId);
        await loadSessions();
      } else {
        toast.error("Sohbet sonlandırılamadı");
      }
    } finally {
      setClosingSession(false);
    }
  };

  // Filtreleme
  const filteredSessions = sessions.filter((s) => {
    if (filter === "transferred" && s.status !== "transferred") return false;
    if (filter === "active" && s.status !== "active_admin") return false;
    if (filter === "closed" && s.status !== "closed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (s.user_name || "").toLowerCase().includes(q);
      const matchPhone = (s.user_phone || "").toLowerCase().includes(q);
      const matchMsg = (s.last_message || "").toLowerCase().includes(q);
      return matchName || matchPhone || matchMsg;
    }
    return true;
  });

  const transferredCount = sessions.filter((s) => s.status === "transferred").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Üst Bilgi Barı */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              Müşteri Canlı Destek & Mesajlaşma
            </h2>
            {transferredCount > 0 && (
              <Badge
                variant="destructive"
                className="bg-amber-500 text-black font-extrabold animate-pulse"
              >
                {transferredCount} Bekleyen Talep
              </Badge>
            )}
          </div>
          <p className="text-xs text-white/60 mt-1">
            Yapay zekanın aktardığı veya temsilci talep eden müşterilerle Cloudflare D1 altyapısı
            üzerinden canlı yazışın.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* Masaüstü Bildirim İzni Butonu */}
          {!browserNotifEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableNotifications}
              className="border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs gap-1.5 cursor-pointer"
              title="Yeni müşteri mesajları için masaüstü bildirimi aç"
            >
              <BellRing className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>Bildirimleri Aç</span>
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
              <Bell className="h-3 w-3" />
              <span>Bildirimler Aktif</span>
            </span>
          )}

          {/* Ses Açık/Kapalı Butonu */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSoundEnabled((v) => {
                const next = !v;
                if (next) {
                  playAdminAlertChime();
                  toast.success("Bildirim sesleri açıldı");
                } else {
                  toast.info("Bildirim sesleri kapatıldı");
                }
                return next;
              });
            }}
            className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 cursor-pointer"
            title={soundEnabled ? "Bildirim sesini kapat" : "Bildirim sesini aç"}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Ses Açık</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-white/50" />
                <span>Sessiz</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSessions(true)}
            disabled={loadingList}
            className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Ana Sohbet Izgarası (Sol Liste - Sağ Detay) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[580px]">
        {/* Sol Kolon: Sohbet Listesi */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
          {/* Arama ve Filtre Butonları */}
          <div className="space-y-2.5 pb-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
              <Input
                placeholder="Müşteri adı, telefon veya mesaj..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filter === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Tümü ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("transferred")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  filter === "transferred"
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-white/5 text-amber-300 hover:bg-white/10"
                }`}
              >
                <span>Yönetici Bekleyen</span>
                {transferredCount > 0 && <span className="text-[10px]">({transferredCount})</span>}
              </button>
              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filter === "active"
                    ? "bg-emerald-700 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => setFilter("closed")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filter === "closed"
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Kapalı
              </button>
            </div>
          </div>

          {/* Oturum Listesi */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-2.5 max-h-[500px] pr-1">
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-white/40">
                <MessageCircleQuestion className="mx-auto mb-2 h-7 w-7 text-white/30" />
                Henüz eşleşen müşteri mesajı yok
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = selectedSessionId === s.id;
                const isTransferred = s.status === "transferred";
                const isActive = s.status === "active_admin";
                const isClosed = s.status === "closed";

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-950/40 shadow-md ring-1 ring-emerald-500/50"
                        : "border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white truncate">
                        <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{s.user_name || "Müşteri / Bayi"}</span>
                      </div>

                      {/* Durum Rozeti */}
                      {isTransferred && (
                        <span className="flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                          YÖNETİCİ BEKLİYOR
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                          Aktif Görüşme
                        </span>
                      )}
                      {isClosed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">
                          Sonlandı
                        </span>
                      )}
                      {s.status === "bot" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                          AI Bot
                        </span>
                      )}
                    </div>

                    {s.user_phone && (
                      <p className="text-[11px] text-white/60 flex items-center gap-1 mb-1">
                        <Phone className="h-3 w-3 text-white/40" />
                        {s.user_phone}
                      </p>
                    )}

                    <p className="text-xs text-white/80 line-clamp-2 leading-relaxed bg-black/20 p-1.5 rounded-lg border border-white/5">
                      {s.last_message || "Henüz mesaj yok"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(s.updated_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-mono text-[9px] text-white/30 truncate max-w-[100px]">
                        ID: {s.id.slice(-6)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sağ Kolon: Mesaj Akışı ve Yanıt Alanı */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          {selectedSessionId && currentSession ? (
            <>
              {/* Sağ Üst Başlık & Eylemler */}
              <div className="flex items-center justify-between gap-3 p-3.5 border-b border-white/10 bg-black/20">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                    {currentSession.user_name
                      ? currentSession.user_name.charAt(0).toUpperCase()
                      : "M"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {currentSession.user_name || "Müşteri / Bayi"}
                      {currentSession.status === "transferred" && (
                        <Badge className="bg-amber-500 text-black text-[10px] font-extrabold">
                          Yetkili Yanıtı Bekleniyor
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-white/60 flex items-center gap-2">
                      {currentSession.user_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-400" />
                          {currentSession.user_phone}
                        </span>
                      )}
                      <span>•</span>
                      <span className="font-mono text-[10px] text-white/40">
                        Oturum: {currentSession.id}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentSession.status !== "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseSession}
                      disabled={closingSession}
                      className="h-8 text-xs border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-white cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1 text-red-400" />
                      Sohbeti Sonlandır
                    </Button>
                  ) : (
                    <Badge variant="outline" className="border-white/20 text-white/50 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                      Sonlandırılmış
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mesaj Listesi */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[380px] max-h-[460px] bg-black/10">
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-white/40">
                    Bu oturumda henüz mesaj bulunmuyor.
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isUser = m.role === "user";
                    const isAdminMsg = m.role === "admin";
                    const isBot = m.role === "assistant" || m.role === "bot";

                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-white/50 mb-1 px-1">
                          {isUser ? (
                            <>
                              <User className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="font-semibold text-emerald-300">
                                {m.sender_name || "Müşteri"}
                              </span>
                            </>
                          ) : isAdminMsg ? (
                            <>
                              <Shield className="h-2.5 w-2.5 text-amber-400" />
                              <span className="font-bold text-amber-300">
                                {m.sender_name || "Yönetici"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Bot className="h-2.5 w-2.5 text-sky-400" />
                              <span className="text-sky-300">Ko AI Asistan</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {m.created_at
                              ? new Date(m.created_at).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            isUser
                              ? "bg-white/10 text-white rounded-tl-sm border border-white/10"
                              : isAdminMsg
                                ? "bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-tr-sm shadow-md border border-emerald-500/40"
                                : "bg-sky-950/40 text-sky-100 rounded-tr-sm border border-sky-500/30"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Alt Yanıt Yazma Alanı */}
              <div className="p-3 border-t border-white/10 bg-black/30">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendReply();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder={`${currentSession.user_name || "Müşteriye"} yönetici olarak doğrudan yanıt yazın...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sendingReply}
                    className="flex-1 bg-black/50 border-white/15 text-white placeholder:text-white/40 text-xs h-10 rounded-xl"
                  />
                  <Button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Gönder</span>
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center text-white/40">
              <MessageSquare className="h-12 w-12 text-white/20 mb-3" />
              <p className="text-sm font-semibold text-white/70">Müşteri Mesajı Seçilmedi</p>
              <p className="text-xs text-white/40 max-w-sm mt-1">
                Sol taraftaki listeden bir müşteri sohbetini seçerek konuşma geçmişini görebilir ve
                doğrudan yanıt yazabilirsiniz.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
