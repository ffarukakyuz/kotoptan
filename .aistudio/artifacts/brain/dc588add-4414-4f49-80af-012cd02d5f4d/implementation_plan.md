# Kotoptan Logo K Harfi Entegrasyonu ve Ön İzleme Planı

Kullanıcının yüklediği görseldeki parlak zümrüt yeşili, keskin kavisli ve modern tipografik **K** harfi formunun, Kotoptan'ın mevcut amblemindeki standart K harfi yerine uyarlanması ve siteye/yönetim paneline aktarılmadan önce burada doğrudan sunulması planı.

---

### Yüklenen Referans Görsel

![Yüklenen Yeni K Tasarımı](Gemini_Generated_Image_t9t0o4t9t0o4t9t0.png)

---

## Kullanıcı Tercihleri ve Alınan Kararlar

> [!IMPORTANT]
> Kullanıcı teyidi doğrultusunda **sitede ve yönetim panelinde hiçbir değişiklik yapılmayacak**, tasarım öncelikle burada kullanıcı onayına sunulacak ve kullanıcı beğenirse yayına alınacaktır.

- **K Harfi Entegrasyon Biçimi**: Arka plandaki ekstra yıldız/ışıltı kümeleri yerine sadece yüklenen görseldeki zümrüt kavisli, modern fütüristik **K** harfi formu Kotoptan amblemine adapte edilecek.
- **Yayınlama Politikası**: Kullanıcı burada tasarımı görüp onaylamadan siteye, logolara veya yönetim paneline hiçbir dosya yüklenmeyecektir.

---

## 1. Genel Bakış ve Tasarım Hedefi

- **Amaç**: Kotoptan toptan gıda ve tüketim malları markasının logosundaki mevcut geleneksel "K" harfini, kullanıcının yüklediği görseldeki yeşil neon, derin gölgeli, keskin hatlı ve kavisli stilize "K" harfi ile değiştirmek.
- **Karakter ve Kimlik**: Kotoptan'ın kurumsal zümrüt yeşili (`#10b981` / `#059669`) ve derin koyu yeşil/siyah arka plan tonları korunarak modern, akılda kalıcı ve prestijli bir marka amblemi elde etmek.

---

## 2. Tasarım ve Karşılaştırma Analizi

```
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│          Mevcut Amblem          │        │     Yeni Tasarım Uyarlaması     │
├─────────────────────────────────┤        ├─────────────────────────────────┤
│ • Dairesel zümrüt çerçeve       │  --->  │ • Dairesel zümrüt çerçeve       │
│ • Standart K harfi formu        │        │ • Keskin kavisli zümrüt K harfi │
│ • Klasik kurumsal görünüm       │        │ • Derinlikli, dinamik hatlar    │
└─────────────────────────────────┘        └─────────────────────────────────┘
```

### Görsel Kimlik Detayları:

1. **Harf Anatomisi**:
   - Üst ve alt kolları kavisli, hançer formunda keskin bitişli zümrüt yeşili ve siyah gölgeli gövde.
   - İki kolun ortadan kesiştiği aerodinamik, güçlü vurgu.
2. **Renk Paleti**:
   - Zümrüt Yeşili: `#10b981` & `#34d399`
   - Koyu Zümrüt Gölgeler: `#064e3b` & `#022c22`
   - Parlak Beyaz/Açık Yeşil Kenar Işıltıları (Glow): `#a7f3d0`
3. **Uygulanacak Alanlar (Yalnızca Beğenilip Onay Verildikten Sonra)**:
   - `/public/kotoptan-logo.jpg`
   - `/public/kotoptan-logo-v2.jpg`
   - `BRAND_LOGO_SRC` referansları (`/src/lib/branding.ts`)
   - Favicon ve PWA simgeleri (kullanıcı isterse)

---

## 3. Uygulama Adımları

1. **Görsel Üretimi & Mockup Hazırlığı**:
   - Yüklenen referans görseldeki K harfi formunu Kotoptan amblemiyle kusursuz şekilde harmanlayan 1:1 kare ve koyu arka planlı logo görselini oluşturmak.
2. **Kullanıcıya Sunum**:
   - Hazırlanan logo görselini doğrudan burada kullanıcıya göstermek.
3. **Kullanıcı Onayı & Yayına Alma**:
   - Kullanıcı "Beğendim, yayına al" derse:
     - `/public/` altındaki logo dosyaları güncellenecek.
     - Sitedeki header, splash screen ve sepet bileşenleri test edilecek.
   - Kullanıcı revize isterse:
     - Renk, kalınlık veya ışık ayarlamaları yapılacak.

---

## 4. Güvenlik ve Geri Alınabilirlik

- Mevcut logoların yedekleri saklanacak (`kotoptan-logo-backup.jpg`).
- Kullanıcı onay verene kadar tek bir kod veya asset dosyasına dokunulmayacaktır.
