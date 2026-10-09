import type { Product } from "./catalog";
import { normalizeProductWithOverrides } from "./catalog";
import { FALLBACK_PRODUCTS } from "@/data/products";

const STORAGE_KEY = "custom_added_products";
const OVERRIDES_STORAGE_KEY = "custom_product_overrides";
const DELETED_IDS_STORAGE_KEY = "permanently_deleted_product_ids";

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
 * Kalıcı olarak silinmiş ürünlerin kimliklerini (ID) döndürür
 */
export function getPermanentlyDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id) => typeof id === "string"));
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Bir ürünün kalıcı olarak silinip silinmediğini kontrol eder
 */
export function isProductPermanentlyDeleted(productId?: string | null): boolean {
  if (!productId || typeof window === "undefined") return false;
  return getPermanentlyDeletedIds().has(productId);
}

/**
 * Bir ürünü kalıcı olarak siler:
 * 1. Kalıcı silinenler listesine (deletedIds) ekler.
 * 2. custom_added_products ve custom_product_overrides'tan siler.
 * 3. custom_product_archived_status ve stock durumlarından tamamen temizler.
 * Böylece ürün ne aktifte ne de arşivde ASLA geri gelmez.
 */
export function markProductPermanentlyDeleted(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    const deletedSet = getPermanentlyDeletedIds();
    deletedSet.add(productId);
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(deletedSet)));

    // 1. custom_added_products içinden kaldır
    const customList = getRawCustomProducts();
    const filteredCustom = customList.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredCustom));

    // 2. custom_product_overrides içinden kaldır
    const overrides = getProductOverrides();
    if (overrides[productId]) {
      delete overrides[productId];
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    }

    // 3. Arşiv haritasından kaldır (tekrar arşivde görünmemesi için!)
    const archRaw = localStorage.getItem("custom_product_archived_status");
    if (archRaw) {
      try {
        const archMap = JSON.parse(archRaw);
        if (archMap[productId] !== undefined) {
          delete archMap[productId];
          localStorage.setItem("custom_product_archived_status", JSON.stringify(archMap));
        }
      } catch {
        // ignore
      }
    }

    // 4. Stok haritasından kaldır
    const stockRaw = localStorage.getItem("custom_product_stock_status");
    if (stockRaw) {
      try {
        const stockMap = JSON.parse(stockRaw);
        if (stockMap[productId] !== undefined) {
          delete stockMap[productId];
          localStorage.setItem("custom_product_stock_status", JSON.stringify(stockMap));
        }
      } catch {
        // ignore
      }
    }

    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("[markProductPermanentlyDeleted] Error:", err);
  }
}

/**
 * Mevcut sabit ürünler (FALLBACK_PRODUCTS) üzerinde yapılan düzenleme değişikliklerini döndürür.
 * { [productId]: Product }
 */
export function getProductOverrides(): Record<string, Product> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, Product>;
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Bir ürün üzerindeki düzenlemeyi yerinde override olarak kaydeder
 */
export function saveProductOverride(product: Product): void {
  if (typeof window === "undefined" || !product?.id) return;
  try {
    const overrides = getProductOverrides();
    overrides[product.id] = product;
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("[saveProductOverride] Error:", err);
  }
}

function getRawCustomProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Sıfırdan eklenen yeni özel ürünleri yerel depolamadan okur.
 * Sabit listedeki ürünlerin override'larını buraya dahil etmez.
 */
export function getCustomProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const deletedIds = getPermanentlyDeletedIds();
    const parsed = getRawCustomProducts();

    // Sabit ürünlerin kimlik setini hazırla
    const fallbackIdSet = new Set(FALLBACK_PRODUCTS.map((p) => p.id));
    const overrides = getProductOverrides();
    let overridesChanged = false;

    // Peos, peros, bozuk ürünleri ve silinmiş ürünleri filtrele.
    // Eğer custom_added_products içinde sabit liste ürünü varsa (önceki versiyondan kalma edit hatası),
    // bunu overrides haritasına taşı ve custom_added_products'tan çıkar!
    const cleaned: Product[] = [];
    let customChanged = false;

    for (const p of parsed) {
      if (!p || !p.id) continue;
      if (deletedIds.has(p.id)) {
        customChanged = true;
        continue;
      }
      if (
        isBogusProductName(p.name) ||
        p.name.toLowerCase().includes("peos") ||
        p.name.toLowerCase().includes("peros")
      ) {
        customChanged = true;
        continue;
      }
      // Sabit katalog ürünüyse overrides içine aktar
      if (fallbackIdSet.has(p.id)) {
        overrides[p.id] = p;
        overridesChanged = true;
        customChanged = true;
        continue;
      }
      cleaned.push(p);
    }

    if (overridesChanged) {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    }
    if (customChanged || cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      window.dispatchEvent(new Event("catalog_updated"));
    }

    return cleaned;
  } catch {
    return [];
  }
}

