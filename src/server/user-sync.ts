import fs from "node:fs";
import path from "node:path";
import { FALLBACK_USERS, type FallbackUser } from "../data/users";

const USERS_DB_PATH = path.resolve(process.cwd(), ".local-users-db.json");
const DELETED_USERS_PATH = path.resolve(process.cwd(), ".local-deleted-users.json");

export interface StoredServerUser extends FallbackUser {
  created_at?: string;
  updated_at?: string;
}

let inMemoryUsers: StoredServerUser[] | null = null;

function loadDeletedUserSet(): Set<string> {
  try {
    if (fs.existsSync(DELETED_USERS_PATH)) {
      const raw = fs.readFileSync(DELETED_USERS_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return new Set(list.map(String));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDeletedUserSet(set: Set<string>) {
  try {
    fs.writeFileSync(DELETED_USERS_PATH, JSON.stringify(Array.from(set)), "utf-8");
  } catch {
    // ignore
  }
}

function loadUsersFromFile(): StoredServerUser[] {
  const deletedSet = loadDeletedUserSet();
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const raw = fs.readFileSync(USERS_DB_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        // Eski demo kullanıcılarını temizle ve silinenleri ele
        const demoPhones = ["5551234567", "5429876543", "5324567890", "5335678901", "5346789012"];
        const cleaned = list.filter((u: StoredServerUser) => {
          if (u.role === "admin") return true;
          if (u.id && deletedSet.has(u.id)) return false;
          if (u.phone && deletedSet.has(u.phone)) return false;
          const norm = (u.phone || "").replace(/\D/g, "");
          if (norm && (deletedSet.has(norm) || deletedSet.has(`0${norm}`))) return false;
          return !demoPhones.some((dp) => norm.includes(dp));
        });
        saveUsersToFile(cleaned);
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("[user-sync] Error reading users DB:", err);
  }

  // Initial seed with FALLBACK_USERS (excluding deleted)
  const initial = FALLBACK_USERS.filter((u) => {
    if (u.role === "admin") return true;
    if (u.id && deletedSet.has(u.id)) return false;
    if (u.phone && deletedSet.has(u.phone)) return false;
    const norm = (u.phone || "").replace(/\D/g, "");
    if (norm && (deletedSet.has(norm) || deletedSet.has(`0${norm}`))) return false;
    return true;
  }).map((u) => ({
    ...u,
    created_at: new Date().toISOString(),
  }));
  saveUsersToFile(initial);
  return initial;
}

function saveUsersToFile(users: StoredServerUser[]) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.warn("[user-sync] Error saving users DB:", err);
  }
}

export function getAllServerUsers(): StoredServerUser[] {
  if (!inMemoryUsers) {
    inMemoryUsers = loadUsersFromFile();
  }
  const deletedSet = loadDeletedUserSet();
  if (deletedSet.size > 0) {
    return inMemoryUsers.filter((u) => {
      if (u.role === "admin") return true;
      if (u.id && deletedSet.has(u.id)) return false;
      if (u.phone && deletedSet.has(u.phone)) return false;
      const uDigits = (u.phone || "").replace(/\D/g, "");
      if (uDigits && (deletedSet.has(uDigits) || deletedSet.has(`0${uDigits}`))) return false;
      return true;
    });
  }
  return inMemoryUsers;
}

export function registerOrUpdateServerUser(
  data: Partial<StoredServerUser> & { phone: string },
): StoredServerUser {
  const digits = data.phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;

  // Yeniden kayıt olunuyorsa silinenler listesinden çıkar
  const deletedSet = loadDeletedUserSet();
  if (deletedSet.has(data.phone) || deletedSet.has(digits) || deletedSet.has(normalized)) {
    deletedSet.delete(data.phone);
    deletedSet.delete(digits);
    deletedSet.delete(normalized);
    deletedSet.delete(`0${normalized}`);
    saveDeletedUserSet(deletedSet);
  }

  const current = getAllServerUsers();

  const existingIndex = current.findIndex(
    (u) =>
      (u.id && data.id && u.id === data.id) ||
      (u.normalizedPhone && u.normalizedPhone === normalized) ||
      (u.phone && data.phone && u.phone.replace(/\D/g, "") === digits),
  );

  const now = new Date().toISOString();
  let savedUser: StoredServerUser;

  if (existingIndex >= 0) {
    const existing = current[existingIndex]!;
    savedUser = {
      ...existing,
      ...data,
      id: existing.id || data.id || `user_${Date.now()}`,
      normalizedPhone: normalized,
      passwords: Array.from(
        new Set([...(existing.passwords || []), ...(data.passwords || []), "123456"]),
      ),
      updated_at: now,
    };
    current[existingIndex] = savedUser;
  } else {
    savedUser = {
      id: data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phone: data.phone,
      normalizedPhone: normalized,
      email: data.email || (data.phone ? `${normalized}@kotoptan.local` : "musteri@kotoptan.local"),
      fullName: data.fullName || "Müşteri",
      businessName: data.businessName || "İşletme",
      address: data.address || "",
      district: data.district || "Tatvan",
      role: data.role || "customer",
      passwords: Array.from(new Set([...(data.passwords || []), "123456"])),
      created_at: now,
      updated_at: now,
    };
    current.unshift(savedUser);
  }

  inMemoryUsers = current;
  saveUsersToFile(current);
  return savedUser;
}

export function deleteServerUser(idOrPhone: string): boolean {
  const deletedSet = loadDeletedUserSet();
  const digits = idOrPhone.replace(/\D/g, "");
  deletedSet.add(idOrPhone);
  if (digits) {
    deletedSet.add(digits);
    if (digits.startsWith("0")) deletedSet.add(digits.slice(1));
    else deletedSet.add(`0${digits}`);
  }
  saveDeletedUserSet(deletedSet);

  const current = getAllServerUsers();
  const filtered = current.filter((u) => {
    if (u.role === "admin") return true;
    if (u.id === idOrPhone) return false;
    if (u.phone === idOrPhone) return false;
    if (digits && u.phone && u.phone.replace(/\D/g, "") === digits) return false;
    return true;
  });
  inMemoryUsers = filtered;
  saveUsersToFile(filtered);
  return true;
}
