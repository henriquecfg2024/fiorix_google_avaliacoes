import { z } from 'zod';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { executarPreviaExportacao } from '@/lib/reurb/export-service';
import { requireReurbAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

const previaSchema = z.object({
  ids: z.array(z.string().min(1).max(120)).min(1).max(200),
  incluirArt69: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireReurbAccess();
    const body = await req.json().catch(() => null);
    const parsed = previaSchema.safeParse(body);
    if (!parsed.success) {
      return reurbJsonReply({ error: 'Selecione entre 1 e 200 regularizações para a prévia.' }, 400);
    }

    const previa = await executarPreviaExportacao({
      tenantId: ctx.user.tenantId,
      ids: [...new Set(parsed.data.ids)],
      incluirArt69: Boolean(parsed.data.incluirArt69),
    });

    return reurbJsonReply(previa, 200);
  } catch (error) {
    return handleReurbApiError(error);
  }
}
