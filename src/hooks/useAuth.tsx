import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/admin-config";
import { findFallbackUser, type FallbackUser } from "@/data/users";

export type Profile = {
  id: string;
  full_name: string;
  business_name: string;
  phone: string;
  address: string;
  district?: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  loginWithFallbackUser: (fUser: FallbackUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_SESSION_KEY = "ko_local_auth_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async (userId: string, currentUser?: User | null) => {
    let prof: Profile | null = null;
    let isDbAdmin = false;

    // 1. Önce Supabase profiles tablosunu dene
    try {
      const { data: profileRow, error } = await supabase
        .from("profiles")
        .select("id, full_name, business_name, phone, address")
        .eq("id", userId)
        .maybeSingle();

      if (!error && profileRow) {
        prof = profileRow as Profile;
      }
    } catch (err) {
      console.warn("[useAuth] Supabase profile fetch failed, using fallback:", err);
    }

    // 2. Supabase yanıt vermediyse veya profil boşsa, yerel kullanıcı verisine bak
    if (!prof) {
      const identifier = currentUser?.email || userId;
      const fallback = findFallbackUser(identifier);
      if (fallback) {
        prof = {
          id: fallback.id,
          full_name: fallback.fullName,
          business_name: fallback.businessName,
          phone: fallback.phone,
          address: fallback.address,
          district: fallback.district || "Tatvan",
        };
      } else if (currentUser?.user_metadata && currentUser.user_metadata["full_name"]) {
        prof = {
          id: userId,
          full_name: String(currentUser.user_metadata["full_name"] || ""),
          business_name: String(currentUser.user_metadata["business_name"] || ""),
          phone: String(currentUser.user_metadata["phone"] || ""),
          address: String(currentUser.user_metadata["address"] || ""),
          district: String(currentUser.user_metadata["district"] || ""),
        };
      }
    }

    setProfile(prof);

    // 3. Yönetici rol kontrolü
    try {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      isDbAdmin = roleRow?.role === "admin";
    } catch {
      // Supabase kapalıysa yerel kontrole geç
    }

    const adminStatus = isDbAdmin || isUserAdmin(currentUser ?? { id: userId }, prof);
    setIsAdmin(adminStatus);
  }, []);

  const loginWithFallbackUser = useCallback((fUser: FallbackUser) => {
    const mockUser = {
      id: fUser.id,
      app_metadata: {},
      user_metadata: {
        full_name: fUser.fullName,
        business_name: fUser.businessName,
        phone: fUser.phone,
        address: fUser.address,
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: fUser.email,
    } as unknown as User;

    const prof: Profile = {
      id: fUser.id,
      full_name: fUser.fullName,
      business_name: fUser.businessName,
      phone: fUser.phone,
      address: fUser.address,
    };

    const isAdm = fUser.role === "admin" || isUserAdmin({ id: fUser.id, email: fUser.email }, prof);

    setUser(mockUser);
    setProfile(prof);
    setIsAdmin(isAdm);
    setLoading(false);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          LOCAL_SESSION_KEY,
          JSON.stringify({
            user: mockUser,
            profile: prof,
            isAdmin: isAdm,
          }),
        );
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Supabase Auth listener
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      if (nextSession?.user) {
        setSession(nextSession);
        setUser(nextSession.user);
        void loadDetails(nextSession.user.id, nextSession.user);
        // Supabase oturumu başarıyla geldiyse yerel yedeği senkronize et
        if (typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_SESSION_KEY);
        }
      }
    });

    // İlk oturum kontrolü (Hibrit: Supabase -> Yerel Depolama)
    void (async () => {
      let foundUser: User | null = null;
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1200),
        );
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        if (data?.session?.user) {
          setSession(data.session);
          foundUser = data.session.user;
          setUser(foundUser);
          if (active) await loadDetails(foundUser.id, foundUser);
        }
      } catch (sbErr) {
        console.warn("[useAuth] Supabase getSession error, checking local fallback:", sbErr);
      }

      // Supabase'de oturum yoksa, daha önce kaydedilmiş yerel oturumu kontrol et
      if (!foundUser && typeof window !== "undefined") {
        try {
          const rawLocal = localStorage.getItem(LOCAL_SESSION_KEY);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (parsed && parsed.user) {
              setUser(parsed.user as User);
              setProfile(parsed.profile as Profile);
              setIsAdmin(Boolean(parsed.isAdmin));
            }
          }
        } catch {
          // ignore
        }
      }

      if (active) {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadDetails]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadDetails(user.id, user);
  }, [user, loadDetails]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Supabase kopsa bile yerel oturumu sonlandır
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      } catch {
        // ignore
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    if (typeof window !== "undefined") window.location.href = "/giris";
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      loading,
      refreshProfile,
      signOut,
      loginWithFallbackUser,
    }),
    [user, session, profile, isAdmin, loading, refreshProfile, signOut, loginWithFallbackUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
