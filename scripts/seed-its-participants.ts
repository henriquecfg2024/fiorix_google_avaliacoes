/**
 * Popula fiorix_its_participants com autor_id das ITs existentes sem guardião
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // ITs sem guardião mas com autor_id — tratar autor como responsável
  const autores = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id::text as it_id, tenant_id, autor_id as usuario_id
    FROM public.fiorix_its
    WHERE autor_id IS NOT NULL
      AND deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.fiorix_its_participants p
        WHERE p.it_id = fiorix_its.id AND p.status = 'ativo' AND p.papel = 'RESPONSAVEL_PRINCIPAL'
      )
  `);
  console.log(`ITs sem responsável principal: ${autores.length}`);
  for (const a of autores) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.fiorix_its_participants (tenant_id, it_id, usuario_id, papel, status, incluido_por, created_at, updated_at)
      VALUES ($1, $2::uuid, $3, 'RESPONSAVEL_PRINCIPAL', 'ativo', $3, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, a.tenant_id, a.it_id, a.usuario_id);
  }
  const totais = await prisma.$queryRawUnsafe<any[]>(`SELECT papel, COUNT(*)::int as total FROM public.fiorix_its_participants GROUP BY papel`);
  console.log('Estado:', JSON.stringify(totais));
}
main().catch(console.error).finally(() => prisma.$disconnect());
