import sql from 'mssql';
import { env } from './src/config/env.js';

async function scanWithoutTbl() {
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

  const roots = [
    'Contraditorio', 'Contraditorios', 'Contradicoes', 'Contradicao',
    'Livro', 'Livros', 'Livro2', 'Livro3',
    'Matricula', 'Matriculas', 'Ficha', 'Fichas',
    'Imovel', 'Imoveis',
    'Oficio', 'Oficios', 'Indisponibilidade', 'Indisponibilidades',
    'Prenotacao', 'Prenotacoes', 'Protocolo', 'Protocolos',
    'Titulo', 'Titulos', 'Recepcao', 'Recepcoes',
    'Participante', 'Participantes', 'Parte', 'Partes', 'Pessoa', 'Pessoas',
    'Ato', 'Atos', 'Registro', 'Registros', 'Averbacao', 'Averbacoes',
    'CIAF', 'Selo', 'Selos', 'Certidao', 'Certidoes',
    'TitulosLivros', 'TitulosLivro', 'TitulosImoveis', 'TitulosImovel',
    'TitulosParticipantes', 'TitulosPartes', 'TitulosContraditorio',
    'RecepcaoLivros', 'RecepcaoLivro', 'RecepcaoImoveis', 'RecepcaoImovel',
    'RecepcaoParticipantes', 'RecepcaoContraditorio',
    'ContraditorioLivros', 'ContraditorioLivro', 'ContraditorioImoveis'
  ];

  const prefixes = ['', 'tbl', 'tbl_', 'tblSRI', 'tblCIAF', 'tblWRI_', 'tblCDS_'];
  const candidates: string[] = [];

  for (const p of prefixes) {
    for (const r of roots) {
      candidates.push(`dbo.${p}${r}`);
    }
  }

  console.log(`Testando ${candidates.length} tabelas...`);
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

scanWithoutTbl().catch(console.error);
