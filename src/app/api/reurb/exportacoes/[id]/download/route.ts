import { NextResponse } from 'next/server';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { obterArquivoExportacaoReurb } from '@/lib/reurb/export-service';
import { requireReurbAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const ctx = await requireReurbAccess();
    const tipoParam = new URL(req.url).searchParams.get('tipo');
    const tipoDownload = tipoParam === 'pendencias' ? 'pendencias' : 'json';

    const file = await obterArquivoExportacaoReurb({
      tenantId: ctx.user.tenantId,
      exportacaoId: context.params.id,
      tipoDownload,
    });

    if (!file) {
      return reurbJsonReply({ error: 'Arquivo de exportação não encontrado.' }, 404);
    }

    const safeFileName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(file.content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return handleReurbApiError(error);
  }
}
