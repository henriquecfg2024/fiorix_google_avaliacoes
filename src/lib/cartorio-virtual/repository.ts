/**
 * Repositório Unificado Multi-Serventia — Módulo Cartório Virtual
 *
 * Responsabilidades:
 * 1. Isolamento estrito por `tenantId` em 100% das consultas e mutações (7º RI e futura expansão 5º RI).
 * 2. Persistência PostgreSQL via Prisma (`FiorixCv*`) quando a migração estiver aplicada.
 * 3. Resiliência honesta sem migração em produção (`NODE_ENV === 'production'`): retorna estado vazio real
 *    e sinaliza `migracaoPendente: true` sem jamais expor ou misturar dados sintéticos em produção.
 * 4. Sandbox isolado por `tenantId` em ambiente de teste/homologação (`isAmbienteSinteticoPermitido()`),
 *    permitindo validação integral local e execução determinística da suíte automatizada.
 */

import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  avaliarComparacaoPiloto,
  executarRegrasConferenciaPedido,
  gerarHashVersaoDadosFonte,
} from "./rules-engine";
import { gerarPdfLotePedidosSiplan } from "./siplan-order-pdf";
import { criarPedidosSinteticosPiloto, isAmbienteSinteticoPermitido } from "./synthetic-fixtures";
import {
  correspondeFiltroTipoCertidao,
  ESTADOS_OPERACIONAIS_LABELS,
  validarTransicaoEstadoPedido,
  type EstadoOperacionalPedido,
  type FiltroConferenciaEscrevente,
  type FiltroTipoCertidaoValor,
  type MarcacaoVisualDocumentoPedido,
  type PapelRegistral,
  type PedidoCertidaoDetalheDTO,
} from "./types";

export interface VersaoAnotacaoDTO {
  id: string;
  versao: number;
  conteudo: string;
  motivoEdicao: string | null;
  editadoPorNome: string;
  criadoEmBr: string;
}

export interface AnotacaoTarefaDTO {
  id: string;
  tenantId: string;
  pedidoId: string | null;
  numeroPedido: string | null;
  numeroMatricula: number | null;
  parentId: string | null;
  tipoRegistro: "ANOTACAO" | "TAREFA" | "DIVERGENCIA" | "ORIENTACAO";
  categoria: string;
  prioridade: "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";
  visibilidade: "EQUIPE_INTERNA" | "REVISORES" | "GESTAO";
  status: "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_RETORNO" | "RESOLVIDA" | "ARQUIVADA";
  titulo: string;
  conteudoAtual: string;
  versaoAtual: number;
  autorId: string;
  autorNome: string;
  autorPapel: string;
  atribuidoParaNome: string | null;
  setorDestino: string | null;
  prazoEmBr: string | null;
  concluidaEmBr: string | null;
  concluidaPorNome: string | null;
  criadoEmBr: string;
  versoes: VersaoAnotacaoDTO[];
  respostas: AnotacaoTarefaDTO[];
}

export interface PendenciaPedidoDTO {
  id: string;
  tenantId: string;
  pedidoId: string;
  numeroPedido: string;
  tipoPendencia: string;
  titulo: string;
  descricao: string;
  status: "ABERTA" | "EM_TRATAMENTO" | "AGUARDANDO_RECONFERENCIA" | "CONCLUIDA" | "CANCELADA";
  prenotacaoRef: string | null;
  numeroMatricula: number | null;
  responsavelNome: string | null;
  evidenciaConclusao: string | null;
  resolvidaPorNome: string | null;
  resolvidaEmBr: string | null;
  criadoEmBr: string;
}

export interface RevisaoHumanaDTO {
  id: string;
  tenantId: string;
  pedidoId: string;
  numeroPedido: string;
  origem: string;
  especieSolicitada: string;
  motivoRevisao: string;
  evidencias: Record<string, unknown>;
  statusRevisao:
    | "PENDENTE"
    | "APROVADA"
    | "REPROVADA"
    | "DEVOLVIDA_ATUALIZACAO"
    | "INVALIDADA_POR_MUDANCA";
  decisaoHumana: string | null;
  justificativa: string | null;
  limitesAprovacao: string | null;
  versaoDadosFonteHash: string;
  decididoPorNome: string | null;
  papelRegistralNoAto: string | null;
  decididoEmBr: string | null;
  criadoEmBr: string;
}

export interface LoteImpressaoResumoDTO {
  id: string;
  tenantId: string;
  codigoLote: string;
  modoSelecao: "INDIVIDUAL" | "SELECIONADOS" | "FILTRADOS" | "TOTAL_DISPONIVEL";
  modoDadosImpressao: "ORIGINAL_CONGELADO" | "ATUAL_RECONSTRUIDO";
  duplexFrenteNovaFolha: boolean;
  criterioOrdenacao: string;
  pedidosIds: string[];
  numerosPedidos: string[];
  totalPedidos: number;
  totalPaginas: number;
  paginasBrancoDuplex: number;
  arquivoHashSha256: string;
  statusLote: string;
  loteOrigemReimpressaoId: string | null;
  motivoReimpressao: string | null;
  criadoPorNome: string;
  criadoEmBr: string;
  eventos: Array<{
    id: string;
    evento: string;
    observacao: string | null;
    operadorNome: string;
    criadoEmBr: string;
  }>;
}

export interface HistoricoOperacaoDTO {
  id: string;
  tenantId: string;
  pedidoId: string | null;
  numeroPedido: string | null;
  loteId: string | null;
  atorTipo: "HUMANO" | "AGENTE_VIRTUAL" | "SISTEMA" | "CONNECTOR";
  atorNome: string;
  papelRegistral: string | null;
  evento: string;
  estadoAnterior: string | null;
  estadoNovo: string | null;
  resumo: string;
  hashIntegridade: string;
  criadoEmIso: string;
  criadoEmBr: string;
}

export interface ResumoVisaoGeralCartorioVirtual {
  migracaoPendente: boolean;
  ambienteSintetico: boolean;
  totalPedidos: number;
  conferidos: number;
  naoConferidos: number;
  recebidos: number;
  emAndamento: number;
  aptosEmissao: number;
  emRevisaoHumana: number;
  aguardandoAtualizacaoMatricula: number;
  pausadosAtoProcessamento: number;
  comFalhaOuPendencia: number;
  entreguesOuConcluidos: number;
  anotacoesAbertas: number;
  lotesImpressaoGerados: number;
  comparacaoPiloto: {
    totalAvaliados: number;
    convergentes: number;
    divergentes: number;
    aguardandoEquipe: number;
    taxaConvergenciaPercentual: number;
  };
}

interface SandboxTenantStore {
  pedidos: PedidoCertidaoDetalheDTO[];
  pendencias: PendenciaPedidoDTO[];
  anotacoes: AnotacaoTarefaDTO[];
  revisoes: RevisaoHumanaDTO[];
  lotes: Array<LoteImpressaoResumoDTO & { snapshotPedidos: PedidoCertidaoDetalheDTO[] }>;
  historico: HistoricoOperacaoDTO[];
  autorizacoes: Map<
    string,
    {
      usuarioId: string;
      usuarioNome: string;
      papelRegistral: PapelRegistral;
      ativo: boolean;
      observacoes: string | null;
      atribuidoPorNome: string;
      atualizadoEmBr: string;
    }
  >;
  regras: Array<{
    id: string;
    codigoRegra: string;
    versao: number;
    titulo: string;
    especieAlvo: string;
    ativa: boolean;
    validadaJuridicamente: boolean;
    textoModelo: string;
    aprovadoPorNome: string | null;
    criadoEmBr: string;
  }>;
}

const globalSandbox = globalThis as unknown as {
  __fiorixCvSandboxPorTenant?: Map<string, SandboxTenantStore>;
  __fiorixCvSandboxMtimeMs?: number;
};

const sandboxPorTenant: Map<string, SandboxTenantStore> =
  globalSandbox.__fiorixCvSandboxPorTenant ||
  (globalSandbox.__fiorixCvSandboxPorTenant = new Map<string, SandboxTenantStore>());

function usarPersistenciaDiscoLocalDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function obterCaminhoPersistenciaLocalDev(): string {
  return path.join(process.cwd(), "backups", "cartorio-virtual-local-store.json");
}

function sincronizarSandboxDoDiscoSeNecessario(): void {
  if (!usarPersistenciaDiscoLocalDev()) return;
  try {
    const arquivo = obterCaminhoPersistenciaLocalDev();
    if (!fs.existsSync(arquivo)) return;
    const stat = fs.statSync(arquivo);
    if (globalSandbox.__fiorixCvSandboxMtimeMs === stat.mtimeMs) return;

    const bruto = fs.readFileSync(arquivo, "utf8");
    const parsed = JSON.parse(bruto) as Record<
      string,
      Omit<SandboxTenantStore, "autorizacoes"> & {
        autorizacoesEntries?: Array<[string, any]>;
      }
    >;

    for (const [tId, dados] of Object.entries(parsed)) {
      sandboxPorTenant.set(tId, {
        pedidos: dados.pedidos || [],
        pendencias: dados.pendencias || [],
        anotacoes: dados.anotacoes || [],
        revisoes: dados.revisoes || [],
        lotes: dados.lotes || [],
        historico: dados.historico || [],
        autorizacoes: new Map(dados.autorizacoesEntries || []),
        regras: dados.regras || [],
      });
    }
    globalSandbox.__fiorixCvSandboxMtimeMs = stat.mtimeMs;
  } catch {
    // Em caso de arquivo inexistente ou escrita concorrente momentânea, segue em memória com segurança
  }
}

