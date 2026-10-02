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
  return new GoogleGenAI({
    apiKey: apiKey || undefined,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
      timeout: 12000,
    },
  });
}

const SITE_INFO = `
Firma: KasımOğulları Ltd. Şti. — Bitlis ve ilçelerindeki bakkal, market ve perakendecilere toptan satış yapan ana gıda, bakliyat ve temizlik deposu.
Depo Yetkilileri ve Yöneticiler: Faruk Akyüz, Yavuz Akyüz, Mücahit Akyüz, Selim Akyüz, Suat Akyüz.
Site bölümleri:
- Ana sayfa (/): Canlı vitrin, kategori filtreleri (Tümü, Gıda, Bakliyat, Temizlik, Kişisel Bakım) ve arama.
- Ürün sayfası (/urun/{id}): Ürün ambalajı, birim bilgisi ve hızlı sipariş.
- Sepet (/sepet): Toptan sipariş özeti ve sipariş tamamlama. İsim, market adı, ilçe ve adres istenir.
- Siparişlerim (/siparislerim): Verilen siparişlerin takibi.
- Yönetim paneli (/yonetim): Yalnızca yöneticilerin eriştiği ürün ekleme/düzenleme, sipariş onaylama ve müşteri yönetimi.

Önemli Toptan Satış Kuralları:
- Sitede toptan satış yapıldığı ve fiyatlar piyasa dinamiklerine göre anlık değişebildiği için doğrudan sabit fiyat yazılmaz.
- Müşteri siparişi oluşturduktan sonra depo yönetimi (Faruk Bey / Suat Bey) siparişi onaylar ve kendi servis araçlarımızla yapılan teslimat esnasında nakit/tahsilat yapılır.
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
  // Use models according to gemini-api skill: 3.1-flash-lite (fast & robust), 3.8-flash, flash-latest
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  const ai = getGeminiClient();

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.65,
        },
      });

      const reply = response.text?.trim();
      if (reply) {
        return { ok: true, reply };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[callGemini] Model ${model} failed, trying next:`, errMsg);
    }
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
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  const ai = getGeminiClient();

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
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
                text: `Bu ürün fotoğrafını analiz et ve toptan kataloğa eklenmek üzere JSON formatında döndür. Sadece JSON nesnesi döndür.${note ? ` Not: "${note}"` : ""}`,
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

      let parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }

      const rawName = parsed.name || parsed.urun_adi || parsed.title;
      const rawCat = (parsed.category || parsed.kategori || "").toLowerCase();
      const rawUnit = parsed.unit || parsed.birim;
      const rawDesc = parsed.description || parsed.aciklama;

      let validCategory = "gida";
      if (["gida", "bakliyat", "temizlik", "kisisel"].includes(rawCat)) {
        validCategory = rawCat;
      } else if (
        rawCat.includes("temiz") ||
        rawCat.includes("deterjan") ||
        rawCat.includes("sabun") ||
        rawCat.includes("yumusat")
      ) {
        validCategory = "temizlik";
      } else if (
        rawCat.includes("bakliyat") ||
        rawCat.includes("pirinc") ||
        rawCat.includes("mercimek") ||
        rawCat.includes("fasulye")
      ) {
        validCategory = "bakliyat";
      } else if (
        rawCat.includes("kisisel") ||
        rawCat.includes("sampuan") ||
        rawCat.includes("krem") ||
        rawCat.includes("dis")
      ) {
        validCategory = "kisisel";
      }

      if (rawName) {
        return {
          ok: true,
          product: {
            name: rawName,
            category: validCategory,
            unit: rawUnit || "Koli",
            description: rawDesc || "KasımOğulları toptan depo ürünü.",
          },
        };
      }
    } catch (err) {
      console.warn(`[callGeminiVision] Error with ${model}:`, err);
    }
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

