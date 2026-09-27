// Auto-generated product image mapping for production & local hosting (/resimler/)

export const KNOWN_IMAGE_FILENAMES = [
  "ahsap-temizleyici.jpg",
  "akel-pirinc-5kg.png",
  "arap-sabunu.jpg",
  "arpa-sehriye.jpg",
  "asurelik-bugday-25kg.png",
  "asurelik-bugday-5kg.webp",
  "aycicek-yagi.jpg",
  "barbunya.jpg",
  "bebek-bezi.jpg",
  "bezelye.jpg",
  "biber-salcasi.jpg",
  "bonbon.jpg",
  "bugday.jpg",
  "bulasik-deterjani.jpg",
  "bulasik-tablet.jpg",
  "burgu.jpg",
  "camasir-suyu.jpg",
  "cam-sil.jpg",
  "cay-bardagi.jpg",
  "cay.jpg",
  "cevizli-sucuk.jpg",
  "cilek-receli.jpg",
  "dalan_gliserinli_sabun_1790110969698.jpg",
  "doa-camasir-suyu-35kg.png",
  "doa-yuzey-temizleyici-25l.jpg",
  "domates-salcasi.jpg",
  "eriste.jpg",
  "fairy-limon-650ml.jpg",
  "familia-plus-natural-havlu.webp",
  "fasulye.jpg",
  "fasulye-konserve.jpg",
  "garnitur.jpg",
  "gofret.jpg",
  "helva.jpg",
  "ince-midyat-pilavlik-bulgur.png",
  "incir-receli.jpg",
  "iri-pilavlik-bulgur.png",
  "islak-mendil.jpg",
  "kagit-havlu.jpg",
  "kahve.jpg",
  "kalip-sabun.jpg",
  "kayisi-receli.jpg",
  "kelebek.jpg",
  "ketcap.jpg",
  "kirec-cozucu.jpg",
  "kirmizi-mercimek.jpg",
  "koftelik-bulgur.png",
  "kolonya.jpg",
  "lavabo-acici.jpg",
  "leke-cikarici.jpg",
  "lokum.jpg",
  "makine-parlatici.jpg",
  "manti.jpg",
  "matik.jpg",
  "mayonez.jpg",
  "misir-konserve.jpg",
  "misir-tane.jpg",
  "nohut.jpg",
  "pecete.jpg",
  "penne.jpg",
  "pilavlik-bulgur.png",
  "pirinc.jpg",
  "pul-biber.jpg",
  "sac-kremi.jpg",
  "sampuan.jpg",
  "sehriyeli-bulgur.png",
  "sivi-sabun.jpg",
  "spagetti.jpg",
  "su-bardagi.jpg",
  "tel-sehriye.jpg",
  "temizlik-kremi.jpg",
  "teno-tuvalet-kagidi-32li.jpg",
  "toz-deterjan.jpg",
  "toz-seker.jpg",
  "tursu.jpg",
  "tuvalet-kagidi.jpg",
  "un.jpg",
  "visne-receli.jpg",
  "yag-cozucu.jpg",
  "yesil-mercimek.jpg",
  "yumusatici.jpg",
  "yuzey-temizleyici.jpg",
  "zeytin.jpg",
];

// Direct mapping dictionary for filenames pointing directly to physical public assets
export const PRODUCT_IMAGE_MAP: Record<string, string> = Object.fromEntries([
  ...KNOWN_IMAGE_FILENAMES.map((fn) => [fn, `/resimler/${fn}`]),
  ...KNOWN_IMAGE_FILENAMES.map((fn) => [`/${fn}`, `/${fn}`]),
  ...KNOWN_IMAGE_FILENAMES.map((fn) => [`/resimler/${fn}`, `/resimler/${fn}`]),
  ...KNOWN_IMAGE_FILENAMES.map((fn) => [`/products/${fn}`, `/products/${fn}`]),
]);

interface KeywordRule {
  all?: string[];
  any?: string[];
  path: string;
}

