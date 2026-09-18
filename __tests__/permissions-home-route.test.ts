import { describe, it, expect } from 'vitest';
import { getHomeRouteForRole } from '@/lib/permissions';

describe('getHomeRouteForRole (RBAC Canonical Home Route)', () => {
  it('direciona o perfil COLABORADOR exclusivamente para /minha-it', () => {
    expect(getHomeRouteForRole('COLABORADOR')).toBe('/minha-it');
    expect(getHomeRouteForRole({ role: 'COLABORADOR' })).toBe('/minha-it');
  });

  it('direciona o perfil RH para /sistema/pessoas', () => {
    expect(getHomeRouteForRole('RH')).toBe('/sistema/pessoas');
    expect(getHomeRouteForRole({ role: 'RH' })).toBe('/sistema/pessoas');
  });

  it('direciona o perfil SUBSTITUTO para /administracao/its', () => {
    expect(getHomeRouteForRole('SUBSTITUTO')).toBe('/administracao/its');
    expect(getHomeRouteForRole({ role: 'SUBSTITUTO' })).toBe('/administracao/its');
  });

  it('direciona os perfis USER, ADMIN e MASTER para /dashboard', () => {
    expect(getHomeRouteForRole('USER')).toBe('/dashboard');
    expect(getHomeRouteForRole({ role: 'USER' })).toBe('/dashboard');

    expect(getHomeRouteForRole('ADMIN')).toBe('/dashboard');
    expect(getHomeRouteForRole({ role: 'ADMIN' })).toBe('/dashboard');

    expect(getHomeRouteForRole('MASTER')).toBe('/dashboard');
    expect(getHomeRouteForRole({ role: 'MASTER' })).toBe('/dashboard');
  });

  it('realiza fallback seguro para /dashboard em valores nulos, vazios ou indefinidos', () => {
    expect(getHomeRouteForRole(null)).toBe('/dashboard');
    expect(getHomeRouteForRole(undefined)).toBe('/dashboard');
    expect(getHomeRouteForRole('')).toBe('/dashboard');
    expect(getHomeRouteForRole({ role: null })).toBe('/dashboard');
  });
});
