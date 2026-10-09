/**
 * FIORIX — Fase 6.0 | Inventário estático de cobertura de rotas, APIs e server actions
 *
 * Finalidade: listar TUDO o que, no futuro, precisará passar pelo guard de
 * acesso granular, classificado por módulo canônico e risco.
 *
 * ESTE ARQUIVO É SOMENTE DADO. Nenhuma rota, página, API ou action o importa e
 * nenhum guard é aplicado nesta fase. O teste
 * `__tests__/route-access-inventory.test.ts` falha se surgir arquivo novo de
 * rota/página/action sem classificação, ou se uma entrada ficar obsoleta.
 *
 * Chave: caminho relativo a `src/` (ex.: `app/api/bi/dashboard/route.ts`).
 */

export type RouteKind = 'PAGE' | 'API' | 'SERVER_ACTION';

/**
 * CANONICAL        → pertence a um módulo canônico do catálogo (moduleId obrigatório).
 * MINIMAL_SAFE     → Início, sempre disponível em modo mínimo seguro.
 * PUBLIC_AUTH      → fluxo de autenticação (login/OAuth/NextAuth).
 * ACCOUNT_SELF     → dados da própria conta do usuário.
 * SHARED_UTILITY   → utilitário transversal autenticado, sem módulo próprio.
 * MASTER_SAAS      → espaço MASTER SAAS (fora do catálogo do cliente).
 * MACHINE_TOKEN    → integração máquina-a-máquina com segredo Bearer.
 * DEV_ONLY         → disponível apenas em desenvolvimento.
 * REDIRECT_ONLY    → apenas redireciona.
 * PENDING_CATALOG  → sem nó no catálogo atual; `suggestedModuleId` obrigatório (decisão na 6.1).
 */
export type RouteAccessScope =
  | 'CANONICAL'
  | 'MINIMAL_SAFE'
  | 'PUBLIC_AUTH'
  | 'ACCOUNT_SELF'
  | 'SHARED_UTILITY'
  | 'MASTER_SAAS'
  | 'MACHINE_TOKEN'
  | 'DEV_ONLY'
  | 'REDIRECT_ONLY'
  | 'PENDING_CATALOG';

export type RouteRisk = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RouteAccessEntry {
  kind: RouteKind;
  scope: RouteAccessScope;
  risk: RouteRisk;
  moduleId?: string;
  suggestedModuleId?: string;
  /** API cujo prefixo no catálogo não resolve para o módulo correto (corrigir na 6.1). */
  catalogGap?: boolean;
  /**
   * Arquivo existente apenas na cópia local (diretório listado no .gitignore,
   * não versionado). Pode não existir em um clone limpo.
   */
  localOnly?: boolean;
  note?: string;
}

type E = RouteAccessEntry;
const page = (scope: RouteAccessScope, risk: RouteRisk, extra: Partial<E> = {}): E => ({ kind: 'PAGE', scope, risk, ...extra });
const api = (scope: RouteAccessScope, risk: RouteRisk, extra: Partial<E> = {}): E => ({ kind: 'API', scope, risk, ...extra });
const action = (scope: RouteAccessScope, risk: RouteRisk, extra: Partial<E> = {}): E => ({ kind: 'SERVER_ACTION', scope, risk, ...extra });

