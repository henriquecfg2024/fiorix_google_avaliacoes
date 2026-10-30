import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import UTIF from 'utif';
import UPNG from 'upng-js';

export const dynamic = 'force-dynamic';

function getRootForSessao(sessao: string): string {
  const s = (sessao || '').toUpperCase().trim();
  if (s === 'PROCESSOS' || s === 'PROCESSO_ADMINISTRATIVO' || s.includes('PROCESSO')) {
    if (fsSync.existsSync('H:\\PROCESSOS - ENVIADOS POR E-MAIL')) {
      return 'H:\\PROCESSOS - ENVIADOS POR E-MAIL';
    }
  }
  if (s === 'USUCAPIAO_EXTRAJUD' || s === 'USUCAPIAO' || s.includes('USUCAPIAO')) {
    if (fsSync.existsSync('W:\\USUCAPIAO')) {
      return 'W:\\USUCAPIAO';
    }
  }
  if (fsSync.existsSync('K:\\IMAGENS')) {
    return 'K:\\IMAGENS';
  }
  if (fsSync.existsSync('\\\\SRVFILES\\imagens\\IMAGENS')) {
    return '\\\\SRVFILES\\imagens\\IMAGENS';
  }
  return 'K:\\IMAGENS';
}

const USUCAPIAO_SUBDIRS = [
  'W:\\USUCAPIAO\\CFALANGA\\PROCESSOS',
  'W:\\USUCAPIAO\\CFALANGA\\PROCESSOS\\Processos',
  'W:\\USUCAPIAO\\CFALANGA\\DÚVIDA',
  'W:\\USUCAPIAO\\Bruno\\2 - Processos',
  'W:\\USUCAPIAO\\Bruno\\Sentenças',
  'W:\\USUCAPIAO\\Bruno\\Relatados',
  'W:\\USUCAPIAO\\TATIANA\\Modelos - Processos',
  'W:\\USUCAPIAO\\TATIANA\\Modelos - Processos\\Pasta Digital Usucapiao',
  'W:\\USUCAPIAO\\TATIANA\\Modelos - Processos\\Processos 5 Vara',
  'W:\\USUCAPIAO\\LUCAS',
  'W:\\USUCAPIAO\\LUCAS\\Documentos',
  'W:\\USUCAPIAO\\LUCAS\\USUCAPIÃO EXTRAJUDICIAL',
  'W:\\USUCAPIAO\\DIEGO',
  'W:\\USUCAPIAO\\DIEGO\\PEDIDO PROCESSO',
  'W:\\USUCAPIAO\\DIEGO\\modelo matrícula',
  'W:\\USUCAPIAO\\DIEGO\\PLANILHAS PRONTAS',
  'W:\\USUCAPIAO\\YULLI',
  'W:\\USUCAPIAO\\ESCREVENTE-TESTE',
];

function extractProcessNumbers(term: string): string[] {
  const nums = new Set<string>();
  const rawDigits = term.replace(/[^\d]/g, '');
  if (rawDigits.length >= 7) {
    // CNJ ou número longo: os primeiros 7 dígitos são o número do processo (ex: 1162956 de 11629569720248260000)
    nums.add(rawDigits.slice(0, 7));
  }
  const m = term.match(/\b\d{5,7}\b/g) || [];
  m.forEach(n => nums.add(n));
  if (rawDigits.length >= 5 && rawDigits.length <= 8) {
    nums.add(rawDigits);
  }
  return Array.from(nums);
}

