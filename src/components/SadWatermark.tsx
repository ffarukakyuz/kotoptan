import { memo } from "react";
import { SAD_WATERMARK_TEXT } from "@/lib/sad-watermark";

interface SadWatermarkProps {
  /**
   * Gösterim varyantı:
   * - "card": Ürün kartı arka planı
   * - "hero": Canlı vitrin slaytı arka planı
   * - "detail": Ürün detay sayfası görsel ve içerik arka planı
   * - "site": Site geneli tam sayfa zemin filigranı
   */
  variant?: "card" | "hero" | "detail" | "site";
  className?: string;
}

/**
 * Satış Bereket Filigranı (7 Adet Sad Harfi - صصصصصصص)
 *
 * Ürün kartının veya sayfanın arka planına %3 opaklıkta, tıklanamayan ve seçilemeyen
 * estetik Arapça el yazısı 7 adet Sad harfi yerleştirir.
 */
export const SadWatermark = memo(function SadWatermark({
  variant = "card",
  className = "",
}: SadWatermarkProps) {
  if (variant === "site") {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none fixed inset-0 z-0 overflow-hidden flex flex-wrap items-center justify-around gap-20 p-8 ${className}`}
        style={{
          opacity: 0.028, // ~%3 opaklık
          direction: "rtl",
        }}
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="text-4xl sm:text-6xl font-serif text-emerald-900 dark:text-emerald-400 rotate-[-15deg] tracking-widest"
            style={{
              fontFamily:
                "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
            }}
          >
            {SAD_WATERMARK_TEXT}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none absolute inset-0 z-0 overflow-hidden flex flex-col items-center justify-center gap-6 p-4 ${className}`}
        style={{
          opacity: 0.035, // ~%3.5 opaklık
          direction: "rtl",
        }}
      >
        <div
          className="text-6xl sm:text-8xl md:text-9xl font-serif text-emerald-950 dark:text-emerald-300 rotate-[-12deg] tracking-widest whitespace-nowrap"
          style={{
            fontFamily:
              "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          }}
        >
          {SAD_WATERMARK_TEXT}
        </div>
        <div
          className="text-4xl sm:text-6xl font-serif text-emerald-950 dark:text-emerald-300 rotate-[-12deg] tracking-widest whitespace-nowrap opacity-60"
          style={{
            fontFamily:
              "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          }}
        >
          {SAD_WATERMARK_TEXT}
        </div>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none absolute inset-0 z-0 overflow-hidden flex items-center justify-center ${className}`}
        style={{
          opacity: 0.032, // ~%3 opaklık
          direction: "rtl",
        }}
      >
        <div
          className="text-7xl sm:text-8xl font-serif text-emerald-950 dark:text-emerald-300 rotate-[-14deg] tracking-widest whitespace-nowrap select-none"
          style={{
            fontFamily:
              "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          }}
        >
          {SAD_WATERMARK_TEXT}
        </div>
      </div>
    );
  }

  // Varsayılan: "card" (Ürün kartı)
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 z-0 overflow-hidden flex items-center justify-center p-2 ${className}`}
      style={{
        opacity: 0.032, // ~%3 opaklık
        direction: "rtl",
      }}
    >
      <div
        className="text-4xl sm:text-5xl font-serif text-emerald-950 dark:text-emerald-300 rotate-[-14deg] tracking-widest whitespace-nowrap select-none"
        style={{
          fontFamily:
            "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
        }}
      >
        {SAD_WATERMARK_TEXT}
      </div>
    </div>
  );
});
