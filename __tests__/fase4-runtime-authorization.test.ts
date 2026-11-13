import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authConfig } from '@/auth.config';

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
const mockIsSameOriginRequest = vi.fn();
const mockListTenantConnectorNodes = vi.fn();
const mockGetTenantConnectorSettings = vi.fn();
const mockGetLatestReleaseManifest = vi.fn();
const mockGetReleaseArtifactDir = vi.fn();
const mockPromoteConnector = vi.fn();
const mockConsumeEnrollmentToken = vi.fn();
const mockGetAlertConfig = vi.fn();
const mockGetRecentAlertLogs = vi.fn();
const mockHoleriteFindFirst = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockLogAuditEventStrict = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockAuthenticateConnector = vi.fn();
const mockClaimSearch = vi.fn();
const mockFinishSearch = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: (...args: unknown[]) => mockIsSameOriginRequest(...args),
}));

vi.mock('@/lib/health/operations-service', () => ({
  invalidateOperationsHealthCache: vi.fn(),
  sanitizeDatabaseError: () => ({ message: 'Erro sanitizado', code: 'DB_ERR' }),
}));

vi.mock('@/lib/connector/ha-manager', () => ({
  listTenantConnectorNodes: (...args: unknown[]) => mockListTenantConnectorNodes(...args),
  getTenantConnectorSettings: (...args: unknown[]) => mockGetTenantConnectorSettings(...args),
  getLatestReleaseManifest: (...args: unknown[]) => mockGetLatestReleaseManifest(...args),
  getReleaseArtifactDir: (...args: unknown[]) => mockGetReleaseArtifactDir(...args),
  promoteConnector: (...args: unknown[]) => mockPromoteConnector(...args),
  pauseConnector: vi.fn(),
  resumeConnector: vi.fn(),
  updateConnectorNodeConfig: vi.fn(),
  setTenantFailoverSettings: vi.fn(),
  createEnrollmentToken: vi.fn(),
  triggerConnectorUpdate: vi.fn(),
  startRollingUpdate: vi.fn(),
  cancelRollingUpdate: vi.fn(),
  deleteConnectorNode: vi.fn(),
  consumeEnrollmentToken: (...args: unknown[]) => mockConsumeEnrollmentToken(...args),
}));

vi.mock('@/lib/alerts/alert-storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/alerts/alert-storage')>(
    '@/lib/alerts/alert-storage',
  );
  return {
    ...actual,
    getAlertConfig: (...args: unknown[]) => mockGetAlertConfig(...args),
    getRecentAlertLogs: (...args: unknown[]) => mockGetRecentAlertLogs(...args),
    saveAlertConfig: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fiorixHolerite: {
      findFirst: (...args: unknown[]) => mockHoleriteFindFirst(...args),
    },
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  },
}));

vi.mock('@/lib/security/requestIp', () => ({
  getRequestIp: () => '198.51.100.10',
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/audit/log', () => ({
  logAuditEventStrict: (...args: unknown[]) => mockLogAuditEventStrict(...args),
}));

vi.mock('@/lib/connectorAuth', () => ({
  authenticateConnector: (...args: unknown[]) => mockAuthenticateConnector(...args),
}));

vi.mock('@/lib/documental/store', () => ({
  claimSearch: (...args: unknown[]) => mockClaimSearch(...args),
  finishSearch: (...args: unknown[]) => mockFinishSearch(...args),
}));

import {
  GET as getOperacoesConnectors,
  POST as postOperacoesConnectors,
} from '@/app/api/v1/operacoes/connectors/route';
import { GET as getOperacoesAlerts } from '@/app/api/v1/operacoes/alerts/route';
import { GET as downloadHolerite } from '@/app/api/holerites/[id]/download/route';
import { GET as getConnectorRelease } from '@/app/api/v1/connector/release/route';
import { POST as postConnectorDocumentos } from '@/app/api/v1/connector/documentos/route';
import { POST as postConnectorEnroll } from '@/app/api/v1/connector/enroll/route';

