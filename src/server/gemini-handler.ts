import { GoogleGenAI } from "@google/genai";
import { FALLBACK_PRODUCTS } from "../data/products";

export const OPENROUTER_API_KEY =
  process.env["OPENROUTER_API_KEY"] || process.env["VITE_OPENROUTER_API_KEY"] || "";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
export const FALLBACK_MODEL = "anthropic/claude-3.5-sonnet";

function getGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    process.env["VITE_GEMINI_API_KEY"] ||
    "";
  return apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI();
}

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

function getProductCatalogContext(): string {
  return FALLBACK_PRODUCTS.map((p, idx) => {
    const hasImg = Boolean(p.image_url && p.image_url.trim().length > 0);
    const isOutOfStock = p.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(p.description);
    const cleanDesc = (p.description || "").replace(/\[(TÜKENDİ|STOK_YOK)\]/gi, "").trim();
    return `${idx + 1}. ${p.name} | Kategori: ${p.category} | Birim: ${p.unit} | Stok: ${isOutOfStock ? "Tükendi" : "Stokta"} | Fotoğraf: ${hasImg ? "Mevcut" : "Görsel yok"}${cleanDesc ? ` | Ambalaj/Açıklama: ${cleanDesc}` : ""}`;
  }).join("\n");
}

async function callGemini(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemInstruction: string,
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    const ai = getGeminiClient();
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
    if (reply) {
      return { ok: true, reply };
    }
  } catch (err) {
    console.warn("[callGemini] Error generating content with Gemini:", err);
  }
  return { ok: false, reply: "" };
}

