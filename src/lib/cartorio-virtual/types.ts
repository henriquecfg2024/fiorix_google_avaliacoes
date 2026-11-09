/**
 * Módulo Cartório Virtual — Tipos Canônicos, Máquina de Estados, Papéis Registrais e Agentes Virtuais
 * Preparado para multi-serventia (7º RI de São Paulo e futura expansão isolada para 5º RI).
 */

export type OrigemPedidoCertidao = "ONR" | "BALCAO";

export type CriterioSolicitacaoCertidao =
  | "MATRICULA"
  | "ENDERECO"
  | "TRANSCRICAO"
  | "LOTEAMENTO"
  | "CPF_CNPJ"
  | "NAO_IDENTIFICADO";

/**
 * Os 13 estados operacionais aprovados (Seção 9 da especificação).
 */
export type EstadoOperacionalPedido =
  | "RECEBIDO"
  | "EM_IDENTIFICACAO"
  | "AGUARDANDO_CONTRADITORIO"
  | "AGUARDANDO_ATUALIZACAO_MATRICULA"
  | "EM_CONFERENCIA"
  | "EM_REVISAO_HUMANA"
  | "APTO_EMISSAO"
  | "EM_IMPRESSAO"
  | "EMITIDO"
  | "AGUARDANDO_ASSINATURA"
  | "ASSINADO"
  | "ENTREGUE"
  | "COM_FALHA_OU_PENDENCIA";

export const ESTADOS_OPERACIONAIS_LABELS: Record<EstadoOperacionalPedido, string> = {
  RECEBIDO: "Recebido p/ Triagem",
  EM_IDENTIFICACAO: "Em identificação",
  AGUARDANDO_CONTRADITORIO: "Aguardando conferência do Contraditório",
  AGUARDANDO_ATUALIZACAO_MATRICULA: "Aguardando atualização da matrícula",
  EM_CONFERENCIA: "Em conferência / Anotação",
  EM_REVISAO_HUMANA: "Aguardando revisão do Escrevente",
  APTO_EMISSAO: "Conferido • Pronto p/ Impressão do Pedido",
  EM_IMPRESSAO: "Em fila de impressão do Pedido",
  EMITIDO: "Processado no WEBRI (Externo)",
  AGUARDANDO_ASSINATURA: "Em assinatura externa (WEBRI)",
  ASSINADO: "Assinado no WEBRI (Externo)",
  ENTREGUE: "Concluído na origem (eREG / Balcão)",
  COM_FALHA_OU_PENDENCIA: "Com falha ou pendência",
};

/**
 * Papéis funcionais registrais na serventia (Seção 14 — distintos de ADMIN técnico de TI).
 */
export type PapelRegistral =
  | "OFICIAL"
  | "OFICIAL_SUBSTITUTO"
  | "ESCREVENTE_AUTORIZADO"
  | "CONFERENTE"
  | "AUXILIAR"
  | "SEM_ATRIBUICAO_REGISTRAL";

export const PAPEIS_REGISTRAIS_LABELS: Record<PapelRegistral, string> = {
  OFICIAL: "Oficial de Registro",
  OFICIAL_SUBSTITUTO: "Oficial Substituto",
  ESCREVENTE_AUTORIZADO: "Escrevente Autorizado",
  CONFERENTE: "Conferente Registral",
  AUXILIAR: "Auxiliar de Cartório",
  SEM_ATRIBUICAO_REGISTRAL: "Sem Atribuição Registral (Acesso Técnico/Consulta)",
};

export type CapacidadeCartorioVirtual =
  | "consultar"
  | "conferir"
  | "anotar"
  | "solicitar_atualizacao"
  | "aprovar_revisao"
  | "imprimir"
  | "solicitar_assinatura"
  | "configurar_regras"
  | "auditar_historico";

/**
 * Agentes Virtuais Especializados (Seção 11) — atuam exclusivamente em tarefas técnicas determinísticas,
 * sem fé pública, delegação ou competência jurídica.
 */
export type AgenteVirtualId =
  | "AGENTE_TRIAGEM"
  | "AGENTE_CONTRADITORIO"
  | "AGENTE_ACERVO"
  | "AGENTE_IMPRESSAO"
  | "AGENTE_COMPARACAO";

export interface DefinicaoAgenteVirtual {
  id: AgenteVirtualId;
  nome: string;
  responsabilidadeTecnica: string;
  vedacaoJuridica: string;
  ativoNoPiloto: boolean;
}

export const CATALOGO_AGENTES_VIRTUAIS: DefinicaoAgenteVirtual[] = [
  {
    id: "AGENTE_TRIAGEM",
    nome: "Agente de Triagem e Identificação",
    responsabilidadeTecnica:
      "Classifica origem (ONR/Balcão), valida número de matrícula, detecta sentinelas SQL e encaminha pedidos por endereço, transcrição ou loteamento à análise humana assistida.",
    vedacaoJuridica:
      "Não presume inteiro teor sem confirmação cadastral e não resolve ambiguidades por suposição.",
    ativoNoPiloto: true,
  },
  {
    id: "AGENTE_CONTRADITORIO",
    nome: "Agente de Consulta ao Contraditório",
    responsabilidadeTecnica:
      "Relaciona prenotações ativas da matrícula, aplica modelo textual aprovado quando em tramitação regular e pausa o pedido quando há ato registral em processamento.",
    vedacaoJuridica:
      "Não dispensa prenotação bloqueante nem decide qualificação registral.",
    ativoNoPiloto: true,
  },
  {
    id: "AGENTE_ACERVO",
    nome: "Agente de Integridade do Acervo e Matrícula",
    responsabilidadeTecnica:
      "Verifica presença de imagem/PDF no Livro 2 via Connector somente leitura e abre pendência de atualização ou digitalização quando incompleto.",
    vedacaoJuridica:
      "Não edita livros, imagens ou banco SQL da serventia.",
    ativoNoPiloto: true,
  },
  {
    id: "AGENTE_IMPRESSAO",
    nome: "Agente de Preparação de Impressão SIPLAN",
    responsabilidadeTecnica:
      "Monta espelho fiel 595x842 pt com código de barras Code 39, paginação multi-item sem redução de fonte e alinhamento frente-folha em duplex.",
    vedacaoJuridica:
      "Não emite certidão final nem aciona assinatura automática no piloto.",
    ativoNoPiloto: true,
  },
  {
    id: "AGENTE_COMPARACAO",
    nome: "Agente de Modo de Comparação (Shadow Piloto)",
    responsabilidadeTecnica:
      "Compara o encaminhamento técnico proposto pelo FIORIX com o procedimento efetivamente realizado pela equipe no WEBRI/eREG.",
    vedacaoJuridica:
      "Atua apenas em observabilidade e aferição de acurácia para homologação do Oficial.",
    ativoNoPiloto: true,
  },
];

