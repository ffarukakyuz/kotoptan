import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Minus,
  Upload,
  ImageIcon,
  CheckCircle2,
  XCircle,
  Archive,
  ArchiveRestore,
  KeyRound,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteAppUser,
  listAppUsers,
  resetAppUserPassword,
  updateAppUser,
  type AppUser,
} from "@/lib/admin-users.functions";
import {
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  UNITS,
  categoryLabel,
  statusLabel,
  DISTRICTS,
  districtLabel,
  type Product,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/yonetim")({
  head: () => ({
    meta: [
      { title: "Yönetim Paneli — KasımOğulları Ltd. Şti." },
      { name: "description", content: "Ürünleri yönetin ve gelen siparişleri görüntüleyin." },
      { property: "og:title", content: "Yönetim Paneli — KasımOğulları Ltd. Şti." },
      { property: "og:description", content: "Ürün ve sipariş yönetimi." },
    ],
  }),
  component: AdminPage,
});

const productSchema = z.object({
  name: z.string().trim().min(2, "Ürün adı gerekli").max(120),
  description: z.string().trim().max(500),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1, "Birim gerekli").max(30),
  image_url: z.string().trim().max(400000),
  is_active: z.boolean(),
});

const emptyProduct = {
  name: "",
  description: "",
  category: "gida",
  unit: "adet",
  image_url: "",
  is_active: true,
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Yetkiniz yok</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu sayfa yalnızca yöneticiler içindir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-foreground">Yönetim paneli</h1>
      <Tabs defaultValue="orders" className="mt-6">
        <TabsList>
          <TabsTrigger value="orders">Siparişler</TabsTrigger>
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="users">Üyeler</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersPanel />
        </TabsContent>
        <TabsContent value="products">
          <ProductsPanel />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type AdminOrderItem = { id: string; product_name: string; unit: string; quantity: number };

type AdminOrder = {
  id: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  full_name: string;
  business_name: string;
  district: string;
  phone: string;
  address: string;
  note: string;
  order_items: AdminOrderItem[];
};

const isArchivedOrder = (o: AdminOrder) =>
  o.archived_at !== null || o.status === "teslim" || o.status === "iptal";

const DATE_RANGES = [
  { value: "hepsi", label: "Tüm zamanlar" },
  { value: "bugun", label: "Bugün" },
  { value: "7", label: "Son 7 gün" },
  { value: "30", label: "Son 30 gün" },
] as const;

type DateRange = (typeof DATE_RANGES)[number]["value"];

const inDateRange = (iso: string, range: DateRange) => {
  if (range === "hepsi") return true;
  const d = new Date(iso);
  if (range === "bugun") return d.toDateString() === new Date().toDateString();
  const days = Number(range);
  return d.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
};

const dayKey = (iso: string) => new Date(iso).toDateString();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yesterday.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
};

