/**
 * FIORIX — Catálogo Canônico de Módulos Reais do SaaS
 *
 * Contém EXCLUSIVAMENTE módulos que possuem rotas, telas, APIs e controles técnicos
 * reais em execução no FIORIX.
 *
 * Matriz Comercial Aprovada:
 * - BASIC: 10 módulos essenciais
 * - PRO: 21 módulos de gestão integrada e pessoas
 * - OMEGA: 23 módulos (100% de cobertura operacional e parametrização avançada)
 */

export type ModuleCategory =
  | 'CORE'
  | 'PRESENCA_GOOGLE'
  | 'GESTAO_PRAZOS'
  | 'INSTRUCOES_TRABALHO'
  | 'ROTINA_TRABALHO'
  | 'GESTAO_PESSOAS'
  | 'SISTEMA_TECNOLOGIA';

export type ModuleAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'export'
  | 'admin';

export type PlanTier = 'BASIC' | 'PRO' | 'OMEGA' | 'CUSTOM';

export interface ModuleDefinition {
  id: string;
  name: string;
  category: ModuleCategory;
  categoryLabel: string;
  description: string;
  route: string;
  routes: string[];
  apiPrefix?: string;
  apiEndpoints?: string[];
  defaultPlanTier: 'BASIC' | 'PRO' | 'OMEGA';
  supportedActions: ModuleAction[];
  isCustomizable: boolean;
  isSystemCritical: boolean;
}

export const MODULE_CATEGORIES: Record<ModuleCategory, string> = {
  CORE: 'VISÃO GERAL',
  PRESENCA_GOOGLE: 'PRESENÇA NO GOOGLE',
  GESTAO_PRAZOS: 'GESTÃO DE PRAZOS & BI',
  INSTRUCOES_TRABALHO: 'INSTRUÇÕES DE TRABALHO',
  ROTINA_TRABALHO: 'ROTINA DE TRABALHO',
  GESTAO_PESSOAS: 'GESTÃO DE PESSOAS',
  SISTEMA_TECNOLOGIA: 'SISTEMA & TECNOLOGIA',
};

