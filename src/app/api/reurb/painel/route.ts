import { handleReurbApiError, parseAnoMesFromUrl, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import { calcularPainelReurb, carregarRegularizacoesReurb } from '@/lib/reurb/query-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const ctx = await requireReurbAccess();
    const { ano, mes } = parseAnoMesFromUrl(req.url);
    const { registros, demoMode } = await carregarRegularizacoesReurb(ctx.user.tenantId);
    const painel = calcularPainelReurb(registros, ano, mes, demoMode);

    return reurbJsonReply({
      ...painel,
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
