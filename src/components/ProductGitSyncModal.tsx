import { useState, useEffect } from "react";
import {
  GitBranch,
  UploadCloud,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Download,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  pushCatalogDirectlyToGitHub,
  exportCatalogDataJSON,
  downloadCatalogBackupFile,
} from "@/lib/github-api-sync";
import {
  getAllCatalogProducts,
  getProductOverrides,
  getPermanentlyDeletedIds,
  getCustomProducts,
} from "@/lib/custom-products";

interface ProductGitSyncModalProps {
  triggerButton?: React.ReactNode;
}

export function ProductGitSyncModal({ triggerButton }: ProductGitSyncModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem("ko_github_token") || "";
    } catch {
      return "";
    }
  });
  const [commitMessage, setCommitMessage] = useState(
    "Yeni ürünler eklendi ve ürün fotoğrafları güncellendi",
  );
  const [isPushing, setIsPushing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Live stats
  const [stats, setStats] = useState({
    total: 0,
    custom: 0,
    overrides: 0,
    deleted: 0,
  });

  const refreshStats = () => {
    const all = getAllCatalogProducts();
    const overrides = getProductOverrides();
    const custom = getCustomProducts();
    const deleted = getPermanentlyDeletedIds();
    setStats({
      total: all.length,
      custom: custom.length,
      overrides: Object.keys(overrides).length,
      deleted: deleted.size,
    });
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
    }
  }, [isOpen]);

  const handlePush = async () => {
    if (!token.trim()) {
      toast.warning("Lütfen GitHub Personal Access Token (PAT) giriniz.");
      return;
    }

    if (!commitMessage.trim()) {
      toast.error("Lütfen bir güncelleme açıklaması (commit mesajı) giriniz.");
      return;
    }

    setIsPushing(true);
    setLogs(["🚀 GitHub senkronizasyonu başlatılıyor..."]);
    const toastId = toast.loading("GitHub'a commit ve push yapılıyor...");

    try {
      // 1. Token'ı yerel hafızaya kaydet
      try {
        localStorage.setItem("ko_github_token", token.trim());
      } catch {
        // ignore
      }

      // 2. Doğrudan GitHub REST API ile commit & push yap
      const activeProducts = getAllCatalogProducts();
      const res = await pushCatalogDirectlyToGitHub({
        token: token.trim(),
        repo: "ffarukakyuz/kotoptan",
        branch: "main",
        commitMessage: commitMessage.trim(),
        onProgress: (msg) => {
          setLogs((prev) => [...prev, msg]);
        },
      });

      // 3. Sunucuya da bildir (eğer arka plan çalışıyorsa yerel diski güncellesin)
      try {
        const deletedIds = Array.from(getPermanentlyDeletedIds());
        void fetch("/api/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            commitMessage: commitMessage.trim(),
            token: token.trim(),
            branch: "main",
            products: activeProducts,
            permanentlyDeleted: { deletedIds },
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }

      if (res.ok) {
        toast.success(`GitHub'a başarıyla push edildi! (Commit: ${res.commitHash || "HEAD"})`, {
          id: toastId,
        });
        refreshStats();
      } else {
        toast.error(res.error || "GitHub push işlemi başarısız oldu.", { id: toastId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bağlantı hatası";
      toast.error(`Push hatası: ${msg}`, { id: toastId });
      setLogs((prev) => [...prev, `❌ Hata: ${msg}`]);
    } finally {
      setIsPushing(false);
    }
  };

  const handleCopyJSON = async () => {
    try {
      const jsonStr = exportCatalogDataJSON();
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      toast.success("Tüm katalog verisi (yeni ürünler & fotoğraflar) panoya kopyalandı!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error("Panoya kopyalanamadı.");
    }
  };

  const handleDownload = () => {
    try {
      downloadCatalogBackupFile();
      toast.success("Katalog yedek JSON dosyası indirildi.");
    } catch {
      toast.error("Dosya indirilemedi.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <Button
            type="button"
            className="bg-[#166534] hover:bg-[#14532d] text-white font-bold h-9 px-3.5 text-xs gap-1.5 shadow-sm cursor-pointer"
          >
            <GitBranch className="h-4 w-4" />
            <span>GitHub'a Push Et</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <GitBranch className="h-5 w-5 text-emerald-600" />
            <span>Katalog & Ürün Değişikliklerini GitHub'a Push Et</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Yönetim panelinde yaptığınız tüm fotoğraf değişiklikleri, yeni eklenen ürünler ve
            silinenler doğrudan <strong>ffarukakyuz/kotoptan</strong> deposuna aktarılır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* İstatistikler */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-xl border border-border bg-muted/40 p-2.5">
              <span className="text-muted-foreground block text-[11px]">Toplam Aktif</span>
              <span className="text-base font-extrabold text-foreground">{stats.total} Ürün</span>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
              <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-semibold">
                Yeni Eklenen
              </span>
              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {stats.custom} Ürün
              </span>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5">
              <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-semibold">
                Değişen Fotoğraf
              </span>
              <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">
                {stats.overrides} Adet
              </span>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
              <span className="text-rose-700 dark:text-rose-300 block text-[11px] font-semibold">
                Silinen Ürün
              </span>
              <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                {stats.deleted} Adet
              </span>
            </div>
          </div>

          {/* Commit Message */}
          <div className="space-y-1.5">
            <Label htmlFor="sync-commit-msg" className="text-xs font-semibold">
              Güncelleme Başlığı (Commit Mesajı)
            </Label>
            <Input
              id="sync-commit-msg"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="h-9 text-xs"
              placeholder="Örn: Yeni toptan gıda ürünleri eklendi"
            />
          </div>

          {/* GitHub Token */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="sync-token"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>GitHub Personal Access Token (PAT)</span>
              </Label>
              {token ? (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                >
                  Kayıtlı
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30"
                >
                  Token Gerekli
                </Badge>
              )}
            </div>
            <Input
              id="sync-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="h-9 text-xs font-mono"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Kotoptan-AutoSync"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Token Oluştur (repo yetkisiyle)
              </a>
              <span>
                Hedef Dal: <strong>main</strong>
              </span>
            </div>
          </div>

          {/* Ana Butonlar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              type="button"
              disabled={isPushing}
              onClick={handlePush}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 text-xs gap-2 shadow-md cursor-pointer"
            >
              {isPushing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>GitHub'a Push Ediliyor...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>GitHub'a Şimdi Push Et</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyJSON}
              className="h-10 text-xs gap-1.5 cursor-pointer shrink-0"
              title="Tüm veriyi kopyala"
            >
              {isCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{isCopied ? "Kopyalandı!" : "Katalog JSON Kopyala"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="h-10 text-xs gap-1.5 cursor-pointer shrink-0"
              title="Yedek dosyasını indir"
            >
              <Download className="h-4 w-4" />
              <span>İndir</span>
            </Button>
          </div>

          {/* Terminal Logs */}
          {logs.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Terminal className="h-3 w-3 text-emerald-600" />
                İşlem Kayıtları
              </span>
              <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-emerald-400 space-y-0.5 max-h-36 overflow-y-auto">
                {logs.map((l, idx) => (
                  <div key={idx} className="leading-snug">
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              GitHub'a push edildiğinde Cloudflare Pages (<code>kotoptan.pages.dev</code>) otomatik
              olarak yeni ürünlerinizi derleyip birkaç dakika içinde yayına alır.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
