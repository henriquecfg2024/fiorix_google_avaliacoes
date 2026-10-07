/**
 * FIORIX — Fase 6.3 | Shadow mode do motor granular (NÃO integrado a rotas)
 *
 * Calcula a decisão granular em paralelo à decisão legada e registra
 * divergências como telemetria estruturada. Garantias:
 * - A decisão RETORNADA é SEMPRE a legada (nenhum bloqueio real).
 * - Flag `FEATURE_GRANULAR_ACCESS_SHADOW_V1_ENABLED` (nome proposto em D10),
 *   padrão desligado: com a flag desligada o motor granular nem é consultado.
 * - Nunca lança: falhas do motor ou do sink são engolidas.
 * - Registro sanitizado: somente IDs imutáveis, nó, ação e códigos de motivo.
 *   Sem e-mail, nome, URL, segredo ou mensagem de erro bruta.
 */

import { CANONICAL_MODULES } from '@/lib/plans/modules-catalog';
import { resolveGranularAccess } from './engine';
import type { AccessDecision, AccessReasonCode, AccessRequest, GranularSnapshot } from './types';

export const GRANULAR_SHADOW_FLAG = 'FEATURE_GRANULAR_ACCESS_SHADOW_V1_ENABLED';

/** Versão do motor granular. Incrementar a cada mudança de regra de decisão. */
export const GRANULAR_ENGINE_VERSION = '6.3.0';

/** FNV-1a 32 bits (determinístico, sem dependências). */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Impressão digital do catálogo canônico (ids + ações suportadas). Muda sempre
 * que um módulo ou ação é adicionado/removido, permitindo separar divergências
 * causadas por código das causadas por mudança de catálogo.
 */
export function computeCatalogVersion(modules: Readonly<Record<string, { supportedActions: readonly string[] }>> = CANONICAL_MODULES): string {
  const canonical = Object.keys(modules)
    .sort()
    .map((id) => `${id}:${[...modules[id].supportedActions].sort().join(',')}`)
    .join('|');
  return `cat-${fnv1a(canonical)}`;
}

export const GRANULAR_CATALOG_VERSION = computeCatalogVersion();

/**
 * O contrato não lê o ambiente (guard da Fase 6.0; decisão D10 pendente).
 * O chamador injeta o ambiente explicitamente; sem injeção ⇒ desligado.
 */
export function isGranularShadowEnabled(env: Record<string, string | undefined> = {}): boolean {
  return env[GRANULAR_SHADOW_FLAG] === 'true';
}

export type ShadowOutcome =
  | 'MATCH'
  /** Legado libera, granular negaria — risco de regressão ao ligar enforcement. */
  | 'WOULD_DENY'
  /** Legado nega, granular liberaria — risco de abertura indevida. */
  | 'WOULD_ALLOW'
  /** Motor granular falhou (tratado como divergência para investigação). */
  | 'ENGINE_ERROR';

/**
 * Gravidade operacional da divergência.
 * CRITICAL → WOULD_ALLOW (abertura indevida; alerta imediato, nunca tolerado).
 * HIGH     → WOULD_DENY ou ENGINE_ERROR (regressão para o usuário; com
 *            enforcement, erro do motor também nega por falha segura).
 * NONE     → MATCH.
 */
export type ShadowSeverity = 'CRITICAL' | 'HIGH' | 'NONE';

export function severityOf(outcome: ShadowOutcome): ShadowSeverity {
  switch (outcome) {
    case 'WOULD_ALLOW':
      return 'CRITICAL';
    case 'WOULD_DENY':
    case 'ENGINE_ERROR':
      return 'HIGH';
    default:
      return 'NONE';
  }
}

export interface ShadowRecord {
  kind: 'GRANULAR_SHADOW_V1';
  at: string;
  outcome: ShadowOutcome;
  severity: ShadowSeverity;
  engineVersion: string;
  catalogVersion: string;
  tenantId: string | null;
  userId: string | null;
  role: string | null;
  nodeId: string | null;
  action: string | null;
  legacyAllowed: boolean;
  granularAllowed: boolean | null;
  granularReason: AccessReasonCode | null;
  granularDecidedBy: AccessDecision['decidedBy'];
  /** Preenchido pelo sink deduplicador: ocorrências suprimidas desde a última emissão. */
  suppressedSinceLast?: number;
}

