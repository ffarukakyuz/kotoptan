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

export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "prod-dalan-sabun",
    name: "Dalan Gliserinli Sabun 600 Gr",
    description: "Doğal bitkisel gliserinli kalıp sabun. Koli içi 24 paket.",
    category: "temizlik",
    unit: "4x150 Gr",
    image_url: "/products/dalan_gliserinli_sabun_1790110969698.jpg",
    is_active: true,
  },
  {
    id: "prod-aycicek-yagi",
    name: "Ayçiçek Yağı 5 L",
    description: "Saf ayçiçek yağı, koli içi 4 adet 5 litrelik pet.",
    category: "gida",
    unit: "koli (4 adet)",
    image_url: "/products/aycicek-yagi.jpg",
    is_active: true,
  },
  {
    id: "prod-kirmizi-mercimek",
    name: "Kırmızı Mercimek 25 kg",
    description: "Yerli üretim, temizlenmiş birinci kalite kırmızı mercimek.",
    category: "bakliyat",
    unit: "çuval",
    image_url: "/products/kirmizi-mercimek.jpg",
    is_active: true,
  },
  {
    id: "prod-baldo-pirinc",
    name: "Baldo Pirinç 25 kg",
    description: "Gönen yöresi baldo pirinç, 25 kg toptan çuval.",
    category: "bakliyat",
    unit: "çuval",
    image_url: "/products/akel-pirinc-5kg.png",
    is_active: true,
  },
  {
    id: "prod-camasir-suyu",
    name: "Çamaşır Suyu 4 L",
    description: "Yoğun kıvamlı klorlu hijyenik çamaşır suyu, koli içi 4 adet.",
    category: "temizlik",
    unit: "koli (4 adet)",
    image_url: "/products/doa-camasir-suyu-35kg.png",
    is_active: true,
  },
  {
    id: "prod-salca-830g",
    name: "Domates Salçası 830 g",
    description: "Çift konsantre domates salçası, koli içi 12 teneke kutu.",
    category: "gida",
    unit: "koli (12 adet)",
    image_url: "/products/domates-salcasi.jpg",
    is_active: true,
  },
  {
    id: "prod-kuru-fasulye",
    name: "Dermason Kuru Fasulye 25 kg",
    description: "Hızlı pişen iri taneli dermason kuru fasulye.",
    category: "bakliyat",
    unit: "çuval",
    image_url: "/products/fasulye.jpg",
    is_active: true,
  },
  {
    id: "prod-toz-seker",
    name: "Kristal Toz Şeker 50 kg",
    description: "Pancar şekeri, 50 kg polipropilen çuval.",
    category: "gida",
    unit: "çuval",
    image_url: "/products/toz-seker.jpg",
    is_active: true,
  },
  {
    id: "prod-nohut-iri",
    name: "İri Koçbaşı Nohut 25 kg",
    description: "9mm boylu yerli koçbaşı nohut.",
    category: "bakliyat",
    unit: "çuval",
    image_url: "/products/nohut.jpg",
    is_active: true,
  },
  {
    id: "prod-yuzey-temizleyici",
    name: "Yüzey Temizleyici 5 L",
    description: "Kalıcı parfümlü genel zemin ve yüzey temizleyici.",
    category: "temizlik",
    unit: "koli (4 adet)",
    image_url: "/products/doa-yuzey-temizleyici-25l.jpg",
    is_active: true,
  },
  {
    id: "prod-makarna-burgu",
    name: "Burgu Makarna 500 g",
    description: "%100 durum buğdayı irmiğinden, koli içi 20 paket.",
    category: "gida",
    unit: "koli (20 adet)",
    image_url: "/products/burgu.jpg",
    is_active: true,
  },
  {
    id: "prod-tuvalet-kagidi",
    name: "Tuvalet Kağıdı 32'li",
    description: "Çift katlı yumuşak dokulu tuvalet kağıdı, 32 rulo paket.",
    category: "temizlik",
    unit: "paket (32 rulo)",
    image_url: "/products/teno-tuvalet-kagidi-32li.jpg",
    is_active: true,
  },
];
