import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Camera,
  PackagePlus,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { askGemini, analyzeProductPhoto, type ChatMessage } from "@/lib/gemini";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = {
  role: "user" | "assistant";
  content: string;
  image?: string;
  productPreview?: {
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

export function SupportChat() {
  const { user, isAdmin, profile } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Yönetici veya Müşteriye göre dinamik karşılama mesajı
  useEffect(() => {
    if (messages.length === 0) {
      if (isAdmin) {
        setMessages([
          {
            role: "assistant",
            content: `Merhaba Yönetici ${profile?.full_name ? profile.full_name.split(" ")[0] : ""} 👋\nBen Ko, KasımOğulları depo asistanıyım. ⚡\n\nÜrün ekleme ve depo operasyonlarınızda size yardımcı olmak için buradayım. Bir ürünün fotoğrafını atarsanız ürün adını, kategorisini, birimini ve açıklamasını otomatik çıkarıp depoya ekleyebilirim!`,
          },
        ]);
      } else {
        setMessages([
          {
            role: "assistant",
            content:
              "Merhaba, ben Ko 👋 KasımOğulları toptan müşteri asistanıyım.\n\nDepomuzdaki ürünler, toptan sipariş verme ve Bitlis/ilçelerine teslimat süreçleri hakkında bana dilediğinizi sorabilirsiniz. Özel ürün talepleriniz varsa depo yöneticilerimize iletmek üzere not alabilirim.",
          },
        ]);
      }
    }
  }, [isAdmin, profile?.full_name, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, loading, analyzingImage]);

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
      toast.success("Fotoğraf eklendi. Göndermek için gönder butonuna basın.");
    } catch {
      toast.error("Fotoğraf işlenemedi, lütfen tekrar deneyin");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePromptClick = (promptText: string) => {
    setInput(promptText);
  };

  const send = async () => {
    const text = input.trim();
    const hasImage = Boolean(selectedImage);

    if ((!text && !hasImage) || loading || analyzingImage) return;

    const currentImg = selectedImage;
    setSelectedImage(null);
    setInput("");

    // Kullanıcı mesajını ekle
    const userMsg: Msg = {
      role: "user",
      content: text || (hasImage ? "📷 [Ürün Fotoğrafı Gönderildi]" : ""),
      image: currentImg || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);

    // EĞER YÖNETİCİ FOTOĞRAF GÖNDERDİYSE: Gemini Vision ile Analiz Et ve Ürünü Depoya Ekle
    if (isAdmin && hasImage && currentImg) {
      setAnalyzingImage(true);
      try {
        const result = await analyzeProductPhoto(currentImg, "image/jpeg", text || undefined);

        if (!result.ok || !result.product) {
          throw new Error(result.error || "Görsel taranamadı");
        }

        const extracted = result.product;

        // Ürünü doğrudan Supabase'e ekle
        const { error: insertError } = await supabase.from("products").insert({
          name: extracted.name,
          category: extracted.category,
          unit: extracted.unit,
          description: extracted.description,
          image_url: currentImg,
          is_active: true,
        });

        if (insertError) {
          console.error("Product insert error:", insertError);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ Ürünü analiz ettim ancak veritabanına eklenirken bir hata oluştu: ${insertError.message}\n\nTespit Edilen Bilgiler:\n📦 Ürün: ${extracted.name}\n📂 Kategori: ${categoryLabel(extracted.category)}\n⚖️ Birim: ${extracted.unit}\n📝 Açıklama: ${extracted.description}`,
            },
          ]);
          return;
        }

        // Başarılı ekleme: query cache'i güncelle ki ana sayfada ve yönetimde anında görünsün
        void qc.invalidateQueries({ queryKey: ["admin-products"] });
        void qc.invalidateQueries({ queryKey: ["products"] });
        toast.success("Yeni ürün otomatik olarak depoya eklendi!");

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ Harika! Ürünü fotoğraftan tespit ettim ve otomatik olarak depoya ekledim:\n\n📦 **${extracted.name}**\n📂 Kategori: **${categoryLabel(extracted.category)}**\n⚖️ Birim: **${extracted.unit}**\n📝 Açıklama: ${extracted.description}\n\nÜrün şu anda katalogda ve yönetim panelinde yayında!`,
            productPreview: {
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
        setMessages((prev) => [
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

    // NORMAL METİN MESAJI
    setLoading(true);
    try {
      const history: ChatMessage[] = [...messages, userMsg]
        .slice(-14)
        .map((m) => ({ role: m.role, content: m.content }));

      const reply = await askGemini(history, isAdmin, {
        fullName: profile?.full_name || user?.email || undefined,
        businessName: profile?.business_name || undefined,
        phone: profile?.phone || undefined,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Şu an sunucuyla bağlantı kurulamadı, lütfen kısa süre sonra tekrar deneyin.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-950/20 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div
            className={`flex items-center gap-2.5 px-4 py-3 text-white transition-colors ${
              isAdmin
                ? "bg-gradient-to-r from-emerald-800 to-teal-900"
                : "bg-gradient-to-r from-[#166534] to-emerald-800"
            }`}
          >
            <div className="relative">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-900 font-extrabold text-sm shadow">
                Ko
              </span>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
            </div>

            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold">Ko</p>
                {isAdmin ? (
                  <span className="flex items-center gap-0.5 rounded bg-amber-400/25 px-1.5 py-0.2 text-[10px] font-bold text-amber-200 border border-amber-400/40">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    YÖNETİCİ ASİSTANI
                  </span>
                ) : (
                  <span className="rounded bg-white/20 px-1.5 py-0.2 text-[10px] font-medium text-white/90">
                    Müşteri Asistanı
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80">
                {isAdmin ? "Fotoğrafla ürün ekleme & depo" : "KasımOğulları Toptan Destek"}
              </p>
            </div>

            <button
              onClick={() => setOpen(false)}
              aria-label="Sohbeti kapat"
              className="ml-auto rounded-lg p-1.5 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-xs bg-[#166534] px-3.5 py-2.5 text-sm text-white shadow-sm"
                      : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-xs bg-white border border-slate-200/80 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
                  }
                >
                  {/* Fotoğraf varsa göster */}
                  {m.image && (
                    <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                      <img
                        src={m.image}
                        alt="Yüklenen görsel"
                        className="max-h-48 w-full object-cover"
                      />
                    </div>
                  )}

                  {m.content}

                  {/* Eğer ürün başarıyla eklendiyse kart önizlemesi göster */}
                  {m.productPreview && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-slate-800">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Kataloğa Eklendi</span>
                      </div>
                      <p className="font-extrabold text-sm text-slate-900">
                        {m.productPreview.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded bg-white px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                          {categoryLabel(m.productPreview.category)}
                        </span>
                        <span className="rounded bg-white px-2 py-0.5 font-semibold text-slate-700 border border-slate-200">
                          {m.productPreview.unit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {analyzingImage && (
              <div className="mr-auto flex items-center gap-2.5 rounded-2xl bg-white border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 shadow-sm animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Fotoğraf yapay zeka ile taranıyor ve ürün kataloğa ekleniyor...</span>
              </div>
            )}

            {loading && !analyzingImage && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-600 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                <span>Ko yazıyor...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Hızlı Öneri Hapları */}
          <div className="border-t border-slate-200/70 bg-white px-2 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer"
                >
                  <Camera className="h-3 w-3 text-emerald-700" />
                  Fotoğraftan Ürün Ekle
                </button>
                <button
                  type="button"
                  onClick={() => handlePromptClick("Depodaki toplam ürünler ve kategoriler neler?")}
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                >
                  📦 Depo Özeti
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePromptClick("Fotoğrafla ürün ekleme sistemi nasıl çalışıyor?")
                  }
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                >
                  💡 Nasıl Çalışır?
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handlePromptClick("Deponuzda hangi ürünler ve kategoriler var?")}
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                >
                  📦 Hangi ürünler var?
                </button>
                <button
                  type="button"
                  onClick={() => handlePromptClick("Teslimat hangi ilçelere yapılıyor?")}
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                >
                  🚚 Teslimat Bölgeleri
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePromptClick(
                      "Katalogda olmayan özel bir ürün talep etmek istiyorum, depoya iletir misin?",
                    )
                  }
                  className="shrink-0 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition-colors"
                >
                  💬 Özel Ürün Talebi
                </button>
                <button
                  type="button"
                  onClick={() => handlePromptClick("Nasıl toptan sipariş verilir?")}
                  className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                >
                  🛒 Sipariş Nasıl Verilir?
                </button>
              </>
            )}
          </div>

          {/* Seçili Fotoğraf Önizleme Çipi */}
          {selectedImage && (
            <div className="bg-emerald-50 border-t border-emerald-200 px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={selectedImage}
                  alt="Önizleme"
                  className="h-8 w-8 rounded-lg object-cover border border-emerald-300"
                />
                <span className="text-xs font-semibold text-emerald-900">
                  {isAdmin ? "Fotoğraf eklendi (Otomatik katalog analizi)" : "Fotoğraf eklendi"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
              >
                Kaldır
              </button>
            </div>
          )}

          {/* Form & Input */}
          <form
            className="flex items-center gap-1.5 border-t border-slate-200 bg-white p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {/* Gizli Dosya Seçici */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Fotoğraf Ekleme Butonu (Yöneticiler için öne çıkan, müşteriler için de görsel gönderme desteği) */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title={isAdmin ? "Ürün fotoğrafı yükle ve depoya ekle" : "Fotoğraf yükle"}
              className={`h-9 w-9 shrink-0 rounded-xl cursor-pointer ${
                isAdmin
                  ? "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Camera className="h-4 w-4" />
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedImage
                  ? "İsteğe bağlı bir not yazın..."
                  : isAdmin
                    ? "Sorunuzu yazın veya fotoğraf atın..."
                    : "Sorunuzu veya ürün talebinizi yazın..."
              }
              maxLength={500}
              className="h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 focus-visible:ring-emerald-600"
            />

            <Button
              type="submit"
              size="icon"
              disabled={loading || analyzingImage || (!input.trim() && !selectedImage)}
              className="h-9 w-9 shrink-0 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Destek asistanı Ko"
        className={`fixed bottom-5 right-4 z-50 flex h-13 items-center gap-2 rounded-full px-4 font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
          isAdmin
            ? "bg-gradient-to-r from-emerald-700 to-teal-800 ring-2 ring-emerald-400/60"
            : "bg-[#166534] ring-2 ring-emerald-500/40"
        }`}
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          {isAdmin && (
            <Sparkles className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-300 fill-amber-300" />
          )}
        </div>
        <span className="text-sm font-bold tracking-wide">Ko</span>
        {isAdmin && (
          <span className="hidden sm:inline-block rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200 border border-amber-300/40">
            YÖNETİCİ
          </span>
        )}
      </button>
    </>
  );
}
