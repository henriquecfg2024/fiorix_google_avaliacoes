export type ReurbModalidade = 'REURB_S' | 'REURB_E' | 'ART_69';
export type ReurbSituacaoValidacao = 'APTO' | 'PENDENTE';
export type ReurbSeveridade = 'BLOQUEIA' | 'MEDIA' | 'INFO';
export type ReurbDataReferencia = 'registro' | 'prenotacao' | 'abertura_derivada';
export type ReurbStatusImportacaoOnr =
  | 'NAO_EXPORTADA'
  | 'EXPORTADA_AGUARDANDO_CONFIRMACAO'
  | 'IMPORTADA_ONR';

export interface ReurbFonteCampo {
  campo: string;
  valor: string;
  origem: string;
  trechoOcr: string | null;
  exigeConferencia: boolean;
}

export interface ReurbAtoVinculado {
  atoId: number;
  seqAto: number;
  seqLabel: string;
  avReg: string;
  tipoAto: string;
  negId: number | null;
  negocioDescricao: string;
  dataAto: string | null;
}

export interface ReurbDerivadaDTO {
  id?: string;
  matriculaDerivada: number;
  complMatricula: string | null;
  dataAbertura: string | null;
  dataRegistro: string | null;
  tipoInteresse: number;
  incluirNoJson: boolean;
  ehAreaPublica: boolean;
  ehCondominioIntermediario: boolean;
  categoriaArea: string;
  vinculoMetodo: string | null;
  motivoExclusao: string | null;
  fonteOcr: string | null;
}

export interface ReurbPendenciaDTO {
  id?: string;
  matriculaDerivada: number | null;
  campo: string;
  severidade: ReurbSeveridade;
  motivo: string;
  fonte: string;
  acaoNecessaria: string | null;
  exigeConferencia: boolean;
}

export interface ReurbRegularizacaoDTO {
  id: string;
  recordKey: string;
  prenotacao: number;
  matricula: number;
  complMatricula: string | null;
  protocolo: string;
  empreendimento: string | null;
  empreendimentoFonte: string | null;
  empreendimentoTrechoOcr: string | null;
  negId: number;
  classificacaoFinal: string;
  modalidade: ReurbModalidade;
  tipoInteresse: number;
  dataRegistro: string | null;
  dataPrenotacao: string | null;
  municipio: string | null;
  distrito: string | null;
  subdistrito: string | null;
  bairro: string | null;
  bairroSugerido: string | null;
  tipoLocalizacao: 'U' | 'R' | string;
  quantidadeUnidades: number;
  qtdDerivadasLista: number;
  qtdAreasPublicasExcluidas: number;
  tipoAgente: number | null;
  agente: string | null;
  situacaoValidacao: ReurbSituacaoValidacao;
  qtdBloqueios: number;
  qtdAlertas: number;
  ehArt69: boolean;
  fontes: ReurbFonteCampo[];
  atosVinculados: ReurbAtoVinculado[];
  derivadas: ReurbDerivadaDTO[];
  pendencias: ReurbPendenciaDTO[];
  ultimaExportacaoEm: string | null;
  ultimaImportacaoConfirmadaEm: string | null;
  statusImportacaoOnr: ReurbStatusImportacaoOnr;
  syncedAt: string | null;
}

export interface ReurbDerivadaDestaqueItem {
  matriculaDerivada: number;
  dataAbertura: string | null;
  dataRegistro: string | null;
  regularizacaoId: string;
  matriculaMatriz: number;
  protocolo: string;
  empreendimento: string | null;
  dataRegistroMatriz: string | null;
  deOutroMes: boolean;
  categoriaArea: string;
}

export interface ReurbRegularizacaoResumo extends ReurbRegularizacaoDTO {
  qtdDerivadasAbertasNoPeriodo?: number;
  derivadasNoPeriodo?: ReurbDerivadaDestaqueItem[];
}

export interface ReurbConsultaFiltros {
  ano?: number | null;
  mes?: number | 'todos' | null;
  dataDe?: string | null;
  dataAte?: string | null;
  tipoData?: ReurbDataReferencia;
  busca?: string | null;
  modalidade?: 'TODAS' | ReurbModalidade;
  situacao?: 'TODAS' | ReurbSituacaoValidacao;
  page?: number;
  pageSize?: number;
  incluirArt69?: boolean;
}

