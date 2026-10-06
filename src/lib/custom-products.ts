import type { Product } from "./catalog";

const STORAGE_KEY = "custom_added_products";

/**
 * Dosya adı, çözünürlük veya anlamsız rastgele kod içeren bozuk ürün adlarını filtreler
 */
export function isBogusProductName(name: string): boolean {
  if (!name || typeof name !== "string") return true;
  const n = name.toLowerCase().trim();
  if (
    n.includes("30000002") ||
    n.includes("1650x1650") ||
    n.includes("0b1937") ||
    n.includes("peos") ||
    n.includes("peros")
  ) {
    return true;
  }
  // Çözünürlük formatı (Örn: 1650x1650, 1080x1920)
  if (/\b\d{3,4}x\d{3,4}\b/.test(n)) return true;
  // Çok uzun sayı veya hex kodları (Örn: 30000002, 0b1937)
  if (/^\d{6,}/.test(n)) return true;
  if (/^(img|pxl|dsc|screenshot|photo|file|image)[\s_-]/i.test(n)) return true;
  // Sadece sayı ve hex karakterlerinden oluşan anlamsız isimler
  const words = n.split(/\s+/);
  const hexOrNumWords = words.filter((w) => /^[a-f0-9]{4,}$/i.test(w) || /^\d+$/.test(w));
  if (words.length > 0 && hexOrNumWords.length === words.length) return true;
  return false;
}

/**
 * Kullanıcı veya AI tarafından fotoğraf yüklenerek eklenen ürünleri yerel depolamadan okur.
 * Hatalı, peos/peros veya bozuk ürünleri kalıcı olarak otomatik temizler.
 */
export function getCustomProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Peos, peros ve bozuk ürünleri kalıcı olarak tamamen temizle
    const cleaned = parsed.filter(
      (p) =>
        p &&
        !isBogusProductName(p.name) &&
        !p.name.toLowerCase().includes("peos") &&
        !p.name.toLowerCase().includes("peros"),
    );

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      window.dispatchEvent(new Event("catalog_updated"));
    }

    // Arşiv tablosundaki peos/peros izlerini de temizle
    try {
      const archRaw = localStorage.getItem("custom_product_archived_status");
      if (archRaw) {
        const archMap = JSON.parse(archRaw);
        let changed = false;
        for (const k of Object.keys(archMap)) {
          if (k.toLowerCase().includes("peros") || k.toLowerCase().includes("peos")) {
            delete archMap[k];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem("custom_product_archived_status", JSON.stringify(archMap));
        }
      }
    } catch {
      // ignore
    }

    return cleaned;
  } catch {
    return [];
  }
}

// Sayfa yüklendiğinde otomatik hafıza temizliği yap
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const purged = parsed.filter(
          (p) =>
            p &&
            !p.name.toLowerCase().includes("peos") &&
            !p.name.toLowerCase().includes("peros") &&
            !isBogusProductName(p.name),
        );
        if (purged.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(purged));
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Yeni ürünü yerel depoya kaydeder ve tüm açık sayfalara / bileşenlere 'catalog_updated' sinyali gönderir
 */
export function saveCustomProduct(product: Product): Product {
  if (typeof window === "undefined") return product;
  try {
    const existing = getCustomProducts();
    const updated = [product, ...existing.filter((p) => p.id !== product.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("[saveCustomProduct] Local storage save error:", err);
  }
  return product;
}

/**
 * Eklenen ürünü yerel depodan siler
 */
export function deleteCustomProduct(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCustomProducts();
    const updated = existing.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("[deleteCustomProduct] Local storage delete error:", err);
  }
}