// Keyword mapping for specific products with priority
const PRODUCT_KEYWORD_RULES: KeywordRule[] = [
  // Specific brand / combination items
  {
    all: ["dalan", "gliserinli"],
    path: "/resimler/dalan_gliserinli_sabun_1790110969698.jpg",
  },
  { all: ["dalan", "roxy"], path: "/resimler/toz-deterjan.jpg" },
  { all: ["doa", "yüzey"], path: "/resimler/doa-yuzey-temizleyici-25l.jpg" },
  { all: ["doa", "yuzey"], path: "/resimler/doa-yuzey-temizleyici-25l.jpg" },
  { all: ["doa", "çamaşır"], path: "/resimler/doa-camasir-suyu-35kg.png" },
  { all: ["doa", "camasir"], path: "/resimler/doa-camasir-suyu-35kg.png" },
  { all: ["fairy", "limon"], path: "/resimler/fairy-limon-650ml.jpg" },
  { all: ["akel", "pirinç"], path: "/resimler/akel-pirinc-5kg.png" },
  { all: ["akel", "pirinc"], path: "/resimler/akel-pirinc-5kg.png" },
  {
    all: ["familia", "havlu"],
    path: "/resimler/familia-plus-natural-havlu.webp",
  },
  { all: ["teno", "tuvalet"], path: "/resimler/teno-tuvalet-kagidi-32li.jpg" },
  { all: ["şehriyeli", "bulgur"], path: "/resimler/sehriyeli-bulgur.png" },
  { all: ["sehriyeli", "bulgur"], path: "/resimler/sehriyeli-bulgur.png" },
  { all: ["iri", "bulgur"], path: "/resimler/iri-pilavlik-bulgur.png" },
  { all: ["köftelik", "bulgur"], path: "/resimler/koftelik-bulgur.png" },
  { all: ["koftelik", "bulgur"], path: "/resimler/koftelik-bulgur.png" },
  { all: ["pilavlık", "bulgur"], path: "/resimler/pilavlik-bulgur.png" },
  { all: ["pilavlik", "bulgur"], path: "/resimler/pilavlik-bulgur.png" },
  { all: ["kırmızı", "mercimek"], path: "/resimler/kirmizi-mercimek.jpg" },
  { all: ["kirmizi", "mercimek"], path: "/resimler/kirmizi-mercimek.jpg" },
  { all: ["yeşil", "mercimek"], path: "/resimler/yesil-mercimek.jpg" },
  { all: ["yesil", "mercimek"], path: "/resimler/yesil-mercimek.jpg" },
  { all: ["domates", "salça"], path: "/resimler/domates-salcasi.jpg" },
  { all: ["domates", "salca"], path: "/resimler/domates-salcasi.jpg" },
  { all: ["biber", "salça"], path: "/resimler/biber-salcasi.jpg" },
  { all: ["biber", "salca"], path: "/resimler/biber-salcasi.jpg" },
  { all: ["arpa", "şehriye"], path: "/resimler/arpa-sehriye.jpg" },
  { all: ["arpa", "sehriye"], path: "/resimler/arpa-sehriye.jpg" },
  { all: ["tel", "şehriye"], path: "/resimler/tel-sehriye.jpg" },
  { all: ["tel", "sehriye"], path: "/resimler/tel-sehriye.jpg" },
  { all: ["tuvalet", "kağıt"], path: "/resimler/tuvalet-kagidi.jpg" },
  { all: ["tuvalet", "kagit"], path: "/resimler/tuvalet-kagidi.jpg" },
  { all: ["kağıt", "havlu"], path: "/resimler/kagit-havlu.jpg" },
  { all: ["kagit", "havlu"], path: "/resimler/kagit-havlu.jpg" },
  { all: ["ıslak", "mendil"], path: "/resimler/islak-mendil.jpg" },
  { all: ["islak", "mendil"], path: "/resimler/islak-mendil.jpg" },
  { all: ["sıvı", "sabun"], path: "/resimler/sivi-sabun.jpg" },
  { all: ["sivi", "sabun"], path: "/resimler/sivi-sabun.jpg" },
  { all: ["kalıp", "sabun"], path: "/resimler/kalip-sabun.jpg" },
  { all: ["kalip", "sabun"], path: "/resimler/kalip-sabun.jpg" },
  { all: ["bulaşık", "tablet"], path: "/resimler/bulasik-tablet.jpg" },
  { all: ["bulasik", "tablet"], path: "/resimler/bulasik-tablet.jpg" },
  { all: ["bulaşık", "deterjan"], path: "/resimler/bulasik-deterjani.jpg" },
  { all: ["bulasik", "deterjan"], path: "/resimler/bulasik-deterjani.jpg" },
  { all: ["çamaşır", "su"], path: "/resimler/camasir-suyu.jpg" },
  { all: ["camasir", "su"], path: "/resimler/camasir-suyu.jpg" },
  { all: ["ayçiçek", "yağ"], path: "/resimler/aycicek-yagi.jpg" },
  { all: ["aycicek", "yag"], path: "/resimler/aycicek-yagi.jpg" },

  // Direct matches for distinct categories
  {
    any: ["yumuşatıcı", "yumusatici", "bingo soft", "vernel", "yumoş", "yumos"],
    path: "/resimler/yumusatici.jpg",
  },
  {
    any: ["yüzey temizleyici", "yuzey temizleyici", "yüzey", "yuzey", "asperox"],
    path: "/resimler/yuzey-temizleyici.jpg",
  },
  {
    any: ["zeytin", "zeytini", "zeytinler"],
    path: "/resimler/zeytin.jpg",
  },
  {
    any: ["cam sil", "camsil", "cam temizleyici"],
    path: "/resimler/cam-sil.jpg",
  },
  {
    any: ["ahşap temizleyici", "ahsap temizleyici", "pronto"],
    path: "/resimler/ahsap-temizleyici.jpg",
  },
  {
    any: ["kireç çözücü", "kirec cozucu", "porçöz", "porcoz"],
    path: "/resimler/kirec-cozucu.jpg",
  },
  {
    any: ["yağ çözücü", "yag cozucu", "yağ sökücü"],
    path: "/resimler/yag-cozucu.jpg",
  },
  {
    any: ["lavabo açıcı", "lavabo acici"],
    path: "/resimler/lavabo-acici.jpg",
  },
  {
    any: ["leke çıkarıcı", "leke cikarici"],
    path: "/resimler/leke-cikarici.jpg",
  },
  {
    any: ["temizlik kremi", "krem temizleyici", "cif"],
    path: "/resimler/temizlik-kremi.jpg",
  },
  {
    any: ["parlatıcı", "parlatici", "makine parlatıcı"],
    path: "/resimler/makine-parlatici.jpg",
  },
  {
    any: ["arap sabunu", "arap sabun"],
    path: "/resimler/arap-sabunu.jpg",
  },
  {
    any: ["toz deterjan", "matik", "ariel", "omo", "alo"],
    path: "/resimler/matik.jpg",
  },
  {
    any: ["bebek bezi", "bebek", "canbebe", "canped", "hasta bezi"],
    path: "/resimler/bebek-bezi.jpg",
  },
  {
    any: ["peçete", "pecete"],
    path: "/resimler/pecete.jpg",
  },
  {
    any: ["şampuan", "sampuan", "clear", "head & shoulders", "pantene", "elidor", "dalin"],
    path: "/resimler/sampuan.jpg",
  },
  {
    any: ["saç kremi", "sac kremi"],
    path: "/resimler/sac-kremi.jpg",
  },
  {
    any: ["kolonya"],
    path: "/resimler/kolonya.jpg",
  },
  {
    any: ["sabun", "hacı şakir", "haci sakir", "duru"],
    path: "/resimler/kalip-sabun.jpg",
  },
  {
    any: ["ayçiçek", "aycicek", "sıvı yağ", "sivi yag"],
    path: "/resimler/aycicek-yagi.jpg",
  },
  {
    any: ["toz şeker", "toz seker", "şeker", "seker"],
    path: "/resimler/toz-seker.jpg",
  },
  {
    any: ["baldo", "pirinç", "pirinc", "osmancık", "osmancik"],
    path: "/resimler/pirinc.jpg",
  },
  {
    any: ["nohut", "koçbaşı", "kocbasi"],
    path: "/resimler/nohut.jpg",
  },
  {
    any: ["kuru fasulye", "dermason", "fasulye"],
    path: "/resimler/fasulye.jpg",
  },
  {
    any: ["barbunya"],
    path: "/resimler/barbunya.jpg",
  },
  {
    any: ["mercimek"],
    path: "/resimler/kirmizi-mercimek.jpg",
  },
  {
    any: ["aşurelik", "asurelik", "dövme", "dovme"],
    path: "/resimler/asurelik-bugday-5kg.webp",
  },
  {
    any: ["bulgur"],
    path: "/resimler/pilavlik-bulgur.png",
  },
  {
    any: ["buğday", "bugday"],
    path: "/resimler/bugday.jpg",
  },
  {
    any: ["salça", "salca"],
    path: "/resimler/domates-salcasi.jpg",
  },
  {
    any: ["burgu"],
    path: "/resimler/burgu.jpg",
  },
  {
    any: ["penne"],
    path: "/resimler/penne.jpg",
  },
  {
    any: ["spagetti"],
    path: "/resimler/spagetti.jpg",
  },
  {
    any: ["kelebek"],
    path: "/resimler/kelebek.jpg",
  },
  {
    any: ["makarna"],
    path: "/resimler/burgu.jpg",
  },
  {
    any: ["erişte", "eriste"],
    path: "/resimler/eriste.jpg",
  },
  {
    any: ["mantı", "manti"],
    path: "/resimler/manti.jpg",
  },
  {
    any: ["çay", "cay", "çaykur", "caykur", "doğuş", "lipton"],
    path: "/resimler/cay.jpg",
  },
  {
    any: ["kahve", "türk kahvesi", "turk kahvesi", "nescafe", "mahmood"],
    path: "/resimler/kahve.jpg",
  },
  {
    any: ["un", "buğday unu"],
    path: "/resimler/un.jpg",
  },
  {
    any: ["helva", "tahin"],
    path: "/resimler/helva.jpg",
  },
  {
    any: ["lokum"],
    path: "/resimler/lokum.jpg",
  },
  {
    any: ["sucuk", "cevizli sucuk"],
    path: "/resimler/cevizli-sucuk.jpg",
  },
  {
    any: ["gofret"],
    path: "/resimler/gofret.jpg",
  },
  {
    any: ["bonbon", "şekerleme"],
    path: "/resimler/bonbon.jpg",
  },
  {
    any: ["turşu", "tursu"],
    path: "/resimler/tursu.jpg",
  },
  {
    any: ["ketçap", "ketcap"],
    path: "/resimler/ketcap.jpg",
  },
  {
    any: ["mayonez"],
    path: "/resimler/mayonez.jpg",
  },
  {
    any: ["garnitür", "garnitur"],
    path: "/resimler/garnitur.jpg",
  },
  {
    any: ["mısır", "misir"],
    path: "/resimler/misir-konserve.jpg",
  },
  {
    any: ["bezelye"],
    path: "/resimler/bezelye.jpg",
  },
  {
    any: ["çilek reçeli", "cilek receli"],
    path: "/resimler/cilek-receli.jpg",
  },
  {
    any: ["vişne reçeli", "visne receli"],
    path: "/resimler/visne-receli.jpg",
  },
  {
    any: ["kayısı reçeli", "kayisi receli"],
    path: "/resimler/kayisi-receli.jpg",
  },
  {
    any: ["incir reçeli", "incir receli"],
    path: "/resimler/incir-receli.jpg",
  },
  {
    any: ["reçel", "receli", "recel"],
    path: "/resimler/cilek-receli.jpg",
  },
  {
    any: ["çay bardağı", "cay bardagi"],
    path: "/resimler/cay-bardagi.jpg",
  },
  {
    any: ["su bardağı", "su bardagi", "bardak", "paşabahçe"],
    path: "/resimler/su-bardagi.jpg",
  },
  {
    any: ["pul biber", "pulbiber", "biber"],
    path: "/resimler/pul-biber.jpg",
  },
];

