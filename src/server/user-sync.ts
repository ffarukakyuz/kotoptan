import fs from "node:fs";
import path from "node:path";
import { FALLBACK_USERS, type FallbackUser } from "../data/users";
import { getD1, type D1Database } from "./d1-chat";

const USERS_DB_PATH = path.resolve(process.cwd(), ".local-users-db.json");
const DELETED_USERS_PATH = path.resolve(process.cwd(), ".local-deleted-users.json");

export interface StoredServerUser extends FallbackUser {
  created_at?: string;
  updated_at?: string;
}

interface D1UserRow {
  id: string;
  phone: string;
  normalized_phone: string;
  email: string | null;
  full_name: string;
  business_name: string;
  address: string;
  role: string;
  is_approved: number;
  passwords_json: string;
  created_at: string;
  updated_at: string;
}

let inMemoryUsers: StoredServerUser[] | null = null;
let d1UsersTableChecked = false;

async function ensureUsersD1Table(db: D1Database | null) {
  if (!db || d1UsersTableChecked) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        normalized_phone TEXT,
        email TEXT,
        full_name TEXT NOT NULL,
        business_name TEXT,
        address TEXT,
        district TEXT DEFAULT 'Tatvan',
        role TEXT DEFAULT 'customer',
        passwords_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    d1UsersTableChecked = true;
  } catch (err) {
    console.warn("[user-sync] D1 user table creation notice:", err);
  }
}

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
        const cleaned = list.filter((u: StoredServerUser) => {
          if (u.role === "admin") return true;
          if (u.id && deletedSet.has(u.id)) return false;
          if (u.phone && deletedSet.has(u.phone)) return false;
          const norm = (u.phone || "").replace(/\D/g, "");
          if (norm && (deletedSet.has(norm) || deletedSet.has(`0${norm}`))) return false;
          return true;
        });
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

export async function getAllServerUsers(env?: unknown): Promise<StoredServerUser[]> {
  const db = getD1(env);
  if (db) {
    await ensureUsersD1Table(db);
  }

  if (!inMemoryUsers) {
    inMemoryUsers = loadUsersFromFile();
  }

  // D1'den kullanıcıları çek ve birleştir
  if (db) {
    try {
      const res = await db
        .prepare("SELECT * FROM app_users ORDER BY created_at DESC")
        .all<D1UserRow>();
      if (res?.results && Array.isArray(res.results)) {
        const d1Users: StoredServerUser[] = res.results.map((row) => {
          let pwList: string[] = ["123456"];
          try {
            pwList = JSON.parse(row.passwords_json || '["123456"]');
          } catch {
            pwList = ["123456"];
          }
          return {
            id: String(row.id),
            phone: String(row.phone || ""),
            normalizedPhone: String(row.normalized_phone || ""),
            email: String(row.email || ""),
            fullName: String(row.full_name || ""),
            businessName: String(row.business_name || ""),
            address: String(row.address || ""),
            district: String(row.district || "Tatvan"),
            role: (row.role as "admin" | "customer") || "customer",
            passwords: Array.isArray(pwList) ? pwList : ["123456"],
            created_at: String(row.created_at || new Date().toISOString()),
            updated_at: String(row.updated_at || new Date().toISOString()),
          };
        });

        const userMap = new Map<string, StoredServerUser>();
        for (const u of inMemoryUsers) {
          const key = u.normalizedPhone || (u.phone ? u.phone.replace(/\D/g, "") : u.id);
          userMap.set(key, u);
        }
        for (const du of d1Users) {
          const key = du.normalizedPhone || (du.phone ? du.phone.replace(/\D/g, "") : du.id);
          userMap.set(key, du);
        }
        inMemoryUsers = Array.from(userMap.values());
      }
    } catch (d1Err) {
      console.warn("[user-sync] D1 users fetch notice:", d1Err);
    }
  }

  const deletedSet = loadDeletedUserSet();

  // Sabit yöneticileri her zaman garanti ekle
  const finalMap = new Map<string, StoredServerUser>();
  for (const fu of FALLBACK_USERS) {
    const key = fu.normalizedPhone || fu.phone.replace(/\D/g, "");
    finalMap.set(key, { ...fu, created_at: new Date().toISOString() });
  }

  for (const u of inMemoryUsers) {
    if (u.role !== "admin") {
      if (u.id && deletedSet.has(u.id)) continue;
      if (u.phone && deletedSet.has(u.phone)) continue;
      const uDigits = (u.phone || "").replace(/\D/g, "");
      if (uDigits && (deletedSet.has(uDigits) || deletedSet.has(`0${uDigits}`))) continue;
    }
    const key = u.normalizedPhone || (u.phone ? u.phone.replace(/\D/g, "") : u.id);
    finalMap.set(key, u);
  }

  return Array.from(finalMap.values());
}

