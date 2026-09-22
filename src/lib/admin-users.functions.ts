import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isUserAdmin } from "@/lib/admin-config";

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
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, "").replace(/^0/, ""))
    .pipe(z.string().regex(/^5\d{9}$/)),
  address: z.string().trim().min(10).max(500),
});

const passwordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(6).max(72),
});

const userIdSchema = z.object({ id: z.string().uuid() });

async function requireAdmin(context: { userId: string; supabase: SupabaseClient<Database> }) {
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", context.userId)
    .maybeSingle();

  if (!isUserAdmin({ id: context.userId }, profile ?? null)) {
    throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  }
}

async function ensureNotFixedAdminForDeletion(userId: string, supabase: SupabaseClient<Database>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", userId)
    .maybeSingle();

  if (isUserAdmin({ id: userId }, profile ?? null)) {
    throw new Error("Sabit sistem yöneticisi hesapları sistem güvenliği için silinemez.");
  }
}

/** Yalnızca yöneticiler: kayıtlı kullanıcıları listeler. */
export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    await requireAdmin(context);

    // İlk olarak profiles tablosundan tüm kayıtlı üyeleri çek
    const { data: profiles, error: profileErr } = await context.supabase
      .from("profiles")
      .select("id, full_name, business_name, phone, address, created_at")
      .order("created_at", { ascending: false });

    if (profileErr) throw profileErr;

    // Supabase auth admin listUsers opsiyonel denenir
    try {
      if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (authData?.users) {
          const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
          return authData.users
            .map((u) => {
              const p = profileById.get(u.id);
              const email = u.email ?? null;
              const admin = isUserAdmin({ id: u.id, email: u.email }, p ?? null);
              return {
                id: u.id,
                email: email && email.endsWith("@kotoptan.local") ? null : email,
                phone: u.phone ?? null,
                created_at: u.created_at,
                last_sign_in_at: u.last_sign_in_at ?? null,
                is_admin: admin,
                full_name: p?.full_name ?? "",
                business_name: p?.business_name ?? "",
                profile_phone: p?.phone ?? "",
                address: p?.address ?? "",
              };
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
        }
      }
    } catch (e) {
      console.warn("auth.admin.listUsers atlandı, profiles tablosu kullanılıyor:", e);
    }

    // Doğrudan profiles listesini döndür
    return (profiles ?? []).map((p) => {
      const admin = isUserAdmin({ id: p.id }, p);
      return {
        id: p.id,
        email: null,
        phone: p.phone,
        created_at: p.created_at,
        last_sign_in_at: null,
        is_admin: admin,
        full_name: p.full_name,
        business_name: p.business_name,
        profile_phone: p.phone,
        address: p.address,
      };
    });
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => customerUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.updateUserById(data.id, {
          email: `${data.phone}@kotoptan.local`,
          email_confirm: true,
          user_metadata: {
            full_name: data.full_name,
            business_name: data.business_name,
            phone: data.phone,
            address: data.address,
          },
        });
      } catch (err) {
        console.warn("Auth güncelleme atlandı:", err);
      }
    }

    const { error: profileError } = await context.supabase.from("profiles").upsert({
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

    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
        password: data.password,
      });
      if (error) throw error;
      return { ok: true as const };
    }
    return { ok: true as const };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    await ensureNotFixedAdminForDeletion(data.id, context.supabase);

    const { count, error: orderError } = await context.supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.id);
    if (orderError) throw orderError;
    if ((count ?? 0) > 0) {
      throw new Error("Bu müşterinin sipariş geçmişi bulunduğu için hesap silinemez.");
    }

    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.deleteUser(data.id);
      } catch (e) {
        console.warn("auth.deleteUser atlandı:", e);
      }
    }

    const { error: delProfileErr } = await context.supabase
      .from("profiles")
      .delete()
      .eq("id", data.id);
    if (delProfileErr) throw delProfileErr;

    return { ok: true as const };
  });
