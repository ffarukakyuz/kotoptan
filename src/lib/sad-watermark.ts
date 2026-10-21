/**
 * Satış Bereket Filigranı (7 Adet Sad Harfi - صصصصصصص) Yönetim ve Yardımcı Modülü
 *
 * Geleneksel ticarette bereket ve helal kazanç niyetiyle kullanılan 7 adet Sad harfi
 * ürün kartları ve sitenin arka planında zarif, göz yormayan (%3 opaklık) bir filigran olarak sunulur.
 */

export const SAD_WATERMARK_TEXT = "صصصصصصص";
export const SAD_WATERMARK_COUNT = 7;

export type SadWatermarkGlobalMode = "selected" | "all" | "off";

const GLOBAL_WATERMARK_STORAGE_KEY = "ko_sad_watermark_global_mode";

/**
 * Site geneli bereket filigranı ayarını okur:
 * - "selected": Yalnızca hasSadWatermark: true olan ürünlerde gösterilir (varsayılan).
 * - "all": Sitedeki tüm ürün kartlarında ve genel sayfa zemininde gösterilir.
 * - "off": Tamamen devre dışı bırakılır.
 */
export function getSadWatermarkGlobalMode(): SadWatermarkGlobalMode {
  if (typeof window === "undefined") return "selected";
  try {
    const saved = localStorage.getItem(GLOBAL_WATERMARK_STORAGE_KEY);
    if (saved === "all" || saved === "selected" || saved === "off") {
      return saved;
    }
  } catch {
    // ignore
  }
  return "selected";
}

/**
 * Site geneli bereket filigranı ayarını günceller ve olay tetikler
 */
export function setSadWatermarkGlobalMode(mode: SadWatermarkGlobalMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLOBAL_WATERMARK_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("sad_watermark_changed", { detail: { mode } }));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.warn("[setSadWatermarkGlobalMode] Error:", e);
  }
}

/**
 * Belirli bir ürün için bereket filigranının gösterilip gösterilmeyeceğini belirler
 */
export function shouldDisplaySadWatermark(product?: { hasSadWatermark?: boolean } | null): boolean {
  const mode = getSadWatermarkGlobalMode();
  if (mode === "off") return false;
  if (mode === "all") return true;
  return Boolean(product?.hasSadWatermark);
}
