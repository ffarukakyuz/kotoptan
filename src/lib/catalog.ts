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
