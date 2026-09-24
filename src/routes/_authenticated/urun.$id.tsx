import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Minus, Plus, PackageSearch, ShoppingCart, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { categoryLabel, FALLBACK_PRODUCTS, type Product } from "@/lib/catalog";
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

async function fetchSingleProduct(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, category, unit, image_url, is_active")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return data as Product;
  } catch (err) {
    console.warn("[ProductDetail] Supabase client fetch failed:", err);
  }

  // REST fallback
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=id,name,description,category,unit,image_url,is_active&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0) {
        return arr[0] as Product;
      }
    }
  } catch (restErr) {
    console.warn("[ProductDetail] REST fetch fallback failed:", restErr);
  }

  return FALLBACK_PRODUCTS.find((p) => p.id === id) ?? null;
}

function ProductDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchSingleProduct(id),
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

  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Ürün bulunamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu ürün kaldırılmış veya katalogda görünmüyor olabilir.
        </p>
        <Button asChild className="mt-5">
          <Link to="/">Kataloğa dön</Link>
        </Button>
      </div>
    );
  }

  const product = data;

  const onAdd = () => {
    add({ productId: product.id, name: product.name, unit: product.unit }, qty);
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
                Bu ürünü doğrudan yönetim panelindeki ürün düzenleme formunda açın.
              </p>
            </div>
          </div>
          <Button
            asChild
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
          >
            <Link to="/yonetim" search={{ tab: "products", edit: product.id }}>
              <Pencil className="mr-2 h-4 w-4" />
              Ürünü Düzenle
            </Link>
          </Button>
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
        <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-card">
          <div className="aspect-square w-full">
            <img
              src={getPublicProductImageUrl(product.image_url, product.name, product.category)}
              alt={product.name}
              onError={(e) => handleProductImageError(e, product.name, product.category)}
              className="h-full w-full object-contain p-4 bg-white"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              {categoryLabel(product.category)}
            </span>
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
          <p className="mt-2 text-sm text-muted-foreground">Birim: {product.unit}</p>
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

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

          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" onClick={onAdd}>
              <ShoppingCart className="h-4 w-4" />
              Sepete ekle
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
