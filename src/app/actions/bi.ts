'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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

/**
 * Creates a new BI import record in fiorix_bi_imports
 */
export async function createBiImport(fileName: string, totalRows: number, importedBy: string = 'Manual SSMS') {
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
    return { success: false, error: error.message || 'Erro ao criar registro de importação' };
  }
}

/**
 * Inserts a batch of rows into fiorix_bi_data
 */
export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
    const dataToInsert = rows.map((r) => {
      const parseDate = (val?: string | null) => {
        if (!val || val.trim() === '') return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const parseIntVal = (val: any) => {
        if (val === null || val === undefined || val === '') return null;
        const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
        return isNaN(parsed) ? null : parsed;
      };

      const parseBool = (val: any) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'sim';
        }
        return false;
      };

      return {
        importId,
        protocolo: String(r.Protocolo || '').trim(),
        flagRecepcao: parseIntVal(r.FlagRecepcao),
        tipoSolicitacao: r.TipoSolicitacao ? String(r.TipoSolicitacao).trim() : null,
        idAndamento: r.IdAndamento ? BigInt(String(r.IdAndamento).replace(/\D/g, '') || 0) : null,
        dtProtocolo: parseDate(r.DtProtocolo),
        dtPrevisaoEntrega: parseDate(r.DtPrevisaoEntrega),
        dtAndamento: parseDate(r.DtAndamento),
        codProcessamento: parseIntVal(r.CodProcessamento),
        descAndamento: r.DescAndamento ? String(r.DescAndamento).trim() : null,
        natureza: r.Natureza ? String(r.Natureza).trim() : null,
        tipoPrenotacao: r.TipoPrenotacao ? String(r.TipoPrenotacao).trim() : null,
        diasPrometidos: parseIntVal(r.DiasPrometidos),
        diasCorridos: parseIntVal(r.DiasCorridos),
        diasAtraso: parseIntVal(r.DiasAtraso),
        situacaoPrazo: r.SituacaoPrazo ? String(r.SituacaoPrazo).trim() : null,
        isDevolucao: parseBool(r.IsDevolucao),
        isRegistrado: parseBool(r.IsRegistrado),
        textoNotaDevolucao: r.TextoNotaDevolucao ? String(r.TextoNotaDevolucao).trim() : null,
      };
    });

    await prisma.fiorixBiData.createMany({
      data: dataToInsert,
    });

    return { success: true, count: dataToInsert.length };
  } catch (error: any) {
    console.error('Error inserting BI batch:', error);
    return { success: false, error: error.message || 'Erro ao inserir lote de dados' };
  }
}

/**
 * Fetches analytics dashboard data from fiorix_bi_data
 */
