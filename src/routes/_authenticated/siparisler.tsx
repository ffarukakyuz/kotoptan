import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  MapPin,
  Truck,
  Phone,
  Navigation,
  Clock,
  CheckCircle2,
  XCircle,
  Milestone,
  ShieldCheck,
  RefreshCw,
  Building2,
  FileText,
  Map as MapIcon,
  Trash2,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Minus,
  PauseCircle,
  Loader2,
  Save,
  Route as RouteIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  mergeOrdersWithLocal,
  applyOrderPatch,
  permanentlyDeleteOrder,
  purgeAllTestOrders,
  isArchivedOrder,
  saveAllOrdersToSystem,
} from "@/lib/order-storage";
import { seedAllDistrictTestOrders } from "@/lib/district-sample-orders";
import {
  ADMIN_DISTRICT_FILTERS,
  matchesDistrictFilter,
  districtLabel,
  statusLabel,
  formatUnitLabel,
  ORDER_STATUSES,
} from "@/lib/catalog";
import {
  AdminDistrictRouteMap,
  computeOptimizedStops,
  type RouteOrderStop,
} from "@/components/AdminDistrictRouteMap";
import { extractCoordinates, getOSMNavigationUrl } from "@/lib/location-utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { AdminUnlockCard } from "@/components/AdminUnlockCard";

export const Route = createFileRoute("/_authenticated/siparisler")({
  head: () => ({
    meta: [
      { title: "Siparişler & Sevkiyat Rotası — Kotoptan" },
      {
        name: "description",
        content:
          "İlçe bazlı toptan siparişler, Tatvan merkezli akıllı teslimat rotası ve durak haritası.",
      },
    ],
  }),
  component: AdminOrdersRoutePage,
});

type OrderItem = {
  id: string;
  product_name: string;
  unit: string;
  quantity: number;
};

type DeliveryOrder = {
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
  order_items: OrderItem[];
};

