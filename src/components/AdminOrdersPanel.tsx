import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Phone,
  MapPin,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  mergeOrdersWithLocal,
  applyOrderPatch,
  permanentlyDeleteOrder,
  isArchivedOrder,
  saveAllOrdersToSystem,
  type StoredOrder,
} from "@/lib/order-storage";

export function AdminOrdersPanel({ onNavigateToDrive }: { onNavigateToDrive?: () => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"aktif" | "arsiv">("aktif");
  const [filter, setFilter] = useState("hepsi");
  const [search, setSearch] = useState("");
  const [orderToDelete, setOrderToDelete] = useState<StoredOrder | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: rawOrders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      let remoteOrders: StoredOrder[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, archived_at, status, full_name, business_name, district, phone, address, note, order_items(id, product_name, unit, quantity)",
          )
          .order("created_at", { ascending: false });
        if (!error && data) {
          remoteOrders = data as StoredOrder[];
        }
      } catch (err) {
        console.warn("[Admin] remote orders notice:", err);
      }

      return mergeOrdersWithLocal<StoredOrder>(remoteOrders, null, true);
    },
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }, [qc]);

  useEffect(() => {
    const handleOrdersUpdated = () => refresh();
    window.addEventListener("orders_updated", handleOrdersUpdated);
    window.addEventListener("storage", handleOrdersUpdated);
    return () => {
      window.removeEventListener("orders_updated", handleOrdersUpdated);
      window.removeEventListener("storage", handleOrdersUpdated);
    };
  }, [refresh]);

  const patchOrder = async (
    id: string,
    patch: { status?: string; archived_at?: string | null; note?: string },
    okMessage: string,
  ) => {
    try {
      await applyOrderPatch(id, patch);
      toast.success(okMessage);
      refresh();
    } catch {
      toast.error("Sipariş güncellenemedi.");
    }
  };

  const executeDeleteOrder = async (order: StoredOrder) => {
    if (!order?.id) return;
    setIsDeletingOrder(true);
    try {
      qc.setQueryData(["admin-orders"], (prev: StoredOrder[] | undefined) =>
        prev ? prev.filter((o) => o.id !== order.id) : [],
      );
      await permanentlyDeleteOrder(order.id);
      toast.success("Sipariş başarıyla silindi");
      refresh();
    } catch {
      toast.error("Sipariş silinirken bir hata oluştu");
    } finally {
      setIsDeletingOrder(false);
      setOrderToDelete(null);
    }
  };

  const all = Array.isArray(rawOrders) ? rawOrders : [];
  const scopedActive = all.filter((o) => !isArchivedOrder(o));
  const scopedPast = all.filter((o) => isArchivedOrder(o));
  const scoped = view === "arsiv" ? scopedPast : scopedActive;

  const filteredOrders = useMemo(() => {
    return scoped.filter((o) => {
      if (filter !== "hepsi" && o.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = o.full_name?.toLowerCase().includes(q);
        const matchBiz = o.business_name?.toLowerCase().includes(q);
        const matchPhone = o.phone?.toLowerCase().includes(q);
        const matchDistrict = o.district?.toLowerCase().includes(q);
        const matchItems = o.order_items?.some((i) => i.product_name?.toLowerCase().includes(q));
        if (!matchName && !matchBiz && !matchPhone && !matchDistrict && !matchItems) return false;
      }
      return true;
    });
  }, [scoped, filter, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "bekliyor":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
          >
            Bekliyor
          </Badge>
        );
      case "hazirlaniyor":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
          >
            Hazırlanıyor
          </Badge>
        );
      case "yolda":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
          >
            Yolda / Dağıtımda
          </Badge>
        );
      case "teslim":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
          >
            Teslim Edildi
          </Badge>
        );
      case "iptal":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
          >
            İptal
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Üst İstatistik & Filtre Çubuğu */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        {/* Aktif / Arşiv Butonları */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setView("aktif")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              view === "aktif"
                ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aktif Siparişler ({scopedActive.length})
          </button>
          <button
            type="button"
            onClick={() => setView("arsiv")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              view === "arsiv"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tamamlanan / Geçmiş ({scopedPast.length})
          </button>
        </div>

        {/* Arama Kutusu & Yenileme */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müşteri, telefon veya ürün ara..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={async () => {
              setIsSaving(true);
              try {
                const res = await saveAllOrdersToSystem(rawOrders);
                toast.success(
                  res.count > 0
                    ? `${res.count} sipariş sisteme kaydedildi.`
                    : "Siparişler sisteme kaydedildi.",
                );
                refresh();
              } catch {
                toast.error("Sisteme kaydedilemedi.");
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="h-8 px-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer shrink-0 gap-1 shadow-xs"
            title="Tüm siparişleri sisteme kaydet"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Sisteme Kaydet</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            className="h-8 px-2.5 text-xs cursor-pointer shrink-0"
            title="Listeyi Yenile"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
          </Button>
        </div>
      </div>

      {/* Durum Filtreleri */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] text-muted-foreground mr-1 font-semibold">Durum:</span>
        {[
          { id: "hepsi", label: `Tümü (${scoped.length})` },
          { id: "bekliyor", label: "Bekleyenler" },
          { id: "hazirlaniyor", label: "Hazırlanıyor" },
          { id: "yolda", label: "Yolda" },
          { id: "teslim", label: "Teslim Edilenler" },
          { id: "iptal", label: "İptal" },
        ].map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setFilter(st.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filter === st.id
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Sipariş Listesi */}
      {isLoading ? (
        <div className="space-y-3 py-6">
          <div className="h-28 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-28 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-2 bg-muted/10">
          <Package className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">
            {search
              ? "Arama kriterine uygun sipariş bulunamadı."
              : view === "aktif"
                ? "Henüz aktif sipariş bulunmuyor."
                : "Geçmiş sipariş bulunmuyor."}
          </p>
          <p className="text-xs text-muted-foreground">
            Müşteriler sipariş verdiğinde anında burada listelenir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const itemCount = Array.isArray(order.order_items)
              ? order.order_items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)
              : 0;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 hover:border-emerald-500/40 transition-colors"
              >
                {/* Başlık: Müşteri & Durum */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm sm:text-base">
                        {order.business_name || order.full_name || "İsimsiz Müşteri"}
                      </span>
                      {order.business_name && order.full_name && (
                        <span className="text-xs text-muted-foreground">({order.full_name})</span>
                      )}
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>No: #{order.id.slice(-6).toUpperCase()}</span>
                      <span>•</span>
                      <span>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Tarihsiz"}
                      </span>
                      {order.district && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-foreground/80">{order.district}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Telefon Arama */}
                  {order.phone && (
                    <a
                      href={`tel:${order.phone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 text-xs font-bold border border-emerald-500/30 w-fit"
                      title="Müşteriyi Ara"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{order.phone}</span>
                    </a>
                  )}
                </div>

                {/* Adres ve Not */}
                {(order.address || order.note) && (
                  <div className="text-xs space-y-1 bg-muted/30 p-2.5 rounded-lg">
                    {order.address && (
                      <p className="text-foreground/90 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{order.address}</span>
                      </p>
                    )}
                    {order.note && (
                      <p className="text-muted-foreground italic pl-5">
                        Müşteri Notu: "{order.note}"
                      </p>
                    )}
                  </div>
                )}

                {/* Sipariş Edilen Ürünler */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground block">
                    Sipariş Ürünleri ({itemCount} parça):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {order.order_items?.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50 text-xs"
                      >
                        <span className="font-semibold text-foreground truncate pr-2">
                          {item.product_name}
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {item.quantity} {item.unit || "adet"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alt Aksiyon Çubuğu: Durum Değiştirme & Silme */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      Durumu Değiştir:
                    </span>
                    <button
                      type="button"
                      disabled={order.status === "bekliyor"}
                      onClick={() =>
                        void patchOrder(
                          order.id,
                          { status: "bekliyor" },
                          "Durum 'Bekliyor' olarak güncellendi",
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                        order.status === "bekliyor"
                          ? "bg-amber-500 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Bekliyor
                    </button>
                    <button
                      type="button"
                      disabled={order.status === "hazirlaniyor"}
                      onClick={() =>
                        void patchOrder(
                          order.id,
                          { status: "hazirlaniyor" },
                          "Durum 'Hazırlanıyor' olarak güncellendi",
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                        order.status === "hazirlaniyor"
                          ? "bg-blue-600 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Hazırlanıyor
                    </button>
                    <button
                      type="button"
                      disabled={order.status === "yolda"}
                      onClick={() =>
                        void patchOrder(
                          order.id,
                          { status: "yolda" },
                          "Durum 'Yolda' olarak güncellendi",
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                        order.status === "yolda"
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Yolda
                    </button>
                    <button
                      type="button"
                      disabled={order.status === "teslim"}
                      onClick={() =>
                        void patchOrder(
                          order.id,
                          { status: "teslim", archived_at: new Date().toISOString() },
                          "Sipariş 'Teslim Edildi' olarak arşivlendi",
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                        order.status === "teslim"
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Teslim Edildi
                    </button>
                    <button
                      type="button"
                      disabled={order.status === "iptal"}
                      onClick={() =>
                        void patchOrder(
                          order.id,
                          { status: "iptal", archived_at: new Date().toISOString() },
                          "Sipariş 'İptal' olarak arşivlendi",
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                        order.status === "iptal"
                          ? "bg-rose-600 text-white font-bold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      İptal
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {order.archived_at ? (
                      <button
                        type="button"
                        onClick={() =>
                          void patchOrder(
                            order.id,
                            { archived_at: null, status: "bekliyor" },
                            "Sipariş aktif siparişlere geri alındı",
                          )
                        }
                        className="px-2.5 py-1 text-xs text-primary hover:underline cursor-pointer"
                      >
                        Aktif Siparişlere Al
                      </button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOrderToDelete(order)}
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Sil
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Silme Onay Dialogu */}
      <AlertDialog
        open={Boolean(orderToDelete)}
        onOpenChange={(open) => !open && setOrderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sipariş Silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Bu sipariş kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOrder}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingOrder}
              onClick={(e) => {
                e.preventDefault();
                if (orderToDelete) void executeDeleteOrder(orderToDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingOrder ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Siparişi Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