export function getCategoryFallbackImageUrl(category?: string | null): string {
  switch (category) {
    case "bakliyat":
      return "/resimler/pirinc.jpg";
    case "temizlik":
      return "/resimler/camasir-suyu.jpg";
    case "kisisel":
      return "/resimler/sampuan.jpg";
    case "gida":
    default:
      return "/resimler/aycicek-yagi.jpg";
  }
}

/**
 * Resolves a product's display image URL to /resimler/...
 * Handles:
 * - Direct filename (e.g. "zeytin.jpg" -> "/resimler/zeytin.jpg")
 * - /products/ paths -> "/products/..." or "/resimler/..."
 * - Base64 and http URLs
 * - Name matching for exact Turkish product names (Yumuşatıcı, Zeytin, Yüzey Temizleyici)
 */
export function getPublicProductImageUrl(
  rawInput?:
    | string
    | null
    | {
        image_url?: string | null;
        image?: string | null;
        name?: string | null;
        category?: string | null;
      },
  productName?: string | null,
  category?: string | null,
): string {
  let url: string | null | undefined;
  let pName = productName;
  let pCat = category;

  if (rawInput && typeof rawInput === "object") {
    url = rawInput.image_url || rawInput.image;
    pName = pName || rawInput.name;
    pCat = pCat || rawInput.category;
  } else {
    url = rawInput;
  }

  // 1. Process provided image_url or image
  if (url && typeof url === "string") {
    const trimmed = url.trim();
    if (trimmed) {
      // Base64 data URLs work directly in browser
      if (trimmed.startsWith("data:")) return trimmed;

      // Absolute external URLs
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }

      // Direct dictionary lookup first
      if (PRODUCT_IMAGE_MAP[trimmed]) {
        return PRODUCT_IMAGE_MAP[trimmed];
      }

      // Direct public path starting with /resimler/ or resimler/
      if (trimmed.startsWith("/resimler/")) {
        return trimmed;
      }
      if (trimmed.startsWith("resimler/")) {
        return "/" + trimmed;
      }

      // Direct public path starting with /products/ or products/
      if (trimmed.startsWith("/products/")) {
        return trimmed;
      }
      if (trimmed.startsWith("products/")) {
        return "/" + trimmed;
      }

      // Direct root public image path (e.g. /image_name.jpg)
      if (trimmed.startsWith("/") && /\.(jpe?g|png|webp|svg|gif|avif)$/i.test(trimmed)) {
        return trimmed;
      }

      // Local asset path
      if (trimmed.includes("/src/assets/images/") || trimmed.includes("/src/assets/products/")) {
        const filename = trimmed.split("/").pop();
        return filename ? "/resimler/" + filename : trimmed;
      }

      // Plain filename (e.g. "yumusatici.jpg", "zeytin.jpg") or root filename
      const cleanFilename = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
      if (cleanFilename.includes(".")) {
        if (PRODUCT_IMAGE_MAP[cleanFilename]) {
          return PRODUCT_IMAGE_MAP[cleanFilename];
        }
        return "/" + cleanFilename;
      }
    }
  }

  // 2. Name-based matching for product catalog
  if (pName && typeof pName === "string") {
    const lower = pName.toLocaleLowerCase("tr");

    for (const rule of PRODUCT_KEYWORD_RULES) {
      if (rule.all && rule.all.length > 0) {
        if (rule.all.every((w) => lower.includes(w))) {
          return rule.path;
        }
      }
      if (rule.any && rule.any.length > 0) {
        if (rule.any.some((w) => lower.includes(w))) {
          return rule.path;
        }
      }
    }
  }

  // 3. Fallback to category default image
  return getCategoryFallbackImageUrl(pCat);
}

