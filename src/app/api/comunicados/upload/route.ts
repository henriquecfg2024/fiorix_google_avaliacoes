import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { supabaseAdmin, FIORIX_SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'fiorix-comunicados-anexos';
let bucketVerified = false;

function hasServiceRoleKey(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || FIORIX_SUPABASE_SERVICE_ROLE_KEY;
  return !!(key && !key.includes('[SENSITIVE]') && key.length > 20);
}

async function ensureBucketExists() {
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
    console.warn('[Upload Comunicado PDF] Verificação do bucket:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Valida permissão: apenas perfis com autorização de RH/Gestão podem publicar comunicados
    const allowedRoles = ['ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Acesso negado: permissão de RH ou Gestão necessária.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    // 1. Limite de tamanho: 25MB
    const MAX_SIZE = 26214400;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'O arquivo PDF excede o limite máximo permitido de 25MB.' },
        { status: 400 }
      );
    }

    // 2. Validação da extensão
    const fileName = file.name.trim();
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Formato inválido. Apenas arquivos PDF (.pdf) são permitidos.' },
        { status: 400 }
      );
    }

    // 3. Validação dos Magic Bytes (%PDF-)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 5 || buffer.toString('utf-8', 0, 5) !== '%PDF-') {
      return NextResponse.json(
        { error: 'O conteúdo binário do arquivo não corresponde a um documento PDF autêntico.' },
        { status: 400 }
      );
    }

    // 4. Cálculo do Hash SHA-256 de Prova de Integridade WORM
    const hashSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 5. Upload para o Supabase Storage
    await ensureBucketExists();

    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const safeBaseName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
    const storagePath = `${user.tenantId}/${Date.now()}_${randomSuffix}_${safeBaseName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Comunicado PDF] Erro Supabase:', uploadError);
      return NextResponse.json(
        { error: 'Falha ao armazenar arquivo no storage seguro.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storagePath,
      nomeOriginal: fileName,
      mimeType: 'application/pdf',
      tamanhoBytes: buffer.length,
      hashSha256,
    });
  } catch (err: any) {
    console.error('[Upload Comunicado PDF] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar upload do comunicado.' },
      { status: 500 }
    );
  }
}
