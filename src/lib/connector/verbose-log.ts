/**
 * Controla logs informativos de alta frequência nas rotas do conector (`MED-11`),
 * silenciando-os por padrão em produção e permitindo habilitação pontual via `FIORIX_VERBOSE_LOGS=true`.
 */
export function isConnectorVerboseLogEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FIORIX_VERBOSE_LOGS === 'true';
}

