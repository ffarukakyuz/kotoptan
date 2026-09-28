import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/integrations/supabase/client";
import { type ChatMessage } from "./gemini";

// Primary fast response model gemini-1.5-flash followed by official aliases
const CANDIDATE_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
];

const SITE_INFO = `
Firma: KasımOğulları Ltd. Şti. — Bitlis ve ilçelerindeki bakkal ve marketlere toptan satış yapan ana depo.
Yöneticiler: Faruk Akyüz, Yavuz Akyüz, Mücahit Akyüz, Selim Akyüz, Suat Akyüz.
Site bölümleri:
- Ana sayfa (/): Canlı vitrin, kategori filtreleri (Tümü, Gıda, Bakliyat, Temizlik, Kişisel Bakım) ve arama.
- Ürün sayfası (/urun/{id}): Ürün ambalajı, birim bilgisi ve hızlı sipariş.
- Sepet (/sepet): Toptan sipariş özeti ve sipariş tamamlama. İsim, market adı, ilçe ve adres istenir.
- Siparişlerim (/siparislerim): Verilen siparişlerin takibi.
- Yönetim paneli (/yonetim): Yalnızca yöneticilerin eriştiği ürün ekleme/düzenleme, sipariş onaylama ve müşteri yönetimi.

Önemli Toptan Satış Kuralları:
- Sitede toptan satış yapıldığı ve fiyatlar piyasa dinamiklerine göre değişebildiği için doğrudan fiyat yazılmaz.
- Müşteri siparişi oluşturduktan sonra depo yönetimi (Faruk Bey / Suat Bey) siparişi onaylar ve teslimat esnasında nakit/tahsilat yapılır.
- Teslimat Yapılan İlçeler: Ahlat, Adilcevaz, Bitlis Merkez, Güroymak, Hizan, Tatvan.
- Sipariş durumları: Yeni, Hazırlanıyor, Yolda, Teslim edildi, İptal.
`;

/**
 * Safely reads Google Gemini API key:
 * Priority:
 * 1. import.meta.env.VITE_GEMINI_API_KEY
 * 2. process.env.VITE_GEMINI_API_KEY / process.env.GEMINI_API_KEY
 * Returns string or empty string "" safely without throwing.
 */
export function getGeminiApiKey(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env) {
      const viteKey =
        import.meta.env["VITE_GEMINI_API_KEY"] ||
        import.meta.env["GEMINI_API_KEY"];
      if (typeof viteKey === "string" && viteKey.trim().length > 0) {
        return viteKey.trim();
      }
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof process !== "undefined" && process?.env) {
      const procKey =
        process.env["VITE_GEMINI_API_KEY"] ||
        process.env["GEMINI_API_KEY"] ||
        process.env["API_KEY"];
      if (typeof procKey === "string" && procKey.trim().length > 0) {
        return procKey.trim();
      }
    }
  } catch {
    // Ignore
  }

  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const winKey = win.__VITE_GEMINI_API_KEY__ || win.VITE_GEMINI_API_KEY || win.GEMINI_API_KEY;
    if (typeof winKey === "string" && winKey.trim().length > 0) {
      return winKey.trim();
    }
  }

  return "";
}

export type ProductRecord = {
  id?: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  image_url?: string | null;
  is_active?: boolean;
};

/**
 * Fetches all products dynamically from Supabase (up to 999 records)
 * to pass directly into the Gemini prompt/context or for instant local search.
 */
export async function fetchDynamicProducts(): Promise<ProductRecord[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, category, unit, image_url, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(0, 999);

    if (error || !data || data.length === 0) {
      return [];
    }

    return data as ProductRecord[];
  } catch (err) {
    console.warn("[Gemini Orchestration] Could not load product list from Supabase:", err);
    return [];
  }
}

/**
 * Builds the text context for Gemini from the dynamic products list
 */
