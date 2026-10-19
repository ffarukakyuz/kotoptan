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
import { useEffect, useState, type ReactNode } from "react";

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
      {
        httpEquiv: "Content-Security-Policy",
        content:
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob: chrome-extension: moz-extension: safari-extension:; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' * data: blob: chrome-extension: moz-extension: safari-extension:; script-src-attr 'self' 'unsafe-inline' 'unsafe-eval' *; style-src 'self' 'unsafe-inline' * data:; style-src-elem 'self' 'unsafe-inline' * data:; font-src 'self' * data: https:; img-src 'self' * data: blob: https: http:; connect-src * blob: data: chrome-extension: moz-extension:; worker-src 'self' * blob: data: 'unsafe-inline' 'unsafe-eval'; frame-src 'self' * data: blob:;",
      },
    ],
    links: [
      { rel: "canonical", href: "https://kotoptan.pages.dev/" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Manrope:wght@400;500;600;700;800&display=swap",
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
    <html lang="tr" className="dark bg-black">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  if (typeof window === "undefined") return;

  // 0. globalThis polyfill
  if (typeof globalThis === "undefined") {
    window.globalThis = window;
  }

  // 1. String.prototype.replaceAll polyfill
  if (typeof String.prototype.replaceAll !== "function") {
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) {
        return this.replace(search, replacement);
      }
      return this.split(search).join(replacement);
    };
  }

  // 2. Array.prototype.at polyfill
  if (typeof Array.prototype.at !== "function") {
    Array.prototype.at = function (n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }

  // 3. Object.hasOwn polyfill
  if (typeof Object.hasOwn !== "function") {
    Object.hasOwn = function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // 4. Promise.allSettled polyfill
  if (typeof Promise.allSettled !== "function") {
    Promise.allSettled = function (promises) {
      return Promise.all(
        Array.from(promises).map(function (p) {
          return Promise.resolve(p).then(
            function (v) { return { status: "fulfilled", value: v }; },
            function (r) { return { status: "rejected", reason: r }; }
          );
        })
      );
    };
  }

  // 5. structuredClone fallback
  if (typeof window.structuredClone !== "function") {
    window.structuredClone = function (obj) {
      if (obj === undefined) return undefined;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        return obj;
      }
    };
  }

  // 6. crypto.randomUUID fallback
  if (typeof window.crypto === "undefined") {
    window.crypto = {};
  }
  if (typeof window.crypto.randomUUID !== "function") {
    window.crypto.randomUUID = function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }

  // 7. requestIdleCallback fallback for iOS Safari < 16.4 & older WebViews
  if (typeof window.requestIdleCallback !== "function") {
    window.requestIdleCallback = function (cb) {
      var start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
  }
  if (typeof window.cancelIdleCallback !== "function") {
    window.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }

  // 8. ResizeObserver fallback
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = function () {
      this.observe = function () {};
      this.unobserve = function () {};
      this.disconnect = function () {};
    };
  }

  // 9. IntersectionObserver fallback (immediate render)
  if (typeof window.IntersectionObserver === "undefined") {
    window.IntersectionObserver = function (cb) {
      this.observe = function (el) {
        setTimeout(function () {
          cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }]);
        }, 30);
      };
      this.unobserve = function () {};
      this.disconnect = function () {};
    };
  }

  // 10. Safari / Private Browsing storage fallback
  try {
    var _testKey = "__ko_check__";
    window.localStorage.setItem(_testKey, "1");
    window.localStorage.removeItem(_testKey);
  } catch (_storageErr) {
    console.warn("[Storage Shield] LocalStorage restricted, activating memory fallback");
    var _memStore = {};
    var _mockStorage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(_memStore, k) ? _memStore[k] : null; },
      setItem: function (k, v) { _memStore[k] = String(v); },
      removeItem: function (k) { delete _memStore[k]; },
      clear: function () { _memStore = {}; },
      get length() { return Object.keys(_memStore).length; },
      key: function (i) { return Object.keys(_memStore)[i] || null; },
    };
    try {
      Object.defineProperty(window, "localStorage", { value: _mockStorage, writable: true, configurable: true });
      Object.defineProperty(window, "sessionStorage", { value: _mockStorage, writable: true, configurable: true });
    } catch (_e) {
      window.localStorage = _mockStorage;
      window.sessionStorage = _mockStorage;
    }
  }

  // 11. Error & unhandled rejection safety shield
  window.addEventListener(
    "error",
    function (evt) {
      var msg = (evt && evt.error && evt.error.message) || (evt && evt.message) || "";
      if (typeof msg === "string") {
        if (
          msg.indexOf("replaceAll") !== -1 ||
          msg.indexOf("Invariant failed") !== -1 ||
          msg.indexOf("useStore") !== -1 ||
          msg.indexOf("reading 'replaceAll'") !== -1 ||
          msg.indexOf("ResizeObserver") !== -1
        ) {
          console.warn("[Global Shield] Intercepted runtime error:", msg);
          if (evt.preventDefault) evt.preventDefault();
          if (evt.stopPropagation) evt.stopPropagation();
        }
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    function (evt) {
      var reason = evt && evt.reason;
      var msg = (reason && reason.message) || String(reason || "");
      if (
        msg.indexOf("replaceAll") !== -1 ||
        msg.indexOf("Invariant failed") !== -1 ||
        msg.indexOf("useStore") !== -1 ||
        msg.indexOf("reading 'replaceAll'") !== -1 ||
        msg.indexOf("ResizeObserver") !== -1
      ) {
        console.warn("[Global Shield] Intercepted unhandled rejection:", msg);
        if (evt.preventDefault) evt.preventDefault();
      }
    },
    true,
  );
})();
`,
          }}
        />
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

const defaultFallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function RootComponent() {
  const ctx = Route.useRouteContext({ shouldThrow: false });
  const queryClient = ctx?.queryClient ?? defaultFallbackQueryClient;

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
  const router = useRouter({ warn: false });
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const normalizedPath = (pathname || "").replace(/\/+$/, "") || "/";
  const isAuthPage = normalizedPath === "/giris" || normalizedPath.startsWith("/giris");
  const isYonetimPage = normalizedPath === "/yonetim" || normalizedPath.startsWith("/yonetim");

  // Mobil Safari / WebKit hata ve önbellek koruma mekanizmaları
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Mobil Safari BFCache: Geri/İleri tuşunda sonsuz reload döngüsünü engelleyerek router'ı tazele
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && router) {
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

    // replaceAll, Invariant veya useStore hatalarının ekranı beyaz ekrana düşürmesini engelle
    const handleError = (event: ErrorEvent) => {
      const msg = event?.message || (event?.error && event.error.message) || "";
      if (
        typeof msg === "string" &&
        (msg.includes("replaceAll") || msg.includes("useStore") || msg.includes("Invariant"))
      ) {
        console.warn("[Root Shield] Intercepted runtime error:", msg);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("error", handleError, true);

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
      window.removeEventListener("error", handleError, true);
    };
  }, [router]);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-[#050b07] font-sans text-white pt-[env(safe-area-inset-top,0px)] relative overflow-x-hidden">
        {/* Kalem Suresi (Nazar Âyeti) Hayalet Filigranı */}
        <div aria-hidden="true" className="watermark-overlay" />
        {/* Splash screen animasyonu ile birebir aynı atmosferik koyu yeşil - siyah radyal derin ışık */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22)_0%,rgba(5,11,7,0.98)_75%)]" />
        <main className="flex flex-1 items-center justify-center p-4 relative z-10">
          <Outlet />
        </main>
        <Toaster position="top-center" richColors theme="dark" />
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen flex-col font-sans ${
        isYonetimPage ? "admin-light bg-slate-50 text-slate-900" : "bg-black text-foreground"
      } relative overflow-x-hidden`}
    >
      {/* Kalem Suresi (Nazar Âyeti) Hayalet Filigranı */}
      {!isYonetimPage && <div aria-hidden="true" className="watermark-overlay" />}
      <div className="relative z-10 flex min-h-screen flex-col">
        {!isYonetimPage && <PWAInstallBanner />}
        {!isYonetimPage && <WelcomeBanner />}
        <SiteHeader />
        <main className={`flex-1 ${isYonetimPage ? "bg-slate-50 text-slate-900" : ""}`}>
          {/* Required: nested routes render here. */}
          <Outlet />
        </main>
        <footer
          className={`mt-auto border-t py-8 ${
            isYonetimPage
              ? "border-slate-200 bg-white text-slate-600"
              : "border-white/10 bg-black text-zinc-400"
          }`}
        >
          <div className="mx-auto max-w-6xl px-4 text-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm border ${
                isYonetimPage ? "border-slate-200 bg-slate-100" : "border-white/20 bg-zinc-900"
              }`}
            >
              <img
                src={BRAND_LOGO_SRC}
                alt="KasımOğulları Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </span>
            <div>
              <p className={`font-semibold ${isYonetimPage ? "text-slate-900" : "text-white"}`}>
                KasımOğulları Ltd. Şti.
              </p>
              <p className={`mt-0.5 text-xs ${isYonetimPage ? "text-slate-600" : "text-zinc-400"}`}>
                Market ve bakkallar için toptan ürün kataloğu. Siparişleriniz tarafımıza ulaşır,
                ödeme teslimat sırasında yapılır.
              </p>
            </div>
          </div>
        </footer>
        <SupportChat />
        <Toaster position="top-center" richColors theme={isYonetimPage ? "light" : "dark"} />
      </div>
    </div>
  );
}
