import { navigationGroups } from "@/components/fiorix/navigation";

export type Role = string;

type NavGroup = (typeof navigationGroups)[keyof typeof navigationGroups];

export function filterNavigationByRole(
  role: Role = "USER",
  allowedItemIds?: string[]
) {
  // Se allowedItemIds foi fornecido dinamicamente (Feature Flag ativa no servidor)
  if (Array.isArray(allowedItemIds)) {
    const isMaster = role === "MASTER";
    const allowedSet = new Set(allowedItemIds);
    const filteredGroups: Record<string, NavGroup> = {};

    for (const [key, group] of Object.entries(navigationGroups)) {
      if (key === "master" && !isMaster) continue;

      const visibleItems = group.items.filter((item: any) => {
        if (!item.id) return false;
        return allowedSet.has(item.id);
      });

      const isGroupHrefAllowed = (group as any).href
        ? allowedSet.has(key) || visibleItems.length > 0
        : false;

      if (visibleItems.length > 0 || isGroupHrefAllowed) {
        filteredGroups[key] = {
          ...group,
          items: visibleItems,
        };
      }
    }

    return filteredGroups;
  }

  const isColaborador = role === "COLABORADOR";
  const isRH = role === "RH";
  const isSubstituto = role === "SUBSTITUTO" || role === "VISITANTE";
  const isUser = role === "USER";

  const filteredGroups: Record<string, NavGroup> = {};

  for (const [key, group] of Object.entries(navigationGroups)) {
    // MASTER: Apenas o MASTER vê o grupo 'master'
    if (key === "master" && role !== "MASTER") continue;
    if (key === "documental" && !["ADMIN", "MASTER", "SUBSTITUTO", "VISITANTE"].includes(role)) continue;

    // COLABORADOR: vê 'operacional', 'comunicacaoInterna' e 'pessoas' (MEU ESPAÇO)
    if (
      isColaborador &&
      key !== "pessoas" &&
      key !== "comunicacaoInterna" &&
      key !== "operacional"
    )
      continue;

    // RH: vê 'comunicacaoInterna', 'trabalho' (RECURSOS HUMANOS: Comunicados, Férias, Holerites) e 'pessoas' (MEU ESPAÇO)
    if (
      isRH &&
      key !== "pessoas" &&
      key !== "comunicacaoInterna" &&
      key !== "trabalho"
    )
      continue;

    // SUBSTITUTO / VISITANTE: não vê sistema
    if (isSubstituto && key === "sistema") continue;

    // USER: não vê SISTEMA & TECNOLOGIA, INSTRUÇÕES DE TRABALHO nem RECURSOS HUMANOS (gestão)
    if (isUser && (key === "sistema" || key === "governancaIts" || key === "trabalho")) continue;

    const visibleItems = group.items.filter((item) => {
      // Itens de gestão em RECURSOS HUMANOS ('trabalho')
      if (key === "trabalho") {
        if (isRH || role === "ADMIN" || role === "MASTER" || role === "GESTOR") {
          return true;
        }
        if (isSubstituto) {
          return (item as any).id === "gestao_comunicados";
        }
        return false;
      }

      // Rastreio oculto para RH
      if (isRH && (item.href === "/trajetoria-titulo" || item.label === "Rastreio" || item.label === "Rastreio do Título")) {
        return false;
      }

      // COLABORADOR: em 'operacional' vê Rastreio, Impressões e Espera; em 'pessoas' vê todo MEU ESPAÇO
      if (isColaborador) {
        if (key === "operacional") {
          return (
            item.href === "/trajetoria-titulo" ||
            item.href === "/controle-impressoes" ||
            item.href === "/espera"
          );
        }
        if (key === "pessoas") {
          return (
            item.href.startsWith("/pessoas/comunicados") ||
            item.href === "/minha-it" ||
            item.href.startsWith("/pessoas/ferias") ||
            item.href.startsWith("/pessoas/holerites")
          );
        }
      }

      if (isRH) {
        return true;
      }
      if (isSubstituto) {
        return true;
      }
      // Espera oculto para perfil USER (exclusivo para liderança e colaboradores)
      if (isUser && item.href === "/espera") {
        return false;
      }

      if (isUser) {
        if (
          item.href === "/espera" ||
          item.href === "/bi/importacoes" ||
          item.href === "/configuracoes" ||
          item.href.startsWith("/administracao") ||
          item.href.startsWith("/sistema") ||
          item.href.startsWith("/configuracoes")
        ) {
          return false;
        }
        return true;
      }
      return true;
    });

    if (visibleItems.length > 0 || Boolean((group as any).href)) {
      filteredGroups[key] = {
        ...group,
        items: visibleItems,
      };
    }
  }

  return filteredGroups;
}
