import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeParticipantesCols() {
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
    // Keys
    'PK_Id', 'PK_ID', 'ID', 'Id', 'PK_SeqTitulo', 'FK_tblWRIRecepcaoRecepcao',
    'FK_tblWRIRecepcaoFlagRecepcao', 'FK_tblWRITitulos_Id', 'FK_tblWRITitulo',
    // Livro / Matricula
    'Livro', 'NumeroLivro', 'NrLivro', 'NumLivro', 'LIVRO', 'Numero_Livro',
    'Matricula', 'NrMatricula', 'NumeroMatricula', 'MATRICULA', 'Numero', 'Nr',
    'FK_tblWRILivro_Id', 'FK_tblWRILivro', 'FK_tblWRIImovel_Id', 'FK_tblWRIImovel',
    'Folha', 'FolhaInicial', 'FolhaFinal', 'Complemento',
    // Nomes
    'Outorgante', 'Outorgado', 'Nome', 'NomeOutorgante', 'NomeOutorgado',
    'NomeParticipante', 'Papel', 'Tipo', 'TipoParticipante', 'Qualificacao',
    'CPF', 'CNPJ', 'Documento', 'NrDocumento', 'NumeroDocumento',
    'RG', 'Orgao', 'Nacionalidade', 'EstadoCivil', 'Profissao',
    // Foreign keys to other tables
    'FK_tblWRIParticipante_Id', 'FK_tblWRIPessoa_Id', 'FK_tblWRIPessoa',
    'FK_tblWRIOutorgante_Id', 'FK_tblWRIOutorgado_Id',
    'FK_tblWRICartorio_Id', 'FK_tblWRIOrgao_Id',
    // Flags
    'Ordem', 'Seq', 'Item', 'Ativo', 'Flag', 'Observacao', 'Observacoes',
    'Relato', 'Contraditorio', 'Indisponibilidade'
  ];

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

  console.log('=== COLUNAS ENCONTRADAS EM dbo.tblWRITitulosParticipantes ===');
  console.log(found);

  await pool.close();
}

probeParticipantesCols().catch(console.error);