export interface ReurbPainelDTO {
  ano: number;
  mes: number | 'todos';
  kpis: {
    registradas: number;
    derivadasAbertas: number;
    aptasExportacao: number;
    comPendencias: number;
  };
  derivadasPeriodoResumo: {
    totalDerivadas: number;
    derivadasDeOutroMes: number;
    itens: ReurbDerivadaDestaqueItem[];
  };
  processosPeriodo: ReurbRegularizacaoResumo[];
  demoMode: boolean;
}

export interface ReurbRelatorioModalidadeItem {
  modalidade: ReurbModalidade;
  label: string;
  registradas: number;
  derivadasAbertas: number;
  aptas: number;
  comPendencias: number;
}

export interface ReurbRelatorioEvolucaoMesItem {
  mes: number;
  mesLabel: string;
  registradas: number;
  derivadasAbertas: number;
  aptas: number;
  comPendencias: number;
}

export interface ReurbRelatorioPendenciaItem {
  id: string;
  matricula: number;
  protocolo: string;
  empreendimento: string | null;
  modalidade: ReurbModalidade;
  dataRegistro: string | null;
  qtdBloqueios: number;
  qtdAlertas: number;
  motivoPrincipal: string;
}

export interface ReurbRelatorioDTO {
  ano: number;
  mes: number | 'todos';
  totais: {
    registradas: number;
    derivadasAbertas: number;
    aptas: number;
    comPendencias: number;
  };
  porModalidade: ReurbRelatorioModalidadeItem[];
  evolucaoMensal: ReurbRelatorioEvolucaoMesItem[];
  pendenciasPeriodo: ReurbRelatorioPendenciaItem[];
  demoMode: boolean;
}

export interface OnrJsonDerivada {
  matricula: number;
  dataAbertura?: string;
  dataRegistro: string | null;
  tipoInteresse: 1 | 2 | 3;
}

export interface OnrJsonRegularizacao {
  matricula: number;
  municipio: string;
  distrito: string;
  subdistrito?: string;
  bairro: string;
  tipoLocalizacao: 'U' | 'R';
  quantidadeUnidades: number;
  dataRegistro: string;
  dataPrenotacao: string;
  tipoInteresse: 1 | 2 | 3;
  tipoAgente: 1 | 2;
  agente: string;
  derivadas: OnrJsonDerivada[];
}

export interface OnrJsonPayload {
  regularizacoes: OnrJsonRegularizacao[];
}

export interface OnrValidationIssue {
  matricula: number | null;
  prenotacao: number | null;
  campo: string;
  severidade: ReurbSeveridade;
  motivo: string;
}

export interface OnrValidationResult {
  apto: boolean;
  registroOnr: OnrJsonRegularizacao | null;
  issues: OnrValidationIssue[];
  bloqueios: OnrValidationIssue[];
  avisos: OnrValidationIssue[];
}

export interface ReurbExportacaoItemDTO {
  id: string;
  regularizacaoId: string | null;
  prenotacao: number;
  matricula: number;
  protocolo: string;
  empreendimento: string | null;
  modalidade: string;
  incluidaNoJson: boolean;
  situacaoNoMomento: string;
  qtdDerivadasIncluidas: number;
  motivosBloqueio: Array<{ campo: string; severidade?: string; motivo: string; fonte?: string }>;
}

export interface ReurbExportacaoDTO {
  id: string;
  tipo: 'UNITARIA' | 'LOTE';
  statusGeracao: 'GERADO' | 'FALHA';
  statusImportacaoOnr: 'NAO_GERADO' | 'PENDENTE_CONFIRMACAO' | 'CONFIRMADA_ONR';
  nomeArquivoJson: string | null;
  nomeArquivoPendencias: string | null;
  qtdSolicitadas: number;
  qtdAptasGeradas: number;
  qtdBarradas: number;
  qtdDerivadasIncluidas: number;
  jsonSha256: string | null;
  erroDetalhe: string | null;
  revalidacaoConnectorId: string | null;
  revalidadoEm: string | null;
  ocrConsultado: boolean;
  geradoPorNome: string | null;
  confirmadoImportacaoEm: string | null;
  confirmadoPorNome: string | null;
  protocoloOnrExterno: string | null;
  observacaoConfirmacao: string | null;
  createdAt: string;
  itens: ReurbExportacaoItemDTO[];
}
