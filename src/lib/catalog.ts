import { FALLBACK_PRODUCTS } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  { value: "tumu", label: "Tümü" },
  { value: "gida", label: "Gıda" },
  { value: "bakliyat", label: "Bakliyat" },
  { value: "temizlik", label: "Temizlik" },
  { value: "kisisel", label: "Kişisel Bakım" },
] as const;

export const PRODUCT_CATEGORIES = CATEGORIES.filter((c) => c.value !== "tumu");

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const UNITS = [
  { value: "adet", label: "Adet" },
  { value: "paket", label: "Paket" },
  { value: "koli", label: "Koli" },
  { value: "çuval", label: "Çuval" },
] as const;

export const ORDER_STATUSES = [
  { value: "yeni", label: "Yeni" },
  { value: "hazirlaniyor", label: "Hazırlanıyor" },
  { value: "yolda", label: "Yolda" },
  { value: "teslim", label: "Teslim edildi" },
  { value: "iptal", label: "İptal" },
] as const;

export function statusLabel(value: string) {
  return ORDER_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export const DISTRICTS = [
  { value: "ahlat", label: "Ahlat" },
  { value: "adilcevaz", label: "Adilcevaz" },
  { value: "bitlis", label: "Bitlis" },
  { value: "guroymak", label: "Güroymak" },
  { value: "hizan", label: "Hizan" },
  { value: "tatvan", label: "Tatvan" },
] as const;

export function districtLabel(value: string) {
  return DISTRICTS.find((d) => d.value === value)?.label ?? (value || "Belirtilmedi");
}

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  image_url: string | null;
  image?: string | null;
  is_active: boolean;
};

export function cleanProductDescription(desc?: string | null): string {
  if (!desc) return "";
  return desc.replace(/\[(TÜKENDİ|STOK_YOK)\]/gi, "").trim();
}

/**
 * Custom product packaging info overrides for specific products.
 * Shampoos (Clear, Dalin, Elidor, Blendax, Pantene, Head & Shoulders, etc.) are sold in packages (paket)
 * and display 'Paket İçi' count.
 */
const PRODUCT_PACKAGING_CUSTOM_OVERRIDES: Record<
  string,
  { unit?: string; description?: string; badge?: string }
> = {
  // Clear Şampuan 350 Ml
  "d2e9cf78-f14c-4873-bded-b2d981d1e944": {
    unit: "paket",
    description: "Paket İçi: 5 Adet (Koli İçi: 5 Paket)",
    badge: "Paket İçi: 5 Adet",
  },
  // Dalin Bebek Şampuan
  "ed283301-4c6a-44d3-bd06-14c7ebe9a68a": {
    unit: "paket",
    description: "Paket İçi: 6 Adet (Koli İçi: 4 Paket)",
    badge: "Paket İçi: 6 Adet",
  },
  // Elidor Şampuan 400 Ml
  "fbe7dd79-418e-495e-a87a-cc60b1ad5ee1": {
    unit: "paket",
    description: "Paket İçi: 6 Adet (Koli İçi: 4 Paket)",
    badge: "Paket İçi: 6 Adet",
  },
  // Blendax Şampuan 500 Ml
  "b2eff754-1113-406b-a18b-adf8483b349c": {
    unit: "paket",
    description: "Paket İçi: 6 Adet (Koli İçi: 2 Paket)",
    badge: "Paket İçi: 6 Adet",
  },
  // Pantene Şampuan 400 Ml
  "8d60ddce-0c97-4451-96d2-1681fca6e7cd": {
    unit: "paket",
    description: "Paket İçi: 6 Adet (Koli İçi: 4 Paket)",
    badge: "Paket İçi: 6 Adet",
  },
  // Head & Shoulders Şampuan
  "5c81bfbf-ec16-47ca-bdec-6e74015a83f1": {
    unit: "paket",
    description: "Paket İçi: 6 Adet (Koli İçi: 4 Paket)",
    badge: "Paket İçi: 6 Adet",
  },
};

/**
 * Normalizes products by applying custom packaging / unit overrides (e.g. shampoos sold as paket).
 */
