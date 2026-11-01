import { Component, type ErrorInfo, type ReactNode } from "react";
import { BRAND_LOGO_SRC } from "@/lib/branding";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Yakalanan mobil/istemci hatası:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleClearCacheAndRestart = () => {
    try {
      if (typeof window !== "undefined") {
        // Eski veya bozuk verileri yerel depolamadan temizle
        const prefixes = ["kotoptan_", "ko_", "supabase.auth."];
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (prefixes.some((p) => k.startsWith(p))) {
            try {
              localStorage.removeItem(k);
            } catch {
              // ignore
            }
          }
        }
        try {
          sessionStorage.clear();
        } catch {
          // ignore
        }

        // Varsa eski service worker'ları sil
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => {
              for (const r of regs) {
                r.unregister().catch(() => {});
              }
            })
            .catch(() => {});
        }

        // Ana sayfaya temiz yönlendirme
        window.location.href = "/";
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  public override render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Bilinmeyen bir hata oluştu";

      if (this.props.inline) {
        return (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-card-foreground shadow-xs my-4 space-y-3">
            <div className="flex items-center gap-2.5 text-destructive font-bold text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/15">
                ⚠️
              </span>
              <h4>{this.props.fallbackTitle || "Bu Bölüm Yüklenirken Bir Hata Oluştu"}</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {this.props.fallbackMessage || "Bileşen yüklenirken beklenmeyen bir durum oluştu."}
            </p>
            {this.state.error && (
              <p className="text-[11px] font-mono text-destructive/80 bg-background/50 p-2 rounded-lg border border-destructive/20 break-all">
                {errorMsg}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
              >
                🔄 Yeniden Dene
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer"
              >
                Sayfayı Yenile
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#060b08] text-white p-4 select-none">
          {/* Yumuşak zümrüt ışık efekti */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0%,rgba(6,11,8,0.98)_75%)] pointer-events-none" />

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1510] p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md">
            {/* Logo */}
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden shadow-lg border border-emerald-500/40 bg-[#040806]">
              <img
                src={BRAND_LOGO_SRC}
                alt="KasımOğulları Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Sistem Kurtarma Modu
            </span>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {this.props.fallbackTitle || "Sayfa Güvenle Durduruldu"}
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-white/70 leading-relaxed">
              {this.props.fallbackMessage ||
                "Mobil tarayıcınızda veya cihazınızın önbelleğinde beklenmeyen bir durum meydana geldi. Ekranın kararmasını önlemek için güvenli kurtarma sayfası açıldı."}
            </p>

            {/* Buton Grubu */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] transition cursor-pointer"
              >
                🔄 Sayfayı Yeniden Yükle
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndRestart}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 px-4 text-xs sm:text-sm font-semibold text-emerald-300 hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
              >
                🧹 Önbelleği Temizle & Başlat
              </button>

              <div className="flex items-center justify-center gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="text-white/60 hover:text-white underline cursor-pointer"
                >
                  Tekrar Dene
                </button>
                <span className="text-white/30">•</span>
                <a href="/giris" className="text-white/60 hover:text-white underline">
                  Giriş Ekranına Git
                </a>
              </div>
            </div>

            {/* Teknik Detayları Göster */}
            <div className="mt-5 border-t border-white/10 pt-3 text-left">
              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="text-[11px] font-mono text-white/40 hover:text-white/70 underline cursor-pointer"
              >
                {this.state.showDetails ? "Teknik Detayları Gizle ▲" : "Teknik Detayları Gör ▼"}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 rounded-lg bg-black/60 p-2.5 font-mono text-[10px] text-red-300 break-words max-h-36 overflow-y-auto border border-white/5">
                  <p className="font-bold text-red-400">Hata Mesajı:</p>
                  <p>{errorMsg}</p>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <p className="font-bold text-white/50 mt-2">Bileşen Ağacı:</p>
                      <pre className="text-[9px] text-white/40 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