export type ShadowSink = (record: ShadowRecord) => void;

/** Sink padrão: uma linha JSON por divergência (telemetria estruturada). */
export const consoleShadowSink: ShadowSink = (record) => {
  console.warn(`[GRANULAR_SHADOW] ${JSON.stringify(record)}`);
};

export interface ShadowInput {
  request: AccessRequest;
  legacyAllowed: boolean;
  snapshot: GranularSnapshot | null | undefined;
}

export interface ShadowOptions {
  env?: Record<string, string | undefined>;
  sink?: ShadowSink;
  /** Registrar também os MATCH (útil em relatório local). Padrão: só divergências. */
  recordMatches?: boolean;
  now?: () => Date;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Comparação pura, sem efeitos colaterais. */
export function compareShadow(input: ShadowInput, now: Date = new Date()): ShadowRecord {
  const legacyAllowed = input?.legacyAllowed === true;
  const req = input?.request;
  let granular: AccessDecision | null = null;
  try {
    granular = resolveGranularAccess(req, input?.snapshot ?? null);
  } catch {
    granular = null;
  }

  let outcome: ShadowOutcome;
  if (!granular || granular.reason === 'RESOLVER_ERROR') outcome = 'ENGINE_ERROR';
  else if (granular.allowed === legacyAllowed) outcome = 'MATCH';
  else outcome = legacyAllowed ? 'WOULD_DENY' : 'WOULD_ALLOW';

  return {
    kind: 'GRANULAR_SHADOW_V1',
    at: now.toISOString(),
    outcome,
    severity: severityOf(outcome),
    engineVersion: GRANULAR_ENGINE_VERSION,
    catalogVersion: GRANULAR_CATALOG_VERSION,
    tenantId: str(req?.subject?.tenantId),
    userId: str(req?.subject?.userId),
    role: str(req?.subject?.role),
    nodeId: str(req?.nodeId),
    action: str(req?.action),
    legacyAllowed,
    granularAllowed: granular ? granular.allowed : null,
    granularReason: granular ? granular.reason : null,
    granularDecidedBy: granular ? granular.decidedBy : null,
  };
}

/**
 * Ponto de observação. Retorna SEMPRE `legacyAllowed`, inalterado.
 */
export function observeGranularShadow(input: ShadowInput, options: ShadowOptions = {}): boolean {
  const legacyAllowed = input?.legacyAllowed === true;
  try {
    if (!isGranularShadowEnabled(options.env)) return legacyAllowed;
    const record = compareShadow(input, (options.now ?? (() => new Date()))());
    if (record.outcome !== 'MATCH' || options.recordMatches) {
      try {
        (options.sink ?? consoleShadowSink)(record);
      } catch {
        /* sink nunca afeta a decisão */
      }
    }
  } catch {
    /* shadow nunca afeta a decisão */
  }
  return legacyAllowed;
}

export interface ShadowReport {
  total: number;
  match: number;
  wouldDeny: number;
  wouldAllow: number;
  engineError: number;
  divergences: ShadowRecord[];
}

/** Agrega registros em relatório de divergências (uso local/homologação). */
export function summarizeShadow(records: readonly ShadowRecord[]): ShadowReport {
  const r: ShadowReport = { total: 0, match: 0, wouldDeny: 0, wouldAllow: 0, engineError: 0, divergences: [] };
  for (const rec of records) {
    r.total++;
    if (rec.outcome === 'MATCH') r.match++;
    else {
      if (rec.outcome === 'WOULD_DENY') r.wouldDeny++;
      else if (rec.outcome === 'WOULD_ALLOW') r.wouldAllow++;
      else r.engineError++;
      r.divergences.push(rec);
    }
  }
  return r;
}

// ─── Deduplicação e agregação ─────────────────────────────────────────────────────────

/**
 * Chave lógica de uma divergência. Exclui `userId` e `at`: a mesma divergência
 * para N usuários do mesmo papel é UMA linha (minimização e volume).
 */
export function shadowDedupKey(r: ShadowRecord): string {
  return [
    r.tenantId ?? '-',
    r.role ?? '-',
    r.nodeId ?? '-',
    r.action ?? '-',
    r.outcome,
    r.legacyAllowed ? 'L1' : 'L0',
    r.granularReason ?? '-',
    r.engineVersion,
    r.catalogVersion,
  ].join('|');
}

export interface DedupSinkOptions {
  /** Janela de supressão por chave. Padrão: 15 minutos. */
  windowMs?: number;
  /** Limite de chaves em memória (descarta a mais antiga). Padrão: 1000. */
  maxKeys?: number;
  now?: () => number;
}

/**
 * Envolve um sink: emite a primeira ocorrência de cada chave por janela e
 * informa, na emissão seguinte, quantas foram suprimidas (`suppressedSinceLast`).
 * CRITICAL (WOULD_ALLOW) NUNCA é suprimido. Memória limitada a `maxKeys`;
 * ao descartar uma chave, sua contagem pendente é perdida (aceitável para telemetria).
 */
export function createDedupShadowSink(inner: ShadowSink, options: DedupSinkOptions = {}): ShadowSink {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxKeys = Math.max(1, options.maxKeys ?? 1000);
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, { lastEmitAt: number; suppressed: number }>();

  return (record) => {
    if (record.severity === 'CRITICAL') {
      inner(record);
      return;
    }
    const key = shadowDedupKey(record);
    const t = now();
    const entry = entries.get(key);
    if (entry && t - entry.lastEmitAt < windowMs) {
      entry.suppressed++;
      return;
    }
    const suppressed = entry?.suppressed ?? 0;
    entries.delete(key); // reinserção mantém a ordem de uso (mais recente no fim)
    entries.set(key, { lastEmitAt: t, suppressed: 0 });
    while (entries.size > maxKeys) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    inner(suppressed > 0 ? { ...record, suppressedSinceLast: suppressed } : record);
  };
}

/** Linha agregada — formato proposto para a futura tabela de divergências. */
export interface ShadowAggregateRow {
  key: string;
  tenantId: string | null;
  role: string | null;
  nodeId: string | null;
  action: string | null;
  outcome: ShadowOutcome;
  severity: ShadowSeverity;
  legacyAllowed: boolean;
  granularReason: AccessReasonCode | null;
  engineVersion: string;
  catalogVersion: string;
  count: number;
  /** Quantidade de usuários distintos (os IDs não são guardados na linha). */
  distinctUsers: number;
  firstSeen: string;
  lastSeen: string;
}

const SEVERITY_RANK: Record<ShadowSeverity, number> = { CRITICAL: 0, HIGH: 1, NONE: 2 };

/** Agrega registros por chave lógica; ordena por gravidade e volume. */
export function aggregateShadow(records: readonly ShadowRecord[]): ShadowAggregateRow[] {
  const rows = new Map<string, ShadowAggregateRow & { users: Set<string> }>();
  for (const r of records) {
    const key = shadowDedupKey(r);
    const n = 1 + (r.suppressedSinceLast ?? 0);
    const row = rows.get(key);
    if (!row) {
      rows.set(key, {
        key,
        tenantId: r.tenantId,
        role: r.role,
        nodeId: r.nodeId,
        action: r.action,
        outcome: r.outcome,
        severity: r.severity,
        legacyAllowed: r.legacyAllowed,
        granularReason: r.granularReason,
        engineVersion: r.engineVersion,
        catalogVersion: r.catalogVersion,
        count: n,
        distinctUsers: 0,
        firstSeen: r.at,
        lastSeen: r.at,
        users: new Set(r.userId ? [r.userId] : []),
      });
      continue;
    }
    row.count += n;
    if (r.userId) row.users.add(r.userId);
    if (r.at < row.firstSeen) row.firstSeen = r.at;
    if (r.at > row.lastSeen) row.lastSeen = r.at;
  }
  return [...rows.values()]
    .map(({ users, ...row }) => ({ ...row, distinctUsers: users.size }))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count || a.key.localeCompare(b.key));
}
