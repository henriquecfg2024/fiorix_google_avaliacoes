import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'fiorix-mensagens-anexos';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const attachmentId = params.id;

    const attachment = await prisma.mensagemAnexo.findFirst({
      where: {
        id: attachmentId,
        tenantId: user.tenantId,
      },
      include: {
        mensagem: {
          select: {
            conversaId: true,
            tenantId: true,
          },
        },
      },
    });

    if (!attachment || attachment.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Anexo não encontrado ou sem permissão.' },
        { status: 404 }
      );
    }

    // Valida se o usuário é participante da conversa
    const isMember = await prisma.conversaMembro.findFirst({
      where: {
        conversaId: attachment.mensagem.conversaId,
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { error: 'Acesso negado: você não é membro desta conversa.' },
        { status: 403 }
      );
    }

    // Gera URL assinada temporária com validade de 15 minutos (900 segundos)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(attachment.storagePath, 900, {
        download: attachment.nomeArquivo,
      });

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Não foi possível gerar a URL segura para download.' },
        { status: 500 }
      );
    }

    // Se a requisição veio via fetch pedindo JSON, retorna JSON
    const accept = req.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({
        signedUrl: signedData.signedUrl,
        fileName: attachment.nomeArquivo,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.tamanhoBytes,
      });
    }

    // Se veio diretamente pelo navegador, redireciona para a URL assinada
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar anexo' },
      { status: error?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}
