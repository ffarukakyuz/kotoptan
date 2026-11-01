import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isUserAdmin } from "@/lib/admin-config";

export const SUPABASE_URL = "https://fxpbsnojtdsemztmzavz.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4cGJzbm9qdGRzZW16dG16YXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMzMzNzEsImV4cCI6MjEwMzYwOTM3MX0.hGloigcRKmZFcMHnJP9U6x00KBlZ2Kx5qd_qFjrkIrA";
export const FALLBACK_SUPABASE_URL = SUPABASE_URL;
export const FALLBACK_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

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
  district?: string | null;
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

const userIdSchema = z.object({ id: z.string().min(1) });

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

function hasServiceRoleKey(): boolean {
  return Boolean(
    (typeof process !== "undefined" && process.env && process.env["SUPABASE_SERVICE_ROLE_KEY"]) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof globalThis !== "undefined" && (globalThis as any)?.__env__?.SUPABASE_SERVICE_ROLE_KEY),
  );
}

/** Yalnızca yöneticiler: kayıtlı kullanıcıları listeler. */
export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    try {
      await requireAdmin(context);

      // İlk olarak profiles tablosundan tüm kayıtlı üyeleri çek
      const { data: profiles, error: profileErr } = await context.supabase
        .from("profiles")
        .select("id, full_name, business_name, phone, address, created_at")
        .order("created_at", { ascending: false });

      if (profileErr) {
        console.error("[listAppUsers] Error fetching profiles:", profileErr);
        throw profileErr;
      }

      // Supabase auth admin listUsers opsiyonel denenir
      try {
        if (hasServiceRoleKey()) {
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
        console.warn(
          "[listAppUsers] auth.admin.listUsers atlandı, profiles tablosu kullanılıyor:",
          e,
        );
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
    } catch (err) {
      console.error("[listAppUsers] Handler error:", err);
      return [];
    }
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => customerUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);

      if (hasServiceRoleKey()) {
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
          console.warn("[updateAppUser] Auth güncelleme atlandı:", err);
        }
      }

      const { error: profileError } = await context.supabase.from("profiles").upsert({
        id: data.id,
        full_name: data.full_name,
        business_name: data.business_name,
        phone: data.phone,
        address: data.address,
      });
      if (profileError) {
        console.error("[updateAppUser] Profile upsert error:", profileError);
        return { ok: false as const, error: profileError.message };
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[updateAppUser] Unexpected error:", err);
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Kullanıcı güncellenemedi",
      };
    }
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => passwordSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);

      if (hasServiceRoleKey()) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
          password: data.password,
        });
        if (error) {
          console.error("[resetAppUserPassword] Error updating password:", error);
          return { ok: false as const, error: error.message };
        }
        return { ok: true as const };
      }
      return { ok: true as const };
    } catch (err) {
      console.error("[resetAppUserPassword] Error:", err);
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Şifre sıfırlanamadı",
      };
    }
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
      await ensureNotFixedAdminForDeletion(data.id, context.supabase);

      try {
        await context.supabase.from("orders").update({ user_id: null }).eq("user_id", data.id);
      } catch (orderUpdateErr) {
        console.warn("[deleteAppUser] Detach orders user_id error:", orderUpdateErr);
      }

      if (hasServiceRoleKey()) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("profiles").delete().eq("id", data.id);
          await supabaseAdmin.auth.admin.deleteUser(data.id);
        } catch (e) {
          console.warn("[deleteAppUser] auth.deleteUser atlandı:", e);
        }
      }

      try {
        await context.supabase.from("profiles").delete().eq("id", data.id);
      } catch (delErr) {
        console.warn("[deleteAppUser] context.supabase delete profiles error:", delErr);
      }

      return { ok: true as const };
    } catch (err) {
      console.error("[deleteAppUser] Error:", err);
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Kullanıcı silinemedi",
      };
    }
  });
