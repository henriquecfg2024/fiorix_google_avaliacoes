import { execFile } from 'node:child_process';
import fsSync, { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import mammoth from 'mammoth';
// @ts-ignore
import * as UTIFImport from 'utif';
// @ts-ignore
import * as UPNGImport from 'upng-js';
// @ts-ignore
import WordExtractorImport from 'word-extractor';

const UTIF: any = (UTIFImport as any).default ?? UTIFImport;
const UPNG: any = (UPNGImport as any).default ?? UPNGImport;
const WordExtractor: any = (WordExtractorImport as any).default ?? WordExtractorImport;

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

const cliMetrics = {
  petitionsExtractedTotal: 0,
  signaturesAnalyzedTotal: 0,
  docxExtractedTotal: 0,
  lastDurationMs: null as number | null,
  lastError: null as string | null,
};

export function resolveDocumentCliPath(): string {
  const configured = process.env.DOCUMENTAL_CLI_PATH || process.env.FIORIX_GD_CLI_PATH;
  if (configured && fsSync.existsSync(configured)) return configured;
  if (process.env.FIORIX_GD_CLI_PATH) return process.env.FIORIX_GD_CLI_PATH;
  if (process.env.DOCUMENTAL_CLI_PATH) return process.env.DOCUMENTAL_CLI_PATH;
  const localBundledBin = path.join(process.cwd(), 'bin', 'fiorix-gd-cli.exe');
  if (fsSync.existsSync(localBundledBin)) return localBundledBin;
  const adjacentRuntimeBin = path.resolve(path.dirname(process.execPath), '..', 'bin', 'fiorix-gd-cli.exe');
  if (fsSync.existsSync(adjacentRuntimeBin)) return adjacentRuntimeBin;
  return 'B:\\henrique-dev\\app-biblioteca\\src-tauri\\target\\debug\\fiorix-gd-cli.exe';
}

export async function executeDocumentCli(
  command: 'extrair-peticao' | 'analisar-assinaturas',
  filePath: string,
  options?: { pageStart?: number; pageEnd?: number; timeoutMs?: number },
): Promise<unknown> {
  const cliPath = resolveDocumentCliPath();
  const args = [command, filePath];
  if (options?.pageStart) args.push('--inicio', String(options.pageStart));
  if (options?.pageEnd) args.push('--fim', String(options.pageEnd));

  const inicio = Date.now();
  try {
    const { stdout } = await execFileAsync(cliPath, args, {
      timeout: options?.timeoutMs ?? 90000,
      maxBuffer: 15 * 1024 * 1024,
      windowsHide: true,
    });
    cliMetrics.lastDurationMs = Date.now() - inicio;
    cliMetrics.lastError = null;
    if (command === 'extrair-peticao') cliMetrics.petitionsExtractedTotal++;
    else cliMetrics.signaturesAnalyzedTotal++;
    return JSON.parse(stdout);
  } catch (err: any) {
    cliMetrics.lastDurationMs = Date.now() - inicio;
    cliMetrics.lastError = String(err?.message || err).slice(0, 200);
    throw err;
  }
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

// Nº de processo CNJ completo ou parcial (com ou sem "." e "-"):
// Ex.: 4121959-50.2026.8.26.0100 | 41219595020268260100 | 1162956-97 | 1162956-97.2024
const REGEX_PROCESSO_CNJ = /\b(?:\d{7}-\d{2}(?:\.\d{4}(?:\.\d(?:\.\d{2}(?:\.\d{4})?)?)?)?|\d{7}\d{2}(?:19|20)\d{2}(?:\d\d{2}\d{4})?)\b/g;

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
  const ehTranscricao = /transcri[çc][ãa]o/i.test(query);
  const ehMatriculaExplicita = /matr[ií]cula/i.test(query);

  // Transcrição pertence ao Livro 3 (LV3), nunca ao Livro 2 (LV2 / Matrículas)
  if (ehTranscricao && rootId === 'livro2') {
    return [];
  }

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

    // Pastas do cartório no acervo de imagens (em livro2 a raiz já é LV2; Transcrição fica em LV3)
    const candidateLivros =
      rootId === 'livro2'
        ? ['']
        : ehTranscricao
        ? ['LV3', '']
        : ehMatriculaExplicita
        ? ['LV2', '']
        : ['LV2', 'LV3', 'LV1', ''];
    const candidateBlocks = [block1000, block10000, ''];
    const candidateNames = process.platform === 'win32'
      ? [`${pad8}.KEN`, `${pad6}.KEN`, `${rawStr}.KEN`, `${pad8}.TIF`]
      : [`${pad8}.KEN`, `${pad8}.ken`, `${pad6}.KEN`, `${rawStr}.KEN`, `${pad8}.TIF`, `${pad8}.tif`];

    const relCandidates: string[] = [];
    for (const livro of candidateLivros) {
      for (const block of candidateBlocks) {
        for (const name of candidateNames) {
          const rel = livro
            ? (block ? path.join(livro, block, name) : path.join(livro, name))
            : (block ? path.join(block, name) : name);
          const lowerRel = rel.toLowerCase();
          if (seenPaths.has(lowerRel)) continue;
          seenPaths.add(lowerRel);
          relCandidates.push(rel);
        }
      }
    }

    const foundBatch = await Promise.all(
      relCandidates.map(async rel => {
        try {
          const stat = await fs.stat(path.join(canonicalRoot, rel));
          if (stat.isFile()) {
            const rotulo = ehTranscricao || /^lv3[\\/]/i.test(rel) ? 'Transcrição' : 'Matrícula';
            return {
              rootId,
              relativePath: rel,
              name: path.basename(rel),
              size: stat.size,
              modifiedAt: stat.mtime.toISOString(),
              matricula: `${rotulo} nº ${num}`,
            } as DocumentMatch;
          }
        } catch {}
        return null;
      }),
    );
    for (const item of foundBatch) {
      if (item) matches.push(item);
    }
  }

  return matches;
}

