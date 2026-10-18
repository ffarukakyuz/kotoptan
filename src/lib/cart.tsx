import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

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

const defaultCartState: CartState = {
  items: [],
  totalQuantity: 0,
  add: () => {},
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
};

const CartContext = createContext<CartState>(defaultCartState);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const safeUserId = user && typeof user.id === "string" && user.id.trim() ? user.id.trim() : "";
  const storageKey = safeUserId ? `depo-sepet-v1_${safeUserId}` : "depo-sepet-v1_guest";

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const valid: CartItem[] = [];
              for (const p of parsed) {
                if (
                  p &&
                  typeof p === "object" &&
                  typeof p.productId === "string" &&
                  p.productId.trim()
                ) {
                  const qty = Number(p.quantity);
                  valid.push({
                    productId: p.productId.trim(),
                    name: typeof p.name === "string" ? p.name : "Ürün",
                    unit: typeof p.unit === "string" ? p.unit : "koli",
                    quantity: isNaN(qty) || qty <= 0 ? 1 : Math.floor(qty),
                    image_url: typeof p.image_url === "string" ? p.image_url : null,
                  });
                }
              }
              setItems(valid);
            } else {
              // Bozuk veya uyumsuz format
              try {
                localStorage.removeItem(storageKey);
              } catch {
                /* ignore */
              }
              setItems([]);
            }
          } catch {
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* ignore */
            }
            setItems([]);
          }
        } else {
          setItems([]);
        }
      }
    } catch (err) {
      console.warn("[Cart] Failed to load cart from localStorage, using fallback:", err);
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* ignore */
      }
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      const safePayload = Array.isArray(items)
        ? items.filter((i) => i && typeof i.productId === "string" && Number(i.quantity) > 0)
        : [];
      localStorage.setItem(storageKey, JSON.stringify(safePayload));
    } catch {
      /* ignore */
    }
  }, [items, hydrated, storageKey]);

  const value = useMemo<CartState>(() => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const totalQuantity = safeItems.reduce((sum, i) => {
      const q = Number(i?.quantity);
      return sum + (isNaN(q) || q <= 0 ? 0 : q);
    }, 0);

    return {
      items: safeItems,
      totalQuantity,
      add: (item, quantity = 1) => {
        if (!item || typeof item.productId !== "string" || !item.productId.trim()) return;
        const addQty = Math.max(1, Number(quantity) || 1);
        setItems((prev) => {
          const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
          const found = list.find((p) => p && p.productId === item.productId);
          if (found) {
            return list.map((p) =>
              p && p.productId === item.productId
                ? { ...p, quantity: (Number(p.quantity) || 0) + addQty }
                : p,
            );
          }
          return [
            ...list,
            {
              productId: item.productId.trim(),
              name: item.name || "Ürün",
              unit: item.unit || "koli",
              quantity: addQty,
              image_url: item.image_url || null,
            },
          ];
        });
      },
      setQuantity: (productId, quantity) => {
        if (!productId || typeof productId !== "string") return;
        const targetQty = Number(quantity) || 0;
        setItems((prev) => {
          const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
          return targetQty <= 0
            ? list.filter((p) => p && p.productId !== productId)
            : list.map((p) =>
                p && p.productId === productId ? { ...p, quantity: Math.floor(targetQty) } : p,
              );
        });
      },
      remove: (productId) => {
        if (!productId || typeof productId !== "string") return;
        setItems((prev) => {
          const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
          return list.filter((p) => p && p.productId !== productId);
        });
      },
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  // Never throw invariant assertion error; always return safe guaranteed fallback
  if (!ctx || typeof ctx !== "object") {
    return defaultCartState;
  }
  return {
    items: Array.isArray(ctx.items) ? ctx.items : [],
    totalQuantity: Number(ctx.totalQuantity) || 0,
    add: typeof ctx.add === "function" ? ctx.add : defaultCartState.add,
    setQuantity:
      typeof ctx.setQuantity === "function" ? ctx.setQuantity : defaultCartState.setQuantity,
    remove: typeof ctx.remove === "function" ? ctx.remove : defaultCartState.remove,
    clear: typeof ctx.clear === "function" ? ctx.clear : defaultCartState.clear,
  };
}
