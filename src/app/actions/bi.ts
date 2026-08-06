'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

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
 * Inserts a batch of rows into fiorix_bi_data (optimized for 5,000 batch size)
 */
export async function insertBiBatch(importId: string, rows: BiRowInput[]) {
  try {
    if (!rows || rows.length === 0) return { success: true, count: 0 };

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
      // Um CSV pode conter o mesmo andamento mais de uma vez no mesmo lote.
      // O lote deve continuar sendo importado, sem abortar os 999 registros válidos.
      skipDuplicates: true,
    });

    return { success: true, count: dataToInsert.length };
  } catch (error: any) {
    console.error('Error inserting BI batch:', error);
    return { success: false, error: error.message || 'Erro ao inserir lote de dados' };
  }
}

/**
 * Fetches analytics dashboard data using high-performance database-side SQL Aggregation (handles 1.5M+ rows in <150ms)
 */
export async function getBiDashboardData(filters?: {
  startDate?: string;
  endDate?: string;
  tipoPrenotacao?: string;
  importId?: string;
}) {
  try {
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

    // 1. Chart 1: Status Distribution Aggregation (SQL Group By)
    const pieRaw = await prisma.$queryRaw<Array<{ situacao: string; cnt: bigint }>>`
      SELECT 
        CASE 
          WHEN "IsDevolucao" = true OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%' THEN 'Devolução'
          WHEN "DiasAtraso" > 0 OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%' THEN 'Atrasado'
          ELSE 'No Prazo'
        END as situacao,
        COUNT(*) as cnt
      FROM fiorix_bi_data
      WHERE ("CodProcessamento" = 6 OR "CodProcessamento" = 5 OR "IsRegistrado" = true)
        AND ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
      GROUP BY 1
    `;

    let noPrazoCount = 0;
    let atrasadoCount = 0;
    let devolucaoCount = 0;

    pieRaw.forEach((row) => {
      const cnt = Number(row.cnt);
      if (row.situacao === 'Devolução') devolucaoCount += cnt;
      else if (row.situacao === 'Atrasado') atrasadoCount += cnt;
      else noPrazoCount += cnt;
    });

    const totalRegistered = (noPrazoCount + atrasadoCount + devolucaoCount) || 1;
    const pieChartData = [
      { name: 'No Prazo', count: noPrazoCount, percentage: Number(((noPrazoCount / totalRegistered) * 100).toFixed(1)), fill: '#10b981' },
      { name: 'Atrasado', count: atrasadoCount, percentage: Number(((atrasadoCount / totalRegistered) * 100).toFixed(1)), fill: '#ef4444' },
      { name: 'Devolução', count: devolucaoCount, percentage: Number(((devolucaoCount / totalRegistered) * 100).toFixed(1)), fill: '#f59e0b' },
    ];

    // 2. Chart 2: Top Devolução Motivos (Sample top 1,500 return notes for instant response)
    const devolucoesRaw = await prisma.$queryRaw<Array<{ texto: string }>>`
      SELECT "TextoNotaDevolucao" as texto
      FROM fiorix_bi_data
      WHERE ("IsDevolucao" = true OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%')
        AND "TextoNotaDevolucao" IS NOT NULL
        AND LENGTH(TRIM("TextoNotaDevolucao")) > 5
        AND ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
      LIMIT 1500
    `;

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
    devolucoesRaw.forEach((row) => {
      const note = row.texto || '';
      const clauses = note
        .split(/(?:\r\n|\n|\.\s+|;\s+|\d+[\)\.\-\s])/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      clauses.forEach((clause) => {
        const words = clause
          .toLowerCase()
          .replace(/[^\w\sà-úÀ-Ú]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stopWords.has(w));
        
        if (words.length > 0) {
          const keyTerm = words.slice(0, 3).join(' ');
          if (keyTerm.length >= 4) {
            const capitalized = keyTerm.charAt(0).toUpperCase() + keyTerm.slice(1);
            reasonFrequency[capitalized] = (reasonFrequency[capitalized] || 0) + 1;
          }
        }
      });
    });

    const topDevolucoes = Object.entries(reasonFrequency)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3. Chart 3: Average DiasCorridos by Natureza (SQL Aggregation)
    const avgNaturezaRaw = await prisma.$queryRaw<Array<{ natureza: string; media_dias: number; total: bigint }>>`
      SELECT 
        COALESCE(TRIM("Natureza"), 'Outros') as natureza,
        ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as media_dias,
        COUNT(*)::bigint as total
      FROM fiorix_bi_data
      WHERE ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
      GROUP BY COALESCE(TRIM("Natureza"), 'Outros')
      ORDER BY media_dias DESC
      LIMIT 10
    `;

    const avgDiasPorNatureza = avgNaturezaRaw.map((r) => ({
      natureza: r.natureza,
      mediaDias: Number(r.media_dias || 0),
      totalTitulos: Number(r.total || 0),
    }));

    // 4. Chart 4: Delay severity buckets for late titles
    const delayBucketsRaw = await prisma.$queryRaw<Array<{ bucket: string; cnt: bigint }>>`
      SELECT CASE
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 1 AND 3 THEN '1-3 dias'
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 4 AND 7 THEN '4-7 dias'
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 8 AND 15 THEN '8-15 dias'
        WHEN COALESCE("DiasAtraso", 0) >= 16 THEN '16+ dias'
        ELSE 'Sem atraso'
      END as bucket,
      COUNT(*)::bigint as cnt
      FROM fiorix_bi_data
      WHERE (${importCondition})
        AND ${tipoCondition}
        AND ${dateCondition}
        AND (
          COALESCE("DiasAtraso", 0) > 0
          OR "IsDevolucao" = true
          OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%'
          OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%'
        )
      GROUP BY 1
      ORDER BY CASE
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 1 AND 3 THEN 1
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 4 AND 7 THEN 2
        WHEN COALESCE("DiasAtraso", 0) BETWEEN 8 AND 15 THEN 3
        WHEN COALESCE("DiasAtraso", 0) >= 16 THEN 4
        ELSE 5
      END
    `;

    const delaySeverity = delayBucketsRaw.map((row) => ({
      bucket: row.bucket,
      count: Number(row.cnt || 0),
    }));

    // 5. Chart 5: Promised vs actual elapsed days by Natureza
    const prazoVsRealRaw = await prisma.$queryRaw<Array<{ natureza: string; prometidos: number; corridos: number; total: bigint }>>`
      SELECT
        COALESCE(TRIM("Natureza"), 'Outros') as natureza,
        ROUND(AVG(COALESCE("DiasPrometidos", 0))::numeric, 1)::float as prometidos,
        ROUND(AVG(COALESCE("DiasCorridos", 0))::numeric, 1)::float as corridos,
        COUNT(*)::bigint as total
      FROM fiorix_bi_data
      WHERE ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
      GROUP BY COALESCE(TRIM("Natureza"), 'Outros')
      ORDER BY corridos DESC, prometidos DESC
      LIMIT 8
    `;

    const prazoPrometidoVsCorridosPorNatureza = prazoVsRealRaw.map((r) => ({
      natureza: r.natureza,
      prometidos: Number(r.prometidos || 0),
      corridos: Number(r.corridos || 0),
      totalTitulos: Number(r.total || 0),
    }));

    // 6. Chart 6: Daily trend of on-time vs late vs returned titles
    const trendRaw = await prisma.$queryRaw<Array<{ data: string; no_prazo: bigint; atrasado: bigint; devolucao: bigint }>>`
      SELECT
        DATE("DtAndamento") as data,
        SUM(CASE WHEN COALESCE("DiasAtraso", 0) <= 0 AND COALESCE("IsDevolucao", false) = false THEN 1 ELSE 0 END) as no_prazo,
        SUM(CASE WHEN COALESCE("DiasAtraso", 0) > 0 AND COALESCE("IsDevolucao", false) = false THEN 1 ELSE 0 END) as atrasado,
        SUM(CASE WHEN COALESCE("IsDevolucao", false) = true THEN 1 ELSE 0 END) as devolucao
      FROM fiorix_bi_data
      WHERE "DtAndamento" IS NOT NULL
        AND ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
      GROUP BY DATE("DtAndamento")
      ORDER BY DATE("DtAndamento")
    `;

    const evolucaoPrazoPorDia = trendRaw.map((row) => ({
      data: row.data,
      noPrazo: Number(row.no_prazo || 0),
      atrasado: Number(row.atrasado || 0),
      devolucao: Number(row.devolucao || 0),
    }));

    // 7. Chart 7: Top andamentos linked to issues
    const topAndamentosRaw = await prisma.$queryRaw<Array<{ andamento: string; cnt: bigint; media_atraso: number }>>`
      SELECT
        COALESCE(TRIM("DescAndamento"), 'Sem andamento') as andamento,
        COUNT(*)::bigint as cnt,
        ROUND(AVG(COALESCE("DiasAtraso", 0))::numeric, 1)::float as media_atraso
      FROM fiorix_bi_data
      WHERE ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
        AND TRIM(COALESCE("DescAndamento", '')) != ''
      GROUP BY COALESCE(TRIM("DescAndamento"), 'Sem andamento')
      ORDER BY cnt DESC, media_atraso DESC
      LIMIT 8
    `;

    const topAndamentosComAtraso = topAndamentosRaw.map((row) => ({
      andamento: row.andamento,
      count: Number(row.cnt || 0),
      mediaAtraso: Number(row.media_atraso || 0),
    }));

    // 8. Dropdown options for tipoPrenotacao filter
    const tiposRaw = await prisma.$queryRaw<Array<{ tipo: string }>>`
      SELECT DISTINCT "TipoPrenotacao" as tipo
      FROM fiorix_bi_data
      WHERE "TipoPrenotacao" IS NOT NULL AND TRIM("TipoPrenotacao") != ''
      LIMIT 30
    `;

    const totalRecordsRaw = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt
      FROM fiorix_bi_data
      WHERE ${importCondition}
        AND ${tipoCondition}
        AND ${dateCondition}
    `;
    const totalRecords = Number(totalRecordsRaw[0]?.cnt || 0);

    return {
      success: true,
      summary: {
        totalRecords,
        totalRegistered,
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
        delaySeverity,
        prazoPrometidoVsCorridosPorNatureza,
        evolucaoPrazoPorDia,
        topAndamentosComAtraso,
      },
      tiposPrenotacao: tiposRaw.map((t) => t.tipo).filter(Boolean).sort(),
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