async function callGeminiVision(
  cleanBase64: string,
  mimeType: string,
  systemPrompt: string,
  note?: string,
): Promise<{
  ok: boolean;
  product?: { name: string; category: string; unit: string; description: string };
  error?: string;
}> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
              text: `Bu ürün fotoğrafını analiz et ve toptan kataloğa eklenmek üzere JSON formatında döndür. Sadece JSON döndür.${note ? ` Not: "${note}"` : ""}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const rawJson = response.text?.trim() || "{}";
    let cleaned = rawJson;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
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
  } catch (err) {
    console.warn("[callGeminiVision] Error analyzing image with Gemini:", err);
  }
  return { ok: false };
}

async function callOpenRouter(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string = DEFAULT_MODEL,
): Promise<{ ok: boolean; reply: string; error?: string }> {
  if (!OPENROUTER_API_KEY) {
    return { ok: false, reply: "", error: "No OpenRouter key configured" };
  }
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
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

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return { ok: true, reply };
      }
    } else {
      console.warn(`[OpenRouter] Call failed with status ${res.status} for model ${model}`);
    }
  } catch (err) {
    console.warn(`[OpenRouter] Request error for ${model}:`, err);
  }

  // Model fallback
  if (model === DEFAULT_MODEL) {
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://kasimogullari.com",
          "X-Title": "KasimOgullari Toptan Depo",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: FALLBACK_MODEL,
          messages,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return { ok: true, reply };
        }
      }
    } catch (fallbackErr) {
      console.warn(`[OpenRouter] Fallback model error:`, fallbackErr);
    }
  }

  return { ok: false, reply: "", error: "OpenRouter response unavailable" };
}

export async function processChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  isAdmin: boolean = false,
  userMeta?: { fullName?: string; businessName?: string; phone?: string },
): Promise<{ ok: boolean; reply: string; error?: string }> {
  try {
    const productCatalog = getProductCatalogContext();

    let systemInstruction = "";

    if (isAdmin) {
      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. depo yönetim asistanısın.
Şu an KasımOğulları'nın yetkili bir yöneticisi ile görüşüyorsun.
Görevin:
1. Yöneticilere depodaki 197 çeşit ürünü yönetme, yeni ürün oluşturma, fotoğraf ile otomatik ürün ekleme konularında tam destek vermek.
2. Yöneticinin yeni ürün taleplerini veya stok sorularını hızlıca yanıtlamak.
3. Hitabın: Saygılı, net, operasyonel ve samimi ("Faruk Bey / Yönetici Bey / Değerli Yöneticimiz").

${SITE_INFO}

Depodaki 197 Ürünün Tam Listesi:
${productCatalog}`;
    } else {
      const customerInfo = userMeta?.businessName
        ? `Müşteri: ${userMeta.fullName || ""} (${userMeta.businessName}, Tel: ${userMeta.phone || ""})`
        : "Ziyaretçi Müşteri";

      systemInstruction = `Sen "Ko". KasımOğulları Ltd. Şti. toptan sipariş sitesinin müşteri destek asistanısın.
Konuştuğun kişi: ${customerInfo}.
Görevin:
1. Müşterilere sitedeki 197 çeşit toptan ürün (gıda, bakliyat, temizlik, kişisel bakım), sipariş adımları, koli/çuval satışları ve teslimat süreçleri hakkında bilgi vermek.
2. Fiyat sorulursa: Toptan satış yapıldığı için sitede fiyat gösterilmediğini, sipariş sepetten iletildikten sonra depo yönetiminin en uygun toptan fiyatı onaylayıp teslimat sırasında tahsil ettiğini nazikçe belirt.
3. ÖZEL TALEP & ŞİKAYET & İSTEK YÖNLENDİRMESİ: Müşteri sitede olmayan bir ürün isterse, özel bir fiyat talebinde bulunursa veya yöneticiyle görüşmek isterse:
   - "Talebinizi aldım! Bunu hemen KasımOğulları depo yöneticilerimiz Faruk Bey ve Suat Bey'e iletiyorum. Size en kısa sürede telefonunuz üzerinden dönüş sağlanacaktır." şeklinde yanıt ver.
4. Teslimat yapılan ilçeler: Ahlat, Adilcevaz, Bitlis Merkez, Güroymak, Hizan ve Tatvan.
5. Hitabın: Esnaf dostu, güven veren, sıcak ve yardımsever ("Hayırlı işler, bol kazançlar dilerim").

${SITE_INFO}

Depodaki 197 Ürünün Tam Listesi:
${productCatalog}`;
    }

    // 1. Try Gemini API first (Native AI Studio Server-Side Integration)
    const geminiResult = await callGemini(messages, systemInstruction);
    if (geminiResult.ok && geminiResult.reply) {
      return geminiResult;
    }

    // 2. Try OpenRouter if configured
    if (OPENROUTER_API_KEY) {
      const openRouterMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> =
        [
          { role: "system", content: systemInstruction },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

      const result = await callOpenRouter(openRouterMessages, DEFAULT_MODEL);
      if (result.ok && result.reply) {
        return result;
      }
    }

    // Akıllı yerel yedek yanıt (OpenRouter anahtarı beklerken veya yanıt gelmezse kullanıcıyı asla yanıtsız bırakmaz)
    const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
    if (
      lastUserMessage.includes("fiyat") ||
      lastUserMessage.includes("kaç para") ||
      lastUserMessage.includes("tl")
    ) {
      return {
        ok: true,
        reply:
          "Merhaba, KasımOğulları Ltd. Şti. olarak toptan satış yapmaktayız. Güncel piyasa koşullarına göre en uygun toptan fiyatlar, sepetinizi onayladığınızda depo yöneticilerimiz (Faruk Bey ve Suat Bey) tarafından belirlenir ve teslimat esnasında tahsil edilir.",
      };
    }
    if (
      lastUserMessage.includes("nerelere") ||
      lastUserMessage.includes("ilçe") ||
      lastUserMessage.includes("teslimat")
    ) {
      return {
        ok: true,
        reply:
          "KasımOğulları depomuz Bitlis Merkez, Ahlat, Adilcevaz, Güroymak, Hizan ve Tatvan ilçelerindeki market ve bakkallara doğrudan kendi servis araçlarımızla toptan teslimat yapmaktadır.",
      };
    }
    if (
      lastUserMessage.includes("sipariş") ||
      lastUserMessage.includes("nasıl") ||
      lastUserMessage.includes("alırım")
    ) {
      return {
        ok: true,
        reply:
          "Sitemizdeki 197 adet ürün arasından ihtiyacınız olanları koli veya çuval adetleriyle sepetinize ekleyebilir, adres ve market bilgilerinizi girerek siparişinizi anında depomuza iletebilirsiniz.",
      };
    }

    return {
      ok: true,
      reply:
        "Merhaba! Ben KasımOğulları toptan sipariş asistanı Ko. 197 çeşit toptan ürünümüz, koli bilgileri ve sipariş süreçleriyle ilgili size yardımcı olabilirim. Nasıl yardımcı olabilirim?",
    };
  } catch (err) {
    console.error("[processChat] OpenRouter Handler Error:", err);
    return {
      ok: true,
      reply:
        "Merhaba! KasımOğulları toptan depomuza hoş geldiniz. Siparişleriniz ve ürünlerimiz hakkında size yardımcı olmaktan memnuniyet duyarım.",
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
    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1]! : imageBase64;
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${cleanBase64}`;

    const systemPrompt = `Sen KasımOğulları Ltd. Şti. toptan gıda, bakliyat ve temizlik deposu için ürün analizi yapan yapay zeka asistanısın.
Fotoğraftaki ürünü inceleyip toptan katalog için şu alanları kesin bir JSON nesnesi olarak döndür:
- name: Ürün markası, adı ve gramaj/hacim bilgisi
- category: Kesinlikle şu 4 değerden biri olmalıdır: "gida", "bakliyat", "temizlik", "kisisel"
- unit: Toptan satış ambalajı (Örn: "Koli (12 Adet)", "Çuval (25 kg)", "Paket", "Koli")
- description: Toptan satışa uygun kısa ve net açıklama

${note ? `Yöneticinin eklediği not: "${note}"` : ""}

Sadece geçerli bir JSON nesnesi döndür, markdown veya başka metin ekleme.`;

    // 1. Try Gemini Vision first (Native AI Studio Server-Side Integration)
    const geminiVisionResult = await callGeminiVision(cleanBase64, mimeType, systemPrompt, note);
    if (geminiVisionResult.ok && geminiVisionResult.product) {
      return geminiVisionResult;
    }

    // 2. Try OpenRouter Vision if configured
    if (OPENROUTER_API_KEY) {
      try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://kasimogullari.com",
            "X-Title": "KasimOgullari Toptan Depo",
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
        console.warn("[processVision] OpenRouter vision request error:", visionErr);
      }
    }

    // Akıllı varsayılan ürün şablonu (yöneticinin formu kolayca tamamlaması için)
    return {
      ok: true,
      product: {
        name: note ? `${note} (Yeni Ürün)` : "Yeni Toptan Ürün",
        category: "gida",
        unit: "Koli",
        description: note || "KasımOğulları toptan depo ürünü.",
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