function persistirSandboxLocalEmDisco(): void {
  if (!usarPersistenciaDiscoLocalDev()) return;
  try {
    const arquivo = obterCaminhoPersistenciaLocalDev();
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const serializavel: Record<string, unknown> = {};
    for (const [tId, store] of sandboxPorTenant.entries()) {
      serializavel[tId] = {
        pedidos: store.pedidos,
        pendencias: store.pendencias,
        anotacoes: store.anotacoes,
        revisoes: store.revisoes,
        lotes: store.lotes,
        historico: store.historico,
        autorizacoesEntries: Array.from(store.autorizacoes.entries()),
        regras: store.regras,
      };
    }
    const tmp = `${arquivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(serializavel, null, 2), "utf8");
    fs.renameSync(tmp, arquivo);
    const stat = fs.statSync(arquivo);
    globalSandbox.__fiorixCvSandboxMtimeMs = stat.mtimeMs;
  } catch {
    // Ignora falha não-crítica de sistema de arquivos local
  }
}

function formatarDataHoraBr(d: Date = new Date()): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gerarHashHistorico(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function isErroTabelaAusente(err: unknown): boolean {
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || "");
  return (
    code === "P2021" ||
    code === "P2022" ||
    msg.includes("42P01") ||
    msg.includes("does not exist") ||
    msg.includes("fiorix_cv_")
  );
}

/**
 * Inicializa de forma determinística e isolada por `tenantId` o sandbox de teste/demonstração local.
 * JAMAIS é invocado quando `NODE_ENV === 'production'`.
 */
function obterSandboxTenant(tenantId: string): SandboxTenantStore {
  sincronizarSandboxDoDiscoSeNecessario();
  const existente = sandboxPorTenant.get(tenantId);
  if (existente) {
    // Sincroniza novos metadados de Contraditório / Prenotações nos pedidos sintéticos cacheados sem perder conferência/marcações
    const gabarito = criarPedidosSinteticosPiloto(tenantId);
    const mapaGabarito = new Map(gabarito.map((g) => [g.id, g]));
    existente.pedidos = existente.pedidos.map((p) => {
      const ref = mapaGabarito.get(p.id);
      if (!ref) return p;
      return {
        ...p,
        estadoOperacionalLabel:
          p.estadoOperacionalLabel === "Em revisão humana"
            ? "Aguardando revisão do Escrevente"
            : ref.estadoOperacionalLabel || p.estadoOperacionalLabel,
        prenotacaoVinculada: ref.prenotacaoVinculada ?? p.prenotacaoVinculada,
        observacoesOrigem: ref.observacoesOrigem ?? p.observacoesOrigem,
        itens: ref.itens,
        ultimaConferencia: ref.ultimaConferencia
          ? {
              ...(p.ultimaConferencia || ref.ultimaConferencia),
              prenotacoesEncontradas: ref.ultimaConferencia.prenotacoesEncontradas,
              textoCertidaoSugerido: ref.ultimaConferencia.textoCertidaoSugerido,
            }
          : p.ultimaConferencia,
      };
    });
    return existente;
  }

  const pedidos = criarPedidosSinteticosPiloto(tenantId);
  const agoraBr = "07/11/2026 09:00";

  const pendencias: PendenciaPedidoDTO[] = [
    {
      id: `pend-${tenantId}-1`,
      tenantId,
      pedidoId: "cv-sint-9901003",
      numeroPedido: "9901003",
      tipoPendencia: "ATO_EM_PROCESSAMENTO",
      titulo: "Ato registral da prenotação 784.355 em lançamento na matrícula 142.300",
      descricao:
        "Regra 6.3: Aguardar conclusão do registro/averbação, lançamento na matrícula, digitalização no Livro 2 e executar nova conferência obrigatória.",
      status: "ABERTA",
      prenotacaoRef: "784.355",
      numeroMatricula: 142300,
      responsavelNome: "Setor de Registro / Atualização",
      evidenciaConclusao: null,
      resolvidaPorNome: null,
      resolvidaEmBr: null,
      criadoEmBr: agoraBr,
    },
    {
      id: `pend-${tenantId}-2`,
      tenantId,
      pedidoId: "cv-sint-9901004",
      numeroPedido: "9901004",
      tipoPendencia: "DIGITALIZACAO_ACERVO",
      titulo: "Matrícula 22.910 sem arquivo PDF na pasta Livro 2",
      descricao:
        "Regra 6.4: Solicitar digitalização da ficha física e validação de completude no acervo antes da emissão.",
      status: "EM_TRATAMENTO",
      prenotacaoRef: null,
      numeroMatricula: 22910,
      responsavelNome: "Setor de Microfilmagem / Digitalização",
      evidenciaConclusao: null,
      resolvidaPorNome: null,
      resolvidaEmBr: null,
      criadoEmBr: agoraBr,
    },
  ];

  const anotacoes: AnotacaoTarefaDTO[] = [
    {
      id: `anot-${tenantId}-1`,
      tenantId,
      pedidoId: "cv-sint-9901002",
      numeroPedido: "9901002",
      numeroMatricula: 118920,
      parentId: null,
      tipoRegistro: "TAREFA",
      categoria: "CONTRADITORIO",
      prioridade: "ALTA",
      visibilidade: "REVISORES",
      status: "ABERTA",
      titulo: "Conferir texto de certificação da prenotação 784.120",
      conteudoAtual:
        "Prenotação nº 784.120 em exame dentro do prazo regulamentar. Confirmar redação padrão antes de liberar como apto.",
      versaoAtual: 1,
      autorId: "agente-contraditorio",
      autorNome: "Agente de Consulta ao Contraditório",
      autorPapel: "AGENTE_VIRTUAL",
      atribuidoParaNome: "Escrevente Autorizado — Certidões",
      setorDestino: "Certidões / Conferência",
      prazoEmBr: "07/11/2026 15:00",
      concluidaEmBr: null,
      concluidaPorNome: null,
      criadoEmBr: agoraBr,
      versoes: [
        {
          id: `ver-${tenantId}-1`,
          versao: 1,
          conteudo:
            "Prenotação nº 784.120 em exame dentro do prazo regulamentar. Confirmar redação padrão antes de liberar como apto.",
          motivoEdicao: "Criação inicial do apontamento",
          editadoPorNome: "Agente de Consulta ao Contraditório",
          criadoEmBr: agoraBr,
        },
      ],
      respostas: [],
    },
    {
      id: `anot-${tenantId}-2`,
      tenantId,
      pedidoId: "cv-sint-9901006",
      numeroPedido: "9901006",
      numeroMatricula: null,
      parentId: null,
      tipoRegistro: "TAREFA",
      categoria: "INDICADOR_REAL",
      prioridade: "NORMAL",
      visibilidade: "EQUIPE_INTERNA",
      status: "EM_ANDAMENTO",
      titulo: "Pesquisa manual no Indicador Real (Sentinela Num_Livro = 0)",
      conteudoAtual:
        "Pedido solicitado por endereço. Necessária busca humana assistida em livros/fichas de loteamento e indicador real.",
      versaoAtual: 1,
      autorId: "agente-triagem",
      autorNome: "Agente de Triagem e Identificação",
      autorPapel: "AGENTE_VIRTUAL",
      atribuidoParaNome: "Equipe de Buscas / Indicador Real",
      setorDestino: "Buscas",
      prazoEmBr: "08/11/2026 12:00",
      concluidaEmBr: null,
      concluidaPorNome: null,
      criadoEmBr: agoraBr,
      versoes: [
        {
          id: `ver-${tenantId}-2`,
          versao: 1,
          conteudo:
            "Pedido solicitado por endereço. Necessária busca humana assistida em livros/fichas de loteamento e indicador real.",
          motivoEdicao: "Criação inicial do apontamento",
          editadoPorNome: "Agente de Triagem e Identificação",
          criadoEmBr: agoraBr,
        },
      ],
      respostas: [],
    },
  ];

  const revisoes: RevisaoHumanaDTO[] = pedidos
    .filter((p) => p.estadoOperacional === "EM_REVISAO_HUMANA")
    .map((p, idx) => ({
      id: `rev-${tenantId}-${idx + 1}`,
      tenantId,
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      origem: p.origem,
      especieSolicitada: p.especieSolicitada,
      motivoRevisao:
        p.ultimaConferencia?.prenotacoesEncontradas.length
          ? `Prenotação ativa (${p.ultimaConferencia.prenotacoesEncontradas
              .map((pr) => pr.numeroPrenotacao)
              .join(", ")}) exige validação humana do texto certificador.`
          : p.itens[0]?.motivoEncaminhamentoHumano ||
            "Requer conferência e decisão de pessoa autorizada.",
      evidencias: {
        criterioSolicitacao: p.criterioSolicitacao,
        subtipoConfirmado: p.subtipoConfirmado,
        contraditorioStatus: p.ultimaConferencia?.contraditorioStatus ?? "INCONCLUSIVO",
        textoSugerido: p.ultimaConferencia?.textoCertidaoSugerido ?? null,
      },
      statusRevisao: "PENDENTE",
      decisaoHumana: null,
      justificativa: null,
      limitesAprovacao: "Aprovação restrita à etapa interna de conferência do piloto (sem emissão/assinatura automática).",
      versaoDadosFonteHash: p.versaoDadosFonteHash,
      decididoPorNome: null,
      papelRegistralNoAto: null,
      decididoEmBr: null,
      criadoEmBr: agoraBr,
    }));

  const historico: HistoricoOperacaoDTO[] = pedidos.slice(0, 4).map((p, idx) => {
    const resumo = `Triagem automática concluída para o pedido nº ${p.numeroPedido} (${p.origem}) -> ${p.estadoOperacionalLabel}.`;
    return {
      id: `hist-${tenantId}-${idx + 1}`,
      tenantId,
      pedidoId: p.id,
      numeroPedido: p.numeroPedido,
      loteId: null,
      atorTipo: "AGENTE_VIRTUAL",
      atorNome: "Agente de Triagem e Contraditório",
      papelRegistral: null,
      evento: "TRIAGEM_CONFERENCIA_INICIAL",
      estadoAnterior: "RECEBIDO",
      estadoNovo: p.estadoOperacional,
      resumo,
      hashIntegridade: gerarHashHistorico({ tenantId, pedidoId: p.id, resumo, idx }),
      criadoEmIso: p.dataPedidoIso,
      criadoEmBr: `${p.dataPedidoBr} ${p.horaPedidoBr.slice(0, 5)}`,
    };
  });

  const regras = [
    {
      id: `regra-${tenantId}-1`,
      codigoRegra: "PILOTO_INTEIRO_TEOR_MATRICULA",
      versao: 1,
      titulo: "Elegibilidade Estrita — Certidão de Inteiro Teor por Número de Matrícula (Livro 2)",
      especieAlvo: "INTEIRO_TEOR_MATRICULA",
      ativa: true,
      validadaJuridicamente: false,
      textoModelo:
        "Admite conferência automatizada exclusivamente quando o subtipo Inteiro Teor estiver confirmado no cadastro e vinculado a número de matrícula válido do Livro 2. Vedado presumir Inteiro Teor a partir de 'Certidão Digital'.",
      aprovadoPorNome: "Aguardando formalização jurídica do Oficial (Seção 6)",
      criadoEmBr: agoraBr,
    },
    {
      id: `regra-${tenantId}-2`,
      codigoRegra: "TEXTO_PRENOTACAO_TRAMITACAO_6_2",
      versao: 1,
      titulo: "Modelo Textual de Certificação de Prenotação em Tramitação Regular (Regra 6.2)",
      especieAlvo: "INTEIRO_TEOR_MATRICULA",
      ativa: true,
      validadaJuridicamente: false,
      textoModelo:
        "CERTIFICO, outrossim, que revendo o Livro 1 - Protocolo (Contraditório), consta em tramitação regular o(s) título(s) prenotado(s) sob nº <LISTA_PRENOTACOES>, pendente(s) de qualificação ou prática de ato registral dentro do prazo legal.",
      aprovadoPorNome: "Aguardando homologação formal para produção",
      criadoEmBr: agoraBr,
    },
  ];

  const store: SandboxTenantStore = {
    pedidos,
    pendencias,
    anotacoes,
    revisoes,
    lotes: [],
    historico,
    autorizacoes: new Map(),
    regras,
  };

  sandboxPorTenant.set(tenantId, store);
  persistirSandboxLocalEmDisco();
  return store;
}

export function resetarSandboxCartorioVirtualParaTestes(tenantId?: string): void {
  if (tenantId) {
    sandboxPorTenant.delete(tenantId);
  } else {
    sandboxPorTenant.clear();
  }
}

export interface FiltrosConsultaPedidosCV {
  busca?: string;
  tipoCertidao?: FiltroTipoCertidaoValor;
  estadoOperacional?: EstadoOperacionalPedido | "TODOS";
  origem?: "ONR" | "BALCAO" | "TODAS";
  criterio?: string;
  apenasDivergentesComparacao?: boolean;
  statusConferencia?: FiltroConferenciaEscrevente;
}

export async function listarPedidosCartorioVirtual(
  tenantId: string,
  filtros: FiltrosConsultaPedidosCV = {}
): Promise<{
  pedidos: PedidoCertidaoDetalheDTO[];
  migracaoPendente: boolean;
  ambienteSintetico: boolean;
}> {
  let pedidosBase: PedidoCertidaoDetalheDTO[] = [];
  let migracaoPendente = false;
  let ambienteSintetico = false;

  try {
    if (process.env.NODE_ENV === "test") {
      throw Object.assign(new Error("Usar sandbox determinístico em suíte unitária"), {
        code: "P2021",
      });
    }
    const rows = await prisma.fiorixCvPedido.findMany({
      where: { tenantId },
      include: {
        itens: { orderBy: { sequenciaItem: "asc" } },
        conferencias: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ dataPedido: "desc" }, { numeroPedido: "desc" }],
      take: 3000,
    });

    if (rows.length === 0 && isAmbienteSinteticoPermitido()) {
      pedidosBase = obterSandboxTenant(tenantId).pedidos;
      ambienteSintetico = true;
    } else {
      pedidosBase = rows.map((r) => {
        const ultima = r.conferencias[0] || null;
        const estado = r.estadoOperacional as EstadoOperacionalPedido;
        const webriMetaRaw = ((r.valoresJson as any)?._webriMeta || null) as any;
        const itensMetaArr: any[] = Array.isArray(webriMetaRaw?.itensMeta)
          ? webriMetaRaw.itensMeta
          : [];
        return {
          id: r.id,
          tenantId: r.tenantId,
          numeroPedido: r.numeroPedido,
          protocoloExterno: r.protocoloExterno,
          origem: (r.origem === "ONR" ? "ONR" : "BALCAO") as "ONR" | "BALCAO",
          canalRecebimento: r.canalRecebimento,
          especieSolicitada: r.especieSolicitada,
          subtipoConfirmado: r.subtipoConfirmado,
          criterioSolicitacao: r.criterioSolicitacao as any,
          estadoOperacional: estado,
          estadoOperacionalLabel: ESTADOS_OPERACIONAIS_LABELS[estado] || r.estadoOperacional,
          prioridade: (r.prioridade as any) || "NORMAL",
          dataPedidoIso: r.dataPedido.toISOString(),
          dataPedidoBr: r.dataPedido.toLocaleDateString("pt-BR"),
          horaPedidoBr: r.dataPedido.toLocaleTimeString("pt-BR"),
          prazoPrevistoIso: r.prazoPrevisto ? r.prazoPrevisto.toISOString() : null,
          prazoPrevistoBr: r.prazoPrevisto ? r.prazoPrevisto.toLocaleDateString("pt-BR") : null,
          formaEntregaExibicao: r.origem === "ONR" ? "Meio Magnético (M) — ONR" : "Balcão",
          escreventeRecepcao:
            webriMetaRaw?.atendenteNome ||
            (r.origem === "ONR" ? "Anne" : "WEBRI / Recepção"),
          versaoDadosFonteHash: r.versaoDadosFonteHash,
          dadosInvalidadosMudanca: r.dadosInvalidadosMudanca,
          pausadoPorAtoProcessamento: r.pausadoPorAtoProcessam,
          prenotacaoVinculada: r.prenotacaoVinculada,
          requerente: (r.requerenteJson as any) || {
            nome: "Não informado",
            tipoDocumento: "NAO_INFORMADO",
            documentoMascarado: null,
          },
          apresentante: (r.apresentanteJson as any) || null,
          destinatarioNota: (r.destinatarioNotaJson as any) || null,
          valores: (r.valoresJson as any) || {
            valorServico: 0,
            valorDespesa: 0,
            totalDeposito: 0,
            moeda: "BRL",
          },
          observacoesOrigem: r.observacoesOrigem,
          motivacaoObrigatoriaPorRegra: false,
          pdfOriginalWebriDisponivel: Boolean(r.pdfOriginalWebriPath),
          resultadoPropostoFiorix: r.resultadoPropostoFiorix,
          procedimentoRealEquipe: r.procedimentoRealEquipe,
          statusComparacao: (r.statusComparacao as any) || "AGUARDANDO_EQUIPE",
          divergenciaClassificacao: r.divergenciaClassificacao,
          ambienteSintetico: r.ambienteSintetico,
          itens: r.itens.map((it) => {
            const mIt = itensMetaArr.find((x) => Number(x.sequenciaItem) === it.sequenciaItem);
            return {
              id: it.id,
              sequenciaItem: it.sequenciaItem,
              naturezaCodigo: it.naturezaCodigo,
              naturezaDescricao: it.naturezaDescricao,
              naturezaOriginalWebri: mIt?.naturezaOriginalWebri ?? webriMetaRaw?.naturezaOriginalWebri ?? null,
              livroCodigo: it.livroCodigo,
              livroDescricao: it.livroDescricao,
              numeroMatricula: it.numeroMatricula,
              transcricaoOuLoteamento: it.transcricaoOuLoteamento,
              enderecoPesquisa: it.enderecoPesquisa,
              meioEntregaCodigo: it.meioEntregaCodigo,
              meioEntregaDescricao: it.meioEntregaDescricao,
              dataPrevisaoIso: it.dataPrevisao ? it.dataPrevisao.toISOString() : null,
              dataPrevisaoBr: it.dataPrevisao ? it.dataPrevisao.toLocaleDateString("pt-BR") : null,
              elegivelPiloto: it.elegivelPiloto,
              motivoEncaminhamentoHumano: it.motivoEncaminhamentoHumano,
              statusItem: it.statusItem,
              acervoSnapshot: (it.acervoSnapshotJson as any) || null,
              resultadoPesquisaSistema:
                mIt?.resultadoPesquisaSistema ??
                webriMetaRaw?.resultadoPesquisaSistema ??
                (it.numeroMatricula ? 2 : 1),
              qtdeImpressao: mIt?.qtdeImpressao ?? (webriMetaRaw?.jaImpressa ? 1 : 0),
              dataImpressaoBr: mIt?.dataImpressaoBr ?? null,
              dataEmissaoBr: mIt?.dataEmissaoBr ?? null,
              assinaOnr: mIt?.assinaOnr ?? Boolean(webriMetaRaw?.assinaOnr ?? r.origem === "ONR"),
              atendenteItemNome: mIt?.atendenteItemNome ?? webriMetaRaw?.atendenteNome ?? null,
            };
          }),
          ultimaConferencia: ultima
            ? {
                id: ultima.id,
                versaoRegraAplicada: ultima.versaoRegraAplicada,
                versaoDadosFonteHash: ultima.versaoDadosFonteHash,
                identificacaoStatus: ultima.identificacaoStatus as any,
                vinculoServentia: ultima.vinculoServentia,
                contraditorioStatus: ultima.contraditorioStatus as any,
                prenotacoesEncontradas: (ultima.prenotacoesEncontradasJson as any) || [],
                textoCertidaoSugerido: ultima.textoCertidaoSugerido,
                atualidadeMatriculaStatus: ultima.atualidadeMatriculaStatus as any,
                decisaoProposta: ultima.decisaoProposta as any,
                invalidadaPorMudanca: ultima.invalidadaPorMudanca,
                executadoPorTipo: ultima.executadoPorTipo as any,
                executadoPorNome: ultima.executadoPorNome,
                criadoEmBr: formatarDataHoraBr(ultima.createdAt),
              }
            : null,
          conferidoPeloEscrevente: Boolean(
            (r.valoresJson as any)?._conferenciaEscrevente?.conferido
          ),
          conferidoPorNome:
            (r.valoresJson as any)?._conferenciaEscrevente?.operadorNome || null,
          conferidoEmBr:
            (r.valoresJson as any)?._conferenciaEscrevente?.conferidoEmBr || null,
          devolvidoPeloEscrevente: Boolean(
            (r.valoresJson as any)?._conferenciaEscrevente?.devolvido
          ),
          devolvidoPorNome:
            (r.valoresJson as any)?._conferenciaEscrevente?.devolvidoPorNome || null,
          devolvidoEmBr:
            (r.valoresJson as any)?._conferenciaEscrevente?.devolvidoEmBr || null,
          marcacoesDocumento: Array.isArray((r.valoresJson as any)?._marcacoesDocumento)
            ? ((r.valoresJson as any)._marcacoesDocumento as MarcacaoVisualDocumentoPedido[])
            : [],
          webriMeta: webriMetaRaw || undefined,
        };
      });
    }
  } catch (err) {
    if (isErroTabelaAusente(err)) {
      migracaoPendente = true;
      if (isAmbienteSinteticoPermitido()) {
        pedidosBase = obterSandboxTenant(tenantId).pedidos;
        ambienteSintetico = true;
      } else {
        pedidosBase = [];
        ambienteSintetico = false;
      }
    } else {
      throw err;
    }
  }

  // Filtragem estrita dentro do próprio tenant
  const filtrados = pedidosBase.filter((p) => {
    if (p.tenantId !== tenantId) return false;
    if (
      filtros.estadoOperacional &&
      filtros.estadoOperacional !== "TODOS" &&
      p.estadoOperacional !== filtros.estadoOperacional
    ) {
      return false;
    }
    if (filtros.origem && filtros.origem !== "TODAS" && p.origem !== filtros.origem) {
      return false;
    }
    if (
      filtros.tipoCertidao &&
      filtros.tipoCertidao !== "TODOS" &&
      !correspondeFiltroTipoCertidao(p, filtros.tipoCertidao)
    ) {
      return false;
    }
    if (
      filtros.criterio &&
      filtros.criterio !== "TODOS" &&
      p.criterioSolicitacao !== filtros.criterio
    ) {
      return false;
    }
    if (filtros.apenasDivergentesComparacao && p.statusComparacao !== "DIVERGENTE") {
      return false;
    }
    if (filtros.statusConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) {
      return false;
    }
    if (filtros.statusConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) {
      return false;
    }
    if (
      filtros.statusConferencia === "NAO_CONFERIDO" &&
      (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
    ) {
      return false;
    }
    if (filtros.busca && filtros.busca.trim()) {
      const q = filtros.busca.trim().toLowerCase();
      const bateProtocolo =
        p.numeroPedido.toLowerCase().includes(q) ||
        (p.protocoloExterno || "").toLowerCase().includes(q);
      const bateNome = p.requerente.nome.toLowerCase().includes(q);
      const bateEspecie = p.especieSolicitada.toLowerCase().includes(q);
      const bateMatricula = p.itens.some((it) => String(it.numeroMatricula || "").includes(q));
      const batePrenotacao =
        (p.prenotacaoVinculada || "").toLowerCase().includes(q) ||
        (p.ultimaConferencia?.prenotacoesEncontradas || []).some(
          (pr) =>
            pr.numeroPrenotacao.toLowerCase().includes(q) ||
            (pr.protocoloMagnetico || "").toLowerCase().includes(q) ||
            (pr.tipoPrenotacaoDescricao || "").toLowerCase().includes(q)
        );
      if (!bateProtocolo && !bateNome && !bateEspecie && !bateMatricula && !batePrenotacao)
        return false;
    }
    return true;
  });

  return { pedidos: filtrados, migracaoPendente, ambienteSintetico };
}

export async function obterDetalhePedidoCartorioVirtual(
  tenantId: string,
  pedidoId: string
): Promise<{
  pedido: PedidoCertidaoDetalheDTO | null;
  pendencias: PendenciaPedidoDTO[];
  anotacoes: AnotacaoTarefaDTO[];
  revisoes: RevisaoHumanaDTO[];
  historico: HistoricoOperacaoDTO[];
  ambienteSintetico: boolean;
}> {
  const { pedidos, ambienteSintetico } = await listarPedidosCartorioVirtual(tenantId);
  const pedido =
    pedidos.find((p) => p.tenantId === tenantId && (p.id === pedidoId || p.numeroPedido === pedidoId)) ||
    null;

  if (!pedido) {
    return {
      pedido: null,
      pendencias: [],
      anotacoes: [],
      revisoes: [],
      historico: [],
      ambienteSintetico,
    };
  }

  const pendencias = (await listarPendenciasCartorioVirtual(tenantId)).filter(
    (pd) => pd.pedidoId === pedido.id
  );
  const anotacoes = (await listarAnotacoesCartorioVirtual(tenantId)).filter(
    (an) => an.pedidoId === pedido.id
  );
  const revisoes = (await listarRevisoesCartorioVirtual(tenantId)).filter(
    (rv) => rv.pedidoId === pedido.id
  );
  const historico = (await listarHistoricoCartorioVirtual(tenantId)).filter(
    (hs) => hs.pedidoId === pedido.id
  );

  return { pedido, pendencias, anotacoes, revisoes, historico, ambienteSintetico };
}

export async function obterResumoVisaoGeralCartorioVirtual(
  tenantId: string
): Promise<ResumoVisaoGeralCartorioVirtual> {
  const { pedidos, migracaoPendente, ambienteSintetico } = await listarPedidosCartorioVirtual(
    tenantId
  );
  const anotacoes = await listarAnotacoesCartorioVirtual(tenantId);
  const lotes = await listarLotesImpressaoCartorioVirtual(tenantId);

  const avaliados = pedidos.filter((p) => p.statusComparacao !== "AGUARDANDO_EQUIPE");
  const convergentes = avaliados.filter((p) => p.statusComparacao === "CONVERGENTE").length;
  const divergentes = avaliados.filter((p) => p.statusComparacao === "DIVERGENTE").length;
  const aguardandoEquipe = pedidos.filter((p) => p.statusComparacao === "AGUARDANDO_EQUIPE").length;

  const conferidos = pedidos.filter((p) => Boolean(p.conferidoPeloEscrevente)).length;

  return {
    migracaoPendente,
    ambienteSintetico,
    totalPedidos: pedidos.length,
    conferidos,
    naoConferidos: pedidos.length - conferidos,
    recebidos: pedidos.filter((p) => p.estadoOperacional === "RECEBIDO").length,
    emAndamento: pedidos.filter((p) =>
      ["EM_IDENTIFICACAO", "AGUARDANDO_CONTRADITORIO", "EM_CONFERENCIA", "EM_IMPRESSAO"].includes(
        p.estadoOperacional
      )
    ).length,
    aptosEmissao: pedidos.filter((p) => p.estadoOperacional === "APTO_EMISSAO").length,
    emRevisaoHumana: pedidos.filter((p) => p.estadoOperacional === "EM_REVISAO_HUMANA").length,
    aguardandoAtualizacaoMatricula: pedidos.filter(
      (p) => p.estadoOperacional === "AGUARDANDO_ATUALIZACAO_MATRICULA"
    ).length,
    pausadosAtoProcessamento: pedidos.filter((p) => p.pausadoPorAtoProcessamento).length,
    comFalhaOuPendencia: pedidos.filter((p) => p.estadoOperacional === "COM_FALHA_OU_PENDENCIA")
      .length,
    entreguesOuConcluidos: pedidos.filter((p) =>
      ["EMITIDO", "ASSINADO", "ENTREGUE"].includes(p.estadoOperacional)
    ).length,
    anotacoesAbertas: anotacoes.filter((a) => !["RESOLVIDA", "ARQUIVADA"].includes(a.status))
      .length,
    lotesImpressaoGerados: lotes.length,
    comparacaoPiloto: {
      totalAvaliados: avaliados.length,
      convergentes,
      divergentes,
      aguardandoEquipe,
      taxaConvergenciaPercentual:
        avaliados.length > 0 ? Math.round((convergentes / avaliados.length) * 100) : 0,
    },
  };
}

export async function listarPendenciasCartorioVirtual(
  tenantId: string
): Promise<PendenciaPedidoDTO[]> {
  if (isAmbienteSinteticoPermitido()) {
    return obterSandboxTenant(tenantId).pendencias.filter((p) => p.tenantId === tenantId);
  }
  try {
    const rows = await prisma.fiorixCvPendencia.findMany({
      where: { tenantId },
      include: { pedido: { select: { numeroPedido: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      pedidoId: r.pedidoId,
      numeroPedido: r.pedido.numeroPedido,
      tipoPendencia: r.tipoPendencia,
      titulo: r.titulo,
      descricao: r.descricao,
      status: r.status as any,
      prenotacaoRef: r.prenotacaoRef,
      numeroMatricula: r.numeroMatricula,
      responsavelNome: r.responsavelNome,
      evidenciaConclusao: r.evidenciaConclusao,
      resolvidaPorNome: r.resolvidaPorNome,
      resolvidaEmBr: r.resolvidaEm ? formatarDataHoraBr(r.resolvidaEm) : null,
      criadoEmBr: formatarDataHoraBr(r.createdAt),
    }));
  } catch (err) {
    if (isErroTabelaAusente(err)) return [];
    throw err;
  }
}

/**
 * Lista Anotações e Tarefas preservando histórico integral de edições (`versoes`) e fios de resposta (`respostas`).
 */
export async function listarAnotacoesCartorioVirtual(
  tenantId: string
): Promise<AnotacaoTarefaDTO[]> {
  if (isAmbienteSinteticoPermitido()) {
    return obterSandboxTenant(tenantId).anotacoes.filter(
      (a) => a.tenantId === tenantId && !a.parentId
    );
  }
  try {
    const rows = await prisma.fiorixCvAnotacao.findMany({
      where: { tenantId },
      include: {
        pedido: { select: { numeroPedido: true } },
        versoes: { orderBy: { versao: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const porId = new Map<string, AnotacaoTarefaDTO>();
    const raizes: AnotacaoTarefaDTO[] = [];

    for (const r of rows) {
      porId.set(r.id, {
        id: r.id,
        tenantId: r.tenantId,
        pedidoId: r.pedidoId,
        numeroPedido: r.pedido?.numeroPedido ?? null,
        numeroMatricula: r.numeroMatricula,
        parentId: r.parentId,
        tipoRegistro: r.tipoRegistro as any,
        categoria: r.categoria,
        prioridade: r.prioridade as any,
        visibilidade: r.visibilidade as any,
        status: r.status as any,
        titulo: r.titulo,
        conteudoAtual: r.conteudoAtual,
        versaoAtual: r.versaoAtual,
        autorId: r.autorId,
        autorNome: r.autorNome,
        autorPapel: r.autorPapel,
        atribuidoParaNome: r.atribuidoParaNome,
        setorDestino: r.setorDestino,
        prazoEmBr: r.prazoEm ? formatarDataHoraBr(r.prazoEm) : null,
        concluidaEmBr: r.concluidaEm ? formatarDataHoraBr(r.concluidaEm) : null,
        concluidaPorNome: r.concluidaPorNome,
        criadoEmBr: formatarDataHoraBr(r.createdAt),
        versoes: r.versoes.map((v) => ({
          id: v.id,
          versao: v.versao,
          conteudo: v.conteudo,
          motivoEdicao: v.motivoEdicao,
          editadoPorNome: v.editadoPorNome,
          criadoEmBr: formatarDataHoraBr(v.createdAt),
        })),
        respostas: [],
      });
    }

    for (const item of porId.values()) {
      if (item.parentId && porId.has(item.parentId)) {
        porId.get(item.parentId)!.respostas.push(item);
      } else {
        raizes.push(item);
      }
    }

    return raizes;
  } catch (err) {
    if (isErroTabelaAusente(err)) return [];
    throw err;
  }
}

export async function criarAnotacaoOuTarefaCartorioVirtual(params: {
  tenantId: string;
  pedidoId?: string | null;
  numeroMatricula?: number | null;
  parentId?: string | null;
  tipoRegistro: "ANOTACAO" | "TAREFA" | "DIVERGENCIA" | "ORIENTACAO";
  categoria: string;
  prioridade: "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";
  visibilidade?: "EQUIPE_INTERNA" | "REVISORES" | "GESTAO";
  titulo: string;
  conteudo: string;
  atribuidoParaNome?: string | null;
  setorDestino?: string | null;
  prazoIso?: string | null;
  autorId: string;
  autorNome: string;
  autorPapel: string;
}): Promise<AnotacaoTarefaDTO> {
  const tituloLimpo = params.titulo.trim();
  const conteudoLimpo = params.conteudo.trim();
  if (!tituloLimpo || !conteudoLimpo) {
    throw new Error("Título e conteúdo da anotação/tarefa são obrigatórios.");
  }

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const pedidoVinc = params.pedidoId
      ? store.pedidos.find((p) => p.id === params.pedidoId && p.tenantId === params.tenantId)
      : null;
    if (params.pedidoId && !pedidoVinc) {
      throw new Error("Pedido vinculado não pertence a esta serventia.");
    }

    const agoraBr = formatarDataHoraBr();
    const nova: AnotacaoTarefaDTO = {
      id: `anot-${randomUUID()}`,
      tenantId: params.tenantId,
      pedidoId: pedidoVinc?.id ?? null,
      numeroPedido: pedidoVinc?.numeroPedido ?? null,
      numeroMatricula: params.numeroMatricula ?? null,
      parentId: params.parentId ?? null,
      tipoRegistro: params.tipoRegistro,
      categoria: params.categoria || "CONFERENCIA",
      prioridade: params.prioridade,
      visibilidade: params.visibilidade || "EQUIPE_INTERNA",
      status: "ABERTA",
      titulo: tituloLimpo,
      conteudoAtual: conteudoLimpo,
      versaoAtual: 1,
      autorId: params.autorId,
      autorNome: params.autorNome,
      autorPapel: params.autorPapel,
      atribuidoParaNome: params.atribuidoParaNome ?? null,
      setorDestino: params.setorDestino ?? null,
      prazoEmBr: params.prazoIso ? formatarDataHoraBr(new Date(params.prazoIso)) : null,
      concluidaEmBr: null,
      concluidaPorNome: null,
      criadoEmBr: agoraBr,
      versoes: [
        {
          id: `ver-${randomUUID()}`,
          versao: 1,
          conteudo: conteudoLimpo,
          motivoEdicao: "Criação original",
          editadoPorNome: params.autorNome,
          criadoEmBr: agoraBr,
        },
      ],
      respostas: [],
    };

    if (params.parentId) {
      const pai = store.anotacoes.find(
        (a) => a.id === params.parentId && a.tenantId === params.tenantId
      );
      if (!pai) {
        throw new Error("Anotação principal não encontrada nesta serventia.");
      }
      pai.respostas.push(nova);
    } else {
      store.anotacoes.unshift(nova);
    }

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: nova.pedidoId,
      atorTipo: "HUMANO",
      atorId: params.autorId,
      atorNome: params.autorNome,
      papelRegistral: params.autorPapel,
      evento: params.parentId ? "RESPOSTA_ANOTACAO_REGISTRADA" : "ANOTACAO_OU_TAREFA_CRIADA",
      resumo: `${params.tipoRegistro} "${nova.titulo}" registrada por ${params.autorNome}.`,
    });

    return nova;
  }

  const criada = await prisma.fiorixCvAnotacao.create({
    data: {
      tenantId: params.tenantId,
      pedidoId: params.pedidoId ?? null,
      numeroMatricula: params.numeroMatricula ?? null,
      parentId: params.parentId ?? null,
      tipoRegistro: params.tipoRegistro,
      categoria: params.categoria || "CONFERENCIA",
      prioridade: params.prioridade,
      visibilidade: params.visibilidade || "EQUIPE_INTERNA",
      status: "ABERTA",
      titulo: tituloLimpo,
      conteudoAtual: conteudoLimpo,
      versaoAtual: 1,
      autorId: params.autorId,
      autorNome: params.autorNome,
      autorPapel: params.autorPapel,
      atribuidoParaNome: params.atribuidoParaNome ?? null,
      setorDestino: params.setorDestino ?? null,
      prazoEm: params.prazoIso ? new Date(params.prazoIso) : null,
      versoes: {
        create: {
          versao: 1,
          conteudo: conteudoLimpo,
          motivoEdicao: "Criação original",
          editadoPorId: params.autorId,
          editadoPorNome: params.autorNome,
        },
      },
    },
    include: {
      pedido: { select: { numeroPedido: true } },
      versoes: { orderBy: { versao: "desc" } },
    },
  });

  await registrarEventoHistoricoCartorioVirtual({
    tenantId: params.tenantId,
    pedidoId: criada.pedidoId,
    atorTipo: "HUMANO",
    atorId: params.autorId,
    atorNome: params.autorNome,
    papelRegistral: params.autorPapel,
    evento: "ANOTACAO_OU_TAREFA_CRIADA",
    resumo: `${params.tipoRegistro} "${criada.titulo}" criada.`,
  });

  return {
    id: criada.id,
    tenantId: criada.tenantId,
    pedidoId: criada.pedidoId,
    numeroPedido: criada.pedido?.numeroPedido ?? null,
    numeroMatricula: criada.numeroMatricula,
    parentId: criada.parentId,
    tipoRegistro: criada.tipoRegistro as any,
    categoria: criada.categoria,
    prioridade: criada.prioridade as any,
    visibilidade: criada.visibilidade as any,
    status: criada.status as any,
    titulo: criada.titulo,
    conteudoAtual: criada.conteudoAtual,
    versaoAtual: criada.versaoAtual,
    autorId: criada.autorId,
    autorNome: criada.autorNome,
    autorPapel: criada.autorPapel,
    atribuidoParaNome: criada.atribuidoParaNome,
    setorDestino: criada.setorDestino,
    prazoEmBr: criada.prazoEm ? formatarDataHoraBr(criada.prazoEm) : null,
    concluidaEmBr: null,
    concluidaPorNome: null,
    criadoEmBr: formatarDataHoraBr(criada.createdAt),
    versoes: criada.versoes.map((v) => ({
      id: v.id,
      versao: v.versao,
      conteudo: v.conteudo,
      motivoEdicao: v.motivoEdicao,
      editadoPorNome: v.editadoPorNome,
      criadoEmBr: formatarDataHoraBr(v.createdAt),
    })),
    respostas: [],
  };
}

/**
 * Edição NÃO-DESTRUTIVA de anotação/tarefa (Seção 8):
 * Toda edição incrementa `versaoAtual` e preserva integralmente o texto anterior em `versoes`!
 */
export async function editarAnotacaoPreservandoHistorico(params: {
  tenantId: string;
  anotacaoId: string;
  novoConteudo: string;
  motivoEdicao: string;
  novoStatus?: "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_RETORNO" | "RESOLVIDA" | "ARQUIVADA";
  editorId: string;
  editorNome: string;
  editorPapel: string;
}): Promise<AnotacaoTarefaDTO> {
  const textoNovo = params.novoConteudo.trim();
  const motivo = params.motivoEdicao.trim();
  if (!textoNovo) {
    throw new Error("O novo conteúdo da anotação não pode ser vazio.");
  }
  if (!motivo) {
    throw new Error("Informe o motivo da edição para registro na trilha de auditoria.");
  }

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const alvo = store.anotacoes.find(
      (a) => a.id === params.anotacaoId && a.tenantId === params.tenantId
    );
    if (!alvo) {
      throw new Error("Anotação não encontrada nesta serventia.");
    }

    const proximaVersao = alvo.versaoAtual + 1;
    const agoraBr = formatarDataHoraBr();

    alvo.conteudoAtual = textoNovo;
    alvo.versaoAtual = proximaVersao;
    if (params.novoStatus) {
      alvo.status = params.novoStatus;
      if (params.novoStatus === "RESOLVIDA") {
        alvo.concluidaEmBr = agoraBr;
        alvo.concluidaPorNome = params.editorNome;
      }
    }

    alvo.versoes.unshift({
      id: `ver-${randomUUID()}`,
      versao: proximaVersao,
      conteudo: textoNovo,
      motivoEdicao: motivo,
      editadoPorNome: params.editorNome,
      criadoEmBr: agoraBr,
    });

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: alvo.pedidoId,
      atorTipo: "HUMANO",
      atorId: params.editorId,
      atorNome: params.editorNome,
      papelRegistral: params.editorPapel,
      evento: "ANOTACAO_EDITADA_COM_VERSAO_PRESERVADA",
      resumo: `Anotação "${alvo.titulo}" atualizada para v${proximaVersao} (histórico anterior preservado). Motivo: ${motivo}`,
    });

    return alvo;
  }

  const atual = await prisma.fiorixCvAnotacao.findFirst({
    where: { id: params.anotacaoId, tenantId: params.tenantId },
  });
  if (!atual) {
    throw new Error("Anotação não encontrada nesta serventia.");
  }

  const proximaVersao = atual.versaoAtual + 1;
  const atualizada = await prisma.fiorixCvAnotacao.update({
    where: { id: atual.id },
    data: {
      conteudoAtual: textoNovo,
      versaoAtual: proximaVersao,
      ...(params.novoStatus ? { status: params.novoStatus } : {}),
      ...(params.novoStatus === "RESOLVIDA"
        ? { concluidaEm: new Date(), concluidaPorNome: params.editorNome }
        : {}),
      versoes: {
        create: {
          versao: proximaVersao,
          conteudo: textoNovo,
          motivoEdicao: motivo,
          editadoPorId: params.editorId,
          editadoPorNome: params.editorNome,
        },
      },
    },
    include: {
      pedido: { select: { numeroPedido: true } },
      versoes: { orderBy: { versao: "desc" } },
    },
  });

  await registrarEventoHistoricoCartorioVirtual({
    tenantId: params.tenantId,
    pedidoId: atualizada.pedidoId,
    atorTipo: "HUMANO",
    atorId: params.editorId,
    atorNome: params.editorNome,
    papelRegistral: params.editorPapel,
    evento: "ANOTACAO_EDITADA_COM_VERSAO_PRESERVADA",
    resumo: `Anotação "${atualizada.titulo}" atualizada para v${proximaVersao}.`,
  });

  return {
    id: atualizada.id,
    tenantId: atualizada.tenantId,
    pedidoId: atualizada.pedidoId,
    numeroPedido: atualizada.pedido?.numeroPedido ?? null,
    numeroMatricula: atualizada.numeroMatricula,
    parentId: atualizada.parentId,
    tipoRegistro: atualizada.tipoRegistro as any,
    categoria: atualizada.categoria,
    prioridade: atualizada.prioridade as any,
    visibilidade: atualizada.visibilidade as any,
    status: atualizada.status as any,
    titulo: atualizada.titulo,
    conteudoAtual: atualizada.conteudoAtual,
    versaoAtual: atualizada.versaoAtual,
    autorId: atualizada.autorId,
    autorNome: atualizada.autorNome,
    autorPapel: atualizada.autorPapel,
    atribuidoParaNome: atualizada.atribuidoParaNome,
    setorDestino: atualizada.setorDestino,
    prazoEmBr: atualizada.prazoEm ? formatarDataHoraBr(atualizada.prazoEm) : null,
    concluidaEmBr: atualizada.concluidaEm ? formatarDataHoraBr(atualizada.concluidaEm) : null,
    concluidaPorNome: atualizada.concluidaPorNome,
    criadoEmBr: formatarDataHoraBr(atualizada.createdAt),
    versoes: atualizada.versoes.map((v) => ({
      id: v.id,
      versao: v.versao,
      conteudo: v.conteudo,
      motivoEdicao: v.motivoEdicao,
      editadoPorNome: v.editadoPorNome,
      criadoEmBr: formatarDataHoraBr(v.createdAt),
    })),
    respostas: [],
  };
}

/**
 * Exclui uma anotação do Escrevente (ou resposta vinculada) do Pedido,
 * removendo-a da Ficha de Impressão (Pág. 2) e registrando o evento na trilha auditável.
 */
export async function excluirAnotacaoCartorioVirtual(params: {
  tenantId: string;
  anotacaoId: string;
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<{ idExcluido: string; pedidoId: string | null }> {
  if (!params.anotacaoId?.trim()) {
    throw new Error("Identificador da anotação é obrigatório para exclusão.");
  }

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const idxRaiz = store.anotacoes.findIndex(
      (a) => a.id === params.anotacaoId && a.tenantId === params.tenantId
    );

    if (idxRaiz >= 0) {
      const [removida] = store.anotacoes.splice(idxRaiz, 1);
      await registrarEventoHistoricoCartorioVirtual({
        tenantId: params.tenantId,
        pedidoId: removida.pedidoId,
        atorTipo: "HUMANO",
        atorId: params.operadorId,
        atorNome: params.operadorNome,
        papelRegistral: params.papelRegistral,
        evento: "ANOTACAO_ESCREVENTE_EXCLUIDA",
        resumo: `Anotação "${removida.titulo}" excluída do Pedido por ${params.operadorNome}.`,
      });
      return { idExcluido: removida.id, pedidoId: removida.pedidoId };
    }

    // Verifica se é uma resposta encadeada dentro de uma anotação principal desta serventia
    for (const pai of store.anotacoes) {
      if (pai.tenantId !== params.tenantId) continue;
      const idxResp = pai.respostas.findIndex(
        (r) => r.id === params.anotacaoId && r.tenantId === params.tenantId
      );
      if (idxResp >= 0) {
        const [respRemovida] = pai.respostas.splice(idxResp, 1);
        await registrarEventoHistoricoCartorioVirtual({
          tenantId: params.tenantId,
          pedidoId: respRemovida.pedidoId ?? pai.pedidoId,
          atorTipo: "HUMANO",
          atorId: params.operadorId,
          atorNome: params.operadorNome,
          papelRegistral: params.papelRegistral,
          evento: "RESPOSTA_ANOTACAO_EXCLUIDA",
          resumo: `Complemento/resposta "${respRemovida.titulo}" excluído por ${params.operadorNome}.`,
        });
        return {
          idExcluido: respRemovida.id,
          pedidoId: respRemovida.pedidoId ?? pai.pedidoId,
        };
      }
    }

    throw new Error("Anotação não encontrada nesta serventia.");
  }

  const atual = await prisma.fiorixCvAnotacao.findFirst({
    where: { id: params.anotacaoId, tenantId: params.tenantId },
  });
  if (!atual) {
    throw new Error("Anotação não encontrada nesta serventia.");
  }

  await prisma.fiorixCvAnotacao.deleteMany({
    where: {
      tenantId: params.tenantId,
      OR: [{ id: atual.id }, { parentId: atual.id }],
    },
  });

  await registrarEventoHistoricoCartorioVirtual({
    tenantId: params.tenantId,
    pedidoId: atual.pedidoId,
    atorTipo: "HUMANO",
    atorId: params.operadorId,
    atorNome: params.operadorNome,
    papelRegistral: params.papelRegistral,
    evento: "ANOTACAO_ESCREVENTE_EXCLUIDA",
    resumo: `Anotação "${atual.titulo}" excluída do Pedido por ${params.operadorNome}.`,
  });

  return { idExcluido: atual.id, pedidoId: atual.pedidoId };
}

/**
 * Conclui atualização/digitalização de matrícula (Regras 6.3 e 6.4) e executa
 * OBRIGATORIAMENTE uma nova conferência sobre a nova versão dos dados-fonte!
 */
export async function concluirAtualizacaoMatriculaEReconferir(params: {
  tenantId: string;
  pedidoId: string;
  evidenciaConclusao: string;
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<PedidoCertidaoDetalheDTO> {
  if (!params.evidenciaConclusao.trim()) {
    throw new Error(
      "Descreva a evidência de conclusão do ato, lançamento na matrícula e digitalização no acervo."
    );
  }

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const pedido = store.pedidos.find(
      (p) => p.id === params.pedidoId && p.tenantId === params.tenantId
    );
    if (!pedido) {
      throw new Error("Pedido não localizado nesta serventia.");
    }

    const agoraIso = new Date().toISOString();
    const agoraBr = formatarDataHoraBr();

    // Atualiza snapshot do acervo e encerra ato em processamento
    for (const item of pedido.itens) {
      if (item.numeroMatricula) {
        item.acervoSnapshot = {
          numeroMatricula: item.numeroMatricula,
          vinculadaServentia: true,
          possuiRegistroEstruturado: true,
          possuiArquivoDigitalizado: true,
          formatoArquivo: "PDF",
          ultimaAtualizacaoAtosIso: agoraIso,
          ultimaDigitalizacaoIso: agoraIso,
          integraEAtualizada: true,
          pendenciaDetectada: null,
        };
        item.statusItem = "RECONFERIDO_APOS_ATUALIZACAO";
      }
    }

    const novoHash = gerarHashVersaoDadosFonte({
      tenantId: params.tenantId,
      numeroPedido: pedido.numeroPedido,
      itens: pedido.itens.map((i) => ({
        sequenciaItem: i.sequenciaItem,
        numeroMatricula: i.numeroMatricula,
        naturezaDescricao: i.naturezaDescricao,
      })),
      prenotacoes: [],
      acervos: pedido.itens
        .map((i) => i.acervoSnapshot)
        .filter((ac): ac is NonNullable<typeof ac> => Boolean(ac)),
    });

    const novaConf = executarRegrasConferenciaPedido({
      elegivelPiloto: pedido.subtipoConfirmado === "INTEIRO_TEOR_MATRICULA",
      criterioSolicitacao: pedido.criterioSolicitacao,
      motivoEncaminhamentoHumano: null,
      numeroMatricula: pedido.itens[0]?.numeroMatricula ?? null,
      acervo: pedido.itens[0]?.acervoSnapshot ?? null,
      contraditorioDisponivel: true,
      prenotacoes: [],
    });

    const estadoAntigo = pedido.estadoOperacional;
    const validacaoTransicao = validarTransicaoEstadoPedido({
      estadoAtual: estadoAntigo,
      novoEstado: "EM_CONFERENCIA",
      atorTipo: "HUMANO",
      pausadoPorAtoProcessamento: false,
      dadosInvalidadosMudanca: false,
      novaConferenciaRealizadaAposAto: true,
    });
    if (!validacaoTransicao.permitida) {
      throw new Error(validacaoTransicao.motivoBloqueio);
    }

    pedido.pausadoPorAtoProcessamento = false;
    pedido.dadosInvalidadosMudanca = false;
    pedido.versaoDadosFonteHash = novoHash;
    pedido.estadoOperacional = novaConf.estadoSugerido;
    pedido.estadoOperacionalLabel = ESTADOS_OPERACIONAIS_LABELS[novaConf.estadoSugerido];
    pedido.resultadoPropostoFiorix = novaConf.decisaoProposta;
    pedido.ultimaConferencia = {
      id: `conf-${randomUUID()}`,
      versaoRegraAplicada: "PILOTO_7RI_V1.0",
      versaoDadosFonteHash: novoHash,
      identificacaoStatus: novaConf.identificacaoStatus,
      vinculoServentia: novaConf.vinculoServentia,
      contraditorioStatus: novaConf.contraditorioStatus,
      prenotacoesEncontradas: [],
      textoCertidaoSugerido: novaConf.textoCertidaoSugerido,
      atualidadeMatriculaStatus: novaConf.atualidadeMatriculaStatus,
      decisaoProposta: novaConf.decisaoProposta,
      invalidadaPorMudanca: false,
      executadoPorTipo: "HUMANO",
      executadoPorNome: params.operadorNome,
      criadoEmBr: agoraBr,
    };

    for (const pend of store.pendencias) {
      if (pend.pedidoId === pedido.id && pend.status !== "CONCLUIDA") {
        pend.status = "CONCLUIDA";
        pend.evidenciaConclusao = params.evidenciaConclusao.trim();
        pend.resolvidaPorNome = params.operadorNome;
        pend.resolvidaEmBr = agoraBr;
      }
    }

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: pedido.id,
      atorTipo: "HUMANO",
      atorId: params.operadorId,
      atorNome: params.operadorNome,
      papelRegistral: params.papelRegistral,
      evento: "ATUALIZACAO_MATRICULA_CONCLUIDA_E_RECONFERIDA",
      estadoAnterior: estadoAntigo,
      estadoNovo: pedido.estadoOperacional,
      resumo: `Atualização/digitalização concluída e nova conferência executada (${params.evidenciaConclusao.trim()}).`,
    });

    return pedido;
  }

  throw new Error("Aguardando aplicação da migração local do piloto no banco PostgreSQL.");
}

export async function listarRevisoesCartorioVirtual(
  tenantId: string
): Promise<RevisaoHumanaDTO[]> {
  if (isAmbienteSinteticoPermitido()) {
    return obterSandboxTenant(tenantId).revisoes.filter((r) => r.tenantId === tenantId);
  }
  try {
    const rows = await prisma.fiorixCvRevisaoDecisao.findMany({
      where: { tenantId },
      include: {
        pedido: { select: { numeroPedido: true, origem: true, especieSolicitada: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      pedidoId: r.pedidoId,
      numeroPedido: r.pedido.numeroPedido,
      origem: r.pedido.origem,
      especieSolicitada: r.pedido.especieSolicitada,
      motivoRevisao: r.motivoRevisao,
      evidencias: (r.evidenciasJson as any) || {},
      statusRevisao: r.statusRevisao as any,
      decisaoHumana: r.decisaoHumana,
      justificativa: r.justificativa,
      limitesAprovacao: r.limitesAprovacao,
      versaoDadosFonteHash: r.versaoDadosFonteHash,
      decididoPorNome: r.decididoPorNome,
      papelRegistralNoAto: r.papelRegistralNoAto,
      decididoEmBr: r.decididoEm ? formatarDataHoraBr(r.decididoEm) : null,
      criadoEmBr: formatarDataHoraBr(r.createdAt),
    }));
  } catch (err) {
    if (isErroTabelaAusente(err)) return [];
    throw err;
  }
}

/**
 * Registra decisão humana de revisão/aprovação exigindo:
 * 1. Papel registral competente (`OFICIAL`, `OFICIAL_SUBSTITUTO` ou `ESCREVENTE_AUTORIZADO`).
 * 2. Correspondência exata do `versaoDadosFonteHash` (se a matrícula ou Contraditório mudou após
 *    a conferência, bloqueia aprovação obsoleta e marca como INVALIDADA_POR_MUDANCA — Seção 12 & 14).
 */
export async function registrarDecisaoRevisaoHumana(params: {
  tenantId: string;
  revisaoId: string;
  decisao: "APROVADA" | "REPROVADA" | "DEVOLVIDA_ATUALIZACAO";
  justificativa: string;
  versaoDadosConfirmadaHash: string;
  decididoPorId: string;
  decididoPorNome: string;
  papelRegistral: PapelRegistral;
}): Promise<RevisaoHumanaDTO> {
  const papeisAutorizados: PapelRegistral[] = [
    "OFICIAL",
    "OFICIAL_SUBSTITUTO",
    "ESCREVENTE_AUTORIZADO",
  ];
  if (!papeisAutorizados.includes(params.papelRegistral)) {
    throw new Error(
      `Competência registral insuficiente: o papel "${params.papelRegistral}" não pode aprovar ou decidir revisões de certidão (Seção 14).`
    );
  }
  if (!params.justificativa.trim()) {
    throw new Error("A justificativa/fundamentação da decisão de revisão é obrigatória.");
  }

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const rev = store.revisoes.find(
      (r) => r.id === params.revisaoId && r.tenantId === params.tenantId
    );
    if (!rev) {
      throw new Error("Registro de revisão não pertence a esta serventia.");
    }

    const pedido = store.pedidos.find(
      (p) => p.id === rev.pedidoId && p.tenantId === params.tenantId
    );
    if (!pedido) {
      throw new Error("Pedido associado não encontrado.");
    }

    if (
      pedido.dadosInvalidadosMudanca ||
      pedido.versaoDadosFonteHash !== params.versaoDadosConfirmadaHash
    ) {
      rev.statusRevisao = "INVALIDADA_POR_MUDANCA";
      throw new Error(
        "Aprovação bloqueada: os dados da matrícula ou do Contraditório sofreram alteração relevante após a última conferência. Execute nova conferência antes de decidir."
      );
    }

    const agoraBr = formatarDataHoraBr();
    rev.statusRevisao = params.decisao;
    rev.decisaoHumana = params.decisao;
    rev.justificativa = params.justificativa.trim();
    rev.decididoPorNome = params.decididoPorNome;
    rev.papelRegistralNoAto = params.papelRegistral;
    rev.decididoEmBr = agoraBr;

    const estadoAntigo = pedido.estadoOperacional;
    const novoEstado: EstadoOperacionalPedido =
      params.decisao === "APROVADA"
        ? "APTO_EMISSAO"
        : params.decisao === "DEVOLVIDA_ATUALIZACAO"
        ? "AGUARDANDO_ATUALIZACAO_MATRICULA"
        : "COM_FALHA_OU_PENDENCIA";

    const checkTrans = validarTransicaoEstadoPedido({
      estadoAtual: estadoAntigo,
      novoEstado,
      atorTipo: "HUMANO",
      pausadoPorAtoProcessamento: pedido.pausadoPorAtoProcessamento,
      dadosInvalidadosMudanca: pedido.dadosInvalidadosMudanca,
    });
    if (!checkTrans.permitida) {
      throw new Error(checkTrans.motivoBloqueio);
    }

    pedido.estadoOperacional = novoEstado;
    pedido.estadoOperacionalLabel = ESTADOS_OPERACIONAIS_LABELS[novoEstado];

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: pedido.id,
      atorTipo: "HUMANO",
      atorId: params.decididoPorId,
      atorNome: params.decididoPorNome,
      papelRegistral: params.papelRegistral,
      evento: `REVISAO_HUMANA_${params.decisao}`,
      estadoAnterior: estadoAntigo,
      estadoNovo: novoEstado,
      resumo: `Revisão decidida (${params.decisao}) por ${params.decididoPorNome} (${params.papelRegistral}): ${rev.justificativa}`,
    });

    return rev;
  }

  throw new Error("Aguardando aplicação da migração local do piloto no banco PostgreSQL.");
}

export async function registrarProcedimentoRealEquipeComparacao(params: {
  tenantId: string;
  pedidoId: string;
  procedimentoRealEquipe: string;
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<PedidoCertidaoDetalheDTO> {
  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const pedido = store.pedidos.find(
      (p) => p.id === params.pedidoId && p.tenantId === params.tenantId
    );
    if (!pedido) {
      throw new Error("Pedido não localizado nesta serventia.");
    }

    const comp = avaliarComparacaoPiloto({
      decisaoPropostaFiorix: pedido.resultadoPropostoFiorix || "ENCAMINHAR_REVISAO_HUMANA",
      procedimentoRealEquipe: params.procedimentoRealEquipe,
    });

    pedido.procedimentoRealEquipe = params.procedimentoRealEquipe;
    pedido.statusComparacao = comp.statusComparacao;
    pedido.divergenciaClassificacao = comp.divergenciaClassificacao;

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: pedido.id,
      atorTipo: "HUMANO",
      atorId: params.operadorId,
      atorNome: params.operadorNome,
      papelRegistral: params.papelRegistral,
      evento: "MODO_COMPARACAO_REGISTRADO",
      resumo: `Modo de Comparação: FIORIX propôs "${pedido.resultadoPropostoFiorix}", equipe executou "${params.procedimentoRealEquipe}" -> ${comp.statusComparacao}.`,
    });

    return pedido;
  }

  throw new Error("Aguardando aplicação da migração local do piloto no banco PostgreSQL.");
}

export async function listarLotesImpressaoCartorioVirtual(
  tenantId: string
): Promise<LoteImpressaoResumoDTO[]> {
  if (isAmbienteSinteticoPermitido()) {
    return obterSandboxTenant(tenantId)
      .lotes.filter((l) => l.tenantId === tenantId)
      .map(({ snapshotPedidos: _s, ...resumo }) => resumo);
  }
  try {
    const rows = await prisma.fiorixCvLoteImpressao.findMany({
      where: { tenantId },
      include: { eventos: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      codigoLote: r.codigoLote,
      modoSelecao: r.modoSelecao as any,
      modoDadosImpressao: r.modoDadosImpressao as any,
      duplexFrenteNovaFolha: r.duplexFrenteNovaFolha,
      criterioOrdenacao: r.criterioOrdenacao,
      pedidosIds: (r.pedidosIdsJson as string[]) || [],
      numerosPedidos: ((r.snapshotPedidosJson as any[]) || []).map((p) =>
        String(p?.numeroPedido || "")
      ),
      totalPedidos: r.totalPedidos,
      totalPaginas: r.totalPaginas,
      paginasBrancoDuplex: r.paginasBrancoDuplex,
      arquivoHashSha256: r.arquivoHashSha256,
      statusLote: r.statusLote,
      loteOrigemReimpressaoId: r.loteOrigemReimpressaoId,
      motivoReimpressao: r.motivoReimpressao,
      criadoPorNome: r.criadoPorNome,
      criadoEmBr: formatarDataHoraBr(r.createdAt),
      eventos: r.eventos.map((ev) => ({
        id: ev.id,
        evento: ev.evento,
        observacao: ev.observacao,
        operadorNome: ev.operadorNome,
        criadoEmBr: formatarDataHoraBr(ev.createdAt),
      })),
    }));
  } catch (err) {
    if (isErroTabelaAusente(err)) return [];
    throw err;
  }
}

export async function criarLoteImpressaoPedidos(params: {
  tenantId: string;
  modoSelecao: "INDIVIDUAL" | "SELECIONADOS" | "FILTRADOS" | "TOTAL_DISPONIVEL";
  pedidosIds?: string[];
  filtros?: FiltrosConsultaPedidosCV;
  duplexFrenteNovaFolha: boolean;
  modoDadosImpressao: "ORIGINAL_CONGELADO" | "ATUAL_RECONSTRUIDO";
  criterioOrdenacao?: "NUMERO_PEDIDO_ASC" | "DATA_PEDIDO_DESC" | "ORIGEM_ASC" | "ORDEM_DIGITADA";
  loteOrigemReimpressaoId?: string | null;
  motivoReimpressao?: string | null;
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<LoteImpressaoResumoDTO> {
  if (params.loteOrigemReimpressaoId && !params.motivoReimpressao?.trim()) {
    throw new Error("A reimpressão de lote exige justificativa auditável.");
  }

  let pedidosAlvo: PedidoCertidaoDetalheDTO[] = [];

  if (
    params.loteOrigemReimpressaoId &&
    params.modoDadosImpressao === "ORIGINAL_CONGELADO" &&
    isAmbienteSinteticoPermitido()
  ) {
    const store = obterSandboxTenant(params.tenantId);
    const loteOrig = store.lotes.find(
      (l) => l.id === params.loteOrigemReimpressaoId && l.tenantId === params.tenantId
    );
    if (!loteOrig) {
      throw new Error("Lote original não encontrado nesta serventia.");
    }
    pedidosAlvo = JSON.parse(JSON.stringify(loteOrig.snapshotPedidos));
  } else if (
    params.loteOrigemReimpressaoId &&
    params.modoDadosImpressao === "ORIGINAL_CONGELADO"
  ) {
    const loteOrigDb = await prisma.fiorixCvLoteImpressao.findFirst({
      where: { id: params.loteOrigemReimpressaoId, tenantId: params.tenantId },
    });
    if (!loteOrigDb) {
      throw new Error("Lote original não encontrado nesta serventia.");
    }
    pedidosAlvo = ((loteOrigDb.snapshotPedidosJson as unknown as PedidoCertidaoDetalheDTO[]) || []);
  } else {
    const { pedidos } = await listarPedidosCartorioVirtual(params.tenantId, params.filtros || {});
    if (params.modoSelecao === "INDIVIDUAL" || params.modoSelecao === "SELECIONADOS") {
      const idSet = new Set(params.pedidosIds || []);
      pedidosAlvo = pedidos.filter((p) => idSet.has(p.id) || idSet.has(p.numeroPedido));
    } else {
      pedidosAlvo = pedidos;
    }
  }

  if (pedidosAlvo.length === 0) {
    throw new Error("Nenhum pedido elegível encontrado para compor o lote de impressão.");
  }

  // Ordenação determinística do lote (incluindo preservação exata da sequência digitada pelo Escrevente)
  const ord = params.criterioOrdenacao || "NUMERO_PEDIDO_ASC";
  if (ord === "ORDEM_DIGITADA" && params.pedidosIds && params.pedidosIds.length > 0) {
    const posMap = new Map(params.pedidosIds.map((id, idx) => [id, idx]));
    pedidosAlvo = [...pedidosAlvo].sort(
      (a, b) => (posMap.get(a.id) ?? 999999) - (posMap.get(b.id) ?? 999999)
    );
  } else {
    pedidosAlvo = [...pedidosAlvo].sort((a, b) => {
      if (ord === "ORIGEM_ASC") return a.origem.localeCompare(b.origem);
      if (ord === "DATA_PEDIDO_DESC") return b.dataPedidoIso.localeCompare(a.dataPedidoIso);
      return a.numeroPedido.localeCompare(b.numeroPedido, undefined, { numeric: true });
    });
  }

  const todasAnotacoes = await listarAnotacoesCartorioVirtual(params.tenantId);

  const pdfGerado = await gerarPdfLotePedidosSiplan({
    pedidos: pedidosAlvo.map((pedido) => ({
      pedido,
      anotacoesSalvas: todasAnotacoes.filter((a) => a.pedidoId === pedido.id),
    })),
    duplexFrenteNovaFolha: params.duplexFrenteNovaFolha,
    modoDados: params.modoDadosImpressao,
    marcaReimpressao: params.loteOrigemReimpressaoId ? "2ª VIA / REIMPRESSÃO AUDITADA" : null,
  });

  const codigoLote = `LOTE-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const agoraBr = formatarDataHoraBr();

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const novoLote = {
      id: `lote-${randomUUID()}`,
      tenantId: params.tenantId,
      codigoLote,
      modoSelecao: params.modoSelecao,
      modoDadosImpressao: params.modoDadosImpressao,
      duplexFrenteNovaFolha: params.duplexFrenteNovaFolha,
      criterioOrdenacao: ord,
      pedidosIds: pedidosAlvo.map((p) => p.id),
      numerosPedidos: pedidosAlvo.map((p) => p.numeroPedido),
      totalPedidos: pedidosAlvo.length,
      totalPaginas: pdfGerado.totalPaginas,
      paginasBrancoDuplex: pdfGerado.paginasBrancoDuplex,
      arquivoHashSha256: pdfGerado.sha256,
      statusLote: "GERADO",
      loteOrigemReimpressaoId: params.loteOrigemReimpressaoId ?? null,
      motivoReimpressao: params.motivoReimpressao?.trim() ?? null,
      criadoPorNome: params.operadorNome,
      criadoEmBr: agoraBr,
      snapshotPedidos: JSON.parse(JSON.stringify(pedidosAlvo)),
      eventos: [
        {
          id: `ev-${randomUUID()}`,
          evento: params.loteOrigemReimpressaoId ? "REIMPRESSAO" : "GERACAO_PDF",
          observacao: params.motivoReimpressao?.trim() || "Lote PDF gerado com sucesso.",
          operadorNome: params.operadorNome,
          criadoEmBr: agoraBr,
        },
      ],
    };

    store.lotes.unshift(novoLote);

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      loteId: novoLote.id,
      atorTipo: "HUMANO",
      atorId: params.operadorId,
      atorNome: params.operadorNome,
      papelRegistral: params.papelRegistral,
      evento: params.loteOrigemReimpressaoId ? "LOTE_REIMPRESSO" : "LOTE_IMPRESSAO_GERADO",
      resumo: `Lote ${codigoLote} gerado (${novoLote.totalPedidos} pedido(s), ${novoLote.totalPaginas} pág., ${novoLote.paginasBrancoDuplex} pág. branco duplex).`,
    });

    const { snapshotPedidos: _snap, ...resumo } = novoLote;
    return resumo;
  }

  const loteCriado = await prisma.fiorixCvLoteImpressao.create({
    data: {
      tenantId: params.tenantId,
      codigoLote,
      modoSelecao: params.modoSelecao,
      modoDadosImpressao: params.modoDadosImpressao,
      duplexFrenteNovaFolha: params.duplexFrenteNovaFolha,
      criterioOrdenacao: ord,
      filtrosAplicadosJson: (params.filtros || {}) as any,
      pedidosIdsJson: pedidosAlvo.map((p) => p.id) as any,
      snapshotPedidosJson: JSON.parse(JSON.stringify(pedidosAlvo)) as any,
      totalPedidos: pedidosAlvo.length,
      totalPaginas: pdfGerado.totalPaginas,
      paginasBrancoDuplex: pdfGerado.paginasBrancoDuplex,
      arquivoHashSha256: pdfGerado.sha256,
      statusLote: "GERADO",
      loteOrigemReimpressaoId: params.loteOrigemReimpressaoId ?? null,
      motivoReimpressao: params.motivoReimpressao?.trim() ?? null,
      criadoPorId: params.operadorId,
      criadoPorNome: params.operadorNome,
      eventos: {
        create: {
          evento: params.loteOrigemReimpressaoId ? "REIMPRESSAO" : "GERACAO_PDF",
          observacao: params.motivoReimpressao?.trim() || "Lote PDF gerado com sucesso.",
          operadorId: params.operadorId,
          operadorNome: params.operadorNome,
        },
      },
    },
    include: { eventos: { orderBy: { createdAt: "desc" } } },
  });

  await registrarEventoHistoricoCartorioVirtual({
    tenantId: params.tenantId,
    loteId: loteCriado.id,
    atorTipo: "HUMANO",
    atorId: params.operadorId,
    atorNome: params.operadorNome,
    papelRegistral: params.papelRegistral,
    evento: params.loteOrigemReimpressaoId ? "LOTE_REIMPRESSO" : "LOTE_IMPRESSAO_GERADO",
    resumo: `Lote ${codigoLote} gerado (${loteCriado.totalPedidos} pedido(s), ${loteCriado.totalPaginas} pág., ${loteCriado.paginasBrancoDuplex} pág. branco duplex).`,
  });

  return {
    id: loteCriado.id,
    tenantId: loteCriado.tenantId,
    codigoLote: loteCriado.codigoLote,
    modoSelecao: loteCriado.modoSelecao as any,
    modoDadosImpressao: loteCriado.modoDadosImpressao as any,
    duplexFrenteNovaFolha: loteCriado.duplexFrenteNovaFolha,
    criterioOrdenacao: loteCriado.criterioOrdenacao,
    pedidosIds: (loteCriado.pedidosIdsJson as string[]) || [],
    numerosPedidos: pedidosAlvo.map((p) => p.numeroPedido),
    totalPedidos: loteCriado.totalPedidos,
    totalPaginas: loteCriado.totalPaginas,
    paginasBrancoDuplex: loteCriado.paginasBrancoDuplex,
    arquivoHashSha256: loteCriado.arquivoHashSha256,
    statusLote: loteCriado.statusLote,
    loteOrigemReimpressaoId: loteCriado.loteOrigemReimpressaoId,
    motivoReimpressao: loteCriado.motivoReimpressao,
    criadoPorNome: loteCriado.criadoPorNome,
    criadoEmBr: formatarDataHoraBr(loteCriado.createdAt),
    eventos: loteCriado.eventos.map((ev) => ({
      id: ev.id,
      evento: ev.evento,
      observacao: ev.observacao,
      operadorNome: ev.operadorNome,
      criadoEmBr: formatarDataHoraBr(ev.createdAt),
    })),
  };
}