export function formatProductsContext(products: ProductRecord[]): string {
  if (!products || products.length === 0) return "";
  return products
    .map((p, index) => {
      const hasImg = Boolean(p.image_url && p.image_url.trim().length > 0);
      const isOutOfStock = p.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(p.description);
      const cleanDesc = (p.description || "").replace(/\[(TÜKENDİ|STOK_YOK)\]/gi, "").trim();
      return `${index + 1}. ${p.name} | Kategori: ${p.category} | Birim: ${p.unit} | Stok: ${isOutOfStock ? "Tükendi" : "Stokta"} | Görsel: ${hasImg ? "Mevcut" : "Görsel yok"}${cleanDesc ? ` | Ambalaj/Koli Notu: ${cleanDesc}` : ""}`;
    })
    .join("\n");
}

/**
 * Local search fallback when Gemini API key is missing or quota is exceeded.
 * Allows users to search and find products directly from the dynamic catalog.
 */
export function searchLocalProducts(query: string, products: ProductRecord[]): string {
  if (!query || query.trim().length === 0) {
    return "KasımOğulları toptan depomuzda aramak istediğiniz ürünü yazabilirsiniz. (Örn: Çay, Şeker, Sıvı Yağ, Deterjan, Pirinç vb.)";
  }

  const terms = query
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (terms.length === 0) {
    return "Depomuzdaki ürünleri incelemek için ürün adı veya kategorisi yazabilirsiniz.";
  }

  const matches = products.filter((p) => {
    const fullText = `${p.name} ${p.category} ${p.unit} ${p.description || ""}`.toLowerCase();
    return terms.some((term) => fullText.includes(term));
  });

  if (matches.length === 0) {
    return `Depomuzda "${query}" ile eşleşen ürün bulunamadı. Talep ettiğiniz ürünü yöneticilerimiz Faruk Bey ve Suat Bey'e bildirmemiz için iletişim numaranızı bırakabilirsiniz.`;
  }

  const topMatches = matches.slice(0, 8);
  const formatted = topMatches
    .map((p) => {
      const isOut = p.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(p.description);
      return `📦 **${p.name}**\n📂 Kategori: ${p.category} | Birim: ${p.unit} | Durum: ${isOut ? "⚠️ Tükendi" : "✅ Stokta"}`;
    })
    .join("\n\n");

  return `🔍 **Depomuzda Bulunan İlgili Ürünler (${matches.length} sonuç):**\n\n${formatted}\n\nDetaylar ve sipariş için ürün adını katalogda aratabilir veya sepetinize ekleyebilirsiniz.`;
}

/**
 * Direct Gemini REST endpoint fallback in case SDK fetch meets CSP or runtime limitations
 */
