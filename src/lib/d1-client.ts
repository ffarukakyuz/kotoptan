import type { Product } from "./catalog";
import type { FallbackUser } from "@/data/users";

export const CLOUDFLARE_D1_DATABASE_ID = "0ff122d9-4dce-4988-a5db-1cd374f4c7c7";

/**
 * Cloudflare D1 / Workers REST API Helpers
 * All database operations run through Cloudflare D1 & Workers endpoints.
 */

// 1. PRODUCTS
export async function fetchD1Products(): Promise<Product[]> {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn("[d1-client] fetchD1Products error:", err);
  }
  return [];
}

export async function saveD1Product(
  product: Partial<Product> & { name: string },
): Promise<Product | null> {
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.product || null;
    }
  } catch (err) {
    console.warn("[d1-client] saveD1Product error:", err);
  }
  return null;
}

export async function deleteD1Product(id: string, name?: string): Promise<boolean> {
  try {
    const url = new URL("/api/products", window.location.origin);
    url.searchParams.set("id", id);
    if (name) url.searchParams.set("name", name);
    const res = await fetch(url.toString(), { method: "DELETE" });
    return res.ok;
  } catch (err) {
    console.warn("[d1-client] deleteD1Product error:", err);
    return false;
  }
}

// 2. ORDERS
export interface D1OrderItem {
  id?: string;
  product_name: string;
  unit: string;
  quantity: number;
}

export interface D1Order {
  id?: string;
  user_id?: string | null;
  full_name: string;
  business_name?: string;
  district?: string;
  phone: string;
  address: string;
  note?: string;
  status?: string;
  created_at?: string;
  order_items: D1OrderItem[];
}

export async function fetchD1Orders(
  userId?: string | null,
  isAdmin: boolean = false,
): Promise<D1Order[]> {
  try {
    const url = new URL("/api/orders", window.location.origin);
    if (userId) url.searchParams.set("userId", userId);
    if (isAdmin) url.searchParams.set("isAdmin", "true");
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && Array.isArray(data.orders)) return data.orders;
    }
  } catch (err) {
    console.warn("[d1-client] fetchD1Orders error:", err);
  }
  return [];
}

export async function saveD1Order(order: D1Order): Promise<D1Order | null> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.order || null;
    }
  } catch (err) {
    console.warn("[d1-client] saveD1Order error:", err);
  }
  return null;
}

export async function updateD1OrderStatus(id: string, updates: Partial<D1Order>): Promise<boolean> {
  try {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[d1-client] updateD1OrderStatus error:", err);
    return false;
  }
}

export async function deleteD1Order(id: string): Promise<boolean> {
  try {
    const url = new URL("/api/orders", window.location.origin);
    url.searchParams.set("id", id);
    const res = await fetch(url.toString(), { method: "DELETE" });
    return res.ok;
  } catch (err) {
    console.warn("[d1-client] deleteD1Order error:", err);
    return false;
  }
}

// 3. USERS
export async function fetchD1Users(): Promise<FallbackUser[]> {
  try {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && Array.isArray(data.users)) return data.users;
    }
  } catch (err) {
    console.warn("[d1-client] fetchD1Users error:", err);
  }
  return [];
}

export async function saveD1User(
  userData: Partial<FallbackUser> & { phone: string },
): Promise<FallbackUser | null> {
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.user || null;
    }
  } catch (err) {
    console.warn("[d1-client] saveD1User error:", err);
  }
  return null;
}

export async function deleteD1User(idOrPhone: string): Promise<boolean> {
  try {
    const url = new URL("/api/users", window.location.origin);
    url.searchParams.set("id", idOrPhone);
    const res = await fetch(url.toString(), { method: "DELETE" });
    return res.ok;
  } catch (err) {
    console.warn("[d1-client] deleteD1User error:", err);
    return false;
  }
}