export async function obterPdfBytesLoteImpressao(params: {
  tenantId: string;
  loteId: string;
  operadorId: string;
  operadorNome: string;
}): Promise<{ codigoLote: string; pdfBytes: Uint8Array; sha256: string }> {
  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const lote = store.lotes.find(
      (l) => l.id === params.loteId && l.tenantId === params.tenantId
    );
    if (!lote) {
      throw new Error("Lote de impressão não pertence a esta serventia.");
    }

    const pedidosParaRenderizar =
      lote.modoDadosImpressao === "ORIGINAL_CONGELADO"
        ? lote.snapshotPedidos
        : store.pedidos.filter((p) => lote.pedidosIds.includes(p.id));

    const resultado = await gerarPdfLotePedidosSiplan({
      pedidos: pedidosParaRenderizar.map((pedido) => ({
        pedido,
        anotacoesSalvas: store.anotacoes.filter(
          (a) => a.tenantId === params.tenantId && !a.parentId && a.pedidoId === pedido.id
        ),
      })),
      duplexFrenteNovaFolha: lote.duplexFrenteNovaFolha,
      modoDados: lote.modoDadosImpressao,
      marcaReimpressao: lote.loteOrigemReimpressaoId ? "2ª VIA / REIMPRESSÃO AUDITADA" : null,
    });

    lote.eventos.unshift({
      id: `ev-${randomUUID()}`,
      evento: "DOWNLOAD_PDF",
      observacao: "Pré-visualização / download do arquivo PDF do lote.",
      operadorNome: params.operadorNome,
      criadoEmBr: formatarDataHoraBr(),
    });

    return {
      codigoLote: lote.codigoLote,
      pdfBytes: resultado.pdfBytes,
      sha256: resultado.sha256,
    };
  }

  const loteDb = await prisma.fiorixCvLoteImpressao.findFirst({
    where: { id: params.loteId, tenantId: params.tenantId },
  });
  if (!loteDb) {
    throw new Error("Lote de impressão não pertence a esta serventia.");
  }

  const pedidosIds = (loteDb.pedidosIdsJson as string[]) || [];
  let pedidosParaRenderizar: PedidoCertidaoDetalheDTO[] = [];

  if (loteDb.modoDadosImpressao === "ORIGINAL_CONGELADO") {
    pedidosParaRenderizar =
      (loteDb.snapshotPedidosJson as unknown as PedidoCertidaoDetalheDTO[]) || [];
  } else {
    const { pedidos } = await listarPedidosCartorioVirtual(params.tenantId);
    const idSet = new Set(pedidosIds);
    pedidosParaRenderizar = pedidos.filter((p) => idSet.has(p.id));
  }

  const todasAnotacoes = await listarAnotacoesCartorioVirtual(params.tenantId);

  const resultado = await gerarPdfLotePedidosSiplan({
    pedidos: pedidosParaRenderizar.map((pedido) => ({
      pedido,
      anotacoesSalvas: todasAnotacoes.filter((a) => a.pedidoId === pedido.id),
    })),
    duplexFrenteNovaFolha: loteDb.duplexFrenteNovaFolha,
    modoDados: loteDb.modoDadosImpressao as any,
    marcaReimpressao: loteDb.loteOrigemReimpressaoId ? "2ª VIA / REIMPRESSÃO AUDITADA" : null,
  });

  await prisma.fiorixCvLoteImpressaoEvento.create({
    data: {
      loteId: loteDb.id,
      evento: "DOWNLOAD_PDF",
      observacao: "Pré-visualização / download do arquivo PDF do lote.",
      operadorId: params.operadorId,
      operadorNome: params.operadorNome,
    },
  });

  return {
    codigoLote: loteDb.codigoLote,
    pdfBytes: resultado.pdfBytes,
    sha256: resultado.sha256,
  };
}

