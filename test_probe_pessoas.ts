import sql from 'mssql';
import { env } from './src/config/env.js';

async function probePessoasCols() {
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
    'PK_Id', 'PK_ID', 'Nome', 'NomePessoa', 'CPF', 'CNPJ', 'Documento', 'NrDocumento',
    'Livro', 'NumeroLivro', 'NrLivro', 'Matricula', 'NrMatricula',
    'FK_tblWRILivro_Id', 'FK_tblWRIImovel_Id', 'Observacao'
  ];

  const found: string[] = [];
  for (const c of candidates) {
    try {
      await pool.request().query(`SELECT ${c} FROM dbo.tblWRIPessoas`);
      found.push(c);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(c);
      }
    }
  }

  console.log('Colunas em dbo.tblWRIPessoas:', found);

  await pool.close();
}

probePessoasCols().catch(console.error);
