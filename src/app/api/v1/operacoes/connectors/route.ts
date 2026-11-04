import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth-helpers';
import { isSameOriginRequest } from '@/lib/documental/origin';
import { invalidateOperationsHealthCache } from '@/lib/health/operations-service';
import {
  listTenantConnectorNodes,
  getTenantConnectorSettings,
  getLatestReleaseManifest,
  promoteConnector,
  pauseConnector,
  resumeConnector,
  updateConnectorNodeConfig,
  setTenantFailoverSettings,
  createEnrollmentToken,
  triggerConnectorUpdate,
  startRollingUpdate,
  deleteConnectorNode,
} from '@/lib/connector/ha-manager';

export const dynamic = 'force-dynamic';

function resolvePublicOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const proto =
      forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1')
        ? 'http'
        : forwardedProto;
    return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
  }
  return 'https://fiorix.app';
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('promote'),
    connectorId: z.string().trim().min(1).max(128),
  }),
  z.object({
    action: z.literal('pause'),
    connectorId: z.string().trim().min(1).max(128),
    promoteStandbyIfActive: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal('resume'),
    connectorId: z.string().trim().min(1).max(128),
  }),
  z.object({
    action: z.literal('update_config'),
    connectorId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(['PRIMARY', 'SECONDARY']).optional(),
    priority: z.number().int().min(1).max(100).optional(),
    lanUrl: z.string().trim().max(255).nullable().optional(),
    remoteConfig: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('set_failover_mode'),
    failoverMode: z.enum(['MANUAL', 'AUTO']),
    autoFailoverTimeoutSec: z.number().int().min(60).max(3600).optional().default(180),
  }),
  z.object({
    action: z.literal('create_enrollment'),
    connectorName: z.string().trim().min(2).max(100),
    intendedRole: z.enum(['PRIMARY', 'SECONDARY']).optional().default('PRIMARY'),
    initialState: z.enum(['ACTIVE', 'STANDBY']).optional(),
    remoteConfig: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('trigger_update'),
    connectorId: z.string().trim().min(1).max(128),
    safeSwitchFirst: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal('rolling_update'),
  }),
  z.object({
    action: z.literal('delete_node'),
    connectorId: z.string().trim().min(1).max(128),
  }),
]);

export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const [nodes, settings] = await Promise.all([
      listTenantConnectorNodes(user.tenantId),
      getTenantConnectorSettings(user.tenantId),
    ]);
    const latestRelease = getLatestReleaseManifest();

    return NextResponse.json(
      { ok: true, nodes, settings, latestRelease },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: any) {
    if (
      error.message?.includes('Acesso negado') ||
      error.message?.includes('Não autorizado') ||
      error.message?.includes('Sessão')
    ) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Falha ao consultar servidores Connector.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
    }

    const user = await requireRole('MASTER', 'ADMIN');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.action === 'promote') {
      const nodes = await promoteConnector(user.tenantId, data.connectorId, user);
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, nodes });
    }

    if (data.action === 'pause') {
      const result = await pauseConnector(
        user.tenantId,
        data.connectorId,
        data.promoteStandbyIfActive,
        user,
      );
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (data.action === 'resume') {
      const result = await resumeConnector(user.tenantId, data.connectorId, user);
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (data.action === 'update_config') {
      const nodes = await updateConnectorNodeConfig(
        user.tenantId,
        data.connectorId,
        {
          name: data.name,
          role: data.role,
          priority: data.priority,
          lanUrl: data.lanUrl,
          remoteConfig: data.remoteConfig,
        },
        user,
      );
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, nodes });
    }

    if (data.action === 'set_failover_mode') {
      const settings = await setTenantFailoverSettings(
        user.tenantId,
        data.failoverMode,
        data.autoFailoverTimeoutSec,
        user,
      );
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, settings });
    }

    if (data.action === 'create_enrollment') {
      const tokenData = await createEnrollmentToken(
        user.tenantId,
        {
          connectorName: data.connectorName,
          intendedRole: data.intendedRole,
          initialState: data.initialState,
          remoteConfig: data.remoteConfig,
        },
        user,
      );
      const origin = resolvePublicOrigin(req);
      const installPs1Command = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm ${origin}/api/v1/connector/install.ps1 | iex; Install-FiorixConnector -Token "${tokenData.rawToken}"`;
      const downloadBatUrl = `${origin}/api/v1/connector/install.ps1?format=bat&token=${encodeURIComponent(tokenData.rawToken)}`;

      return NextResponse.json({
        ok: true,
        ...tokenData,
        installPs1Command,
        downloadBatUrl,
      });
    }

    if (data.action === 'trigger_update') {
      const result = await triggerConnectorUpdate(
        user.tenantId,
        data.connectorId,
        data.safeSwitchFirst,
        user,
      );
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (data.action === 'rolling_update') {
      const result = await startRollingUpdate(user.tenantId, user);
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (data.action === 'delete_node') {
      const result = await deleteConnectorNode(user.tenantId, data.connectorId, user);
      invalidateOperationsHealthCache(user.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
  } catch (error: any) {
    if (
      error.message?.includes('Acesso negado') ||
      error.message?.includes('Não autorizado') ||
      error.message?.includes('Sessão')
    ) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || 'Erro ao executar operação no servidor Connector.' },
      { status: 400 },
    );
  }
}

