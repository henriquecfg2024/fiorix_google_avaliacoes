import { NavCatalogGroup, NavCatalogItem } from './types';

/**
 * Catálogo Canônico com identificadores únicos e estáveis para todos os menus e submenus do FIORIX.
 * Mantém exatamente os mesmos hrefs, labels e hierarquias da Sidebar real.
 */
export const NAV_CATALOG_GROUPS: NavCatalogGroup[] = [
  {
    id: 'gestao',
    label: 'PRESENÇA NO GOOGLE',
    items: [
      {
        id: 'avaliacoes',
        label: 'Avaliações',
        href: '/avaliacoes',
        groupId: 'gestao',
        groupLabel: 'PRESENÇA NO GOOGLE',
        description: 'Gestão e respostas a avaliações do Google',
      },
      {
        id: 'estatisticas',
        label: 'Estatísticas',
        href: '/estatisticas',
        groupId: 'gestao',
        groupLabel: 'PRESENÇA NO GOOGLE',
        description: 'Métricas agregadas e evolução de notas',
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        href: '/relatorios',
        groupId: 'gestao',
        groupLabel: 'PRESENÇA NO GOOGLE',
        description: 'Exportação e relatórios consolidados',
      },
    ],
  },
  {
    id: 'operacional',
    label: 'GESTÃO DE PRAZOS',
    items: [
      {
        id: 'espera',
        label: 'Espera',
        href: '/espera',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Tempo de espera e atendimento presencial',
      },
      {
        id: 'recepcao',
        label: 'Recepção',
        href: '/bi/produtividade',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Produtividade de entrada digital e presencial',
      },
      {
        id: 'prazos',
        label: 'Prazos',
        href: '/bi',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Visão geral de títulos e prazos legais',
      },
      {
        id: 'tarefas',
        label: 'Tarefas',
        href: '/bi/tarefas',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Previsão de carga operacional por colaborador',
      },
      {
        id: 'metas',
        label: 'Metas',
        href: '/bi/metas',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Metas de produtividade e análise de gargalos',
      },
      {
        id: 'retornos',
        label: 'Retornos',
        href: '/bi/retornos',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Títulos em retorno, responsáveis e observações',
      },
      {
        id: 'impressoes',
        label: 'Impressões',
        href: '/controle-impressoes',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Controle de certidões e atos nos livros',
      },
      {
        id: 'rastreio',
        label: 'Rastreio',
        href: '/trajetoria-titulo',
        groupId: 'operacional',
        groupLabel: 'GESTÃO DE PRAZOS',
        description: 'Última localização e situação do protocolo',
      },
    ],
  },
  {
    id: 'rhGestao',
    label: 'GESTÃO DE PESSOAS',
    href: '/sistema/pessoas',
    items: [
      {
        id: 'gestao_pessoas',
        label: 'Painel de Pessoas & RH',
        href: '/sistema/pessoas',
        groupId: 'rhGestao',
        groupLabel: 'GESTÃO DE PESSOAS',
        description: 'Quadro de colaboradores, férias e holerites',
        structuralRoles: ['MASTER', 'ADMIN', 'RH', 'SUBSTITUTO'],
        sharedWithId: 'gestao_comunicados',
        sharedNote: 'Compartilha a rota base /sistema/pessoas com Gestão de Comunicados',
      },
    ],
  },
  {
    id: 'governancaIts',
    label: 'INSTRUÇÕES DE TRABALHO',
    items: [
      {
        id: 'gestao_its',
        label: 'Gestão de ITs',
        href: '/administracao/its',
        groupId: 'governancaIts',
        groupLabel: 'INSTRUÇÕES DE TRABALHO',
        description: 'Acompanhe, revise e aprove Instruções de Trabalho',
        structuralRoles: ['MASTER', 'ADMIN', 'SUBSTITUTO'],
      },
    ],
  },
  {
    id: 'trabalho',
    label: 'ROTINA DE TRABALHO',
    items: [
      {
        id: 'mensagens',
        label: 'Mensagens',
        href: '/mensagens',
        groupId: 'trabalho',
        groupLabel: 'ROTINA DE TRABALHO',
        description: 'Comunicação corporativa em tempo real',
      },
      {
        id: 'comunicados',
        label: 'Comunicados',
        href: '/pessoas/comunicados',
        groupId: 'trabalho',
        groupLabel: 'ROTINA DE TRABALHO',
        description: 'Mural interno e minhas ciências',
      },
      {
        id: 'gestao_comunicados',
        label: 'Gestão de Comunicados',
        href: '/sistema/pessoas?tab=comunicados',
        groupId: 'trabalho',
        groupLabel: 'ROTINA DE TRABALHO',
        description: 'Criar comunicados e gerenciar ciências',
        structuralRoles: ['MASTER', 'ADMIN', 'RH', 'SUBSTITUTO'],
        sharedWithId: 'gestao_pessoas',
        sharedNote: 'Compartilha a rota base /sistema/pessoas com Painel de Pessoas',
      },
      {
        id: 'minha_it',
        label: 'Minha IT',
        href: '/minha-it',
        groupId: 'trabalho',
        groupLabel: 'ROTINA DE TRABALHO',
        description: 'Instrução oficial do Responsável Técnico',
      },
    ],
  },
  {
    id: 'pessoas',
    label: 'MEU ESPAÇO',
    items: [
      {
        id: 'ferias',
        label: 'Férias',
        href: '/pessoas/ferias',
        groupId: 'pessoas',
        groupLabel: 'MEU ESPAÇO',
        description: 'Meu saldo e solicitações individuais',
      },
      {
        id: 'holerites',
        label: 'Holerites',
        href: '/pessoas/holerites',
        groupId: 'pessoas',
        groupLabel: 'MEU ESPAÇO',
        description: 'Meus contracheques e comprovantes',
      },
    ],
  },
  {
    id: 'sistema',
    label: 'SISTEMA & TECNOLOGIA',
    items: [
      {
        id: 'central_operacoes',
        label: 'Central de Operações',
        href: '/sistema/operacoes',
        groupId: 'sistema',
        groupLabel: 'SISTEMA & TECNOLOGIA',
        description: 'Saúde, conectividade e observabilidade',
        structuralRoles: ['MASTER', 'ADMIN'],
      },
      {
        id: 'importacao_contingencia',
        label: 'Importação de Contingência',
        href: '/bi/importacoes',
        groupId: 'sistema',
        groupLabel: 'SISTEMA & TECNOLOGIA',
        description: 'Carga manual de contingência',
      },
      {
        id: 'configuracoes',
        label: 'Configurações',
        href: '/configuracoes',
        groupId: 'sistema',
        groupLabel: 'SISTEMA & TECNOLOGIA',
        description: 'Preferências do cartório e integrações',
      },
      {
        id: 'gestao_mensagens',
        label: 'Gestão de Mensagens',
        href: '/administracao/mensagens',
        groupId: 'sistema',
        groupLabel: 'SISTEMA & TECNOLOGIA',
        description: 'Políticas, métricas e governança',
        structuralRoles: ['MASTER', 'ADMIN'],
      },
    ],
  },
  {
    id: 'master',
    label: 'MASTER SAAS',
    isMasterOnly: true,
    items: [
      {
        id: 'cartorios_tenants',
        label: 'Cartórios (Tenants)',
        href: '/master/tenants',
        groupId: 'master',
        groupLabel: 'MASTER SAAS',
        description: 'Gestão multi-tenant da plataforma',
        isMasterOnly: true,
      },
      {
        id: 'mensagens_saas',
        label: 'Mensagens SaaS',
        href: '/master/mensagens',
        groupId: 'master',
        groupLabel: 'MASTER SAAS',
        description: 'Telemetria e volume global de mensageria',
        isMasterOnly: true,
      },
    ],
  },
];

