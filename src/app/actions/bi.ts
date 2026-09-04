'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

import { queryBiDashboardData, queryBiImportsList, invalidateBiImportsCache } from '@/lib/bi-dashboard';
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

const IMPORT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 40_000 } as const;

async function configureImportTransaction(tx: Prisma.TransactionClient) {
  // Impede que um lock de DDL ou uma consulta congestionada deixe a Server
  // Action aberta indefinidamente na Vercel.
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10000ms'");
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30000ms'");
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

    invalidateBiImportsCache(user.tenantId);
    return { success: true, importId: record.id };
  } catch (error: any) {
    console.error('Error creating BI import:', error);
    return { success: false, error: error?.message || 'Erro ao criar registro de importação.' };
  }
}

export async function updateBiImportStatus(importId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');
    
    // Validar se a importação pertence ao tenant
    const targetImport = await prisma.$transaction(async (tx) => {
      await configureImportTransaction(tx);
      return tx.fiorixBiImport.findFirst({
        where: { id: importId, tenantId: user.tenantId },
      });
    }, IMPORT_TRANSACTION_OPTIONS);
    if (!targetImport) return { success: false, error: 'Importação não encontrada para este cartório.' };

    if (status === 'FAILED') {
      await prisma.$transaction(async (tx) => {
        await configureImportTransaction(tx);
        await tx.fiorixBiData.deleteMany({ where: { importId, tenantId: user.tenantId } });
        await tx.fiorixBiImport.update({
          where: { id: importId },
          data: { status, errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : null },
        });
      }, IMPORT_TRANSACTION_OPTIONS);
    } else {
      try {
        await refreshBiAggregatesForImport(importId, user.tenantId);
      } catch (aggError: any) {
        console.warn('[BI Import] Falha na agregação opcional (não-fatal):', aggError?.message || String(aggError));
      }

      await prisma.$transaction(async (tx) => {
        await configureImportTransaction(tx);
        await tx.fiorixBiImport.update({
          where: { id: importId },
          data: { status: 'SUCCESS', errorMessage: null },
        });
      }, IMPORT_TRANSACTION_OPTIONS);
    }

    invalidateBiImportsCache(user.tenantId);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating import status:', error);
    return { success: false, error: error?.message || 'Erro ao atualizar status da importação.' };
  }
}

export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');

    // Validar se a importação pertence ao tenant
    if (!rows || rows.length === 0) {
      return { success: true, count: 0 };
    }

    const parseDate = (value?: string | null) => {
      if (!value || typeof value !== 'string') return null;
      const v = value.trim();
      if (!v) return null;

      // DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
      if (v.includes('/')) {
        const parts = v.split(' ');
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          const [d, m, y] = dateParts;
          const timePart = parts[1] || '00:00:00';
          const iso = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`;
          const parsed = new Date(iso);
          if (!Number.isNaN(parsed.getTime())) return parsed;
        }
      }

      // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
      if (v.includes('-')) {
        const iso = v.replace(' ', 'T');
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }

      const fallback = new Date(v);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
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

    const parseBigIntVal = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null;
      const cleaned = String(value).replace(/\D/g, '');
      if (!cleaned) return null;
      try {
        const val = BigInt(cleaned);
        return val === 0n ? null : val;
      } catch {
        return null;
      }
    };

    const seenAndamento = new Set<string>();
    const dataToInsert: Prisma.FiorixBiDataCreateManyInput[] = [];

    for (const row of rows) {
      const idAndamento = parseBigIntVal(row.IdAndamento);
      if (idAndamento !== null) {
        const key = idAndamento.toString();
        if (seenAndamento.has(key)) continue;
        seenAndamento.add(key);
      }

      dataToInsert.push({
        importId,
        tenantId: user.tenantId,
        protocolo: String(row.Protocolo || '').trim(),
        flagRecepcao: parseIntVal(row.FlagRecepcao),
        tipoSolicitacao: row.TipoSolicitacao ? String(row.TipoSolicitacao).trim() : null,
        idAndamento,
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
      });
    }

    const targetImport = await prisma.fiorixBiImport.findFirst({
      where: { id: importId, tenantId: user.tenantId },
      select: { id: true },
    });
      if (!targetImport) {
        throw new Error('Importação não encontrada para este cartório.');
      }

    await prisma.fiorixBiData.createMany({ data: dataToInsert });

    return { success: true, count: dataToInsert.length };
  } catch (error: any) {
    console.error('Error inserting BI batch:', error);
    return { success: false, error: error?.message || 'Erro ao inserir lote de dados.' };
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

    invalidateBiImportsCache(user.tenantId);
    revalidatePath('/admin/bi');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting import:', error);
    return { success: false, error: error?.message || 'Erro ao excluir importação.' };
  }
}

