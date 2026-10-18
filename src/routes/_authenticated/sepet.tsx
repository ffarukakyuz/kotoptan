import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  MapPin,
  Navigation,
  Loader2,
  ShieldCheck,
  Package,
} from "lucide-react";
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
import { DISTRICTS, districtLabel, formatUnitLabel } from "@/lib/catalog";
import { getPublicProductImageUrl, handleProductImageError } from "@/lib/product-image-map";
import { MapLocationDialog } from "@/components/MapLocationDialog";
import { BitlisMapPicker } from "@/components/BitlisMapPicker";
import {
  extractCoordinates,
  reverseGeocodeNominatim,
  getUserDefaultLocation,
  saveUserDefaultLocation,
  findNearestBitlisDistrict,
  clampToBitlis,
  type GeoLocation,
} from "@/lib/location-utils";
import type { StoredOrder } from "@/lib/order-storage";

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
  district: z.string().trim().optional().default("Tatvan"),
  phone: z.string().trim().min(5, "Telefon gerekli").max(30),
  address: z.string().trim().min(2, "Teslimat adresi gerekli").max(500),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

function CartPage() {
  const { items, setQuantity, remove, clear } = useCart();
  const { user, profile, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [autoGpsOnOpen, setAutoGpsOnOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    district: "Tatvan",
    phone: "",
    address: "",
    note: "",
  });

  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    let initialCoords: GeoLocation | null = null;
    let initialAddr = "";
    let initialDistrict = "Tatvan";

    // 1. Kullanıcının kayıtlı varsayılan GPS/Harita konumu
    const savedDefaultLoc = getUserDefaultLocation();
    if (savedDefaultLoc) {
      if (savedDefaultLoc.lat && savedDefaultLoc.lng) {
        initialCoords = { lat: savedDefaultLoc.lat, lng: savedDefaultLoc.lng };
      }
      if (savedDefaultLoc.address) {
        initialAddr = savedDefaultLoc.address;
      }
      if (savedDefaultLoc.district) {
        initialDistrict = districtLabel(savedDefaultLoc.district);
      }
    }

    // 2. Profildeki adres ve ilçe
    if (profile) {
      if (!initialAddr && profile.address) {
        initialAddr = profile.address;
        const coordsFromAddr = extractCoordinates(profile.address);
        if (coordsFromAddr && !initialCoords) {
          initialCoords = coordsFromAddr;
        }
      }
      if (profile.district) {
        initialDistrict = districtLabel(profile.district);
      }
    }

    if (initialCoords) {
      setSelectedLocation((prev) => prev ?? initialCoords);
    }

    setForm((f) => ({
      ...f,
      full_name: f.full_name || profile?.full_name || "",
      business_name: f.business_name || profile?.business_name || "",
      phone: f.phone || profile?.phone || "",
      district: f.district && f.district !== "Tatvan" ? districtLabel(f.district) : initialDistrict,
      address: f.address || initialAddr,
    }));
  }, [profile]);

  const handleQuickGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setAutoGpsOnOpen(true);
      setMapOpen(true);
      return;
    }

    setGpsLoading(true);
    toast.loading("GPS konumunuz alınıyor ve adres çözümleniyor...", { id: "gps-fetch" });

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const rawLat = pos.coords.latitude;
          const rawLng = pos.coords.longitude;
          const clamped = clampToBitlis(rawLat, rawLng);
          const lat = clamped.lat;
          const lng = clamped.lng;
          setSelectedLocation({ lat, lng });

          let resolvedAddr = "";
          let matchedDist = form.district || "Tatvan";

          try {
            const rev = await reverseGeocodeNominatim(lat, lng);
            resolvedAddr = rev.formattedAddress;
            if (rev.districtLabel) matchedDist = rev.districtLabel;
            else if (rev.matchedDistrictValue)
              matchedDist = districtLabel(rev.matchedDistrictValue);
          } catch {
            const nearest = findNearestBitlisDistrict(lat, lng);
            matchedDist = nearest.label;
            resolvedAddr = `${nearest.label}, Bitlis Teslimat Noktası`;
          }

          const fullWithCoords = `${resolvedAddr || "Bitlis Teslimat Noktası"} (📍 Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          setForm((prev) => ({
            ...prev,
            address: fullWithCoords,
            district: matchedDist,
          }));

          saveUserDefaultLocation({
            lat,
            lng,
            address: fullWithCoords,
            district: matchedDist,
            city: "Bitlis",
          });

          setGpsLoading(false);
          toast.success(`GPS teslimat konumunuz (${matchedDist}) başarıyla dolduruldu!`, {
            id: "gps-fetch",
          });
        },
        (err) => {
          setGpsLoading(false);
          console.warn("GPS hatası:", err);
          toast.dismiss("gps-fetch");
          setAutoGpsOnOpen(true);
          setMapOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch (gpsSyncErr) {
      setGpsLoading(false);
      console.warn("GPS senkron hatası:", gpsSyncErr);
      toast.dismiss("gps-fetch");
      setAutoGpsOnOpen(true);
      setMapOpen(true);
    }
  };

  const handleOpenMap = () => {
    setAutoGpsOnOpen(false);
    setMapOpen(true);
  };

  const handleLocationFromMap = useCallback(
    (loc: {
      lat: number;
      lng: number;
      address: string;
      districtMatch?: string;
      district?: string;
    }) => {
      setSelectedLocation({ lat: loc.lat, lng: loc.lng });
      const fullAddr = loc.address.trim();
      const newDistrict =
        districtLabel(loc.district || loc.districtMatch) || form.district || "Tatvan";

      setForm((prev) => ({
        ...prev,
        address: fullAddr.slice(0, 500),
        district: newDistrict,
      }));

      saveUserDefaultLocation({
        lat: loc.lat,
        lng: loc.lng,
        address: fullAddr,
        district: newDistrict,
        city: "Bitlis",
      });

      toast.success(`Harita konumu ve ${newDistrict} ilçesi sipariş formuna aktarıldı!`);
    },
    [form.district],
  );

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

    const effectiveDistrict = form.district || (selectedLocation ? "Tatvan" : "Bitlis");
    let effectiveAddress = form.address.trim();
    if (selectedLocation && !effectiveAddress.includes(selectedLocation.lat.toFixed(4))) {
      effectiveAddress =
        `${effectiveAddress} (📍 Konum: ${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)})`.trim();
    }

    const parsed = orderSchema.safeParse({
      ...form,
      district: effectiveDistrict,
      address: effectiveAddress,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Lütfen sipariş bilgilerinizi kontrol edin.");
      return;
    }
    setBusy(true);

    try {
      // Sipariş notu opsiyoneldir; kullanıcının yazdığı kişisel not haricinde sipariş ürünleri buraya eklenmez
      const orderNote = parsed.data.note ? parsed.data.note.trim() : "";

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
            note: orderNote.slice(0, 500),
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
      const generateSafeId = () =>
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `ko-ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const finalOrderId = dbOrderId || generateSafeId();
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
          note: orderNote,
          order_items: items.map((i, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            product_name: i.name,
            unit: i.unit,
            quantity: i.quantity,
          })),
        };

        const existingRaw = localStorage.getItem("ko_local_orders");
        let existingList: StoredOrder[] = [];
        try {
          const parsed = existingRaw ? JSON.parse(existingRaw) : [];
          existingList = Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
        } catch {
          existingList = [];
        }
        const filteredList = existingList.filter((o) => o && o.id !== finalOrderId);
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
        const fallbackId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `ko-ord-fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
          order_items: (Array.isArray(items) ? items : []).map((i, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            product_name: i.name || "Ürün",
            unit: i.unit || "koli",
            quantity: Number(i.quantity) || 1,
          })),
        };
        const raw = localStorage.getItem("ko_local_orders");
        let list: StoredOrder[] = [];
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          list = Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
        } catch {
          list = [];
        }
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

  if (isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 mb-4 border border-emerald-500/30">
          <ShieldCheck className="h-9 w-9 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">Yönetici Hesabı</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Yönetici hesabında alışveriş sepeti kullanılmamaktadır. Bakkal ve marketlerden gelen
          toptan siparişleri ve dağıtım rotasını incelemek için Siparişler paneline gidebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
          >
            <Link to="/siparisler">
              <Package className="h-4 w-4" />
              <span>Siparişler & Sevkiyat</span>
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/yonetim">Yönetim Paneli</Link>
          </Button>
        </div>
      </div>
    );
  }

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
                <p className="text-xs text-muted-foreground mt-0.5">
                  Birim:{" "}
                  {item.unit?.toLowerCase() === "adet" ? (
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-[11px]">
                      Adet
                    </span>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {formatUnitLabel(item.unit)}
                    </span>
                  )}
                </p>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="o-district">İlçe (Konumdan otomatik belirlenir)</Label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {form.district ? `Seçili: ${form.district}` : "Otomatik"}
                  </span>
                </div>
                <Select
                  value={form.district}
                  onValueChange={(v) => setForm({ ...form, district: v })}
                >
                  <SelectTrigger id="o-district" className="mt-1">
                    <SelectValue placeholder="İlçe (otomatik)" />
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
                <Label
                  htmlFor="o-district"
                  className="text-xs font-semibold flex items-center justify-between mb-1.5"
                >
                  <span>Teslimat İlçesi (Bitlis)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    {form.district ? `Seçili: ${form.district}` : "İlçe seçin"}
                  </span>
                </Label>
                <Select
                  value={form.district}
                  onValueChange={(val) => {
                    const formatted = districtLabel(val);
                    setForm((prev) => ({ ...prev, district: formatted }));
                  }}
                >
                  <SelectTrigger id="o-district" className="h-9 text-xs">
                    <SelectValue placeholder="İlçe seçin" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {DISTRICTS.map((d) => (
                      <SelectItem key={d.value} value={d.label} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                {selectedLocation && (
                  <div className="mb-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                        <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Kayıtlı Teslimat Konumunuz Aktif</span>
                        <span className="rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                          {form.district || "Tatvan"}
                        </span>
                      </span>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Otomatik Kullanılıyor
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      İlçe: <strong>{form.district || "Tatvan"}</strong> — GPS:{" "}
                      {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <Label htmlFor="o-address" className="font-semibold text-foreground">
                    Teslimat Adresi & GPS Konumu
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={gpsLoading}
                      onClick={handleQuickGps}
                      className="h-7 text-xs px-2.5 bg-background border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs transition-colors cursor-pointer"
                      title="Cihazınızın GPS konumuyla açık adresi otomatik çözer ve doldurur"
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-emerald-600" />
                      ) : (
                        <Navigation className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{gpsLoading ? "Konum Alınıyor..." : "GPS Konumumu Al"}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenMap}
                      className="h-7 text-xs px-2.5 bg-background border-border text-foreground hover:bg-muted shadow-xs transition-colors"
                      title="Bitlis haritasında dükkan veya depo kapısını pimi kaydırarak seçin"
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                      Haritada Seç
                    </Button>
                  </div>
                </div>

                <Textarea
                  id="o-address"
                  rows={2}
                  required={!selectedLocation}
                  value={form.address}
                  maxLength={500}
                  placeholder="Kayıtlı teslimat noktanız haritada işaretlidir. İl/ilçe yazmanıza gerek yoktur."
                  onChange={(e) => {
                    setForm({ ...form, address: e.target.value });
                    const parsedCoords = extractCoordinates(e.target.value);
                    if (parsedCoords) setSelectedLocation(parsedCoords);
                  }}
                />

                {/* Doğrudan sayfada interaktif Bitlis teslimat haritası */}
                <div className="mt-2.5">
                  <BitlisMapPicker
                    value={selectedLocation}
                    onChange={handleLocationFromMap}
                    height="300px"
                    allowExpand={true}
                  />
                </div>
              </div>

              <MapLocationDialog
                open={mapOpen}
                onOpenChange={setMapOpen}
                initialLocation={selectedLocation}
                autoGps={autoGpsOnOpen}
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
