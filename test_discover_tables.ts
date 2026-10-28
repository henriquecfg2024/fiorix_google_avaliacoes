import sql from 'mssql';
import { env } from './src/config/env.js';

async function testMoreTables() {
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

  const candidates = [
    // Contraditório
    'dbo.tblWRIContraditorios',
    'dbo.tblWRIContraditorio',
    'dbo.tblWRITitulosContraditorio',
    'dbo.tblWRITitulosContraditorios',
    'dbo.tblWRIRecepcaoContraditorio',
    // Livros / Matrículas
    'dbo.tblWRILivros',
    'dbo.tblWRILivro',
    'dbo.tblWRITitulosLivro',
    'dbo.tblWRITitulosLivros',
    'dbo.tblWRIRecepcaoLivro',
    'dbo.tblWRIRecepcaoLivros',
    'dbo.tblWRIContraditorioLivro',
    'dbo.tblWRIContraditorioLivros',
    'dbo.tblWRILivrosContraditorio',
    'dbo.tblWRILivroContraditorio',
    // Imóveis
    'dbo.tblWRIImoveis',
    'dbo.tblWRIImovel',
    'dbo.tblWRITitulosImoveis',
    'dbo.tblWRITitulosImovel',
    'dbo.tblWRIRecepcaoImoveis',
    'dbo.tblWRIRecepcaoImovel',
    'dbo.tblWRIContraditorioImovel',
    'dbo.tblWRIContraditorioImoveis',
    // Participantes
    'dbo.tblWRIParticipante',
    'dbo.tblWRIParticipantes',
    'dbo.tblWRITitulosParticipante',
    'dbo.tblWRITitulosParticipantes',
    'dbo.tblWRIRecepcaoParticipante',
    'dbo.tblWRIRecepcaoParticipantes',
    'dbo.tblWRIContraditorioParticipante',
    'dbo.tblWRIContraditorioParticipantes',
    // CIAF
    'dbo.tblWRICIAF',
    'dbo.tblWRICIAFImovel',
    'dbo.tblWRICIAFAto',
    // Fichas
    'dbo.tblWRIFichas',
    'dbo.tblWRIFicha',
    'dbo.tblWRITitulosFichas',
    // Atos
    'dbo.tblWRIAto',
    'dbo.tblWRIAtos',
    'dbo.tblWRITitulosAtos',
    'dbo.tblWRITituloAtos',
    'dbo.tblWRIRecepcaoAtos',
    // Prenotação
    'dbo.tblWRIPrenotacao',
    'dbo.tblWRIPrenotacaoLivros',
    'dbo.tblWRIPrenotacaoLivro'
  ];

  const existing: string[] = [];

  for (const t of candidates) {
    try {
      await pool.request().query(`SELECT TOP 1 * FROM ${t}`);
      existing.push(`${t} (COM ACESSO)`);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        existing.push(`${t}`);
      }
    }
  }

  console.log(`\n=== TABELAS EXISTENTES ENCONTRADAS (${existing.length}) ===`);
  existing.forEach(t => console.log(' - ' + t));

  await pool.close();
}

testMoreTables().catch(console.error);
