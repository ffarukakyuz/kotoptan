import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Check,
  PackageSearch,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Pause,
  Zap,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { categoryLabel, FALLBACK_PRODUCTS, type Product } from "@/lib/catalog";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";
import { useCart } from "@/lib/cart";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AllCategoryIcon,
  TemizlikCategoryIcon,
  GidaCategoryIcon,
  BakliyatCategoryIcon,
} from "@/components/CategoryIcons";

async function fetchProductsFromDatabase(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, category, unit, image_url, is_active")
      .eq("is_active", true)
      .order("name")
      .limit(1000);

    if (!error && data && data.length > 0) {
      return data as Product[];
    }
  } catch (err) {
    console.warn("[Products] Supabase client query threw:", err);
  }

  // Fallback to direct REST endpoint if client had any network/auth issue
  try {
    const restEndpoint = `${SUPABASE_URL}/rest/v1/products?select=id,name,description,category,unit,image_url,is_active&is_active=eq.true&order=name&limit=1000`;
    const res = await fetch(restEndpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        return json as Product[];
      }
    }
  } catch (restErr) {
    console.warn("[Products] Direct REST fetch query threw:", restErr);
  }

  return [];
}

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "KasımOğulları Ltd. Şti. — Toptan Ürün Kataloğu" },
      {
        name: "description",
        content:
          "KasımOğulları depomuzun toptan ürünlerini inceleyin, adetleri seçin ve siparişinizi oluşturun.",
      },
      { property: "og:title", content: "KasımOğulları Ltd. Şti. — Toptan Ürün Kataloğu" },
      {
        property: "og:description",
        content: "Market ve bakkallar için toptan ürün kataloğu ve kolay sipariş.",
      },
    ],
  }),
  component: Index,
});

const CIRCULAR_CATEGORIES = [
  { value: "tumu", label: "Tümü", Icon: AllCategoryIcon },
  { value: "temizlik", label: "Temizlik", Icon: TemizlikCategoryIcon },
  { value: "gida", label: "Gıda", Icon: GidaCategoryIcon },
  { value: "bakliyat", label: "Bakliyat", Icon: BakliyatCategoryIcon },
] as const;

