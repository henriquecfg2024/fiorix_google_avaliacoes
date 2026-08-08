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

// Fonte legal recebida em 6 de agosto de 2026:
// quando a previsao e 0, nao existe prazo legal de entrega.
// A classificacao abaixo segue exatamente as descricoes com previsao zero
// da tabela legal enviada pelo usuario.
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

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

  const historicalPerformanceRaw = (chartEnabled('11') || chartEnabled('12')) ? await prisma.$queryRaw<Array<{
    ano: number;
    mes: number;
    no_prazo: bigint;
    atrasados: bigint;
  }>>`
    SELECT
      EXTRACT(YEAR FROM "DtAndamento")::int as ano,
      EXTRACT(MONTH FROM "DtAndamento")::int as mes,
      SUM(CASE
        WHEN COALESCE("DiasAtraso", 0) > 0 OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%' THEN 0
        ELSE 1
      END)::bigint as no_prazo,
      SUM(CASE
        WHEN COALESCE("DiasAtraso", 0) > 0 OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%' THEN 1
        ELSE 0
      END)::bigint as atrasados
    FROM fiorix_bi_data
    WHERE "DtAndamento" IS NOT NULL
      AND ("CodProcessamento" = 6 OR "CodProcessamento" = 5 OR "IsRegistrado" = true)
      AND COALESCE("IsDevolucao", false) = false
      AND LOWER(COALESCE("SituacaoPrazo", '')) NOT LIKE '%devolucao%'
      AND ${generalCondition}
    GROUP BY 1, 2
    ORDER BY 1, 2
  ` : [];

  const pieRaw = (includeSummary || chartEnabled('1')) ? await prisma.$queryRaw<Array<{ situacao: string; cnt: bigint }>>`
    SELECT
      CASE
        WHEN "IsDevolucao" = true OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%' THEN 'Devolução'
        WHEN "DiasAtraso" > 0 OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%' THEN 'Atrasado'
        ELSE 'No Prazo'
      END as situacao,
      COUNT(*)::bigint as cnt
    FROM fiorix_bi_data
    WHERE ("CodProcessamento" = 6 OR "CodProcessamento" = 5 OR "IsRegistrado" = true)
      AND ${generalCondition}
    GROUP BY 1
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
    SELECT COUNT(*)::bigint as cnt
    FROM fiorix_bi_data
    WHERE ${generalCondition}
      AND (
        "IsDevolucao" = true
        OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%'
      )
  ` : [];

  const devolucoesRaw = chartEnabled('6') ? await prisma.$queryRaw<Array<{ texto: string }>>`
    SELECT "TextoNotaDevolucao" as texto
    FROM fiorix_bi_data
    WHERE ("IsDevolucao" = true OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%')
      AND "TextoNotaDevolucao" IS NOT NULL
      AND LENGTH(TRIM("TextoNotaDevolucao")) > 5
      AND ${generalCondition}
    LIMIT 1500
  ` : [];

  const stopWords = new Set([
    'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no',
    'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'seu', 'sua', 'ou',
    'quando', 'muito', 'nos', 'já', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela',
    'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'você',
    'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'numa', 'cujo', 'quais', 'item', 'conforme',
    'nota', 'devolução', 'andamento', 'registro', 'prenotação', 'solicitação', 'favor', 'apresentar',
    'deverá', 'ser', 'certidão', 'imóvel', 'documento', 'documentos', 'deve', 'constar', 'termos',
    'artigo', 'art', 'lei', 'provimento', 'exigência', 'atender',
  ]);

  const reasonFrequency: Record<string, number> = {};
  devolucoesRaw.forEach((row) => {
    const note = row.texto || '';
    const clauses = note
      .split(/(?:\r\n|\n|\.\s+|;\s+|\d+[\)\.\-\s])/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 5);

    clauses.forEach((clause) => {
      const words = clause
        .toLowerCase()
        .replace(/[^\w\sà-úÀ-Ú]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !stopWords.has(word));

      if (words.length === 0) {
        return;
      }

      const keyTerm = words.slice(0, 3).join(' ');
      if (keyTerm.length < 4) {
        return;
      }

      const capitalized = keyTerm.charAt(0).toUpperCase() + keyTerm.slice(1);
      reasonFrequency[capitalized] = (reasonFrequency[capitalized] || 0) + 1;
    });
  });

  const topDevolucoes = Object.entries(reasonFrequency)
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const avgNaturezaRaw = chartEnabled('7') ? await prisma.$queryRaw<Array<{ natureza: string; media_dias: number; total: bigint }>>`
    SELECT
      COALESCE(TRIM("Natureza"), 'Outros') as natureza,
      ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as media_dias,
      COUNT(*)::bigint as total
    FROM fiorix_bi_data
    WHERE ${generalCondition}
    GROUP BY COALESCE(TRIM("Natureza"), 'Outros')
    ORDER BY media_dias DESC
    LIMIT 10
  ` : [];

  const avgDiasPorNatureza = avgNaturezaRaw.map((row) => ({
    natureza: row.natureza,
    mediaDias: Number(row.media_dias || 0),
    totalTitulos: Number(row.total || 0),
  }));

  const delayBucketsRaw = chartEnabled('2') ? await prisma.$queryRaw<Array<{ bucket: string; cnt: bigint }>>`
    SELECT
      bucket,
      COUNT(*)::bigint as cnt
    FROM (
      SELECT CASE
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 1 AND 3 THEN '1-3 dias'
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 4 AND 7 THEN '4-7 dias'
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 8 AND 15 THEN '8-15 dias'
        WHEN COALESCE("DiasAtraso", 0) >= 16 THEN '16+ dias'
        ELSE 'Sem atraso'
      END as bucket
      FROM fiorix_bi_data
      WHERE ${generalCondition}
        AND (
          COALESCE("DiasAtraso", 0) > 0
          OR "IsDevolucao" = true
          OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%'
          OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%'
        )
    ) buckets
    GROUP BY bucket
    ORDER BY CASE bucket
      WHEN '1-3 dias' THEN 1
      WHEN '4-7 dias' THEN 2
      WHEN '8-15 dias' THEN 3
      WHEN '16+ dias' THEN 4
      ELSE 5
    END
  ` : [];

  const delaySeverity = delayBucketsRaw.map((row) => ({
    bucket: row.bucket,
    count: Number(row.cnt || 0),
  }));

  const prazoVsRealPromise = chartEnabled('3') ? prisma.$queryRaw<Array<{ natureza: string; prometidos: number; corridos: number; total: bigint }>>`
    SELECT
      COALESCE(TRIM("Natureza"), 'Outros') as natureza,
      ROUND(AVG(COALESCE("DiasPrometidos", 0))::numeric, 1)::float as prometidos,
      ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as corridos,
      COUNT(*)::bigint as total
    FROM fiorix_bi_data
    WHERE ${generalCondition}
    GROUP BY COALESCE(TRIM("Natureza"), 'Outros')
    ORDER BY corridos DESC, prometidos DESC
    LIMIT 8
  ` : Promise.resolve([] as Array<{ natureza: string; prometidos: number; corridos: number; total: bigint }>);

  const trendPromise = chartEnabled('4') ? prisma.$queryRaw<Array<{ data: Date | string; no_prazo: bigint; atrasado: bigint; devolucao: bigint }>>`
    SELECT
      DATE("DtAndamento") as data,
      SUM(CASE WHEN COALESCE("DiasAtraso", 0) <= 0 AND COALESCE("IsDevolucao", false) = false THEN 1 ELSE 0 END) as no_prazo,
      SUM(CASE WHEN COALESCE("DiasAtraso", 0) > 0 AND COALESCE("IsDevolucao", false) = false THEN 1 ELSE 0 END) as atrasado,
      SUM(CASE WHEN COALESCE("IsDevolucao", false) = true THEN 1 ELSE 0 END) as devolucao
    FROM fiorix_bi_data
    WHERE "DtAndamento" IS NOT NULL
      AND ${generalCondition}
    GROUP BY DATE("DtAndamento")
    ORDER BY DATE("DtAndamento")
  ` : Promise.resolve([] as Array<{ data: Date | string; no_prazo: bigint; atrasado: bigint; devolucao: bigint }>);

  const [prazoVsRealRaw, trendRaw] = await Promise.all([prazoVsRealPromise, trendPromise]);

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

  const topAndamentosRaw = chartEnabled('5') ? await prisma.$queryRaw<Array<{ andamento: string; cnt: bigint; media_atraso: number }>>`
    SELECT
      COALESCE(TRIM("DescAndamento"), 'Sem andamento') as andamento,
      COUNT(*)::bigint as cnt,
      ROUND(AVG(COALESCE("DiasAtraso", 0))::numeric, 1)::float as media_atraso
    FROM fiorix_bi_data
    WHERE ${generalCondition}
      AND TRIM(COALESCE("DescAndamento", '')) != ''
    GROUP BY COALESCE(TRIM("DescAndamento"), 'Sem andamento')
    ORDER BY cnt DESC, media_atraso DESC
    LIMIT 8
  ` : [];

  const topAndamentosComAtraso = topAndamentosRaw.map((row) => ({
    andamento: row.andamento,
    count: Number(row.cnt || 0),
    mediaAtraso: Number(row.media_atraso || 0),
  }));

  const totalRecordsRaw = includeSummary ? await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt
    FROM fiorix_bi_data
    WHERE ${generalCondition}
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

  const exceptionAndamentosRaw = chartEnabled('10') ? await prisma.$queryRaw<Array<{ andamento: string; cnt: bigint }>>`
    SELECT
      COALESCE(TRIM("DescAndamento"), 'Sem andamento') as andamento,
      COUNT(*)::bigint as cnt
    FROM fiorix_bi_data
    WHERE ${exceptionCondition}
      AND TRIM(COALESCE("DescAndamento", '')) != ''
    GROUP BY COALESCE(TRIM("DescAndamento"), 'Sem andamento')
    ORDER BY cnt DESC
    LIMIT 8
  ` : [];

  const tiposRaw = includeSummary ? await prisma.$queryRaw<Array<{ tipo: string }>>`
    SELECT DISTINCT "TipoPrenotacao" as tipo
    FROM fiorix_bi_data
    WHERE "TipoPrenotacao" IS NOT NULL AND TRIM("TipoPrenotacao") != ''
    LIMIT 30
  ` : [];

  const totalRecords = Number(totalRecordsRaw[0]?.cnt || 0);
  const devolucaoGeneralCount = Number(devolucaoSummaryRaw[0]?.cnt || 0);
  const exceptionSummary = exceptionSummaryRaw[0];
  const exceptionRecordsExcluded = Number(exceptionSummary?.total || 0);
  const exceptionProtocolsExcluded = Number(exceptionSummary?.protocolos || 0);
  const exceptionEmAcompanhamento = Number(exceptionSummary?.em_acompanhamento || 0);
  const exceptionFinalizados = Number(exceptionSummary?.finalizados || 0);
  const exceptionAvgDias = Number(exceptionSummary?.media_dias || 0);
  const exceptionMaxDias = Number(exceptionSummary?.maior_dias || 0);

  const historicalBase = historicalPerformanceRaw.map((row) => {
    const noPrazo = Number(row.no_prazo || 0);
    const atrasados = Number(row.atrasados || 0);
    const total = noPrazo + atrasados;
    return {
      ano: Number(row.ano),
      mes: Number(row.mes),
      label: `${MONTH_NAMES_PT[Number(row.mes) - 1] || row.mes}/${row.ano}`,
      noPrazo,
      atrasados,
      total,
      percentNoPrazo: Number(((noPrazo / (total || 1)) * 100).toFixed(1)),
      percentAtrasados: Number(((atrasados / (total || 1)) * 100).toFixed(1)),
    };
  });

  const historicalYears = Array.from(new Set(historicalBase.map((row) => row.ano))).sort((a, b) => a - b);
  const historicalTotal = historicalBase.reduce((sum, row) => sum + row.total, 0);
  const historicalNoPrazo = historicalBase.reduce((sum, row) => sum + row.noPrazo, 0);
  const historicalOverallPercent = Number(((historicalNoPrazo / (historicalTotal || 1)) * 100).toFixed(1));
  const recentRows = historicalBase.slice(-12);
  const recentTotal = recentRows.reduce((sum, row) => sum + row.total, 0);
  const recentNoPrazo = recentRows.reduce((sum, row) => sum + row.noPrazo, 0);
  const recentPercent = Number(((recentNoPrazo / (recentTotal || 1)) * 100).toFixed(1));
  const annualPerformance = historicalYears.map((ano) => {
    const rows = historicalBase.filter((row) => row.ano === ano);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const noPrazo = rows.reduce((sum, row) => sum + row.noPrazo, 0);
    return { ano, total, percentNoPrazo: Number(((noPrazo / (total || 1)) * 100).toFixed(1)) };
  });
  const bestYear = annualPerformance.reduce((best, current) => current.percentNoPrazo > best.percentNoPrazo ? current : best, { ano: 0, total: 0, percentNoPrazo: 0 });
  const targetPercent = historicalBase.length === 0 ? 0 : Number(Math.min(
    95,
    Math.max(
      historicalOverallPercent + 3,
      recentPercent + 2,
      historicalOverallPercent + ((bestYear.percentNoPrazo - historicalOverallPercent) / 2),
    ),
  ).toFixed(1));
  const historicalMonthly = historicalBase.map((row) => ({ ...row, metaPercent: targetPercent }));
  const historicalComparison = MONTH_NAMES_PT.map((nome, index) => {
    const result: Record<string, number | string | null> = { mes: index + 1, nome };
    historicalYears.forEach((ano) => {
      const row = historicalBase.find((item) => item.ano === ano && item.mes === index + 1);
      result[String(ano)] = row ? row.percentNoPrazo : null;
    });
    return result;
  });

  return {
    summary: {
      totalRecords,
      totalRegistered,
      noPrazoCount,
      atrasadoCount,
      devolucaoCount: devolucaoGeneralCount,
      percentNoPrazo: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)),
      percentAtrasado: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)),
      percentDevolucao: Number(((devolucaoGeneralCount / (totalRecords || 1)) * 100).toFixed(1)),
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
        topAndamentos: exceptionAndamentosRaw.map((row) => ({
          andamento: row.andamento,
          count: Number(row.cnt || 0),
        })),
      },
    },
    historical: {
      monthly: historicalMonthly,
      comparison: historicalComparison,
      years: historicalYears,
      annualPerformance,
      summary: {
        overallPercent: historicalOverallPercent,
        recentPercent,
        targetPercent,
        bestYear: bestYear.ano,
        bestYearPercent: bestYear.percentNoPrazo,
      },
    },
    charts: {
      pieChartData,
      topDevolucoes,
      avgDiasPorNatureza,
      delaySeverity,
      prazoPrometidoVsCorridosPorNatureza,
      evolucaoPrazoPorDia,
      topAndamentosComAtraso,
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
