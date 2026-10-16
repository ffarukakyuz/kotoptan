import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  image_url?: string | null;
};

type CartState = {
  items: CartItem[];
  totalQuantity: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

import { useAuth } from "@/hooks/useAuth";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const storageKey = user?.id ? `depo-sepet-v1_${user.id}` : "depo-sepet-v1_guest";

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((i): i is CartItem =>
              Boolean(i && typeof i === "object" && i.productId && typeof i.quantity === "number"),
            );
            setItems(valid);
          } else {
            setItems([]);
          }
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(Array.isArray(items) ? items : []));
      }
    } catch {
      /* ignore */
    }
  }, [items, hydrated, storageKey]);

  const value = useMemo<CartState>(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return {
      items: safeItems,
      totalQuantity: safeItems.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0),
      add: (item, quantity = 1) =>
        setItems((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          const found = arr.find((p) => p && p.productId === item.productId);
          if (found) {
            return arr.map((p) =>
              p.productId === item.productId
                ? { ...p, quantity: (Number(p.quantity) || 0) + quantity }
                : p,
            );
          }
          return [...arr, { ...item, quantity }];
        }),
      setQuantity: (productId, quantity) =>
        setItems((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          return quantity <= 0
            ? arr.filter((p) => p && p.productId !== productId)
            : arr.map((p) => (p && p.productId === productId ? { ...p, quantity } : p));
        }),
      remove: (productId) =>
        setItems((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          return arr.filter((p) => p && p.productId !== productId);
        }),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

const FALLBACK_CART_STATE: CartState = {
  items: [],
  totalQuantity: 0,
  add: () => {},
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
};

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return FALLBACK_CART_STATE;
  }
  return ctx;
}
