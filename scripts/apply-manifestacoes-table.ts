import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';

/**
 * Cria a tabela "DocumentManifestacao" (fila de conferência + histórico de manifestações).
 * Idempotente: pode ser executado mais de uma vez. Apenas acrescenta objetos ao banco.
 *   npx tsx scripts/apply-manifestacoes-table.ts
 */
/** Divide o script em comandos, respeitando blocos $$ ... $$ (funções e DO). */
function dividirComandos(sql: string): string[] {
  const semComentarios = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  const comandos: string[] = [];
  let atual = '';
  let emDolar = false;
  for (let i = 0; i < semComentarios.length; i++) {
    if (semComentarios.startsWith('$$', i)) { emDolar = !emDolar; atual += '$$'; i++; continue; }
    const c = semComentarios[i];
    if (c === ';' && !emDolar) {
      if (atual.trim()) comandos.push(atual.trim());
      atual = '';
    } else {
      atual += c;
    }
  }
  if (atual.trim()) comandos.push(atual.trim());
  return comandos;
}

async function main() {
  const sql = readFileSync(path.join(__dirname, '..', 'prisma', 'migrations', 'document_manifestacoes.sql'), 'utf8');
  const comandos = dividirComandos(sql);
  console.log(`Aplicando prisma/migrations/document_manifestacoes.sql (${comandos.length} comandos) ...`);
  // Executa em transação única: ou tudo é criado, ou nada
  await prisma.$transaction(async tx => {
    for (const comando of comandos) await tx.$executeRawUnsafe(comando);
  });
  const [{ existe }] = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentManifestacao') AS existe`;
  console.log(existe ? 'Tabela DocumentManifestacao criada/verificada com sucesso.' : 'ATENÇÃO: tabela não encontrada após a execução.');
}

main()
  .catch(err => { console.error('Falha ao aplicar a migração:', err?.message || err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
