import { handleReurbApiError, parseFiltrosFromUrl, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import { carregarRegularizacoesReurb, filtrarProcessosReurb } from '@/lib/reurb/query-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const ctx = await requireReurbAccess();
    const filtros = parseFiltrosFromUrl(req.url);
    const { registros, demoMode } = await carregarRegularizacoesReurb(ctx.user.tenantId);
    const resultado = filtrarProcessosReurb(registros, filtros);

    return reurbJsonReply({
      ...resultado,
      filtros,
      demoMode,
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
