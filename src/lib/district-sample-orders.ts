import { supabase } from "@/integrations/supabase/client";
import {
  LOCAL_ORDERS_KEY,
  DELETED_ORDERS_KEY,
  TEST_ORDERS_PURGED_FLAG,
  type StoredOrder,
} from "@/lib/order-storage";
import { adjustIfInLakeVan } from "@/lib/location-utils";

export interface DistrictOrderDefinition {
  district: "tatvan" | "bitlis" | "ahlat" | "adilcevaz" | "guroymak" | "hizan";
  districtName: string;
  customers: Array<{
    business_name: string;
    full_name: string;
    phone: string;
    neighborhood: string;
    street: string;
    coords: { lat: number; lng: number };
    status: "yolda" | "beklemede" | "hazirlaniyor";
    items: Array<{ product_name: string; unit: string; quantity: number }>;
  }>;
}

export const DISTRICT_SAMPLE_DEFINITIONS: DistrictOrderDefinition[] = [
  // 1. TATVAN (10 Müşteri Siparişi)
  {
    district: "tatvan",
    districtName: "Tatvan",
    customers: [
      {
        business_name: "Tatvan Göller Market",
        full_name: "Mehmet Demir",
        phone: "0532 411 20 01",
        neighborhood: "Aydınlar Mahallesi",
        street: "İstiklal Caddesi No: 14",
        coords: { lat: 38.4995, lng: 42.2785 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 5,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 10 },
        ],
      },
      {
        business_name: "Van Gölü Şarküteri & Kahvaltı",
        full_name: "Ahmet Kaya",
        phone: "0543 512 30 02",
        neighborhood: "Cumhuriyet Mahallesi",
        street: "Cumhuriyet Caddesi No: 45",
        coords: { lat: 38.5021, lng: 42.2854 },
        status: "yolda",
        items: [
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 8 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 12 },
          { product_name: "Karakovan Süzme Bal 850g", unit: "Kavanoz", quantity: 6 },
        ],
      },
      {
        business_name: "Tatvan Sahil Kafe & Unlu Mamulleri",
        full_name: "Fatma Çelik",
        phone: "0535 613 40 03",
        neighborhood: "Sahil Mahallesi",
        street: "Van Gölü Bulvarı No: 12",
        coords: { lat: 38.504, lng: 42.282 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 10,
          },
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 15 },
        ],
      },
      {
        business_name: "Kale Çarşı Bakkaliyesi",
        full_name: "Ali Yılmaz",
        phone: "0544 714 50 04",
        neighborhood: "Kale Mahallesi",
        street: "Çarşı İçi Caddesi No: 8",
        coords: { lat: 38.4942, lng: 42.2715 },
        status: "yolda",
        items: [
          { product_name: "Eski Kaşar Peyniri Göbek", unit: "Kalıp", quantity: 4 },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Fatih Mini Market & Büfe",
        full_name: "Mustafa Öztürk",
        phone: "0536 815 60 05",
        neighborhood: "Fatih Mahallesi",
        street: "Barış Caddesi No: 33",
        coords: { lat: 38.506, lng: 42.279 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 6,
          },
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 5 },
        ],
      },
      {
        business_name: "Karşıyaka Esnaf Bakkalı",
        full_name: "Hüseyin Aydın",
        phone: "0537 916 70 06",
        neighborhood: "Karşıyaka Mahallesi",
        street: "Gül Sokak No: 5",
        coords: { lat: 38.489, lng: 42.268 },
        status: "yolda",
        items: [
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 12 },
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 6 },
        ],
      },
      {
        business_name: "Kültür Gıda & Manav",
        full_name: "Emine Şahin",
        phone: "0545 117 80 07",
        neighborhood: "Kültür Mahallesi",
        street: "Sanat Sokak No: 18",
        coords: { lat: 38.5035, lng: 42.276 },
        status: "beklemede",
        items: [
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 6 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 4,
          },
        ],
      },
      {
        business_name: "Tuğ Feribot Sahil Büfesi",
        full_name: "İbrahim Yıldız",
        phone: "0538 218 90 08",
        neighborhood: "Tuğ Mahallesi",
        street: "Feribot İskelesi Yolu No: 22",
        coords: { lat: 38.508, lng: 42.281 },
        status: "beklemede",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 20 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 5 },
        ],
      },
      {
        business_name: "Esentepe Bereket Şarküteri",
        full_name: "Hasan Koç",
        phone: "0546 319 00 09",
        neighborhood: "Esentepe Mahallesi",
        street: "Şafak Sokak No: 7",
        coords: { lat: 38.4925, lng: 42.274 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 4 },
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 6 },
        ],
      },
      {
        business_name: "Çağlayan Su & Gıda Pazarı",
        full_name: "Zeynep Aslan",
        phone: "0539 420 10 10",
        neighborhood: "Çağlayan Mahallesi",
        street: "Dere Kenarı Caddesi No: 19",
        coords: { lat: 38.487, lng: 42.2635 },
        status: "hazirlaniyor",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 10 },
        ],
      },
    ],
  },

  // 2. BİTLİS (10 Müşteri Siparişi)
  {
    district: "bitlis",
    districtName: "Bitlis",
    customers: [
      {
        business_name: "Bitlis Kalesi Şarküteri",
        full_name: "Kemal Uçar",
        phone: "0533 521 21 01",
        neighborhood: "Şerefiye Mahallesi",
        street: "Çarşı Caddesi No: 12",
        coords: { lat: 38.3995, lng: 42.1085 },
        status: "yolda",
        items: [
          { product_name: "Bitlis Yöresel Karakovan Balı", unit: "Kavanoz", quantity: 8 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 10 },
        ],
      },
      {
        business_name: "Hüsrevpaşa Gross Market",
        full_name: "Selim Tunç",
        phone: "0542 622 32 02",
        neighborhood: "Hüsrevpaşa Mahallesi",
        street: "Ahmet Eren Bulvarı No: 54",
        coords: { lat: 38.412, lng: 42.118 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 15,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 12 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 10 },
        ],
      },
      {
        business_name: "İnönü Kalealtı Bakkaliyesi",
        full_name: "Recep Bulut",
        phone: "0531 723 43 03",
        neighborhood: "İnönü Mahallesi",
        street: "Kalealtı Sokak No: 9",
        coords: { lat: 38.397, lng: 42.106 },
        status: "yolda",
        items: [
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 6 },
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 10 },
        ],
      },
      {
        business_name: "Atatürk Bulvarı Manav & Gıda",
        full_name: "Dursun Polat",
        phone: "0541 824 54 04",
        neighborhood: "Atatürk Mahallesi",
        street: "Vilayet Caddesi No: 28",
        coords: { lat: 38.4035, lng: 42.1115 },
        status: "yolda",
        items: [
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 6,
          },
        ],
      },
      {
        business_name: "Gök Meydan Ulu Gıda",
        full_name: "Cengiz Varol",
        phone: "0532 925 65 05",
        neighborhood: "Gök Meydan Mahallesi",
        street: "Ulu Cami Yanı No: 3",
        coords: { lat: 38.3985, lng: 42.1075 },
        status: "yolda",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 5 },
          { product_name: "Eski Kaşar Peyniri Göbek", unit: "Kalıp", quantity: 4 },
        ],
      },
      {
        business_name: "Beşminare Süpermarket",
        full_name: "Murat Güven",
        phone: "0543 026 76 06",
        neighborhood: "Beşminare Mahallesi",
        street: "Üniversite Yolu No: 88",
        coords: { lat: 38.418, lng: 42.125 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 12,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 14 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 8 },
        ],
      },
      {
        business_name: "Zeydan Esnaf Bakkalı",
        full_name: "Yunus Yalçın",
        phone: "0535 127 87 07",
        neighborhood: "Zeydan Mahallesi",
        street: "Kazımpaşa Caddesi No: 16",
        coords: { lat: 38.405, lng: 42.113 },
        status: "beklemede",
        items: [
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 4 },
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 5 },
        ],
      },
      {
        business_name: "Gazibey Bereket Gıda",
        full_name: "Şükrü Erdem",
        phone: "0544 228 98 08",
        neighborhood: "Gazibey Mahallesi",
        street: "Nurullah Eren Sokak No: 21",
        coords: { lat: 38.3955, lng: 42.104 },
        status: "beklemede",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 7,
          },
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 10 },
        ],
      },
      {
        business_name: "Hersan Değirmenaltı Market",
        full_name: "Bülent Kılıç",
        phone: "0536 329 09 09",
        neighborhood: "Hersan Mahallesi",
        street: "Değirmenaltı Caddesi No: 11",
        coords: { lat: 38.402, lng: 42.1095 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 8 },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 6 },
        ],
      },
      {
        business_name: "Saray Meydan Büfesi",
        full_name: "Kenan Arslan",
        phone: "0545 430 19 10",
        neighborhood: "Saray Mahallesi",
        street: "Hükümet Konağı Yanı No: 4",
        coords: { lat: 38.4005, lng: 42.108 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 15 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 5,
          },
        ],
      },
    ],
  },

  // 3. AHLAT (10 Müşteri Siparişi)
  {
    district: "ahlat",
    districtName: "Ahlat",
    customers: [
      {
        business_name: "Selçuklu Market Ahlat",
        full_name: "Orhan Beyaz",
        phone: "0532 531 31 01",
        neighborhood: "Selçuklu Mahallesi",
        street: "Kümbetler Caddesi No: 15",
        coords: { lat: 38.751, lng: 42.478 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 10,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Ergezen Çarşı Şarküteri",
        full_name: "Cemal Dinç",
        phone: "0543 632 42 02",
        neighborhood: "Ergezen Mahallesi",
        street: "Çarşı Meydanı No: 8",
        coords: { lat: 38.7535, lng: 42.481 },
        status: "yolda",
        items: [
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 12 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 10 },
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 6 },
        ],
      },
      {
        business_name: "İkikubbe Tarihi Gıda Pazarı",
        full_name: "Halil Bozkurt",
        phone: "0535 733 53 03",
        neighborhood: "İkikubbe Mahallesi",
        street: "Tarihi Yol No: 22",
        coords: { lat: 38.748, lng: 42.475 },
        status: "yolda",
        items: [
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 8 },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 10 },
        ],
      },
      {
        business_name: "Ahlat Kale Çarşı Kafe",
        full_name: "Deniz Karahan",
        phone: "0544 834 64 04",
        neighborhood: "Kale Mahallesi",
        street: "Kale İçi Caddesi No: 34",
        coords: { lat: 38.754, lng: 42.482 },
        status: "yolda",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 20 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
        ],
      },
      {
        business_name: "Kırklar Şehitler Bakkaliyesi",
        full_name: "Salih Gündüz",
        phone: "0536 935 75 05",
        neighborhood: "Kırklar Mahallesi",
        street: "Şehitler Caddesi No: 7",
        coords: { lat: 38.756, lng: 42.479 },
        status: "yolda",
        items: [
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 6 },
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 5 },
        ],
      },
      {
        business_name: "Kulaksız Bereket Market",
        full_name: "Veli Yıldırım",
        phone: "0537 036 86 06",
        neighborhood: "Kulaksız Mahallesi",
        street: "Bayındır Sokak No: 18",
        coords: { lat: 38.752, lng: 42.477 },
        status: "yolda",
        items: [
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 10 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 5,
          },
        ],
      },
      {
        business_name: "Tahtısüleyman Bahçe Gıda",
        full_name: "Fikret Taş",
        phone: "0545 137 97 07",
        neighborhood: "Tahtısüleyman Mahallesi",
        street: "Bahçe Sokak No: 11",
        coords: { lat: 38.746, lng: 42.472 },
        status: "beklemede",
        items: [
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 6 },
          { product_name: "Eski Kaşar Peyniri Göbek", unit: "Kalıp", quantity: 3 },
        ],
      },
      {
        business_name: "Yuvadamı Köy Bakkalı",
        full_name: "Davut Çetin",
        phone: "0538 238 08 08",
        neighborhood: "Yuvadamı Mahallesi",
        street: "Ahlat Yolu No: 4",
        coords: { lat: 38.759, lng: 42.476 },
        status: "beklemede",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 7,
          },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Harabeşehir Taş Fırın & Gıda",
        full_name: "Bayram Sarı",
        phone: "0546 339 19 09",
        neighborhood: "Harabeşehir Mahallesi",
        street: "Eski Ahlat Sokak No: 19",
        coords: { lat: 38.743, lng: 42.469 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 12 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 6 },
        ],
      },
      {
        business_name: "Tunus Meydan Bakkalı",
        full_name: "Mahmut Alkan",
        phone: "0539 440 29 10",
        neighborhood: "Tunus Mahallesi",
        street: "Meydan Caddesi No: 27",
        coords: { lat: 38.757, lng: 42.48 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 4 },
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 10 },
        ],
      },
    ],
  },

  // 4. ADİLCEVAZ (10 Müşteri Siparişi)
  {
    district: "adilcevaz",
    districtName: "Adilcevaz",
    customers: [
      {
        business_name: "Ceviz Diyarı Şarküteri",
        full_name: "Gökhan Bilgin",
        phone: "0533 641 41 01",
        neighborhood: "Orta Mahalle",
        street: "Hükümet Caddesi No: 10",
        coords: { lat: 38.8035, lng: 42.7285 },
        status: "yolda",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 10 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 8 },
        ],
      },
      {
        business_name: "Alacaatlı Çarşı Süpermarket",
        full_name: "Zafer Şimşek",
        phone: "0542 742 52 02",
        neighborhood: "Alacaatlı Mahallesi",
        street: "Gül Caddesi No: 42",
        coords: { lat: 38.8065, lng: 42.7305 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 12,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 10 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 6 },
        ],
      },
      {
        business_name: "Süphan Dağı Gıda Pazarı",
        full_name: "Tevfik Aksoy",
        phone: "0531 843 63 03",
        neighborhood: "Kale Mahallesi",
        street: "Süphan Caddesi No: 18",
        coords: { lat: 38.8015, lng: 42.726 },
        status: "yolda",
        items: [
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 7 },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Çayır Park Mini Büfe",
        full_name: "Ercan Kurt",
        phone: "0541 944 74 04",
        neighborhood: "Çayır Mahallesi",
        street: "Park Sokak No: 6",
        coords: { lat: 38.8055, lng: 42.728 },
        status: "yolda",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 18 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 6,
          },
        ],
      },
      {
        business_name: "Cevizli Bereket Bakkalı",
        full_name: "Naim Yavuz",
        phone: "0532 045 85 05",
        neighborhood: "Cevizli Mahallesi",
        street: "Bereket Caddesi No: 25",
        coords: { lat: 38.8075, lng: 42.7295 },
        status: "yolda",
        items: [
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 12 },
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 5 },
        ],
      },
      {
        business_name: "Van Gölü Bulvar Marketi",
        full_name: "Hakkı Vural",
        phone: "0543 146 96 06",
        neighborhood: "Atatürk Mahallesi",
        street: "Atatürk Bulvarı No: 14",
        coords: { lat: 38.805, lng: 42.7315 },
        status: "yolda",
        items: [
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 9 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
        ],
      },
      {
        business_name: "Şerefiye Pazar Bakkaliyesi",
        full_name: "Süleyman Duman",
        phone: "0535 247 07 07",
        neighborhood: "Şerefiye Mahallesi",
        street: "Pazar Sokak No: 8",
        coords: { lat: 38.802, lng: 42.727 },
        status: "beklemede",
        items: [
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 6 },
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 5 },
        ],
      },
      {
        business_name: "Selçuklu Çarşı Kafe",
        full_name: "Metin Sezer",
        phone: "0544 348 18 08",
        neighborhood: "Selçuklu Mahallesi",
        street: "Selçuklu Caddesi No: 31",
        coords: { lat: 38.808, lng: 42.731 },
        status: "beklemede",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 10,
          },
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 12 },
        ],
      },
      {
        business_name: "Gültepe Esnaf Bakkalı",
        full_name: "İsmet Özdemir",
        phone: "0536 449 29 09",
        neighborhood: "Gültepe Mahallesi",
        street: "Tepe Sokak No: 12",
        coords: { lat: 38.799, lng: 42.722 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 5 },
        ],
      },
      {
        business_name: "Bahçelievler Doğa Manavı",
        full_name: "Nihat Can",
        phone: "0545 550 39 10",
        neighborhood: "Bahçelievler Mahallesi",
        street: "Doğa Caddesi No: 17",
        coords: { lat: 38.8045, lng: 42.727 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 4 },
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 6 },
        ],
      },
    ],
  },

  // 5. GÜROYMAK (10 Müşteri Siparişi)
  {
    district: "guroymak",
    districtName: "Güroymak",
    customers: [
      {
        business_name: "Güroymak Çarşı Market",
        full_name: "Faruk Kaplan",
        phone: "0532 651 51 01",
        neighborhood: "Barış Mahallesi",
        street: "Çarşı Caddesi No: 14",
        coords: { lat: 38.551, lng: 42.0205 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 10,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 12 },
        ],
      },
      {
        business_name: "Norşin Şarküteri & Süt Ürünleri",
        full_name: "Harun Çetin",
        phone: "0543 752 62 02",
        neighborhood: "Şentepe Mahallesi",
        street: "Kaplıca Yolu No: 33",
        coords: { lat: 38.5545, lng: 42.026 },
        status: "yolda",
        items: [
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 15 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 10 },
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 6 },
        ],
      },
      {
        business_name: "İstasyon Barış Gıda",
        full_name: "Sedat Yaman",
        phone: "0535 853 73 03",
        neighborhood: "Yeşiltepe Mahallesi",
        street: "İstasyon Sokak No: 9",
        coords: { lat: 38.549, lng: 42.017 },
        status: "yolda",
        items: [
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 8 },
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 12 },
        ],
      },
      {
        business_name: "Norşin Bulvar Bakkalı",
        full_name: "Kadir Usta",
        phone: "0544 954 84 04",
        neighborhood: "Bağlar Mahallesi",
        street: "Norşin Caddesi No: 28",
        coords: { lat: 38.553, lng: 42.0235 },
        status: "yolda",
        items: [
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 10 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 6,
          },
        ],
      },
      {
        business_name: "Güroymak Kaplıca Tesisleri Büfe",
        full_name: "Levent Baran",
        phone: "0536 055 95 05",
        neighborhood: "Girne Mahallesi",
        street: "Hastane Sokak No: 11",
        coords: { lat: 38.556, lng: 42.0285 },
        status: "yolda",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 25 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 8 },
        ],
      },
      {
        business_name: "Hürriyet Mini Market",
        full_name: "Mesut Doğan",
        phone: "0537 156 06 06",
        neighborhood: "Yenimahalle",
        street: "Hürriyet Caddesi No: 20",
        coords: { lat: 38.55, lng: 42.019 },
        status: "yolda",
        items: [
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 10 },
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 4 },
        ],
      },
      {
        business_name: "Aşağıkolbaşı Bereket Bakkaliyesi",
        full_name: "Fethi Güler",
        phone: "0545 257 17 07",
        neighborhood: "Aşağıkolbaşı Mahallesi",
        street: "Köy Yolu No: 5",
        coords: { lat: 38.547, lng: 42.014 },
        status: "beklemede",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 6 },
        ],
      },
      {
        business_name: "Gölbaşı Park Manavı",
        full_name: "Adnan Aktaş",
        phone: "0538 358 28 08",
        neighborhood: "Gölbaşı Mahallesi",
        street: "Park Kenarı No: 16",
        coords: { lat: 38.555, lng: 42.027 },
        status: "beklemede",
        items: [
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 7 },
          { product_name: "Eski Kaşar Peyniri Göbek", unit: "Kalıp", quantity: 3 },
        ],
      },
      {
        business_name: "Erentepe Camialtı Gıda",
        full_name: "Cahit Yurt",
        phone: "0546 459 39 09",
        neighborhood: "Erentepe Mahallesi",
        street: "Cami Yanı No: 8",
        coords: { lat: 38.552, lng: 42.022 },
        status: "hazirlaniyor",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 7,
          },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Şirintepe Tepe Bakkalı",
        full_name: "Gürkan Koçak",
        phone: "0539 560 49 10",
        neighborhood: "Şirintepe Mahallesi",
        street: "Tepe Sokak No: 22",
        coords: { lat: 38.557, lng: 42.031 },
        status: "hazirlaniyor",
        items: [
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 6 },
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 4 },
        ],
      },
    ],
  },

  // 6. HİZAN (10 Müşteri Siparişi)
  {
    district: "hizan",
    districtName: "Hizan",
    customers: [
      {
        business_name: "Hizan Bal & Şarküteri Evi",
        full_name: "Tahir Balcı",
        phone: "0533 761 61 01",
        neighborhood: "Yenikent Mahallesi",
        street: "Hükümet Caddesi No: 19",
        coords: { lat: 38.2245, lng: 42.421 },
        status: "yolda",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 15 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 10 },
        ],
      },
      {
        business_name: "Taşlıca Çarşı Bakkaliyesi",
        full_name: "Nurettin Er",
        phone: "0542 862 72 02",
        neighborhood: "Taşlıca Mahallesi",
        street: "Çarşı İçi No: 7",
        coords: { lat: 38.226, lng: 42.4245 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 10 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 6 },
        ],
      },
      {
        business_name: "Hizan Vadisi Gıda Pazarı",
        full_name: "İdris Sancar",
        phone: "0531 963 83 03",
        neighborhood: "Yeşilova Mahallesi",
        street: "Vadi Caddesi No: 35",
        coords: { lat: 38.2225, lng: 42.418 },
        status: "yolda",
        items: [
          { product_name: "Yağlı Beyaz Peynir 1kg", unit: "Teneke", quantity: 8 },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 12 },
        ],
      },
      {
        business_name: "Karşıyaka Esnaf Manavı",
        full_name: "Beşir Kurt",
        phone: "0541 064 94 04",
        neighborhood: "Karşıyaka Mahallesi",
        street: "Dağ Sokak No: 12",
        coords: { lat: 38.2275, lng: 42.427 },
        status: "yolda",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 15 },
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 6,
          },
        ],
      },
      {
        business_name: "Altınoluk Yayla Gıda",
        full_name: "Hamza Oral",
        phone: "0532 165 05 05",
        neighborhood: "Altınoluk Mahallesi",
        street: "Balcılar Sokak No: 4",
        coords: { lat: 38.221, lng: 42.415 },
        status: "yolda",
        items: [
          { product_name: "Doğal Yayık Köy Tereyağı 500g", unit: "Paket", quantity: 14 },
          { product_name: "Tulum Peyniri 1kg", unit: "Teneke", quantity: 5 },
        ],
      },
      {
        business_name: "Nurs Yolu Çayboyu Marketi",
        full_name: "Sabri Bilir",
        phone: "0543 266 16 06",
        neighborhood: "Nurs Yolu Mahallesi",
        street: "Çayboyu Caddesi No: 28",
        coords: { lat: 38.2285, lng: 42.429 },
        status: "yolda",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 9,
          },
          { product_name: "Tatvan Doğal Köy Yoğurdu 3kg", unit: "Kova", quantity: 8 },
        ],
      },
      {
        business_name: "Bahçelievler Okul Büfesi",
        full_name: "Vedat Şen",
        phone: "0535 367 27 07",
        neighborhood: "Bahçelievler Mahallesi",
        street: "Okul Sokak No: 15",
        coords: { lat: 38.2235, lng: 42.4195 },
        status: "beklemede",
        items: [
          { product_name: "Geleneksel Yayık Ayranı 200ml", unit: "Koli (20 Adet)", quantity: 20 },
          { product_name: "Taze Kaşar Peyniri 1kg", unit: "Kalıp", quantity: 5 },
        ],
      },
      {
        business_name: "Tepe Yayla Bakkaliyesi",
        full_name: "Cevdet Uğur",
        phone: "0544 468 38 08",
        neighborhood: "Tepe Mahallesi",
        street: "Yayla Yolu No: 2",
        coords: { lat: 38.2295, lng: 42.431 },
        status: "beklemede",
        items: [
          { product_name: "Taze Lor Peyniri 1kg", unit: "Paket", quantity: 6 },
          { product_name: "Eski Kaşar Peyniri Göbek", unit: "Kalıp", quantity: 4 },
        ],
      },
      {
        business_name: "Zafer Şehitler Gıda",
        full_name: "Yasin Kaya",
        phone: "0536 569 49 09",
        neighborhood: "Zafer Mahallesi",
        street: "Şehitler Caddesi No: 21",
        coords: { lat: 38.2255, lng: 42.423 },
        status: "hazirlaniyor",
        items: [
          {
            product_name: "KasımOğulları Tatvan Tam Yağlı Süt 1L",
            unit: "Koli (12 Adet)",
            quantity: 8,
          },
          { product_name: "Köy Usulü Süzme Yoğurt 1kg", unit: "Kova", quantity: 10 },
        ],
      },
      {
        business_name: "Cumhuriyet Meydan Marketi",
        full_name: "Lokman Demirtaş",
        phone: "0545 670 59 10",
        neighborhood: "Cumhuriyet Mahallesi",
        street: "Meydan No: 10",
        coords: { lat: 38.224, lng: 42.42 },
        status: "hazirlaniyor",
        items: [
          { product_name: "Bitlis Karakovan Balı 1kg", unit: "Kavanoz", quantity: 6 },
          { product_name: "KasımOğulları Geleneksel Tereyağı 1kg", unit: "Paket", quantity: 8 },
        ],
      },
    ],
  },
];

