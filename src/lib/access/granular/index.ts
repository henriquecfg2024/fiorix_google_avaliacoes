/**
 * FIORIX — Fase 6.0 | Contrato do motor granular (ponto de entrada).
 * NÃO importar em src/app ou src/components nesta fase.
 */
export * from './types';
export {
  GRANULAR_ENGINE_MODE,
  resolveGranularAccess,
  canConfigureAvailability,
  decideAccess,
  isGranularAction,
  type LegacyDecisionInput,
} from './engine';
export {
  buildGranularSnapshot,
  type RawDeploymentRecord,
  type BuildSnapshotInput,
} from './snapshot-builder';
export {
  GRANULAR_SHADOW_FLAG,
  GRANULAR_ENGINE_VERSION,
  GRANULAR_CATALOG_VERSION,
  computeCatalogVersion,
  isGranularShadowEnabled,
  severityOf,
  compareShadow,
  observeGranularShadow,
  summarizeShadow,
  consoleShadowSink,
  shadowDedupKey,
  createDedupShadowSink,
  aggregateShadow,
  type ShadowOutcome,
  type ShadowSeverity,
  type ShadowRecord,
  type ShadowSink,
  type ShadowInput,
  type ShadowOptions,
  type ShadowReport,
  type DedupSinkOptions,
  type ShadowAggregateRow,
} from './shadow';
