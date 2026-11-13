import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindFirst = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockConversaMembroFindFirst = vi.fn();
const mockMensagemFindMany = vi.fn();
const mockComunicadoAnexoFindFirst = vi.fn();
const mockComunicadoCienciaFindFirst = vi.fn();
const mockIntegrationConfigFindFirst = vi.fn();
const mockIntegrationConfigUpdate = vi.fn();
const mockSincronizarPedidosWebri = vi.fn();
const mockDocumentAccess = vi.fn();

vi.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bi-aggregates', () => ({
  refreshBiAggregatesForImport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cartorio-virtual/connector-sync', () => ({
  sincronizarPedidosOficiaisWebriBatch: (...args: any[]) => mockSincronizarPedidosWebri(...args),
}));

vi.mock('@/lib/documental/access', () => {
  class DocumentAccessError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    DocumentAccessError,
    requireDocumentAccess: (...args: any[]) => mockDocumentAccess(...args),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        download: vi.fn().mockResolvedValue({ data: null, error: { message: 'not mocked' } }),
      }),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: any[]) => mockExecuteRawUnsafe(...args),
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      findFirst: (...args: any[]) => mockUserFindFirst(...args),
    },
    tenant: {
      findUnique: (...args: any[]) => mockTenantFindUnique(...args),
    },
    conversaMembro: {
      findFirst: (...args: any[]) => mockConversaMembroFindFirst(...args),
    },
    mensagem: {
      findMany: (...args: any[]) => mockMensagemFindMany(...args),
    },
    fiorixComunicadoAnexo: {
      findFirst: (...args: any[]) => mockComunicadoAnexoFindFirst(...args),
    },
    fiorixComunicadoCiencia: {
      findFirst: (...args: any[]) => mockComunicadoCienciaFindFirst(...args),
    },
    integrationConfig: {
      findFirst: (...args: any[]) => mockIntegrationConfigFindFirst(...args),
      update: (...args: any[]) => mockIntegrationConfigUpdate(...args),
    },
  },
}));

import {
  invalidateUserMetaCache,
  requireAuth,
  requireRole,
  revokeAllUserSessions,
} from '@/lib/auth-helpers';
import { createUserAction, getUsers } from '@/app/actions/admin';
import { getItDetailData, toggleColaboradorTutor } from '@/app/actions/its';
import { getMessages } from '@/app/actions/mensagens';
import { GET as getComunicadoAnexo } from '@/app/api/comunicados/anexo/[id]/route';
import { GET as getDocumentalKen } from '@/app/api/documental/ken/route';
import { unpackLiveRecords } from '@/lib/connector/unpack-live';
import { produtividadeTenantCache } from '@/lib/bi-produtividade-cache';
import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';
import { sanitizeDocumentHtml } from '@/lib/security/html-sanitizer';
import { encryptConfig } from '@/lib/integration-crypto';
import { getEsperaData, isDemoSyntheticTenant } from '@/lib/espera/espera-service';
import nextConfig from '../../../next.config.mjs';

