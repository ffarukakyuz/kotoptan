import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Çevre değişkenlerini okur, yoksa doğrudan yedek tanımları kullanır
const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 
  'https://fxpbsnojtdsemztmzavz.supabase.co';

const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4cGJzbm9qdGRzZW16dG16YXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMzMzNzEsImV4cCI6MjEwMzYwOTM3MX0.hGloigcRKmZFcMHnJP9U6x00KBlZ2Kx5qd_qFjrkIrA';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
