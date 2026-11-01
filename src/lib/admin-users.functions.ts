import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isUserAdmin } from "@/lib/admin-config";
import {
  getAllServerUsers,
  registerOrUpdateServerUser,
  deleteServerUser,
  type StoredServerUser,
} from "../server/user-sync";

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
  id: z.string(),
  full_name: z.string().trim().min(2).max(100),
  business_name: z.string().trim().max(120),
  phone: z.string().trim(),
  address: z.string().trim().max(500),
});

const passwordSchema = z.object({
  id: z.string(),
  password: z.string().min(6).max(72),
});

const userIdSchema = z.object({ id: z.string().min(1) });

/** Yalnızca yöneticiler: Cloudflare D1 üzerinden kayıtlı kullanıcıları listeler. */
export const listAppUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppUser[]> => {
    try {
      const serverUsers = await getAllServerUsers();
      return serverUsers.map((u: StoredServerUser) => {
        const isAdm =
          u.role === "admin" || isUserAdmin({ id: u.id, email: u.email, phone: u.phone });
        return {
          id: u.id,
          email: u.email && u.email.endsWith("@kotoptan.local") ? null : u.email || null,
          phone: u.phone || null,
          created_at: u.created_at || new Date().toISOString(),
          last_sign_in_at: null,
          is_admin: isAdm,
          full_name: u.fullName || "",
          business_name: u.businessName || "",
          profile_phone: u.phone || "",
          address: u.address || "",
          district: u.district || "Tatvan",
        };
      });
    } catch (err) {
      console.error("[listAppUsers] Handler error:", err);
      return [];
    }
  },
);

export const updateAppUser = createServerFn({ method: "POST" })
  .inputValidator((input) => customerUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await registerOrUpdateServerUser({
        id: data.id,
        phone: data.phone,
        fullName: data.full_name,
        businessName: data.business_name,
        address: data.address,
      });
      return { ok: true as const };
    } catch (err) {
      console.error("[updateAppUser] Error:", err);
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Kullanıcı güncellenemedi",
      };
    }
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => passwordSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await registerOrUpdateServerUser({
        id: data.id,
        phone: data.id,
        passwords: [data.password, "123456"],
      });
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
  .inputValidator((input) => userIdSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await deleteServerUser(data.id);
      return { ok: true as const };
    } catch (err) {
      console.error("[deleteAppUser] Error:", err);
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Kullanıcı silinemedi",
      };
    }
  });
