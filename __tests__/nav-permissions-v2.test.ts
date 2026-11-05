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

  it('valida os 6 perfis editáveis (incluindo VISITANTE) sem expor MASTER', () => {
    const roles = EDITABLE_ROLES.map((r) => r.role);
    expect(roles).toEqual(['ADMIN', 'SUBSTITUTO', 'VISITANTE', 'RH', 'USER', 'COLABORADOR']);
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

describe('FIORIX — Gestão Documental liberada para todos os grupos via Permissões de Menu', () => {
  it('não bloqueia Manifestações nem Visualizador por guarda estrutural em nenhum perfil do sistema', () => {
    const manifestacoes = ITEM_BY_ID.get('gestao_documental')!;
    const visualizador = ITEM_BY_ID.get('visualizador_documental')!;

    for (const role of ['MASTER', 'ADMIN', 'SUBSTITUTO', 'VISITANTE', 'RH', 'USER', 'COLABORADOR']) {
      expect(checkStructuralRestriction(manifestacoes, role).isBlocked).toBe(false);
      expect(checkStructuralRestriction(visualizador, role).isBlocked).toBe(false);
    }
  });

  it('permite ativar Gestão Documental para USER (ex.: Cristiane Falanga / Ligação Judicial), COLABORADOR e RH e exibe na Sidebar', async () => {
    const { prisma } = await import('@/lib/prisma');
    const {
      getAllowedNavItemsForUser,
      getFirstAllowedRouteForUser,
      isRouteAllowedForUser,
      saveNavPermissionsBatch,
    } = await import('@/lib/nav-permissions/service');
    const { filterNavigationByRole } = await import('@/lib/navigation/permissions');

    process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED = 'true';

    // MASTER consegue salvar ALLOW para USER sem erro de bloqueio pelo sistema
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-falanga',
      role: 'USER',
      tenantId: 'tenant-123',
    } as any);

    const saveRes = await saveNavPermissionsBatch({
      tenantId: 'tenant-123',
      targetType: 'COLABORADOR',
      targetId: 'user-falanga',
      targetRoleForUser: 'USER',
      changes: [
        { itemId: 'gestao_documental', action: 'ALLOW' },
        { itemId: 'visualizador_documental', action: 'ALLOW' },
      ],
      masterUser: { id: 'super-master', role: 'MASTER' },
    });
    expect(saveRes.success).toBe(true);
    expect(saveRes.updatedCount).toBe(2);

    // Usuário USER com todos os outros menus desativados e apenas Gestão Documental ativada
    const falangaRules = [
      { item_id: 'inicio', override: 'DENY' },
      { item_id: 'gestao_documental', override: 'ALLOW' },
      { item_id: 'visualizador_documental', override: 'ALLOW' },
      { item_id: 'avaliacoes', override: 'DENY' },
      { item_id: 'estatisticas', override: 'DENY' },
      { item_id: 'relatorios', override: 'DENY' },
      { item_id: 'recepcao', override: 'DENY' },
      { item_id: 'prazos', override: 'DENY' },
      { item_id: 'tarefas', override: 'DENY' },
      { item_id: 'metas', override: 'DENY' },
      { item_id: 'retornos', override: 'DENY' },
      { item_id: 'qualidade', override: 'DENY' },
      { item_id: 'impressoes', override: 'DENY' },
      { item_id: 'rastreio', override: 'DENY' },
      { item_id: 'mensagens', override: 'DENY' },
      { item_id: 'comunicados', override: 'DENY' },
      { item_id: 'minha_it', override: 'DENY' },
      { item_id: 'ferias', override: 'DENY' },
      { item_id: 'holerites', override: 'DENY' },
    ];

    const falanga = {
      id: 'user-falanga',
      role: 'USER',
      tenantId: 'tenant-123',
      departamento: 'LIGAÇÃO JUDICIAL',
    };

    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as any) // roleRules
      .mockResolvedValueOnce(falangaRules as any) // userRules
      .mockResolvedValueOnce([] as any); // deptRules

    const nav = await getAllowedNavItemsForUser(falanga);
    expect(nav.allowedItemIds).toEqual(['gestao_documental', 'visualizador_documental']);

    // Sidebar exibe o grupo GESTÃO DOCUMENTAL mesmo para role USER ou COLABORADOR
    const sidebarGroups = filterNavigationByRole('USER', nav.allowedItemIds);
    expect(Object.keys(sidebarGroups)).toEqual(['documental']);
    expect(sidebarGroups.documental.items.map((i: any) => i.href)).toEqual([
      '/gestao-documental',
      '/gestao-documental/visualizador',
    ]);

    const colabSidebar = filterNavigationByRole('COLABORADOR', ['gestao_documental']);
    expect(Object.keys(colabSidebar)).toEqual(['documental']);

    // Acesso direto às rotas /gestao-documental, /gestao-documental/historico e /gestao-documental/visualizador liberado
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(falangaRules as any);
    expect(await isRouteAllowedForUser('/gestao-documental', falanga)).toBe(true);

    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(falangaRules as any);
    expect(await isRouteAllowedForUser('/gestao-documental/historico', falanga)).toBe(true);

    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(falangaRules as any);
    expect(await isRouteAllowedForUser('/gestao-documental/visualizador', falanga)).toBe(true);

    // Rota inicial resolve direto para /gestao-documental
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce(falangaRules as any)
      .mockResolvedValueOnce([] as any);
    expect(await getFirstAllowedRouteForUser(falanga)).toBe('/gestao-documental');

    delete process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED;
  });
});