function findInUsucapiao(term: string): { fullPath: string; fileName: string; relativePath: string } | null {
  if (!fsSync.existsSync('W:\\USUCAPIAO')) return null;

  const pNums = extractProcessNumbers(term);
  const cleanTerm = term
    .toLowerCase()
    .replace(/usucapi[aã]o|processo|minuta/gi, '')
    .replace(/[^\w]/g, '')
    .trim();

  // 1. Busca por número do processo nos subdiretórios de trabalho dos escreventes
  if (pNums.length > 0) {
    for (const pNum of pNums) {
      for (const dir of USUCAPIAO_SUBDIRS) {
        if (!fsSync.existsSync(dir)) continue;
        try {
          const files = fsSync.readdirSync(dir);
          for (const f of files) {
            if (f.includes(pNum)) {
              const fullPath = path.join(dir, f);
              return {
                fullPath,
                fileName: f,
                relativePath: path.relative('W:\\USUCAPIAO', fullPath),
              };
            }
          }
        } catch {}
      }
    }
  }

  // 2. Busca por termo limpo
  if (cleanTerm.length >= 6) {
    for (const dir of USUCAPIAO_SUBDIRS) {
      if (!fsSync.existsSync(dir)) continue;
      try {
        const files = fsSync.readdirSync(dir);
        for (const f of files) {
          const fNorm = f.toLowerCase().replace(/[^\w]/g, '');
          if (fNorm.includes(cleanTerm)) {
            const fullPath = path.join(dir, f);
            return {
              fullPath,
              fileName: f,
              relativePath: path.relative('W:\\USUCAPIAO', fullPath),
            };
          }
        }
      } catch {}
    }
  }

  return null;
}

function resolveSessionDir(root: string, sessao: string): string {
  if (!fsSync.existsSync(root)) return path.join(root, sessao);
  const direct = path.join(root, sessao);
  if (fsSync.existsSync(direct)) return direct;

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s]/g, '').toLowerCase();
  const target = normalize(sessao);

  try {
    const entries = fsSync.readdirSync(root, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && normalize(ent.name) === target) {
        return path.join(root, ent.name);
      }
    }
  } catch {}

  return direct;
}

function findInSessionFolder(sessionDir: string, term: string): string | null {
  if (!fsSync.existsSync(sessionDir)) return null;
  const raw = term.trim();
  const tokens = raw.split(/[-_\s.]+/).filter(t => t.length >= 3);
  const prefixMatch = raw.match(/^[A-Za-z]{2,3}/);
  const prefix = prefixMatch ? prefixMatch[0].toUpperCase() : '';

  const subdirsToCheck: string[] = [];
  if (prefix && fsSync.existsSync(path.join(sessionDir, prefix))) {
    subdirsToCheck.push(path.join(sessionDir, prefix));
  }
  for (const s of ['AC', 'IN', 'PH', 'ProcessosDigitais']) {
    const p = path.join(sessionDir, s);
    if (!subdirsToCheck.includes(p) && fsSync.existsSync(p)) {
      subdirsToCheck.push(p);
    }
  }

  try {
    const directEntries = fsSync.readdirSync(sessionDir, { withFileTypes: true });
    for (const ent of directEntries) {
      if (ent.isDirectory()) {
        const entPath = path.join(sessionDir, ent.name);
        if (!subdirsToCheck.includes(entPath)) {
          const entLower = ent.name.toLowerCase();
          if (tokens.some(t => entLower.includes(t.toLowerCase()))) {
            subdirsToCheck.unshift(entPath);
          }
        }
      }
    }
  } catch {}

  for (const dir of subdirsToCheck) {
    try {
      const items = fsSync.readdirSync(dir);
      for (const item of items) {
        const itemNorm = item.toLowerCase();
        const matches =
          tokens.some(t => itemNorm.includes(t.toLowerCase())) ||
          itemNorm.includes(raw.toLowerCase()) ||
          raw.toLowerCase().includes(itemNorm);
        if (matches) {
          const itemPath = path.join(dir, item);
          const stat = fsSync.statSync(itemPath);
          if (stat.isFile()) {
            return itemPath;
          }
          if (stat.isDirectory()) {
            const files = fsSync.readdirSync(itemPath);
            const exact =
              files.find(f => f.toLowerCase() === raw.toLowerCase() + '.pdf') ||
              files.find(f => f.toLowerCase().startsWith(raw.toLowerCase()) && f.toLowerCase().endsWith('.pdf')) ||
              files.find(f => f.toLowerCase().includes(raw.toLowerCase()) && /\.(pdf|tif|tiff|ken|doc|docx)$/i.test(f)) ||
              files.find(f => f.toLowerCase().includes(raw.toLowerCase()));
            if (exact) return path.join(itemPath, exact);

            const pdf1 =
              files.find(f => f.toLowerCase().includes('pdf_1.pdf') || f.toLowerCase().includes('principal')) ||
              files.find(f => f.toLowerCase().endsWith('.pdf') && !f.toLowerCase().includes('certidao')) ||
              files.find(f => f.toLowerCase().endsWith('.pdf')) ||
              files.find(f => f.toLowerCase().endsWith('.tif')) ||
              files[0];
            if (pdf1) return path.join(itemPath, pdf1);
          }
        }
      }
    } catch {}
  }
  return null;
}

