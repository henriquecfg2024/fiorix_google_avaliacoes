import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { validarRegularizacaoParaOnr } from '@/lib/reurb/onr-exporter';
import { requireReurbAccess } from '@/lib/reurb/permissions';
import {
  carregarRegularizacaoPorId,
  sanitizarDetalheRegularizacaoParaPerfil,
} from '@/lib/reurb/query-service';

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

    const isMaster = String(ctx.user.role).toUpperCase() === 'MASTER';
    const registroVisivel = sanitizarDetalheRegularizacaoParaPerfil(registro, isMaster);
    const validacao = validarRegularizacaoParaOnr(registro, { incluirArt69: false });
    const validacaoVisivel = isMaster
      ? validacao
      : {
          apto: validacao.apto,
          registroOnr: null,
          issues: [],
          bloqueios: validacao.bloqueios,
          avisos: validacao.avisos,
        };

    return reurbJsonReply({
      registro: registroVisivel,
      validacaoOnr: validacaoVisivel,
      canViewTechnicalDetails: isMaster,
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
