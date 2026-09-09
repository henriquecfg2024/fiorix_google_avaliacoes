import { createClient } from '@supabase/supabase-js';

export const FIORIX_SUPABASE_URL = 'https://uvieekfizuzujpwfbjww.supabase.co';
export const FIORIX_SUPABASE_ANON_KEY = 'sb_publishable_gLo1mRVogCkhQEtTQXyK0A_PQ7264A0';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseUrl = (rawUrl && rawUrl.includes('uvieekfizuzujpwfbjww'))
  ? rawUrl.trim()
  : FIORIX_SUPABASE_URL;

const rawKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const supabaseAnonKey = (rawKey && !rawKey.includes('[SENSITIVE]'))
  ? rawKey.trim()
  : FIORIX_SUPABASE_ANON_KEY;

const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceRoleKey = (rawServiceKey && !rawServiceKey.includes('[SENSITIVE]') && rawServiceKey.length > 20)
  ? rawServiceKey.trim()
  : supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

