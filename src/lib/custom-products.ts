import type { Product } from "./catalog";
import { normalizeProductWithOverrides } from "./catalog";
import { FALLBACK_PRODUCTS } from "@/data/products";
import staticDeletedData from "@/data/permanently-deleted.json";

const STORAGE_KEY = "custom_added_products";
const OVERRIDES_STORAGE_KEY = "custom_product_overrides";
const DELETED_IDS_STORAGE_KEY = "permanently_deleted_product_ids";
const DELETED_NAMES_STORAGE_KEY = "permanently_deleted_product_names";

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
 * Kullanıcının istemediği "Başhan" / "Bashan" başlıklı ürünleri ve bozuk ürünleri kesin olarak engeller
 */
export function isBannedProductName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return false;
  const n = name.toLowerCase().trim();
  if (n.includes("başhan") || n.includes("bashan")) return true;
  if (n.includes("peos") || n.includes("peros")) return true;
  return isBogusProductName(name);
}

let cachedDeletedIds: Set<string> | null = null;
let cachedDeletedNames: Set<string> | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DELETED_IDS_STORAGE_KEY) cachedDeletedIds = null;
    if (e.key === DELETED_NAMES_STORAGE_KEY) cachedDeletedNames = null;
  });
  window.addEventListener("catalog_updated", () => {
    cachedDeletedIds = null;
    cachedDeletedNames = null;
  });
}

/**
 * Kalıcı olarak silinmiş ürünlerin kimliklerini (ID) döndürür
 */
export function getPermanentlyDeletedIds(): Set<string> {
  if (cachedDeletedIds !== null) return cachedDeletedIds;

  const result = new Set<string>();

  // 1. Statik JSON dosyasından gelen silinmiş ID'ler (sunucu/derleme seviyesinde garantili)
  if (staticDeletedData && Array.isArray(staticDeletedData.deletedIds)) {
    for (const id of staticDeletedData.deletedIds) {
      if (typeof id === "string" && id.trim()) result.add(id.trim());
    }
  }

  // 2. Tarayıcı yerel deposundaki silinmiş ID'ler
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id === "string" && id.trim()) result.add(id.trim());
          }
        }
      }
    } catch {
      // ignore
    }
  }

  cachedDeletedIds = result;
  return result;
}

/**
 * Kalıcı olarak silinmiş ürünlerin adlarını döndürür (böylece silinen ürün asla geri gelmez)
 */
export function getPermanentlyDeletedNames(): Set<string> {
  if (cachedDeletedNames !== null) return cachedDeletedNames;

  const result = new Set<string>();

  // 1. Statik JSON dosyasından gelen silinmiş isimler
  if (staticDeletedData && Array.isArray(staticDeletedData.deletedNames)) {
    for (const name of staticDeletedData.deletedNames) {
      if (typeof name === "string" && name.trim()) {
        result.add(name.toLowerCase().trim());
      }
    }
  }

  // 2. Tarayıcı yerel deposundaki silinmiş isimler
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(DELETED_NAMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const n of parsed) {
            if (typeof n === "string" && n.trim()) {
              result.add(n.toLowerCase().trim());
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  cachedDeletedNames = result;
  return result;
}

/**
 * Bir ürünün kalıcı olarak silinip silinmediğini kontrol eder
 */
export function isProductPermanentlyDeleted(
  productId?: string | null,
  productName?: string | null,
): boolean {
  if (productId && getPermanentlyDeletedIds().has(productId)) return true;
  if (productName && getPermanentlyDeletedNames().has(productName.toLowerCase().trim()))
    return true;
  if (productName && isBannedProductName(productName)) return true;
  return false;
}

/**
 * Bir ürünü kalıcı olarak siler:
 * 1. Kalıcı silinenler listesine (deletedIds ve deletedNames) hem localStorage'a hem sunucuya ekler.
 * 2. custom_added_products ve custom_product_overrides'tan siler.
 * 3. custom_product_archived_status ve stock durumlarından tamamen temizler.
 * Böylece ürün ne aktifte ne de arşivde ASLA geri gelmez.
 */
export function markProductPermanentlyDeleted(
  productId: string,
  productName?: string | null,
): void {
  if (!productId) return;
  try {
    const deletedSet = getPermanentlyDeletedIds();
    deletedSet.add(productId);

    let namesSet: Set<string> | null = null;
    if (productName && typeof productName === "string" && productName.trim()) {
      namesSet = getPermanentlyDeletedNames();
      namesSet.add(productName.toLowerCase().trim());
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(deletedSet)));
      if (namesSet) {
        localStorage.setItem(DELETED_NAMES_STORAGE_KEY, JSON.stringify(Array.from(namesSet)));
      }

      // Sunucuya arka planda kalıcı olarak bildir (sayfa yenilense de sunucuda da silinsin)
      fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, name: productName || undefined }),
      }).catch((err) => {
        console.warn("[markProductPermanentlyDeleted] Server sync warning:", err);
      });

      // 1. custom_added_products içinden kaldır
      const customList = getRawCustomProducts();
      const filteredCustom = customList.filter(
        (p) =>
          p.id !== productId &&
          (!productName || p.name.toLowerCase().trim() !== productName.toLowerCase().trim()),
      );
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
    }
  } catch (err) {
    console.warn("[markProductPermanentlyDeleted] Error:", err);
  }
}

