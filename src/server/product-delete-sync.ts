import fs from "node:fs";
import path from "node:path";
import staticDeletedData from "../data/permanently-deleted.json";

const LOCAL_DELETED_PATH = path.resolve(process.cwd(), ".local-deleted-products.json");
const DATA_DELETED_PATH = path.resolve(process.cwd(), "src/data/permanently-deleted.json");

let cachedIds: Set<string> | null = null;
let cachedNames: Set<string> | null = null;

function initDeletedCache() {
  if (cachedIds && cachedNames) return;

  cachedIds = new Set<string>();
  cachedNames = new Set<string>();

  // 1. Statik JSON verilerini yükle
  if (staticDeletedData) {
    if (Array.isArray(staticDeletedData.deletedIds)) {
      for (const id of staticDeletedData.deletedIds) {
        if (typeof id === "string" && id.trim()) cachedIds.add(id.trim());
      }
    }
    if (Array.isArray(staticDeletedData.deletedNames)) {
      for (const name of staticDeletedData.deletedNames) {
        if (typeof name === "string" && name.trim()) cachedNames.add(name.toLowerCase().trim());
      }
    }
  }

  // 2. .local-deleted-products.json dosyasını yükle
  try {
    if (fs.existsSync(LOCAL_DELETED_PATH)) {
      const raw = fs.readFileSync(LOCAL_DELETED_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (Array.isArray(parsed.deletedIds)) {
          for (const id of parsed.deletedIds) {
            if (typeof id === "string" && id.trim()) cachedIds.add(id.trim());
          }
        }
        if (Array.isArray(parsed.deletedNames)) {
          for (const name of parsed.deletedNames) {
            if (typeof name === "string" && name.trim()) cachedNames.add(name.toLowerCase().trim());
          }
        }
      }
    }
  } catch (err) {
    console.warn("[product-delete-sync] Could not read local deleted file:", err);
  }
}

function persistCacheToDisk() {
  if (!cachedIds || !cachedNames) return;
  const payload = {
    deletedIds: Array.from(cachedIds),
    deletedNames: Array.from(cachedNames),
  };
  const jsonStr = JSON.stringify(payload, null, 2);

  try {
    fs.writeFileSync(LOCAL_DELETED_PATH, jsonStr, "utf-8");
  } catch (err) {
    console.warn("[product-delete-sync] Could not write to .local-deleted-products.json:", err);
  }

  try {
    if (fs.existsSync(DATA_DELETED_PATH)) {
      fs.writeFileSync(DATA_DELETED_PATH, jsonStr, "utf-8");
    }
  } catch {
    // ignore
  }
}

export function getServerDeletedProducts(): { deletedIds: string[]; deletedNames: string[] } {
  initDeletedCache();
  return {
    deletedIds: Array.from(cachedIds ?? new Set()),
    deletedNames: Array.from(cachedNames ?? new Set()),
  };
}

export function recordDeletedProductOnServer(
  id: string,
  name?: string,
): { deletedIds: string[]; deletedNames: string[] } {
  initDeletedCache();
  if (id && typeof id === "string" && id.trim()) {
    cachedIds?.add(id.trim());
  }
  if (name && typeof name === "string" && name.trim()) {
    cachedNames?.add(name.toLowerCase().trim());
  }
  persistCacheToDisk();
  return getServerDeletedProducts();
}

export function recordBatchDeletedProductsOnServer(items: { id: string; name?: string }[]): {
  deletedIds: string[];
  deletedNames: string[];
} {
  initDeletedCache();
  for (const item of items) {
    if (item.id && typeof item.id === "string" && item.id.trim()) {
      cachedIds?.add(item.id.trim());
    }
    if (item.name && typeof item.name === "string" && item.name.trim()) {
      cachedNames?.add(item.name.toLowerCase().trim());
    }
  }
  persistCacheToDisk();
  return getServerDeletedProducts();
}
