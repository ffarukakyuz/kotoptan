import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/giris")({
  head: () => ({
    meta: [
      { title: "Giriş / Kayıt — KasımOğulları Ltd. Şti." },
      {
        name: "description",
        content: "Telefon numaranızla hesap oluşturun ve toptan sipariş vermeye başlayın.",
      },
      { property: "og:title", content: "Giriş / Kayıt — KasımOğulları Ltd. Şti." },
      {
        property: "og:description",
        content: "Toptan sipariş vermek için telefon numaranızla giriş yapın.",
      },
    ],
  }),
  component: AuthPage,
});

/** Telefon numarasını sadece rakamlara indirger. */
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/** Telefon numarasından sabit bir giriş kimliği üretir. */
function phoneIdentity(raw: string) {
  return `${normalizePhone(raw)}@kotoptan.local`;
}

const signUpSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => normalizePhone(v).length >= 10, "Geçerli bir telefon numarası girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").max(72),
  full_name: z.string().trim().min(2, "Ad soyad gerekli").max(100),
  business_name: z.string().trim().min(2, "Market/bakkal adı gerekli").max(120),
  address: z.string().trim().min(10, "Teslimat adresi gerekli").max(500),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    if (!loading && user && pathname === "/giris") {
      void navigate({ to: "/" });
    }
  }, [user, loading, navigate, pathname]);

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(
        /provider|secret|not enabled/i.test(error.message)
          ? "Google ile giriş şu anda etkin değil. Lütfen telefon numaranızla giriş yapın."
          : "Google ile giriş yapılamadı: " + error.message,
      );
    }
  };

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "");
    if (normalizePhone(phone).length < 10) {
      toast.error("Geçerli bir telefon numarası girin");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneIdentity(phone),
      password: String(fd.get("password") ?? ""),
    });
    setBusy(false);
    if (error) {
      toast.error("Telefon numarası veya şifre hatalı");
      return;
    }
    toast.success("Giriş yapıldı");
    void navigate({ to: "/" });
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
    const { error } = await supabase.auth.signUp({
      email: phoneIdentity(meta.phone),
      password,
      options: { data: meta },
    });
    if (error) {
      setBusy(false);
      toast.error(
        error.message.includes("already registered")
          ? "Bu telefon numarası ile zaten bir hesap var"
          : "Kayıt oluşturulamadı",
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInWithPassword({ email: phoneIdentity(meta.phone), password });
    }
    setBusy(false);
    toast.success("Hesabınız oluşturuldu");
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-extrabold text-foreground">Hesabınıza girin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Telefon numaranız ve şifrenizle giriş yapın. Market/bakkal bilgilerinizi bir kez kaydetmeniz
        yeterli.
      </p>

      <Button
        variant="outline"
        className="mt-6 w-full"
        disabled={busy}
        onClick={() => void signInWithGoogle()}
      >
        Google ile devam et
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> veya <span className="h-px flex-1 bg-border" />
      </div>

      {mode === "login" ? (
        <>
          <form className="space-y-4" onSubmit={onSignIn}>
            <div>
              <Label htmlFor="si-phone">Telefon numarası</Label>
              <Input
                id="si-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="05xx xxx xx xx"
                required
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="si-password">Şifre</Label>
              <Input id="si-password" name="password" type="password" required maxLength={72} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Giriş yap
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setMode("register")}
          >
            Hesabınız yok mu? Hesap oluşturun
          </button>
        </>
      ) : (
        <>
          <form className="space-y-4" onSubmit={onSignUp}>
            <div>
              <Label htmlFor="su-name">Ad soyad</Label>
              <Input id="su-name" name="full_name" required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="su-business">Market / bakkal adı</Label>
              <Input id="su-business" name="business_name" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="su-phone">Telefon numarası</Label>
              <Input
                id="su-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="05xx xxx xx xx"
                required
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="su-address">Teslimat adresi</Label>
              <Textarea id="su-address" name="address" required maxLength={500} rows={3} />
            </div>
            <div>
              <Label htmlFor="su-password">Şifre</Label>
              <Input id="su-password" name="password" type="password" required maxLength={72} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Hesap oluştur
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setMode("login")}
          >
            Zaten hesabınız var mı? Giriş yapın
          </button>
        </>
      )}
    </div>
  );
}