/**
 * Birden fazla ürünü tek seferde kalıcı olarak siler
 */
export function batchMarkProductsPermanentlyDeleted(
  items: { id: string; name?: string | null }[],
): void {
  if (!items || items.length === 0) return;
  try {
    const deletedSet = getPermanentlyDeletedIds();
    const namesSet = getPermanentlyDeletedNames();
    const itemsToSync: { id: string; name?: string }[] = [];

    for (const item of items) {
      if (item.id) {
        deletedSet.add(item.id);
        itemsToSync.push({ id: item.id, name: item.name || undefined });
      }
      if (item.name && typeof item.name === "string" && item.name.trim()) {
        namesSet.add(item.name.toLowerCase().trim());
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(deletedSet)));
      localStorage.setItem(DELETED_NAMES_STORAGE_KEY, JSON.stringify(Array.from(namesSet)));

      // Sunucuya toplu silme isteği
      fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSync }),
      }).catch((err) => {
        console.warn("[batchMarkProductsPermanentlyDeleted] Server sync warning:", err);
      });

      // Depolama temizliği
      cleanStoredProductsStorage();

      window.dispatchEvent(new Event("catalog_updated"));
      window.dispatchEvent(new Event("storage"));
    }
  } catch (err) {
    console.warn("[batchMarkProductsPermanentlyDeleted] Error:", err);
  }
}

/**
 * Sunucudaki kalıcı silinmiş ürünleri yerel depoyla senkronize eder
 */
