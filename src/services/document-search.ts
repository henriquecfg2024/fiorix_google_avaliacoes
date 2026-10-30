import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const UTIF = require('utif');
const UPNG = require('upng-js');
const WordExtractor = require('word-extractor');

const execFileAsync = promisify(execFile);

export interface DocumentRoot { id: string; path: string }
export interface DocumentMatch {
  rootId: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedAt: string;
  matricula?: string;
}
export interface DocumentSearchResult {
  files: DocumentMatch[];
  partial: boolean;
  unavailableRoots: string[];
  matriculaDetectada?: string;
  matriculas?: string[];
}
const extensions = new Set(['.pdf', '.doc', '.docx', '.tif', '.tiff', '.txt', '.rtf', '.ken']);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Arquivo de bloqueio do Word ("owner file", 162 bytes, oculto/sistema) criado enquanto o documento está aberto.
// Normalmente se chama "~$NOME.doc", mas em compartilhamentos SMB antigos o prefixo pode se perder
// (ex.: "OCESSOS COM SENTENÇA.doc"). Nenhum .doc (OLE, mín. 1,5 KB) ou .docx (ZIP) real tem menos de 1 KB.
const EXT_OFFICE = new Set(['.doc', '.docx']);
const TAMANHO_MINIMO_OFFICE = 1024;
export function isArquivoBloqueioOffice(name: string, size: number): boolean {
  return EXT_OFFICE.has(path.extname(name).toLowerCase()) && size < TAMANHO_MINIMO_OFFICE;
}

export function parseDocumentRoots(raw: string): DocumentRoot[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) throw new Error('Configure de 1 a 10 pastas.');
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Pasta inválida.');
    const root = item as Record<string, unknown>;
    if (typeof root.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(root.id) || ids.has(root.id)) throw new Error('Identificador de pasta inválido ou repetido.');
    if (typeof root.path !== 'string' || !path.isAbsolute(root.path) || root.path.includes('\0')) throw new Error('Use caminhos absolutos.');
    ids.add(root.id);
    return { id: root.id, path: root.path };
  });
}

export function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function resolveAuthorizedRoot(roots: DocumentRoot[], rootId: string): DocumentRoot {
  const root = roots.find(r => r.id === rootId)
    || (rootId === 'livro2' ? roots.find(r => r.id === 'imagens') : undefined)
    || (rootId === 'imagens' ? roots.find(r => r.id === 'livro2') : undefined)
    || (rootId === 'minutas' ? roots.find(r => r.id === 'usucapiao') : undefined)
    || (rootId === 'usucapiao' ? roots.find(r => r.id === 'minutas') : undefined);
  if (!root) throw new Error('Pasta não autorizada.');
  return root;
}

export async function resolveAuthorizedFile(
  roots: DocumentRoot[],
  rootId: string,
  relativePath: string,
): Promise<string> {
  const root = resolveAuthorizedRoot(roots, rootId);
  const canonicalRoot = await fs.realpath(root.path);
  const target = path.resolve(canonicalRoot, relativePath);
  const canonicalTarget = await fs.realpath(target);
  if (!isWithinRoot(canonicalRoot, canonicalTarget)) {
    throw new Error('Acesso fora da pasta autorizada negado.');
  }
  return canonicalTarget;
}

export interface DirectoryEntry {
  name: string;
  type: 'dir' | 'file';
  relativePath: string;
  size?: number;
  modifiedAt?: string;
}
export interface DirectoryListing {
  rootId: string;
  relativePath: string;
  entries: DirectoryEntry[];
  total: number;
  truncated: boolean;
}

const MAX_ENTRADAS_LISTAGEM = 3000;
const MAX_ENTRADAS_CONTAGEM = 20000;
const MAX_STAT_ARQUIVOS = 400;

// Explorador de pastas do Visualizador: lista UMA pasta (sem recursão) dentro de uma raiz autorizada.
// Mesmas garantias da leitura de arquivos: caminho canônico dentro da raiz, symlinks/junctions ignorados
// e apenas extensões documentais conhecidas são expostas.
export async function listDirectory(
  roots: DocumentRoot[],
  rootId: string,
  relativePath: string,
): Promise<DirectoryListing> {
  const root = resolveAuthorizedRoot(roots, rootId);
  const canonicalRoot = await fs.realpath(root.path);
  const rel = relativePath === '.' ? '' : relativePath;
  const canonicalTarget = await fs.realpath(path.resolve(canonicalRoot, rel));
  if (!isWithinRoot(canonicalRoot, canonicalTarget)) {
    throw new Error('Acesso fora da pasta autorizada negado.');
  }
  if (!(await fs.stat(canonicalTarget)).isDirectory()) throw new Error('O caminho informado não é uma pasta.');

  const dirs: DirectoryEntry[] = [];
  const files: DirectoryEntry[] = [];
  let total = 0;
  let truncated = false;
  const handle = await fs.opendir(canonicalTarget);
  for await (const entry of handle) {
    if (entry.isSymbolicLink()) continue;
    // Pastas de sistema ($RECYCLE.BIN etc.) e temporários do Office (~$arquivo.docx)
    if (entry.name.startsWith('$') || entry.name.startsWith('~$')) continue;
    const isDir = entry.isDirectory();
    if (!isDir && !(entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))) continue;
    total++;
    if (total > MAX_ENTRADAS_CONTAGEM) { truncated = true; break; }
    if (dirs.length + files.length >= MAX_ENTRADAS_LISTAGEM) { truncated = true; continue; }
    const entryRel = path.relative(canonicalRoot, path.join(canonicalTarget, entry.name));
    (isDir ? dirs : files).push({ name: entry.name, type: isDir ? 'dir' : 'file', relativePath: entryRel });
  }

  // Tamanho/data só quando a pasta é pequena: em blocos do Livro 2 (1.000 .KEN) o stat via SMB ficaria lento.
  // .doc/.docx são sempre verificados para descartar arquivos de bloqueio do Word.
  const statTodos = files.length <= MAX_STAT_ARQUIVOS;
  const paraStat = statTodos ? files : files.filter(f => EXT_OFFICE.has(path.extname(f.name).toLowerCase()));
  for (let i = 0; i < paraStat.length; i += 50) {
    await Promise.all(paraStat.slice(i, i + 50).map(async f => {
      try {
        const info = await fs.stat(path.join(canonicalRoot, f.relativePath));
        f.size = info.size;
        f.modifiedAt = info.mtime.toISOString();
      } catch {}
    }));
  }
  const arquivosValidos = files.filter(f => f.size === undefined || !isArquivoBloqueioOffice(f.name, f.size));
  total -= files.length - arquivosValidos.length;
  if (!statTodos) for (const f of arquivosValidos) { delete f.size; delete f.modifiedAt; }

  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  dirs.sort((a, b) => collator.compare(a.name, b.name));
  arquivosValidos.sort((a, b) => collator.compare(a.name, b.name));
  return {
    rootId,
    relativePath: path.relative(canonicalRoot, canonicalTarget),
    entries: [...dirs, ...arquivosValidos],
    total: Math.min(total, MAX_ENTRADAS_CONTAGEM),
    truncated,
  };
}

