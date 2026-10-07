/**
 * FIORIX — Fase 6.0 | Modo Mínimo Seguro
 *
 * Decisão MASTER nº 4: Login e Início permanecem sempre disponíveis em modo
 * mínimo seguro. Este é o ÚNICO conjunto de módulos que o novo motor (e o
 * caminho de planos com feature flag ligada) concede quando há falha,
 * ausência de regra, tenant não encontrado ou plano desconhecido.
 *
 * - Login (`/login`) é rota pública de autenticação e não pertence ao catálogo
 *   de módulos; por isso não aparece aqui.
 * - Início corresponde ao módulo canônico `core.dashboard`.
 *
 * Este arquivo não altera nenhum comportamento legado: ele só é consultado por
 * caminhos protegidos por feature flag (desligadas) ou pelo contrato do motor
 * granular futuro (não integrado a rotas).
 */

export const MINIMAL_SAFE_MODULE_IDS: readonly string[] = Object.freeze(['core.dashboard']);

/** Ações permitidas no modo mínimo seguro (somente leitura). */
export const MINIMAL_SAFE_ACTIONS: readonly string[] = Object.freeze(['view']);

export function isMinimalSafeModule(moduleId: string | null | undefined): boolean {
  return typeof moduleId === 'string' && MINIMAL_SAFE_MODULE_IDS.includes(moduleId);
}

export function isMinimalSafeAction(action: string | null | undefined): boolean {
  return typeof action === 'string' && MINIMAL_SAFE_ACTIONS.includes(action);
}

/** Retorna uma cópia mutável do conjunto mínimo (evita mutação do congelado). */
export function getMinimalSafeModules(): string[] {
  return [...MINIMAL_SAFE_MODULE_IDS];
}
