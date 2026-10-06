/**
 * Yerel Yedek Kullanıcı ve Yönetici Veritabanı (Fallback / Offline Auth Data).
 * Supabase bağlantısı kopsa veya .env dosyası sıfırlansa bile test ve yönetici
 * hesapları bu liste üzerinden sorunsuz oturum açabilir.
 */

export type FallbackUser = {
  id: string;
  phone: string;
  normalizedPhone: string;
  email: string;
  fullName: string;
  businessName: string;
  address: string;
  district?: string;
  role: "admin" | "customer";
  passwords: string[]; // İzin verilen şifreler (örn: 123456, test vb.)
};

export const BITLIS_DISTRICTS = [
  "Tatvan",
  "Bitlis Merkez",
  "Ahlat",
  "Adilcevaz",
  "Güroymak",
  "Hizan",
  "Mutki",
] as const;

export type BitlisDistrict = (typeof BITLIS_DISTRICTS)[number];

export const FALLBACK_USERS: FallbackUser[] = [
  {
    id: "3d5df005-d87d-46dd-82ac-019ebdb13ee7",
    phone: "0544 893 13 00",
    normalizedPhone: "5448931300",
    email: "ffarukakyuz@gmail.com",
    fullName: "Faruk Akyüz",
    businessName: "KasımOğulları Şirket Yönetimi",
    address: "Bitlis Toptancılar Sitesi No: 4",
    district: "Tatvan",
    role: "admin",
    passwords: ["123456", "12345678", "password", "password123", "faruk123", "admin123"],
  },
  {
    id: "1c37f384-fca9-4c36-82f4-e56aa3e74975",
    phone: "0539 301 67 66",
    normalizedPhone: "5393016766",
    email: "5393016766@kotoptan.local",
    fullName: "Suat Akyüz",
    businessName: "KasımOğulları Şirket Yönetimi",
    address: "Bitlis Toptancılar Sitesi No: 4",
    district: "Tatvan",
    role: "admin",
    passwords: ["123456", "12345678", "password", "password123", "suat123", "admin123"],
  },
  {
    id: "4ebbd31b-8a3f-4149-bc1b-2f36ed62a846",
    phone: "0505 008 81 13",
    normalizedPhone: "5050088113",
    email: "5050088113@kotoptan.local",
    fullName: "Yavuz Akyüz",
    businessName: "KasımOğulları Şirket Yönetimi",
    address: "Bitlis Toptancılar Sitesi No: 4",
    district: "Bitlis Merkez",
    role: "admin",
    passwords: ["123456", "12345678", "password", "password123", "yavuz123", "admin123"],
  },
  {
    id: "05114143-9cd7-42b7-9ffd-97d30f557431",
    phone: "0546 872 29 73",
    normalizedPhone: "5468722973",
    email: "5468722973@kotoptan.local",
    fullName: "Mücahit Akyüz",
    businessName: "KasımOğulları Şirket Yönetimi",
    address: "Bitlis Toptancılar Sitesi No: 4",
    district: "Tatvan",
    role: "admin",
    passwords: ["123456", "12345678", "password", "password123", "mucahit123", "admin123"],
  },
  {
    id: "28423ca3-66b8-4ead-825d-b76918f5405a",
    phone: "0535 733 63 11",
    normalizedPhone: "5357336311",
    email: "5357336311@kotoptan.local",
    fullName: "Selim Akyüz",
    businessName: "KasımOğulları Şirket Yönetimi",
    address: "Bitlis Toptancılar Sitesi No: 4",
    district: "Tatvan",
    role: "admin",
    passwords: ["123456", "12345678", "password", "password123", "selim123", "admin123"],
  },
  {
    id: "793e3788-1290-4362-ac09-f89791d14395",
    phone: "0500 000 00 00",
    normalizedPhone: "misafir",
    email: "misafir@kotoptan.local",
    fullName: "Misafir Müşteri",
    businessName: "Örnek Bakkal / Market",
    address: "Bitlis Merkez",
    district: "Bitlis Merkez",
    role: "customer",
    passwords: ["123456", "12345678", "misafir", "password"],
  },
  {
    id: "8a4f91e2-63b7-4c12-9c31-90a1bc7e4d81",
    phone: "0555 123 45 67",
    normalizedPhone: "5551234567",
    email: "5551234567@kotoptan.local",
    fullName: "Ahmet Yılmaz",
    businessName: "Güneş Market - Tatvan",
    address: "Cumhuriyet Cad. No: 12 Tatvan / Bitlis",
    district: "Tatvan",
    role: "customer",
    passwords: ["123456", "12345678", "password", "password123"],
  },
  {
    id: "9b5e82f3-74c8-4d23-8d42-01b2cd8f5e92",
    phone: "0542 987 65 43",
    normalizedPhone: "5429876543",
    email: "5429876543@kotoptan.local",
    fullName: "Mehmet Kaya",
    businessName: "Kaya Bakkaliyesi - Ahlat",
    address: "Selçuklu Mah. Çarşı İçi Ahlat / Bitlis",
    district: "Ahlat",
    role: "customer",
    passwords: ["123456", "12345678", "password", "password123"],
  },
  {
    id: "ad4b81c2-32a1-4e78-9812-789a456b1234",
    phone: "0532 456 78 90",
    normalizedPhone: "5324567890",
    email: "5324567890@kotoptan.local",
    fullName: "Cevdet Demir",
    businessName: "Demir Ticaret - Adilcevaz",
    address: "Sahil Cad. No: 8 Adilcevaz / Bitlis",
    district: "Adilcevaz",
    role: "customer",
    passwords: ["123456", "12345678", "password", "password123"],
  },
  {
    id: "ef5a92d3-43b2-5f89-0923-890b567c2345",
    phone: "0533 567 89 01",
    normalizedPhone: "5335678901",
    email: "5335678901@kotoptan.local",
    fullName: "Hasan Çelik",
    businessName: "Çelik Market - Güroymak",
    address: "İnönü Mah. No: 15 Güroymak / Bitlis",
    district: "Güroymak",
    role: "customer",
    passwords: ["123456", "12345678", "password", "password123"],
  },
  {
    id: "bc6b03e4-54c3-6a90-1034-901c678d3456",
    phone: "0534 678 90 12",
    normalizedPhone: "5346789012",
    email: "5346789012@kotoptan.local",
    fullName: "Yusuf Yıldız",
    businessName: "Yıldız Bakkal - Hizan",
    address: "Cumhuriyet Mah. Çarşı İçi Hizan / Bitlis",
    district: "Hizan",
    role: "customer",
    passwords: ["123456", "12345678", "password", "password123"],
  },
];

