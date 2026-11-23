import { z } from 'zod';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { confirmarImportacaoOnrReurb } from '@/lib/reurb/export-service';
import { requireReurbConfirmImportAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  protocoloOnrExterno: z.string().max(120).optional().nullable(),
  observacao: z.string().max(500).optional().nullable(),
});

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const ctx = await requireReurbConfirmImportAccess(req);
    const body = await req.json().catch(() => ({}));
    const parsed = confirmSchema.safeParse(body || {});
    if (!parsed.success) {
      return reurbJsonReply({ error: 'Parâmetros de confirmação inválidos.' }, 400);
    }

    const res = await confirmarImportacaoOnrReurb({
      ctx,
      exportacaoId: context.params.id,
      protocoloOnrExterno: parsed.data.protocoloOnrExterno,
      observacao: parsed.data.observacao,
    });

    if (!res.ok) {
      return reurbJsonReply(res, res.statusHttp);
    }
    return reurbJsonReply(res, 200);
  } catch (error) {
    return handleReurbApiError(error);
  }
}
