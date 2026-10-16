import { supabase } from "@/integrations/supabase/client";

export const LOCAL_ORDERS_KEY = "ko_local_orders";
export const ORDER_OVERRIDES_KEY = "ko_order_status_overrides";
export const DELETED_ORDERS_KEY = "ko_deleted_order_ids";

export interface StoredOrderItem {
  id: string;
  product_name: string;
  unit: string;
  quantity: number;
}

export interface StoredOrder {
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
  order_items: StoredOrderItem[];
}

/**
 * Bir siparişin geçmiş/arşiv statüsünde olup olmadığını belirler.
 * "teslim" veya "iptal" durumundaki ya da archived_at dolu tüm siparişler geçmiş sipariştir.
 */
export function isArchivedOrder(o: { status?: string; archived_at?: string | null }): boolean {
  if (!o) return false;
  return Boolean(o.archived_at) || o.status === "teslim" || o.status === "iptal";
}

export function getDeletedOrderIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_ORDERS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function getOrderStatusOverrides(): Record<
  string,
  { status?: string; archived_at?: string | null; note?: string }
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ORDER_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getLocalOrders(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o): o is StoredOrder => Boolean(o && typeof o === "object" && o.id))
      .map((o) => ({
        ...o,
        order_items: Array.isArray(o.order_items) ? o.order_items : [],
      }));
  } catch {
    return [];
  }
}

/**
 * Sunucu siparişleri ile yerel siparişleri birleştirir,
 * silinen siparişleri temizler ve durum güncellemelerini uygular.
 * KULLANICI İZOLASYONU: Eğer yönetici değilse yalnızca oturum açmış kullanıcının
 * siparişlerini (user_id = currentUserId) döndürür. Başka kullanıcıların siparişleri ASLA gösterilmez.
 */
export function mergeOrdersWithLocal<T extends StoredOrder>(
  remoteOrders: T[] = [],
  currentUserId?: string | null,
  isAdmin: boolean = false,
): T[] {
  const deletedIds = getDeletedOrderIds();
  const overrides = getOrderStatusOverrides();
  const safeRemote = Array.isArray(remoteOrders) ? remoteOrders : [];
  let localList = (getLocalOrders() as T[]) || [];

  // Kullanıcı izolasyonu: Yönetici değilse yerel siparişlerden de yalnızca kendisine ait olanları al
  if (!isAdmin && currentUserId) {
    localList = localList.filter((lo) => lo && lo.user_id === currentUserId);
  }

  const remoteIds = new Set(safeRemote.map((o) => String(o?.id || "")));
  const combined = [
    ...safeRemote,
    ...localList.filter((lo) => lo && lo.id && !remoteIds.has(String(lo.id))),
  ];

  const processed = combined
    .filter((o) => {
      if (!o || !o.id || deletedIds.has(String(o.id))) return false;
      // Güvenlik katmanı: Müşteri ise başka user_id'ye ait sipariş sızamaz
      if (!isAdmin && currentUserId && o.user_id && o.user_id !== currentUserId) {
        return false;
      }
      return true;
    })
    .map((o) => {
      const sid = String(o.id);
      const override = overrides[sid] || overrides[o.id];
      const safeItems = Array.isArray(o.order_items) ? o.order_items : [];
      if (override) {
        return {
          ...o,
          order_items: safeItems,
          status: override.status ?? o.status,
          archived_at: override.archived_at !== undefined ? override.archived_at : o.archived_at,
          note: override.note !== undefined ? override.note : o.note,
        };
      }
      return {
        ...o,
        order_items: safeItems,
      };
    });

  processed.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });
  return processed;
}

/**
 * Sipariş durumunu hem yerel önbellekte hem de Supabase'de günceller.
 * İptal veya Teslim durumunda archived_at alanını da otomatik doldurur.
 */
