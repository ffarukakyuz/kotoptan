import fs from "node:fs";
import path from "node:path";
import { FALLBACK_PRODUCTS } from "../data/products";
import type { Product } from "../lib/catalog";
import { getServerDeletedProducts, recordDeletedProductOnServer } from "./product-delete-sync";
import { getD1, type D1Database } from "./d1-chat";

const CUSTOM_PRODUCTS_PATH = path.resolve(process.cwd(), ".local-custom-products.json");

interface D1ProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  image_url: string | null;
  is_active: number;
  in_stock: number;
  has_sad_watermark: number;
  created_at: string;
  updated_at: string;
}

let inMemoryCustomProducts: Product[] | null = null;
let d1TablesChecked = false;

async function ensureProductD1Table(db: D1Database | null) {
  if (!db || d1TablesChecked) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS custom_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT,
        is_active INTEGER DEFAULT 1,
        in_stock INTEGER DEFAULT 1,
        has_sad_watermark INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    d1TablesChecked = true;
  } catch (err) {
    console.warn("[product-sync] D1 table creation notice:", err);
  }
}

function loadCustomProductsFromFile(): Product[] {
  try {
    if (fs.existsSync(CUSTOM_PRODUCTS_PATH)) {
      const raw = fs.readFileSync(CUSTOM_PRODUCTS_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.warn("[product-sync] Could not read custom products from file:", err);
  }
  return [];
}

function saveCustomProductsToFile(list: Product[]) {
  try {
    fs.writeFileSync(CUSTOM_PRODUCTS_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("[product-sync] Could not save custom products to file:", err);
  }
}

export async function getAllServerProducts(env?: unknown): Promise<Product[]> {
  const db = getD1(env);
  if (db) {
    await ensureProductD1Table(db);
  }

  if (inMemoryCustomProducts === null) {
    inMemoryCustomProducts = loadCustomProductsFromFile();
  }

  // D1 tablosundan ürünleri çekip in-memory ile birleştir
  if (db) {
    try {
      const res = await db
        .prepare("SELECT * FROM custom_products ORDER BY updated_at DESC")
        .all<D1ProductRow>();
      if (res?.results && Array.isArray(res.results)) {
        const d1Products: Product[] = res.results.map((row) => ({
          id: String(row.id),
          name: String(row.name || ""),
          category: (row.category as Product["category"]) || "gida",
          unit: String(row.unit || "adet"),
          description: String(row.description || ""),
          image_url: row.image_url ? String(row.image_url) : null,
          is_active: Boolean(row.is_active),
          in_stock: Boolean(row.in_stock),
          hasSadWatermark: Boolean(row.has_sad_watermark),
        }));

        const existingMap = new Map<string, Product>();
        for (const cp of inMemoryCustomProducts) {
          existingMap.set(cp.id, cp);
        }
        for (const dp of d1Products) {
          existingMap.set(dp.id, dp);
        }
        inMemoryCustomProducts = Array.from(existingMap.values());
      }
    } catch (d1Err) {
      console.warn("[product-sync] D1 query notice:", d1Err);
    }
  }

  const { deletedIds, deletedNames } = getServerDeletedProducts();
  const deletedIdSet = new Set(deletedIds);
  const deletedNameSet = new Set(deletedNames.map((n) => n.toLowerCase().trim()));

  const productMap = new Map<string, Product>();

  // 1. Önce özel eklenen / düzenlenen ürünler
  for (const p of inMemoryCustomProducts) {
    if (!p || !p.id) continue;
    if (deletedIdSet.has(p.id)) continue;
    const norm = p.name ? p.name.toLowerCase().trim() : "";
    if (norm && deletedNameSet.has(norm)) continue;
    productMap.set(p.id, p);
  }

  // 2. Sabit katalog ürünleri (FALLBACK_PRODUCTS)
  for (const fp of FALLBACK_PRODUCTS) {
    if (!fp || !fp.id) continue;
    if (deletedIdSet.has(fp.id)) continue;
    const norm = fp.name ? fp.name.toLowerCase().trim() : "";
    if (norm && deletedNameSet.has(norm)) continue;
    if (!productMap.has(fp.id)) {
      productMap.set(fp.id, fp);
    }
  }

  return Array.from(productMap.values());
}

export async function saveServerProduct(
  data: Partial<Product> & { name: string },
  env?: unknown,
): Promise<Product> {
  const db = getD1(env);
  if (db) {
    await ensureProductD1Table(db);
  }

  if (inMemoryCustomProducts === null) {
    inMemoryCustomProducts = loadCustomProductsFromFile();
  }

  const id = data.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const inStock = data.in_stock !== false;
  const product: Product = {
    id,
    name: data.name.trim(),
    category: (data.category as Product["category"]) || "gida",
    unit: data.unit || "adet",
    description: data.description || "",
    image_url: data.image_url || null,
    is_active: data.is_active !== false,
    in_stock: inStock,
    hasSadWatermark: Boolean(data.hasSadWatermark),
  };

  // Silinenler listesinden çıkar (yeniden ekleniyor veya düzenleniyor)
  const { deletedIds, deletedNames } = getServerDeletedProducts();
  const dIndex = deletedIds.indexOf(id);
  if (dIndex >= 0) deletedIds.splice(dIndex, 1);
  const norm = product.name.toLowerCase().trim();
  const nIndex = deletedNames.indexOf(norm);
  if (nIndex >= 0) deletedNames.splice(nIndex, 1);

  // In-memory listeyi güncelle
  const existingIdx = inMemoryCustomProducts.findIndex((p) => p.id === id);
  if (existingIdx >= 0) {
    inMemoryCustomProducts[existingIdx] = product;
  } else {
    inMemoryCustomProducts.unshift(product);
  }

  // Dosyaya yaz
  saveCustomProductsToFile(inMemoryCustomProducts);

  // D1 veritabanına yaz
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO custom_products (id, name, category, unit, description, image_url, is_active, in_stock, has_sad_watermark, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             category = excluded.category,
             unit = excluded.unit,
             description = excluded.description,
             image_url = excluded.image_url,
             is_active = excluded.is_active,
             in_stock = excluded.in_stock,
             has_sad_watermark = excluded.has_sad_watermark,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          product.id,
          product.name,
          product.category,
          product.unit,
          product.description,
          product.image_url,
          product.is_active ? 1 : 0,
          product.in_stock ? 1 : 0,
          product.hasSadWatermark ? 1 : 0,
        )
        .run();
    } catch (d1Err) {
      console.warn("[product-sync] D1 insert/update notice:", d1Err);
    }
  }

  return product;
}

export async function deleteServerProduct(
  id: string,
  name?: string,
  env?: unknown,
): Promise<boolean> {
  if (!id) return false;
  recordDeletedProductOnServer(id, name);

  if (inMemoryCustomProducts === null) {
    inMemoryCustomProducts = loadCustomProductsFromFile();
  }

  inMemoryCustomProducts = inMemoryCustomProducts.filter((p) => p.id !== id);
  saveCustomProductsToFile(inMemoryCustomProducts);

  const db = getD1(env);
  if (db) {
    try {
      await db.prepare("DELETE FROM custom_products WHERE id = ?").bind(id).run();
    } catch (d1Err) {
      console.warn("[product-sync] D1 delete notice:", d1Err);
    }
  }

  return true;
}
