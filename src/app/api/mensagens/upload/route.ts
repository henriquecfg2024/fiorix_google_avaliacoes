import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin, FIORIX_SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase';
import { validateAttachmentFile, logMessagingAudit } from '@/lib/mensagens/security';
import { checkRateLimit } from '@/lib/mensagens/rate-limiter';
import { getRequestIp } from '@/lib/security/requestIp';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'fiorix-mensagens-anexos';
let bucketVerified = false;

// Detecta se a service role key está configurada
function hasServiceRoleKey(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || FIORIX_SUPABASE_SERVICE_ROLE_KEY;
  return !!(key && !key.includes('[SENSITIVE]') && key.length > 20);
}

async function ensurePrivateBucketExists() {
  if (bucketVerified) return;
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (!listError && buckets?.some((b) => b.name === BUCKET_NAME)) {
      bucketVerified = true;
      return;
    }
    if (!listError) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 26214400, // 25 MB
      });
      if (!createError) {
        bucketVerified = true;
      }
    }
  } catch (err) {
    console.warn('[Upload Anexo] Verificação do bucket em cache (bucket já existe):', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verificação antecipada: service role key obrigatória para storage privado
    if (!hasServiceRoleKey()) {
      console.error('[Upload Anexo] SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione ao .env ou variáveis de produção.');
      return NextResponse.json(
        { error: 'Configuração de storage incompleta. Contate o administrador do sistema.' },
        { status: 503 }
      );
    }

    const user = await requireAuth();

    // Rate limit: upload (5/30s compartilhado entre instâncias)
    const allowed = await checkRateLimit(user.id, 'upload');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Limite de uploads atingido. Aguarde alguns segundos.' },
        { status: 429 }
      );
    }

    const contentType = req.headers.get('content-type') || '';

    // ── Fluxo 1: Solicitação de Signed Upload URL (Suporta arquivos grandes até 25MB direto para Supabase) ──
    if (contentType.includes('application/json')) {
      const json = await req.json().catch(() => ({}));
      const { fileName, fileSize, mimeType, conversationId } = json;

      if (!fileName || !conversationId) {
        return NextResponse.json(
          { error: 'Nome do arquivo e ID da conversa são obrigatórios.' },
          { status: 400 }
        );
      }

      // Validação de membro da conversa
      const membership = await prisma.conversaMembro.findFirst({
        where: {
          conversaId: conversationId,
          usuarioId: user.id,
          tenantId: user.tenantId,
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'Acesso negado: Você não é participante desta conversa.' },
          { status: 403 }
        );
      }

      // Política de anexos do tenant
      const policy = await prisma.messagingPolicy.findUnique({
        where: { tenantId: user.tenantId },
      });

      if (policy && !policy.attachmentsEnabled) {
        return NextResponse.json(
          { error: 'O envio de anexos está temporariamente desativado para a sua organização.' },
          { status: 403 }
        );
      }

      const maxBytes = policy?.maxAttachmentBytes || 26214400; // 25 MB
      if (fileSize && fileSize > maxBytes) {
        return NextResponse.json(
          { error: `Arquivo muito grande (${(fileSize / 1024 / 1024).toFixed(1)}MB). O tamanho máximo permitido é ${(maxBytes / 1024 / 1024).toFixed(0)}MB.` },
          { status: 400 }
        );
      }

      await ensurePrivateBucketExists();

      const sanitizedBaseName = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 100);
      const fileUuid = crypto.randomUUID();
      const storagePath = `tenants/${user.tenantId}/conversations/${conversationId}/${Date.now()}_${fileUuid}_${sanitizedBaseName}`;

      const { data: signData, error: signError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUploadUrl(storagePath, { upsert: false });

      if (signError || !signData?.signedUrl) {
        console.error('[Upload Anexo] Erro Supabase createSignedUploadUrl:', signError);
        return NextResponse.json(
          { error: 'Falha ao autorizar upload seguro na nuvem.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        signedUrl: signData.signedUrl,
        storagePath,
        maxBytes,
      });
    }

    // ── Fluxo 2: Upload Multipart tradicional ──
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: 'Arquivo e ID da conversa são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Validação estrita: usuário é membro da conversa no mesmo tenant?
    const membership = await prisma.conversaMembro.findFirst({
      where: {
        conversaId: conversationId,
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Acesso negado: Você não é participante desta conversa.' },
        { status: 403 }
      );
    }

    // 2. Busca política do tenant
    const policy = await prisma.messagingPolicy.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (policy && !policy.attachmentsEnabled) {
      return NextResponse.json(
        { error: 'O envio de anexos está temporariamente desativado para a sua organização.' },
        { status: 403 }
      );
    }

    const maxBytes = policy?.maxAttachmentBytes || 26214400; // 25 MB

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Validação de segurança (extensão, tamanho e magic bytes)
    const validation = validateAttachmentFile(file.name, buffer, file.type, maxBytes);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Arquivo rejeitado por políticas de segurança.' },
        { status: 400 }
      );
    }

    await ensurePrivateBucketExists();

    // 4. Nome seguro e caminho particionado
    const sanitizedBaseName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
    const fileUuid = crypto.randomUUID();
    const storagePath = `tenants/${user.tenantId}/conversations/${conversationId}/${Date.now()}_${fileUuid}_${sanitizedBaseName}`;

    // 5. Upload seguro no bucket privado
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: validation.safeMimeType || file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Anexo] Erro Supabase Storage:', JSON.stringify(uploadError));
      const msg = uploadError.message === 'signature verification failed'
        ? 'Erro de autenticação no armazenamento. Chave de serviço inválida ou expirada.'
        : uploadError.message || 'erro desconhecido';
      return NextResponse.json(
        { error: `Falha ao armazenar o anexo na nuvem privada. (${msg})` },
        { status: 500 }
      );
    }

    // 6. Auditoria de envio de anexo
    const ipAddress = getRequestIp(req);
    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'UPLOAD_ATTACHMENT',
      targetType: 'ATTACHMENT',
      targetId: storagePath,
      metadata: {
        fileName: sanitizedBaseName,
        sizeBytes: buffer.length,
        mimeType: validation.safeMimeType,
        conversationId,
      },
      ipAddress,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      attachment: {
        nomeArquivo: file.name,
        tamanhoBytes: buffer.length,
        mimeType: validation.safeMimeType || file.type,
        storagePath,
      },
    });
  } catch (error: any) {
    console.error('[API /mensagens/upload POST] Erro:', error);
    const msg = error?.message === 'signature verification failed'
      ? 'Erro de autenticação no armazenamento (verificação de assinatura falhou).'
      : error?.message || 'Falha no upload';
    return NextResponse.json(
      { error: msg },
      { status: error?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}
