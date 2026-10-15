import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Minus,
  Upload,
  ImageIcon,
  CheckCircle2,
  XCircle,
  Archive,
  ArchiveRestore,
  KeyRound,
  ShieldCheck,
  Shield,
  Users,
  Search,
  RefreshCw,
  UserCheck,
  Cloud,
  PackageSearch,
  Loader2,
  Boxes,
  Package,
  MessageSquare,
  MapPin,
  Navigation,
  X,
  Camera,
  ImagePlus,
  Eraser,
  Link2,
  GitBranch,
  CloudLightning,
  Milestone,
  Clock,
  Route as RouteIcon,
  Truck,
  PauseCircle,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { AdminUnlockCard } from "@/components/AdminUnlockCard";

import { GitHubCloudflareSyncPanel } from "@/components/GitHubCloudflareSyncPanel";
import { GoogleDriveSyncPanel } from "@/components/GoogleDriveSyncPanel";
import { AdminChatPanel } from "@/components/AdminChatPanel";
import { listAdminChatSessions } from "@/lib/chat-service";
import type { DriveOrder } from "@/lib/google-drive";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { FALLBACK_PRODUCTS } from "@/data/products";
import { useAuth } from "@/hooks/useAuth";
import {
  getCustomProducts,
  saveCustomProduct,
  deleteCustomProduct,
  isBogusProductName,
  isBannedProductName,
  isProductPermanentlyDeleted,
  getAllCatalogProducts,
  markProductPermanentlyDeleted,
  batchMarkProductsPermanentlyDeleted,
} from "@/lib/custom-products";
import {
  mergeOrdersWithLocal,
  applyOrderPatch,
  permanentlyDeleteOrder,
  purgeAllTestOrders,
  isArchivedOrder as isArchivedOrderStorage,
} from "@/lib/order-storage";
import { analyzeProductPhoto } from "@/lib/gemini";
import { ADMIN_MEMBERS, isUserAdmin, GUEST_ACCOUNT } from "@/lib/admin-config";
import {
  getStoredLocalUsers,
  getAllRegisteredUsers,
  deleteLocalUser,
  isUserDeleted,
  markUserAsDeleted,
} from "@/data/users";
import {
  deleteAppUser,
  listAppUsers,
  resetAppUserPassword,
  updateAppUser,
  type AppUser,
} from "@/lib/admin-users.functions";
import {
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  UNITS,
  categoryLabel,
  statusLabel,
  DISTRICTS,
  districtLabel,
  ADMIN_DISTRICT_FILTERS,
  matchesDistrictFilter,
  type Product,
  isProductInStock,
  setProductStockStatusLocal,
  cleanProductDescription,
  extractPackageOrBoxInfo,
  normalizeProductWithOverrides,
  setProductArchivedStatusLocal,
  isProductArchived,
} from "@/lib/catalog";
import {
  extractCoordinates,
  getOSMNavigationUrl,
  BITLIS_CENTER_COORDS,
  BITLIS_DISTRICT_COORDS,
} from "@/lib/location-utils";
import {
  AdminDistrictRouteMap,
  calculateDistanceKm,
  computeOptimizedStops,
  type RouteOrderStop,
} from "@/components/AdminDistrictRouteMap";
import { seedAllDistrictTestOrders } from "@/lib/district-sample-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const adminSearchSchema = z
  .object({
    tab: z.string().optional(),
    edit: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/yonetim")({
  validateSearch: (search: Record<string, unknown>) => {
    try {
      return adminSearchSchema.parse(search);
    } catch {
      return {};
    }
  },
  head: () => ({
    meta: [
      { title: "Yönetim Paneli — Kotoptan" },
      { name: "description", content: "Ürünleri yönetin ve gelen siparişleri görüntüleyin." },
      { property: "og:title", content: "Yönetim Paneli — Kotoptan" },
      { property: "og:description", content: "Ürün ve sipariş yönetimi." },
    ],
  }),
  component: AdminPage,
});

const productSchema = z.object({
  name: z.string().trim().min(2, "Ürün adı gerekli").max(120),
  description: z.string().trim().max(500),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1, "Birim gerekli").max(30),
  image_url: z.string().trim().max(400000),
  is_active: z.boolean(),
});

const emptyProduct = {
  name: "",
  description: "",
  category: "gida",
  unit: "adet",
  image_url: "",
  is_active: true,
};

type AdminOrderItem = { id: string; product_name: string; unit: string; quantity: number };

type AdminOrder = {
  id: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  full_name: string;
  business_name: string;
  district: string;
  phone: string;
  address: string;
  note: string;
  order_items: AdminOrderItem[];
};

