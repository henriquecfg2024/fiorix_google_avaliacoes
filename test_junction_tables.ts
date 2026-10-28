import sql from 'mssql';
import { env } from './src/config/env.js';

async function testJunctionTables() {
  const pool = await sql.connect({
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    server: env.SQL_SERVER_HOST,
    database: env.SQL_SERVER_DATABASE,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 5000
    }
  });

  const prefixes = [
    'tblWRITitulos',
    'tblWRIRecepcao',
    'tblWRILivro',
    'tblWRIImovel',
    'tblWRI'
  ];

  const suffixes = [
    'Livro', 'Livros', 'Imovel', 'Imoveis', 'Contraditorio', 'Contraditorios',
    'Matricula', 'Matriculas', 'Ato', 'Atos', 'Participante', 'Participantes',
    'Relacao', 'Vinculo', 'Dados', 'Item', 'Itens', 'Detalhe', 'Detalhes',
    'Auxiliar', 'Geral', 'Registro', 'Registros', 'Protocolo', 'Protocolos'
  ];

  const candidates = new Set<string>();

  for (const p of prefixes) {
    for (const s of suffixes) {
      candidates.add(`dbo.${p}${s}`);
      candidates.add(`dbo.${p}_${s}`);
    }
  }

  // Also some specific WebRI naming patterns:
  candidates.add('dbo.tblWRITitulosContraditorio');
  candidates.add('dbo.tblWRIContraditorioTitulos');
  candidates.add('dbo.tblWRIRecepcaoLivro');
  candidates.add('dbo.tblWRILivroTitulo');
  candidates.add('dbo.tblWRILivroTitulos');
  candidates.add('dbo.tblWRILivrosTitulos');
  candidates.add('dbo.tblWRITitulo');
  candidates.add('dbo.tblWRITituloLivro');
  candidates.add('dbo.tblWRITituloParticipantes');
  candidates.add('dbo.tblWRITituloAtos');

  const existing: string[] = [];

  for (const t of Array.from(candidates)) {
    try {
      await pool.request().query(`SELECT TOP 1 * FROM ${t}`);
      existing.push(`${t} (COM ACESSO)`);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        existing.push(t);
      }
    }
  }

  console.log(`\n=== TABELAS EXISTENTES ENCONTRADAS (${existing.length}) ===`);
  existing.forEach(t => console.log(' - ' + t));

  await pool.close();
}

testJunctionTables().catch(console.error);
