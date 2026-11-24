import { z } from 'zod';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { executarGeracaoJsonReurb } from '@/lib/reurb/export-service';
import { requireReurbExportAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

const loteSchema = z.object({
  ids: z.array(z.string().min(1).max(120)).min(1).max(200),
  confirmarMisto: z.boolean().optional(),
  incluirArt69: z.boolean().optional(),
  individuais: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireReurbExportAccess(req);
    const body = await req.json().catch(() => null);
    const parsed = loteSchema.safeParse(body);
    if (!parsed.success) {
      return reurbJsonReply({ error: 'Parâmetros inválidos para geração em lote.' }, 400);
    }

    const res = await executarGeracaoJsonReurb({
      ctx,
      ids: parsed.data.ids,
      tipo: 'LOTE',
      confirmarMisto: Boolean(parsed.data.confirmarMisto),
      incluirArt69: Boolean(parsed.data.incluirArt69),
      individuais: Boolean(parsed.data.individuais),
    });

    if (!res.ok) {
      return reurbJsonReply(res, res.statusHttp);
    }
    return reurbJsonReply(res, 200);
  } catch (error) {
    return handleReurbApiError(error);
  }
}