function AdminOrdersRoutePage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const [view, setView] = useState<"aktif" | "arsiv">("aktif");
  const [district, setDistrict] = useState("hepsi");
  const [statusFilter, setStatusFilter] = useState("hepsi");
  const [routeMode, setRouteMode] = useState<"yolda" | "hepsi">("yolda");
  const [sortByRoute, setSortByRoute] = useState(true);
  const [showRouteMap, setShowRouteMap] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Kalıcı silme diyaloğu için sipariş
  const [orderToDelete, setOrderToDelete] = useState<DeliveryOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deneme siparişleri işlemleri
  const [isPurging, setIsPurging] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);

  // Fetch all orders
  const {
    data: rawOrders = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      let remoteOrders: DeliveryOrder[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, archived_at, status, full_name, business_name, district, phone, address, note, order_items(id, product_name, unit, quantity)",
          )
          .order("created_at", { ascending: false });
        if (!error && data) {
          remoteOrders = data as DeliveryOrder[];
        }
      } catch (err) {
        console.warn("[Siparişler] Remote orders query error:", err);
      }
      return mergeOrdersWithLocal<DeliveryOrder>(remoteOrders, null, true);
    },
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }, [qc]);

  // Aktif vs Geçmiş ayrımı
  const activeOrders = useMemo(() => {
    return rawOrders.filter((o) => !isArchivedOrder(o));
  }, [rawOrders]);

  const pastOrders = useMemo(() => {
    return rawOrders.filter((o) => isArchivedOrder(o));
  }, [rawOrders]);

  const scopedOrders = view === "arsiv" ? pastOrders : activeOrders;

  // Seçilen ilçe kapsamındaki siparişler
  const districtOrders = useMemo(() => {
    return scopedOrders.filter((o) => matchesDistrictFilter(o.district, district));
  }, [scopedOrders, district]);

  // Durum filtresine göre süzme
  const filteredOrders = useMemo(() => {
    return districtOrders.filter((o) => {
      if (statusFilter === "hepsi") return true;
      if (statusFilter === "yolda") return o.status === "yolda";
      if (statusFilter === "bekliyor") return o.status !== "yolda";
      return o.status === statusFilter;
    });
  }, [districtOrders, statusFilter]);

  // Rotaya dahil edilecek siparişler (yalnızca aktifte)
  const routedOrders = useMemo(() => {
    const activeInDistrict = activeOrders.filter((o) =>
      matchesDistrictFilter(o.district, district),
    );
    if (routeMode === "hepsi") {
      return activeInDistrict;
    }
    return activeInDistrict.filter((o) => o.status === "yolda");
  }, [activeOrders, district, routeMode]);

  // TSP optimize duraklar
  const optimizedStops = useMemo(() => {
    return computeOptimizedStops(routedOrders);
  }, [routedOrders]);

  // Durak numarası arama haritası
  const stopLookup = useMemo(() => {
    const map = new Map<string, RouteOrderStop>();
    optimizedStops.forEach((s) => map.set(s.id, s));
    return map;
  }, [optimizedStops]);

  // Sıralanmış siparişler
  const sortedOrders = useMemo(() => {
    if (view === "aktif" && sortByRoute) {
      return [...filteredOrders].sort((a, b) => {
        const stopA = stopLookup.get(a.id)?.stopNumber;
        const stopB = stopLookup.get(b.id)?.stopNumber;
        if (stopA !== undefined && stopB !== undefined) return stopA - stopB;
        if (stopA !== undefined) return -1;
        if (stopB !== undefined) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return [...filteredOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [filteredOrders, view, sortByRoute, stopLookup]);

  // Durum güncelleme / yama fonksiyonu
  const patchOrder = useCallback(
    async (
      id: string,
      patch: { status?: string; archived_at?: string | null; note?: string },
      msg: string,
    ) => {
      setUpdatingId(id);
      try {
        await applyOrderPatch(id, patch);
        toast.success(msg);
        refresh();
      } catch {
        toast.error("Sipariş güncellenemedi.");
      } finally {
        setUpdatingId(null);
      }
    },
    [refresh],
  );

  // Tüm siparişleri ve güncel durumları sisteme ve veritabanına kaydet
  const handleSaveOrdersToSystem = async () => {
    setIsSavingSystem(true);
    try {
      const res = await saveAllOrdersToSystem(rawOrders);
      toast.success(
        res.count > 0
          ? `${res.count} sipariş ve durum güncellemeleri başarıyla sisteme kaydedildi.`
          : "Siparişler sisteme kaydedildi.",
      );
      refresh();
    } catch {
      toast.error("Siparişler sisteme kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingSystem(false);
    }
  };

  // Kalıcı sipariş silme
  const executeDeleteOrder = async () => {
    if (!orderToDelete?.id) return;
    setIsDeleting(true);
    try {
      // Optimistik anında temizleme
      qc.setQueryData(["admin-orders"], (prev: DeliveryOrder[] | undefined) =>
        prev ? prev.filter((o) => o.id !== orderToDelete.id) : [],
      );
      await permanentlyDeleteOrder(orderToDelete.id);
      toast.success("Sipariş kalıcı olarak silindi.");
      refresh();
    } catch {
      toast.error("Sipariş silinirken bir sorun oluştu.");
      refresh();
    } finally {
      setIsDeleting(false);
      setOrderToDelete(null);
    }
  };

  // İlçedeki tüm bekleyenleri rotaya ekle
  const handleAddAllDistrictToRoute = useCallback(async () => {
    const waiting = activeOrders
      .filter((o) => matchesDistrictFilter(o.district, district))
      .filter((o) => o.status !== "yolda");
    if (waiting.length === 0) {
      toast.info("Bu ilçede rotaya eklenecek bekleyen sipariş bulunmuyor.");
      return;
    }
    for (const ord of waiting) {
      await applyOrderPatch(ord.id, { status: "yolda" });
    }
    toast.success(`${waiting.length} sipariş topluca rotaya eklendi ('Yolda').`);
    refresh();
  }, [activeOrders, district, refresh]);

  // Deneme siparişlerini sil
  const handlePurgeTestOrders = async () => {
    setIsPurging(true);
    try {
      const purged = await purgeAllTestOrders();
      toast.success(
        purged > 0
          ? `${purged} adet deneme siparişi temizlendi.`
          : "Tüm deneme siparişleri başarıyla temizlendi.",
      );
      refresh();
    } catch {
      toast.error("Deneme siparişleri silinirken bir sorun oluştu.");
    } finally {
      setIsPurging(false);
    }
  };

  // 6 ilçe için rota deneme siparişleri oluştur
  const handleSeedDistrictOrders = async () => {
    setIsSeeding(true);
    try {
      const res = await seedAllDistrictTestOrders();
      toast.success(
        `6 ilçe için toplam ${res.count} adet rota deneme siparişi başarıyla oluşturuldu!`,
      );
      refresh();
    } catch {
      toast.error("Deneme siparişleri oluşturulurken bir hata oluştu.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleScrollToCard = (orderId: string) => {
    const el = document.getElementById(`order-delivery-${orderId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-500", "shadow-lg");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500", "shadow-lg");
      }, 2500);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  // Müşteri hesabı doğrudan /siparisler linkine gelse dahi yönetici yetkilendirmesi zorunludur
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <AdminUnlockCard
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ["admin-orders"] });
          }}
          title="Yönetici Sipariş & Sevkiyat Paneli"
          description="Tüm toptan siparişleri ve dağıtım rotalarını görüntülemek için yetkili şifrenizi girin."
        />
        <div className="mt-4 text-center">
          <Link
            to="/siparislerim"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
          >
            ← Kendi siparişlerinizi görüntülemek için tıklayın
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* 1. ÜST BAŞLIK VE HIZLI AKSİYONLAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-xs">
                <Package className="h-5 w-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Siparişler & Sevkiyat Rotası
              </h1>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs"
              >
                {activeOrders.length} Aktif Sipariş
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              İlçe bazlı toptan siparişler, Tatvan Ana Depo çıkışlı akıllı sevkiyat haritası,
              sipariş arşivleme ve silme paneli.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurgeTestOrders}
              disabled={isPurging}
              className="h-8.5 px-3 text-xs gap-1.5 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer"
              title="Test ve deneme siparişlerini temizler"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isPurging ? "Siliniyor..." : "Testleri Sil"}</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSaveOrdersToSystem()}
              disabled={isSavingSystem}
              className="h-8.5 px-3.5 text-xs gap-1.5 font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs cursor-pointer"
              title="Tüm siparişleri, güncellemeleri ve durumları sisteme ve veritabanına kaydeder"
            >
              {isSavingSystem ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{isSavingSystem ? "Kaydediliyor..." : "Sisteme Kaydet"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="h-8.5 px-3 text-xs gap-1.5 font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-800 cursor-pointer shadow-xs"
              title="Siparişleri yenile"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`}
              />
              <span>Yenile</span>
            </Button>

            <Link
              to="/yonetim"
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-emerald-700 transition-colors shadow-xs cursor-pointer"
              title="Yönetim Paneline Git"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Yönetim</span>
            </Link>
          </div>
        </div>

        {/* 2. AKTİF VS GEÇMİŞ / ARŞİV SEKMELERİ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl p-1 bg-slate-200/80 border border-slate-300/80 gap-1">
            <button
              type="button"
              onClick={() => {
                setView("aktif");
                setStatusFilter("hepsi");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                view === "aktif"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="h-4 w-4 text-emerald-600" />
              <span>Aktif Siparişler & Sevkiyat</span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-extrabold">
                {activeOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setView("arsiv");
                setStatusFilter("hepsi");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                view === "arsiv"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Archive className="h-4 w-4 text-slate-600" />
              <span>Geçmiş / Arşivlenen Siparişler</span>
              <span className="rounded-full bg-slate-200 text-slate-800 px-2 py-0.5 text-xs font-bold">
                {pastOrders.length}
              </span>
            </button>
          </div>

          {view === "aktif" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDistrictOrders}
              disabled={isSeeding}
              className="h-8.5 px-3 text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 cursor-pointer shadow-xs gap-1.5"
            >
              <RouteIcon className="h-3.5 w-3.5 text-emerald-700" />
              <span>{isSeeding ? "Oluşturuluyor..." : "6 İlçe Rota Siparişi Ekle"}</span>
            </Button>
          )}
        </div>

        {/* 3. İLÇE SEÇİMİ (İlçeler Buton Barı) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-600" />
              İlçe Seçimi:
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Seçili İlçe:{" "}
              <strong className="text-slate-900">
                {district === "hepsi" ? "Tüm İlçeler" : districtLabel(district)}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
            {ADMIN_DISTRICT_FILTERS.map((d) => {
              const isSelected = district === d.value;
              const count = scopedOrders.filter((o) =>
                matchesDistrictFilter(o.district, d.value),
              ).length;

              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDistrict(d.value)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20 scale-[1.02]"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-emerald-500/40"
                  }`}
                >
                  <span>{d.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                      isSelected ? "bg-emerald-900 text-emerald-100" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. DURUM FİLTRELERİ */}
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="font-semibold text-slate-500 mr-1">Durum:</span>
          {view === "aktif"
            ? [
                { value: "hepsi", label: `Tüm Aktifler (${districtOrders.length})` },
                {
                  value: "yolda",
                  label: `🚚 Yolda (${districtOrders.filter((o) => o.status === "yolda").length})`,
                },
                {
                  value: "bekliyor",
                  label: `⏳ Bekliyor (${districtOrders.filter((o) => o.status !== "yolda").length})`,
                },
                { value: "yeni", label: "Yeni" },
                { value: "hazirlaniyor", label: "Hazırlanıyor" },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors cursor-pointer ${
                    statusFilter === s.value
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))
            : [
                { value: "hepsi", label: `Tüm Geçmiş (${districtOrders.length})` },
                {
                  value: "teslim",
                  label: `✅ Teslim Edildi (${districtOrders.filter((o) => o.status === "teslim").length})`,
                },
                {
                  value: "iptal",
                  label: `❌ İptal Edildi (${districtOrders.filter((o) => o.status === "iptal").length})`,
                },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors cursor-pointer ${
                    statusFilter === s.value
                      ? "bg-slate-800 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
        </div>

        {/* 5. ROTA HARİTA (Yalnızca Aktif Sevkiyatta) */}
        {view === "aktif" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <MapIcon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>
                      {district === "hepsi" ? "Tüm İlçeler" : districtLabel(district)} Sevkiyat
                      Rotası
                    </span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[11px] flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {routedOrders.length} Durak Yolda
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Tatvan Aydınlar Mah. Ana Depodan başlayarak teslimat durakları en yakın mesafeye
                    göre sıralanır.
                  </p>
                </div>
              </div>

              {/* Rota Butonları */}
              <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setRouteMode("yolda")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      routeMode === "yolda"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Sadece 'Yolda' olan siparişleri haritaya dizer"
                  >
                    <Truck className="h-3 w-3" />
                    <span>
                      Sadece Yoldakiler ({districtOrders.filter((o) => o.status === "yolda").length}
                      )
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteMode("hepsi")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      routeMode === "hepsi"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="İlçedeki tüm aktif siparişleri haritada gösterir"
                  >
                    <span>Tüm Aktifler ({districtOrders.length})</span>
                  </button>
                </div>

                {districtOrders.some((o) => o.status !== "yolda") && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleAddAllDistrictToRoute()}
                    className="h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs gap-1"
                    title="Bu bölgedeki tüm bekleyen siparişleri rotaya ekle"
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
                  className="h-8 text-xs font-semibold cursor-pointer gap-1"
                  title="Sipariş kartlarını en yakın duraktan uzağa doğru diz"
                >
                  <Milestone className="h-3.5 w-3.5" />
                  <span>{sortByRoute ? "Sıralama: Rota" : "Sıralama: Tarih"}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRouteMap((prev) => !prev)}
                  className="h-8 text-xs cursor-pointer bg-white"
                >
                  {showRouteMap ? "Haritayı Gizle" : "Haritayı Göster"}
                </Button>
              </div>
            </div>

            {/* Harita Bileşeni */}
            {showRouteMap && (
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-200">
                <AdminDistrictRouteMap
                  orders={routedOrders}
                  selectedDistrict={district}
                  onOrderClick={handleScrollToCard}
                />
              </div>
            )}
          </div>
        )}

        {/* 6. SİPARİŞLER LİSTESİ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <span>
                {view === "aktif" ? "Aktif Sipariş Listesi" : "Geçmiş / Arşivlenen Siparişler"}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({sortedOrders.length} sipariş)
              </span>
            </h2>

            <span className="text-xs text-slate-500">
              {view === "aktif" && sortByRoute
                ? "Durak sırasına göre sıralandı"
                : "Tarihe göre sıralandı"}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl bg-white" />
              <Skeleton className="h-32 w-full rounded-xl bg-white" />
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {view === "arsiv"
                  ? "Bu filtrede geçmiş veya arşivlenmiş sipariş bulunmuyor."
                  : district === "hepsi"
                    ? "Henüz aktif teslimat bekleyen sipariş bulunmuyor."
                    : `${districtLabel(district)} ilçesinde aktif sipariş bulunmuyor.`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {view === "arsiv"
                  ? "Teslim edilen veya iptal edilen siparişler burada güvenle arşivlenir."
                  : "Müşteriler sipariş verdiğinde burada listelenir ve rotaya alınabilir."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((o) => {
                const stopInfo = stopLookup.get(o.id);
                const coords = extractCoordinates(o.address) || extractCoordinates(o.note);
                const isUpdating = updatingId === o.id;
                const isEditing = editingId === o.id;

                return (
                  <article
                    key={o.id}
                    id={`order-delivery-${o.id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-md space-y-3"
                  >
                    {/* Kart Üst Bilgileri */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            {o.business_name || o.full_name || "İsimsiz Müşteri"}
                          </span>

                          {/* Rota Durak Rozeti */}
                          {view === "aktif" &&
                            (o.status === "yolda" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                                <Truck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                                {stopInfo ? (
                                  <>
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white font-extrabold">
                                      {stopInfo.stopNumber}
                                    </span>
                                    <span>
                                      {stopInfo.stopNumber}. Durak ({stopInfo.distanceFromDepotKm}{" "}
                                      km)
                                    </span>
                                  </>
                                ) : (
                                  <span>🚚 Yolda (Rotada)</span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                <span>⏳ Sevkiyatta Bekliyor</span>
                              </span>
                            ))}

                          {/* Geçmiş Sipariş Rozeti */}
                          {view === "arsiv" && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                o.status === "teslim"
                                  ? "bg-emerald-100 border border-emerald-300 text-emerald-800"
                                  : "bg-rose-100 border border-rose-300 text-rose-800"
                              }`}
                            >
                              {o.status === "teslim" ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  Teslim Edildi
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                  İptal Edildi
                                </>
                              )}
                            </span>
                          )}

                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold bg-slate-100 text-slate-800"
                          >
                            {districtLabel(o.district)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-0.5">
                          <span>
                            Yetkili: <strong className="text-slate-900">{o.full_name}</strong>
                          </span>
                          <span>•</span>
                          <a
                            href={`tel:${String(o.phone || "").replace(/\s+/g, "")}`}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {o.phone || ""}
                          </a>
                          <span>•</span>
                          <span>#{String(o.id).slice(0, 8).toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(o.created_at).toLocaleString("tr-TR")}</span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-start gap-1 pt-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{o.address}</span>
                        </div>

                        {coords && (
                          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                            <MapPin className="h-3 w-3 text-blue-600" />
                            <span>
                              Koordinat: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Durum Seçici Dropdown */}
                      <div className="w-full sm:w-48 shrink-0">
                        <Select
                          value={o.status}
                          disabled={isUpdating}
                          onValueChange={async (v) => {
                            const isFinished = v === "teslim" || v === "iptal";
                            await patchOrder(
                              o.id,
                              {
                                status: v,
                                archived_at: isFinished ? new Date().toISOString() : null,
                              },
                              v === "iptal"
                                ? `Sipariş iptal edildi ve Geçmiş'e aktarıldı.`
                                : isFinished
                                  ? `Sipariş "${statusLabel(v)}" olarak işaretlendi ve Arşivlendi.`
                                  : v === "yolda"
                                    ? "Sipariş teslimat rotasına dahil edildi ('Yolda')."
                                    : "Sipariş durumu güncellendi ('Bekliyor').",
                            );
                          }}
                        >
                          <SelectTrigger className="h-8.5 text-xs bg-white border-slate-200">
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

                    {/* Sipariş Kalemleri Tablosu */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        Sipariş Kalemleri ({(o.order_items || []).length} Çeşit):
                      </p>
                      <div className="divide-y divide-slate-200">
                        {o.order_items && o.order_items.length > 0 ? (
                          o.order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between py-1.5 text-xs"
                            >
                              <span className="font-medium text-slate-800">
                                {item.product_name}
                              </span>
                              <span
                                className={`font-bold px-2 py-0.5 rounded border text-xs ${
                                  item.unit?.toLowerCase() === "adet"
                                    ? "text-blue-600 bg-blue-50 border-blue-200"
                                    : "text-emerald-800 bg-emerald-50 border-emerald-200"
                                }`}
                              >
                                {item.quantity} {formatUnitLabel(item.unit)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic py-1">
                            Ürün kalemi bulunmuyor.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Not ve Düzenleme Alanı */}
                    {isEditing ? (
                      <div className="mt-2 space-y-1.5">
                        <Label
                          htmlFor={`note-${o.id}`}
                          className="text-xs font-semibold text-slate-700"
                        >
                          Sipariş Notunu Güncelle:
                        </Label>
                        <Textarea
                          id={`note-${o.id}`}
                          rows={2}
                          defaultValue={o.note}
                          maxLength={500}
                          placeholder="Müşteri teslimat notu..."
                          className="text-xs bg-white border-slate-200"
                          onBlur={(e) => {
                            if (e.target.value !== o.note) {
                              void patchOrder(o.id, { note: e.target.value }, "Not güncellendi.");
                            }
                          }}
                        />
                      </div>
                    ) : (
                      o.note && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-900">
                          <strong>Müşteri Notu:</strong> {o.note}
                        </div>
                      )
                    )}

                    {/* Kart Alt Aksiyon Butonları (Yönetim Gibi: Sil, Arşivle, Teslim, İptal, Navigasyon) */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Rotaya Ekle / Rotadan Çıkar */}
                        {view === "aktif" &&
                          (o.status !== "yolda" ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() =>
                                void patchOrder(
                                  o.id,
                                  { status: "yolda" },
                                  "Sipariş rotaya eklendi ('Yolda').",
                                )
                              }
                              className="h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs gap-1"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              <span>Rotaya Ekle</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() =>
                                void patchOrder(
                                  o.id,
                                  { status: "hazirlaniyor" },
                                  "Sipariş rotadan çıkarıldı.",
                                )
                              }
                              className="h-8 text-xs font-semibold text-amber-800 border-amber-300 hover:bg-amber-50 cursor-pointer gap-1"
                            >
                              <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span>Rotadan Çıkar</span>
                            </Button>
                          ))}

                        {/* Teslim Et Butonu */}
                        {o.status !== "teslim" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { status: "teslim", archived_at: new Date().toISOString() },
                                "Sipariş teslim edildi ve Geçmiş'e aktarıldı.",
                              )
                            }
                            className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs gap-1"
                            title="Teslimatı tamamla ve arşivle"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Teslim Edildi</span>
                          </Button>
                        )}

                        {/* İptal Et Butonu */}
                        {o.status !== "iptal" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { status: "iptal", archived_at: new Date().toISOString() },
                                "Sipariş iptal edildi.",
                              )
                            }
                            className="h-8 text-xs font-semibold text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            <span>İptal Et</span>
                          </Button>
                        )}

                        {/* Arşivle / Aktif Listeye Al */}
                        {isArchivedOrder(o) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { archived_at: null, status: "yeni" },
                                "Sipariş aktif listeye geri alındı.",
                              )
                            }
                            className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer gap-1"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Aktife Geri Al</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() =>
                              void patchOrder(
                                o.id,
                                { archived_at: new Date().toISOString() },
                                "Sipariş arşivlendi.",
                              )
                            }
                            className="h-8 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer gap-1"
                          >
                            <Archive className="h-3.5 w-3.5 text-slate-500" />
                            <span>Arşivle</span>
                          </Button>
                        )}

                        {/* Sisteme Kaydet Butonu */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => {
                            void patchOrder(o.id, {}, "Sipariş sisteme kaydedildi.");
                          }}
                          className="h-8 text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 cursor-pointer gap-1"
                          title="Bu siparişi ve güncel durumunu sisteme kaydet"
                        >
                          <Save className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Sisteme Kaydet</span>
                          <span className="sm:hidden">Kaydet</span>
                        </Button>

                        {/* Düzenle Butonu */}
                        <Button
                          type="button"
                          size="sm"
                          variant={isEditing ? "default" : "outline"}
                          onClick={() => setEditingId(isEditing ? null : o.id)}
                          className="h-8 text-xs cursor-pointer gap-1 bg-white border-slate-200 text-slate-800"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-600" />
                          <span>{isEditing ? "Kapat" : "Düzenle"}</span>
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Navigasyon Başlat */}
                        {coords && (
                          <a
                            href={getOSMNavigationUrl(coords.lat, coords.lng)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors shadow-xs"
                            title="Haritada yol tarifi aç"
                          >
                            <Navigation className="h-3.5 w-3.5 text-blue-600" />
                            <span className="hidden sm:inline">Navigasyon</span>
                          </a>
                        )}

                        {/* Kalıcı Sipariş Sil Butonu */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setOrderToDelete(o)}
                          className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer gap-1"
                          title="Bu siparişi kalıcı olarak sil"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          <span>Sil</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Sipariş Kalıcı Silme Onay Modalı */}
        <AlertDialog
          open={Boolean(orderToDelete)}
          onOpenChange={(open) => !open && setOrderToDelete(null)}
        >
          <AlertDialogContent className="bg-white text-slate-900 border-slate-200 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <Trash2 className="h-5 w-5" />
                Siparişi Kalıcı Olarak Sil
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-sm text-slate-600">
                <span>
                  <strong>
                    #
                    {String(orderToDelete?.id || "")
                      .slice(0, 8)
                      .toUpperCase()}
                  </strong>{" "}
                  numaralı ({orderToDelete?.business_name || orderToDelete?.full_name || "Müşteri"})
                  siparişini veritabanından <strong>tamamen silmek</strong> üzeresiniz.
                </span>
                <span className="block text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                  ⚠️ Bu işlem geri alınamaz. Sipariş sistemden tamamen yok edilecektir.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  void executeDeleteOrder();
                }}
                className="bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Kalıcı Olarak Sil"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
