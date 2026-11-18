import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuth = vi.fn();
const mockUserFindUnique = vi.fn();
const mockIsSameOriginRequest = vi.fn();
const mockRecordAuditLog = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: (...args: unknown[]) => mockIsSameOriginRequest(...args),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

import {
  GOVERNANCE_BOUNDARIES_7RI,
  OFFICIAL_INFRA_MEMORIAL_ENTRIES,
  SERVERS_TOPOLOGY_7RI,
} from '@/lib/memorial-infraestrutura/catalog';
import {
  containsSensitiveSecretPattern,
  resetMemorialInfraMemoryStoreForTests,
} from '@/lib/memorial-infraestrutura/store';
import {
  ALL_NAV_CATALOG_ITEMS,
  ITEM_BY_HREF,
  ITEM_BY_ID,
  checkStructuralRestriction,
} from '@/lib/nav-permissions/catalog';
import { evaluateRouteAccessFromAllowedIds } from '@/lib/nav-permissions/evaluator';
import { filterNavigationByRole } from '@/lib/navigation/permissions';
import { navigationGroups } from '@/components/fiorix/navigation';
import { DELETE, GET, POST, PUT } from '@/app/api/master/memorial-infraestrutura/route';

const BASE_PAYLOAD = {
  server: 'SRVFILES' as const,
  category: 'PERFORMANCE' as const,
  status: 'ATIVO' as const,
  title: 'Ajuste adicional de prioridade em rotina de backup noturno',
  implementedAt: '2026-11-18',
  connectorVersion: 'v2.6.23',
  impactBadge: '-25% latência disco',
  summarySimple: 'Limitamos a leitura simultânea da janela de cópia noturna para evitar disputa no volume D:.',
  metricBefore: 'Fila de disco acima de 40 ms durante varredura',
  metricAfter: 'Fila de disco abaixo de 8 ms',
  problemBefore: 'Concorrência de leitura simultânea entre backup e SMB.',
  solutionApplied: 'Escalonamento da janela para horário de baixa demanda.',
  technicalDetails: 'Configuração aplicada via Agendador de Tarefas sem alterar scripts da serventia.',
  commandsSnippet: 'Get-ScheduledTask -TaskName "FIORIX_Governor_*" | Select-Object TaskName, State',
  rollbackPlan: 'Remover a restrição de horário no Agendador.',
};