export interface ParticipantePedido {
  nome: string;
  tipoDocumento: "CPF" | "CNPJ" | "OUTRO" | "NAO_INFORMADO";
  documentoMascarado: string | null;
  documentoFormatado?: string | null;
  email?: string | null;
  telefone?: string | null;
  enderecoResumo?: string | null;
}

export interface ValoresFinanceirosPedido {
  valorServico: number;
  valorDespesa: number;
  totalDeposito: number;
  moeda: "BRL";
}

/**
 * Prenotação em Contraditório vinculada ao Pedido / Matrícula.
 * Origem SQL no SIPLAN WEBRI:
 *  - dbo.tblWRIRecepcao (PK_FlagRecepcao, PK_Recepcao, NumPrenotacao, ProtocoloEntidade, DtRecep, DtPrenotacao, TipoPrenotacao)
 *  - dbo.tblWRITitulos (FK_tblWRIRecepcaoRecepcao, PK_SeqTitulo, FK_tblWRINatureza_Id, DataDoTituloApresentado, DtPrevisaoEntrega)
 *  - dbo.tblWRICertidaoResultadoContraditorio (vínculo de resultado do contraditório com o Pedido de Certidão)
 *  - dbo.tblWRITipoPrenotacao (PK_ID, TipoPrenotacao — ex: "INTIMACAO ONLINE", "RECEPCAO BALCAO")
 *  - dbo.tblWRITitulosReal / dbo.tblWRIReal / dbo.tblWRIImovelBase / dbo.tblWRIImovel (Livro / Matrícula vinculada — ex: MAT 77801)
 */
export interface PrenotacaoContraditorio {
  numeroPrenotacao: string;
  pkRecepcao?: number | null;
  pkFlagRecepcao?: number | null;
  pkSeqTitulo?: number | null;
  tipoPrenotacaoCodigo?: number | null;
  tipoPrenotacaoDescricao?: string | null;
  protocoloMagnetico?: string | null;
  numeroMatricula?: number | null;
  livroContraditorio?: string | null;
  orgaoServentia?: string | null;
  statusContraditorioIndicador?: string | null;
  outorgante?: string | null;
  outorgado?: string | null;
  dataApresentacaoIso: string;
  dataApresentacaoBr: string;
  dataPrevisaoBr?: string | null;
  naturezaTitulo: string;
  emProcessamentoAtoNaMatricula: boolean;
  etapaAtual: string;
  observacao?: string | null;
  origemSqlTabelas?: string | null;
}

export interface SnapshotAcervoMatricula {
  numeroMatricula: number;
  vinculadaServentia: boolean;
  possuiRegistroEstruturado: boolean;
  possuiArquivoDigitalizado: boolean;
  formatoArquivo?: "PDF" | "TIF" | "KEN" | "AUSENTE";
  ultimaAtualizacaoAtosIso?: string | null;
  ultimaDigitalizacaoIso?: string | null;
  integraEAtualizada: boolean;
  pendenciaDetectada?: string | null;
}

export interface ItemPedidoCertidaoDTO {
  id: string;
  sequenciaItem: number;
  naturezaCodigo: number | null;
  naturezaDescricao: string;
  naturezaOriginalWebri?: string | null;
  livroCodigo: number | null;
  livroDescricao: string | null;
  numeroMatricula: number | null;
  transcricaoOuLoteamento: string | null;
  enderecoPesquisa: string | null;
  meioEntregaCodigo: string | null;
  meioEntregaDescricao: string | null;
  dataPrevisaoIso: string | null;
  dataPrevisaoBr: string | null;
  elegivelPiloto: boolean;
  motivoEncaminhamentoHumano: string | null;
  statusItem: string;
  acervoSnapshot: SnapshotAcervoMatricula | null;
  resultadoPesquisaSistema?: number | null;
  qtdeImpressao?: number;
  dataImpressaoBr?: string | null;
  dataEmissaoBr?: string | null;
  assinaOnr?: boolean;
  atendenteItemNome?: string | null;
}

export interface MetadadosWebriPedido {
  numRps?: number | null;
  gerarNfe?: boolean;
  codigoAcesso?: string | null;
  divisorId?: number | null;
  divisorDescricao?: string | null;
  usuarioIdPedido?: number | null;
  atendenteNome?: string | null;
  observacaoPedidoOriginal?: string | null;
  descricaoDosItensOriginal?: string | null;
  naturezaOriginalWebri?: string | null;
  resultadoPesquisaSistema?: number | null;
  jaImpressa?: boolean;
  assinaOnr?: boolean;
  dataCertidaoBr?: string | null;
}

