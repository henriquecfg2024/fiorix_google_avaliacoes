export const AGENDA_FEATURE_FLAG = 'FEATURE_AGENDA_INTELIGENTE_V1_ENABLED';
export const LOGIN_WELCOME_FEATURE_FLAG = 'FEATURE_LOGIN_WELCOME_V1_ENABLED';
export const AGENDA_SANDBOX_FLAG = 'FIORIX_AGENDA_SANDBOX_MODE';

export function isAgendaEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const explicit = env[AGENDA_FEATURE_FLAG];
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function isLoginWelcomeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const explicit = env[LOGIN_WELCOME_FEATURE_FLAG];
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function isAgendaSandboxMode(
  env: Record<string, string | undefined> = process.env
): boolean {
  const explicit = env[AGENDA_SANDBOX_FLAG];
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return env.NODE_ENV !== 'production';
}
