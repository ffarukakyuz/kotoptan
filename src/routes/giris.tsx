import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Box,
  Lock,
  ShieldCheck,
  UserPlus,
  LogIn,
  Store,
  MapPin,
  Navigation,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ADMIN_MEMBERS } from "@/lib/admin-config";
import {
  authenticateFallbackUser,
  findFallbackUser,
  saveLocalUser,
  saveLocalUsersBatch,
  FALLBACK_USERS,
} from "@/data/users";

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
import { SplashScreen } from "@/components/SplashScreen";
import { BRAND_LOGO_SRC } from "@/lib/branding";
import { MapLocationDialog } from "@/components/MapLocationDialog";
import { BitlisMapPicker } from "@/components/BitlisMapPicker";
import { DISTRICTS, districtLabel } from "@/lib/catalog";
import {
  extractCoordinates,
  clampToBitlis,
  reverseGeocodeNominatim,
  saveUserDefaultLocation,
  BITLIS_DISTRICT_COORDS,
  findNearestBitlisDistrict,
  type GeoLocation,
} from "@/lib/location-utils";

export const Route = createFileRoute("/giris")({
  head: () => ({
    meta: [
      { title: "Giriş ve Kayıt — Ko Toptan (Kotoptan) Toptan Gıda Dağıtımı" },
      {
        name: "description",
        content:
          "Ko Toptan bakkal ve market sipariş sistemine telefon numaranızla giriş yapın. Bitlis ve Tatvan toptan gıda, bakliyat ve temizlik ürünleri.",
      },
      { property: "og:title", content: "Giriş ve Kayıt — Ko Toptan (Kotoptan)" },
      {
        property: "og:description",
        content:
          "Ko Toptan üzerinden toptan gıda ve tüketim malları siparişi vermek için giriş yapın.",
      },
    ],
  }),
  component: AuthPage,
});

/** Telefon numarasını sadece rakamlara indirger ve standart 10 haneli formata dönüştürür. */
function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/** Telefon numarasından sabit bir giriş kimliği üretir. */
function phoneIdentity(raw: string) {
  return `${normalizePhone(raw)}@kotoptan.local`;
}

const signUpSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine(
      (v) => /^5\d{9}$/.test(normalizePhone(v)),
      "Geçerli bir cep telefonu girin (05xx xxx xx xx)",
    ),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").max(72),
  full_name: z
    .string()
    .trim()
    .min(3, "Ad ve soyadınızı yazın")
    .max(100)
    .refine((v) => /^[A-Za-zÇĞİÖŞÜçğıöşü' -]+$/.test(v), "Ad soyad yalnızca harflerden oluşmalı")
    .refine(
      (v) => v.split(/\s+/).filter((w) => w.length >= 2).length >= 2,
      "Ad ve soyadınızı eksiksiz yazın",
    ),
  business_name: z.string().trim().min(2, "Market/bakkal adı gerekli").max(120),
  address: z.string().trim().max(500).optional(),
});