describe('FIORIX — Visibilidade de cards em Minha Conta (/minha-conta)', () => {
  it('exibe Segurança & Dispositivos Conectados apenas para MASTER e ADMIN, e Notificações & Privacidade apenas para quem tem Mensagens ativo', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { resolveMinhaContaVisibility } = await import('@/lib/usuarios/minhaContaVisibility');

    process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED = 'true';

    // 1. MASTER e ADMIN visualizam ambos os cards
    expect(await resolveMinhaContaVisibility({ id: 'm1', role: 'MASTER', tenantId: 'tenant-123' })).toEqual({
      showConfiguracoesLink: true,
      showNotificacoesPrivacidade: true,
      showSegurancaDispositivos: true,
    });
    expect(await resolveMinhaContaVisibility({ id: 'a1', role: 'ADMIN', tenantId: 'tenant-123' })).toEqual({
      showConfiguracoesLink: true,
      showNotificacoesPrivacidade: true,
      showSegurancaDispositivos: true,
    });

    // 2. USER com Mensagens ativo vê Notificações & Privacidade, mas NÃO vê Segurança & Dispositivos Conectados
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ item_id: 'mensagens', override: 'ALLOW' }] as any) // /mensagens -> userRules
      .mockResolvedValueOnce([] as any) // /configuracoes -> userRules
      .mockResolvedValueOnce([] as any); // /configuracoes -> roleRules
    expect(
      await resolveMinhaContaVisibility({ id: 'u-msg', role: 'USER', tenantId: 'tenant-123' })
    ).toEqual({
      showConfiguracoesLink: false,
      showNotificacoesPrivacidade: true,
      showSegurancaDispositivos: false,
    });

    // 3. USER (ex.: Cristiane Falanga) ou COLABORADOR (ex.: Sara) com Mensagens desativado NÃO vê nenhum dos dois cards
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ item_id: 'mensagens', override: 'DENY' }] as any) // /mensagens -> userRules
      .mockResolvedValueOnce([] as any) // /configuracoes -> userRules
      .mockResolvedValueOnce([] as any) // /configuracoes -> deptRules
      .mockResolvedValueOnce([] as any); // /configuracoes -> roleRules
    expect(
      await resolveMinhaContaVisibility({
        id: 'u-falanga',
        role: 'USER',
        tenantId: 'tenant-123',
        departamento: 'LIGAÇÃO JUDICIAL',
      })
    ).toEqual({
      showConfiguracoesLink: false,
      showNotificacoesPrivacidade: false,
      showSegurancaDispositivos: false,
    });

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