/**
 * Ürünü kaydeder:
 * - Eğer ürün sabit listede (FALLBACK_PRODUCTS) yer alıyorsa:
 *   Yeni bir ürün gibi EN ÜSTE EKLEMEZ! Sabit listenin içindeki ürünün yerine override olarak yazar.
 * - Eğer ürün zaten custom bir ürünse:
 *   En başa sıçratmaz, kendi sırasındaki pozisyonunda günceller.
 * - Eğer sıfırdan "Yeni Ürün Ekle" ile eklenmişse:
 *   custom_added_products listesinin başına yeni ürün olarak ekler.
 */
export function saveCustomProduct(product: Product, isExplicitEdit = false): Product {
  if (typeof window === "undefined" || !product?.id) return product;
  try {
    const isFallbackItem = FALLBACK_PRODUCTS.some((fp) => fp.id === product.id);

    if (isFallbackItem) {
      // 1. Sabit ürün düzenleniyor: Overrides haritasına kaydet
      saveProductOverride(product);

      // custom_added_products içinde varsa temizle ki çift görünmesin
      const raw = getRawCustomProducts();
      const cleaned = raw.filter((p) => p.id !== product.id);
      if (cleaned.length !== raw.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
    } else {
      // 2. Özel ürün (custom): Var ise yerinde güncelle, yoksa başa ekle
      const existing = getRawCustomProducts();
      const existingIndex = existing.findIndex((p) => p.id === product.id);

      let updated: Product[];
      if (existingIndex >= 0) {
        // Yerinde güncelle (sırasını bozma)
        updated = existing.map((p, idx) => (idx === existingIndex ? product : p));
      } else if (isExplicitEdit) {
        // Düzenleme modunda ama bulunamadıysa yine de override olarak sakla
        saveProductOverride(product);
        return product;
      } else {
        // Yepyeni ürün ekleme: başa koy
        updated = [product, ...existing.filter((p) => p.id !== product.id)];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("[saveCustomProduct] Save error:", err);
  }
  return product;
}

/**
 * Eklenen ürünü yerel depodan siler (kalıcı silme işlemi)
 */
export function deleteCustomProduct(id: string): void {
  markProductPermanentlyDeleted(id);
}

/**
 * Tüm kataloğu eksiksiz, tek bir doğru kaynak olarak birleştirir:
 * 1. Kalıcı silinen ürünleri TAMAMEN dışarıda bırakır.
 * 2. Sabit ürünlerin üzerinde yapılan isim/fotoğraf/paket düzenlemelerini (overrides) yerinde uygular.
 * 3. Yeni eklenen özel ürünleri en başta listeler.
 * 4. Asla mükerrer veya çift ürün oluşturmaz.
 */
export function getAllCatalogProducts(): Product[] {
  const deletedIds = getPermanentlyDeletedIds();
  const overrides = getProductOverrides();
  const customProducts = getCustomProducts().filter((p) => !deletedIds.has(p.id));

  // Sabit ürünleri filtrele ve üzerindeki düzenlemeleri yerinde uygula
  const fallbackProducts = FALLBACK_PRODUCTS.filter(
    (p) =>
      !deletedIds.has(p.id) &&
      !isBogusProductName(p.name) &&
      !p.name.toLowerCase().includes("peos") &&
      !p.name.toLowerCase().includes("peros"),
  ).map((p) => {
    const override = overrides[p.id];
    const merged = override ? { ...p, ...override } : p;
    return normalizeProductWithOverrides(merged);
  });

  const normalizedCustom = customProducts.map(normalizeProductWithOverrides);

  return [...normalizedCustom, ...fallbackProducts];
}
