'use server';

import { revalidatePath } from 'next/cache';

import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';
import { prisma } from '@/lib/prisma';

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
    const record = await prisma.fiorixBiImport.create({
      data: {
        fileName,
        rowsCount: totalRows,
        importedBy,
      },
    });

    return { success: true, importId: record.id };
  } catch (error: any) {
    console.error('Error creating BI import:', error);
    return { success: false, error: error.message || 'Erro ao criar registro de importacao' };
  }
}

export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
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
    const imports = await queryBiImportsList();
    return { success: true, imports };
  } catch (error: any) {
    console.error('Error fetching imports list:', error);
    return { success: false, error: error.message || 'Erro ao listar importacoes' };
  }
}

export async function deleteBiImport(importId: string) {
  try {
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
