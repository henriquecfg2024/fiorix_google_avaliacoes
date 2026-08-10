import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface BiDashboardFilters {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
  enabledCharts?: string[];
  includeSummary?: boolean;
}

const NATUREZA_NORMALIZADA_SQL = Prisma.sql`
  TRANSLATE(
    UPPER(COALESCE(TRIM("Natureza"), '')),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'AAAAAEEEEIIIIOOOOOUUUUC'
  )
`;

const ZERO_DEADLINE_NATURE_CONDITION_SQL = Prisma.sql`
  (
    ${NATUREZA_NORMALIZADA_SQL} = 'INTIMACAO'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'INTIMACAO ONLINE'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'OFICIO - INDISPONIBILIDADE'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO - RETIFICACAO DE AREA'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO - USUCAPIAO EXTRAJUDICIAL'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO-ADJUDICACAO COMPULSORIA'
    OR ${NATUREZA_NORMALIZADA_SQL} = 'REGULARIZACAO FUNDIARIA'
  )
`;

const EXCEPTION_NATURE_CONDITION_SQL = Prisma.sql`
  (
    ${ZERO_DEADLINE_NATURE_CONDITION_SQL}
  )
`;

const GENERAL_NATURE_CONDITION_SQL = Prisma.sql`
  NOT (${EXCEPTION_NATURE_CONDITION_SQL})
`;

const EXCEPTION_NATURE_GROUP_SQL = Prisma.sql`
  CASE
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'INTIMACAO' THEN 'Intimação'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'INTIMACAO ONLINE' THEN 'Intimação Online'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'OFICIO - INDISPONIBILIDADE' THEN 'Ofício - Indisponibilidade'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO - RETIFICACAO DE AREA' THEN 'Petição - Retificação de Área'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO - USUCAPIAO EXTRAJUDICIAL' THEN 'Petição - Usucapião Extrajudicial'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'PETICAO-ADJUDICACAO COMPULSORIA' THEN 'Petição-Adjudicação Compulsória'
    WHEN ${NATUREZA_NORMALIZADA_SQL} = 'REGULARIZACAO FUNDIARIA' THEN 'Regularização fundiária'
    ELSE 'Outras Exceções Legais'
  END
`;