function Index() {
  const [category, setCategory] = useState<string>("tumu");
  const [search, setSearch] = useState("");

  // 1. TanStack Query for caching and server-rendering integration
  const { data: dbProducts, isLoading: isQueryLoading } = useQuery({
    queryKey: ["products", "active"],
    queryFn: fetchProductsFromDatabase,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });

  // 2. Direct client-side state guarantee: runs in browser on component mount
  const [clientProducts, setClientProducts] = useState<Product[]>([]);
  const [isClientLoading, setIsClientLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadClientSide() {
      try {
        const items = await fetchProductsFromDatabase();
        if (active && items.length > 0) {
          setClientProducts(items);
        }
      } catch (err) {
        console.warn("[Products] Client-side fetch error:", err);
      } finally {
        if (active) {
          setIsClientLoading(false);
        }
      }
    }

    loadClientSide();

    return () => {
      active = false;
    };
  }, []);

  // Merge client state and query data (whichever is populated first / most up-to-date)
  const loadedProducts = useMemo(() => {
    if (clientProducts.length > 0) return clientProducts;
    if (dbProducts && dbProducts.length > 0) return dbProducts;
    return [];
  }, [clientProducts, dbProducts]);

  // Merge DB products with FALLBACK_PRODUCTS (ensuring Dalan soap and catalog items exist)
  const allProducts = useMemo(() => {
    if (loadedProducts && loadedProducts.length > 0) {
      const hasDalan = loadedProducts.some((p) => p.name.toLowerCase().includes("dalan"));
      return hasDalan ? loadedProducts : [...FALLBACK_PRODUCTS.slice(0, 1), ...loadedProducts];
    }
    return FALLBACK_PRODUCTS;
  }, [loadedProducts]);

  const isLoading = isQueryLoading && isClientLoading && loadedProducts.length === 0;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return allProducts.filter(
      (p) =>
        (category === "tumu" || p.category === category) &&
        (q === "" || p.name.toLocaleLowerCase("tr").includes(q)),
    );
  }, [allProducts, category, search]);

  const scrollToCatalog = () => {
    const el = document.getElementById("urunler");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#060b08] text-white">
      {/* HERO SECTION: BLACK BASE, DEEP FOREST GREEN ACCENTS, WHITE HIGHLIGHTS */}
      <section className="relative overflow-hidden px-4 pt-4 pb-12 sm:pt-6 sm:pb-16 bg-gradient-to-b from-[#09150d] via-[#060b08] to-[#040805]">
        {/* Deep forest ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[#166534]/15 blur-[140px]"
        />

        <div className="relative mx-auto max-w-4xl">
          {/* Hero Featured Showcase Card (Pure mockup style: image, arrows, title, unit, pill) */}
          <div className="mt-2 sm:mt-4">
            <HeroProductCard
              products={allProducts}
              selectedCategory={category}
              loading={isLoading}
            />
          </div>

          {/* Hero Call-To-Action Copy & Buttons */}
          <div className="mt-8 text-center sm:mt-10">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] text-[#22c55e] uppercase">
              Toptan Depo Kataloğu
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight max-w-xl mx-auto text-balance">
              Ürünleri görün, adetleri seçin, siparişi gönderin.
            </h1>

            <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="flex-1 rounded-xl bg-[#166534] hover:bg-[#14532d] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-black/60 transition-all active:scale-95 cursor-pointer"
              >
                Ürünleri incele
              </button>
              <Link
                to="/sepet"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-6 py-3.5 text-base font-semibold text-white transition-all active:scale-95 text-center cursor-pointer"
              >
                Sepetim
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG GRID SECTION */}
      <section id="urunler" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {/* Circular Category Navigation (Tümü, Gıda, Bakliyat, Temizlik) - Tüm Ürünler yazısının hemen üstünde */}
        <div className="mb-8 flex items-center justify-center gap-3 sm:gap-8 overflow-x-auto py-2">
          {CIRCULAR_CATEGORIES.map(({ value, label, Icon }) => {
            const isActive = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className="group flex flex-col items-center focus:outline-none cursor-pointer shrink-0"
              >
                <div
                  className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg transition-all duration-200 group-hover:scale-105 active:scale-95 ${
                    isActive
                      ? "scale-105 ring-4 ring-[#166534] ring-offset-2 ring-offset-[#060b08] shadow-[#166534]/40"
                      : "opacity-95 hover:opacity-100"
                  }`}
                >
                  <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-slate-800 transition-transform group-hover:scale-110" />
                </div>
                <span
                  className={`mt-2 text-xs sm:text-sm font-semibold tracking-wide transition-colors ${
                    isActive ? "text-[#22c55e] font-bold" : "text-white/80 group-hover:text-white"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {category === "tumu" ? "Tüm Ürünler" : `${categoryLabel(category)} Ürünleri`}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {filteredProducts.length} adet ürün listeleniyor
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <Input
              id="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı veya barkod ara..."
              className="h-11 w-full rounded-xl border-white/15 bg-white/10 pl-10 pr-9 text-sm text-white placeholder:text-white/40 focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
              maxLength={80}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="my-16 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            <PackageSearch className="h-12 w-12 text-[#22c55e] mb-3" />
            <p className="text-lg font-semibold text-white">Ürün bulunamadı</p>
            <p className="mt-1 text-sm max-w-sm">
              {search
                ? `"${search}" aramasına uygun ürün bulunamadı. Lütfen farklı bir arama deneyin.`
                : "Bu kategoride henüz ürün bulunmuyor."}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                Aramayı Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((p) => (
              <CatalogProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Featured Hero Product Showcase Card
 * Faithfully matches the user's mockup image:
 * Clean white body, image with arrow buttons, category kicker, bold title, pack unit, and counter pill.
 */
function HeroProductCard({
  products,
  selectedCategory,
  loading,
}: {
  products: Product[];
  selectedCategory: string;
  loading: boolean;
}) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  // Filter slides based on category if selected, or use all
  const slides = useMemo(() => {
    const list =
      selectedCategory === "tumu"
        ? products
        : products.filter((p) => p.category === selectedCategory);
    return list.length > 0 ? list : products;
  }, [products, selectedCategory]);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tick, setTick] = useState(0);

  // Reset index when category changes
  useEffect(() => {
    setIndex(0);
    setTick((t) => t + 1);
  }, [selectedCategory]);

  // 3 Saniyede bir otomatik geçiş (Kullanıcı talebi: "allahın hakkı 3 tür 3 sn yap")
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
      setTick((t) => t + 1);
    }, 3000);

    return () => clearInterval(timer);
  }, [isPlaying, slides.length]);

  const nextSlide = () => {
    if (slides.length <= 1) return;
    setIndex((prev) => (prev + 1) % slides.length);
    setTick((t) => t + 1);
  };

  const prevSlide = () => {
    if (slides.length <= 1) return;
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setTick((t) => t + 1);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[340px] sm:max-w-[390px] h-[400px] rounded-[32px] bg-white/10 animate-pulse" />
    );
  }

  if (slides.length === 0) return null;

  const current = slides[index] ?? slides[0]!;

  const handleQuickAdd = () => {
    add({ productId: current.id, name: current.name, unit: current.unit }, 1);
    setJustAdded(true);
    toast.success(`1 ${current.unit} ${current.name} sepete eklendi`);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="relative mx-auto max-w-[340px] sm:max-w-[390px] w-full rounded-[28px] sm:rounded-[32px] bg-white p-5 sm:p-6 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(34,197,94,0.35)] border-2 border-emerald-500/50 transition-all select-none overflow-hidden group">
      {/* 3 SANİYELİK DİNAMİK İLERLEME ÇUBUĞU (Hava Civa Efekti) */}
      {isPlaying && slides.length > 1 && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 overflow-hidden z-20">
          <div
            key={tick}
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#166534] w-full"
            style={{
              animation: "heroProgress 3000ms linear forwards",
            }}
          />
        </div>
      )}

      {/* Üst Canlı Vitrin ve Oynat/Durdur Barı */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
          </span>
          <span className="tracking-wide">CANLI VİTRİN • 3 SN</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
            title={isPlaying ? "Durdur" : "Otomatik Başlat"}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3 w-3 fill-slate-700" />
                <span>Durdur</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-slate-700" />
                <span>3sn Başlat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Image Area with Carousel Arrows */}
      <div className="relative aspect-square w-full rounded-2xl bg-gradient-to-b from-neutral-50 to-neutral-100/70 p-4 flex items-center justify-center overflow-hidden border border-slate-100 shadow-inner">
        <Link
          to="/urun/$id"
          params={{ id: current.id }}
          className="flex h-full w-full items-center justify-center transition-transform hover:scale-105"
        >
          <img
            key={current.id}
            src={getPublicProductImageUrl(current.image_url, current.name, current.category)}
            alt={current.name}
            onError={(e) => handleProductImageError(e, current.name, current.category)}
            className="h-full w-full object-contain drop-shadow-md transition-all duration-300 animate-in fade-in zoom-in-95"
          />
        </Link>

        {/* Left Arrow Button */}
        {slides.length > 1 && (
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Önceki ürün"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/90 text-white shadow-lg transition-transform hover:bg-black active:scale-90 z-10 cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}

        {/* Right Arrow Button */}
        {slides.length > 1 && (
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Sonraki ürün"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/90 text-white shadow-lg transition-transform hover:bg-black active:scale-90 z-10 cursor-pointer"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Product Details matching Mockup */}
      <div className="mt-4 flex flex-col">
        {/* Category kicker in uppercase */}
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-700">
            {categoryLabel(current.category)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 border border-slate-200/60">
            {index + 1} / {slides.length}
          </span>
        </div>

        {/* Title */}
        <Link to="/urun/$id" params={{ id: current.id }}>
          <h2
            key={`title-${current.id}`}
            className="mt-1 line-clamp-2 text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-950 hover:text-[#166534] transition-colors leading-tight animate-in fade-in"
          >
            {current.name}
          </h2>
        </Link>

        {/* Package / Unit and Quick Add Row */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-base sm:text-lg font-bold text-slate-800">{current.unit}</p>

          <button
            type="button"
            onClick={handleQuickAdd}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
              justAdded
                ? "bg-emerald-600 text-white scale-105"
                : "bg-[#166534] hover:bg-[#14532d] text-white"
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Eklendi!
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                Hemen Ekle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Grid Product Card Component for the lower catalog section
 * Here, quantity stepper and Add to Cart buttons are fully accessible
 */
function CatalogProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    add({ productId: product.id, name: product.name, unit: product.unit }, qty);
    setAdded(true);
    toast.success(`${qty} ${product.unit} ${product.name} sepete eklendi`);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-3 sm:p-4 text-slate-900 shadow-md hover:shadow-xl transition-all duration-200 border border-slate-100">
      <div>
        <Link
          to="/urun/$id"
          params={{ id: product.id }}
          className="block aspect-square w-full overflow-hidden rounded-xl bg-neutral-50 p-2 relative"
        >
          <img
            src={getPublicProductImageUrl(product.image_url, product.name, product.category)}
            alt={product.name}
            loading="lazy"
            onError={(e) => handleProductImageError(e, product.name, product.category)}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        <div className="mt-3 flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#166534]">
            {categoryLabel(product.category)}
          </span>
          <Link to="/urun/$id" params={{ id: product.id }}>
            <h3 className="mt-0.5 line-clamp-2 text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#166534] transition-colors leading-snug">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 text-xs text-slate-500 font-medium">Birim: {product.unit}</p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {/* Quantity selector */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="flex h-7 w-6 items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-25 cursor-pointer"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-5 text-center text-xs font-bold tabular-nums text-slate-800">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="flex h-7 w-6 items-center justify-center rounded text-slate-600 hover:bg-white cursor-pointer"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            type="button"
            onClick={handleAdd}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer ${
              added ? "bg-[#14532d]" : "bg-[#166534] hover:bg-[#14532d] shadow-sm"
            }`}
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{added ? "Eklendi" : "Ekle"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
