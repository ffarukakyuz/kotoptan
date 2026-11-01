import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useDeferredValue, memo, useCallback } from "react";
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
  ShoppingCart,
  Loader2,
  Package,
  Boxes,
  ShieldCheck,
  Pencil,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BRAND_LOGO_SRC } from "@/lib/branding";
import {
  categoryLabel,
  type Product,
  isProductInStock,
  cleanProductDescription,
  extractPackageOrBoxInfo,
  setProductStockStatusLocal,
  normalizeProductWithOverrides,
  formatUnitLabel,
} from "@/lib/catalog";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  AllCategoryIcon,
  TemizlikCategoryIcon,
  GidaCategoryIcon,
  BakliyatCategoryIcon,
  KisiselCategoryIcon,
} from "@/components/CategoryIcons";
import { getAllCatalogProducts, isProductPermanentlyDeleted } from "@/lib/custom-products";
import { FALLBACK_PRODUCTS } from "@/data/products";
import { SadWatermark } from "@/components/SadWatermark";
import { shouldDisplaySadWatermark } from "@/lib/sad-watermark";

async function fetchProductsFromDatabase(): Promise<Product[]> {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const items = (await res.json()) as Product[];
      if (Array.isArray(items) && items.length > 0) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("custom_added_products", JSON.stringify(items));
          } catch {
            // ignore
          }
        }
        return items;
      }
    }
  } catch (err) {
    console.warn("[index.tsx] /api/products fetch notice:", err);
  }

  return typeof window === "undefined" ? FALLBACK_PRODUCTS : getAllCatalogProducts();
}

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda ve Market Dağıtımı" },
      {
        name: "description",
        content:
          "Ko Toptan (Kotoptan / KasımOğulları Ltd. Şti.) — Bitlis, Tatvan ve çevre ilçelerdeki bakkal ve marketlere toptan gıda, bakliyat, un, yağ, salça ve temizlik ürünleri dağıtımı. Hızlı sevkiyat ve güvenilir toptan sipariş platformu.",
      },
      {
        name: "keywords",
        content:
          "ko toptan, kotoptan, ko toptan gıda, ko toptan market, tatvan toptan, bitlis toptan, kasımoğulları toptan, kasım oğulları gıda, toptan gıda, toptan bakliyat, toptan temizlik, bitlis toptancı, tatvan toptancı, toptan market ürünleri",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ko Toptan" },
      { property: "og:url", content: "https://kotoptan.pages.dev" },
      {
        property: "og:title",
        content: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda ve Market Dağıtımı",
      },
      {
        property: "og:description",
        content:
          "Ko Toptan — Bitlis, Tatvan, Ahlat, Adilcevaz, Güroymak ve Hizan marketlerine toptan gıda, bakliyat ve temizlik ürünleri doğrudan depo teslimatı.",
      },
      {
        property: "og:image",
        content: "https://kotoptan.pages.dev/kotoptan-official-logo.png?v=20261021-user-k-cube",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda Dağıtımı",
      },
      {
        name: "twitter:description",
        content:
          "Ko Toptan — Bitlis ve Tatvan merkezli bakkal ve marketlere toptan gıda, bakliyat ve temizlik ürünleri dağıtımı.",
      },
      {
        name: "twitter:image",
        content: "https://kotoptan.pages.dev/kotoptan-official-logo.png?v=20261021-user-k-cube",
      },
    ],
  }),
  component: IndexPage,
});

const CIRCULAR_CATEGORIES = [
  { value: "tumu", label: "Tümü", Icon: AllCategoryIcon },
  { value: "gida", label: "Gıda", Icon: GidaCategoryIcon },
  { value: "bakliyat", label: "Bakliyat", Icon: BakliyatCategoryIcon },
  { value: "temizlik", label: "Temizlik", Icon: TemizlikCategoryIcon },
  { value: "kisisel", label: "Kişisel Bakım", Icon: KisiselCategoryIcon },
] as const;

function IndexPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { isAdmin } = useAuth();
  const [category, setCategory] = useState<string>("tumu");
  const [search, setSearch] = useState("");
  const [stockTick, setStockTick] = useState(0);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    const handleStockChange = () => setStockTick((t) => t + 1);
    const handleCatalogUpdate = () => {
      setStockTick((t) => t + 1);
      fetchProductsFromDatabase().then((items) => setClientProducts(items));
    };
    window.addEventListener("product_stock_status_changed", handleStockChange);
    window.addEventListener("catalog_updated", handleCatalogUpdate);
    window.addEventListener("sad_watermark_changed", handleCatalogUpdate);
    return () => {
      window.removeEventListener("product_stock_status_changed", handleStockChange);
      window.removeEventListener("catalog_updated", handleCatalogUpdate);
      window.removeEventListener("sad_watermark_changed", handleCatalogUpdate);
    };
  }, [isMounted]);

  const { data: dbProducts, isLoading: isQueryLoading } = useQuery({
    queryKey: ["live-d1-products"],
    queryFn: fetchProductsFromDatabase,
    initialData: () =>
      typeof window === "undefined" ? FALLBACK_PRODUCTS : getAllCatalogProducts(),
    staleTime: 0,
    refetchOnMount: true,
  });

  const [clientProducts, setClientProducts] = useState<Product[]>(() =>
    typeof window === "undefined" ? FALLBACK_PRODUCTS : getAllCatalogProducts(),
  );
  const [isClientLoading, setIsClientLoading] = useState(false);

  useEffect(() => {
    if (!isMounted) return;
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
  }, [isMounted]);

  const allProducts = useMemo(() => {
    void stockTick;
    const base =
      Array.isArray(clientProducts) && clientProducts.length > 0
        ? clientProducts
        : Array.isArray(dbProducts) && dbProducts.length > 0
          ? dbProducts
          : typeof window === "undefined"
            ? FALLBACK_PRODUCTS
            : getAllCatalogProducts();

    return (Array.isArray(base) ? base : [])
      .filter((p) => p && p.name && !isProductPermanentlyDeleted(p.id, p.name))
      .map(normalizeProductWithOverrides)
      .filter((p) => p && p.is_active !== false);
  }, [clientProducts, dbProducts, stockTick]);

  const isLoading = (isQueryLoading || isClientLoading) && allProducts.length === 0;

  const deferredSearch = useDeferredValue(search);

  const filteredProducts = useMemo(() => {
    const q = (deferredSearch || "").trim().toLocaleLowerCase("tr");
    return (allProducts || []).filter(
      (p) =>
        p &&
        (category === "tumu" || p.category === category) &&
        (q === "" || (p.name || "").toLocaleLowerCase("tr").includes(q)),
    );
  }, [allProducts, category, deferredSearch]);

  const scrollToCatalog = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("urunler");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // İstemci tarafında tam olarak yüklenene kadar sunucu/istemci uyuşmazlığını (Hydration Mismatch) önlemek için render engellenir
  if (!isMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050806] text-white relative overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sayfa zemin hayalet filigran */}
      <div aria-hidden="true" className="watermark-overlay" />

      {/* HERO SECTION: DEEP FOREST OBSIDIAN WITH EMERALD ACCENTS */}
      <section className="relative overflow-hidden px-4 pt-6 pb-14 sm:pt-8 sm:pb-20 bg-gradient-to-b from-[#09150d] via-[#050806] to-[#040705] border-b border-white/5">
        {/* Ambient atmospheric glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-emerald-600/10 blur-[130px]"
        />

        <div className="relative mx-auto max-w-4xl">
          {/* Hero Featured Showcase Card (Sleek Dark Theme) */}
          <div className="mt-2 sm:mt-4">
            <HeroProductCard
              products={allProducts}
              selectedCategory={category}
              loading={isLoading}
            />
          </div>

          {/* Hero Copy & Call To Action */}
          <div className="mt-8 text-center sm:mt-10">
            {/* Marka Vitrin Logosu */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center group select-none">
              <div className="absolute -inset-2 rounded-3xl bg-emerald-500/20 blur-lg pointer-events-none transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-full w-full items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/40 bg-[#060e09] transition-transform duration-300 group-hover:scale-105">
                <img
                  src={BRAND_LOGO_SRC}
                  alt="Kotoptan Logo"
                  className="h-full w-full object-cover select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Toptan & Doğrudan Depo Teslimatı
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight max-w-2xl mx-auto text-balance">
              Her ürünü ambalajına göre sipariş verin.
            </h1>

            {/* Ambalaj / Birim Bilgilendirme Çubuğu */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-2xl mx-auto text-xs sm:text-sm">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-950/30 px-3 py-1.5 text-slate-200">
                <span className="text-purple-400 font-extrabold">🧴 Paket</span>
                <span className="text-slate-400">bazlılar paketle,</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-slate-200">
                <span className="text-rose-400 font-extrabold">📦 Koli</span>
                <span className="text-slate-400">bazlılar koliyle,</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-slate-200">
                <span className="text-emerald-400 font-extrabold">🌾 Çuval</span>
                <span className="text-slate-400">bazlılar çuvalla,</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-950/30 px-3 py-1.5 text-slate-200">
                <span className="text-blue-400 font-extrabold">🏷️ Adet</span>
                <span className="text-slate-400">adetli ürünler</span>
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              İhtiyacınız olan toptan miktarı belirleyin, sepetinizi oluşturup market teslimatınızı
              başlatın.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg shadow-emerald-950/60 transition-all active:scale-95 cursor-pointer"
              >
                Ürünleri İncele
              </button>
              {isAdmin ? (
                <Link
                  to="/yonetim"
                  className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-950/50 hover:bg-emerald-900/60 px-6 py-3.5 text-sm sm:text-base font-bold text-emerald-300 transition-all active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Yönetim</span>
                </Link>
              ) : (
                <Link
                  to="/sepet"
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-sm sm:text-base font-semibold text-white transition-all active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Sepetim</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG GRID SECTION */}
      <section id="urunler" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Circular Category Navigation (Symmetric & Sized for Mobile & Desktop) */}
        <div className="mb-8 flex items-center justify-between sm:justify-center gap-1.5 sm:gap-6 md:gap-8 py-2 px-1 w-full overflow-x-auto no-scrollbar">
          {CIRCULAR_CATEGORIES.map(({ value, label, Icon }) => {
            const isActive = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className="group flex flex-1 sm:flex-initial flex-col items-center focus:outline-none cursor-pointer min-w-0 max-w-[72px] sm:max-w-none shrink-0"
              >
                <div
                  className={`flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-105 active:scale-95 shrink-0 ${
                    isActive
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#050806]"
                      : "bg-[#0f1b13] text-zinc-300 hover:text-white border border-white/10 hover:border-emerald-500/40"
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 sm:h-8 sm:w-8 transition-transform group-hover:scale-110 ${
                      isActive ? "text-black" : "text-zinc-300 group-hover:text-white"
                    }`}
                  />
                </div>
                <span
                  className={`mt-2 text-[11px] sm:text-xs md:text-sm font-semibold tracking-tight transition-colors text-center truncate max-w-full ${
                    isActive
                      ? "text-emerald-400 font-bold"
                      : "text-zinc-400 group-hover:text-zinc-200"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Header (Milimetric Alignment) */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>
                {category === "tumu" ? "Tüm Ürünler" : `${categoryLabel(category)} Ürünleri`}
              </span>
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-zinc-400 tabular-nums">
              {isLoading
                ? "Katalog verileri yükleniyor..."
                : `${filteredProducts.length} adet toptan ürün listeleniyor`}
            </p>
          </div>

          {/* Symmetrical Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı veya barkod ara..."
              className="h-11 w-full rounded-xl border-white/15 bg-[#0b140e] pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              maxLength={80}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Aramayı temizle"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Product Grid (Uniform, Symmetrical Heights) */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0b140e] p-3.5 animate-pulse"
              >
                <div>
                  <div className="aspect-square w-full rounded-xl bg-white/5 mb-3" />
                  <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                  <div className="h-4 w-3/4 rounded bg-white/10 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-white/5" />
                </div>
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="h-8 w-full rounded-lg bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="my-14 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0b140e] p-8 text-center text-zinc-400">
            <PackageSearch className="h-12 w-12 text-emerald-500 mb-3" />
            <p className="text-lg font-bold text-white">
              {allProducts.length === 0 ? "Katalog Yüklenemedi" : "Ürün Bulunamadı"}
            </p>
            <p className="mt-1 text-sm max-w-sm text-zinc-400">
              {allProducts.length === 0
                ? "Canlı ERP 12 veya veritabanı ürünleri alınamadı. Lütfen bağlantıyı kontrol edin."
                : search
                  ? `"${search}" aramasına uygun ürün bulunamadı. Lütfen farklı bir arama deneyin.`
                  : "Bu kategoride henüz ürün listelenmiyor."}
            </p>
            {allProducts.length === 0 ? (
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-lg flex items-center gap-1.5"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Kataloğu Yenile</span>
              </button>
            ) : search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                Aramayı Temizle
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((p) => (
              <CatalogProductCard key={`${p.id}-${isProductInStock(p)}`} product={p} />
            ))}
          </div>
        )}

        {/* Corporate Trust & Delivery Info Footer */}
        <footer className="mt-14 pt-8 border-t border-white/10 text-zinc-400">
          <div className="rounded-2xl border border-white/10 bg-[#09120c] p-5 sm:p-7 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Ko Toptan — Bitlis & Tatvan Toptan Gıda ve Market Dağıtımı
                </h2>
                <p className="text-xs sm:text-sm text-emerald-400 font-bold mt-0.5">
                  KasımOğulları Gıda ve Tüketim Malları Dağıtım Merkezi
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 font-semibold">
                  Gıda & Temizlik & Bakliyat
                </span>
                <span className="rounded-lg bg-white/5 border border-white/10 text-zinc-300 px-2.5 py-1 font-semibold">
                  Depodan Kapıya Teslimat
                </span>
                <span className="rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 font-semibold">
                  Bitlis 7 İlçe Rotalı
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
              <div>
                <h3 className="font-semibold text-white text-sm mb-2">Ko Toptan Hakkında</h3>
                <p>
                  Ko Toptan (Kotoptan), Bitlis, Tatvan ve çevre ilçelerdeki bakkal, market ve
                  süpermarketlere toptan bakliyat, temizlik, gıda, kişisel bakım ve tüketim malları
                  tedarik eden ana toptan satış platformudur.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white text-sm mb-2">Hizmet Verilen İlçeler</h3>
                <p>
                  Kendi sevkiyat araç filomuzla haftalık düzenli rotalarımız:{" "}
                  <strong className="text-white">Tatvan</strong>,{" "}
                  <strong className="text-white">Bitlis Merkez</strong>,{" "}
                  <strong className="text-white">Ahlat</strong>,{" "}
                  <strong className="text-white">Adilcevaz</strong>,{" "}
                  <strong className="text-white">Güroymak</strong>,{" "}
                  <strong className="text-white">Hizan</strong> ve{" "}
                  <strong className="text-white">Mutki</strong>.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white text-sm mb-2">Depo & Sipariş İletişim</h3>
                <p className="space-y-1">
                  <span>📍 Aydınlar Mahallesi, İstiklal Caddesi, Tatvan / Bitlis</span>
                  <br />
                  <span>
                    📞 <strong className="text-white">Sipariş Hattı:</strong> 0544 893 13 00
                  </span>
                  <br />
                  <span>
                    ⏰ <strong className="text-white">Çalışma Saatleri:</strong> Pazartesi -
                    Cumartesi 07:30 - 19:00
                  </span>
                </p>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

/**
 * Featured Hero Product Showcase Card (Sleek Dark Obsidian & Emerald)
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
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [justAdded, setJustAdded] = useState(false);
  const [togglingHeroStock, setTogglingHeroStock] = useState(false);

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

  useEffect(() => {
    setIndex(0);
    setTick((t) => t + 1);
  }, [selectedCategory]);

  // 3 saniyede bir otomatik geçiş
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

  if (loading || slides.length === 0) {
    return (
      <div className="mx-auto max-w-[340px] sm:max-w-[400px] w-full rounded-3xl bg-[#0b140e] p-5 sm:p-6 text-white shadow-2xl border border-white/10 animate-pulse">
        <div className="aspect-square w-full rounded-2xl bg-white/5 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin opacity-40" />
        </div>
        <div className="mt-4 flex flex-col items-center">
          <div className="h-3 w-20 rounded bg-white/10 mb-2" />
          <div className="h-5 w-48 rounded-md bg-white/10 mb-2" />
          <div className="h-4 w-24 rounded bg-white/5 mb-4" />
          <div className="h-11 w-full rounded-xl bg-white/10" />
        </div>
      </div>
    );
  }

  const current = slides[index] ?? slides[0]!;
  const inStock = isProductInStock(current);
  const boxInfo = extractPackageOrBoxInfo(
    current.description,
    current.unit,
    current.name,
    current.id,
  );

  const handleToggleHeroStock = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = !inStock;
    setTogglingHeroStock(true);
    setProductStockStatusLocal(current.id, newStatus);

    const baseDesc = cleanProductDescription(current.description);
    const newDescription = newStatus ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    qc.setQueryData<Product[]>(["live-d1-products"], (old) => {
      if (!old) return old;
      return old.map((p) => (p.id === current.id ? { ...p, description: newDescription } : p));
    });

    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, description: newDescription }),
      });
    } catch (err) {
      console.warn("Product stock update error:", err);
    }

    toast.success(
      newStatus
        ? `"${current.name}" stokta olarak işaretlendi.`
        : `"${current.name}" stokta yok olarak işaretlendi.`,
    );
    setTogglingHeroStock(false);
    void qc.invalidateQueries({ queryKey: ["live-d1-products"] });
  };

  const handleQuickAdd = () => {
    if (!inStock) {
      toast.error("Bu ürün şu anda stokta bulunmamaktadır.");
      return;
    }
    add(
      {
        productId: current.id,
        name: current.name,
        unit: current.unit,
        image_url: current.image_url,
      },
      1,
    );
    setJustAdded(true);
    toast.success(`1 ${current.unit} ${current.name} sepete eklendi`);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="relative mx-auto max-w-[340px] sm:max-w-[400px] w-full rounded-3xl bg-[#0b140e] p-5 sm:p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(16,185,129,0.18)] border border-emerald-500/40 transition-all select-none overflow-hidden group">
      {/* Satış Bereket Filigranı */}
      {shouldDisplaySadWatermark(current) && <SadWatermark variant="hero" />}

      {/* 3 Saniyelik Dinamik İlerleme Çubuğu */}
      {isPlaying && slides.length > 1 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-20">
          <div
            key={tick}
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 w-full"
            style={{
              animation: "heroProgress 3000ms linear forwards",
            }}
          />
        </div>
      )}

      {/* Üst Canlı Vitrin ve Oynat/Durdur Çubuğu */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="tracking-wide">CANLI VİTRİN • 3 SN</span>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300 transition-colors cursor-pointer"
          title={isPlaying ? "Durdur" : "Otomatik Başlat"}
        >
          {isPlaying ? (
            <>
              <Pause className="h-3 w-3 fill-zinc-300" />
              <span>Durdur</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-zinc-300" />
              <span>3sn Başlat</span>
            </>
          )}
        </button>
      </div>

      {/* Ürün Görsel Alanı - Oval Hatlar, Yumuşatılmış Kenarlar ve Kenar Blur Efekti */}
      <div className="relative aspect-square w-full rounded-3xl bg-gradient-to-b from-[#14261a]/95 via-[#0e1b12]/95 to-[#09120c]/95 p-4 sm:p-5 flex items-center justify-center overflow-hidden border border-emerald-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Sol Üst Ambalaj Rozeti */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1 pointer-events-none">
          {boxInfo && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border shadow-sm flex items-center gap-1.5 backdrop-blur-md ${
                (boxInfo || "").toLowerCase().startsWith("paket")
                  ? "text-purple-300 bg-purple-950/90 border-purple-500/40"
                  : "text-rose-300 bg-rose-950/90 border-rose-500/40"
              }`}
            >
              {(boxInfo || "").toLowerCase().startsWith("paket") ? (
                <Package className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              ) : (
                <Boxes className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              )}
              <span>{boxInfo}</span>
            </span>
          )}
          {(current.unit || "").toLowerCase() === "adet" && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-950/90 text-blue-300 shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span>Adet</span>
            </span>
          )}
          {!boxInfo && (current.unit || "").toLowerCase() !== "adet" && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg border border-white/20 bg-black/80 text-zinc-200 shadow-sm flex items-center gap-1.5 backdrop-blur-md">
              <span>{formatUnitLabel(current.unit)}</span>
            </span>
          )}
        </div>

        {/* Yumuşak Yeşil Studio Işık Halosu */}
        <div className="pointer-events-none absolute inset-6 rounded-full bg-emerald-500/15 blur-2xl select-none" />
        <div className="pointer-events-none absolute inset-10 rounded-full bg-white/5 blur-xl select-none" />

        <Link
          to="/urun/$id"
          params={{ id: current.id }}
          className="relative z-0 flex h-full w-full items-center justify-center transition-transform hover:scale-[1.02] group/img p-2.5"
        >
          {/* Dışa doğru çok az taşan beyaz yumuşak blur aurası (Arka katman) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-2.5 rounded-3xl bg-white/40 blur-md select-none transition-opacity duration-300 group-hover/img:bg-white/55"
          />

          {/* Ovalleştirilmiş Beyaz Kaide (Dışa doğru beyaz blur gölgesi yayar, ürün üstüne blur gelmez) */}
          <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-white p-3.5 product-outer-white-blur-hero">
            <img
              key={current.id}
              src={getPublicProductImageUrl(current, current.name, current.category)}
              alt={current.name}
              onError={(e) => handleProductImageError(e, current.name, current.category)}
              className={`h-full w-full object-contain transition-transform duration-300 product-image-crisp ${
                !inStock ? "opacity-60 grayscale-[40%]" : "group-hover/img:scale-105"
              }`}
            />
          </div>
        </Link>

        {/* Carousel Sol/Sağ Butonları */}
        {slides.length > 1 && (
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Önceki ürün"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/80 text-white shadow-lg border border-white/20 transition-all hover:bg-black hover:scale-105 active:scale-95 z-10 cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}

        {slides.length > 1 && (
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Sonraki ürün"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/80 text-white shadow-lg border border-white/20 transition-all hover:bg-black hover:scale-105 active:scale-95 z-10 cursor-pointer"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Ürün Detay & Başlık */}
      <div className="mt-4 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            <span className="text-emerald-400">{categoryLabel(current.category)}</span>
            <span className="text-zinc-600">•</span>
            <span
              className={`text-[11px] font-semibold ${
                inStock ? "text-emerald-400" : "text-rose-400 font-bold"
              }`}
            >
              {inStock ? "Stokta Var" : "Stokta Yok"}
            </span>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-300 border border-white/10">
            {index + 1} / {slides.length}
          </span>
        </div>

        <Link to="/urun/$id" params={{ id: current.id }}>
          <h2
            key={`title-${current.id}`}
            className="mt-1.5 line-clamp-2 text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-emerald-400 transition-colors leading-snug"
          >
            {current.name}
          </h2>
        </Link>

        {/* Ambalaj & Hızlı Aksiyon Satırı */}
        <div className="mt-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col">
            <p className="text-sm sm:text-base font-semibold text-zinc-300">
              Birim:{" "}
              {(current.unit || "").toLowerCase() === "adet" ? (
                <span className="text-blue-400 font-bold">Adet</span>
              ) : (
                <span className="text-white font-bold">{formatUnitLabel(current.unit)}</span>
              )}
            </p>
            {boxInfo && (
              <span
                className={`text-xs font-bold flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg border ${
                  (boxInfo || "").toLowerCase().startsWith("paket")
                    ? "text-purple-300 bg-purple-950/60 border-purple-500/40"
                    : "text-rose-300 bg-rose-950/60 border-rose-500/40"
                }`}
              >
                {(boxInfo || "").toLowerCase().startsWith("paket") ? (
                  <Package className="h-3 w-3 text-purple-400 shrink-0" />
                ) : (
                  <Boxes className="h-3 w-3 text-rose-400 shrink-0" />
                )}
                <span>{boxInfo}</span>
              </span>
            )}
          </div>

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={togglingHeroStock}
                onClick={handleToggleHeroStock}
                aria-label={inStock ? "Stokta Var (Stokta Yok Yap)" : "Stokta Yok (Stokta Var Yap)"}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all border shadow-sm active:scale-95 cursor-pointer ${
                  inStock
                    ? "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/40"
                }`}
                title={
                  inStock ? "Stokta Var (Tıklayarak değiştir)" : "Stokta Yok (Tıklayarak değiştir)"
                }
              >
                {togglingHeroStock ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : inStock ? (
                  <Check className="h-5 w-5 stroke-[2.8] text-emerald-400" />
                ) : (
                  <X className="h-5 w-5 stroke-[2.8] text-rose-400" />
                )}
              </button>

              <Link
                to="/yonetim"
                search={{ tab: "products", edit: current.id }}
                aria-label="Ürünü Düzenle"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95 cursor-pointer"
                title="Ürün bilgilerini düzenle"
              >
                <Pencil className="h-5 w-5 stroke-[2.2]" />
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={!inStock}
              onClick={handleQuickAdd}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                !inStock
                  ? "bg-white/10 text-zinc-500 cursor-not-allowed opacity-60"
                  : justAdded
                    ? "bg-emerald-500 text-black font-extrabold scale-105"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {!inStock ? (
                <>
                  <X className="h-4 w-4 text-rose-400 stroke-[2.5]" />
                  <span>Stokta Yok</span>
                </>
              ) : justAdded ? (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Eklendi</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  <span>Hemen Ekle</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Symmetrical Dark-Mode Grid Product Card Component
 * Guaranteed identical row heights, clean alignments, and active button feedback
 */
const CatalogProductCard = memo(function CatalogProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [togglingStock, setTogglingStock] = useState(false);
  const inStock = isProductInStock(product);
  const boxInfo = extractPackageOrBoxInfo(
    product.description,
    product.unit,
    product.name,
    product.id,
  );

  const handleToggleStock = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus = !inStock;
    setTogglingStock(true);
    setProductStockStatusLocal(product.id, newStatus);

    const baseDesc = cleanProductDescription(product.description);
    const newDescription = newStatus ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

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
    void qc.invalidateQueries({ queryKey: ["live-d1-products"] });
  };

  const handleAdd = () => {
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
    setAdded(true);
    toast.success(`${qty} ${product.unit} ${product.name} sepete eklendi`);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0b140e] hover:bg-[#0e1a12] p-3 sm:p-4 text-white shadow-lg hover:shadow-2xl transition-all duration-200 border border-emerald-950/80 hover:border-emerald-500/40 relative">
      <div className="relative z-10 flex flex-col flex-1">
        {/* Üst Bereket Filigranı */}
        {shouldDisplaySadWatermark(product) && <SadWatermark variant="strip" />}

        <Link
          to="/urun/$id"
          params={{ id: product.id }}
          className="group/card-img block aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#14261a]/90 via-[#0e1b12]/90 to-[#09120c]/90 p-2.5 relative border border-emerald-500/20 shadow-inner"
        >
          {/* Arka plan hafif ışıltı */}
          <div className="pointer-events-none absolute inset-4 rounded-full bg-emerald-500/10 blur-xl select-none" />

          <div className="relative flex h-full w-full items-center justify-center p-1.5">
            {/* Dışa doğru çok az taşan beyaz yumuşak blur */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-1.5 rounded-2xl bg-white/35 blur-sm select-none transition-opacity duration-200 group-hover/card-img:bg-white/50"
            />

            {/* Ovalleştirilmiş Beyaz Kaide (Dışa beyaz blur yayar, ürün üstüne blur gelmez) */}
            <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-white p-2 product-outer-white-blur-grid">
              <img
                src={getPublicProductImageUrl(product, product.name, product.category)}
                alt={product.name}
                loading="lazy"
                onError={(e) => handleProductImageError(e, product.name, product.category)}
                className={`h-full w-full object-contain transition-transform duration-300 product-image-crisp ${
                  !inStock ? "opacity-50 grayscale-[50%]" : "group-hover/card-img:scale-105"
                }`}
              />
            </div>
          </div>
        </Link>

        {/* Metin & Başlık Alanı (Milimetrik Boyut Sabitleme) */}
        <div className="mt-3 flex flex-col flex-1 justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {categoryLabel(product.category)}
              </span>
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  inStock ? "text-emerald-400" : "text-rose-400 font-bold"
                }`}
              >
                {inStock ? "● Stokta" : "● Tükendi"}
              </span>
            </div>

            <Link to="/urun/$id" params={{ id: product.id }}>
              <h3 className="mt-1 min-h-[2.5rem] sm:min-h-[2.75rem] line-clamp-2 text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                {product.name}
              </h3>
            </Link>
          </div>

          <div className="mt-1 min-h-[1.5rem] flex items-center justify-between gap-1 flex-wrap">
            <p className="text-[11px] text-zinc-400 font-medium">
              Birim:{" "}
              {(product.unit || "").toLowerCase() === "adet" ? (
                <span className="text-blue-400 font-bold">Adet</span>
              ) : (
                <span className="text-zinc-200 font-semibold">{formatUnitLabel(product.unit)}</span>
              )}
            </p>
            {boxInfo && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1 border ${
                  (boxInfo || "").toLowerCase().startsWith("paket")
                    ? "text-purple-300 bg-purple-950/60 border-purple-500/30"
                    : "text-rose-300 bg-rose-950/60 border-rose-500/30"
                }`}
              >
                {boxInfo}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Aksiyon Satırı (Milimetrik Hizalı ve Kararlı) */}
      <div className="mt-3 pt-2.5 border-t border-white/10">
        {isAdmin ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              disabled={togglingStock}
              onClick={handleToggleStock}
              aria-label={inStock ? "Stokta Var (Stokta Yok Yap)" : "Stokta Yok (Stokta Var Yap)"}
              className={`flex-1 h-9 flex items-center justify-center rounded-xl transition-all border shadow-sm active:scale-95 cursor-pointer ${
                inStock
                  ? "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40"
                  : "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/40"
              }`}
              title={
                inStock
                  ? "Stok durumu: Stokta Var (Tıkla değiştir)"
                  : "Stok durumu: Stokta Yok (Tıkla değiştir)"
              }
            >
              {togglingStock ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : inStock ? (
                <Check className="h-5 w-5 stroke-[2.8] text-emerald-400 shrink-0" />
              ) : (
                <X className="h-5 w-5 stroke-[2.8] text-rose-400 shrink-0" />
              )}
            </button>

            <Link
              to="/yonetim"
              search={{ tab: "products", edit: product.id }}
              aria-label="Ürünü Düzenle"
              className="flex-1 h-9 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 text-center cursor-pointer"
              title="Ürün bilgilerini düzenle"
            >
              <Pencil className="h-4 w-4 stroke-[2.2] shrink-0" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* Quantity Stepper */}
            <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={!inStock || qty <= 1}
                aria-label="Miktarı azalt"
                className="flex h-7 w-6 items-center justify-center rounded text-zinc-300 hover:bg-white/10 disabled:opacity-20 cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-xs font-bold tabular-nums text-white">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                disabled={!inStock}
                aria-label="Miktarı artır"
                className="flex h-7 w-6 items-center justify-center rounded text-zinc-300 hover:bg-white/10 disabled:opacity-20 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Add to Cart button */}
            <button
              type="button"
              disabled={!inStock}
              onClick={handleAdd}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                !inStock
                  ? "bg-white/10 text-zinc-500 cursor-not-allowed opacity-60"
                  : added
                    ? "bg-emerald-500 text-black font-extrabold"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              }`}
            >
              {!inStock ? (
                <X className="h-4 w-4 stroke-[2.5] text-rose-400" />
              ) : added ? (
                <>
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Eklendi</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ekle</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
