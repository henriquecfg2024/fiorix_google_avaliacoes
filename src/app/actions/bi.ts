'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';
import { refreshBiAggregatesForImport } from '@/lib/bi-aggregates';
import { prisma } from '@/lib/prisma';

async function requireSession() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Nao autorizado');
  }
  return session;
}

async function requireAdmin() {
  const session = await requireSession();
  if (!session.user.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    throw new Error('Apenas administradores podem gerenciar importacoes do BI.');
  }
  return session;
}

export interface BiRowInput {
  Protocolo: string;
  FlagRecepcao?: number | null;
  TipoSolicitacao?: string | null;
  IdAndamento?: number | string | null;
  DtProtocolo?: string | null;
  DtPrevisaoEntrega?: string | null;
  DtAndamento?: string | null;
  CodProcessamento?: number | null;
  DescAndamento?: string | null;
  Natureza?: string | null;
  TipoPrenotacao?: string | null;
  DiasPrometidos?: number | null;
  DiasCorridos?: number | null;
  DiasAtraso?: number | null;
  SituacaoPrazo?: string | null;
  IsDevolucao?: boolean | null;
  IsRegistrado?: boolean | null;
  TextoNotaDevolucao?: string | null;
}

export async function createBiImport(fileName: string, totalRows: number, importedBy = 'Manual SSMS') {
  try {
    await requireAdmin();

    const record = await prisma.fiorixBiImport.create({
      data: {
        fileName,
        rowsCount: totalRows,
        importedBy,
        status: 'PROCESSING',
      },
    });

    return { success: true, importId: record.id };
  } catch (error: any) {
    console.error('Error creating BI import:', error);
    return { success: false, error: error.message || 'Erro ao criar registro de importacao' };
  }
}

export async function updateBiImportStatus(importId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
  try {
    await requireAdmin();

    if (status === 'FAILED') {
      await prisma.$transaction([
        prisma.fiorixBiData.deleteMany({ where: { importId } }),
        prisma.fiorixBiImport.update({
          where: { id: importId },
          data: { status, errorMessage },
        }),
      ]);
    } else {
      // Calcula uma vez os resumos do BI. Os graficos passam a consultar
      // milhares de linhas agregadas, em vez de reler todo o CSV importado.
      await refreshBiAggregatesForImport(importId);
      await prisma.fiorixBiImport.update({
        where: { id: importId },
        data: { status, errorMessage },
      });
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error updating import status:', error);
    return { success: false, error: error.message || 'Erro ao atualizar status da importacao' };
  }
}

export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
    await requireAdmin();

    if (!rows || rows.length === 0) {
      return { success: true, count: 0 };
    }

    const dataToInsert = rows.map((row) => {
      const parseDate = (value?: string | null) => {
        if (!value || value.trim() === '') return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const parseIntVal = (value: unknown) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = parseInt(String(value).replace(/\D/g, ''), 10);
        return Number.isNaN(parsed) ? null : parsed;
      };

      const parseBool = (value: unknown) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
          const lower = value.trim().toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'sim';
        }
        return false;
      };

      return {
        importId,
        protocolo: String(row.Protocolo || '').trim(),
        flagRecepcao: parseIntVal(row.FlagRecepcao),
        tipoSolicitacao: row.TipoSolicitacao ? String(row.TipoSolicitacao).trim() : null,
        idAndamento: row.IdAndamento ? BigInt(String(row.IdAndamento).replace(/\D/g, '') || 0) : null,
        dtProtocolo: parseDate(row.DtProtocolo),
        dtPrevisaoEntrega: parseDate(row.DtPrevisaoEntrega),
        dtAndamento: parseDate(row.DtAndamento),
        codProcessamento: parseIntVal(row.CodProcessamento),
        descAndamento: row.DescAndamento ? String(row.DescAndamento).trim() : null,
        natureza: row.Natureza ? String(row.Natureza).trim() : null,
        tipoPrenotacao: row.TipoPrenotacao ? String(row.TipoPrenotacao).trim() : null,
        diasPrometidos: parseIntVal(row.DiasPrometidos),
        diasCorridos: parseIntVal(row.DiasCorridos),
        diasAtraso: parseIntVal(row.DiasAtraso),
        situacaoPrazo: row.SituacaoPrazo ? String(row.SituacaoPrazo).trim() : null,
        isDevolucao: parseBool(row.IsDevolucao),
        isRegistrado: parseBool(row.IsRegistrado),
        textoNotaDevolucao: row.TextoNotaDevolucao ? String(row.TextoNotaDevolucao).trim() : null,
      };
    });

    await prisma.fiorixBiData.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    return { success: true, count: dataToInsert.length };
  } catch (error: any) {
    console.error('Error inserting BI batch:', error);
    return { success: false, error: error.message || 'Erro ao inserir lote de dados' };
  }
}

export async function getBiDashboardData(filters?: {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
}) {
  try {
    await requireSession();

    return {
      success: true,
      ...(await queryBiDashboardData(filters)),
    };
  } catch (error: any) {
    console.error('Error fetching BI dashboard data:', error);
    return { success: false, error: error.message || 'Erro ao carregar dados do dashboard' };
  }
}

export async function getBiImportsList() {
  try {
    await requireSession();

    const imports = await queryBiImportsList();
    return { success: true, imports };
  } catch (error: any) {
    console.error('Error fetching imports list:', error);
    return { success: false, error: error.message || 'Erro ao listar importacoes' };
  }
}

export async function deleteBiImport(importId: string) {
  try {
    await requireAdmin();

    await prisma.fiorixBiImport.delete({
      where: { id: importId },
    });

    revalidatePath('/admin/bi');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting import:', error);
    return { success: false, error: error.message || 'Erro ao excluir importacao' };
  }
}
