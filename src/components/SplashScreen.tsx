import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish?: () => void;
  message?: string;
  minDuration?: number;
}

export function SplashScreen({
  onFinish,
  message = "KasımOğulları — Oturum açılıyor...",
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#060b08] text-white transition-opacity duration-300 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Arka plan yumuşak zümrüt radyal ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,rgba(6,11,8,0.95)_75%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        {/* Logo ve Animasyon Alanı (Kutu yerine logonun kendisi) */}
        <div className="relative mb-5 flex items-center justify-center">
          {/* Arkadaki yumuşak yeşil parlama */}
          <div className="absolute -inset-4 rounded-full bg-emerald-500/25 blur-2xl animate-pulse pointer-events-none" />

          {/* Yeni KasımOğulları Logosu */}
          <div className="relative flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(16,185,129,0.35)] border border-emerald-500/40 transition-transform duration-700 hover:scale-105">
            <img
              src="/kasimogullari-logo.jpg"
              alt="KasımOğulları Logo"
              className="h-full w-full object-cover animate-pulse"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Marka İsmi ve Tipografi */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1 flex items-center justify-center gap-1.5">
          <span>
            KASIM<span className="text-[#22c55e]">OĞULLARI</span>
          </span>
        </h1>
        <p className="text-xs font-bold tracking-wider uppercase text-emerald-400/90 mb-6">
          Ltd. Şti. • Tatvan Dağıtım Merkezi
        </p>

        {/* İnce Modern İlerleme Çubuğu */}
        <div className="w-52 h-2 bg-white/10 rounded-full overflow-hidden mb-3.5 border border-white/10 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_14px_rgba(34,197,94,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Durum Metni */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <p className="text-xs sm:text-sm font-semibold text-emerald-300 tracking-wide">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