describe('FIORIX — Duplo Fator (2FA) por Usuário para Todas as Funções', () => {
  it('permite ativar e desativar 2FA em qualquer função não-MASTER e preserva MASTER sempre protegido', async () => {
    const { userRequires2FA } = await import('@/lib/totp');

    expect(userRequires2FA({ role: 'MASTER', totpRequired: false, totpEnabled: false })).toBe(true);

    for (const role of ['ADMIN', 'SUBSTITUTO', 'VISITANTE', 'RH', 'USER', 'COLABORADOR']) {
      expect(userRequires2FA({ role, totpRequired: false, totpEnabled: false })).toBe(false);
      expect(userRequires2FA({ role, totpRequired: true, totpEnabled: false })).toBe(true);
      expect(userRequires2FA({ role, totpRequired: false, totpEnabled: true })).toBe(true);
    }
  });
});


describe('FIORIX — Permissões de Menu por Departamento (Precedência Colaborador > Departamento > Perfil > Legado)', () => {
  it('salva regras no modo DEPARTAMENTO somente quando acionado por MASTER e valida departamento vazio', async () => {
    await expect(
      saveNavPermissionsBatch({
        tenantId: 'tenant-123',
        targetType: 'DEPARTAMENTO',
        targetId: '   ',
        changes: [{ itemId: 'avaliacoes', action: 'ALLOW' }],
        masterUser: { id: 'super-master', role: 'MASTER' },
      })
    ).rejects.toThrow('Departamento alvo inválido.');

    const { prisma } = await import('@/lib/prisma');
    const executeSpy = vi.fn().mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({ $executeRawUnsafe: executeSpy });
    });

    const res = await saveNavPermissionsBatch({
      tenantId: 'tenant-123',
      targetType: 'DEPARTAMENTO',
      targetId: 'Qualificação',
      changes: [{ itemId: 'qualidade', action: 'ALLOW' }],
      masterUser: { id: 'super-master', role: 'MASTER' },
    });

    expect(res.success).toBe(true);
    expect(res.updatedCount).toBe(1);
    expect(executeSpy).toHaveBeenCalled();
  });

  it('aplica precedência Colaborador > Departamento > Perfil em getAllowedNavItemsForUser e isRouteAllowedForUser', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { getAllowedNavItemsForUser, isRouteAllowedForUser } = await import('@/lib/nav-permissions/service');

    process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED = 'true';

    // 1) Perfil USER bloqueia qualidade e espera; Departamento Atendimento libera espera e qualidade;
    //    Colaborador individualmente bloqueia qualidade (DENY), mantendo espera liberada pelo Departamento.
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        { item_id: 'espera', visible: false },
        { item_id: 'qualidade', visible: false },
      ] as any) // roleRules
      .mockResolvedValueOnce([
        { item_id: 'qualidade', override: 'DENY' },
      ] as any) // userRules
      .mockResolvedValueOnce([
        { item_id: 'espera', override: 'ALLOW' },
        { item_id: 'qualidade', override: 'ALLOW' },
      ] as any); // deptRules

    const user = {
      id: 'user-atd-1',
      role: 'USER',
      tenantId: 'tenant-123',
      departamento: 'Atendimento',
    };

    const allowed = await getAllowedNavItemsForUser(user);
    expect(allowed.enabled).toBe(true);
    expect(allowed.allowedItemIds).toContain('espera'); // liberado pelo Departamento sobrepondo Perfil
    expect(allowed.allowedItemIds).not.toContain('qualidade'); // bloqueado pelo Colaborador sobrepondo Departamento

    // Verifica rota direta /espera (liberada pelo Departamento)
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([]) // userRules
      .mockResolvedValueOnce([{ item_id: 'espera', override: 'ALLOW' }] as any); // deptRules

    expect(await isRouteAllowedForUser('/espera', user)).toBe(true);

    // Verifica que guarda estrutural impede item restrito mesmo se Departamento tiver ALLOW
    const centralAllowed = allowed.allowedItemIds.includes('central_operacoes');
    expect(centralAllowed).toBe(false);

    delete process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED;
  });

  it('verifica que a migration preparada de fiorix_nav_department_rules existe e ativa RLS', () => {
    const deptMigPath = path.resolve(
      __dirname,
      '../supabase/prepared-migrations/20261105163000_fiorix_nav_department_rules.sql'
    );
    expect(fs.existsSync(deptMigPath)).toBe(true);
    const sql = fs.readFileSync(deptMigPath, 'utf-8');
    expect(sql).toContain('fiorix_nav_department_rules');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.fiorix_nav_department_rules FROM PUBLIC');
  });
});


