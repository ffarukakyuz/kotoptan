import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Vitrin (ana sayfa ve ürün detay) herkese açık açılır.
  // Sadece sepet, siparişlerim, profil ve yönetim için oturum zorunludur.
  const isProtected =
    currentPath.startsWith("/sepet") ||
    currentPath.startsWith("/siparislerim") ||
    currentPath.startsWith("/profil") ||
    currentPath.startsWith("/yonetim");

  useEffect(() => {
    if (!loading && !user && isProtected) {
      void navigate({ to: "/giris", replace: true });
    }
  }, [user, loading, isProtected, navigate]);

  if (loading && isProtected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#060b08] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide text-white/70">
            KasımOğulları — Oturum kontrol ediliyor...
          </p>
        </div>
      </div>
    );
  }

  if (!user && isProtected) {
    return null;
  }

  return <Outlet />;
}
