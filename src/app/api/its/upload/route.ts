import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import { publicarNovaVersaoIT } from '@/app/actions/minha-it';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Organização não identificada na sessão.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const itId = formData.get('itId') as string | null;
    const codigo = formData.get('codigo') as string | null;
    const novaVersao = formData.get('novaVersao') as string | null;
    const hashSha256 = formData.get('hashSha256') as string | null;
    const resumoMudancas = (formData.get('resumoMudancas') as string | null) || '';
    const titulo = (formData.get('titulo') as string | null)?.trim() || undefined;

    if (!file || !itId || !codigo || !novaVersao) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros incompletos para upload do PDF.' },
        { status: 400 }
      );
    }

    // Verifica autorização sobre a IT ANTES de enviar qualquer arquivo ao Storage
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT responsavel_tecnico_id, guardiao_id, autor_id, substituto_id, substituto_ate
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      itId,
      tenantId
    );
    if (itRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Instrução de trabalho não encontrada ou não autorizada.' },
        { status: 404 }
      );
    }

    const itRow = itRows[0];
    const uid = String(currentUser.id);
    const todayIso = new Date().toISOString().slice(0, 10);
    const subAteIso = itRow.substituto_ate
      ? new Date(itRow.substituto_ate).toISOString().slice(0, 10)
      : null;
    const isSubstitutoAtivo =
      String(itRow.substituto_id || '') === uid && (!subAteIso || subAteIso >= todayIso);

    let autorizado =
      ['MASTER', 'ADMIN', 'SUBSTITUTO'].includes(String(currentUser.role || '').toUpperCase()) ||
      String(itRow.responsavel_tecnico_id || '') === uid ||
      String(itRow.guardiao_id || '') === uid ||
      String(itRow.autor_id || '') === uid ||
      isSubstitutoAtivo;

    if (!autorizado) {
      try {
        const partRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT 1 FROM public.fiorix_its_participants
           WHERE it_id = $1::uuid
             AND tenant_id = $2
             AND usuario_id = $3
             AND status = 'ativo'
             AND papel IN ('RESPONSAVEL_PRINCIPAL', 'CORRESPONSAVEL')
           LIMIT 1`,
          itId,
          tenantId,
          uid
        );
        autorizado = partRows.length > 0;
      } catch {
        autorizado = false;
      }
    }

    if (!autorizado) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para publicar nova versão nesta Instrução de Trabalho.' },
        { status: 403 }
      );
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'O arquivo excede o limite de envio via servidor proxy (4.5 MB). Utilize o envio direto pela nuvem.' },
        { status: 413 }
      );
    }

    // Normaliza o nome do arquivo para padrão seguro ASCII
    const safeFileName = (file.name || 'documento.pdf')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const timestamp = Date.now();
    const tenantFolder = currentUser.tenantId || 'global';
    const storagePath = `uploads/${tenantFolder}_${timestamp}_${codigo}_v${novaVersao}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validação estrita de magic bytes para garantir que se trata de PDF autêntico
    if (buffer.length < 5 || buffer.toString('utf-8', 0, 5) !== '%PDF-') {
      return NextResponse.json(
        { success: false, error: 'Formato de arquivo inválido. O documento deve ser um arquivo PDF autêntico.' },
        { status: 400 }
      );
    }

    // 1. Upload seguro via supabaseAdmin (service_role) no bucket 'it-documentos'
    let uploadRes = await supabaseAdmin.storage
      .from('it-documentos')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    // Se o bucket principal falhar, tenta no fallback 'fiorix-its'
    if (uploadRes.error) {
      console.warn('Tentativa em it-documentos falhou, tentando fallback fiorix-its com supabaseAdmin:', uploadRes.error);
      uploadRes = await supabaseAdmin.storage
        .from('fiorix-its')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
    }

    if (uploadRes.error) {
      console.error('Erro definitivo de upload no storage:', uploadRes.error);
      return NextResponse.json(
        { success: false, error: `Falha no armazenamento: ${uploadRes.error.message}` },
        { status: 500 }
      );
    }

    // 2. Persiste a nova versão no banco de dados e reseta ciências
    const pubRes = await publicarNovaVersaoIT({
      itId,
      codigo,
      novaVersao,
      pdfPath: storagePath,
      hashSha256: hashSha256 || '0000000000000000000000000000000000000000000000000000000000000000',
      resumoMudancas,
      titulo,
    });

    if (!pubRes.success) {
      return NextResponse.json(
        { success: false, error: pubRes.error || 'Erro ao registrar nova versão no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      versao: novaVersao,
      path: storagePath,
    });
  } catch (err: any) {
    console.error('Erro no endpoint de upload de IT:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno durante processamento do arquivo.' },
      { status: 500 }
    );
  }
}
