import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Çevre değişkenlerini okur, yoksa doğrudan yedek tanımları kullanır
const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 
  'https://fxpbsnojtdsemztmzavz.supabase.co';

const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  'SUPABASE_ANON_KEY_BURAYA';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
