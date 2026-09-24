import { useEffect, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  FolderSync,
  ExternalLink,
  FileSpreadsheet,
  FileJson,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShoppingCart,
  HardDrive,
  LogOut,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  initGoogleDriveAuth,
  isDriveConnected,
  getDriveUser,
  listAppFiles,
  syncProductCatalogToDrive,
  readProductCatalogFromDrive,
  syncOrdersToDrive,
  syncAllToGoogleDrive,
  deleteDriveFile,
  getOrCreateAppFolder,
  DRIVE_CONFIG,
  type DriveUser,
  type DriveFileItem,
  type DriveOrder,
} from "@/lib/google-drive";
import type { Product } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GoogleDriveSyncPanelProps {
  products: Product[];
  orders: DriveOrder[];
  onCatalogImported?: () => void;
}

export function GoogleDriveSyncPanel({
  products,
  orders,
  onCatalogImported,
}: GoogleDriveSyncPanelProps) {
  const qc = useQueryClient();
  const [user, setUser] = useState<DriveUser | null>(getDriveUser());
  const [connected, setConnected] = useState<boolean>(isDriveConnected());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Operation states
  const [syncingType, setSyncingType] = useState<"all" | "catalog" | "orders" | null>(null);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmSyncAll, setConfirmSyncAll] = useState(false);
  const [confirmSyncCatalog, setConfirmSyncCatalog] = useState(false);
  const [confirmSyncOrders, setConfirmSyncOrders] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);

  // Import preview dialog
  const [importPreviewData, setImportPreviewData] = useState<{
    syncedAt: string;
    totalProducts: number;
    products: Product[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (driveUser) => {
        setUser(driveUser);
        setConnected(true);
      },
      () => {
        setUser(null);
        setConnected(false);
      },
    );
    return () => unsubscribe();
  }, []);

  // Fetch Drive folder URL when connected
  useEffect(() => {
    if (connected) {
      getOrCreateAppFolder()
        .then((id) => setFolderUrl(`https://drive.google.com/drive/folders/${id}`))
        .catch(() => {});
    } else {
      setFolderUrl(null);
    }
  }, [connected]);

  // Query files in Drive folder
  const {
    data: driveFiles = [],
    isLoading: isFilesLoading,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["drive-files", connected],
    queryFn: async () => {
      if (!isDriveConnected()) return [];
      return await listAppFiles();
    },
    enabled: connected,
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { user: driveUser } = await connectGoogleDrive();
      setUser(driveUser);
      setConnected(true);
      toast.success("Google Drive bağlantısı başarıyla kuruldu.");
      void refetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bağlantı hatası";
      toast.error(`Google Drive'a bağlanılamadı: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogleDrive();
      setUser(null);
      setConnected(false);
      setFolderUrl(null);
      toast.success("Google Drive bağlantısı kesildi.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bağlantı kesilemedi";
      toast.error(msg);
    }
  };

  // 1. Full Sync
  const executeSyncAll = async () => {
    setSyncingType("all");
    setConfirmSyncAll(false);
    try {
      const result = await syncAllToGoogleDrive(products, orders);
      setFolderUrl(result.folderUrl);
      toast.success(
        `Tam senkronizasyon başarılı: ${products.length} ürün ve ${orders.length} sipariş Google Drive'a yüklendi.`,
      );
      void refetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Senkronizasyon hatası";
      toast.error(`Senkronizasyon başarısız: ${msg}`);
    } finally {
      setSyncingType(null);
    }
  };

  // 2. Catalog Sync
  const executeSyncCatalog = async () => {
    setSyncingType("catalog");
    setConfirmSyncCatalog(false);
    try {
      const result = await syncProductCatalogToDrive(products);
      toast.success(
        `Ürün kataloğu (${result.itemCount} ürün) Google Drive'a JSON ve Tablo (CSV) olarak eşitlendi.`,
      );
      void refetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Katalog senkronizasyon hatası";
      toast.error(`Katalog aktarılamadı: ${msg}`);
    } finally {
      setSyncingType(null);
    }
  };

  // 3. Orders Sync
  const executeSyncOrders = async () => {
    setSyncingType("orders");
    setConfirmSyncOrders(false);
    try {
      const result = await syncOrdersToDrive(orders);
      toast.success(
        `Müşteri siparişleri (${result.itemCount} sipariş) Google Drive'a JSON ve E-Tablo (CSV) olarak eşitlendi.`,
      );
      void refetchFiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sipariş senkronizasyon hatası";
      toast.error(`Siparişler aktarılamadı: ${msg}`);
    } finally {
      setSyncingType(null);
    }
  };

  // 4. Read Catalog from Drive for Import
  const handleFetchCatalogFromDrive = async () => {
    try {
      const data = await readProductCatalogFromDrive();
      setImportPreviewData({
        syncedAt: data.syncedAt,
        totalProducts: data.totalProducts,
        products: data.products,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Katalog okunamadı";
      toast.error(msg);
    }
  };

  // 5. Apply Imported Catalog to Database
  const handleApplyCatalogImport = async () => {
    if (!importPreviewData) return;
    setIsImporting(true);

    try {
      let importedCount = 0;
      for (const p of importPreviewData.products) {
        const payload = {
          name: p.name,
          description: p.description || "",
          category: p.category || "gida",
          unit: p.unit || "adet",
          image_url: p.image_url || null,
          is_active: p.is_active ?? true,
        };

        const { error } = await supabase
          .from("products")
          .upsert({ id: p.id, ...payload }, { onConflict: "id" });

        if (!error) importedCount++;
      }

      toast.success(
        `Google Drive'dan ${importedCount} ürün başarıyla veri tabanına aktarıldı/güncellendi.`,
      );
      setImportPreviewData(null);
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      onCatalogImported?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "İçe aktarma hatası";
      toast.error(`İçe aktarma sırasında hata oluştu: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  // 6. Delete File (with confirmation)
  const executeDeleteFile = async () => {
    if (!fileToDelete) return;
    const { id, name } = fileToDelete;
    setFileToDelete(null);

    startTransition(async () => {
      try {
        await deleteDriveFile(id);
        toast.success(`'${name}' dosyası Google Drive'dan kaldırıldı.`);
        void refetchFiles();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Silinemedi";
        toast.error(`Dosya silinemedi: ${msg}`);
      }
    });
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return "-";
    const b = parseInt(bytes, 10);
    if (isNaN(b)) return "-";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Connection Header & Official Sign-in Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Google Drive Entegrasyonu & Senkronizasyon
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                KasımOğulları ürün kataloğunu ve müşteri siparişlerini Google Drive hesabınızda
                otomatik olarak eşitleyin, yedekleyin ve arşivleyin.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono">
                  OAuth Client ID: {DRIVE_CONFIG.oAuthClientId ? "Aktif" : "Eksik"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono">
                  Klasör: {DRIVE_CONFIG.driveFolderName}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {connected && user ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Google"}
                    className="h-8 w-8 rounded-full border border-emerald-500/40"
                  />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                <div className="text-left">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    {user.displayName || "Google Kullanıcısı"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="ml-2 h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  title="Bağlantıyı Kes"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              /* Official Google Sign-in Styled Button as mandated by Workspace Skill */
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className="gsi-material-button inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted/80 disabled:opacity-50"
              >
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="font-semibold text-foreground">
                  {isConnecting ? "Bağlanıyor..." : "Google Drive ile Bağlan"}
                </span>
              </button>
            )}
          </div>
        </div>

        {!connected && (
          <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Google Drive bağlantısı gereklidir</span>
            </div>
            <p className="mt-1">
              Google Drive hesabınızı bağlayarak ürün kataloğu ve müşteri sipariş verilerinizi tek
              tıkla Google E-Tablolar (CSV) ve JSON formatında Drive klasörünüze yedekleyebilir ve
              farklı cihazlar arasında senkronize edebilirsiniz.
            </p>
          </div>
        )}
      </div>

      {/* 2. Main Sync Actions Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Catalog Sync Card */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-card">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Ürün Kataloğu Senkronizasyonu</h3>
                  <p className="text-xs text-muted-foreground">
                    Veri tabanındaki {products.length} ürün
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                JSON + E-Tablo (CSV)
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Güncel ürün kataloğunuzu (isim, birim, koli içi, kategori, durum) Google Drive&apos;a
              aktarın veya Drive&apos;da depolanan katalog yedeğinden ürünleri sisteme geri
              yükleyin.
            </p>

            <div className="mt-4 space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktarılacak Dosyalar:</span>
                <span className="font-mono font-medium">urun-katalogu-sync.json & tablo.csv</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kayıtlı Ürün Sayısı:</span>
                <span className="font-semibold text-foreground">{products.length} adet</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => setConfirmSyncCatalog(true)}
              disabled={!connected || syncingType !== null}
              className="flex-1 gap-2"
            >
              {syncingType === "catalog" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Drive&apos;a Aktar
            </Button>
            <Button
              variant="outline"
              onClick={handleFetchCatalogFromDrive}
              disabled={!connected || syncingType !== null}
              className="gap-2"
            >
              <CloudDownload className="h-4 w-4" />
              Drive&apos;dan İçe Aktar
            </Button>
          </div>
        </div>

        {/* Orders Sync Card */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-card">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Müşteri Siparişleri Senkronizasyonu</h3>
                  <p className="text-xs text-muted-foreground">
                    Veri tabanındaki {orders.length} sipariş
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                JSON + E-Tablo (CSV)
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Müşteri siparişlerini, kalem detaylarını, müşteri iletişim bilgilerini ve sipariş
              durumlarını Google Drive&apos;a yedekleyin. Excel ve Google E-Tablolar ile açılabilen
              CSV oluşturulur.
            </p>

            <div className="mt-4 space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktarılacak Dosyalar:</span>
                <span className="font-mono font-medium">siparisler-sync.json & tablo.csv</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam Sipariş Sayısı:</span>
                <span className="font-semibold text-foreground">{orders.length} sipariş</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => setConfirmSyncOrders(true)}
              disabled={!connected || syncingType !== null}
              className="flex-1 gap-2"
            >
              {syncingType === "orders" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Siparişleri Drive&apos;a Aktar
            </Button>
            {folderUrl && (
              <Button variant="outline" asChild className="gap-2">
                <a href={folderUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  E-Tabloları Aç
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Global Full Sync Banner */}
      {connected && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FolderSync className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">Hızlı Tam Senkronizasyon</h4>
              <p className="text-xs text-muted-foreground">
                Tek dokunuşla tüm ürün kataloğunu ve müşteri sipariş kayıtlarını arşivleyip Google
                Drive klasörüne aktarın.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {folderUrl && (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={folderUrl} target="_blank" rel="noopener noreferrer">
                  <FolderOpen className="h-4 w-4" />
                  Drive Klasörü
                </a>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setConfirmSyncAll(true)}
              disabled={syncingType !== null}
              className="gap-1.5 font-semibold"
            >
              {syncingType === "all" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              Tümünü Şimdi Eşitle
            </Button>
          </div>
        </div>
      )}

      {/* 4. Synced Files Explorer in Google Drive */}
      {connected && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Google Drive&apos;daki Dosyalarınız
              </h3>
              <p className="text-xs text-muted-foreground">
                Klasör: <span className="font-mono">{DRIVE_CONFIG.driveFolderName}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchFiles()}
                disabled={isFilesLoading}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFilesLoading ? "animate-spin" : ""}`} />
                Yenile
              </Button>
              {folderUrl && (
                <Button variant="secondary" size="sm" asChild className="gap-1.5">
                  <a href={folderUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Google Drive&apos;da Aç
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4">
            {isFilesLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                Dosyalar yükleniyor...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Henüz bu klasörde senkronize edilmiş dosya bulunmuyor. Yukarıdaki butonlarla ilk
                senkronizasyonu başlatabilirsiniz.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Dosya Adı</th>
                      <th className="pb-2 font-medium">Tür</th>
                      <th className="pb-2 font-medium">Boyut</th>
                      <th className="pb-2 font-medium">Son Güncelleme</th>
                      <th className="pb-2 text-right font-medium">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {driveFiles.map((file) => {
                      const isCsv = file.name.endsWith(".csv");
                      const isJson = file.name.endsWith(".json");
                      return (
                        <tr key={file.id} className="hover:bg-muted/40">
                          <td className="py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {isCsv ? (
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                              ) : isJson ? (
                                <FileJson className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Cloud className="h-4 w-4 text-primary" />
                              )}
                              <span>{file.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {isCsv ? "E-Tablo (CSV)" : isJson ? "JSON Veri" : "Dosya"}
                          </td>
                          <td className="py-3 text-xs font-mono text-muted-foreground">
                            {formatFileSize(file.size)}
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {file.modifiedTime
                              ? new Date(file.modifiedTime).toLocaleString("tr-TR")
                              : "-"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {file.webViewLink && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 gap-1 px-2 text-xs"
                                >
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Aç
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFileToDelete(file)}
                                disabled={isPending}
                                className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                title="Dosyayı Sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Sync All (Mandatory destructive operation confirmation) */}
      <AlertDialog open={confirmSyncAll} onOpenChange={setConfirmSyncAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tüm Verileri Google Drive&apos;a Eşitle?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem {products.length} adet ürün ve {orders.length} adet müşteri siparişini Google
              Drive klasörünüze (&apos;{DRIVE_CONFIG.driveFolderName}&apos;) JSON ve E-Tablo (CSV)
              olarak yükleyecektir. Var olan ana senkronizasyon dosyaları güncellenecek ve tarihli
              arşiv yedeği oluşturulacaktır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeSyncAll}
              className="bg-primary text-primary-foreground"
            >
              Onayla ve Eşitle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMATION DIALOG: Sync Catalog */}
      <AlertDialog open={confirmSyncCatalog} onOpenChange={setConfirmSyncCatalog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ürün Kataloğunu Google Drive&apos;a Aktar?</AlertDialogTitle>
            <AlertDialogDescription>
              {products.length} ürünün tüm bilgileri Google Drive&apos;daki
              &apos;urun-katalogu-sync.json&apos; ve &apos;urun-katalogu-tablo.csv&apos; dosyalarına
              yazılacaktır. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={executeSyncCatalog}>Onayla ve Aktar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMATION DIALOG: Sync Orders */}
      <AlertDialog open={confirmSyncOrders} onOpenChange={setConfirmSyncOrders}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Siparişleri Google Drive&apos;a Aktar?</AlertDialogTitle>
            <AlertDialogDescription>
              {orders.length} sipariş kaydı Google Drive&apos;daki &apos;siparisler-sync.json&apos;
              ve &apos;siparisler-tablo.csv&apos; dosyalarına yazılacaktır. Devam etmek istiyor
              musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={executeSyncOrders}>Onayla ve Aktar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMATION DIALOG: Delete File from Drive */}
      <AlertDialog
        open={Boolean(fileToDelete)}
        onOpenChange={(open) => !open && setFileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Google Drive&apos;dan Dosya Silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{fileToDelete?.name}&apos; adlı dosya Google Drive hesabınızdan kalıcı olarak
              kaldırılacaktır. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Dosyayı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DIALOG: Preview and Confirm Catalog Import */}
      <Dialog
        open={Boolean(importPreviewData)}
        onOpenChange={(open) => !open && setImportPreviewData(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Google Drive&apos;dan Katalog İçe Aktarma</DialogTitle>
            <DialogDescription>
              Google Drive&apos;daki &apos;urun-katalogu-sync.json&apos; dosyasından{" "}
              {importPreviewData?.totalProducts} adet ürün okundu. Bu ürünleri veri tabanına işlemek
              istiyor musunuz?
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-border p-3 text-xs">
            <p className="font-semibold text-foreground">İçe Aktarılacak Ürünler:</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {importPreviewData?.products.slice(0, 15).map((p) => (
                <li key={p.id} className="flex justify-between border-b border-border/50 pb-1">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span>
                    {p.category} • {p.unit}
                  </span>
                </li>
              ))}
              {(importPreviewData?.products.length ?? 0) > 15 && (
                <li className="pt-1 text-center italic">
                  ... ve {(importPreviewData?.products.length ?? 0) - 15} ürün daha
                </li>
              )}
            </ul>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportPreviewData(null)}
              disabled={isImporting}
            >
              Vazgeç
            </Button>
            <Button onClick={handleApplyCatalogImport} disabled={isImporting} className="gap-2">
              {isImporting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              Onayla ve İçe Aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
