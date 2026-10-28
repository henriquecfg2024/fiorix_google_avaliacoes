import sql from 'mssql';
import { env } from './src/config/env.js';

async function testPermissions() {
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

  // Test 1: What tables can we SELECT from?
  const testTables = [
    'dbo.tblWRITitulos',
    'dbo.tblWRIRecepcao',
    'dbo.tblWRIContraditorio',
    'dbo.tblWRIContraditorioLivros',
    'dbo.tblWRITitulosLivros',
    'dbo.tblWRIParticipantes',
    'dbo.tblWRITitulosParticipantes',
    'dbo.tblWRIRecepcaoLivros',
    'dbo.tblWRIRecepcaoParticipantes',
    'dbo.tblWRILivros',
    'dbo.tblWRILivro',
    'dbo.tblWRIMatriculas',
    'dbo.tblWRIMatricula',
    'dbo.tblWRIAto',
    'dbo.tblWRIAtos',
    'dbo.tblCDSTarefa'
  ];

  for (const t of testTables) {
    try {
      const res = await pool.request().query(`SELECT TOP 1 * FROM ${t}`);
      console.log(`✅ SELECT PERMITIDO em ${t}! Colunas:`, Object.keys(res.recordset[0] || {}));
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        console.log(`❌ SEM PERMISSAO em ${t} (tabela existe!)`);
      } else if (e.message.includes('Invalid object name')) {
        // Table doesn't exist with this exact name
      } else {
        console.log(`⚠️ Outro erro em ${t}:`, e.message);
      }
    }
  }

  await pool.close();
}

testPermissions().catch(console.error);
