/**
 * Avaliadores Puros de Competência Funcional, Registral e Isolamento Multi-Serventia (Seção 14)
 *
 * Princípio inegociável:
 * Permissão técnica de sistema (ADMIN / MASTER) NÃO confere automaticamente fé pública,
 * delegação ou competência registral para aprovar revisão humana, dispensar conferência
 * ou solicitar assinatura de certidão.
 */

import type { CapacidadeCartorioVirtual, PapelRegistral } from "./types";

export interface RegistroAutorizacaoRegistral {
  papelRegistral: PapelRegistral;
  ativo: boolean;
  podeConsultar: boolean;
  podeConferir: boolean;
  podeAnotar: boolean;
  podeSolicitarAtualizacao: boolean;
  podeAprovarRevisao: boolean;
  podeImprimir: boolean;
  podeSolicitarAssinatura: boolean;
  podeConfigurarRegras: boolean;
  podeAuditarHistorico: boolean;
  vigenciaInicio?: Date | string | null;
  vigenciaFim?: Date | string | null;
}

/**
 * Matriz padrão por papel funcional/registral quando atribuído formalmente à pessoa.
 */
export function obterMatrizPadraoPapelRegistral(
  papelRegistral: PapelRegistral
): Omit<RegistroAutorizacaoRegistral, "papelRegistral" | "ativo"> {
  switch (papelRegistral) {
    case "OFICIAL":
    case "OFICIAL_SUBSTITUTO":
      return {
        podeConsultar: true,
        podeConferir: true,
        podeAnotar: true,
        podeSolicitarAtualizacao: true,
        podeAprovarRevisao: true,
        podeImprimir: true,
        podeSolicitarAssinatura: true,
        podeConfigurarRegras: true,
        podeAuditarHistorico: true,
      };
    case "ESCREVENTE_AUTORIZADO":
      return {
        podeConsultar: true,
        podeConferir: true,
        podeAnotar: true,
        podeSolicitarAtualizacao: true,
        podeAprovarRevisao: true,
        podeImprimir: true,
        podeSolicitarAssinatura: true,
        podeConfigurarRegras: false,
        podeAuditarHistorico: true,
      };
    case "CONFERENTE":
      return {
        podeConsultar: true,
        podeConferir: true,
        podeAnotar: true,
        podeSolicitarAtualizacao: true,
        podeAprovarRevisao: false,
        podeImprimir: true,
        podeSolicitarAssinatura: false,
        podeConfigurarRegras: false,
        podeAuditarHistorico: false,
      };
    case "AUXILIAR":
      return {
        podeConsultar: true,
        podeConferir: false,
        podeAnotar: true,
        podeSolicitarAtualizacao: true,
        podeAprovarRevisao: false,
        podeImprimir: true,
        podeSolicitarAssinatura: false,
        podeConfigurarRegras: false,
        podeAuditarHistorico: false,
      };
    case "SEM_ATRIBUICAO_REGISTRAL":
    default:
      return {
        podeConsultar: true,
        podeConferir: false,
        podeAnotar: false,
        podeSolicitarAtualizacao: false,
        podeAprovarRevisao: false,
        podeImprimir: false,
        podeSolicitarAssinatura: false,
        podeConfigurarRegras: false,
        podeAuditarHistorico: false,
      };
  }
}

/**
 * Avaliador puro e determinístico de capacidades efetivas (testável isoladamente).
 */
