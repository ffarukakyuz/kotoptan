export const CATEGORIES = [
  { value: "tumu", label: "Tümü" },
  { value: "gida", label: "Gıda" },
  { value: "bakliyat", label: "Bakliyat" },
  { value: "temizlik", label: "Temizlik" },
  { value: "kisisel", label: "Kişisel Bakım" },
] as const;

export const PRODUCT_CATEGORIES = CATEGORIES.filter((c) => c.value !== "tumu");

export function categoryLabel(value?: string | null): string {
  if (!value) return "";
  return CATEGORIES.find((c) => c.value === value)?.label ?? String(value || "");
}

export const UNITS = [
  { value: "adet", label: "Adet" },
  { value: "paket", label: "Paket" },
  { value: "koli", label: "Koli" },
  { value: "çuval", label: "Çuval" },
] as const;

export function formatUnitLabel(unit?: string | null): string {
  if (!unit) return "Adet";
  const trimmed = String(unit || "").trim();
  const lower = trimmed.toLowerCase();
  if (lower === "adet") return "Adet";
  if (lower === "paket") return "Paket";
  if (lower === "koli") return "Koli";
  if (lower === "çuval") return "Çuval";
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase("tr") + trimmed.slice(1) : "Adet";
}

export const ORDER_STATUSES = [
  { value: "yeni", label: "Yeni" },
  { value: "hazirlaniyor", label: "Hazırlanıyor" },
  { value: "yolda", label: "Yolda" },
  { value: "teslim", label: "Teslim edildi" },
  { value: "iptal", label: "İptal" },
] as const;

export function statusLabel(value?: string | null): string {
  if (!value) return "";
  return ORDER_STATUSES.find((s) => s.value === value)?.label ?? String(value || "");
}

export const DISTRICTS = [
  { value: "tatvan", label: "Tatvan" },
  { value: "bitlis", label: "Bitlis" },
  { value: "ahlat", label: "Ahlat" },
  { value: "adilcevaz", label: "Adilcevaz" },
  { value: "guroymak", label: "Güroymak" },
  { value: "hizan", label: "Hizan" },
] as const;

export function districtLabel(value?: string | null): string {
  if (!value) return "Tatvan";
  const trimmed = String(value || "").trim();
  const lower = trimmed.toLowerCase();
  if (lower === "ahlat_adilcevaz" || lower === "ahlat-adilcevaz" || lower === "ahlat & adilcevaz") {
    return "Ahlat & Adilcevaz";
  }
  if (lower === "bitlis merkez" || lower === "bitlis") {
    return "Bitlis";
  }
  const found = DISTRICTS.find(
    (d) =>
      d.value.toLowerCase() === lower ||
      d.label.toLowerCase() === lower ||
      (lower === "bitlis" && d.value === "bitlis"),
  );
  return found ? found.label : trimmed || "Tatvan";
}

// Yönetim siparişler ekranı için ilçe filtreleri (Ahlat ve Adilcevaz aynı gün sevkiyat rotasında birleşik gösterilir)
export const ADMIN_DISTRICT_FILTERS = [
  { value: "hepsi", label: "Tüm ilçeler" },
  { value: "tatvan", label: "Tatvan" },
  { value: "bitlis", label: "Bitlis" },
  { value: "ahlat_adilcevaz", label: "Ahlat & Adilcevaz" },
  { value: "guroymak", label: "Güroymak" },
  { value: "hizan", label: "Hizan" },
] as const;

export function matchesDistrictFilter(
  orderDistrict?: string | null,
  filterDistrict?: string | null,
): boolean {
  if (!filterDistrict || filterDistrict === "hepsi") return true;
  if (!orderDistrict) return false;
  const d = orderDistrict.toLowerCase().trim();
  if (filterDistrict === "ahlat_adilcevaz") {
    return (
      d === "ahlat" ||
      d === "adilcevaz" ||
      d === "ahlat_adilcevaz" ||
      d === "ahlat-adilcevaz" ||
      d === "ahlat & adilcevaz"
    );
  }
  if (filterDistrict === "bitlis" && (d === "bitlis" || d === "bitlis merkez")) {
    return true;
  }
  return d === filterDistrict.toLowerCase().trim();
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
  in_stock?: boolean;
  hasSadWatermark?: boolean;
};

