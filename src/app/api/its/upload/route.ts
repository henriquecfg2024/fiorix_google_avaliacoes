import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, FIORIX_SUPABASE_URL, FIORIX_SUPABASE_ANON_KEY } from '@/lib/supabase';
import { publicarNovaVersaoIT } from '@/app/actions/minha-it';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const itId = formData.get('itId') as string | null;
    const codigo = formData.get('codigo') as string | null;
    const novaVersao = formData.get('novaVersao') as string | null;
    const hashSha256 = formData.get('hashSha256') as string | null;
    const resumoMudancas = (formData.get('resumoMudancas') as string | null) || '';

    if (!file || !itId || !codigo || !novaVersao) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros incompletos para upload do PDF.' },
        { status: 400 }
      );
    }

    // Normaliza o nome do arquivo para padrão seguro ASCII
    const safeFileName = (file.name || 'documento.pdf')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const timestamp = Date.now();
    const tenantFolder = currentUser.tenantId || 'global';
    const storagePath = `uploads/${tenantFolder}_${timestamp}_${codigo}_v${novaVersao}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Tenta upload no bucket oficial 'it-documentos'
    let uploadRes = await supabase.storage
      .from('it-documentos')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    // Se falhar, tenta no fallback 'fiorix-its'
    if (uploadRes.error) {
      console.warn('Tentativa em it-documentos falhou, tentando fiorix-its:', uploadRes.error);
      uploadRes = await supabase.storage
        .from('fiorix-its')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
    }

    // Se ainda falhar, tenta com direct client garantido com chaves oficiais
    if (uploadRes.error) {
      console.warn('Tentativa padrão falhou, tentando cliente com credenciais oficiais:', uploadRes.error);
      const directClient = createClient(FIORIX_SUPABASE_URL, FIORIX_SUPABASE_ANON_KEY);
      uploadRes = await directClient.storage
        .from('it-documentos')
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadRes.error) {
        uploadRes = await directClient.storage
          .from('fiorix-its')
          .upload(storagePath, buffer, {
            contentType: 'application/pdf',
            upsert: true,
          });
      }
    }

    if (uploadRes.error) {
      console.error('Erro definitivo de upload no storage:', uploadRes.error);
      return NextResponse.json(
        { success: false, error: `Falha no armazenamento: ${uploadRes.error.message}` },
        { status: 500 }
      );
    }

    // 2. Persiste a nova versão no banco de dados e reseta ciências
    const pubRes = await publicarNovaVersaoIT({
      itId,
      codigo,
      novaVersao,
      pdfPath: storagePath,
      hashSha256: hashSha256 || '0000000000000000000000000000000000000000000000000000000000000000',
      resumoMudancas,
    });

    if (!pubRes.success) {
      return NextResponse.json(
        { success: false, error: pubRes.error || 'Erro ao registrar nova versão no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      versao: novaVersao,
      path: storagePath,
    });
  } catch (err: any) {
    console.error('Erro no endpoint de upload de IT:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno durante processamento do arquivo.' },
      { status: 500 }
    );
  }
}
