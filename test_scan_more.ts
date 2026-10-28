import sql from 'mssql';
import { env } from './src/config/env.js';

async function scanMore() {
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
    // Indisponibilidade / Oficios
    'dbo.tblWRIOficio', 'dbo.tblWRIOficios', 'dbo.tblWRIOficioLivro', 'dbo.tblWRIOficiosLivro',
    'dbo.tblWRIOficioLivros', 'dbo.tblWRIOficiosLivros', 'dbo.tblWRIOficioImovel', 'dbo.tblWRIOficiosImovel',
    'dbo.tblWRIIndisponibilidade', 'dbo.tblWRIIndisponibilidades',
    'dbo.tblWRIIndisponibilidadeLivro', 'dbo.tblWRIIndisponibilidadeLivros',
    'dbo.tblWRIIndisponibilidadeImovel', 'dbo.tblWRIIndisponibilidadeImoveis',
    'dbo.tblWRIIndisponibilidadePessoas', 'dbo.tblWRIIndisponibilidadeParticipantes',

    // Contraditorio
    'dbo.tblWRIContraditorio', 'dbo.tblWRIContraditorios',
    'dbo.tblWRIContradicao', 'dbo.tblWRIContradicoes',
    'dbo.tblWRITituloContraditorio', 'dbo.tblWRITituloContraditorios',
    'dbo.tblWRITitulosContraditorio', 'dbo.tblWRITitulosContraditorios',
    'dbo.tblWRIRecepcaoContraditorio', 'dbo.tblWRIRecepcaoContraditorios',

    // Livros / Matriculas
    'dbo.tblWRILivros', 'dbo.tblWRILivro',
    'dbo.tblWRIMatricula', 'dbo.tblWRIMatriculas',
    'dbo.tblWRIMatriculasTitulos', 'dbo.tblWRITitulosMatriculas',
    'dbo.tblWRIMatriculaTitulos', 'dbo.tblWRITituloMatriculas',
    'dbo.tblWRILivroTitulos', 'dbo.tblWRITitulosLivros',
    'dbo.tblWRILivroTitulo', 'dbo.tblWRITituloLivro',

    // CIAF
    'dbo.tblWRICIAF', 'dbo.tblWRICIAFImovel', 'dbo.tblWRICIAFAto', 'dbo.tblWRICIAFLivro',
    'dbo.tblWRITitulosCIAF', 'dbo.tblWRIRecepcaoCIAF',

    // Imoveis
    'dbo.tblWRIImovel', 'dbo.tblWRIImoveis',
    'dbo.tblWRIImoveisTitulos', 'dbo.tblWRITitulosImoveis',
    'dbo.tblWRIImovelTitulos', 'dbo.tblWRITituloImoveis',
    'dbo.tblWRIImovelTitulo', 'dbo.tblWRITituloImovel',
    'dbo.tblWRIRecepcaoImovel', 'dbo.tblWRIRecepcaoImoveis',

    // Participantes
    'dbo.tblWRIParticipante', 'dbo.tblWRIParticipantes',
    'dbo.tblWRIPessoas', 'dbo.tblWRIPessoa',
    'dbo.tblWRITitulosParticipantes', 'dbo.tblWRITitulosParticipante',
    'dbo.tblWRITituloParticipantes', 'dbo.tblWRITituloParticipante',
    'dbo.tblWRIRecepcaoParticipantes', 'dbo.tblWRIRecepcaoParticipante',
    'dbo.tblWRIParticipantesTitulos', 'dbo.tblWRIParticipanteTitulos',

    // Bens
    'dbo.tblWRIBens', 'dbo.tblWRIBem',
    'dbo.tblWRITitulosBens', 'dbo.tblWRITituloBens',
    'dbo.tblWRIRecepcaoBens', 'dbo.tblWRIRecepcaoBem',

    // Relato
    'dbo.tblWRIRelato', 'dbo.tblWRIRelatos',
    'dbo.tblWRITitulosRelato', 'dbo.tblWRITitulosRelatos',

    // Atos
    'dbo.tblWRIAto', 'dbo.tblWRIAtos', 'dbo.tblWRITitulosAtos', 'dbo.tblWRITituloAtos',
    'dbo.tblWRIRecepcaoAtos', 'dbo.tblWRIRecepcaoAto',

    // Prenotacao
    'dbo.tblWRIPrenotacao', 'dbo.tblWRIPrenotacoes',
    'dbo.tblWRIPrenotacaoLivro', 'dbo.tblWRIPrenotacaoLivros',
    'dbo.tblWRIPrenotacaoImovel', 'dbo.tblWRIPrenotacaoImoveis'
  ];

  const found: string[] = [];
  for (const t of candidates) {
    try {
      await pool.request().query(`SELECT 1 FROM ${t}`);
      found.push(`${t} (ACESSO LIVRE)`);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        found.push(t);
      }
    }
  }

  console.log('Tabelas encontradas:', found);

  await pool.close();
}

scanMore().catch(console.error);
