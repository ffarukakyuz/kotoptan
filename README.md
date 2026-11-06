# Kotoptan — Toptan Satış ve Sipariş Portalı

Kotoptan toptan gıda, temizlik ve tüketim malları sipariş ve katalog yönetim platformu.
Cloudflare Pages ve Cloudflare D1 veritabanı altyapısıyla desteklenmektedir.

## Özellikler

- **Cloudflare Pages:** `kotoptan` projesi altında kenar sunucularda statik ve hızlı teslimat (`dist` çıktısı).
- **Cloudflare D1:** `kotoptan-db` sunucusuz SQL veritabanı entegrasyonu.
- **PWA Desteği:** Mobil ana ekrana kısayol ekleme, çevrimdışı önbellek koruması ve anında güncelleme.
- **Sipariş ve Sepet Yönetimi:** Sepete ekleme, GPS / harita ile konum işaretleme ve sipariş takibi.
- **Yönetim Paneli:** Ürün ekleme/düzenleme, sipariş onaylama ve GitHub & Cloudflare tek tıkla eşitleme.

## Geliştirme ve Dağıtım

```sh
npm install
npm run dev
```

### Derleme & Cloudflare Dağıtımı

```sh
npm run build
npx wrangler pages deploy dist --project-name=kotoptan
npx wrangler d1 execute kotoptan-db --file=./schema.sql
```
