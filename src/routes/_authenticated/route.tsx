import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Mobil ve masaüstü tarayıcı ortamında hızlı ve güvenilir oturum kontrolü
    if (typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) {
          throw redirect({ to: "/giris" });
        }
        return { user: data.session.user };
      } catch (err) {
        // TanStack Router redirect nesnesiyse aynen ilet
        if (typeof err === "object" && err !== null && "to" in err) {
          throw err;
        }
        throw redirect({ to: "/giris" });
      }
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/giris", replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-semibold text-muted-foreground">Oturum doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-semibold text-foreground">
            Giriş ekranına yönlendiriliyorsunuz...
          </p>
          <p className="text-xs text-muted-foreground">
            Kataloğu görüntülemek için giriş yapmanız zorunludur.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