async function fetchAdminProductsList(): Promise<Product[]> {
  return getAllCatalogProducts();
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(
    search.edit ? "products" : search.tab === "drive" ? "sync" : (search.tab ?? "orders"),
  );
  const [syncSubTab, setSyncSubTab] = useState<"github" | "cloudflare">("github");

  useEffect(() => {
    const target = search.edit ? "products" : search.tab === "drive" ? "sync" : search.tab;
    if (target) {
      setActiveTab((prev) => (prev !== target ? target : prev));
    }
  }, [search.edit, search.tab]);

  const { data: allOrders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      let remoteOrders: AdminOrder[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, archived_at, status, full_name, business_name, district, phone, address, note, order_items(id, product_name, unit, quantity)",
          )
          .order("created_at", { ascending: false });
        if (!error && data) {
          remoteOrders = data as AdminOrder[];
        }
      } catch (err) {
        console.warn("[Admin] Supabase fetch orders error:", err);
      }

      return mergeOrdersWithLocal<AdminOrder>(remoteOrders, null, true);
    },
  });

  const { data: allProducts = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: fetchAdminProductsList,
    initialData: () => getAllCatalogProducts(),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });

  const { data: chatSessions = [] } = useQuery({
    queryKey: ["admin-chat-sessions"],
    queryFn: listAdminChatSessions,
    refetchInterval: 5000,
  });

  const transferredChatCount = Array.isArray(chatSessions)
    ? chatSessions.filter((s) => s.status === "transferred").length
    : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <AdminUnlockCard
          onSuccess={() => {
            void qc.invalidateQueries();
          }}
          title="Yönetim Paneli Girişi"
          description="Yönetim paneline erişmek için yetkili şifrenizi (veya 123456) girin."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Yönetim paneli</h1>
          <p className="text-sm text-muted-foreground">
            Siparişleri, ürün kataloğunu, GitHub ve Cloudflare senkronizasyonunu yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab("sync");
              setSyncSubTab("github");
            }}
            className="gap-1.5 self-start sm:self-auto border-emerald-600/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
          >
            <GitBranch className="h-4 w-4 text-emerald-600" />
            GitHub Depo Eşitle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab("sync");
              setSyncSubTab("cloudflare");
            }}
            className="gap-1.5 self-start sm:self-auto border-amber-600/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer"
          >
            <CloudLightning className="h-4 w-4 text-amber-500" />
            Cloudflare Eşitle
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto sm:h-10 p-1 bg-muted rounded-xl gap-1">
          <TabsTrigger
            value="orders"
            className="px-1 py-1.5 text-[11px] sm:text-xs md:text-sm font-semibold truncate flex items-center justify-center gap-0.5 sm:gap-1"
          >
            <span>Sipariş</span>
            <span className="hidden sm:inline">ler ({allOrders.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="px-1 py-1.5 text-[11px] sm:text-xs md:text-sm font-semibold truncate flex items-center justify-center gap-0.5 sm:gap-1"
          >
            <span>Ürünler</span>
            <span className="hidden sm:inline"> ({allProducts.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="flex items-center justify-center gap-1 px-1 py-1.5 text-[11px] sm:text-xs md:text-sm font-semibold truncate relative"
            title="Müşteri ile Konuş (Canlı Destek)"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">Müşteri </span>
            <span>Sohbet</span>
            {transferredChatCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground animate-pulse">
                {transferredChatCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="sync"
            className="flex items-center justify-center gap-1 px-1 py-1.5 text-[11px] sm:text-xs md:text-sm font-semibold truncate"
          >
            <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Depo & Sync</span>
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="px-1 py-1.5 text-[11px] sm:text-xs md:text-sm font-semibold truncate flex items-center justify-center"
          >
            Üyeler
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Siparişler Paneli"
            fallbackMessage="Sipariş ve sevkiyat listesi yüklenirken beklenmeyen bir hata oluştu."
          >
            <OrdersPanel onNavigateToDrive={() => setActiveTab("sync")} />
          </GlobalErrorBoundary>
        </TabsContent>
        <TabsContent value="products">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Ürünler Paneli"
            fallbackMessage="Ürün kataloğu paneli yüklenirken beklenmeyen bir hata oluştu."
          >
            <ProductsPanel
              initialEditId={search.edit}
              onNavigateToDrive={() => setActiveTab("sync")}
              initialProducts={allProducts}
              isLoadingProducts={isProductsLoading}
            />
          </GlobalErrorBoundary>
        </TabsContent>
        <TabsContent value="messages">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Müşteri Sohbet Paneli"
            fallbackMessage="Canlı destek paneli yüklenirken bir sorun oluştu."
          >
            <AdminChatPanel onNavigateToOrders={() => setActiveTab("orders")} />
          </GlobalErrorBoundary>
        </TabsContent>
        <TabsContent value="sync">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Senkronizasyon Paneli"
            fallbackMessage="GitHub veya Cloudflare senkronizasyon araçları yüklenirken bir sorun oluştu."
          >
            <GitHubCloudflareSyncPanel
              products={allProducts}
              orders={allOrders}
              defaultSubTab={syncSubTab}
            />
          </GlobalErrorBoundary>
        </TabsContent>
        <TabsContent value="drive">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Depo & Senkronizasyon Paneli"
            fallbackMessage="Depo araçları yüklenirken bir sorun oluştu."
          >
            <GitHubCloudflareSyncPanel
              products={allProducts}
              orders={allOrders}
              defaultSubTab={syncSubTab}
            />
          </GlobalErrorBoundary>
        </TabsContent>
        <TabsContent value="users">
          <GlobalErrorBoundary
            inline={true}
            fallbackTitle="Üye ve Müşteri Paneli"
            fallbackMessage="Kayıtlı üyeler yüklenirken bir sorun oluştu."
          >
            <UsersPanel />
          </GlobalErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const isArchivedOrder = (o: AdminOrder) => isArchivedOrderStorage(o);

const DATE_RANGES = [
  { value: "hepsi", label: "Tüm zamanlar" },
  { value: "bugun", label: "Bugün" },
  { value: "7", label: "Son 7 gün" },
  { value: "30", label: "Son 30 gün" },
] as const;

type DateRange = (typeof DATE_RANGES)[number]["value"];

const inDateRange = (iso: string, range: DateRange) => {
  if (range === "hepsi") return true;
  const d = new Date(iso);
  if (range === "bugun") return d.toDateString() === new Date().toDateString();
  const days = Number(range);
  return d.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
};

const dayKey = (iso: string) => new Date(iso).toDateString();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yesterday.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
};

function OrdersPanel({ onNavigateToDrive }: { onNavigateToDrive?: () => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"aktif" | "arsiv">("aktif");
  const [filter, setFilter] = useState("hepsi");
  const [range, setRange] = useState<DateRange>("hepsi");
  const [district, setDistrict] = useState("hepsi");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      let remoteOrders: AdminOrder[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, archived_at, status, full_name, business_name, district, phone, address, note, order_items(id, product_name, unit, quantity)",
          )
          .order("created_at", { ascending: false });
        if (!error && data) {
          remoteOrders = data as AdminOrder[];
        }
      } catch (err) {
        console.warn("[Admin] remote orders query error:", err);
      }

      return mergeOrdersWithLocal<AdminOrder>(remoteOrders);
    },
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }, [qc]);

  const patchOrder = async (
    id: string,
    patch: { status?: string; archived_at?: string | null; note?: string },
    okMessage: string,
  ) => {
    await applyOrderPatch(id, patch);
    toast.success(okMessage);
    refresh();
  };

  const setItemQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const { error } = await supabase.from("order_items").update({ quantity }).eq("id", itemId);
    if (error) {
      toast.error("Adet güncellenemedi");
      return;
    }
    refresh();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (error) {
      toast.error("Ürün silinemedi");
      return;
    }
    toast.success("Ürün siparişten çıkarıldı");
    refresh();
  };

  const [orderToDelete, setOrderToDelete] = useState<AdminOrder | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const executeDeleteOrder = async (order: AdminOrder) => {
    if (!order?.id) return;
    setIsDeletingOrder(true);
    try {
      // Optimistik anında güncelleme
      qc.setQueryData(["admin-orders"], (prev: AdminOrder[] | undefined) =>
        prev ? prev.filter((o) => o.id !== order.id) : [],
      );

      await permanentlyDeleteOrder(order.id);
      toast.success("Sipariş kalıcı olarak silindi");
      refresh();
    } catch (err) {
      console.error("[OrdersPanel] Delete error:", err);
      toast.error("Sipariş silinirken bir hata oluştu");
      refresh();
    } finally {
      setIsDeletingOrder(false);
      setOrderToDelete(null);
    }
  };

  const [showRouteMap, setShowRouteMap] = useState(true);
  const [sortByRoute, setSortByRoute] = useState(true);
  const [routeMode, setRouteMode] = useState<"yolda" | "hepsi">("yolda");
  const [isSeedingOrders, setIsSeedingOrders] = useState(false);
  const [isPurgingOrders, setIsPurgingOrders] = useState(false);

  const handleSeedDistrictOrders = async () => {
    setIsSeedingOrders(true);
    try {
      const res = await seedAllDistrictTestOrders();
      toast.success(
        `6 ilçe için toplam ${res.count} adet rota deneme siparişi başarıyla oluşturuldu!`,
        { duration: 5000 },
      );
      refresh();
    } catch (err) {
      console.error("[OrdersPanel] Seed error:", err);
      toast.error("Deneme siparişleri oluşturulurken bir hata oluştu");
    } finally {
      setIsSeedingOrders(false);
    }
  };

  const handlePurgeTestOrders = async () => {
    setIsPurgingOrders(true);
    try {
      const purged = await purgeAllTestOrders();
      toast.success(
        purged > 0
          ? `${purged} adet deneme siparişi temizlendi.`
          : "Tüm deneme siparişleri başarıyla temizlendi.",
      );
      refresh();
    } catch (err) {
      console.error("[OrdersPanel] Purge error:", err);
      toast.error("Deneme siparişleri silinirken bir sorun oluştu.");
    } finally {
      setIsPurgingOrders(false);
    }
  };

  // Kullanıcı "sil yaptıgın deneme siparisleri" dediği için tüm deneme siparişlerini temizle
  const purgeDoneRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || purgeDoneRef.current) return;
    purgeDoneRef.current = true;
    try {
      const hasPurgedUserRequested = localStorage.getItem("ko_user_requested_purge_test_v5");
      if (!hasPurgedUserRequested) {
        localStorage.setItem("ko_user_requested_purge_test_v5", "true");
        void purgeAllTestOrders()
          .then(() => {
            refresh();
          })
          .catch(() => {});
      }
    } catch {
      // ignore storage restriction
    }
  }, [refresh]);

  const all = data ?? [];
  const scopedActive = all.filter((o) => !isArchivedOrder(o));
  const scopedPast = all.filter((o) => isArchivedOrder(o));

  const activeCount = scopedActive.length;
  const archivedCount = scopedPast.length;
  const inTransitCount = scopedActive.filter((o) => o.status === "yolda").length;
  const waitingCount = scopedActive.filter((o) => o.status !== "yolda").length;

  const scoped = view === "arsiv" ? scopedPast : scopedActive;

  // Seçilen ilçe veya tüm ilçelerdeki aktif siparişler (Sevkiyat Haritası için)
  // Ahlat & Adilcevaz seçildiğinde iki ilçenin de siparişleri aynı ekranda birleşir
  const districtActiveOrders = useMemo(() => {
    return scopedActive.filter((o) => matchesDistrictFilter(o.district, district));
  }, [scopedActive, district]);

  // Rotaya dahil edilecek siparişler:
  // "yolda" modunda (varsayılan): Yalnızca rotaya eklenip "Yolda" seçilen siparişler rotalanır.
  // "hepsi" modunda: İlçedeki tüm aktif siparişler rotalanır.
  const districtRoutedOrders = useMemo(() => {
    if (routeMode === "hepsi") {
      return districtActiveOrders;
    }
    return districtActiveOrders.filter((o) => o.status === "yolda");
  }, [districtActiveOrders, routeMode]);

  // Depodan başlayarak en yakın komşu (TSP) sırasına göre optimize edilmiş duraklar
  const optimizedDistrictStops = useMemo(() => {
    return computeOptimizedStops(districtRoutedOrders);
  }, [districtRoutedOrders]);

  // Sipariş ID'sine göre durak bilgisi sorgulama haritası
  const stopLookup = useMemo(() => {
    const map = new Map<string, RouteOrderStop>();
    optimizedDistrictStops.forEach((s) => map.set(s.id, s));
    return map;
  }, [optimizedDistrictStops]);

  // İlçedeki bekleyen tüm siparişleri tek tıkla rotaya dahil etme
  const handleAddAllDistrictWaitingToRoute = async () => {
    const waitingInDistrict = districtActiveOrders.filter((o) => o.status !== "yolda");
    if (waitingInDistrict.length === 0) {
      toast.info("Bu ilçede rotaya eklenecek bekleyen sipariş bulunmuyor.");
      return;
    }
    for (const ord of waitingInDistrict) {
      await patchOrder(
        ord.id,
        { status: "yolda" },
        `${waitingInDistrict.length} sipariş topluca rotaya eklendi ve 'Yolda' olarak güncellendi.`,
      );
    }
  };

  // Listede görüntülenecek filtrelenmiş ve sıralanmış siparişler
  const orders = useMemo(() => {
    const filtered = scoped.filter((o) => {
      const matchDistrict = matchesDistrictFilter(o.district, district);
      const matchDate = inDateRange(o.created_at, range);
      if (!matchDistrict || !matchDate) return false;

      if (view === "aktif") {
        if (filter === "hepsi") return true;
        if (filter === "yolda") return o.status === "yolda";
        if (filter === "bekliyor") return o.status !== "yolda";
        return o.status === filter;
      }
      if (filter === "hepsi") return true;
      return o.status === filter;
    });

    if (view === "aktif" && sortByRoute) {
      // Rotadaki durakları en yakın duraktan uzağa doğru sırala, bekleyenleri tarih sırasına göre sonraya koy
      return [...filtered].sort((a, b) => {
        const stopA = stopLookup.get(a.id)?.stopNumber;
        const stopB = stopLookup.get(b.id)?.stopNumber;
        if (stopA !== undefined && stopB !== undefined) return stopA - stopB;
        if (stopA !== undefined) return -1;
        if (stopB !== undefined) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return filtered;
  }, [scoped, filter, district, range, view, sortByRoute, stopLookup]);

  return (
    <div className="mt-4">
      {/* 1. Üst Sekmeler: Aktif vs Geçmiş Siparişler (Yeni ile eski siparişler kesinlikle karışmaz) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            key="aktif"
            type="button"
            onClick={() => {
              setView("aktif");
              setFilter("hepsi");
            }}
            className={
              view === "aktif"
                ? "rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground flex items-center gap-2 shadow-xs"
                : "rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary flex items-center gap-2"
            }
          >
            <span>📦 Aktif Sevkiyat & Siparişler</span>
            <span className="rounded-full bg-white/20 dark:bg-black/20 px-2 py-0.5 text-xs font-bold">
              {activeCount}
            </span>
            {inTransitCount > 0 && (
              <span className="rounded-full bg-emerald-500/80 text-white px-2 py-0.5 text-[11px] font-bold">
                🚚 {inTransitCount} Yolda
              </span>
            )}
            {waitingCount > 0 && (
              <span className="rounded-full bg-amber-500/80 text-white px-2 py-0.5 text-[11px] font-bold">
                ⏳ {waitingCount} Bekliyor
              </span>
            )}
          </button>

          <button
            key="arsiv"
            type="button"
            onClick={() => {
              setView("arsiv");
              setFilter("hepsi");
            }}
            className={
              view === "arsiv"
                ? "rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground flex items-center gap-2 shadow-xs"
                : "rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary flex items-center gap-2"
            }
          >
            <span>📋 Geçmiş Siparişler (Teslim & İptal)</span>
            <span className="rounded-full bg-white/20 dark:bg-black/20 px-2 py-0.5 text-xs font-bold">
              {archivedCount}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePurgeTestOrders}
            disabled={isPurgingOrders}
            className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 cursor-pointer"
            title="Tüm deneme ve test siparişlerini temizler"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPurgingOrders ? "Siliniyor..." : "Deneme Siparişlerini Sil"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDistrictOrders}
            disabled={isSeedingOrders}
            className="gap-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 cursor-pointer shadow-xs"
            title="6 ilçenin her biri için 10 adet (toplam 60) gerçek GPS koordinatlı deneme siparişi oluşturur"
          >
            <RouteIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {isSeedingOrders
              ? "Siparişler Oluşturuluyor..."
              : "6 İlçe İçin 10'ar Sipariş Oluştur (60 Rota Siparişi)"}
          </Button>

          <Link
            to="/siparisler"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            title="Sadece ilçeler, siparişler ve rota haritasının olduğu ayrı ekrana git"
          >
            <RouteIcon className="h-3.5 w-3.5" />
            <span>Ayrı İlçe & Rota Ekranına Git</span>
          </Link>

          {onNavigateToDrive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToDrive}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
              GitHub & Cloudflare&apos;a Eşitle
            </Button>
          )}
        </div>
      </div>

      {/* 2. Geçmiş Siparişler Bilgilendirme Kutusu */}
      {view === "arsiv" && (
        <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Geçmiş ve Tamamlanan Siparişler Ekranı
              </p>
              <p className="text-[11px] text-muted-foreground">
                Teslim edilen veya iptal edilen tüm siparişler burada arşivlenir. Yeni aktif sipariş
                listenizi meşgul etmez.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setView("aktif")}
            className="text-xs cursor-pointer h-7"
          >
            ← Aktif Sevkiyat Ekranına Dön
          </Button>
        </div>
      )}

      {/* 3. İlçe Seçimi Butonları */}
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground mr-1">İlçe:</span>
        {ADMIN_DISTRICT_FILTERS.map((d) => {
          const isSelected = district === d.value;
          return (
            <button
              key={d.value}
              onClick={() => setDistrict(d.value)}
              className={
                isSelected
                  ? "rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground shadow-xs cursor-pointer"
                  : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary cursor-pointer"
              }
            >
              {d.label}
              {d.value !== "hepsi" && (
                <span className="ml-1 opacity-75 font-semibold">
                  ({scoped.filter((o) => matchesDistrictFilter(o.district, d.value)).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Durum Filtreleri */}
      <div className="mt-2.5 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Durum:</span>
        {view === "aktif"
          ? [
              { value: "hepsi", label: `Tüm Aktifler (${activeCount})` },
              { value: "yolda", label: `🚚 Yolda / Rotada (${inTransitCount})` },
              { value: "bekliyor", label: `⏳ Sevkiyatta Bekleyen (${waitingCount})` },
              { value: "yeni", label: "Yeni" },
              { value: "hazirlaniyor", label: "Hazırlanıyor" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setFilter(s.value)}
                className={
                  filter === s.value
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary"
                }
              >
                {s.label}
              </button>
            ))
          : [
              { value: "hepsi", label: `Tüm Geçmiş (${archivedCount})` },
              { value: "teslim", label: "Teslim Edilenler" },
              { value: "iptal", label: "İptal Edilenler" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setFilter(s.value)}
                className={
                  filter === s.value
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary"
                }
              >
                {s.label}
              </button>
            ))}
      </div>

      {/* 5. Tarih Aralığı Filtresi */}
      <div className="mt-2.5 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Tarih:</span>
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={
              range === r.value
                ? "rounded-full bg-muted-foreground text-background px-3 py-0.5 text-xs font-semibold"
                : "rounded-full border border-border px-3 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 6. Aktif Siparişler İçin Otomatik İlçe Sevkiyat Rotası ve Harita Bileşeni */}
      {view === "aktif" && (
        <div id="admin-route-map-section" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 p-2.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <RouteIcon className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 leading-none flex-wrap">
                  <span>
                    {district === "hepsi" ? "Tüm İlçeler" : districtLabel(district)} Akıllı Sevkiyat
                    Rotası
                  </span>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 text-[10px] flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {districtRoutedOrders.length} Durak Yolda / Rotada
                  </span>
                  {districtActiveOrders.length - districtRoutedOrders.length > 0 && (
                    <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 text-[10px] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {districtActiveOrders.length - districtRoutedOrders.length} Sevkiyatta
                      Bekliyor
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tatvan Aydınlar Mah. Ana Depodan başlayarak 'Yolda' olan siparişler en yakın
                  teslimat noktasına göre dizilir
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Rota Gösterim Modu */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setRouteMode("yolda")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    routeMode === "yolda"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Yalnızca rotaya eklenip 'Yolda' olan siparişleri haritaya dizer"
                >
                  <Truck className="h-3 w-3" />
                  <span>
                    Sadece Yoldakiler (
                    {districtActiveOrders.filter((o) => o.status === "yolda").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRouteMode("hepsi")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    routeMode === "hepsi"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="İlçedeki tüm aktif siparişleri haritada gösterir"
                >
                  <span>Tüm Aktifler ({districtActiveOrders.length})</span>
                </button>
              </div>

              {districtActiveOrders.some((o) => o.status !== "yolda") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddAllDistrictWaitingToRoute}
                  className="text-xs h-7.5 cursor-pointer font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                  title="Bu ilçedeki tüm bekleyen siparişleri rotaya ekler ve 'Yolda' yapar"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Tümünü Rotaya Ekle</span>
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant={sortByRoute ? "default" : "outline"}
                onClick={() => setSortByRoute((prev) => !prev)}
                className="text-xs h-7.5 cursor-pointer font-semibold"
                title="Sipariş kartlarını rota durak sırasına (en yakın duraktan uzağa) göre diz"
              >
                <Milestone className="h-3.5 w-3.5 mr-1" />
                {sortByRoute ? "Sıralama: Rota (En Yakın)" : "Sıralama: Tarihe Göre"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRouteMap((prev) => !prev)}
                className="text-xs h-7.5 cursor-pointer"
              >
                {showRouteMap ? "Haritayı Gizle" : "Haritayı Göster"}
              </Button>
            </div>
          </div>

          {/* Rotada hiç sipariş yoksa bilgilendirme kutusu */}
          {showRouteMap && districtRoutedOrders.length === 0 && (
            <div className="mb-2 p-3 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Rotada henüz sipariş yok:</strong> Siparişler verilmiş olsa da sevkiyatta
                  beklemektedir. Dağıtıma çıkaracağınız siparişlerin yanındaki{" "}
                  <strong>"Rotaya Ekle (Yolda)"</strong> butonuna tıklayarak onları akıllı rotaya
                  ekleyebilirsiniz.
                </span>
              </div>
              {districtActiveOrders.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleAddAllDistrictWaitingToRoute}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer gap-1"
                >
                  <Truck className="h-3.5 w-3.5" />
                  Bekleyenleri Rotaya Ekle ({districtActiveOrders.length})
                </Button>
              )}
            </div>
          )}

          {showRouteMap && (
            <AdminDistrictRouteMap
              orders={districtRoutedOrders}
              selectedDistrict={district}
              onOrderClick={(orderId) => {
                const el = document.getElementById(`order-card-${orderId}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-emerald-500");
                  setTimeout(() => el.classList.remove("ring-2", "ring-emerald-500"), 2500);
                }
              }}
            />
          )}
        </div>
      )}

      {/* 7. Sipariş Kartları Listesi */}
      {isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-xl" />
      ) : orders.length === 0 ? (
        <div className="mt-8 text-center p-8 rounded-xl border border-dashed border-border bg-card/50">
          <p className="text-sm text-muted-foreground font-medium mb-3">
            {view === "arsiv"
              ? "Geçmiş / arşiv kayıtlarında sipariş bulunmuyor."
              : "Aktif sevkiyat bekleyen sipariş bulunmuyor."}
          </p>
          {view === "aktif" && (
            <Button
              onClick={handleSeedDistrictOrders}
              disabled={isSeedingOrders}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer gap-2"
            >
              <RouteIcon className="h-4 w-4" />
              {isSeedingOrders
                ? "Siparişler Ekleniyor..."
                : "7 İlçe İçin 10'ar Rota Siparişi Oluştur (Toplam 70 Sipariş)"}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {orders.map((o, idx) => {
            const editing = editingId === o.id;
            const stopInfo = stopLookup.get(o.id);
            const showDay =
              !sortByRoute &&
              (idx === 0 || dayKey(orders[idx - 1]!.created_at) !== dayKey(o.created_at));

            return (
              <Fragment key={o.id}>
                {showDay && (
                  <h3 className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {dayLabel(o.created_at)}
                  </h3>
                )}
                <article
                  id={`order-card-${o.id}`}
                  className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-base">{o.business_name}</p>

                        {/* Rota ve Sevkiyat Durum Rozeti */}
                        {view === "aktif" &&
                          (o.status === "yolda" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              <Truck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              {stopInfo ? (
                                <>
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white font-extrabold">
                                    {stopInfo.stopNumber}
                                  </span>
                                  <span>
                                    {stopInfo.stopNumber}. Durak (Depodan{" "}
                                    {stopInfo.distanceFromDepotKm} km)
                                  </span>
                                </>
                              ) : (
                                <span>🚚 Yolda (Rotaya Eklendi)</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>⏳ Sevkiyatta Bekliyor (Rotada Değil)</span>
                            </span>
                          ))}

                        {/* Geçmiş Sipariş Rozeti (Teslim veya İptal) */}
                        {view === "arsiv" && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              o.status === "teslim"
                                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                : "bg-destructive/15 border border-destructive/30 text-destructive"
                            }`}
                          >
                            {o.status === "teslim" ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Teslim Edildi
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5" /> İptal Edildi
                              </>
                            )}
                          </span>
                        )}

                        <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {districtLabel(o.district)}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">
                        {o.full_name} ·{" "}
                        <span className="font-medium text-foreground">{o.phone}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{o.address}</p>

                      {(() => {
                        const coords = extractCoordinates(o.address) || extractCoordinates(o.note);
                        if (!coords) return null;
                        return (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>
                              Konum: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                            </span>
                          </div>
                        );
                      })()}

                      <p className="mt-1 text-xs text-muted-foreground">
                        #{o.id.slice(0, 8).toUpperCase()} ·{" "}
                        {new Date(o.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Tek tıkla Rotaya Ekle veya Beklet Hızlı Butonu */}
                      {view === "aktif" &&
                        (o.status !== "yolda" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { status: "yolda" },
                                "Sipariş teslimat rotasına eklendi ve 'Yolda' olarak güncellendi.",
                              )
                            }
                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs gap-1"
                            title="Siparişi teslimat rotasına dahil et ve durumunu 'Yolda' yap"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            <span>Rotaya Ekle (Yolda)</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { status: "hazirlaniyor" },
                                "Sipariş teslimat rotasından çıkarıldı ve beklemede olarak işaretlendi.",
                              )
                            }
                            className="h-8 text-xs font-semibold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer shadow-xs gap-1"
                            title="Siparişi teslimat rotasından çıkarıp sevkiyat beklemesine al"
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                            <span>Rotadan Çıkar (Beklet)</span>
                          </Button>
                        ))}

                      <div className="w-48">
                        <Select
                          value={o.status}
                          onValueChange={async (v) => {
                            const isFinished = v === "teslim" || v === "iptal";
                            await patchOrder(
                              o.id,
                              { status: v },
                              v === "iptal"
                                ? `"${o.business_name || o.full_name || "Sipariş"}" siparişi iptal edildi.`
                                : isFinished
                                  ? `Sipariş "${statusLabel(v)}" olarak işaretlendi ve Geçmiş Siparişler ekranına aktarıldı.`
                                  : v === "yolda"
                                    ? "Sipariş teslimat rotasına eklendi ('Yolda')"
                                    : "Sipariş durumu güncellendi ('Sevkiyatta Bekliyor')",
                            );
                            if (v === "teslim") {
                              setView("arsiv");
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={statusLabel(o.status)} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yeni">⏳ Yeni (Sevkiyat Bekliyor)</SelectItem>
                            <SelectItem value="hazirlaniyor">
                              ⏳ Hazırlanıyor (Sevkiyat Bekliyor)
                            </SelectItem>
                            <SelectItem value="yolda">🚚 Yolda (Rotada Dağıtımda)</SelectItem>
                            <SelectItem value="teslim">✅ Teslim Edildi (Arşivle)</SelectItem>
                            <SelectItem value="iptal">❌ İptal Edildi (Arşivle)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {o.order_items.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 border-b border-border/60 py-1"
                      >
                        <span>{i.product_name}</span>
                        {editing ? (
                          <span className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Azalt"
                              onClick={() => void setItemQuantity(i.id, i.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-14 text-center font-semibold">
                              {i.quantity} {i.unit}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Artır"
                              onClick={() => void setItemQuantity(i.id, i.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ürünü çıkar"
                              onClick={() => void removeItem(i.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </span>
                        ) : (
                          <span className="font-semibold">
                            {i.quantity} {i.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {editing ? (
                    <div className="mt-3">
                      <Label htmlFor={`note-${o.id}`}>Sipariş notu</Label>
                      <Textarea
                        id={`note-${o.id}`}
                        rows={2}
                        defaultValue={o.note}
                        maxLength={500}
                        onBlur={(e) => {
                          if (e.target.value !== o.note)
                            void patchOrder(o.id, { note: e.target.value }, "Not güncellendi");
                        }}
                      />
                    </div>
                  ) : (
                    o.note && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Not:</span> {o.note}
                      </p>
                    )
                  )}

                  {/* Alt İşlem Butonları (Google Maps butonu kaldırıldı, doğrudan rota ve teslimat butonları yerleştirildi) */}
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    {view === "aktif" && stopInfo && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setShowRouteMap(true);
                          const el = document.getElementById("admin-route-map-section");
                          el?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs font-semibold cursor-pointer"
                      >
                        <RouteIcon className="h-3.5 w-3.5 mr-1 text-blue-600" />
                        Haritada Durak #{stopInfo.stopNumber}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant={editing ? "default" : "outline"}
                      onClick={() => setEditingId(editing ? null : o.id)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      {editing ? "Düzenlemeyi bitir" : "Düzenle"}
                    </Button>

                    {/* Teslim Edildi Butonu -> Durumu günceller ve Geçmiş Siparişler ekranına yönlendirir */}
                    {o.status !== "teslim" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer font-semibold"
                        onClick={async () => {
                          await patchOrder(
                            o.id,
                            { status: "teslim", archived_at: new Date().toISOString() },
                            `"${o.business_name || o.full_name || "Sipariş"}" teslim edildi olarak işaretlendi ve Geçmiş Siparişler ekranına aktarıldı.`,
                          );
                          setView("arsiv");
                          setFilter("hepsi");
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mr-1" />
                        Teslim edildi
                      </Button>
                    )}

                    {/* İptal Et Butonu -> Durumu günceller, kullanıcı ekranını yönlendirmez; sipariş iptal edilenlere aktarılır */}
                    {o.status !== "iptal" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer font-semibold"
                        onClick={async () => {
                          await patchOrder(
                            o.id,
                            { status: "iptal", archived_at: new Date().toISOString() },
                            `"${o.business_name || o.full_name || "Sipariş"}" siparişi iptal edildi.`,
                          );
                        }}
                      >
                        <XCircle className="h-4 w-4 text-destructive mr-1" />
                        İptal et
                      </Button>
                    )}

                    {/* Geçmiş Ekranındaysa: Aktife Geri Al Butonu */}
                    {isArchivedOrder(o) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={async () => {
                          await patchOrder(
                            o.id,
                            { archived_at: null, status: "yeni" },
                            `"${o.business_name}" siparişi aktif listeye geri alındı.`,
                          );
                          setView("aktif");
                        }}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-1 text-primary" />
                        Aktif listeye al
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void patchOrder(
                            o.id,
                            { archived_at: new Date().toISOString() },
                            "Sipariş arşivlendi",
                          )
                        }
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Arşivle
                      </Button>
                    )}

                    {isArchivedOrder(o) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 cursor-pointer font-medium"
                        onClick={() => setOrderToDelete(o)}
                        title="Bu siparişi kalıcı olarak sil"
                      >
                        <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                        Kalıcı sil
                      </Button>
                    )}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      )}

      {/* Sipariş Kalıcı Silme Onay Diyaloğu */}
      <AlertDialog
        open={Boolean(orderToDelete)}
        onOpenChange={(open) => !open && setOrderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Siparişi Kalıcı Olarak Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-foreground/80">
              <span>
                <strong>#{orderToDelete?.id.slice(0, 8).toUpperCase()}</strong> numaralı (
                {orderToDelete?.business_name || orderToDelete?.full_name || "Müşteri"}) siparişini
                veritabanından ve hafızadan <strong>tamamen silmek</strong> üzeresiniz.
              </span>
              <span className="block text-xs text-destructive/90 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium">
                ⚠️ Bu işlem geri alınamaz. Sipariş tüm geçmiş kayıtlardan tamamen yok edilecektir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOrder}>İptal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingOrder}
              onClick={(e) => {
                e.preventDefault();
                if (orderToDelete) void executeDeleteOrder(orderToDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingOrder ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                "Kalıcı Olarak Sil"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function compressImage(file: File, max = 800, quality = 0.72) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("canvas only available in browser");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

function ProductsPanel({
  initialEditId,
  onNavigateToDrive,
  initialProducts,
  isLoadingProducts,
}: {
  initialEditId?: string;
  onNavigateToDrive?: () => void;
  initialProducts?: Product[];
  isLoadingProducts?: boolean;
}) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyProduct });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("hepsi");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const pickImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel dosyası seçin");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, image_url: dataUrl }));
      toast.success("Fotoğraf yüklendi");

      // Yalnızca yeni ürün ekleme diyaloğunda AI çalışsın
      // Var olan ürün düzenlenirken (editingId varsa) kullanıcının mevcut metinlerini ezmeyelim!
      if (!editingId) {
        toast.info("Yapay zeka görseli analiz ediyor...");
        const aiResult = await analyzeProductPhoto(dataUrl, "image/jpeg", form.name || undefined);
        if (aiResult.ok && aiResult.product) {
          const p = aiResult.product;
          const validName = !isBogusProductName(p.name) ? p.name : "";
          setForm((f) => ({
            ...f,
            name: f.name ? f.name : validName,
            category: f.category !== "gida" ? f.category : p.category,
            unit: f.unit !== "adet" ? f.unit : p.unit,
            description: f.description ? f.description : p.description,
            image_url: dataUrl,
          }));
          if (validName) {
            toast.success(`Yapay zeka "${validName}" ürününü tespit etti ve formu doldurdu!`);
          } else {
            toast.info("Fotoğraf yüklendi. Lütfen ürün adını yazınız.");
          }
        }
      }
    } catch {
      toast.error("Fotoğraf işlenemedi");
    } finally {
      setUploading(false);
    }
  };

  const { data: queriedData, isLoading: isQueryLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: fetchAdminProductsList,
    initialData: () => getAllCatalogProducts(),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });

  const data = useMemo(
    () => (queriedData && queriedData.length > 0 ? queriedData : (initialProducts ?? [])),
    [queriedData, initialProducts],
  );
  const isLoading =
    (isLoadingProducts ?? false) && data.length === 0 ? true : isQueryLoading && data.length === 0;

  // initialEditId verilmişse veya URL'den gelmişse düzenleme modunu başlat
  const lastInitialEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialEditId || lastInitialEditIdRef.current === initialEditId) return;
    const target = data?.find((p) => p.id === initialEditId) ?? null;
    if (target) {
      lastInitialEditIdRef.current = initialEditId;
      setEditingId(target.id);
      setForm({
        name: target.name || "",
        description: cleanProductDescription(target.description),
        category: target.category || "gida",
        unit: target.unit || "adet",
        image_url: target.image_url ?? "",
        is_active: target.is_active ?? true,
      });
      toast.info(`"${target.name}" düzenleme için hazırlandı.`);
      setTimeout(() => {
        if (typeof document !== "undefined") {
          const itemEl = document.getElementById(`edit-product-${target.id}`);
          itemEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  }, [initialEditId, data]);

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyProduct });
    setIsAddDialogOpen(false);
    setShowUrlInput(false);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    const targetProduct = editingId ? data.find((p) => p.id === editingId) : null;
    const inStock = targetProduct ? isProductInStock(targetProduct) : true;
    const baseDesc = cleanProductDescription(parsed.data.description);
    const finalDesc = inStock ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    const normalizedImageUrl = parsed.data.image_url?.trim()
      ? getPublicProductImageUrl(parsed.data.image_url)
      : null;

    const payload = {
      ...parsed.data,
      description: finalDesc,
      image_url: normalizedImageUrl || null,
    };
    setBusy(true);
    const isEdit = Boolean(editingId);
    const finalId = editingId || `custom-${Date.now()}`;
    const customProd: Product = {
      id: finalId,
      name: payload.name,
      category: payload.category as Product["category"],
      unit: payload.unit,
      description: payload.description,
      image_url: payload.image_url,
      is_active: payload.is_active,
    };
    saveCustomProduct(customProd, isEdit);

    try {
      if (editingId) {
        await supabase.from("products").update(payload).eq("id", editingId);
      } else {
        await supabase.from("products").insert({ ...payload, id: finalId });
      }
    } catch {
      // ignore
    }
    setBusy(false);

    // Optimistic cache update: Düzenlenen ürünü kendi yerinde güncelle, yeni ürünü başa ekle
    const updateInCache = (old: Product[] | undefined) => {
      if (!old) return old;
      if (isEdit) {
        return old.map((p) => (p.id === finalId ? { ...p, ...customProd } : p));
      }
      return [customProd, ...old];
    };
    qc.setQueryData<Product[]>(["admin-products"], updateInCache);
    qc.setQueryData<Product[]>(["products", "active"], updateInCache);
    qc.setQueryData<Product[]>(["live-supabase-products"], updateInCache);

    toast.success(isEdit ? "Ürün güncellendi" : "Ürün eklendi");
    reset();
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("catalog_updated"));
    }
  };

  const [productView, setProductView] = useState<"aktif" | "arsiv">("aktif");
  const [restoringProduct, setRestoringProduct] = useState<Product | null>(null);
  const [permanentDeletingProduct, setPermanentDeletingProduct] = useState<Product | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const archiveProduct = async (product: Product) => {
    setActionBusy(true);

    // 1. Yerel arşivleme durumunu kaydet (tüm ürün tiplerinde anında çalışır)
    setProductArchivedStatusLocal(product.id, true);

    // 2. Custom ürünlerde de is_active'i false yap
    const customList = getCustomProducts();
    const targetCustom = customList.find((p) => p.id === product.id);
    if (targetCustom) {
      saveCustomProduct({ ...targetCustom, is_active: false }, true);
    }

    // 3. Supabase'i de güncellemeye çalış
    try {
      await supabase.from("products").update({ is_active: false }).eq("id", product.id);
    } catch {
      // ignore
    }

    // 4. Cache'i optimistic olarak güncelle
    const updateInactive = (old: Product[] | undefined) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, is_active: false } : p));
    };
    qc.setQueryData<Product[]>(["admin-products"], updateInactive);
    qc.setQueryData<Product[]>(["products", "active"], (old) =>
      old ? old.filter((p) => p.id !== product.id) : old,
    );
    qc.setQueryData<Product[]>(["live-supabase-products"], updateInactive);

    setActionBusy(false);
    toast.success(`"${product.name}" arşive kaldırıldı.`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("catalog_updated"));
    }
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
  };

  const restoreProduct = async (product: Product) => {
    setActionBusy(true);

    // 1. Yerel arşivleme durumunu kaldır
    setProductArchivedStatusLocal(product.id, false);

    // 2. Custom ürünlerde de is_active'i true yap
    const customList = getCustomProducts();
    const targetCustom = customList.find((p) => p.id === product.id);
    if (targetCustom) {
      saveCustomProduct({ ...targetCustom, is_active: true }, true);
    }

    // 3. Supabase'i de güncelle
    try {
      await supabase.from("products").update({ is_active: true }).eq("id", product.id);
    } catch {
      // ignore
    }

    // 4. Cache'i optimistic olarak güncelle
    const updateActive = (old: Product[] | undefined) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, is_active: true } : p));
    };
    qc.setQueryData<Product[]>(["admin-products"], updateActive);
    qc.setQueryData<Product[]>(["live-supabase-products"], updateActive);

    setActionBusy(false);
    toast.success(`"${product.name}" başarıyla geri yüklendi ve kataloğa eklendi.`);
    setRestoringProduct(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("catalog_updated"));
    }
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
  };

  const permanentlyDeleteProduct = async (product: Product) => {
    setActionBusy(true);
    markProductPermanentlyDeleted(product.id, product.name);

    // Listeden anında kaldırmak için optimistic güncelleme
    const removeProduct = (old: Product[] | undefined) =>
      old ? old.filter((p) => p.id !== product.id && p.name !== product.name) : old;
    qc.setQueryData<Product[]>(["admin-products"], removeProduct);
    qc.setQueryData<Product[]>(["products", "active"], removeProduct);
    qc.setQueryData<Product[]>(["live-supabase-products"], removeProduct);

    try {
      await supabase.from("products").delete().eq("id", product.id);
    } catch {
      // ignore
    }
    setActionBusy(false);
    toast.success(`"${product.name}" kalıcı olarak silindi.`);
    setPermanentDeletingProduct(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("catalog_updated"));
    }
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
  };

  const [togglingStockId, setTogglingStockId] = useState<string | null>(null);

  const toggleStockStatus = async (product: Product) => {
    const currentInStock = isProductInStock(product);
    const newStatus = !currentInStock;
    setTogglingStockId(product.id);

    // 1. Local override anında güncellensin (sayfa yenilense de hatırlanır)
    setProductStockStatusLocal(product.id, newStatus);

    const baseDesc = cleanProductDescription(product.description);
    const newDescription = newStatus ? baseDesc : baseDesc ? `${baseDesc} [TÜKENDİ]` : "[TÜKENDİ]";

    // 2. Optimistic update query client cache
    const updateProductList = (old: Product[] | undefined) => {
      if (!old) return old;
      return old.map((p) => (p.id === product.id ? { ...p, description: newDescription } : p));
    };
    qc.setQueryData<Product[]>(["admin-products"], updateProductList);
    qc.setQueryData<Product[]>(["products", "active"], updateProductList);
    qc.setQueryData<Product[]>(["live-supabase-products"], (updateList) =>
      updateProductList(updateList),
    );

    // 3. Veritabanına da yaz
    try {
      const { error } = await supabase
        .from("products")
        .update({ description: newDescription })
        .eq("id", product.id);
      if (error) {
        console.warn("[toggleStockStatus] Supabase update note:", error.message);
      }
    } catch (err) {
      console.warn("[toggleStockStatus] err:", err);
    }

    toast.success(
      newStatus
        ? `"${product.name}" stokta olarak işaretlendi.`
        : `"${product.name}" stokta yok olarak işaretlendi.`,
    );
    setTogglingStockId(null);
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
    void qc.invalidateQueries({ queryKey: ["live-supabase-products"] });
  };

  const normalizedData = useMemo(
    () =>
      data
        .filter((p) => !isBannedProductName(p.name) && !isProductPermanentlyDeleted(p.id, p.name))
        .map(normalizeProductWithOverrides),
    [data],
  );
  const activeProducts = useMemo(
    () => normalizedData.filter((p) => p.is_active !== false),
    [normalizedData],
  );
  const archivedProducts = useMemo(
    () => normalizedData.filter((p) => p.is_active === false),
    [normalizedData],
  );
  const currentViewList = productView === "arsiv" ? archivedProducts : activeProducts;

  const filteredProducts = useMemo(() => {
    return currentViewList.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase()));
      const matchCategory = categoryFilter === "hepsi" || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [currentViewList, productSearch, categoryFilter]);

  const [syncingImages, setSyncingImages] = useState(false);

  const syncAllImagesInDatabase = async () => {
    if (!data || data.length === 0) return;
    setSyncingImages(true);
    let updatedCount = 0;
    try {
      for (const p of data) {
        const currentUrl = p.image_url?.trim() || "";
        const isCleanPublicPath =
          currentUrl.startsWith("/") && !currentUrl.includes("/src/assets/");
        if (isCleanPublicPath) {
          continue;
        }

        const resolved = getPublicProductImageUrl(p.image_url, p.name, p.category);
        if (resolved && resolved !== p.image_url) {
          const { error } = await supabase
            .from("products")
            .update({ image_url: resolved })
            .eq("id", p.id);
          if (!error) updatedCount++;
        }
      }
      if (updatedCount > 0) {
        toast.success(`${updatedCount} ürünün fotoğraf yolu güncellendi ve eşitlendi.`);
        void qc.invalidateQueries({ queryKey: ["admin-products"] });
        void qc.invalidateQueries({ queryKey: ["products", "active"] });
      } else {
        toast.info("Tüm ürün fotoğrafları zaten güncel ve yerel depoya bağlı.");
      }
    } catch {
      toast.error("Fotoğraflar eşitlenirken bir hata oluştu.");
    } finally {
      setSyncingImages(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Gizli görsel dosya seçici */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pickImage(file);
        }}
      />

      {/* YENİ ÜRÜN EKLEME MODAL DİYALOĞU */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Yeni Ürün Ekle
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kataloğa yeni ürün eklemek için bilgileri doldurun. Cihazdan fotoğraf yüklerseniz
              yapay zeka alanları otomatik tamamlar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="add-pr-name" className="text-xs font-semibold">
                Ürün Adı
              </Label>
              <Input
                id="add-pr-name"
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Örn: Çaykur Rize Turist Çay 1000g"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-pr-desc" className="text-xs font-semibold">
                Paket / Koli İçi Bilgisi
              </Label>
              <Textarea
                id="add-pr-desc"
                rows={2}
                placeholder="Örn: Paket içi 6 Adet veya Koli içi 12 Adet"
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Kategori</Label>
                <Select
                  value={
                    PRODUCT_CATEGORIES.some((c) => c.value === form.category)
                      ? form.category
                      : "gida"
                  }
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="add-pr-unit" className="text-xs font-semibold">
                  Birim
                </Label>
                <Input
                  id="add-pr-unit"
                  placeholder="adet, koli, paket..."
                  value={form.unit}
                  maxLength={30}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="text-xs h-9"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {UNITS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm({ ...form, unit: u.value })}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                        form.unit.toLowerCase() === u.value.toLowerCase()
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Görsel Yükleme */}
            <div className="space-y-1 border-t border-border/60 pt-3">
              <Label className="text-xs font-semibold">Ürün Fotoğrafı</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                  <img
                    src={getPublicProductImageUrl(form.image_url, form.name, form.category)}
                    alt="Önizleme"
                    onError={(e) => handleProductImageError(e, form.name, form.category)}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Görsel URL veya dosya yükleyin"
                      value={
                        form.image_url.startsWith("data:") ? "(Yüklenen görsel)" : form.image_url
                      }
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="text-xs h-8"
                    />
                    {form.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ ...form, image_url: "" })}
                        className="h-8 text-xs text-muted-foreground cursor-pointer"
                      >
                        Kaldır
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="h-7 text-xs gap-1.5 cursor-pointer"
                    >
                      <Upload className="h-3 w-3" />
                      {uploading ? "Yükleniyor..." : "Cihazdan Fotoğraf Seç"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Katalogda görünsün switch */}
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
              <Label htmlFor="add-pr-active" className="text-xs font-medium cursor-pointer">
                Katalogda görünsün (Aktif Ürün)
              </Label>
              <Switch
                id="add-pr-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <DialogFooter className="gap-2 border-t border-border/80 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={busy}
                className="cursor-pointer text-xs"
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer text-xs gap-1.5"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Ürünü Ekle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Üst Yönetim Araç Çubuğu */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm">
        {/* Sol: Sekmeler (Aktif Ürünler / Arşiv) */}
        <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl w-fit border border-border/60">
          <button
            type="button"
            onClick={() => setProductView("aktif")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              productView === "aktif"
                ? "bg-emerald-600 text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PackageSearch className="h-3.5 w-3.5" />
            Aktif Ürünler ({activeProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setProductView("arsiv")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              productView === "arsiv"
                ? "bg-amber-600 text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            Arşiv ({archivedProducts.length})
          </button>
        </div>

        {/* Sağ: Yeni Ürün Ekle Butonu & Aksiyonlar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => {
              reset();
              setIsAddDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 px-3.5 text-xs gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Yeni Ürün Ekle</span>
          </Button>

          {onNavigateToDrive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNavigateToDrive}
              className="h-9 gap-1.5 text-xs cursor-pointer"
            >
              <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
              <span>Depo & Cloudflare Eşitle</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={syncAllImagesInDatabase}
            disabled={syncingImages || isLoading}
            className="h-9 gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingImages ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Görselleri Depoyla Eşitle</span>
          </Button>
        </div>
      </div>

      {/* Arşiv Bilgilendirme Kutusu */}
      {productView === "arsiv" && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <Archive className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold">📦 Ürün Arşivi (Silinmeyen Ürünler)</p>
            <p className="leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              Sildiğiniz veya geçici olarak satıştan kaldırdığınız ürünler burada güvenle saklanır.
              Müşteriler katalogda bu ürünleri göremez. Ürünü tekrar yayına almak için{" "}
              <strong>"Geri Yükle"</strong> butonuna tıklayabilir veya gerekirse{" "}
              <strong>"Kalıcı Olarak Sil"</strong> butonunu kullanabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Arama & Kategori Filtresi */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              productView === "arsiv" ? "Arşivdeki ürünlerde ara..." : "Aktif ürünlerde ara..."
            }
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hepsi">Tüm Kategoriler</SelectItem>
            {PRODUCT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border/80 rounded-2xl bg-card/40">
          {productView === "arsiv" ? (
            <div className="flex flex-col items-center gap-2">
              <Archive className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-medium">Arşivde ürün bulunmuyor.</p>
              <p className="text-xs text-muted-foreground/70">
                Aktif ürünler listesinden sildiğiniz ürünler burada saklanır.
              </p>
            </div>
          ) : data.length === 0 ? (
            "Henüz ürün bulunmuyor."
          ) : (
            "Aramaya uygun ürün bulunamadı."
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((p) => {
            const inStock = isProductInStock(p);
            const isBusy = togglingStockId === p.id;
            const isArchived = p.is_active === false;

            if (editingId === p.id) {
              return (
                <div
                  key={p.id}
                  id={`edit-product-${p.id}`}
                  className="rounded-2xl border-2 border-emerald-500 bg-card p-3 sm:p-4 shadow-lg ring-4 ring-emerald-500/10 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border/70 pb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Ürün Bilgilerini Düzenle
                    </span>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      title="Düzenlemeyi İptal Et"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Kapat</span>
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row items-start gap-4">
                    {/* FOTOĞRAF ÜSTÜNDE FOTOĞRAF EKLEME / DEĞİŞTİRME */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 self-center md:self-start">
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-500 bg-black/30 p-1 cursor-pointer group shadow-md hover:border-emerald-400 transition-all"
                        title="Fotoğrafı değiştirmek veya yeni fotoğraf yüklemek için tıklayın"
                      >
                        <img
                          src={getPublicProductImageUrl(
                            form.image_url || p.image_url,
                            form.name || p.name,
                            form.category || p.category,
                          )}
                          alt={form.name || p.name}
                          onError={(e) =>
                            handleProductImageError(
                              e,
                              form.name || p.name,
                              form.category || p.category,
                            )
                          }
                          className="h-full w-full object-contain"
                        />
                        {/* Fotoğraf Üzerinde Foto Ekle Katmanı */}
                        <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 flex flex-col items-center justify-center text-white transition-opacity">
                          <Camera className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold text-emerald-300 mt-1 leading-none text-center px-1">
                            {uploading ? "Yükleniyor..." : "Foto Ekle"}
                          </span>
                        </div>
                      </div>

                      {/* Fotoğraf Altı Hızlı Butonlar */}
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-600/25 border border-emerald-500/30 cursor-pointer flex items-center gap-1"
                          title="Cihazdan Fotoğraf Seç"
                        >
                          <Upload className="h-3 w-3" />
                          <span>Foto Seç</span>
                        </button>
                        {form.image_url && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                            className="px-1.5 py-0.5 rounded text-destructive hover:bg-destructive/10 cursor-pointer font-medium"
                            title="Fotoğrafı Kaldır"
                          >
                            Kaldır
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                          title="URL ile Fotoğraf Ekle"
                        >
                          <Link2 className="h-3 w-3" />
                        </button>
                      </div>

                      {showUrlInput && (
                        <div className="w-full mt-1">
                          <Input
                            placeholder="Görsel linki yapıştırın..."
                            value={
                              form.image_url.startsWith("data:")
                                ? "(Yüklenen dosya)"
                                : form.image_url
                            }
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, image_url: e.target.value }))
                            }
                            className="h-6 text-[10px] w-36 px-1.5"
                          />
                        </div>
                      )}
                    </div>

                    {/* YAZILAR ÜSTÜNDE SİLME & DÜZELTME ALANLARI */}
                    <div className="min-w-0 flex-1 space-y-2.5 w-full">
                      {/* 1. Ürün İsmi (Silme ve Düzeltme Butonlu) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Ürün İsmi
                          </label>
                          {form.name && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, name: "" }))}
                              className="text-[10px] text-destructive hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Tüm ismi sil"
                            >
                              <Eraser className="h-3 w-3" />
                              <span>İsmi Temizle</span>
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Ürün adı yazın..."
                            maxLength={120}
                            className="h-8 pr-8 text-xs sm:text-sm font-bold bg-background text-foreground border-emerald-500/50 focus:border-emerald-500"
                            autoFocus
                          />
                          {form.name && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, name: "" }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded"
                              title="Sil"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Paket / Koli İçi Bilgisi */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Paket / Koli İçi Bilgisi (Açıklama)
                          </label>
                          {form.description && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, description: "" }))}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
                              title="Açıklamayı temizle"
                            >
                              <X className="h-3 w-3" />
                              <span>Temizle</span>
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            value={form.description}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            placeholder="Örn: Koli içi 12 Adet veya Paket içi 6 Adet"
                            maxLength={300}
                            className="h-7 pr-8 text-[11px] sm:text-xs bg-background text-foreground border-border"
                          />
                          {form.description && (
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, description: "" }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded"
                              title="Sil"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {/* Hızlı Koli / Paket Şablonları */}
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          <span className="text-[10px] text-muted-foreground">Hızlı ekle:</span>
                          {[
                            "Koli içi 12 Adet",
                            "Koli içi 24 Adet",
                            "Paket içi 6 Adet",
                            "1 Koli",
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, description: preset }))}
                              className="px-1.5 py-0.2 rounded text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Kategori ve Birim */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Kategori
                          </label>
                          <select
                            value={form.category}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className="h-8 w-full px-2 text-xs font-medium rounded-md border border-border bg-background text-foreground cursor-pointer"
                          >
                            {PRODUCT_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">
                            Birim
                          </label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={form.unit}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, unit: e.target.value }))
                              }
                              placeholder="adet, koli..."
                              maxLength={20}
                              className="h-8 text-xs bg-background text-foreground border-border"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              {["adet", "koli", "paket"].map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => setForm((prev) => ({ ...prev, unit: u }))}
                                  className={`px-1.5 py-1 text-[10px] font-medium rounded border cursor-pointer ${
                                    form.unit.toLowerCase() === u
                                      ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80 border-border"
                                  }`}
                                >
                                  {u}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ALT ÇUBUK: KAYDET VE VAZGEÇ BUTONLARI */}
                  <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={reset}
                      className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Vazgeç</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void submit()}
                      className="h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm cursor-pointer"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Değişiklikleri Kaydet</span>
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2 sm:p-3 shadow-card overflow-hidden transition-all ${
                  isArchived
                    ? "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <img
                      src={getPublicProductImageUrl(p.image_url, p.name, p.category)}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => handleProductImageError(e, p.name, p.category)}
                      className="h-full w-full object-contain p-1 bg-white"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        {p.name}
                      </span>
                      {isArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`"${p.name}" ürününü sil`}
                          disabled={actionBusy}
                          className="h-6 px-2 py-0 text-rose-700 hover:text-white hover:bg-rose-600 rounded-md shrink-0 inline-flex items-center gap-1 cursor-pointer border border-rose-400/60 bg-rose-500/15 dark:text-rose-300 dark:bg-rose-950/50 font-bold transition-all shadow-xs"
                          onClick={() => void permanentlyDeleteProduct(p)}
                          title={`"${p.name}" ürününü direkt sil`}
                        >
                          <Trash2 className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                          <span className="text-[11px] font-bold">Sil</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span>
                        {categoryLabel(p.category)} · {p.unit}
                      </span>
                      {extractPackageOrBoxInfo(p.description, p.unit, p.name, p.id) &&
                        (() => {
                          const info = extractPackageOrBoxInfo(
                            p.description,
                            p.unit,
                            p.name,
                            p.id,
                          )!;
                          const isPack = info.toLowerCase().startsWith("paket");
                          return (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                isPack
                                  ? "text-purple-700 bg-purple-500/10 border-purple-500/30"
                                  : "text-amber-700 bg-amber-500/10 border-amber-500/30"
                              }`}
                            >
                              {isPack ? (
                                <Package className="h-3 w-3 text-purple-600" />
                              ) : (
                                <Boxes className="h-3 w-3 text-amber-600" />
                              )}
                              {info}
                            </span>
                          );
                        })()}
                      {cleanProductDescription(p.description) && (
                        <span className="text-muted-foreground/80 hidden sm:inline">
                          · {cleanProductDescription(p.description)}
                        </span>
                      )}
                      {isArchived ? (
                        <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          ● Arşivde (Gizli)
                        </span>
                      ) : inStock ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ● Stokta
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          ● Tükendi
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Aksiyon Butonları Grubu */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isArchived ? (
                    // ARŞİVDEKİ ÜRÜN İÇİN: Geri Yükle ve Kalıcı Sil
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => void restoreProduct(p)}
                        className="h-7 sm:h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold rounded-lg border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 gap-1 cursor-pointer"
                        title="Ürünü tekrar aktif kataloğa al"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Geri Yükle</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => void permanentlyDeleteProduct(p)}
                        className="h-7 sm:h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold rounded-lg border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-600 hover:text-white dark:text-rose-400 dark:hover:text-white gap-1 cursor-pointer transition-colors"
                        title={`"${p.name}" ürününü direkt sil`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 group-hover:text-white" />
                        <span>Kalıcı Sil</span>
                      </Button>
                    </>
                  ) : (
                    // AKTİF ÜRÜN İÇİN BUTONLAR: Stok Durumu, Düzenle, Arşive Kaldır (Sil)
                    <>
                      {/* STOKTA VAR / YOK BUTONU */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void toggleStockStatus(p)}
                        className={`h-7 sm:h-8 px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          inStock
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/50"
                        }`}
                        title={
                          inStock
                            ? "Stokta Var (Tıklayın: Yok yap)"
                            : "Stokta Yok (Tıklayın: Var yap)"
                        }
                      >
                        {isBusy ? (
                          <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                        ) : inStock ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className="ml-1 text-[10.5px] sm:text-xs">
                          {inStock ? "Var" : "Yok"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Düzenle"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingId(p.id);
                          setForm({
                            name: p.name || "",
                            description: cleanProductDescription(p.description),
                            category: p.category || "gida",
                            unit: p.unit || "adet",
                            image_url: p.image_url ?? "",
                            is_active: p.is_active ?? true,
                          });
                        }}
                        title="Ürünü Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Arşive Kaldır"
                        disabled={actionBusy}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 cursor-pointer"
                        onClick={() => void archiveProduct(p)}
                        title="Doğrudan Arşive Kaldır"
                      >
                        <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Kalıcı Olarak Sil"
                        disabled={actionBusy}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-rose-600 hover:text-white hover:bg-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                        onClick={() => {
                          if (
                            window.confirm(
                              `"${p.name}" adlı ürünü kalıcı olarak silmek istediğinizden emin misiniz? Bu ürün kataloğa asla geri gelmeyecektir.`,
                            )
                          ) {
                            void permanentlyDeleteProduct(p);
                          }
                        }}
                        title="Ürünü Kalıcı Olarak Sil (Geri Gelmez)"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KALICI SİLME ONAY DİYALOĞU (Yalnızca Arşivden) */}
      <AlertDialog
        open={Boolean(permanentDeletingProduct)}
        onOpenChange={(open) => !open && setPermanentDeletingProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Ürünü Kalıcı Olarak Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span>
                <strong>"{permanentDeletingProduct?.name}"</strong> adlı ürünü veritabanından{" "}
                <strong>tamamen silmek</strong> üzeresiniz.
              </span>
              <span className="block text-xs text-destructive/90 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium">
                ⚠️ Bu işlem geri alınamaz. Eğer bu ürün geçmiş sipariş kayıtlarında yer alıyorsa,
                sipariş tutarlılığı için silme işlemi engellenecektir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>İptal</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={() =>
                permanentDeletingProduct && void permanentlyDeleteProduct(permanentDeletingProduct)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kalıcı Olarak Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const updateUser = useServerFn(updateAppUser);
  const resetPassword = useServerFn(resetAppUserPassword);
  const removeUser = useServerFn(deleteAppUser);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "admin" | "customer">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users"],
    refetchInterval: 5000,
    queryFn: async () => {
      const userMap = new Map<string, AppUser>();

      const normalizePhoneDigits = (ph?: string | null) => {
        if (!ph) return "";
        const d = ph.replace(/\D/g, "");
        return d.startsWith("0") ? d.slice(1) : d;
      };

      // 1. Doğrudan profiles tablosundan çek (Supabase)
      try {
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, full_name, business_name, phone, address, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (!profError && profiles && profiles.length > 0) {
          for (const p of profiles) {
            if (isUserDeleted(p.id, p.phone)) continue;
            const isGuest = p.phone === "misafir" || p.full_name?.toLowerCase().includes("misafir");
            const admin = isUserAdmin({ id: p.id }, p);
            const key = normalizePhoneDigits(p.phone) || p.id;
            userMap.set(key, {
              id: p.id,
              email: isGuest ? "misafir@kotoptan.local" : null,
              phone: p.phone,
              created_at: p.created_at,
              last_sign_in_at: null,
              is_admin: admin,
              full_name: p.full_name,
              business_name: isGuest
                ? "Misafir Hesabı"
                : p.business_name || (admin ? "Kotoptan Yönetim" : ""),
              profile_phone: p.phone,
              address: p.address,
            });
          }
        }
      } catch (err) {
        console.warn("Direct profiles query fallback:", err);
      }

      // 2. Sunucu API (/api/users) üzerinden kayıtlı müşterileri çek
      try {
        const serverRes = await fetch("/api/users");
        if (serverRes.ok) {
          const sData = await serverRes.json();
          if (Array.isArray(sData.users)) {
            for (const su of sData.users) {
              if (isUserDeleted(su.id, su.phone)) continue;
              const key = normalizePhoneDigits(su.phone) || su.id;
              if (!userMap.has(key)) {
                userMap.set(key, {
                  id: su.id,
                  email: su.email || null,
                  phone: su.phone,
                  created_at: su.created_at || new Date().toISOString(),
                  last_sign_in_at: null,
                  is_admin: su.role === "admin",
                  full_name: su.fullName,
                  business_name: su.businessName,
                  profile_phone: su.phone,
                  address: su.address,
                });
              }
            }
          }
        }
      } catch (apiErr) {
        console.warn("API users fetch fallback:", apiErr);
      }

      // 3. Yerel kayıtlı kullanıcıları ekle (getStoredLocalUsers)
      try {
        const localRegistered = getAllRegisteredUsers();
        for (const lu of localRegistered) {
          if (isUserDeleted(lu.id, lu.phone)) continue;
          const key = normalizePhoneDigits(lu.phone) || lu.id;
          if (!userMap.has(key)) {
            userMap.set(key, {
              id: lu.id,
              email: lu.email,
              phone: lu.phone,
              created_at: new Date().toISOString(),
              last_sign_in_at: null,
              is_admin: lu.role === "admin",
              full_name: lu.fullName,
              business_name: lu.businessName,
              profile_phone: lu.phone,
              address: lu.address,
            });
          }
        }
      } catch (luErr) {
        console.warn("Local registered users fallback:", luErr);
      }

      // 4. Sabit yöneticileri ve misafir hesabını garanti ekle
      for (const adm of ADMIN_MEMBERS) {
        if (isUserDeleted(adm.id, adm.phone)) continue;
        const key = adm.normalizedPhone;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: adm.id,
            email: adm.email,
            phone: adm.phone,
            created_at: new Date().toISOString(),
            last_sign_in_at: null,
            is_admin: true,
            full_name: adm.name,
            business_name: "Kotoptan Yönetim",
            profile_phone: adm.phone,
            address: "Bitlis Depo",
          });
        }
      }

      if (!userMap.has("misafir") && !isUserDeleted("misafir", "05000000000")) {
        userMap.set("misafir", {
          id: GUEST_ACCOUNT.id,
          email: GUEST_ACCOUNT.email,
          phone: GUEST_ACCOUNT.phone,
          created_at: new Date().toISOString(),
          last_sign_in_at: null,
          is_admin: false,
          full_name: GUEST_ACCOUNT.name,
          business_name: "Misafir Hesabı (Ziyaretçi)",
          profile_phone: GUEST_ACCOUNT.phone,
          address: "Ziyaretçi",
        });
      }

      return Array.from(userMap.values()).filter((u) => !isUserDeleted(u.id, u.phone));
    },
  });

  // Gerçek zamanlı müşteri kaydı event dinleyicisi (sonsuz tetiklemeyi önlemek için debounced)
  const refetchUsersRef = useRef(refetch);
  refetchUsersRef.current = refetch;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refetchUsersRef.current();
      }, 400);
    };
    window.addEventListener("kotoptan:users-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("kotoptan:users-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const users = data ?? [];

  const refreshUsers = async () => {
    await refetch();
    await qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const full_name = String(form.get("full_name") ?? "").trim();
      const business_name = String(form.get("business_name") ?? "").trim();
      const phone = String(form.get("phone") ?? "").trim();
      const address = String(form.get("address") ?? "").trim();

      // 1. Doğrudan supabase profiles tablosunu güncelle
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: editing.id,
        full_name,
        business_name,
        phone,
        address,
      });
      if (profileError) throw profileError;

      // 2. Server function çağrısı (varsa ek yetki güncellemesi)
      try {
        await updateUser({
          data: {
            id: editing.id,
            full_name,
            business_name,
            phone,
            address,
          },
        });
      } catch (err) {
        console.warn("Server updateUser fallback:", err);
      }

      await refreshUsers();
      setEditing(null);
      toast.success("Üye bilgileri güncellendi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Bilgiler güncellenemedi");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordUser) return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    setBusy(true);
    try {
      // Eğer kendi oturumunun şifresini değiştiriyorsa
      const { data: currentAuth } = await supabase.auth.getUser();
      if (currentAuth?.user?.id === passwordUser.id) {
        const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
        if (upErr) throw upErr;
      }

      try {
        await resetPassword({
          data: { id: passwordUser.id, password: newPassword },
        });
      } catch (err) {
        console.warn("resetPassword server fallback:", err);
      }

      setPasswordUser(null);
      toast.success("Yeni şifre kaydedildi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Şifre değiştirilemedi");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      if (
        isUserAdmin({ id: deleting.id }, { phone: deleting.phone, full_name: deleting.full_name })
      ) {
        toast.error("Sabit sistem yöneticisi hesapları sistem güvenliği için silinemez.");
        setDeleting(null);
        return;
      }

      const targetId = deleting.id;
      const targetPhone = deleting.phone || deleting.profile_phone || "";

      // 1. Tarayıcı yerel hafızasından sil ve kalıcı silindi olarak işaretle
      markUserAsDeleted(targetId);
      if (targetPhone) {
        markUserAsDeleted(targetPhone);
      }
      deleteLocalUser(targetId);
      if (targetPhone) {
        deleteLocalUser(targetPhone);
      }

      // 2. İstemci önbelleğini anında güncelle
      qc.setQueryData<AppUser[]>(["admin", "users"], (prev) =>
        (prev ?? []).filter((u) => !isUserDeleted(u.id, u.phone)),
      );

      // 3. Supabase Profiles tablosundan silmeyi dene
      try {
        await supabase.from("profiles").delete().eq("id", targetId);
      } catch (sbErr) {
        console.warn("Supabase profile deletion warning:", sbErr);
      }
      if (targetPhone) {
        try {
          await supabase.from("profiles").delete().eq("phone", targetPhone);
        } catch {
          // ignore
        }
      }

      // 4. Server API (/api/users?id=...) üzerinden sil
      try {
        await fetch(`/api/users?id=${encodeURIComponent(targetId)}`, {
          method: "DELETE",
        });
        if (targetPhone) {
          await fetch(`/api/users?id=${encodeURIComponent(targetPhone)}`, {
            method: "DELETE",
          });
        }
      } catch (apiErr) {
        console.warn("Server user deletion warning:", apiErr);
      }

      // 5. TanStack Server Function çağrısı
      try {
        await removeUser({ data: { id: targetId } });
      } catch (err) {
        console.warn("removeUser server function fallback:", err);
      }

      await refreshUsers();
      setDeleting(null);
      toast.success("Üye hesabı başarıyla silindi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Hesap silinemedi");
    } finally {
      setBusy(false);
    }
  };

  // Filtreleme
  const filteredUsers = users.filter((u) => {
    const isGuest = u.phone === "misafir" || u.full_name?.toLowerCase().includes("misafir");
    if (filterType === "admin" && !u.is_admin) return false;
    if (filterType === "customer" && u.is_admin) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.business_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.profile_phone?.toLowerCase().includes(q) ||
      (isGuest && "misafir".includes(q))
    );
  });

  const adminCount = users.filter((u) => u.is_admin).length;
  const customerCount = users.filter((u) => !u.is_admin).length;

  return (
    <div className="mt-6 space-y-6">
      {/* İstatistik ve Açıklama Başlığı */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Toplam Kayıtlı Üye</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-xl border border-[#166534]/30 bg-[#166534]/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#166534]">Sistem Yöneticileri</span>
            <ShieldCheck className="h-4 w-4 text-[#166534]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#166534]">{adminCount} Kişi</p>
          <p className="text-[11px] text-[#166534]/80">Yetkili Yönetici Ekibi</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Müşteriler & Misafir</span>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{customerCount}</p>
          <p className="text-[11px] text-muted-foreground">Misafir hesabı aktif (123456)</p>
        </div>
      </div>

      {/* Arama ve Filtreleme Barı */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, telefon veya işletme adına göre ara..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tümü ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("admin")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "admin"
                  ? "bg-background text-[#166534] shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yöneticiler ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("customer")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "customer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Müşteriler ({customerCount})
            </button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refreshUsers()}
            title="Listeyi Yenile"
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const isGuest = u.phone === "misafir" || u.full_name?.toLowerCase().includes("misafir");
            return (
              <div
                key={u.id}
                className={`rounded-xl border p-4 shadow-sm transition-colors ${
                  u.is_admin
                    ? "border-[#166534]/40 bg-[#166534]/[0.03]"
                    : isGuest
                      ? "border-amber-500/30 bg-amber-500/[0.02]"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground text-base">
                    {u.full_name || u.business_name || "İsimsiz üye"}
                  </span>
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#166534]/15 px-2.5 py-0.5 text-xs font-semibold text-[#166534]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Yönetici (Şifre: 123456)
                    </span>
                  ) : isGuest ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Misafir Hesabı (Şifre: 123456)
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Müşteri
                    </span>
                  )}
                  {u.created_at && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                  {u.business_name && (
                    <p>
                      <strong className="text-foreground/80">İşletme:</strong> {u.business_name}
                    </p>
                  )}
                  {(u.profile_phone || u.phone) && (
                    <p>
                      <strong className="text-foreground/80">Telefon / Giriş:</strong>{" "}
                      <span className="font-mono text-foreground font-medium">
                        {u.profile_phone || u.phone}
                      </span>
                    </p>
                  )}
                  {u.email && (
                    <p>
                      <strong className="text-foreground/80">Sistem E-posta:</strong> {u.email}
                    </p>
                  )}
                  {u.address && (
                    <p className="sm:col-span-2">
                      <strong className="text-foreground/80">Adres:</strong> {u.address}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                    <Pencil className="h-4 w-4" /> Bilgileri düzenle
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPasswordUser(u)}>
                    <KeyRound className="h-4 w-4" /> Şifre belirle
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (u.is_admin) {
                        toast.error(
                          "Sabit sistem yöneticisi hesapları güvenlik nedeniyle silinemez.",
                        );
                        return;
                      }
                      setDeleting(u);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Hesabı sil
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Arama kriterine uygun üye bulunamadı.</p>
            </div>
          )}
        </div>
      )}

      {/* Düzenleme Diyaloğu */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Üye bilgilerini düzenle</DialogTitle>
            <DialogDescription>
              Telefon veya işletme bilgileri güncellendiğinde sisteme anında yansır.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={saveUser}>
              <div>
                <Label htmlFor="edit-full-name">Ad soyad</Label>
                <Input
                  id="edit-full-name"
                  name="full_name"
                  defaultValue={editing.full_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-business">İşletme adı</Label>
                <Input
                  id="edit-business"
                  name="business_name"
                  defaultValue={editing.business_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={editing.profile_phone || editing.phone || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Adres</Label>
                <Textarea
                  id="edit-address"
                  name="address"
                  defaultValue={editing.address}
                  required
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  Kaydet
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Şifre Belirleme Diyaloğu */}
      <Dialog open={passwordUser !== null} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni şifre belirle</DialogTitle>
            <DialogDescription>
              {passwordUser?.business_name || passwordUser?.full_name} için en az 6 karakterli yeni
              şifre girin.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePassword}>
            <div>
              <Label htmlFor="new-password">Yeni şifre</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                minLength={6}
                maxLength={72}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Şifreyi kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Diyaloğu */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Üye hesabı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.business_name || deleting?.full_name} hesabı kalıcı olarak silinecek.
              Sipariş geçmişi bulunan hesaplar silinmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hesabı sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