export async function executeDocumentCli(
  command: 'extrair-peticao' | 'analisar-assinaturas',
  filePath: string,
  options?: { pageStart?: number; pageEnd?: number },
): Promise<unknown> {
  const defaultBin = 'B:\\henrique-dev\\app-biblioteca\\src-tauri\\target\\debug\\fiorix-gd-cli.exe';
  const cliPath = process.env.FIORIX_GD_CLI_PATH || defaultBin;
  const args = [command, filePath];
  if (options?.pageStart) args.push('--inicio', String(options.pageStart));
  if (options?.pageEnd) args.push('--fim', String(options.pageEnd));

  const { stdout } = await execFileAsync(cliPath, args, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  return JSON.parse(stdout);
}

// HTTPS is always required, except plain HTTP to the local loopback when explicitly
// allowed for local testing (never in production). Prevents credentials over the network.
export function isAllowedDocumentApiUrl(
  rawUrl: string,
  options: { allowInsecureLocalhost: boolean; environment: string },
): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol === 'https:') return true;
  if (!options.allowInsecureLocalhost || options.environment === 'production') return false;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export function extrairNumeroMatricula(textoOuNome: string): string | null {
  if (!textoOuNome) return null;
  const match = textoOuNome.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*[:.\s]*([0-9.\-]+)/i);
  if (match) {
    const rawNum = match[1].trim().replace(/[.\-]+$/, '');
    if (rawNum.length >= 2) {
      const rotulo = /transcri/i.test(match[0]) ? 'Transcrição' : 'Matrícula';
      return `${rotulo} nº ${rawNum}`;
    }
  }

  const fileNumMatch = textoOuNome.match(/(?:^|[\\/_\-\s])0*([1-9][0-9]{2,7})(?:\.pdf|\.tif|\.tiff|\.ken|\.docx?|$)/i);
  if (fileNumMatch) {
    const digits = fileNumMatch[1];
    if (digits.length >= 3 && digits.length <= 7) {
      return `Matrícula nº ${digits}`;
    }
  }

  return null;
}

export async function detectarMatriculaEmArquivo(filePath: string): Promise<string | null> {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const nameMatch = extrairNumeroMatricula(fileName);
  if (nameMatch) return nameMatch;

  if (ext === '.docx' || ext === '.doc') {
    try {
      const { value: text } = await mammoth.extractRawText({ path: filePath });
      const docMatch = extrairNumeroMatricula(text);
      if (docMatch) return docMatch;
    } catch {}
  } else if (ext === '.txt' || ext === '.rtf') {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const txtMatch = extrairNumeroMatricula(content);
      if (txtMatch) return txtMatch;
    } catch {}
  } else if (ext === '.pdf') {
    try {
      const handle = await fs.open(filePath, 'r');
      const buf = Buffer.alloc(65536);
      const { bytesRead } = await handle.read(buf, 0, 65536, 0);
      await handle.close();
      const slice = buf.subarray(0, bytesRead);

      let text = slice.toString('latin1');
      const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
      let m;
      let count = 0;
      while ((m = streamRegex.exec(text)) !== null && count < 6) {
        count++;
        try {
          const decomp = zlib.inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
          text += ' ' + decomp;
        } catch {}
      }
      const pdfMatch = extrairNumeroMatricula(text);
      if (pdfMatch) return pdfMatch;
    } catch {}
  }

  return null;
}

// Nº de processo CNJ completo ou parcial: 1162956-97 | 1162956-97.2024 | 1162956-97.2024.8.26.0100
const REGEX_PROCESSO_CNJ = /\b\d{7}-\d{2}(?:\.\d{4}(?:\.\d(?:\.\d{2}(?:\.\d{4})?)?)?)?\b/g;

export function removerNumerosDeProcesso(query: string): string {
  return query.replace(REGEX_PROCESSO_CNJ, ' ');
}

/** A consulta contém nº de processo e nenhum outro número (ex.: "1162956-97.2024.8.26.0100") */
export function consultaApenasProcesso(query: string): boolean {
  return removerNumerosDeProcesso(query) !== query && !/\d/.test(removerNumerosDeProcesso(query));
}