function formatDateKey(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

type DashboardCacheEntry = { expiresAt: number; value: any };
const dashboardCache = new Map<string, DashboardCacheEntry>();
const dashboardInFlight = new Map<string, Promise<any>>();
const DASHBOARD_CACHE_TTL_MS = 30_000;

function dashboardCacheKey(filters?: BiDashboardFilters) {
  return JSON.stringify({
    ...filters,
    enabledCharts: filters?.enabledCharts ? [...filters.enabledCharts].sort() : undefined,
  });
}

export async function queryBiDashboardData(filters?: BiDashboardFilters) {
  const key = dashboardCacheKey(filters);
  const now = Date.now();
  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached) dashboardCache.delete(key);

  const running = dashboardInFlight.get(key);
  if (running) return running;

  const request = (async () => {
    const value = await queryBiDashboardDataUncached(filters);
    dashboardCache.set(key, { value, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
    while (dashboardCache.size > 8) {
      const oldestKey = dashboardCache.keys().next().value;
      if (!oldestKey) break;
      dashboardCache.delete(oldestKey);
    }
    return value;
  })();

  dashboardInFlight.set(key, request);
  try {
    return await request;
  } finally {
    dashboardInFlight.delete(key);
  }
}

async function queryBiDashboardDataUncached(filters?: BiDashboardFilters) {
  const selectedCharts = filters?.enabledCharts?.length ? new Set(filters.enabledCharts) : null;
  const chartEnabled = (id: string) => !selectedCharts || selectedCharts.has(id);
  const includeSummary = filters?.includeSummary !== false;
  let importCondition = Prisma.sql`1=1`;
  if (filters?.importId && filters.importId !== 'ALL') {
    importCondition = Prisma.sql`"import_id" = ${filters.importId}`;
  }

  let tipoCondition = Prisma.sql`1=1`;
  if (filters?.tipoPrenotacao && filters.tipoPrenotacao !== 'ALL') {
    tipoCondition = Prisma.sql`"TipoPrenotacao" = ${filters.tipoPrenotacao}`;
  }

  let dateCondition = Prisma.sql`1=1`;
  if (filters?.startDate || filters?.endDate) {
    if (filters.startDate && filters.endDate) {
      const endD = new Date(filters.endDate);
      endD.setHours(23, 59, 59, 999);
      dateCondition = Prisma.sql`"DtAndamento" >= ${new Date(filters.startDate)} AND "DtAndamento" <= ${endD}`;
    } else if (filters.startDate) {
      dateCondition = Prisma.sql`"DtAndamento" >= ${new Date(filters.startDate)}`;
    } else if (filters.endDate) {
      const endD = new Date(filters.endDate);
      endD.setHours(23, 59, 59, 999);
      dateCondition = Prisma.sql`"DtAndamento" <= ${endD}`;
    }
  }

  const baseCondition = Prisma.sql`${importCondition} AND ${tipoCondition} AND ${dateCondition}`;
  const generalCondition = Prisma.sql`${baseCondition} AND ${GENERAL_NATURE_CONDITION_SQL}`;
  const exceptionCondition = Prisma.sql`${baseCondition} AND ${EXCEPTION_NATURE_CONDITION_SQL}`;

  let aggregateImportCondition = Prisma.sql`1=1`;
  if (filters?.importId && filters.importId !== 'ALL') {
    aggregateImportCondition = Prisma.sql`a.import_id = ${filters.importId}`;
  }

  let aggregateTipoCondition = Prisma.sql`1=1`;
  if (filters?.tipoPrenotacao && filters.tipoPrenotacao !== 'ALL') {
    aggregateTipoCondition = Prisma.sql`a.tipo_prenotacao = ${filters.tipoPrenotacao}`;
  }

  let aggregateDateCondition = Prisma.sql`1=1`;
  if (filters?.startDate || filters?.endDate) {
    if (filters.startDate && filters.endDate) {
      aggregateDateCondition = Prisma.sql`
        a.day >= CAST(${filters.startDate} AS date)
        AND a.day <= CAST(${filters.endDate} AS date)
      `;
    } else if (filters.startDate) {
      aggregateDateCondition = Prisma.sql`a.day >= CAST(${filters.startDate} AS date)`;
    } else if (filters.endDate) {
      aggregateDateCondition = Prisma.sql`a.day <= CAST(${filters.endDate} AS date)`;
    }
  }

  const aggregateBaseCondition = Prisma.sql`
    ${aggregateImportCondition}
    AND ${aggregateTipoCondition}
    AND ${aggregateDateCondition}
  `;
  const aggregateGeneralCondition = Prisma.sql`${aggregateBaseCondition} AND a.is_exception = false`;

  const pieRaw = (includeSummary || chartEnabled('1')) ? await prisma.$queryRaw<Array<{ situacao: string; cnt: bigint }>>`
    WITH totals AS (
      SELECT
        COALESCE(SUM(a.registered_no_prazo), 0)::bigint AS no_prazo,
        COALESCE(SUM(a.registered_atrasado), 0)::bigint AS atrasado,
        COALESCE(SUM(a.registered_devolucao), 0)::bigint AS devolucao
      FROM fiorix_bi_daily_agg a
      WHERE ${aggregateGeneralCondition}
    )
    SELECT 'No Prazo' AS situacao, no_prazo AS cnt FROM totals
    UNION ALL SELECT 'Atrasado', atrasado FROM totals
    UNION ALL SELECT 'Devolução', devolucao FROM totals
  ` : [];

  let noPrazoCount = 0;
  let atrasadoCount = 0;
  let devolucaoCount = 0;

  pieRaw.forEach((row) => {
    const cnt = Number(row.cnt);
    if (row.situacao === 'Devolução') devolucaoCount += cnt;
    else if (row.situacao === 'Atrasado') atrasadoCount += cnt;
    else noPrazoCount += cnt;
  });

  const totalRegistered = noPrazoCount + atrasadoCount + devolucaoCount || 1;
  const pieChartData = [
    { name: 'No Prazo', count: noPrazoCount, percentage: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)), fill: '#10b981' },
    { name: 'Atrasado', count: atrasadoCount, percentage: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)), fill: '#ef4444' },
    { name: 'Devolução', count: devolucaoCount, percentage: Number(((devolucaoCount / totalRegistered) * 100).toFixed(1)), fill: '#f59e0b' },
  ];

  const devolucaoSummaryRaw = includeSummary ? await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COALESCE(SUM(a.devolucao_all), 0)::bigint as cnt
    FROM fiorix_bi_daily_agg a
    WHERE ${aggregateGeneralCondition}
  ` : [];

  const avgNaturezaRaw = chartEnabled('7') ? await prisma.$queryRaw<Array<{ natureza: string; media_dias: number; total: bigint }>>`
    SELECT
      a.natureza,
      ROUND((SUM(a.sum_dias_corridos)::numeric / NULLIF(SUM(a.metric_count), 0)), 1)::float as media_dias,
      SUM(a.metric_count)::bigint as total
    FROM fiorix_bi_daily_agg a
    WHERE ${aggregateGeneralCondition}
    GROUP BY a.natureza
    ORDER BY media_dias DESC
    LIMIT 10
  ` : [];

  const avgDiasPorNatureza = avgNaturezaRaw.map((row) => ({
    natureza: row.natureza,
    mediaDias: Number(row.media_dias || 0),
    totalTitulos: Number(row.total || 0),
  }));

  const delayBucketsRaw = chartEnabled('2') ? await prisma.$queryRaw<Array<{ bucket: string; cnt: bigint }>>`
    WITH totals AS (
      SELECT
        COALESCE(SUM(a.delay_1_3), 0)::bigint AS d1,
        COALESCE(SUM(a.delay_4_7), 0)::bigint AS d2,
        COALESCE(SUM(a.delay_8_15), 0)::bigint AS d3,
        COALESCE(SUM(a.delay_16_plus), 0)::bigint AS d4
      FROM fiorix_bi_daily_agg a
      WHERE ${aggregateGeneralCondition}
    )
    SELECT buckets.bucket, buckets.cnt
    FROM totals
    CROSS JOIN LATERAL (
      VALUES
        ('1-3 dias', totals.d1, 1),
        ('4-7 dias', totals.d2, 2),
        ('8-15 dias', totals.d3, 3),
        ('16+ dias', totals.d4, 4)
    ) AS buckets(bucket, cnt, sort_order)
    WHERE buckets.cnt > 0
    ORDER BY buckets.sort_order
  ` : [];

  const delaySeverity = delayBucketsRaw.map((row) => ({
    bucket: row.bucket,
    count: Number(row.cnt || 0),
  }));

  const prazoVsRealRaw = chartEnabled('3') ? await prisma.$queryRaw<Array<{ natureza: string; prometidos: number; corridos: number; total: bigint }>>`
    SELECT
      a.natureza,
      ROUND((SUM(a.sum_dias_prometidos)::numeric / NULLIF(SUM(a.metric_count), 0)), 1)::float as prometidos,
      ROUND((SUM(a.sum_dias_corridos)::numeric / NULLIF(SUM(a.metric_count), 0)), 1)::float as corridos,
      SUM(a.metric_count)::bigint as total
    FROM fiorix_bi_daily_agg a
    WHERE ${aggregateGeneralCondition}
    GROUP BY a.natureza
    ORDER BY corridos DESC, prometidos DESC
    LIMIT 8
  ` : [];

  const trendRaw = chartEnabled('3') ? await prisma.$queryRaw<Array<{ data: Date | string; no_prazo: bigint; atrasado: bigint; devolucao: bigint }>>`
    SELECT
      a.day as data,
      SUM(a.daily_no_prazo)::bigint as no_prazo,
      SUM(a.daily_atrasado)::bigint as atrasado,
      SUM(a.daily_devolucao)::bigint as devolucao
    FROM fiorix_bi_daily_agg a
    WHERE a.day <> DATE '1900-01-01'
      AND ${aggregateGeneralCondition}
    GROUP BY a.day
    ORDER BY a.day
  ` : [];

  const prazoPrometidoVsCorridosPorNatureza = prazoVsRealRaw.map((row) => ({
    natureza: row.natureza,
    prometidos: Number(row.prometidos || 0),
    corridos: Number(row.corridos || 0),
    totalTitulos: Number(row.total || 0),
  }));

  const evolucaoPrazoPorDia = trendRaw.map((row) => ({
    data: formatDateKey(row.data),
    noPrazo: Number(row.no_prazo || 0),
    atrasado: Number(row.atrasado || 0),
    devolucao: Number(row.devolucao || 0),
  }));

  const totalRecordsRaw = includeSummary ? await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COALESCE(SUM(a.total_records), 0)::bigint as cnt
    FROM fiorix_bi_daily_agg a
    WHERE ${aggregateGeneralCondition}
  ` : [];

  const exceptionRecordsAggregateRaw = includeSummary ? await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COALESCE(SUM(a.total_records), 0)::bigint as cnt
    FROM fiorix_bi_daily_agg a
    WHERE ${aggregateBaseCondition}
      AND a.is_exception = true
  ` : [];

  const exceptionSummaryRaw = (chartEnabled('8') || chartEnabled('9') || chartEnabled('10')) ? await prisma.$queryRaw<Array<{
    total: bigint;
    protocolos: bigint;
    em_acompanhamento: bigint;
    finalizados: bigint;
    media_dias: number | null;
    maior_dias: number | null;
  }>>`
    SELECT
      COUNT(*)::bigint as total,
      COUNT(DISTINCT "Protocolo")::bigint as protocolos,
      SUM(CASE WHEN ("CodProcessamento" = 6 OR "CodProcessamento" = 5 OR "IsRegistrado" = true) THEN 0 ELSE 1 END)::bigint as em_acompanhamento,
      SUM(CASE WHEN ("CodProcessamento" = 6 OR "CodProcessamento" = 5 OR "IsRegistrado" = true) THEN 1 ELSE 0 END)::bigint as finalizados,
      ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as media_dias,
      MAX(COALESCE("DiasCorridos", 0))::int as maior_dias
    FROM fiorix_bi_data
    WHERE ${exceptionCondition}
  ` : [];

  const exceptionByNaturezaRaw = chartEnabled('9') ? await prisma.$queryRaw<Array<{
    natureza: string;
    total: bigint;
    protocolos: bigint;
    media_dias: number | null;
  }>>`
    SELECT
      ${EXCEPTION_NATURE_GROUP_SQL} as natureza,
      COUNT(*)::bigint as total,
      COUNT(DISTINCT "Protocolo")::bigint as protocolos,
      ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as media_dias
    FROM fiorix_bi_data
    WHERE ${exceptionCondition}
    GROUP BY 1
    ORDER BY total DESC, natureza
  ` : [];

  const tiposRaw = includeSummary ? await prisma.$queryRaw<Array<{ tipo: string }>>`
    SELECT DISTINCT a.tipo_prenotacao as tipo
    FROM fiorix_bi_daily_agg a
    WHERE a.tipo_prenotacao != ''
    LIMIT 30
  ` : [];

  const totalRecords = Number(totalRecordsRaw[0]?.cnt || 0);
  const devolucaoGeneralCount = Number(devolucaoSummaryRaw[0]?.cnt || 0);
  const exceptionSummary = exceptionSummaryRaw[0];
  const exceptionRecordsExcluded = Number(exceptionSummary?.total || exceptionRecordsAggregateRaw[0]?.cnt || 0);
  const exceptionProtocolsExcluded = Number(exceptionSummary?.protocolos || 0);
  const exceptionEmAcompanhamento = Number(exceptionSummary?.em_acompanhamento || 0);
  const exceptionFinalizados = Number(exceptionSummary?.finalizados || 0);
  const exceptionAvgDias = Number(exceptionSummary?.media_dias || 0);
  const exceptionMaxDias = Number(exceptionSummary?.maior_dias || 0);

  return {
    summary: {
      totalRecords,
      totalRegistered,
      noPrazoCount,
      atrasadoCount,
      devolucaoCount: devolucaoGeneralCount,
      percentNoPrazo: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)) || 0,
      percentAtrasado: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)) || 0,
      percentDevolucao: Number(((devolucaoGeneralCount / (totalRecords || 1)) * 100).toFixed(1)) || 0,
      exceptionRecordsExcluded,
      exceptionProtocolsExcluded,
    },
    legalExceptions: {
      summary: {
        totalRecords: exceptionRecordsExcluded,
        totalProtocols: exceptionProtocolsExcluded,
        emAcompanhamento: exceptionEmAcompanhamento,
        finalizados: exceptionFinalizados,
        avgDiasCorridos: exceptionAvgDias,
        maxDiasCorridos: exceptionMaxDias,
      },
      charts: {
        statusPieData: [
          { name: 'Em acompanhamento', count: exceptionEmAcompanhamento, fill: '#f59e0b' },
          { name: 'Finalizados', count: exceptionFinalizados, fill: '#2563eb' },
        ],
        porNatureza: exceptionByNaturezaRaw.map((row) => ({
          natureza: row.natureza,
          total: Number(row.total || 0),
          protocolos: Number(row.protocolos || 0),
          mediaDias: Number(row.media_dias || 0),
        })),
      },
    },
    charts: {
      pieChartData,
      delaySeverity,
      evolucaoPrazoPorDia,
    },
    tiposPrenotacao: tiposRaw.map((row) => row.tipo).filter(Boolean).sort(),
  };
}

export async function queryBiImportsList() {
  const cached = dashboardCache.get('__imports__');
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const running = dashboardInFlight.get('__imports__');
  if (running) return running;

  const request = (async () => {
    const value = await prisma.fiorixBiImport.findMany({
      orderBy: { importedAt: 'desc' },
      take: 20,
    });
    dashboardCache.set('__imports__', { value, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
    return value;
  })();

  dashboardInFlight.set('__imports__', request);
  try {
    return await request;
  } finally {
    dashboardInFlight.delete('__imports__');
  }
}

export interface BiAtrasadosFilters extends BiDashboardFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  rangeIndex?: number;
}

export interface BiAtrasadosItem {
  id: string;
  protocolo: string;
  data: string;
  tipo: string;
  atraso: number;
  status: string;
}

export interface BiAtrasadosResult {
  items: BiAtrasadosItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  rangeCounts: number[];
}

export async function queryBiAtrasadosList(filters?: BiAtrasadosFilters): Promise<BiAtrasadosResult> {
  const page = Math.max(1, Number(filters?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters?.pageSize) || 20));
  const rangeIndex = Number(filters?.rangeIndex) || 0;
  const search = filters?.search?.trim() || '';

  let importCondition = Prisma.sql`1=1`;
  if (filters?.importId && filters.importId !== 'ALL') {
    importCondition = Prisma.sql`"import_id" = ${filters.importId}`;
  }

  let tipoCondition = Prisma.sql`1=1`;
  if (filters?.tipoPrenotacao && filters.tipoPrenotacao !== 'ALL') {
    tipoCondition = Prisma.sql`"TipoPrenotacao" = ${filters.tipoPrenotacao}`;
  }

  let dateCondition = Prisma.sql`1=1`;
  if (filters?.startDate || filters?.endDate) {
    if (filters.startDate && filters.endDate) {
      const endD = new Date(filters.endDate);
      endD.setHours(23, 59, 59, 999);
      dateCondition = Prisma.sql`"DtAndamento" >= ${new Date(filters.startDate)} AND "DtAndamento" <= ${endD}`;
    } else if (filters.startDate) {
      dateCondition = Prisma.sql`"DtAndamento" >= ${new Date(filters.startDate)}`;
    } else if (filters.endDate) {
      const endD = new Date(filters.endDate);
      endD.setHours(23, 59, 59, 999);
      dateCondition = Prisma.sql`"DtAndamento" <= ${endD}`;
    }
  }

  const baseCondition = Prisma.sql`${importCondition} AND ${tipoCondition} AND ${dateCondition}`;
  const generalCondition = Prisma.sql`${baseCondition} AND ${GENERAL_NATURE_CONDITION_SQL}`;
  const atrasadoCondition = Prisma.sql`("DiasAtraso" > 0 OR ("DiasCorridos" > "DiasPrometidos" AND "DiasPrometidos" > 0))`;

  let searchCondition = Prisma.sql`1=1`;
  if (search !== '') {
    searchCondition = Prisma.sql`CAST("Protocolo" AS TEXT) ILIKE ${'%' + search + '%'}`;
  }

  const calculatedAtraso = Prisma.sql`COALESCE("DiasAtraso", COALESCE("DiasCorridos", 0) - COALESCE("DiasPrometidos", 0))`;

  let rangeCondition = Prisma.sql`1=1`;
  if (rangeIndex === 1) {
    rangeCondition = Prisma.sql`${calculatedAtraso} >= 1 AND ${calculatedAtraso} <= 3`;
  } else if (rangeIndex === 2) {
    rangeCondition = Prisma.sql`${calculatedAtraso} >= 4 AND ${calculatedAtraso} <= 7`;
  } else if (rangeIndex === 3) {
    rangeCondition = Prisma.sql`${calculatedAtraso} >= 8 AND ${calculatedAtraso} <= 15`;
  } else if (rangeIndex === 4) {
    rangeCondition = Prisma.sql`${calculatedAtraso} >= 16 AND ${calculatedAtraso} <= 30`;
  } else if (rangeIndex === 5) {
    rangeCondition = Prisma.sql`${calculatedAtraso} >= 31`;
  }

  const countsRaw = await prisma.$queryRaw<Array<{
    total: bigint;
    d1_3: bigint;
    d4_7: bigint;
    d8_15: bigint;
    d16_30: bigint;
    d31_plus: bigint;
  }>>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(CASE WHEN ${calculatedAtraso} >= 1 AND ${calculatedAtraso} <= 3 THEN 1 END)::bigint AS d1_3,
      COUNT(CASE WHEN ${calculatedAtraso} >= 4 AND ${calculatedAtraso} <= 7 THEN 1 END)::bigint AS d4_7,
      COUNT(CASE WHEN ${calculatedAtraso} >= 8 AND ${calculatedAtraso} <= 15 THEN 1 END)::bigint AS d8_15,
      COUNT(CASE WHEN ${calculatedAtraso} >= 16 AND ${calculatedAtraso} <= 30 THEN 1 END)::bigint AS d16_30,
      COUNT(CASE WHEN ${calculatedAtraso} >= 31 THEN 1 END)::bigint AS d31_plus
    FROM fiorix_bi_data
    WHERE ${generalCondition}
      AND ${atrasadoCondition}
      AND ${searchCondition}
  `;

  const countRow = countsRaw[0] || { total: BigInt(0), d1_3: BigInt(0), d4_7: BigInt(0), d8_15: BigInt(0), d16_30: BigInt(0), d31_plus: BigInt(0) };
  const rangeCounts = [
    Number(countRow.total || 0),
    Number(countRow.d1_3 || 0),
    Number(countRow.d4_7 || 0),
    Number(countRow.d8_15 || 0),
    Number(countRow.d16_30 || 0),
    Number(countRow.d31_plus || 0),
  ];

  const totalItems = rangeIndex > 0 ? rangeCounts[rangeIndex] : rangeCounts[0];
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validPage = Math.min(page, totalPages);
  const offset = (validPage - 1) * pageSize;

  const atrasadosRaw = await prisma.$queryRaw<Array<{ id: string; protocolo: string; data_entrada: Date; tipo: string; atraso_dias: number; situacao: string }>>`
    SELECT
      "id",
      "Protocolo" as protocolo,
      "DtAndamento" as data_entrada,
      "TipoPrenotacao" as tipo,
      ${calculatedAtraso} as atraso_dias,
      CASE 
        WHEN "IsDevolucao" = true THEN 'devolvido'
        WHEN "DiasAtraso" > 0 OR ("DiasCorridos" > "DiasPrometidos" AND "DiasPrometidos" > 0) THEN 'atrasado'
        ELSE 'no_prazo'
      END as situacao
    FROM fiorix_bi_data
    WHERE ${generalCondition}
      AND ${atrasadoCondition}
      AND ${searchCondition}
      AND ${rangeCondition}
    ORDER BY atraso_dias DESC, "DtAndamento" DESC
    OFFSET ${offset}
    LIMIT ${pageSize}
  `;

  const items = atrasadosRaw.map(row => ({
    id: row.id,
    protocolo: String(row.protocolo),
    data: formatDateKey(row.data_entrada),
    tipo: row.tipo,
    atraso: Number(row.atraso_dias),
    status: row.situacao,
  }));

  return {
    items,
    pagination: {
      page: validPage,
      pageSize,
      totalItems,
      totalPages,
    },
    rangeCounts,
  };
}

