export interface RetornoItem {
  idAndamento: string;
  idRecepcao: number;
  numeroPrenotacao: number;
  dataRecepcao: string;
  tipoRecepcao: 'ENTRADA' | 'REINGRESSO' | string;
  formaTitulo: string;
  idTipoRetorno: number;
  siglaRetorno: 'RTR' | 'RRE' | 'RPE' | 'RTC' | 'RPC' | 'RRC' | string;
  tipoRetorno: string;
  familiaRetorno: 'Pessoal' | 'Real' | 'Tela de recepção';
  classificacao: 'Corrigido' | 'Sem marcador';
  dataRetorno: string; // ISO
  idUsuarioOrigem: string | null;
  usuarioOrigem: string;
  idUsuarioDestino: string | null;
  usuarioDestinoRetorno: string;
  observacao: string;
  seqTitulo: number;
}

export interface ResponsavelContagem {
  id: string;
  nome: string;
  quantidade: number;
}

/** Contagem de TODOS os eventos (292-297) por colaborador — para o card "Erros por colaborador" */
export interface ResponsavelContagemCompleta {
  id: string;
  nome: string;
  total: number;
  corrigidos: number;
  semMarcador: number;
}

/** Agregação mensal — para o card "Erros mês a mês" */
export interface ErroMensal {
  mes: string;       // "YYYY-MM"
  mesLabel: string;   // "Jan/25", "Fev/25"…
  total: number;
  corrigidos: number;
  semMarcador: number;
}

export interface TopCausa {
  id: string;
  nome: string;
  descricao: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

export interface RetornosKpis {
  total: number;
  corrigidos: number;
  semMarcador: number;
  reingressos: number;
  taxaRetrabalho: number;  // percentual (ex: 28.5)
  tempoMedioDias: number;  // média de dias desde a recepção
  taxaResolucao: number;   // percentual de corrigidos (ex: 42.1)
  topCausas?: TopCausa[];
}

export interface RetornosResponse {
  success: boolean;
  kpis: RetornosKpis;
  responsaveis: ResponsavelContagem[];
  /** Contagem completa (292-297) por colaborador */
  responsaveisCompleto: ResponsavelContagemCompleta[];
  /** Agregação mensal de eventos */
  errosMensais: ErroMensal[];
  /** Principais causas de retorno/exigência */
  topCausas: TopCausa[];
  items: RetornoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastSyncAt: string | null;
  isMockData?: boolean;
}
