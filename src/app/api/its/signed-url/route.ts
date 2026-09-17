import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const fileName = (body.fileName as string) || 'documento.pdf';
    const timestamp = Date.now();

    const safeFileName = fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const tenantFolder = currentUser.tenantId || 'global';
    const storagePath = `uploads/${tenantFolder}_${timestamp}_${safeFileName}`;

    // 1. Tenta gerar no bucket 'it-documentos' com supabaseAdmin
    let bucketName = 'it-documentos';
    let res = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath, { upsert: true });

    // 2. Fallback para 'fiorix-its' se falhar
    if (res.error || !res.data?.signedUrl) {
      console.warn('Falha em it-documentos com admin, tentando fiorix-its:', res.error);
      bucketName = 'fiorix-its';
      res = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(storagePath, { upsert: true });
    }

    // 3. Fallback com client anon se ainda falhar
    if (res.error || !res.data?.signedUrl) {
      console.warn('Falha com admin, tentando client anon:', res.error);
      bucketName = 'it-documentos';
      res = await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(storagePath, { upsert: true });
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