export async function applyOrderPatch(
  id: string,
  patch: { status?: string; archived_at?: string | null; note?: string },
): Promise<void> {
  if (typeof window === "undefined" || !id) return;

  const isFinished = patch.status === "teslim" || patch.status === "iptal";
  const finalPatch = {
    ...patch,
    archived_at:
      patch.archived_at !== undefined
        ? patch.archived_at
        : isFinished
          ? new Date().toISOString()
          : undefined,
  };

  // 1. Overrides haritasına yaz
  try {
    const overrides = getOrderStatusOverrides();
    overrides[id] = { ...overrides[id], ...finalPatch };
    localStorage.setItem(ORDER_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn("[applyOrderPatch] Overrides write error:", err);
  }

  // 2. ko_local_orders içinde varsa güncelle
  try {
    const local = getLocalOrders();
    const existingIdx = local.findIndex((o) => o.id === id);
    if (existingIdx >= 0) {
      local[existingIdx] = { ...local[existingIdx], ...finalPatch };
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(local));
    }
  } catch (err) {
    console.warn("[applyOrderPatch] Local orders write error:", err);
  }

  // 3. Supabase veritabanını güncelle
  try {
    const dbPayload: Record<string, unknown> = {};
    if (finalPatch.status !== undefined) dbPayload["status"] = finalPatch.status;
    if (finalPatch.archived_at !== undefined) dbPayload["archived_at"] = finalPatch.archived_at;
    if (finalPatch.note !== undefined) dbPayload["note"] = finalPatch.note;

    await supabase.from("orders").update(dbPayload).eq("id", id);
  } catch (err) {
    console.warn("[applyOrderPatch] Supabase update warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
}

/**
 * Tek bir siparişi kalıcı olarak siler
 */
export async function permanentlyDeleteOrder(id: string): Promise<void> {
  if (typeof window === "undefined" || !id) return;
  const strId = String(id);

  try {
    const deletedSet = getDeletedOrderIds();
    deletedSet.add(strId);
    localStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(Array.from(deletedSet)));

    const local = getLocalOrders();
    const filtered = local.filter((o) => o && String(o.id) !== strId);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filtered));

    const overrides = getOrderStatusOverrides();
    if (overrides[strId] || overrides[id]) {
      delete overrides[strId];
      delete overrides[id];
      localStorage.setItem(ORDER_OVERRIDES_KEY, JSON.stringify(overrides));
    }
  } catch (err) {
    console.warn("[permanentlyDeleteOrder] Local error:", err);
  }

  try {
    await supabase.from("order_items").delete().eq("order_id", strId);
  } catch (err) {
    console.warn("[permanentlyDeleteOrder] Supabase order_items delete warning:", err);
  }

  try {
    await supabase.from("orders").delete().eq("id", strId);
  } catch (err) {
    console.warn("[permanentlyDeleteOrder] Supabase delete warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
}

export const TEST_ORDERS_PURGED_FLAG = "ko_test_orders_purged_flag_v3";
export const TEST_ORDERS_PURGED_FLAG_V4 = "ko_test_orders_purged_flag_v4";
export const TEST_ORDERS_PURGED_FLAG_V5 = "ko_test_orders_purged_flag_v5";

/**
 * Kullanıcının isteği üzerine oluşturulan tüm deneme/test siparişlerini
 * yerel depodan ve Supabase'den kalıcı olarak temizler.
 */
export async function purgeAllTestOrders(): Promise<number> {
  if (typeof window === "undefined") return 0;
  let purgedCount = 0;

  try {
    const local = getLocalOrders();
    const testIds: string[] = [];
    const remainingOrders = local.filter((o) => {
      if (
        !o ||
        !o.id ||
        String(o.id).startsWith("test-order-") ||
        String(o.id).startsWith("mock-") ||
        String(o.id).startsWith("sample-") ||
        o.note?.toLowerCase().includes("rota deneme") ||
        o.note?.toLowerCase().includes("test siparişi") ||
        o.note?.toLowerCase().includes("deneme siparişi")
      ) {
        if (o?.id) testIds.push(String(o.id));
        return false;
      }
      return true;
    });

    purgedCount = testIds.length;
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(remainingOrders));

    const deletedSet = getDeletedOrderIds();
    testIds.forEach((id) => deletedSet.add(id));
    localStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(Array.from(deletedSet)));

    const overrides = getOrderStatusOverrides();
    testIds.forEach((id) => {
      delete overrides[id];
    });
    localStorage.setItem(ORDER_OVERRIDES_KEY, JSON.stringify(overrides));
    localStorage.setItem(TEST_ORDERS_PURGED_FLAG_V4, "true");
  } catch (err) {
    console.warn("[purgeAllTestOrders] Local purge error:", err);
  }

  try {
    await supabase.from("order_items").delete().like("order_id", "test-order-%");
    await supabase.from("orders").delete().like("id", "test-order-%");
  } catch (err) {
    console.warn("[purgeAllTestOrders] Supabase purge warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
  return purgedCount;
}

/**
 * Mevcut tüm deneme ve test siparişlerini hem yerel depodan hem de veritabanından tamamen yok eder.
 */
/**
 * Sipariş içindeki bir ürünün miktarını günceller (hem local hem supabase)
 */
export async function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (typeof window === "undefined" || !orderId || !itemId || quantity < 1) return;

  try {
    const local = getLocalOrders();
    const orderIdx = local.findIndex((o) => o.id === orderId);
    if (orderIdx >= 0) {
      const items = local[orderIdx]?.order_items || [];
      const itemIdx = items.findIndex((i) => i.id === itemId);
      if (itemIdx >= 0 && items[itemIdx]) {
        items[itemIdx].quantity = quantity;
        local[orderIdx]!.order_items = [...items];
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(local));
      }
    }
  } catch (err) {
    console.warn("[updateOrderItemQuantity] local error:", err);
  }

  try {
    await supabase.from("order_items").update({ quantity }).eq("id", itemId);
  } catch (err) {
    console.warn("[updateOrderItemQuantity] Supabase update warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
}

/**
 * Sipariş içindeki bir ürünü çıkarır (hem local hem supabase)
 */
export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  if (typeof window === "undefined" || !orderId || !itemId) return;

  try {
    const local = getLocalOrders();
    const orderIdx = local.findIndex((o) => o.id === orderId);
    if (orderIdx >= 0) {
      const items = (local[orderIdx]?.order_items || []).filter((i) => i.id !== itemId);
      local[orderIdx]!.order_items = items;
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(local));
    }
  } catch (err) {
    console.warn("[removeOrderItem] local error:", err);
  }

  try {
    await supabase.from("order_items").delete().eq("id", itemId);
  } catch (err) {
    console.warn("[removeOrderItem] Supabase delete warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
}

export async function purgeAllOrders(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // Mevcut tüm siparişlerin ID'lerini deleted listesine al
    const local = getLocalOrders();
    const deletedSet = getDeletedOrderIds();
    for (const o of local) {
      if (o.id) deletedSet.add(o.id);
    }
    localStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(Array.from(deletedSet)));

    // Yerel kayıtları sıfırla
    localStorage.removeItem(LOCAL_ORDERS_KEY);
    localStorage.removeItem(ORDER_OVERRIDES_KEY);
    localStorage.setItem(TEST_ORDERS_PURGED_FLAG, "true");
    localStorage.setItem(TEST_ORDERS_PURGED_FLAG_V4, "true");
  } catch (err) {
    console.warn("[purgeAllOrders] Local purge error:", err);
  }

  try {
    // Supabase'deki tüm kayıtları silmeyi dene
    await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (err) {
    console.warn("[purgeAllOrders] Supabase purge warning:", err);
  }

  window.dispatchEvent(new Event("orders_updated"));
  window.dispatchEvent(new Event("storage"));
}

/**
 * İlk açılışta kullanıcının belirttiği deneme siparişlerini otomatik temizler
 */
export function autoPurgeTestOrdersOnBoot(): void {
  if (typeof window === "undefined") return;
  try {
    const hasPurgedV5 = localStorage.getItem(TEST_ORDERS_PURGED_FLAG_V5);
    if (!hasPurgedV5) {
      localStorage.setItem(TEST_ORDERS_PURGED_FLAG_V5, "true");
      void purgeAllTestOrders();
    }
  } catch (err) {
    console.warn("[autoPurgeTestOrdersOnBoot] error:", err);
  }
}

// Tarayıcı ortamında otomatik çalıştır
if (typeof window !== "undefined") {
  setTimeout(() => {
    autoPurgeTestOrdersOnBoot();
  }, 50);
}