/** Todos os itens planos para busca indexada por id ou href */
export const ALL_NAV_CATALOG_ITEMS: NavCatalogItem[] = NAV_CATALOG_GROUPS.flatMap((g) => g.items);

export const ITEM_BY_ID = new Map<string, NavCatalogItem>(
  ALL_NAV_CATALOG_ITEMS.map((item) => [item.id, item])
);

export const ITEM_BY_HREF = new Map<string, NavCatalogItem>(
  ALL_NAV_CATALOG_ITEMS.map((item) => [item.href, item])
);

/**
 * Papéis editáveis no modo PERFIL (conforme schema real, excluindo MASTER)
 */
export const EDITABLE_ROLES: Array<{ role: string; label: string }> = [
  { role: 'ADMIN', label: 'Administrador (ADMIN)' },
  { role: 'SUBSTITUTO', label: 'Oficial Substituto (SUBSTITUTO)' },
  { role: 'RH', label: 'Recursos Humanos (RH)' },
  { role: 'USER', label: 'Operador Padrão (USER)' },
  { role: 'COLABORADOR', label: 'Colaborador de Cartório (COLABORADOR)' },
];

/**
 * Avalia se o item possui guarda estrutural no servidor que impede a concessão para o papel dado.
 */
export function checkStructuralRestriction(
  item: NavCatalogItem,
  role: string
): { isBlocked: boolean; reason?: string } {
  if (item.isMasterOnly) {
    if (role !== 'MASTER') {
      return {
        isBlocked: true,
        reason: 'Recurso exclusivo do MASTER da plataforma.',
      };
    }
  }

  if (item.isProtected) {
    return {
      isBlocked: true,
      reason: 'Recurso essencial do sistema; acesso protegido.',
    };
  }

  if (item.structuralRoles && item.structuralRoles.length > 0) {
    const isAllowed = item.structuralRoles.includes(role) || role === 'MASTER';
    if (!isAllowed) {
      return {
        isBlocked: true,
        reason: `Bloqueado pelo sistema: a rota exige perfil [${item.structuralRoles.join(', ')}] no servidor.`,
      };
    }
  }

  return { isBlocked: false };
}