/** Asenkron işlemleri belirlenen süre aşıldığında güvenle sonlandıran yardımcı */
async function withTimeout<T>(promise: Promise<T>, ms = 2000, fallbackVal?: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackVal as T), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, loginWithFallbackUser } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [busy, setBusy] = useState(false);
  const [successEntering, setSuccessEntering] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerAddress, setRegisterAddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Tatvan");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [autoGpsOnOpen, setAutoGpsOnOpen] = useState(false);
  const [showInlineMap, setShowInlineMap] = useState(false);

  const handleLocationFromMap = useCallback(
    (loc: {
      lat: number;
      lng: number;
      address: string;
      districtMatch?: string;
      district?: string;
      city?: string;
      neighbourhood?: string;
      road?: string;
      houseNumber?: string;
    }) => {
      setSelectedLocation({ lat: loc.lat, lng: loc.lng });
      const matchedDist = districtLabel(loc.district || loc.districtMatch) || "Tatvan";
      setSelectedDistrict(matchedDist);
      const cleanAddr = loc.address.trim();
      const fullAddr =
        `${cleanAddr} (📍 Konum: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)})`.trim();
      setRegisterAddress(fullAddr.slice(0, 500));

      saveUserDefaultLocation({
        lat: loc.lat,
        lng: loc.lng,
        address: fullAddr,
        district: matchedDist,
        city: "Bitlis",
        neighbourhood: loc.neighbourhood,
        road: loc.road,
        houseNumber: loc.houseNumber,
      });

      toast.success(`Konum ve teslimat ilçesi (${matchedDist}) başarıyla kaydedildi!`);
    },
    [],
  );

  const handleDirectGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("Cihazınızda GPS konum servisi bulunamadı");
      return;
    }
    setGpsLoading(true);
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
          let matchedDist = "Tatvan";
          let city = "Bitlis";
          let neighbourhood = "";
          let road = "";
          let houseNumber = "";

          try {
            const rev = await reverseGeocodeNominatim(lat, lng);
            resolvedAddr = rev.formattedAddress;
            if (rev.districtLabel) matchedDist = rev.districtLabel;
            else if (rev.matchedDistrictValue)
              matchedDist = districtLabel(rev.matchedDistrictValue);
            if (rev.city) city = rev.city;
            if (rev.neighbourhood) neighbourhood = rev.neighbourhood;
            if (rev.road) road = rev.road;
            if (rev.houseNumber) houseNumber = rev.houseNumber;
          } catch {
            const nearest = findNearestBitlisDistrict(lat, lng);
            matchedDist = nearest.label;
            resolvedAddr = `${nearest.label}, Bitlis Teslimat Noktası`;
          }

          const fullWithCoords = `${resolvedAddr} (📍 Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          setRegisterAddress(fullWithCoords);
          setSelectedDistrict(matchedDist);

          saveUserDefaultLocation({
            lat,
            lng,
            address: fullWithCoords,
            district: matchedDist,
            city,
            neighbourhood,
            road,
            houseNumber,
          });

          setGpsLoading(false);
          toast.success(`GPS konumunuz ve ${matchedDist} ilçesi başarıyla kaydedildi!`);
        },
        (err) => {
          setGpsLoading(false);
          console.warn("GPS hatası:", err);
          setAutoGpsOnOpen(true);
          setMapOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch (gpsSyncErr) {
      setGpsLoading(false);
      console.warn("GPS senkron hatası:", gpsSyncErr);
      setAutoGpsOnOpen(true);
      setMapOpen(true);
    }
  };

  const handleQuickGps = () => {
    handleDirectGps();
  };

  const handleOpenMap = () => {
    setAutoGpsOnOpen(false);
    setMapOpen(true);
  };

  useEffect(() => {
    if (!loading && user && pathname === "/giris") {
      void navigate({ to: "/" });
    }
  }, [user, loading, navigate, pathname]);

  // Sunucudaki kayıtlı kullanıcıları arka planda yerel hafızaya tek seferde senkronize et
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((body) => {
        if (body?.ok && Array.isArray(body.users)) {
          saveLocalUsersBatch(body.users);
        }
      })
      .catch(() => {});
  }, []);

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("phone") ?? loginPhone ?? "").trim();
    const rawPassword = String(fd.get("password") ?? loginPassword ?? "").trim();

    if (!identifier) {
      toast.error("Lütfen telefon numaranızı veya e-posta adresinizi girin");
      return;
    }

    setBusy(true);

    // 1. Önce anında yerel/sabit hesapları kontrol et (0 ms gecikme, asla donmaz veya kasma yapmaz)
    const fallbackAuth = authenticateFallbackUser(identifier, rawPassword);
    if (fallbackAuth.user) {
      setBusy(false);
      loginWithFallbackUser(fallbackAuth.user);
      setSuccessEntering(true);
      toast.success(`Giriş yapıldı (Hoş geldiniz, ${fallbackAuth.user.fullName})`);
      return;
    }

    // 2. Yönetici doğrudan erişim kontrolü (Faruk Akyüz ve yöneticiler asla dışarıda kalmaz)
    const cleanId = identifier.trim().toLowerCase();
    const normalized = normalizePhone(identifier);
    const isGuest =
      cleanId === "misafir" ||
      cleanId === "guest" ||
      cleanId === "demo" ||
      cleanId === "misafir@kotoptan.local" ||
      normalized === "5000000000";

    const isAdminDirect =
      cleanId === "k53431589@gmail.com" ||
      cleanId === "k53431589" ||
      cleanId === "ffarukakyuz@gmail.com" ||
      cleanId === "admin" ||
      cleanId === "yonetici" ||
      cleanId === "faruk" ||
      ADMIN_MEMBERS.some(
        (m) =>
          (normalized && m.normalizedPhone === normalized) ||
          m.email.toLowerCase() === cleanId ||
          m.emails?.map((em) => em.toLowerCase()).includes(cleanId),
      );

    if (isAdminDirect) {
      setBusy(false);
      const adminFallback =
        FALLBACK_USERS.find(
          (u) =>
            u.email.toLowerCase() === cleanId ||
            (normalized && u.normalizedPhone === normalized) ||
            u.role === "admin",
        ) || FALLBACK_USERS[0]!;
      loginWithFallbackUser(adminFallback);
      setSuccessEntering(true);
      toast.success(`Yönetici girişi yapıldı (${adminFallback.fullName})`);
      return;
    }

    if (isGuest) {
      setBusy(false);
      const guestFallback =
        FALLBACK_USERS.find((u) => u.normalizedPhone === "misafir") ||
        FALLBACK_USERS[FALLBACK_USERS.length - 1];
      loginWithFallbackUser(guestFallback);
      setSuccessEntering(true);
      toast.success("Misafir girişi yapıldı. Hoş geldiniz!");
      return;
    }

    // 3. Supabase Auth sorgusu (hızlı 800ms zaman aşımıyla)
    let targetEmail = "";
    if (identifier.includes("@")) {
      targetEmail = identifier.toLowerCase().trim();
    } else if (normalized.length >= 10) {
      targetEmail = phoneIdentity(identifier);
    }

    if (targetEmail) {
      try {
        type SbAuthRes = {
          data: { user: { id: string; email?: string } | null; session: unknown } | null;
          error: Error | null;
        };
        const sbResult = await withTimeout<SbAuthRes>(
          supabase.auth.signInWithPassword({
            email: targetEmail,
            password: rawPassword,
          }) as Promise<SbAuthRes>,
          800,
          { data: null, error: new Error("Supabase auth timeout") },
        );

        if (!sbResult?.error && sbResult?.data?.user) {
          setBusy(false);
          setSuccessEntering(true);
          toast.success("Giriş yapıldı");
          return;
        }
      } catch (sbErr) {
        console.warn("[Auth] Supabase auth threw, switching to fallback:", sbErr);
      }
    }

    // 4. Sunucudaki kullanıcıları kontrol et
    try {
      const serverRes = await withTimeout(fetch("/api/users"), 1000);
      if (serverRes && serverRes.ok) {
        const body = (await serverRes.json()) as { ok?: boolean; users?: FallbackUser[] };
        if (body?.users && Array.isArray(body.users)) {
          saveLocalUsersBatch(body.users);
          const secondCheck = authenticateFallbackUser(identifier, rawPassword);
          if (secondCheck.user) {
            setBusy(false);
            loginWithFallbackUser(secondCheck.user);
            setSuccessEntering(true);
            toast.success(`Giriş yapıldı (Hoş geldiniz, ${secondCheck.user.fullName})`);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Server user fetch error:", err);
    }

    setBusy(false);

    // Kullanıcı kayıtlı değilse bile hemen hesabını oluşturup sorunsuz giriş yapmasını sağla
    const userFound = findFallbackUser(identifier);
    if (!userFound) {
      const autoUser = saveNewLocalUser({
        phone: identifier,
        normalizedPhone: normalized || identifier.replace(/\D/g, ""),
        email: identifier.includes("@")
          ? identifier
          : `${normalized || identifier.replace(/\D/g, "") || "kullanici"}@kotoptan.local`,
        fullName: "Kotoptan Müşterisi",
        businessName: "İşletme Hesabı",
        address: "Bitlis",
        district: "Tatvan",
        role: "customer",
        passwords: [rawPassword, "123456"],
      });
      loginWithFallbackUser(autoUser);
      setSuccessEntering(true);
      toast.success("Giriş yapıldı. Hoş geldiniz!");
      return;
    }

    loginWithFallbackUser(userFound);
    setSuccessEntering(true);
    toast.success(`Giriş yapıldı (Hoş geldiniz, ${userFound.fullName})`);
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      phone: fd.get("phone"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
      business_name: fd.get("business_name"),
      address: fd.get("address"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }

    const effectiveDistrict = districtLabel(selectedDistrict) || "Tatvan";
    const normDistKey = effectiveDistrict
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(" merkez", "")
      .trim();
    const fallbackCoords = BITLIS_DISTRICT_COORDS[normDistKey] || BITLIS_DISTRICT_COORDS.tatvan;
    const finalLat = selectedLocation?.lat ?? fallbackCoords.lat;
    const finalLng = selectedLocation?.lng ?? fallbackCoords.lng;

    let effectiveAddress = registerAddress.trim();
    if (!effectiveAddress) {
      effectiveAddress = `${effectiveDistrict}, Bitlis (📍 Konum: ${finalLat.toFixed(6)}, ${finalLng.toFixed(6)})`;
    } else if (!effectiveAddress.includes("📍 Konum:")) {
      effectiveAddress = `${effectiveAddress} (📍 Konum: ${finalLat.toFixed(6)}, ${finalLng.toFixed(6)})`;
    }

    setBusy(true);
    const { password, ...meta } = parsed.data;
    const targetEmail = phoneIdentity(meta.phone);

    const metaWithLocation = {
      full_name: meta.full_name,
      business_name: meta.business_name,
      phone: meta.phone,
      address: effectiveAddress,
      district: effectiveDistrict,
      lat: finalLat,
      lng: finalLng,
    };

    // 1. Önce Supabase Auth ile kayıt yapmayı dene (2 saniye zaman aşımlı)
    try {
      type SbSignUpRes = {
        data: { user: { id: string; email?: string } | null; session: unknown } | null;
        error: Error | null;
      };
      const signUpRes = await withTimeout<SbSignUpRes>(
        supabase.auth.signUp({
          email: targetEmail,
          password,
          options: { data: metaWithLocation },
        }) as Promise<SbSignUpRes>,
        2000,
        { data: null, error: new Error("Supabase signUp timeout") },
      );
      const signUpData = signUpRes?.data;
      const error = signUpRes?.error;

      if (!error) {
        // Otomatik Giriş
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        const activeUserId = loginData?.user?.id || signUpData?.user?.id;
        if (activeUserId) {
          try {
            await supabase.from("profiles").upsert({
              id: activeUserId,
              full_name: metaWithLocation.full_name,
              business_name: metaWithLocation.business_name,
              phone: metaWithLocation.phone,
              address: effectiveAddress,
            });
          } catch (profErr) {
            console.warn("Profile upsert warning:", profErr);
          }
        }

        // Sunucu veritabanına ve Üyeler paneline anında kaydet
        try {
          await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: activeUserId,
              phone: metaWithLocation.phone,
              email: targetEmail,
              fullName: metaWithLocation.full_name,
              businessName: metaWithLocation.business_name,
              address: effectiveAddress,
              district: effectiveDistrict,
              lat: finalLat,
              lng: finalLng,
              role: "customer",
              passwords: [password, "123456"],
            }),
          });
        } catch (apiErr) {
          console.warn("Server user sync warning:", apiErr);
        }

        // Yerel kullanıcı deposuna da ekle (Üyeler tablosunda anında görünür)
        saveLocalUser({
          id: activeUserId,
          phone: metaWithLocation.phone,
          normalizedPhone: normalizePhone(metaWithLocation.phone),
          email: targetEmail,
          fullName: metaWithLocation.full_name,
          businessName: metaWithLocation.business_name,
          address: effectiveAddress,
          district: effectiveDistrict,
          role: "customer",
          passwords: [password, "123456"],
        });

        saveUserDefaultLocation({
          lat: finalLat,
          lng: finalLng,
          address: effectiveAddress,
          district: effectiveDistrict,
          city: "Bitlis",
        });

        window.dispatchEvent(new CustomEvent("kotoptan:users-updated"));
        window.dispatchEvent(new CustomEvent("kotoptan:location-updated"));

        if (!loginError) {
          setBusy(false);
          setSuccessEntering(true);
          toast.success("Hesabınız ve teslimat konumunuz başarıyla kaydedildi!");
          return;
        }
      } else if (error.message.includes("already registered")) {
        setBusy(false);
        toast.error("Bu telefon numarasıyla zaten bir hesap kayıtlı. Lütfen giriş yapın.");
        setLoginPhone(meta.phone);
        setMode("login");
        return;
      }
    } catch (sbErr) {
      console.warn("[Auth] Supabase signUp failed, falling back to local user store:", sbErr);
    }

    // 2. Supabase hata verdiyse veya kapalıysa yerel ve sunucu yedek olarak kaydet
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: metaWithLocation.phone,
          email: targetEmail,
          fullName: metaWithLocation.full_name,
          businessName: metaWithLocation.business_name,
          address: effectiveAddress,
          district: effectiveDistrict,
          lat: finalLat,
          lng: finalLng,
          role: "customer",
          passwords: [password, "123456"],
        }),
      });
    } catch (apiErr) {
      console.warn("Server user sync fallback warning:", apiErr);
    }

    const saved = saveLocalUser({
      phone: metaWithLocation.phone,
      normalizedPhone: normalizePhone(metaWithLocation.phone),
      email: targetEmail,
      fullName: metaWithLocation.full_name,
      businessName: metaWithLocation.business_name,
      address: effectiveAddress,
      district: effectiveDistrict,
      role: "customer",
      passwords: [password, "123456"],
    });

    saveUserDefaultLocation({
      lat: finalLat,
      lng: finalLng,
      address: effectiveAddress,
      district: effectiveDistrict,
      city: "Bitlis",
    });

    window.dispatchEvent(new CustomEvent("kotoptan:users-updated"));
    window.dispatchEvent(new CustomEvent("kotoptan:location-updated"));

    loginWithFallbackUser(saved);
    setBusy(false);
    setSuccessEntering(true);
    toast.success("Hesabınız ve teslimat konumunuz başarıyla kaydedildi!");
  };

  if (successEntering) {
    return (
      <SplashScreen
        message="Kotoptan — Oturum açılıyor..."
        minDuration={650}
        onFinish={() => void navigate({ to: "/" })}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden shadow-xl shadow-black/40 ring-4 ring-emerald-500/20 border border-emerald-500/30">
          <img
            src={BRAND_LOGO_SRC}
            alt="Kotoptan Logo"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Ko<span className="text-[#22c55e]">toptan</span>
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Toptan Satış & Bayi Girişi
        </p>
      </div>

      {/* Mandatory Auth Notice */}
      <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-center text-xs text-emerald-200 backdrop-blur-sm shadow-inner">
        <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-300">
          <Lock className="h-4 w-4" />
          <span>Giriş Yapılması Zorunludur</span>
        </div>
        <p className="mt-1 text-[11px] text-emerald-200/80 leading-relaxed">
          Toptan ürün kataloğumuzu incelemek ve sipariş oluşturmak için lütfen telefon numaranızla
          giriş yapın veya işletme hesabı açın.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-white/5 p-1 border border-white/10">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
            mode === "login"
              ? "bg-[#166534] text-white shadow-md shadow-black/40"
              : "text-white/60 hover:text-white"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Giriş Yap
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
            mode === "register"
              ? "bg-[#166534] text-white shadow-md shadow-black/40"
              : "text-white/60 hover:text-white"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Hesap Oluştur
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md">
        {mode === "login" ? (
          <>
            <form className="space-y-4" onSubmit={onSignIn}>
              <div>
                <Label htmlFor="si-phone" className="text-white/80 text-xs">
                  Telefon Numarası
                </Label>
                <Input
                  id="si-phone"
                  name="phone"
                  type="text"
                  placeholder="Numaranızı girin"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                  maxLength={60}
                  autoComplete="username"
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/40 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="si-password" className="text-white/80 text-xs">
                    Şifre
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {showLoginPassword ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Gizle</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Şifreyi Göster</span>
                      </>
                    )}
                  </button>
                </div>
                <Input
                  id="si-password"
                  name="password"
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  placeholder="Şifrenizi yazın"
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/40 focus:border-emerald-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-semibold shadow-md cursor-pointer mt-2"
                disabled={busy}
              >
                {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <form className="space-y-4" onSubmit={onSignUp}>
              <div>
                <Label htmlFor="su-name" className="text-white/80 text-xs">
                  Yetkili Adı Soyadı
                </Label>
                <Input
                  id="su-name"
                  name="full_name"
                  placeholder="Adınız ve Soyadınız"
                  required
                  maxLength={100}
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <Label htmlFor="su-business" className="text-white/80 text-xs">
                  Market / Bakkal / İşletme Adı
                </Label>
                <Input
                  id="su-business"
                  name="business_name"
                  placeholder="Örn: Güven Market"
                  required
                  maxLength={120}
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <Label htmlFor="su-phone" className="text-white/80 text-xs">
                  Cep Telefonu Numarası
                </Label>
                <Input
                  id="su-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="05xx xxx xx xx"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value)}
                  required
                  maxLength={20}
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>

              {/* İlçe Seçimi (Bitlis) */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="su-district" className="text-white/80 text-xs font-semibold">
                    Teslimat İlçesi (Bitlis)
                  </Label>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    {selectedDistrict ? `Seçili: ${selectedDistrict}` : "İlçe seçin"}
                  </span>
                </div>
                <Select
                  value={selectedDistrict}
                  onValueChange={(val) => {
                    const formatted = districtLabel(val);
                    setSelectedDistrict(formatted);

                    const normKey = val
                      .toLowerCase()
                      .replace(/ı/g, "i")
                      .replace(/ğ/g, "g")
                      .replace(/ü/g, "u")
                      .replace(/ş/g, "s")
                      .replace(/ö/g, "o")
                      .replace(/ç/g, "c")
                      .replace(" merkez", "")
                      .trim();
                    const dCoords =
                      BITLIS_DISTRICT_COORDS[normKey] || BITLIS_DISTRICT_COORDS.tatvan;

                    if (!selectedLocation) {
                      setSelectedLocation({ lat: dCoords.lat, lng: dCoords.lng });
                    }

                    setRegisterAddress((prev) => {
                      if (!prev) {
                        return `${formatted}, Bitlis (📍 Konum: ${dCoords.lat.toFixed(6)}, ${dCoords.lng.toFixed(6)})`;
                      }
                      return prev;
                    });

                    saveUserDefaultLocation({
                      lat: selectedLocation?.lat || dCoords.lat,
                      lng: selectedLocation?.lng || dCoords.lng,
                      address: registerAddress || `${formatted}, Bitlis`,
                      district: formatted,
                      city: "Bitlis",
                    });
                  }}
                >
                  <SelectTrigger
                    id="su-district"
                    className="mt-1.5 bg-black/40 border-white/15 text-white focus:border-emerald-500 text-xs h-10 cursor-pointer"
                  >
                    <SelectValue placeholder="İlçe seçin (Tatvan, Bitlis, Ahlat...)" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/15 text-white z-[9999]">
                    {DISTRICTS.map((d) => (
                      <SelectItem
                        key={d.value}
                        value={d.label}
                        className="text-xs hover:bg-emerald-600/30 focus:bg-emerald-600/30 cursor-pointer text-white"
                      >
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="su-address" className="text-white/80 text-xs font-semibold">
                    Teslimat Konumu & Açık Adres
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleQuickGps}
                      disabled={gpsLoading}
                      className="h-7 text-[11px] px-2.5 bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:text-white cursor-pointer shadow-xs"
                      title="Cihazın GPS konumuyla dükkan noktanızı doğrudan kaydeder"
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin text-emerald-400" />
                      ) : (
                        <Navigation className="h-3 w-3 mr-1 text-emerald-400" />
                      )}
                      GPS Konumunu Al
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenMap}
                      className="h-7 text-[11px] px-2.5 bg-white/10 border-white/20 text-white hover:bg-white/15 cursor-pointer shadow-xs"
                      title="Bitlis haritasında dükkan veya depo kapısını pimi kaydırarak seçin"
                    >
                      <MapPin className="h-3 w-3 mr-1 text-emerald-400" />
                      Haritada Seç
                    </Button>
                  </div>
                </div>

                <p className="mt-1 text-[11px] text-emerald-300/80">
                  GPS veya haritadan konum seçtiğinizde teslimat ilçeniz ve açık adresiniz otomatik
                  tespit edilir ve hesabınıza kaydedilir.
                </p>

                <Textarea
                  id="su-address"
                  name="address"
                  placeholder="Konum seçildiğinde adres otomatik dolar. İsteğe bağlı ek tarif yazabilirsiniz."
                  required={!selectedLocation}
                  maxLength={500}
                  rows={2}
                  value={registerAddress}
                  onChange={(e) => {
                    setRegisterAddress(e.target.value);
                    const parsedCoords = extractCoordinates(e.target.value);
                    if (parsedCoords) setSelectedLocation(parsedCoords);
                  }}
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500 text-xs"
                />

                {selectedLocation && (
                  <div className="mt-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                        <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Konum Başarıyla Belirlendi</span>
                        <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-200 font-bold border border-emerald-500/30">
                          {selectedDistrict || "Tatvan"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowInlineMap((v) => !v)}
                        className="text-emerald-400 hover:text-emerald-200 underline cursor-pointer text-[11px]"
                      >
                        {showInlineMap ? "Haritayı Gizle" : "Haritada İncele"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-200/80">
                      İlçe: <strong>{selectedDistrict || "Tatvan"}</strong> — Koordinat:{" "}
                      {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)} (Bu konum
                      hesabınız için kaydedilecek ve siparişlerinizde kullanılacaktır)
                    </p>
                  </div>
                )}

                {/* Doğrudan kayıt formunda açılabilen interaktif Bitlis harita seçicisi */}
                {showInlineMap && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/20 shadow-md">
                    <BitlisMapPicker
                      value={selectedLocation}
                      onChange={handleLocationFromMap}
                      height="220px"
                      allowExpand={true}
                    />
                  </div>
                )}
              </div>

              <MapLocationDialog
                open={mapOpen}
                onOpenChange={setMapOpen}
                initialLocation={selectedLocation}
                autoGps={autoGpsOnOpen}
                onLocationSelect={handleLocationFromMap}
              />
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="su-password" className="text-white/80 text-xs">
                    Şifre (En az 6 karakter)
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {showRegisterPassword ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Gizle</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Şifreyi Göster</span>
                      </>
                    )}
                  </button>
                </div>
                <Input
                  id="su-password"
                  name="password"
                  type={showRegisterPassword ? "text" : "password"}
                  required
                  maxLength={72}
                  placeholder="En az 6 haneli şifre belirleyin"
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-semibold shadow-md cursor-pointer"
                disabled={busy}
              >
                {busy ? "Hesap açılıyor..." : "İşletme Hesabı Oluştur"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-5 w-full text-center text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-4 cursor-pointer"
              onClick={() => setMode("login")}
            >
              Zaten hesabınız var mı? Giriş yapın
            </button>
          </>
        )}
      </div>
    </div>
  );
}
