import sql from 'mssql';
import { env } from './src/config/env.js';

async function discoverColumns() {
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

  const tables = [
    'dbo.tblWRITitulosParticipantes',
    'dbo.tblWRILivro',
    'dbo.tblWRIImovel'
  ];

  const commonCols = [
    // PKs and FKs
    'PK_Id', 'PK_ID', 'ID', 'Id', 'PK_Seq', 'Seq',
    'FK_tblWRIRecepcaoRecepcao', 'FK_tblWRITitulos', 'FK_tblWRITitulos_Id', 'FK_tblWRITitulosTitulos',
    'FK_tblWRILivro_Id', 'FK_tblWRILivro', 'FK_tblWRIImovel_Id', 'FK_tblWRIImovel',
    'PK_Recepcao', 'FK_Recepcao', 'Protocolo', 'PROTOCOLO', 'NumeroProtocolo',
    'PK_SeqTitulo', 'FK_SeqTitulo', 'SeqTitulo', 'ItemServico',
    // Livro related
    'Livro', 'LIVRO', 'NumeroLivro', 'NrLivro', 'N_Livro', 'Numero_Livro', 'NumLivro',
    'LivroNumero', 'Livro_Numero', 'Numero', 'NrMatricula', 'Matricula', 'MATRICULA',
    'TipoLivro', 'FK_tblWRITipoLivro_Id', 'Folha', 'FolhaInicial', 'FolhaFinal',
    'Complemento', 'Orgao', 'Contraditorio', 'Indisponibilidade',
    // Participante related
    'Outorgante', 'Outorgado', 'Nome', 'NomeParticipante', 'Papel', 'TipoParticipante',
    'Qualificacao', 'CPF', 'CNPJ', 'Documento', 'NrDocumento',
    // Others
    'Data', 'DataCadastro', 'Observacao', 'Observacoes', 'Status', 'Ativo'
  ];

  for (const table of tables) {
    console.log(`\n=== DESCOBRINDO COLUNAS DE ${table} ===`);
    const validCols: string[] = [];
    for (const col of commonCols) {
      try {
        await pool.request().query(`SELECT ${col} FROM ${table}`);
        validCols.push(col);
      } catch (e: any) {
        if (e.message.includes('permission was denied')) {
          validCols.push(col);
        }
      }
    }
    console.log(`Colunas válidas encontradas em ${table}:`, validCols);
  }

  await pool.close();
}

discoverColumns().catch(console.error);
