import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Check, PackageSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Ürün Kataloğu — KasımOğulları Ltd. Şti." },
      {
        name: "description",
        content:
          "Gıda, bakliyat ve temizlik ürünlerimizi inceleyin, adet belirleyip sepetinize ekleyin.",
      },
      { property: "og:title", content: "Ürün Kataloğu — KasımOğulları Ltd. Şti." },
      {
        property: "og:description",
        content: "Market ve bakkallar için toptan ürün kataloğu ve kolay sipariş.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [category, setCategory] = useState<string>("tumu");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, category, unit, image_url, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const products = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLocaleLowerCase("tr");
    return list.filter(
      (p) =>
        (category === "tumu" || p.category === category) &&
        (q === "" || p.name.toLocaleLowerCase("tr").includes(q)),
    );
  }, [data, category, search]);

  return (
    <>
      <section className="bg-brand-gradient text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.45fr_1fr] lg:items-stretch">
          <HeroShowcase products={data ?? []} loading={isLoading} />

          <div className="flex flex-col gap-5">
            <ProductMarquee products={data ?? []} />

            <div className="text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-green">
                Toptan depo kataloğu
              </p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
                Ürünleri görün, adetleri seçin, siparişi gönderin.
              </h1>
              <div className="mt-5 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button asChild size="lg">
                  <a href="#urunler">Ürünleri incele</a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                >
                  <Link to="/sepet">Sepetim</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section id="urunler" className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={
                  category === c.value
                    ? "rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
                    : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara..."
              className="pl-9"
              maxLength={80}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center text-muted-foreground">
            <PackageSearch className="h-10 w-10" />
            <p className="mt-3 font-medium text-foreground">Ürün bulunamadı</p>
            <p className="mt-1 text-sm">
              Bu kategoride henüz ürün yok. Yönetim panelinden ürün ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const onAdd = () => {
    add({ productId: product.id, name: product.name, unit: product.unit }, 1);
    setAdded(true);
    toast.success(`${product.name} sepete eklendi`);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-pop">
      <Link to="/urun/$id" params={{ id: product.id }} className="block">
        <div className="aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <PackageSearch className="h-10 w-10" />
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {categoryLabel(product.category)}
        </span>
        <Link to="/urun/$id" params={{ id: product.id }}>
          <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground hover:text-primary">
            {product.name}
          </h2>
        </Link>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Birim: {product.unit}</p>
        <Button className="mt-3 w-full" size="sm" onClick={onAdd}>
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {added ? "Eklendi" : "Sepete ekle"}
        </Button>
      </div>
    </article>
  );
}

function HeroShowcase({ products, loading }: { products: Product[]; loading: boolean }) {
  const slides = useMemo(() => {
    const withImage = products.filter((p) => p.image_url);
    return withImage.length > 0 ? withImage : products;
  }, [products]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = (i: number) => {
    if (slides.length === 0) return;
    setIndex(((i % slides.length) + slides.length) % slides.length);
  };

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 3500);
    return () => clearInterval(id);
  }, [slides.length, paused]);


  if (loading) {
    return <Skeleton className="aspect-[16/9] w-full rounded-2xl bg-white/10" />;
  }

  if (slides.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/60">
        <PackageSearch className="h-10 w-10" />
      </div>
    );
  }


  const active = slides[index]!;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-pop"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(delta) > 40) goTo(index + (delta < 0 ? 1 : -1));
      }}
    >
      <Link
        to="/urun/$id"
        params={{ id: active.id }}
        aria-label={`${active.name} ürününü aç`}
        className="block"
      >
        <div className="aspect-[16/9] w-full bg-white p-4">
          {active.image_url ? (
            <img
              key={active.id}
              src={active.image_url}
              alt={active.name}
              className="animate-slide-fade h-full w-full object-contain"
            />

          ) : (
            <div
              key={active.id}
              className="animate-slide-fade flex h-full w-full flex-col items-center justify-center gap-3 bg-white/5 px-6 text-center"
            >
              <PackageSearch className="h-12 w-12 text-brand-green" />
              <p className="text-2xl font-extrabold text-white">{active.name}</p>
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-green">
            {categoryLabel(active.category)}
          </p>
          <p className="mt-1 text-xl font-extrabold text-white sm:text-3xl">{active.name}</p>
          <p className="text-sm text-white/70">Birim: {active.unit} · Ürünü görüntüle</p>
        </div>
      </Link>
      <div className="absolute right-4 top-4 flex gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            aria-label={`${i + 1}. ürün`}
            onClick={() => setIndex(i)}
            className={
              i === index
                ? "h-1.5 w-6 rounded-full bg-brand-green transition-all"
                : "h-1.5 w-1.5 rounded-full bg-white/50 transition-all"
            }
          />
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Önceki ürün"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Sonraki ürün"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/70"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

function ProductMarquee({ products }: { products: Product[] }) {
  const items = products;
  if (items.length < 3) return null;
  const loop = [...items, ...items];

  return (
    <div className="relative mt-6 overflow-hidden border-y border-white/10 py-5">
      <div className="animate-marquee flex w-max gap-4">
        {loop.map((p, i) => (
          <Link
            key={`${p.id}-${i}`}
            to="/urun/$id"
            params={{ id: p.id }}
            className="flex w-40 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 transition-colors hover:border-brand-green/60 hover:bg-white/10"
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.name}
                loading="lazy"
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-brand-green">
                <PackageSearch className="h-5 w-5" />
              </span>
            )}
            <span className="line-clamp-2 text-xs font-medium text-white/80">{p.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
