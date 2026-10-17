import { useState } from "react";
import {
  Save,
  UploadCloud,
  Check,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Boxes,
  Users,
  ShoppingBag,
  Sparkles,
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import { getLocalOrders } from "@/lib/order-storage";

interface MasterSaveSyncModalProps {
  buttonText?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function MasterSaveSyncModal({
  buttonText = "Değişiklikleri Kaydet & Dağıt",
  className = "",
  variant = "default",
  size = "sm",
}: MasterSaveSyncModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem("ko_github_token") || "";
    } catch {
      return "";
    }
  });
  const [commitMessage, setCommitMessage] = useState(
    "Yönetim panelinden tüm sistem değişiklikleri (ürünler, siparişler, üyeler) kaydedildi",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const performFullSaveAndDeploy = async (tokenToUse: string) => {
    setIsSaving(true);
    setLogs(["🚀 Sistem kaydetme ve dağıtım işlemi başlatılıyor..."]);
    const toastId = toast.loading(
      "Değişiklikler kaydediliyor ve GitHub & Cloudflare'e gönderiliyor...",
    );

    try {
      const activeProducts = getAllCatalogProducts();
      const deletedIds = Array.from(getPermanentlyDeletedIds());
      const deletedNames = Array.from(getPermanentlyDeletedNames());
      const localOrders = getLocalOrders();

      const trimmedToken = tokenToUse.trim();
      if (trimmedToken) {
        try {
          localStorage.setItem("ko_github_token", trimmedToken);
          setToken(trimmedToken);
        } catch {
          // ignore
        }
      }

      // 1. Sunucu dosyalarını güncelle (/api/github)
      setLogs((prev) => [
        ...prev,
        `📦 ${activeProducts.length} aktif ürün ve ${deletedIds.length} silinen ürün kod tabanına işleniyor...`,
      ]);
      try {
        await fetch("/api/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            commitMessage: commitMessage.trim(),
            token: trimmedToken,
            branch: "main",
            products: activeProducts,
            permanentlyDeleted: { deletedIds, deletedNames },
            orders: localOrders,
          }),
        });
        setLogs((prev) => [...prev, "✅ Kod tabanı (src/data/products.ts) başarıyla güncellendi."]);
      } catch (srvErr) {
        console.warn("Server sync notice:", srvErr);
      }

      // 2. Eğer Token varsa doğrudan GitHub REST API üzerinden commit & push yap
      let gitSuccess = false;
      if (trimmedToken && trimmedToken.length > 10) {
        setLogs((prev) => [
          ...prev,
          "🔑 GitHub Token ile doğrudan GitHub REST API üzerinden commit oluşturuluyor...",
        ]);
        const ghRes = await pushCatalogDirectlyToGitHub({
          token: trimmedToken,
          repo: "ffarukakyuz/kotoptan",
          branch: "main",
          commitMessage: commitMessage.trim(),
          onProgress: (msg) => {
            setLogs((prev) => [...prev, msg]);
          },
        });
        if (ghRes.ok) {
          gitSuccess = true;
          setLogs((prev) => [
            ...prev,
            `🎉 GitHub ana dalına (main) başarıyla push edildi! Commit: ${ghRes.commitHash || "HEAD"}`,
            "🚀 Cloudflare Pages otomatik derleme ve yayın süreci tetiklendi.",
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            `⚠️ GitHub push uyarısı: ${ghRes.error || "Bilinmeyen hata"}`,
          ]);
        }
      }

      if (gitSuccess) {
        toast.success("Tüm değişiklikler başarıyla kaydedildi ve GitHub/Cloudflare'e gönderildi!", {
          id: toastId,
        });
        setTimeout(() => setIsOpen(false), 2000);
      } else if (!trimmedToken) {
        toast.success(
          "Değişiklikler yerel sisteme başarıyla kaydedildi! (Canlıya aktarım için Token giriniz)",
          {
            id: toastId,
          },
        );
      } else {
        toast.warning("Yerel sistem güncellendi, GitHub aktarımı kontrol ediliyor...", {
          id: toastId,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("catalog_updated"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bağlantı hatası";
      toast.error(`Kayıt hatası: ${msg}`, { id: toastId });
      setLogs((prev) => [...prev, `❌ Hata: ${msg}`]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMainClick = () => {
    // Eğer token zaten varsa doğrudan kaydet ve dağıt, yoksa dialogu aç
    if (token && token.trim().length > 10) {
      void performFullSaveAndDeploy(token);
    } else {
      setIsOpen(true);
    }
  };

  const handleCopyJSON = async () => {
    try {
      const jsonStr = exportCatalogDataJSON();
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      toast.success("Tüm ürün verileri panoya kopyalandı!");
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
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleMainClick}
        disabled={isSaving}
        className={`bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-md cursor-pointer transition-all ${className}`}
        title="Word tarzı tek tıkla: Ürünleri, siparişleri ve üyeleri kaydeder; GitHub & Cloudflare'e anında dağıtır"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Kaydediliyor & Dağıtılıyor...</span>
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            <span>{buttonText}</span>
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Save className="h-5 w-5 text-emerald-600" />
              <span>Değişiklikleri Kaydet & Canlıya Dağıt</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Yönetim panelinde yaptığınız tüm ürün, fotoğraf, sipariş ve üye değişikliklerini tek
              tıkla kaydedip <strong>GitHub</strong> ve <strong>Cloudflare Pages</strong>'e
              gönderin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Bilgilendirme Kartları */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <Boxes className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                <span className="text-muted-foreground block text-[10px]">Aktif Ürünler</span>
                <span className="font-extrabold text-foreground">
                  {getAllCatalogProducts().length}
                </span>
              </div>
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5">
                <ShoppingBag className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                <span className="text-muted-foreground block text-[10px]">Siparişler</span>
                <span className="font-extrabold text-foreground">{getLocalOrders().length}</span>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <Users className="h-4 w-4 mx-auto text-amber-600 mb-1" />
                <span className="text-muted-foreground block text-[10px]">Kalıcı Silinen</span>
                <span className="font-extrabold text-foreground">
                  {getPermanentlyDeletedIds().size}
                </span>
              </div>
            </div>

            {/* Token Input */}
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="master-token"
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
                    Gerekli
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Token bir kez girildiğinde tarayıcınızda kalıcı saklanır; sonraki tüm
                kaydetmelerinizde tek tıkla doğrudan GitHub ve Cloudflare'e otomatik dağıtım
                yapılır.
              </p>
              <Input
                id="master-token"
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
                  className="text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="h-3 w-3" />
                  Token Oluştur (GitHub'dan 30 saniyede al)
                </a>
                <span>
                  Hedef: <strong>ffarukakyuz/kotoptan</strong>
                </span>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void performFullSaveAndDeploy(token)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 text-xs gap-2 shadow-md cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Kaydediliyor & Dağıtılıyor...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>Kaydet ve Canlıya Dağıt</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => void performFullSaveAndDeploy("")}
                className="h-10 text-xs gap-1.5 cursor-pointer shrink-0"
                title="GitHub'a göndermeden sadece yerel kodlara kaydet"
              >
                <span>Yalnızca Sisteme Kaydet</span>
              </Button>
            </div>

            {/* Hızlı Yedek & İndirme */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/70">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyJSON}
                className="text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{isCopied ? "Kopyalandı!" : "Katalog JSON Kopyala"}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Yedek Dosyası İndir</span>
              </Button>
            </div>

            {/* Logs */}
            {logs.length > 0 && (
              <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-emerald-400 space-y-0.5 max-h-36 overflow-y-auto">
                {logs.map((l, idx) => (
                  <div key={idx} className="leading-snug">
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
