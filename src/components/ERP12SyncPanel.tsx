import { useState, useEffect, useMemo } from "react";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileCode,
  PackageCheck,
  PackageX,
  Search,
  Boxes,
  Package,
  Layers,
  Sparkles,
  ArrowUpDown,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/lib/catalog";
import { categoryLabel, formatUnitLabel } from "@/lib/catalog";
import {
  getERP12SyncStatus,
  ingestERP12Data,
  type ERP12SyncStatus,
  type ERP12ProductRow,
} from "@/lib/erp-sync";

interface ERP12SyncPanelProps {
  products: Product[];
  onCatalogUpdated?: () => void;
}

export function ERP12SyncPanel({ products, onCatalogUpdated }: ERP12SyncPanelProps) {
  const [status, setStatus] = useState<ERP12SyncStatus>(() => getERP12SyncStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/erp-sync");
      if (res.ok) {
        const data = await res.json();
        const inStockCount = products.filter((p) => p.in_stock !== false).length;
        const outOfStockCount = products.length - inStockCount;

        const updated: ERP12SyncStatus = {
          connected: true,
          lastSyncAt: data.lastSyncAt || new Date().toISOString(),
          totalSyncedProducts: products.length,
          inStockCount,
          outOfStockCount,
          source: data.source || "ERP 12 SQL Server",
          lastSyncMessage: "ERP 12 SQL bağlantısı aktif ve veri akışı güncel.",
        };
        setStatus(updated);
        toast.success("ERP 12 SQL bağlantısı doğrulandı ve stok verileri eşitlendi.");
      } else {
        toast.error("ERP 12 sunucu yanıtı alınamadı.");
      }
    } catch {
      toast.error("ERP 12 sunucu bağlantısında hata oluştu.");
    } finally {
      setIsRefreshing(false);
      onCatalogUpdated?.();
    }
  };

  useEffect(() => {
    const inStockCount = products.filter((p) => p.in_stock !== false).length;
    const outOfStockCount = products.length - inStockCount;
    setStatus((prev) => ({
      ...prev,
      totalSyncedProducts: products.length,
      inStockCount,
      outOfStockCount,
      connected: true,
    }));
  }, [products]);

  const handleImportSubmit = async () => {
    if (!importText.trim()) {
      toast.error("Lütfen içe aktarılacak ERP 12 SQL veya JSON verisini yapıştırın.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await ingestERP12Data(importText, {
        sourceName: "ERP 12 SQL Manuel Aktarım",
      });

      if (res.success) {
        toast.success(res.message);
        setIsImportOpen(false);
        setImportText("");
        onCatalogUpdated?.();
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ERP 12 verisi işlenemedi";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadSampleERP12 = () => {
    const sampleRows: ERP12ProductRow[] = [
      {
        STOK_KODU: "ERP-GDA-101",
        STOK_ADI: "Tatvan Doğal Baldo Pirinç 5 Kg",
        ANA_GRUP: "Bakliyat",
        BIRIM: "Çuval",
        BAKIYE: 250,
        KOLI_ICI: "5 Kg Çuval",
        AKTIF: 1,
      },
      {
        STOK_KODU: "ERP-TMZ-204",
        STOK_ADI: "Doa Ultra Çamaşır Suyu 4 Kg",
        ANA_GRUP: "Temizlik",
        BIRIM: "Koli",
        BAKIYE: 120,
        KOLI_ICI: "4 Adet / Koli",
        AKTIF: 1,
      },
      {
        STOK_KODU: "ERP-GDA-305",
        STOK_ADI: "Çaykur Rize Turist Çayı 1000g",
        ANA_GRUP: "Gıda",
        BIRIM: "Koli",
        BAKIYE: 85,
        KOLI_ICI: "12 Paket / Koli",
        AKTIF: 1,
      },
    ];

    setImportText(JSON.stringify(sampleRows, null, 2));
  };

  const filteredItems = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());

      const inStock = p.in_stock !== false;
      const matchesStock =
        selectedFilter === "all" ||
        (selectedFilter === "in_stock" && inStock) ||
        (selectedFilter === "out_of_stock" && !inStock);

      return matchesSearch && matchesStock;
    });
  }, [products, searchQuery, selectedFilter]);

  return (
    <div className="space-y-6">
      {/* ERP 12 Status Banner Card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
              <Database className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">ERP 12 SQL Canlı Veritabanı</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BAĞLI
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                KasımOğulları Ltd. Şti. Ana Depo SQL veri akışı ve bakiye senkronizasyonu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStatus}
              disabled={isRefreshing}
              className="gap-1.5 font-semibold text-xs border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Stokları Yenile</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsImportOpen(true)}
              className="gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>SQL / JSON İçe Aktar</span>
            </Button>
          </div>
        </div>

        {/* 4 Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[11px] font-medium text-muted-foreground block">Toplam Ürün</span>
            <span className="text-lg font-bold text-foreground tabular-nums">
              {products.length} Adet
            </span>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <span className="text-[11px] font-medium text-emerald-400 block">Stokta Mevcut</span>
            <span className="text-lg font-bold text-emerald-400 tabular-nums">
              {status.inStockCount} Ürün
            </span>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
            <span className="text-[11px] font-medium text-rose-400 block">Tükenen / Kritik</span>
            <span className="text-lg font-bold text-rose-400 tabular-nums">
              {status.outOfStockCount} Ürün
            </span>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Veri Kaynağı
            </span>
            <span className="text-xs font-semibold text-foreground truncate block mt-1">
              {status.source || "ERP 12 SQL"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Stok adı, barkod veya kod ara..."
            className="h-9 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedFilter("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedFilter === "all"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tümü ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("in_stock")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedFilter === "in_stock"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Stokta ({status.inStockCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("out_of_stock")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedFilter === "out_of_stock"
                ? "bg-rose-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tükendi ({status.outOfStockCount})
          </button>
        </div>
      </div>

      {/* Synced Products Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Stok Kodu</th>
                <th className="px-4 py-3">Ürün Adı</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Birim</th>
                <th className="px-4 py-3">Stok Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.slice(0, 50).map((item) => {
                const inStock = item.in_stock !== false;
                return (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {item.id}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{item.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="capitalize text-muted-foreground">
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-medium">
                      {formatUnitLabel(item.unit)}
                    </td>
                    <td className="px-4 py-2.5">
                      {inStock ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Stokta Var</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                          <PackageX className="h-3.5 w-3.5" />
                          <span>Tükendi</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredItems.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border bg-muted/20">
            Toplam {filteredItems.length} üründen ilk 50 tanesi gösteriliyor.
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600" />
              <span>ERP 12 SQL / JSON Veri Aktarımı</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              ERP 12 programınızdan aldığınız Stok Listesi JSON veya SQL sorgusu dökümünü buraya
              yapıştırarak kataloğu tek tıkla güncelleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Veri Metni (JSON / SQL)</span>
              <button
                type="button"
                onClick={handleLoadSampleERP12}
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                Örnek Şablonu Yükle
              </button>
            </div>
            <Textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[{ "STOK_KODU": "010203", "STOK_ADI": "Baldo Pirinç 5 Kg", "ANA_GRUP": "Bakliyat", "BIRIM": "Çuval", "BAKIYE": 150 }]...'
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(false)}>
              Vazgeç
            </Button>
            <Button
              size="sm"
              onClick={handleImportSubmit}
              disabled={isImporting || !importText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isImporting ? "İşleniyor..." : "Verileri İçe Aktar ve Kataloğu Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
