import { GoogleGenAI } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
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

export async function processChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<{ ok: boolean; reply: string }> {
  try {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["API_KEY"];
    const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

    let systemInstruction = "";

    if (isAdmin) {
      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. depo yönetim asistanısın.
Şu an KasımOğulları'nın yetkili bir yöneticisi ile görüşüyorsun.
Görevin:
1. Yöneticilere depodaki ürünleri yönetme, yeni ürün oluşturma, fotoğraf ile otomatik ürün ekleme konularında tam destek vermek.
2. Yöneticinin yeni ürün taleplerini veya stok sorularını hızlıca yanıtlamak.
3. Hitabın: Saygılı, net, operasyonel ve samimi ("Faruk Bey / Yönetici Bey / Değerli Yöneticimiz").

${SITE_INFO}`;
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

${SITE_INFO}`;
    }

    const contents = messages.map((m) => ({
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
    return { ok: true, reply };
  } catch (err) {
    console.error("[processChat] Error:", err);
    return {
      ok: false,
      reply: "Şu an bağlantıda kısa bir yoğunluk var, lütfen bir saniye sonra tekrar deneyin.",
    };
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
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["API_KEY"];
    const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1]! : imageBase64;

    const systemPrompt = `Sen KasımOğulları Ltd. Şti. toptan gıda, bakliyat ve temizlik deposu için ürün analizi yapan yapay zeka asistanısın.
Fotoğraftaki ürünü inceleyip toptan katalog için şu alanları kesin bir JSON nesnesi olarak döndür:
- name: Ürün markası, adı ve gramaj/hacim bilgisi
- category: Kesinlikle şu 4 değerden biri olmalıdır: "gida", "bakliyat", "temizlik", "kisisel"
- unit: Toptan satış ambalajı (Örn: "Koli (12 Adet)", "Çuval (25 kg)", "Paket", "Koli")
- description: Toptan satışa uygun kısa ve net açıklama

${note ? `Yöneticinin eklediği not: "${note}"` : ""}

Sadece geçerli bir JSON nesnesi döndür, markdown veya başka metin ekleme.`;

    const response = await generateWithFallback(ai, {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
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
      ok: true,
      product: {
        name: parsed.name || "Yeni Ürün",
        category: validCategory,
        unit: parsed.unit || "Koli",
        description: parsed.description || "KasımOğulları toptan depo ürünü.",
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
