import sql from 'mssql';
import { env } from './src/config/env.js';

async function scanThousands() {
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
    'Livro', 'Livros', 'Livro2', 'Livro3', 'Livro1',
    'Matricula', 'Matriculas', 'Ficha', 'Fichas',
    'Imovel', 'Imoveis', 'ImovelCIAF', 'AtoCIAF',
    'Oficio', 'Oficios', 'Indisponibilidade', 'Indisponibilidades',
    'Prenotacao', 'Prenotacoes', 'Protocolo', 'Protocolos',
    'SelecaoLivro', 'SelecaoLivros', 'SelecionarLivro', 'SelecionarLivros',
    'SelecaoImovel', 'SelecaoImoveis', 'SelecionarImovel', 'SelecionarImoveis',
    'Relato', 'Relatos', 'RelatoLivro',
    'Busca', 'Buscas', 'Pesquisa', 'Pesquisas',
    'Ato', 'Atos', 'AtosPraticados', 'AtoPraticado',
    'Registro', 'Registros', 'Averbacao', 'Averbacoes',
    'Certidao', 'Certidoes', 'Selo', 'Selos',
    'Parte', 'Partes', 'Participante', 'Participantes',
    'Pessoa', 'Pessoas', 'Outorgante', 'Outorgados',
    'Andamento', 'Andamentos', 'Historico', 'Historicos',
    'Servico', 'Servicos', 'Tarefa', 'Tarefas',
    'Usuario', 'Usuarios', 'Cartorio', 'Cartorios',
    'Caixa', 'Caixas', 'Autenticacao', 'Autenticacoes',
    'Natureza', 'Naturezas', 'Custas', 'Emolumentos'
  ];

  const candidateTables = new Set<string>();
  
  // Single roots
  for (const r of roots) {
    candidateTables.add(`dbo.tblWRI${r}`);
    candidateTables.add(`dbo.tblCDS${r}`);
    candidateTables.add(`dbo.tblSIP${r}`);
    candidateTables.add(`dbo.tbl${r}`);
  }

  // Compound roots (e.g. TitulosLivros, RecepcaoLivros, TitulosImoveis, ContraditorioLivros...)
  const mainPrefixes = ['Titulos', 'Titulo', 'Recepcao', 'Prenotacao', 'Contraditorio', 'Indisponibilidade', 'Oficio', 'Livro', 'Matricula', 'Imovel'];
  const subSuffixes = ['Livro', 'Livros', 'Matricula', 'Matriculas', 'Imovel', 'Imoveis', 'Ato', 'Atos', 'Contraditorio', 'Contraditorios', 'Parte', 'Partes', 'Participante', 'Participantes', 'Pessoas', 'Oficio', 'Oficios', 'CIAF', 'Ficha', 'Fichas', 'Detalhe', 'Detalhes', 'Item', 'Itens'];

  for (const p of mainPrefixes) {
    for (const s of subSuffixes) {
      candidateTables.add(`dbo.tblWRI${p}${s}`);
      candidateTables.add(`dbo.tblWRI${p}_${s}`);
      candidateTables.add(`dbo.tbl${p}${s}`);
    }
  }

  console.log(`Testando ${candidateTables.size} tabelas candidatas...`);

  const existing: string[] = [];
  const list = Array.from(candidateTables);

  for (const t of list) {
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

scanThousands().catch(console.error);
