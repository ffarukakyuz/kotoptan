import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/sepet")({
  head: () => ({
    meta: [
      { title: "Sepetim — KasımOğulları Ltd. Şti." },
      {
        name: "description",
        content: "Sepetinizdeki ürünlerin adetlerini belirleyin ve sipariş talebinizi gönderin.",
      },
      { property: "og:title", content: "Sepetim — KasımOğulları Ltd. Şti." },
      { property: "og:description", content: "Sipariş adetlerinizi belirleyin ve gönderin." },
    ],
  }),
  component: CartPage,
});

const orderSchema = z.object({
  full_name: z.string().trim().min(2, "Ad soyad gerekli").max(100),
  business_name: z.string().trim().min(2, "Market/bakkal adı gerekli").max(120),
  district: z.string().trim().min(1, "İlçe seçilmeli"),
  phone: z.string().trim().min(7, "Telefon gerekli").max(30),
  address: z.string().trim().min(10, "Teslimat adresi gerekli").max(500),
  note: z.string().trim().max(500),
});

function CartPage() {
  const { items, setQuantity, remove, clear } = useCart();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
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
      setForm((f) => ({
        ...f,
        full_name: f.full_name || profile.full_name,
        business_name: f.business_name || profile.business_name,
        phone: f.phone || profile.phone,
        address: f.address || profile.address,
      }));
    }
  }, [profile]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    setBusy(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({ user_id: user.id, ...parsed.data })
      .select("id")
      .single();

    if (error || !order) {
      setBusy(false);
      toast.error("Sipariş oluşturulamadı, tekrar deneyin");
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        unit: i.unit,
        quantity: i.quantity,
      })),
    );
    setBusy(false);

    if (itemsError) {
      toast.error("Ürünler kaydedilemedi, tekrar deneyin");
      return;
    }

    clear();
    toast.success("Siparişiniz bize ulaştı");
    void navigate({ to: "/siparislerim" });
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
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{item.name}</p>
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
                <Label htmlFor="o-address">Teslimat adresi</Label>
                <Textarea
                  id="o-address"
                  rows={3}
                  value={form.address}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
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
