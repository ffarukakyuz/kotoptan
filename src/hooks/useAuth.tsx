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

export type Profile = {
  id: string;
  full_name: string;
  business_name: string;
  phone: string;
  address: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async (userId: string, currentUser?: User | null) => {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, phone, address")
      .eq("id", userId)
      .maybeSingle();

    const prof = (profileRow as Profile | null) ?? null;
    setProfile(prof);

    // Veritabanı rolü ve yönetici listesi kontrolü
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isDbAdmin = roleRow?.role === "admin";
    const adminStatus = isDbAdmin || isUserAdmin(currentUser ?? { id: userId }, prof);
    setIsAdmin(adminStatus);
  }, []);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        void loadDetails(nextUser.id, nextUser);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      const initialUser = data.session?.user ?? null;
      setUser(initialUser);
      if (initialUser) await loadDetails(initialUser.id, initialUser);
      setLoading(false);
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
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    if (typeof window !== "undefined") window.location.href = "/giris";
  }, []);

  const value = useMemo(
    () => ({ user, session, profile, isAdmin, loading, refreshProfile, signOut }),
    [user, session, profile, isAdmin, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
