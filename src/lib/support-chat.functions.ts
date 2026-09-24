import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(3000),
  image: z.string().optional(),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(25),
  isAdmin: z.boolean().default(false),
  userMeta: z
    .object({
      fullName: z.string().optional(),
      businessName: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

const imageAnalysisSchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().default("image/jpeg"),
  note: z.string().max(500).optional(),
});

const SITE_INFO = `
Firma: KasımOğulları Ltd. Şti. — Bitlis ve ilçelerindeki bakkal ve marketlere toptan satış yapan ana depo.
Yöneticiler: Faruk Akyüz, Yavuz Akyüz, Mücahit Akyüz, Selim Akyüz, Suat Akyüz.
Site bölümleri:
- Ana sayfa (/): Canlı vitrin (3 saniyede değişen vitrin kartı), kategori filtreleri (Tümü, Gıda, Bakliyat, Temizlik, Kişisel Bakım) ve arama.
- Ürün sayfası (/urun/{id}): Ürün ambalajı, birim bilgisi ve hızlı sipariş.
- Sepet (/sepet): Toptan sipariş özeti ve sipariş tamamlama. İsim, market adı, ilçe ve adres istenir.
- Siparişlerim (/siparislerim): Verilen siparişlerin takibi.
- Yönetim paneli (/yonetim): Yalnızca 5 yöneticinin eriştiği ürün ekleme/düzenleme, sipariş onaylama ve müşteri yönetimi.

Önemli Toptan Satış Kuralları:
- Sitede toptan satış yapıldığı ve fiyatlar piyasa dinamiklerine göre değişebildiği için doğrudan fiyat yazılmaz.
- Müşteri siparişi oluşturduktan sonra depo yönetimi (Faruk Bey / Suat Bey) siparişi onaylar ve teslimat esnasında nakit/tahsilat yapılır.
- Teslimat Yapılan İlçeler: Ahlat, Adilcevaz, Bitlis Merkez, Güroymak, Hizan, Tatvan.
- Sipariş durumları: Yeni, Hazırlanıyor, Yolda, Teslim edildi, İptal.
`;

/**
 * Ürün listesini Supabase REST üzerinden çeker (Asistanın güncel depoyu bilmesi için)
 */
