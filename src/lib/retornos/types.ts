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

export interface RetornosKpis {
  total: number;
  corrigidos: number;
  semMarcador: number;
}

export interface RetornosResponse {
  success: boolean;
  kpis: RetornosKpis;
  responsaveis: ResponsavelContagem[];
  items: RetornoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastSyncAt: string | null;
  isMockData?: boolean;
}
