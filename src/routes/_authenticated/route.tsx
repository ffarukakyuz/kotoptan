import { createFileRoute, Outlet, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    // DEĞİŞMEZ KURAL: Sitede tüm sayfalar için oturum açma ZORUNLUDUR.
    // İlk girişte veya oturumsuz durumda derhal /giris ekranına yönlendirilir.
    if (typeof window !== "undefined") {
      try {
        const localSession = localStorage.getItem("ko_local_auth_session");
        const hasSbToken = Object.keys(localStorage).some(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
        );
        if (!localSession && !hasSbToken) {
          throw redirect({
            to: "/giris",
            replace: true,
          });
        }
      } catch (err) {
        if (err && typeof err === "object" && "isRedirect" in err) {
          throw err;
        }
      }
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // DEĞİŞMEZ KURAL: Oturumsuz kullanıcılar kesinlikle /giris ekranına yönlendirilir
  useEffect(() => {
    if (!loading && !user) {
      if (navigate) {
        void navigate({ to: "/giris", replace: true }).catch(() => {});
      }
    }
  }, [user, loading, navigate]);

  // Oturum kontrol ediliyor (karanlık atmosferik zemin, asla beyaz ekran patlaması yapmaz)
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#050b07] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-xs font-semibold text-white/80">Kotoptan kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamışsa kesinlikle içeriği açma
  if (!user) {
    return null;
  }

  return (
    <GlobalErrorBoundary>
      <Outlet />
    </GlobalErrorBoundary>
  );
}