interface IndexedDocEntry {
  relativePath: string;
  name: string;
  normRel: string;
  cleanRel: string;
}

interface RootDirectoryIndex {
  canonical: string;
  builtAt: number;
  refreshing: boolean;
  entries: IndexedDocEntry[];
}

const directoryIndexCache = new Map<string, RootDirectoryIndex>();
const INDEX_TTL_MS = 45_000;
const INDEX_MAX_ENTRIES = 120_000;

async function buildRootDirectoryIndex(rootPath: string): Promise<RootDirectoryIndex | null> {
  let canonical: string;
  try {
    canonical = await fs.realpath(rootPath);
  } catch {
    return null;
  }
  const entries: IndexedDocEntry[] = [];
  const queue: string[] = [canonical];
  let head = 0;

  async function worker() {
    while (head < queue.length && entries.length < INDEX_MAX_ENTRIES) {
      const dir = queue[head++];
      if (!dir) break;
      try {
        const handle = await fs.opendir(dir);
        for await (const entry of handle) {
          if (entries.length >= INDEX_MAX_ENTRIES) break;
          if (entry.isSymbolicLink()) continue;
          const full = path.join(dir, entry.name);
          if (!isWithinRoot(canonical, full)) continue;
          if (entry.isDirectory()) {
            queue.push(full);
            continue;
          }
          if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
          if (entry.name.startsWith('~$')) continue;
          const relativePath = path.relative(canonical, full);
          const normRel = normalize(relativePath);
          const cleanRel = normRel.replace(/[.\-_/\s]/g, '');
          entries.push({ relativePath, name: entry.name, normRel, cleanRel });
        }
      } catch {}
    }
  }

  // Semeia o primeiro nível e depois processa subpastas em paralelo (8 workers SMB)
  await worker();
  if (head < queue.length) {
    await Promise.all(Array.from({ length: 8 }, () => worker()));
  }

  const built: RootDirectoryIndex = {
    canonical,
    builtAt: Date.now(),
    refreshing: false,
    entries,
  };
  directoryIndexCache.set(rootPath, built);
  return built;
}