export interface ConferenciaPedidoDTO {
  id: string;
  versaoRegraAplicada: string;
  versaoDadosFonteHash: string;
  identificacaoStatus:
    | "CONFIRMADA"
    | "INEXISTENTE"
    | "AMBIGUA"
    | "INCOMPLETA"
    | "ENCAMINHADA_HUMANO";
  vinculoServentia: boolean;
  contraditorioStatus:
    | "NADA_CONSTA"
    | "PRENOTACAO_EM_TRAMITACAO"
    | "ATO_EM_PROCESSAMENTO"
    | "INDISPONIVEL"
    | "INCONCLUSIVO";
  prenotacoesEncontradas: PrenotacaoContraditorio[];
  textoCertidaoSugerido: string | null;
  atualidadeMatriculaStatus:
    | "INTEGRA_ATUALIZADA"
    | "PENDENTE_ATUALIZACAO"
    | "PENDENTE_DIGITALIZACAO"
    | "VERIFICACAO_MANUAL";
  decisaoProposta:
    | "APTO_EMISSAO"
    | "APTO_COM_CERTIFICACAO_PRENOTACAO"
    | "PAUSAR_POR_ATO_EM_PROCESSAMENTO"
    | "AGUARDAR_ATUALIZACAO_MATRICULA"
    | "ENCAMINHAR_REVISAO_HUMANA";
  invalidadaPorMudanca: boolean;
  executadoPorTipo: "AGENTE_CONFERENCIA" | "HUMANO";
  executadoPorNome: string;
  criadoEmBr: string;
}

export type CorGrifoDocumento =
  | "AMARELO"
  | "VERDE"
  | "AZUL"
  | "ROSA"
  | "LARANJA"
  | "LILAS";

export type CorTextoDocumento =
  | "PRETO"
  | "AZUL_ESCURO"
  | "VERMELHO"
  | "VERDE_ESCURO"
  | "ROXO";

export type FiltroConferenciaEscrevente =
  | "TODOS"
  | "CONFERIDO"
  | "NAO_CONFERIDO"
  | "DEVOLVIDO";

export type StatusConferenciaPedido = "CONFERIDO" | "NAO_CONFERIDO" | "DEVOLVIDO";

export interface MarcacaoVisualDocumentoPedido {
  id: string;
  /** Página 1-indexada do espelho do Pedido (1 = Pedido, 2 = Ficha Operacional / Continuação) */
  pagina: number;
  tipo: "GRIFO" | "TEXTO";
  /** Coordenadas na geometria canônica SIPLAN 595 x 842 pt (origem no canto superior esquerdo) */
  xPt: number;
  yTopoPt: number;
  larguraPt: number;
  alturaPt: number;
  corGrifo?: CorGrifoDocumento;
  texto?: string;
  corTexto?: CorTextoDocumento;
  tamanhoFontePt?: number;
  trechoSelecionado?: string | null;
  autorNome: string;
  criadoEmBr: string;
}

export interface PedidoCertidaoDetalheDTO {
  id: string;
  tenantId: string;
  numeroPedido: string;
  protocoloExterno: string | null;
  origem: OrigemPedidoCertidao;
  canalRecebimento: string;
  especieSolicitada: string;
  subtipoConfirmado: string | null;
  criterioSolicitacao: CriterioSolicitacaoCertidao;
  estadoOperacional: EstadoOperacionalPedido;
  estadoOperacionalLabel: string;
  prioridade: "NORMAL" | "URGENTE" | "CRITICA";
  dataPedidoIso: string;
  dataPedidoBr: string;
  horaPedidoBr: string;
  prazoPrevistoIso: string | null;
  prazoPrevistoBr: string | null;
  formaEntregaExibicao: string;
  escreventeRecepcao: string;
  versaoDadosFonteHash: string;
  dadosInvalidadosMudanca: boolean;
  pausadoPorAtoProcessamento: boolean;
  prenotacaoVinculada: string | null;
  requerente: ParticipantePedido;
  apresentante: ParticipantePedido | null;
  destinatarioNota: ParticipantePedido | null;
  valores: ValoresFinanceirosPedido;
  observacoesOrigem: string | null;
  motivacaoObrigatoriaPorRegra: boolean;
  pdfOriginalWebriDisponivel: boolean;
  resultadoPropostoFiorix: string | null;
  procedimentoRealEquipe: string | null;
  statusComparacao: "CONVERGENTE" | "DIVERGENTE" | "AGUARDANDO_EQUIPE";
  divergenciaClassificacao: string | null;
  ambienteSintetico: boolean;
  itens: ItemPedidoCertidaoDTO[];
  ultimaConferencia: ConferenciaPedidoDTO | null;
  /** Conferência manual pelo Escrevente antes da impressão */
  conferidoPeloEscrevente?: boolean;
  conferidoPorNome?: string | null;
  conferidoEmBr?: string | null;
  /** Devolução do Pedido pelo Escrevente */
  devolvidoPeloEscrevente?: boolean;
  devolvidoPorNome?: string | null;
  devolvidoEmBr?: string | null;
  /** Grifos coloridos e anotações de texto posicionadas diretamente sobre o documento */
  marcacoesDocumento?: MarcacaoVisualDocumentoPedido[];
  /** Metadados originais do WEBRI para espelhamento 100% fiel e filtros de impressão em lote */
  webriMeta?: MetadadosWebriPedido;
}

/**
 * Guardas Arquiteturais Imutáveis do Cartório Virtual:
 * O objetivo primário do Cartório Virtual é operar como Central de Impressões de alta capacidade
 * e plataforma de Anotações Permanentes do Escrevente no Pedido antes da impressão.
 * Em HIPÓTESE ALGUMA o FIORIX realiza emissão de Certidão ou cobrança.
 */
