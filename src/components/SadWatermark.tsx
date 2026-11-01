import { memo } from "react";
import { SAD_WATERMARK_TEXT } from "@/lib/sad-watermark";

interface SadWatermarkProps {
  /**
   * Gösterim varyantı:
   * - "strip" / "card": Ürün kartının üst ince kısmına yerleşen, kartla birlikte hareket eden saydam hat
   * - "hero": Canlı vitrin slaytı üst ince kısmı
   * - "detail": Ürün detay sayfası görsel ve başlık alanı
   * - "site": Site geneli tam sayfa zemin filigranı
   */
  variant?: "strip" | "card" | "hero" | "detail" | "site";
  className?: string;
}

/**
 * Satış Bereket Filigranı (7 Adet Sad Harfi - صصصصصصص)
 *
 * Ürün kartının üst ince kısmına veya detay sayfasına zarif, saydam,
 * tıklamaları engellemeyen (%35 saydamlık) estetik Arapça 7 adet Sad harfi yerleştirir.
 */
export const SadWatermark = memo(function SadWatermark({
  variant = "strip",
  className = "",
}: SadWatermarkProps) {
  if (variant === "site") {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none fixed inset-0 z-0 overflow-hidden flex flex-wrap items-center justify-around gap-20 p-8 ${className}`}
        style={{
          opacity: 0.028,
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
        dir="rtl"
        className={`pointer-events-none select-none w-full flex items-center justify-center py-1.5 overflow-hidden ${className}`}
      >
        <span
          className="text-slate-800/12 dark:text-emerald-300/15 text-sm sm:text-base font-serif tracking-[0.25em] font-normal leading-none whitespace-nowrap select-none"
          style={{
            fontFamily:
              "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          }}
        >
          {SAD_WATERMARK_TEXT}
        </span>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div
        aria-hidden="true"
        dir="rtl"
        className={`pointer-events-none select-none w-full flex items-center justify-center py-0.5 overflow-hidden ${className}`}
      >
        <span
          className="text-slate-800/12 dark:text-emerald-300/15 text-xs sm:text-sm font-serif tracking-[0.25em] font-normal leading-none whitespace-nowrap select-none"
          style={{
            fontFamily:
              "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          }}
        >
          {SAD_WATERMARK_TEXT}
        </span>
      </div>
    );
  }

  // Varsayılan: "strip" / "card" (Ürün kartının üst ince kısmına yerleşen, kartla birlikte hareket eden saydam şerit)
  return (
    <div
      aria-hidden="true"
      dir="rtl"
      className={`pointer-events-none select-none w-full flex items-center justify-center -mt-0.5 sm:-mt-1 mb-1.5 py-0.5 overflow-hidden ${className}`}
    >
      <span
        className="text-slate-800/12 dark:text-emerald-300/15 text-xs sm:text-sm font-serif tracking-[0.25em] font-normal leading-none whitespace-nowrap select-none transition-opacity"
        style={{
          fontFamily:
            "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
        }}
      >
        {SAD_WATERMARK_TEXT}
      </span>
    </div>
  );
});
