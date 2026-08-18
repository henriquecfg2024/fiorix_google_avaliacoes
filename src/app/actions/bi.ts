'use server';

import { revalidatePath } from 'next/cache';

import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';
import { refreshBiAggregatesForImport } from '@/lib/bi-aggregates';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';

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
    const user = await requireRole('ADMIN', 'MASTER');
    const record = await prisma.fiorixBiImport.create({
      data: {
        fileName,
        rowsCount: totalRows,
        importedBy,
        tenantId: user.tenantId,
        status: 'PROCESSING',
      },
    });

    return { success: true, importId: record.id };
  } catch (error: any) {
    console.error('Error creating BI import:', error);
    return { success: false, error: 'Erro ao criar registro de importação.' };
  }
}

export async function updateBiImportStatus(importId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');
    
    // Validar se a importação pertence ao tenant
    const targetImport = await prisma.fiorixBiImport.findFirst({
      where: { id: importId, tenantId: user.tenantId },
    });
    if (!targetImport) {
      return { success: false, error: 'Importação não encontrada para este cartório.' };
    }

    if (status === 'FAILED') {
      await prisma.$transaction([
        prisma.fiorixBiData.deleteMany({ where: { importId, tenantId: user.tenantId } }),
        prisma.fiorixBiImport.update({
          where: { id: importId },
          data: { status, errorMessage },
        }),
      ]);
    } else {
      try {
        await refreshBiAggregatesForImport(importId, user.tenantId);
        await prisma.fiorixBiImport.update({
          where: { id: importId },
          data: { status, errorMessage },
        });
      } catch (aggError: any) {
        console.error('Error refreshing aggregates, marking import as FAILED:', aggError);
        const failMessage = aggError?.message || String(aggError);
        await prisma.$transaction([
          prisma.fiorixBiData.deleteMany({ where: { importId, tenantId: user.tenantId } }),
          prisma.fiorixBiImport.update({
            where: { id: importId },
            data: { status: 'FAILED', errorMessage: `Erro de agregação: ${failMessage}` },
          }),
        ]);
        return { success: false, error: `Erro de agregação: ${failMessage}` };
      }
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error updating import status:', error);
    return { success: false, error: 'Erro ao atualizar status da importação.' };
  }
}

export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');

    // Validar se a importação pertence ao tenant
    const targetImport = await prisma.fiorixBiImport.findFirst({
      where: { id: importId, tenantId: user.tenantId },
    });
    if (!targetImport) {
      return { success: false, error: 'Importação não encontrada para este cartório.' };
    }

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
        tenantId: user.tenantId,
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
    return { success: false, error: 'Erro ao inserir lote de dados.' };
  }
}

export async function getBiDashboardData(filters?: {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
}) {
  try {
    const user = await requireAuth();
    return {
      success: true,
      ...(await queryBiDashboardData(user.tenantId, filters)),
    };
  } catch (error: any) {
    console.error('Error fetching BI dashboard data:', error);
    return { success: false, error: 'Erro ao carregar dados do dashboard.' };
  }
}

export async function getBiImportsList() {
  try {
    const user = await requireAuth();
    const imports = await queryBiImportsList(user.tenantId);
    return { success: true, imports };
  } catch (error: any) {
    console.error('Error fetching imports list:', error);
    return { success: false, error: 'Erro ao listar importações.' };
  }
}

export async function deleteBiImport(importId: string) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');
    await prisma.fiorixBiImport.deleteMany({
      where: { id: importId, tenantId: user.tenantId },
    });

    revalidatePath('/admin/bi');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting import:', error);
    return { success: false, error: 'Erro ao excluir importação.' };
  }
}

