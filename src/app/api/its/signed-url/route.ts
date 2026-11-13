import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';
import {
  canUserUploadItDocument,
  validateStrictPdfMetadata,
} from '@/lib/security/it-upload-guard';

export const dynamic = 'force-dynamic';

const MAX_DIRECT_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

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

    const body = await req.json().catch(() => ({}));
    const rawFileName = (body.fileName as string) || '';
    const rawContentType = (body.contentType as string) || 'application/pdf';
    const rawFileSize = body.fileSize !== undefined ? Number(body.fileSize) : undefined;

    if (rawFileSize !== undefined && (!Number.isFinite(rawFileSize) || rawFileSize <= 0 || rawFileSize > MAX_DIRECT_PDF_BYTES)) {
      return NextResponse.json(
        { success: false, error: 'Tamanho de arquivo PDF inválido ou acima do limite máximo de 50 MB.' },
        { status: 400 }
      );
    }

    const pdfCheck = validateStrictPdfMetadata(rawFileName, rawContentType);
    if (!pdfCheck.valid) {
      return NextResponse.json(
        { success: false, error: pdfCheck.error || 'Apenas documentos PDF são permitidos.' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const storagePath = `uploads/${currentUser.tenantId}/${timestamp}_${pdfCheck.safeFileName}`;

    // 1. Tenta gerar no bucket 'it-documentos' com supabaseAdmin (service_role)
    let bucketName = 'it-documentos';
    let res = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath, { upsert: false });

    // 2. Fallback para 'fiorix-its' exclusivamente com supabaseAdmin
    if (res.error || !res.data?.signedUrl) {
      console.warn('Falha em it-documentos com admin, tentando fiorix-its:', res.error);
      bucketName = 'fiorix-its';
      res = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(storagePath, { upsert: false });
    }

    if (res.error || !res.data?.signedUrl) {
      console.error('Erro definitivo ao gerar Signed URL:', res.error);
      return NextResponse.json(
        {
          success: false,
          error: `Falha ao autorizar upload no armazenamento: ${res.error?.message || 'Erro desconhecido'}`,
        },
        { status: 500 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      signedUrl: res.data.signedUrl,
      token: res.data.token,
      path: res.data.path,
      storagePath,
      publicUrl: publicData.publicUrl,
      bucketName,
    });
  } catch (err: any) {
    if (err?.message?.includes('Não autorizado') || err?.message?.includes('Acesso negado') || err?.message?.includes('Sessão')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado.' },
        { status: 403 }
      );
    }
    console.error('Erro no endpoint /api/its/signed-url:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro interno ao gerar autorização de upload.',
      },
      { status: 500 }
    );
  }
}