describe('Memorial dos Servidores 7º RI — Catálogo, Isolamento MASTER e CRUD Seguro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemorialInfraMemoryStoreForTests();
    mockIsSameOriginRequest.mockReturnValue(true);
    mockRecordAuditLog.mockResolvedValue(undefined);
  });

  it('documenta os 3 servidores (SRVSQL, SRVFILES, SRVSIPLANIA), v2.6.23, CPU 33,6% e não expõe segredos', () => {
    expect(SERVERS_TOPOLOGY_7RI.map((s) => s.key)).toEqual(['SRVSQL', 'SRVFILES', 'SRVSIPLANIA']);
    expect(GOVERNANCE_BOUNDARIES_7RI.length).toBeGreaterThanOrEqual(4);
    expect(OFFICIAL_INFRA_MEMORIAL_ENTRIES.length).toBeGreaterThanOrEqual(12);

    const serversCovered = new Set(OFFICIAL_INFRA_MEMORIAL_ENTRIES.map((e) => e.server));
    expect(serversCovered.has('SRVSQL')).toBe(true);
    expect(serversCovered.has('SRVFILES')).toBe(true);
    expect(serversCovered.has('SRVSIPLANIA')).toBe(true);

    const allTexts = JSON.stringify(OFFICIAL_INFRA_MEMORIAL_ENTRIES);
    expect(allTexts).toContain('v2.6.23');
    expect(allTexts).toContain('33,6%');

    for (const entry of OFFICIAL_INFRA_MEMORIAL_ENTRIES) {
      expect(containsSensitiveSecretPattern(entry.summarySimple)).toBe(false);
      expect(containsSensitiveSecretPattern(entry.technicalDetails)).toBe(false);
      expect(containsSensitiveSecretPattern(entry.commandsSnippet)).toBe(false);
    }
  });

  it('isola totalmente o item e a rota /master/memorial-infraestrutura para o perfil MASTER', () => {
    const catItem = ITEM_BY_ID.get('memorial_infraestrutura_7ri');
    expect(catItem).toBeDefined();
    expect(catItem?.isMasterOnly).toBe(true);
    expect(catItem?.groupId).toBe('sistema');
    expect(ITEM_BY_HREF.get('/master/memorial-infraestrutura')?.id).toBe(
      'memorial_infraestrutura_7ri',
    );

    const navItem = navigationGroups.sistema.items.find(
      (i) => i.id === 'memorial_infraestrutura_7ri',
    );
    expect(navItem?.href).toBe('/master/memorial-infraestrutura');

    expect(checkStructuralRestriction(catItem!, 'MASTER').isBlocked).toBe(false);
    for (const role of ['ADMIN', 'SUBSTITUTO', 'VISITANTE', 'RH', 'USER', 'COLABORADOR']) {
      expect(checkStructuralRestriction(catItem!, role).isBlocked).toBe(true);
    }

    const legacyAdmin = filterNavigationByRole('ADMIN');
    expect(
      legacyAdmin.sistema?.items.some((i) => i.id === 'memorial_infraestrutura_7ri'),
    ).toBe(false);

    const legacyMaster = filterNavigationByRole('MASTER');
    expect(
      legacyMaster.sistema?.items.some((i) => i.id === 'memorial_infraestrutura_7ri'),
    ).toBe(true);

    // Mesmo que um cliente envie o ID na lista dinâmica, ADMIN nunca recebe item isMasterOnly
    const dynAdmin = filterNavigationByRole('ADMIN', ['memorial_infraestrutura_7ri', 'briefing_matinal']);
    expect(
      dynAdmin.sistema?.items.some((i) => i.id === 'memorial_infraestrutura_7ri'),
    ).toBe(false);

    const dynMaster = filterNavigationByRole('MASTER', ['memorial_infraestrutura_7ri', 'briefing_matinal']);
    expect(
      dynMaster.sistema?.items.some((i) => i.id === 'memorial_infraestrutura_7ri'),
    ).toBe(true);

    const adminRouteEval = evaluateRouteAccessFromAllowedIds({
      pathname: '/master/memorial-infraestrutura',
      role: 'ADMIN',
      enabled: true,
      allowedItemIds: ALL_NAV_CATALOG_ITEMS.map((i) => i.id),
    });
    expect(adminRouteEval.allowed).toBe(false);

    const masterRouteEval = evaluateRouteAccessFromAllowedIds({
      pathname: '/master/memorial-infraestrutura',
      role: 'MASTER',
      enabled: true,
      allowedItemIds: ['memorial_infraestrutura_7ri'],
    });
    expect(masterRouteEval.allowed).toBe(true);
  });

  it('bloqueia não autenticados (401), não-MASTER (403) e cross-origin (403) na API', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('Não autorizado'));
    const unauthRes = await GET();
    expect(unauthRes.status).toBe(401);

    mockRequireAuth.mockResolvedValueOnce({
      id: 'user-admin',
      role: 'ADMIN',
      tenantId: 'tenant-1',
    });
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-admin',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      name: 'Admin Local',
      email: 'admin@cartorio.br',
    });
    const adminGetRes = await GET();
    expect(adminGetRes.status).toBe(403);

    mockIsSameOriginRequest.mockReturnValueOnce(false);
    const crossOriginReq = new NextRequest('https://fiorix.app/api/master/memorial-infraestrutura', {
      method: 'POST',
      body: JSON.stringify(BASE_PAYLOAD),
    });
    const crossOriginRes = await POST(crossOriginReq);
    expect(crossOriginRes.status).toBe(403);
  });

  it('rejeita credenciais sensíveis, protege registros oficiais e executa CRUD completo para MASTER', async () => {
    mockRequireAuth.mockResolvedValue({
      id: 'user-master',
      role: 'MASTER',
      tenantId: 'tenant-7ri',
    });
    mockUserFindUnique.mockResolvedValue({
      id: 'user-master',
      role: 'MASTER',
      tenantId: 'tenant-7ri',
      name: 'Henrique Master',
      email: 'master@fiorix.app',
    });

    // 1. Rejeita tentativa de salvar senha literal
    const secretReq = new NextRequest('https://fiorix.app/api/master/memorial-infraestrutura', {
      method: 'POST',
      body: JSON.stringify({
        ...BASE_PAYLOAD,
        commandsSnippet: 'SQL_SERVER_PASSWORD=MinhaSenhaSuperSecreta123',
      }),
    });
    const secretRes = await POST(secretReq);
    expect(secretRes.status).toBe(400);

    // 2. Cria nova melhoria (201)
    const createReq = new NextRequest('https://fiorix.app/api/master/memorial-infraestrutura', {
      method: 'POST',
      body: JSON.stringify(BASE_PAYLOAD),
    });
    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as { entry: { id: string; source: string } };
    expect(createdJson.entry.id).toMatch(/^master-/);
    expect(createdJson.entry.source).toBe('REGISTRO_MASTER');
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'MEMORIAL_INFRAESTRUTURA',
        acao: 'INCLUSAO',
      }),
    );

    // 3. Lista snapshot com registro customizado incluído (200)
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const snapshotJson = (await getRes.json()) as {
      dbPersistedCount: number;
      entries: Array<{ id: string; title: string }>;
    };
    expect(snapshotJson.dbPersistedCount).toBe(1);
    expect(snapshotJson.entries.some((e) => e.id === createdJson.entry.id)).toBe(true);

    // 4. Atualiza registro customizado (200)
    const putReq = new NextRequest('https://fiorix.app/api/master/memorial-infraestrutura', {
      method: 'PUT',
      body: JSON.stringify({
        id: createdJson.entry.id,
        data: { ...BASE_PAYLOAD, title: 'Título atualizado pelo MASTER em auditoria' },
      }),
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);
    const putJson = (await putRes.json()) as { entry: { title: string } };
    expect(putJson.entry.title).toBe('Título atualizado pelo MASTER em auditoria');

    // 5. Bloqueia exclusão de entrada oficial do código (400)
    const delOfficialReq = new NextRequest(
      `https://fiorix.app/api/master/memorial-infraestrutura?id=${encodeURIComponent(
        OFFICIAL_INFRA_MEMORIAL_ENTRIES[0].id,
      )}`,
      { method: 'DELETE' },
    );
    const delOfficialRes = await DELETE(delOfficialReq);
    expect(delOfficialRes.status).toBe(400);

    // 6. Exclui registro customizado criado (200)
    const delReq = new NextRequest(
      `https://fiorix.app/api/master/memorial-infraestrutura?id=${encodeURIComponent(
        createdJson.entry.id,
      )}`,
      { method: 'DELETE' },
    );
    const delRes = await DELETE(delReq);
    expect(delRes.status).toBe(200);
  });

  it('evita tag <header> na página e mantém regras permanentes AGENTS.md e .agents/rules ativas', () => {
    const pageSrc = readFileSync(
      path.resolve(process.cwd(), 'src/app/(dashboard)/master/memorial-infraestrutura/page.tsx'),
      'utf8',
    );
    expect(pageSrc).not.toContain('<header');
    expect(pageSrc).toContain('MEMORIAL DOS SERVIDORES');
    expect(pageSrc).toContain("dbUser.role !== 'MASTER'");

    const rootAgents = readFileSync(path.resolve(process.cwd(), '../AGENTS.md'), 'utf8');
    const repoAgents = readFileSync(path.resolve(process.cwd(), 'AGENTS.md'), 'utf8');
    const ruleFile = readFileSync(
      path.resolve(process.cwd(), '.agents/rules/memorial-infraestrutura-7ri.md'),
      'utf8',
    );
    expect(rootAgents).toContain('src/lib/memorial-infraestrutura/catalog.ts');
    expect(repoAgents).toContain('src/lib/memorial-infraestrutura/catalog.ts');
    expect(ruleFile).toContain('src/lib/memorial-infraestrutura/catalog.ts');
    expect(ruleFile).toContain('always_on');
  });
});