/**
 * Convenience helper to resolve image from a Product object
 */
export function resolveProductImage(
  product?: {
    image_url?: string | null;
    image?: string | null;
    name?: string | null;
    category?: string | null;
  } | null,
): string {
  if (!product) return "/resimler/aycicek-yagi.jpg";
  return getPublicProductImageUrl(product, product.name, product.category);
}

/**
 * Robust image error handler for <img /> components:
 * 1. Checks alternate static asset path (/ vs /resimler/)
 * 2. Checks keyword match based on product name
 * 3. Falls back to category default
 * Never drops or restricts products whose images fail to load.
 */
export function handleProductImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  productName?: string | null,
  category?: string | null,
) {
  const target = e.currentTarget;
  const currentStage = parseInt(target.getAttribute("data-err-stage") || "0", 10);
  const currentSrc = target.getAttribute("src") || target.src || "";

  // Stage 0: Try switching between /resimler/<filename> and /<filename>
  if (currentStage === 0) {
    target.setAttribute("data-err-stage", "1");
    if (currentSrc.includes("/resimler/")) {
      const parts = currentSrc.split("/resimler/");
      const filename = parts[parts.length - 1];
      if (filename && filename.includes(".")) {
        target.src = "/" + filename;
        return;
      }
    } else if (currentSrc.includes("/products/")) {
      const parts = currentSrc.split("/products/");
      const filename = parts[parts.length - 1];
      if (filename && filename.includes(".")) {
        target.src = "/resimler/" + filename;
        return;
      }
    } else if (!currentSrc.startsWith("data:") && !currentSrc.startsWith("http")) {
      const filename = currentSrc.split("/").pop();
      if (filename && filename.includes(".")) {
        target.src = "/resimler/" + filename;
        return;
      }
    }
  }

  // Stage 1: Try keyword-based matching for product name
  if (currentStage <= 1 && productName) {
    target.setAttribute("data-err-stage", "2");
    const lower = productName.toLocaleLowerCase("tr");
    for (const rule of PRODUCT_KEYWORD_RULES) {
      if (
        (rule.all && rule.all.every((w) => lower.includes(w))) ||
        (rule.any && rule.any.some((w) => lower.includes(w)))
      ) {
        if (target.src !== rule.path && !target.src.endsWith(rule.path)) {
          target.src = rule.path;
          return;
        }
      }
    }
  }

  // Stage 2: Fallback to category default
  if (currentStage <= 2) {
    target.setAttribute("data-err-stage", "3");
    const fallback = getCategoryFallbackImageUrl(category);
    if (target.src !== fallback && !target.src.endsWith(fallback)) {
      target.src = fallback;
      return;
    }
  }

  // Stage 3: Global emergency fallback (ensure image element always displays)
  target.setAttribute("data-err-stage", "4");
  target.src = "/resimler/aycicek-yagi.jpg";
}