export function cleanProductDescription(desc?: string | null): string {
  if (!desc) return "";
  return String(desc || "")
    .replace(/\[(TÜKENDİ|STOK_YOK)\]/gi, "")
    .trim();
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

let cachedArchivedMap: Record<string, boolean> | null = null;
let cachedStockMap: Record<string, boolean> | null = null;

function getArchivedMap(): Record<string, boolean> {
  if (cachedArchivedMap !== null) return cachedArchivedMap;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("custom_product_archived_status");
    if (!raw) {
      cachedArchivedMap = {};
    } else {
      const parsed = JSON.parse(raw);
      cachedArchivedMap =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
  } catch {
    cachedArchivedMap = {};
  }
  return cachedArchivedMap || {};
}

function getStockMap(): Record<string, boolean> {
  if (cachedStockMap !== null) return cachedStockMap;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("custom_product_stock_status");
    if (!raw) {
      cachedStockMap = {};
    } else {
      const parsed = JSON.parse(raw);
      cachedStockMap = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
  } catch {
    cachedStockMap = {};
  }
  return cachedStockMap || {};
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "custom_product_archived_status") cachedArchivedMap = null;
    if (e.key === "custom_product_stock_status") cachedStockMap = null;
  });
  window.addEventListener("catalog_updated", () => {
    cachedArchivedMap = null;
  });
  window.addEventListener("product_stock_status_changed", () => {
    cachedStockMap = null;
  });
}

/**
 * Normalizes products by applying custom packaging / unit overrides (e.g. shampoos sold as paket),
 * respecting local archive status overrides, and synchronizing stock status precisely down to fine details.
 */
