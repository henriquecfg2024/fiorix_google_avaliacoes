import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

export type { SupabaseClient, RealtimeChannel };

function sanitizeEnvValue(raw?: string | null): string {
  if (!raw || raw.includes('[SENSITIVE]')) return '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

export function getSupabaseUrl(): string {
  return sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return sanitizeEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY
  );
}

let _supabasePublic: SupabaseClient | null = null;
let _warnedMissingAnon = false;

export function getSupabasePublic(): SupabaseClient {
  if (!_supabasePublic) {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();

    if (!url || !anonKey) {
      if (!_warnedMissingAnon && process.env.NODE_ENV !== 'test') {
        _warnedMissingAnon = true;
        console.warn(
          '[FIORIX Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausente nas variáveis de ambiente. Realtime operará em modo inativo.'
        );
      }
      _supabasePublic = createClient(
        url || 'http://127.0.0.1:54321',
        anonKey || 'unconfigured-supabase-anon-key',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      return _supabasePublic;
    }

    _supabasePublic = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return _supabasePublic;
}

// Cliente público lazy exclusivo para Realtime Broadcast no navegador (sem chaves hardcoded no código)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabasePublic();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// Cliente administrativo seguro (server-only): inicializado sob demanda exclusivamente no servidor
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin não pode ser executado no navegador por razões de segurança.');
  }

  if (!_supabaseAdmin) {
    const supabaseUrl = getSupabaseUrl();
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL não configurada nas variáveis de ambiente do servidor.');
    }

    const rawServiceKey = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const serviceKey = rawServiceKey.length > 20 ? rawServiceKey : undefined;

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
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const admin = getSupabaseAdmin();
    const value = (admin as any)[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  },
});