export const PILOTO_GUARDA_OPERACIONAL = {
  emissaoCertidaoNoFiorixPermitida: false,
  cobrancaNoFiorixPermitida: false,
  emissaoAutomaticaHabilitada: false,
  assinaturaAutomaticaHabilitada: false,
  entregaAutomaticaHabilitada: false,
  cobrancaAutomaticaHabilitada: false,
} as const;

const TRANSICOES_PERMITIDAS: Record<EstadoOperacionalPedido, EstadoOperacionalPedido[]> = {
  RECEBIDO: ["EM_IDENTIFICACAO", "EM_REVISAO_HUMANA", "COM_FALHA_OU_PENDENCIA"],
  EM_IDENTIFICACAO: [
    "AGUARDANDO_CONTRADITORIO",
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
    "EM_REVISAO_HUMANA",
    "COM_FALHA_OU_PENDENCIA",
  ],
  AGUARDANDO_CONTRADITORIO: [
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
    "EM_CONFERENCIA",
    "EM_REVISAO_HUMANA",
    "COM_FALHA_OU_PENDENCIA",
  ],
  AGUARDANDO_ATUALIZACAO_MATRICULA: [
    "AGUARDANDO_CONTRADITORIO",
    "EM_CONFERENCIA",
    "EM_REVISAO_HUMANA",
    "COM_FALHA_OU_PENDENCIA",
  ],
  EM_CONFERENCIA: [
    "APTO_EMISSAO",
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
    "EM_REVISAO_HUMANA",
    "COM_FALHA_OU_PENDENCIA",
  ],
  EM_REVISAO_HUMANA: [
    "EM_CONFERENCIA",
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
    "APTO_EMISSAO",
    "COM_FALHA_OU_PENDENCIA",
  ],
  APTO_EMISSAO: [
    "EM_IMPRESSAO",
    "EM_CONFERENCIA",
    "EM_REVISAO_HUMANA",
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
  ],
  EM_IMPRESSAO: ["APTO_EMISSAO", "EMITIDO", "COM_FALHA_OU_PENDENCIA"],
  EMITIDO: ["AGUARDANDO_ASSINATURA", "EM_REVISAO_HUMANA", "COM_FALHA_OU_PENDENCIA"],
  AGUARDANDO_ASSINATURA: ["ASSINADO", "EM_REVISAO_HUMANA", "COM_FALHA_OU_PENDENCIA"],
  ASSINADO: ["ENTREGUE", "EM_REVISAO_HUMANA"],
  ENTREGUE: [],
  COM_FALHA_OU_PENDENCIA: [
    "EM_IDENTIFICACAO",
    "AGUARDANDO_CONTRADITORIO",
    "AGUARDANDO_ATUALIZACAO_MATRICULA",
    "EM_CONFERENCIA",
    "EM_REVISAO_HUMANA",
  ],
};

export function validarTransicaoEstadoPedido(params: {
  estadoAtual: EstadoOperacionalPedido;
  novoEstado: EstadoOperacionalPedido;
  atorTipo: "HUMANO" | "AGENTE_VIRTUAL" | "SISTEMA";
  pausadoPorAtoProcessamento?: boolean;
  dadosInvalidadosMudanca?: boolean;
  novaConferenciaRealizadaAposAto?: boolean;
}): { permitida: boolean; motivoBloqueio?: string } {
  const {
    estadoAtual,
    novoEstado,
    atorTipo,
    pausadoPorAtoProcessamento,
    dadosInvalidadosMudanca,
    novaConferenciaRealizadaAposAto,
  } = params;

  if (estadoAtual === novoEstado) return { permitida: true };

  // Regra Piloto (Seção 3 & 24): Agentes de software não podem emitir, assinar ou entregar no piloto
  if (
    atorTipo === "AGENTE_VIRTUAL" &&
    (["EMITIDO", "AGUARDANDO_ASSINATURA", "ASSINADO", "ENTREGUE"] as EstadoOperacionalPedido[]).includes(
      novoEstado
    )
  ) {
    return {
      permitida: false,
      motivoBloqueio:
        "No escopo do piloto, agentes virtuais não estão autorizados a emitir, assinar ou entregar certidões automaticamente.",
    };
  }

  // Regra 6.3: Ato registral em processamento pausa a emissão até conclusão + lançamento + digitalização + nova conferência
  if (
    novoEstado === "APTO_EMISSAO" &&
    pausadoPorAtoProcessamento &&
    !novaConferenciaRealizadaAposAto
  ) {
    return {
      permitida: false,
      motivoBloqueio:
        "Pedido pausado por ato registral em processamento (Regra 6.3): exige conclusão do ato, lançamento na matrícula, digitalização no acervo e nova conferência antes de ficar apto.",
    };
  }

  // Regra 12 & 14: Mudança relevante invalida conferências e aprovações anteriores
  if (
    (["APTO_EMISSAO", "EMITIDO", "ASSINADO"] as EstadoOperacionalPedido[]).includes(novoEstado) &&
    dadosInvalidadosMudanca
  ) {
    return {
      permitida: false,
      motivoBloqueio:
        "Os dados da matrícula ou do Contraditório sofreram alteração relevante após a última conferência/aprovação. É obrigatória nova conferência antes de avançar.",
    };
  }

  const destinosValidos = TRANSICOES_PERMITIDAS[estadoAtual] || [];
  if (!destinosValidos.includes(novoEstado)) {
    return {
      permitida: false,
      motivoBloqueio: `Transição de estado não permitida de "${ESTADOS_OPERACIONAIS_LABELS[estadoAtual]}" para "${ESTADOS_OPERACIONAIS_LABELS[novoEstado]}".`,
    };
  }

  return { permitida: true };
}

/**
 * Categorias canônicas de filtro por Tipo / Espécie de Certidão (Seções 3 e 7),
 * admitindo também filtro exato por espécie cadastrada no WEBRI (`ESPECIE:<descricao>`).
 */
