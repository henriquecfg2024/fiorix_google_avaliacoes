import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, queryBiDashboardData, queryBiImportsList, refreshBiAggregatesForImport, revalidatePath } =
  vi.hoisted(() => ({
    prismaMock: {
      fiorixBiImport: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      fiorixBiData: { createMany: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn(),
    },
    queryBiDashboardData: vi.fn(),
    queryBiImportsList: vi.fn(),
    refreshBiAggregatesForImport: vi.fn(),
    revalidatePath: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/bi-dashboard', () => ({ queryBiDashboardData, queryBiImportsList }));
vi.mock('@/lib/bi-aggregates', () => ({ refreshBiAggregatesForImport }));
vi.mock('next/cache', () => ({ revalidatePath }));

import {
  createBiImport,
  deleteBiImport,
  getBiDashboardData,
  getBiImportsList,
  insertBiBatch,
  updateBiImportStatus,
} from './bi';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('createBiImport', () => {
  it('registers the import as PROCESSING and returns its id', async () => {
    prismaMock.fiorixBiImport.create.mockResolvedValue({ id: 'imp-1' });

    await expect(createBiImport('base.csv', 120)).resolves.toEqual({ success: true, importId: 'imp-1' });
    expect(prismaMock.fiorixBiImport.create).toHaveBeenCalledWith({
      data: { fileName: 'base.csv', rowsCount: 120, importedBy: 'Manual SSMS', status: 'PROCESSING' },
    });
  });

  it('reports database failures instead of throwing', async () => {
    prismaMock.fiorixBiImport.create.mockRejectedValue(new Error('db down'));
    await expect(createBiImport('base.csv', 1, 'ana')).resolves.toEqual({ success: false, error: 'db down' });
  });
});

describe('updateBiImportStatus', () => {
  it('refreshes the aggregates before marking an import as SUCCESS', async () => {
    await expect(updateBiImportStatus('imp-1', 'SUCCESS')).resolves.toEqual({ success: true });

    expect(refreshBiAggregatesForImport).toHaveBeenCalledWith('imp-1');
    expect(prismaMock.fiorixBiImport.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: { status: 'SUCCESS', errorMessage: undefined },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('discards the partially imported rows when the import fails', async () => {
    await expect(updateBiImportStatus('imp-1', 'FAILED', 'csv inválido')).resolves.toEqual({ success: true });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.fiorixBiData.deleteMany).toHaveBeenCalledWith({ where: { importId: 'imp-1' } });
    expect(refreshBiAggregatesForImport).not.toHaveBeenCalled();
  });

  it('surfaces aggregate refresh errors', async () => {
    refreshBiAggregatesForImport.mockRejectedValue(new Error('refresh failed'));
    await expect(updateBiImportStatus('imp-1', 'SUCCESS')).resolves.toEqual({
      success: false,
      error: 'refresh failed',
    });
  });
});

describe('insertBiBatch', () => {
  it('short-circuits on an empty batch', async () => {
    await expect(insertBiBatch('imp-1', [])).resolves.toEqual({ success: true, count: 0 });
    expect(prismaMock.fiorixBiData.createMany).not.toHaveBeenCalled();
  });

  it('coerces CSV strings into dates, integers, bigints and booleans', async () => {
    await expect(
      insertBiBatch('imp-1', [
        {
          Protocolo: '  123 ',
          FlagRecepcao: '1a' as any,
          TipoSolicitacao: '  Registro ',
          IdAndamento: 'A-42',
          DtProtocolo: '2026-01-02T00:00:00.000Z',
          DtPrevisaoEntrega: '   ',
          DtAndamento: 'not-a-date',
          CodProcessamento: 6,
          Natureza: ' Intimação ',
          DiasCorridos: 0,
          DiasAtraso: '' as any,
          IsDevolucao: 'Sim' as any,
          IsRegistrado: 0 as any,
        },
      ]),
    ).resolves.toEqual({ success: true, count: 1 });

    expect(prismaMock.fiorixBiData.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          importId: 'imp-1',
          protocolo: '123',
          flagRecepcao: 1,
          tipoSolicitacao: 'Registro',
          idAndamento: BigInt(42),
          dtProtocolo: new Date('2026-01-02T00:00:00.000Z'),
          dtPrevisaoEntrega: null,
          dtAndamento: null,
          codProcessamento: 6,
          natureza: 'Intimação',
          diasCorridos: 0,
          diasAtraso: null,
          isDevolucao: true,
          isRegistrado: false,
        }),
      ],
    });
  });

  it('keeps optional fields null and booleans false when absent', async () => {
    await insertBiBatch('imp-1', [{ Protocolo: 'P1' }]);

    expect(prismaMock.fiorixBiData.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          importId: 'imp-1',
          protocolo: 'P1',
          flagRecepcao: null,
          tipoSolicitacao: null,
          idAndamento: null,
          dtProtocolo: null,
          dtPrevisaoEntrega: null,
          dtAndamento: null,
          codProcessamento: null,
          descAndamento: null,
          natureza: null,
          tipoPrenotacao: null,
          diasPrometidos: null,
          diasCorridos: null,
          diasAtraso: null,
          situacaoPrazo: null,
          isDevolucao: false,
          isRegistrado: false,
          textoNotaDevolucao: null,
        },
      ],
    });
  });

  it.each([
    [true, true],
    ['TRUE', true],
    ['1', true],
    [1, true],
    ['nao', false],
    [0, false],
    [null, false],
  ])('parses %o as the boolean %o', async (input, expected) => {
    await insertBiBatch('imp-1', [{ Protocolo: 'P1', IsDevolucao: input as any }]);
    const [{ data }] = prismaMock.fiorixBiData.createMany.mock.calls.at(-1)!;
    expect(data[0].isDevolucao).toBe(expected);
  });

  it('reports insert failures instead of throwing', async () => {
    prismaMock.fiorixBiData.createMany.mockRejectedValue(new Error('unique violation'));
    await expect(insertBiBatch('imp-1', [{ Protocolo: 'P1' }])).resolves.toEqual({
      success: false,
      error: 'unique violation',
    });
  });
});

