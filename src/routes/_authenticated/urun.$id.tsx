import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  PackageSearch,
  ShoppingCart,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Boxes,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { FALLBACK_PRODUCTS } from "@/data/products";
import {
  categoryLabel,
  type Product,
  isProductInStock,
  setProductStockStatusLocal,
  cleanProductDescription,
  extractPackageOrBoxInfo,
  normalizeProductWithOverrides,
} from "@/lib/catalog";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/urun/$id")({
  head: () => ({
    meta: [
      { title: "Ürün Detayı — KasımOğulları Ltd. Şti." },
      {
        name: "description",
        content: "Ürün bilgilerini inceleyin, adet belirleyip sepetinize ekleyin.",
      },
      { property: "og:title", content: "Ürün Detayı — KasımOğulları Ltd. Şti." },
      {
        property: "og:description",
        content: "Toptan ürün detayları: birim bilgisi, açıklama ve hızlı sipariş.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetail,
});

import { getCustomProducts } from "@/lib/custom-products";

async function fetchSingleProduct(id: string): Promise<Product | null> {
  const custom = getCustomProducts();
  const customMatch = custom.find((p) => p.id === id);
  if (customMatch) {
    return customMatch;
  }

  const localMatch = FALLBACK_PRODUCTS.find((p) => p.id === id);
  if (localMatch) {
    return localMatch;
  }

  try {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (!error && data) return data as Product;
  } catch (err) {
    console.warn("[ProductDetail] Supabase client fetch failed:", err);
  }

  return null;
}

function ProductDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const { add } = useCart();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [stockTick, setStockTick] = useState(0);
  const [togglingStock, setTogglingStock] = useState(false);

  useEffect(() => {
    const handleStockChange = () => setStockTick((t) => t + 1);
    window.addEventListener("product_stock_status_changed", handleStockChange);
    return () => window.removeEventListener("product_stock_status_changed", handleStockChange);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchSingleProduct(id),
    initialData: () => FALLBACK_PRODUCTS.find((p) => p.id === id) ?? undefined,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!data || data.is_active === false) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Ürün Yayında Değil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu ürün arşivlenmiş veya satıştan kaldırılmıştır.
        </p>
        <Button asChild className="mt-5">
          <Link to="/">Kataloğa dön</Link>
        </Button>
      </div>
    );
  }

  const product = normalizeProductWithOverrides(data);
  const inStock = isProductInStock(product);

  const toggleStock = async () => {
    const newStatus = !inStock;
    setTogglingStock(true);
    setProductStockStatusLocal(product.id, newStatus);

    const baseDesc = cleanProductDescription(product.description);
    const newDescription = newStatus ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    qc.setQueryData<Product | null>(["product", id], (old) => {
      if (!old) return old;
      return { ...old, description: newDescription };
    });
    qc.setQueryData<Product[]>(["live-supabase-products"], (old) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, description: newDescription } : p));
    });
    qc.setQueryData<Product[]>(["admin-products"], (old) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, description: newDescription } : p));
    });

    try {
      await supabase.from("products").update({ description: newDescription }).eq("id", product.id);
    } catch (err) {
      console.warn("Supabase update error:", err);
    }

    toast.success(
      newStatus
        ? `"${product.name}" stokta olarak işaretlendi.`
        : `"${product.name}" stokta yok olarak işaretlendi.`,
    );
    setTogglingStock(false);
    void qc.invalidateQueries({ queryKey: ["product", id] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const onAdd = () => {
    if (!inStock) {
      toast.error("Bu ürün şu anda stokta bulunmamaktadır.");
      return;
    }
    add(
      {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        image_url: product.image_url,
      },
      qty,
    );
    toast.success(`${product.name} sepete eklendi (${qty} ${product.unit})`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Yönetici İşlem Bannerı */}
      {isAdmin && (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Yönetici Paneli Kısayolu</p>
              <p className="text-xs text-muted-foreground">
                Stok durumunu hızlıca değiştirebilir veya ürün düzenleme formunu açabilirsiniz.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={togglingStock}
              onClick={() => void toggleStock()}
              className={`flex-1 sm:flex-initial text-xs font-semibold ${
                inStock
                  ? "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-rose-500 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
              }`}
            >
              {togglingStock ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : inStock ? (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              {inStock ? "Stokta Var (Yok Yap)" : "Stokta Yok (Var Yap)"}
            </Button>
            <Button
              asChild
              className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
            >
              <Link to="/yonetim" search={{ tab: "products", edit: product.id }}>
                <Pencil className="mr-2 h-4 w-4" />
                Ürünü Düzenle
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Katalog
      </Link>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-card relative group">
          <div className="aspect-square w-full">
            <img
              src={getPublicProductImageUrl(product, product.name, product.category)}
              alt={product.name}
              onError={(e) => handleProductImageError(e, product.name, product.category)}
              className={`h-full w-full object-contain p-4 bg-white transition-opacity ${
                !inStock ? "opacity-70" : "opacity-100"
              }`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                {categoryLabel(product.category)}
              </span>
              <span className="text-muted-foreground">•</span>
              {inStock ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Stokta Var
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <XCircle className="h-3.5 w-3.5" />
                  Stokta Yok / Tükendi
                </span>
              )}
            </div>
            {isAdmin && (
              <Link
                to="/yonetim"
                search={{ tab: "products", edit: product.id }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                <span>Düzenle</span>
              </Link>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-foreground">
            {product.name}
          </h1>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              Birim: <strong>{product.unit}</strong>
            </span>
            {extractPackageOrBoxInfo(product.description, product.unit, product.name, product.id) &&
              (() => {
                const info = extractPackageOrBoxInfo(
                  product.description,
                  product.unit,
                  product.name,
                  product.id,
                )!;
                const isPack = info.toLowerCase().startsWith("paket");
                return (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border ${
                      isPack
                        ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {isPack ? (
                      <Package className="h-3.5 w-3.5 text-purple-600" />
                    ) : (
                      <Boxes className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <strong>{info}</strong>
                  </span>
                );
              })()}
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                inStock
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
              }`}
            >
              {inStock ? "Sipariş verilebilir" : "Geçici olarak temin edilemiyor"}
            </span>
          </div>

          {cleanProductDescription(product.description) && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {cleanProductDescription(product.description)}
            </p>
          )}

          {inStock ? (
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Azalt"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-semibold">{qty}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Artır"
                  onClick={() => setQty((q) => Math.min(999, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">{product.unit}</span>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                Bu ürün şu anda şirketimizde tükenmiştir. Yeni sevkiyat geldiğinde stok durumu
                güncellenecektir.
              </span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={!inStock}
              onClick={onAdd}
              className={!inStock ? "opacity-60 cursor-not-allowed" : ""}
            >
              <ShoppingCart className="h-4 w-4" />
              {inStock ? "Sepete ekle" : "Stokta Yok"}
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sepet">Sepete git</Link>
            </Button>
            {isAdmin && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-semibold"
              >
                <Link to="/yonetim" search={{ tab: "products", edit: product.id }}>
                  <Pencil className="h-4 w-4" />
                  Yönetim Paneline Git
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