export async function listarHistoricoCartorioVirtual(
  tenantId: string,
  busca?: string
): Promise<HistoricoOperacaoDTO[]> {
  let lista: HistoricoOperacaoDTO[] = [];

  if (isAmbienteSinteticoPermitido()) {
    lista = obterSandboxTenant(tenantId).historico.filter((h) => h.tenantId === tenantId);
  } else {
    try {
      const rows = await prisma.fiorixCvHistoricoOperacao.findMany({
        where: { tenantId },
        include: { pedido: { select: { numeroPedido: true } } },
        orderBy: { createdAt: "desc" },
        take: 250,
      });
      lista = rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        pedidoId: r.pedidoId,
        numeroPedido: r.pedido?.numeroPedido ?? null,
        loteId: r.loteId,
        atorTipo: r.atorTipo as any,
        atorNome: r.atorNome,
        papelRegistral: r.papelRegistral,
        evento: r.evento,
        estadoAnterior: r.estadoAnterior,
        estadoNovo: r.estadoNovo,
        resumo: r.resumo,
        hashIntegridade: r.hashIntegridade,
        criadoEmIso: r.createdAt.toISOString(),
        criadoEmBr: formatarDataHoraBr(r.createdAt),
      }));
    } catch (err) {
      if (isErroTabelaAusente(err)) return [];
      throw err;
    }
  }

  if (busca && busca.trim()) {
    const q = busca.trim().toLowerCase();
    return lista.filter(
      (h) =>
        h.evento.toLowerCase().includes(q) ||
        h.resumo.toLowerCase().includes(q) ||
        h.atorNome.toLowerCase().includes(q) ||
        (h.numeroPedido || "").toLowerCase().includes(q)
    );
  }

  return lista;
}

