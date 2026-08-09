import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('supabase client', () => {
  it('uses the configured project url and anon key', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const { supabase } = await import('./supabase');

    expect(supabase).toBeDefined();
    expect(createClient).toHaveBeenCalledWith('https://project.supabase.co', 'anon-key');
  });

  it('falls back to the built in project when the env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await import('./supabase');

    const [url, key] = createClient.mock.calls[0];
    expect(url).toMatch(/^https:\/\/.*\.supabase\.co$/);
    expect(key).toBeTruthy();
  });
});
