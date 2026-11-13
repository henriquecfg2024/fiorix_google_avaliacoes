import { getHomeRouteForRole } from '@/lib/permissions';
import { ALL_NAV_CATALOG_ITEMS, ITEM_BY_ID } from './catalog';
import { NavCatalogItem } from './types';

export const PREFIX_SORTED_CATALOG_ITEMS: NavCatalogItem[] = ALL_NAV_CATALOG_ITEMS
  .filter((item) => !item.href.includes('#'))
  .slice()
  .sort((a, b) => {
    const baseA = a.href.split('?')[0].replace(/\/+$/, '') || '/';
    const baseB = b.href.split('?')[0].replace(/\/+$/, '') || '/';
    return baseB.length - baseA.length;
  });

/**
 * Resolve a primeira rota permitida a partir da lista já calculada de allowedItemIds,
 * evitando consultas SQL ou Server Actions duplicadas.
 */
export function resolveFirstAllowedRouteFromAllowedIds(
  role: string,
  allowedItemIds: string[],
  enabled: boolean = true
): string {
  const defaultRoleHome = getHomeRouteForRole(role);

  if (!enabled || role === 'MASTER') {
    return defaultRoleHome;
  }

  const allowedSet = new Set(allowedItemIds);

  // 1. Se a rota canônica do perfil estiver permitida, prioriza-a
  if (defaultRoleHome === '/sistema/pessoas') {
    const rhHomeItem = ['gestao_comunicados', 'rh_ferias', 'rh_holerites']
      .map((id) => ITEM_BY_ID.get(id))
      .find((item) => item && allowedSet.has(item.id));
    if (rhHomeItem) {
      return rhHomeItem.href;
    }
  }
  const roleHomeItem = ALL_NAV_CATALOG_ITEMS.find(
    (item) => item.href === defaultRoleHome || item.href.split('?')[0] === defaultRoleHome
  );
  if (roleHomeItem && allowedSet.has(roleHomeItem.id)) {
    return roleHomeItem.href;
  }

  // 2. Se o menu Início (/dashboard) estiver permitido, utiliza-o
  if (allowedSet.has('inicio')) {
    return '/dashboard';
  }

  // 3. Caso contrário, retorna o primeiro módulo permitido na ordem do catálogo
  const firstAllowedItem = ALL_NAV_CATALOG_ITEMS.find(
    (item) => !item.isMasterOnly && allowedSet.has(item.id)
  );
  if (firstAllowedItem) {
    return firstAllowedItem.href;
  }

  // 4. Fallback seguro sempre acessível caso nenhum menu esteja ativo
  return '/minha-conta';
}

/**
 * Avalia localmente (client-safe) se uma rota é permitida a partir dos allowedItemIds
 * já carregados para o usuário, mantendo paridade exata com isRouteAllowedForUser no servidor.
 */
export function evaluateRouteAccessFromAllowedIds(params: {
  pathname: string;
  role: string;
  enabled: boolean;
  allowedItemIds: string[];
}): { allowed: boolean; fallbackHref: string } {
  const { pathname, role, enabled, allowedItemIds } = params;

  if (!enabled || role === 'MASTER') {
    return { allowed: true, fallbackHref: pathname };
  }

  const rawPath = String(pathname || '').trim();
  const cleanPath = rawPath.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  // Rotas utilitárias explícitas para qualquer sessão autenticada válida
  if (
    cleanPath === '/' ||
    cleanPath === '/minha-conta' ||
    cleanPath === '/meu-perfil' ||
    cleanPath === '/sem-acesso'
  ) {
    return { allowed: true, fallbackHref: pathname };
  }

  const fallbackHref = resolveFirstAllowedRouteFromAllowedIds(role, allowedItemIds, enabled);

  // Espaço exclusivo MASTER (incluindo subrotas fora do catálogo do cliente)
  if (
    cleanPath === '/master' ||
    cleanPath.startsWith('/master/') ||
    cleanPath === '/configuracoes/grupos-permissoes' ||
    cleanPath.startsWith('/configuracoes/grupos-permissoes/')
  ) {
    return { allowed: false, fallbackHref };
  }

  const allowedSet = new Set(allowedItemIds);
  const anyAllowed = (ids: string[]) => ids.some((id) => allowedSet.has(id));

  let allowed: boolean | null = null;

  if (cleanPath === '/instrucoes-trabalho' || cleanPath.startsWith('/instrucoes-trabalho/')) {
    allowed = anyAllowed(['minha_it', 'gestao_its']);
  } else if (cleanPath === '/visualizador-documental' || cleanPath.startsWith('/visualizador-documental/')) {
    allowed = anyAllowed(['visualizador_documental']);
  } else if (cleanPath === '/bi/importar' || cleanPath.startsWith('/bi/importar/')) {
    allowed = anyAllowed(['importacao_contingencia']);
  } else if (cleanPath === '/jornada' || cleanPath.startsWith('/jornada/')) {
    allowed = anyAllowed(['rastreio']);
  } else if (
    cleanPath === '/sistema/pessoas' ||
    cleanPath === '/administracao/rh' ||
    cleanPath.startsWith('/administracao/rh/')
  ) {
    allowed = anyAllowed(['gestao_comunicados', 'rh_ferias', 'rh_holerites']);
  } else if (cleanPath === '/sistema/pessoas/usuarios' || cleanPath.startsWith('/sistema/pessoas/usuarios/')) {
    allowed = anyAllowed(['configuracoes']);
  } else if (
    (cleanPath === '/configuracoes/departamentos' ||
      cleanPath.startsWith('/configuracoes/departamentos/')) &&
    role === 'RH'
  ) {
    allowed = anyAllowed(['configuracoes', 'gestao_comunicados', 'rh_ferias', 'rh_holerites']);
  } else if (cleanPath === '/pessoas') {
    allowed = anyAllowed(['comunicados', 'minha_it', 'ferias', 'holerites']);
  } else if (
    cleanPath === '/relatorios/imprimir-colaboradores' ||
    cleanPath.startsWith('/relatorios/imprimir-colaboradores/')
  ) {
    allowed = anyAllowed(['configuracoes', 'gestao_comunicados', 'rh_ferias', 'rh_holerites']);
  } else if (cleanPath === '/relatorios/imprimir-mensal' || cleanPath.startsWith('/relatorios/imprimir-mensal/')) {
    allowed = anyAllowed(['relatorios']);
  } else if (cleanPath === '/preview-visao-consolidada' || cleanPath.startsWith('/preview-visao-consolidada/')) {
    allowed = anyAllowed(['inicio']);
  } else if (
    cleanPath === '/gestao/rh/instrucoes-trabalho-monitoramento' ||
    cleanPath.startsWith('/gestao/rh/instrucoes-trabalho-monitoramento/')
  ) {
    allowed = anyAllowed(['gestao_its']);
  } else {
    const matchingItem = PREFIX_SORTED_CATALOG_ITEMS.find((item) => {
      const baseHref = item.href.split('?')[0].replace(/\/+$/, '') || '/';
      if (baseHref === '/') return cleanPath === '/';
      return cleanPath === baseHref || cleanPath.startsWith(`${baseHref}/`);
    });
    allowed = matchingItem ? allowedSet.has(matchingItem.id) : false;
  }

  return allowed
    ? { allowed: true, fallbackHref: pathname }
    : { allowed: false, fallbackHref };
}

