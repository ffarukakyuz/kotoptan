import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, districtLabel } from "@/lib/catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, XCircle, Trash2, Loader2 } from "lucide-react";
import { extractCoordinates, getGoogleMapsNavigationUrl } from "@/lib/location-utils";
import { useAuth } from "@/hooks/useAuth";
import {
  mergeOrdersWithLocal,
  applyOrderPatch,
  permanentlyDeleteOrder,
  isArchivedOrder,
} from "@/lib/order-storage";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/siparislerim")({
  head: () => ({
    meta: [
      { title: "Siparişlerim — Kotoptan" },
      { name: "description", content: "Geçmiş sipariş taleplerinizi ve durumlarını görüntüleyin." },
      { property: "og:title", content: "Siparişlerim — Kotoptan" },
      { property: "og:description", content: "Sipariş taleplerinizin durumunu takip edin." },
    ],
  }),
  component: MyOrders,
});

type OrderRow = {
  id: string;
  user_id?: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  note: string;
  district: string;
  address: string;
  order_items: { id: string; product_name: string; unit: string; quantity: number }[];
};

const isPast = (o: OrderRow) => isArchivedOrder(o);

function OrderCard({
  order,
  onCancelled,
  onDeleted,
}: {
  order: OrderRow;
  onCancelled?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isPastOrder = isPast(order);

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await applyOrderPatch(order.id, {
        status: "iptal",
        archived_at: new Date().toISOString(),
      });
      toast.success("Sipariş iptal edildi.");
      setShowCancelDialog(false);
      onCancelled?.();
    } catch {
      toast.error("Sipariş iptal edilirken bir sorun oluştu.");
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await permanentlyDeleteOrder(order.id);
      toast.success("Sipariş geçmişten kalıcı olarak silindi.");
      setShowDeleteDialog(false);
      onDeleted?.(order.id);
    } catch {
      toast.error("Sipariş silinirken bir sorun oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">
              Sipariş #{String(order.id).slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-slate-500">
              {new Date(order.created_at).toLocaleString("tr-TR")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-800">
              {statusLabel(order.status)}
            </span>
            {!isPastOrder ? (
              <Button
                size="sm"
                variant="outline"
                disabled={cancelling}
                className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer font-medium"
                onClick={() => setShowCancelDialog(true)}
                title="Siparişi İptal Et ve Geçmişe Aktar"
              >
                <XCircle className="h-3.5 w-3.5 mr-1 text-rose-600" />
                İptal Et
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={deleting}
                className="h-7 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
                onClick={() => setShowDeleteDialog(true)}
                title="Siparişi Kalıcı Olarak Sil"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                Kalıcı Sil
              </Button>
            )}
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {(order.order_items || []).map((i) => (
            <li key={i.id} className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-slate-800">{i.product_name}</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                {i.quantity} {i.unit}
              </span>
            </li>
          ))}
        </ul>
        {order.note && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Not:</span> {order.note}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Adres:</span>{" "}
          {districtLabel(order.district)} — {order.address}
        </p>

        {(() => {
          const coords = extractCoordinates(order.address) || extractCoordinates(order.note);
          if (!coords) return null;
          return (
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/50">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  Harita Pimi: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </span>
              <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                <a
                  href={getGoogleMapsNavigationUrl(coords.lat, coords.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Haritada Gör
                </a>
              </Button>
            </div>
          );
        })()}
      </article>

      {/* İptal Onay Diyaloğu */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Siparişi İptal Et
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-foreground/80">
              <span>
                <strong>#{order.id.slice(0, 8).toUpperCase()}</strong> numaralı siparişinizi iptal
                etmek istediğinize emin misiniz?
              </span>
              <span className="block text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border font-medium">
                Siparişiniz iptal edildikten sonra <strong>Geçmiş Siparişler</strong> bölümüne
                taşınacaktır.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Evet, İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kalıcı Silme Onay Diyaloğu */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Siparişi Kalıcı Olarak Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-foreground/80">
              <span>
                <strong>#{order.id.slice(0, 8).toUpperCase()}</strong> numaralı sipariş kaydını
                tamamen silmek istediğinize emin misiniz?
              </span>
              <span className="block text-xs text-destructive/90 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium">
                ⚠️ Bu işlem geri alınamaz. Sipariş listenizden kalıcı olarak çıkarılacaktır.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Kalıcı Olarak Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MyOrders() {
  const qc = useQueryClient();
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      void router.navigate({ to: "/yonetim", search: { tab: "orders" }, replace: true });
    }
  }, [isAdmin, loading, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      if (!user || isAdmin) return [];
      let remoteOrders: OrderRow[] = [];
      try {
        let query = supabase
          .from("orders")
          .select(
            "id, user_id, created_at, archived_at, status, note, district, address, order_items(id, product_name, unit, quantity)",
          );

        // KULLANICI İZOLASYONU GÜVENLİK FİLTRESİ:
        // Oturum açan müşteri ise KESİNLİKLE sadece kendi siparişlerini (WHERE user_id = current_user_id) getir.
        if (!isAdmin) {
          query = query.eq("user_id", user.id);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (!error && data) {
          remoteOrders = data as unknown as OrderRow[];
        }
      } catch (err) {
        console.warn("[MyOrders] Supabase fetch error:", err);
      }

      return mergeOrdersWithLocal<OrderRow>(remoteOrders, user.id, isAdmin);
    },
    enabled: Boolean(user),
  });

  const orders = data ?? [];
  const active = orders.filter((o) => !isPast(o));
  const past = orders.filter(isPast);

  const handleOrderChange = () => {
    void qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  const handleOrderDelete = (id: string) => {
    qc.setQueryData(["my-orders"], (prev: OrderRow[] | undefined) =>
      prev ? prev.filter((o) => o.id !== id) : [],
    );
    void qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Yönetici Siparişler Paneline yönlendiriliyorsunuz...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-foreground">Siparişlerim</h1>
        {isAdmin && (
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs cursor-pointer shadow-xs"
          >
            <Link to="/yonetim">
              <Navigation className="h-3.5 w-3.5" />
              Sevkiyat & Rota Haritası (Yönetim)
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">Henüz sipariş vermediniz.</p>
          <Button asChild className="mt-4">
            <Link to="/">Ürünlere göz at</Link>
          </Button>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aktif siparişiniz bulunmuyor.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {active.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onCancelled={handleOrderChange}
                  onDeleted={handleOrderDelete}
                />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="mt-8">
              <Button variant="outline" size="sm" onClick={() => setShowPast((v) => !v)}>
                {showPast ? "Geçmiş siparişleri gizle" : `Geçmiş siparişler (${past.length})`}
              </Button>
              {showPast && (
                <div className="mt-4 space-y-4 opacity-90">
                  {past.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onCancelled={handleOrderChange}
                      onDeleted={handleOrderDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