describe('dashboard read actions', () => {
  it('spreads the dashboard payload alongside the success flag', async () => {
    queryBiDashboardData.mockResolvedValue({ summary: { totalRecords: 3 } });
    await expect(getBiDashboardData({ importId: 'imp-1' })).resolves.toEqual({
      success: true,
      summary: { totalRecords: 3 },
    });
    expect(queryBiDashboardData).toHaveBeenCalledWith({ importId: 'imp-1' });
  });

  it('returns a failure payload when the dashboard query breaks', async () => {
    queryBiDashboardData.mockRejectedValue(new Error('timeout'));
    await expect(getBiDashboardData()).resolves.toEqual({ success: false, error: 'timeout' });
  });

  it('lists imports and falls back to a friendly error', async () => {
    queryBiImportsList.mockResolvedValue([{ id: 'imp-1' }]);
    await expect(getBiImportsList()).resolves.toEqual({ success: true, imports: [{ id: 'imp-1' }] });

    queryBiImportsList.mockRejectedValue(new Error(''));
    await expect(getBiImportsList()).resolves.toEqual({ success: false, error: 'Erro ao listar importacoes' });
  });
});

describe('deleteBiImport', () => {
  it('deletes the import and revalidates the admin page', async () => {
    await expect(deleteBiImport('imp-1')).resolves.toEqual({ success: true });
    expect(prismaMock.fiorixBiImport.delete).toHaveBeenCalledWith({ where: { id: 'imp-1' } });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/bi');
  });

  it('does not revalidate when the deletion fails', async () => {
    prismaMock.fiorixBiImport.delete.mockRejectedValue(new Error('fk constraint'));
    await expect(deleteBiImport('imp-1')).resolves.toEqual({ success: false, error: 'fk constraint' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
