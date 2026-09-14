import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, districtLabel } from "@/lib/catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/siparislerim")({
  head: () => ({
    meta: [
      { title: "Siparişlerim — KasımOğulları Ltd. Şti." },
      { name: "description", content: "Geçmiş sipariş taleplerinizi ve durumlarını görüntüleyin." },
      { property: "og:title", content: "Siparişlerim — KasımOğulları Ltd. Şti." },
      { property: "og:description", content: "Sipariş taleplerinizin durumunu takip edin." },
    ],
  }),
  component: MyOrders,
});

type OrderRow = {
  id: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  note: string;
  district: string;
  address: string;
  order_items: { id: string; product_name: string; unit: string; quantity: number }[];
};

const isPast = (o: OrderRow) =>
  o.archived_at !== null || o.status === "teslim" || o.status === "iptal";

function OrderCard({ order }: { order: OrderRow }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Sipariş #{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleString("tr-TR")}
          </p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          {statusLabel(order.status)}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {order.order_items.map((i) => (
          <li key={i.id} className="flex justify-between border-b border-border/60 py-1">
            <span>{i.product_name}</span>
            <span className="font-semibold">
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
        <span className="font-medium text-foreground">Adres:</span> {districtLabel(order.district)} — {order.address}
      </p>
    </article>
  );
}

function MyOrders() {
  const [showPast, setShowPast] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, archived_at, status, note, district, address, order_items(id, product_name, unit, quantity)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const orders = data ?? [];
  const active = orders.filter((o) => !isPast(o));
  const past = orders.filter(isPast);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-foreground">Siparişlerim</h1>

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
                <OrderCard key={o.id} order={o} />
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
                    <OrderCard key={o.id} order={o} />
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