export async function syncDeletedProductsWithServer(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/products/deleted");
    if (!res.ok) return;
    const data = (await res.json()) as {
      ok?: boolean;
      deletedIds?: string[];
      deletedNames?: string[];
    };
    if (!data.ok) return;

    let changed = false;
    const localIds = getPermanentlyDeletedIds();
    if (Array.isArray(data.deletedIds)) {
      for (const id of data.deletedIds) {
        if (id && !localIds.has(id)) {
          localIds.add(id);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(localIds)));
      }
    }

    const localNames = getPermanentlyDeletedNames();
    let nameChanged = false;
    if (Array.isArray(data.deletedNames)) {
      for (const n of data.deletedNames) {
        const norm = typeof n === "string" ? n.toLowerCase().trim() : "";
        if (norm && !localNames.has(norm)) {
          localNames.add(norm);
          nameChanged = true;
        }
      }
      if (nameChanged) {
        localStorage.setItem(DELETED_NAMES_STORAGE_KEY, JSON.stringify(Array.from(localNames)));
        changed = true;
      }
    }

    if (changed) {
      cleanStoredProductsStorage();
      window.dispatchEvent(new Event("catalog_updated"));
    }
  } catch {
    // ignore
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
    const inStock = product.in_stock !== undefined ? product.in_stock : true;
    const baseDesc = cleanProductDescription(product.description || "");
    const finalDesc = inStock ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    overrides[product.id] = {
      ...product,
      description: finalDesc,
      in_stock: inStock,
    };
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

    // Yerel stok haritasını da eşitle
    try {
      const rawStock = localStorage.getItem("custom_product_stock_status");
      const stockMap = rawStock ? JSON.parse(rawStock) : {};
      stockMap[product.id] = inStock;
      localStorage.setItem("custom_product_stock_status", JSON.stringify(stockMap));
    } catch {
      // ignore
    }

    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("product_stock_status_changed"));
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
    const deletedNames = getPermanentlyDeletedNames();
    const parsed = getRawCustomProducts();

    // Sabit ürünlerin kimlik setini hazırla
    const fallbackIdSet = new Set(FALLBACK_PRODUCTS.map((p) => p.id));
    const overrides = getProductOverrides();
    let overridesChanged = false;

    const cleaned: Product[] = [];
    let customChanged = false;

    for (const p of parsed) {
      if (!p || !p.id) continue;
      const normalizedName = p.name ? p.name.toLowerCase().trim() : "";
      if (deletedIds.has(p.id) || (normalizedName && deletedNames.has(normalizedName))) {
        customChanged = true;
        continue;
      }
      if (isBannedProductName(p.name)) {
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
  if (isBannedProductName(product.name)) {
    console.warn("[saveCustomProduct] Banned product rejected:", product.name);
    return product;
  }
  try {
    const inStock =
      product.in_stock !== undefined
        ? product.in_stock
        : !/\[(TÜKENDİ|STOK_YOK)\]/i.test(product.description || "");

    const baseDesc = cleanProductDescription(product.description || "");
    const finalDesc = inStock ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    const productWithStock: Product = {
      ...product,
      description: finalDesc,
      in_stock: inStock,
    };

    // Yerel stok haritasını eşitle
    try {
      const rawStock = localStorage.getItem("custom_product_stock_status");
      const stockMap = rawStock ? JSON.parse(rawStock) : {};
      stockMap[product.id] = inStock;
      localStorage.setItem("custom_product_stock_status", JSON.stringify(stockMap));
    } catch {
      // ignore
    }

    const isFallbackItem = FALLBACK_PRODUCTS.some((fp) => fp.id === product.id);

    if (isFallbackItem) {
      // 1. Sabit ürün düzenleniyor: Overrides haritasına kaydet
      saveProductOverride(productWithStock);

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
        updated = existing.map((p, idx) => (idx === existingIndex ? productWithStock : p));
      } else if (isExplicitEdit) {
        // Düzenleme modunda ama bulunamadıysa yine de override olarak sakla
        saveProductOverride(productWithStock);
        return productWithStock;
      } else {
        // Yepyeni ürün ekleme: başa koy
        updated = [productWithStock, ...existing.filter((p) => p.id !== product.id)];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("product_stock_status_changed"));
    window.dispatchEvent(new Event("storage"));
    return productWithStock;
  } catch (err) {
    console.warn("[saveCustomProduct] Save error:", err);
    return product;
  }
}

/**
 * Eklenen ürünü yerel depodan siler (kalıcı silme işlemi)
 */
export function deleteCustomProduct(id: string): void {
  markProductPermanentlyDeleted(id);
}

/**
 * Tüm kataloğu eksiksiz, tek bir doğru kaynak olarak birleştirir:
 * 1. Kalıcı silinen ürünleri TAMAMEN dışarıda bırakır (id veya isim bazında asla geri gelmez).
 * 2. "Başhan" başlıklı ve bozuk ürünleri kesin olarak eler.
 * 3. Sabit ürünlerin üzerinde yapılan isim/fotoğraf/paket düzenlemelerini (overrides) yerinde uygular.
 * 4. Yeni eklenen özel ürünleri en başta listeler.
 * 5. Asla mükerrer veya çift ürün oluşturmaz.
 */
export function getAllCatalogProducts(): Product[] {
  try {
    const deletedIds = getPermanentlyDeletedIds() || new Set();
    const deletedNames = getPermanentlyDeletedNames() || new Set();
    const overrides = getProductOverrides() || {};
    const rawCustom = getCustomProducts();
    const customProducts = (Array.isArray(rawCustom) ? rawCustom : []).filter(
      (p) =>
        p &&
        p.id &&
        !deletedIds.has(p.id) &&
        (!p.name || !deletedNames.has(p.name.toLowerCase().trim())) &&
        !isBannedProductName(p.name),
    );

    // Sabit ürünleri filtrele ve üzerindeki düzenlemeleri yerinde uygula
    const safeFallbackList = Array.isArray(FALLBACK_PRODUCTS) ? FALLBACK_PRODUCTS : [];
    const fallbackProducts = safeFallbackList
      .filter(
        (p) =>
          p &&
          p.id &&
          !deletedIds.has(p.id) &&
          (!p.name || !deletedNames.has(p.name.toLowerCase().trim())) &&
          !isBannedProductName(p.name),
      )
      .map((p) => {
        const override = overrides[p.id];
        const merged = override ? { ...p, ...override } : p;
        return normalizeProductWithOverrides(merged);
      });

    const normalizedCustom = customProducts.map(normalizeProductWithOverrides);
    return [...normalizedCustom, ...fallbackProducts];
  } catch (err) {
    console.warn("[getAllCatalogProducts] Error retrieving products, using clean fallback:", err);
    return (Array.isArray(FALLBACK_PRODUCTS) ? FALLBACK_PRODUCTS : []).map(
      normalizeProductWithOverrides,
    );
  }
}

/**
 * Başlangıçta depolamadaki silinen veya Başhan ürünleri temizler
 */
export function cleanStoredProductsStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const deletedIds = getPermanentlyDeletedIds();
    const deletedNames = getPermanentlyDeletedNames();

    // 1. custom_added_products temizliği
    const rawCustom = localStorage.getItem(STORAGE_KEY);
    if (rawCustom) {
      const parsed = JSON.parse(rawCustom);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (p) =>
            p &&
            p.id &&
            !deletedIds.has(p.id) &&
            (!p.name || !deletedNames.has(p.name.toLowerCase().trim())) &&
            !isBannedProductName(p.name),
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        }
      }
    }

    // 2. custom_product_overrides temizliği
    const rawOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (rawOverrides) {
      const overrides = JSON.parse(rawOverrides);
      if (overrides && typeof overrides === "object") {
        let changed = false;
        for (const [id, prod] of Object.entries(overrides)) {
          const p = prod as Product;
          if (
            deletedIds.has(id) ||
            (p?.name && deletedNames.has(p.name.toLowerCase().trim())) ||
            (p?.name && isBannedProductName(p.name))
          ) {
            delete overrides[id];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
        }
      }
    }
  } catch (err) {
    console.warn("[cleanStoredProductsStorage] Error:", err);
  }
}

if (typeof window !== "undefined") {
  setTimeout(() => {
    cleanStoredProductsStorage();
    void syncDeletedProductsWithServer();
  }, 30);
}
