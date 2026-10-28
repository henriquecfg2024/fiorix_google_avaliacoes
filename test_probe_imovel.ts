import sql from 'mssql';
import { env } from './src/config/env.js';

async function probeImovelCols() {
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
    'PK_Id', 'PK_ID', 'ID', 'Id', 'PK_Imovel', 'FK_tblWRIRecepcaoRecepcao',
    'FK_tblWRITitulos', 'PK_SeqTitulo', 'FK_tblWRIRecepcaoFlagRecepcao',
    // Number / Matricula / Livro
    'Matricula', 'NrMatricula', 'NumeroMatricula', 'MATRICULA', 'Numero', 'Nr',
    'Livro', 'NumeroLivro', 'NrLivro', 'NumLivro', 'FK_tblWRILivro_Id',
    'Descricao', 'Complemento', 'Orgao', 'Contraditorio', 'Indisponibilidade',
    // Endereço / Localização
    'Logradouro', 'Bairro', 'Cidade', 'UF', 'CEP', 'Designacao',
    'ContInd', 'CIAF', 'ImovelCIAF', 'AtoCIAF',
    // Transcrição
    'Transcricao', 'NrTranscricao', 'Inscricao', 'Contribuinte', 'SQL',
    // Status
    'Ativo', 'Status', 'DataCadastro', 'Data'
  ];

  const found: string[] = [];
  for (const c of candidates) {
    try {
      await pool.request().query(`SELECT ${c} FROM dbo.tblWRIImovel`);
      found.push(c);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(c);
      }
    }
  }

  console.log('=== COLUNAS EM dbo.tblWRIImovel ===');
  console.log(found);

  await pool.close();
}

probeImovelCols().catch(console.error);
