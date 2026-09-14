import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppUser = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  full_name: string;
  business_name: string;
  profile_phone: string;
  address: string;
};

/** Yalnızca yöneticiler: kayıtlı kullanıcıları listeler. */
export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    const { data: myRoles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw roleError;
    if (!myRoles?.some((r) => r.role === "admin")) {
      throw new Error("Bu bilgiye erişim yetkiniz yok.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, business_name, phone, address"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    return authData.users
      .map((u) => {
        const p = profileById.get(u.id);
        const email = u.email ?? null;
        return {
          id: u.id,
          email: email && email.endsWith("@kotoptan.local") ? null : email,
          phone: u.phone ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          is_admin: adminIds.has(u.id),
          full_name: p?.full_name ?? "",
          business_name: p?.business_name ?? "",
          profile_phone: p?.phone ?? "",
          address: p?.address ?? "",
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
