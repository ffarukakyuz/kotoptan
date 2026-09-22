import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
  component: () => <Outlet />,
});
