import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner + 3 kişi = en fazla 4 yönetim hesabı. */
const MAX_ADMINS = 4;

/**
 * Grants the admin role to the signed-in user when they provide the correct
 * yönetim kayıt kodu, as long as the admin quota is not full.
 */
export const claimAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_SIGNUP_CODE"];
    if (!expected || data.code.trim() !== expected) {
      return { ok: false as const, reason: "invalid_code" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: admins, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (countError) throw countError;

    if (admins.some((a) => a.user_id === context.userId)) {
      return { ok: true as const };
    }
    if (admins.length >= MAX_ADMINS) {
      return { ok: false as const, reason: "limit_reached" as const };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });

    if (error) throw error;
    return { ok: true as const };
  });