// Localização direta e ultrarrápida de imagens de matrículas no padrão do 7º RI (K:\IMAGENS\LV2).
// Todas as matrículas no acervo do Livro 2 são arquivos .KEN de 8 dígitos divididos em blocos de 1.000.
export async function checkDirectMatriculaFiles(
  canonicalRoot: string,
  rootId: string,
  query: string,
): Promise<DocumentMatch[]> {
  const matches: DocumentMatch[] = [];
  const numbersToTry = new Set<number>();

  // Números de processo (CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO, inclusive parciais) não são matrícula.
  // Sem isso o ano de "1162956-97.2024" virava a matrícula 2.024 (00002024.KEN).
  const consultaSemProcesso = removerNumerosDeProcesso(query);

  // 1. Se contiver número formatado com pontos (ex: "123.456", "45.890"), extrai o número unificado sem quebrar nos pontos
  const formattedMatches = consultaSemProcesso.match(/\b\d{1,3}(?:\.\d{3})+(?:-\d+)?\b/g);
  if (formattedMatches) {
    for (const f of formattedMatches) {
      const num = parseInt(f.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num > 0) numbersToTry.add(num);
    }
  }

  // 2. Extrai número completo desconsiderando pontos e traços (ex: "123.456" -> 123456, "45.890" -> 45890)
  const fullDigits = consultaSemProcesso.replace(/[^\d]/g, '');
  if (fullDigits.length >= 2 && fullDigits.length <= 8) {
    numbersToTry.add(parseInt(fullDigits, 10));
  }

  // 3. Extrai sequências isoladas de 3 a 8 dígitos caso a consulta contenha outros termos NÃO separados por pontos
  const unpunctQuery = consultaSemProcesso.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ');
  const digitMatches = unpunctQuery.match(/\b\d{3,8}\b/g);
  if (digitMatches) {
    for (const d of digitMatches) {
      const num = parseInt(d, 10);
      if (!isNaN(num) && num > 0) numbersToTry.add(num);
    }
  }

  const seenPaths = new Set<string>();

  for (const num of numbersToTry) {
    if (isNaN(num) || num <= 0) continue;

    // Padrão do 7º RI: K:\IMAGENS\LV2\00123000\00123456.KEN (sempre 8 dígitos com extensão .KEN)
    const pad8 = String(num).padStart(8, '0');
    const pad6 = String(num).padStart(6, '0');
    const rawStr = String(num);

    const block1000 = String(Math.floor(num / 1000) * 1000).padStart(8, '0');
    const block10000 = String(Math.floor(num / 10000) * 10000).padStart(8, '0');

    // Pastas do cartório no acervo de imagens (LV2 = Livro 2 / Registro Geral das matrículas)
    const candidateLivros = ['LV2', 'LV3', 'LV1', ''];
    const candidateBlocks = [block1000, block10000, ''];
    // Matrículas em K:\IMAGENS\LV2 são estritamente arquivos .KEN
    const candidateNames = [
      `${pad8}.KEN`,
      `${pad8}.ken`,
      `${pad6}.KEN`,
      `${rawStr}.KEN`,
      `${pad8}.TIF`,
      `${pad8}.tif`,
    ];

    for (const livro of candidateLivros) {
      for (const block of candidateBlocks) {
        for (const name of candidateNames) {
          const rel = livro
            ? (block ? path.join(livro, block, name) : path.join(livro, name))
            : (block ? path.join(block, name) : name);

          const lowerRel = rel.toLowerCase();
          if (seenPaths.has(lowerRel)) continue;
          seenPaths.add(lowerRel);

          const fullPath = path.join(canonicalRoot, rel);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isFile()) {
              matches.push({
                rootId,
                relativePath: rel,
                name: path.basename(rel),
                size: stat.size,
                modifiedAt: stat.mtime.toISOString(),
                matricula: `Matrícula nº ${num}`,
              });
            }
          } catch {}
        }
      }
    }
  }

  return matches;
}