export function avaliarAutorizacaoCartorioVirtual(params: {
  papelSistema: string;
  atorTipo?: "HUMANO" | "AGENTE_VIRTUAL";
  autorizacaoRegistral?: RegistroAutorizacaoRegistral | null;
  agora?: Date;
}): {
  papelRegistral: PapelRegistral;
  capacidades: CapacidadeCartorioVirtual[];
} {
  const {
    papelSistema,
    atorTipo = "HUMANO",
    autorizacaoRegistral,
    agora = new Date(),
  } = params;

  // Vedação absoluta (Seções 1, 11 e 14): agentes de software JAMAIS possuem competência
  // para aprovar revisão humana ou solicitar assinatura.
  if (atorTipo === "AGENTE_VIRTUAL") {
    return {
      papelRegistral: "SEM_ATRIBUICAO_REGISTRAL",
      capacidades: ["consultar", "conferir", "anotar", "solicitar_atualizacao"],
    };
  }

  const capacidadesSet = new Set<CapacidadeCartorioVirtual>();
  const roleUpper = String(papelSistema || "USER").toUpperCase();

  // Capacidades estritamente técnicas de governança de plataforma para ADMIN / MASTER:
  // permitem configurar integrações/regras e auditar histórico técnico, mas NUNCA
  // aprovar revisão registral ou solicitar assinatura sem outorga registral explícita.
  if (roleUpper === "ADMIN" || roleUpper === "MASTER") {
    capacidadesSet.add("consultar");
    capacidadesSet.add("configurar_regras");
    capacidadesSet.add("auditar_historico");
  } else if (["SUBSTITUTO", "USER", "COLABORADOR", "VISITANTE"].includes(roleUpper)) {
    capacidadesSet.add("consultar");
  }

  if (!autorizacaoRegistral || !autorizacaoRegistral.ativo) {
    return {
      papelRegistral: "SEM_ATRIBUICAO_REGISTRAL",
      capacidades: Array.from(capacidadesSet),
    };
  }

  // Valida janela de vigência da portaria/autorização registral
  if (autorizacaoRegistral.vigenciaInicio) {
    const inicio = new Date(autorizacaoRegistral.vigenciaInicio);
    if (!Number.isNaN(inicio.getTime()) && agora < inicio) {
      return {
        papelRegistral: "SEM_ATRIBUICAO_REGISTRAL",
        capacidades: Array.from(capacidadesSet),
      };
    }
  }
  if (autorizacaoRegistral.vigenciaFim) {
    const fim = new Date(autorizacaoRegistral.vigenciaFim);
    if (!Number.isNaN(fim.getTime()) && agora > fim) {
      return {
        papelRegistral: "SEM_ATRIBUICAO_REGISTRAL",
        capacidades: Array.from(capacidadesSet),
      };
    }
  }

  if (autorizacaoRegistral.podeConsultar) capacidadesSet.add("consultar");
  if (autorizacaoRegistral.podeConferir) capacidadesSet.add("conferir");
  if (autorizacaoRegistral.podeAnotar) capacidadesSet.add("anotar");
  if (autorizacaoRegistral.podeSolicitarAtualizacao) {
    capacidadesSet.add("solicitar_atualizacao");
  }
  if (autorizacaoRegistral.podeImprimir) capacidadesSet.add("imprimir");
  if (autorizacaoRegistral.podeConfigurarRegras) capacidadesSet.add("configurar_regras");
  if (autorizacaoRegistral.podeAuditarHistorico) capacidadesSet.add("auditar_historico");

  // Dupla trava para atos privativos de pessoa autorizada (Seção 14)
  const papeisComFeOuDelegacao: PapelRegistral[] = [
    "OFICIAL",
    "OFICIAL_SUBSTITUTO",
    "ESCREVENTE_AUTORIZADO",
  ];
  if (
    autorizacaoRegistral.podeAprovarRevisao &&
    papeisComFeOuDelegacao.includes(autorizacaoRegistral.papelRegistral)
  ) {
    capacidadesSet.add("aprovar_revisao");
  }
  if (
    autorizacaoRegistral.podeSolicitarAssinatura &&
    papeisComFeOuDelegacao.includes(autorizacaoRegistral.papelRegistral)
  ) {
    capacidadesSet.add("solicitar_assinatura");
  }

  return {
    papelRegistral: autorizacaoRegistral.papelRegistral,
    capacidades: Array.from(capacidadesSet),
  };
}

export function validarIsolamentoTenantRecurso(params: {
  userTenantId: string;
  recursoTenantId: string;
}): { permitido: boolean; motivo?: string } {
  if (!params.userTenantId || !params.recursoTenantId) {
    return {
      permitido: false,
      motivo: "Identificador de serventia (tenantId) ausente na verificação de acesso.",
    };
  }
  if (params.userTenantId !== params.recursoTenantId) {
    return {
      permitido: false,
      motivo:
        "Violação de isolamento entre serventias: o recurso pertence a outra serventia e não pode ser acessado.",
    };
  }
  return { permitido: true };
}

