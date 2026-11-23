import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { listarExportacoesReurb } from '@/lib/reurb/export-service';
import { requireReurbAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await requireReurbAccess();
    const exportacoes = await listarExportacoesReurb(ctx.user.tenantId);
    return reurbJsonReply({
      exportacoes,
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
