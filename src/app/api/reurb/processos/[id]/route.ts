import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { validarRegularizacaoParaOnr } from '@/lib/reurb/onr-exporter';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import { carregarRegularizacaoPorId } from '@/lib/reurb/query-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  try {
    const ctx = await requireReurbAccess();
    const { registro, demoMode } = await carregarRegularizacaoPorId(
      ctx.user.tenantId,
      context.params.id
    );
    if (!registro) {
      return reurbJsonReply({ error: 'Processo REURB não encontrado.' }, 404);
    }

    const validacao = validarRegularizacaoParaOnr(registro, { incluirArt69: false });
    return reurbJsonReply({
      registro,
      validacaoOnr: validacao,
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