/**
 * 6 İlçe İçin 10'ar Sipariş (Toplam 60 Sipariş) oluşturur ve kaydeder.
 * Her sipariş gerçek GPS koordinatı (📍 Konum: lat, lng) içerir.
 */
export async function seedAllDistrictTestOrders(): Promise<{ count: number; districts: number }> {
  if (typeof window === "undefined") return { count: 0, districts: 0 };

  const allOrdersToCreate: StoredOrder[] = [];
  const now = Date.now();
  let indexCounter = 0;

  for (const def of DISTRICT_SAMPLE_DEFINITIONS) {
    for (const cust of def.customers) {
      indexCounter++;
      // Dağıtılmış gerçekçi oluşturulma tarihi (son 24 saat içinde saat saat geriye)
      const createdAt = new Date(now - indexCounter * 12 * 60 * 1000).toISOString();
      const orderId = `test-order-${def.district}-${indexCounter.toString().padStart(2, "0")}`;

      const safeCoords = adjustIfInLakeVan(cust.coords.lat, cust.coords.lng);
      // Adres formatı: Mahalle, Cadde/Sokak, İlçe, Bitlis (📍 Konum: lat, lng)
      const addressString = `${cust.neighborhood}, ${cust.street}, ${def.districtName}, Bitlis (📍 Konum: ${safeCoords.lat.toFixed(6)}, ${safeCoords.lng.toFixed(6)})`;

      const newOrder: StoredOrder = {
        id: orderId,
        created_at: createdAt,
        archived_at: null,
        status: cust.status,
        full_name: cust.full_name,
        business_name: cust.business_name,
        district: def.district,
        phone: cust.phone,
        address: addressString,
        note: `Rota deneme siparişi (${def.districtName} - ${cust.business_name})`,
        order_items: cust.items.map((it, itemIdx) => ({
          id: `item-${orderId}-${itemIdx + 1}`,
          product_name: it.product_name,
          unit: it.unit,
          quantity: it.quantity,
        })),
      };

      allOrdersToCreate.push(newOrder);
    }
  }

  // 1. LocalStorage güncelle (Deleted listesinden çıkar, orders listesine ekle)
  try {
    const deletedRaw = localStorage.getItem(DELETED_ORDERS_KEY);
    if (deletedRaw) {
      const deletedSet = new Set<string>(JSON.parse(deletedRaw));
      allOrdersToCreate.forEach((o) => deletedSet.delete(o.id));
      localStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(Array.from(deletedSet)));
    }

    const currentLocal = JSON.parse(
      localStorage.getItem(LOCAL_ORDERS_KEY) || "[]",
    ) as StoredOrder[];
    const nonTestLocal = currentLocal.filter((o) => !o.id.startsWith("test-order-"));
    const updatedLocal = [...allOrdersToCreate, ...nonTestLocal];
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updatedLocal));
    localStorage.setItem(TEST_ORDERS_PURGED_FLAG, "true");
  } catch (err) {
    console.warn("[seedAllDistrictTestOrders] LocalStorage write error:", err);
  }

  // 2. Supabase varsa oraya da yazmayı dene (hata verse bile localde %100 çalışır)
  try {
    const dbOrders = allOrdersToCreate.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      archived_at: o.archived_at,
      status: o.status,
      full_name: o.full_name,
      business_name: o.business_name,
      district: o.district,
      phone: o.phone,
      address: o.address,
      note: o.note,
    }));

    await supabase.from("orders").upsert(dbOrders, { onConflict: "id" });

    const allDbItems: Array<{
      id: string;
      order_id: string;
      product_name: string;
      unit: string;
      quantity: number;
    }> = [];

    allOrdersToCreate.forEach((o) => {
      o.order_items.forEach((item) => {
        allDbItems.push({
          id: item.id,
          order_id: o.id,
          product_name: item.product_name,
          unit: item.unit,
          quantity: item.quantity,
        });
      });
    });

    if (allDbItems.length > 0) {
      await supabase.from("order_items").upsert(allDbItems, { onConflict: "id" });
    }
  } catch (err) {
    console.warn(
      "[seedAllDistrictTestOrders] Supabase sync notice (local storage is primary):",
      err,
    );
  }

  // Olayları tetikle ki UI anında yenilensin
  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));

  return { count: allOrdersToCreate.length, districts: DISTRICT_SAMPLE_DEFINITIONS.length };
}