describe('FIORIX — Menu INICIAL (/dashboard) configurável em Permissões de Menu', () => {
  it('inclui o grupo INICIAL com o item inicio (/dashboard) no topo do catálogo e oculta por padrão para COLABORADOR', () => {
    expect(NAV_CATALOG_GROUPS[0].id).toBe('inicial');
    expect(NAV_CATALOG_GROUPS[0].label).toBe('INICIAL');
    const inicioItem = ITEM_BY_ID.get('inicio');
    expect(inicioItem).toBeDefined();
    expect(inicioItem?.href).toBe('/dashboard');

    // Legado: visível por padrão para USER/ADMIN/MASTER, oculto por padrão para COLABORADOR e RH
    expect(isItemVisibleInLegacy(inicioItem!, 'ADMIN')).toBe(true);
    expect(isItemVisibleInLegacy(inicioItem!, 'USER')).toBe(true);
    expect(isItemVisibleInLegacy(inicioItem!, 'COLABORADOR')).toBe(false);
    expect(isItemVisibleInLegacy(inicioItem!, 'RH')).toBe(false);
  });

  it('quando COLABORADOR (Sara) tem apenas Qualidade ativado, inicio não aparece em allowedItemIds e a rota inicial resolve para /bi/qualidade', async () => {
    const { prisma } = await import('@/lib/prisma');
    const {
      getAllowedNavItemsForUser,
      getFirstAllowedRouteForUser,
      isRouteAllowedForUser,
    } = await import('@/lib/nav-permissions/service');

    process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED = 'true';

    const saraUserRules = [
      { item_id: 'qualidade', override: 'ALLOW' },
      { item_id: 'espera', override: 'DENY' },
      { item_id: 'impressoes', override: 'DENY' },
      { item_id: 'rastreio', override: 'DENY' },
      { item_id: 'mensagens', override: 'DENY' },
      { item_id: 'comunicados', override: 'DENY' },
      { item_id: 'minha_it', override: 'DENY' },
      { item_id: 'ferias', override: 'DENY' },
      { item_id: 'holerites', override: 'DENY' },
    ];

    const sara = {
      id: 'user-sara',
      role: 'COLABORADOR',
      tenantId: 'tenant-123',
      departamento: 'CONTRADITÓRIO / EXTRATO',
    };

    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as any) // roleRules
      .mockResolvedValueOnce(saraUserRules as any) // userRules
      .mockResolvedValueOnce([] as any); // deptRules

    const nav = await getAllowedNavItemsForUser(sara);
    expect(nav.allowedItemIds).toEqual(['qualidade']);
    expect(nav.allowedItemIds).not.toContain('inicio');

    // Verifica que /dashboard está bloqueado para Sara
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce(saraUserRules as any) // userRules
      .mockResolvedValueOnce([] as any) // deptRules
      .mockResolvedValueOnce([] as any); // roleRules
    expect(await isRouteAllowedForUser('/dashboard', sara)).toBe(false);

    // Verifica que a primeira rota permitida para Sara resolve para /bi/qualidade
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as any) // roleRules
      .mockResolvedValueOnce(saraUserRules as any) // userRules
      .mockResolvedValueOnce([] as any); // deptRules
    expect(await getFirstAllowedRouteForUser(sara)).toBe('/bi/qualidade');

    delete process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED;
  });
});
