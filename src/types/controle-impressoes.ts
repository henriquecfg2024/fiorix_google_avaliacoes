export interface ImpressaoHeroStats {
  demanda: number;
  produzidas: number;
  pendencias: number;
  saldoOperacional: number;
  taxaAtendimento: number;
  tempoMedio: number;
  backlogInicio: number;
  backlogFinal: number;
}

export type StatusImpressaoItem = 'REALIZADO' | 'PENDENTE' | 'NAO_APLICAVEL';

export interface ImpressaoItemRow {
  id: string;
  protocolo: number;
  numeroLivro: string;
  tipoNatureza: string;
  dataEntrada?: string;
  etapaAtual?: string;
  ultimoRegistro: string;
  certidaoStatus: StatusImpressaoItem;
  certidaoData: string | null;
  certidaoResponsavel?: string | null;
  livroStatus: StatusImpressaoItem;
  livroData: string | null;
  livroResponsavel?: string | null;
  diasPendente: number;
  linkOnr: string;
}

export interface OperadorImpressao {
  nome: string;
  totalLivro: number;
  totalCertidao: number;
  total: number;
}

export interface EvolucaoDiariaItem {
  data: string;
  demanda: number;
  produzidasCertidao: number;
  produzidasLivro: number;
}

export interface DistribuicaoNaturezaItem {
  nome: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

export interface DistribuicaoBacklogItem {
  faixa: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

export interface ControleImpressoesData {
  certidaoStats: ImpressaoHeroStats;
  livroStats: ImpressaoHeroStats;
  evolucaoDiaria: EvolucaoDiariaItem[];
  distribuicaoNatureza: DistribuicaoNaturezaItem[];
  distribuicaoBacklog: DistribuicaoBacklogItem[];
  itens: ImpressaoItemRow[];
  totalRegistros: number;
  ultimaSincronizacao: string;
  operadores: OperadorImpressao[];
}