export async function getBiDashboardData(filters?: {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
}) {
  try {
    const whereClause: any = {};

    if (filters?.importId && filters.importId !== 'ALL') {
      whereClause.importId = filters.importId;
    }

    if (filters?.tipoPrenotacao && filters.tipoPrenotacao !== 'ALL') {
      whereClause.tipoPrenotacao = filters.tipoPrenotacao;
    }

    if (filters?.startDate || filters?.endDate) {
      whereClause.dtAndamento = {};
      if (filters.startDate) {
        whereClause.dtAndamento.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Set to end of day
        const endD = new Date(filters.endDate);
        endD.setHours(23, 59, 59, 999);
        whereClause.dtAndamento.lte = endD;
      }
    }

    // Fetch records
    const records = await prisma.fiorixBiData.findMany({
      where: whereClause,
      select: {
        id: true,
        protocolo: true,
        codProcessamento: true,
        descAndamento: true,
        natureza: true,
        tipoPrenotacao: true,
        diasPrometidos: true,
        diasCorridos: true,
        diasAtraso: true,
        situacaoPrazo: true,
        isDevolucao: true,
        isRegistrado: true,
        textoNotaDevolucao: true,
        dtAndamento: true,
        dtPrevisaoEntrega: true,
      },
    });

    // 1. Chart 1: Deadline status for CodProcessamento = 6 (Registrado)
    // Filter only CodProcessamento = 6 (or isRegistrado = true)
    const registeredRecords = records.filter(
      (r) => r.codProcessamento === 6 || r.isRegistrado === true
    );

    let noPrazoCount = 0;
    let atrasadoCount = 0;
    let devolucaoCount = 0;

    registeredRecords.forEach((r) => {
      const situacao = (r.situacaoPrazo || '').toLowerCase();
      if (r.isDevolucao || situacao.includes('devolucao')) {
        devolucaoCount++;
      } else if ((r.diasAtraso && r.diasAtraso > 0) || situacao.includes('atrasad')) {
        atrasadoCount++;
      } else {
        noPrazoCount++;
      }
    });

    const totalRegistered = registeredRecords.length || 1;
    const pieChartData = [
      { name: 'No Prazo', count: noPrazoCount, percentage: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)), fill: '#10b981' },
      { name: 'Atrasado', count: atrasadoCount, percentage: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)), fill: '#ef4444' },
      { name: 'Devolução', count: devolucaoCount, percentage: Number(((devolucaoCount / totalRegistered) * 100).toFixed(1)), fill: '#f59e0b' },
    ];

    // 2. Chart 2: Top 10 Return Reasons from TextoNotaDevolucao
    const returnNotes = records
      .filter((r) => r.isDevolucao || (r.textoNotaDevolucao && r.textoNotaDevolucao.trim().length > 0))
      .map((r) => r.textoNotaDevolucao || '')
      .filter(Boolean);

    // Extract top phrases/keywords
    const stopWords = new Set([
      'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no',
      'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'seu', 'sua', 'ou',
      'quando', 'muito', 'nos', 'já', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela',
      'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'você',
      'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'numa', 'cujo', 'quais', 'item', 'conforme',
      'nota', 'devolução', 'andamento', 'registro', 'prenotação', 'solicitação', 'favor', 'apresentar',
      'deverá', 'ser', 'certidão', 'imóvel', 'documento', 'documentos', 'deve', 'constar', 'termos',
      'artigo', 'art', 'lei', 'provimento', 'exigência', 'atender'
    ]);

    const reasonFrequency: Record<string, number> = {};

    returnNotes.forEach((note) => {
      // Split by common separators (semicolon, period, newline, numbered items)
      const clauses = note
        .split(/(?:\r\n|\n|\.\s+|;\s+|\d+[\)\.\-\s])/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      if (clauses.length > 0) {
        clauses.forEach((clause) => {
          // Normalize clause to key concept (first 5 words or cleaned title)
          const words = clause
            .toLowerCase()
            .replace(/[^\w\sà-úÀ-Ú]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3 && !stopWords.has(w));
          
          if (words.length > 0) {
            // Take meaningful keyword pair or single main term
            const keyTerm = words.slice(0, 3).join(' ');
            if (keyTerm.length >= 4) {
              const capitalized = keyTerm.charAt(0).toUpperCase() + keyTerm.slice(1);
              reasonFrequency[capitalized] = (reasonFrequency[capitalized] || 0) + 1;
            }
          }
        });
      }
    });

    const topDevolucoes = Object.entries(reasonFrequency)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3. Chart 3: Average DiasCorridos by Natureza
    const naturezaStats: Record<string, { totalDays: number; count: number }> = {};

    records.forEach((r) => {
      const nat = (r.natureza || 'Outros').trim();
      const dias = r.diasCorridos ?? 0;
      if (!naturezaStats[nat]) {
        naturezaStats[nat] = { totalDays: 0, count: 0 };
      }
      naturezaStats[nat].totalDays += dias;
      naturezaStats[nat].count += 1;
    });

    const avgDiasPorNatureza = Object.entries(naturezaStats)
      .map(([natureza, stat]) => ({
        natureza,
        mediaDias: Number((stat.totalDays / stat.count).toFixed(1)),
        totalTitulos: stat.count,
      }))
      .sort((a, b) => b.mediaDias - a.mediaDias)
      .slice(0, 10);

    // Available TipoPrenotacao options for filter dropdown
    const tiposPrenotacaoSet = new Set<string>();
    records.forEach((r) => {
      if (r.tipoPrenotacao) tiposPrenotacaoSet.add(r.tipoPrenotacao);
    });

    return {
      success: true,
      summary: {
        totalRecords: records.length,
        totalRegistered: registeredRecords.length,
        noPrazoCount,
        atrasadoCount,
        devolucaoCount,
        percentNoPrazo: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)),
        percentAtrasado: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)),
        percentDevolucao: Number(((devolucaoCount / totalRegistered) * 100).toFixed(1)),
      },
      charts: {
        pieChartData,
        topDevolucoes,
        avgDiasPorNatureza,
      },
      tiposPrenotacao: Array.from(tiposPrenotacaoSet).sort(),
    };
  } catch (error: any) {
    console.error('Error fetching BI dashboard data:', error);
    return { success: false, error: error.message || 'Erro ao carregar dados do dashboard' };
  }
}

/**
 * Gets import history list
 */
export async function getBiImportsList() {
  try {
    const imports = await prisma.fiorixBiImport.findMany({
      orderBy: { importedAt: 'desc' },
      take: 20,
    });
    return { success: true, imports };
  } catch (error: any) {
    console.error('Error fetching imports list:', error);
    return { success: false, error: error.message || 'Erro ao listar importações' };
  }
}

/**
 * Deletes a specific import and its associated data
 */
export async function deleteBiImport(importId: string) {
  try {
    await prisma.fiorixBiImport.delete({
      where: { id: importId },
    });
    revalidatePath('/admin/bi');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting import:', error);
    return { success: false, error: error.message || 'Erro ao excluir importação' };
  }
}
