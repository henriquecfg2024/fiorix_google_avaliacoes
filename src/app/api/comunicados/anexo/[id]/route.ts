import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'fiorix-comunicados-anexos';
const ROLES_GESTAO_COMUNICADOS = new Set(['MASTER', 'ADMIN', 'RH', 'GESTOR', 'SUBSTITUTO']);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireTenant();
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

    const roleUpper = String(user.role || '').toUpperCase();
    if (!ROLES_GESTAO_COMUNICADOS.has(roleUpper)) {
      const statusUpper = String(anexo.comunicado.status || 'PUBLICADO').toUpperCase();
      if (statusUpper !== 'PUBLICADO') {
        return NextResponse.json(
          { error: 'Este comunicado não está disponível para leitura.' },
          { status: 403 }
        );
      }

      const rawDest = Array.isArray(anexo.comunicado.destinatarios)
        ? anexo.comunicado.destinatarios
        : [];
      const alvosUpper = new Set(rawDest.map((d) => String(d || '').trim().toUpperCase()).filter(Boolean));
      const isTodos = alvosUpper.size === 0 || alvosUpper.has('TODOS');

      if (!isTodos) {
        let elegivel =
          alvosUpper.has(String(user.id).toUpperCase()) ||
          alvosUpper.has(roleUpper);

        if (!elegivel) {
          const [dbUser, cienciaExistente] = await Promise.all([
            prisma.user.findFirst({
              where: { id: user.id, tenantId: user.tenantId },
              select: { departamento: true, cargo: true },
            }),
            prisma.fiorixComunicadoCiencia.findFirst({
              where: { comunicadoId: anexo.comunicado.id, usuarioId: user.id },
              select: { id: true },
            }),
          ]);

          if (cienciaExistente) {
            elegivel = true;
          } else if (dbUser?.departamento && alvosUpper.has(dbUser.departamento.trim().toUpperCase())) {
            elegivel = true;
          } else if (dbUser?.cargo && alvosUpper.has(dbUser.cargo.trim().toUpperCase())) {
            elegivel = true;
          }
        }

        if (!elegivel) {
          return NextResponse.json(
            { error: 'Acesso negado: Você não é destinatário deste comunicado.' },
            { status: 403 }
          );
        }
      }
    }

    const accept = req.headers.get('accept') || '';

    let signedUrl: string | null = null;
    let signError: any = null;

    try {
      const res = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(anexo.storagePath, 900);
      signedUrl = res.data?.signedUrl ?? null;
      signError = res.error;
    } catch (err) {
      signError = err;
    }

    // Se a geração da URL assinada falhar, tenta fallback seguro via stream/buffer usando exclusivamente supabaseAdmin
    if (signError || !signedUrl) {
      console.warn('[Download Comunicado PDF] Falha na URL assinada, tentando download direto:', signError);
      try {
        const res = await supabaseAdmin.storage.from(BUCKET_NAME).download(anexo.storagePath);
        const blob = res.data;

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
