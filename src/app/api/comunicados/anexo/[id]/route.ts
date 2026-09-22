import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';

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
        tenantId: user.tenantId,
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

    // Gera URL assinada com validade de 15 minutos (900 segundos)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(anexo.storagePath, 900, {
        download: anexo.nomeOriginal,
      });

    if (signError || !signedData?.signedUrl) {
      console.error('[Download Comunicado PDF] Erro ao gerar URL assinada:', signError);
      return NextResponse.json(
        { error: 'Não foi possível gerar a URL de visualização segura.' },
        { status: 500 }
      );
    }

    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({
        signedUrl: signedData.signedUrl,
        fileName: anexo.nomeOriginal,
        mimeType: anexo.mimeType,
        sizeBytes: anexo.tamanhoBytes,
        hashSha256: anexo.hashSha256,
      });
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (err: any) {
    console.error('[Download Comunicado PDF] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar visualização do documento.' },
      { status: err?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}
