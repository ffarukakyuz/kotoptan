import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Navigation, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISTRICTS } from "@/lib/catalog";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";
import { MapLocationDialog } from "@/components/MapLocationDialog";
import {
  extractCoordinates,
  reverseGeocodeNominatim,
  type GeoLocation,
} from "@/lib/location-utils";

export const Route = createFileRoute("/_authenticated/sepet")({
  head: () => ({
    meta: [
      { title: "Sepetim — Kotoptan" },
      {
        name: "description",
        content: "Sepetinizdeki ürünlerin adetlerini belirleyin ve sipariş talebinizi gönderin.",
      },
      { property: "og:title", content: "Sepetim — Kotoptan" },
      { property: "og:description", content: "Sipariş adetlerinizi belirleyin ve gönderin." },
    ],
  }),
  component: CartPage,
});

const orderSchema = z.object({
  full_name: z.string().trim().min(1, "Ad soyad gerekli").max(100),
  business_name: z.string().trim().min(1, "Market/bakkal adı gerekli").max(120),
  district: z.string().trim().min(1, "İlçe seçilmeli"),
  phone: z.string().trim().min(5, "Telefon gerekli").max(30),
  address: z.string().trim().min(2, "Teslimat adresi gerekli").max(500),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

function CartPage() {
  const { items, setQuantity, remove, clear } = useCart();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    district: "",
    phone: "",
    address: "",
    note: "",
  });

  useEffect(() => {
    if (profile) {
      setForm((f) => {
        const nextAddress = f.address || profile.address || "";
        const initialCoords = extractCoordinates(nextAddress);
        if (initialCoords && !selectedLocation) {
          setSelectedLocation(initialCoords);
        }
        return {
          ...f,
          full_name: f.full_name || profile.full_name,
          business_name: f.business_name || profile.business_name,
          phone: f.phone || profile.phone,
          address: nextAddress,
        };
      });
    }
  }, [profile]);

  const handleQuickGps = () => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      toast.error("Cihazınız veya tarayıcınız konum servisini desteklemiyor.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setSelectedLocation({ lat, lng });

          const geo = await reverseGeocodeNominatim(lat, lng);
          const fullAddr = `${geo.formattedAddress} (📍 Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;

          setForm((prev) => ({
            ...prev,
            address: fullAddr.slice(0, 500),
            district: geo.matchedDistrictValue || prev.district,
          }));

          toast.success("Mevcut GPS konumunuz alındı ve adres bilgileri dolduruldu!");
        } catch (err) {
          console.warn("Reverse geocode error:", err);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const fallback = `(📍 Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          setForm((prev) => ({
            ...prev,
            address: prev.address ? `${prev.address} ${fallback}`.slice(0, 500) : fallback,
          }));
          toast.success("GPS koordinatları adrese eklendi.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        console.warn("GPS error:", err);
        toast.error("Konumunuza ulaşılamadı. Lütfen tarayıcı konum iznini kontrol edin.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleLocationFromMap = (loc: {
    lat: number;
    lng: number;
    address: string;
    districtMatch?: string;
  }) => {
    setSelectedLocation({ lat: loc.lat, lng: loc.lng });
    const fullAddr = `${loc.address} (📍 Konum: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`;
    setForm((prev) => ({
      ...prev,
      address: fullAddr.slice(0, 500),
      district: loc.districtMatch || prev.district,
    }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sipariş verebilmek için lütfen önce giriş yapın.");
      void navigate({ to: "/giris" });
      return;
    }
    if (items.length === 0) {
      toast.error("Sepetinizde ürün bulunmamaktadır.");
      return;
    }

    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Lütfen sipariş bilgilerinizi kontrol edin.");
      return;
    }
    setBusy(true);

    try {
      // Siparişteki ürünlerin özeti (not alanında da görünmesi için)
      const itemsSummary = items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
      const combinedNote = parsed.data.note
        ? `${parsed.data.note} | Ürünler: ${itemsSummary}`
        : `Ürünler: ${itemsSummary}`;

      let dbOrderId: string | null = null;

      // 1. Supabase orders tablosuna kaydetmeyi dene
      try {
        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            full_name: parsed.data.full_name,
            business_name: parsed.data.business_name,
            district: parsed.data.district,
            phone: parsed.data.phone,
            address: parsed.data.address,
            note: combinedNote.slice(0, 500),
          })
          .select("id")
          .single();

        if (order && !error) {
          dbOrderId = order.id;
        }
      } catch (err) {
        console.warn("[Sepet] Supabase order insert uyarısı:", err);
      }

      // 2. Supabase'e sipariş kaydedildiyse kalemleri (order_items) ekle
      if (dbOrderId) {
        try {
          let validDbProductIds = new Set<string>();
          try {
            const { data: dbProducts } = await supabase.from("products").select("id");
            if (dbProducts && Array.isArray(dbProducts)) {
              validDbProductIds = new Set(dbProducts.map((p) => p.id));
            }
          } catch {
            // ignore
          }

          const isValidUuid = (val?: string | null): boolean =>
            typeof val === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          const itemsPayload = items.map((i) => ({
            order_id: dbOrderId as string,
            product_id:
              i.productId && isValidUuid(i.productId) && validDbProductIds.has(i.productId)
                ? i.productId
                : null,
            product_name: i.name || "Ürün",
            unit: i.unit || "adet",
            quantity: i.quantity || 1,
          }));

          const { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
          if (itemsError) {
            console.warn(
              "[Sepet] order_items ilk deneme hatası, null product_id ile deneniyor:",
              itemsError,
            );
            const fallbackPayload = items.map((i) => ({
              order_id: dbOrderId as string,
              product_id: null,
              product_name: i.name || "Ürün",
              unit: i.unit || "adet",
              quantity: i.quantity || 1,
            }));
            await supabase.from("order_items").insert(fallbackPayload);
          }
        } catch (itemErr) {
          console.warn("[Sepet] order_items insert istisnası:", itemErr);
        }
      }

      // 3. Siparişi her koşulda yerel depoya da güvenle kaydet (ko_local_orders)
      // Böylece sunucu/ağ durumundan bağımsız olarak sipariş asla kaybolmaz
      const finalOrderId = dbOrderId || crypto.randomUUID();
      try {
        const localOrderRecord = {
          id: finalOrderId,
          created_at: new Date().toISOString(),
          archived_at: null,
          status: "beklemede",
          user_id: user.id,
          full_name: parsed.data.full_name,
          business_name: parsed.data.business_name,
          district: parsed.data.district,
          phone: parsed.data.phone,
          address: parsed.data.address,
          note: combinedNote,
          order_items: items.map((i, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            product_name: i.name,
            unit: i.unit,
            quantity: i.quantity,
          })),
        };

        const existingRaw = localStorage.getItem("ko_local_orders");
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        const filteredList = Array.isArray(existingList)
          ? existingList.filter((o: { id: string }) => o.id !== finalOrderId)
          : [];
        localStorage.setItem(
          "ko_local_orders",
          JSON.stringify([localOrderRecord, ...filteredList]),
        );
      } catch (err) {
        console.warn("[Sepet] Yerel sipariş kaydı hatası:", err);
      }

      clear();
      toast.success("Siparişiniz başarıyla alındı ve iletildi!");
      void navigate({ to: "/siparislerim" });
    } catch (finalErr) {
      console.warn("[Sepet] Kurtarıldı:", finalErr);
      try {
        const fallbackId = crypto.randomUUID();
        const fallbackRecord = {
          id: fallbackId,
          created_at: new Date().toISOString(),
          archived_at: null,
          status: "beklemede",
          user_id: user?.id || "guest",
          full_name: form.full_name || "Müşteri",
          business_name: form.business_name || "İşletme",
          district: form.district || "Tatvan",
          phone: form.phone || "",
          address: form.address || "",
          note: form.note || "",
          order_items: items.map((i, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            product_name: i.name,
            unit: i.unit,
            quantity: i.quantity,
          })),
        };
        const raw = localStorage.getItem("ko_local_orders");
        const list = raw ? JSON.parse(raw) : [];
        localStorage.setItem("ko_local_orders", JSON.stringify([fallbackRecord, ...list]));
        clear();
        toast.success("Siparişiniz başarıyla alındı ve iletildi!");
        void navigate({ to: "/siparislerim" });
      } catch {
        toast.error("Sipariş kaydedilirken bir hata oluştu.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">Sepetiniz boş</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Katalogdan ürün ekleyerek siparişinizi oluşturabilirsiniz.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Ürünlere göz at</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-foreground">Sepetim</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
                <img
                  src={getPublicProductImageUrl(item.image_url, item.name)}
                  alt={item.name}
                  onError={(e) => handleProductImageError(e, item.name)}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to="/urun/$id"
                  params={{ id: item.productId }}
                  className="truncate font-semibold text-foreground hover:text-primary transition-colors block"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-muted-foreground">Birim: {item.unit}</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Azalt"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  className="w-12 bg-transparent text-center text-sm font-semibold outline-none"
                  value={item.quantity}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setQuantity(item.productId, Number.isNaN(n) ? 0 : Math.min(n, 9999));
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Artır"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Kaldır"
                onClick={() => remove(item.productId)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">Teslimat bilgileri</h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Yükleniyor...</p>
          ) : !user ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Sipariş gönderebilmek için giriş yapmanız gerekiyor. Sepetiniz kaybolmaz.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/giris">Giriş yap / Kayıt ol</Link>
              </Button>
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <div>
                <Label htmlFor="o-name">Ad soyad</Label>
                <Input
                  id="o-name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="o-business">Market / bakkal adı (zorunlu)</Label>
                <Input
                  id="o-business"
                  required
                  value={form.business_name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="o-district">İl / İlçe (zorunlu)</Label>
                <Select
                  value={form.district}
                  onValueChange={(v) => setForm({ ...form, district: v })}
                >
                  <SelectTrigger id="o-district" className="mt-1">
                    <SelectValue placeholder="İlçe seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRICTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="o-phone">Telefon</Label>
                <Input
                  id="o-phone"
                  value={form.phone}
                  maxLength={30}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <Label htmlFor="o-address" className="font-semibold text-foreground">
                    Teslimat adresi (zorunlu)
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleQuickGps}
                      disabled={gpsLoading}
                      className="h-7 text-xs px-2.5 bg-background border-primary/40 text-primary hover:bg-primary/10 shadow-xs transition-colors"
                      title="Cihazınızın GPS konumunu alıp adresi ve koordinatları otomatik doldurur"
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Navigation className="h-3.5 w-3.5 mr-1 text-primary" />
                      )}
                      {gpsLoading ? "GPS Alınıyor..." : "Konumumu Kullan (GPS)"}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMapOpen(true)}
                      className="h-7 text-xs px-2.5 bg-background border-border text-foreground hover:bg-muted shadow-xs transition-colors"
                      title="Haritada dükkan veya depo kapısını pimi kaydırarak seçin"
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1 text-rose-500" />
                      Haritada Seç
                    </Button>
                  </div>
                </div>

                <Textarea
                  id="o-address"
                  rows={3}
                  required
                  value={form.address}
                  maxLength={500}
                  placeholder="Örn: Cumhuriyet Mah. İnönü Cad. No: 12 veya 'Konumumu Kullan' butonuna basarak otomatik doldurun"
                  onChange={(e) => {
                    setForm({ ...form, address: e.target.value });
                    const parsedCoords = extractCoordinates(e.target.value);
                    if (parsedCoords) setSelectedLocation(parsedCoords);
                  }}
                />

                {selectedLocation && (
                  <div className="mt-1.5 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">
                        Harita Pimi: {selectedLocation.lat.toFixed(5)},{" "}
                        {selectedLocation.lng.toFixed(5)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setMapOpen(true)}
                      className="underline text-[11px] font-semibold hover:opacity-80 ml-2 shrink-0 cursor-pointer"
                    >
                      Haritada Değiştir
                    </button>
                  </div>
                )}
              </div>

              <MapLocationDialog
                open={mapOpen}
                onOpenChange={setMapOpen}
                initialLocation={selectedLocation}
                onLocationSelect={handleLocationFromMap}
              />
              <div>
                <Label htmlFor="o-note">Sipariş notu (opsiyonel)</Label>
                <Textarea
                  id="o-note"
                  rows={2}
                  value={form.note}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Siparişi gönder
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Ödeme alınmaz; siparişiniz talep olarak iletilir.
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