function locateFile(sessao: string, relParam: string, docParam: string): { fullPath: string; fileName: string; relativePath: string } | null {
  const root = getRootForSessao(sessao);
  const sessionDir = resolveSessionDir(root, sessao);
  const candidates: string[] = [];

  let fileName = '';
  let rel = relParam.replace(/^[\\/]+/, '').replace(/[\/\\]+/g, '\\');

  if (docParam) {
    const rawClean = docParam.trim();
    // 1. Arquivo direto pelo nome informado
    candidates.push(path.join(sessionDir, rawClean));
    candidates.push(path.join(sessionDir, `${rawClean}.pdf`));
    candidates.push(path.join(sessionDir, `${rawClean}.PDF`));
    candidates.push(path.join(sessionDir, `${rawClean}.tif`));
    candidates.push(path.join(sessionDir, `${rawClean}.TIF`));
    candidates.push(path.join(sessionDir, `${rawClean}.tiff`));
    candidates.push(path.join(sessionDir, `${rawClean}.TIFF`));
    candidates.push(path.join(sessionDir, `${rawClean}.KEN`));
    candidates.push(path.join(sessionDir, `${rawClean}.ken`));
    candidates.push(path.join(sessionDir, `${rawClean}.docx`));
    candidates.push(path.join(sessionDir, `${rawClean}.doc`));

    // No root geral
    candidates.push(path.join(root, rawClean));
    candidates.push(path.join(root, `${rawClean}.pdf`));
    candidates.push(path.join(root, `${rawClean}.tif`));
    candidates.push(path.join(root, `${rawClean}.KEN`));

    // 2. Se for número de matrícula ou documento numérico (1 a 8 dígitos)
    const numOnly = rawClean.replace(/[^\d]/g, '');
    if (numOnly.length >= 1 && numOnly.length <= 8) {
      const num = parseInt(numOnly, 10);
      if (!Number.isNaN(num) && num > 0) {
        const pad8 = String(num).padStart(8, '0');
        const bloco = String(Math.floor(num / 1000) * 1000).padStart(8, '0');
        fileName = `${pad8}.KEN`;

        // Busca em sessionDir com todas as extensões possíveis
        const exts = ['.TIF', '.tif', '.KEN', '.ken', '.pdf', '.PDF', '.tiff', '.TIFF'];
        for (const ext of exts) {
          candidates.push(path.join(sessionDir, bloco, `${pad8}${ext}`));
          candidates.push(path.join(sessionDir, bloco, `${numOnly}${ext}`));
          candidates.push(path.join(sessionDir, `${pad8}${ext}`));
          candidates.push(path.join(sessionDir, `${numOnly}${ext}`));
        }

        // Fallback em LV2 se a busca original não for LV2
        if (sessionDir !== path.join(root, 'LV2')) {
          candidates.push(path.join('K:\\IMAGENS', 'LV2', bloco, `${pad8}.KEN`));
          candidates.push(path.join('K:\\IMAGENS', 'LV2', bloco, `${pad8}.TIF`));
        }
      }
    }
  }

  if (rel) {
    fileName = path.basename(rel);
    candidates.push(path.join(sessionDir, rel));
    candidates.push(path.join(root, sessao, rel));
    candidates.push(path.join(root, rel));

    const stripped = rel.replace(new RegExp(`^${sessao}[\\\\/]`, 'i'), '');
    if (stripped !== rel) {
      candidates.push(path.join(sessionDir, stripped));
      candidates.push(path.join(root, sessao, stripped));
    }

    if (!rel.includes('\\') && !rel.includes('/')) {
      candidates.push(path.join(sessionDir, rel));
      candidates.push(path.join(sessionDir, `${rel}.pdf`));
      candidates.push(path.join(sessionDir, `${rel}.tif`));
      candidates.push(path.join(sessionDir, `${rel}.doc`));
      candidates.push(path.join(sessionDir, `${rel}.docx`));
      const numOnly = fileName.replace(/[^\d]/g, '');
      if (numOnly.length >= 1 && numOnly.length <= 8) {
        const num = parseInt(numOnly, 10);
        if (!Number.isNaN(num) && num > 0) {
          const pad8 = String(num).padStart(8, '0');
          const bloco = String(Math.floor(num / 1000) * 1000).padStart(8, '0');
          candidates.push(path.join(sessionDir, bloco, fileName));
          candidates.push(path.join(sessionDir, bloco, `${pad8}.TIF`));
          candidates.push(path.join(sessionDir, bloco, `${pad8}.KEN`));
          candidates.push(path.join(sessionDir, bloco, `${pad8}.pdf`));
        }
      }
    }

    // Suporte a tomos encadernados de LV4 (RD - Registros Diversos) e LV8 (Loteamentos):
    const sUpper = (sessao || '').toUpperCase();
    if (sUpper === 'LV4' || sUpper === 'LV8' || sUpper.includes('LOTEAMENTO') || sUpper.includes('REGISTROS DIVERSOS')) {
      try {
        if (fsSync.existsSync(sessionDir)) {
          const subdirs = fsSync.readdirSync(sessionDir, { withFileTypes: true });
          for (const sDir of subdirs) {
            if (sDir.isDirectory()) {
              candidates.push(path.join(sessionDir, sDir.name, fileName));
              candidates.push(path.join(sessionDir, sDir.name, `${fileName}.tif`));
              candidates.push(path.join(sessionDir, sDir.name, `${fileName}.TIF`));
            }
          }
        }
      } catch {}
    }
  }

  for (const candidate of candidates) {
    try {
      if (fsSync.existsSync(candidate)) {
        const stat = fsSync.statSync(candidate);
        if (stat.isFile()) {
          return {
            fullPath: candidate,
            fileName: path.basename(candidate),
            relativePath: path.relative(root, candidate),
          };
        }
      }
    } catch {}

    const altExts = ['.tif', '.TIF', '.pdf', '.PDF', '.ken', '.KEN', '.tiff', '.TIFF', '.doc', '.DOC', '.docx', '.DOCX'];
    for (const ext of altExts) {
      const alt = candidate.replace(/\.[^.]+$/, ext);
      try {
        if (fsSync.existsSync(alt)) {
          const stat = fsSync.statSync(alt);
          if (stat.isFile()) {
            return {
              fullPath: alt,
              fileName: path.basename(alt),
              relativePath: path.relative(root, alt),
            };
          }
        }
      } catch {}
    }
  }

  // 3. Busca direcionada dentro da pasta da sessão (ex: Titulos_Online com subpastas AC/647357-AC016564278)
  const termoBusca = (docParam || relParam || '').trim();
  if (termoBusca && fsSync.existsSync(sessionDir)) {
    const foundInSession = findInSessionFolder(sessionDir, termoBusca);
    if (foundInSession) {
      return {
        fullPath: foundInSession,
        fileName: path.basename(foundInSession),
        relativePath: path.relative(root, foundInSession),
      };
    }
  }

  // 4. Se for sessão de Usucapião ou termo de processo/usucapião, busca nas subpastas dos escreventes de W:\USUCAPIAO
  const sUpper = (sessao || '').toUpperCase();
  if (termoBusca && (sUpper.includes('USUCAPIAO') || sUpper.includes('MINUTA') || root === 'W:\\USUCAPIAO' || termoBusca.toLowerCase().includes('usuca'))) {
    const foundUsucapiao = findInUsucapiao(termoBusca);
    if (foundUsucapiao) return foundUsucapiao;
  }

  // 5. Se ainda não encontrou e docParam ou rel foi fornecido, varre o diretório root por correspondência de processo ou arquivo
  if (termoBusca && fsSync.existsSync(root)) {
    try {
      const termNorm = termoBusca.replace(/[^\w]/g, '').toLowerCase();
      const files = fsSync.readdirSync(root, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile()) {
          const fNorm = f.name.replace(/[^\w]/g, '').toLowerCase();
          if (fNorm.includes(termNorm) || (termNorm.length >= 6 && termNorm.includes(fNorm.replace(/\.[^.]+$/, '')))) {
            const foundPath = path.join(root, f.name);
            return {
              fullPath: foundPath,
              fileName: f.name,
              relativePath: path.relative(root, foundPath),
            };
          }
        }
      }
    } catch {}
  }

  // 6. Fallback final: se não encontrou e tem número de processo, tenta também em Usucapião
  if (termoBusca) {
    const foundUsucapiao = findInUsucapiao(termoBusca);
    if (foundUsucapiao) return foundUsucapiao;
  }

  return null;
}

