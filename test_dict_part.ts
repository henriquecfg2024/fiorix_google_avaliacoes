import sql from 'mssql';
import { env } from './src/config/env.js';

async function dictionaryProbeParticipantes() {
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

  // Words that might be column names
  const words = [
    'Livro', 'NumeroLivro', 'NrLivro', 'NumLivro', 'N_Livro', 'NroLivro',
    'Matricula', 'NrMatricula', 'NumeroMatricula', 'NumMatricula',
    'Folha', 'FolhaInicial', 'FolhaFinal', 'Complemento',
    'Outorgante', 'Outorgado', 'Qualificacao', 'Papel', 'Tipo',
    'Ordem', 'Seq', 'Sequencia', 'Item',
    'Valor', 'Fracao', 'Percentual', 'Cota',
    'Texto', 'Descricao', 'Relato', 'Observacao',
    'FK_tblWRILivro_Id', 'FK_tblWRILivro', 'FK_tblWRIImovel_Id', 'FK_tblWRIImovel',
    'FK_tblWRIAto_Id', 'FK_tblWRIAtos_Id', 'FK_tblWRIOficio_Id',
    'FK_tblWRIContraditorio_Id', 'FK_tblWRIPapel_Id', 'FK_tblWRITipoParticipante_Id',
    'FK_tblWRITipoPapel_Id', 'FK_tblWRIQualificacao_Id',
    'Indicador', 'Contraditorio', 'Indisponibilidade',
    'Imovel', 'Imoveis', 'NrImovel', 'NumeroImovel',
    'Cartorio', 'Orgao', 'Comarca',
    'Data', 'DataCadastro', 'DataRegistro', 'Ativo', 'Cancelado'
  ];

  const found: string[] = [];

  for (const w of words) {
    try {
      await pool.request().query(`SELECT ${w} FROM dbo.tblWRITitulosParticipantes`);
      found.push(w);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(w);
      }
    }
  }

  console.log('=== COLUNAS ENCONTRADAS EM tblWRITitulosParticipantes ===');
  console.log(found);

  await pool.close();
}

dictionaryProbeParticipantes().catch(console.error);
