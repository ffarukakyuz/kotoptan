export type FMCGProductInfo = {
  name: string;
  category: "gida" | "bakliyat" | "temizlik" | "kisisel";
  unit: string;
  koliIci: string;
  description: string;
};

/**
 * Türkiye toptan FMCG (Hızlı Tüketim Malları) piyasası standart koli, paket ve kategori bilgi bankası.
 * KasımOğulları Tatvan toptan deposunun ürün standartlarına göre optimize edilmiştir.
 */
export const FMCG_STANDARDS: Array<{
  keywords: string[];
  template: FMCGProductInfo;
}> = [
  // --- ŞAMPUAN & SAÇ BAKIM ---
  {
    keywords: ["clear", "sampuan", "şampuan", "men", "cool", "kepek"],
    template: {
      name: "Clear Şampuan 350 Ml",
      category: "kisisel",
      unit: "Paket",
      koliIci: "Paket İçi: 5 Adet (Koli İçi: 5 Paket / 25 Adet)",
      description: "Paket İçi: 5 Adet (Koli İçi: 5 Paket / 25 Adet). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["elidor", "sampuan", "şampuan"],
    template: {
      name: "Elidor Şampuan 400 Ml",
      category: "kisisel",
      unit: "Paket",
      koliIci: "Paket İçi: 6 Adet (Koli İçi: 24 Adet)",
      description: "Paket İçi: 6 Adet (Koli İçi: 4 Paket / 24 Adet). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["dalin", "bebek", "sampuan", "şampuan"],
    template: {
      name: "Dalin Bebek Şampuan",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 6 Adet",
      description: "Koli İçi: 6 Adet. Göz yakmayan özel formül. Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["pantene", "sampuan", "şampuan"],
    template: {
      name: "Pantene Şampuan 400 Ml",
      category: "kisisel",
      unit: "Paket",
      koliIci: "Paket İçi: 6 Adet (Koli İçi: 24 Adet)",
      description: "Paket İçi: 6 Adet (Koli İçi: 24 Adet). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["blendax", "sampuan", "şampuan"],
    template: {
      name: "Blendax Şampuan 500 Ml",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet. Tatvan depomuzda toptan satışa hazır.",
    },
  },
  {
    keywords: ["head", "shoulders", "sampuan", "şampuan"],
    template: {
      name: "Head & Shoulders Şampuan 360 Ml",
      category: "kisisel",
      unit: "Paket",
      koliIci: "Paket İçi: 6 Adet (Koli İçi: 24 Adet)",
      description: "Paket İçi: 6 Adet (Koli İçi: 24 Adet). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["ipek", "sampuan", "şampuan"],
    template: {
      name: "İpek Şampuan 480 Ml",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet. Saf bitki özlü toptan şampuan.",
    },
  },
  {
    keywords: ["haci", "hacı", "sakir", "şakir", "sampuan", "şampuan"],
    template: {
      name: "Hacı Şakir Şampuan 500 Ml",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet. Bal ve badem özlü geleneksel şampuan.",
    },
  },

  // --- SABUN & KİŞİSEL BAKIM ---
  {
    keywords: ["duru", "sabun"],
    template: {
      name: "Duru Naturel Kalıp Sabun (4'lü Paket)",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 18 Paket (72 Kalıp)",
      description: "Koli İçi: 18 Paket (72 Kalıp). Tatvan toptan depomuzda mevcut.",
    },
  },
  {
    keywords: ["haci", "hacı", "sakir", "şakir", "sabun"],
    template: {
      name: "Hacı Şakir Saf Sabun (4'lü)",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 24 Paket",
      description: "Koli İçi: 24 Paket. Doğal beyaz banyo sabunu.",
    },
  },
  {
    keywords: ["sivi", "sıvı", "sabun"],
    template: {
      name: "Sıvı Sabun 4 Lt",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 4 Adet",
      description: "Koli İçi: 4 Adet (4x4 Lt). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["dis", "diş", "macun", "colgate", "signal", "sensodyne"],
    template: {
      name: "Diş Macunu 75 Ml",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 24 Adet",
      description: "Koli İçi: 24 Adet. Market ve bakkallara toptan teslimat.",
    },
  },
  {
    keywords: ["islak", "ıslak", "mendil", "sleepy", "baby"],
    template: {
      name: "Islak Mendil 120'li Kapaklı",
      category: "kisisel",
      unit: "Koli",
      koliIci: "Koli İçi: 24 Paket",
      description: "Koli İçi: 24 Paket. Kapaklı toptan ıslak mendil.",
    },
  },

  // --- ÇAY ÇEŞİTLERİ ---
  {
    keywords: ["tiryaki", "caykur", "çaykur"],
    template: {
      name: "Çaykur Tiryaki Çay 1000g",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 10 Adet (10x1 Kg)",
      description:
        "Koli İçi: 10 Adet (10x1 Kg). Rize'nin en çok tercih edilen tiryaki harmanı. Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["rize", "turist", "caykur", "çaykur"],
    template: {
      name: "Çaykur Rize Turist Çay 1000g",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 10 Adet (10x1 Kg)",
      description: "Koli İçi: 10 Adet (10x1 Kg). Klasik sarı paket Çaykur Rize çayı.",
    },
  },
  {
    keywords: ["kamelya", "caykur", "çaykur"],
    template: {
      name: "Çaykur Kamelya Çay 1000g",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 10 Adet (10x1 Kg)",
      description: "Koli İçi: 10 Adet (10x1 Kg). Yumuşak içimli açık çay harmanı.",
    },
  },
  {
    keywords: ["filiz", "caykur", "çaykur"],
    template: {
      name: "Çaykur Filiz Çay 1000g",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 10 Adet (10x1 Kg)",
      description: "Koli İçi: 10 Adet (10x1 Kg). Özel ilk hasat filiz yaprak çay.",
    },
  },
  {
    keywords: ["dogus", "doğuş", "cay", "çay"],
    template: {
      name: "Doğuş Filiz Çay 1 Kg",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Karadeniz harmanı toptan çay.",
    },
  },
  {
    keywords: ["lipton", "yellow", "label", "cay", "çay"],
    template: {
      name: "Lipton Yellow Label Çay 1 Kg",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Tatvan depomuzda mevcut.",
    },
  },

  // --- BAKLİYAT (PİRİNÇ, MERCİMEK, NOHUT, BULGUR) ---
  {
    keywords: ["baldo", "pirinc", "pirinç"],
    template: {
      name: "Başhan Gönen Baldo Pirinç 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description:
        "Koli İçi: 12 Adet (12x1 Kg). 1. sınıf yerli Gönen baldo pirinç. Tatvan depomuzda hazır.",
    },
  },
  {
    keywords: ["osmancik", "osmancık", "pirinc", "pirinç"],
    template: {
      name: "Başhan Osmancık Pirinç 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Trakya yöresi Osmancık pirinç.",
    },
  },
  {
    keywords: ["pirinc", "pirinç", "5 kg"],
    template: {
      name: "Akel Yerli Pilavlık Pirinç 5 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 5 Adet (5x5 Kg)",
      description: "Koli İçi: 5 Adet (5x5 Kg). Aile boyu pilavlık pirinç koli.",
    },
  },
  {
    keywords: ["kirmizi", "kırmızı", "mercimek"],
    template: {
      name: "Başhan Kırmızı Mercimek 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). 1. kalite yaprak kırmızı mercimek.",
    },
  },
  {
    keywords: ["yesil", "yeşil", "mercimek"],
    template: {
      name: "Başhan Yeşil Mercimek 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Yozgat/Konya yöresi yeşil mercimek.",
    },
  },
  {
    keywords: ["mercimek", "25 kg", "cuval", "çuval"],
    template: {
      name: "Başhan Kabuklu Mercimek 25 Kg",
      category: "bakliyat",
      unit: "Çuval",
      koliIci: "1 Çuval (25 Kg)",
      description: "Çuval (25 Kg). Depodan dökme toptan çuval mercimek.",
    },
  },
  {
    keywords: ["nohut"],
    template: {
      name: "Başhan Koçbaşı Nohut 1 Kg (8mm)",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Hızlı pişen iri koçbaşı nohut.",
    },
  },
  {
    keywords: ["fasulye", "kuru fasulye", "dermason"],
    template: {
      name: "Başhan Dermason Kuru Fasulye 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). İnce kabuklu Dermason kuru fasulye.",
    },
  },
  {
    keywords: ["bulgur"],
    template: {
      name: "Başhan Pilavlık Bulgur 1 Kg",
      category: "bakliyat",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet (12x1 Kg)",
      description: "Koli İçi: 12 Adet (12x1 Kg). Sarı durum buğdayı pilavlık bulgur.",
    },
  },

  // --- BULAŞIK & ÇAMAŞIR TEMİZLİK ---
  {
    keywords: ["fairy", "bulasik", "bulaşık", "1500"],
    template: {
      name: "Fairy Bulaşık Deterjanı 1500 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 9 Adet",
      description: "Koli İçi: 9 Adet (9x1500 Ml). Yağ çözücü limonlu konsantre bulaşık deterjanı.",
    },
  },
  {
    keywords: ["fairy", "bulasik", "bulaşık", "650"],
    template: {
      name: "Fairy Limon Sıvı Bulaşık Deterjanı 650 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 16 Adet",
      description: "Koli İçi: 16 Adet (16x650 Ml). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["fairy", "bulasik", "bulaşık", "2600"],
    template: {
      name: "Fairy Bulaşık Deterjanı 2600 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 6 Adet",
      description: "Koli İçi: 6 Adet (6x2600 Ml). Ekonomik büyük boy toptan bulaşık deterjanı.",
    },
  },
  {
    keywords: ["bingo", "bulasik", "bulaşık"],
    template: {
      name: "Bingo Bulaşık Deterjanı 1500 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 9 Adet",
      description: "Koli İçi: 9 Adet (9x1500 Ml). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["bingo", "bulasik", "bulaşık", "4 lt"],
    template: {
      name: "Bingo Bulaşık Deterjanı 4 Lt",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 4 Adet",
      description: "Koli İçi: 4 Adet (4x4 Lt). Endüstriyel ve ekonomik toptan boy.",
    },
  },
  {
    keywords: ["ace", "camasir", "çamaşır", "suyu"],
    template: {
      name: "Ace Çamaşır Suyu 1 Lt",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 18 Adet",
      description: "Koli İçi: 18 Adet (18x1 Lt). Klasik hijyenik çamaşır suyu.",
    },
  },
  {
    keywords: ["domestos", "750"],
    template: {
      name: "Domestos Çamaşır Suyu 750 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 20 Adet",
      description: "Koli İçi: 20 Adet (20x750 Ml). Yoğun kıvamlı maksimum hijyen çamaşır suyu.",
    },
  },
  {
    keywords: ["domestos"],
    template: {
      name: "Domestos Yoğun Kıvamlı Çamaşır Suyu 1850 Ml",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 6 Adet",
      description: "Koli İçi: 6 Adet (6x1850 Ml). Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["omo", "ariel", "alo", "toz", "deterjan"],
    template: {
      name: "Ariel Dağ Esintisi Toz Deterjan 4 Kg",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 4 Adet",
      description: "Koli İçi: 4 Adet (4x4 Kg). Otomatik çamaşır makinesi toptan deterjanı.",
    },
  },
  {
    keywords: ["asperox", "sari", "sarı", "guc", "güç"],
    template: {
      name: "Asperox Sarı Güç Çok Amaçlı 1 Lt",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet (12x1 Lt). 5 saniyede yağ sökücü sprey.",
    },
  },
  {
    keywords: ["porcoz", "porçöz", "kirec", "kireç"],
    template: {
      name: "Porçöz Pas ve Kireç Çözücü 1 Lt",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet (12x1 Lt). Güçlü kireç çözücü formül.",
    },
  },
  {
    keywords: ["teno", "tuvalet", "kagidi", "kağıdı"],
    template: {
      name: "Teno Tuvalet Kağıdı 32'li",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 2 Paket (64 Rulo)",
      description: "Koli İçi: 2 Paket (64 Rulo). Çift katlı yumuşak toptan tuvalet kağıdı.",
    },
  },
  {
    keywords: ["havlu", "kagit", "kağıt", "teno", "solo"],
    template: {
      name: "Teno Kağıt Havlu 12'li",
      category: "temizlik",
      unit: "Koli",
      koliIci: "Koli İçi: 3 Paket (36 Rulo)",
      description: "Koli İçi: 3 Paket (36 Rulo). Emici toptan kağıt havlu.",
    },
  },

  // --- SALÇA, MAKARNA & TEMEL GIDA ---
  {
    keywords: ["burcu", "salca", "salça", "830"],
    template: {
      name: "Burcu Domates Salçası 830 Gr",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 12 Adet",
      description: "Koli İçi: 12 Adet (12x830 Gr). Teneke kutu 1. kalite domates salçası.",
    },
  },
  {
    keywords: ["burcu", "salca", "salça", "1500"],
    template: {
      name: "Burcu Salça 1500 Gr Domates",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 6 Adet",
      description: "Koli İçi: 6 Adet (6x1500 Gr). Cam kavanoz toptan salça.",
    },
  },
  {
    keywords: ["tukas", "tukaş", "biber", "salca", "salça"],
    template: {
      name: "Tukaş Biber Salçası 1650 Gr Tatlı",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 6 Adet",
      description: "Koli İçi: 6 Adet (6x1650 Gr). Tatvan depomuzda toptan teslimata hazır.",
    },
  },
  {
    keywords: ["filiz", "makarna", "burgu", "spagetti", "arpa"],
    template: {
      name: "Filiz Makarna 500 Gr",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 20 Adet",
      description: "Koli İçi: 20 Adet (20x500 Gr). %100 Türk buğdayı toptan makarna.",
    },
  },
  {
    keywords: ["yudum", "orkide", "biryag", "biryağ", "aycicek", "ayçiçek", "yag", "yağ"],
    template: {
      name: "Orkide Ayçiçek Yağı 5 Lt Köşeli Pet",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 4 Adet (4x5 Lt)",
      description: "Koli İçi: 4 Adet (4x5 Lt). 1. kalite rafine ayçiçek yağı.",
    },
  },
  {
    keywords: ["seker", "şeker", "toz seker", "toz şeker", "50 kg"],
    template: {
      name: "Balküpü Toz Şeker 50 Kg Çuval",
      category: "gida",
      unit: "Çuval",
      koliIci: "1 Çuval (50 Kg)",
      description: "Çuval (50 Kg). %100 pancar şekeri toptan çuval. Tatvan depomuzda mevcut.",
    },
  },
  {
    keywords: ["kup", "küp", "seker", "şeker"],
    template: {
      name: "Balküpü Küp Şeker 1 Kg",
      category: "gida",
      unit: "Koli",
      koliIci: "Koli İçi: 20 Adet (20x1 Kg)",
      description: "Koli İçi: 20 Adet (20x1 Kg). 360 adetlik tek sargılı/dökme küp şeker.",
    },
  },
  {
    keywords: ["un", "50 kg", "25 kg"],
    template: {
      name: "Özel Amaçlı Buğday Unu 50 Kg Çuval",
      category: "gida",
      unit: "Çuval",
      koliIci: "1 Çuval (50 Kg)",
      description: "Çuval (50 Kg). Ekmeklik ve böreklik 1. kalite toptan un.",
    },
  },
];

/**
 * Dosya adı, çözünürlük veya anlamsız rastgele kod içeren bozuk ürün adlarını filtreler
 */
export function isInvalidProductInput(str: string): boolean {
  if (!str || typeof str !== "string") return true;
  const s = str.trim().toLowerCase();
  if (
    s.includes("30000002") ||
    s.includes("1650x1650") ||
    s.includes("0b1937") ||
    s.includes("1650")
  ) {
    return true;
  }
  // Çözünürlük veya kamera dosya isimleri
  if (/\b\d{3,4}x\d{3,4}\b/.test(s)) return true;
  if (/^\d{6,}/.test(s)) return true;
  if (/^(img|pxl|dsc|screenshot|photo|file|image)[\s_-]/i.test(s)) return true;
  // Sadece sayı ve hex karakterlerinden oluşan anlamsız isimler
  const words = s.split(/[\s_-]+/);
  const hexOrNumWords = words.filter((w) => /^[a-f0-9]{4,}$/i.test(w) || /^\d+$/.test(w));
  if (words.length > 0 && hexOrNumWords.length === words.length) return true;
  return false;
}

/**
 * Metin, görsel dosya adı veya kullanıcı notunu analiz ederek en doğru FMCG ürün bilgilerini çıkarır
 */
export function deduceFMCGProduct(inputQuery: string): FMCGProductInfo {
  // Eğer giriş anlamsız bir dosya adı veya çözünürlük ise (örn: 30000002 0b1937 1650x1650) temizle
  const isBogus = isInvalidProductInput(inputQuery || "");
  const effectiveQuery = isBogus ? "" : inputQuery;

  const norm = (effectiveQuery || "")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  // 1. Bilgi bankasından en yüksek eşleşen standardı bul
  let bestMatch: FMCGProductInfo | null = null;
  let maxScore = 0;

  for (const item of FMCG_STANDARDS) {
    let score = 0;
    for (const kw of item.keywords) {
      const normKw = kw
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");
      if (norm.includes(normKw)) {
        score += normKw.length >= 4 ? 10 : 5;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item.template;
    }
  }

  if (bestMatch && maxScore >= 5) {
    // Eğer kullanıcı özel bir gramaj veya marka belirttiyse adını uyarla
    let customName = bestMatch.name;
    if (effectiveQuery && effectiveQuery.trim().length > 3 && !effectiveQuery.startsWith("data:")) {
      const cleanUserText = effectiveQuery
        .replace(/[_-]/g, " ")
        .replace(/\.[a-zA-Z0-9]+$/, "")
        .trim();
      if (
        cleanUserText.length <= 40 &&
        !isInvalidProductInput(cleanUserText) &&
        !cleanUserText.toLowerCase().includes("image") &&
        !cleanUserText.toLowerCase().includes("foto")
      ) {
        customName = cleanUserText
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }
    }

    return {
      ...bestMatch,
      name: customName,
    };
  }

  // 2. Kategori bazlı genel tespit
  let cat: FMCGProductInfo["category"] = "gida";
  let unit = "Koli";
  let koliIci = "Koli İçi: 12 Adet";

  if (
    norm.includes("sampuan") ||
    norm.includes("sabun") ||
    norm.includes("kisisel") ||
    norm.includes("bakim") ||
    norm.includes("krem") ||
    norm.includes("losyon") ||
    norm.includes("kolonya")
  ) {
    cat = "kisisel";
    unit = "Paket";
    koliIci = "Paket İçi: 6 Adet (Koli İçi: 24 Adet)";
  } else if (
    norm.includes("deterjan") ||
    norm.includes("camasir") ||
    norm.includes("bulasik") ||
    norm.includes("temiz") ||
    norm.includes("kirec") ||
    norm.includes("yag coz") ||
    norm.includes("yumusatici") ||
    norm.includes("pecete") ||
    norm.includes("havlu")
  ) {
    cat = "temizlik";
    unit = "Koli";
    koliIci = "Koli İçi: 12 veya 16 Adet";
  } else if (
    norm.includes("pirinc") ||
    norm.includes("mercimek") ||
    norm.includes("nohut") ||
    norm.includes("fasulye") ||
    norm.includes("bulgur") ||
    norm.includes("barbunya")
  ) {
    cat = "bakliyat";
    unit = "Koli";
    koliIci = "Koli İçi: 12 Adet (12x1 Kg)";
  }

  const rawInput =
    effectiveQuery && !effectiveQuery.startsWith("data:") ? effectiveQuery.trim() : "";
  let finalName = "Yeni Depo Ürünü";
  if (rawInput && !isInvalidProductInput(rawInput)) {
    const cleaned = rawInput
      .replace(/[_-]/g, " ")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .trim();
    if (cleaned.length > 2 && !isInvalidProductInput(cleaned)) {
      finalName = cleaned
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return {
    name: finalName,
    category: cat,
    unit,
    koliIci,
    description: `${koliIci}. KasımOğulları Tatvan toptan depomuzda stokta ve sevkiyata hazır.`,
  };
}
