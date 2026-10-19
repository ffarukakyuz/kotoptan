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

  // DEĞİŞMEZ KURAL: Sitede tüm sayfalar (katalog, sepet, siparişler, yönetim vb.)
  // için oturum açma ZORUNLUDUR. İlk girişte veya oturumsuz durumda derhal /giris ekranına yönlendirilir.
  useEffect(() => {
    if (!loading && !user) {
      if (navigate) {
        void navigate({ to: "/giris", replace: true }).catch(() => {});
      }
      if (typeof window !== "undefined") {
        window.location.replace("/giris");
      }
    }
  }, [user, loading, navigate]);

  // Oturum kontrol ediliyor (en geç 1.5 sn sonra fallback ile kapanır)
  if (loading) {
    return (
      <SplashScreen
        message="Kotoptan — Oturum kontrol ediliyor..."
        minDuration={400}
        maxTimeout={1500}
      />
    );
  }

  // Kullanıcı giriş yapmamışsa kesinlikle içeriği açma, doğrudan giriş ekranına aktar
  if (!user) {
    return (
      <SplashScreen
        message="Giriş ekranına yönlendiriliyor..."
        minDuration={200}
        maxTimeout={1000}
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
