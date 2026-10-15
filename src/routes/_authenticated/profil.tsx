import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Navigation, Loader2, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapLocationDialog } from "@/components/MapLocationDialog";
import { BitlisMapPicker } from "@/components/BitlisMapPicker";
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
import { deleteLocalUser } from "@/data/users";
import {
  extractCoordinates,
  reverseGeocodeNominatim,
  findNearestBitlisDistrict,
  saveUserDefaultLocation,
  getUserDefaultLocation,
  type GeoLocation,
} from "@/lib/location-utils";
import { DISTRICTS, districtLabel } from "@/lib/catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Hesap Bilgilerim — Kotoptan" },
      { name: "description", content: "Market bilgilerinizi ve teslimat adresinizi güncelleyin." },
      { property: "og:title", content: "Hesap Bilgilerim — Kotoptan" },
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
  const [autoGpsOnOpen, setAutoGpsOnOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Tatvan");

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
      if (profile.district) {
        setSelectedDistrict(districtLabel(profile.district));
      } else {
        const defaultLoc = getUserDefaultLocation();
        if (defaultLoc?.district) {
          setSelectedDistrict(districtLabel(defaultLoc.district));
        }
      }
    }
  }, [profile]);

  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const handleQuickGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setAutoGpsOnOpen(true);
      setMapOpen(true);
      return;
    }

    setIsGpsLoading(true);
    toast.loading("GPS konumunuz alınıyor ve adres çözümleniyor...", { id: "profile-gps" });

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const rawLat = pos.coords.latitude;
          const rawLng = pos.coords.longitude;
          setSelectedLocation({ lat: rawLat, lng: rawLng });

          try {
            const rev = await reverseGeocodeNominatim(rawLat, rawLng);
            // İl, İlçe, Mahalle, Cadde/Sokak, Bina No
            const detailedAddr = rev.formattedAddress;
            const fullWithCoords =
              `${detailedAddr} (📍 Konum: ${rawLat.toFixed(6)}, ${rawLng.toFixed(6)})`.slice(
                0,
                500,
              );

            setForm((prev) => ({
              ...prev,
              address: fullWithCoords,
            }));
            toast.success("GPS konumu ve açık adres formu otomatik dolduruldu!", {
              id: "profile-gps",
            });
          } catch {
            const fallback = `Bitlis Teslimat Konumu (📍 Konum: ${rawLat.toFixed(6)}, ${rawLng.toFixed(6)})`;
            setForm((prev) => ({
              ...prev,
              address: fallback,
            }));
            toast.success("GPS konumu alındı!", { id: "profile-gps" });
          } finally {
            setIsGpsLoading(false);
          }
        },
        (err) => {
          console.warn("GPS hatası:", err);
          setIsGpsLoading(false);
          toast.error("GPS alınamadı. Harita üzerinden pini seçebilirsiniz.", {
            id: "profile-gps",
          });
          setAutoGpsOnOpen(false);
          setMapOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch (gpsSyncErr) {
      console.warn("GPS senkron hatası:", gpsSyncErr);
      setIsGpsLoading(false);
      toast.error("GPS servisi başlatılamadı. Lütfen konum izinlerinizi kontrol edin.", {
        id: "profile-gps",
      });
      setAutoGpsOnOpen(false);
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
      city?: string;
      district?: string;
      neighbourhood?: string;
      road?: string;
      houseNumber?: string;
    }) => {
      setSelectedLocation({ lat: loc.lat, lng: loc.lng });
      // Detaylı adres veya formatted adresi hazırla
      let fullAddr = loc.address.trim();
      if (!fullAddr.includes("📍 Konum:")) {
        fullAddr = `${fullAddr} (📍 Konum: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`;
      }
      if (loc.district) {
        setSelectedDistrict(districtLabel(loc.district));
      }
      setForm((prev) => {
        const newAddr = fullAddr.slice(0, 500);
        if (prev.address === newAddr) return prev;
        return {
          ...prev,
          address: newAddr,
        };
      });
      toast.success("Haritadan adres ve koordinatlar alındı!");
    },
    [],
  );

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    setBusy(true);

    // Koordinat ve ilçe bilgisini tespit et
    const coords = extractCoordinates(parsed.data.address) || selectedLocation;
    let districtName = selectedDistrict || "Tatvan";
    if (!selectedDistrict && coords) {
      districtName = findNearestBitlisDistrict(coords.lat, coords.lng).label;
    }

    let supabaseSaved = false;
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...parsed.data, district: districtName })
        .eq("id", user.id);
      if (!error) supabaseSaved = true;
    } catch {
      // Supabase connection error
    }

    if (coords) {
      saveUserDefaultLocation({
        lat: coords.lat,
        lng: coords.lng,
        address: parsed.data.address,
        district: districtName,
        city: "Bitlis",
      });
    }

    // Yerel oturum kaydını ve sunucu kullanıcı eşitlemesini de güncelle
    if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem("ko_local_auth_session");
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          parsedLocal.profile = { id: user.id, ...parsed.data, district: districtName };
          localStorage.setItem("ko_local_auth_session", JSON.stringify(parsedLocal));
        }
      } catch {
        // ignore
      }

      // Ayrıca /api/users uç noktasına da kaydet (anında admin listesine düşmesi için)
      try {
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            phone: parsed.data.phone,
            name: parsed.data.full_name,
            businessName: parsed.data.business_name,
            address: parsed.data.address,
            district: districtName,
            lat: coords?.lat,
            lng: coords?.lng,
          }),
        });
      } catch {
        // ignore
      }
    }

    setBusy(false);
    await refreshProfile();
    toast.success("Bilgileriniz ve teslimat konumunuz başarıyla kaydedildi!");
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    toast.loading("Hesabınız siliniyor...", { id: "delete-acc" });
    try {
      const userId = user.id;
      const userPhone = profile?.phone || form.phone || "";

      // 1. Supabase Profiles tablosundan sil
      try {
        await supabase.from("profiles").delete().eq("id", userId);
      } catch (e) {
        console.warn("Supabase profile delete error:", e);
      }

      // 2. Server API üzerinden sil
      try {
        await fetch(`/api/users?id=${encodeURIComponent(userId)}`, { method: "DELETE" });
        if (userPhone) {
          await fetch(`/api/users?id=${encodeURIComponent(userPhone)}`, { method: "DELETE" });
        }
      } catch (e) {
        console.warn("Server user delete error:", e);
      }

      // 3. Yerel depolamadan sil
      deleteLocalUser(userId);
      if (userPhone) deleteLocalUser(userPhone);

      toast.success("Hesabınız başarıyla silindi", { id: "delete-acc" });
      await signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/giris";
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Hesap silinemedi", {
        id: "delete-acc",
      });
      setIsDeletingAccount(false);
    }
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
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="p-district" className="font-semibold text-foreground text-xs">
              Teslimat İlçesi (Bitlis)
            </Label>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Seçili: {selectedDistrict}
            </span>
          </div>
          <Select
            value={selectedDistrict}
            onValueChange={(val) => {
              const formatted = districtLabel(val);
              setSelectedDistrict(formatted);
            }}
          >
            <SelectTrigger id="p-district" className="h-9 text-xs">
              <SelectValue placeholder="İlçe seçin (Tatvan, Ahlat, Adilcevaz...)" />
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
                disabled={isGpsLoading}
                className="h-7 text-xs px-2.5 bg-background border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                title="Mevcut GPS konumunuzu alır ve açık adresi otomatik doldurur"
              >
                {isGpsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-emerald-600" />
                ) : (
                  <Navigation className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                )}
                {isGpsLoading ? "GPS Alınıyor..." : "Mevcut Konumumu Kullan (GPS)"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleOpenMap}
                className="h-7 text-xs px-2.5 bg-background border-border text-foreground hover:bg-muted shadow-xs"
                title="Bitlis haritasında dükkan veya depo kapısını pimi kaydırarak seçin"
              >
                <MapPin className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                Haritada Seç
              </Button>
            </div>
          </div>

          <Textarea
            id="p-address"
            rows={2}
            value={form.address}
            maxLength={500}
            placeholder="İl, ilçe, mahalle ve sokak veya aşağıdaki Bitlis haritasından dükkanınızı işaretleyin"
            onChange={(e) => {
              setForm({ ...form, address: e.target.value });
              const parsed = extractCoordinates(e.target.value);
              if (parsed) setSelectedLocation(parsed);
            }}
          />

          {/* Doğrudan sayfada interaktif Bitlis haritası */}
          <div className="mt-2.5">
            <BitlisMapPicker
              value={selectedLocation}
              onChange={handleLocationFromMap}
              height="280px"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy}>
              Kaydet
            </Button>
            <Button type="button" variant="outline" onClick={() => void signOut()}>
              Çıkış yap
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9 px-3 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hesabımı Sil
          </Button>
        </div>
      </form>

      {/* Hesabımı Sil Onay Diyaloğu */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Hesabınızı Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Hesabınız, kayıtlı teslimat adresiniz ve profil bilgileriniz
              sistemden kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAccount ? "Siliniyor..." : "Evet, Hesabımı Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
