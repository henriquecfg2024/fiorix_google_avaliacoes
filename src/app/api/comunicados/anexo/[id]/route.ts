import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'fiorix-comunicados-anexos';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const anexoId = params.id;

    if (!anexoId) {
      return NextResponse.json({ error: 'ID do anexo não informado.' }, { status: 400 });
    }

    const anexo = await prisma.fiorixComunicadoAnexo.findFirst({
      where: {
        id: anexoId,
        ...(user.role === 'MASTER' ? {} : { tenantId: user.tenantId }),
      },
      include: {
        comunicado: {
          select: {
            id: true,
            titulo: true,
            status: true,
            destinatarios: true,
          },
        },
      },
    });

    if (!anexo || !anexo.comunicado) {
      return NextResponse.json(
        { error: 'Documento PDF não encontrado ou sem permissão de acesso.' },
        { status: 404 }
      );
    }

    const accept = req.headers.get('accept') || '';

    // Download do arquivo diretamente via cliente Supabase
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(anexo.storagePath);

    if (downloadError || !blob) {
      console.error('[Download Comunicado PDF] Erro Supabase:', downloadError);
      return NextResponse.json(
        { error: 'Não foi possível carregar o arquivo do storage.' },
        { status: 500 }
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (accept.includes('application/json')) {
      return NextResponse.json({
        fileName: anexo.nomeOriginal,
        mimeType: anexo.mimeType || 'application/pdf',
        sizeBytes: anexo.tamanhoBytes,
        hashSha256: anexo.hashSha256,
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': anexo.mimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(anexo.nomeOriginal)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('[Download Comunicado PDF] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar visualização do documento.' },
      { status: err?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}