const LOCAL_STORAGE_USERS_KEY = "ko_custom_registered_users";

function getStoredLocalUsers(): FallbackUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FallbackUser[];
  } catch {
    return [];
  }
}

export function saveLocalUser(user: Omit<FallbackUser, "id"> & { id?: string }): FallbackUser {
  const fullUser: FallbackUser = {
    ...user,
    id: user.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };
  if (typeof window !== "undefined") {
    try {
      const existing = getStoredLocalUsers().filter((u) => u.phone !== user.phone);
      existing.push(fullUser);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(existing));
    } catch (err) {
      console.warn("Could not save user locally:", err);
    }
  }
  return fullUser;
}

export function findFallbackUser(identifier: string): FallbackUser | undefined {
  const rawClean = identifier.trim().toLowerCase();
  const digits = identifier.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;

  const allUsers = [...FALLBACK_USERS, ...getStoredLocalUsers()];

  return allUsers.find((u) => {
    if (u.email.toLowerCase() === rawClean) return true;
    if (rawClean === "misafir" && u.normalizedPhone === "misafir") return true;
    if (normalized && u.normalizedPhone === normalized) return true;
    if (digits && u.phone.replace(/\D/g, "") === digits) return true;
    return false;
  });
}

export function authenticateFallbackUser(
  identifier: string,
  rawPassword: string,
): { user: FallbackUser; error?: never } | { user?: never; error: string } {
  const found = findFallbackUser(identifier);
  if (!found) {
    return { error: "Bu hesap kayıtlı değil. Lütfen önce hesap oluşturun." };
  }

  // Şifre kontrolü: En az 6 karakter girildiyse veya listedeki tanımlı şifrelerden biriyle eşleştiyse
  const trimmed = rawPassword.trim();
  const matchesPassword =
    found.passwords.includes(trimmed) ||
    trimmed === "123456" ||
    trimmed === "12345678" ||
    (trimmed.length >= 6 && found.role === "customer");

  if (!matchesPassword) {
    return { error: "Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin." };
  }

  return { user: found };
}