// No path supplied by a browser is accepted. Only locally configured roots are traversed.
// Symlinks/junctions are skipped and each directory/file is checked against the canonical root.
export async function searchDocuments(
  roots: DocumentRoot[], query: string, limit = 100,
  budget = { maxEntries: 50000, timeoutMs: 25000 },
): Promise<DocumentSearchResult> {
  // Busca Cruzada: os campos chegam separados por "|" (ex.: "1124837-38.2022.8.26.0100 | 7987").
  // Cada campo é um critério independente: termos DENTRO do campo precisam casar juntos (E),
  // e o resultado final é a UNIÃO dos critérios (OU). Antes todos os termos eram exigidos no mesmo
  // caminho, então processo + matrícula nunca casavam com nenhum arquivo do processo.
  const criterios = query.split('|')
    .map(texto => ({ texto: texto.trim(), termos: normalize(texto).trim().split(/\s+/).filter(Boolean) }))
    .filter(c => c.termos.join(' ').length >= 2);
  const buscaCruzada = criterios.length > 1;
  if (criterios.length === 0 || query.length > 200 || limit < 1 || limit > 100) throw new Error('Pesquisa inválida.');

  const termoCasa = (term: string, normRel: string, cleanRel: string): boolean => {
    if (buscaCruzada) {
      // Na busca cruzada, nº curto (matrícula, SQL) precisa aparecer isolado no caminho:
      // "7987" não pode casar com "1079875-..." de outro processo.
      const digitos = /^\d{1,3}(?:\.\d{3})+$/.test(term) ? term.replace(/\./g, '') : term;
      if (/^\d{1,8}$/.test(digitos)) {
        const semZeros = digitos.replace(/^0+/, '') || '0';
        return new RegExp(`(^|\\D)0*${semZeros}(\\D|$)`).test(normRel);
      }
    }
    if (normRel.includes(term)) return true;
    const cleanTerm = term.replace(/[.\-_/\s]/g, '');
    return cleanTerm.length >= 2 && cleanRel.includes(cleanTerm);
  };

  const result: DocumentSearchResult = { files: [], partial: false, unavailableRoots: [] };
  // Imagens localizadas diretamente pelo nº digitado: o usuário pediu explicitamente, nunca são descartadas
  const chavesExplicitas = new Set<string>();
  let visited = 0;
  const deadline = Date.now() + budget.timeoutMs;
  for (const root of roots) {
    let canonical: string;
    try { canonical = await fs.realpath(root.path); }
    catch { result.unavailableRoots.push(root.id); result.partial = true; continue; }
    const ehAcervoImagens = root.id === 'imagens' || root.id === 'livro2';

    // 1. Busca direta ultrarrápida para matrículas .KEN (resolve K:\IMAGENS\LV2 em poucos ms)
    const criteriosResolvidosDireto = new Set<number>();
    for (let i = 0; i < criterios.length; i++) {
      try {
        const directMatches = await checkDirectMatriculaFiles(canonical, root.id, criterios[i].texto);
        for (const m of directMatches) {
          const key = `${m.rootId}:${m.relativePath.toLowerCase()}`;
          // Na busca simples o nº é ambíguo (pode ser processo); só o campo da busca cruzada é explícito
          if (buscaCruzada) chavesExplicitas.add(key);
          criteriosResolvidosDireto.add(i);
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push(m);
          }
        }
      } catch {}
    }

    const criteriosParaVarrer = criterios.filter((c, i) => {
      if (!ehAcervoImagens) return true;
      // Já localizamos o .KEN direto no Livro 2: evita varredura pesada de 50.000 entradas na rede SMB
      if (criteriosResolvidosDireto.has(i)) return false;
      // As imagens do Livro 2 são nomeadas apenas pelo nº da matrícula: uma consulta que é só
      // nº de processo (CNJ) nunca casa com elas, então não varremos o acervo K:\IMAGENS\LV2.
      if (consultaApenasProcesso(c.texto)) return false;
      // Na busca cruzada, campo sem número (ex.: nome do requerente) nunca casa com imagens numeradas
      if (buscaCruzada && !/\d/.test(c.texto)) return false;
      return true;
    });
    if (criteriosParaVarrer.length === 0) continue;

    const queue: string[] = [canonical];
    let queueHead = 0;
    while (queueHead < queue.length) {
      if (Date.now() >= deadline || visited >= budget.maxEntries || result.files.length >= limit) { result.partial = true; break; }
      const directory = queue[queueHead++];
      try {
        const handle = await fs.opendir(directory);
        for await (const entry of handle) {
          if (++visited > budget.maxEntries || Date.now() >= deadline || result.files.length >= limit) { result.partial = true; break; }
          if (entry.isSymbolicLink()) continue;
          const filePath = path.join(directory, entry.name);
          if (!isWithinRoot(canonical, filePath)) continue;
          if (entry.isDirectory()) {
            queue.push(filePath);
            continue;
          }
          if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
          const relativePath = path.relative(canonical, filePath);
          const normRel = normalize(relativePath);
          const cleanRel = normRel.replace(/[.\-_/\s]/g, '');
          // Busca inteligente: cada termo do critério deve bater com o caminho (com pontuação ou dígitos limpos);
          // basta um critério casar (busca cruzada = união dos campos)
          const matches = criteriosParaVarrer.some(c => c.termos.every(term => termoCasa(term, normRel, cleanRel)));
          if (!matches) continue;

          // Validação canônica e stat apenas para arquivos que realmente correspondem aos filtros
          const resolved = await fs.realpath(filePath);
          if (!isWithinRoot(canonical, resolved)) continue;
          const info = await fs.stat(filePath);
          if (isArquivoBloqueioOffice(entry.name, info.size)) continue;

          const key = `${root.id}:${relativePath.toLowerCase()}`;
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push({ rootId: root.id, relativePath, name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() });
          }
        }
      } catch { result.partial = true; }
    }
  }

  // Enriquecer os resultados identificando matrículas vinculadas aos arquivos encontrados
  if (result.files.length > 0) {
    const matriculasEncontradas = new Set<string>();
    const matriculasDosProcessos = new Set<string>();
    let matriculaPrincipalProcesso: string | undefined;
    let matriculaPrincipal: string | undefined;

    const filesToInspect = result.files.slice(0, 20);
    await Promise.all(
      filesToInspect.map(async file => {
        try {
          const ext = path.extname(file.name).toLowerCase();
          const isImageFile = ext === '.ken' || ext === '.tif' || ext === '.tiff';

          if (file.matricula) {
            matriculasEncontradas.add(file.matricula);
            if (!isImageFile) {
              matriculasDosProcessos.add(file.matricula);
              if (!matriculaPrincipalProcesso) matriculaPrincipalProcesso = file.matricula;
            }
            if (!matriculaPrincipal) matriculaPrincipal = file.matricula;
            return;
          }
          const nameMat = extrairNumeroMatricula(file.name);
          if (nameMat) {
            file.matricula = nameMat;
            matriculasEncontradas.add(nameMat);
            if (!isImageFile) {
              matriculasDosProcessos.add(nameMat);
              if (!matriculaPrincipalProcesso) matriculaPrincipalProcesso = nameMat;
            }
            if (!matriculaPrincipal) matriculaPrincipal = nameMat;
            return;
          }
          const canonicalTarget = await resolveAuthorizedFile(roots, file.rootId, file.relativePath);
          const mat = await detectarMatriculaEmArquivo(canonicalTarget);
          if (mat) {
            file.matricula = mat;
            matriculasEncontradas.add(mat);
            matriculasDosProcessos.add(mat);
            const lower = file.name.toLowerCase();
            if (!matriculaPrincipalProcesso || lower.includes('manifestacao') || lower.includes('peticao') || lower.includes('usucapiao')) {
              matriculaPrincipalProcesso = mat;
            }
            matriculaPrincipal = matriculaPrincipalProcesso || mat;
          }
        } catch {}
      })
    );

    const matriculaFinal = matriculaPrincipalProcesso || matriculaPrincipal || Array.from(matriculasEncontradas)[0];
    if (matriculaFinal) {
      result.matriculaDetectada = matriculaFinal;
      result.matriculas = Array.from(new Set([matriculaFinal, ...matriculasDosProcessos, ...matriculasEncontradas]));
    }

    // -------------------------------------------------------------
    // REGRA DE BUSCA CRUZADA AUTOMÁTICA COM O LIVRO 2 (K:\IMAGENS\LV2):
    // Se a busca encontrou documentos de processo (PDF, DOCX) e detectou a matrícula
    // a eles vinculada (ex: Matrícula nº 123.456), realizamos o cruzamento automático
    // para localizar a imagem digitalizada (.KEN) dessa matrícula no acervo do Livro 2
    // e incluí-la diretamente no resultado da busca!
    // -------------------------------------------------------------
    const matriculasParaCruzar = new Set<string>();
    if (result.matriculaDetectada) matriculasParaCruzar.add(result.matriculaDetectada);
    for (const m of matriculasDosProcessos) matriculasParaCruzar.add(m);

    const temDocumentosProcesso = result.files.some(f => {
      const ext = path.extname(f.name).toLowerCase();
      return ext !== '.ken' && ext !== '.tif' && ext !== '.tiff';
    });

    if (matriculasParaCruzar.size > 0 && temDocumentosProcesso) {
      const numerosEsperados = new Set<string>();
      for (const m of matriculasParaCruzar) {
        const d = m.replace(/[^\d]/g, '');
        if (d) numerosEsperados.add(d);
      }

      // 1. Buscar arquivos .KEN no acervo para cada matrícula detectada
      const arquivosCruzados: DocumentMatch[] = [];
      for (const mat of matriculasParaCruzar) {
        for (const root of roots) {
          try {
            const canonical = await fs.realpath(root.path);
            const directMatches = await checkDirectMatriculaFiles(canonical, root.id, mat);
            for (const match of directMatches) {
              const key = `${match.rootId}:${match.relativePath.toLowerCase()}`;
              if (!arquivosCruzados.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
                arquivosCruzados.push(match);
              }
            }
          } catch {}
        }
      }

      // 2. Se temos documentos do processo e encontramos a matrícula dele (ex: 123.456),
      // remover falsos positivos de arquivos de imagem (.KEN) que vieram apenas por colisão
      // de substring com o termo do processo (ex: "00000001.KEN" não pertence ao processo 00001 cuja matrícula é 123.456)
      result.files = result.files.filter(f => {
        const ext = path.extname(f.name).toLowerCase();
        const isImg = ext === '.ken' || ext === '.tif' || ext === '.tiff';
        if (!isImg) return true; // Preserva todos os arquivos de processo (PDF, DOCX, TXT, etc.)
        // Matrícula digitada explicitamente (ex.: campo Matrícula da Busca Cruzada) sempre permanece
        if (chavesExplicitas.has(`${f.rootId}:${f.relativePath.toLowerCase()}`)) return true;

        const fNum = parseInt(f.name.replace(/[^\d]/g, ''), 10);
        return Array.from(numerosEsperados).some(numStr => {
          const num = parseInt(numStr, 10);
          return !isNaN(fNum) && !isNaN(num) && fNum === num;
        });
      });

      // 3. Adicionar os arquivos .KEN encontrados pela busca cruzada
      for (const cruzado of arquivosCruzados) {
        const key = `${cruzado.rootId}:${cruzado.relativePath.toLowerCase()}`;
        if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
          result.files.push(cruzado);
        }
      }

      // Atualizar lista final de matrículas
      result.matriculas = Array.from(new Set([...matriculasParaCruzar]));
      result.matriculaDetectada = matriculaPrincipalProcesso || result.matriculaDetectada;
    }
  }

  return result;
}

