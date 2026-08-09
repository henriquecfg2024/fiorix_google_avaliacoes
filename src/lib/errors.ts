const NEXT_CONTROL_FLOW_DIGESTS = ['NEXT_REDIRECT', 'NEXT_NOT_FOUND'];

/**
 * Next.js implements `redirect()` and `notFound()` by throwing. Catch blocks
 * must rethrow these so navigation is not turned into an error message.
 */
export function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null | undefined)?.digest;
  return typeof digest === 'string' && NEXT_CONTROL_FLOW_DIGESTS.some((prefix) => digest.startsWith(prefix));
}

export function getErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error.trim() || fallback;

  const message = (error as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

export function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

/**
 * Logs and returns a user-facing message, rethrowing Next.js navigation errors.
 */
export function describeError(context: string, error: unknown, fallback?: string): string {
  if (isNextControlFlowError(error)) throw error;
  logError(context, error);
  return getErrorMessage(error, fallback);
}