describe('Fase 3 (Pacotes 3.1 & 3.2) — Suíte Consolidada de Segurança Multi-Tenant, RBAC, Resiliência & Governança', () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockExecuteRawUnsafe.mockReset();
    mockUserFindUnique.mockReset();
    mockUserFindFirst.mockReset();
    mockTenantFindUnique.mockReset();
    mockConversaMembroFindFirst.mockReset();
    mockMensagemFindMany.mockReset();
    mockComunicadoAnexoFindFirst.mockReset();
    mockComunicadoCienciaFindFirst.mockReset();
    mockIntegrationConfigFindFirst.mockReset();
    mockIntegrationConfigUpdate.mockReset();
    mockSincronizarPedidosWebri.mockReset();
    mockDocumentAccess.mockReset();

    invalidateUserMetaCache();
    produtividadeTenantCache.clear();

    process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockTenantFindUnique.mockResolvedValue({ id: 'tenant-a' });
    mockIntegrationConfigUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    globalThis.fetch = originalFetch;
  });

  describe('1. Sessão Viva & Revogação Imediata em requireAuth()', () => {
    it('bloqueia imediatamente usuários inativos, excluídos ou com sessão revogada em modo produção', async () => {
      delete process.env.VITEST;
      (process.env as any).NODE_ENV = 'production';

      // A) Usuário desativado no banco (mesmo com JWT ainda dentro da validade)
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-inativo', role: 'COLABORADOR', tenantId: 'tenant-a', authAt: Date.now() },
      });
      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          role: 'COLABORADOR',
          status: 'inativo',
          tenantId: 'tenant-a',
          departamento: 'RI',
          cargo: 'Escrevente',
          revoked_before: null,
        },
      ]);

      await expect(requireAuth()).rejects.toThrow(/Conta desativada/);

      // B) Usuário excluído do banco
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-excluido', role: 'COLABORADOR', tenantId: 'tenant-a', authAt: Date.now() },
      });
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      await expect(requireAuth()).rejects.toThrow(/Usuário não encontrado ou removido/);

      // C) Sessão revogada explicitamente (ex.: rebaixamento de perfil ou troca de senha)
      const oldTokenIssuedAt = Date.now() - 10_000;
      await revokeAllUserSessions('u-revogado', {
        revokedBefore: new Date(Date.now() + 1_000),
        reason: 'role_downgrade',
      });
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-revogado', role: 'ADMIN', tenantId: 'tenant-a', authAt: oldTokenIssuedAt },
      });

      await expect(requireAuth()).rejects.toThrow(/Sessão encerrada ou credenciais atualizadas/);
    });

    it('impede troca forjada de tenantId na sessão para perfis não-MASTER', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-colab-a', role: 'COLABORADOR', tenantId: 'tenant-b-forjado' },
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u-colab-a',
        role: 'COLABORADOR',
        tenantId: 'tenant-a',
        departamento: 'Atendimento',
        cargo: 'Auxiliar',
      });

      const resolved = await requireAuth();
      expect(resolved.tenantId).toBe('tenant-a');
      expect(resolved.role).toBe('COLABORADOR');
    });
  });

  describe('2. Restrição Estrita de VISITANTE e Escalonamento Vertical em requireRole() / admin.ts', () => {
    it('bloqueia VISITANTE em requireRole() para todas as funções operacionais e administrativas', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'u-vis', role: 'VISITANTE', tenantId: 'tenant-a' },
      });
      mockUserFindUnique.mockResolvedValue({
        id: 'u-vis',
        role: 'VISITANTE',
        tenantId: 'tenant-a',
      });

      await expect(requireRole('COLABORADOR', 'USER', 'RH', 'ADMIN', 'MASTER')).rejects.toThrow(
        /Permissão insuficiente/
      );
      await expect(getUsers()).rejects.toThrow(/Permissão insuficiente/);
    });

    it('impede ADMIN comum de criar conta com perfil ADMIN (exclusivo MASTER)', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-admin-a', role: 'ADMIN', tenantId: 'tenant-a' },
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u-admin-a',
        role: 'ADMIN',
        tenantId: 'tenant-a',
      });

      const fd = new FormData();
      fd.set('name', 'Tentativa Escalada');
      fd.set('email', 'escalada@cartorio.com.br');
      fd.set('password', 'SenhaForte123');
      fd.set('role', 'ADMIN');

      const res = await createUserAction(fd);
      expect(res.error).toMatch(/Apenas o MASTER/i);
    });
  });

  describe('3. Isolamento Estrito Multi-Tenant (Tenant A vs Tenant B)', () => {
    it('admin.ts (getUsers) e its.ts (toggleColaboradorTutor / getItDetailData) escopam estritamente ao Tenant A', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'u-admin-a', role: 'ADMIN', tenantId: 'tenant-a' },
      });
      mockUserFindUnique.mockResolvedValue({
        id: 'u-admin-a',
        role: 'ADMIN',
        tenantId: 'tenant-a',
      });

      // admin.ts -> getUsers()
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      await getUsers();
      expect(mockQueryRawUnsafe).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE "tenantId" = $1'),
        'tenant-a'
      );

      // its.ts -> toggleColaboradorTutor tentando atingir ID de outro tenant
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      await toggleColaboradorTutor('user-from-tenant-b', true);
      expect(mockQueryRawUnsafe).toHaveBeenLastCalledWith(
        expect.stringContaining('WHERE id = $2 AND "tenantId" = $3'),
        true,
        'user-from-tenant-b',
        'tenant-a'
      );

      // its.ts -> getItDetailData para UUID pertencente ao Tenant B retorna null quando filtrado por tenant-a
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      const detail = await getItDetailData('11111111-2222-3333-4444-555555555555');
      expect(detail).toBeNull();
      const itSelectArgs = mockQueryRawUnsafe.mock.calls.at(-1)!;
      expect(String(itSelectArgs[0])).toContain('tenant_id');
      expect(itSelectArgs).toContain('tenant-a');
    });

    it('mensagens.ts (getMessages) bloqueia leitura cruzada de conversa de outro tenant', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: 'u-colab-a', role: 'COLABORADOR', tenantId: 'tenant-a' },
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u-colab-a',
        role: 'COLABORADOR',
        tenantId: 'tenant-a',
      });
      mockConversaMembroFindFirst.mockResolvedValueOnce(null);

      const res = await getMessages('conv-do-tenant-b');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Acesso negado/);
      expect(mockConversaMembroFindFirst).toHaveBeenCalledWith({
        where: {
          conversaId: 'conv-do-tenant-b',
          usuarioId: 'u-colab-a',
          tenantId: 'tenant-a',
        },
      });
      expect(mockMensagemFindMany).not.toHaveBeenCalled();
    });

    it('comunicados (/api/comunicados/anexo/[id]) bloqueia IDOR entre tenants (404) e destinatários não elegíveis (403)', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'u-colab-a', role: 'COLABORADOR', tenantId: 'tenant-a' },
      });
      mockUserFindUnique.mockResolvedValue({
        id: 'u-colab-a',
        role: 'COLABORADOR',
        tenantId: 'tenant-a',
      });

      // Tentativa de baixar anexo de Tenant B -> findFirst com tenantId='tenant-a' retorna null -> 404
      mockComunicadoAnexoFindFirst.mockResolvedValueOnce(null);
      const crossRes = await getComunicadoAnexo(
        new NextRequest('http://localhost/api/comunicados/anexo/anexo-tenant-b'),
        { params: { id: 'anexo-tenant-b' } }
      );
      expect(crossRes.status).toBe(404);
      expect(mockComunicadoAnexoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'anexo-tenant-b', tenantId: 'tenant-a' },
        })
      );

      // Comunicado do mesmo tenant, porém restrito ao setor 'CONTABILIDADE' enquanto usuário é 'ATENDIMENTO' -> 403
      mockComunicadoAnexoFindFirst.mockResolvedValueOnce({
        id: 'anexo-restrito',
        tenantId: 'tenant-a',
        storagePath: 'tenant-a/restrito.pdf',
        nomeArquivo: 'restrito.pdf',
        comunicado: {
          id: 'com-1',
          titulo: 'Restrito Contabilidade',
          status: 'PUBLICADO',
          destinatarios: ['CONTABILIDADE'],
        },
      });
      mockUserFindFirst.mockResolvedValueOnce({
        departamento: 'ATENDIMENTO',
        cargo: 'ESCREVENTE',
      });
      mockComunicadoCienciaFindFirst.mockResolvedValueOnce(null);

      const forbiddenRes = await getComunicadoAnexo(
        new NextRequest('http://localhost/api/comunicados/anexo/anexo-restrito'),
        { params: { id: 'anexo-restrito' } }
      );
      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('4. Resiliência de unpackLiveRecords, Invalidação de Cache e Deduplicação', () => {
    it('propaga erros de persistência em unpackLiveRecords sem engoli-los silenciosamente', async () => {
      mockQueryRawUnsafe.mockRejectedValueOnce(new Error('PG connection terminated unexpectedly'));

      await expect(
        unpackLiveRecords({
          tenantId: 'tenant-a',
          source: 'produtividade',
          records: [{ pedido: 101, data: '2026-11-12', quantidade: 1 }],
        })
      ).rejects.toThrow('PG connection terminated unexpectedly');
    });

    it('invalida produtividadeTenantCache apenas para o tenant sincronizado e preserva outros tenants', async () => {
      produtividadeTenantCache.set('tenant-a', [{ PEDIDO: '1' }]);
      produtividadeTenantCache.set('tenant-b', [{ PEDIDO: '2' }]);

      mockQueryRawUnsafe.mockResolvedValueOnce([{ inserted: 1, updated: 0 }]);
      const res = await unpackLiveRecords({
        tenantId: 'tenant-a',
        source: 'produtividade',
        records: [{ pedido: 200, data: '2026-11-12', quantidade: 1 }],
      });

      expect(res).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
      expect(produtividadeTenantCache.get('tenant-a')).toBeUndefined();
      expect(produtividadeTenantCache.get('tenant-b')).toEqual([{ PEDIDO: '2' }]);
    });

    it('repassa tenantId estrito e contagens deduplicadas em cartorio_virtual_certidoes', async () => {
      mockSincronizarPedidosWebri.mockResolvedValueOnce({
        inseridos: 2,
        atualizados: 1,
        inalterados: 1497,
      });

      const records = [{ NumeroPedido: 5001 }, { NumeroPedido: 5002 }];
      const out = await unpackLiveRecords({
        tenantId: 'tenant-a',
        source: 'cartorio_virtual_certidoes',
        records,
      });

      expect(mockSincronizarPedidosWebri).toHaveBeenCalledWith('tenant-a', records);
      expect(out).toEqual({ inserted: 2, updated: 1, unchanged: 1497 });
    });
  });

  describe('5. Prevenção de Path Traversal (/api/documental/ken) e XSS Documental', () => {
    it('rejeita acessos não autenticados (401) e tentativas de Path Traversal / caminhos absolutos (400)', async () => {
      const { DocumentAccessError } = await import('@/lib/documental/access');
      mockDocumentAccess.mockRejectedValueOnce(new DocumentAccessError(401, 'Não autenticado.'));

      const unauthRes = await getDocumentalKen(
        new Request('http://localhost/api/documental/ken?doc=100', {
          headers: { 'x-test-enforce-auth': '1' },
        })
      );
      expect(unauthRes.status).toBe(401);

      const traversalVectors = [
        'http://localhost/api/documental/ken?path=..\\..\\Windows\\win.ini',
        'http://localhost/api/documental/ken?doc=../../etc/passwd',
        'http://localhost/api/documental/ken?path=C:\\Windows\\System32\\drivers\\etc\\hosts',
        'http://localhost/api/documental/ken?path=\\\\SRVSQL\\c$\\secret.pdf',
      ];

      for (const url of traversalVectors) {
        const res = await getDocumentalKen(new Request(url));
        expect(res.status).toBe(400);
      }
    });

    it('neutraliza vetores XSS no preview HTML documental preservando formatação legítima', () => {
      const dirty =
        '<p>Matrícula <strong>45.120</strong></p><img src=x onerror="fetch(\'//evil\')"><script>alert(1)</script>';
      const sanitized = sanitizeDocumentHtml(dirty, '');
      expect(sanitized).toContain('<p>Matrícula <strong>45.120</strong></p>');
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onerror');
    });
  });

  describe('6. Pacote 3.2 (LOW-01, LOW-03, LOW-05, LOW-06) — Caches Bounded, Espera Real, CSP/SW & Higiene', () => {
    it('BoundedTtlMap aplica TTL, poda expirados antes de evicção e respeita ordem LRU', () => {
      const cache = new BoundedTtlMap<string, number>(2, 1_000);
      cache.set('k1', 1, 1_000, 100);
      cache.set('k2', 2, 1_000, 100);

      // Acessa k1 -> k1 vira MRU, k2 vira LRU
      expect(cache.get('k1', 200)).toBe(1);

      // Inserir k3 com capacidade 2 remove k2 (LRU), mantendo k1
      cache.set('k3', 3, 1_000, 300);
      expect(cache.get('k2', 350)).toBeUndefined();
      expect(cache.get('k1', 350)).toBe(1);
      expect(cache.get('k3', 350)).toBe(3);

      // Após TTL expirar (t = 1500), retorna undefined
      expect(cache.get('k1', 1500)).toBeUndefined();
      expect(cache.size).toBe(1);
    });

    it('LOW-03: getEsperaData nunca injeta senhas sintéticas em tenants reais com 0 ou poucos tickets', async () => {
      delete process.env.ESPERA_ALLOW_DEMO_SYNTHETIC;
      expect(isDemoSyntheticTenant('tenant-cartorio-real')).toBe(false);
      expect(isDemoSyntheticTenant('demo-sandbox')).toBe(true);

      const enc = encryptConfig({
        apiUrl: 'https://api.nextqs.com/v1',
        apiKey: 'mock-nextqs-key',
        orgId: 'site-1',
      });

      mockIntegrationConfigFindFirst.mockResolvedValue({
        id: 'cfg-1',
        tenantId: 'tenant-cartorio-real',
        integrationId: 'nextqs',
        encryptedConfig: enc.encrypted,
        configIv: enc.iv,
        slaMinutes: 15,
        status: 'CONNECTED',
        lastSyncAt: null,
      });

      // Mock NextQS retornando 0 senhas em dia útil passado (ex.: feriado municipal)
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/organization/sites')) {
          return new Response(JSON.stringify([{ _id: 'site-1', label: '7º RI SP' }]), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as any;

      const realRes = await getEsperaData('tenant-cartorio-real', '2026-11-10', true);
      expect(realRes.configured).toBe(true);
      expect(realRes.records).toHaveLength(0);
      expect(realRes.dataSource).toBe('REAL_CONNECTOR');
    });

    it('LOW-05 & LOW-06: next.config.mjs, public/sw.js, unpackStaging.ts e árvore Git cumprem governança', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(nextConfig.poweredByHeader).toBe(false);
      const headersConfig = await nextConfig.headers!();
      const globalHeaders = headersConfig.find((h) => h.source === '/(.*)')?.headers || [];
      const csp = globalHeaders.find((h) => h.key === 'Content-Security-Policy')?.value || '';

      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).not.toContain('uvieekfizuzujpwfbjww.supabase.co');

      const repoRoot = path.resolve(__dirname, '../../..');
      const nextConfigSrc = fs.readFileSync(path.join(repoRoot, 'next.config.mjs'), 'utf8');
      expect(nextConfigSrc).not.toContain('uvieekfizuzujpwfbjww.supabase.co');
      const swContent = fs.readFileSync(path.join(repoRoot, 'public/sw.js'), 'utf8');
      expect(swContent).toContain('FIORIX_LOGOUT_CLEANUP');
      expect(swContent).toContain('isAuthenticatedSameOriginClient');
      expect(swContent).toContain('sanitizeInternalRelativeUrl');

      const unpackStagingSrc = fs.readFileSync(
        path.join(repoRoot, 'src/scripts/unpackStaging.ts'),
        'utf8'
      );
      expect(unpackStagingSrc).not.toContain("tenant_id = '${TENANT_ID}'");
      expect(unpackStagingSrc).not.toContain('cms3xd0wm00002pw9j2k0ahan');
      expect(unpackStagingSrc).toContain('DELETE FROM public.fiorix_bi_data WHERE import_id = $1 AND tenant_id = $2');

      // Verifica remoção dos arquivos duplicados obsoletos *(1)* do código-fonte
      expect(fs.existsSync(path.join(repoRoot, 'src/lib/prisma (1).ts'))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'src/lib/google (1).ts'))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'src/app/globals (1).css'))).toBe(false);
      expect(fs.existsSync(path.join(repoRoot, 'package (1).json'))).toBe(false);
    });
  });
});
