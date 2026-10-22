import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// AMOSTRAS REAIS DE SAÚDE (TEMPO DE RESPOSTA E DISPONIBILIDADE)
// Cada verificação da Central de Operações e cada sinal do conector grava uma
// amostra com o tempo de ida e volta ao banco de dados e se houve resposta.
// Os cards calculam p95 e disponibilidade a partir dessas amostras.
// ─────────────────────────────────────────────────────────────────────────────

export type HealthSampleSource = 'central' | 'heartbeat';

export interface HealthSample {
  tenantId: string;
  source: HealthSampleSource;
  latencyMs: number | null;
  success: boolean;
  checkedAt?: Date;
  /** Motivo resumido e seguro da falha (sem detalhes de infraestrutura) */
  detail?: string | null;
}

export interface HealthFailure {
  id: string;
  source: HealthSampleSource;
  checkedAt: string;
  detail: string;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface HealthMeasurement {
  windowHours: number;
  totalChecks: number;
  successfulChecks: number;
  p95LatencyMs: number | null;
  availabilityPercent: number | null;
  since: string | null;
}

export const HEALTH_WINDOW_HOURS = 24;
const RETENTION_DAYS = 7;
const MAX_PENDING_SAMPLES = 500;

// Amostras que não puderam ser gravadas (ex.: banco fora do ar) aguardam o próximo envio bem-sucedido
const pendingSamples: Array<Required<HealthSample>> = [];

const DETALHE_PADRAO: Record<HealthSampleSource, string> = {
  central: 'Banco de dados sem resposta durante a verificação da Central',
  heartbeat: 'Falha ao registrar o sinal (heartbeat) do conector',
};

let tableReady: Promise<boolean> | null = null;

function ensureHealthSamplesTable(): Promise<boolean> {
  if (!tableReady) {
    tableReady = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS public.fiorix_operations_health_samples (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            source TEXT NOT NULL,
            latency_ms INT,
            success BOOLEAN NOT NULL,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE public.fiorix_operations_health_samples ADD COLUMN IF NOT EXISTS detail TEXT;
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_health_samples_tenant_checked
            ON public.fiorix_operations_health_samples (tenant_id, checked_at DESC);
        `);
        return true;
      } catch {
        // Não registra o erro bruto (pode conter detalhes de infraestrutura)
        console.warn('[Health Samples] Tabela de amostras indisponível no momento.');
        tableReady = null;
        return false;
      }
    })();
  }
  return tableReady;
}

function bufferSamples(samples: Array<Required<HealthSample>>) {
  pendingSamples.push(...samples);
  if (pendingSamples.length > MAX_PENDING_SAMPLES) {
    pendingSamples.splice(0, pendingSamples.length - MAX_PENDING_SAMPLES);
  }
}

/** Guarda a amostra apenas em memória (usado quando o banco está inacessível). */
export function bufferHealthSample(sample: HealthSample) {
  bufferSamples([{
    ...sample,
    checkedAt: sample.checkedAt ?? new Date(),
    detail: sample.success ? null : (sample.detail ?? DETALHE_PADRAO[sample.source]),
  }]);
}

/** Grava a amostra (e as pendentes, com seus horários originais). Nunca lança erro. */
export async function recordHealthSample(sample: HealthSample): Promise<void> {
  const item: Required<HealthSample> = {
    ...sample,
    checkedAt: sample.checkedAt ?? new Date(),
    detail: sample.success ? null : (sample.detail ?? DETALHE_PADRAO[sample.source]),
  };

  if (!(await ensureHealthSamplesTable())) {
    bufferSamples([item]);
    return;
  }

  const lote = [...pendingSamples.splice(0, pendingSamples.length), item];
  let gravadas = 0;
  try {
    for (const s of lote) {
      const latencia = s.latencyMs === null ? null : Math.round(s.latencyMs);
      await prisma.$executeRaw`
        INSERT INTO public.fiorix_operations_health_samples (tenant_id, source, latency_ms, success, checked_at, detail)
        VALUES (${s.tenantId}, ${s.source}, ${latencia}::int, ${s.success}, ${s.checkedAt}, ${s.detail})
      `;
      gravadas++;
    }

    // Limpeza ocasional das amostras antigas
    if (Math.random() < 0.02) {
      const limite = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.$executeRaw`
        DELETE FROM public.fiorix_operations_health_samples WHERE checked_at < ${limite}
      `.catch(() => 0);
    }
  } catch {
    bufferSamples(lote.slice(gravadas));
    console.warn('[Health Samples] Falha ao gravar amostras; mantidas em memória para nova tentativa.');
  }
}

/**
 * Falhas das últimas 24 h, da mais recente para a mais antiga. Uma falha é
 * considerada solucionada quando houve uma verificação bem-sucedida da mesma
 * origem depois dela.
 */
export async function getRecentHealthFailures(tenantId: string, limit = 20): Promise<HealthFailure[]> {
  if (!(await ensureHealthSamplesTable())) return [];

  const inicioJanela = new Date(Date.now() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: bigint; source: string; checked_at: Date; detail: string | null; resolved_at: Date | null }>
    >`
      SELECT f.id, f.source, f.checked_at, f.detail,
        (SELECT MIN(s.checked_at)
           FROM public.fiorix_operations_health_samples s
          WHERE s.tenant_id = f.tenant_id AND s.source = f.source
            AND s.success AND s.checked_at > f.checked_at) AS resolved_at
      FROM public.fiorix_operations_health_samples f
      WHERE f.tenant_id = ${tenantId} AND NOT f.success AND f.checked_at >= ${inicioJanela}
      ORDER BY f.checked_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => {
      const source: HealthSampleSource = r.source === 'heartbeat' ? 'heartbeat' : 'central';
      return {
        id: String(r.id),
        source,
        checkedAt: new Date(r.checked_at).toISOString(),
        detail: r.detail || DETALHE_PADRAO[source],
        resolved: r.resolved_at !== null,
        resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      };
    });
  } catch {
    console.warn('[Health Samples] Falha ao listar as falhas recentes.');
    return [];
  }
}

/** p95 e disponibilidade das últimas 24 h, calculados sobre as amostras gravadas. */
export async function getHealthMeasurement(tenantId: string): Promise<HealthMeasurement | null> {
  if (!(await ensureHealthSamplesTable())) return null;

  const inicioJanela = new Date(Date.now() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);
  try {
    const rows = await prisma.$queryRaw<
      Array<{ total: number; ok: number; p95: number | null; since: Date | null }>
    >`
      SELECT
        COUNT(*)::int AS total,
        (COUNT(*) FILTER (WHERE success))::int AS ok,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
          FILTER (WHERE success AND latency_ms IS NOT NULL) AS p95,
        MIN(checked_at) AS since
      FROM public.fiorix_operations_health_samples
      WHERE tenant_id = ${tenantId} AND checked_at >= ${inicioJanela}
    `;

    const row = rows[0];
    const total = Number(row?.total ?? 0);
    const ok = Number(row?.ok ?? 0);
    const p95 = row?.p95 === null || row?.p95 === undefined ? null : Number(row.p95);

    return {
      windowHours: HEALTH_WINDOW_HOURS,
      totalChecks: total,
      successfulChecks: ok,
      p95LatencyMs: p95 !== null && Number.isFinite(p95) ? Math.round(p95) : null,
      // Arredonda para baixo: qualquer falha impede exibir 100%
      availabilityPercent: total > 0 ? Math.floor((ok / total) * 1000) / 10 : null,
      since: row?.since ? new Date(row.since).toISOString() : null,
    };
  } catch {
    console.warn('[Health Samples] Falha ao calcular as métricas medidas.');
    return null;
  }
}
