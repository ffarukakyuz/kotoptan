import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/SplashScreen";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isStrictlyProtected =
    pathname.startsWith("/profil") || pathname.startsWith("/siparislerim");

  // Sadece kişisel hesap ve sipariş geçmişi sayfalarında oturum zorunludur.
  // Ana sayfa, ürün kataloğu ve yönetim/sevkiyat sayfaları ziyaretçilere açıktır.
  useEffect(() => {
    if (!loading && !user && isStrictlyProtected) {
      if (navigate) {
        void navigate({ to: "/giris", replace: true }).catch(() => {});
      }
      const timer = setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          (window.location.pathname.startsWith("/profil") ||
            window.location.pathname.startsWith("/siparislerim"))
        ) {
          window.location.replace("/giris");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, loading, navigate, isStrictlyProtected]);

  if (loading && isStrictlyProtected) {
    return (
      <SplashScreen
        message="KasımOğulları — Oturum açılıyor..."
        minDuration={600}
        maxTimeout={1500}
      />
    );
  }

  if (!user && isStrictlyProtected) {
    return (
      <SplashScreen
        message="Giriş ekranına yönlendiriliyor..."
        minDuration={600}
        maxTimeout={1500}
        onFinish={() => {
          if (typeof window !== "undefined") {
            window.location.replace("/giris");
          }
        }}
      />
    );
  }

  return (
    <GlobalErrorBoundary>
      <Outlet />
    </GlobalErrorBoundary>
  );
}
