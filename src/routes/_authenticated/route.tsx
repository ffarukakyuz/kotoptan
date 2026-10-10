import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/SplashScreen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Giriş zorunludur: Oturum açılmamışsa derhal /giris sayfasına yönlendir.
  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/giris", replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <SplashScreen message="Kotoptan — Oturum açılıyor..." />;
  }

  if (!user) {
    return null;
  }

  return <Outlet />;
}
