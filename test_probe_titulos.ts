import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeTitulosColumns() {
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
    // Keys
    'FK_tblWRIRecepcaoRecepcao', 'PK_SeqTitulo', 'FK_tblWRIRecepcaoFlagRecepcao',
    'DataDoTituloApresentado', 'DtPrevisaoEntrega', 'DtDevolucao', 'DtRetirada',
    'DataUltimoRegistro', 'FK_tblWRINatureza_Id',
    // Screen 1 fields from "Dados do Título"
    'Livro', 'NumeroLivro', 'NrLivro', 'NumLivro', 'FK_tblWRILivro_Id',
    'Complemento', 'FolhaInicial', 'FolhaFinal', 'DataTitulo', 'DtTitulo',
    'Processo', 'NrProcesso', 'NumeroProcesso',
    'Oficio', 'NrOficio', 'NumeroOficio',
    'Orgao', 'FK_tblWRIOrgao_Id', 'OrgaoEmissor',
    'Negocio', 'FK_tblWRINegocio_Id',
    'Observacao', 'Observacoes',
    // Matrícula / Imóvel
    'Matricula', 'NrMatricula', 'NumeroMatricula', 'MATRICULA',
    'Imovel', 'FK_tblWRIImovel_Id',
    // CIAF
    'CIAF', 'ImovelCIAF', 'AtoCIAF',
    // Other IDs
    'FK_tblWRIEscrevente_Id', 'FK_tblWRIUsuario_Id', 'Situacao', 'Status'
  ];

  const found: string[] = [];
  for (const w of words) {
    try {
      await pool.request().query(`SELECT ${w} FROM dbo.tblWRITitulos`);
      found.push(w);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(w);
      }
    }
  }

  console.log('Colunas encontradas em dbo.tblWRITitulos:', found);

  await pool.close();
}

probeTitulosColumns().catch(console.error);
