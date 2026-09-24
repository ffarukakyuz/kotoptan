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
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sayfa yüklenemedi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir sorun oluştu. Sayfayı yenilemeyi deneyebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tekrar dene
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
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
      { title: "KasımOğulları Ltd. Şti. — Toptan Ürün Kataloğu" },
      {
        name: "description",
        content:
          "KasımOğulları depomuzun ürünlerini inceleyin, sepete ekleyin ve sipariş talebinizi iletin.",
      },
      { property: "og:type", content: "website" },
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

  // If still checking session or not authenticated, render outlet without main site header/footer/chat
  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-[#060b08] font-sans text-white">
        <Outlet />
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
