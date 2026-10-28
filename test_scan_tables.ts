import sql from 'mssql';
import { env } from './src/config/env.js';

async function scanTables() {
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
    // Contraditorio
    'Contraditorio', 'Contraditorios', 'ContraditorioLivro', 'ContraditorioLivros',
    'ContraditorioImovel', 'ContraditorioImoveis', 'ContraditorioParticipante', 'ContraditorioParticipantes',
    'ContraditorioItem', 'ContraditorioItens', 'ContraditorioDetalhe', 'ContraditorioDetalhes',
    'ContraditorioTexto', 'ContraditorioRelato',
    // Livro
    'Livro', 'Livros', 'LivroRegistro', 'LivroAuxiliar', 'LivroIndicador',
    'LivroFicha', 'LivroFichas', 'LivroFolha', 'LivroFolhas',
    'Matricula', 'Matriculas', 'MatriculaImovel', 'MatriculaAto',
    // Imovel
    'Imovel', 'Imoveis', 'ImovelLivro', 'ImovelAto', 'ImovelParticipante',
    // Participante
    'Participante', 'Participantes', 'Parte', 'Partes',
    // Titulo
    'Titulo', 'Titulos', 'TituloLivro', 'TituloLivros', 'TitulosLivro', 'TitulosLivros',
    'TituloImovel', 'TituloImoveis', 'TitulosImovel', 'TitulosImoveis',
    'TituloParticipante', 'TituloParticipantes', 'TitulosParticipante', 'TitulosParticipantes',
    'TituloContraditorio', 'TituloContraditorios', 'TitulosContraditorio', 'TitulosContraditorios',
    'TituloAto', 'TituloAtos', 'TitulosAto', 'TitulosAtos',
    'TituloFicha', 'TituloFichas', 'TitulosFicha', 'TitulosFichas',
    // Recepcao
    'RecepcaoLivro', 'RecepcaoLivros', 'RecepcaoImovel', 'RecepcaoImoveis',
    'RecepcaoParticipante', 'RecepcaoParticipantes',
    'RecepcaoContraditorio', 'RecepcaoContraditorios',
    'RecepcaoAto', 'RecepcaoAtos',
    // Prenotacao
    'Prenotacao', 'Prenotacoes', 'TipoPrenotacao', 'PrenotacaoLivro', 'PrenotacaoLivros',
    // Indisponibilidade
    'Indisponibilidade', 'Indisponibilidades', 'IndisponibilidadeLivro', 'IndisponibilidadeLivros',
    'Oficio', 'Oficios',
    // CIAF
    'CIAF', 'CIAFImovel', 'CIAFAto', 'CIAFLivro',
    // Selos
    'Selo', 'Selos', 'SeloDigital', 'SelosDigitais',
    // Outros
    'Ato', 'Atos', 'TipoAto', 'AtoPraticado', 'AtosPraticados',
    'Registro', 'Registros', 'Averbacao', 'Averbacoes'
  ];

  const prefixes = ['tblWRI', 'tblCDS', 'tblSIP', 'tbl'];
  const candidates: string[] = [];

  for (const p of prefixes) {
    for (const r of roots) {
      candidates.push(`dbo.${p}${r}`);
    }
  }

  console.log(`Testando ${candidates.length} possíveis tabelas...`);
  const existing: string[] = [];

  for (const t of candidates) {
    try {
      await pool.request().query(`SELECT 1 FROM ${t}`);
      existing.push(`${t} (ACESSO LIVRE)`);
    } catch (e: any) {
      if (e.message.includes('permission was denied')) {
        existing.push(t);
      }
    }
  }

  console.log(`\n================== TABELAS ENCONTRADAS (${existing.length}) ==================`);
  existing.forEach(t => console.log(' -> ' + t));

  await pool.close();
}

scanTables().catch(console.error);
