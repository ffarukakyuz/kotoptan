import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const customerUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(3).max(100),
  business_name: z.string().trim().min(3).max(120),
  phone: z.string().transform((value) => value.replace(/\D/g, "").replace(/^0/, "")).pipe(z.string().regex(/^5\d{9}$/)),
  address: z.string().trim().min(10).max(500),
});

const passwordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(6).max(72),
});

const userIdSchema = z.object({ id: z.string().uuid() });

async function requireAdmin(context: {
  userId: string;
  supabase: Parameters<Parameters<typeof createServerFn>[0]>[0] extends never ? never : any;
}) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw error;
  if (!data?.some((row: { role: string }) => row.role === "admin")) {
    throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  }
}

async function ensureCustomer(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (data) throw new Error("Sabit yönetici hesapları bu alandan değiştirilemez.");
  return supabaseAdmin;
}

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

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => customerUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const supabaseAdmin = await ensureCustomer(data.id);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: `${data.phone}@kotoptan.local`,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        business_name: data.business_name,
        phone: data.phone,
        address: data.address,
      },
    });
    if (authError) {
      if (authError.message.toLowerCase().includes("already")) {
        throw new Error("Bu telefon numarası başka bir hesapta kayıtlı.");
      }
      throw authError;
    }
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.id,
      full_name: data.full_name,
      business_name: data.business_name,
      phone: data.phone,
      address: data.address,
    });
    if (profileError) throw profileError;
    return { ok: true as const };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => passwordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const supabaseAdmin = await ensureCustomer(data.id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const supabaseAdmin = await ensureCustomer(data.id);
    const { count, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.id);
    if (orderError) throw orderError;
    if ((count ?? 0) > 0) {
      throw new Error("Bu müşterinin sipariş geçmişi bulunduğu için hesap silinemez.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw error;
    return { ok: true as const };
  });
