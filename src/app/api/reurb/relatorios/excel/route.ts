import { NextResponse } from 'next/server';
import { handleReurbApiError, parseAnoMesFromUrl, parseFiltrosFromUrl } from '@/lib/reurb/api-helpers';
import { gerarBufferExcelReurb } from '@/lib/reurb/excel-export';
import { registrarAuditExcelReurb } from '@/lib/reurb/export-service';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import {
  calcularPainelReurb,
  carregarRegularizacoesReurb,
  filtrarProcessosReurb,
  montarRelatoriosReurb,
} from '@/lib/reurb/query-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const ctx = await requireReurbAccess();
    const { ano, mes } = parseAnoMesFromUrl(req.url);
    const filtros = parseFiltrosFromUrl(req.url);
    const { registros, demoMode } = await carregarRegularizacoesReurb(ctx.user.tenantId);

    const painel = calcularPainelReurb(registros, ano, mes, demoMode);
    const relatorio = montarRelatoriosReurb(registros, ano, mes, demoMode);
    const filtrados = filtrarProcessosReurb(registros, {
      ...filtros,
      ano: filtros.dataDe || filtros.dataAte ? null : ano,
      mes: filtros.dataDe || filtros.dataAte ? null : mes,
      page: 1,
      pageSize: 5000,
    });

    const buffer = gerarBufferExcelReurb({
      relatorio,
      painel,
      processos: filtrados.itens,
    });

    await registrarAuditExcelReurb({
      ctx,
      ano,
      mes,
      totalRegistros: filtrados.itens.length,
    });

    const mesSuffix = mes === 'todos' ? 'ano_inteiro' : String(mes).padStart(2, '0');
    const safeName = `fiorix_reurb_relatorio_${ano}_${mesSuffix}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return handleReurbApiError(error);
  }
}
