import { navigationGroups } from "@/components/fiorix/navigation";

export type Role = string;

export function filterNavigationByRole(role: Role = "USER") {
  const isColaborador = role === "COLABORADOR";
  const isRH = role === "RH";
  const isSubstituto = role === "SUBSTITUTO";
  const isUser = role === "USER";

  const filteredGroups: Record<string, any> = {};

  for (const [key, group] of Object.entries(navigationGroups)) {
    // COLABORADOR: Apenas o seu Espaço Pessoal
    if (isColaborador && key !== "pessoas") continue;

    // RH: Apenas GESTÃO DE RH e seu Espaço Pessoal (SEM GOVERNANÇA DE ITS)
    if (isRH && key !== "rhGestao" && key !== "pessoas") continue;

    // SUBSTITUTO: Apenas GOVERNANÇA DE ITS, OPERACIONAL & BI, GESTÃO & ANÁLISES e Espaço Pessoal (SEM GESTÃO DE RH / FÉRIAS / HOLERITES ALHEIOS)
    if (isSubstituto && (key === "rhGestao" || key === "sistema")) continue;

    // USER: Não tem acesso a SISTEMA, GESTÃO DE RH nem GOVERNANÇA DE ITS
    if (isUser && (key === "sistema" || key === "rhGestao" || key === "governancaIts")) continue;

    const visibleItems = group.items.filter((item) => {
      if (isColaborador) {
        return (
          item.href.startsWith("/pessoas") ||
          item.href === "/minha-it"
        );
      }
      if (isRH) {
        // RH tem acesso aos itens de rhGestao e pessoas
        return true;
      }
      if (isSubstituto) {
        // Substituto tem acesso pleno a governancaIts, pessoas, operacional e gestao
        return true;
      }
      if (isUser) {
        if (
          item.href === "/bi/auditoria" ||
          item.href === "/bi/importacoes" ||
          item.href === "/configuracoes" ||
          item.href === "/gestao/rh/instrucoes-trabalho-monitoramento" ||
          item.href.startsWith("/administracao") ||
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
