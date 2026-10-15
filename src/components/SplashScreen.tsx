import { useEffect, useState } from "react";
import { BRAND_LOGO_SRC } from "@/lib/branding";

interface SplashScreenProps {
  onFinish?: () => void;
  message?: string;
  minDuration?: number;
}

export function SplashScreen({
  onFinish,
  message = "Kotoptan — Oturum açılıyor...",
  minDuration = 800,
}: SplashScreenProps) {
  const [progress, setProgress] = useState(15);
  const [fadeOut, setFadeOut] = useState(false);
  const [showDirectButton, setShowDirectButton] = useState(false);

  useEffect(() => {
    // Akıcı ilerleme simülasyonu
    const timer1 = setTimeout(() => setProgress(45), 150);
    const timer2 = setTimeout(() => setProgress(85), 400);
    const timer3 = setTimeout(() => setProgress(100), Math.max(minDuration - 200, 600));

    // Yalnızca onFinish geri çağrımı verilmişse otomatik kararma yap; aksi halde yükleme bitene kadar ekranda kalmalı!
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    if (onFinish) {
      finishTimer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          onFinish();
        }, 350);
      }, minDuration);
    }

    // iPhone veya yavaş bağlantılarda 3 saniye sonra kullanıcıyı asla kilitli bırakma; doğrudan giriş butonu göster
    const emergencyTimer = setTimeout(() => {
      setShowDirectButton(true);
    }, 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (finishTimer) clearTimeout(finishTimer);
      clearTimeout(emergencyTimer);
    };
  }, [minDuration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center bg-[#050b07] text-white transition-opacity duration-300 select-none ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Arka plan koyu yeşil - siyah derin atmosferik ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22)_0%,rgba(5,11,7,0.98)_75%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm w-full">
        {/* Logo ve Animasyon Alanı */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/25 blur-2xl animate-pulse pointer-events-none" />

          <div className="relative flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-emerald-500/40 ring-4 ring-emerald-500/20 bg-[#040806] transition-transform duration-700 hover:scale-105">
            <img
              src={BRAND_LOGO_SRC}
              alt="Kotoptan Logo"
              className="h-full w-full object-cover animate-pulse"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Marka İsmi ve Tipografi: Ko beyaz, toptan zümrüt yeşili */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none mb-1 flex items-center justify-center">
          <span>
            Ko<span className="text-[#22c55e]">toptan</span>
          </span>
        </h1>
        <p className="text-[11px] sm:text-xs font-semibold text-emerald-400 tracking-wider uppercase mt-1 mb-6">
          Toptan Dağıtım
        </p>

        {/* İnce Modern İlerleme Çubuğu */}
        <div className="w-52 h-2 bg-black/60 rounded-full overflow-hidden mb-3.5 border border-emerald-500/25 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_16px_rgba(34,197,94,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Durum Metni */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <p className="text-xs sm:text-sm font-semibold text-white/85 tracking-wide">{message}</p>
        </div>

        {/* Mobil Acil Durum Butonu */}
        {showDirectButton && (
          <div className="mt-5 animate-in fade-in flex flex-col items-center gap-2">
            <a
              href="/giris"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
            >
              Giriş Ekranına Devam Et →
            </a>
            <p className="text-[10px] text-white/50">
              Cihazınızda yönlendirme geciktiyse butona dokunun
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
