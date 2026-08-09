import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    fiorixBiImport: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

type QueryHandler = (sql: string) => unknown[];

/**
 * The dashboard fires many `$queryRaw` templates in sequence; route each one by
 * a distinctive fragment of its SQL so the assertions stay readable.
 */
function respondByQuery(handler: QueryHandler) {
  prismaMock.$queryRaw.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join(' ') + JSON.stringify(values.map((value: any) => value?.strings ?? value));
    return Promise.resolve(handler(sql));
  });
}

async function importDashboard() {
  vi.resetModules();
  return import('./bi-dashboard');
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([]);
});

describe('queryBiDashboardData', () => {
  it('aggregates the deadline situation into counts and percentages', async () => {
    respondByQuery((sql) => {
      if (sql.includes("'No Prazo' AS situacao")) {
        return [
          { situacao: 'No Prazo', cnt: BigInt(70) },
          { situacao: 'Atrasado', cnt: BigInt(20) },
          { situacao: 'Devolução', cnt: BigInt(10) },
        ];
      }
      if (sql.includes('devolucao_all')) return [{ cnt: BigInt(30) }];
      if (sql.includes('a.total_records')) return [{ cnt: BigInt(300) }];
      return [];
    });

    const { queryBiDashboardData } = await importDashboard();
    const data = await queryBiDashboardData();

    expect(data.charts.pieChartData).toEqual([
      { name: 'No Prazo', count: 70, percentage: 70, fill: '#10b981' },
      { name: 'Atrasado', count: 20, percentage: 20, fill: '#ef4444' },
      { name: 'Devolução', count: 10, percentage: 10, fill: '#f59e0b' },
    ]);
    expect(data.summary).toMatchObject({
      totalRecords: 300,
      totalRegistered: 100,
      noPrazoCount: 70,
      atrasadoCount: 20,
      devolucaoCount: 30,
      percentNoPrazo: 70,
      percentAtrasado: 20,
      percentDevolucao: 10,
    });
  });

  it('avoids dividing by zero when there is no registered title', async () => {
    const { queryBiDashboardData } = await importDashboard();
    const data = await queryBiDashboardData();

    expect(data.summary.totalRegistered).toBe(1);
    expect(data.summary.percentNoPrazo).toBe(0);
    expect(data.charts.pieChartData.every((slice: any) => slice.percentage === 0)).toBe(true);
  });

  it('normalises trend rows and numeric strings coming from Postgres', async () => {
    respondByQuery((sql) => {
      if (sql.includes('a.day as data')) {
        return [
          { data: new Date('2026-03-04T15:00:00.000Z'), no_prazo: BigInt(3), atrasado: BigInt(1), devolucao: null },
          { data: '2026-03-05', no_prazo: BigInt(2), atrasado: null, devolucao: BigInt(4) },
        ];
      }
      if (sql.includes('delay_1_3')) {
        return [
          { bucket: '1-3 dias', cnt: BigInt(5) },
          { bucket: '16+ dias', cnt: BigInt(2) },
        ];
      }
      if (sql.includes('a.tipo_prenotacao as tipo')) {
        return [{ tipo: 'Registro' }, { tipo: '' }, { tipo: 'Certidão' }];
      }
      return [];
    });

    const { queryBiDashboardData } = await importDashboard();
    const data = await queryBiDashboardData();

    expect(data.charts.evolucaoPrazoPorDia).toEqual([
      { data: '2026-03-04', noPrazo: 3, atrasado: 1, devolucao: 0 },
      { data: '2026-03-05', noPrazo: 2, atrasado: 0, devolucao: 4 },
    ]);
    expect(data.charts.delaySeverity).toEqual([
      { bucket: '1-3 dias', count: 5 },
      { bucket: '16+ dias', count: 2 },
    ]);
    expect(data.tiposPrenotacao).toEqual(['Certidão', 'Registro']);
  });

  it('summarises the legal exceptions block', async () => {
    respondByQuery((sql) => {
      if (sql.includes('em_acompanhamento')) {
        return [
          {
            total: BigInt(12),
            protocolos: BigInt(9),
            em_acompanhamento: BigInt(5),
            finalizados: BigInt(7),
            media_dias: 4.5,
            maior_dias: 30,
          },
        ];
      }
      if (sql.includes('GROUP BY 1')) {
        return [{ natureza: 'Intimação', total: BigInt(8), protocolos: BigInt(6), media_dias: 3.2 }];
      }
      return [];
    });

    const { queryBiDashboardData } = await importDashboard();
    const data = await queryBiDashboardData();

    expect(data.legalExceptions.summary).toEqual({
      totalRecords: 12,
      totalProtocols: 9,
      emAcompanhamento: 5,
      finalizados: 7,
      avgDiasCorridos: 4.5,
      maxDiasCorridos: 30,
    });
    expect(data.legalExceptions.charts.statusPieData).toEqual([
      { name: 'Em acompanhamento', count: 5, fill: '#f59e0b' },
      { name: 'Finalizados', count: 7, fill: '#2563eb' },
    ]);
    expect(data.legalExceptions.charts.porNatureza).toEqual([
      { natureza: 'Intimação', total: 8, protocolos: 6, mediaDias: 3.2 },
    ]);
    expect(data.summary.exceptionRecordsExcluded).toBe(12);
  });

  it('skips queries for charts that were not requested', async () => {
    const { queryBiDashboardData } = await importDashboard();
    await queryBiDashboardData({ enabledCharts: ['2'], includeSummary: false });

    const executed = prismaMock.$queryRaw.mock.calls.map(([strings]: any) => strings.join(' '));
    expect(executed).toHaveLength(1);
    expect(executed[0]).toContain('delay_1_3');
  });

  it('serves repeated calls from the cache and shares in-flight requests', async () => {
    const { queryBiDashboardData } = await importDashboard();

    const [first, second] = await Promise.all([
      queryBiDashboardData({ importId: 'imp-1' }),
      queryBiDashboardData({ importId: 'imp-1' }),
    ]);
    const callsAfterConcurrent = prismaMock.$queryRaw.mock.calls.length;
    const third = await queryBiDashboardData({ importId: 'imp-1' });

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(prismaMock.$queryRaw.mock.calls.length).toBe(callsAfterConcurrent);
  });

  it('treats a different chart selection order as the same cache entry', async () => {
    const { queryBiDashboardData } = await importDashboard();

    const first = await queryBiDashboardData({ enabledCharts: ['2', '7'] });
    const second = await queryBiDashboardData({ enabledCharts: ['7', '2'] });

    expect(second).toBe(first);
  });

  it('re-queries once the cached entry expires', async () => {
    vi.useFakeTimers();
    try {
      const { queryBiDashboardData } = await importDashboard();
      const first = await queryBiDashboardData();
      vi.advanceTimersByTime(31_000);
      const second = await queryBiDashboardData();

      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies import, tipo and date filters to the SQL parameters', async () => {
    const { queryBiDashboardData } = await importDashboard();
    await queryBiDashboardData({
      importId: 'imp-9',
      tipoPrenotacao: 'Registro',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const [, ...values] = prismaMock.$queryRaw.mock.calls[0];
    const flattened = JSON.stringify(values.map((value: any) => value?.values ?? value));
    expect(flattened).toContain('imp-9');
    expect(flattened).toContain('Registro');
    expect(flattened).toContain('2026-01-01');
  });

  it('ignores the ALL sentinel used by the filter dropdowns', async () => {
    const { queryBiDashboardData } = await importDashboard();
    await queryBiDashboardData({ importId: 'ALL', tipoPrenotacao: 'ALL', enabledCharts: ['1'], includeSummary: false });

    const [, ...values] = prismaMock.$queryRaw.mock.calls[0];
    expect(JSON.stringify(values.map((value: any) => value?.values ?? value))).not.toContain('ALL');
  });
});

describe('queryBiImportsList', () => {
  it('returns the most recent imports and caches them', async () => {
    const imports = [{ id: 'imp-1' }];
    prismaMock.fiorixBiImport.findMany.mockResolvedValue(imports);

    const { queryBiImportsList } = await importDashboard();
    const first = await queryBiImportsList();
    const second = await queryBiImportsList();

    expect(first).toBe(imports);
    expect(second).toBe(imports);
    expect(prismaMock.fiorixBiImport.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.fiorixBiImport.findMany).toHaveBeenCalledWith({
      orderBy: { importedAt: 'desc' },
      take: 20,
    });
  });
});