export async function registrarEventoHistoricoCartorioVirtual(params: {
  tenantId: string;
  pedidoId?: string | null;
  loteId?: string | null;
  atorTipo: "HUMANO" | "AGENTE_VIRTUAL" | "SISTEMA" | "CONNECTOR";
  atorId: string;
  atorNome: string;
  papelRegistral?: string | null;
  evento: string;
  estadoAnterior?: string | null;
  estadoNovo?: string | null;
  resumo: string;
}): Promise<void> {
  const agora = new Date();
  const hashIntegridade = gerarHashHistorico({
    tenantId: params.tenantId,
    pedidoId: params.pedidoId ?? null,
    loteId: params.loteId ?? null,
    atorId: params.atorId,
    evento: params.evento,
    resumo: params.resumo,
    ts: agora.toISOString(),
  });

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const ped = params.pedidoId
      ? store.pedidos.find((p) => p.id === params.pedidoId && p.tenantId === params.tenantId)
      : null;
    store.historico.unshift({
      id: `hist-${randomUUID()}`,
      tenantId: params.tenantId,
      pedidoId: params.pedidoId ?? null,
      numeroPedido: ped?.numeroPedido ?? null,
      loteId: params.loteId ?? null,
      atorTipo: params.atorTipo,
      atorNome: params.atorNome,
      papelRegistral: params.papelRegistral ?? null,
      evento: params.evento,
      estadoAnterior: params.estadoAnterior ?? null,
      estadoNovo: params.estadoNovo ?? null,
      resumo: params.resumo,
      hashIntegridade,
      criadoEmIso: agora.toISOString(),
      criadoEmBr: formatarDataHoraBr(agora),
    });
    persistirSandboxLocalEmDisco();
    return;
  }

  try {
    await prisma.fiorixCvHistoricoOperacao.create({
      data: {
        tenantId: params.tenantId,
        pedidoId: params.pedidoId ?? null,
        loteId: params.loteId ?? null,
        atorTipo: params.atorTipo,
        atorId: params.atorId,
        atorNome: params.atorNome,
        papelRegistral: params.papelRegistral ?? null,
        evento: params.evento,
        estadoAnterior: params.estadoAnterior ?? null,
        estadoNovo: params.estadoNovo ?? null,
        resumo: params.resumo,
        hashIntegridade,
      },
    });
  } catch (err) {
    if (!isErroTabelaAusente(err)) throw err;
  }
}

