import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Minus, Plus, PackageSearch, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
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

function ProductDetail() {
  const { id } = Route.useParams();
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, category, unit, image_url, is_active")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Product | null;
    },
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
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <PackageSearch className="h-14 w-14" />
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {categoryLabel(product.category)}
          </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
