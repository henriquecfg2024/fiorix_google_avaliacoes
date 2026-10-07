import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (cb: any) => cb({
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    })),
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u1', role: 'USER', tenantId: 'tenant-123' }),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant-123' }),
    },
  },
}));
import {
  NAV_CATALOG_GROUPS,
  ALL_NAV_CATALOG_ITEMS,
  ITEM_BY_ID,
  ITEM_BY_HREF,
  EDITABLE_ROLES,
  checkStructuralRestriction,
} from '@/lib/nav-permissions/catalog';
import {
  computeNavPermissionsState,
  isItemVisibleInLegacy,
  isNavPermissionsFeatureEnabled,
  saveNavPermissionsBatch,
  NAV_PERMISSIONS_FLAG,
} from '@/lib/nav-permissions/service';
import { navigationGroups } from '@/components/fiorix/navigation';

describe('FIORIX — Permissões de Menu V2 (Catálogo e Estrutura)', () => {
  it('garante que todos os itens de navegação do catálogo têm IDs únicos e estáveis', () => {
    const ids = new Set<string>();
    for (const item of ALL_NAV_CATALOG_ITEMS) {
      expect(item.id).toBeDefined();
      expect(item.id.trim()).not.toBe('');
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(18);
  });

  it('garante que todos os itens em navigation.ts possuem id correspondente no catálogo', () => {
    for (const [groupKey, group] of Object.entries(navigationGroups)) {
      for (const item of group.items) {
        expect((item as any).id).toBeDefined();
        const catalogItem = ITEM_BY_ID.get((item as any).id);
        expect(catalogItem).toBeDefined();
        expect(catalogItem?.href).toBe(item.href);
      }
    }
  });

  it('valida os 5 perfis editáveis sem inventar novos papéis', () => {
    const roles = EDITABLE_ROLES.map((r) => r.role);
    expect(roles).toEqual(['ADMIN', 'SUBSTITUTO', 'RH', 'USER', 'COLABORADOR']);
    expect(roles).not.toContain('MASTER');
    expect(roles).not.toContain('GESTOR');
    expect(roles).not.toContain('DIRETORIA');
  });

  it('identifica rotas compartilhadas corretamente', () => {
    const comunicados = ITEM_BY_ID.get('gestao_comunicados');
    const pessoas = ITEM_BY_ID.get('gestao_pessoas');

    expect(comunicados?.sharedWithId).toBe('gestao_pessoas');
    expect(pessoas?.sharedWithId).toBe('gestao_comunicados');
  });
});

describe('FIORIX — Guardas Estruturais e Bloqueio pelo Sistema', () => {
  it('impede concessão de Central de Operações para USER, RH ou COLABORADOR', () => {
    const central = ITEM_BY_ID.get('central_operacoes')!;
    expect(checkStructuralRestriction(central, 'ADMIN').isBlocked).toBe(false);
    expect(checkStructuralRestriction(central, 'MASTER').isBlocked).toBe(false);

    const userCheck = checkStructuralRestriction(central, 'USER');
    expect(userCheck.isBlocked).toBe(true);
    expect(userCheck.reason).toContain('Bloqueado pelo sistema');

    const rhCheck = checkStructuralRestriction(central, 'RH');
    expect(rhCheck.isBlocked).toBe(true);

    const colabCheck = checkStructuralRestriction(central, 'COLABORADOR');
    expect(colabCheck.isBlocked).toBe(true);
  });

  it('permite Gestão de ITs apenas para MASTER, ADMIN e SUBSTITUTO', () => {
    const its = ITEM_BY_ID.get('gestao_its')!;
    expect(checkStructuralRestriction(its, 'MASTER').isBlocked).toBe(false);
    expect(checkStructuralRestriction(its, 'ADMIN').isBlocked).toBe(false);
    expect(checkStructuralRestriction(its, 'SUBSTITUTO').isBlocked).toBe(false);

    expect(checkStructuralRestriction(its, 'USER').isBlocked).toBe(true);
    expect(checkStructuralRestriction(its, 'RH').isBlocked).toBe(true);
    expect(checkStructuralRestriction(its, 'COLABORADOR').isBlocked).toBe(true);
  });

  it('bloqueia itens Master SaaS para qualquer usuário não-MASTER', () => {
    const masterTenants = ITEM_BY_ID.get('cartorios_tenants')!;
    expect(checkStructuralRestriction(masterTenants, 'MASTER').isBlocked).toBe(false);
    expect(checkStructuralRestriction(masterTenants, 'ADMIN').isBlocked).toBe(true);
    expect(checkStructuralRestriction(masterTenants, 'USER').isBlocked).toBe(true);
  });
});

describe('FIORIX — Precedência e Herança', () => {
  it('legado: Colaborador acessa Meu Espaço (Férias e Holerites) e rotinas permitidas', () => {
    const ferias = ITEM_BY_ID.get('ferias')!;
    const holerites = ITEM_BY_ID.get('holerites')!;
    const central = ITEM_BY_ID.get('central_operacoes')!;

    expect(isItemVisibleInLegacy(ferias, 'COLABORADOR')).toBe(true);
    expect(isItemVisibleInLegacy(holerites, 'COLABORADOR')).toBe(true);
    expect(isItemVisibleInLegacy(central, 'COLABORADOR')).toBe(false);
  });

  it('feature flag: desativada por padrão preserva comportamento legado', () => {
    expect(isNavPermissionsFeatureEnabled({ FEATURE_NAV_PERMISSIONS_V1_ENABLED: 'false' })).toBe(false);
    expect(isNavPermissionsFeatureEnabled({})).toBe(false);
    expect(isNavPermissionsFeatureEnabled({ FEATURE_NAV_PERMISSIONS_V1_ENABLED: 'true' })).toBe(true);
  });
});

describe('FIORIX — Exclusividade MASTER e Validações no Servidor', () => {
  it('rejeita tentativa de salvar por não-MASTER (ADMIN, USER, RH)', async () => {
    await expect(
      saveNavPermissionsBatch({
        tenantId: 'tenant-123',
        targetType: 'PERFIL',
        targetId: 'ADMIN',
        changes: [{ itemId: 'avaliacoes', action: 'ALLOW' }],
        masterUser: { id: 'admin-1', role: 'ADMIN' },
      })
    ).rejects.toThrow('Acesso negado: somente o MASTER pode alterar permissões de menu.');
  });

  it('rejeita tentativa de editar conta com perfil MASTER', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'master-user-id',
      role: 'MASTER',
      tenantId: 'tenant-123',
    } as any);

    await expect(
      saveNavPermissionsBatch({
        tenantId: 'tenant-123',
        targetType: 'COLABORADOR',
        targetId: 'master-user-id',
        changes: [{ itemId: 'avaliacoes', action: 'DENY' }],
        masterUser: { id: 'super-master', role: 'MASTER' },
      })
    ).rejects.toThrow('Contas com papel MASTER não podem ter permissões editadas.');
  });

  it('rejeita tentativa de editar usuário pertencente a outra organização', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'foreign-user-id',
      role: 'USER',
      tenantId: 'outro-cartorio-456',
    } as any);

    await expect(
      saveNavPermissionsBatch({
        tenantId: 'tenant-123',
        targetType: 'COLABORADOR',
        targetId: 'foreign-user-id',
        changes: [{ itemId: 'avaliacoes', action: 'ALLOW' }],
        masterUser: { id: 'super-master', role: 'MASTER' },
      })
    ).rejects.toThrow('Usuário alvo inválido ou pertencente a outra organização.');
  });

  it('sincroniza itens com rota compartilhada durante o salvamento', async () => {
    const { prisma } = await import('@/lib/prisma');
    const executeSpy = vi.fn().mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({ $executeRawUnsafe: executeSpy });
    });

    const result = await saveNavPermissionsBatch({
      tenantId: 'tenant-123',
      targetType: 'PERFIL',
      targetId: 'ADMIN',
      changes: [{ itemId: 'gestao_comunicados', action: 'ALLOW' }],
      masterUser: { id: 'super-master', role: 'MASTER' },
    });

    expect(result.success).toBe(true);
    // Deve ter atualizado 2 itens (gestao_comunicados e gestao_pessoas sincronizado)
    expect(result.updatedCount).toBe(2);
  });

  it('quando SUBSTITUTO tem PRESENCA NO GOOGLE desativado, o grupo some da navegacao e a rota e bloqueada', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { getAllowedNavItemsForUser, isRouteAllowedForUser } = await import('@/lib/nav-permissions/service');
    const { filterNavigationByRole } = await import('@/lib/navigation/permissions');

    // Liga a flag para o teste
    process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED = 'true';

    // Mock das regras de perfil do banco retornando avaliacoes, estatisticas e relatorios como false
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      { item_id: 'avaliacoes', visible: false },
      { item_id: 'estatisticas', visible: false },
      { item_id: 'relatorios', visible: false },
    ] as any);
    // Mock das regras individuais vazias
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([]);

    const user = { id: 'user-sonia', role: 'SUBSTITUTO', tenantId: 'tenant-123' };
    const navPermissions = await getAllowedNavItemsForUser(user);

    expect(navPermissions.enabled).toBe(true);
    expect(navPermissions.allowedItemIds).not.toContain('avaliacoes');
    expect(navPermissions.allowedItemIds).not.toContain('estatisticas');
    expect(navPermissions.allowedItemIds).not.toContain('relatorios');

    // Filtra os grupos da Sidebar usando os IDs permitidos
    const filteredSidebar = filterNavigationByRole(user.role, navPermissions.allowedItemIds);
    expect(filteredSidebar.gestao).toBeUndefined(); // PRESENÇA NO GOOGLE totalmente removido!

    // Mock de verificação de rota direta
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([]); // user rules
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      { item_id: 'avaliacoes', visible: false },
    ] as any); // role rules

    const isAllowed = await isRouteAllowedForUser('/avaliacoes', user);
    expect(isAllowed).toBe(false); // Acesso direto a /avaliacoes bloqueado!

    // Restaura flag
    delete process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED;
  });
});

