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
  is_active: boolean;
};
