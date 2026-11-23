import { handleReurbApiError, parseAnoMesFromUrl, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import { carregarRegularizacoesReurb, montarRelatoriosReurb } from '@/lib/reurb/query-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const ctx = await requireReurbAccess();
    const { ano, mes } = parseAnoMesFromUrl(req.url);
    const { registros, demoMode } = await carregarRegularizacoesReurb(ctx.user.tenantId);
    const relatorio = montarRelatoriosReurb(registros, ano, mes, demoMode);

    return reurbJsonReply({
      ...relatorio,
      permissoes: {
        canExportJson: ctx.canExportJson,
        canConfirmImport: ctx.canConfirmImport,
        isReadOnly: ctx.isReadOnly,
      },
    });
  } catch (error) {
    return handleReurbApiError(error);
  }
}
