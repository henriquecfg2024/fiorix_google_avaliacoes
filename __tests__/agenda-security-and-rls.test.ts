import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  isSameOriginRequest: vi.fn(() => true),
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isRouteAllowedForUser: vi.fn(async () => true),
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: mocks.isSameOriginRequest,
}));
vi.mock('@/lib/nav-permissions/service', () => ({
  isNavPermissionsFeatureEnabled: mocks.isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser: mocks.isRouteAllowedForUser,
}));

import {
  AgendaAccessError,
  canUserViewEvent,
  isCronAuthorized,
  requireAgendaAccess,
} from '@/lib/agenda/permissions';
import { resetAgendaSandboxForTests } from '@/lib/agenda/sandbox-store';
import {
  createAgendaEvent,
  deleteAgendaEvent,
  getAgendaEventById,
  updateAgendaEvent,
} from '@/lib/agenda/service';

describe('Agenda Inteligente — Segurança Multi-Tenant, Privacidade, RBAC e RLS SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isNavPermissionsFeatureEnabled.mockReturnValue(true);
    mocks.isRouteAllowedForUser.mockResolvedValue(true);
    resetAgendaSandboxForTests();
  });

  it('rejeita não autenticado (401), CSRF cross-origin (403) e VISITANTE somente leitura', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Error('Não autorizado'));
    await expect(requireAgendaAccess()).rejects.toMatchObject({ status: 401 });

    mocks.isSameOriginRequest.mockReturnValueOnce(false);
    await expect(
      requireAgendaAccess(new Request('http://localhost:3000/api/agenda/events', { method: 'POST' }))
    ).rejects.toMatchObject({ status: 403 });

    mocks.requireAuth.mockResolvedValueOnce({
      id: 'u-vis',
      tenantId: 'tenant-1',
      role: 'VISITANTE',
      name: 'Visitante',
      email: 'vis@7risp.com.br',
    });
    const ctxVis = await requireAgendaAccess();
    expect(ctxVis.isReadOnly).toBe(true);
    expect(ctxVis.canCreateOwn).toBe(false);
    await expect(
      createAgendaEvent(ctxVis, {
        title: 'Tentativa Visitante',
        localStartDate: '2026-11-26',
        visibility: 'INDIVIDUAL',
      })
    ).rejects.toThrow(AgendaAccessError);
  });

  it('impede vazamento entre tenants e protege compromissos INDIVIDUAL mesmo contra MASTER/ADMIN', async () => {
    mocks.requireAuth.mockResolvedValue({
      id: 'u-col-1',
      tenantId: 'tenant-A',
      role: 'COLABORADOR',
      name: 'Colaborador A',
      email: 'cola@cartorioa.br',
      departamento: 'Registro',
    });
    const ctxColA = await requireAgendaAccess();

    // COLABORADOR não pode criar compromisso INSTITUCIONAL
    await expect(
      createAgendaEvent(ctxColA, {
        title: 'Tentativa Institucional',
        localStartDate: '2026-11-26',
        visibility: 'INSTITUCIONAL',
      })
    ).rejects.toThrow(AgendaAccessError);

    const { event: privateA } = await createAgendaEvent(ctxColA, {
      title: 'Consulta Médica Privada',
      localStartDate: '2026-11-26',
      visibility: 'INDIVIDUAL',
    });

    // MASTER do mesmo tenant NÃO possui acesso automático a agenda privada INDIVIDUAL de terceiros
    mocks.requireAuth.mockResolvedValue({
      id: 'u-master-A',
      tenantId: 'tenant-A',
      role: 'MASTER',
      name: 'Master A',
      email: 'master@cartorioa.br',
    });
    const ctxMasterA = await requireAgendaAccess();
    expect(canUserViewEvent(privateA, ctxMasterA.user)).toBe(false);
    await expect(getAgendaEventById(ctxMasterA, privateA.id)).rejects.toThrow(AgendaAccessError);
    await expect(
      updateAgendaEvent(ctxMasterA, privateA.id, { title: 'Adulteração' })
    ).rejects.toThrow(AgendaAccessError);

    // Usuário de outro tenant NÃO acessa nem mesmo compromisso INSTITUCIONAL do Tenant A
    mocks.requireAuth.mockResolvedValue({
      id: 'u-admin-A',
      tenantId: 'tenant-A',
      role: 'ADMIN',
      name: 'Admin A',
      email: 'admin@cartorioa.br',
    });
    const ctxAdminA = await requireAgendaAccess();
    const { event: instA } = await createAgendaEvent(ctxAdminA, {
      title: 'Reunião Geral Tenant A',
      localStartDate: '2026-11-26',
      visibility: 'INSTITUCIONAL',
    });

    mocks.requireAuth.mockResolvedValue({
      id: 'u-admin-B',
      tenantId: 'tenant-B',
      role: 'ADMIN',
      name: 'Admin B',
      email: 'admin@cartoriob.br',
    });
    const ctxAdminB = await requireAgendaAccess();
    await expect(getAgendaEventById(ctxAdminB, instA.id)).rejects.toThrow(AgendaAccessError);

    // Governança 5 anos impede exclusão por não-MASTER
    await expect(deleteAgendaEvent(ctxAdminA, instA.id)).rejects.toThrow(AgendaAccessError);
  });

  it('valida autenticação do CRON com Bearer token seguro e verifica migration RLS preparada', () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'super-secret-agenda-cron-token-2026';

    expect(
      isCronAuthorized(
        new Request('http://localhost/api/cron/agenda-reminders', {
          method: 'POST',
          headers: { authorization: 'Bearer invalid' },
        })
      )
    ).toBe(false);
    expect(
      isCronAuthorized(
        new Request('http://localhost/api/cron/agenda-reminders', {
          method: 'POST',
          headers: { authorization: 'Bearer super-secret-agenda-cron-token-2026' },
        })
      )
    ).toBe(true);

    process.env.CRON_SECRET = prevSecret;

    const root = path.resolve(__dirname, '..');
    const migPath = path.join(
      root,
      'supabase',
      'prepared-migrations',
      '20261125090000_fiorix_agenda_inteligente_v1.sql'
    );
    const rbPath = path.join(
      root,
      'supabase',
      'prepared-migrations',
      '20261125090000_fiorix_agenda_inteligente_v1_rollback.sql'
    );

    expect(fs.existsSync(migPath)).toBe(true);
    expect(fs.existsSync(rbPath)).toBe(true);
    const sql = fs.readFileSync(migPath, 'utf8');
    const rbSql = fs.readFileSync(rbPath, 'utf8');

    expect(sql).toContain('NÃO APLICAR SEM AUTORIZAÇÃO DO MASTER');
    expect(sql).toMatch(/BEGIN;/);
    expect(sql).toMatch(/COMMIT;/);
    expect(sql).toContain('ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;');
    expect(sql).not.toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(sql).toContain('REVOKE ALL ON TABLE public.agenda_events FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain("visibility <> 'INDIVIDUAL'");
    expect(rbSql).toContain('DROP TABLE IF EXISTS public.agenda_events;');
  });
});