export function normalizeProductWithOverrides(product: Product): Product {
  if (!product) return product;
  const override = product.id ? PRODUCT_PACKAGING_CUSTOM_OVERRIDES[product.id] : undefined;
  if (override) {
    return {
      ...product,
      unit: override.unit ?? product.unit,
      description: override.description ?? product.description,
    };
  }

  // Name based shampoo fallback if new shampoo products are added
  if (
    /şampuan|sampuan/i.test(product.name) &&
    /clear|dalin|elidor|blendax|pantene|head.*shoulder/i.test(product.name)
  ) {
    const isClear = /clear/i.test(product.name);
    const count = isClear ? 5 : 6;
    return {
      ...product,
      unit: "paket",
      description: `Paket İçi: ${count} Adet`,
    };
  }

  return product;
}

/**
 * Extracts box / package quantity information (e.g. "Paket İçi: 5 Adet", "Koli İçi: 24 Adet", "12'li Koli")
 * from the product description or unit if available.
 * Returns null if no box/koli/package information is present.
 */
export function extractPackageOrBoxInfo(
  desc?: string | null,
  unit?: string | null,
  productName?: string | null,
  productId?: string | null,
): string | null {
  if (productId && PRODUCT_PACKAGING_CUSTOM_OVERRIDES[productId]?.badge) {
    return PRODUCT_PACKAGING_CUSTOM_OVERRIDES[productId].badge!;
  }

  // Şampuanlar için otomatik Paket İçi kuralı
  if (productName && /şampuan|sampuan/i.test(productName)) {
    if (/clear/i.test(productName)) return "Paket İçi: 5 Adet";
    if (/dalin/i.test(productName)) return "Paket İçi: 6 Adet";
    if (/elidor/i.test(productName)) return "Paket İçi: 6 Adet";
    if (/blendax/i.test(productName)) return "Paket İçi: 6 Adet";
    if (/pantene/i.test(productName)) return "Paket İçi: 6 Adet";
    if (/head.*shoulder/i.test(productName)) return "Paket İçi: 6 Adet";
  }

  // Özel kural: Akel Yerli Pilavlık Pirinç koli içi 4 adettir
  if (productName && /akel.*pirin[cç]/i.test(productName)) {
    return "Koli İçi: 4 Adet";
  }

  const text = cleanProductDescription(desc);

  if (!text) {
    if (unit && /(?:koli|paket|kutu)/i.test(unit) && /\d+/.test(unit)) {
      return unit.trim();
    }
    return null;
  }

  // Eğer açıklama hem paket içi hem de koli içi bilgisini içeriyorsa (örn: "Paket İçi: 5 Adet · Koli İçi: 5 Paket (25 Adet)")
  // Öncelikle paket içi kısmını göster
  if (/(?:paket\s*içi|paket\s*ici)/i.test(text)) {
    const packMatch = text.match(
      /(?:paket\s*içi|paket\s*ici)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane)?)/i,
    );
    if (packMatch) {
      return packMatch[0].trim().replace(/^paket/i, "Paket");
    }
  }

  // Look for patterns like:
  // "Paket İçi: 5 Adet"
  // "Koli İçi : 24 Adet"
  // "Koli İçi: 12 Adet"
  // "Koli İçi 24"
  // "1 Koli: 24 Adet"
  // "Koli: 24 Adet"
  // "24'lü Koli"
  const patterns = [
    /(?:paket\s*içi|paket\s*ici)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane|gr|kg|ml|lt|l|paket)?)/i,
    /(?:koli\s*içi|koli\s*ici|kutu\s*içi|koli\s*adedi)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane|gr|kg|ml|lt|l|paket)?)/i,
    /(?:1\s*koli\s*(?:içi|içinde)?)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane|gr|kg|ml|lt|l)?)/i,
    /([0-9]+['’]?(?:li|lı|lu|lü)\s*(?:koli|paket))/i,
    /(?:koli\s*miktarı|koli\s*miktari)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane)?)/i,
    /(koli\s*[:=-]\s*[0-9]+\s*(?:adet|tane)?)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const captured = match[0].trim();
      // Capitalize first letter properly in Turkish
      return captured.charAt(0).toLocaleUpperCase("tr") + captured.slice(1);
    }
  }

  // Also check if the entire description is short and specifically about box/pack count
  if (text.length <= 40 && /(koli|paket|kutu|\badet\b)/i.test(text) && /\d+/.test(text)) {
    return text.trim();
  }

  return null;
}