describe('FIORIX — Integridade das Migrations Preparadas V2', () => {
  it('verifica que o arquivo de migration v2 existe e contém definições de role e user rules', () => {
    const migPath = path.resolve(
      __dirname,
      '../supabase/prepared-migrations/20261007180000_fiorix_nav_permissions_v2.sql'
    );
    expect(fs.existsSync(migPath)).toBe(true);

    const sql = fs.readFileSync(migPath, 'utf-8');
    expect(sql).toContain('fiorix_nav_role_rules');
    expect(sql).toContain('fiorix_nav_user_rules');
    expect(sql).toContain('trg_check_nav_user_rule_tenant');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.fiorix_nav_role_rules FROM PUBLIC');
  });

  it('verifica que o arquivo de rollback v2 existe e realiza a limpeza segura', () => {
    const rollbackPath = path.resolve(
      __dirname,
      '../supabase/prepared-migrations/20261007180000_fiorix_nav_permissions_v2_rollback.sql'
    );
    expect(fs.existsSync(rollbackPath)).toBe(true);

    const sql = fs.readFileSync(rollbackPath, 'utf-8');
    expect(sql).toContain('DROP TABLE IF EXISTS public.fiorix_nav_user_rules CASCADE;');
    expect(sql).toContain('DROP TABLE IF EXISTS public.fiorix_nav_role_rules CASCADE;');
  });
});
