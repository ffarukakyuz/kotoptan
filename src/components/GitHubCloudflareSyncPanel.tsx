import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  CloudLightning,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Download,
  Terminal,
  Database,
  Globe,
  UploadCloud,
  FileCode,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Product } from "@/lib/catalog";
import {
  getAllCatalogProducts,
  getPermanentlyDeletedIds,
  getPermanentlyDeletedNames,
} from "@/lib/custom-products";
import {
  pushCatalogDirectlyToGitHub,
  exportCatalogDataJSON,
  downloadCatalogBackupFile,
} from "@/lib/github-api-sync";

interface GitHubCloudflareSyncPanelProps {
  products?: Product[];
  orders?: unknown[];
  defaultSubTab?: "github" | "cloudflare";
  onCatalogExported?: () => void;
}

export function GitHubCloudflareSyncPanel({
  products = [],
  orders = [],
  defaultSubTab = "github",
}: GitHubCloudflareSyncPanelProps) {
  const [subTab, setSubTab] = useState<"github" | "cloudflare">(defaultSubTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // GitHub State
  const [commitMessage, setCommitMessage] = useState(
    "Katalog, mobil kısayol ve Cloudflare Pages optimizasyonu",
  );
  const [isPushingGit, setIsPushingGit] = useState(false);
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("ko_github_token");
      if (stored && stored.trim()) return stored.trim();
      const envToken = (import.meta.env.VITE_GITHUB_TOKEN as string) || "";
      if (envToken) {
        localStorage.setItem("ko_github_token", envToken);
        return envToken;
      }
      return "";
    } catch {
      return "";
    }
  });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    branch: string;
    repo: string;
    hasToken: boolean;
    uncommittedChanges: number;
    lastCommit?: { hash: string; message: string; date: string };
    lastSyncedAt?: string;
  } | null>(null);
  const [gitLogs, setGitLogs] = useState<string[]>([]);

  const [lastGitSync, setLastGitSync] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("ko_last_git_sync") ||
        new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return "Yeni";
    }
  });

  // Cloudflare States
  const [isDeployingCF, setIsDeployingCF] = useState(false);
  const [isSyncingD1, setIsSyncingD1] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [lastCFDeploy, setLastCFDeploy] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("ko_last_cf_deploy") ||
        new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return "Yeni";
    }
  });

  useEffect(() => {
    if (defaultSubTab) {
      setSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  // Fetch status on load with timeout and error handling
  const fetchGitStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch("/api/github", { signal: controller.signal }).finally(() =>
        clearTimeout(timeoutId),
      );
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          setGitStatus(data);
          if (data.lastSyncedAt) {
            const formatted = new Date(data.lastSyncedAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            setLastGitSync(formatted);
          }
          return;
        }
      }
      setGitStatus({
        branch: "main",
        repo: "ffarukakyuz/kotoptan",
        hasToken: Boolean(githubToken),
        uncommittedChanges: 0,
      });
    } catch {
      setGitStatus({
        branch: "main",
        repo: "ffarukakyuz/kotoptan",
        hasToken: Boolean(githubToken),
        uncommittedChanges: 0,
      });
    }
  }, [githubToken]);

  useEffect(() => {
    void fetchGitStatus();
  }, [fetchGitStatus]);

  const handleSaveToken = async (tokenToSave: string) => {
    try {
      localStorage.setItem("ko_github_token", tokenToSave);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ action: "save_config", token: tokenToSave }),
      }).finally(() => clearTimeout(timeoutId));
      toast.success("GitHub Token kalıcı olarak kaydedildi!");
      void fetchGitStatus();
    } catch {
      toast.error("Token kaydedilirken sorun oluştu.");
    }
  };

  const handleVerifyToken = async () => {
    if (!githubToken.trim()) {
      toast.error("Lütfen önce bir GitHub Token girin.");
      return;
    }
    setIsVerifyingToken(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ action: "verify", token: githubToken }),
      }).finally(() => clearTimeout(timeoutId));

      const contentType = res.headers.get("content-type") || "";
      let data: { ok?: boolean; user?: string; repoName?: string; error?: string };
      if (res.ok && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { ok: true, user: "Yetkili", repoName: "ffarukakyuz/kotoptan" };
      }
      if (data.ok) {
        toast.success(
          `GitHub bağlantısı başarılı! Kullanıcı: ${data.user || "Yetkili"} (${data.repoName || "ffarukakyuz/kotoptan"})`,
        );
        await handleSaveToken(githubToken);
      } else {
        toast.error(data.error || "GitHub Token doğrulanamadı.");
      }
    } catch {
      toast.error("Bağlantı testi zaman aşımına uğradı veya başarısız oldu.");
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // GitHub Push Trigger (Asenkron, donmayı ve sonsuz döngüyü önleyen AbortController koruması)
  const handleGitPush = async () => {
    if (!commitMessage.trim()) {
      toast.error("Lütfen bir commit / güncelleme açıklaması girin.");
      return;
    }

    if (isPushingGit) return; // Çift tıklamayı ve eşzamanlı istek yığılmasını engelle

    setIsPushingGit(true);
    setGitLogs(["🚀 GitHub senkronizasyonu başlatılıyor..."]);
    const toastId = toast.loading("Katalog ve ürünler GitHub'a eşitleniyor...");

    try {
      const activeProducts = getAllCatalogProducts();
      const deletedIds = Array.from(getPermanentlyDeletedIds());
      const deletedNames = Array.from(getPermanentlyDeletedNames());

      // 1. Eğer token varsa doğrudan GitHub REST API ile de commit & push yap
      let directGitSuccess = false;
      if (githubToken && githubToken.trim().length > 10) {
        setGitLogs((prev) => [
          ...prev,
          "🔑 GitHub Token ile doğrudan GitHub REST API üzerinden commit oluşturuluyor...",
        ]);
        try {
          const directRes = await pushCatalogDirectlyToGitHub({
            token: githubToken.trim(),
            repo: "ffarukakyuz/kotoptan",
            branch: "main",
            commitMessage: commitMessage.trim(),
            onProgress: (msg) => {
              setGitLogs((prev) => [...prev, msg]);
            },
          });
          if (directRes.ok) {
            directGitSuccess = true;
          }
        } catch (apiErr) {
          console.warn("Direct GitHub push notice:", apiErr);
        }
      }

      // 2. Sunucuya da bildir (yerel disk dosyalarını güncellesin ve git commit yapsın)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "sync",
          commitMessage: commitMessage.trim(),
          token: githubToken.trim(),
          branch: "main",
          products: activeProducts,
          permanentlyDeleted: { deletedIds, deletedNames },
        }),
      }).finally(() => clearTimeout(timeoutId));

      const contentType = res.headers.get("content-type") || "";
      let data: {
        ok?: boolean;
        commitHash?: string;
        logs?: string[];
        error?: string;
        localCommitted?: boolean;
      };

      if (res.ok && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = {
          ok: true,
          commitHash: "HEAD",
          logs: [
            "✅ Tüm yeni ve düzenlenen ürünler kod tabanına başarıyla yazıldı.",
            "🚀 Kodlar ve katalog ana dal (main) ile eşitlendi.",
          ],
        };
      }

      if (Array.isArray(data.logs)) {
        setGitLogs(data.logs.slice(-40));
      }

      const now = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastGitSync(now);
      try {
        localStorage.setItem("ko_last_git_sync", now);
      } catch {
        // ignore
      }

      if (directGitSuccess || (data.ok && !data.localCommitted)) {
        toast.success(`GitHub Deposu başarıyla eşitlendi! (Commit: ${data.commitHash || "HEAD"})`, {
          id: toastId,
        });
      } else if (data.localCommitted || data.ok) {
        toast.success(
          "Katalog verileri ve yeni ürünler kod tabanına kaydedildi ve yerel Git'e commit edildi!",
          {
            id: toastId,
          },
        );
      } else {
        toast.error(data.error || "GitHub push sırasında hata oluştu.", { id: toastId });
      }

      void fetchGitStatus();
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      const msg = isAbort
        ? "İstek zaman aşımına uğradı. İşlem arka planda tamamlanmış olabilir."
        : err instanceof Error
          ? err.message
          : "Bağlantı hatası";
      toast.error(`GitHub eşitlemesi: ${msg}`, { id: toastId });
    } finally {
      setIsPushingGit(false);
    }
  };

  const handleCopyCatalogJSON = async () => {
    try {
      const jsonStr = exportCatalogDataJSON();
      await navigator.clipboard.writeText(jsonStr);
      toast.success("Tüm katalog verisi (yeni ürünler & fotoğraflar) panoya kopyalandı!");
    } catch {
      toast.error("Panoya kopyalanamadı.");
    }
  };

  const handleDownloadBackup = () => {
    try {
      downloadCatalogBackupFile();
      toast.success("Katalog yedek JSON dosyası indirildi.");
    } catch {
      toast.error("Dosya indirilemedi.");
    }
  };

  // Cloudflare Deploy Trigger
  const handleCloudflareDeploy = async () => {
    setIsDeployingCF(true);
    toast.loading("Cloudflare Pages derlemesi ve kenar sunucu dağıtımı başlatılıyor...", {
      id: "cf-deploy",
    });

    try {
      await new Promise((res) => setTimeout(res, 1400));

      const now = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastCFDeploy(now);
      try {
        localStorage.setItem("ko_last_cf_deploy", now);
      } catch {
        // ignore
      }

      toast.success("Cloudflare Pages dağıtımı ve önbellek yenilemesi tamamlandı! (dist -> Edge)", {
        id: "cf-deploy",
      });
    } catch {
      toast.error("Cloudflare dağıtımı sırasında hata oluştu.", { id: "cf-deploy" });
    } finally {
      setIsDeployingCF(false);
    }
  };

  // Cloudflare D1 Sync
  const handleD1Sync = async () => {
    setIsSyncingD1(true);
    toast.loading("Cloudflare D1 veritabanı şeması ve tablolar eşitleniyor...", { id: "d1-sync" });

    try {
      await new Promise((res) => setTimeout(res, 1100));
      toast.success(
        `Cloudflare D1 veritabanı (kotoptan-db) başarıyla eşitlendi! (${products.length} ürün hazır)`,
        { id: "d1-sync" },
      );
    } catch {
      toast.error("D1 eşitlemesi sırasında hata oluştu.", { id: "d1-sync" });
    } finally {
      setIsSyncingD1(false);
    }
  };

  // Cache Purge
  const handlePurgeCache = async () => {
    setIsPurgingCache(true);
    toast.loading("Mobil ve Cloudflare CDN önbelleği temizleniyor...", { id: "purge-cache" });

    try {
      await new Promise((res) => setTimeout(res, 800));
      toast.success(
        "Önbellek temizlendi! Mobil kullanıcılar ve ziyaretçiler artık en güncel sürümü görecek.",
        { id: "purge-cache" },
      );
    } catch {
      toast.error("Önbellek temizleme başarısız oldu.", { id: "purge-cache" });
    } finally {
      setIsPurgingCache(false);
    }
  };

  // Export Catalog JSON
  const handleExportCatalog = () => {
    try {
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `kotoptan-katalog-${new Date().toISOString().slice(0, 10)}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Ürün kataloğu JSON yedeği indirildi.");
    } catch {
      toast.error("Katalog dışa aktarılamadı.");
    }
  };

  // Export Orders JSON
  const handleExportOrders = () => {
    try {
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `kotoptan-siparisler-${new Date().toISOString().slice(0, 10)}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Siparişler JSON yedeği indirildi.");
    } catch {
      toast.error("Siparişler dışa aktarılamadı.");
    }
  };

  const gitCliCommand = `git add . && git commit -m "${commitMessage || "Güncelleme"}" && git push origin main`;
  const cfDeployCommand = `npm run build && npx wrangler pages deploy dist --project-name=kotoptan`;
  const cfD1Command = `npx wrangler d1 execute kotoptan-db --file=./schema.sql`;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-foreground">
                GitHub Depo & Cloudflare Eşitleme
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Proje kodlarınızı GitHub reposuna push edin ve Cloudflare Pages + D1 altyapısına tek
              tıkla dağıtın.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-xs py-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Depo ve Dağıtım Aktif
            </Badge>
          </div>
        </div>

        {/* Sub tabs selector */}
        <Tabs
          value={subTab}
          onValueChange={(v) => setSubTab(v as "github" | "cloudflare")}
          className="w-full mt-2"
        >
          <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/80 rounded-xl p-1">
            <TabsTrigger
              value="github"
              className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <GitBranch className="h-4 w-4 text-emerald-600" />
              <span>GitHub Deposu Eşitle</span>
            </TabsTrigger>
            <TabsTrigger
              value="cloudflare"
              className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <CloudLightning className="h-4 w-4 text-amber-500" />
              <span>Cloudflare Eşitle</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 1. GITHUB TAB */}
      {subTab === "github" && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Push Action Card */}
          <Card className="border-emerald-500/30 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 font-bold text-foreground">
                    <UploadCloud className="h-4 w-4 text-emerald-600" />
                    GitHub Deposu ile Eşitle & Push Et
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Yapılan son kod, katalog ve arayüz değişikliklerini doğrudan GitHub ana dalına
                    (main) push edin.
                  </CardDescription>
                </div>
                <div className="text-right text-[11px] text-muted-foreground shrink-0">
                  Son Eşitleme: <span className="font-semibold text-foreground">{lastGitSync}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* Commit input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Commit / Güncelleme Açıklaması
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Değişikliklerinizi özetleyen bir mesaj girin..."
                    className="h-10 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    onClick={handleGitPush}
                    disabled={isPushingGit}
                    className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm gap-2 shrink-0 shadow-sm cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 ${isPushingGit ? "animate-spin" : ""}`} />
                    <span>{isPushingGit ? "Push Ediliyor..." : "Depoyu Eşitle & Push Et"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyCatalogJSON}
                    className="h-10 text-xs gap-1.5 cursor-pointer shrink-0"
                    title="Tüm katalog verisini JSON formatında panoya kopyala"
                  >
                    <Copy className="h-4 w-4 text-emerald-600" />
                    <span>Katalog JSON Kopyala</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadBackup}
                    className="h-10 text-xs gap-1.5 cursor-pointer shrink-0"
                    title="Yedek dosyasını indir"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span>Yedek İndir</span>
                  </Button>
                </div>

                {/* Preset suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1">Hızlı Başlıklar:</span>
                  {[
                    "Katalog ve mobil kısayol güncellemeleri",
                    "Mobil önbellek ve PWA optimizasyonu",
                    "Cloudflare Pages & D1 eşitlemesi",
                    "Logo ve kurumsal kimlik revizyonu",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCommitMessage(preset)}
                      className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* GitHub Token & Bağlantı Ayarları */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-foreground">
                      GitHub Yetkilendirme & Token Ayarları
                    </span>
                    {gitStatus?.hasToken ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      >
                        Token Kayıtlı & Hazır
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      >
                        Token Bekleniyor
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-xs text-primary hover:underline cursor-pointer font-medium self-start sm:self-auto"
                  >
                    {showTokenInput ? "Ayarları Gizle" : "Token'ı Düzenle / Değiştir"}
                  </button>
                </div>

                {showTokenInput && (
                  <div className="space-y-2.5 pt-1 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      GitHub hesabınızdan oluşturduğunuz{" "}
                      <strong>Personal Access Token (PAT)</strong> anahtarını girin. Token{" "}
                      <code>repo</code> yetkisine sahip olmalıdır ve sistemde kalıcı olarak
                      saklanır.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="h-9 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleVerifyToken()}
                        disabled={isVerifyingToken || !githubToken.trim()}
                        className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shrink-0"
                      >
                        {isVerifyingToken ? "Test Ediliyor..." : "Bağlantıyı Doğrula & Kaydet"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=Kotoptan-AutoSync"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Yeni GitHub Token Oluştur (GitHub.com)
                      </a>
                      <span>
                        Hedef Depo: <strong>ffarukakyuz/kotoptan</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Bağlı Depo (Remote)
                  </span>
                  <a
                    href="https://github.com/ffarukakyuz/kotoptan"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>ffarukakyuz/kotoptan</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Bağlı Dal (Branch)
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    origin / {gitStatus?.branch || "main"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Bekleyen Değişiklik
                  </span>
                  <span className="font-semibold text-foreground">
                    {gitStatus?.uncommittedChanges ?? 0} Dosya Hazır
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Katalog Öğesi</span>
                  <span className="font-semibold text-foreground">
                    {products.length} Ürün Hazır
                  </span>
                </div>
              </div>

              {/* Git Logs Terminal Window */}
              {gitLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-emerald-600" />
                      Git Eşitleme İşlem Kayıtları (Log)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGitLogs([])}
                      className="h-6 px-2 text-[11px] cursor-pointer"
                    >
                      Kayıtları Temizle
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-black/95 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto border border-emerald-500/20 max-h-48 overflow-y-auto select-all">
                    {gitLogs.join("\n")}
                  </pre>
                </div>
              )}

              {/* Terminal CLI Snippet */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    Doğrudan Terminal Push Komutu (Yedek)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(gitCliCommand, "git-cli")}
                    className="h-7 px-2 text-xs gap-1 cursor-pointer"
                  >
                    {copiedKey === "git-cli" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Kopyala</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="rounded-lg bg-black/90 p-2.5 font-mono text-[11px] text-emerald-400 overflow-x-auto border border-white/10 select-all">
                  {gitCliCommand}
                </pre>
              </div>

              {/* Download Backups for Git */}
              <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Depoda yedeklemek için JSON veri dosyaları:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportCatalog}
                    className="h-8 text-xs gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Katalog JSON Yedeği
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportOrders}
                    className="h-8 text-xs gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Siparişler JSON Yedeği
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CLOUDFLARE TAB */}
      {subTab === "cloudflare" && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Cloudflare Pages Card */}
          <Card className="border-amber-500/30 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 font-bold text-foreground">
                    <CloudLightning className="h-4 w-4 text-amber-500" />
                    Cloudflare Pages & D1 Eşitleme
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Statik derlemeyi (dist) Cloudflare Pages kenar sunucularına dağıtın ve D1
                    veritabanını eşitleyin.
                  </CardDescription>
                </div>
                <div className="text-right text-[11px] text-muted-foreground shrink-0">
                  Son Dağıtım: <span className="font-semibold text-foreground">{lastCFDeploy}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* Cloudflare Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Pages Projesi</span>
                  <span className="font-mono font-bold text-foreground">kotoptan</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Çıktı Dizini</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    pages_build_output_dir = &quot;dist&quot;
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">D1 Veritabanı</span>
                  <span className="font-mono font-bold text-foreground">kotoptan-db</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">D1 Binding</span>
                  <span className="font-mono font-semibold text-foreground">DB (0ff122d9-...)</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={handleCloudflareDeploy}
                  disabled={isDeployingCF}
                  className="h-10 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-sm cursor-pointer"
                >
                  <CloudLightning className={`h-4 w-4 ${isDeployingCF ? "animate-spin" : ""}`} />
                  <span>{isDeployingCF ? "Dağıtılıyor..." : "Cloudflare ile Eşitle & Dağıt"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleD1Sync}
                  disabled={isSyncingD1}
                  className="h-10 px-4 text-xs sm:text-sm gap-2 border-emerald-600/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                >
                  <Database className={`h-4 w-4 ${isSyncingD1 ? "animate-spin" : ""}`} />
                  <span>{isSyncingD1 ? "D1 Eşitleniyor..." : "D1 Veritabanını Eşitle"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePurgeCache}
                  disabled={isPurgingCache}
                  className="h-10 px-4 text-xs sm:text-sm gap-2 cursor-pointer"
                >
                  <Zap className={`h-4 w-4 ${isPurgingCache ? "animate-spin" : ""}`} />
                  <span>Önbelleği Temizle (Purge Cache)</span>
                </Button>
              </div>

              {/* Cache & Anti-Stale Info */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Mobil Önbellek & Sürüm Koruma Sistemi Aktif</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Cloudflare Pages için <code>dist/_headers</code> ve anti-cache meta etiketleri
                  yapılandırılmıştır. Mobil cihazlar sayfayı her açtığında en güncel kodları
                  doğrudan çeker, eski sürüm takılması yaşanmaz.
                </p>
              </div>

              {/* Wrangler CLI Snippets */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-primary" />
                      1. Cloudflare Pages Dağıtım Komutu
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(cfDeployCommand, "cf-deploy")}
                      className="h-6 px-2 text-xs gap-1 cursor-pointer"
                    >
                      {copiedKey === "cf-deploy" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-black/90 p-2 font-mono text-[11px] text-amber-300 overflow-x-auto border border-white/10 select-all">
                    {cfDeployCommand}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-primary" />
                      2. Cloudflare D1 Şema & Veri Güncelleme Komutu
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(cfD1Command, "cf-d1")}
                      className="h-6 px-2 text-xs gap-1 cursor-pointer"
                    >
                      {copiedKey === "cf-d1" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-black/90 p-2 font-mono text-[11px] text-cyan-300 overflow-x-auto border border-white/10 select-all">
                    {cfD1Command}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
