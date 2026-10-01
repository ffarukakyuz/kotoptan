import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const FALLBACK_SUPABASE_URL = "https://fxpbsnojtdsemztmzavz.supabase.co";
export const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4pGJzbm9qdGRzZW16dG16YXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMzMzNzEsImV4cCI6MjEwMzYwOTM3MX0.hGloigcRKmZFcMHnJP9U6x00KBlZ2Kx5qd_qFjrkIrA";

function getEnvVar(key: string): string | undefined {
  // 1. Try import.meta.env (Vite / client)
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env) {
      const val = import.meta.env[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // Ignore
  }

  // 2. Try process.env (Node / SSR)
  try {
    if (typeof process !== "undefined" && process?.env) {
      const val = process.env[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // Ignore
  }

  return undefined;
}

const envUrl = getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_URL");

const envKey =
  getEnvVar("VITE_SUPABASE_ANON_KEY") ||
  getEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  getEnvVar("SUPABASE_ANON_KEY") ||
  getEnvVar("SUPABASE_PUBLISHABLE_KEY");

export const SUPABASE_URL = envUrl || FALLBACK_SUPABASE_URL;
export const SUPABASE_ANON_KEY = envKey || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
