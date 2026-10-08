import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabase, supabaseAdmin } from '@/lib/supabase';

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

    // Gera URL assinada temporária (15 minutos / 900s) diretamente pelo Supabase Storage CDN.
    // Isso evita bufferizar arquivos pesados (ex.: PDFs de 8MB+) na memória da função serverless da Vercel,
    // que causava estouro do limite de payload (4.5MB) e travamento com cursor girando indefinidamente.
    let signedUrl: string | null = null;
    let signError: any = null;

    try {
      const res = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(anexo.storagePath, 900);
      signedUrl = res.data?.signedUrl ?? null;
      signError = res.error;
    } catch {
      const res = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(anexo.storagePath, 900);
      signedUrl = res.data?.signedUrl ?? null;
      signError = res.error;
    }

    // Se a geração da URL assinada falhar, tenta fallback seguro via stream/buffer
    if (signError || !signedUrl) {
      console.warn('[Download Comunicado PDF] Falha na URL assinada, tentando download direto:', signError);
      try {
        let blob: Blob | null = null;
        try {
          const res = await supabaseAdmin.storage.from(BUCKET_NAME).download(anexo.storagePath);
          blob = res.data;
        } catch {
          const res = await supabase.storage.from(BUCKET_NAME).download(anexo.storagePath);
          blob = res.data;
        }

        if (blob) {
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
              'X-Frame-Options': 'SAMEORIGIN',
              'Content-Security-Policy': "frame-ancestors 'self'",
            },
          });
        }
      } catch (fbErr) {
        console.error('[Download Comunicado PDF] Fallback falhou:', fbErr);
      }

      return NextResponse.json(
        { error: 'Não foi possível carregar o arquivo do storage.' },
        { status: 500 }
      );
    }

    // Se o chamador pedir JSON explicitamente (ex.: inspeção de metadados), retorna JSON com signedUrl
    if (accept.includes('application/json')) {
      return NextResponse.json({
        signedUrl,
        fileName: anexo.nomeOriginal,
        mimeType: anexo.mimeType || 'application/pdf',
        sizeBytes: anexo.tamanhoBytes,
        hashSha256: anexo.hashSha256,
      });
    }

    // Redireciona o navegador ou fetch diretamente para a URL assinada de alta performance do Supabase CDN
    return NextResponse.redirect(signedUrl);
  } catch (err: any) {
    console.error('[Download Comunicado PDF] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar visualização do documento.' },
      { status: err?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}
