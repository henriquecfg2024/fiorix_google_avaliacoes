import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeColumns() {
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
    'FK_tblWRIRecepcaoRecepcao', 'FK_tblWRIRecepcao_Id', 'PK_Recepcao', 'FK_Recepcao', 'Recepcao',
    'PK_SeqTitulo', 'FK_tblWRITitulos', 'FK_tblWRITitulo', 'SeqTitulo', 'Titulo',
    'FK_tblWRILivro_Id', 'FK_tblWRILivro', 'PK_Livro', 'IdLivro', 'IDLivro',
    'Livro', 'LIVRO', 'NumeroLivro', 'NrLivro', 'NumLivro', 'N_Livro', 'Numero_Livro', 'Numero', 'Nr',
    'Matricula', 'NrMatricula', 'NumeroMatricula', 'NumMatricula', 'MATRICULA', 'Mat', 'MAT',
    'TipoLivro', 'FK_tblWRITipoLivro_Id', 'Tipo', 'Descricao', 'Texto',
    'Orgao', 'FK_tblWRIOrgao_Id', 'FK_Orgao', 'Serventia',
    'Folha', 'Folhas', 'FolhaInicial', 'FolhaFinal', 'Complemento',
    'Contraditorio', 'Indisponibilidade', 'ContInd', 'Cont_Ind',
    'CIAF', 'ImovelCIAF', 'AtoCIAF', 'Imovel', 'Ato',
    'Outorgante', 'Outorgado', 'Nome', 'Participante', 'FK_tblWRIParticipante_Id',
    'Data', 'DataCadastro', 'DataRegistro', 'DataCriacao', 'DataAtualizacao',
    'Relato', 'RelatoLivro', 'Observacao', 'Observacoes',
    'Ativo', 'Flag', 'Status', 'Excluido', 'Cancelado',
    'FK_tblWRICartorio_Id', 'Cartorio', 'Comarca', 'Circunscricao'
  ];

  const tables = [
    'dbo.tblWRILivro',
    'dbo.tblWRITitulosParticipantes',
    'dbo.tblWRIImovel',
    'dbo.tblWRIAtos'
  ];

  for (const table of tables) {
    const found: string[] = [];
    for (const w of words) {
      try {
        await pool.request().query(`SELECT ${w} FROM ${table}`);
        found.push(w);
      } catch (e: any) {
        if (e.message.includes('permission was denied')) {
          found.push(w);
        }
      }
    }
    console.log(`\nColunas em ${table}:`, found);
  }

  await pool.close();
}

probeColumns().catch(console.error);