export const CANONICAL_MODULES: Record<string, ModuleDefinition> = {
  // ── 1. CORE (1 módulo) ───────────────────────────────────────────────────
  'core.dashboard': {
    id: 'core.dashboard',
    name: 'Início & Visão Geral',
    category: 'CORE',
    categoryLabel: 'VISÃO GERAL',
    description: 'Painel principal de métricas resumidas e navegação rápida',
    route: '/dashboard',
    routes: ['/dashboard'],
    apiPrefix: '/api/bi/summary',
    apiEndpoints: ['/api/bi/summary'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view'],
    isCustomizable: false,
    isSystemCritical: true,
  },

  // ── 2. PRESENÇA NO GOOGLE (3 módulos) ─────────────────────────────────────
  'google.avaliacoes': {
    id: 'google.avaliacoes',
    name: 'Google Avaliações',
    category: 'PRESENCA_GOOGLE',
    categoryLabel: 'PRESENÇA NO GOOGLE',
    description: 'Gestão, moderação e respostas às avaliações do Google Meu Negócio',
    route: '/avaliacoes',
    routes: ['/avaliacoes'],
    apiPrefix: '/api/reviews',
    apiEndpoints: ['/api/reviews', '/api/google'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'create', 'edit', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'google.estatisticas': {
    id: 'google.estatisticas',
    name: 'Estatísticas Google',
    category: 'PRESENCA_GOOGLE',
    categoryLabel: 'PRESENÇA NO GOOGLE',
    description: 'Métricas de visualização, cliques e chamadas do perfil do cartório',
    route: '/estatisticas',
    routes: ['/estatisticas'],
    apiPrefix: '/api/google/stats',
    apiEndpoints: ['/api/google/stats'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'google.relatorios': {
    id: 'google.relatorios',
    name: 'Relatórios de Reputação',
    category: 'PRESENCA_GOOGLE',
    categoryLabel: 'PRESENÇA NO GOOGLE',
    description: 'Relatórios analíticos consolidados de reputação e notas',
    route: '/relatorios',
    routes: ['/relatorios'],
    apiPrefix: '/api/google/reports',
    apiEndpoints: ['/api/google/reports'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },

  // ── 3. GESTÃO DE PRAZOS & BI (8 módulos) ──────────────────────────────────
  'prazos.tarefas': {
    id: 'prazos.tarefas',
    name: 'Tarefas & Carga Operacional',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Previsão de carga de trabalho e distribuição operacional',
    route: '/bi/tarefas',
    routes: ['/bi/tarefas'],
    apiPrefix: '/api/bi/tarefas',
    apiEndpoints: ['/api/bi/tarefas'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.metas': {
    id: 'prazos.metas',
    name: 'Metas & Gargalos',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Acompanhamento de metas de prazos e pontos de retenção',
    route: '/bi/metas',
    routes: ['/bi/metas'],
    apiPrefix: '/api/bi/metas',
    apiEndpoints: ['/api/bi/metas'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.retornos': {
    id: 'prazos.retornos',
    name: 'Retornos de Títulos',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Controle de títulos devolvidos, motivos e responsáveis',
    route: '/bi/retornos',
    routes: ['/bi/retornos'],
    apiPrefix: '/api/devolucoes',
    apiEndpoints: ['/api/devolucoes', '/api/bi/retornos'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.qualidade': {
    id: 'prazos.qualidade',
    name: 'Controle de Qualidade',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Indicadores de qualidade, retornos internos, metas e limites de erro',
    route: '/bi/qualidade',
    routes: ['/bi/qualidade'],
    apiPrefix: '/api/bi/qualidade',
    apiEndpoints: ['/api/bi/qualidade'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.espera': {
    id: 'prazos.espera',
    name: 'Gestão de Espera & Atendimento',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Filas em tempo real, emissão de senhas e SLAs de atendimento NextQS',
    route: '/espera',
    routes: ['/espera'],
    apiPrefix: '/api/v1/espera',
    apiEndpoints: ['/api/v1/espera'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.recepcao': {
    id: 'prazos.recepcao',
    name: 'Recepção & Produtividade',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Produtividade de atendimento digital e balcão presencial',
    route: '/bi/produtividade',
    routes: ['/bi/produtividade'],
    apiPrefix: '/api/bi/produtividade',
    apiEndpoints: ['/api/bi/produtividade'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.bi': {
    id: 'prazos.bi',
    name: 'Prazos & Protocolos em Aberto',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Visão executiva de protocolos, prazos legais e percentual de atraso',
    route: '/bi',
    routes: ['/bi', '/bi/prazos', '/prenotacoes', '/reclamacoes'],
    apiPrefix: '/api/connector/status',
    apiEndpoints: ['/api/connector/status', '/api/bi'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.impressoes': {
    id: 'prazos.impressoes',
    name: 'Controle de Impressões',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Auditoria de certidões impressas e atos lançados nos livros',
    route: '/controle-impressoes',
    routes: ['/controle-impressoes'],
    apiPrefix: '/api/controle-impressoes',
    apiEndpoints: ['/api/controle-impressoes'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'edit', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'prazos.rastreio': {
    id: 'prazos.rastreio',
    name: 'Rastreio de Títulos',
    category: 'GESTAO_PRAZOS',
    categoryLabel: 'GESTÃO DE PRAZOS & BI',
    description: 'Consulta da trajetória, última localização física e status de protocolos',
    route: '/trajetoria-titulo',
    routes: ['/trajetoria-titulo'],
    apiPrefix: '/api/trajetoria',
    apiEndpoints: ['/api/trajetoria'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view'],
    isCustomizable: true,
    isSystemCritical: false,
  },

  // ── 4. INSTRUÇÕES DE TRABALHO (2 módulos) ─────────────────────────────────
  'its.gestao': {
    id: 'its.gestao',
    name: 'Gestão de ITs',
    category: 'INSTRUCOES_TRABALHO',
    categoryLabel: 'INSTRUÇÕES DE TRABALHO',
    description: 'Repositório oficial e governança de Instruções de Trabalho',
    route: '/administracao/its',
    routes: ['/administracao/its'],
    apiPrefix: '/api/its',
    apiEndpoints: ['/api/its'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'create', 'edit', 'approve', 'delete', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'its.minha_it': {
    id: 'its.minha_it',
    name: 'Minha IT',
    category: 'INSTRUCOES_TRABALHO',
    categoryLabel: 'INSTRUÇÕES DE TRABALHO',
    description: 'Instruções de trabalho atribuídas à função do colaborador logado',
    route: '/minha-it',
    routes: ['/minha-it'],
    apiPrefix: '/api/its/user',
    apiEndpoints: ['/api/its/user'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view'],
    isCustomizable: false,
    isSystemCritical: true,
  },

  // ── 5. ROTINA DE TRABALHO (3 módulos) ─────────────────────────────────────
  'rotina.comunicados': {
    id: 'rotina.comunicados',
    name: 'Comunicados & Mural',
    category: 'ROTINA_TRABALHO',
    categoryLabel: 'ROTINA DE TRABALHO',
    description: 'Leitura de avisos institucionais e registro formal de ciência',
    route: '/pessoas/comunicados',
    routes: ['/pessoas/comunicados'],
    apiPrefix: '/api/pessoas/comunicados',
    apiEndpoints: ['/api/pessoas/comunicados', '/api/comunicados'],
    defaultPlanTier: 'BASIC',
    supportedActions: ['view', 'create'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'rotina.mensagens': {
    id: 'rotina.mensagens',
    name: 'Mensagens Corporativas',
    category: 'ROTINA_TRABALHO',
    categoryLabel: 'ROTINA DE TRABALHO',
    description: 'Canais e conversas em tempo real entre colaboradores e setores',
    route: '/mensagens',
    routes: ['/mensagens', '/administracao/mensagens'],
    apiPrefix: '/api/mensagens/conversas',
    apiEndpoints: ['/api/mensagens/conversas', '/api/mensagens'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'delete'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'rotina.comunicados_rh': {
    id: 'rotina.comunicados_rh',
    name: 'Gestão de Comunicados (RH)',
    category: 'ROTINA_TRABALHO',
    categoryLabel: 'ROTINA DE TRABALHO',
    description: 'Publicação, público-alvo e relatórios de ciência obrigatória',
    route: '/sistema/pessoas/comunicados',
    routes: ['/sistema/pessoas/comunicados'],
    apiPrefix: '/api/comunicados/admin',
    apiEndpoints: ['/api/comunicados/admin'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'edit', 'delete', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },

  // ── 6. GESTÃO DE PESSOAS (3 módulos) ──────────────────────────────────────
  'pessoas.gestao': {
    id: 'pessoas.gestao',
    name: 'Gestão de Pessoas & Colaboradores',
    category: 'GESTAO_PESSOAS',
    categoryLabel: 'GESTÃO DE PESSOAS',
    description: 'Cadastro de equipe, cargos, setores e relatórios de RH',
    route: '/sistema/pessoas',
    routes: ['/sistema/pessoas'],
    apiPrefix: '/api/rh',
    apiEndpoints: ['/api/rh'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'edit', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'pessoas.ferias': {
    id: 'pessoas.ferias',
    name: 'Férias & Escalas',
    category: 'GESTAO_PESSOAS',
    categoryLabel: 'GESTÃO DE PESSOAS',
    description: 'Solicitação, programação, escala e aprovação de férias',
    route: '/pessoas/ferias',
    routes: ['/pessoas/ferias'],
    apiPrefix: '/api/pessoas/ferias',
    apiEndpoints: ['/api/pessoas/ferias', '/api/ferias'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'edit', 'approve', 'delete', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'pessoas.holerites': {
    id: 'pessoas.holerites',
    name: 'Holerites & Recibos',
    category: 'GESTAO_PESSOAS',
    categoryLabel: 'GESTÃO DE PESSOAS',
    description: 'Disponibilização segura e comprovante de entrega de holerites',
    route: '/pessoas/holerites',
    routes: ['/pessoas/holerites'],
    apiPrefix: '/api/pessoas/holerites',
    apiEndpoints: ['/api/pessoas/holerites', '/api/holerites'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'create', 'export'],
    isCustomizable: true,
    isSystemCritical: false,
  },

  // ── 7. SISTEMA & TECNOLOGIA (3 módulos) ───────────────────────────────────
  'sistema.operacoes': {
    id: 'sistema.operacoes',
    name: 'Central de Operações & Saúde',
    category: 'SISTEMA_TECNOLOGIA',
    categoryLabel: 'SISTEMA & TECNOLOGIA',
    description: 'Observabilidade SaaS, conectores, saúde do banco e auditoria de lotes',
    route: '/sistema/operacoes',
    routes: ['/sistema/operacoes'],
    apiPrefix: '/api/v1/operacoes',
    apiEndpoints: ['/api/v1/operacoes'],
    defaultPlanTier: 'PRO',
    supportedActions: ['view', 'export', 'admin'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'sistema.contingencia': {
    id: 'sistema.contingencia',
    name: 'Importação de Contingência',
    category: 'SISTEMA_TECNOLOGIA',
    categoryLabel: 'SISTEMA & TECNOLOGIA',
    description: 'Carga manual de arquivos CSV de contingência operacional',
    route: '/bi/importacoes',
    routes: ['/bi/importacoes', '/bi/importar'],
    apiPrefix: '/api/bi/import',
    apiEndpoints: ['/api/bi/import'],
    defaultPlanTier: 'OMEGA',
    supportedActions: ['view', 'create', 'delete', 'admin'],
    isCustomizable: true,
    isSystemCritical: false,
  },
  'sistema.configuracoes': {
    id: 'sistema.configuracoes',
    name: 'Configurações Avançadas',
    category: 'SISTEMA_TECNOLOGIA',
    categoryLabel: 'SISTEMA & TECNOLOGIA',
    description: 'Parametrização de integrações, tokens de APIs e webhooks',
    route: '/configuracoes',
    routes: [
      '/configuracoes',
      '/configuracoes/usuarios',
      '/configuracoes/departamentos',
      '/configuracoes/colaboradores',
      '/configuracoes/parametros',
      '/configuracoes/cartorios',
    ],
    apiPrefix: '/api/configuracoes',
    apiEndpoints: ['/api/configuracoes'],
    defaultPlanTier: 'OMEGA',
    supportedActions: ['view', 'create', 'edit', 'delete', 'admin'],
    isCustomizable: true,
    isSystemCritical: true,
  },
};

export const CANONICAL_MODULES_LIST: ModuleDefinition[] = Object.values(CANONICAL_MODULES);

/**
 * Retorna os módulos oficiais incluídos por padrão em cada plano conforme decisão comercial:
 * - BASIC: 10 módulos
 * - PRO: 21 módulos
 * - OMEGA: 23 módulos
 */
export function getDefaultModulesForTier(tier: PlanTier): string[] {
  if (tier === 'BASIC') {
    return CANONICAL_MODULES_LIST.filter((m) => m.defaultPlanTier === 'BASIC').map((m) => m.id);
  }

  if (tier === 'PRO') {
    return CANONICAL_MODULES_LIST.filter(
      (m) => m.defaultPlanTier === 'BASIC' || m.defaultPlanTier === 'PRO'
    ).map((m) => m.id);
  }

  // OMEGA possui todos os 23 módulos
  return CANONICAL_MODULES_LIST.map((m) => m.id);
}

/**
 * Localiza o módulo canônico associado a uma rota do sistema
 */
export function getModuleByRoute(route: string): ModuleDefinition | undefined {
  const cleanRoute = route.split('?')[0].trim();
  return CANONICAL_MODULES_LIST.find(
    (m) => m.route === cleanRoute || m.routes?.includes(cleanRoute)
  );
}

/**
 * Normaliza um caminho de API para correspondência: remove query string e fragmento,
 * espaços e barras finais redundantes. Não altera caixa (rotas Next.js diferenciam caixa).
 */
export function normalizeApiPath(apiPath: string): string {
  const clean = String(apiPath ?? '').split('?')[0].split('#')[0].trim();
  if (clean.length > 1 && clean.endsWith('/')) return clean.replace(/\/+$/, '');
  return clean;
}

/**
 * Verdadeiro se `path` é exatamente `prefix` ou está abaixo dele em fronteira de segmento
 * (`/api/bi` casa `/api/bi/x`, mas NÃO `/api/bianual`).
 */
export function matchesApiPrefix(path: string, prefix: string): boolean {
  const p = normalizeApiPath(prefix);
  if (!p) return false;
  return path === p || path.startsWith(`${p}/`);
}

/**
 * Localiza o módulo canônico associado a um endpoint de API.
 *
 * Fase 6.0: seleciona o prefixo MAIS ESPECÍFICO (mais longo) entre `apiPrefix` e `apiEndpoints`
 * de todos os módulos, com fronteira de segmento. Antes, retornava o primeiro prefixo encontrado
 * na ordem do catálogo (ex.: `/api/its/user` caía em `its.gestao` e `/api/google/stats` em
 * `google.avaliacoes`).
 *
 * Sem correspondência, ou com empate entre módulos diferentes no mesmo comprimento, retorna
 * `undefined` — nunca um módulo "padrão". Quem consome decide o que `undefined` significa
 * (o motor granular futuro nega; o modo legado não usa esta função para bloquear).
 */
export function getModuleByApi(apiPath: string): ModuleDefinition | undefined {
  const cleanPath = normalizeApiPath(apiPath);
  if (!cleanPath.startsWith('/api')) return undefined;

  let best: ModuleDefinition | undefined;
  let bestLength = -1;
  let ambiguous = false;

  for (const mod of CANONICAL_MODULES_LIST) {
    const prefixes = [mod.apiPrefix, ...(mod.apiEndpoints ?? [])].filter(
      (p): p is string => typeof p === 'string' && p.length > 0
    );
    for (const prefix of prefixes) {
      if (!matchesApiPrefix(cleanPath, prefix)) continue;
      const length = normalizeApiPath(prefix).length;
      if (length > bestLength) {
        best = mod;
        bestLength = length;
        ambiguous = false;
      } else if (length === bestLength && best && best.id !== mod.id) {
        ambiguous = true;
      }
    }
  }

  return ambiguous ? undefined : best;
}
