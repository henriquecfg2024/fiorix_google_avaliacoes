import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
  if (match) process.env[match[1]] = match[2];
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey?.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // List root of bucket
  const { data: rootData, error: rootErr } = await supabase.storage
    .from('it-documentos')
    .list('', { limit: 50 });

  if (rootErr) {
    console.error('Erro root:', rootErr.message);
  } else {
    console.log('Root:', JSON.stringify(rootData, null, 2));
  }

  // List uploads/ folder
  const { data, error } = await supabase.storage
    .from('it-documentos')
    .list('uploads', { limit: 50 });

  if (error) {
    console.error('Erro uploads:', error.message);
  } else {
    console.log('Uploads:', JSON.stringify(data, null, 2));
  }

  // Also check all ITs pdf_original_url
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const its = await prisma.$queryRawUnsafe<any[]>(
    "SELECT id, codigo, versao, pdf_original_url FROM public.fiorix_its WHERE deleted_at IS NULL ORDER BY codigo"
  );
  console.log('\nITs no banco:');
  its.forEach((it: any) => {
    console.log(`  ${it.codigo} v${it.versao} → pdf_url: ${it.pdf_original_url || 'NULL'}`);
  });
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