export const ROUTE_ACCESS_INVENTORY: Readonly<Record<string, RouteAccessEntry>> = Object.freeze({
  // ─── PÁGINAS ──────────────────────────────────────────────────────────────
  'app/(dashboard)/administracao/its/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'its.gestao' }),
  'app/(dashboard)/administracao/mensagens/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'rotina.mensagens', note: 'Gestão de Mensagens (submenu administrativo); nó filho a definir na 6.1.' }),
  'app/(dashboard)/administracao/rh/page.tsx': page('PENDING_CATALOG', 'HIGH', { suggestedModuleId: 'pessoas.gestao' }),
  'app/(dashboard)/avaliacoes/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'google.avaliacoes' }),
  'app/(dashboard)/bi/importacoes/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.contingencia' }),
  'app/(dashboard)/bi/importar/page.tsx': page('PENDING_CATALOG', 'HIGH', { suggestedModuleId: 'sistema.contingencia' }),
  'app/(dashboard)/bi/metas/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.metas' }),
  'app/(dashboard)/bi/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.bi' }),
  'app/(dashboard)/bi/produtividade/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.recepcao' }),
  'app/(dashboard)/bi/retornos/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.retornos' }),
  'app/(dashboard)/bi/qualidade/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.qualidade' }),
  'app/(dashboard)/bi/tarefas/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.tarefas' }),
  'app/(dashboard)/configuracoes/cartorios/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes' }),
  'app/(dashboard)/configuracoes/categorias/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'sistema.configuracoes' }),
  'app/(dashboard)/configuracoes/colaboradores/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes', note: 'Dados pessoais de colaboradores.' }),
  'app/(dashboard)/configuracoes/departamentos/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes' }),
  'app/(dashboard)/configuracoes/grupos-permissoes/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes', note: 'Prévia visual local de Grupos e Permissões do 7º RI-SP; acesso exclusivo para MASTER, sem APIs associadas e sem persistência.' }),
  'app/(dashboard)/configuracoes/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes' }),
  'app/(dashboard)/configuracoes/parametros/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes' }),
  'app/(dashboard)/configuracoes/usuarios/page.tsx': page('CANONICAL', 'CRITICAL', { moduleId: 'sistema.configuracoes', note: 'Gestão de usuários e papéis do tenant.' }),
  'app/(dashboard)/controle-impressoes/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.impressoes' }),
  'app/(dashboard)/dashboard/page.tsx': page('MINIMAL_SAFE', 'LOW', { moduleId: 'core.dashboard' }),
  'app/(dashboard)/espera/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.espera' }),
  'app/(dashboard)/estatisticas/page.tsx': page('CANONICAL', 'LOW', { moduleId: 'google.estatisticas' }),
  'app/(dashboard)/gestao/rh/instrucoes-trabalho-monitoramento/page.tsx': page('REDIRECT_ONLY', 'LOW', { suggestedModuleId: 'its.gestao' }),
  'app/(dashboard)/instrucoes-trabalho/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'its.minha_it' }),
  'app/(dashboard)/instrucoes-trabalho/[id]/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'its.minha_it' }),
  'app/(dashboard)/jornada/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'prazos.rastreio', localOnly: true, note: 'Código experimental não versionado (.gitignore). Consome /api/jornada/[protocolo].' }),
  'app/(dashboard)/master/mensagens/page.tsx': page('MASTER_SAAS', 'CRITICAL', { note: 'Espaço MASTER SAAS.' }),
  'app/(dashboard)/master/permissoes/page.tsx': page('MASTER_SAAS', 'CRITICAL', { note: 'Espaço MASTER SAAS.' }),
  'app/(dashboard)/master/planos/page.tsx': page('MASTER_SAAS', 'CRITICAL', { note: 'Espaço MASTER SAAS.' }),
  'app/(dashboard)/master/saas/observacao/page.tsx': page('MASTER_SAAS', 'CRITICAL', { note: 'Espaço MASTER SAAS.' }),
  'app/(dashboard)/master/tenants/page.tsx': page('MASTER_SAAS', 'CRITICAL', { note: 'Espaço MASTER SAAS.' }),
  'app/(dashboard)/mensagens/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'rotina.mensagens' }),
  'app/(dashboard)/minha-conta/page.tsx': page('ACCOUNT_SELF', 'MEDIUM', { note: 'Inclui configuração de TOTP do próprio usuário.' }),
  'app/(dashboard)/minha-it/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'its.minha_it' }),
  'app/(dashboard)/pessoas/comunicados/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'rotina.comunicados' }),
  'app/(dashboard)/pessoas/ferias/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'pessoas.ferias' }),
  'app/(dashboard)/pessoas/holerites/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'pessoas.holerites' }),
  'app/(dashboard)/pessoas/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'pessoas.ferias', note: 'Hub "Meu Espaço" vinculado a pessoas.ferias.' }),
  'app/(dashboard)/relatorios/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'google.relatorios' }),
  'app/(dashboard)/sistema/operacoes/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'sistema.operacoes' }),
  'app/(dashboard)/sistema/pessoas/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'pessoas.gestao' }),
  'app/(dashboard)/sistema/pessoas/usuarios/page.tsx': page('REDIRECT_ONLY', 'LOW', { suggestedModuleId: 'sistema.configuracoes' }),
  'app/(dashboard)/trajetoria-titulo/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'prazos.rastreio' }),
  'app/login/page.tsx': page('PUBLIC_AUTH', 'LOW'),
  'app/page.tsx': page('REDIRECT_ONLY', 'LOW'),
  'app/preview-visao-consolidada/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'core.dashboard', note: 'Página de preview de visão consolidada.' }),
  'app/relatorios/imprimir-colaboradores/page.tsx': page('CANONICAL', 'HIGH', { moduleId: 'pessoas.gestao', note: 'Impressão de colaboradores com dados pessoais.' }),
  'app/relatorios/imprimir-mensal/page.tsx': page('CANONICAL', 'MEDIUM', { moduleId: 'google.relatorios' }),
  'app/valida/[hash]/page.tsx': page('REDIRECT_ONLY', 'LOW', { note: 'Redirecionamento para /verifica/[hash].' }),
  'app/verifica/[hash]/page.tsx': page('PUBLIC_AUTH', 'LOW', { note: 'Validação pública de autenticidade e ciência de comunicados.' }),

  // ─── APIs ─────────────────────────────────────────────────────────────────
  'app/api/auth/callback/google/route.ts': api('PUBLIC_AUTH', 'HIGH'),
  'app/api/auth/google/route.ts': api('PUBLIC_AUTH', 'HIGH'),
  'app/api/auth/[...nextauth]/route.ts': api('PUBLIC_AUTH', 'HIGH'),
  'app/api/bi/atrasados/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.bi' }),
  'app/api/bi/dashboard/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.bi' }),
  'app/api/bi/impressoes/import/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.impressoes', catalogGap: true, note: 'Catálogo resolve para prazos.bi.' }),
  'app/api/bi/metas/data/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.metas' }),
  'app/api/bi/metas/import/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.metas' }),
  'app/api/bi/produtividade/data/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.recepcao' }),
  'app/api/bi/produtividade/import/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.recepcao' }),
  'app/api/bi/produtividade/sync/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.recepcao' }),
  'app/api/bi/retornos/data/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.retornos' }),
  'app/api/bi/retornos/import/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.retornos' }),
  'app/api/bi/qualidade/data/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.qualidade' }),
  'app/api/bi/qualidade/metas/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.qualidade' }),
  'app/api/bi/qualidade/limites/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.qualidade' }),
  'app/api/bi/qualidade/revisar-causa/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.qualidade' }),
  'app/api/bi/tarefas/data/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.tarefas' }),
  'app/api/bi/tarefas/import/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'prazos.tarefas' }),
  'app/api/comunicados/anexo/[id]/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'rotina.comunicados' }),
  'app/api/comunicados/ciencia/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'rotina.comunicados' }),
  'app/api/comunicados/publish/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'rotina.comunicados_rh', catalogGap: true, note: 'Ação de RH; catálogo resolve para rotina.comunicados.' }),
  'app/api/comunicados/upload/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'rotina.comunicados_rh', catalogGap: true, note: 'Ação de RH; catálogo resolve para rotina.comunicados.' }),
  'app/api/comunicados/verifica/[hash]/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'rotina.comunicados', note: 'Confirmar na 6.1 se a verificação por hash é pública por desenho.' }),
  'app/api/controle-impressoes/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.impressoes' }),
  'app/api/export/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'google.relatorios', catalogGap: true, note: 'Exportação de avaliações do tenant.' }),
  'app/api/ferias/validar/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'pessoas.ferias' }),
  'app/api/fiorix-chat/route.ts': api('SHARED_UTILITY', 'MEDIUM'),
  'app/api/fiorix-generate-it/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'its.gestao', catalogGap: true }),
  'app/api/google/auth/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'google.avaliacoes', note: 'OAuth da integração Google Business.' }),
  'app/api/google/callback/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'google.avaliacoes', note: 'OAuth da integração Google Business.' }),
  'app/api/holerites/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'pessoas.holerites' }),
  'app/api/holerites/[id]/download/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'pessoas.holerites' }),
  'app/api/ip/route.ts': api('SHARED_UTILITY', 'LOW'),
  'app/api/its/signed-url/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'its.gestao' }),
  'app/api/its/universal-parser/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'its.gestao' }),
  'app/api/its/upload/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'its.gestao' }),
  'app/api/its/upload-pdf/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'its.gestao' }),
  'app/api/jornada/[protocolo]/route.ts': api('CANONICAL', 'HIGH', {
    moduleId: 'prazos.rastreio',
    localOnly: true,
    catalogGap: true,
    note: 'Fase 6.0.A: exige sessão, tenant e permissão view em prazos.rastreio; consultas filtradas por tenant; 404 uniforme. Código experimental não versionado (.gitignore).',
  }),
  'app/api/lgpd/relatorio/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes', catalogGap: true, note: 'Logs de acesso (LGPD).' }),
  'app/api/lgpd/solicitacoes/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes', catalogGap: true, note: 'Solicitações de titulares (LGPD).' }),
  'app/api/mensagens/anexo/[id]/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'rotina.mensagens' }),
  'app/api/mensagens/upload/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'rotina.mensagens' }),
  'app/api/navigation/stats/route.ts': api('SHARED_UTILITY', 'LOW'),
  'app/api/push/subscribe/route.ts': api('ACCOUNT_SELF', 'LOW'),
  'app/api/push/test/route.ts': api('ACCOUNT_SELF', 'LOW'),
  'app/api/push/vapid-public-key/route.ts': api('SHARED_UTILITY', 'LOW'),
  'app/api/rh/upload-holerites/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'pessoas.gestao' }),
  'app/api/seed-reviews/route.ts': api('DEV_ONLY', 'MEDIUM', { note: 'Bloqueada fora de desenvolvimento; exige MASTER.' }),
  'app/api/sync-reviews/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'google.avaliacoes', catalogGap: true, note: 'Catálogo não referencia esta API.' }),
  'app/api/trajetoria/[protocolo]/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.rastreio' }),
  'app/api/v1/connector/status/route.ts': api('MACHINE_TOKEN', 'HIGH', { note: 'Catálogo referencia /api/connector/status (inexistente).' }),
  'app/api/v1/connector/sync/route.ts': api('MACHINE_TOKEN', 'HIGH'),
  'app/api/v1/espera/senhas/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'prazos.espera' }),
  'app/api/v1/integrations/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.operacoes', catalogGap: true, note: 'Configurações e auditoria de integrações.' }),
  'app/api/v1/operacoes/alerts/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.operacoes' }),
  'app/api/v1/operacoes/alerts/test/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.operacoes' }),
  'app/api/v1/operacoes/batches/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'sistema.operacoes' }),
  'app/api/v1/operacoes/health/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'sistema.operacoes' }),
  'app/api/v1/operacoes/integracoes/test/route.ts': api('CANONICAL', 'HIGH', { moduleId: 'sistema.operacoes' }),
  'app/api/v1/operacoes/telemetry-history/route.ts': api('CANONICAL', 'MEDIUM', { moduleId: 'sistema.operacoes' }),

  // ─── SERVER ACTIONS ───────────────────────────────────────────────────────
  'app/(dashboard)/bi/importacoes/actions.ts': action('CANONICAL', 'HIGH', { moduleId: 'sistema.contingencia' }),
  'app/actions/admin.ts': action('CANONICAL', 'CRITICAL', { moduleId: 'sistema.configuracoes', note: 'Ações administrativas do tenant (usuários/papéis).' }),
  'app/actions/auth.ts': action('PUBLIC_AUTH', 'HIGH'),
  'app/actions/bi.ts': action('CANONICAL', 'MEDIUM', { moduleId: 'prazos.bi' }),
  'app/actions/colaboradores.ts': action('CANONICAL', 'HIGH', { moduleId: 'pessoas.gestao' }),
  'app/actions/comunicados.ts': action('CANONICAL', 'HIGH', { moduleId: 'rotina.comunicados_rh' }),
  'app/actions/departamentos.ts': action('CANONICAL', 'HIGH', { moduleId: 'sistema.configuracoes' }),
  'app/actions/ferias.ts': action('CANONICAL', 'MEDIUM', { moduleId: 'pessoas.ferias' }),
  'app/actions/holerites.ts': action('CANONICAL', 'HIGH', { moduleId: 'pessoas.holerites' }),
  'app/actions/its.ts': action('CANONICAL', 'HIGH', { moduleId: 'its.gestao' }),
  'app/actions/mensagens.ts': action('CANONICAL', 'MEDIUM', { moduleId: 'rotina.mensagens' }),
  'app/actions/minha-it.ts': action('CANONICAL', 'MEDIUM', { moduleId: 'its.minha_it' }),
  'app/actions/nav-permissions.ts': action('CANONICAL', 'CRITICAL', { moduleId: 'sistema.configuracoes', note: 'Permissões de navegação (Fase V1.3): exclusivo MASTER validado no banco, tenant canônico do MASTER, step-up senha+TOTP em toda gravação, regra e auditoria na mesma transação; flag FEATURE_NAV_PERMISSIONS_V1_ENABLED desligada por padrão.' }),
  'app/actions/plans.ts': action('MASTER_SAAS', 'CRITICAL', { note: 'Governança de planos/políticas (step-up obrigatório).' }),
  'app/actions/reviews.ts': action('CANONICAL', 'MEDIUM', { moduleId: 'google.avaliacoes' }),
  'app/actions/rh.ts': action('CANONICAL', 'HIGH', { moduleId: 'pessoas.gestao' }),
  'app/actions/tenants.ts': action('MASTER_SAAS', 'CRITICAL', { note: 'Gestão de tenants (espaço MASTER SAAS).' }),
});

/** Converte a chave de inventário de uma API para o caminho de URL (remove grupos de rota). */
export function inventoryKeyToUrlPath(key: string): string {
  const withoutApp = key.replace(/^app\//, '');
  const withoutFile = withoutApp.replace(/\/(page\.tsx|route\.ts)$/, '').replace(/^(page\.tsx|route\.ts)$/, '');
  const segments = withoutFile.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  return '/' + segments.join('/');
}
