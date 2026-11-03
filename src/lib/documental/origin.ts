/**
 * Validação segura de mesma origem (CSRF) compatível com Safari, Chrome, Firefox, Edge
 * e proxies reversos / domínios customizados (Vercel x-forwarded-host / host).
 */
export function isSameOriginRequest(req: Request): boolean {
  const rawOrigin = req.headers.get('origin')?.trim();
  if (!rawOrigin || rawOrigin === 'null') return false;

  let originNormalized: string;
  try {
    originNormalized = new URL(rawOrigin).origin.toLowerCase();
  } catch {
    return false;
  }

  const allowed = new Set<string>();

  try {
    allowed.add(new URL(req.url).origin.toLowerCase());
  } catch {
    // ignora URL malformada
  }

  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    ?.toLowerCase();
  const protocols = new Set<string>(['https']);
  if (forwardedProto === 'http' || forwardedProto === 'https') {
    protocols.add(forwardedProto);
  }
  try {
    const reqProto = new URL(req.url).protocol.replace(/:$/, '').toLowerCase();
    if (reqProto === 'http' || reqProto === 'https') protocols.add(reqProto);
  } catch {}

  const hostCandidates = [
    req.headers.get('x-forwarded-host'),
    req.headers.get('host'),
  ];

  for (const rawHost of hostCandidates) {
    if (!rawHost) continue;
    for (const part of rawHost.split(',')) {
      const cleanHost = part.trim().toLowerCase();
      if (!cleanHost || /[\\/\s@]/.test(cleanHost)) continue;
      for (const proto of protocols) {
        allowed.add(`${proto}://${cleanHost}`);
      }
    }
  }

  for (const envUrl of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!envUrl) continue;
    try {
      allowed.add(new URL(envUrl).origin.toLowerCase());
    } catch {}
  }

  return allowed.has(originNormalized);
}