/** Pré-aquece em memória o índice das pastas de processos e minutas para buscas sub-segundo. */
export async function warmDocumentIndex(roots: DocumentRoot[]): Promise<void> {
  const indexable = roots.filter(r => r.id !== 'imagens' && r.id !== 'livro2');
  await Promise.all(indexable.map(r => buildRootDirectoryIndex(r.path).catch(() => null)));
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
      const digitos = /^[0-9.\-]+$/.test(term) ? term.replace(/[.\-]/g, '') : term;
      if (/^\d{1,8}$/.test(digitos)) {
        const semZeros = digitos.replace(/^0+/, '') || '0';
        const normSemPontosNumero = normRel.replace(/(\d)[.\-](\d)/g, '$1$2').replace(/(\d)[.\-](\d)/g, '$1$2');
        return new RegExp(`(^|\\D)0*${semZeros}(\\D|$)`).test(normSemPontosNumero);
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
    const ehPastaSemImagens = root.id === 'minutas' || root.id === 'processos';

    // 1. Busca direta ultrarrápida para matrículas .KEN (apenas em acervos que podem conter imagens)
    const criteriosResolvidosDireto = new Set<number>();
    for (let i = 0; i < criterios.length && !ehPastaSemImagens; i++) {
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

    const cachedIdx = !ehAcervoImagens && budget.maxEntries >= 50000 ? directoryIndexCache.get(root.path) : undefined;
    if (cachedIdx && cachedIdx.canonical === canonical) {
      if (Date.now() - cachedIdx.builtAt > INDEX_TTL_MS && !cachedIdx.refreshing) {
        cachedIdx.refreshing = true;
        void buildRootDirectoryIndex(root.path).catch(() => {
          cachedIdx.refreshing = false;
        });
      }
      const matchedEntries: IndexedDocEntry[] = [];
      for (const item of cachedIdx.entries) {
        if (result.files.length + matchedEntries.length >= limit) {
          result.partial = true;
          break;
        }
        const ok = criteriosParaVarrer.some(c => c.termos.every(term => termoCasa(term, item.normRel, item.cleanRel)));
        if (ok) matchedEntries.push(item);
      }
      const verified = await Promise.all(
        matchedEntries.map(async item => {
          try {
            const filePath = path.join(canonical, item.relativePath);
            const resolved = await fs.realpath(filePath);
            if (!isWithinRoot(canonical, resolved)) return null;
            const info = await fs.stat(filePath);
            if (isArquivoBloqueioOffice(item.name, info.size)) return null;
            return {
              rootId: root.id,
              relativePath: item.relativePath,
              name: item.name,
              size: info.size,
              modifiedAt: info.mtime.toISOString(),
            } as DocumentMatch;
          } catch {
            return null;
          }
        }),
      );
      for (const v of verified) {
        if (!v) continue;
        const key = `${v.rootId}:${v.relativePath.toLowerCase()}`;
        if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
          result.files.push(v);
        }
      }
      continue;
    }

    const queue: string[] = [canonical];
    let queueHead = 0;
    const usarParalelo = !ehAcervoImagens && budget.maxEntries >= 50000;
    const processarDiretorio = async (directory: string) => {
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
          const matches = criteriosParaVarrer.some(c => c.termos.every(term => termoCasa(term, normRel, cleanRel)));
          if (!matches) continue;

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
    };

    if (usarParalelo) {
      if (queueHead < queue.length && Date.now() < deadline && visited < budget.maxEntries && result.files.length < limit) {
        await processarDiretorio(queue[queueHead++]);
      }
      const workers = Array.from({ length: 8 }, async () => {
        while (queueHead < queue.length) {
          if (Date.now() >= deadline || visited >= budget.maxEntries || result.files.length >= limit) { result.partial = true; break; }
          const dir = queue[queueHead++];
          if (!dir) break;
          await processarDiretorio(dir);
        }
      });
      await Promise.all(workers);
      void buildRootDirectoryIndex(root.path).catch(() => null);
    } else {
      while (queueHead < queue.length) {
        if (Date.now() >= deadline || visited >= budget.maxEntries || result.files.length >= limit) { result.partial = true; break; }
        await processarDiretorio(queue[queueHead++]);
      }
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
      const numerosMatriculaLivro2 = new Set<number>();
      const numerosTranscricaoLivro3 = new Set<number>();
      for (const m of matriculasParaCruzar) {
        const d = parseInt(m.replace(/[^\d]/g, ''), 10);
        if (!isNaN(d) && d > 0) {
          if (/transcri[çc][ãa]o/i.test(m)) {
            numerosTranscricaoLivro3.add(d);
          } else {
            numerosMatriculaLivro2.add(d);
          }
        }
      }

      // 1. Buscar arquivos .KEN no acervo correspondente (Matrícula -> Livro 2, Transcrição -> Livro 3)
      const arquivosCruzados: DocumentMatch[] = [];
      for (const mat of matriculasParaCruzar) {
        const ehTranscricao = /transcri[çc][ãa]o/i.test(mat);
        for (const root of roots) {
          if (root.id === 'minutas' || root.id === 'processos') continue;
          if (ehTranscricao && root.id === 'livro2') continue;
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

      // 2. Se temos documentos do processo e encontramos a matrícula/transcrição dele,
      // remover falsos positivos de arquivos de imagem (.KEN) que vieram apenas por colisão
      // de substring ou livro divergente (ex.: não trazer LV2 quando os autos citam apenas Transcrição LV3)
      result.files = result.files.filter(f => {
        const ext = path.extname(f.name).toLowerCase();
        const isImg = ext === '.ken' || ext === '.tif' || ext === '.tiff';
        if (!isImg) return true; // Preserva todos os arquivos de processo (PDF, DOCX, TXT, etc.)
        // Matrícula digitada explicitamente (ex.: campo Matrícula da Busca Cruzada) sempre permanece
        if (chavesExplicitas.has(`${f.rootId}:${f.relativePath.toLowerCase()}`)) return true;

        const fNum = parseInt(f.name.replace(/[^\d]/g, ''), 10);
        if (isNaN(fNum)) return false;

        const ehDoLivro2 = f.rootId === 'livro2' || /(?:^|[\\/])lv2[\\/]/i.test(f.relativePath);
        const ehDoLivro3 = /(?:^|[\\/])lv3[\\/]/i.test(f.relativePath);
        if (ehDoLivro2) return numerosMatriculaLivro2.has(fNum);
        if (ehDoLivro3) return numerosTranscricaoLivro3.has(fNum);
        return numerosMatriculaLivro2.has(fNum) || numerosTranscricaoLivro3.has(fNum);
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

  // Deduplica arquivos idênticos quando raízes sobrepostas (ex.: K:\IMAGENS e K:\IMAGENS\LV2) apontam ao mesmo arquivo físico
  if (result.files.length > 1) {
    const prioridadeRoot = (id: string) => (id === 'livro2' ? 3 : id === 'minutas' || id === 'processos' ? 2 : 1);
    const porCaminhoCanonico = new Map<string, { idx: number; item: DocumentMatch }>();
    await Promise.all(
      result.files.map(async (item, idx) => {
        let chave = `${item.rootId}:${item.relativePath.toLowerCase()}`;
        try {
          const canon = await resolveAuthorizedFile(roots, item.rootId, item.relativePath);
          chave = process.platform === 'win32' ? canon.toLowerCase() : canon;
        } catch {}
        const existente = porCaminhoCanonico.get(chave);
        if (!existente || prioridadeRoot(item.rootId) > prioridadeRoot(existente.item.rootId)) {
          porCaminhoCanonico.set(chave, { idx: existente ? existente.idx : idx, item });
        }
      }),
    );
    result.files = Array.from(porCaminhoCanonico.values())
      .sort((a, b) => a.idx - b.idx)
      .map(v => v.item);
  }

  return result;
}

// Limite seguro (2,4 MB bruto ≈ 3,2 MB em base64) abaixo do teto de 4,5 MB das rotas serverless na nuvem
export const MAX_INLINE_PDF_BYTES = 2_516_582;
export const MAX_DOCUMENT_CHUNK_BYTES = 2_516_582;
const MAX_KEN_BASE64_CHARS = 3_200_000;

export interface DocumentChunkPayload {
  fileName: string;
  totalSize: number;
  offset: number;
  bytesRead: number;
  eof: boolean;
  chunkBase64: string;
  isChunk: true;
}

export async function readDocumentChunk(
  filePath: string,
  offset: number,
  length = MAX_DOCUMENT_CHUNK_BYTES,
): Promise<DocumentChunkPayload> {
  const safeOffset = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const safeLength = Math.max(1, Math.min(MAX_DOCUMENT_CHUNK_BYTES, Math.floor(Number.isFinite(length) ? length : MAX_DOCUMENT_CHUNK_BYTES)));
  const fileName = path.basename(filePath);
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    if (safeOffset >= stat.size) {
      return {
        fileName,
        totalSize: stat.size,
        offset: safeOffset,
        bytesRead: 0,
        eof: true,
        chunkBase64: '',
        isChunk: true,
      };
    }
    const toRead = Math.min(safeLength, stat.size - safeOffset);
    const buf = Buffer.allocUnsafe(toRead);
    const { bytesRead } = await handle.read(buf, 0, toRead, safeOffset);
    const slice = bytesRead === toRead ? buf : buf.subarray(0, bytesRead);
    return {
      fileName,
      totalSize: stat.size,
      offset: safeOffset,
      bytesRead,
      eof: safeOffset + bytesRead >= stat.size,
      chunkBase64: slice.toString('base64'),
      isChunk: true,
    };
  } finally {
    await handle.close();
  }
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
  loadedPageStart?: number;
  loadedPageEnd?: number;
  hasMorePages?: boolean;
}

export async function readDocumentText(
  filePath: string,
  options?: { pageStart?: number; pageEnd?: number },
): Promise<DocumentVisualPayload> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // 1. Imagens de Matrícula (Wang TIFF / Kenta .KEN / TIFF)
  if (ext === '.ken' || ext === '.tif' || ext === '.tiff') {
    try {
      const buf = await fs.readFile(filePath);
      const ifds = UTIF.decode(buf);
      const totalIfds = ifds.length;
      const startIdx = options?.pageStart ? Math.max(0, Math.min(totalIfds, options.pageStart - 1)) : 0;
      const maxEndIdx = options?.pageEnd ? Math.max(startIdx, Math.min(totalIfds, options.pageEnd)) : totalIfds;
      const pages: string[] = [];
      let totalChars = 0;
      let lastDecodedIdx = startIdx - 1;

      for (let i = startIdx; i < maxEndIdx; i++) {
        const page = ifds[i];
        UTIF.decodeImage(buf, page);
        const rgba = UTIF.toRGBA8(page);
        const pngBuf = Buffer.from(UPNG.encode([rgba.buffer], page.width, page.height, 0));
        const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;
        if (pages.length > 0 && totalChars + dataUrl.length > MAX_KEN_BASE64_CHARS) {
          break;
        }
        pages.push(dataUrl);
        totalChars += dataUrl.length;
        lastDecodedIdx = i;
      }

      const loadedEnd = pages.length > 0 ? lastDecodedIdx + 1 : startIdx;
      const hasMorePages = loadedEnd < totalIfds;

      return {
        fileName,
        extension: ext,
        size: stat.size,
        pages,
        pageCount: totalIfds,
        loadedPageStart: pages.length > 0 ? startIdx + 1 : undefined,
        loadedPageEnd: pages.length > 0 ? loadedEnd : undefined,
        hasMorePages,
        html: '',
        text: `[Imagem Digitalizada da Matrícula: ${fileName} - ${totalIfds} folha(s) no Livro 2 (Registro Geral)]`,
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

      return {
        fileName,
        extension: ext,
        size: stat.size,
        pdfDataUrl,
        html: '',
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
      const text = String(extracted.getBody() || '');
      const html = `<div style="font-family: inherit; line-height: 1.6;">${text.split('\n\n').filter(Boolean).map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}</div>`;
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

  // Limpa ruídos comuns capturados pelo OCR em ofícios de resposta do próprio 7º RI
  if (typeof result.requerente === 'string' && result.requerente) {
    result.requerente = result.requerente
      .replace(/\s+(?:USUCAPI[ÃA]O|MERIT[ÍI]SSIM[OA]|MM\.?\s*JUIZ[A]?|EXCELENT[ÍI]SSIM[OA]|DOUTOR[A]?\s+JUIZ[A]?).*$/i, '')
      .trim();
  }
  const ehTimbreSetimoRi = (val: unknown) =>
    typeof val === 'string' &&
    (/rua\s+augusta[,\s]+(?:n[ºo°.]?\s*)?356/i.test(val) || /3218-0527|01304-000/i.test(val));
  if (ehTimbreSetimoRi(result.imovel)) {
    result.imovel = '';
  }
  if (
    ehTimbreSetimoRi(result.rua_olhar_confrontacao) ||
    (typeof result.rua_olhar_confrontacao === 'string' &&
      /^rua\s+augusta$/i.test(result.rua_olhar_confrontacao.trim()) &&
      !result.imovel)
  ) {
    result.rua_olhar_confrontacao = '';
  }

  if ((!result.numero_processo || !String(result.numero_processo).trim()) && relativePath) {
    const cnjMatch = relativePath.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (cnjMatch) result.numero_processo = cnjMatch[1];
  }

  if (!result.vara || !String(result.vara).trim()) {
    const origensTxt = Array.isArray(result.origem_campos)
      ? result.origem_campos.map((o: any) => o?.trecho || '').join(' ')
      : '';
    const varaMatch = origensTxt.match(/(\d{1,2}\s*[ªaº°]?\s*Vara(?:\s+(?:C[íi]vel|de\s+Registros\s+P[úu]blicos|da\s+Fazenda\s+P[úu]blica))?(?:\s+(?:da\s+Comarca\s+)?de\s+[A-ZÀ-Úa-zà-ú\s]{3,25})?)/i);
    if (varaMatch) {
      result.vara = varaMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

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

  cliMetrics.docxExtractedTotal++;
  cliMetrics.petitionsExtractedTotal++;
  return enrichPetitionData(rawData, relativePath);
}

export async function extractPdfPetitionResilient(
  filePath: string,
  relativePath: string,
  options?: { pageStart?: number; pageEnd?: number },
): Promise<Record<string, any>> {
  try {
    const cliResult = (await executeDocumentCli('extrair-peticao', filePath, {
      pageStart: options?.pageStart,
      pageEnd: options?.pageEnd,
      timeoutMs: 90000,
    })) as Record<string, any>;
    return enrichPetitionData(cliResult, relativePath);
  } catch (firstErr) {
    // Se o PDF for grande e não havia recorte de páginas explícito, tenta apenas as 18 páginas iniciais
    if (!options?.pageStart && !options?.pageEnd) {
      try {
        const retryResult = (await executeDocumentCli('extrair-peticao', filePath, {
          pageStart: 1,
          pageEnd: 18,
          timeoutMs: 60000,
        })) as Record<string, any>;
        return enrichPetitionData(retryResult, relativePath);
      } catch {
        // segue para fallback em JS puro abaixo
      }
    }

    // Fallback resiliente em JS puro: nunca bloqueia a abertura do formulário de Manifestação
    const cnjMatch = relativePath.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    const numProcesso = cnjMatch ? cnjMatch[1] : '';
    const matDetectada = extrairNumeroMatricula(relativePath) || '';
    const fallbackData: Record<string, any> = {
      id_ficha: `FICHA-${Date.now()}`,
      buscas_feitas_em: new Date().toLocaleDateString('pt-BR'),
      tipo_processo: 'USUCAPIÃO',
      numero_processo: numProcesso,
      vara: '',
      data_chegada: '',
      requerente: '',
      imovel: '',
      rua_olhar_confrontacao: '',
      contribuinte_sql: '',
      fls_inicial: '',
      fls_laudo: '',
      matricula_transcricao: matDetectada,
      cartorio_origem: '',
      fls_certidao_origem: '',
      titular_origem: '',
      resultado_buscas: 'NEGATIVAS',
      subdistrito: '',
      data_competencia_subdistrito: '23 de dezembro de 1.938',
      confrontante_lado_direito: '',
      confrontante_lado_esquerdo: '',
      confrontante_fundos: '',
      transcricoes_anexas: 'a conferir na certidão',
      matriculas_anexas: matDetectada,
      cartorio_encaminhamento: '',
      anotacoes_ficha_oficial: '',
      escrevente_pasta: 'CFALANGA',
      pagina_inicial_detectada: 1,
      pagina_final_detectada: 1,
      total_paginas_pdf: 1,
      origem_campos: [],
      extracao_parcial_aviso: String((firstErr as any)?.message || 'Extração parcial automática'),
    };
    cliMetrics.petitionsExtractedTotal++;
    return enrichPetitionData(fallbackData, relativePath);
  }
}

export interface DocumentRootHealth {
  id: string;
  label: string;
  path: string;
  accessible: boolean;
  latencyMs: number | null;
  indexedFiles: number;
  indexBuiltAt: string | null;
}

export interface DocumentSearchTelemetry {
  roots: DocumentRootHealth[];
  index: {
    indexedRootsCount: number;
    totalIndexedFiles: number;
    refreshingCount: number;
    indexTtlSeconds: number;
    maxEntriesPerRoot: number;
    lastBuiltAt: string | null;
  };
  cli: {
    available: boolean;
    binaryName: string;
    petitionsExtractedTotal: number;
    docxExtractedTotal: number;
    signaturesAnalyzedTotal: number;
    lastDurationMs: number | null;
    lastError: string | null;
  };
}

const ROOT_LABELS: Record<string, string> = {
  minutas: 'Usucapião (W:)',
  usucapiao: 'Usucapião (W:)',
  processos: 'Processos (H:)',
  imagens: 'Imagens (K:)',
  livro2: 'Livro 2 (K:\\LV2)',
};

let cachedRootsHealth: { checkedAt: number; key: string; items: DocumentRootHealth[] } | null = null;
let cachedCliAvailable: { checkedAt: number; cliPath: string; available: boolean } | null = null;

export function getDocumentSearchTelemetrySync(roots: DocumentRoot[]): DocumentSearchTelemetry {
  const agora = Date.now();
  const rootsKey = roots.map((r) => `${r.id}:${r.path}`).join('|');
  if (!cachedRootsHealth || cachedRootsHealth.key !== rootsKey || agora - cachedRootsHealth.checkedAt > 55_000) {
    // Dispara atualização assíncrona em background e usa verificação rápida síncrona no primeiro pulso
    void getDocumentSearchTelemetry(roots).catch(() => {});
    if (!cachedRootsHealth || cachedRootsHealth.key !== rootsKey) {
      const items: DocumentRootHealth[] = roots.map((r) => {
        const start = Date.now();
        let accessible = false;
        let latencyMs: number | null = null;
        try {
          accessible = fsSync.statSync(r.path).isDirectory();
          latencyMs = Date.now() - start;
        } catch {
          accessible = false;
        }
        const idx = directoryIndexCache.get(r.id);
        return {
          id: r.id,
          label: ROOT_LABELS[r.id] || r.id,
          path: r.path,
          accessible,
          latencyMs,
          indexedFiles: idx ? idx.entries.length : 0,
          indexBuiltAt: idx && idx.builtAt ? new Date(idx.builtAt).toISOString() : null,
        };
      });
      cachedRootsHealth = { checkedAt: agora, key: rootsKey, items };
    }
  }

  const cliPath = resolveDocumentCliPath();
  if (!cachedCliAvailable || cachedCliAvailable.cliPath !== cliPath || agora - cachedCliAvailable.checkedAt > 55_000) {
    let available = false;
    try {
      available = fsSync.statSync(cliPath).isFile();
    } catch {
      available = false;
    }
    cachedCliAvailable = { checkedAt: agora, cliPath, available };
  }

  let totalIndexedFiles = 0;
  let refreshingCount = 0;
  let latestBuiltMs = 0;
  for (const [, idx] of directoryIndexCache) {
    totalIndexedFiles += idx.entries.length;
    if (idx.refreshing) refreshingCount++;
    if (idx.builtAt > latestBuiltMs) latestBuiltMs = idx.builtAt;
  }

  return {
    roots: cachedRootsHealth.items.map((item) => {
      const idx = directoryIndexCache.get(item.id);
      return {
        ...item,
        indexedFiles: idx ? idx.entries.length : item.indexedFiles,
        indexBuiltAt: idx && idx.builtAt ? new Date(idx.builtAt).toISOString() : item.indexBuiltAt,
      };
    }),
    index: {
      indexedRootsCount: directoryIndexCache.size,
      totalIndexedFiles,
      refreshingCount,
      indexTtlSeconds: Math.round(INDEX_TTL_MS / 1000),
      maxEntriesPerRoot: INDEX_MAX_ENTRIES,
      lastBuiltAt: latestBuiltMs > 0 ? new Date(latestBuiltMs).toISOString() : null,
    },
    cli: {
      available: cachedCliAvailable.available,
      binaryName: path.basename(cliPath),
      petitionsExtractedTotal: cliMetrics.petitionsExtractedTotal,
      docxExtractedTotal: cliMetrics.docxExtractedTotal,
      signaturesAnalyzedTotal: cliMetrics.signaturesAnalyzedTotal,
      lastDurationMs: cliMetrics.lastDurationMs,
      lastError: cliMetrics.lastError,
    },
  };
}

export async function getDocumentSearchTelemetry(roots: DocumentRoot[]): Promise<DocumentSearchTelemetry> {
  const agora = Date.now();
  const rootsKey = roots.map((r) => `${r.id}:${r.path}`).join('|');

  if (!cachedRootsHealth || cachedRootsHealth.key !== rootsKey || agora - cachedRootsHealth.checkedAt > 55_000) {
    const items = await Promise.all(
      roots.map(async (r): Promise<DocumentRootHealth> => {
        const start = Date.now();
        let accessible = false;
        let latencyMs: number | null = null;
        try {
          const st = await fs.stat(r.path);
          accessible = st.isDirectory();
          latencyMs = Date.now() - start;
        } catch {
          accessible = false;
          latencyMs = null;
        }
        const idx = directoryIndexCache.get(r.id);
        return {
          id: r.id,
          label: ROOT_LABELS[r.id] || r.id,
          path: r.path,
          accessible,
          latencyMs,
          indexedFiles: idx ? idx.entries.length : 0,
          indexBuiltAt: idx && idx.builtAt ? new Date(idx.builtAt).toISOString() : null,
        };
      }),
    );
    cachedRootsHealth = { checkedAt: agora, key: rootsKey, items };
  }

  const cliPath = resolveDocumentCliPath();
  if (!cachedCliAvailable || cachedCliAvailable.cliPath !== cliPath || agora - cachedCliAvailable.checkedAt > 55_000) {
    let available = false;
    try {
      const st = await fs.stat(cliPath);
      available = st.isFile();
    } catch {
      available = false;
    }
    cachedCliAvailable = { checkedAt: agora, cliPath, available };
  }

  let totalIndexedFiles = 0;
  let refreshingCount = 0;
  let latestBuiltMs = 0;
  for (const [, idx] of directoryIndexCache) {
    totalIndexedFiles += idx.entries.length;
    if (idx.refreshing) refreshingCount++;
    if (idx.builtAt > latestBuiltMs) latestBuiltMs = idx.builtAt;
  }

  return {
    roots: cachedRootsHealth.items.map((item) => {
      const idx = directoryIndexCache.get(item.id);
      return {
        ...item,
        indexedFiles: idx ? idx.entries.length : item.indexedFiles,
        indexBuiltAt: idx && idx.builtAt ? new Date(idx.builtAt).toISOString() : item.indexBuiltAt,
      };
    }),
    index: {
      indexedRootsCount: directoryIndexCache.size,
      totalIndexedFiles,
      refreshingCount,
      indexTtlSeconds: Math.round(INDEX_TTL_MS / 1000),
      maxEntriesPerRoot: INDEX_MAX_ENTRIES,
      lastBuiltAt: latestBuiltMs > 0 ? new Date(latestBuiltMs).toISOString() : null,
    },
    cli: {
      available: cachedCliAvailable.available,
      binaryName: path.basename(cliPath),
      petitionsExtractedTotal: cliMetrics.petitionsExtractedTotal,
      docxExtractedTotal: cliMetrics.docxExtractedTotal,
      signaturesAnalyzedTotal: cliMetrics.signaturesAnalyzedTotal,
      lastDurationMs: cliMetrics.lastDurationMs,
      lastError: cliMetrics.lastError,
    },
  };
}