async function fetchCurrentProductList(): Promise<string> {
  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !publishableKey) return "";

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?select=name,description,category,unit&is_active=eq.true&order=name&limit=150`,
      { headers: { apikey: publishableKey } },
    );
    if (!res.ok) return "";
    const rows = (await res.json()) as Array<{
      name: string;
      description: string;
      category: string;
      unit: string;
    }>;
    return rows
      .map(
        (p) =>
          `- ${p.name} | Kategori: ${p.category} | Birim: ${p.unit} (${p.description || "Standart ambalaj"})`,
      )
      .join("\n");
  } catch {
    return "";
  }
}

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateWithFallback(ai: GoogleGenAI, params: any) {
  let lastError: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      if (response) {
        return response;
      }
    } catch (err) {
      console.warn(`[Gemini] Model ${model} failed, attempting fallback...`, err);
      lastError = err;
    }
  }
  throw lastError || new Error("Yapay zeka yanıt üretemedi.");
}

/**
 * Destek ve Sohbet Asistanı (Müşteri & Yönetici ayrımı ile)
 */
export const askSupport = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["API_KEY"];
    const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
    const productList = await fetchCurrentProductList();

    let systemInstruction = "";

    if (data.isAdmin) {
      // YÖNETİCİ MODU (Faruk, Suat, Yavuz, Mücahit, Selim için özel)
      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. depo yönetim asistanısın.
Şu an KasımOğulları'nın yetkili bir yöneticisi ile görüşüyorsun.
Görevin:
1. Yöneticilere depodaki ürünleri yönetme, yeni ürün oluşturma, fotoğraf ile otomatik ürün ekleme konularında tam destek vermek.
2. Yöneticinin yeni ürün taleplerini veya stok sorularını hızlıca yanıtlamak.
3. Bir ürünün fotoğrafı yüklendiğinde veya ürün eklendiğinde bunu onaylayıp yönetim paneliyle senkronize olduğunu belirtmek.
4. Hitabın: Saygılı, net, operasyonel ve samimi ("Faruk Bey / Yönetici Bey / Değerli Yöneticimiz").

${SITE_INFO}

Depodaki Mevcut Ürünler:
${productList || "(Ürün listesi şu an yüklenemedi)"}`;
    } else {
      // MÜŞTERİ MODU (Bakkallar, marketler, ziyaretçiler)
      const customerInfo = data.userMeta?.businessName
        ? `Müşteri: ${data.userMeta.fullName || ""} (${data.userMeta.businessName}, Tel: ${data.userMeta.phone || ""})`
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

Depodaki Mevcut Ürünler:
${productList || "(Ürün listesi şu an yüklenemedi)"}`;
    }

    try {
      const contents = data.messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

      const response = await generateWithFallback(ai, {
        contents,
        config: {
          systemInstruction,
        },
      });

      const reply = response.text?.trim() || "Anlayamadım, lütfen tekrar sorabilir misiniz?";
      return { ok: true as const, reply };
    } catch (error) {
      console.error("[askSupport] Error:", error);
      return {
        ok: false as const,
        reply: "Şu an bağlantıda kısa bir yoğunluk var, lütfen bir saniye sonra tekrar deneyin.",
      };
    }
  });

/**
 * Fotoğraftan Ürün Bilgisi Çıkarma (Yöneticiler için Otomatik Ürün Ekleme)
 */
export const analyzeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data) => imageAnalysisSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["API_KEY"];
    const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

    // Base64 veri başlığını (data:image/jpeg;base64,) temizle
    const cleanBase64 = data.imageBase64.includes(",")
      ? data.imageBase64.split(",")[1]!
      : data.imageBase64;

    const systemPrompt = `Sen KasımOğulları Ltd. Şti. toptan gıda, bakliyat ve temizlik deposu için ürün analizi yapan yapay zeka asistanısın.
Fotoğraftaki ürünü inceleyip toptan katalog için şu alanları kesin bir JSON nesnesi olarak döndür:
- name: Ürün markası, adı ve gramaj/hacim bilgisi (Örn: "Çaykur Rize Turist Çay 1000g", "Bingo Matik Çamaşır Deterjanı 6kg", "Dalan Gliserinli Sabun 600g")
- category: Kesinlikle şu 4 değerden biri olmalıdır: "gida", "bakliyat", "temizlik", "kisisel"
- unit: Toptan satış ambalajı (Örn: "Koli (12 Adet)", "Koli (24 Adet)", "Çuval (25 kg)", "Paket", "Koli")
- description: Toptan satışa uygun kısa ve net açıklama (Örn: "Orijinal ambalajında kaliteli toptan çay. Market ve bakkallara toptan dağıtım.")

${data.note ? `Yöneticinin eklediği not: "${data.note}"` : ""}

Sadece geçerli bir JSON nesnesi döndür, markdown veya başka metin ekleme.`;

    try {
      const response = await generateWithFallback(ai, {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: data.mimeType || "image/jpeg",
                  data: cleanBase64,
                },
              },
              {
                text: "Bu ürün fotoğrafını analiz et ve KasımOğulları toptan kataloğuna eklenmek üzere JSON nesnesini üret.",
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      let rawJson = response.text?.trim() || "{}";
      if (rawJson.startsWith("```json")) {
        rawJson = rawJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (rawJson.startsWith("```")) {
        rawJson = rawJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(rawJson) as {
        name?: string;
        category?: string;
        unit?: string;
        description?: string;
      };

      const validCategory =
        parsed.category === "gida" ||
        parsed.category === "bakliyat" ||
        parsed.category === "temizlik" ||
        parsed.category === "kisisel"
          ? parsed.category
          : "gida";

      return {
        ok: true as const,
        product: {
          name: parsed.name || "Yeni Ürün",
          category: validCategory,
          unit: parsed.unit || "Koli",
          description: parsed.description || "KasımOğulları toptan depo ürünü.",
        },
      };
    } catch (error) {
      console.error("[analyzeProductImage] Vision error:", error);
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Görsel analiz edilemedi",
      };
    }
  });