export function isProductArchived(product: { is_active?: boolean | null }): boolean {
  return product.is_active === false;
}

export function isProductInStock(product: {
  id?: string;
  description?: string | null;
  is_active?: boolean | null;
}): boolean {
  if (typeof window !== "undefined" && product.id) {
    try {
      const overrides = JSON.parse(localStorage.getItem("custom_product_stock_status") || "{}");
      if (overrides[product.id] !== undefined) {
        return Boolean(overrides[product.id]);
      }
    } catch {
      // ignore
    }
  }
  if (product.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(product.description)) {
    return false;
  }
  return true;
}

export function setProductStockStatusLocal(productId: string, inStock: boolean) {
  if (typeof window !== "undefined") {
    try {
      const overrides = JSON.parse(localStorage.getItem("custom_product_stock_status") || "{}");
      overrides[productId] = inStock;
      localStorage.setItem("custom_product_stock_status", JSON.stringify(overrides));
      window.dispatchEvent(new Event("product_stock_status_changed"));
    } catch {
      // ignore
    }
  }
}

export const CUSTOM_ADDED_PRODUCTS_KEY = "ko_custom_added_products";
export const CUSTOM_PRODUCT_UPDATES_KEY = "ko_custom_product_updates";
export const CUSTOM_DELETED_PRODUCT_IDS_KEY = "ko_custom_deleted_product_ids";

export function getCustomAddedProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_ADDED_PRODUCTS_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}

export function getCustomProductUpdates(): Record<string, Partial<Product>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CUSTOM_PRODUCT_UPDATES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Product>>) : {};
  } catch {
    return {};
  }
}

export function getCustomDeletedProductIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_DELETED_PRODUCT_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Loads all catalog products, seamlessly merging:
 * 1. Static 197 fallback products
 * 2. Supabase live database products
 * 3. LocalStorage custom added & updated products
 * 4. Filter out any permanently deleted products
 */
export async function fetchCatalogProducts(): Promise<Product[]> {
  let dbProducts: Product[] = [];
  try {
    const { data, error } = await supabase.from("products").select("*");
    if (!error && Array.isArray(data) && data.length > 0) {
      dbProducts = data as Product[];
    }
  } catch (err) {
    console.warn("[fetchCatalogProducts] Supabase fetch error:", err);
  }

  const map = new Map<string, Product>();

  // 1. Base static products
  for (const p of FALLBACK_PRODUCTS) {
    map.set(p.id, { ...p });
  }

  // 2. Supabase products
  for (const p of dbProducts) {
    map.set(p.id, { ...p });
  }

  // 3. LocalStorage custom added products
  const localAdded = getCustomAddedProducts();
  for (const p of localAdded) {
    map.set(p.id, { ...p });
  }

  // 4. LocalStorage custom edits (updates & archive status)
  const localUpdates = getCustomProductUpdates();
  for (const [id, updates] of Object.entries(localUpdates)) {
    const existing = map.get(id);
    if (existing) {
      map.set(id, { ...existing, ...updates });
    }
  }

  // 5. Filter out deleted products
  const deletedIds = new Set(getCustomDeletedProductIds());
  for (const id of deletedIds) {
    map.delete(id);
  }

  const all = Array.from(map.values()).map(normalizeProductWithOverrides);

  // Newly added local products come first
  const localAddedIds = new Set(localAdded.map((p) => p.id));
  return all.sort((a, b) => {
    const aNew = localAddedIds.has(a.id);
    const bNew = localAddedIds.has(b.id);
    if (aNew && !bNew) return -1;
    if (!aNew && bNew) return 1;
    return 0;
  });
}

/**
 * Loads a single product by ID from catalog
 */
export async function fetchSingleCatalogProduct(id: string): Promise<Product | null> {
  const all = await fetchCatalogProducts();
  return all.find((p) => p.id === id) || null;
}

/**
 * Saves (creates or updates) a product. Persists immediately in localStorage
 * and syncs with Supabase if online.
 */
