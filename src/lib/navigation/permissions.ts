import { navigationGroups } from "@/components/fiorix/navigation";

export type Role = string;

export function filterNavigationByRole(role: Role = "USER") {
  const isColaborador = role === "COLABORADOR";
  const isRH = role === "RH";
  const isUser = role === "USER";

  const filteredGroups: Record<string, any> = {};

  for (const [key, group] of Object.entries(navigationGroups)) {
    // COLABORADOR: Apenas PESSOAS & RH
    if (isColaborador && key !== "pessoas") continue;

    // RH: Apenas PESSOAS & RH (inclui Painel RH)
    if (isRH && key !== "pessoas") continue;

    // USER: Não tem acesso a SISTEMA & INFRA
    if (isUser && key === "sistema") continue;

    const visibleItems = group.items.filter((item) => {
      if (isColaborador) {
        return (
          item.href.startsWith("/pessoas") ||
          item.href === "/minha-it"
        );
      }
      if (isRH) {
        return (
          item.href.startsWith("/pessoas") ||
          item.href === "/sistema/pessoas" ||
          item.href === "/minha-it" ||
          item.href === "/gestao/rh/instrucoes-trabalho-monitoramento" ||
          item.href === "/administracao/its"
        );
      }
      if (isUser) {
        if (
          item.href === "/bi/auditoria" ||
          item.href === "/bi/importacoes" ||
          item.href === "/configuracoes" ||
          item.href === "/gestao/rh/instrucoes-trabalho-monitoramento" ||
          item.href.startsWith("/sistema") ||
          item.href.startsWith("/configuracoes")
        ) {
          return false;
        }
        return true;
      }
      return true; // ADMIN and MASTER see everything
    });

    if (visibleItems.length > 0) {
      filteredGroups[key] = {
        ...group,
        items: visibleItems,
      };
    }
  }

  return filteredGroups;
}
