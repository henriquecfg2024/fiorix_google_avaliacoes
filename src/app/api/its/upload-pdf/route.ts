import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const codigo = ((formData.get('codigo') as string | null) || 'IT')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado para upload.' },
        { status: 400 }
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
    const storagePath = `uploads/${tenantFolder}_${timestamp}_${codigo}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Tenta upload no bucket 'it-documentos'
    let bucketName = 'it-documentos';
    let uploadRes = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: true,
      });

    // Se falhar no it-documentos, tenta no fiorix-its
    if (uploadRes.error) {
      console.warn('Tentativa em it-documentos falhou, tentando fiorix-its:', uploadRes.error);
      bucketName = 'fiorix-its';
      uploadRes = await supabase.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/pdf',
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

    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      publicUrl: publicData.publicUrl,
      storagePath,
    });
  } catch (err: any) {
    console.error('Erro no endpoint de upload-pdf:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno durante processamento do arquivo.' },
      { status: 500 }
    );
  }
}
