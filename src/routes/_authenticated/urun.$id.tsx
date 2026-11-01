import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  PackageSearch,
  ShoppingCart,
  Check,
  X,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Boxes,
  Package,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
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
import { getAllCatalogProducts, isProductPermanentlyDeleted } from "@/lib/custom-products";
import { SadWatermark } from "@/components/SadWatermark";
import { shouldDisplaySadWatermark, SAD_WATERMARK_TEXT } from "@/lib/sad-watermark";

export const Route = createFileRoute("/_authenticated/urun/$id")({
  head: () => ({
    meta: [
      { title: "Ürün Detayı — Ko Toptan" },
      {
        name: "description",
        content:
          "Ürün ambalaj bilgilerini inceleyin, toptan miktarı belirleyip sepetinize ekleyin.",
      },
      { property: "og:title", content: "Ürün Detayı — Ko Toptan" },
      {
        property: "og:description",
        content: "Toptan ürün detayları: birim bilgisi, ambalaj açıklaması ve hızlı sipariş.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetailPage,
});

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
    const res = await fetch("/api/products");
    if (res.ok) {
      const items = (await res.json()) as Product[];
      if (Array.isArray(items)) {
        const found = items.find((p) => p.id === id);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function ProductDetailPage() {
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
  const [justAdded, setJustAdded] = useState(false);

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
      <div className="w-full bg-[#050806] text-white min-h-[calc(100vh-4rem)] px-4 py-10">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-3xl bg-[#0b140e] border border-white/5" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3 bg-white/10" />
            <Skeleton className="h-4 w-1/3 bg-white/5" />
            <Skeleton className="h-28 w-full bg-[#0b140e]" />
            <Skeleton className="h-12 w-full bg-white/10 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.is_active === false) {
    return (
      <div className="w-full bg-[#050806] text-white min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <PackageSearch className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-white">Ürün Yayında Değil</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Bu ürün arşivlenmiş, tükenmiş veya satıştan kaldırılmıştır.
          </p>
          <Button
            asChild
            className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-6"
          >
            <Link to="/">Kataloğa Dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  const product = normalizeProductWithOverrides(data);
  const inStock = isProductInStock(product);
  const boxInfo = extractPackageOrBoxInfo(
    product.description,
    product.unit,
    product.name,
    product.id,
  );

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
    qc.setQueryData<Product[]>(["live-d1-products"], (old) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, description: newDescription } : p));
    });

    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, description: newDescription }),
      });
    } catch (err) {
      console.warn("Product stock update error:", err);
    }

    toast.success(
      newStatus
        ? `"${product.name}" stokta olarak işaretlendi.`
        : `"${product.name}" stokta yok olarak işaretlendi.`,
    );
    setTogglingStock(false);
    void qc.invalidateQueries({ queryKey: ["product", id] });
    void qc.invalidateQueries({ queryKey: ["live-d1-products"] });
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
    setJustAdded(true);
    toast.success(`${product.name} sepete eklendi (${qty} ${product.unit})`);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="w-full bg-[#050806] text-white min-h-[calc(100vh-4rem)] selection:bg-emerald-500/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kataloğa Dön</span>
          </Link>

          {shouldDisplaySadWatermark(product) && (
            <span
              aria-hidden="true"
              dir="rtl"
              title="Bereket Filigranı"
              className="pointer-events-none select-none text-sm sm:text-base font-serif text-emerald-400/30 tracking-widest leading-none"
              style={{
                fontFamily:
                  "'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif",
              }}
            >
              {SAD_WATERMARK_TEXT}
            </span>
          )}
        </div>

        {/* Product Detail Two-Column Showcase */}
        <div className="mt-8 grid gap-8 md:grid-cols-2 items-start">
          {/* Image Showcase Card */}
          <div className="overflow-hidden rounded-3xl border border-emerald-950/80 bg-[#0b140e] p-6 shadow-2xl relative group">
            {shouldDisplaySadWatermark(product) && <SadWatermark variant="detail" />}

            {/* Sol Üst Ambalaj Rozeti */}
            <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1 pointer-events-none">
              {boxInfo && (
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border shadow-sm backdrop-blur-md ${
                    (boxInfo || "").toLowerCase().startsWith("paket")
                      ? "bg-purple-950/90 border-purple-500/40 text-purple-300"
                      : "bg-rose-950/90 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {(boxInfo || "").toLowerCase().startsWith("paket") ? (
                    <Package className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <Boxes className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span>{boxInfo}</span>
                </span>
              )}
              {(product.unit || "").toLowerCase() === "adet" && (
                <span className="rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border border-blue-500/40 bg-blue-950/90 text-blue-300 shadow-sm backdrop-blur-md">
                  <span>Adet</span>
                </span>
              )}
              {!boxInfo && (product.unit || "").toLowerCase() !== "adet" && (
                <span className="rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 border border-white/10 bg-black/80 text-zinc-300 shadow-sm backdrop-blur-md">
                  <span>{formatUnitLabel(product.unit)}</span>
                </span>
              )}
            </div>

            <div className="relative aspect-square w-full rounded-3xl bg-gradient-to-b from-[#14261a]/95 via-[#0e1b12]/95 to-[#09120c]/95 flex items-center justify-center p-6 sm:p-8 border border-emerald-500/20 shadow-2xl overflow-hidden backdrop-blur-md">
              <div className="relative flex h-full w-full items-center justify-center p-2.5">
                {/* Dışa doğru çok az taşan beyaz yumuşak blur */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-2.5 rounded-3xl bg-white/40 blur-md select-none transition-opacity duration-300 group-hover:bg-white/55"
                />

                {/* Ovalleştirilmiş Beyaz Kaide (Dışa beyaz blur yayar, ürün üstüne blur gelmez) */}
                <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-white p-6 product-outer-white-blur-hero">
                  <img
                    src={getPublicProductImageUrl(product, product.name, product.category)}
                    alt={product.name}
                    onError={(e) => handleProductImageError(e, product.name, product.category)}
                    className={`h-full w-full object-contain transition-transform duration-300 product-image-crisp ${
                      !inStock ? "opacity-50 grayscale-[50%]" : "group-hover:scale-105"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Details & Purchase Module */}
          <div className="flex flex-col justify-between h-full space-y-6">
            <div>
              {/* Category, Status & Admin Controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {categoryLabel(product.category)}
                  </span>
                  <span className="text-zinc-600">•</span>
                  {inStock ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Stokta Var
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-950/70 px-2.5 py-0.5 rounded-lg border border-rose-500/40">
                      <XCircle className="h-3.5 w-3.5 text-rose-400" />
                      Stokta Yok / Tükendi
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={togglingStock}
                      onClick={toggleStock}
                      aria-label="Stok Durumunu Değiştir"
                      className={`inline-flex h-8 px-2.5 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-all ${
                        inStock
                          ? "bg-rose-950/70 border-rose-500/40 text-rose-300 hover:bg-rose-900"
                          : "bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900"
                      }`}
                    >
                      {togglingStock ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : inStock ? (
                        <>
                          <X className="h-3.5 w-3.5 text-rose-400" />
                          <span>Tükendi Yap</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Stokta Yap</span>
                        </>
                      )}
                    </button>

                    <Link
                      to="/yonetim"
                      search={{ tab: "products", edit: product.id }}
                      aria-label="Ürünü Düzenle"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 transition-colors"
                      title="Ürün Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold leading-tight text-white">
                {product.name}
              </h1>

              {/* Units & Packaging Info Strip */}
              <div className="mt-4 flex items-center gap-2.5 flex-wrap">
                <span className="rounded-xl bg-[#0b140e] px-3.5 py-1.5 text-xs font-bold text-zinc-300 border border-white/10">
                  Birim:{" "}
                  {(product.unit || "").toLowerCase() === "adet" ? (
                    <span className="text-blue-400 font-extrabold">Adet</span>
                  ) : (
                    <span className="text-white font-extrabold">
                      {formatUnitLabel(product.unit)}
                    </span>
                  )}
                </span>

                {boxInfo && (
                  <span
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 border ${
                      (boxInfo || "").toLowerCase().startsWith("paket")
                        ? "bg-purple-950/60 border-purple-500/40 text-purple-300"
                        : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {(boxInfo || "").toLowerCase().startsWith("paket") ? (
                      <Package className="h-3.5 w-3.5 text-purple-400" />
                    ) : (
                      <Boxes className="h-3.5 w-3.5 text-rose-400" />
                    )}
                    <span>{boxInfo}</span>
                  </span>
                )}
              </div>

              {/* Description */}
              {cleanProductDescription(product.description) && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b140e] p-4 text-sm text-zinc-300 leading-relaxed">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                    Ambalaj & Ürün Bilgisi
                  </h3>
                  <p>{cleanProductDescription(product.description)}</p>
                </div>
              )}
            </div>

            {/* Purchase Order Block */}
            <div className="rounded-2xl border border-white/10 bg-[#09120c] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300">Sipariş Miktarı:</span>
                <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={!inStock || qty <= 1}
                    aria-label="Miktarı azalt"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-base font-bold tabular-nums text-white">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    disabled={!inStock}
                    aria-label="Miktarı artır"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!inStock}
                  onClick={onAdd}
                  className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 cursor-pointer ${
                    !inStock
                      ? "bg-white/10 text-zinc-500 cursor-not-allowed opacity-60"
                      : justAdded
                        ? "bg-emerald-500 text-black font-extrabold"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {!inStock ? (
                    <>
                      <X className="h-4 w-4 text-rose-400 stroke-[2.5]" />
                      <span>Bu Ürün Şu Anda Tükendi</span>
                    </>
                  ) : justAdded ? (
                    <>
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>Sepete Eklendi</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      <span>
                        Sepete Ekle ({qty} {product.unit})
                      </span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-zinc-400 text-center">
                Depo teslimatımız Tatvan, Bitlis ve çevre 7 ilçeye haftalık düzenli rotalarla
                yapılmaktadır.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