export function normalizeProductWithOverrides(product: Product): Product {
  if (!product) return product;

  // 1. Yerel arşiv durumunu kontrol et
  let active = product.is_active !== false;
  if (typeof window !== "undefined" && product.id) {
    const archivedMap = getArchivedMap();
    if (archivedMap[product.id] !== undefined) {
      active = !archivedMap[product.id];
    }
  }

  // 2. Stok durumunu ince detaylara kadar tam eşitle
  const inStock = isProductInStock(product);
  const baseDesc = cleanProductDescription(product.description);
  const finalDesc = inStock ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

  const override = product.id ? PRODUCT_PACKAGING_CUSTOM_OVERRIDES[product.id] : undefined;
  if (override) {
    const customDesc = override.description ?? baseDesc;
    return {
      ...product,
      unit: override.unit ?? product.unit,
      description: inStock ? customDesc : `${customDesc} [TÜKENDİ]`,
      is_active: active,
      in_stock: inStock,
    };
  }

  const safeName = String(product.name || "");
  // Name based shampoo fallback if new shampoo products are added
  if (
    /şampuan|sampuan/i.test(safeName) &&
    /clear|dalin|elidor|blendax|pantene|head.*shoulder/i.test(safeName)
  ) {
    const isClear = /clear/i.test(safeName);
    const count = isClear ? 5 : 6;
    const shampooDesc = `Paket İçi: ${count} Adet`;
    return {
      ...product,
      unit: "paket",
      description: inStock ? shampooDesc : `${shampooDesc} [TÜKENDİ]`,
      is_active: active,
      in_stock: inStock,
    };
  }

  return {
    ...product,
    description: finalDesc,
    is_active: active,
    in_stock: inStock,
  };
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

  const safeProdName = String(productName || "");
  // Şampuanlar için otomatik Paket İçi kuralı
  if (safeProdName && /şampuan|sampuan/i.test(safeProdName)) {
    if (/clear/i.test(safeProdName)) return "Paket İçi: 5 Adet";
    if (/dalin/i.test(safeProdName)) return "Paket İçi: 6 Adet";
    if (/elidor/i.test(safeProdName)) return "Paket İçi: 6 Adet";
    if (/blendax/i.test(safeProdName)) return "Paket İçi: 6 Adet";
    if (/pantene/i.test(safeProdName)) return "Paket İçi: 6 Adet";
    if (/head.*shoulder/i.test(safeProdName)) return "Paket İçi: 6 Adet";
  }

  // Özel kural: Akel Yerli Pilavlık Pirinç koli içi 4 adettir
  if (safeProdName && /akel.*pirin[cç]/i.test(safeProdName)) {
    return "Koli İçi: 4 Adet";
  }

  const text = cleanProductDescription(desc);
  const safeUnit = String(unit || "");

  if (!text) {
    if (safeUnit && /(?:koli|paket|kutu)/i.test(safeUnit) && /\d+/.test(safeUnit)) {
      return safeUnit.trim();
    }
    return null;
  }

  // Eğer açıklama hem paket içi hem de koli içi bilgisini içeriyorsa (örn: "Paket İçi: 5 Adet · Koli İçi: 5 Paket (25 Adet)")
  // Öncelikle paket içi kısmını göster
  if (/(?:paket\s*içi|paket\s*ici)/i.test(text)) {
    const packMatch = text.match(
      /(?:paket\s*içi|paket\s*ici)\s*[:=-]?\s*([0-9]+\s*(?:adet|tane)?)/i,
    );
    if (packMatch && packMatch[0]) {
      return String(packMatch[0])
        .trim()
        .replace(/^paket/i, "Paket");
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

export function isProductArchived(product: { is_active?: boolean | null; id?: string }): boolean {
  if (product.id && typeof window !== "undefined") {
    try {
      const deletedRaw = localStorage.getItem("permanently_deleted_product_ids");
      if (deletedRaw) {
        const deletedArr = JSON.parse(deletedRaw);
        if (Array.isArray(deletedArr) && deletedArr.includes(product.id)) {
          return false;
        }
      }
      const archivedMap = getArchivedMap();
      if (archivedMap && archivedMap[product.id] !== undefined) {
        return Boolean(archivedMap[product.id]);
      }
    } catch {
      // ignore
    }
  }
  return product.is_active === false;
}

export function removeProductArchivedStatusLocal(productId: string) {
  if (typeof window !== "undefined" && productId) {
    try {
      const archivedMap = { ...getArchivedMap() };
      if (archivedMap[productId] !== undefined) {
        delete archivedMap[productId];
        cachedArchivedMap = archivedMap;
        localStorage.setItem("custom_product_archived_status", JSON.stringify(archivedMap));
        window.dispatchEvent(new Event("catalog_updated"));
        window.dispatchEvent(new Event("storage"));
      }
    } catch {
      // ignore
    }
  }
}

export function setProductArchivedStatusLocal(productId: string, isArchived: boolean) {
  if (typeof window !== "undefined" && productId) {
    try {
      const archivedMap = { ...getArchivedMap() };
      archivedMap[productId] = isArchived;
      cachedArchivedMap = archivedMap;
      localStorage.setItem("custom_product_archived_status", JSON.stringify(archivedMap));
      window.dispatchEvent(new Event("catalog_updated"));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  }
}

export function isProductInStock(product: {
  id?: string;
  description?: string | null;
  is_active?: boolean | null;
  in_stock?: boolean | null;
}): boolean {
  if (typeof window !== "undefined" && product.id) {
    const overrides = getStockMap();
    if (overrides[product.id] !== undefined) {
      return Boolean(overrides[product.id]);
    }
  }
  if (product.in_stock !== undefined && product.in_stock !== null) {
    return Boolean(product.in_stock);
  }
  if (product.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(product.description)) {
    return false;
  }
  return true;
}

export function setProductStockStatusLocal(productId: string, inStock: boolean) {
  if (typeof window !== "undefined" && productId) {
    try {
      // 1. Stok haritasını güncelle
      const stockMap = { ...getStockMap() };
      stockMap[productId] = inStock;
      cachedStockMap = stockMap;
      localStorage.setItem("custom_product_stock_status", JSON.stringify(stockMap));

      // 2. custom_product_overrides içindeki ürünü de ince detayına kadar eşitle
      const rawOverrides = localStorage.getItem("custom_product_overrides");
      if (rawOverrides) {
        try {
          const overrides = JSON.parse(rawOverrides);
          if (overrides && typeof overrides === "object") {
            const existing = overrides[productId] as Product | undefined;
            if (existing) {
              const baseDesc = cleanProductDescription(existing.description || "");
              overrides[productId] = {
                ...existing,
                in_stock: inStock,
                description: inStock ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]",
              };
              localStorage.setItem("custom_product_overrides", JSON.stringify(overrides));
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. custom_added_products içindeki ürünü de güncelle
      const rawCustom = localStorage.getItem("custom_added_products");
      if (rawCustom) {
        try {
          const customList = JSON.parse(rawCustom);
          if (Array.isArray(customList)) {
            let changed = false;
            const updated = customList.map((p: Product) => {
              if (p && p.id === productId) {
                changed = true;
                const baseDesc = cleanProductDescription(p.description || "");
                return {
                  ...p,
                  in_stock: inStock,
                  description: inStock
                    ? baseDesc
                    : baseDesc
                      ? `${baseDesc} [TÜKENDİ]`
                      : "[TÜKENDİ]",
                };
              }
              return p;
            });
            if (changed) {
              localStorage.setItem("custom_added_products", JSON.stringify(updated));
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. Tüm bileşenlere bildir
      window.dispatchEvent(new Event("product_stock_status_changed"));
      window.dispatchEvent(new Event("catalog_updated"));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  }
}