export interface DocumentVisualPayload {
  fileName: string;
  extension: string;
  size: number;
  html: string;
  text: string;
  pdfDataUrl?: string;
  pages?: string[];
  pageCount?: number;
}

export async function readDocumentText(filePath: string): Promise<DocumentVisualPayload> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // 1. Imagens de Matrícula (Wang TIFF / Kenta .KEN / TIFF)
  if (ext === '.ken' || ext === '.tif' || ext === '.tiff') {
    try {
      const buf = await fs.readFile(filePath);
      const ifds = UTIF.decode(buf);
      const pages: string[] = [];
      for (let i = 0; i < ifds.length; i++) {
        const page = ifds[i];
        UTIF.decodeImage(buf, page);
        const rgba = UTIF.toRGBA8(page);
        const pngBuf = Buffer.from(UPNG.encode([rgba.buffer], page.width, page.height, 0));
        pages.push(`data:image/png;base64,${pngBuf.toString('base64')}`);
      }

      const html = `
        <div style="font-family: sans-serif; text-align: center;">
          <div style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block;">
            <span style="font-size: 13px; font-weight: bold; color: #0369a1;">
              7º Registro de Imóveis • Matrícula Digitalizada (${pages.length} folha${pages.length > 1 ? 's' : ''})
            </span>
          </div>
          ${pages.map((p, idx) => `
            <div style="margin-bottom: 30px; text-align: center;">
              <div style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 8px;">
                Folha / Ficha ${idx + 1} de ${pages.length}
              </div>
              <img src="${p}" style="max-width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);" alt="Ficha ${idx + 1}" />
            </div>
          `).join('')}
        </div>
      `;

      return {
        fileName,
        extension: ext,
        size: stat.size,
        pages,
        pageCount: pages.length,
        html,
        text: `[Imagem Digitalizada da Matrícula: ${fileName} - ${pages.length} folha(s) no Livro 2 (Registro Geral)]`,
      };
    } catch {
      return {
        fileName,
        extension: ext,
        size: stat.size,
        html: `<p>Não foi possível decodificar visualmente as páginas do arquivo de imagem ${fileName}.</p>`,
        text: `[Erro ao decodificar imagem ${fileName}]`,
      };
    }
  }

  // 2. Arquivos PDF (Petições, laudos, certidões)
  if (ext === '.pdf') {
    try {
      const buf = await fs.readFile(filePath);
      const pdfBase64 = buf.toString('base64');
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
      const html = `<iframe src="${pdfDataUrl}" width="100%" height="800px" style="border: none; border-radius: 8px;" title="${fileName}"></iframe>`;

      return {
        fileName,
        extension: ext,
        size: stat.size,
        pdfDataUrl,
        html,
        text: `[Documento PDF: ${fileName} • ${Math.round(stat.size / 1024)} KB]`,
      };
    } catch {
      return {
        fileName,
        extension: ext,
        size: stat.size,
        html: `<p>Não foi possível carregar o arquivo PDF ${fileName}.</p>`,
        text: `[Erro ao carregar PDF ${fileName}]`,
      };
    }
  }

  // 3. Minutas em Word DOCX (.docx)
  if (ext === '.docx') {
    try {
      const htmlResult = await mammoth.convertToHtml({ path: filePath });
      const textResult = await mammoth.extractRawText({ path: filePath });
      return {
        fileName,
        extension: ext,
        html: htmlResult.value || '<p>Documento sem texto detectável.</p>',
        text: textResult.value || '',
        size: stat.size,
      };
    } catch {
      const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
      return {
        fileName,
        extension: ext,
        html: `<p>${raw.replace(/\n/g, '<br/>')}</p>`,
        text: raw,
        size: stat.size,
      };
    }
  }

  // 4. Minutas em Word DOC (.doc clássico)
  if (ext === '.doc') {
    try {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(filePath);
      const text = extracted.getBody() || '';
      const html = `<div style="font-family: inherit; line-height: 1.6;">${text.split('\n\n').filter(Boolean).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}</div>`;
      return {
        fileName,
        extension: ext,
        html: html || '<p>Documento Word sem texto detectável.</p>',
        text: text || '',
        size: stat.size,
      };
    } catch {
      try {
        const htmlResult = await mammoth.convertToHtml({ path: filePath });
        const textResult = await mammoth.extractRawText({ path: filePath });
        return {
          fileName,
          extension: ext,
          html: htmlResult.value || '<p>Documento sem texto detectável.</p>',
          text: textResult.value || '',
          size: stat.size,
        };
      } catch {
        const raw = await fs.readFile(filePath, 'latin1').catch(() => '');
        const clean = raw.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ');
        return {
          fileName,
          extension: ext,
          html: `<p>${clean}</p>`,
          text: clean,
          size: stat.size,
        };
      }
    }
  }

  // 5. Demais formatos de texto (.txt, .rtf)
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  return {
    fileName,
    extension: ext,
    html: `<pre style="white-space: pre-wrap; font-family: inherit;">${raw}</pre>`,
    text: raw,
    size: stat.size,
  };
}

