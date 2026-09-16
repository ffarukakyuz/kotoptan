import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One-off bootstrap: creates the fixed admin accounts (phone identity,
 * password 123456) and links the existing ffarukakyuz@gmail.com account to
 * Faruk's phone number. Guarded by LOVABLE_CRON_SECRET.
 */
const ADMINS = [
  { phone: "5393016766", name: "Suat" },
  { phone: "5050088113", name: "Yavuz" },
  { phone: "5468722973", name: "Mücahit" },
  { phone: "5357336311", name: "Selim" },
] as const;

const FARUK_PHONE = "0544 893 13 00";
const FARUK_EMAIL = "ffarukakyuz@gmail.com";

export const bootstrapAdmins = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ secret: z.string() }).parse(data))
  .handler(async ({ data }) => {
    if (data.secret !== process.env["LOVABLE_CRON_SECRET"]) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Record<string, string> = {};

    for (const admin of ADMINS) {
      const email = `${admin.phone}@kotoptan.local`;
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "123456",
        email_confirm: true,
        user_metadata: { full_name: admin.name, phone: `0${admin.phone}` },
      });
      let userId = created?.user?.id;
      if (error) {
        if (!error.message.toLowerCase().includes("already")) {
          results[admin.name] = `hata: ${error.message}`;
          continue;
        }
        // User exists — find id and ensure password is set.
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        userId = list?.users?.find((u) => u.email === email)?.id;
        if (userId) {
          await supabaseAdmin.auth.admin.updateUserById(userId, { password: "123456" });
        }
      }
      if (!userId) {
        results[admin.name] = "kullanıcı bulunamadı";
        continue;
      }
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: admin.name, phone: `0${admin.phone}` })
        .eq("id", userId);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      results[admin.name] = "tamam";
    }

    // Faruk: link the existing ff email account to the 00 phone number.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const faruk = list?.users?.find((u) => u.email === FARUK_EMAIL);
    if (faruk) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: FARUK_PHONE, full_name: "Faruk Akyüz" })
        .eq("id", faruk.id);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: faruk.id, role: "admin" }, { onConflict: "user_id,role" });
      results["Faruk"] = "tamam";
    } else {
      results["Faruk"] = "hesap bulunamadı";
    }

    // No one else may be admin: revoke admin from everyone not in this set.
    const keepIds = new Set<string>([faruk?.id ?? ""]);
    for (const admin of ADMINS) {
      const u = list?.users?.find((x) => x.email === `${admin.phone}@kotoptan.local`);
      if (u) keepIds.add(u.id);
    }
    const { data: currentAdmins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    for (const row of currentAdmins ?? []) {
      if (!keepIds.has(row.user_id)) {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", row.user_id)
          .eq("role", "admin");
      }
    }

    return results;
  });
