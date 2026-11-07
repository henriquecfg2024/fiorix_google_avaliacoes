/**
 * Motor Determinístico de Regras de Conferência, Contraditório, Atualização de Matrícula
 * e Modo de Comparação do Piloto (Seções 6, 10, 14 e 23).
 */

import { createHash } from "crypto";
import type {
  ConferenciaPedidoDTO,
  EstadoOperacionalPedido,
  PrenotacaoContraditorio,
  SnapshotAcervoMatricula,
} from "./types";

export const MODELO_PADRAO_PRENOTACAO_TRAMITACAO_V1 =
  "CERTIFICO, outrossim, que revendo o Livro 1 - Protocolo (Contraditório), consta(m) em tramitação referente(s) ao imóvel desta matrícula a(s) seguinte(s) prenotação(ões), ainda pendente(s) de qualificação/registro até a presente data: {{LISTA_PRENOTACOES}}.";

/**
 * Gera hash SHA-256 canônico sobre os dados-fonte relevantes para invalidar automaticamente
 * conferências ou aprovações anteriores caso ocorra nova prenotação, ato ou redigitalização (Seção 12 & 14).
 */
export function gerarHashVersaoDadosFonte(params: {
  tenantId: string;
  numeroPedido: string;
  itens: Array<{
    sequenciaItem: number;
    numeroMatricula: number | null;
    naturezaDescricao: string;
  }>;
  prenotacoes: PrenotacaoContraditorio[];
  acervos: SnapshotAcervoMatricula[];
}): string {
  const payload = JSON.stringify({
    t: params.tenantId,
    p: params.numeroPedido,
    i: params.itens.map((x) => [x.sequenciaItem, x.numeroMatricula, x.naturezaDescricao]),
    pr: params.prenotacoes.map((x) => [
      x.numeroPrenotacao,
      x.dataApresentacaoIso,
      x.naturezaTitulo,
      x.emProcessamentoAtoNaMatricula,
      x.etapaAtual,
    ]),
    ac: params.acervos.map((a) => [
      a.numeroMatricula,
      a.vinculadaServentia,
      a.possuiArquivoDigitalizado,
      a.ultimaAtualizacaoAtosIso,
      a.ultimaDigitalizacaoIso,
      a.integraEAtualizada,
    ]),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function detectarMudancaMaterialPedido(
  hashConferenciaOuAprovacaoAnterior: string | null | undefined,
  hashDadosAtuais: string
): boolean {
  if (!hashConferenciaOuAprovacaoAnterior) return false;
  return hashConferenciaOuAprovacaoAnterior !== hashDadosAtuais;
}

export function renderizarTextoCertificacaoPrenotacoes(
  prenotacoes: PrenotacaoContraditorio[],
  templateTexto: string = MODELO_PADRAO_PRENOTACAO_TRAMITACAO_V1
): string {
  const listaFmt = prenotacoes
    .map(
      (p) =>
        `Prenotação nº ${p.numeroPrenotacao}, apresentada em ${p.dataApresentacaoBr} (${p.naturezaTitulo})`
    )
    .join("; ");
  return templateTexto.replace("{{LISTA_PRENOTACOES}}", listaFmt);
}

export interface ResultadoAvaliacaoRegras {
  identificacaoStatus: ConferenciaPedidoDTO["identificacaoStatus"];
  vinculoServentia: boolean;
  contraditorioStatus: ConferenciaPedidoDTO["contraditorioStatus"];
  atualidadeMatriculaStatus: ConferenciaPedidoDTO["atualidadeMatriculaStatus"];
  decisaoProposta: ConferenciaPedidoDTO["decisaoProposta"];
  estadoSugerido: EstadoOperacionalPedido;
  pausarPorAtoProcessamento: boolean;
  prenotacaoBloqueante: string | null;
  textoCertidaoSugerido: string | null;
  pendenciasGeradas: Array<{
    tipoPendencia:
      | "ATO_EM_PROCESSAMENTO"
      | "ATUALIZACAO_MATRICULA"
      | "DIGITALIZACAO_ACERVO"
      | "PESQUISA_ENDERECO"
      | "TRANSCRICAO_LOTEAMENTO"
      | "DIVERGENCIA_CADASTRO";
    titulo: string;
    descricao: string;
    prenotacaoRef?: string | null;
    numeroMatricula?: number | null;
  }>;
}

/**
 * Aplica determinísticamente as Regras 6.1, 6.2, 6.3 e 6.4 para um pedido/item de certidão.
 */
export function executarRegrasConferenciaPedido(params: {
  elegivelPiloto: boolean;
  criterioSolicitacao: string;
  motivoEncaminhamentoHumano?: string | null;
  numeroMatricula: number | null;
  acervo: SnapshotAcervoMatricula | null;
  contraditorioDisponivel: boolean;
  prenotacoes: PrenotacaoContraditorio[];
  templatePrenotacaoTramitacao?: string;
}): ResultadoAvaliacaoRegras {
  const pendenciasGeradas: ResultadoAvaliacaoRegras["pendenciasGeradas"] = [];

  // 1. Subtipos fora do escopo automático inicial ou critérios por endereço/transcrição/loteamento
  if (!params.elegivelPiloto || !params.numeroMatricula) {
    if (params.criterioSolicitacao === "ENDERECO") {
      pendenciasGeradas.push({
        tipoPendencia: "PESQUISA_ENDERECO",
        titulo: "Pesquisa assistida de endereço no Indicador Real",
        descricao:
          params.motivoEncaminhamentoHumano ||
          "Pedido formulado por endereço exige pesquisa assistida nos livros e indicadores da serventia.",
      });
    } else if (
      params.criterioSolicitacao === "TRANSCRICAO" ||
      params.criterioSolicitacao === "LOTEAMENTO"
    ) {
      pendenciasGeradas.push({
        tipoPendencia: "TRANSCRICAO_LOTEAMENTO",
        titulo: `Análise assistida de ${params.criterioSolicitacao === "LOTEAMENTO" ? "loteamento" : "transcrição"}`,
        descricao:
          params.motivoEncaminhamentoHumano ||
          "Acervo exige conferência manual específica antes de qualquer certificação.",
      });
    } else {
      pendenciasGeradas.push({
        tipoPendencia: "DIVERGENCIA_CADASTRO",
        titulo: "Subtipo ou identificação pendente de confirmação humana",
        descricao:
          params.motivoEncaminhamentoHumano ||
          "Não foi possível confirmar automaticamente o subtipo Inteiro Teor por matrícula.",
      });
    }

    return {
      identificacaoStatus: params.numeroMatricula ? "ENCAMINHADA_HUMANO" : "INCOMPLETA",
      vinculoServentia: false,
      contraditorioStatus: "INCONCLUSIVO",
      atualidadeMatriculaStatus: "VERIFICACAO_MANUAL",
      decisaoProposta: "ENCAMINHAR_REVISAO_HUMANA",
      estadoSugerido: "EM_REVISAO_HUMANA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido: null,
      pendenciasGeradas,
    };
  }

  // 2. Regra 6.1: Conferência de existência e vínculo da matrícula com a serventia
  if (!params.acervo || !params.acervo.possuiRegistroEstruturado) {
    pendenciasGeradas.push({
      tipoPendencia: "DIVERGENCIA_CADASTRO",
      titulo: `Matrícula nº ${params.numeroMatricula} não localizada na base estruturada`,
      descricao:
        "Matrícula inexistente na base estruturada ou pertencente a outra circunscrição; encaminhada à análise humana sem suposição.",
      numeroMatricula: params.numeroMatricula,
    });
    return {
      identificacaoStatus: "INEXISTENTE",
      vinculoServentia: false,
      contraditorioStatus: "INCONCLUSIVO",
      atualidadeMatriculaStatus: "VERIFICACAO_MANUAL",
      decisaoProposta: "ENCAMINHAR_REVISAO_HUMANA",
      estadoSugerido: "EM_REVISAO_HUMANA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido: null,
      pendenciasGeradas,
    };
  }

  if (!params.acervo.vinculadaServentia) {
    pendenciasGeradas.push({
      tipoPendencia: "DIVERGENCIA_CADASTRO",
      titulo: `Vínculo circunscricional não confirmado — Matrícula nº ${params.numeroMatricula}`,
      descricao:
        "O imóvel necessita validação humana de vínculo com o 7º Registro de Imóveis de São Paulo.",
      numeroMatricula: params.numeroMatricula,
    });
    return {
      identificacaoStatus: "AMBIGUA",
      vinculoServentia: false,
      contraditorioStatus: "INCONCLUSIVO",
      atualidadeMatriculaStatus: "VERIFICACAO_MANUAL",
      decisaoProposta: "ENCAMINHAR_REVISAO_HUMANA",
      estadoSugerido: "EM_REVISAO_HUMANA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido: null,
      pendenciasGeradas,
    };
  }

  // 3. Verifica disponibilidade do Contraditório
  if (!params.contraditorioDisponivel) {
    return {
      identificacaoStatus: "CONFIRMADA",
      vinculoServentia: true,
      contraditorioStatus: "INDISPONIVEL",
      atualidadeMatriculaStatus: params.acervo.integraEAtualizada
        ? "INTEGRA_ATUALIZADA"
        : "VERIFICACAO_MANUAL",
      decisaoProposta: "ENCAMINHAR_REVISAO_HUMANA",
      estadoSugerido: "COM_FALHA_OU_PENDENCIA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido: null,
      pendenciasGeradas: [
        {
          tipoPendencia: "DIVERGENCIA_CADASTRO",
          titulo: "Consulta ao Contraditório indisponível no momento",
          descricao:
            "Não é permitido declarar matrícula apta para emissão sem confirmação real do Contraditório.",
          numeroMatricula: params.numeroMatricula,
        },
      ],
    };
  }

  // 4. Regra 6.3: Ato registral em processamento referente à matrícula -> PAUSA OBRIGATÓRIA
  const atoEmProcessamento = params.prenotacoes.find((p) => p.emProcessamentoAtoNaMatricula);
  if (atoEmProcessamento) {
    pendenciasGeradas.push({
      tipoPendencia: "ATO_EM_PROCESSAMENTO",
      titulo: `Ato registral em processamento — Prenotação nº ${atoEmProcessamento.numeroPrenotacao}`,
      descricao: `Pedido pausado (Regra 6.3): aguardar conclusão do ato (${atoEmProcessamento.naturezaTitulo} — etapa: ${atoEmProcessamento.etapaAtual}), lançamento na matrícula nº ${params.numeroMatricula}, atualização da imagem/PDF no acervo e nova conferência.`,
      prenotacaoRef: atoEmProcessamento.numeroPrenotacao,
      numeroMatricula: params.numeroMatricula,
    });

    return {
      identificacaoStatus: "CONFIRMADA",
      vinculoServentia: true,
      contraditorioStatus: "ATO_EM_PROCESSAMENTO",
      atualidadeMatriculaStatus: "PENDENTE_ATUALIZACAO",
      decisaoProposta: "PAUSAR_POR_ATO_EM_PROCESSAMENTO",
      estadoSugerido: "AGUARDANDO_ATUALIZACAO_MATRICULA",
      pausarPorAtoProcessamento: true,
      prenotacaoBloqueante: atoEmProcessamento.numeroPrenotacao,
      textoCertidaoSugerido: null,
      pendenciasGeradas,
    };
  }

  // 5. Regra 6.4: Matrícula desatualizada ou sem imagem/PDF digitalizado íntegro no acervo
  if (!params.acervo.possuiArquivoDigitalizado || !params.acervo.integraEAtualizada) {
    const faltaImagem = !params.acervo.possuiArquivoDigitalizado;
    pendenciasGeradas.push({
      tipoPendencia: faltaImagem ? "DIGITALIZACAO_ACERVO" : "ATUALIZACAO_MATRICULA",
      titulo: faltaImagem
        ? `Matrícula nº ${params.numeroMatricula} pendente de digitalização no Livro 2`
        : `Matrícula nº ${params.numeroMatricula} com atos pendentes de consolidação/imagem`,
      descricao:
        params.acervo.pendenciaDetectada ||
        "A matrícula precisa estar integralmente atualizada e digitalizada antes de prosseguir à aptidão de emissão.",
      numeroMatricula: params.numeroMatricula,
    });

    return {
      identificacaoStatus: "CONFIRMADA",
      vinculoServentia: true,
      contraditorioStatus:
        params.prenotacoes.length > 0 ? "PRENOTACAO_EM_TRAMITACAO" : "NADA_CONSTA",
      atualidadeMatriculaStatus: faltaImagem ? "PENDENTE_DIGITALIZACAO" : "PENDENTE_ATUALIZACAO",
      decisaoProposta: "AGUARDAR_ATUALIZACAO_MATRICULA",
      estadoSugerido: "AGUARDANDO_ATUALIZACAO_MATRICULA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido:
        params.prenotacoes.length > 0
          ? renderizarTextoCertificacaoPrenotacoes(
              params.prenotacoes,
              params.templatePrenotacaoTramitacao
            )
          : null,
      pendenciasGeradas,
    };
  }

  // 6. Regra 6.2: Prenotação em tramitação regular -> NÃO impede automaticamente, exige certificação textual aprovada + revisão humana de conferência
  if (params.prenotacoes.length > 0) {
    const textoSugerido = renderizarTextoCertificacaoPrenotacoes(
      params.prenotacoes,
      params.templatePrenotacaoTramitacao
    );
    return {
      identificacaoStatus: "CONFIRMADA",
      vinculoServentia: true,
      contraditorioStatus: "PRENOTACAO_EM_TRAMITACAO",
      atualidadeMatriculaStatus: "INTEGRA_ATUALIZADA",
      decisaoProposta: "APTO_COM_CERTIFICACAO_PRENOTACAO",
      estadoSugerido: "EM_REVISAO_HUMANA",
      pausarPorAtoProcessamento: false,
      prenotacaoBloqueante: null,
      textoCertidaoSugerido: textoSugerido,
      pendenciasGeradas: [],
    };
  }

  // 7. Nada consta no Contraditório + Matrícula confirmada, vinculada, atualizada e digitalizada
  return {
    identificacaoStatus: "CONFIRMADA",
    vinculoServentia: true,
    contraditorioStatus: "NADA_CONSTA",
    atualidadeMatriculaStatus: "INTEGRA_ATUALIZADA",
    decisaoProposta: "APTO_EMISSAO",
    estadoSugerido: "APTO_EMISSAO",
    pausarPorAtoProcessamento: false,
    prenotacaoBloqueante: null,
    textoCertidaoSugerido: null,
    pendenciasGeradas: [],
  };
}

/**
 * Modo de Comparação do Piloto (Seção 10):
 * Compara o resultado proposto pelo FIORIX com o procedimento real realizado pela equipe.
 */
export function avaliarComparacaoPiloto(params: {
  decisaoPropostaFiorix: ConferenciaPedidoDTO["decisaoProposta"] | string | null;
  procedimentoRealEquipe: string | null;
}): {
  statusComparacao: "CONVERGENTE" | "DIVERGENTE" | "AGUARDANDO_EQUIPE";
  divergenciaClassificacao: string | null;
} {
  if (!params.procedimentoRealEquipe || !params.decisaoPropostaFiorix) {
    return { statusComparacao: "AGUARDANDO_EQUIPE", divergenciaClassificacao: null };
  }

  const mapaEquivalencia: Record<string, string[]> = {
    APTO_EMISSAO: ["APTO_EMISSAO", "EMITIDA_NORMALMENTE"],
    APTO_COM_CERTIFICACAO_PRENOTACAO: [
      "APTO_COM_CERTIFICACAO_PRENOTACAO",
      "EMITIDA_COM_PRENOTACAO",
    ],
    PAUSAR_POR_ATO_EM_PROCESSAMENTO: [
      "PAUSAR_POR_ATO_EM_PROCESSAMENTO",
      "RETIDA_POR_ATO_EM_PROCESSAMENTO",
      "RETIDA_PARA_ATUALIZACAO",
    ],
    AGUARDAR_ATUALIZACAO_MATRICULA: [
      "AGUARDAR_ATUALIZACAO_MATRICULA",
      "RETIDA_PARA_ATUALIZACAO",
    ],
    ENCAMINHAR_REVISAO_HUMANA: [
      "ENCAMINHAR_REVISAO_HUMANA",
      "ENCAMINHADA_PESQUISA_ESPECIAL",
      "EMITIDA_COM_PRENOTACAO",
      "RETIDA_PARA_ATUALIZACAO",
    ],
  };

  const aceitos = mapaEquivalencia[params.decisaoPropostaFiorix] || [];
  if (aceitos.includes(params.procedimentoRealEquipe)) {
    return { statusComparacao: "CONVERGENTE", divergenciaClassificacao: null };
  }

  // Classificação analítica da divergência para calibração de regras pelo Oficial/Gestor
  if (
    params.decisaoPropostaFiorix === "APTO_EMISSAO" &&
    (params.procedimentoRealEquipe === "EMITIDA_COM_PRENOTACAO" ||
      params.procedimentoRealEquipe === "APTO_COM_CERTIFICACAO_PRENOTACAO" ||
      params.procedimentoRealEquipe === "RETIDA_POR_ATO_EM_PROCESSAMENTO" ||
      params.procedimentoRealEquipe === "PAUSAR_POR_ATO_EM_PROCESSAMENTO")
  ) {
    return {
      statusComparacao: "DIVERGENTE",
      divergenciaClassificacao: "CRITICA_OMISSAO_CONTRADITORIO",
    };
  }

  return {
    statusComparacao: "DIVERGENTE",
    divergenciaClassificacao: `DIVERGENCIA_FLUXO (${params.decisaoPropostaFiorix} vs ${params.procedimentoRealEquipe})`,
  };
}

