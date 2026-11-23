import { z } from 'zod';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { executarGeracaoJsonReurb } from '@/lib/reurb/export-service';
import { requireReurbExportAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

const unitariaSchema = z.object({
  id: z.string().min(1).max(120),
  incluirArt69: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireReurbExportAccess(req);
    const body = await req.json().catch(() => null);
    const parsed = unitariaSchema.safeParse(body);
    if (!parsed.success) {
      return reurbJsonReply({ error: 'Parâmetros inválidos para exportação unitária.' }, 400);
    }

    const res = await executarGeracaoJsonReurb({
      ctx,
      ids: [parsed.data.id],
      tipo: 'UNITARIA',
      incluirArt69: Boolean(parsed.data.incluirArt69),
    });

    if (!res.ok) {
      return reurbJsonReply(res, res.statusHttp);
    }
    return reurbJsonReply(res, 200);
  } catch (error) {
    return handleReurbApiError(error);
  }
}
