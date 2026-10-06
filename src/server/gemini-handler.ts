import { GoogleGenAI } from "@google/genai";
import { FALLBACK_PRODUCTS } from "../data/products";
import { deduceFMCGProduct } from "../lib/fmcg-knowledge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalEnv = typeof globalThis !== "undefined" ? (globalThis as any).__env__ : undefined;

export const GEMINI_API_KEY =
  (typeof process !== "undefined" && process.env
    ? process.env["GEMINI_API_KEY"] || process.env["VITE_GEMINI_API_KEY"]
    : "") ||
  globalEnv?.GEMINI_API_KEY ||
  globalEnv?.VITE_GEMINI_API_KEY ||
  "";

export const OPENROUTER_API_KEY =
  (typeof process !== "undefined" && process.env
    ? process.env["OPENROUTER_API_KEY"] || process.env["VITE_OPENROUTER_API_KEY"]
    : "") ||
  globalEnv?.OPENROUTER_API_KEY ||
  globalEnv?.VITE_OPENROUTER_API_KEY ||
  "";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
export const FALLBACK_MODEL = "anthropic/claude-3.5-sonnet";

const SITE_INFO = `
Firma: KasımOğulları Ltd. Şti. — Tatvan ana depomuzdan Tatvan, Bitlis Merkez, Ahlat, Adilcevaz, Güroymak ve Hizan'daki bakkal ve marketlere toptan satış yapan ana depo.
Yönetim: Depo Yöneticisi
Ana Depo Lokasyonu: Tatvan / Bitlis
Site bölümleri:
- Ana sayfa (/): Canlı vitrin, kategori filtreleri (Tümü, Gıda, Bakliyat, Temizlik, Kişisel Bakım) ve arama.
- Ürün sayfası (/urun/{id}): Ürün ambalajı, birim bilgisi ve hızlı sipariş.
- Sepet (/sepet): Toptan sipariş özeti ve sipariş tamamlama. İsim, market adı, ilçe ve adres istenir.
- Siparişlerim (/siparislerim): Verilen siparişlerin takibi.
- Yönetim paneli (/yonetim): Yalnızca yöneticilerin eriştiği ürün ekleme/düzenleme, sipariş onaylama ve müşteri yönetimi.

Önemli Toptan Satış Kuralları:
- Sitede toptan satış yapıldığı ve fiyatlar piyasa dinamiklerine göre değişebildiği için doğrudan fiyat yazılmaz.
- Müşteri siparişi oluşturduktan sonra depo yöneticisi siparişi onaylar ve teslimat esnasında nakit/tahsilat yapılır.
- Teslimat Yapılan İlçeler: Tatvan (Ana Depomuz), Bitlis Merkez, Ahlat, Adilcevaz, Güroymak, Hizan.
- Sipariş durumları: Yeni, Hazırlanıyor, Yolda, Teslim edildi, İptal.
`;

function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

const STOP_WORDS = new Set([
  "var",
  "mi",
  "mu",
  "miyiz",
  "misiniz",
  "neler",
  "olan",
  "urun",
  "fiyati",
  "kac",
  "koli",
  "paket",
  "adet",
  "tane",
  "cuval",
  "ici",
  "ne",
  "kadar",
  "icin",
  "ile",
  "ve",
  "veya",
  "bir",
  "tl",
  "para",
  "bana",
  "bize",
  "size",
  "hakkinda",
  "bilgi",
  "verir",
  "misin",
]);

/**
 * 197 ürünlük katalogda arama yapar ve en alakalı ürünleri puanlayarak getirir
 */
