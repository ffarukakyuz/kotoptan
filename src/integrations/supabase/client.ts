import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const REAL_SUPABASE_URL = "https://fxpbsnojtdsemztmzavz.supabase.co";
export const REAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4cGJzbm9qdGRzZW16dG16YXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMzMzNzEsImV4cCI6MjEwMzYwOTM3MX0.hGloigcRKmZFcMHnJP9U6x00KBlZ2Kx5qd_qFjrkIrA";

export const FALLBACK_SUPABASE_URL = REAL_SUPABASE_URL;
export const FALLBACK_SUPABASE_ANON_KEY = REAL_SUPABASE_ANON_KEY;

function getEnvVar(key: string): string | undefined {
  // 1. Try static import.meta.env (Vite / client)
  try {
    let val: string | undefined;
    if (key === "VITE_SUPABASE_URL") val = import.meta.env.VITE_SUPABASE_URL;
    else if (key === "VITE_SUPABASE_ANON_KEY") val = import.meta.env.VITE_SUPABASE_ANON_KEY;
    else if (key === "VITE_SUPABASE_PUBLISHABLE_KEY")
      val = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (
      typeof val === "string" &&
      val.trim() &&
      !val.includes("fgobmapryccuqcmbotkj") &&
      !val.includes("sb_publishable_12XuaSyp")
    ) {
      return val.trim();
    }
  } catch {
    // Ignore
  }

  // 2. Try process.env (Node / SSR)
  try {
    if (typeof process !== "undefined" && process?.env) {
      const val = process.env[key];
      if (
        typeof val === "string" &&
        val.trim() &&
        !val.includes("fgobmapryccuqcmbotkj") &&
        !val.includes("sb_publishable_12XuaSyp")
      ) {
        return val.trim();
      }
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

// fg... ile başlayan sahte/eski adresi ve anahtarları tamamen engelle, gerçek adres ve anahtarı kullan
export const SUPABASE_URL =
  envUrl && !envUrl.includes("fgobmapryccuqcmbotkj") && !envUrl.includes("://fg")
    ? envUrl
    : REAL_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  envKey && !envKey.includes("12XuaSyp") && !envKey.startsWith("sb_publishable_")
    ? envKey
    : REAL_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
