/**
 * Script para verificar/criar o bucket fiorix-holerites no Supabase Storage.
 * Executar com: npx tsx prisma/check-holerites-bucket.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const BUCKET_NAME = 'fiorix-holerites';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceKey || serviceKey.includes('[SENSITIVE]')) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
    process.exit(1);
  }

  const supabase = createClient(url.trim(), serviceKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n🔍 Verificando bucket "${BUCKET_NAME}" no Supabase Storage...\n`);

  // Listar buckets existentes
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Erro ao listar buckets:', listError.message);
    process.exit(1);
  }

  console.log(`📦 Buckets existentes: ${buckets?.map(b => b.name).join(', ') || '(nenhum)'}\n`);

  const exists = buckets?.some(b => b.name === BUCKET_NAME);

  if (exists) {
    console.log(`✅ Bucket "${BUCKET_NAME}" já existe!\n`);
    
    // Mostrar detalhes do bucket
    const bucket = buckets?.find(b => b.name === BUCKET_NAME);
    if (bucket) {
      console.log(`   • ID: ${bucket.id}`);
      console.log(`   • Público: ${bucket.public ? 'Sim ⚠️' : 'Não ✅ (privado)'}`);
      console.log(`   • Criado em: ${bucket.created_at}`);
    }
  } else {
    console.log(`⚠️  Bucket "${BUCKET_NAME}" não encontrado. Criando...`);

    const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['application/pdf'],
    });

    if (createError) {
      console.error('❌ Erro ao criar bucket:', createError.message);
      process.exit(1);
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" criado com sucesso!`);
    console.log(`   • Público: Não (privado)`);
    console.log(`   • Limite: 5MB por arquivo`);
    console.log(`   • Tipos: application/pdf`);
  }

  console.log('\n🔒 Lembrete: O bucket é privado. Downloads usam URLs assinadas temporárias.\n');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