async function callGeminiRest(
  apiKey: string,
  model: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsedMsg = errText;
    try {
      const errJson = JSON.parse(errText);
      if (errJson?.error?.message) {
        parsedMsg = errJson.error.message;
      }
    } catch {
      // keep raw
    }
    throw new Error(`Gemini API HTTP ${res.status}: ${parsedMsg}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error("Gemini boş yanıt döndürdü.");
  return reply.trim();
}

/**
 * Orchestrates Google Gemini call using gemini-1.5-flash with official @google/genai SDK
 * and direct HTTP REST endpoint fallback.
 * Strictly wraps in try-catch without throwing blocking errors or freezing the UI.
 */
export async function callGeminiAI(
  messages: ChatMessage[],
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    const apiKey = getGeminiApiKey();

    // 1. Fetch dynamic product list from Supabase
    const products = await fetchDynamicProducts();
    const dynamicProductsContext = formatProductsContext(products);
    const lastUserQuery = messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "";

    // If API key is missing or empty, perform local search and return clear informative response
    if (!apiKey) {
      const searchAnswer = searchLocalProducts(lastUserQuery, products);
      return {
        ok: true,
        reply: searchAnswer,
        error: "NO_API_KEY",
      };
    }

    // 2. Build system instructions with full dynamic Supabase context
    let systemInstruction = "";
    if (isAdmin) {
      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. depo yönetim asistanısın.
Şu an KasımOğulları'nın yetkili bir yöneticisi ile görüşüyorsun.
Görevin:
1. Yöneticilere depodaki ürünleri yönetme, yeni ürün oluşturma, fotoğraf ile otomatik ürün ekleme konularında tam destek vermek.
2. Yöneticinin yeni ürün taleplerini veya stok sorularını hızlıca yanıtlamak.
3. Hitabın: Saygılı, net, operasyonel ve samimi ("Faruk Bey / Yönetici Bey / Değerli Yöneticimiz").

${SITE_INFO}

Depodaki Güncel Canlı Ürünler (Supabase veritabanından dinamik çekildi):
${dynamicProductsContext || "(Ürün listesi şu an yüklenemedi)"}`;
    } else {
      const customerInfo = userMeta?.businessName
        ? `Müşteri: ${userMeta.fullName || ""} (${userMeta.businessName}, Tel: ${userMeta.phone || ""})`
        : "Ziyaretçi Müşteri";

      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. toptan sipariş sitesinin müşteri destek asistanısın.
Konuştuğun kişi: ${customerInfo}.
Görevin:
1. Müşterilere sitedeki toptan ürünler (gıda, bakliyat, temizlik), sipariş adımları, koli/çuval satışları ve teslimat süreçleri hakkında bilgi vermek.
2. Fiyat sorulursa: Toptan satış yapıldığı için sitede fiyat gösterilmediğini, sipariş sepetten iletildikten sonra depo yönetiminin en uygun toptan fiyatı onaylayıp teslimat sırasında tahsil ettiğini nazikçe belirt.
3. ÖZEL TALEP & ŞİKAYET & İSTEK YÖNLENDİRMESİ: Müşteri sitede olmayan bir ürün isterse, özel bir fiyat talebinde bulunursa veya yöneticiyle görüşmek isterse:
   - "Talebinizi aldım! Bunu hemen KasımOğulları depo yöneticilerimiz Faruk Bey ve Suat Bey'e iletiyorum. Size en kısa sürede telefonunuz üzerinden dönüş sağlanacaktır." şeklinde yanıt ver.
4. Teslimat yapılan ilçeler: Ahlat, Adilcevaz, Bitlis Merkez, Güroymak, Hizan ve Tatvan.
5. Hitabın: Esnaf dostu, güven veren, sıcak ve yardımsever ("Hayırlı işler, bol kazançlar dilerim").

${SITE_INFO}

Depodaki Güncel Canlı Ürünler (Supabase veritabanından dinamik çekildi):
${dynamicProductsContext || "(Ürün listesi şu an yüklenemedi)"}`;
    }

    const contents = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // 3. Try primary model gemini-1.5-flash and fallbacks via @google/genai SDK
    let lastError: unknown = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        const reply = response.text?.trim();
        if (reply && reply.length > 0) {
          return { ok: true, reply };
        }
      } catch (err: unknown) {
        console.warn(`[Gemini SDK] Model ${model} failed, trying next fallback:`, err);
        lastError = err;
      }
    }

    // 4. Fallback to direct Gemini HTTP REST endpoint
    for (const model of CANDIDATE_MODELS) {
      try {
        const reply = await callGeminiRest(apiKey, model, contents, systemInstruction);
        if (reply) {
          return { ok: true, reply };
        }
      } catch (restErr: unknown) {
        console.warn(`[Gemini REST] Model ${model} failed:`, restErr);
        lastError = restErr;
      }
    }

    // 5. If all models fail (quota or network), provide local search answer or clear non-blocking message
    const searchFallback = searchLocalProducts(lastUserQuery, products);
    const errString = String(lastError || "");

    let errorNotice = "";
    if (errString.includes("429") || errString.toLowerCase().includes("quota") || errString.toLowerCase().includes("rate limit")) {
      errorNotice = "⚠️ (Yapay zeka yanıt kotası dolduğu için canlı depo listesinden arama yapıldı)\n\n";
    }

    return {
      ok: true,
      reply: `${errorNotice}${searchFallback}`,
      error: errString,
    };
  } catch (fatalErr: unknown) {
    console.error("[callGeminiAI] Unexpected non-blocking error:", fatalErr);
    return {
      ok: false,
      reply: "Şu an bağlantıda kısa bir yoğunluk var. Dilerseniz sorunuzu birkaç saniye sonra tekrar iletebilir ya da ürün adını doğrudan katalogdan aratabilirsiniz.",
      error: fatalErr instanceof Error ? fatalErr.message : "UNKNOWN_ERROR",
    };
  }
}