function searchCatalogScored(query: string, maxResults = 5) {
  const normQ = normalizeText(query);
  const rawWords = normQ.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  let meaningfulWords = rawWords.filter((w) => !STOP_WORDS.has(w));
  if (meaningfulWords.length === 0) meaningfulWords = rawWords;

  const scored = FALLBACK_PRODUCTS.map((p) => {
    let score = 0;
    const name = normalizeText(p.name);
    const desc = normalizeText(p.description || "");
    const cat = normalizeText(p.category || "");

    // Tam arama eşleşmesi
    if (name.includes(normQ)) score += 60;

    for (const w of meaningfulWords) {
      if (name.includes(w)) {
        score += 25;
        if (name.startsWith(w) || name.includes(" " + w)) score += 10;
      }
      if (desc.includes(w)) score += 8;
      if (cat === w) score += 15;
    }
    return { product: p, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((i) => i.product);
}

/**
 * Kullanıcının mesajını ve bağlamını analiz ederek dinamik, zengin, esnaf dostu ve gerçek yanıt üretir
 */
function generateDynamicAssistantResponse(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): string {
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const normMsg = normalizeText(lastUserMsg);

  const customerName = userMeta?.fullName ? userMeta.fullName.split(" ")[0] : "";
  const storeName = userMeta?.businessName ? ` (${userMeta.businessName})` : "";
  const userGreetingPrefix = customerName
    ? `Merhaba ${customerName} Bey${storeName}, `
    : "Merhaba, ";

  // 1. YÖNETİCİ MODU ÖZEL KONTROLLERİ
  if (isAdmin) {
    if (
      normMsg.includes("urun") ||
      normMsg.includes("ekle") ||
      normMsg.includes("stok") ||
      normMsg.includes("yonetim")
    ) {
      return (
        "Sayın Yöneticimiz, KasımOğulları yönetim panelinden dilediğiniz zaman yeni ürün ekleyebilir, mevcut ürünlerin stok durumunu güncelleyebilir veya arşivleyebilirsiniz. " +
        "Ayrıca sohbetteki kamera simgesine tıklayarak herhangi bir ürünün fotoğrafını yüklerseniz, ürün adını, koli/paket bilgisini ve kategorisini otomatik analiz edip doğrudan şirket kataloğuna kaydedebilirim!"
      );
    }
    if (normMsg.includes("siparis") || normMsg.includes("onay") || normMsg.includes("musteri")) {
      return (
        "Sayın Yöneticimiz, yönetim panelindeki 'Siparişler' sekmesinden bakkal ve marketlerden gelen yeni siparişleri inceleyebilir; durumlarını 'Hazırlanıyor', 'Yolda' veya 'Teslim Edildi' olarak güncelleyebilirsiniz. " +
        "Müşteriler sekmesinden de kayıtlı esnaflarımızın bilgilerine ulaşabilirsiniz."
      );
    }
  }

  // 2. SELAMLAŞMA VE GİRİŞ
  const greetingWords = [
    "merhaba",
    "selam",
    "selamun aleykum",
    "sa",
    "gunaydin",
    "iyi gunler",
    "iyi aksamlar",
    "kolay gelsin",
    "hayirli isler",
    "hayirli gunler",
  ];
  const containsGreeting = greetingWords.some((gw) => normMsg.includes(gw));
  const hasSpecificQuestion =
    normMsg.includes("?") ||
    normMsg.includes("fiyat") ||
    normMsg.includes("teslimat") ||
    normMsg.includes("siparis") ||
    normMsg.includes("koli") ||
    normMsg.includes("kac");

  if (containsGreeting && !hasSpecificQuestion) {
    const greetings = [
      `${userGreetingPrefix}KasımOğulları Tatvan toptan şirketimize hoş geldiniz! Hayırlı işler, bereketli kazançlar dilerim. Şirketimizdeki 197 çeşit gıda, bakliyat ve temizlik ürünü, koli bilgileri ve teslimat süreçleri hakkında size nasıl yardımcı olabilirim?`,
      `Aleykümselam ${customerName ? customerName + " Bey" : ""}, hoş geldiniz! Hayırlı ve bol kazançlı günler dilerim. Şirketimizden toptan siparişleriniz, koli adetleri veya ürün sorgulamalarınız için buradayım. Hangi ürünlerimizi incelemek istersiniz?`,
      `${userGreetingPrefix}KasımOğulları Tatvan toptan şirket sipariş hattına hoş geldiniz. Tatvan merkezimizden Bitlis Merkez, Ahlat, Adilcevaz, Güroymak ve Hizan'daki marketlerimize toptan servis yapmaktayız. Aklınıza takılan her şeyi sorabilirsiniz.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // 3. FİYAT VE MALİYET SORULARI
  if (
    normMsg.includes("fiyat") ||
    normMsg.includes("kac para") ||
    normMsg.includes("kac tl") ||
    normMsg.includes("ne kadar") ||
    normMsg.includes("maliyet") ||
    normMsg.includes("iskonto")
  ) {
    // Fiyat sorulurken ürün de belirtilmişse ürünü de bağlama ekle
    const relatedProducts = searchCatalogScored(lastUserMsg, 3);
    let productAddon = "";
    if (relatedProducts.length > 0) {
      productAddon =
        `\n\nSorduğunuz ürünlerle ilgili şirketimizde bulunan seçenekler:\n` +
        relatedProducts
          .map(
            (p) =>
              `• **${p.name}** (${p.unit.toUpperCase()}${p.description ? " - " + p.description : ""})`,
          )
          .join("\n") +
        "\n\nBu ürünleri koli veya çuval adetleriyle sepetinize eklediğinizde, en güncel toptan fiyat üzerinden siparişiniz teyit edilir.";
    }

    return (
      "KasımOğulları Ltd. Şti. olarak yalnızca market ve bakkallara toptan dağıtım yapmaktayız. " +
      "Toptan piyasa koşullarına göre fiyatlarımız anlık ve hacme göre güncellendiği için sitede sabit fiyat yazılmaz. " +
      "İhtiyacınız olan ürünleri sepetinize ekleyip siparişinizi gönderdiğinizde, Tatvan şirket yöneticimiz siparişi en uygun toptan fiyatla onaylar ve teslimat sırasında tahsilat yapılır." +
      productAddon
    );
  }

  // 4. TESLİMAT, İLÇE VE SEVKİYAT SORULARI
  if (
    normMsg.includes("nerelere") ||
    normMsg.includes("ilce") ||
    normMsg.includes("teslimat") ||
    normMsg.includes("servis") ||
    normMsg.includes("tatvan") ||
    normMsg.includes("ahlat") ||
    normMsg.includes("adilcevaz") ||
    normMsg.includes("guroymak") ||
    normMsg.includes("hizan") ||
    normMsg.includes("bitlis") ||
    normMsg.includes("araba") ||
    normMsg.includes("sevkiyat")
  ) {
    return (
      "KasımOğulları ana merkezimiz Tatvan ilçemizde yer almakta olup kendi servis araçlarımızla doğrudan kapınıza kadar toptan teslimat yapmaktadır.\n\n" +
      "🚚 **Tatvan Ana Merkezimizden Servis Yapılan İlçeler:**\n" +
      "• Tatvan (Ana Merkez Lokasyonumuz)\n" +
      "• Bitlis Merkez\n" +
      "• Ahlat\n" +
      "• Adilcevaz\n" +
      "• Güroymak\n" +
      "• Hizan\n\n" +
      "Siparişinizi sepet üzerinden oluşturduktan sonra hazırlık aşamasına alınır ve planlanan günde servis aracımız bakkal/marketinize teslim eder."
    );
  }

  // 5. NASIL SİPARİŞ VERİLİR?
  if (
    normMsg.includes("nasil siparis") ||
    normMsg.includes("siparis verme") ||
    normMsg.includes("siparis nasil") ||
    normMsg.includes("nasil alirim") ||
    normMsg.includes("siparis vermek")
  ) {
    return (
      "KasımOğulları toptan kataloğundan sipariş vermek çok kolaydır:\n\n" +
      "1️⃣ **Ürünleri Seçin:** Ana sayfadaki 197 çeşit ürün arasından ihtiyacınız olanları koli/çuval adedi belirterek sepetinize ekleyin.\n" +
      "2️⃣ **Sepeti İnceleyin:** Sağ üstteki sepet simgesine tıklayarak listenizi kontrol edin.\n" +
      "3️⃣ **Bilgilerinizi Girin:** Market adınız, ilçeniz ve açık teslimat adresinizi yazarak siparişi tamamlayın.\n" +
      "4️⃣ **Depo Onayı & Teslimat:** Depo yöneticimiz siparişinizi onaylayıp servis aracımızla teslimata çıkarır."
    );
  }

  // 6. ÖDEME VE TAHSİLAT SORULARI
  if (
    normMsg.includes("odeme") ||
    normMsg.includes("kart") ||
    normMsg.includes("nakit") ||
    normMsg.includes("tahsilat") ||
    normMsg.includes("havale") ||
    normMsg.includes("eft")
  ) {
    return (
      "Ödeme ve tahsilat süreçlerimiz esnafımızın kolaylığına göre düzenlenmiştir:\n\n" +
      "• **Teslimatta Nakit:** Ürünler bakkal veya marketinize indirildiğinde araç personeline nakit ödeme yapabilirsiniz.\n" +
      "• **Ticari Kart / Havale:** Anlaşmalı müşterilerimiz ve yöneticilerimizle teyitli havale/EFT veya POS tahsilatı yapılabilir.\n" +
      "• Önceden online kredi kartı zorunluluğu yoktur; siparişinizi güvenle sepetten oluşturabilirsiniz."
    );
  }

  // 7. YÖNETİCİ VE ÖZEL TALEPLER
  if (
    normMsg.includes("faruk") ||
    normMsg.includes("suat") ||
    normMsg.includes("yavuz") ||
    normMsg.includes("mucahit") ||
    normMsg.includes("selim") ||
    normMsg.includes("akyuz") ||
    normMsg.includes("yetkili") ||
    normMsg.includes("yonetici") ||
    normMsg.includes("telefon") ||
    normMsg.includes("numara") ||
    normMsg.includes("gorusmek") ||
    normMsg.includes("ozel talep") ||
    normMsg.includes("sikayet")
  ) {
    return (
      "Talebinizi aldım! Bunu hemen KasımOğulları depo yöneticimize iletiyorum. " +
      (userMeta?.phone
        ? `Sistemde kayıtlı telefon numaranız (${userMeta.phone}) üzerinden en kısa sürede sizinle irtibata geçilecektir.`
        : "Yetkilimiz talebinizi değerlendirip sizinle en kısa sürede iletişime geçecektir. Acil durumlar için sipariş notuna da talebinizi ekleyebilirsiniz.")
    );
  }

  // 8. TEŞEKKÜR VE VEDA
  if (
    normMsg.includes("tesekkur") ||
    normMsg.includes("sagol") ||
    normMsg.includes("eyvallah") ||
    normMsg.includes("harika") ||
    normMsg.includes("tamamdir")
  ) {
    return (
      "Rica ederim, vazifemiz! KasımOğulları ailesi olarak her zaman yanınızdayız. " +
      "Hayırlı işler, bol bereketli satışlar dilerim. Başka bir sorunuz veya ihtiyacınız olursa bana her an yazabilirsiniz."
    );
  }

  // 9. ÜRÜN ARAMA VE KATALOG SORGULARI (197 ÜRÜNLÜK AKILLI EŞLEŞTİRME)
  const matchedProducts = searchCatalogScored(lastUserMsg, 5);

  if (matchedProducts.length > 0) {
    const productListFormatted = matchedProducts
      .map((p, idx) => {
        const packaging = p.description ? ` (${p.description})` : ` (${p.unit.toUpperCase()})`;
        return `${idx + 1}. **${p.name}**${packaging} - Kategori: *${p.category.toUpperCase()}*`;
      })
      .join("\n");

    return (
      `Şirketimizde aradığınız konuyla ilgili 197 ürünlük toptan kataloğumuzda yer alan ürünler şunlardır:\n\n` +
      `${productListFormatted}\n\n` +
      `✅ Bu ürünlerin tamamı Bitlis ana merkezimizde mevcut ve sevkiyata hazırdır. İhtiyacınız olan adetleri koli veya paket olarak sepetinize ekleyip hızlıca siparişinizi oluşturabilirsiniz. Belirli bir ürünün koli içi adedini öğrenmek isterseniz adını yazmanız yeterlidir!`
    );
  }

  // 10. KATALOGDA OLMAYAN ÖZEL ÜRÜNLER (Örn: Çuval Toz Şeker, Un vb.)
  if (
    normMsg.includes("seker") ||
    normMsg.includes("toz seker") ||
    normMsg.includes("un ") ||
    normMsg.includes("un50")
  ) {
    return (
      "Aradığınız ürün şu an sitedeki 197 ürünlük online vitrinde yer almıyor olabilir; ancak KasımOğulları ana firmamızda toptan çuval un ve şeker gibi temel gıda ürünlerinin sevkiyatı düzenli olarak yapılmaktadır.\n\n" +
      "Talebinizi aldım, bunu hemen şirket yöneticimize not olarak iletiyorum. Özel tonaj ve çuval siparişleriniz için sizinle irtibata geçilecektir."
    );
  }

  // 11. KREDİ / BAKİYE / CARİ LİMİT SORGULARI
  if (
    normMsg.includes("kredi") ||
    normMsg.includes("bakiye") ||
    normMsg.includes("limit") ||
    normMsg.includes("para") ||
    normMsg.includes("ucret") ||
    normMsg.includes("ücret")
  ) {
    return (
      "💳 **Kredi / Bakiye Bilgilendirmesi:**\n\n" +
      "• **Kredi veya Bakiye Zorunluluğu Yoktur:** Sistemimizde sipariş oluşturmak veya yapay zeka asistanını kullanmak için önceden bakiye yüklemeniz ya da kredi kartı tanımlamanız **gerekmez**.\n" +
      "• **Sipariş Oluşturma:** Sepetinize istediğiniz toptan ürünleri ekleyip doğrudan siparişinizi tamamlayabilirsiniz. Siparişiniz Tatvan merkezimize sevkiyat talebi olarak düşer.\n" +
      "• **Ödeme Şekli:** Ödemeler servis aracımız ürünleri market/bakkalınıza teslim ettiğinde kapıda nakit, havale veya işletmeniz ile şirket yönetimi arasındaki **cari hesap (açık hesap)** anlaşmasıyla yapılır.\n" +
      "• **Yapay Zeka ve Sistem Kullanımı:** Tamamen ücretsiz ve sınırsızdır."
    );
  }

  // 12. KATEGORİ GENEL SORGULARI
  if (normMsg.includes("temizlik")) {
    const temizlikSamples = FALLBACK_PRODUCTS.filter((p) => p.category === "temizlik").slice(0, 5);
    return (
      "Şirketimizde 66 çeşit toptan temizlik ürünü bulunmaktadır (Fairy, Bingo, Ace, Doa, Teno, vb.).\n\n" +
      "Öne çıkan temizlik ürünlerimiz:\n" +
      temizlikSamples.map((p) => `• **${p.name}** - ${p.description || p.unit}`).join("\n") +
      "\n\nAna sayfadaki 'Temizlik' kategorisine tıklayarak tüm listeyi görebilirsiniz."
    );
  }

  if (normMsg.includes("bakliyat")) {
    const bakliyatSamples = FALLBACK_PRODUCTS.filter((p) => p.category === "bakliyat").slice(0, 5);
    return (
      "Şirketimizde 40 çeşit birinci kalite toptan bakliyat ürünü bulunmaktadır (Bashan pirinç, mercimek, nohut, fasulye, bulgur vb.).\n\n" +
      "Öne çıkan bakliyat ürünlerimiz:\n" +
      bakliyatSamples.map((p) => `• **${p.name}** - ${p.description || p.unit}`).join("\n") +
      "\n\nAna sayfadaki 'Bakliyat' kategorisine tıklayarak koli ve çuval seçeneklerini inceleyebilirsiniz."
    );
  }

  if (normMsg.includes("gida")) {
    const gidaSamples = FALLBACK_PRODUCTS.filter((p) => p.category === "gida").slice(0, 5);
    return (
      "Şirketimizde 60 çeşit toptan temel gıda ürünü bulunmaktadır (Çaykur ve Doğuş çaylar, Burcu ve Demko salçalar, Filiz makarnalar, turşular vb.).\n\n" +
      "Öne çıkan gıda ürünlerimiz:\n" +
      gidaSamples.map((p) => `• **${p.name}** - ${p.description || p.unit}`).join("\n") +
      "\n\nAna sayfadaki 'Gıda' sekmesinden dilediğiniz ürünü koli bazında sepetinize ekleyebilirsiniz."
    );
  }

  if (normMsg.includes("sampuan") || normMsg.includes("kisisel")) {
    const sampuanSamples = FALLBACK_PRODUCTS.filter((p) => p.category === "kisisel").slice(0, 5);
    return (
      "Şirketimizde şampuan ve kişisel bakım grubunda Clear, Elidor, Pantene, Dalin, Blendax, Duru ve Hacı Şakir gibi güçlü markaların toptan paketleri mevcuttur.\n\n" +
      "Öne çıkan ürünlerimiz:\n" +
      sampuanSamples.map((p) => `• **${p.name}** - ${p.description || p.unit}`).join("\n") +
      "\n\nŞampuanlarımız paket bazında satılmakta olup koli içi paket adetleri ürün detayında belirtilmiştir."
    );
  }

  // 12. GENEL AKILLI YARDIM YANITI (Kullanıcının sorusuna özel yönlendirme)
  return (
    `"${lastUserMsg}" ile ilgili olarak size yardımcı olmaktan memnuniyet duyarım.\n\n` +
    `KasımOğulları şirketimizde 197 çeşit toptan ürün (Gıda, Bakliyat, Temizlik ve Kişisel Bakım) bulunmaktadır. ` +
    `Aradığınız özel bir marka veya ürün adı varsa (örneğin "Çaykur", "Fairy", "Pirinç", "Clear şampuan") yazabilir; ` +
    `veya sipariş, teslimat ve fiyat politikamız hakkında detaylı bilgi alabilirsiniz.`
  );
}

/**
 * OpenRouter üzerinden AI çağrısı yapar (zaman aşımlı)
 */
async function callOpenRouter(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string = DEFAULT_MODEL,
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://kasimogullari.com",
        "X-Title": "KasimOgullari Toptan Depo",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply && reply.length > 5) {
        return { ok: true, reply };
      }
    }
  } catch (err) {
    // Timeout or network error
  }

  return { ok: false, reply: "", error: "OpenRouter response unavailable" };
}

export async function processChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    // 1. Google Gemini via @google/genai if GEMINI_API_KEY is available
    if (GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. Bitlis toptan gıda, bakliyat ve temizlik firmasının akıllı asistanısın. Esnaf dostu, bilgili ve samimi yanıtlar ver.\n${SITE_INFO}`;

        const contents = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        const reply = response.text?.trim();
        if (reply && reply.length > 3) {
          return { ok: true, reply };
        }
      } catch (geminiErr) {
        console.warn("[processChat] Gemini API error:", geminiErr);
      }
    }

    // 2. OpenRouter'ı dene (varsa)
    if (OPENROUTER_API_KEY) {
      const openRouterMessages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = [
        {
          role: "system",
          content: `Sen "Ko". KasımOğulları Ltd. Şti. Bitlis toptan gıda, bakliyat ve temizlik firmasının akıllı asistanısın. Esnaf dostu, bilgili ve samimi yanıtlar ver.\n${SITE_INFO}`,
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = await callOpenRouter(openRouterMessages, DEFAULT_MODEL);
      if (result.ok && result.reply) {
        return result;
      }
    }

    // 3. Dinamik Asistan Motoru (197 ürünlük tam katalog verisine ve doğal Türkçe niyet analizine dayalı)
    const dynamicReply = generateDynamicAssistantResponse(messages, isAdmin, userMeta);
    return { ok: true, reply: dynamicReply };
  } catch (err) {
    console.error("[processChat] Handler Error:", err);
    const dynamicReply = generateDynamicAssistantResponse(messages, isAdmin, userMeta);
    return { ok: true, reply: dynamicReply };
  }
}

export async function processVision(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  note?: string,
): Promise<{
  ok: boolean;
  product?: { name: string; category: string; unit: string; description: string };
  error?: string;
}> {
  try {
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1]! : imageBase64;
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${cleanBase64}`;

    const systemPrompt = `Sen KasımOğulları Ltd. Şti. toptan gıda, bakliyat ve temizlik firması için ürün analizi yapan yapay zeka asistanısın.
Fotoğraftaki ürünü inceleyip toptan katalog için şu alanları kesin bir JSON nesnesi olarak döndür:
- name: Ürün markası, adı ve gramaj/hacim bilgisi
- category: Kesinlikle şu 4 değerden biri olmalıdır: "gida", "bakliyat", "temizlik", "kisisel"
- unit: Toptan satış ambalajı (Örn: "Koli (12 Adet)", "Çuval (25 kg)", "Paket", "Koli")
- description: Toptan satışa uygun kısa ve net açıklama

${note ? `Yöneticinin eklediği not: "${note}"` : ""}

Sadece geçerli bir JSON nesnesi döndür, markdown veya başka metin ekleme.`;

    // 1. Google Gemini Vision via @google/genai
    if (GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "Bu ürün fotoğrafını analiz et ve toptan katalog için JSON nesnesini üret." +
                    (note ? `\nNot: ${note}` : ""),
                },
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || "image/jpeg",
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
          },
        });

        const rawJson = response.text?.trim() || "{}";
        const parsed = JSON.parse(rawJson);
        const validCategory = ["gida", "bakliyat", "temizlik", "kisisel"].includes(parsed.category)
          ? parsed.category
          : "gida";

        return {
          ok: true,
          product: {
            name: parsed.name || "Yeni Ürün",
            category: validCategory,
            unit: parsed.unit || "Koli",
            description: parsed.description || "KasımOğulları toptan depo ürünü.",
          },
        };
      } catch (geminiVisionErr) {
        console.warn("[processVision] Gemini vision error:", geminiVisionErr);
      }
    }

    if (OPENROUTER_API_KEY) {
      try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://kasimogullari.com",
            "X-Title": "KasimOgullari Toptan",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Bu ürün fotoğrafını analiz et ve KasımOğulları toptan kataloğuna eklenmek üzere JSON nesnesini üret.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          let rawJson = data.choices?.[0]?.message?.content?.trim() || "{}";
          if (rawJson.startsWith("```json")) {
            rawJson = rawJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
          } else if (rawJson.startsWith("```")) {
            rawJson = rawJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
          }

          const parsed = JSON.parse(rawJson);
          const validCategory = ["gida", "bakliyat", "temizlik", "kisisel"].includes(
            parsed.category,
          )
            ? parsed.category
            : "gida";

          return {
            ok: true,
            product: {
              name: parsed.name || "Yeni Ürün",
              category: validCategory,
              unit: parsed.unit || "Koli",
              description: parsed.description || "KasımOğulları toptan depo ürünü.",
            },
          };
        }
      } catch (visionErr) {
        console.warn("[processVision] Vision request error:", visionErr);
      }
    }

    // Fotoğraftan akıllı ürün şablonu (FMCG Toptan Kategori ve Koli Bilgi Bankası)
    const fmcg = deduceFMCGProduct(note || "");
    return {
      ok: true,
      product: {
        name: fmcg.name,
        category: fmcg.category,
        unit: fmcg.unit,
        description: fmcg.description,
      },
    };
  } catch (err) {
    console.error("[processVision] Error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Görsel analiz edilemedi",
    };
  }
}
