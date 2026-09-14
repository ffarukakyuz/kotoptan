import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        business_name: profile.business_name,
        phone: profile.phone,
        address: profile.address,
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...parsed.data })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Kaydedilemedi");
      return;
    }
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
          <Label htmlFor="p-address">Teslimat adresi</Label>
          <Textarea
            id="p-address"
            rows={3}
            value={form.address}
            maxLength={500}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
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
