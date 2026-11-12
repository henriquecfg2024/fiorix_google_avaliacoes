/**
 * Desempacotador e Sincronizador Oficial WEBRI -> PostgreSQL (Módulo Cartório Virtual)
 *
 * Recebe os lotes extraídos em modo estritamente SOMENTE LEITURA pelo `fiorix-connector`
 * (`source = 'cartorio_virtual_certidoes'`) a partir do banco oficial `SRVSQL\WEBRI`
 * e popula/atualiza idempotentemente as tabelas `public.fiorix_cv_*` no PostgreSQL,
 * preservando integralmente as conferências (`CONFERIDO` / `DEVOLVIDO`) e marcações visuais
 * realizadas pelos Escreventes no FIORIX.
 */

import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  classificarSubtipoElegibilidadePiloto,
  construirParticipanteSeguro,
  normalizarDataSentinelaSql,
  normalizarNumeroMatriculaSql,
  normalizarProtocoloExternoSql,
} from "./mapping-dictionary";
import {
  executarRegrasConferenciaPedido,
  gerarHashVersaoDadosFonte,
} from "./rules-engine";
import type {
  PrenotacaoContraditorio,
  SnapshotAcervoMatricula,
} from "./types";

function formatarDataBrCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function limparNaturezaWebri(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/<=<=/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolverEspecieENaturezaItem(params: {
  naturezaCodigo: number | null;
  naturezaDescricaoRaw: string | null;
  numeroMatricula: number | null;
  enderecoPesquisa: string | null;
  transcricaoOuLoteamento: string | null;
  nomePesquisado: string | null;
  documentoPesquisado: string | null;
}): {
  especieSolicitada: string;
  naturezaDescricao: string;
  subtipoExplicito: string | null;
} {
  const cod = params.naturezaCodigo;
  const limpo = limparNaturezaWebri(params.naturezaDescricaoRaw);

  // Código 71 no 7º RI = "Incluido por meio Magnetico (M)"
  if (cod === 71) {
    if (params.numeroMatricula) {
      return {
        especieSolicitada: "Certidão de Inteiro Teor da Matrícula",
        naturezaDescricao: "Certidão de Inteiro Teor da Matrícula",
        subtipoExplicito: "INTEIRO_TEOR_MATRICULA",
      };
    }
    if (params.enderecoPesquisa) {
      return {
        especieSolicitada: "Busca por Endereço / Indicador Real",
        naturezaDescricao: "Certidão Solicitada por Endereço (Meio Magnético)",
        subtipoExplicito: null,
      };
    }
    if (params.transcricaoOuLoteamento) {
      return {
        especieSolicitada: "Certidão de Transcrição / Loteamento",
        naturezaDescricao: "Certidão de Transcrição / Loteamento (Meio Magnético)",
        subtipoExplicito: null,
      };
    }
    return {
      especieSolicitada: "Certidão Digital",
      naturezaDescricao: limpo || "Incluído por Meio Magnético (M)",
      subtipoExplicito: null,
    };
  }

  // Código 69 = "Incluido por meio Magnetico (T)" -> Transcrição
  if (cod === 69 || limpo.includes("(T)")) {
    return {
      especieSolicitada: "Certidão de Transcrição / Loteamento",
      naturezaDescricao: "Certidão de Transcrição das Transmissões",
      subtipoExplicito: null,
    };
  }

  // Código 76 = "Incluido por meio Magnetico (P)" ou 51 = "Certidão de Propriedade"
  if (cod === 76 || cod === 51 || limpo.toLowerCase().includes("propriedade")) {
    return {
      especieSolicitada: "Certidão de Propriedade",
      naturezaDescricao: "Certidão de Propriedade (Indicador Pessoal)",
      subtipoExplicito: null,
    };
  }

  // Código 63 = "Certidão Digital"
  if (cod === 63) {
    if (params.numeroMatricula) {
      return {
        especieSolicitada: "Certidão de Inteiro Teor da Matrícula",
        naturezaDescricao: "Certidão de Inteiro Teor da Matrícula (Digital)",
        subtipoExplicito: "INTEIRO_TEOR_MATRICULA",
      };
    }
    return {
      especieSolicitada: "Certidão Digital",
      naturezaDescricao: "Certidão Digital",
      subtipoExplicito: null,
    };
  }

  if (limpo) {
    return {
      especieSolicitada: limpo,
      naturezaDescricao: limpo,
      subtipoExplicito: limpo.toLowerCase().includes("inteiro teor")
        ? "INTEIRO_TEOR_MATRICULA"
        : null,
    };
  }

  return {
    especieSolicitada: params.numeroMatricula
      ? "Certidão de Inteiro Teor da Matrícula"
      : "Certidão Registral",
    naturezaDescricao: params.numeroMatricula
      ? "Certidão de Inteiro Teor da Matrícula"
      : "Certidão Registral",
    subtipoExplicito: params.numeroMatricula ? "INTEIRO_TEOR_MATRICULA" : null,
  };
}

async function garantirRegrasPadraoTenant(tenantId: string): Promise<void> {
  const count = await prisma.fiorixCvRegraVersao.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.fiorixCvRegraVersao.createMany({
    data: [
      {
        id: `regra-${tenantId}-1`,
        tenantId,
        codigoRegra: "PILOTO_INTEIRO_TEOR_MATRICULA",
        versao: 1,
        titulo:
          "Elegibilidade Estrita — Certidão de Inteiro Teor por Número de Matrícula (Livro 2)",
        especieAlvo: "INTEIRO_TEOR_MATRICULA",
        ativa: true,
        validadaJurid: true,
        textoModelo:
          "Admite conferência automatizada exclusivamente quando o subtipo Inteiro Teor estiver confirmado no cadastro e vinculado a número de matrícula válido do Livro 2.",
        parametrosJson: {},
        aprovadoPorNome: "Configuração Oficial 7º RI",
      },
      {
        id: `regra-${tenantId}-2`,
        tenantId,
        codigoRegra: "TEXTO_PRENOTACAO_TRAMITACAO_6_2",
        versao: 1,
        titulo:
          "Modelo Textual de Certificação de Prenotação em Tramitação Regular (Regra 6.2)",
        especieAlvo: "INTEIRO_TEOR_MATRICULA",
        ativa: true,
        validadaJurid: true,
        textoModelo:
          "CERTIFICO, outrossim, que revendo o Livro 1 - Protocolo (Contraditório), consta em tramitação regular o(s) título(s) prenotado(s) sob nº {{LISTA_PRENOTACOES}}, pendente(s) de qualificação ou prática de ato registral dentro do prazo legal.",
        parametrosJson: {},
        aprovadoPorNome: "Configuração Oficial 7º RI",
      },
    ],
    skipDuplicates: true,
  });
}

export async function sincronizarPedidosOficiaisWebriBatch(
  tenantId: string,
  records: any[]
): Promise<{ processados: number; inseridos: number; atualizados: number; inalterados: number }> {
  if (!records || records.length === 0) {
    return { processados: 0, inseridos: 0, atualizados: 0, inalterados: 0 };
  }

  await garantirRegrasPadraoTenant(tenantId);

  // Extrai números de pedido válidos do lote
  const numerosPedidosLote = Array.from(
    new Set(
      records
        .map((r) => String(r?.numeroPedido ?? r?.Pk_NrPedido ?? "").trim())
        .filter((n) => n.length > 0 && n !== "0")
    )
  );

  if (numerosPedidosLote.length === 0) {
    return { processados: 0, inseridos: 0, atualizados: 0, inalterados: 0 };
  }

  const existentes = await prisma.fiorixCvPedido.findMany({
    where: {
      tenantId,
      numeroPedido: { in: numerosPedidosLote },
    },
    select: {
      id: true,
      numeroPedido: true,
      protocoloExterno: true,
      observacoesOrigem: true,
      prioridade: true,
      versaoDadosFonteHash: true,
      estadoOperacional: true,
      valoresJson: true,
      procedimentoRealEquipe: true,
      statusComparacao: true,
      divergenciaClassificacao: true,
    },
  });

  const mapaExistentes = new Map(existentes.map((e) => [e.numeroPedido, e]));

  let inseridos = 0;
  let atualizados = 0;
  let inalterados = 0;

  for (const raw of records) {
    const numeroPedido = String(raw?.numeroPedido ?? raw?.Pk_NrPedido ?? "").trim();
    if (!numeroPedido || numeroPedido === "0") continue;

    const protocoloExterno = normalizarProtocoloExternoSql(
      raw.protocoloExterno ?? raw.ProtocoloEntidade
    );
    const dataPedido =
      normalizarDataSentinelaSql(raw.dataPedidoIso ?? raw.DataPedido) || new Date();

    const itensRaw: any[] = Array.isArray(raw.itens) && raw.itens.length > 0
      ? raw.itens
      : [
          {
            sequenciaItem: 1,
            naturezaCodigo: null,
            naturezaDescricao: raw.tipoPedidoDescricao || "Certidão Registral",
            livroCodigo: 2,
            numLivro: null,
            dataPrevisaoIso: raw.dataPrevisaoIso ?? null,
          },
        ];

    const prazoPrevisto =
      normalizarDataSentinelaSql(
        raw.dataPrevisaoIso ??
          itensRaw[0]?.dataPrevisaoIso ??
          raw.DataPrevisao ??
          raw.DataFinalRetirada
      ) || null;

    // Regra oficial do Webri: todo pedido do ONR tem preenchido o campo Magnético (ProtocoloEntidade / protocoloExterno).
    // Pedidos com Magnético vazio ou '0' (ex.: 1.332.611, 1.332.898, 1.330.765) são sempre PRESENCIAL (BALCAO).
    const ehOnr = Boolean(protocoloExterno);

    const origem = ehOnr ? "ONR" : "BALCAO";
    const canalRecebimento = ehOnr ? "EREG_ONR" : "RECEPCAO_WEBRI";

    const requerente = construirParticipanteSeguro({
      nome: raw.nomeRequerente ?? raw.NomeRequerente,
      documento: raw.documentoRequerente ?? raw.DocumentoRequerente,
      email: raw.emailRequerente ?? raw.EmailRequerente,
      telefone: raw.foneRequerente ?? raw.FoneRequerente,
      enderecoResumo: raw.enderecoRequerente ?? null,
    });

    const apresentante =
      ehOnr && protocoloExterno
        ? construirParticipanteSeguro({
            nome: "ONR / Central de Serviços Eletrônicos Compartilhados (SAEC)",
            documento: null,
          })
        : construirParticipanteSeguro({
            nome: raw.nomeRequerente ?? raw.NomeRequerente,
            documento: raw.documentoRequerente ?? raw.DocumentoRequerente,
          });

    const destinatarioNota = construirParticipanteSeguro({
      nome: raw.nomeRequerente ?? raw.NomeRequerente,
      documento: raw.documentoRequerente ?? raw.DocumentoRequerente,
    });

    // Processa itens do pedido
    const acervos: SnapshotAcervoMatricula[] = [];
    const itensProcessados = itensRaw.map((it, idx) => {
      const seq = Number(it.sequenciaItem || idx + 1);
      const mat = normalizarNumeroMatriculaSql(it.numLivro ?? it.numeroMatricula);
      const numeroMatricula = mat.matriculaValida;
      const naturezaCodigo =
        it.naturezaCodigo !== null && it.naturezaCodigo !== undefined
          ? Number(it.naturezaCodigo)
          : null;

      const enderecoPesquisa = it.enderecoPesquisa
        ? String(it.enderecoPesquisa).trim()
        : null;
      const transcricaoOuLoteamento = it.transcricaoOuLoteamento
        ? String(it.transcricaoOuLoteamento).trim()
        : null;

      const resolucaoNat = resolverEspecieENaturezaItem({
        naturezaCodigo,
        naturezaDescricaoRaw: it.naturezaDescricao ?? null,
        numeroMatricula,
        enderecoPesquisa,
        transcricaoOuLoteamento,
        nomePesquisado: it.nomePesquisado ?? null,
        documentoPesquisado: it.documentoPesquisado ?? null,
      });

      const livroCodigo =
        it.livroCodigo !== null && it.livroCodigo !== undefined && Number(it.livroCodigo) > 0
          ? Number(it.livroCodigo)
          : numeroMatricula
          ? 2
          : 0;

      const livroDescricao =
        livroCodigo === 2
          ? "Livro 2 - Registro Geral"
          : livroCodigo === 3
          ? "Livro 3 - Registro Auxiliar"
          : enderecoPesquisa
          ? "Indicador Real (Livro 4)"
          : "Acervo / Indicadores";

      const classif = classificarSubtipoElegibilidadePiloto({
        especieDescricao: resolucaoNat.naturezaDescricao,
        subtipoExplicito: resolucaoNat.subtipoExplicito,
        livroCodigo,
        numeroMatriculaRaw: numeroMatricula,
        enderecoPesquisa,
        transcricaoOuLoteamento,
      });

      let acervoSnapshot: SnapshotAcervoMatricula | null = null;
      if (numeroMatricula) {
        const existeNoReal =
          it.existeNaTblWriReal !== undefined ? Boolean(it.existeNaTblWriReal) : true;
        const bloqueada = Boolean(it.dataBloqueioRealIso);
        acervoSnapshot = {
          numeroMatricula,
          vinculadaServentia: existeNoReal,
          possuiRegistroEstruturado: existeNoReal,
          possuiArquivoDigitalizado: true,
          formatoArquivo: "PDF",
          ultimaAtualizacaoAtosIso:
            it.dataDigitacaoRealIso || dataPedido.toISOString(),
          ultimaDigitalizacaoIso:
            it.dataDigitacaoRealIso || dataPedido.toISOString(),
          integraEAtualizada: existeNoReal && !bloqueada,
          pendenciaDetectada: bloqueada
            ? "Matrícula com apontamento/bloqueio em tblWRIReal."
            : !existeNoReal
            ? `Matrícula nº ${numeroMatricula} sem registro localizado em tblWRIReal (Livro 2).`
            : null,
        };
        acervos.push(acervoSnapshot);
      }

      const itemPrev = normalizarDataSentinelaSql(it.dataPrevisaoIso) || prazoPrevisto;

      return {
        sequenciaItem: seq,
        naturezaCodigo,
        especieSolicitada: resolucaoNat.especieSolicitada,
        naturezaDescricao: resolucaoNat.naturezaDescricao,
        livroCodigo,
        livroDescricao,
        numeroMatricula,
        transcricaoOuLoteamento,
        enderecoPesquisa,
        documentoPesquisadoMascarado: it.documentoPesquisado
          ? construirParticipanteSeguro({ documento: it.documentoPesquisado })
              .documentoMascarado
          : null,
        meioEntregaCodigo: ehOnr ? "M" : "I",
        meioEntregaDescricao: ehOnr ? "Meio Magnético (M)" : "Balcão / Impresso (I)",
        dataPrevisao: itemPrev,
        elegivelPiloto: classif.elegivelPiloto,
        motivoEncaminhamentoHumano: classif.motivoEncaminhamentoHumano,
        subtipoConfirmado: classif.subtipoConfirmado,
        criterioSolicitacao: classif.criterioSolicitacao,
        acervoSnapshot,
      };
    });

    // Processa Contraditório / Prenotações vinculadas ao pedido ou às matrículas do pedido
    const prenotacoesRaw: any[] = Array.isArray(raw.prenotacoesContraditorio)
      ? raw.prenotacoesContraditorio
      : [];
    const seenPren = new Set<string>();
    const prenotacoesEncontradas: PrenotacaoContraditorio[] = [];

    for (const pr of prenotacoesRaw) {
      const numStr = String(pr?.numPrenotacao ?? pr?.numeroPrenotacao ?? "").trim();
      if (!numStr || numStr === "0" || seenPren.has(numStr)) continue;
      seenPren.add(numStr);

      const dtApresIso =
        normalizarDataSentinelaSql(pr.dataRecepcaoIso ?? pr.DtRecep ?? pr.DtPrenotacao)?.toISOString() ||
        dataPedido.toISOString();
      const dtPrevIso = normalizarDataSentinelaSql(
        pr.dataPrevisaoIso ?? pr.DtPrevisaoEntrega ?? pr.DtExpiraPrn
      )?.toISOString();

      const numMat =
        pr.numMatricula && Number(pr.numMatricula) > 0 && Number(pr.numMatricula) < 9999999
          ? Number(pr.numMatricula)
          : itensProcessados[0]?.numeroMatricula ?? null;

      const tipoDesc = String(pr.tipoPrenotacaoDescricao || "PRENOTADO").trim();
      const protMag =
        pr.protocoloMagnetico && String(pr.protocoloMagnetico).trim() !== "0"
          ? String(pr.protocoloMagnetico).trim()
          : null;
      const emProc = Boolean(pr.emProcessamentoAto);

      prenotacoesEncontradas.push({
        numeroPrenotacao: numStr,
        pkRecepcao: Number(pr.pkRecepcao || numStr) || undefined,
        pkFlagRecepcao: Number(pr.pkFlagRecepcao || 1),
        pkSeqTitulo: Number(pr.pkSeqTitulo || 1),
        tipoPrenotacaoCodigo: pr.tipoPrenotacaoCodigo != null ? Number(pr.tipoPrenotacaoCodigo) : null,
        tipoPrenotacaoDescricao: tipoDesc,
        protocoloMagnetico: protMag,
        numeroMatricula: numMat,
        livroContraditorio: numMat ? `MAT ${numMat}` : "Livro 1 - Protocolo",
        orgaoServentia: "desta Serventia",
        statusContraditorioIndicador: emProc ? "Em Lançamento" : "Livre",
        dataApresentacaoIso: dtApresIso,
        dataApresentacaoBr: formatarDataBrCurta(dtApresIso),
        dataPrevisaoBr: dtPrevIso ? formatarDataBrCurta(dtPrevIso) : null,
        naturezaTitulo: pr.naturezaTitulo
          ? String(pr.naturezaTitulo).trim()
          : tipoDesc,
        emProcessamentoAtoNaMatricula: emProc,
        etapaAtual: emProc
          ? `Ato em lançamento na matrícula${numMat ? ` ${numMat}` : ""}`
          : `Contraditório ativo — ${tipoDesc}${numMat ? ` (MAT ${numMat})` : ""}`,
        origemSqlTabelas:
          "tblWRIRecepcao • tblWRITitulos • tblWRICertidaoResultadoContraditorio • tblWRITipoPrenotacao • tblWRITitulosReal • tblWRIReal",
      });
    }

    const itemPrincipal = itensProcessados[0];
    const versaoDadosFonteHash = gerarHashVersaoDadosFonte({
      tenantId,
      numeroPedido,
      itens: itensProcessados.map((i) => ({
        sequenciaItem: i.sequenciaItem,
        numeroMatricula: i.numeroMatricula,
        naturezaDescricao: i.naturezaDescricao,
      })),
      prenotacoes: prenotacoesEncontradas,
      acervos,
    });

    const avaliacao = executarRegrasConferenciaPedido({
      elegivelPiloto: itemPrincipal.elegivelPiloto,
      criterioSolicitacao: itemPrincipal.criterioSolicitacao,
      motivoEncaminhamentoHumano: itemPrincipal.motivoEncaminhamentoHumano,
      numeroMatricula: itemPrincipal.numeroMatricula,
      acervo: itemPrincipal.acervoSnapshot,
      contraditorioDisponivel: true,
      prenotacoes: prenotacoesEncontradas,
    });

    const existente = mapaExistentes.get(numeroPedido);
    const valoresExistentes = ((existente?.valoresJson as Record<string, unknown>) || {}) as Record<
      string,
      unknown
    >;

    const valorServico = Number(raw.valorServico ?? 0);
    const valorDespesa = Number(raw.valorDespesa ?? 0);

    // Regra oficial do Webri (dbo.tblWRICertidaoCotas e dbo.tblWRICertidao):
    // - Cota (totalCota) = tblWRICertidaoCotas.VlrTotal (VlrCer1 + VlrCer2..10) = tblWRICertidao.VlrTotalCota
    // - Depósito (totalDeposito) = tblWRICertidao.VlrTotalDeposito + VlrTotalCompDep
    // - Saldo (saldo) = tblWRICertidao.VlrSaldo = Depósito - Cota
    // Caso o conector em execução em memória envie payload antigo (sem raw.totalCota definido),
    // preserva valoresExistentes ou recompõe a Cota a partir de VlrTotCer1 (valorServico) + VlrTotCer2..7 (valorDespesa),
    // impedindo que o serviço em memória sobrescreva a Cota com 0 ou o Depósito ONR com 76,54.
    const payloadPossuiCotaExplicita =
      raw.totalCota !== undefined && raw.totalCota !== null;

    const oficiaisSalvos = (valoresExistentes._valoresOficiaisWebri || null) as Record<
      string,
      unknown
    > | null;

    const cotaCalculadaPartes =
      raw.VlrTotalCota !== undefined && raw.VlrTotalCota !== null
        ? Number(raw.VlrTotalCota)
        : valorDespesa > 0
        ? Math.round((valorServico + valorDespesa) * 100) / 100
        : 0;

    const totalCota = payloadPossuiCotaExplicita
      ? Number(raw.totalCota)
      : oficiaisSalvos?.totalCota !== undefined && oficiaisSalvos?.totalCota !== null
      ? Number(oficiaisSalvos.totalCota)
      : valoresExistentes.totalCota !== undefined &&
        valoresExistentes.totalCota !== null &&
        Number(valoresExistentes.totalCota) > 0
      ? Number(valoresExistentes.totalCota)
      : cotaCalculadaPartes;

    const totalDeposito = payloadPossuiCotaExplicita
      ? Number(raw.totalDeposito ?? 0)
      : oficiaisSalvos?.totalDeposito !== undefined && oficiaisSalvos?.totalDeposito !== null
      ? Number(oficiaisSalvos.totalDeposito)
      : raw.VlrTotalDeposito !== undefined && raw.VlrTotalDeposito !== null
      ? Math.round((Number(raw.VlrTotalDeposito) + Number(raw.VlrTotalCompDep ?? 0)) * 100) / 100
      : ehOnr
      ? 0
      : Number(raw.totalDeposito ?? 0);

    const saldo =
      raw.saldo !== undefined && raw.saldo !== null
        ? Number(raw.saldo)
        : oficiaisSalvos?.saldo !== undefined && oficiaisSalvos?.saldo !== null
        ? Number(oficiaisSalvos.saldo)
        : raw.VlrSaldo !== undefined && raw.VlrSaldo !== null
        ? Number(raw.VlrSaldo)
        : Math.round((totalDeposito - totalCota) * 100) / 100;

    const previaCustas =
      raw.previaCustas !== undefined && raw.previaCustas !== null
        ? Number(raw.previaCustas)
        : oficiaisSalvos?.previaCustas !== undefined && oficiaisSalvos?.previaCustas !== null
        ? Number(oficiaisSalvos.previaCustas)
        : valoresExistentes.previaCustas !== undefined && valoresExistentes.previaCustas !== null
        ? Number(valoresExistentes.previaCustas)
        : Number(raw.VlrTotTotal ?? 0);

    const observacaoOriginalLimpa = raw.observacoesOrigem
      ? String(raw.observacoesOrigem).trim()
      : null;
    const descricaoItensOriginalLimpa = raw.descricaoDosItens
      ? String(raw.descricaoDosItens).trim()
      : null;

    const webriMetaObj = {
      numRps: raw.numRps != null && Number(raw.numRps) > 0 ? Number(raw.numRps) : null,
      gerarNfe: raw.gerarNfe !== undefined && raw.gerarNfe !== null ? Boolean(raw.gerarNfe) : true,
      codigoAcesso: raw.codigoAcesso ? String(raw.codigoAcesso).trim() : null,
      divisorId: raw.divisorId != null ? Number(raw.divisorId) : 2,
      divisorDescricao: "Custas Integrais",
      usuarioIdPedido: raw.usuarioIdPedido != null ? Number(raw.usuarioIdPedido) : null,
      atendenteNome:
        (raw.atendenteNome && String(raw.atendenteNome).trim()) ||
        (itensRaw[0]?.atendenteItemNome && String(itensRaw[0].atendenteItemNome).trim()) ||
        null,
      observacaoPedidoOriginal: observacaoOriginalLimpa,
      descricaoDosItensOriginal: descricaoItensOriginalLimpa,
      naturezaOriginalWebri:
        itensRaw[0]?.naturezaDescricaoOriginal ||
        itensRaw[0]?.naturezaDescricao ||
        null,
      resultadoPesquisaSistema:
        itensRaw[0]?.resultadoPesquisaSistema != null
          ? Number(itensRaw[0].resultadoPesquisaSistema)
          : itensProcessados[0]?.numeroMatricula
          ? 2
          : 1,
      jaImpressa: itensRaw.some(
        (i) => Number(i.qtdeImpressao || 0) > 0 || Boolean(i.dataImpressaoIso)
      ),
      assinaOnr: itensRaw.some((i) => Boolean(i.assinaOnr)) || ehOnr,
      dataCertidaoBr: formatarDataBrCurta(
        itensRaw[0]?.dataEmissaoIso ||
          itensRaw[0]?.dataImpressaoIso ||
          dataPedido.toISOString()
      ),
      itensMeta: itensRaw.map((i, idx) => ({
        sequenciaItem: Number(i.sequenciaItem || idx + 1),
        naturezaOriginalWebri:
          i.naturezaDescricaoOriginal || i.naturezaDescricao || null,
        resultadoPesquisaSistema:
          i.resultadoPesquisaSistema != null ? Number(i.resultadoPesquisaSistema) : null,
        qtdeImpressao: Number(i.qtdeImpressao || 0),
        dataImpressaoBr: i.dataImpressaoIso ? formatarDataBrCurta(i.dataImpressaoIso) : null,
        dataEmissaoBr: i.dataEmissaoIso ? formatarDataBrCurta(i.dataEmissaoIso) : null,
        assinaOnr: Boolean(i.assinaOnr),
        atendenteItemNome: i.atendenteItemNome ? String(i.atendenteItemNome).trim() : null,
      })),
    };

    const valoresJsonFinal: Record<string, unknown> = {
      ...valoresExistentes,
      valorServico,
      valorDespesa,
      totalDeposito,
      totalCota,
      saldo,
      previaCustas,
      _valoresOficiaisWebri: {
        totalDeposito,
        totalCota,
        saldo,
        previaCustas,
      },
      moeda: "BRL",
      _webriMeta: webriMetaObj,
    };

    const prenotacaoVinculada =
      prenotacoesEncontradas.length > 0
        ? prenotacoesEncontradas.map((p) => p.numeroPrenotacao).join(" / ")
        : null;

    const observacoesOrigem = observacaoOriginalLimpa;

    const prioridade =
      prenotacoesEncontradas.some((p) => p.emProcessamentoAtoNaMatricula)
        ? "CRITICA"
        : prenotacoesEncontradas.length > 0
        ? "URGENTE"
        : "NORMAL";

    const hashSyncCompleto = createHash("sha256")
      .update(
        JSON.stringify({
          versaoDadosFonteHash,
          protocoloExterno,
          origem,
          estadoSugerido: avaliacao.estadoSugerido,
          prioridade,
          observacoesOrigem,
          valoresOficiais: valoresJsonFinal._valoresOficiaisWebri,
          webriMeta: webriMetaObj,
        })
      )
      .digest("hex");

    const ultimoHashSyncSalvo =
      typeof valoresExistentes._syncPayloadHash === "string"
        ? valoresExistentes._syncPayloadHash
        : null;

    const semAlteracaoRelevante =
      Boolean(existente) &&
      (ultimoHashSyncSalvo === hashSyncCompleto ||
        (existente!.versaoDadosFonteHash === versaoDadosFonteHash &&
          existente!.estadoOperacional === avaliacao.estadoSugerido &&
          (existente!.observacoesOrigem ?? null) === (observacoesOrigem ?? null) &&
          (existente!.protocoloExterno ?? null) === (protocoloExterno ?? null) &&
          existente!.prioridade === prioridade &&
          JSON.stringify(valoresExistentes._valoresOficiaisWebri ?? null) ===
            JSON.stringify(valoresJsonFinal._valoresOficiaisWebri) &&
          JSON.stringify(valoresExistentes._webriMeta ?? null) ===
            JSON.stringify(webriMetaObj)));

    if (semAlteracaoRelevante) {
      inalterados++;
      continue;
    }

    valoresJsonFinal._syncPayloadHash = hashSyncCompleto;

    const pedidoId = existente?.id || `cv-webri-${tenantId.slice(-6)}-${numeroPedido}`;

    await prisma.fiorixCvPedido.upsert({
      where: {
        tenantId_numeroPedido: {
          tenantId,
          numeroPedido,
        },
      },
      create: {
        id: pedidoId,
        tenantId,
        numeroPedido,
        protocoloExterno,
        origem,
        canalRecebimento,
        especieSolicitada: itemPrincipal.especieSolicitada,
        subtipoConfirmado: itemPrincipal.subtipoConfirmado,
        criterioSolicitacao: itemPrincipal.criterioSolicitacao,
        estadoOperacional: avaliacao.estadoSugerido,
        prioridade,
        dataPedido,
        prazoPrevisto,
        versaoDadosFonteHash,
        dadosInvalidadosMudanca: false,
        pausadoPorAtoProcessam: avaliacao.pausarPorAtoProcessamento,
        prenotacaoVinculada,
        requerenteJson: requerente as any,
        apresentanteJson: apresentante as any,
        destinatarioNotaJson: destinatarioNota as any,
        valoresJson: valoresJsonFinal as any,
        observacoesOrigem,
        modoComparacaoAtivo: true,
        resultadoPropostoFiorix: avaliacao.decisaoProposta,
        procedimentoRealEquipe: avaliacao.decisaoProposta,
        statusComparacao: "CONVERGENTE",
        ambienteSintetico: false,
        ultimoSincronismoEm: new Date(),
      },
      update: {
        protocoloExterno,
        origem,
        canalRecebimento,
        especieSolicitada: itemPrincipal.especieSolicitada,
        subtipoConfirmado: itemPrincipal.subtipoConfirmado,
        criterioSolicitacao: itemPrincipal.criterioSolicitacao,
        estadoOperacional: avaliacao.estadoSugerido,
        prioridade,
        dataPedido,
        prazoPrevisto,
        versaoDadosFonteHash,
        pausadoPorAtoProcessam: avaliacao.pausarPorAtoProcessamento,
        prenotacaoVinculada,
        requerenteJson: requerente as any,
        apresentanteJson: apresentante as any,
        destinatarioNotaJson: destinatarioNota as any,
        valoresJson: valoresJsonFinal as any,
        observacoesOrigem,
        resultadoPropostoFiorix: avaliacao.decisaoProposta,
        ambienteSintetico: false,
        ultimoSincronismoEm: new Date(),
      },
    });

    // Upsert de cada item do pedido
    for (const it of itensProcessados) {
      const statusItem =
        avaliacao.estadoSugerido === "APTO_EMISSAO"
          ? "CONFERIDO_APTO"
          : prenotacoesEncontradas.length > 0
          ? "EM_REVISAO_CONTRADITORIO"
          : "AGUARDANDO_CONFERENCIA";

      await prisma.fiorixCvPedidoItem.upsert({
        where: {
          pedidoId_sequenciaItem: {
            pedidoId,
            sequenciaItem: it.sequenciaItem,
          },
        },
        create: {
          id: `cv-item-${pedidoId}-${it.sequenciaItem}`,
          tenantId,
          pedidoId,
          sequenciaItem: it.sequenciaItem,
          naturezaCodigo: it.naturezaCodigo,
          naturezaDescricao: it.naturezaDescricao,
          livroCodigo: it.livroCodigo,
          livroDescricao: it.livroDescricao,
          numeroMatricula: it.numeroMatricula,
          transcricaoOuLoteamento: it.transcricaoOuLoteamento,
          enderecoPesquisa: it.enderecoPesquisa,
          documentoPesquisadoMascarado: it.documentoPesquisadoMascarado,
          meioEntregaCodigo: it.meioEntregaCodigo,
          meioEntregaDescricao: it.meioEntregaDescricao,
          dataPrevisao: it.dataPrevisao,
          elegivelPiloto: it.elegivelPiloto,
          motivoEncaminhamentoHumano: it.motivoEncaminhamentoHumano,
          statusItem,
          acervoSnapshotJson: (it.acervoSnapshot as any) ?? undefined,
        },
        update: {
          naturezaCodigo: it.naturezaCodigo,
          naturezaDescricao: it.naturezaDescricao,
          livroCodigo: it.livroCodigo,
          livroDescricao: it.livroDescricao,
          numeroMatricula: it.numeroMatricula,
          transcricaoOuLoteamento: it.transcricaoOuLoteamento,
          enderecoPesquisa: it.enderecoPesquisa,
          documentoPesquisadoMascarado: it.documentoPesquisadoMascarado,
          meioEntregaCodigo: it.meioEntregaCodigo,
          meioEntregaDescricao: it.meioEntregaDescricao,
          dataPrevisao: it.dataPrevisao,
          elegivelPiloto: it.elegivelPiloto,
          motivoEncaminhamentoHumano: it.motivoEncaminhamentoHumano,
          statusItem,
          acervoSnapshotJson: (it.acervoSnapshot as any) ?? undefined,
        },
      });
    }

    // Se é pedido novo ou se o hash dos dados-fonte mudou (ex: entrou/saiu prenotação no Contraditório),
    // registra nova Conferência e entrada no Histórico de Andamentos
    const mudouHash = !existente || existente.versaoDadosFonteHash !== versaoDadosFonteHash;
    if (mudouHash) {
      await prisma.fiorixCvConferencia.create({
        data: {
          id: `conf-${pedidoId}-${versaoDadosFonteHash.slice(0, 10)}`,
          tenantId,
          pedidoId,
          itemId: `cv-item-${pedidoId}-1`,
          versaoRegraAplicada: "OFICIAL_7RI_V1.0",
          versaoDadosFonteHash,
          identificacaoStatus: avaliacao.identificacaoStatus,
          vinculoServentia: avaliacao.vinculoServentia,
          contraditorioStatus: avaliacao.contraditorioStatus,
          prenotacoesEncontradasJson: prenotacoesEncontradas as any,
          textoCertidaoSugerido: avaliacao.textoCertidaoSugerido,
          atualidadeMatriculaStatus: avaliacao.atualidadeMatriculaStatus,
          decisaoProposta: avaliacao.decisaoProposta,
          invalidadaPorMudanca: false,
          executadoPorTipo: "AGENTE_CONFERENCIA",
          executadoPorNome: "FIORIX AUTOMATICO • Triagem e Contraditório WEBRI",
        },
      }).catch(() => {});

      const resumoHist =
        prenotacoesEncontradas.length > 0
          ? `Sincronizado do WEBRI com ${prenotacoesEncontradas.length} prenotação(ões) em Contraditório (${prenotacoesEncontradas
              .map((p) => p.numeroPrenotacao)
              .join(", ")}).`
          : `Sincronizado do WEBRI (${itemPrincipal.especieSolicitada}${
              itemPrincipal.numeroMatricula ? ` • Matrícula ${itemPrincipal.numeroMatricula}` : ""
            }).`;

      const hashIntegridade = createHash("sha256")
        .update(`${tenantId}:${pedidoId}:${versaoDadosFonteHash}`)
        .digest("hex");

      await prisma.fiorixCvHistoricoOperacao.create({
        data: {
          id: `hist-${pedidoId}-${versaoDadosFonteHash.slice(0, 8)}-${randomUUID().slice(0, 4)}`,
          tenantId,
          pedidoId,
          atorTipo: "CONNECTOR",
          atorId: "fiorix-connector-webri",
          atorNome: "FIORIX AUTOMATICO (WEBRI)",
          evento: "TRIAGEM_CONFERENCIA_INICIAL",
          estadoAnterior: existente?.estadoOperacional ?? "RECEBIDO",
          estadoNovo: avaliacao.estadoSugerido,
          resumo: resumoHist,
          hashIntegridade,
          createdAt: dataPedido,
        },
      }).catch(() => {});
    }

    if (!existente) {
      inseridos++;
    } else {
      atualizados++;
    }
  }

  return {
    processados: inseridos + atualizados,
    inseridos,
    atualizados,
    inalterados,
  };
}
