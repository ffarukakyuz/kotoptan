import { useState, useEffect } from "react";
import {
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone,
  Check,
  Apple,
  Monitor,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { usePWAInstall, PWAPlatform } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { BRAND_LOGO_SRC } from "@/lib/branding";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isAndroid, platform, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    // Oturum bazlı kapatma kontrolü
    const isDismissed = sessionStorage.getItem("pwa_banner_dismissed") === "true";
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa_banner_dismissed", "true");
    }
  };

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        handleDismiss();
        return;
      }
    }
    // iPhone Safari veya manuel yönlendirme gereken durumlarda modal rehberi aç
    setShowGuide(true);
  };

  if (!mounted) {
    return null;
  }

  // Zaten yüklüyse veya bu oturumda gizlendiyse banner'ı gösterme
  if (isInstalled || dismissed) {
    return (
      <>
        {showGuide && (
          <PWAInstallModal initialPlatform={platform} onClose={() => setShowGuide(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="relative z-40 border-b border-emerald-500/30 bg-gradient-to-r from-[#0d281e] via-[#081b13] to-[#040806] px-3.5 py-2.5 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo Önizleme Rozeti */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-black ring-1 ring-emerald-400/40 shadow-md">
              <img
                src={BRAND_LOGO_SRC}
                alt="Kotoptan"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  {isIOS ? (
                    <>
                      <Apple className="h-3 w-3" /> iPhone & iPad
                    </>
                  ) : isAndroid ? (
                    <>
                      <Smartphone className="h-3 w-3" /> Android
                    </>
                  ) : (
                    <>
                      <Monitor className="h-3 w-3" /> Bilgisayar & Masaüstü
                    </>
                  )}
                </span>
                <span className="inline-block h-1 w-1 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-white/70">Tek Tıkla Erişim</span>
              </div>
              <p className="text-xs sm:text-sm font-extrabold tracking-tight text-white truncate">
                {isIOS
                  ? "Kotoptan'ı iPhone Ana Ekranınıza Ekleyin"
                  : isAndroid
                    ? "Kotoptan'ı Telefonunuza Yükleyin"
                    : "Kotoptan'ı Masaüstü Uygulaması Yapın"}
              </p>
              <p className="text-[11px] text-white/75 truncate hidden sm:block">
                Tarayıcı çubuğu olmadan tam ekran toptan sipariş deneyimi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleAction}
              className="h-8.5 rounded-lg bg-[#166534] hover:bg-[#14532d] text-white text-xs font-bold px-3.5 shadow-md ring-1 ring-emerald-400/40 cursor-pointer active:scale-95 transition-all"
            >
              {isInstallable ? (
                <>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Hemen Yükle
                </>
              ) : isIOS ? (
                <>
                  <Share className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
                  Nasıl Eklenir?
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Ana Ekrana Ekle
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Kapat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 active:scale-90 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showGuide && (
        <PWAInstallModal initialPlatform={platform} onClose={() => setShowGuide(false)} />
      )}
    </>
  );
}

export function PWAInstallModal({
  initialPlatform = "android",
  onClose,
}: {
  initialPlatform?: PWAPlatform;
  onClose: () => void;
}) {
  const { isInstallable, install } = usePWAInstall();
  const [selectedTab, setSelectedTab] = useState<PWAPlatform>(initialPlatform);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  const handleDirectInstall = async () => {
    const success = await install();
    if (success) {
      setInstalledSuccessfully(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#07110b] p-5 sm:p-6 text-white shadow-2xl overflow-hidden">
        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-black border border-emerald-500/40 overflow-hidden shadow-lg ring-2 ring-emerald-500/20">
              <img
                src={BRAND_LOGO_SRC}
                alt="Kotoptan"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-white">Ana Ekrana Ekle</h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Uygulama
                </span>
              </div>
              <p className="text-xs text-white/60">
                Tüm cihazlarda (iPhone, Android, PC) kolay kurulum
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cihaz Seçim Sekmeleri */}
        <div className="mt-4 flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setSelectedTab("ios")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTab === "ios"
                ? "bg-[#166534] text-white shadow"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Apple className="h-3.5 w-3.5" />
            <span>iPhone / iPad</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTab("android")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTab === "android"
                ? "bg-[#166534] text-white shadow"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Android</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTab("desktop")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTab === "desktop"
                ? "bg-[#166534] text-white shadow"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Bilgisayar</span>
          </button>
        </div>

        {/* Ana Ekran İkon Önizleme Kartı (Tüm Cihazlar İçin) */}
        <div className="mt-3.5 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-black/40 p-3 border border-emerald-500/25">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-black shadow-lg ring-2 ring-emerald-500/40">
            <img
              src={BRAND_LOGO_SRC}
              alt="Kotoptan Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-400">
              Ana Ekranınızda Görünecek İkon:
            </p>
            <p className="text-sm font-bold text-white truncate">Kotoptan</p>
            <p className="text-[11px] text-white/65">Bitlis & Tatvan Toptan Dağıtım Merkezi</p>
          </div>
        </div>

        {/* Sekme İçerikleri */}
        <div className="mt-4 space-y-3">
          {/* 1. iPHONE / iPAD (iOS Safari) */}
          {selectedTab === "ios" && (
            <div className="space-y-2.5 text-xs sm:text-sm text-white/90 animate-in fade-in duration-150">
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                iPhone / iPad Safari'de 3 Kolay Adımda Kurun:
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  1
                </span>
                <p className="text-xs leading-relaxed">
                  Safari tarayıcısının alt menü çubuğundaki{" "}
                  <strong className="text-white inline-flex items-center gap-1 font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    <Share className="inline h-3.5 w-3.5 text-emerald-400" /> Paylaş
                  </strong>{" "}
                  (kare içinden yukarı ok) simgesine dokunun.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  2
                </span>
                <p className="text-xs leading-relaxed">
                  Açılan menü seçeneklerini hafifçe aşağı kaydırıp{" "}
                  <strong className="text-white inline-flex items-center gap-1 font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    <PlusSquare className="inline h-3.5 w-3.5 text-emerald-400" /> Ana Ekrana Ekle
                  </strong>{" "}
                  seçeneğine basın.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  3
                </span>
                <p className="text-xs leading-relaxed">
                  Sağ üst köşedeki <strong className="text-emerald-300 font-bold">"Ekle"</strong>{" "}
                  butonuna dokunun. Kotoptan yeşil sürat logolu ikonu telefonunuzun ana ekranına
                  uygulama gibi gelecektir.
                </p>
              </div>
            </div>
          )}

          {/* 2. ANDROID */}
          {selectedTab === "android" && (
            <div className="space-y-2.5 text-xs sm:text-sm text-white/90 animate-in fade-in duration-150">
              {isInstallable && !installedSuccessfully && (
                <div className="rounded-xl bg-emerald-600/20 p-3 border border-emerald-500/40 text-center">
                  <p className="text-xs text-emerald-300 font-semibold mb-2">
                    Cihazınız otomatik yüklemeyi destekliyor:
                  </p>
                  <Button
                    onClick={handleDirectInstall}
                    className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-bold py-2 shadow-lg cursor-pointer"
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Tek Dokunuşla Uygulamayı Yükle
                  </Button>
                </div>
              )}

              {installedSuccessfully && (
                <div className="rounded-xl bg-emerald-600/30 p-3 border border-emerald-400 text-center text-xs text-emerald-200 font-bold">
                  ✓ Uygulama başarıyla yüklendi! Ana ekranınızdan başlatabilirsiniz.
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  1
                </span>
                <p className="text-xs leading-relaxed">
                  Chrome veya Samsung Internet sağ üst köşesindeki{" "}
                  <strong className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    üç nokta (⋮)
                  </strong>{" "}
                  menüsüne dokunun.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  2
                </span>
                <p className="text-xs leading-relaxed">
                  Menüden{" "}
                  <strong className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    "Uygulamayı Yükle"
                  </strong>{" "}
                  veya{" "}
                  <strong className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    "Ana Ekrana Ekle"
                  </strong>{" "}
                  seçeneğine basın.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  3
                </span>
                <p className="text-xs leading-relaxed">
                  Onay kutusunda <strong className="text-emerald-300 font-bold">"Yükle"</strong>{" "}
                  butonuna basın. Kotoptan logosu ana ekranınıza yerleşecektir.
                </p>
              </div>
            </div>
          )}

          {/* 3. BİLGİSAYAR / MASAÜSTÜ */}
          {selectedTab === "desktop" && (
            <div className="space-y-2.5 text-xs sm:text-sm text-white/90 animate-in fade-in duration-150">
              {isInstallable && !installedSuccessfully && (
                <div className="rounded-xl bg-emerald-600/20 p-3 border border-emerald-500/40 text-center">
                  <Button
                    onClick={handleDirectInstall}
                    className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-bold py-2 shadow-lg cursor-pointer"
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Bilgisayara Yükle (Chrome / Edge)
                  </Button>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  1
                </span>
                <p className="text-xs leading-relaxed">
                  Google Chrome veya Microsoft Edge tarayıcınızın üst adres çubuğunun en sağında yer
                  alan{" "}
                  <strong className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                    "Uygulamayı Yükle" (⊕ veya ekran simgesi)
                  </strong>{" "}
                  düğmesine tıklayın.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  2
                </span>
                <p className="text-xs leading-relaxed">
                  Veya tarayıcı menüsünden (üç nokta ⋮){" "}
                  <strong className="text-white font-bold">
                    "Yayınla, Kaydet ve Paylaş" &gt; "Kotoptan uygulamasını yükle"
                  </strong>{" "}
                  seçeneğini seçin.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-extrabold text-white">
                  3
                </span>
                <p className="text-xs leading-relaxed">
                  Masaüstünüzde doğrudan açılan bağımsız Kotoptan penceresiyle hızlı sipariş
                  verebilirsiniz.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alt Kapat / Onay Butonu */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/50">
            {selectedTab === "ios"
              ? "iOS 16+ ve tüm iPad modelleriyle tam uyumludur."
              : selectedTab === "android"
                ? "Tüm Android sürümleriyle tam uyumludur."
                : "Windows, macOS ve Linux ile uyumludur."}
          </p>
          <Button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2 text-xs cursor-pointer"
          >
            <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
            Anladım
          </Button>
        </div>
      </div>
    </div>
  );
}
