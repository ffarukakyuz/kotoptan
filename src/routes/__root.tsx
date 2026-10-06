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
          (k) => k.startsWith("kasimogullari_") || k.startsWith("ko_customer_chat"),
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
    <div className="flex min-h-screen items-center justify-center bg-[#060b08] text-white px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-[#0e1612] p-6 shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xl">
          ⚡
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Sayfa yüklenemedi</h1>
        <p className="mt-2 text-xs sm:text-sm text-white/70">
          Bir sorun oluştu. Sayfayı yenilemeyi deneyebilir veya ana sayfaya dönebilirsiniz.
        </p>

        {error?.message && (
          <p className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[11px] text-red-300 break-words text-left border border-white/5">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer shadow-md"
          >
            Tekrar dene
          </button>
          <button
            onClick={handleClearCacheAndReload}
            className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-emerald-300 transition-colors cursor-pointer"
          >
            Önbelleği Temizle & Aç
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent px-3.5 py-2 text-xs sm:text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
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
      { name: "theme-color", content: "#060b08" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "KasımOğulları" },
      { name: "apple-mobile-web-app-title", content: "KasımOğulları" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { title: "KasımOğulları Toptan" },
      {
        name: "description",
        content:
          "KasımOğulları şirketimizin ürünlerini inceleyin, sepete ekleyin ve sipariş talebinizi iletin.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "KasımOğulları Toptan" },
      {
        property: "og:description",
        content:
          "KasımOğulları şirketimizin ürünlerini inceleyin, sepete ekleyin ve sipariş talebinizi iletin.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", sizes: "192x192", type: "image/png", href: "/icon-192x192.png" },
      { rel: "icon", sizes: "512x512", type: "image/png", href: "/icon-512x512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <RootAppContent />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootAppContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const isAuthPage = pathname === "/giris";

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-[#060b08] font-sans text-white">
        <main className="flex flex-1 items-center justify-center p-4">
          <Outlet />
        </main>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <PWAInstallBanner />
      <SiteHeader />
      <main className="flex-1">
        {/* Required: nested routes render here. */}
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-white/10 bg-[#040806] py-8 text-white/60">
        <div className="mx-auto max-w-6xl px-4 text-sm">
          <p className="font-semibold text-white">KasımOğulları Ltd. Şti.</p>
          <p className="mt-1">
            Market ve bakkallar için toptan ürün kataloğu. Siparişleriniz tarafımıza ulaşır, ödeme
            teslimat sırasında yapılır.
          </p>
        </div>
      </footer>
      <SupportChat />
      <Toaster position="top-center" richColors />
    </div>
  );
}
