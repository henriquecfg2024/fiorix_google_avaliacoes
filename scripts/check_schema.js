const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // List ALL tables in public schema
  const tables = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('=== ALL tables in public schema ===');
  for (const t of tables) {
    console.log(`  ${t.table_name}`);
  }

  // Try using Prisma models directly
  console.log('\n=== Trying Prisma models ===');

  try {
    const comunicados = await p.fiorixComunicado.count();
    console.log(`  FiorixComunicado: ${comunicados}`);
  } catch(e) { console.log(`  FiorixComunicado: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const holerites = await p.fiorixHolerite.count();
    console.log(`  FiorixHolerite: ${holerites}`);
  } catch(e) { console.log(`  FiorixHolerite: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const ferias = await p.fiorixFeriasPrevista.count();
    console.log(`  FiorixFeriasPrevista: ${ferias}`);
  } catch(e) { console.log(`  FiorixFeriasPrevista: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const feriasH = await p.fiorixFeriasPrevistaHistorico.count();
    console.log(`  FiorixFeriasPrevistaHistorico: ${feriasH}`);
  } catch(e) { console.log(`  FiorixFeriasPrevistaHistorico: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const feriasA = await p.fiorixFeriasAviso.count();
    console.log(`  FiorixFeriasAviso: ${feriasA}`);
  } catch(e) { console.log(`  FiorixFeriasAviso: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const anexos = await p.fiorixComunicadoAnexo.count();
    console.log(`  FiorixComunicadoAnexo: ${anexos}`);
  } catch(e) { console.log(`  FiorixComunicadoAnexo: ERROR - ${e.message?.substring(0,100)}`); }

  try {
    const ciencias = await p.fiorixComunicadoCiencia.count();
    console.log(`  FiorixComunicadoCiencia: ${ciencias}`);
  } catch(e) { console.log(`  FiorixComunicadoCiencia: ERROR - ${e.message?.substring(0,100)}`); }

  await p.$disconnect();
}

main().catch(async (e) => { console.error(e); await p.$disconnect(); });
