import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
};

export type AuthSession = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  loginWithFallbackUser: (fUser: FallbackUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_SESSION_KEY = "ko_local_auth_session";

function getInitialStoredAuth(): {
  user: AuthUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  hasStoredSession: boolean;
} {
  if (typeof window === "undefined") {
    return { user: null, profile: null, isAdmin: false, hasStoredSession: false };
  }
  try {
    const rawLocal = localStorage.getItem(LOCAL_SESSION_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && typeof parsed === "object" && parsed.user) {
        return {
          user: parsed.user as AuthUser,
          profile: (parsed.profile as Profile) || null,
          isAdmin: Boolean(parsed.isAdmin),
          hasStoredSession: true,
        };
      }
    }
    return { user: null, profile: null, isAdmin: false, hasStoredSession: false };
  } catch {
    return { user: null, profile: null, isAdmin: false, hasStoredSession: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(getInitialStoredAuth);
  const [session, setSession] = useState<AuthSession | null>(
    initial.user ? { user: initial.user } : null,
  );
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  const [isAdmin, setIsAdmin] = useState(initial.isAdmin);
  const [loading, setLoading] = useState(false);

  const loadDetails = useCallback(async (userId: string, currentUser?: AuthUser | null) => {
    let prof: Profile | null = null;

    // 1. D1 / Users API veya yerel kullanıcı verisine bak
    try {
      const identifier = currentUser?.email || currentUser?.phone || userId;
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
    } catch (err) {
      console.warn("[useAuth] Profile fetch notice:", err);
    }

    setProfile(prof);

    // 2. Yönetici kontrolü
    const adminStatus = isUserAdmin(currentUser ?? { id: userId }, prof);
    setIsAdmin(adminStatus);
  }, []);

  const loginWithFallbackUser = useCallback((fUser: FallbackUser) => {
    const mockUser: AuthUser = {
      id: fUser.id,
      user_metadata: {
        full_name: fUser.fullName,
        business_name: fUser.businessName,
        phone: fUser.phone,
        address: fUser.address,
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: fUser.email,
      phone: fUser.phone,
    };

    const prof: Profile = {
      id: fUser.id,
      full_name: fUser.fullName,
      business_name: fUser.businessName,
      phone: fUser.phone,
      address: fUser.address,
      district: fUser.district || "Tatvan",
    };

    const isAdm = fUser.role === "admin" || isUserAdmin({ id: fUser.id, email: fUser.email }, prof);

    setUser(mockUser);
    setSession({ user: mockUser });
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
    // İlk oturum kontrolü
    if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem(LOCAL_SESSION_KEY);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (parsed && typeof parsed === "object" && parsed.user) {
            setUser(parsed.user as AuthUser);
            setSession({ user: parsed.user as AuthUser });
            setProfile((parsed.profile as Profile) || null);
            setIsAdmin(Boolean(parsed.isAdmin));
          }
        }
      } catch (err) {
        console.warn("[useAuth] Failed parsing local session:", err);
      }
    }
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadDetails(user.id, user);
  }, [user, loadDetails]);

  const signOut = useCallback(async () => {
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

const FALLBACK_AUTH_VALUE: AuthContextValue = {
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
  loginWithFallbackUser: () => {},
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return FALLBACK_AUTH_VALUE;
  }
  return ctx;
}
