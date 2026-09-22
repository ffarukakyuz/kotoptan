import { useState, useEffect } from "react";
import { Download, Share, PlusSquare, X, Smartphone, Check } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
      if (ok) handleDismiss();
    } else {
      // Show step by step guide (especially for iOS Safari or mobile Chrome)
      setShowGuide(true);
    }
  };

  // If already installed as app, or dismissed in this session, do not show banner
  if (isInstalled || dismissed) {
    return (
      <>{showGuide && <PWAInstallModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}</>
    );
  }

  // Only show banner on mobile devices or if browser triggered installable
  if (!isMobile && !isInstallable) {
    return null;
  }

  return (
    <>
      <div className="relative z-40 border-b border-emerald-500/30 bg-gradient-to-r from-[#0d281e] via-[#091f16] to-[#040806] px-3.5 py-2.5 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#166534] text-white shadow ring-1 ring-emerald-400/40">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold tracking-tight text-white truncate">
                Telefonunuza Kısayol Ekleyin
              </p>
              <p className="text-[11px] sm:text-xs text-white/75 truncate">
                Tek dokunuşla sipariş vermek için ana ekrana ekleyin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleAction}
              className="h-8 rounded-lg bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold px-3 shadow cursor-pointer active:scale-95"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Kısayol Ekle
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Kapat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 active:scale-90 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showGuide && <PWAInstallModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}

export function PWAInstallModal({ isIOS, onClose }: { isIOS: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b140f] p-5 sm:p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#166534] text-white shadow ring-1 ring-emerald-500/40">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Ana Ekrana Kısayol Ekle</h3>
              <p className="text-xs text-white/60">KasımOğulları Toptan Kataloğu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-sm text-white/85">
          {isIOS ? (
            <>
              <p className="text-xs text-emerald-400 font-medium">
                iPhone / iPad Safari için 3 Kolay Adım:
              </p>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  1
                </span>
                <p className="text-xs sm:text-sm">
                  Safari'nin alt menü çubuğundaki{" "}
                  <strong className="text-white inline-flex items-center gap-1 font-semibold">
                    <Share className="inline h-3.5 w-3.5 text-emerald-400" /> Paylaş
                  </strong>{" "}
                  simgesine dokunun.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  2
                </span>
                <p className="text-xs sm:text-sm">
                  Açılan sayfayı biraz aşağı kaydırıp{" "}
                  <strong className="text-white inline-flex items-center gap-1 font-semibold">
                    <PlusSquare className="inline h-3.5 w-3.5 text-emerald-400" /> Ana Ekrana Ekle
                  </strong>{" "}
                  seçeneğine basın.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  3
                </span>
                <p className="text-xs sm:text-sm">
                  Sağ üst köşedeki <strong className="text-white font-semibold">"Ekle"</strong>{" "}
                  butonuna dokunun. KasımOğulları logosu telefonunuzun ana ekranında uygulama gibi
                  hazır olacaktır!
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-emerald-400 font-medium">
                Android / Chrome için 3 Kolay Adım:
              </p>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  1
                </span>
                <p className="text-xs sm:text-sm">
                  Tarayıcınızın sağ üst köşesindeki{" "}
                  <strong className="text-white font-semibold">üç nokta (⋮)</strong> menü simgesine
                  dokunun.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  2
                </span>
                <p className="text-xs sm:text-sm">
                  <strong className="text-white inline-flex items-center gap-1 font-semibold">
                    <Download className="inline h-3.5 w-3.5 text-emerald-400" /> Uygulamayı Yükle
                  </strong>{" "}
                  veya <strong className="text-white font-semibold">"Ana ekrana ekle"</strong>{" "}
                  seçeneğini seçin.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#166534] text-xs font-bold text-white">
                  3
                </span>
                <p className="text-xs sm:text-sm">
                  Onay penceresinde <strong className="text-white font-semibold">"Yükle"</strong>{" "}
                  butonuna basın. Uygulama telefonunuza kaydedilecektir.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-5">
          <Button
            onClick={onClose}
            className="w-full rounded-xl bg-[#166534] hover:bg-[#14532d] text-white font-semibold py-2.5 cursor-pointer"
          >
            <Check className="mr-1.5 h-4 w-4" />
            Anladım
          </Button>
        </div>
      </div>
    </div>
  );
}