export type CategoriaFiltroTipoCertidao =
  | "TODOS"
  | "INTEIRO_TEOR_MATRICULA"
  | "INTEIRO_TEOR_INDIVIDUAL"
  | "INTEIRO_TEOR_MULTI_ITEM"
  | "CERTIDAO_DIGITAL_GENERICA"
  | "BUSCA_ENDERECO"
  | "TRANSCRICAO_LOTEAMENTO"
  | "ONUS_PROPRIEDADE_OUTRAS";

export type FiltroTipoCertidaoValor = CategoriaFiltroTipoCertidao | `ESPECIE:${string}` | string;

export interface OpcaoFiltroTipoCertidao {
  valor: CategoriaFiltroTipoCertidao;
  rotulo: string;
}

export const OPCOES_FILTRO_TIPO_CERTIDAO: OpcaoFiltroTipoCertidao[] = [
  { valor: "TODOS", rotulo: "TIPOS DE CERTIDÕES" },
  {
    valor: "INTEIRO_TEOR_MATRICULA",
    rotulo: "Certidão de Inteiro Teor da Matrícula (Todos)",
  },
  {
    valor: "INTEIRO_TEOR_INDIVIDUAL",
    rotulo: "Inteiro Teor — Matrícula Individual (1 item)",
  },
  {
    valor: "INTEIRO_TEOR_MULTI_ITEM",
    rotulo: "Inteiro Teor — Multi-Matrícula / Lote",
  },
  {
    valor: "CERTIDAO_DIGITAL_GENERICA",
    rotulo: "Certidão Digital (Subtipo a confirmar)",
  },
  {
    valor: "BUSCA_ENDERECO",
    rotulo: "Busca por Endereço / Indicador Real",
  },
  {
    valor: "TRANSCRICAO_LOTEAMENTO",
    rotulo: "Certidão de Transcrição / Loteamento",
  },
  {
    valor: "ONUS_PROPRIEDADE_OUTRAS",
    rotulo: "Ônus, Propriedade, Negativa ou Outras Espécies",
  },
];