export interface ConfrontacoesExtraidas {
  ladoDireito: string;
  ladoEsquerdo: string;
  fundos: string;
}

export function limparConfrontante(valor: string): string {
  if (!valor) return '';
  let limpo = valor.trim();

  // Remove pontuações iniciais e traços
  limpo = limpo.replace(/^[\s\-–—:;.]+|[\s\-–—:;.]+$/g, '').trim();

  // Remove prefixos direcionais redundantes caso venham no texto capturado
  limpo = limpo.replace(/^(?:pelo\s+lado\s+direito|do\s+lado\s+direito|lado\s+direito|à\s+direita|a\s+direita|direita)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|lado\s+esquerdo|à\s+esquerda|a\s+esquerda|esquerda)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos|fundos)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^[:\s\-–—]+/, '').trim();

  // Remove menções subsequentes a outras direções que possam ter sido engolidas pela captura
  limpo = limpo.replace(/\s+(?:,\s*)?(?:pelo\s+lado|do\s+lado|lado|e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|e\s+fundos|\bfundos\b|esquerdo|direito|à\s+esquerda|à\s+direita).*$/i, '').trim();

  // Remove traços ou pontuações finais remanescentes
  limpo = limpo.replace(/[\s\-–—:;.,]+$/, '').trim();

  if (!limpo) return '';

  // Padroniza com 'com ' se não iniciar com 'com '
  if (!/^com\b/i.test(limpo)) {
    limpo = `com ${limpo}`;
  }
  return limpo;
}

