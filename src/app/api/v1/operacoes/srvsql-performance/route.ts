import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { buildSiplanIncidentReport } from '@/lib/srvsql-performance/engine';
import {
  buildSrvsqlPerformanceSnapshot,
  ingestCollectorSample,
  recordUserSlownessIncident,
  updateAlertRulesConfig,
  updateWebriAssociationConfig,
} from '@/lib/srvsql-performance/store';
import type { ScenarioPresetId, TimeWindowPreset } from '@/lib/srvsql-performance/types';

export const dynamic = 'force-dynamic';

const VALID_SCENARIOS = new Set<ScenarioPresetId>([
  'LIVE_OR_REAL',
  'LENTIDAO_BLOQUEIO',
  'PRESSAO_LOG_WRITELOG',
  'CONCORRENCIA_BACKUP_DISCO',
  'PRESSAO_MEMORIA_GRANT',
  'FALTA_PERMISSAO_VIEW_SERVER_STATE',
  'COLETOR_INDISPONIVEL',
]);

const VALID_WINDOWS = new Set<TimeWindowPreset>(['15m', '30m', '1h', '6h', '24h']);

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO', 'VISITANTE');
    const tenantId = user.tenantId || 'default-tenant';

    const rawScenario = (req.nextUrl.searchParams.get('scenario') || 'LENTIDAO_BLOQUEIO') as ScenarioPresetId;
    const scenario: ScenarioPresetId = VALID_SCENARIOS.has(rawScenario) ? rawScenario : 'LENTIDAO_BLOQUEIO';

    const rawWindow = (req.nextUrl.searchParams.get('window') || '30m') as TimeWindowPreset;
    const windowPreset: TimeWindowPreset = VALID_WINDOWS.has(rawWindow) ? rawWindow : '30m';

    const snapshot = buildSrvsqlPerformanceSnapshot(tenantId, scenario, windowPreset);

    if (req.nextUrl.searchParams.get('export') === 'siplan') {
      const dossier = buildSiplanIncidentReport(snapshot);
      return NextResponse.json(dossier, {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      });
    }

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('Acesso negado') || msg.includes('Não autorizado') || msg.includes('Sessão')) {
      return NextResponse.json({ error: 'Acesso não autorizado ao módulo Performance do SRVSQL.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Falha ao consultar o estado de monitoramento do SRVSQL.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
    const tenantId = user.tenantId || 'default-tenant';
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'record_slowness') {
      const affectedOperation = String(body?.affectedOperation || '').trim();
      const observation = String(body?.observation || '').trim();
      const perceivedDurationSeconds = Number(body?.perceivedDurationSeconds || 0);

      if (!affectedOperation || affectedOperation.length < 3) {
        return NextResponse.json(
          { error: 'Informe a operação do WEBRI afetada pela lentidão.' },
          { status: 400 },
        );
      }

      if (!Number.isFinite(perceivedDurationSeconds) || perceivedDurationSeconds <= 0) {
        return NextResponse.json(
          { error: 'Informe uma duração percebida válida (em segundos).' },
          { status: 400 },
        );
      }

      const incident = await recordUserSlownessIncident(tenantId, {
        occurredAt: typeof body?.occurredAt === 'string' ? body.occurredAt : undefined,
        reportedBy: user.name || user.email || 'Usuário FIORIX',
        affectedOperation,
        perceivedDurationSeconds,
        observation: observation || 'Sem observações adicionais.',
        activeScenario: VALID_SCENARIOS.has(body?.activeScenario) ? body.activeScenario : 'LENTIDAO_BLOQUEIO',
      });

      return NextResponse.json({ ok: true, incident });
    }

    if (action === 'update_webri_config') {
      if (user.role !== 'MASTER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Apenas perfis MASTER ou ADMIN podem alterar o vínculo de serviços do WEBRI.' },
          { status: 403 },
        );
      }
      const config = updateWebriAssociationConfig(
        tenantId,
        {
          databases: Array.isArray(body?.databases) ? body.databases.map(String) : undefined,
          logins: Array.isArray(body?.logins) ? body.logins.map(String) : undefined,
          applicationNames: Array.isArray(body?.applicationNames) ? body.applicationNames.map(String) : undefined,
          hosts: Array.isArray(body?.hosts) ? body.hosts.map(String) : undefined,
          windowsServices: Array.isArray(body?.windowsServices) ? body.windowsServices.map(String) : undefined,
          confirmedJavaProcessNames: Array.isArray(body?.confirmedJavaProcessNames)
            ? body.confirmedJavaProcessNames.map(String)
            : undefined,
          mysqlUsedByWebri: typeof body?.mysqlUsedByWebri === 'boolean' ? body.mysqlUsedByWebri : undefined,
        },
        user.name || user.email || 'Administrador',
      );
      return NextResponse.json({ ok: true, webriConfig: config });
    }

    if (action === 'update_alert_rules') {
      if (user.role !== 'MASTER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Apenas perfis MASTER ou ADMIN podem alterar os limites de alerta.' },
          { status: 403 },
        );
      }
      const rules = updateAlertRulesConfig(
        tenantId,
        Array.isArray(body?.rules) ? body.rules : [],
      );
      return NextResponse.json({ ok: true, alertRules: rules });
    }

    if (action === 'ingest_collector_sample' && body?.sample) {
      const result = ingestCollectorSample(tenantId, body.sample);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('Acesso negado') || msg.includes('Não autorizado') || msg.includes('Sessão')) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Falha ao processar ação no monitoramento do SRVSQL.' }, { status: 500 });
  }
}
