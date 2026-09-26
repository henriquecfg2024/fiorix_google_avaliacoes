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

export interface RetornosKpis {
  total: number;
  corrigidos: number;
  semMarcador: number;
}

export interface RetornosResponse {
  success: boolean;
  kpis: RetornosKpis;
  responsaveis: ResponsavelContagem[];
  /** Contagem completa (292-297) por colaborador */
  responsaveisCompleto: ResponsavelContagemCompleta[];
  /** Agregação mensal de eventos */
  errosMensais: ErroMensal[];
  items: RetornoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastSyncAt: string | null;
  isMockData?: boolean;
}