export async function listarRegrasGovernancaCartorioVirtual(tenantId: string) {
  if (isAmbienteSinteticoPermitido()) {
    return obterSandboxTenant(tenantId).regras;
  }
  try {
    const rows = await prisma.fiorixCvRegraVersao.findMany({
      where: { tenantId },
      orderBy: [{ codigoRegra: "asc" }, { versao: "desc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      codigoRegra: r.codigoRegra,
      versao: r.versao,
      titulo: r.titulo,
      especieAlvo: r.especieAlvo,
      ativa: r.ativa,
      validadaJuridicamente: r.validadaJurid,
      textoModelo: r.textoModelo || "",
      aprovadoPorNome: r.aprovadoPorNome,
      criadoEmBr: formatarDataHoraBr(r.createdAt),
    }));
  } catch (err) {
    if (isErroTabelaAusente(err)) return [];
    throw err;
  }
}

/**
 * Marca o Pedido como CONFERIDO, DEVOLVIDO ou estorna de volta para NÃO CONFERIDO,
 * mantendo auditoria completa.
 */
export async function definirConferenciaEscreventePedido(params: {
  tenantId: string;
  pedidoId: string;
  conferido?: boolean;
  status?: "CONFERIDO" | "NAO_CONFERIDO" | "DEVOLVIDO";
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<PedidoCertidaoDetalheDTO> {
  const agoraBr = formatarDataHoraBr();
  const statusAlvo: "CONFERIDO" | "NAO_CONFERIDO" | "DEVOLVIDO" =
    params.status ?? (params.conferido ? "CONFERIDO" : "NAO_CONFERIDO");

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const pedido = store.pedidos.find(
      (p) =>
        p.tenantId === params.tenantId &&
        (p.id === params.pedidoId || p.numeroPedido === params.pedidoId)
    );
    if (!pedido) {
      throw new Error("Pedido não localizado nesta serventia.");
    }

    pedido.conferidoPeloEscrevente = statusAlvo === "CONFERIDO";
    pedido.conferidoPorNome = statusAlvo === "CONFERIDO" ? params.operadorNome : null;
    pedido.conferidoEmBr = statusAlvo === "CONFERIDO" ? agoraBr : null;

    pedido.devolvidoPeloEscrevente = statusAlvo === "DEVOLVIDO";
    pedido.devolvidoPorNome = statusAlvo === "DEVOLVIDO" ? params.operadorNome : null;
    pedido.devolvidoEmBr = statusAlvo === "DEVOLVIDO" ? agoraBr : null;

    persistirSandboxLocalEmDisco();

    await registrarEventoHistoricoCartorioVirtual({
      tenantId: params.tenantId,
      pedidoId: pedido.id,
      atorTipo: "HUMANO",
      atorId: params.operadorId,
      atorNome: params.operadorNome,
      papelRegistral: params.papelRegistral,
      evento:
        statusAlvo === "CONFERIDO"
          ? "PEDIDO_CONFERIDO_ESCREVENTE"
          : statusAlvo === "DEVOLVIDO"
          ? "PEDIDO_DEVOLVIDO_ESCREVENTE"
          : "PEDIDO_CONFERENCIA_ESTORNADA",
      resumo:
        statusAlvo === "CONFERIDO"
          ? `Pedido nº ${pedido.numeroPedido} marcado como CONFERIDO pelo Escrevente ${params.operadorNome}.`
          : statusAlvo === "DEVOLVIDO"
          ? `Pedido nº ${pedido.numeroPedido} marcado como DEVOLVIDO pelo Escrevente ${params.operadorNome}.`
          : `Status do Pedido nº ${pedido.numeroPedido} estornado para NÃO CONFERIDO por ${params.operadorNome}.`,
    });

    return pedido;
  }

  const row = await prisma.fiorixCvPedido.findFirst({
    where: {
      tenantId: params.tenantId,
      OR: [{ id: params.pedidoId }, { numeroPedido: params.pedidoId }],
    },
  });
  if (!row) {
    throw new Error("Pedido não localizado nesta serventia.");
  }

  const valoresAtuais = ((row.valoresJson as Record<string, unknown>) || {}) as Record<
    string,
    unknown
  >;
  await prisma.fiorixCvPedido.update({
    where: { id: row.id },
    data: {
      valoresJson: {
        ...valoresAtuais,
        _conferenciaEscrevente:
          statusAlvo === "CONFERIDO"
            ? {
                conferido: true,
                operadorId: params.operadorId,
                operadorNome: params.operadorNome,
                conferidoEmBr: agoraBr,
                devolvido: false,
                devolvidoPorNome: null,
                devolvidoEmBr: null,
              }
            : statusAlvo === "DEVOLVIDO"
            ? {
                conferido: false,
                operadorId: params.operadorId,
                operadorNome: null,
                conferidoEmBr: null,
                devolvido: true,
                devolvidoPorNome: params.operadorNome,
                devolvidoEmBr: agoraBr,
              }
            : {
                conferido: false,
                operadorId: null,
                operadorNome: null,
                conferidoEmBr: null,
                devolvido: false,
                devolvidoPorNome: null,
                devolvidoEmBr: null,
              },
      } as any,
    },
  });

  await registrarEventoHistoricoCartorioVirtual({
    tenantId: params.tenantId,
    pedidoId: row.id,
    atorTipo: "HUMANO",
    atorId: params.operadorId,
    atorNome: params.operadorNome,
    papelRegistral: params.papelRegistral,
    evento:
      statusAlvo === "CONFERIDO"
        ? "PEDIDO_CONFERIDO_ESCREVENTE"
        : statusAlvo === "DEVOLVIDO"
        ? "PEDIDO_DEVOLVIDO_ESCREVENTE"
        : "PEDIDO_CONFERENCIA_ESTORNADA",
    resumo:
      statusAlvo === "CONFERIDO"
        ? `Pedido nº ${row.numeroPedido} marcado como CONFERIDO por ${params.operadorNome}.`
        : statusAlvo === "DEVOLVIDO"
        ? `Pedido nº ${row.numeroPedido} marcado como DEVOLVIDO por ${params.operadorNome}.`
        : `Status do Pedido nº ${row.numeroPedido} estornado para NÃO CONFERIDO por ${params.operadorNome}.`,
  });

  const atualizado = await obterDetalhePedidoCartorioVirtual(params.tenantId, row.id);
  if (!atualizado.pedido) {
    throw new Error("Falha ao recarregar Pedido após atualizar conferência.");
  }
  return atualizado.pedido;
}

/**
 * Persiste os grifos coloridos e textos posicionados pelo Escrevente sobre as páginas do Pedido,
 * garantindo que saiam impressos fielmente na impressão individual e em lote.
 */
export async function salvarMarcacoesDocumentoPedido(params: {
  tenantId: string;
  pedidoId: string;
  marcacoes: MarcacaoVisualDocumentoPedido[];
  operadorId: string;
  operadorNome: string;
  papelRegistral: string;
}): Promise<PedidoCertidaoDetalheDTO> {
  const marcacoesSeguras: MarcacaoVisualDocumentoPedido[] = (params.marcacoes || [])
    .slice(0, 200)
    .map((m) => ({
      id: String(m.id || `mk-${randomUUID()}`),
      pagina: Math.max(1, Math.min(20, Math.round(Number(m.pagina) || 1))),
      tipo: m.tipo === "TEXTO" ? "TEXTO" : "GRIFO",
      xPt: Math.max(4, Math.min(585, Number(m.xPt) || 34)),
      yTopoPt: Math.max(4, Math.min(834, Number(m.yTopoPt) || 60)),
      larguraPt: Math.max(12, Math.min(580, Number(m.larguraPt) || 120)),
      alturaPt: Math.max(8, Math.min(400, Number(m.alturaPt) || 16)),
      corGrifo: m.corGrifo,
      texto: typeof m.texto === "string" ? m.texto.slice(0, 1000) : undefined,
      corTexto: m.corTexto,
      tamanhoFontePt: m.tamanhoFontePt ? Math.max(7.5, Math.min(14, Number(m.tamanhoFontePt))) : undefined,
      trechoSelecionado: m.trechoSelecionado ? String(m.trechoSelecionado).slice(0, 300) : null,
      autorNome: m.autorNome || params.operadorNome,
      criadoEmBr: m.criadoEmBr || formatarDataHoraBr(),
    }));

  if (isAmbienteSinteticoPermitido()) {
    const store = obterSandboxTenant(params.tenantId);
    const pedido = store.pedidos.find(
      (p) =>
        p.tenantId === params.tenantId &&
        (p.id === params.pedidoId || p.numeroPedido === params.pedidoId)
    );
    if (!pedido) {
      throw new Error("Pedido não localizado nesta serventia.");
    }

    pedido.marcacoesDocumento = marcacoesSeguras;
    persistirSandboxLocalEmDisco();
    return pedido;
  }

  const row = await prisma.fiorixCvPedido.findFirst({
    where: {
      tenantId: params.tenantId,
      OR: [{ id: params.pedidoId }, { numeroPedido: params.pedidoId }],
    },
  });
  if (!row) {
    throw new Error("Pedido não localizado nesta serventia.");
  }

  const valoresAtuais = ((row.valoresJson as Record<string, unknown>) || {}) as Record<
    string,
    unknown
  >;
  await prisma.fiorixCvPedido.update({
    where: { id: row.id },
    data: {
      valoresJson: {
        ...valoresAtuais,
        _marcacoesDocumento: marcacoesSeguras,
      } as any,
    },
  });

  const atualizado = await obterDetalhePedidoCartorioVirtual(params.tenantId, row.id);
  if (!atualizado.pedido) {
    throw new Error("Falha ao recarregar Pedido após salvar marcações visuais.");
  }
  return atualizado.pedido;
}