export async function saveCatalogProduct(
  payload: {
    name: string;
    category: string;
    unit: string;
    description: string;
    image_url?: string | null;
    is_active?: boolean;
  },
  editingId?: string | null,
): Promise<Product> {
  const id = editingId || `ko-prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const product: Product = {
    id,
    name: payload.name.trim(),
    category: payload.category.trim(),
    unit: payload.unit.trim(),
    description: payload.description.trim(),
    image_url: payload.image_url || null,
    is_active: payload.is_active !== undefined ? payload.is_active : true,
  };

  if (typeof window !== "undefined") {
    try {
      if (editingId) {
        const updates = getCustomProductUpdates();
        updates[editingId] = { ...product };
        localStorage.setItem(CUSTOM_PRODUCT_UPDATES_KEY, JSON.stringify(updates));

        const added = getCustomAddedProducts();
        const idx = added.findIndex((p) => p.id === editingId);
        if (idx !== -1) {
          added[idx] = product;
          localStorage.setItem(CUSTOM_ADDED_PRODUCTS_KEY, JSON.stringify(added));
        }
      } else {
        const added = getCustomAddedProducts();
        added.unshift(product);
        localStorage.setItem(CUSTOM_ADDED_PRODUCTS_KEY, JSON.stringify(added));
      }

      // Ensure not marked deleted
      const deleted = getCustomDeletedProductIds().filter((dId) => dId !== id);
      localStorage.setItem(CUSTOM_DELETED_PRODUCT_IDS_KEY, JSON.stringify(deleted));

      window.dispatchEvent(new Event("products_catalog_changed"));
    } catch (storageErr) {
      console.warn("[saveCatalogProduct] LocalStorage save error:", storageErr);
    }
  }

  // Also attempt Supabase upsert in background
  try {
    if (editingId) {
      await supabase.from("products").update(product).eq("id", editingId);
    } else {
      await supabase.from("products").insert(product);
    }
  } catch (sbErr) {
    console.warn("[saveCatalogProduct] Supabase background save notice:", sbErr);
  }

  return product;
}

/**
 * Archives or restores a product
 */
export async function archiveCatalogProduct(productId: string, is_active: boolean): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      const updates = getCustomProductUpdates();
      updates[productId] = { ...(updates[productId] || {}), is_active };
      localStorage.setItem(CUSTOM_PRODUCT_UPDATES_KEY, JSON.stringify(updates));

      const added = getCustomAddedProducts();
      const idx = added.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        added[idx]!.is_active = is_active;
        localStorage.setItem(CUSTOM_ADDED_PRODUCTS_KEY, JSON.stringify(added));
      }

      window.dispatchEvent(new Event("products_catalog_changed"));
    } catch (storageErr) {
      console.warn("[archiveCatalogProduct] LocalStorage archive error:", storageErr);
    }
  }

  try {
    await supabase.from("products").update({ is_active }).eq("id", productId);
  } catch (err) {
    console.warn("[archiveCatalogProduct] Supabase archive notice:", err);
  }
}

/**
 * Permanently deletes a product
 */
export async function deleteCatalogProductPermanently(productId: string): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      const added = getCustomAddedProducts().filter((p) => p.id !== productId);
      localStorage.setItem(CUSTOM_ADDED_PRODUCTS_KEY, JSON.stringify(added));

      const updates = getCustomProductUpdates();
      delete updates[productId];
      localStorage.setItem(CUSTOM_PRODUCT_UPDATES_KEY, JSON.stringify(updates));

      const deleted = getCustomDeletedProductIds();
      if (!deleted.includes(productId)) {
        deleted.push(productId);
        localStorage.setItem(CUSTOM_DELETED_PRODUCT_IDS_KEY, JSON.stringify(deleted));
      }

      window.dispatchEvent(new Event("products_catalog_changed"));
    } catch (storageErr) {
      console.warn("[deleteCatalogProductPermanently] LocalStorage delete error:", storageErr);
    }
  }

  try {
    await supabase.from("products").delete().eq("id", productId);
  } catch (err) {
    console.warn("[deleteCatalogProductPermanently] Supabase delete notice:", err);
  }
}
