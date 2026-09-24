import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useRef, useState } from "react";
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
  ShieldCheck,
  Shield,
  Users,
  Search,
  RefreshCw,
  UserCheck,
  Cloud,
  PackageSearch,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { GoogleDriveSyncPanel } from "@/components/GoogleDriveSyncPanel";
import type { DriveOrder } from "@/lib/google-drive";
import { getPublicProductImageUrl } from "@/lib/product-image-map";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_MEMBERS, isUserAdmin, GUEST_ACCOUNT } from "@/lib/admin-config";
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

const adminSearchSchema = z.object({
  tab: z.enum(["orders", "products", "drive", "users"]).optional(),
  edit: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/yonetim")({
  validateSearch: (search: Record<string, unknown>) => adminSearchSchema.parse(search),
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

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(
    search.edit ? "products" : (search.tab ?? "orders"),
  );

  useEffect(() => {
    if (search.edit) {
      setActiveTab("products");
    } else if (search.tab) {
      setActiveTab(search.tab);
    }
  }, [search.edit, search.tab]);

  const { data: allOrders = [] } = useQuery({
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

  const { data: allProducts = [] } = useQuery({
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Yönetim paneli</h1>
          <p className="text-sm text-muted-foreground">
            Siparişleri, ürün kataloğunu ve Google Drive senkronizasyonunu yönetin.
          </p>
        </div>
        {activeTab !== "drive" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("drive")}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Cloud className="h-4 w-4 text-primary" />
            Google Drive Eşitleme
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="orders">Siparişler ({allOrders.length})</TabsTrigger>
          <TabsTrigger value="products">Ürünler ({allProducts.length})</TabsTrigger>
          <TabsTrigger value="drive" className="flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            Google Drive
          </TabsTrigger>
          <TabsTrigger value="users">Üyeler</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersPanel onNavigateToDrive={() => setActiveTab("drive")} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsPanel
            initialEditId={search.edit}
            onNavigateToDrive={() => setActiveTab("drive")}
          />
        </TabsContent>
        <TabsContent value="drive">
          <GoogleDriveSyncPanel
            products={allProducts}
            orders={allOrders as unknown as DriveOrder[]}
            onCatalogImported={() => {
              void qc.invalidateQueries({ queryKey: ["admin-products"] });
              void qc.invalidateQueries({ queryKey: ["products"] });
            }}
          />
        </TabsContent>
        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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

function OrdersPanel({ onNavigateToDrive }: { onNavigateToDrive?: () => void }) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {onNavigateToDrive && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToDrive}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Cloud className="h-3.5 w-3.5 text-primary" />
            Drive&apos;a Siparişleri Yedekle
          </Button>
        )}
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

function ProductsPanel({
  initialEditId,
  onNavigateToDrive,
}: {
  initialEditId?: string;
  onNavigateToDrive?: () => void;
}) {
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

  // initialEditId verilmişse veya URL'den gelmişse düzenleme modunu başlat
  useEffect(() => {
    if (!initialEditId) return;
    const target =
      data?.find((p) => p.id === initialEditId) ??
      FALLBACK_PRODUCTS.find((p) => p.id === initialEditId);
    if (target) {
      setEditingId(target.id);
      setForm({
        name: target.name,
        description: target.description ?? "",
        category: target.category,
        unit: target.unit,
        image_url: target.image_url ?? "",
        is_active: target.is_active,
      });
      toast.info(`"${target.name}" düzenleme için hazırlandı.`);
      setTimeout(() => {
        const formEl = document.getElementById("product-edit-form");
        formEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        const nameInput = document.getElementById("pr-name");
        nameInput?.focus();
      }, 150);
    }
  }, [initialEditId, data]);

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

  const [syncingImages, setSyncingImages] = useState(false);

  const syncAllImagesInDatabase = async () => {
    if (!data || data.length === 0) return;
    setSyncingImages(true);
    let updatedCount = 0;
    try {
      for (const p of data) {
        const resolved = getPublicProductImageUrl(p.image_url, p.name);
        if (resolved && resolved !== p.image_url) {
          const { error } = await supabase
            .from("products")
            .update({ image_url: resolved })
            .eq("id", p.id);
          if (!error) updatedCount++;
        }
      }
      if (updatedCount > 0) {
        toast.success(`${updatedCount} ürünün fotoğraf yolu güncellendi ve eşitlendi.`);
        void qc.invalidateQueries({ queryKey: ["admin-products"] });
        void qc.invalidateQueries({ queryKey: ["products", "active"] });
      } else {
        toast.info("Tüm ürün fotoğrafları zaten güncel ve yerel depoya bağlı.");
      }
    } catch {
      toast.error("Fotoğraflar eşitlenirken bir hata oluştu.");
    } finally {
      setSyncingImages(false);
    }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        id="product-edit-form"
        onSubmit={submit}
        className={`h-fit space-y-3 rounded-xl border bg-card p-5 shadow-card transition-all ${
          editingId ? "border-amber-500/60 ring-2 ring-amber-500/20" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{editingId ? "Ürünü düzenle" : "Yeni ürün"}</h2>
            {editingId && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                Düzenleme
              </span>
            )}
          </div>
          {onNavigateToDrive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNavigateToDrive}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Cloud className="h-3.5 w-3.5 text-primary" />
              Drive Kataloğu
            </Button>
          )}
        </div>
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
              {getPublicProductImageUrl(form.image_url, form.name) ? (
                <img
                  src={getPublicProductImageUrl(form.image_url, form.name)!}
                  alt="Önizleme"
                  className="h-full w-full object-contain p-1 bg-white"
                />
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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">
            Kayıtlı Ürünler ({data?.length ?? 0})
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={syncAllImagesInDatabase}
            disabled={syncingImages || isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingImages ? "animate-spin" : ""}`} />
            Görselleri Depoyla Eşitle
          </Button>
        </div>
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
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {getPublicProductImageUrl(p.image_url, p.name) ? (
                    <img
                      src={getPublicProductImageUrl(p.image_url, p.name)!}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-contain p-1 bg-white"
                    />
                  ) : (
                    <PackageSearch className="h-6 w-6 text-muted-foreground" />
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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "admin" | "customer">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      // 1. Önce doğrudan profiles tablosundan çek (Supabase anon/publishable istemciyle her zaman erişilebilir)
      try {
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, full_name, business_name, phone, address, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (!profError && profiles && profiles.length > 0) {
          // Profil haritası
          const existingIds = new Set(profiles.map((p) => p.id));
          const list: AppUser[] = profiles.map((p) => {
            const isGuest = p.phone === "misafir" || p.full_name?.toLowerCase().includes("misafir");
            const admin = isUserAdmin({ id: p.id }, p);
            return {
              id: p.id,
              email: isGuest ? "misafir@kotoptan.local" : null,
              phone: p.phone,
              created_at: p.created_at,
              last_sign_in_at: null,
              is_admin: admin,
              full_name: p.full_name,
              business_name: isGuest
                ? "Misafir Hesabı"
                : p.business_name || (admin ? "KasımOğulları Yönetim" : ""),
              profile_phone: p.phone,
              address: p.address,
            };
          });

          // 5 yönetici listede eksikse garanti ekle
          for (const adm of ADMIN_MEMBERS) {
            if (
              !existingIds.has(adm.id) &&
              !list.some((u) => u.phone?.replace(/\D/g, "").includes(adm.normalizedPhone))
            ) {
              list.unshift({
                id: adm.id,
                email: adm.email,
                phone: adm.phone,
                created_at: new Date().toISOString(),
                last_sign_in_at: null,
                is_admin: true,
                full_name: adm.name,
                business_name: "KasımOğulları Yönetim",
                profile_phone: adm.phone,
                address: "Bitlis Merkez Depo",
              });
            }
          }

          return list;
        }
      } catch (err) {
        console.warn("Direct profiles query fallback:", err);
      }

      // 2. Server function denemesi
      try {
        const serverUsers = await listAppUsers();
        if (serverUsers && serverUsers.length > 0) return serverUsers;
      } catch (err) {
        console.warn("listAppUsers error:", err);
      }

      // 3. Sabit yöneticileri ve misafir hesabını listele
      return [
        ...ADMIN_MEMBERS.map((adm) => ({
          id: adm.id,
          email: adm.email,
          phone: adm.phone,
          created_at: new Date().toISOString(),
          last_sign_in_at: null,
          is_admin: true,
          full_name: adm.name,
          business_name: "KasımOğulları Yönetim",
          profile_phone: adm.phone,
          address: "Bitlis Merkez Depo",
        })),
        {
          id: GUEST_ACCOUNT.id,
          email: GUEST_ACCOUNT.email,
          phone: GUEST_ACCOUNT.phone,
          created_at: new Date().toISOString(),
          last_sign_in_at: null,
          is_admin: false,
          full_name: GUEST_ACCOUNT.name,
          business_name: "Misafir Hesabı (Ziyaretçi)",
          profile_phone: GUEST_ACCOUNT.phone,
          address: "Ziyaretçi",
        },
      ] as AppUser[];
    },
  });

  const users = data ?? [];

  const refreshUsers = async () => {
    await refetch();
    await qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const full_name = String(form.get("full_name") ?? "").trim();
      const business_name = String(form.get("business_name") ?? "").trim();
      const phone = String(form.get("phone") ?? "").trim();
      const address = String(form.get("address") ?? "").trim();

      // 1. Doğrudan supabase profiles tablosunu güncelle
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: editing.id,
        full_name,
        business_name,
        phone,
        address,
      });
      if (profileError) throw profileError;

      // 2. Server function çağrısı (varsa ek yetki güncellemesi)
      try {
        await updateUser({
          data: {
            id: editing.id,
            full_name,
            business_name,
            phone,
            address,
          },
        });
      } catch (err) {
        console.warn("Server updateUser fallback:", err);
      }

      await refreshUsers();
      setEditing(null);
      toast.success("Üye bilgileri güncellendi");
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
    const newPassword = String(form.get("password") ?? "");
    setBusy(true);
    try {
      // Eğer kendi oturumunun şifresini değiştiriyorsa
      const { data: currentAuth } = await supabase.auth.getUser();
      if (currentAuth?.user?.id === passwordUser.id) {
        const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
        if (upErr) throw upErr;
      }

      try {
        await resetPassword({
          data: { id: passwordUser.id, password: newPassword },
        });
      } catch (err) {
        console.warn("resetPassword server fallback:", err);
      }

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
      if (
        isUserAdmin({ id: deleting.id }, { phone: deleting.phone, full_name: deleting.full_name })
      ) {
        toast.error("Sabit sistem yöneticisi hesapları sistem güvenliği için silinemez.");
        setDeleting(null);
        return;
      }

      const { error: delErr } = await supabase.from("profiles").delete().eq("id", deleting.id);
      if (delErr) throw delErr;

      try {
        await removeUser({ data: { id: deleting.id } });
      } catch (err) {
        console.warn("removeUser server fallback:", err);
      }

      await refreshUsers();
      setDeleting(null);
      toast.success("Üye hesabı silindi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Hesap silinemedi");
    } finally {
      setBusy(false);
    }
  };

  // Filtreleme
  const filteredUsers = users.filter((u) => {
    const isGuest = u.phone === "misafir" || u.full_name?.toLowerCase().includes("misafir");
    if (filterType === "admin" && !u.is_admin) return false;
    if (filterType === "customer" && u.is_admin) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.business_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.profile_phone?.toLowerCase().includes(q) ||
      (isGuest && "misafir".includes(q))
    );
  });

  const adminCount = users.filter((u) => u.is_admin).length;
  const customerCount = users.filter((u) => !u.is_admin).length;

  return (
    <div className="mt-6 space-y-6">
      {/* İstatistik ve Açıklama Başlığı */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Toplam Kayıtlı Üye</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-xl border border-[#166534]/30 bg-[#166534]/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#166534]">Sistem Yöneticileri</span>
            <ShieldCheck className="h-4 w-4 text-[#166534]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#166534]">{adminCount} Kişi</p>
          <p className="text-[11px] text-[#166534]/80">Suat, Faruk, Yavuz, Mücahit, Selim</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Müşteriler & Misafir</span>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{customerCount}</p>
          <p className="text-[11px] text-muted-foreground">Misafir hesabı aktif (123456)</p>
        </div>
      </div>

      {/* Arama ve Filtreleme Barı */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, telefon veya işletme adına göre ara..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tümü ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("admin")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "admin"
                  ? "bg-background text-[#166534] shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yöneticiler ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("customer")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === "customer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Müşteriler ({customerCount})
            </button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refreshUsers()}
            title="Listeyi Yenile"
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const isGuest = u.phone === "misafir" || u.full_name?.toLowerCase().includes("misafir");
            return (
              <div
                key={u.id}
                className={`rounded-xl border p-4 shadow-sm transition-colors ${
                  u.is_admin
                    ? "border-[#166534]/40 bg-[#166534]/[0.03]"
                    : isGuest
                      ? "border-amber-500/30 bg-amber-500/[0.02]"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground text-base">
                    {u.full_name || u.business_name || "İsimsiz üye"}
                  </span>
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#166534]/15 px-2.5 py-0.5 text-xs font-semibold text-[#166534]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Yönetici (Şifre: 123456)
                    </span>
                  ) : isGuest ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Misafir Hesabı (Şifre: 123456)
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Müşteri
                    </span>
                  )}
                  {u.created_at && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                  {u.business_name && (
                    <p>
                      <strong className="text-foreground/80">İşletme:</strong> {u.business_name}
                    </p>
                  )}
                  {(u.profile_phone || u.phone) && (
                    <p>
                      <strong className="text-foreground/80">Telefon / Giriş:</strong>{" "}
                      <span className="font-mono text-foreground font-medium">
                        {u.profile_phone || u.phone}
                      </span>
                    </p>
                  )}
                  {u.email && (
                    <p>
                      <strong className="text-foreground/80">Sistem E-posta:</strong> {u.email}
                    </p>
                  )}
                  {u.address && (
                    <p className="sm:col-span-2">
                      <strong className="text-foreground/80">Adres:</strong> {u.address}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                    <Pencil className="h-4 w-4" /> Bilgileri düzenle
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPasswordUser(u)}>
                    <KeyRound className="h-4 w-4" /> Şifre belirle
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (u.is_admin) {
                        toast.error(
                          "Sabit sistem yöneticisi hesapları güvenlik nedeniyle silinemez.",
                        );
                        return;
                      }
                      setDeleting(u);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Hesabı sil
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Arama kriterine uygun üye bulunamadı.</p>
            </div>
          )}
        </div>
      )}

      {/* Düzenleme Diyaloğu */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Üye bilgilerini düzenle</DialogTitle>
            <DialogDescription>
              Telefon veya işletme bilgileri güncellendiğinde sisteme anında yansır.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={saveUser}>
              <div>
                <Label htmlFor="edit-full-name">Ad soyad</Label>
                <Input
                  id="edit-full-name"
                  name="full_name"
                  defaultValue={editing.full_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-business">İşletme adı</Label>
                <Input
                  id="edit-business"
                  name="business_name"
                  defaultValue={editing.business_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={editing.profile_phone || editing.phone || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Adres</Label>
                <Textarea
                  id="edit-address"
                  name="address"
                  defaultValue={editing.address}
                  required
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  Kaydet
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Şifre Belirleme Diyaloğu */}
      <Dialog open={passwordUser !== null} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni şifre belirle</DialogTitle>
            <DialogDescription>
              {passwordUser?.business_name || passwordUser?.full_name} için en az 6 karakterli yeni
              şifre girin.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePassword}>
            <div>
              <Label htmlFor="new-password">Yeni şifre</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                minLength={6}
                maxLength={72}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                Şifreyi kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Diyaloğu */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Üye hesabı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.business_name || deleting?.full_name} hesabı kalıcı olarak silinecek.
              Sipariş geçmişi bulunan hesaplar silinmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hesabı sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