function searchCatalogLocally(query: string): string | null {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return null;

  const matches = FALLBACK_PRODUCTS.filter((p) => {
    const nameLower = p.name.toLowerCase();
    const catLower = p.category.toLowerCase();
    const descLower = (p.description || "").toLowerCase();

    // Check individual keywords
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    if (
      words.length > 0 &&
      words.every((w) => nameLower.includes(w) || catLower.includes(w) || descLower.includes(w))
    ) {
      return true;
    }

    return nameLower.includes(q) || catLower.includes(q);
  });

  if (matches.length > 0) {
    const topMatches = matches.slice(0, 6);
    const lines = topMatches
      .map((p) => {
        const isOutOfStock = p.description && /\[(TÜKENDİ|STOK_YOK)\]/i.test(p.description);
        const cleanDesc = (p.description || "").replace(/\[(TÜKENDİ|STOK_YOK)\]/gi, "").trim();
        return `• **${p.name}** (${p.unit}${cleanDesc ? ` · ${cleanDesc}` : ""}) — ${
          isOutOfStock ? "⚠️ Stokta kalmadı" : "✅ Stokta var"
        }`;
      })
      .join("\n");

    return `Evet! Aradığınız ürünle ilgili depomuzda bulunan çeşitler:\n\n${lines}\n\nİhtiyacınız olan ürünleri sepetinize ekleyerek siparişinizi oluşturabilirsiniz. Başka bakmak istediğiniz bir ürün var mı?`;
  }

  return null;
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
      systemInstruction = `Sen "Ko", KasımOğulları Ltd. Şti. toptan gıda, bakliyat ve temizlik deposunun baş yönetim asistanısın.
Şu an KasımOğulları yetkili depo yöneticileriyle (Faruk Akyüz, Suat Akyüz, Yavuz Akyüz, Mücahit Akyüz, Selim Akyüz) görüşüyorsun.

Görevin ve Prensiplerin:
1. Depomuzdaki 197 çeşit ürün, stok durumları, koli ve paket adetleri, yeni ürün açma ve depo operasyonlarında tam destek sağlamak.
2. Saygılı, net, operasyonel ve esnaf samimiyetiyle konuş ("Değerli Yöneticimiz", "Faruk Bey", "Suat Bey").
3. Yeni ürün eklemek istendiğinde fotoğraf atılması veya ürün bilgisi verilmesi durumunda anında yardımcı ol.

${SITE_INFO}

Depodaki 197 Ürünün Tam Listesi:
${productCatalog}`;
    } else {
      const customerInfo = userMeta?.businessName
        ? `Müşteri: ${userMeta.fullName || ""} (${userMeta.businessName}, Tel: ${userMeta.phone || ""})`
        : "Değerli Müşterimiz";

      systemInstruction = `Sen "Ko", Bitlis ve çevre ilçelerinin köklü toptancısı KasımOğulları Ltd. Şti.'nin toptan sipariş asistanısın.
Konuştuğun kişi: ${customerInfo}.

Davranış ve Konuşma Prensiplerin:
1. Esnaf dilinden anlayan, sıcak, samimi, saygılı, net ve güven veren bir üslup kullan ("Hayırlı işler, bol kazançlar dilerim").
2. Asla gereksiz veya boş genel karşılama mesajlarıyla geçiştirme; kullanıcının sorduğu soruya doğrudan ve doyurucu cevap ver.
3. Depomuzdaki 197 çeşit ürünü (Çaykur, Doğuş, Akel, Yudum, Orkide, Omo, Ariel, Fairy, Bingo, Domestos, Solo, Selpak, Clear, Elidor, Blendax vb.) çok iyi tanıyorsun.
4. Müşteri belirli bir ürün sorduğunda:
   - Ürünün depomuzda olup olmadığını net bir şekilde belirt.
   - Koli veya paket içeriğini (örn: Akel pirinç için "Koli İçi 4 Adet", şampuanlar için "Paket İçi 5-6 Adet", deterjanlarda kilo ve koli adetlerini) açıkla.
   - Ürünü doğrudan sepete ekleyerek sipariş verebileceklerini hatırlat.
5. Müşteri genel bir ürün grubu sorduğunda (örn: "Hangi pirinçler var?", "Temizlikte ne var?", "Şampuanlar neler?"):
   - Sadece tek bir cümleyle geçiştirme, depomuzda bulunan markaları ve ambalaj çeşitlerini maddeler halinde veya akıcı bir dille say.
6. Fiyat sorulduğunda:
   - Toptan satış yapıldığı ve piyasa dinamiklerine göre en uygun toptan iskonto uygulandığı için sitede doğrudan fiyat listesi yer almadığını, sipariş sepetten onaylandıktan sonra depo yöneticilerimiz (Faruk Bey ve Suat Bey) tarafından onaylanıp teslimatta tahsil edildiğini nazikçe belirt.
7. Teslimat ilçeleri: Bitlis Merkez, Tatvan, Ahlat, Adilcevaz, Güroymak ve Hizan. Kendi servis araçlarımızla doğrudan market ve bakkal kapısına teslim ediyoruz.
8. Depo yöneticilerimiz: Faruk Akyüz, Suat Akyüz, Yavuz Akyüz, Mücahit Akyüz, Selim Akyüz. Müşterinin özel bir talebi varsa not alıp yöneticilere ileteceğini belirt.

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

    // 3. Akıllı yerel katalog araması (Yapay zeka ağı meşgulken dahi gerçek ürün bilgisiyle yanıt verir)
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lower = lastUserMessage.toLowerCase();

    // Özel katalog araması dene
    const catalogAnswer = searchCatalogLocally(lastUserMessage);
    if (catalogAnswer) {
      return { ok: true, reply: catalogAnswer };
    }

    if (
      lower.includes("fiyat") ||
      lower.includes("kaç para") ||
      lower.includes("tl") ||
      lower.includes("ücret")
    ) {
      return {
        ok: true,
        reply:
          "Merhaba, KasımOğulları Ltd. Şti. olarak market ve bakkallara toptan satış yapmaktayız. Güncel piyasa koşullarına göre en uygun toptan fiyatlar, sepetinizi onayladığınızda depo yöneticilerimiz (Faruk Bey ve Suat Bey) tarafından belirlenir ve kapıda teslimat esnasında tahsil edilir.",
      };
    }
    if (
      lower.includes("nerelere") ||
      lower.includes("ilçe") ||
      lower.includes("teslimat") ||
      lower.includes("servis")
    ) {
      return {
        ok: true,
        reply:
          "KasımOğulları depomuz Bitlis Merkez, Ahlat, Adilcevaz, Güroymak, Hizan ve Tatvan ilçelerindeki market ve bakkallara doğrudan kendi toptan servis araçlarımızla teslimat yapmaktadır.",
      };
    }
    if (lower.includes("sipariş") || lower.includes("nasıl") || lower.includes("alırım")) {
      return {
        ok: true,
        reply:
          "Sitemizdeki 197 adet ürün arasından ihtiyacınız olanları koli veya paket adetleriyle sepetinize ekleyebilir, ilçe ve market adresinizi girerek siparişinizi anında depomuza gönderebilirsiniz. Yöneticilerimiz siparişinizi onaylayıp sevkiyata çıkaracaktır.",
      };
    }
    if (
      lower.includes("iletişim") ||
      lower.includes("telefon") ||
      lower.includes("yetkili") ||
      lower.includes("faruk") ||
      lower.includes("suat")
    ) {
      return {
        ok: true,
        reply:
          "KasımOğulları toptan depomuzun yöneticileri Faruk Akyüz ve Suat Akyüz'dür. Siparişleriniz, özel ürün talepleriniz veya toptan anlaşmalarınız için yöneticilerimizle doğrudan iletişime geçebilirsiniz.",
      };
    }

    return {
      ok: true,
      reply:
        "Merhaba! Ben KasımOğulları toptan sipariş asistanı Ko. Gıda, bakliyat, temizlik ve kişisel bakım ürünlerimiz, koli/paket adetleri ve teslimat süreçleriyle ilgili merak ettiğiniz her şeyi sorabilirsiniz. Size hangi ürünümüz hakkında bilgi vermemi istersiniz?",
    };
  } catch (err) {
    console.error("[processChat] Handler Error:", err);
    return {
      ok: true,
      reply:
        "Merhaba! KasımOğulları toptan depomuza hoş geldiniz. 197 çeşit ürünümüz ve siparişleriniz hakkında size yardımcı olmaktan memnuniyet duyarım.",
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
