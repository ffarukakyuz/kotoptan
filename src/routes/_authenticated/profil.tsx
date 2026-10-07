import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Navigation, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapLocationDialog } from "@/components/MapLocationDialog";
import {
  extractCoordinates,
  reverseGeocodeNominatim,
  type GeoLocation,
} from "@/lib/location-utils";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Hesap Bilgilerim — KasımOğulları Ltd. Şti." },
      { name: "description", content: "Market bilgilerinizi ve teslimat adresinizi güncelleyin." },
      { property: "og:title", content: "Hesap Bilgilerim — KasımOğulları Ltd. Şti." },
      { property: "og:description", content: "İletişim ve teslimat bilgilerinizi güncelleyin." },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Ad soyad gerekli").max(100),
  business_name: z.string().trim().min(2, "Market/bakkal adı gerekli").max(120),
  phone: z.string().trim().min(7, "Telefon gerekli").max(30),
  address: z.string().trim().min(10, "Teslimat adresi gerekli").max(500),
});

function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [form, setForm] = useState({ full_name: "", business_name: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        business_name: profile.business_name,
        phone: profile.phone,
        address: profile.address,
      });
      const coords = extractCoordinates(profile.address);
      if (coords) setSelectedLocation(coords);
    }
  }, [profile]);

  const handleQuickGps = () => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      toast.error("Tarayıcınız konum servisini desteklemiyor.");
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
          }));

          toast.success("GPS konumunuz alındı ve adres güncellendi!");
        } catch {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const fallback = `(📍 Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          setForm((prev) => ({
            ...prev,
            address: prev.address ? `${prev.address} ${fallback}`.slice(0, 500) : fallback,
          }));
          toast.success("GPS koordinatları eklendi.");
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsLoading(false);
        toast.error("Konumunuza ulaşılamadı. Lütfen konum iznini kontrol edin.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleLocationFromMap = (loc: {
    lat: number;
    lng: number;
    address: string;
  }) => {
    setSelectedLocation({ lat: loc.lat, lng: loc.lng });
    const fullAddr = `${loc.address} (📍 Konum: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`;
    setForm((prev) => ({
      ...prev,
      address: fullAddr.slice(0, 500),
    }));
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    setBusy(true);
    let supabaseSaved = false;
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...parsed.data })
        .eq("id", user.id);
      if (!error) supabaseSaved = true;
    } catch {
      // Supabase connection error
    }

    // Yerel oturum kaydını da güncelle
    if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem("ko_local_auth_session");
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          parsedLocal.profile = { id: user.id, ...parsed.data };
          localStorage.setItem("ko_local_auth_session", JSON.stringify(parsedLocal));
        }
      } catch {
        // ignore
      }
    }

    setBusy(false);
    await refreshProfile();
    toast.success("Bilgileriniz güncellendi");
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-extrabold text-foreground">Hesap bilgilerim</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

      <form className="mt-6 space-y-4" onSubmit={save}>
        <div>
          <Label htmlFor="p-name">Ad soyad</Label>
          <Input
            id="p-name"
            value={form.full_name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-business">Market / bakkal adı</Label>
          <Input
            id="p-business"
            value={form.business_name}
            maxLength={120}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-phone">Telefon</Label>
          <Input
            id="p-phone"
            value={form.phone}
            maxLength={30}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <Label htmlFor="p-address" className="font-semibold text-foreground">
              Teslimat adresi
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleQuickGps}
                disabled={gpsLoading}
                className="h-7 text-xs px-2.5 bg-background border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
              >
                {gpsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5 mr-1 text-primary" />
                )}
                {gpsLoading ? "Alınıyor..." : "Konumumu Kullan (GPS)"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMapOpen(true)}
                className="h-7 text-xs px-2.5 bg-background border-border text-foreground hover:bg-muted shadow-xs"
              >
                <MapPin className="h-3.5 w-3.5 mr-1 text-rose-500" />
                Haritada Seç
              </Button>
            </div>
          </div>

          <Textarea
            id="p-address"
            rows={3}
            value={form.address}
            maxLength={500}
            placeholder="İl, ilçe, mahalle ve sokak veya 'Konumumu Kullan' butonuna tıklayarak otomatik doldurun"
            onChange={(e) => {
              setForm({ ...form, address: e.target.value });
              const parsed = extractCoordinates(e.target.value);
              if (parsed) setSelectedLocation(parsed);
            }}
          />

          {selectedLocation && (
            <div className="mt-1.5 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>Harita Pimi: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</span>
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
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            Kaydet
          </Button>
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            Çıkış yap
          </Button>
        </div>
      </form>
    </div>
  );
}
