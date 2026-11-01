import fs from "node:fs";
import path from "node:path";
import { getD1, type D1Database } from "./d1-chat";

export interface ServerOrderItem {
  id: string;
  product_name: string;
  unit: string;
  quantity: number;
}

export interface ServerOrder {
  id: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  user_id?: string;
  full_name?: string;
  business_name?: string;
  district?: string;
  phone?: string;
  address?: string;
  note?: string;
  order_items: ServerOrderItem[];
}

interface D1OrderRow {
  id: string;
  user_id: string | null;
  full_name: string;
  business_name: string;
  district: string;
  phone: string;
  address: string;
  note: string;
  status: string;
  archived_at: string | null;
  order_items_json: string;
  created_at: string;
  updated_at: string;
}

const ORDERS_DB_PATH = path.resolve(process.cwd(), ".local-orders-db.json");

let inMemoryOrders: ServerOrder[] | null = null;
let d1OrdersTableChecked = false;

async function ensureOrdersD1Table(db: D1Database | null) {
  if (!db || d1OrdersTableChecked) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        full_name TEXT NOT NULL,
        business_name TEXT DEFAULT '',
        district TEXT DEFAULT 'Tatvan',
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        note TEXT DEFAULT '',
        status TEXT DEFAULT 'beklemede',
        order_items_json TEXT NOT NULL,
        archived_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    d1OrdersTableChecked = true;
  } catch (err) {
    console.warn("[order-sync] D1 table creation notice:", err);
  }
}

