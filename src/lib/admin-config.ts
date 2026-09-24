/**
 * KasımOğulları Ltd. Şti. Yönetici Yapılandırması
 *
 * Kesin kural: Yalnızca aşağıda tanımlı 5 numara/hesap yönetici yetkisine sahiptir.
 * Başka hiçbir hesap yönetici olamaz.
 */

export type AdminMember = {
  name: string;
  phone: string;
  normalizedPhone: string;
  email: string;
  emails?: string[];
  id: string;
};

export const ADMIN_MEMBERS: AdminMember[] = [
  {
    name: "Suat",
    phone: "0539 301 67 66",
    normalizedPhone: "5393016766",
    email: "5393016766@kotoptan.local",
    id: "1c37f384-fca9-4c36-82f4-e56aa3e74975",
  },
  {
    name: "Faruk",
    phone: "0544 893 13 00",
    normalizedPhone: "5448931300",
    email: "5448931300@kotoptan.local",
    emails: ["5448931300@kotoptan.local", "ffarukakyuz@gmail.com"],
    id: "3d5df005-d87d-46dd-82ac-019ebdb13ee7",
  },
  {
    name: "Yavuz",
    phone: "0505 008 81 13",
    normalizedPhone: "5050088113",
    email: "5050088113@kotoptan.local",
    id: "4ebbd31b-8a3f-4149-bc1b-2f36ed62a846",
  },
  {
    name: "Mücahit",
    phone: "0546 872 29 73",
    normalizedPhone: "5468722973",
    email: "5468722973@kotoptan.local",
    id: "05114143-9cd7-42b7-9ffd-97d30f557431",
  },
  {
    name: "Selim",
    phone: "0535 733 63 11",
    normalizedPhone: "5357336311",
    email: "5357336311@kotoptan.local",
    id: "28423ca3-66b8-4ead-825d-b76918f5405a",
  },
];

export const GUEST_ACCOUNT = {
  username: "misafir",
  phone: "misafir",
  email: "misafir@kotoptan.local",
  defaultPassword: "123456",
  id: "793e3788-1290-4362-ac09-f89791d14395",
};

/** Telefon numarasından rakamları çıkarır ve baştaki 0'ı atar */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/**
 * Bir kullanıcının yönetici olup olmadığını kesin olarak doğrular.
 * Yalnızca tanımlı 5 numaraya/hesaba izin verir.
 */
export function isUserAdmin(
  user?: { id?: string; email?: string } | null,
  profile?: { id?: string; phone?: string } | null,
): boolean {
  if (!user && !profile) return false;

  const email = (user?.email ?? "").trim().toLowerCase();
  const userId = user?.id || profile?.id;
  const rawPhone = (profile?.phone ?? "").trim();
  const digits = normalizePhone(rawPhone);

  if (email === "ffarukakyuz@gmail.com") return true;

  return ADMIN_MEMBERS.some((adm) => {
    if (adm.id && userId === adm.id) return true;
    if (email && email === adm.email.toLowerCase()) return true;
    if (adm.emails && email && adm.emails.map((e) => e.toLowerCase()).includes(email)) return true;
    if (digits && digits === adm.normalizedPhone) return true;
    return false;
  });
}