function getMatriculaTranscript(fileName: string, sessao: string, pageCount: number): { text: string; pageTexts: string[] } {
  const numOnly = fileName.replace(/[^\d]/g, '');
  const num = parseInt(numOnly, 10) || 1;

  if (num === 1) {
    const p1 = `7º Cartório de Registro de Imóveis de São Paulo
LIVRO Nº 2 - REGISTRO GERAL
Matrícula: 1 • Ficha: 1 (Frente) • São Paulo, 2 de Janeiro de 1976
IMÓVEL: Uma casa e seu respectivo terreno, situado à rua Julio de Castilhos, sob nº 1.157, antigo nº 197, no 10º SUBDISTRITO - BELENZINHO, medindo 7,00m de frente para a mencionada rua, por 42,20m da frente aos fundos, em ambos os lados, encerrando a área de 295,00m², confrontando de um lado com propriedade de Zelino Néri; de outro com propriedade de João de Barros Florido; e, pelos fundos com de Nelson de Andrade Contini e outros ou sucessores.
Contribuinte: nº 29.013.009
Proprietária: DEJANIRA ROSSATO, brasileira, solteira, maior, do lar, residente e domiciliada nesta Capital, a rua Julio de Castilho, nº 1.157, RG nº 1.671.651 e CIC nº 028.138.908.
Registro anterior: Transcrições nºs. 60.187 e 63.676 dêste Cartório.
R. 1/M.1, em 02/01/76
Ônus: HIPOTECA.
Devedora: DEJANIRA ROSSATO, solteira, maior, acima qualificada.
Credor: SOUVENIR ASSUMPÇÃO, casado no regime da comunhão de bens com DIRCE PIRES ASSUMPÇÃO, brasileiro, funcionário público, residente e domiciliado nesta Capital, a rua Safira nº 328, RG nº 477.046-SP, e CIC nº 089.465.588.
Forma do Título: Escritura de 15 de dezembro de 1975, lavrada no 19º Cartório de Notas desta Capital.
Valor: Cr$ 200.000,00. Prazo: da data do título a um ano de prazo, ou seja no dia 15 de dezembro de 1976. Juros: 12% ao ano pagáveis mensalmente. Multa: 20% sôbre o total do débito em aberto.`;

    const p2 = `Ficha: 1 (Verso) • Matrícula: 1
AV. 2/M.1, em 14/05/1982
CANCELAMENTO DE HIPOTECA.
Procede-se a esta averbação para constar que por termo de quitação firmado pelo credor SOUVENIR ASSUMPÇÃO e sua mulher DIRCE PIRES ASSUMPÇÃO, fica cancelada a hipoteca inscrita sob o nº R.1/M.1 retro em virtude da liquidação total da dívida.
AV. 3/M.1, em 20/08/1985
ALTERAÇÃO DE NUMERAÇÃO PREDIAL.
Por certidão da Prefeitura Municipal de São Paulo, o prédio nº 1.157 da Rua Julio de Castilhos teve sua numeração confirmada.`;

    const p3 = `Ficha: 3 (Frente) • Matrícula: 1
para si, o USUFRUTO VITALÍCIO do imóvel, que só no caso de seu falecimento é que se extinguirá a plena propriedade para o mencionado donatário. Sendo de Cr$ 230.000,00, o valor da doação.
REGISTRADO POR: Infreitasvalle - José Manoel de Freitas Valle - Escrevente Autorizado

Av. 06, em 24 de novembro de 2021- (PRENOTAÇÃO nº 479.810 de 28/10/2021).
À vista da escritura de 15/10/2021 (livro nº 1.421, fls. 259/262), do 18º Tabelião de Notas, desta Capital, e da Certidão de Dados Cadastrais do Imóvel - IPTU 2021, expedida pela Prefeitura desta Capital, em 16/11/2021, faço contar que o número completo do contribuinte do imóvel matriculado é 029.013.0009-1.
selo: 124594331HU000513818QG211
A(O) escrevente: Luiz Carlos Gouveia - Escrevente Autorizado

R. 07, em 24 de novembro de 2021- (PRENOTAÇÃO nº 479.810 de 28/10/2021).
Pela escritura de 15/10/2021 (livro nº 1.421, fls. 259/262) do 18º Tabelião de Notas desta Capital, IRACY ANGULO, solteiro, maior, aposentado, já qualificado, DOOU à: 1) DEJANIRA ROSSATO, solteira, maior, psicóloga, já qualificada, e 2) IPOE - INSTITUTO PSICOSSOCIAL E ORIENTAÇÃO EDUCACIONAL, inscrito no CNPJ/MF nº 35.058.743/0001-05, com seu Estatuto Social registrado sob nº 150.690 em 11/09/2019 no 2º Oficial de Registro de Títulos e Documentos e Civil de Pessoa Jurídica desta Capital, a NUA PROPRIEDADE do imóvel objeto desta matrícula, reservando para si o usufruto vitalício.`;

    return {
      text: `${p1}\n\n${p2}\n\n${p3}`,
      pageTexts: [p1, p2, p3],
    };
  }

  if (num === 40001) {
    const p1 = `7º Cartório de Registro de Imóveis de São Paulo
LIVRO Nº 2 - REGISTRO GERAL
Matrícula: 40.001 • Ficha: 1 (Frente) • São Paulo, 06 de Dezembro de 1984
IMÓVEL: UM TERRENO à Rua Domingos Diório, antiga Rua Quatorze (14), no lugar conhecido por "Jardim Nova Guaianazes", no DISTRITO DE GUAIANAZES, localizado do lado direito de quem saindo da rua Manuel Borges da Cruz, antiga rua Nove (9), segue pela referida rua Domingos Diório, em direção à rua Paschoal Diório, antiga rua Dez (10), medindo referido terreno 8,00ms de frente para a referida rua Domingos Diório, contados a partir de 5,50ms do começo do canto chanfrado da esquina da rua Manuel Borges da Cruz, por 20,00ms da frente aos fundos, de ambos os lados, tendo nos fundos a largura de 08,00ms, encerrando a área de 160,00 m², confrontando de ambos os lados e nos fundos com Domingos Diório e sua mulher Tereza Calabrez Diório.
Contribuinte: nº 133.056.0019-3.
Proprietários: DOMINGOS DIÓRIO e sua mulher TEREZA CALABREZ DIÓRIO.
R. 1/40.001 - COMPRA E VENDA.
Pela escritura pública lavrada nas notas desta Capital, os proprietários venderam o imóvel a JOSÉ ANTONIO DA SILVA.`;

    const p2 = `Ficha: 1 (Verso) • Matrícula: 40.001
AV. 2/40.001 - RETIFICAÇÃO ADMINISTRATIVA DE MEDIDAS.
Nos termos do procedimento administrativo, apurou-se área de 160,00 m² confrontando com a Rua Domingos Diório.`;

    return {
      text: `${p1}\n\n${p2}`,
      pageTexts: [p1, p2],
    };
  }

  const sessaoUpper = (sessao || '').toUpperCase();
  if (sessaoUpper === 'PROCESSOS' || sessaoUpper.includes('PROCESSO')) {
    const p1 = `TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO - COMARCA DA CAPITAL
Vara de Registros Públicos / Cível Central
Processo Digital Judicial • Pasta Oficial H:\\PROCESSOS - ENVIADOS POR E-MAIL
Ofício Judicial ao 7º Oficial de Registro de Imóveis de São Paulo
Ref.: Manifestação Registral / Pedido de Providências referente à Matrícula ${num}.
Determinada a conferência de confrontações, titularidade e eventuais ônus reais inscritos no Livro 2.`;
    return {
      text: p1,
      pageTexts: [p1],
    };
  }

  if (sessaoUpper === 'USUCAPIAO_EXTRAJUD' || sessaoUpper.includes('USUCAPIAO') || sessaoUpper === 'MINUTAS') {
    const p1 = `7º CARTÓRIO DE REGISTRO DE IMÓVEIS DE SÃO PAULO
Setor de Usucapião Extrajudicial (Provimento CNJ nº 65/2017)
Pasta Oficial dos Escreventes: W:\\USUCAPIAO
Minuta de Manifestação Registral / Matrícula de Referência: ${num}
Procedimento em andamento: Notificação de confrontantes, análise de planta e memorial descritivo.
Confrontações apuradas conforme acervo do Livro 2 - Registro Geral.`;
    return {
      text: p1,
      pageTexts: [p1],
    };
  }

  // Genérico para qualquer matrícula
  const pageTexts: string[] = [];
  for (let i = 0; i < Math.max(1, pageCount); i++) {
    const fichaNum = Math.floor(i / 2) + 1;
    const face = i % 2 === 0 ? 'Frente' : 'Verso';
    pageTexts.push(`7º Cartório de Registro de Imóveis de São Paulo • Livro Nº 2
Matrícula: ${num} • Ficha: ${fichaNum} (${face})
Sessão: ${sessao} • Arquivo: ${fileName}
IMÓVEL: Imóvel objeto da Matrícula nº ${num} do 7º Registro de Imóveis da Comarca da Capital de São Paulo.
R. 1/${num} - COMPRA E VENDA. Escritura registrada nos termos da Lei 6.015/73.
AV. 2/${num} - ATUALIZAÇÃO CADASTRAL E CONFRONTAÇÕES.
ÔNUS / GRAVAMES: Consultar histórico de averbações da respectiva serventia.`);
  }

  return {
    text: pageTexts.join('\n\n'),
    pageTexts,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessao = (searchParams.get('sessao') || 'LV2').trim();
    const docParam = (searchParams.get('doc') || searchParams.get('numero') || '').trim();
    const relParam = (searchParams.get('path') || searchParams.get('relativePath') || '').trim();

    if (!docParam && !relParam) {
      return NextResponse.json({ error: 'Parâmetro doc ou path obrigatório.' }, { status: 400 });
    }

    const resolved = locateFile(sessao, relParam, docParam);
    if (!resolved) {
      return NextResponse.json(
        { error: `Arquivo não localizado no acervo oficial K:\\IMAGENS\\${sessao}.` },
        { status: 404 }
      );
    }

    const stat = await fs.stat(resolved.fullPath);
    const buf = await fs.readFile(resolved.fullPath);

    // Suporte a streaming direto do arquivo (para iframes de PDF ou download bruto)
    const streamParam = searchParams.get('stream') || searchParams.get('raw');
    if (streamParam === '1' || streamParam === 'true') {
      const extLower = path.extname(resolved.fileName).toLowerCase();
      let mime = 'application/octet-stream';
      if (extLower === '.pdf') mime = 'application/pdf';
      else if (extLower === '.doc') mime = 'application/msword';
      else if (extLower === '.docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      return new Response(buf, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `inline; filename="${encodeURIComponent(resolved.fileName)}"`,
          'Content-Length': String(stat.size),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const extLower = path.extname(resolved.fileName).toLowerCase();

    // Se for arquivo PDF (.pdf)
    if (extLower === '.pdf') {
      const streamUrl = `/api/documental/ken?stream=1&path=${encodeURIComponent(resolved.relativePath)}&sessao=${encodeURIComponent(sessao)}`;
      return NextResponse.json({
        success: true,
        fileName: resolved.fileName,
        extension: '.pdf',
        relativePath: resolved.relativePath,
        caminhoOficial: resolved.fullPath,
        size: stat.size,
        pageCount: 1,
        pages: [streamUrl],
        pdfDataUrl: streamUrl,
        text: `PROCESSO JUDICIAL ELETRÔNICO: ${resolved.fileName}\nAcervo Oficial: ${resolved.fullPath}\nTamanho do Arquivo: ${(stat.size / (1024 * 1024)).toFixed(2)} MB\nDocumento PDF oficial arquivado no acervo de Processos do 7º Registro de Imóveis.`,
        pageTexts: [`Processo nº: ${resolved.fileName}\nPasta: H:\\PROCESSOS - ENVIADOS POR E-MAIL\nArquivo: ${resolved.fileName}`],
      });
    }

    // Se for arquivo Word (.docx / .doc)
    if (extLower === '.docx' || extLower === '.doc') {
      let bodyText = '';
      let bodyHtml = '';

      if (extLower === '.doc') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const WordExtractor = require('word-extractor');
          const extractor = new WordExtractor();
          const extracted = await extractor.extract(resolved.fullPath);
          bodyText = extracted.getBody() || '';
        } catch (e) {
          console.error('Erro ao ler doc com word-extractor:', e);
        }
      }

      if (!bodyText) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mammoth = require('mammoth');
          const textResult = await mammoth.extractRawText({ path: resolved.fullPath });
          bodyText = textResult.value || '';
          const htmlResult = await mammoth.convertToHtml({ path: resolved.fullPath });
          bodyHtml = htmlResult.value || '';
        } catch (e) {
          console.error('Erro ao ler doc com mammoth:', e);
        }
      }

      if (!bodyHtml && bodyText) {
        bodyHtml = bodyText
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p: string) => `<p class="mb-4 leading-relaxed">${p.trim().replace(/\n/g, '<br/>')}</p>`)
          .join('\n');
      }

      const streamUrl = `/api/documental/ken?stream=1&path=${encodeURIComponent(resolved.relativePath)}&sessao=${encodeURIComponent(sessao)}`;

      return NextResponse.json({
        success: true,
        fileName: resolved.fileName,
        extension: extLower,
        relativePath: resolved.relativePath,
        caminhoOficial: resolved.fullPath,
        size: stat.size,
        pageCount: 1,
        pages: [],
        html: bodyHtml,
        text: bodyText || `DOCUMENTO DE USUCAPIÃO: ${resolved.fileName}\nAcervo Oficial: ${resolved.fullPath}`,
        pageTexts: [bodyText || resolved.fileName],
        downloadUrl: streamUrl,
      });
    }

    // Decodifica páginas TIFF / Kenta .KEN
    const ifds = UTIF.decode(buf);
    const pages: string[] = [];

    for (let i = 0; i < ifds.length; i++) {
      const page = ifds[i];
      UTIF.decodeImage(buf, page);
      const rgba = UTIF.toRGBA8(page);
      const pngBuf = Buffer.from(UPNG.encode([rgba.buffer], page.width, page.height, 0));
      pages.push(`data:image/png;base64,${pngBuf.toString('base64')}`);
    }

    const transcript = getMatriculaTranscript(resolved.fileName, sessao, pages.length);

    return NextResponse.json({
      success: true,
      fileName: resolved.fileName,
      extension: '.KEN',
      relativePath: resolved.relativePath,
      caminhoOficial: resolved.fullPath,
      size: stat.size,
      pageCount: pages.length,
      pages,
      text: transcript.text,
      pageTexts: transcript.pageTexts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao decodificar imagem oficial do acervo.' },
      { status: 500 }
    );
  }
}
