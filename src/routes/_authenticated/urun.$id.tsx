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
  formatUnitLabel,
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

import { getAllCatalogProducts, isProductPermanentlyDeleted } from "@/lib/custom-products";

async function fetchSingleProduct(id: string): Promise<Product | null> {
  if (isProductPermanentlyDeleted(id)) {
    return null;
  }
  const all = getAllCatalogProducts();
  const match = all.find((p) => p.id === id);
  if (match) {
    return match;
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
  const params = Route.useParams({ shouldThrow: false }) as { id?: string } | undefined;
  const id =
    params?.id ||
    (typeof window !== "undefined"
      ? window.location.pathname.match(/\/urun\/([^/?#]+)/)?.[1] || ""
      : "");
  const { isAdmin } = useAuth();
  const { add } = useCart();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [stockTick, setStockTick] = useState(0);
  const [togglingStock, setTogglingStock] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStockChange = () => setStockTick((t) => t + 1);
    window.addEventListener("product_stock_status_changed", handleStockChange);
    return () => window.removeEventListener("product_stock_status_changed", handleStockChange);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchSingleProduct(id),
    initialData: () => getAllCatalogProducts().find((p) => p.id === id) ?? undefined,
    staleTime: 0,
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
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Katalog
      </Link>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm relative group">
          {/* SOL ÜSTTE: Koli İçi (Kırmızı) / Paket İçi (Mor) / Adet (Mavi) Rozeti */}
          <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1 pointer-events-none">
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
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border shadow-xs backdrop-blur-xs ${
                      isPack
                        ? "bg-purple-50/95 border-purple-200 text-purple-700 dark:bg-purple-950/90 dark:text-purple-300 dark:border-purple-800"
                        : "bg-red-50/95 border border-red-200 text-red-600 dark:bg-red-950/90 dark:text-red-400 dark:border-red-800"
                    }`}
                  >
                    {isPack ? (
                      <Package className="h-3.5 w-3.5 text-purple-600" />
                    ) : (
                      <Boxes className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <strong>{info}</strong>
                  </span>
                );
              })()}
            {(product.unit || "").toLowerCase() === "adet" && (
              <span className="rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border shadow-xs backdrop-blur-xs bg-blue-50/95 border-blue-200 text-blue-600 dark:bg-blue-950/90 dark:text-blue-400 dark:border-blue-800">
                <strong>Adet</strong>
              </span>
            )}
            {!extractPackageOrBoxInfo(
              product.description,
              product.unit,
              product.name,
              product.id,
            ) &&
              (product.unit || "").toLowerCase() !== "adet" && (
                <span className="rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border shadow-xs backdrop-blur-xs bg-white/95 border-slate-200 text-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                  <span>{formatUnitLabel(product.unit)}</span>
                </span>
              )}
          </div>

          <div className="aspect-square w-full bg-white flex items-center justify-center">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
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
              Birim:{" "}
              {(product.unit || "").toLowerCase() === "adet" ? (
                <strong className="text-blue-600 font-extrabold">Adet</strong>
              ) : (
                <strong>{formatUnitLabel(product.unit)}</strong>
              )}
            </span>
            {extractPackageOrBoxInfo(product.description, product.unit, product.name, product.id) &&
              (() => {
                const info = extractPackageOrBoxInfo(
                  product.description,
                  product.unit,
                  product.name,
                  product.id,
                )!;
                const isPack = (info || "").toLowerCase().startsWith("paket");
                return (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border shadow-xs ${
                      isPack
                        ? "bg-purple-50/90 border-purple-200 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800"
                        : "bg-red-50/90 border border-red-200 text-red-600 dark:bg-red-950/70 dark:text-red-400 dark:border-red-800"
                    }`}
                  >
                    {isPack ? (
                      <Package className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300" />
                    ) : (
                      <Boxes className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
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

          {!isAdmin && inStock ? (
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
              <span className="text-sm font-semibold">
                {(product.unit || "").toLowerCase() === "adet" ? (
                  <span className="text-blue-600 font-bold">Adet</span>
                ) : (
                  <span className="text-muted-foreground">{formatUnitLabel(product.unit)}</span>
                )}
              </span>
            </div>
          ) : !inStock ? (
            <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                Bu ürün şu anda şirketimizde tükenmiştir. Yeni sevkiyat geldiğinde stok durumu
                güncellenecektir.
              </span>
            </div>
          ) : null}

          {/* Aksiyon Butonları: Yöneticide Sepet Kesinlikle Yoktur, Solda Stokta Var/Yok ve Ürünü Düzenle Yan Yana */}
          {isAdmin ? (
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {/* Solda: Stokta Var / Stokta Yok Butonları */}
              <Button
                type="button"
                size="lg"
                disabled={togglingStock}
                onClick={() => {
                  if (!inStock) void toggleStock();
                }}
                className={`font-bold gap-1.5 transition-all ${
                  inStock
                    ? "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                    : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200"
                }`}
              >
                {togglingStock ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Stokta Var</span>
              </Button>

              <Button
                type="button"
                size="lg"
                disabled={togglingStock}
                onClick={() => {
                  if (inStock) void toggleStock();
                }}
                className={`font-bold gap-1.5 transition-all ${
                  !inStock
                    ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                    : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200"
                }`}
              >
                {togglingStock ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>Stokta Yok</span>
              </Button>

              {/* Sağında: Ürünü Düzenle Butonu */}
              <Button
                asChild
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
              >
                <Link to="/yonetim" search={{ tab: "products", edit: product.id }}>
                  <Pencil className="h-4 w-4" />
                  <span>Ürünü Düzenle</span>
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline">
                <Link to="/yonetim">Yönetim Paneli</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-50"
              >
                <Link to="/siparisler">
                  <Package className="h-4 w-4 mr-1.5" />
                  Siparişler & Sevkiyat
                </Link>
              </Button>
            </div>
          ) : (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
