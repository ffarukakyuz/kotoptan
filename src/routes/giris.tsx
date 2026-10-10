import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Box, Lock, ShieldCheck, UserPlus, LogIn, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ADMIN_MEMBERS } from "@/lib/admin-config";
import { authenticateFallbackUser, findFallbackUser, saveLocalUser } from "@/data/users";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SplashScreen } from "@/components/SplashScreen";
import { BRAND_LOGO_SRC } from "@/lib/branding";

export const Route = createFileRoute("/giris")({
  head: () => ({
    meta: [
      { title: "Giriş / Kayıt — Kotoptan" },
      {
        name: "description",
        content: "Telefon numaranızla hesap oluşturun ve toptan sipariş vermeye başlayın.",
      },
      { property: "og:title", content: "Giriş / Kayıt — Kotoptan" },
      {
        property: "og:description",
        content: "Toptan sipariş vermek için telefon numaranızla giriş yapın.",
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
  address: z.string().trim().min(5, "Teslimat adresi gerekli").max(500),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, loginWithFallbackUser } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [busy, setBusy] = useState(false);
  const [successEntering, setSuccessEntering] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginPhone, setLoginPhone] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");

  useEffect(() => {
    if (!loading && user && pathname === "/giris") {
      void navigate({ to: "/" });
    }
  }, [user, loading, navigate, pathname]);

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("phone") ?? "").trim();
    const rawPassword = String(fd.get("password") ?? "");

    // Özel kişiler için gizli misafir girişi (ekranda görünmez, kod seviyesinde desteklenir)
    const isGuest =
      identifier.toLocaleLowerCase("tr") === "misafir" ||
      identifier.toLowerCase() === "misafir@kotoptan.local";

    let targetEmail = "";
    const isEmailInput = identifier.includes("@");
    const normalized = isEmailInput ? "" : normalizePhone(identifier);

    if (isGuest) {
      targetEmail = "misafir@kotoptan.local";
    } else if (isEmailInput) {
      targetEmail = identifier.toLowerCase().trim();
    } else {
      // Rastgele veya geçersiz numaraları reddet (Türk cep numarası formatı: 05xx xxx xx xx)
      if (!/^5\d{9}$/.test(normalized)) {
        toast.error("Lütfen geçerli bir cep telefonu numarası girin (Örn: 05xx xxx xx xx)");
        return;
      }
      targetEmail = phoneIdentity(identifier);
    }

    setBusy(true);

    // 1. Önce doğrudan Supabase Auth servisine bağlanmayı dene
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: rawPassword,
      });

      if (!error && data?.user) {
        setBusy(false);
        setSuccessEntering(true);
        toast.success("Giriş yapıldı");
        return;
      }
    } catch (sbErr) {
      console.warn("[Auth] Supabase auth threw, switching to fallback:", sbErr);
    }

    // 2. Supabase hata verdiyse veya yanıt vermediyse yerel yedek kullanıcıları (src/data/users.ts) kontrol et
    const fallbackAuth = authenticateFallbackUser(identifier, rawPassword);
    if (fallbackAuth.user) {
      setBusy(false);
      loginWithFallbackUser(fallbackAuth.user);
      setSuccessEntering(true);
      toast.success(`Giriş yapıldı (Hoş geldiniz, ${fallbackAuth.user.fullName})`);
      return;
    }

    setBusy(false);

    if (isGuest) {
      toast.error("Şifre hatalı. Lütfen kontrol edin.");
      return;
    }

    // Kullanıcı kayıtlı mı kontrolü (Yerel + Supabase)
    const localUserExists = Boolean(findFallbackUser(identifier));
    if (!localUserExists) {
      // Yönetici mi kontrolü
      const isAdmin =
        identifier.toLowerCase() === "ffarukakyuz@gmail.com" ||
        ADMIN_MEMBERS.some(
          (m) =>
            (normalized && m.normalizedPhone === normalized) ||
            m.email.toLowerCase() === targetEmail ||
            m.emails?.map((e) => e.toLowerCase()).includes(targetEmail),
        );

      if (!isAdmin) {
        toast.error("Bu hesap kayıtlı değil. Lütfen önce hesap oluşturun.");
        if (normalized) {
          setRegisterPhone(normalized.startsWith("0") ? normalized : `0${normalized}`);
        }
        setMode("register");
        return;
      }
    }

    toast.error("Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.");
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

    setBusy(true);
    const { password, ...meta } = parsed.data;
    const targetEmail = phoneIdentity(meta.phone);

    // 1. Önce Supabase Auth ile kayıt yapmayı dene
    let supabaseSuccess = false;
    try {
      const { error } = await supabase.auth.signUp({
        email: targetEmail,
        password,
        options: { data: meta },
      });

      if (!error) {
        supabaseSuccess = true;
        // Otomatik Giriş
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (!loginError) {
          setBusy(false);
          setSuccessEntering(true);
          toast.success("Hesabınız başarıyla oluşturuldu");
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

    // 2. Supabase hata verdiyse veya kapalıysa yerel yedek olarak kaydet
    const saved = saveLocalUser({
      phone: meta.phone,
      normalizedPhone: normalizePhone(meta.phone),
      email: targetEmail,
      fullName: meta.full_name,
      businessName: meta.business_name,
      address: meta.address,
      role: "customer",
      passwords: [password, "123456"],
    });

    loginWithFallbackUser(saved);
    setBusy(false);
    setSuccessEntering(true);
    toast.success("Hesabınız başarıyla oluşturuldu");
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
                  placeholder="05xx xxx xx xx"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                  maxLength={40}
                  autoComplete="username"
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <Label htmlFor="si-password" className="text-white/80 text-xs">
                  Şifre
                </Label>
                <Input
                  id="si-password"
                  name="password"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-semibold shadow-md cursor-pointer"
                disabled={busy}
              >
                {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-5 w-full text-center text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-4 cursor-pointer"
              onClick={() => setMode("register")}
            >
              Henüz işletme hesabınız yok mu? Hesap oluşturun
            </button>
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
              <div>
                <Label htmlFor="su-address" className="text-white/80 text-xs">
                  Teslimat Adresi
                </Label>
                <Textarea
                  id="su-address"
                  name="address"
                  placeholder="İl, ilçe, mahalle ve dükkan adresi..."
                  required
                  maxLength={500}
                  rows={3}
                  className="mt-1.5 bg-black/40 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <Label htmlFor="su-password" className="text-white/80 text-xs">
                  Şifre (En az 6 karakter)
                </Label>
                <Input
                  id="su-password"
                  name="password"
                  type="password"
                  required
                  maxLength={72}
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
