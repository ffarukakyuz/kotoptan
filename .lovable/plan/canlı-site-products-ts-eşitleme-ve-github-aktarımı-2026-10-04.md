# Canlı Site → products.ts Eşitleme ve GitHub Aktarımı

## Durum tespiti (yapıldı)

- `kotoptan.pages.dev` tarandı: site giriş ekranıyla korunuyor, ürünler giriş yapmadan görünmüyor.
- Projede `src/data/products.ts` zaten 197 ürünlük sabit yedek katalog içeriyor (base64 fotoğraflı).
- Projede GitHub remote'u yok — push yapılabilmesi için Lovable–GitHub bağlantısının kurulması şart.

## Plan

### 1. Canlı siteden veri toplama
- Playwright ile `kotoptan.pages.dev` sitesine yönetici hesabıyla (0544 893 13 00) giriş yapılır.
- Katalog sayfaları gezilerek görünen tüm ürünler (ad, kategori, birim, koli içi bilgisi, görsel URL) toplanır.
- Tarayıcı localStorage'ındaki ürün/sepet verileri de okunur.

### 2. Karşılaştırma ve kod güncelleme
- Toplanan ürünler `src/data/products.ts` içindeki `FALLBACK_PRODUCTS` dizisiyle karşılaştırılır.
- Eksik ürünler diziye eklenir; var olanlara dokunulmaz.
- Bileşenlerin veriyi bu dosyadan okuduğu doğrulanır (mevcut yapı zaten böyle çalışıyor).
- Derleme kontrolü yapılır; hata varsa düzeltilir.

### 3. GitHub'a aktarım
- Bu adım sizin tek seferlik bir işleminizi gerektirir: Lovable sohbet kutusundaki **+** menüsü → **GitHub** → **Connect project** → depo oluştur (örn. `ready-catalog-site`).
- Bağlantı kurulduktan sonra tüm değişiklikler otomatik olarak GitHub deposunun `main` dalına gider; ayrıca manuel push gerekmez.
- Ben doğrudan `git push` yapamıyorum — projede GitHub yetkisi/remote'u bulunmuyor.

## Not
- Canlı sitede giriş ekranı dışında içerik olmadığı için 1. adım yalnızca yönetici girişiyle mümkün; şifre 123456 kullanılacak.
- Eğer canlı sitedeki ürünler zaten veritabanındaki 255 ürünle aynıysa, products.ts'e eklenecek yeni bir şey çıkmayabilir; bu durumda sonuç raporlanır.
