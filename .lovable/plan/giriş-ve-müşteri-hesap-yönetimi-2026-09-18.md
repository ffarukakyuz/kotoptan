# Giriş ve müşteri hesap yönetimi

## Yapılacaklar
- Girişteki mevcut hatayı doğrulayıp kullanıcıya doğru telefon ve şifre biçimini göstereceğim.
- Yönetim alanındaki Üyeler bölümüne ad, işletme adı, telefon ve adres düzenleme işlemleri ekleyeceğim.
- Yönetici tarafından yeni şifre belirleme ve müşteri hesabını tamamen silme işlemleri ekleyeceğim.
- Beş sabit yönetici hesabının silinmesini ve yönetici yetkisinin yanlışlıkla değiştirilmesini engelleyeceğim.
- Her işlemi yalnızca giriş yapmış bir yönetici çalıştırabilecek; müşteri verileri tarayıcıdan ayrıcalıklı erişime açılmayacak.
- Giriş, düzenleme, şifre yenileme ve silme akışlarını test edeceğim.
- Kodun, ürün görsel göstergelerinin ve veritabanı durumunun aktarım durumunu kontrol edeceğim; GitHub bağlantısı yoksa kalan tek kullanıcı adımını açıkça belirteceğim.

## Teknik ayrıntılar
- Hesap işlemleri, yönetici rolünü sunucuda doğrulayan güvenli sunucu işlevleriyle yapılacak.
- Profil düzenlemeleri `profiles`, giriş telefonu ve şifre işlemleri kimlik sistemi üzerinden birlikte güncellenecek.
- Hesap silme öncesi onay istenecek; ilişkili siparişleri bulunan hesaplarda veri bütünlüğü korunacak ve anlaşılır hata gösterilecek.
