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

  useEffect(() => {
    if (!loading && !user) {
      if (navigate) {
        void navigate({ to: "/giris", replace: true }).catch(() => {});
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <SplashScreen message="KasımOğulları — Oturum kontrol ediliyor..." />;
  }

  if (!user) {
    return <SplashScreen message="Giriş ekranına yönlendiriliyor..." />;
  }

  return (
    <GlobalErrorBoundary>
      <Outlet />
    </GlobalErrorBoundary>
  );
}
