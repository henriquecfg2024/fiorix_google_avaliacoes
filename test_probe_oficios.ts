import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeOficiosCols() {
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

  const words = [
    'PK_Id', 'PK_ID', 'ID', 'Id', 'FK_tblWRIRecepcaoRecepcao', 'PK_SeqTitulo',
    'NumeroOficio', 'NrOficio', 'Oficio', 'Processo', 'NrProcesso',
    'Livro', 'NumeroLivro', 'NrLivro', 'Matricula', 'NrMatricula',
    'FK_tblWRILivro_Id', 'FK_tblWRIImovel_Id', 'FK_tblWRIPessoas_Id',
    'Orgao', 'FK_tblWRIOrgao_Id', 'Data', 'DataOficio', 'Observacao'
  ];

  const found: string[] = [];
  for (const w of words) {
    try {
      await pool.request().query(`SELECT ${w} FROM dbo.tblWRIOficios`);
      found.push(w);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(w);
      }
    }
  }

  console.log('Colunas encontradas em dbo.tblWRIOficios:', found);

  await pool.close();
}

probeOficiosCols().catch(console.error);