function OrdersPanel() {
  const qc = useQueryClient();
  const [view, setView] = useState<"aktif" | "arsiv">("aktif");
  const [filter, setFilter] = useState("hepsi");
  const [range, setRange] = useState<DateRange>("hepsi");
  const [district, setDistrict] = useState("hepsi");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, archived_at, status, full_name, business_name, district, phone, address, note, order_items(id, product_name, unit, quantity)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminOrder[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-orders"] });

  const patchOrder = async (
    id: string,
    patch: { status?: string; archived_at?: string | null; note?: string },
    okMessage: string,
  ) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      toast.error("İşlem tamamlanamadı");
      return;
    }
    toast.success(okMessage);
    refresh();
  };

  const setItemQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const { error } = await supabase.from("order_items").update({ quantity }).eq("id", itemId);
    if (error) {
      toast.error("Adet güncellenemedi");
      return;
    }
    refresh();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (error) {
      toast.error("Ürün silinemedi");
      return;
    }
    toast.success("Ürün siparişten çıkarıldı");
    refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm("Bu sipariş kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error("Sipariş silinemedi");
      return;
    }
    toast.success("Sipariş silindi");
    refresh();
  };

  const all = data ?? [];
  const scoped = all.filter((o) => (view === "arsiv" ? isArchivedOrder(o) : !isArchivedOrder(o)));
  const orders = scoped.filter(
    (o) =>
      (filter === "hepsi" || o.status === filter) &&
      (district === "hepsi" || o.district === district) &&
      inDateRange(o.created_at, range),
  );
  const activeCount = all.filter((o) => !isArchivedOrder(o)).length;
  const archivedCount = all.length - activeCount;

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {(
          [
            ["aktif", `Aktif (${activeCount})`],
            ["arsiv", `Arşiv (${archivedCount})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              view === v
                ? "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                : "rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[{ value: "hepsi", label: "Hepsi" }, ...ORDER_STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={
              filter === s.value
                ? "rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
                : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={
              range === r.value
                ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[{ value: "hepsi", label: "Tüm ilçeler" }, ...DISTRICTS].map((d) => (
          <button
            key={d.value}
            onClick={() => setDistrict(d.value)}
            className={
              district === d.value
                ? "rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
                : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
            }
          >
            {d.label}
            {d.value !== "hepsi" && (
              <span className="ml-1 opacity-70">
                ({scoped.filter((o) => o.district === d.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-xl" />
      ) : orders.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {view === "arsiv" ? "Arşivde sipariş yok." : "Aktif sipariş bulunmuyor."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {orders.map((o, idx) => {
            const editing = editingId === o.id;
            const showDay =
              idx === 0 || dayKey(orders[idx - 1]!.created_at) !== dayKey(o.created_at);
            return (
              <Fragment key={o.id}>
                {showDay && (
                  <h3 className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {dayLabel(o.created_at)}
                  </h3>
                )}
                <article className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-foreground">{o.business_name}</p>
                      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {districtLabel(o.district)}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {o.full_name} · {o.phone}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{o.address}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        #{o.id.slice(0, 8).toUpperCase()} ·{" "}
                        {new Date(o.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="w-44">
                      <Select
                        value={o.status}
                        onValueChange={(v) =>
                          void patchOrder(o.id, { status: v }, "Durum güncellendi")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={statusLabel(o.status)} />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {o.order_items.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 border-b border-border/60 py-1"
                      >
                        <span>{i.product_name}</span>
                        {editing ? (
                          <span className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Azalt"
                              onClick={() => void setItemQuantity(i.id, i.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-14 text-center font-semibold">
                              {i.quantity} {i.unit}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Artır"
                              onClick={() => void setItemQuantity(i.id, i.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ürünü çıkar"
                              onClick={() => void removeItem(i.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </span>
                        ) : (
                          <span className="font-semibold">
                            {i.quantity} {i.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {editing ? (
                    <div className="mt-3">
                      <Label htmlFor={`note-${o.id}`}>Sipariş notu</Label>
                      <Textarea
                        id={`note-${o.id}`}
                        rows={2}
                        defaultValue={o.note}
                        maxLength={500}
                        onBlur={(e) => {
                          if (e.target.value !== o.note)
                            void patchOrder(o.id, { note: e.target.value }, "Not güncellendi");
                        }}
                      />
                    </div>
                  ) : (
                    o.note && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Not:</span> {o.note}
                      </p>
                    )
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={editing ? "default" : "outline"}
                      onClick={() => setEditingId(editing ? null : o.id)}
                    >
                      <Pencil className="h-4 w-4" />
                      {editing ? "Düzenlemeyi bitir" : "Düzenle"}
                    </Button>
                    {o.status !== "teslim" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void patchOrder(o.id, { status: "teslim" }, "Sipariş teslim edildi")
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Teslim edildi
                      </Button>
                    )}
                    {o.status !== "iptal" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void patchOrder(o.id, { status: "iptal" }, "Sipariş iptal edildi")
                        }
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                        İptal et
                      </Button>
                    )}
                    {isArchivedOrder(o) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void patchOrder(
                            o.id,
                            { archived_at: null, status: "yeni" },
                            "Sipariş aktif listeye alındı",
                          )
                        }
                      >
                        <ArchiveRestore className="h-4 w-4" />
                        Arşivden çıkar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void patchOrder(
                            o.id,
                            { archived_at: new Date().toISOString() },
                            "Sipariş arşivlendi",
                          )
                        }
                      >
                        <Archive className="h-4 w-4" />
                        Arşivle
                      </Button>
                    )}
                    {isArchivedOrder(o) && (
                      <Button size="sm" variant="ghost" onClick={() => void deleteOrder(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        Kalıcı sil
                      </Button>
                    )}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function compressImage(file: File, max = 800, quality = 0.72) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

function ProductsPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel dosyası seçin");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, image_url: dataUrl }));
      toast.success("Fotoğraf hazır");
    } catch {
      toast.error("Fotoğraf işlenemedi");
    } finally {
      setUploading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, category, unit, image_url, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyProduct });
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin");
      return;
    }
    const payload = { ...parsed.data, image_url: parsed.data.image_url || null };
    setBusy(true);
    const { error } = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (error) {
      toast.error("Kaydedilemedi");
      return;
    }
    toast.success(editingId ? "Ürün güncellendi" : "Ürün eklendi");
    reset();
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Silinemedi");
      return;
    }
    toast.success("Ürün silindi");
    void qc.invalidateQueries({ queryKey: ["admin-products"] });
    void qc.invalidateQueries({ queryKey: ["products", "active"] });
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={submit}
        className="h-fit space-y-3 rounded-xl border border-border bg-card p-5 shadow-card"
      >
        <h2 className="text-lg font-bold">{editingId ? "Ürünü düzenle" : "Yeni ürün"}</h2>
        <div>
          <Label htmlFor="pr-name">Ürün adı</Label>
          <Input
            id="pr-name"
            value={form.name}
            maxLength={120}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pr-desc">Koli içi bilgisi</Label>
          <Textarea
            id="pr-desc"
            rows={2}
            placeholder="Örn: 1 kolide 12 adet"
            value={form.description}
            maxLength={500}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label>Kategori</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pr-unit">Birim</Label>
          <Input
            id="pr-unit"
            placeholder="Seçin ya da yazın (örn: adet, koli, paket)"
            value={form.unit}
            maxLength={30}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {UNITS.map((u) => {
              const selected = form.unit.toLowerCase() === u.value.toLowerCase();
              return (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setForm({ ...form, unit: u.value })}
                  className={
                    selected
                      ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"
                  }
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Ürün fotoğrafı</Label>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {form.image_url ? (
                <img src={form.image_url} alt="Önizleme" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void pickImage(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading
                  ? "Yükleniyor..."
                  : form.image_url
                    ? "Fotoğrafı değiştir"
                    : "Fotoğraf seç"}
              </Button>
              {form.image_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, image_url: "" })}
                >
                  Kaldır
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label htmlFor="pr-active">Katalogda görünsün</Label>
          <Switch
            id="pr-active"
            checked={form.is_active}
            onCheckedChange={(v) => setForm({ ...form, is_active: v })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" />
            {editingId ? "Güncelle" : "Ekle"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={reset}>
              Vazgeç
            </Button>
          )}
        </div>
      </form>

      <div>
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (data?.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Henüz ürün yok.</p>
        ) : (
          <div className="space-y-2">
            {data!.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(p.category)} · {p.unit}
                    {!p.is_active && " · gizli"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Düzenle"
                  onClick={() => {
                    setEditingId(p.id);
                    setForm({
                      name: p.name,
                      description: p.description,
                      category: p.category,
                      unit: p.unit,
                      image_url: p.image_url ?? "",
                      is_active: p.is_active,
                    });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sil"
                  onClick={() => void removeProduct(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const updateUser = useServerFn(updateAppUser);
  const resetPassword = useServerFn(resetAppUserPassword);
  const removeUser = useServerFn(deleteAppUser);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listAppUsers(),
  });

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-6 text-sm text-destructive">Üyeler yüklenemedi. Lütfen tekrar deneyin.</p>
    );
  }

  const users = data ?? [];

  const refreshUsers = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateUser({
        data: {
          id: editing.id,
          full_name: String(form.get("full_name") ?? ""),
          business_name: String(form.get("business_name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          address: String(form.get("address") ?? ""),
        },
      });
      await refreshUsers();
      setEditing(null);
      toast.success("Müşteri bilgileri güncellendi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Bilgiler güncellenemedi");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordUser) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await resetPassword({
        data: { id: passwordUser.id, password: String(form.get("password") ?? "") },
      });
      setPasswordUser(null);
      toast.success("Yeni şifre kaydedildi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Şifre değiştirilemedi");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await removeUser({ data: { id: deleting.id } });
      await refreshUsers();
      setDeleting(null);
      toast.success("Müşteri hesabı silindi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Hesap silinemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        Toplam <span className="font-semibold text-foreground">{users.length}</span> kayıtlı üye
      </p>
      <div className="mt-4 space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">
                {u.business_name || u.full_name || "İsimsiz üye"}
              </span>
              {u.is_admin && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  Yönetici
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString("tr-TR")} tarihinde katıldı
              </span>
            </div>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {u.full_name && <p>Yetkili: {u.full_name}</p>}
              {(u.profile_phone || u.phone) && <p>Telefon: {u.profile_phone || u.phone}</p>}
              {u.email && <p>E-posta: {u.email}</p>}
              {u.address && <p className="sm:col-span-2">Adres: {u.address}</p>}
              <p className="sm:col-span-2 text-xs">
                Son giriş:{" "}
                {u.last_sign_in_at
                  ? new Date(u.last_sign_in_at).toLocaleString("tr-TR")
                  : "Kayıt yok"}
              </p>
            </div>
            {!u.is_admin && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                  <Pencil className="h-4 w-4" /> Bilgileri düzenle
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPasswordUser(u)}>
                  <KeyRound className="h-4 w-4" /> Şifre belirle
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleting(u)}>
                  <Trash2 className="h-4 w-4" /> Hesabı sil
                </Button>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz kayıtlı üye yok.</p>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri bilgilerini düzenle</DialogTitle>
            <DialogDescription>Telefon değişirse müşteri yeni numarasıyla giriş yapar.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={saveUser}>
              <div><Label htmlFor="edit-full-name">Ad soyad</Label><Input id="edit-full-name" name="full_name" defaultValue={editing.full_name} required /></div>
              <div><Label htmlFor="edit-business">İşletme adı</Label><Input id="edit-business" name="business_name" defaultValue={editing.business_name} required /></div>
              <div><Label htmlFor="edit-phone">Telefon</Label><Input id="edit-phone" name="phone" type="tel" defaultValue={editing.profile_phone || editing.phone || ""} required /></div>
              <div><Label htmlFor="edit-address">Adres</Label><Textarea id="edit-address" name="address" defaultValue={editing.address} required rows={3} /></div>
              <DialogFooter><Button type="submit" disabled={busy}>Kaydet</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordUser !== null} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni şifre belirle</DialogTitle>
            <DialogDescription>{passwordUser?.business_name || passwordUser?.full_name} için en az 6 karakterli yeni şifre girin.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePassword}>
            <div><Label htmlFor="new-password">Yeni şifre</Label><Input id="new-password" name="password" type="password" minLength={6} maxLength={72} required /></div>
            <DialogFooter><Button type="submit" disabled={busy}>Şifreyi kaydet</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Müşteri hesabı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.business_name || deleting?.full_name} hesabı kalıcı olarak silinecek. Sipariş geçmişi bulunan hesaplar silinmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hesabı sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
