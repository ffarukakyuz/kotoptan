import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { SupportChat } from "@/components/SupportChat";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { SplashScreen } from "@/components/SplashScreen";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { BRAND_LOGO_SRC } from "@/lib/branding";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[Route Error]", error);
  const router = useRouter();

  const handleClearCacheAndReload = () => {
    try {
      if (typeof window !== "undefined") {
        const keysToRemove = Object.keys(localStorage).filter(
          (k) => k.startsWith("kotoptan_") || k.startsWith("ko_customer_chat"),
        );
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore
    }
    router.invalidate();
    reset();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xl">
          ⚡
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Sayfa yüklenemedi</h1>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          Bir sorun oluştu. Sayfayı yenilemeyi deneyebilir veya ana sayfaya dönebilirsiniz.
        </p>

        {error?.message && (
          <p className="mt-3 rounded-lg bg-muted p-2 font-mono text-[11px] text-destructive break-words text-left border border-border">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer shadow-sm"
          >
            Tekrar dene
          </button>
          <button
            onClick={handleClearCacheAndReload}
            className="inline-flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 border border-border px-3.5 py-2 text-xs sm:text-sm font-medium text-secondary-foreground transition-colors cursor-pointer"
          >
            Önbelleği Temizle & Aç
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Ana sayfa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Kotoptan" },
      { name: "apple-mobile-web-app-title", content: "Kotoptan" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda ve Market Dağıtımı" },
      {
        name: "description",
        content:
          "Ko Toptan (Kotoptan / KasımOğulları Ltd. Şti.) — Bitlis, Tatvan ve çevre ilçelerdeki bakkal ve marketlere toptan gıda, bakliyat, un, yağ, salça ve temizlik ürünleri dağıtımı. Hızlı sevkiyat ve güvenilir toptan sipariş platformu.",
      },
      {
        name: "keywords",
        content:
          "ko toptan, kotoptan, ko toptan gıda, ko toptan market, tatvan toptan, bitlis toptan, kasımoğulları toptan, kasım oğulları gıda, toptan gıda, toptan bakliyat, toptan temizlik, bitlis toptancı, tatvan toptancı, toptan gıda dağıtımı, toptan market ürünleri",
      },
      { name: "author", content: "KasımOğulları Ltd. Şti." },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ko Toptan" },
      { property: "og:url", content: "https://kotoptan.pages.dev" },
      {
        property: "og:title",
        content: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda ve Market Dağıtımı",
      },
      {
        property: "og:description",
        content:
          "Ko Toptan — Bitlis, Tatvan, Ahlat, Adilcevaz, Güroymak ve Hizan marketlerine toptan gıda, bakliyat ve temizlik ürünleri doğrudan depo teslimatı.",
      },
      { property: "og:image", content: "https://kotoptan.pages.dev/kotoptan-logo-v2.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "tr_TR" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Ko Toptan (Kotoptan) — Bitlis & Tatvan Toptan Gıda Dağıtımı",
      },
      {
        name: "twitter:description",
        content:
          "Ko Toptan — Bitlis ve Tatvan merkezli bakkal ve marketlere toptan gıda, bakliyat ve temizlik ürünleri dağıtımı.",
      },
      { name: "twitter:image", content: "https://kotoptan.pages.dev/kotoptan-logo-v2.jpg" },
      { httpEquiv: "Cache-Control", content: "no-cache, no-store, must-revalidate" },
      { httpEquiv: "Pragma", content: "no-cache" },
      { httpEquiv: "Expires", content: "0" },
    ],
    links: [
      { rel: "canonical", href: "https://kotoptan.pages.dev/" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest?v=20261010-k" },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=20261010-k" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/icons/apple-touch-icon.png?v=20261010-k",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=20261010-k" },
      { rel: "icon", sizes: "192x192", type: "image/png", href: "/icon-192x192.png?v=20261010-k" },
      { rel: "icon", sizes: "512x512", type: "image/png", href: "/icon-512x512.png?v=20261010-k" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="bg-black">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-black text-foreground antialiased font-sans">
        <div id="root">
          <GlobalErrorBoundary>{children}</GlobalErrorBoundary>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <RootAppContent />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

function RootAppContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const router = useRouter();
  const isAuthPage = pathname === "/giris";

  // Mobil Safari / WebKit hata ve önbellek koruma mekanizmaları
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Mobil Safari BFCache: Geri/İleri tuşunda sonsuz reload döngüsünü engelleyerek router'ı tazele
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        try {
          router.invalidate();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    // Mobil tarayıcılarda yakalanmamış promise veya JS hatalarının ekranı kilitlemesini engelle
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn("[Root] Unhandled promise rejection yakalandı:", event.reason);
      // Ekranın kararmasını engellemek için varsayılan çöküşü durdur
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Varsa eski/bozuk service worker kayıtlarını temizleyip bayat JS/CSS çakışmasını engelle
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const reg of registrations) {
            reg.unregister().catch(() => {});
          }
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [router]);

  // Giriş zorunludur: Giriş yapılmamışsa ve /giris sayfasında değilsek derhal /giris'e yönlendir.
  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      void router.navigate({ to: "/giris", replace: true });
      const timer = setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/giris") {
          window.location.replace("/giris");
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, loading, isAuthPage, router]);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-[#050b07] font-sans text-white pt-[env(safe-area-inset-top,0px)] relative overflow-x-hidden">
        {/* Splash screen animasyonu ile birebir aynı atmosferik koyu yeşil - siyah radyal derin ışık */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22)_0%,rgba(5,11,7,0.98)_75%)]" />
        <main className="flex flex-1 items-center justify-center p-4 relative z-10">
          <Outlet />
        </main>
        <Toaster position="top-center" richColors theme="dark" />
      </div>
    );
  }

  // Oturum kontrol ediliyorken kullanıcı henüz yoksa şık Splash Screen animasyonu göster
  if (loading && !user) {
    return <SplashScreen message="KasımOğulları — Oturum açılıyor..." />;
  }

  // Kullanıcı giriş yapmamışsa yönlendirme tamamlanana kadar yönlendirme ekranı göster
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <SplashScreen message="Giriş ekranına yönlendiriliyor..." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col font-sans bg-background text-foreground">
      <PWAInstallBanner />
      <WelcomeBanner />
      <SiteHeader />
      <main className="flex-1">
        {/* Required: nested routes render here. */}
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-white/10 bg-black py-8 text-zinc-400">
        <div className="mx-auto max-w-6xl px-4 text-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm border border-white/20 bg-zinc-900">
            <img
              src={BRAND_LOGO_SRC}
              alt="KasımOğulları Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </span>
          <div>
            <p className="font-semibold text-white">KasımOğulları Ltd. Şti.</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Market ve bakkallar için toptan ürün kataloğu. Siparişleriniz tarafımıza ulaşır, ödeme
              teslimat sırasında yapılır.
            </p>
          </div>
        </div>
      </footer>
      <SupportChat />
      <Toaster position="top-center" richColors />
    </div>
  );
}
