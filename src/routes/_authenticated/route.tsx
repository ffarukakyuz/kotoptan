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

  const isManagementRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/yonetim") ||
      window.location.pathname.startsWith("/siparisler"));

  // Giriş zorunludur: Müşteri sayfalarında oturum açılmamışsa /giris sayfasına yönlendir.
  // Yönetim ve Sevkiyat rotaları doğrudan açılabilir.
  useEffect(() => {
    if (!loading && !user && !isManagementRoute) {
      void navigate({ to: "/giris", replace: true });
      const timer = setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/giris" &&
          !window.location.pathname.startsWith("/yonetim") &&
          !window.location.pathname.startsWith("/siparisler")
        ) {
          window.location.replace("/giris");
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, loading, navigate, isManagementRoute]);

  if (loading) {
    return <SplashScreen message="KasımOğulları — Oturum açılıyor..." />;
  }

  // Yönetim ve Sevkiyat sayfaları oturum olmasa bile doğrudan açılır
  if (!user && !isManagementRoute) {
    return <SplashScreen message="Giriş ekranına yönlendiriliyor..." />;
  }

  return (
    <GlobalErrorBoundary>
      <Outlet />
    </GlobalErrorBoundary>
  );
}