function normalizarTextoComparacao(valor: string | null | undefined): string {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export interface PedidoResumoTipoCertidao {
  especieSolicitada: string;
  subtipoConfirmado?: string | null;
  criterioSolicitacao?: CriterioSolicitacaoCertidao | string | null;
  itens?: Array<{ naturezaDescricao?: string | null }>;
}

/**
 * Avalia de forma determinística se um pedido corresponde ao filtro de Tipo / Espécie de Certidão selecionado.
 * Respeita a regra da Seção 3: "Certidão Digital" sem subtipo confirmado NUNCA é confundida com Inteiro Teor.
 */
export function correspondeFiltroTipoCertidao(
  pedido: PedidoResumoTipoCertidao,
  filtroTipo: FiltroTipoCertidaoValor | undefined | null
): boolean {
  if (!filtroTipo || filtroTipo === "TODOS") {
    return true;
  }

  const espNorm = normalizarTextoComparacao(pedido.especieSolicitada);
  const subNorm = normalizarTextoComparacao(pedido.subtipoConfirmado);
  const crit = (pedido.criterioSolicitacao || "").toUpperCase();
  const qtdItens = pedido.itens ? pedido.itens.length : 1;

  if (filtroTipo.startsWith("ESPECIE:")) {
    const alvoNorm = normalizarTextoComparacao(filtroTipo.slice("ESPECIE:".length));
    if (!alvoNorm) return true;
    if (espNorm === alvoNorm) return true;
    return Boolean(
      pedido.itens?.some((it) => normalizarTextoComparacao(it.naturezaDescricao) === alvoNorm)
    );
  }

  const isInteiroTeorConfirmado =
    subNorm === "inteiro_teor_matricula" ||
    (espNorm.includes("inteiro teor") && (crit === "MATRICULA" || crit === ""));

  const isBuscaEndereco =
    crit === "ENDERECO" ||
    espNorm.includes("endereco") ||
    espNorm.includes("indicador real");

  const isTranscricaoLoteamento =
    crit === "TRANSCRICAO" ||
    crit === "LOTEAMENTO" ||
    espNorm.includes("transcricao") ||
    espNorm.includes("loteamento");

  const isCertidaoDigitalGenerica =
    !isInteiroTeorConfirmado &&
    !isBuscaEndereco &&
    !isTranscricaoLoteamento &&
    (subNorm === "nao_confirmado" || espNorm.includes("certidao digital"));

  switch (filtroTipo) {
    case "INTEIRO_TEOR_MATRICULA":
      return isInteiroTeorConfirmado;
    case "INTEIRO_TEOR_INDIVIDUAL":
      return isInteiroTeorConfirmado && qtdItens <= 1;
    case "INTEIRO_TEOR_MULTI_ITEM":
      return isInteiroTeorConfirmado && qtdItens > 1;
    case "CERTIDAO_DIGITAL_GENERICA":
      return isCertidaoDigitalGenerica;
    case "BUSCA_ENDERECO":
      return isBuscaEndereco;
    case "TRANSCRICAO_LOTEAMENTO":
      return isTranscricaoLoteamento;
    case "ONUS_PROPRIEDADE_OUTRAS":
      return (
        !isInteiroTeorConfirmado &&
        !isCertidaoDigitalGenerica &&
        !isBuscaEndereco &&
        !isTranscricaoLoteamento
      );
    default: {
      const livreNorm = normalizarTextoComparacao(filtroTipo);
      if (!livreNorm) return true;
      return (
        espNorm === livreNorm ||
        espNorm.includes(livreNorm) ||
        Boolean(
          pedido.itens?.some((it) =>
            normalizarTextoComparacao(it.naturezaDescricao).includes(livreNorm)
          )
        )
      );
    }
  }
}

/**
 * Extrai espécies nominais distintas presentes na lista carregada (útil quando o WEBRI traz naturezas adicionais).
 */
export function extrairEspeciesDistintasPedidos<T extends { especieSolicitada: string }>(
  pedidos: T[]
): Array<{ especie: string; quantidade: number }> {
  const mapa = new Map<string, { especie: string; quantidade: number }>();
  for (const p of pedidos) {
    const chave = normalizarTextoComparacao(p.especieSolicitada);
    if (!chave) continue;
    const atual = mapa.get(chave);
    if (atual) {
      atual.quantidade += 1;
    } else {
      mapa.set(chave, { especie: p.especieSolicitada.trim(), quantidade: 1 });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR"));
}

export interface ResultadoSelecaoPedidosLote<T> {
  pedidosEncontrados: T[];
  idsEncontrados: string[];
  numerosEncontrados: string[];
  naoLocalizados: string[];
  resumoCriterio: string;
  temEntradaValida: boolean;
}

function extrairInteiroPedido(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const limpo = valor.trim().replace(/^#+/, "");
  if (!/^\d+$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Interpreta seleção rápida de Pedidos para impressão em lote pelo Escrevente:
 * 1) Intervalo "de tanto a tanto" (`faixaInicio` até `faixaFim`, ex: 9901001 até 9901006);
 * 2) Números separados por ponto e vírgula `;` (também aceita vírgula, quebra de linha e
 *    intervalos inline como `9901001-9901004; 9901007; 9901008`).
 */
export function interpretarSelecaoPedidosLote<
  T extends { id: string; numeroPedido: string; protocoloExterno?: string | null }
>(params: {
  pedidosDisponiveis: T[];
  faixaInicio?: string;
  faixaFim?: string;
  listaPontoEVirgula?: string;
}): ResultadoSelecaoPedidosLote<T> {
  const { pedidosDisponiveis } = params;
  const iniRaw = (params.faixaInicio || "").trim();
  const fimRaw = (params.faixaFim || "").trim();
  const listaRaw = (params.listaPontoEVirgula || "").trim();

  if (!iniRaw && !fimRaw && !listaRaw) {
    return {
      pedidosEncontrados: [],
      idsEncontrados: [],
      numerosEncontrados: [],
      naoLocalizados: [],
      resumoCriterio: "",
      temEntradaValida: false,
    };
  }

  const adicionadosSet = new Set<string>();
  const pedidosEncontrados: T[] = [];
  const naoLocalizados: string[] = [];
  const partesResumo: string[] = [];

  const adicionarPedido = (p: T) => {
    if (!adicionadosSet.has(p.id)) {
      adicionadosSet.add(p.id);
      pedidosEncontrados.push(p);
    }
  };

  const normalizarZerosConsecutivos = (valor: string): string =>
    valor.replace(/\D/g, "").replace(/0+/g, "0");

  const resolverPedidoPorTokenFlexivel = (tokenBruto: string): T | undefined => {
    const limpo = tokenBruto.trim().replace(/^#+/, "");
    if (!limpo) return undefined;
    const norm = limpo.toLowerCase();
    const numToken = extrairInteiroPedido(limpo);
    const digitosLimpos = limpo.replace(/\D/g, "");
    const zeroCompacto = normalizarZerosConsecutivos(limpo);

    // 1. Match exato por número do pedido ou protocolo externo
    const exato = pedidosDisponiveis.find((p) => {
      if (p.numeroPedido.trim().toLowerCase() === norm) return true;
      if (numToken !== null && extrairInteiroPedido(p.numeroPedido) === numToken) return true;
      if ((p.protocoloExterno || "").trim().toLowerCase() === norm) return true;
      return false;
    });
    if (exato) return exato;

    // 2. Match tolerante a zeros extras intermediários (ex: "99010001" -> "9901001")
    if (zeroCompacto.length >= 4) {
      const porZeroCompacto = pedidosDisponiveis.find(
        (p) => normalizarZerosConsecutivos(p.numeroPedido) === zeroCompacto
      );
      if (porZeroCompacto) return porZeroCompacto;
    }

    // 3. Match por sufixo numérico não-ambíguo quando digitado final do pedido (ex: "1001", "001")
    if (digitosLimpos.length >= 1 && digitosLimpos.length <= 4) {
      const candidatosSufixo = pedidosDisponiveis.filter((p) => {
        const pDig = p.numeroPedido.replace(/\D/g, "");
        return pDig.endsWith(digitosLimpos);
      });
      if (candidatosSufixo.length === 1) {
        return candidatosSufixo[0];
      }
    }

    return undefined;
  };

  const processarFaixaNumerica = (aStr: string, bStr: string, rotuloOriginal: string) => {
    let numA = extrairInteiroPedido(aStr);
    let numB = extrairInteiroPedido(bStr);
    if (numA === null || numB === null) {
      naoLocalizados.push(rotuloOriginal);
      return;
    }
    let min = Math.min(numA, numB);
    let max = Math.max(numA, numB);
    let daFaixa = pedidosDisponiveis
      .filter((p) => {
        const n = extrairInteiroPedido(p.numeroPedido);
        return n !== null && n >= min && n <= max;
      })
      .sort((x, y) => x.numeroPedido.localeCompare(y.numeroPedido, undefined, { numeric: true }));

    // Se a faixa exata não localizou pedidos (ex: digitou 99010001 até 99010004 com zero extra), resolve os extremos
    if (daFaixa.length === 0) {
      const pedIni = resolverPedidoPorTokenFlexivel(aStr);
      const pedFim = resolverPedidoPorTokenFlexivel(bStr);
      const nIniResolvido = pedIni ? extrairInteiroPedido(pedIni.numeroPedido) : null;
      const nFimResolvido = pedFim ? extrairInteiroPedido(pedFim.numeroPedido) : null;
      if (nIniResolvido !== null && nFimResolvido !== null) {
        min = Math.min(nIniResolvido, nFimResolvido);
        max = Math.max(nIniResolvido, nFimResolvido);
        daFaixa = pedidosDisponiveis
          .filter((p) => {
            const n = extrairInteiroPedido(p.numeroPedido);
            return n !== null && n >= min && n <= max;
          })
          .sort((x, y) =>
            x.numeroPedido.localeCompare(y.numeroPedido, undefined, { numeric: true })
          );
      }
    }

    if (daFaixa.length === 0) {
      naoLocalizados.push(`${min} a ${max}`);
    } else {
      for (const p of daFaixa) adicionarPedido(p);
    }
  };

  const processarTokenUnico = (tokenBruto: string) => {
    const limpo = tokenBruto.trim().replace(/^#+/, "");
    if (!limpo) return;
    const achado = resolverPedidoPorTokenFlexivel(limpo);
    if (achado) {
      adicionarPedido(achado);
    } else {
      naoLocalizados.push(limpo);
    }
  };

  // 1) Faixa explícita "De ... Até ..."
  if (iniRaw || fimRaw) {
    const efetivoIni = iniRaw || fimRaw;
    const efetivoFim = fimRaw || iniRaw;
    partesResumo.push(`Faixa ${efetivoIni} até ${efetivoFim}`);
    processarFaixaNumerica(efetivoIni, efetivoFim, `${efetivoIni} até ${efetivoFim}`);
  }

  // 2) Lista separada por ponto e vírgula `;` (aceitando intervalos inline ex: 9901001-9901004; 9901007)
  if (listaRaw) {
    const segmentos = listaRaw
      .split(/[;,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (segmentos.length > 0) {
      partesResumo.push(
        `${segmentos.length} entrada(s) por ponto e vírgula (${segmentos.slice(0, 4).join("; ")}${
          segmentos.length > 4 ? "…" : ""
        })`
      );
    }

    for (const seg of segmentos) {
      const matchFaixaInline = seg.match(
        /^#?\s*(\d+)\s*(?:-|–|—|\.\.|a|até|ate)\s*#?\s*(\d+)$/i
      );
      if (matchFaixaInline) {
        processarFaixaNumerica(matchFaixaInline[1], matchFaixaInline[2], seg);
      } else {
        processarTokenUnico(seg);
      }
    }
  }

  return {
    pedidosEncontrados,
    idsEncontrados: pedidosEncontrados.map((p) => p.id),
    numerosEncontrados: pedidosEncontrados.map((p) => p.numeroPedido),
    naoLocalizados,
    resumoCriterio: partesResumo.join(" + "),
    temEntradaValida: true,
  };
}

/**
 * Retorna a lista consolidada de Prenotações em Contraditório vinculadas ao Pedido
 * (oriundas de tblWRIRecepcao, tblWRITitulos, tblWRICertidaoResultadoContraditorio,
 * tblWRITipoPrenotacao, tblWRITitulosReal, tblWRIReal, tblWRIImovelBase e tblWRIImovel).
 */
export function obterPrenotacoesContraditorioDoPedido(
  pedido: PedidoCertidaoDetalheDTO
): PrenotacaoContraditorio[] {
  const encontradas = pedido.ultimaConferencia?.prenotacoesEncontradas || [];
  if (encontradas.length > 0) {
    return encontradas;
  }
  if (pedido.prenotacaoVinculada) {
    return [
      {
        numeroPrenotacao: pedido.prenotacaoVinculada,
        numeroMatricula: pedido.itens[0]?.numeroMatricula || null,
        livroContraditorio: pedido.itens[0]?.numeroMatricula
          ? `MAT ${pedido.itens[0].numeroMatricula}`
          : null,
        dataApresentacaoIso: pedido.dataPedidoIso,
        dataApresentacaoBr: pedido.dataPedidoBr,
        naturezaTitulo: "Prenotação ativa vinculada no Contraditório",
        emProcessamentoAtoNaMatricula: Boolean(pedido.pausadoPorAtoProcessamento),
        etapaAtual: pedido.pausadoPorAtoProcessamento
          ? "Ato registral em processamento"
          : "Em tramitação no Contraditório",
        origemSqlTabelas:
          "tblWRIRecepcao • tblWRITitulos • tblWRICertidaoResultadoContraditorio • tblWRITipoPrenotacao • tblWRITitulosReal • tblWRIReal • tblWRIImovelBase • tblWRIImovel",
      },
    ];
  }
  return [];
}

/**
 * Formata o número do protocolo no padrão oficial WEBRI com ponto separador de milhar (ex: 1321013 -> 1.321.013).
 */
export function formatarProtocoloPontoMilhar(numeroPedido: string | number): string {
  const digitos = String(numeroPedido || "")
    .trim()
    .replace(/\D/g, "");
  if (!digitos) return String(numeroPedido || "—");
  const n = Number(digitos);
  if (!Number.isSafeInteger(n) || n <= 0) return String(numeroPedido || "—");
  return n.toLocaleString("pt-BR");
}

/**
 * Gera o Código de Acesso idêntico ao impresso pelo WEBRI no Verso:
 * últimos 4 dígitos do protocolo + MM + DD + YYYY da data do pedido (ex: 1321013 em 28/09/2026 -> 101309282026).
 */
export function gerarCodigoAcessoWebri(pedido: PedidoCertidaoDetalheDTO): string {
  if (pedido.webriMeta?.codigoAcesso && pedido.webriMeta.codigoAcesso.trim()) {
    return pedido.webriMeta.codigoAcesso.trim();
  }
  const digitosPedido = String(pedido.numeroPedido || "")
    .replace(/\D/g, "")
    .slice(-4)
    .padStart(4, "0");

  const partesData = (pedido.dataPedidoBr || "").split("/");
  if (partesData.length === 3) {
    const [dd, mm, yyyy] = partesData;
    return `${digitosPedido}${mm.padStart(2, "0")}${dd.padStart(2, "0")}${yyyy}`;
  }
  const dt = new Date(pedido.dataPedidoIso);
  if (!Number.isNaN(dt.getTime())) {
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = String(dt.getFullYear());
    return `${digitosPedido}${mm}${dd}${yyyy}`;
  }
  return `${digitosPedido}00000000`;
}

/**
 * Extrai estritamente a Observação original do banco de dados do WEBRI / ONR
 * (ex: "Valor Depositado: 76,54"), removendo qualquer concatenação legada de DescricaoDosItens.
 */
export function obterObservacaoOriginalWebri(pedido: PedidoCertidaoDetalheDTO): string {
  const metaObs = pedido.webriMeta?.observacaoPedidoOriginal?.trim();
  if (metaObs) return metaObs;

  const bruto = (pedido.observacoesOrigem || "").trim();
  if (bruto) {
    const semConcat = bruto
      .split(/\s*\|\s*(?:Pedido referente a|\d+\.\s*<B>|\d+\.\s*Incluido)/i)[0]
      .replace(/<[^>]+>/g, "")
      .trim();
    if (semConcat) return semConcat;
  }

  const vDep = pedido.valores?.totalDeposito ?? pedido.valores?.valorServico ?? 0;
  if (vDep > 0) {
    return `Valor Depositado: ${vDep.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return "";
}

/**
 * Retorna o nome do(a) Atendente para exibição na Frente ("Atendente: Anne").
 */
export function obterAtendentePedidoWebri(pedido: PedidoCertidaoDetalheDTO): string {
  const nomeMeta = pedido.webriMeta?.atendenteNome?.trim();
  if (nomeMeta) return nomeMeta;
  const itemAtend = pedido.itens?.[0]?.atendenteItemNome?.trim();
  if (itemAtend) return itemAtend;
  const escr = (pedido.escreventeRecepcao || "").trim();
  if (escr && escr !== "WEBRI / Recepção" && !escr.toLowerCase().includes("autom")) {
    return escr;
  }
  return pedido.origem === "ONR" ? "Anne" : "Recepção";
}

export interface LinhaItemDadosDoPedidoWebri {
  sequencia: number;
  naturezaTexto: string;
  complementoAntesMatricula: string;
  numeroMatricula: number | null;
  complementoDepoisMatricula: string;
  textoCompletoPlano: string;
}

/**
 * Monta as linhas de "DADOS DO PEDIDO:" idênticas ao modelo oficial do WEBRI:
 * ex: "1.Incluido por meio Magnetico (M) - Matrícula livro n. 150053"
 */
export function obterLinhasDadosDoPedidoWebri(
  pedido: PedidoCertidaoDetalheDTO
): LinhaItemDadosDoPedidoWebri[] {
  const itens =
    pedido.itens && pedido.itens.length > 0
      ? pedido.itens
      : [
          {
            id: "fallback-1",
            sequenciaItem: 1,
            naturezaCodigo: pedido.origem === "ONR" ? 71 : null,
            naturezaDescricao: pedido.especieSolicitada,
            naturezaOriginalWebri:
              pedido.webriMeta?.naturezaOriginalWebri ||
              (pedido.origem === "ONR" ? "Incluido por meio Magnetico (M)" : pedido.especieSolicitada),
            livroCodigo: 2,
            livroDescricao: "Matrícula",
            numeroMatricula: null,
            transcricaoOuLoteamento: null,
            enderecoPesquisa: null,
            meioEntregaCodigo: "M",
            meioEntregaDescricao: null,
            dataPrevisaoIso: pedido.prazoPrevistoIso,
            dataPrevisaoBr: pedido.prazoPrevistoBr,
            elegivelPiloto: false,
            motivoEncaminhamentoHumano: null,
            statusItem: "PENDENTE",
            acervoSnapshot: null,
          },
        ];

  return itens.map((it, idx) => {
    const seq = it.sequenciaItem || idx + 1;
    const natOrig = (
      it.naturezaOriginalWebri ||
      pedido.webriMeta?.naturezaOriginalWebri ||
      (it.naturezaCodigo === 71 || pedido.origem === "ONR"
        ? "Incluido por meio Magnetico (M)"
        : it.naturezaDescricao || pedido.especieSolicitada)
    )
      .replace(/<=<=/g, "")
      .trim();

    if (it.numeroMatricula && it.numeroMatricula > 0) {
      const textoCompletoPlano = `${seq}.${natOrig} - Matrícula livro n. ${it.numeroMatricula}`;
      return {
        sequencia: seq,
        naturezaTexto: `${seq}.${natOrig}`,
        complementoAntesMatricula: " - Matrícula livro n. ",
        numeroMatricula: it.numeroMatricula,
        complementoDepoisMatricula: "",
        textoCompletoPlano,
      };
    }

    const detExtra = it.enderecoPesquisa
      ? ` - Endereço: ${it.enderecoPesquisa}`
      : it.transcricaoOuLoteamento
      ? ` - ${it.transcricaoOuLoteamento}`
      : "";
    const textoCompletoPlano = `${seq}.${natOrig}${detExtra}`;
    return {
      sequencia: seq,
      naturezaTexto: `${seq}.${natOrig}`,
      complementoAntesMatricula: detExtra,
      numeroMatricula: null,
      complementoDepoisMatricula: "",
      textoCompletoPlano,
    };
  });
}




