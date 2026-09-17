import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Yalnızca bu e-postalar yönetici olabilir. Yeni yönetici eklemek için
 * e-postayı bu listeye ekleyin (ya da ADMIN_EMAILS ortam değişkenine yazın).
 */
const ALLOWED_ADMIN_EMAILS = [
  "5448931300@kotoptan.local", // Faruk
  "5393016766@kotoptan.local", // Suat
  "5050088113@kotoptan.local", // Yavuz
  "5468722973@kotoptan.local", // Mücahit
  "5357336311@kotoptan.local", // Selim
];

/**
 * Signs the current user in as admin when their e-mail is on the allowlist,
 * and removes the admin role when it is not.
 */
export const syncAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as { email?: string } | null;
    const email = (claims?.email ?? "").trim().toLowerCase();
    if (!email) return { isAdmin: false as const };

    const extra = (process.env["ADMIN_EMAILS"] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const allowed = new Set([...ALLOWED_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...extra]);
    const shouldBeAdmin = allowed.has(email);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (shouldBeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
      return { isAdmin: true as const };
    }

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", context.userId)
      .eq("role", "admin");
    return { isAdmin: false as const };
  });
