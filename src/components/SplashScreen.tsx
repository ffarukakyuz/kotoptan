import { useEffect, useState } from "react";
import { Package, Sparkles } from "lucide-react";

interface SplashScreenProps {
  onFinish?: () => void;
  message?: string;
  minDuration?: number;
}

export function SplashScreen({
  onFinish,
  message = "Toptan Satış Kataloğu Hazırlanıyor...",
  minDuration = 800,
}: SplashScreenProps) {
  const [progress, setProgress] = useState(15);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Akıcı ilerleme simülasyonu
    const timer1 = setTimeout(() => setProgress(45), 150);
    const timer2 = setTimeout(() => setProgress(85), 400);
    const timer3 = setTimeout(() => setProgress(100), minDuration - 200);

    const finishTimer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        onFinish?.();
      }, 350);
    }, minDuration);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(finishTimer);
    };
  }, [minDuration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050a07] text-white transition-opacity duration-300 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Arka plan yumuşak radyal ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        {/* Parıldayan Logo Rozeti */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-3xl bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 border border-emerald-400/40 shadow-[0_10px_35px_rgba(5,150,105,0.35)] transform transition-transform duration-700 hover:scale-105">
            <Package className="h-10 w-10 text-white drop-shadow-md animate-bounce" />
            <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow-md">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Marka İsmi ve Tipografi */}
        <h1 className="text-2xl font-black tracking-tight text-white mb-1.5 flex items-center justify-center gap-1.5">
          <span>KASIMOĞULLARI</span>
        </h1>
        <p className="text-xs font-semibold tracking-wider uppercase text-emerald-400 mb-6">
          Ltd. Şti. • Tatvan Dağıtım Merkezi
        </p>

        {/* İnce Modern İlerleme Çubuğu */}
        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mb-3 border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Durum Metni */}
        <p className="text-[11px] font-medium text-white/60 tracking-wide">
          {message}
        </p>
      </div>
    </div>
  );
}