function loadOrdersFromFile(): ServerOrder[] {
  try {
    if (fs.existsSync(ORDERS_DB_PATH)) {
      const raw = fs.readFileSync(ORDERS_DB_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.warn("[order-sync] Error reading orders DB:", err);
  }
  return [];
}

function saveOrdersToFile(orders: ServerOrder[]) {
  try {
    fs.writeFileSync(ORDERS_DB_PATH, JSON.stringify(orders, null, 2), "utf-8");
  } catch (err) {
    console.warn("[order-sync] Error saving orders DB:", err);
  }
}

export async function getAllServerOrders(
  env?: unknown,
  userId?: string | null,
  isAdmin: boolean = false,
): Promise<ServerOrder[]> {
  const db = getD1(env);
  if (db) {
    await ensureOrdersD1Table(db);
  }

  if (inMemoryOrders === null) {
    inMemoryOrders = loadOrdersFromFile();
  }

  // D1 veritabanından siparişleri çek ve in-memory ile birleştir
  if (db) {
    try {
      const res = await db
        .prepare("SELECT * FROM customer_orders ORDER BY created_at DESC")
        .all<D1OrderRow>();
      if (res?.results && Array.isArray(res.results)) {
        const d1Orders: ServerOrder[] = res.results.map((row) => {
          let items: ServerOrderItem[] = [];
          try {
            items = JSON.parse(row.order_items_json || "[]");
          } catch {
            items = [];
          }
          return {
            id: String(row.id),
            user_id: row.user_id ? String(row.user_id) : undefined,
            full_name: String(row.full_name || ""),
            business_name: String(row.business_name || ""),
            district: String(row.district || "Tatvan"),
            phone: String(row.phone || ""),
            address: String(row.address || ""),
            note: String(row.note || ""),
            status: String(row.status || "beklemede"),
            archived_at: row.archived_at ? String(row.archived_at) : null,
            created_at: String(row.created_at || new Date().toISOString()),
            order_items: Array.isArray(items) ? items : [],
          };
        });

        const orderMap = new Map<string, ServerOrder>();
        for (const o of inMemoryOrders) {
          orderMap.set(o.id, o);
        }
        for (const o of d1Orders) {
          orderMap.set(o.id, o);
        }
        inMemoryOrders = Array.from(orderMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
    } catch (d1Err) {
      console.warn("[order-sync] D1 orders fetch notice:", d1Err);
    }
  }

  let list = inMemoryOrders;

  // Güvenlik & İzolasyon: Müşteri yalnızca kendi siparişlerini görür
  if (!isAdmin && userId) {
    list = list.filter((o) => o.user_id === userId);
  }

  return list;
}

export async function createOrUpdateServerOrder(
  data: Partial<ServerOrder> & { full_name: string; phone: string; address: string },
  env?: unknown,
): Promise<ServerOrder> {
  const db = getD1(env);
  if (db) {
    await ensureOrdersD1Table(db);
  }

  if (inMemoryOrders === null) {
    inMemoryOrders = loadOrdersFromFile();
  }

  const id =
    data.id ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  const now = new Date().toISOString();
  const orderItems: ServerOrderItem[] = Array.isArray(data.order_items)
    ? data.order_items.map((item, idx) => ({
        id: item.id || `item_${Date.now()}_${idx}`,
        product_name: item.product_name || "Ürün",
        unit: item.unit || "adet",
        quantity: Number(item.quantity) || 1,
      }))
    : [];

  const newOrder: ServerOrder = {
    id,
    created_at: data.created_at || now,
    archived_at: data.archived_at || null,
    status: data.status || "beklemede",
    user_id: data.user_id,
    full_name: data.full_name,
    business_name: data.business_name || "",
    district: data.district || "Tatvan",
    phone: data.phone,
    address: data.address,
    note: data.note || "",
    order_items: orderItems,
  };

  const existingIdx = inMemoryOrders.findIndex((o) => o.id === id);
  if (existingIdx >= 0) {
    inMemoryOrders[existingIdx] = newOrder;
  } else {
    inMemoryOrders.unshift(newOrder);
  }

  saveOrdersToFile(inMemoryOrders);

  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO customer_orders (id, user_id, full_name, business_name, district, phone, address, note, status, order_items_json, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             archived_at = excluded.archived_at,
             note = excluded.note,
             address = excluded.address,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          newOrder.id,
          newOrder.user_id || null,
          newOrder.full_name,
          newOrder.business_name || "",
          newOrder.district || "Tatvan",
          newOrder.phone,
          newOrder.address,
          newOrder.note || "",
          newOrder.status,
          JSON.stringify(newOrder.order_items),
          newOrder.archived_at || null,
          newOrder.created_at,
        )
        .run();
    } catch (d1Err) {
      console.warn("[order-sync] D1 order insert notice:", d1Err);
    }
  }

  return newOrder;
}

export async function updateServerOrderStatus(
  id: string,
  patch: { status?: string; archived_at?: string | null; note?: string },
  env?: unknown,
): Promise<ServerOrder | null> {
  const db = getD1(env);
  if (db) {
    await ensureOrdersD1Table(db);
  }

  if (inMemoryOrders === null) {
    inMemoryOrders = loadOrdersFromFile();
  }

  const existingIdx = inMemoryOrders.findIndex((o) => o.id === id);
  if (existingIdx < 0) return null;

  const existing = inMemoryOrders[existingIdx]!;
  const updated: ServerOrder = {
    ...existing,
    status: patch.status ?? existing.status,
    archived_at:
      patch.archived_at !== undefined
        ? patch.archived_at
        : patch.status === "teslim" || patch.status === "iptal"
          ? new Date().toISOString()
          : existing.archived_at,
    note: patch.note !== undefined ? patch.note : existing.note,
  };

  inMemoryOrders[existingIdx] = updated;
  saveOrdersToFile(inMemoryOrders);

  if (db) {
    try {
      await db
        .prepare(
          `UPDATE customer_orders
           SET status = ?, archived_at = ?, note = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(updated.status, updated.archived_at, updated.note || "", id)
        .run();
    } catch (d1Err) {
      console.warn("[order-sync] D1 order update notice:", d1Err);
    }
  }

  return updated;
}

export async function deleteServerOrder(id: string, env?: unknown): Promise<boolean> {
  if (inMemoryOrders === null) {
    inMemoryOrders = loadOrdersFromFile();
  }

  inMemoryOrders = inMemoryOrders.filter((o) => o.id !== id);
  saveOrdersToFile(inMemoryOrders);

  const db = getD1(env);
  if (db) {
    try {
      await db.prepare("DELETE FROM customer_orders WHERE id = ?").bind(id).run();
    } catch (d1Err) {
      console.warn("[order-sync] D1 order delete notice:", d1Err);
    }
  }

  return true;
}