export function extrairConfrontacoes(texto: string): ConfrontacoesExtraidas {
  if (!texto) return { ladoDireito: '', ladoEsquerdo: '', fundos: '' };

  let ladoDireito = '';
  let ladoEsquerdo = '';
  let fundos = '';

  // 1. Lado Direito
  const matchDir = texto.match(
    /(?:pelo\s+lado\s+direito|do\s+lado\s+direito|lado\s+direito|à\s+direita|a\s+direita|\bdireito\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:,\s*(?:pelo\s+lado|do\s+lado|e\s+aos|aos\s+fundos|e\s+pelos|e\s+nos|lado\s+esquerdo|esquerdo|à\s+esquerda)|;\s*|\n|\r|$))/i
  );
  if (matchDir) {
    ladoDireito = limparConfrontante(matchDir[1] || matchDir[0]);
  }

  // 2. Lado Esquerdo
  const matchEsq = texto.match(
    /(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|lado\s+esquerdo|à\s+esquerda|a\s+esquerda|\besquerdo\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:,\s*(?:pelo\s+lado|do\s+lado|e\s+aos|aos\s+fundos|e\s+pelos|e\s+nos|e\s+fundos|fundos)|;\s*|\s+e\s+(?:aos\s+|nos\s+|pelos\s+)?fundos|\n|\r|$))/i
  );
  if (matchEsq) {
    ladoEsquerdo = limparConfrontante(matchEsq[1] || matchEsq[0]);
  }

  // 3. Fundos
  const matchFundos = texto.match(
    /(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos|\bfundos\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:;\s*|\.|\n|\r|$))/i
  );
  if (matchFundos) {
    fundos = limparConfrontante(matchFundos[1] || matchFundos[0]);
  }

  return { ladoDireito, ladoEsquerdo, fundos };
}

export function enrichPetitionData(data: Record<string, any>, relativePath?: string): Record<string, any> {
  const result = { ...data };
  const rawText = [
    result.imovel,
    result.rua_olhar_confrontacao,
    result.anotacoes_ficha_oficial,
    result.matricula_transcricao,
    result.titular_origem,
    result.requerente,
    relativePath,
  ].filter(Boolean).join(' ');

  const normalizado = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Subdistrito Territorial
  let subdistrito = result.subdistrito;
  if (!subdistrito || subdistrito === 'ALTO DA MOÓCA' || subdistrito === 'Subdistrito') {
    if (/gu[ai]+anaz/i.test(normalizado)) subdistrito = 'GUAIANAZES';
    else if (/itaquera/i.test(normalizado)) subdistrito = 'ITAQUERA';
    else if (/alto da mooca/i.test(normalizado)) subdistrito = 'ALTO DA MOÓCA';
    else if (/belenzinho|belem/i.test(normalizado)) subdistrito = 'BELENZINHO';
    else if (/mooca/i.test(normalizado)) subdistrito = 'MOÓCA';
    else if (/bras/i.test(normalizado)) subdistrito = 'BRÁS';
    else if (/pari/i.test(normalizado)) subdistrito = 'PARI';
    else if (/tatuape/i.test(normalizado)) subdistrito = 'TATUAPÉ';
    else if (/sao miguel/i.test(normalizado)) subdistrito = 'SÃO MIGUEL PAULISTA';
    else if (/ermelino/i.test(normalizado)) subdistrito = 'ERMELINO MATARAZZO';
    else subdistrito = 'ALTO DA MOÓCA';
  }
  result.subdistrito = subdistrito;
  result.data_competencia_subdistrito = subdistrito === 'SÃO MIGUEL PAULISTA' || subdistrito === 'ERMELINO MATARAZZO'
    ? 'Circunscrição atribuída ao 12º Registro de Imóveis da Capital'
    : '23 de dezembro de 1.938';

  // Cartório de Encaminhamento
  let cartorioEncaminhamento = result.cartorio_encaminhamento || result.cartorio_origem;
  if (!cartorioEncaminhamento || cartorioEncaminhamento.trim() === '') {
    if (subdistrito === 'GUAIANAZES' || subdistrito === 'ITAQUERA') {
      cartorioEncaminhamento = '9º Oficial de Registro de Imóveis da Capital';
    } else if (subdistrito === 'SÃO MIGUEL PAULISTA' || subdistrito === 'ERMELINO MATARAZZO') {
      cartorioEncaminhamento = '12º Oficial de Registro de Imóveis da Capital';
    } else {
      cartorioEncaminhamento = '3º Oficial de Registro de Imóveis da Capital';
    }
  }
  // Verificar se o texto menciona expressamente um cartório
  const cartMatch = normalizado.match(/(?:digno\s+)?(\d{1,2})[ºoªa°]?\s*(?:oficial|oficio|cartorio|registro de imoveis|cri|ri)\b/i);
  if (cartMatch && cartMatch[1]) {
    cartorioEncaminhamento = cartMatch[1] === '7'
      ? '7º Cartório de Registro de Imóveis da Capital'
      : `${cartMatch[1]}º Oficial de Registro de Imóveis da Capital`;
  }
  result.cartorio_encaminhamento = cartorioEncaminhamento;
  if (!result.cartorio_origem || result.cartorio_origem.trim() === '') {
    result.cartorio_origem = cartorioEncaminhamento;
  }

  // Resultado das Buscas
  if (/positivas?|matricula ativa no 7/i.test(normalizado)) {
    result.resultado_buscas = 'POSITIVAS';
  } else if (/negativas?|nao consta registro|nenhum registro/i.test(normalizado)) {
    result.resultado_buscas = 'NEGATIVAS';
  } else if (cartorioEncaminhamento && !cartorioEncaminhamento.includes('7º')) {
    result.resultado_buscas = 'NEGATIVAS';
  } else {
    result.resultado_buscas = result.resultado_buscas || 'NEGATIVAS';
  }

  // Escrevente Responsável
  if (relativePath) {
    const escMatch = relativePath.match(/[\\/](CFALANGA|Bruno|DIEGO|LUCAS|TATIANA|YULLI)[\\/]/i)
      || relativePath.match(/^(CFALANGA|Bruno|DIEGO|LUCAS|TATIANA|YULLI)[\\/]/i);
    if (escMatch) {
      result.escrevente_pasta = escMatch[1].toUpperCase();
    }
  }
  if (!result.escrevente_pasta || result.escrevente_pasta.trim() === '') {
    result.escrevente_pasta = 'CFALANGA';
  }

  // Confrontações do Imóvel (Lado direito, esquerdo e fundos)
  const conf = extrairConfrontacoes(rawText);
  if (!result.confrontante_lado_direito || result.confrontante_lado_direito === 'conforme apuração nos autos') {
    result.confrontante_lado_direito = conf.ladoDireito || result.confrontante_lado_direito || '';
  }
  if (!result.confrontante_lado_esquerdo || result.confrontante_lado_esquerdo === 'conforme apuração nos autos') {
    result.confrontante_lado_esquerdo = conf.ladoEsquerdo || result.confrontante_lado_esquerdo || '';
  }
  if (!result.confrontante_fundos || result.confrontante_fundos === 'conforme apuração nos autos') {
    result.confrontante_fundos = conf.fundos || result.confrontante_fundos || '';
  }

  return result;
}