describe('Fase 4 — Autorização, Isolamento Multi-Tenant e Abuso em Execução (API + Middleware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSameOriginRequest.mockReturnValue(true);
    mockCheckRateLimit.mockReturnValue({ ok: true, remaining: 9 });
    mockLogAuditEventStrict.mockResolvedValue(undefined);
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockGetLatestReleaseManifest.mockReturnValue(null);
    mockListTenantConnectorNodes.mockResolvedValue([]);
    mockGetTenantConnectorSettings.mockResolvedValue({ failoverMode: 'MANUAL' });
    process.env.DOCUMENTAL_ENABLED = 'true';
  });

  describe('1. Gate de borda authConfig.callbacks.authorized (/preview-* e rotas protegidas)', () => {
    const invokeAuthorized = async (pathname: string, loggedIn: boolean) => {
      const fn = authConfig.callbacks?.authorized;
      if (!fn) {
        throw new Error('callbacks.authorized ausente');
      }
      return fn({
        auth: loggedIn ? ({ user: { id: 'u-1', role: 'COLABORADOR' } } as never) : null,
        request: new NextRequest(`https://app.fiorix.test${pathname}`) as never,
      });
    };

    it('bloqueia acesso anônimo às rotas /preview-* e demais áreas autenticadas', async () => {
      for (const routePath of [
        '/preview-operacoes',
        '/preview-qualidade',
        '/preview-recepcao',
        '/preview-visao-consolidada',
        '/dashboard',
        '/configuracoes/usuarios',
      ]) {
        const res = await invokeAuthorized(routePath, false);
        expect(res, `Esperava bloqueio sem sessão em ${routePath}`).toBe(false);
      }
    });

    it('mantém acessíveis /login e /verifica/[hash] sem sessão e redireciona /login se já autenticado', async () => {
      expect(await invokeAuthorized('/login', false)).toBe(true);
      expect(await invokeAuthorized('/verifica/abc123', false)).toBe(true);

      const redirected = await invokeAuthorized('/login', true);
      expect(redirected).toBeInstanceOf(Response);
      expect((redirected as Response).headers.get('location')).toBe(
        'https://app.fiorix.test/dashboard',
      );
    });
  });

  describe('2. Chamadas diretas às APIs de Operações HA e Alertas', () => {
    it('nega GET/POST em /api/v1/operacoes/connectors para anônimo e papel COLABORADOR', async () => {
      mockRequireRole.mockRejectedValueOnce(new Error('Não autorizado'));
      const unauthRes = await getOperacoesConnectors();
      expect(unauthRes.status).toBe(403);

      mockRequireRole.mockRejectedValueOnce(new Error('Acesso negado para COLABORADOR'));
      const req = new NextRequest('https://app.fiorix.test/api/v1/operacoes/connectors', {
        method: 'POST',
        body: JSON.stringify({ action: 'promote', connectorId: 'conn-1' }),
      });
      const forbiddenRes = await postOperacoesConnectors(req);
      expect(forbiddenRes.status).toBe(403);
      expect(mockPromoteConnector).not.toHaveBeenCalled();
    });

    it('bloqueia POST cross-origin (CSRF) em /api/v1/operacoes/connectors antes mesmo de verificar auth', async () => {
      mockIsSameOriginRequest.mockReturnValueOnce(false);
      const req = new NextRequest('https://app.fiorix.test/api/v1/operacoes/connectors', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify({ action: 'promote', connectorId: 'conn-1' }),
      });
      const res = await postOperacoesConnectors(req);
      expect(res.status).toBe(403);
      expect(mockRequireRole).not.toHaveBeenCalled();
      expect(mockPromoteConnector).not.toHaveBeenCalled();
    });

    it('escopo de tenant estrito na listagem HA e mascaramento de segredos em /api/v1/operacoes/alerts', async () => {
      mockRequireRole.mockResolvedValueOnce({
        id: 'u-master-a',
        role: 'MASTER',
        tenantId: 'tenant-a',
      });
      await getOperacoesConnectors();
      expect(mockListTenantConnectorNodes).toHaveBeenCalledWith('tenant-a');
      expect(mockListTenantConnectorNodes).not.toHaveBeenCalledWith('tenant-b');

      mockRequireRole.mockResolvedValueOnce({
        id: 'u-admin-a',
        role: 'ADMIN',
        tenantId: 'tenant-a',
      });
      mockGetAlertConfig.mockResolvedValueOnce({
        tenantId: 'tenant-a',
        name: 'Alertas',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/RAW_WEBHOOK_SECRET_XYZ',
        channelType: 'slack',
        enabled: true,
        notifyConnectorOffline: true,
        notifySyncFailed: true,
        notifyModuleDelayed: true,
        cooldownMinutes: 15,
        emailProvider: 'smtp',
        emailConfig: {
          host: 'smtp.cartorio.test',
          pass: 'raw-smtp-password',
          resendApiKey: 're_raw_secret_key',
        },
        whatsappProvider: 'evolution',
        whatsappConfig: {
          apikey: 'raw-callmebot-key',
          token: 'raw-evolution-token',
          phones: [{ phone: '5511999999999', apikey: 'raw-phone-apikey' }],
        },
      });
      mockGetRecentAlertLogs.mockResolvedValueOnce([]);

      const alertRes = await getOperacoesAlerts();
      expect(alertRes.status).toBe(200);
      expect(alertRes.headers.get('cache-control')).toContain('no-store');
      const serialized = JSON.stringify(await alertRes.json());
      expect(serialized).not.toContain('RAW_WEBHOOK_SECRET_XYZ');
      expect(serialized).not.toContain('raw-smtp-password');
      expect(serialized).not.toContain('re_raw_secret_key');
      expect(serialized).not.toContain('raw-callmebot-key');
      expect(serialized).not.toContain('raw-evolution-token');
      expect(serialized).not.toContain('raw-phone-apikey');

      mockRequireRole.mockRejectedValueOnce(new Error('Acesso negado'));
      const deniedAlertRes = await getOperacoesAlerts();
      expect(deniedAlertRes.status).toBe(403);
    });
  });

  describe('3. Anti-IDOR e isolamento entre tenants em /api/holerites/[id]/download', () => {
    it('bloqueia download não autenticado sem consultar banco nem gerar URL assinada', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Não autorizado'));
      const req = new NextRequest('https://app.fiorix.test/api/holerites/hol-1/download');
      const res = await downloadHolerite(req, { params: { id: 'hol-1' } });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(mockHoleriteFindFirst).not.toHaveBeenCalled();
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it('impede COLABORADOR de acessar holerite de outro usuário (404 uniforme e filtro usuarioId+tenantId)', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        id: 'user-a1',
        role: 'COLABORADOR',
        tenantId: 'tenant-a',
      });
      mockHoleriteFindFirst.mockResolvedValueOnce(null);

      const req = new NextRequest('https://app.fiorix.test/api/holerites/hol-user-a2/download');
      const res = await downloadHolerite(req, { params: { id: 'hol-user-a2' } });
      expect(res.status).toBe(404);
      expect(mockHoleriteFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hol-user-a2', tenantId: 'tenant-a', usuarioId: 'user-a1' },
        }),
      );
      expect(mockLogAuditEventStrict).not.toHaveBeenCalled();
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it('impede ADMIN do tenant-a de baixar holerite pertencente ao tenant-b', async () => {
      mockRequireAuth.mockResolvedValueOnce({
        id: 'admin-a',
        role: 'ADMIN',
        tenantId: 'tenant-a',
      });
      mockHoleriteFindFirst.mockResolvedValueOnce(null);

      const req = new NextRequest('https://app.fiorix.test/api/holerites/hol-tenant-b/download');
      const res = await downloadHolerite(req, { params: { id: 'hol-tenant-b' } });
      expect(res.status).toBe(404);
      expect(mockHoleriteFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hol-tenant-b', tenantId: 'tenant-a' },
        }),
      );
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('4. Autenticação M2M, isolamento de tenant e rate limit dos endpoints do Connector', () => {
    it('rejeita /api/v1/connector/release sem Bearer ou com secret inválido (401)', async () => {
      const noHeaderReq = new NextRequest('https://app.fiorix.test/api/v1/connector/release');
      const res1 = await getConnectorRelease(noHeaderReq);
      expect(res1.status).toBe(401);
      expect(res1.headers.get('cache-control')).toContain('no-store');

      mockAuthenticateConnector.mockResolvedValueOnce({ success: false });
      const badSecretReq = new NextRequest('https://app.fiorix.test/api/v1/connector/release', {
        headers: { authorization: 'Bearer wrong-secret', 'x-connector-id': 'conn-1' },
      });
      const res2 = await getConnectorRelease(badSecretReq);
      expect(res2.status).toBe(401);
    });

    it('rejeita campo spoofed tenantId via schema estrito (400) e vincula /api/v1/connector/documentos ao tenant do token (200)', async () => {
      const spoofedReq = new Request('https://app.fiorix.test/api/v1/connector/documentos', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'claim',
          connectorId: 'conn-tenant-a',
          tenantId: 'tenant-b-spoofed',
        }),
      });
      const spoofedRes = await postConnectorDocumentos(spoofedReq);
      expect(spoofedRes.status).toBe(400);
      expect(mockClaimSearch).not.toHaveBeenCalled();

      mockAuthenticateConnector.mockResolvedValueOnce({
        success: true,
        connector: { id: 'conn-tenant-a' },
        tenant: { id: 'tenant-a' },
      });
      mockClaimSearch.mockResolvedValueOnce(null);

      const validReq = new Request('https://app.fiorix.test/api/v1/connector/documentos', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'claim',
          connectorId: 'conn-tenant-a',
        }),
      });

      const res = await postConnectorDocumentos(validReq);
      expect(res.status).toBe(200);
      expect(mockClaimSearch).toHaveBeenCalledWith('tenant-a', 'conn-tenant-a');
    });

    it('retorna 401 para token de pareamento inválido e aplica rate-limit 429 em /api/v1/connector/enroll', async () => {
      mockConsumeEnrollmentToken.mockRejectedValueOnce(new Error('INVALID_OR_EXPIRED_TOKEN'));
      const ip = '203.0.113.77';
      const invalidReq = new Request('https://app.fiorix.test/api/v1/connector/enroll', {
        method: 'POST',
        headers: {
          'x-forwarded-for': ip,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ token: 'x'.repeat(32) }),
      });

      const invalidRes = await postConnectorEnroll(invalidReq);
      expect(invalidRes.status).toBe(401);

      let rateLimitedRes: Response | null = null;
      for (let i = 0; i < 15; i++) {
        mockConsumeEnrollmentToken.mockRejectedValueOnce(new Error('INVALID_OR_EXPIRED_TOKEN'));
        const req = new Request('https://app.fiorix.test/api/v1/connector/enroll', {
          method: 'POST',
          headers: {
            'x-forwarded-for': ip,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ token: 'y'.repeat(32) }),
        });
        const attempt = await postConnectorEnroll(req);
        if (attempt.status === 429) {
          rateLimitedRes = attempt;
          break;
        }
      }
      expect(rateLimitedRes?.status).toBe(429);
    });
  });
});
