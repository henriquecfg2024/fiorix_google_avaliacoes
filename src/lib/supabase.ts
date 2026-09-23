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
  ? rawKey.replace(/^["']|["']$/g, '').trim()
  : FIORIX_SUPABASE_ANON_KEY;

// Cliente público seguro para uso no navegador e realtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrativo seguro (server-only): inicializado sob demanda exclusivamente no servidor
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin não pode ser executado no navegador por razões de segurança.');
  }

  if (!_supabaseAdmin) {
    const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceKey = (rawServiceKey && !rawServiceKey.includes('[SENSITIVE]') && rawServiceKey.length > 20)
      ? rawServiceKey.replace(/^["']|["']$/g, '').trim()
      : undefined;

    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do servidor.');
    }

    _supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return _supabaseAdmin;
}

// Proxy transparente para manter compatibilidade total com os módulos de backend existentes
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const admin = getSupabaseAdmin();
    const value = (admin as any)[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  },
});