export async function extractDocxPetition(filePath: string, relativePath: string): Promise<Record<string, any>> {
  let text = '';
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.doc') {
    try {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(filePath);
      text = extracted.getBody() || '';
    } catch (docErr) {
      console.error('Erro ao ler doc com word-extractor:', docErr);
    }
  }

  if (!text) {
    try {
      const res = await mammoth.extractRawText({ path: filePath });
      text = res.value || '';
    } catch {
      try {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(filePath);
        text = extracted.getBody() || '';
      } catch {}
    }
  }

  const numProcesso = text.match(/(?:processo(?:\s+digital)?(?:\s+n[ºo°]?)?|proc\.?)\s*[:.\s]*([0-9.\-]{15,25})/i)?.[1]?.trim() || '';
  const vara = text.match(/(\d+ª?\s*Vara(?:\s+de\s+Registros\s+P[úu]blicos)?)/i)?.[1]?.trim() || '1ª Vara de Registros Públicos da Capital';
  const requerente = text.match(/Requerente\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || '';
  const sql = text.match(/(?:contribuinte(?:\s+sql|\s+iptu)?|sql)\s*[:.\s]*([0-9.\-]{10,20})/i)?.[1]?.trim() || '';
  const matriculaMatch = text.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*([0-9.\-]+)/i);
  const matricula = matriculaMatch ? matriculaMatch[0].trim() : '';
  const titular = text.match(/em\s+nome\s+de\s+([^\n\r,.;]+)/i)?.[1]?.trim() || '';
  const imovelMatch = text.match(/(?:im[óo]vel(?:\s+usucapiendo)?|situado\s+[aà])\s*[:.\s]*([^\n\r.]+)/i);
  const imovel = imovelMatch ? imovelMatch[0].trim() : '';
  const flsInicial = text.match(/fls\.?\s*(\d+(?:\/\d+)?)/i)?.[1] || '';
  const flsLaudo = text.match(/(?:laudo|memorial)[^\n\r]{0,30}fls\.?\s*(\d+(?:\/\d+)?)/i)?.[1] || '';

  const conf = extrairConfrontacoes(text);

  const escTextMatch = text.match(/Escrevente(?:\s+Autor)?:\s*([A-Za-z0-9_-]+)/i);
  const escrevente = escTextMatch ? escTextMatch[1].toUpperCase() : 'CFALANGA';

  const rawData: Record<string, any> = {
    id_ficha: `FICHA-${Date.now()}`,
    buscas_feitas_em: new Date().toLocaleDateString('pt-BR'),
    tipo_processo: 'USUCAPIÃO',
    numero_processo: numProcesso,
    vara: vara,
    data_chegada: '',
    requerente: requerente,
    imovel: imovel,
    rua_olhar_confrontacao: text.match(/(?:Rua|Avenida|Al\.|Travessa)\s+([^\n\r,]+)/i)?.[0] || '',
    contribuinte_sql: sql,
    fls_inicial: flsInicial,
    fls_laudo: flsLaudo,
    matricula_transcricao: matricula,
    cartorio_origem: '',
    fls_certidao_origem: '',
    titular_origem: titular,
    resultado_buscas: 'NEGATIVAS',
    subdistrito: '',
    data_competencia_subdistrito: '23 de dezembro de 1.938',
    confrontante_lado_direito: conf.ladoDireito,
    confrontante_lado_esquerdo: conf.ladoEsquerdo,
    confrontante_fundos: conf.fundos,
    transcricoes_anexas: 'a conferir na certidão',
    matriculas_anexas: matricula,
    cartorio_encaminhamento: '',
    anotacoes_ficha_oficial: text.substring(0, 300),
    escrevente_pasta: escrevente,
    pagina_inicial_detectada: 1,
    pagina_final_detectada: 1,
    total_paginas_pdf: 1,
    origem_campos: [
      { campo: 'processo', pagina: 1, trecho: numProcesso, confianca: 'alta' },
      { campo: 'requerente', pagina: 1, trecho: requerente, confianca: 'alta' },
      { campo: 'imovel', pagina: 1, trecho: imovel, confianca: 'alta' },
      { campo: 'matricula_transcricao', pagina: 1, trecho: matricula, confianca: 'alta' },
      { campo: 'titular_origem', pagina: 1, trecho: titular, confianca: 'alta' },
    ],
  };

  return enrichPetitionData(rawData, relativePath);
}

