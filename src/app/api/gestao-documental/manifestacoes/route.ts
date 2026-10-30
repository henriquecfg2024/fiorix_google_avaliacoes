import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireManifestacaoAccess, DocumentAccessError } from '@/lib/documental/access';
import { listarManifestacoesQuery, manifestacaoInput } from '@/lib/documental/contracts';
import {
  ManifestacaoError,
  finalizarManifestacao,
  importarFilaLocal,
  listarManifestacoes,
  obterManifestacao,
  removerFichaEmConferencia,
  salvarFichaEmConferencia,
} from '@/lib/documental/manifestacoes';

export const dynamic = 'force-dynamic';

// Formulário + texto da manifestação; inclui a importação da fila antiga do navegador (até 200 fichas)
const LIMITE_CORPO = 4 * 1024 * 1024;

const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

function errorResponse(error: unknown) {
  if (error instanceof DocumentAccessError || error instanceof ManifestacaoError) return reply({ error: error.message }, error.status);
  const msg = String((error as { message?: string })?.message || '');
  if (msg.includes('DocumentManifestacao') && msg.includes('does not exist')) {
    return reply({ error: 'O arquivo de Manifestações ainda não foi instalado no banco de dados.' }, 503);
  }
  console.error('[MANIFESTACOES]', msg);
  return reply({ error: 'Serviço de Manifestações indisponível no momento.' }, 503);
}

export async function GET(req: Request) {
  try {
    const user = await requireManifestacaoAccess();
    const params = new URL(req.url).searchParams;
    const id = params.get('id');
    if (id !== null) {
      if (!z.string().uuid().safeParse(id).success) return reply({ error: 'Manifestação inválida.' }, 400);
      return reply({ manifestacao: await obterManifestacao(user.tenantId, id) });
    }
    const filtros = listarManifestacoesQuery.safeParse(Object.fromEntries(params));
    if (!filtros.success) return reply({ error: 'Filtros inválidos.' }, 400);
    return reply(await listarManifestacoes(user.tenantId, {
      ...filtros.data,
      busca: filtros.data.busca || undefined,
      escrevente: filtros.data.escrevente || undefined,
    }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Origem inválida.' }, 403);
    const user = await requireManifestacaoAccess();
    const raw = await req.text();
    if (raw.length > LIMITE_CORPO) return reply({ error: 'Formulário grande demais.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Requisição inválida.' }, 400); }
    const parsed = manifestacaoInput.safeParse(body);
    if (!parsed.success) return reply({ error: 'Dados da manifestação inválidos.' }, 400);
    const entrada = parsed.data;
    const usuario = { id: user.id, name: user.name, email: user.email };

    if (entrada.acao === 'salvar_fila') {
      const ficha = await salvarFichaEmConferencia(user.tenantId, usuario, entrada);
      return reply({ ficha });
    }
    if (entrada.acao === 'finalizar') {
      const manifestacao = await finalizarManifestacao(user.tenantId, usuario, entrada);
      return reply({ manifestacao }, 201);
    }
    const importadas = await importarFilaLocal(user.tenantId, usuario, entrada.fichas);
    return reply({ importadas });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(req: Request) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Origem inválida.' }, 403);
    const user = await requireManifestacaoAccess();
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !z.string().uuid().safeParse(id).success) return reply({ error: 'Ficha inválida.' }, 400);
    // Somente fichas em conferência podem ser removidas; finalizadas são imutáveis
    const removida = await removerFichaEmConferencia(user.tenantId, id);
    return removida ? reply({ ok: true }) : reply({ error: 'Ficha não encontrada na fila (pode já ter sido finalizada).' }, 404);
  } catch (error) { return errorResponse(error); }
}
