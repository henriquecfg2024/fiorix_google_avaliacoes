'use server';

import { revalidatePath } from 'next/cache';

import { runAction } from '@/lib/action-result';
import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';
import { refreshBiAggregatesForImport } from '@/lib/bi-aggregates';
import { BiCsvRow, parseBoolValue, parseDateValue, parseIntValue, trimOrNull } from '@/lib/bi-row';
import { prisma } from '@/lib/prisma';

export type { BiCsvRow as BiRowInput } from '@/lib/bi-row';

export async function createBiImport(fileName: string, totalRows: number, importedBy = 'Manual SSMS') {
  return runAction('Error creating BI import:', 'Erro ao criar registro de importacao', async () => {
    const record = await prisma.fiorixBiImport.create({
      data: {
        fileName,
        rowsCount: totalRows,
        importedBy,
        status: 'PROCESSING',
      },
    });

    return { importId: record.id };
  });
}

export async function updateBiImportStatus(importId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
  return runAction('Error updating import status:', 'Erro ao atualizar status da importacao', async () => {
    if (status === 'FAILED') {
      await prisma.$transaction([
        prisma.fiorixBiData.deleteMany({ where: { importId } }),
        prisma.fiorixBiImport.update({
          where: { id: importId },
          data: { status, errorMessage },
        }),
      ]);
      return {};
    }

    // Calcula uma vez os resumos do BI. Os graficos passam a consultar
    // milhares de linhas agregadas, em vez de reler todo o CSV importado.
    await refreshBiAggregatesForImport(importId);
    await prisma.fiorixBiImport.update({
      where: { id: importId },
      data: { status, errorMessage },
    });

    return {};
  });
}

export async function insertBiBatch(importId: string, rows: BiCsvRow[]) {
  return runAction('Error inserting BI batch:', 'Erro ao inserir lote de dados', async () => {
    if (!rows || rows.length === 0) {
      return { count: 0 };
    }

    const dataToInsert = rows.map((row) => ({
      importId,
      protocolo: String(row.Protocolo || '').trim(),
      flagRecepcao: parseIntValue(row.FlagRecepcao),
      tipoSolicitacao: trimOrNull(row.TipoSolicitacao),
      idAndamento: row.IdAndamento ? BigInt(String(row.IdAndamento).replace(/\D/g, '') || 0) : null,
      dtProtocolo: parseDateValue(row.DtProtocolo),
      dtPrevisaoEntrega: parseDateValue(row.DtPrevisaoEntrega),
      dtAndamento: parseDateValue(row.DtAndamento),
      codProcessamento: parseIntValue(row.CodProcessamento),
      descAndamento: trimOrNull(row.DescAndamento),
      natureza: trimOrNull(row.Natureza),
      tipoPrenotacao: trimOrNull(row.TipoPrenotacao),
      diasPrometidos: parseIntValue(row.DiasPrometidos),
      diasCorridos: parseIntValue(row.DiasCorridos),
      diasAtraso: parseIntValue(row.DiasAtraso),
      situacaoPrazo: trimOrNull(row.SituacaoPrazo),
      isDevolucao: parseBoolValue(row.IsDevolucao),
      isRegistrado: parseBoolValue(row.IsRegistrado),
      textoNotaDevolucao: trimOrNull(row.TextoNotaDevolucao),
    }));

    await prisma.fiorixBiData.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    return { count: dataToInsert.length };
  });
}

export async function getBiDashboardData(filters?: {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
}) {
  return runAction('Error fetching BI dashboard data:', 'Erro ao carregar dados do dashboard', async () =>
    queryBiDashboardData(filters)
  );
}

export async function getBiImportsList() {
  return runAction('Error fetching imports list:', 'Erro ao listar importacoes', async () => ({
    imports: await queryBiImportsList(),
  }));
}

export async function deleteBiImport(importId: string) {
  return runAction('Error deleting import:', 'Erro ao excluir importacao', async () => {
    await prisma.fiorixBiImport.delete({
      where: { id: importId },
    });

    revalidatePath('/admin/bi');
    return {};
  });
}
