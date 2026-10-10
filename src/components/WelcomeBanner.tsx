import { useEffect, useState } from "react";
import { X, MapPin, CheckCircle2, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PWAInstallModal } from "@/components/PWAInstallBanner";
import { BRAND_LOGO_SRC } from "@/lib/branding";
import { toast } from "sonner";

export function WelcomeBanner() {
  const { user, profile } = useAuth();
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    if (!user || dismissed) return;

    // Her oturumda sadece bir kez göster
    const sessionKey = `ko_welcomed_${user.id}`;
    try {
      if (typeof window !== "undefined") {
        const alreadyShown = sessionStorage.getItem(sessionKey);
        if (!alreadyShown) {
          const timer = setTimeout(() => {
            setVisible(true);
            sessionStorage.setItem(sessionKey, "true");
          }, 400);

          // 8 saniye sonra otomatik kapat
          const autoClose = setTimeout(() => {
            setVisible(false);
          }, 8000);

          return () => {
            clearTimeout(timer);
            clearTimeout(autoClose);
          };
        }
      }
    } catch {
      // ignore
    }
  }, [user, dismissed]);

  const handleShortcutClick = async () => {
    setVisible(false);
    setDismissed(true);

    if (isInstallable) {
      const installed = await install();
      if (installed) {
        toast.success("Uygulama başarıyla ana ekrana eklendi!");
        return;
      }
    }
    // Mobil veya tarayıcı rehberi modalını aç
    setShowInstallGuide(true);
  };

  const displayName =
    profile?.business_name ||
    profile?.full_name ||
    user?.email?.split("@")[0] ||
    "Değerli Müşterimiz";
  const district =
    profile?.district || (profile?.address?.includes("Tatvan") ? "Tatvan" : "Bitlis");

  return (
    <>
      {visible && user && (
        <div className="fixed top-18 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#0c1812] via-[#09140e] to-[#040806] p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-md">
            {/* Arka plan ışık vurgusu */}
            <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md border border-emerald-500/30">
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="Kotoptan Logo"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Giriş Yapıldı
                  </span>
                  <h3 className="text-sm font-extrabold text-white truncate max-w-[210px]">
                    Hoş Geldiniz, {displayName}!
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVisible(false);
                  setDismissed(true);
                }}
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2.5 text-xs text-white/75 leading-relaxed relative z-10">
              Kotoptan toptan kataloğuna hoş geldiniz. Hızlı sipariş ve tek tıkla erişim için
              ana ekrana kısayol ekleyebilirsiniz.
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-xs relative z-10">
              <span className="flex items-center gap-1 font-semibold text-emerald-300 text-[11px]">
                <MapPin className="h-3 w-3 text-emerald-400" />
                {district} Bölgesi
              </span>

              <button
                type="button"
                onClick={handleShortcutClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-3 py-1.5 text-[11px] font-bold text-white transition-all shadow-xs cursor-pointer ring-1 ring-emerald-400/40"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-200" />
                Ana Ekrana Kısayol Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstallGuide && (
        <PWAInstallModal isIOS={isIOS} onClose={() => setShowInstallGuide(false)} />
      )}
    </>
  );
}
