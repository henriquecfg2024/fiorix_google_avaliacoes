import { NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeEnrollmentToken } from '@/lib/connector/ha-manager';
import { invalidateOperationsHealthCache } from '@/lib/health/operations-service';

export const dynamic = 'force-dynamic';

const RATE_WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS_PER_IP = 15;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkEnrollRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS_PER_IP) {
    return false;
  }
  entry.count++;
  return true;
}

const enrollSchema = z.object({
  token: z.string().trim().min(20).max(200),
  hostname: z.string().trim().max(128).optional().nullable(),
  osVersion: z.string().trim().max(128).optional().nullable(),
  installedPath: z.string().trim().max(260).optional().nullable(),
  lanUrl: z.string().trim().max(255).optional().nullable(),
  version: z.string().trim().max(64).optional().nullable(),
});

function resolvePublicBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const proto = forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1') ? 'http' : forwardedProto;
    return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
  }
  return 'https://fiorix.app';
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (!checkEnrollRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Muitas tentativas de pareamento. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Payload JSON inválido.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados de pareamento inválidos.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const enrolled = await consumeEnrollmentToken(parsed.data.token, {
      hostname: parsed.data.hostname ?? null,
      osVersion: parsed.data.osVersion ?? null,
      installedPath: parsed.data.installedPath ?? null,
      lanUrl: parsed.data.lanUrl ?? null,
      version: parsed.data.version ?? 'v2.6.0',
    });

    invalidateOperationsHealthCache(enrolled.tenantId);

    const origin = resolvePublicBaseUrl(req);

    return NextResponse.json(
      {
        ok: true,
        ...enrolled,
        syncUrl: `${origin}/api/v1/connector/sync`,
        statusUrl: `${origin}/api/v1/connector/status`,
        documentalUrl: `${origin}/api/v1/connector/documentos`,
        releaseUrl: `${origin}/api/v1/connector/release`,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err: any) {
    const code = String(err?.message || '');
    if (code === 'INVALID_OR_EXPIRED_TOKEN') {
      return NextResponse.json(
        {
          error:
            'Token de pareamento inválido, expirado ou já utilizado. Gere um novo token em Central de Operações.',
        },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    console.error('[CONNECTOR_ENROLL_ERROR]', code);
    return NextResponse.json(
      { error: 'Falha interna ao concluir pareamento do servidor Connector.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

