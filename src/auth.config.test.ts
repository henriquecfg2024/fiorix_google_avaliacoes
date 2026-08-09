import { describe, expect, it } from 'vitest';

import { authConfig } from './auth.config';

type AuthorizedParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>['authorized']>>[0];

function buildParams(pathname: string, role?: string): AuthorizedParams {
  return {
    auth: role ? ({ user: { role } } as any) : null,
    request: { nextUrl: new URL(`https://app.test${pathname}`) } as any,
  } as AuthorizedParams;
}

function authorized(pathname: string, role?: string) {
  return authConfig.callbacks!.authorized!(buildParams(pathname, role));
}

function redirectLocation(result: unknown) {
  expect(result).toBeInstanceOf(Response);
  return (result as Response).headers.get('location');
}

describe('authConfig.authorized', () => {
  it('blocks anonymous access to every protected area', () => {
    const protectedPaths = [
      '/dashboard',
      '/avaliacoes',
      '/estatisticas',
      '/relatorios',
      '/admin',
      '/bi',
      '/configuracoes',
    ];

    for (const pathname of protectedPaths) {
      expect(authorized(pathname), pathname).toBe(false);
    }
  });

  it('allows authenticated users into protected areas', () => {
    expect(authorized('/dashboard', 'USER')).toBe(true);
    expect(authorized('/bi/importar', 'ADMIN')).toBe(true);
  });

  it('restricts /configuracoes/cartorios to MASTER users', () => {
    expect(redirectLocation(authorized('/configuracoes/cartorios', 'ADMIN'))).toBe('https://app.test/dashboard');
    expect(authorized('/configuracoes/cartorios', 'MASTER')).toBe(true);
  });

  it('keeps plain users out of /configuracoes', () => {
    expect(redirectLocation(authorized('/configuracoes/usuarios', 'USER'))).toBe('https://app.test/dashboard');
    expect(authorized('/configuracoes/usuarios', 'ADMIN')).toBe(true);
  });

  it('sends logged in users away from the login page', () => {
    expect(redirectLocation(authorized('/login', 'USER'))).toBe('https://app.test/dashboard');
  });

  it('leaves public pages open', () => {
    expect(authorized('/login')).toBe(true);
    expect(authorized('/')).toBe(true);
  });
});

describe('authConfig session callbacks', () => {
  it('copies user claims into the token only on sign in', async () => {
    const jwt = authConfig.callbacks!.jwt!;
    const withUser = await jwt({
      token: {} as any,
      user: { id: 'u1', role: 'ADMIN', tenantId: 't1' } as any,
    } as any);
    expect(withUser).toMatchObject({ id: 'u1', role: 'ADMIN', tenantId: 't1' });

    const withoutUser = await jwt({ token: { id: 'u1' } as any } as any);
    expect(withoutUser).toEqual({ id: 'u1' });
  });

  it('exposes token claims through the session', async () => {
    const session = authConfig.callbacks!.session!;
    const result = await session({
      session: { user: { name: 'Ana' } } as any,
      token: { id: 'u1', role: 'MASTER', tenantId: 't1' } as any,
    } as any);

    expect(result.user).toMatchObject({ name: 'Ana', id: 'u1', role: 'MASTER', tenantId: 't1' });
  });

  it('ignores sessions without a user', async () => {
    const session = authConfig.callbacks!.session!;
    const result = await session({ session: {} as any, token: { id: 'u1' } as any } as any);
    expect(result).toEqual({});
  });
});