export async function registerOrUpdateServerUser(
  data: Partial<StoredServerUser> & { phone: string },
  env?: unknown,
): Promise<StoredServerUser> {
  const db = getD1(env);
  if (db) {
    await ensureUsersD1Table(db);
  }

  const digits = String(data.phone || "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;

  // Yeniden kayıt olunuyorsa silinenler listesinden çıkar
  const deletedSet = loadDeletedUserSet();
  if (
    deletedSet.has(data.phone) ||
    (digits && deletedSet.has(digits)) ||
    (normalized && deletedSet.has(normalized))
  ) {
    deletedSet.delete(data.phone);
    if (digits) deletedSet.delete(digits);
    if (normalized) {
      deletedSet.delete(normalized);
      deletedSet.delete(`0${normalized}`);
    }
    saveDeletedUserSet(deletedSet);
  }

  const current = await getAllServerUsers(env);

  const existingIndex = current.findIndex(
    (u) =>
      (u.id && data.id && u.id === data.id) ||
      (u.normalizedPhone && u.normalizedPhone === normalized) ||
      (u.phone && data.phone && String(u.phone || "").replace(/\D/g, "") === digits),
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
      fullName: data.fullName || existing.fullName,
      businessName: data.businessName || existing.businessName,
      address: data.address || existing.address,
      district: data.district || existing.district,
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

  // D1 veritabanına da yaz
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO app_users (id, phone, normalized_phone, email, full_name, business_name, address, district, role, passwords_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             phone = excluded.phone,
             normalized_phone = excluded.normalized_phone,
             email = excluded.email,
             full_name = excluded.full_name,
             business_name = excluded.business_name,
             address = excluded.address,
             district = excluded.district,
             role = excluded.role,
             passwords_json = excluded.passwords_json,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          savedUser.id,
          savedUser.phone,
          savedUser.normalizedPhone,
          savedUser.email,
          savedUser.fullName,
          savedUser.businessName,
          savedUser.address,
          savedUser.district,
          savedUser.role,
          JSON.stringify(savedUser.passwords),
        )
        .run();
    } catch (d1Err) {
      console.warn("[user-sync] D1 user insert notice:", d1Err);
    }
  }

  return savedUser;
}

export async function deleteServerUser(idOrPhone?: string | null, env?: unknown): Promise<boolean> {
  if (!idOrPhone) return false;
  const deletedSet = loadDeletedUserSet();
  const digits = String(idOrPhone || "").replace(/\D/g, "");
  deletedSet.add(idOrPhone);
  if (digits) {
    deletedSet.add(digits);
    if (digits.startsWith("0")) deletedSet.add(digits.slice(1));
    else deletedSet.add(`0${digits}`);
  }
  saveDeletedUserSet(deletedSet);

  const current = await getAllServerUsers(env);
  const filtered = current.filter((u) => {
    if (u.role === "admin") return true;
    if (u.id === idOrPhone) return false;
    if (u.phone === idOrPhone) return false;
    if (digits && u.phone && String(u.phone || "").replace(/\D/g, "") === digits) return false;
    return true;
  });
  inMemoryUsers = filtered;
  saveUsersToFile(filtered);

  const db = getD1(env);
  if (db) {
    try {
      await db
        .prepare("DELETE FROM app_users WHERE id = ? OR phone = ? OR normalized_phone = ?")
        .bind(idOrPhone, idOrPhone, digits)
        .run();
    } catch (d1Err) {
      console.warn("[user-sync] D1 user delete notice:", d1Err);
    }
  }

  return true;
}
