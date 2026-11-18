export type MemorialServerKey = 'SRVSQL' | 'SRVFILES' | 'SRVSIPLANIA' | 'GERAL';

export type MemorialCategory =
  | 'PERFORMANCE'
  | 'SEGURANCA_ACESSO'
  | 'IA_OCR_PESQUISA'
  | 'OBSERVABILIDADE'
  | 'ALTA_DISPONIBILIDADE'
  | 'ARQUITETURA_REDE';

export type MemorialStatus =
  | 'ATIVO'
  | 'MONITORANDO'
  | 'DECISAO_ARQUITETURAL'
  | 'HISTORICO';

export type MemorialSource = 'OFICIAL_CODIGO' | 'REGISTRO_MASTER';

export interface ServerTopologySummary {
  key: 'SRVSQL' | 'SRVFILES' | 'SRVSIPLANIA';
  name: string;
  ip: string;
  roleTitle: string;
  specs: string;
  engines: string;
  currentHealthSummary: string;
  keyMetrics: Array<{ label: string; value: string }>;
}

export interface GovernanceBoundaryItem {
  id: string;
  server: MemorialServerKey;
  subject: string;
  portOrScope: string;
  mode: string;
  protection: string;
  notes: string;
}

export interface MemorialInfraEntry {
  id: string;
  source: MemorialSource;
  server: MemorialServerKey;
  category: MemorialCategory;
  status: MemorialStatus;
  title: string;
  implementedAt: string; // YYYY-MM-DD
  connectorVersion: string | null;
  summarySimple: string;
  problemBefore: string;
  solutionApplied: string;
  metricBefore: string;
  metricAfter: string;
  impactBadge: string;
  technicalDetails: string;
  commandsSnippet: string | null;
  rollbackPlan: string | null;
  authorName: string;
  updatedAtIso: string;
}

export interface MemorialInfraSnapshot {
  generatedAtIso: string;
  servers: ServerTopologySummary[];
  governance: GovernanceBoundaryItem[];
  entries: MemorialInfraEntry[];
  dbPersistedCount: number;
}
