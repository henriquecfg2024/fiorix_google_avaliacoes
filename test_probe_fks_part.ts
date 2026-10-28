import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeFksOnParticipantes() {
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

  const nouns = [
    'Pessoa', 'Pessoas', 'Participante', 'Participantes', 'Parte', 'Partes',
    'Outorgante', 'Outorgados', 'Outorgado', 'Outorgantes',
    'Livro', 'Livros', 'Imovel', 'Imoveis', 'Matricula', 'Matriculas',
    'Papel', 'Tipo', 'Qualificacao', 'Cartorio', 'Orgao',
    'Ato', 'Atos', 'Contraditorio', 'Titulo', 'Titulos'
  ];

  const candidates: string[] = [];
  for (const n of nouns) {
    candidates.push(`FK_tblWRI${n}_Id`);
    candidates.push(`FK_tblWRI${n}`);
    candidates.push(`FK_${n}_Id`);
    candidates.push(`FK_${n}`);
    candidates.push(`Id_${n}`);
    candidates.push(`ID_${n}`);
    candidates.push(`ID${n}`);
    candidates.push(`Id${n}`);
  }

  const found: string[] = [];
  for (const c of candidates) {
    try {
      await pool.request().query(`SELECT ${c} FROM dbo.tblWRITitulosParticipantes`);
      found.push(c);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(c);
      }
    }
  }

  console.log('FKs encontradas em tblWRITitulosParticipantes:', found);

  await pool.close();
}

probeFksOnParticipantes().catch(console.error);
