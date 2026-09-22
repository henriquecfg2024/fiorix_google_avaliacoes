import { navigationGroups } from "@/components/fiorix/navigation";

export type Role = string;

type NavGroup = (typeof navigationGroups)[keyof typeof navigationGroups];

export function filterNavigationByRole(role: Role = "USER") {
  const isColaborador = role === "COLABORADOR";
  const isRH = role === "RH";
  const isSubstituto = role === "SUBSTITUTO";
  const isUser = role === "USER";

  const filteredGroups: Record<string, NavGroup> = {};

  for (const [key, group] of Object.entries(navigationGroups)) {
    // MASTER: Apenas o MASTER vê o grupo 'master'
    if (key === "master" && role !== "MASTER") continue;

    // COLABORADOR: vê 'pessoas' (Férias+Holerites) e 'trabalho' (Comunicados+MinhaIT+Trajetória)
    // Opção A: 'trabalho' é visível a todos os perfis que tinham acesso a Comunicados/Minha IT
    if (isColaborador && key !== "pessoas" && key !== "trabalho") continue;

    // RH: 'rhGestao', 'pessoas' e 'trabalho' (Opção A — Comunicados e Minha IT migrados)
    if (isRH && key !== "rhGestao" && key !== "pessoas" && key !== "trabalho") continue;

    // SUBSTITUTO: vê governancaIts, operacional, gestao, pessoas e trabalho; não vê rhGestao nem sistema
    if (isSubstituto && (key === "rhGestao" || key === "sistema")) continue;

    // USER: não vê SISTEMA & TECNOLOGIA, PESSOAS & RH nem INSTRUÇÕES DE TRABALHO; mas vê 'trabalho' (Opção A)
    if (isUser && (key === "sistema" || key === "rhGestao" || key === "governancaIts")) continue;

    const visibleItems = group.items.filter((item) => {
      // Gestão de Comunicados em 'trabalho' oculto para RH (acesso feito pelo Painel RH / Gestão de Pessoas);
      // visível apenas para liderança (SUBSTITUTO, ADMIN, MASTER, GESTOR)
      if (key === "trabalho" && (item.href === "/sistema/pessoas?tab=comunicados" || item.label === "Gestão de Comunicados")) {
        if (isRH) return false;
        return isSubstituto || role === "ADMIN" || role === "MASTER" || role === "GESTOR";
      }

      // COLABORADOR: 'pessoas' mostra só Férias e Holerites (Comunicados/MinhaIT estão em 'trabalho')
      if (isColaborador && key === "pessoas") {
        return (
          item.href.startsWith("/pessoas/ferias") ||
          item.href.startsWith("/pessoas/holerites")
        );
      }

      if (isRH) {
        // RH tem acesso aos itens de rhGestao, pessoas e trabalho
        return true;
      }
      if (isSubstituto) {
        // Substituto tem acesso pleno a governancaIts, pessoas, operacional, gestao e trabalho
        return true;
      }
      if (isUser) {
        if (
          item.href === "/bi/auditoria" ||
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
      return true; // ADMIN, MASTER e COLABORADOR em 'trabalho' veem tudo
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
