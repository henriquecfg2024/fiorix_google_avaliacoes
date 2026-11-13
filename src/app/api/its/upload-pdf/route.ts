import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import {
  canUserUploadItDocument,
  validateStrictPdfMetadata,
} from '@/lib/security/it-upload-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    if (!currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Organização (tenant) não identificada na sessão.' },
        { status: 403 }
      );
    }

    const allowed = await canUserUploadItDocument(currentUser);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: sem permissão para enviar documentos de Instrução de Trabalho.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const codigo = ((formData.get('codigo') as string | null) || 'IT')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado para upload.' },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { success: false, error: 'O arquivo enviado está vazio.' },
        { status: 400 }
      );
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'O arquivo excede o limite de envio via servidor proxy (4.5 MB). Utilize o envio direto pela nuvem.' },
        { status: 413 }
      );
    }

    const pdfCheck = validateStrictPdfMetadata(file.name, file.type || 'application/pdf');
    if (!pdfCheck.valid) {
      return NextResponse.json(
        { success: false, error: pdfCheck.error || 'Formato inválido. Apenas arquivos PDF (.pdf) são permitidos.' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const storagePath = `uploads/${currentUser.tenantId}/${timestamp}_${codigo}_${pdfCheck.safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validação estrita de magic bytes para garantir que se trata de PDF autêntico
    if (buffer.length < 5 || buffer.toString('utf-8', 0, 5) !== '%PDF-') {
      return NextResponse.json(
        { success: false, error: 'Formato de arquivo inválido. O documento deve ser um arquivo PDF autêntico.' },
        { status: 400 }
      );
    }

    // 1. Tenta upload no bucket 'it-documentos' com contentType fixo application/pdf (impede poliglotas text/html)
    let bucketName = 'it-documentos';
    let uploadRes = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    // 2. Se falhar no it-documentos, tenta no fiorix-its com supabaseAdmin
    if (uploadRes.error) {
      console.warn('Tentativa em it-documentos falhou, tentando fiorix-its:', uploadRes.error);
      bucketName = 'fiorix-its';
      uploadRes = await supabaseAdmin.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });
    }

    if (uploadRes.error) {
      console.error('Erro definitivo de upload no storage:', uploadRes.error);
      return NextResponse.json(
        { success: false, error: `Falha no armazenamento: ${uploadRes.error.message}` },
        { status: 500 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      publicUrl: publicData.publicUrl,
      storagePath,
    });
  } catch (err: any) {
    if (err?.message?.includes('Não autorizado') || err?.message?.includes('Acesso negado') || err?.message?.includes('Sessão')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado.' },
        { status: 403 }
      );
    }
    console.error('Erro no endpoint de upload-pdf:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno durante processamento do arquivo.' },
      { status: 500 }
    );
  }
}
