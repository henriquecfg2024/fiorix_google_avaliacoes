import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeOutboundUrlError';
  }
}

export interface SsrfGuardOptions {
  allowHttpInDev?: boolean;
  resolveDns?: boolean;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    acc = ((acc << 8) | n) >>> 0;
  }
  return acc;
}

function inCidrV4(ipUint: number, baseIp: string, prefixBits: number): boolean {
  const baseUint = ipv4ToUint32(baseIp);
  if (baseUint === null) return false;
  const mask = prefixBits === 0 ? 0 : (~0 << (32 - prefixBits)) >>> 0;
  return (ipUint & mask) >>> 0 === (baseUint & mask) >>> 0;
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  const ipUint = ipv4ToUint32(ip);
  if (ipUint === null) return true;

  return (
    inCidrV4(ipUint, '0.0.0.0', 8) || // Current network / unspecified
    inCidrV4(ipUint, '10.0.0.0', 8) || // RFC1918 private
    inCidrV4(ipUint, '100.64.0.0', 10) || // Carrier-grade NAT
    inCidrV4(ipUint, '127.0.0.0', 8) || // Loopback
    inCidrV4(ipUint, '169.254.0.0', 16) || // Link-local & Cloud Metadata (169.254.169.254)
    inCidrV4(ipUint, '172.16.0.0', 12) || // RFC1918 private
    inCidrV4(ipUint, '192.0.0.0', 24) || // IETF protocol assignments
    inCidrV4(ipUint, '192.0.2.0', 24) || // TEST-NET-1
    inCidrV4(ipUint, '192.168.0.0', 16) || // RFC1918 private
    inCidrV4(ipUint, '198.18.0.0', 15) || // Benchmarking
    inCidrV4(ipUint, '198.51.100.0', 24) || // TEST-NET-2
    inCidrV4(ipUint, '203.0.113.0', 24) || // TEST-NET-3
    inCidrV4(ipUint, '224.0.0.0', 4) || // Multicast
    inCidrV4(ipUint, '240.0.0.0', 4) // Reserved / Broadcast
  );
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (!ip) return true;

  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  if (version !== 6) {
    return true;
  }

  if (ip === '::' || ip === '::1' || ip === '0:0:0:0:0:0:0:0' || ip === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // IPv4-mapped IPv6 em notação pontilhada (ex.: ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    const tail = ip.slice('::ffff:'.length);
    if (net.isIP(tail) === 4) {
      return isPrivateOrReservedIpv4(tail);
    }
    // Notação hexadecimal canonizada pelo parser WHATWG URL (ex.: ::ffff:7f00:1 ou ::ffff:a9fe:a9fe)
    const hexParts = tail.split(':');
    if (hexParts.length === 2 && hexParts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIpv4(v4);
    }
    return true;
  }

  // Unique Local (fc00::/7), Link-Local (fe80::/10), Multicast (ff00::/8), Documentation (2001:db8::/32)
  if (
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe8') ||
    ip.startsWith('fe9') ||
    ip.startsWith('fea') ||
    ip.startsWith('feb') ||
    ip.startsWith('ff') ||
    ip.startsWith('2001:db8:') ||
    ip.startsWith('2001:0db8:')
  ) {
    return true;
  }

  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

/**
 * Valida uma URL externa antes de realizar requisição HTTP/HTTPS a partir do servidor (anti-SSRF).
 * - Exige `https:` (permitindo `http:` apenas em `NODE_ENV === 'development'` quando `allowHttpInDev !== false`)
 * - Rejeita credenciais embutidas (`user:pass@host`)
 * - Rejeita `localhost`, domínios `.local`/`.internal` e faixas IP privadas/loopback/link-local/metadata
 * - Resolve DNS para impedir DNS rebinding apontando para IPs internos
 */
export async function assertSafeOutboundUrl(
  rawUrl: string,
  options?: SsrfGuardOptions
): Promise<URL> {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new UnsafeOutboundUrlError('URL de destino não informada.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnsafeOutboundUrlError('URL de destino inválida.');
  }

  const allowHttp =
    (options?.allowHttpInDev ?? true) && process.env.NODE_ENV === 'development';
  const validProtocols = allowHttp ? ['https:', 'http:'] : ['https:'];
  if (!validProtocols.includes(parsed.protocol)) {
    throw new UnsafeOutboundUrlError(
      'Protocolo bloqueado por segurança: apenas endpoints externos HTTPS são permitidos.'
    );
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeOutboundUrlError(
      'URL bloqueada por segurança: credenciais embutidas na URL não são permitidas.'
    );
  }

  const rawHostname = parsed.hostname.trim().toLowerCase();
  const cleanHost = rawHostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (
    !cleanHost ||
    BLOCKED_HOSTNAMES.has(cleanHost) ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.lan')
  ) {
    throw new UnsafeOutboundUrlError(
      'Destino bloqueado por política anti-SSRF: host local ou interno não é permitido.'
    );
  }

  if (net.isIP(cleanHost) !== 0) {
    if (isPrivateOrReservedIp(cleanHost)) {
      throw new UnsafeOutboundUrlError(
        'Destino bloqueado por política anti-SSRF: endereços IP privados, loopback ou metadata não são permitidos.'
      );
    }
    return parsed;
  }

  const isUnitTest = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const shouldResolveDns =
    options?.resolveDns ?? (!isUnitTest || Boolean(options?.lookupFn));

  if (shouldResolveDns) {
    const lookup = options?.lookupFn || ((host: string) => dns.lookup(host, { all: true }));
    let records: Array<{ address: string; family: number }>;
    try {
      records = await lookup(cleanHost);
    } catch {
      throw new UnsafeOutboundUrlError(
        `Não foi possível resolver o domínio de destino (${cleanHost}).`
      );
    }

    if (!records || records.length === 0) {
      throw new UnsafeOutboundUrlError(
        `Domínio de destino (${cleanHost}) não retornou endereços IP válidos.`
      );
    }

    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new UnsafeOutboundUrlError(
          'Destino bloqueado por política anti-SSRF: o domínio resolve para um endereço IP interno ou reservado.'
        );
      }
    }
  }

  return parsed;
}

