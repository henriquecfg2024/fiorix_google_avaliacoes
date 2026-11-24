import type { NextRequest } from 'next/server';
import { handleReurbApiError, reurbJsonReply } from '@/lib/reurb/api-helpers';
import { listarExportacoesReurb } from '@/lib/reurb/export-service';
import { requireReurbAccess } from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

function parseOptionalIntParam(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireReurbAccess();
    const { searchParams } = new URL(request.url);
    const ano = parseOptionalIntParam(searchParams.get('ano'), 2000, 2100);
    const mes = parseOptionalIntParam(searchParams.get('mes'), 1, 12);
    const limit = parseOptionalIntParam(searchParams.get('limit'), 1, 500) ?? 200;

    const exportacoes = await listarExportacoesReurb(ctx.user.tenantId, {
      ano,
      mes,
      limit,
    });
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
