import { execFile } from 'node:child_process';
import fsSync, { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import mammoth from 'mammoth';
import {
  escapeHtmlEntities,
  plainTextToSafeHtml,
  sanitizeDocumentHtml,
} from '../utils/html-sanitizer.js';
import {
  consultarProtocolosVinculadosWebriReadOnly,
  type ProtocoloVinculadoWebri,
} from '../db/titulos-cruzados-readonly.js';
import {
  consultarPaginasOcrMatriculaSiplanIaReadOnly,
  deveConsultarFullTextSiplanIa,
  pesquisarMatriculasTextoSiplanIaReadOnly,
  type SiplaniaOcrMatriculaResult,
} from '../db/siplania-readonly.js';
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
  const direct = roots.find(r => r.id === rootId);
  if (direct) return direct;

  if (rootId === 'livro2') {
    const img = roots.find(r => r.id === 'imagens');
    if (img) return img;
  }
  if (rootId === 'imagens') {
    const lv2 = roots.find(r => r.id === 'livro2');
    if (lv2) return lv2;
  }
  if (rootId === 'minutas') {
    const usuc = roots.find(r => r.id === 'usucapiao');
    if (usuc) return usuc;
  }
  if (rootId === 'usucapiao') {
    const min = roots.find(r => r.id === 'minutas');
    if (min) return min;
  }
  if (rootId === 'titulos_visualiza') {
    const img = roots.find(r => r.id === 'imagens');
    if (img) return { id: 'titulos_visualiza', path: path.join(img.path, 'TITULOS-VISUALIZA') };
  }
  if (rootId === 'titulos_online') {
    const img = roots.find(r => r.id === 'imagens');
    if (img) return { id: 'titulos_online', path: path.join(img.path, 'Titulos_Online') };
  }
  throw new Error('Pasta não autorizada.');
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
  const configured = (process.env.DOCUMENTAL_CLI_PATH || process.env.FIORIX_GD_CLI_PATH || '').trim();
  if (configured) {
    return path.resolve(configured);
  }
  const localBundledBin = path.join(process.cwd(), 'bin', 'fiorix-gd-cli.exe');
  if (fsSync.existsSync(localBundledBin)) return localBundledBin;
  const adjacentRuntimeBin = path.resolve(path.dirname(process.execPath), '..', 'bin', 'fiorix-gd-cli.exe');
  if (fsSync.existsSync(adjacentRuntimeBin)) return adjacentRuntimeBin;
  return localBundledBin;
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

const REGEX_MATRICULA_EXPLICITA =
  /\b(?:matr[ií]culas?\b|matriculad[oa]s?\s+sob\b|matr(?:\.|\b)|mat\.|transcri[çc][õo]es\b|transcri[çc][ãa]o\b|transcrit[oa]s?\s+sob\b|transcr(?:\.|\b))\s*(?:(?:o|de)\s+)?(?:n[ºo°.]*\s*)?[:.\-\s]*([0-9][0-9.]*)(?![\d.])(?!-\d{2}\.(?:19|20)\d{2})/gi;

function formatarMilharCartorio(n: number): string {
  const inteiro = Math.trunc(Math.abs(n));
  if (!Number.isFinite(inteiro) || inteiro <= 0) return String(n);
  return inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function extrairNumeroMatricula(textoOuNome: string): string | null {
  if (!textoOuNome) return null;

  for (const match of textoOuNome.matchAll(REGEX_MATRICULA_EXPLICITA)) {
    const rawNum = match[1]
      .trim()
      .replace(/\.+$/, '')
      .replace(/^(?:0+\.)*0+([1-9])/, '$1');
    const digitsOnly = rawNum.replace(/\D+/g, '');
    const parsedNum = parseInt(digitsOnly, 10);
    if (digitsOnly.length >= 1 && digitsOnly.length <= 7 && Number.isFinite(parsedNum) && parsedNum > 0) {
      const rotulo = /transcr/i.test(match[0]) ? 'Transcrição' : 'Matrícula';
      return `${rotulo} nº ${rawNum}`;
    }
  }

  // Sem rótulo explícito, apenas arquivos .KEN do Livro 2 / Livro 3 identificam nº de registro (nunca Plantas de SETORES nem .DOC/.PDF de atos)
  if (!/(?:^|[\\/])setores[\\/]/i.test(textoOuNome)) {
    const kenMatch = textoOuNome.match(/(?:^|[\\/])0*([1-9][0-9]{0,7})\.ken$/i);
    if (kenMatch) {
      const digits = kenMatch[1];
      const parsedNum = parseInt(digits, 10);
      if (Number.isFinite(parsedNum) && parsedNum > 0 && parsedNum <= 9_999_999) {
        const rotulo = /(?:^|[\\/])lv3[\\/]/i.test(textoOuNome) ? 'Transcrição' : 'Matrícula';
        return `${rotulo} nº ${digits}`;
      }
    }
  }

  return null;
}

const processoMatriculaCache = new Map<string, string>();

function registrarMatriculaNoCache(filePathOuRef: string, matricula?: string | null) {
  if (!filePathOuRef || !matricula || typeof matricula !== 'string') return;
  const limpo = matricula.trim();
  if (!limpo) return;
  processoMatriculaCache.set(filePathOuRef.toLowerCase(), limpo);
  const cnj = filePathOuRef.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{20})/);
  if (cnj) {
    processoMatriculaCache.set(cnj[1].replace(/[^\d]/g, ''), limpo);
  }
}

export async function detectarMatriculaEmArquivo(filePath: string): Promise<string | null> {
  const cachedDirect = processoMatriculaCache.get(filePath.toLowerCase());
  if (cachedDirect) return cachedDirect;
  const cnjInPath = filePath.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{20})/);
  if (cnjInPath) {
    const cachedCnj = processoMatriculaCache.get(cnjInPath[1].replace(/[^\d]/g, ''));
    if (cachedCnj) return cachedCnj;
  }

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const pathMatch = extrairNumeroMatricula(filePath);
  if (pathMatch) {
    registrarMatriculaNoCache(filePath, pathMatch);
    return pathMatch;
  }

  if (ext === '.docx' || ext === '.doc') {
    if (ext === '.doc') {
      try {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(filePath);
        const bodyText = String(extracted.getBody() || '');
        const docMatch = extrairNumeroMatricula(bodyText);
        if (docMatch) {
          registrarMatriculaNoCache(filePath, docMatch);
          return docMatch;
        }
      } catch {}
    }
    try {
      const { value: text } = await mammoth.extractRawText({ path: filePath });
      const docMatch = extrairNumeroMatricula(text);
      if (docMatch) {
        registrarMatriculaNoCache(filePath, docMatch);
        return docMatch;
      }
    } catch {}
  } else if (ext === '.txt' || ext === '.rtf') {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const txtMatch = extrairNumeroMatricula(content);
      if (txtMatch) {
        registrarMatriculaNoCache(filePath, txtMatch);
        return txtMatch;
      }
    } catch {}
  } else if (ext === '.pdf') {
    try {
      const ocrCacheText = await lerTextoCacheOcrRecente(filePath, fileName);
      if (ocrCacheText) {
        const ocrMatch = extrairNumeroMatricula(ocrCacheText);
        if (ocrMatch) {
          registrarMatriculaNoCache(filePath, ocrMatch);
          return ocrMatch;
        }
      }
      const handle = await fs.open(filePath, 'r');
      const maxRead = 512 * 1024;
      const buf = Buffer.alloc(maxRead);
      const { bytesRead } = await handle.read(buf, 0, maxRead, 0);
      await handle.close();
      const slice = buf.subarray(0, bytesRead);

      let text = slice.toString('latin1');
      const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
      let m;
      let count = 0;
      while ((m = streamRegex.exec(text)) !== null && count < 30) {
        count++;
        try {
          const decomp = zlib.inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
          text += ' ' + decomp;
        } catch {}
      }
      const pdfMatch = extrairNumeroMatricula(text);
      if (pdfMatch) {
        registrarMatriculaNoCache(filePath, pdfMatch);
        return pdfMatch;
      }
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
  if (rootId === 'titulos_visualiza' || rootId === 'titulos_online') {
    return [];
  }
  const numbersToTry = new Set<number>();
  const ehTranscricao = /transcri[çc][ãa]o/i.test(query);
  const ehMatriculaExplicita = /matr[ií]cula/i.test(query);
  const ehProtocoloOuCentralExplicito =
    /\b(?:protocolo|prenota[çc][ãa]o|t[íi]tulo|ac\d{5,}|ph\d{5,}|in[a-z0-9]{5,})\b/i.test(query);

  // Consulta explícita de Protocolo/Prenotação/Central sem menção a Matrícula não deve casar com LV2/LV3
  if (ehProtocoloOuCentralExplicito && !ehMatriculaExplicita && !ehTranscricao) {
    return [];
  }

  // Pesquisa de conteúdo textual (ex.: "Jerônimo de Mendonça 75", "Rua Bruna 390") sem rótulo de Matrícula/Transcrição:
  // o "75" é nº predial do endereço e NÃO deve buscar Matrícula nº 75 nem Transcrição nº 75 por colisão numérica.
  if (deveConsultarFullTextSiplanIa(query) && !ehMatriculaExplicita && !ehTranscricao) {
    return [];
  }

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

// Localização direta ultrarrápida de Plantas Fiscais de Setores/Quadras (K:\IMAGENS\SETORES\00SSS000\00SSSQQQ.KEN).
export async function checkDirectSetorFiles(
  canonicalRoot: string,
  rootId: string,
  query: string,
): Promise<DocumentMatch[]> {
  if (rootId === 'livro2' || rootId === 'titulos_visualiza' || rootId === 'titulos_online') return [];
  const matches: DocumentMatch[] = [];
  const consultaSemProcesso = removerNumerosDeProcesso(query);
  const paresSetorQuadra = new Set<string>();
  const setoresIsolados = new Set<string>();

  // 1. SQL formatado ou parcial: SSS.QQQ.LLLL-D ou SSS.QQQ
  const sqlMatches = consultaSemProcesso.match(/\b(\d{3})\.(\d{3})(?:\.\d{4}(?:-\d)?)?\b/g);
  if (sqlMatches) {
    for (const sm of sqlMatches) {
      const m = sm.match(/^(\d{3})\.(\d{3})/);
      if (m && (m[1] !== '000' || m[2] !== '000')) {
        paresSetorQuadra.add(`${m[1]}:${m[2]}`);
      }
    }
  }

  // 2. Código direto da planta fiscal: 00SSSQQQ (8 dígitos começando com 00) ou SQL 10/11 dígitos contínuos
  const digitosApenas = consultaSemProcesso.replace(/[^\d]/g, '');
  if ((/setor|quadra|planta|sql|iptu/i.test(query) || /^\d{3}\.\d{3}/.test(consultaSemProcesso.trim())) && (digitosApenas.length === 10 || digitosApenas.length === 11)) {
    const s = digitosApenas.slice(0, 3);
    const q = digitosApenas.slice(3, 6);
    if (s !== '000' || q !== '000') {
      paresSetorQuadra.add(`${s}:${q}`);
    }
  }
  const codPlantaMatch = consultaSemProcesso.match(/\b00(\d{3})(\d{3})(?:\.ken)?\b/i);
  if (codPlantaMatch) {
    const [, s, q] = codPlantaMatch;
    if (q === '000') setoresIsolados.add(s);
    else paresSetorQuadra.add(`${s}:${q}`);
  }

  // 3. Menção textual: "setor 053 quadra 006" ou "setor 053"
  const textoSetorQuadra = consultaSemProcesso.match(/setor(?:\s+fiscal)?\s*[:nºo°.\s]*(\d{1,3})(?:[\s,;/\-]+quadra(?:\s+fiscal)?\s*[:nºo°.\s]*(\d{1,3}))?/i);
  if (textoSetorQuadra) {
    const s = textoSetorQuadra[1].padStart(3, '0');
    if (textoSetorQuadra[2]) {
      const q = textoSetorQuadra[2].padStart(3, '0');
      paresSetorQuadra.add(`${s}:${q}`);
    } else {
      setoresIsolados.add(s);
    }
  }

  const seenPaths = new Set<string>();
  for (const par of paresSetorQuadra) {
    const [setor, quadra] = par.split(':');
    const pastaSetor = `00${setor}000`;
    const nomeBase = `00${setor}${quadra}`;
    const candidateRels = [
      path.join('SETORES', pastaSetor, `${nomeBase}.KEN`),
      path.join('SETORES', pastaSetor, `${nomeBase}.TIF`),
      path.join(pastaSetor, `${nomeBase}.KEN`),
    ];
    for (const rel of candidateRels) {
      const lower = rel.toLowerCase();
      if (seenPaths.has(lower)) continue;
      seenPaths.add(lower);
      try {
        const stat = await fs.stat(path.join(canonicalRoot, rel));
        if (stat.isFile()) {
          matches.push({
            rootId,
            relativePath: rel,
            name: path.basename(rel),
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            matricula: `Planta Fiscal Setor ${setor} • Quadra ${quadra}`,
          });
        }
      } catch {}
    }
  }

  // Se encontrou apenas o Setor ou a quadra exata não tinha arquivo individual, lista até 20 plantas do Setor
  const setoresParaListar = new Set<string>(setoresIsolados);
  if (matches.length === 0) {
    for (const par of paresSetorQuadra) {
      setoresParaListar.add(par.split(':')[0]);
    }
  }
  for (const setor of setoresParaListar) {
    const pastaSetor = `00${setor}000`;
    const dirCandidates = [path.join(canonicalRoot, 'SETORES', pastaSetor), path.join(canonicalRoot, pastaSetor)];
    for (const dirPath of dirCandidates) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries.slice(0, 25)) {
          if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
          const full = path.join(dirPath, entry.name);
          const rel = path.relative(canonicalRoot, full);
          const lower = rel.toLowerCase();
          if (seenPaths.has(lower)) continue;
          seenPaths.add(lower);
          const stat = await fs.stat(full);
          const qMatch = entry.name.match(/^00\d{3}(\d{3})\./i);
          const qLabel = qMatch ? ` • Quadra ${qMatch[1]}` : '';
          matches.push({
            rootId,
            relativePath: rel,
            name: entry.name,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            matricula: `Planta Fiscal Setor ${setor}${qLabel}`,
          });
        }
        if (matches.length > 0) break;
      } catch {}
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

export interface TituloDirectTarget {
  protocolo?: number;
  protocoloCentral?: string | null;
}

const STOP_LABEL_TERMS = new Set(['matricula', 'transcricao', 'protocolo', 'prenotacao', 'titulo']);
function getEffectiveSearchTerms(termos: string[]): string[] {
  const filtered = termos.filter(t => !STOP_LABEL_TERMS.has(t));
  return filtered.length > 0 ? filtered : termos;
}

export function isTituloAcervoMatch(rootId: string, relativePath: string): boolean {
  const r = (rootId || '').toLowerCase();
  return (
    r === 'titulos_visualiza' ||
    r === 'titulos_online' ||
    /(?:^|[\\/])(?:titulos-visualiza|titulos_online)(?:[\\/]|$)/i.test(relativePath || '')
  );
}

const IGNORED_TITULO_DIR_RE = /^(?:limpeza|backup|temp|nova pasta(?:\s*\(\d+\))?|\$recycle\.bin)$/i;
function isIgnoredTituloFolderOrFile(name: string, isDir: boolean): boolean {
  if (!name || name.startsWith('$') || name.startsWith('~$')) return true;
  if (isDir) return IGNORED_TITULO_DIR_RE.test(name.trim());
  return !extensions.has(path.extname(name).toLowerCase());
}

interface TitulosOnlineChannelIndex {
  canonicalBase: string;
  builtAt: number;
  byProtocolo: Map<number, string[]>;
  byCentralCode: Map<string, string[]>;
}

const TITULOS_ONLINE_INDEX_TTL_MS = 5 * 60_000;
const TITULOS_ONLINE_CHANNELS = ['AC', 'PH', 'IN', 'ProcessosDigitais'] as const;
const titulosOnlineIndexCache = new Map<string, TitulosOnlineChannelIndex>();
const titulosOnlineIndexInFlight = new Map<string, Promise<TitulosOnlineChannelIndex>>();

function pushMapArray<K>(map: Map<K, string[]>, key: K, val: string): void {
  const list = map.get(key);
  if (list) {
    if (!list.includes(val)) list.push(val);
  } else {
    map.set(key, [val]);
  }
}

async function getOrBuildTitulosOnlineIndex(canonicalBase: string): Promise<TitulosOnlineChannelIndex> {
  const cached = titulosOnlineIndexCache.get(canonicalBase);
  if (cached && Date.now() - cached.builtAt < TITULOS_ONLINE_INDEX_TTL_MS) {
    return cached;
  }
  const existing = titulosOnlineIndexInFlight.get(canonicalBase);
  if (existing) return existing;

  const task = (async (): Promise<TitulosOnlineChannelIndex> => {
    const byProtocolo = new Map<number, string[]>();
    const byCentralCode = new Map<string, string[]>();

    await Promise.all(
      TITULOS_ONLINE_CHANNELS.map(async channel => {
        const channelDir = path.join(canonicalBase, channel);
        try {
          const handle = await fs.opendir(channelDir);
          for await (const entry of handle) {
            if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
            if (isIgnoredTituloFolderOrFile(entry.name, true)) continue;
            const relSub = path.join(channel, entry.name);
            const protoCentralMatch = entry.name.match(/^0*([1-9]\d{2,7})-([a-z]{2,3}[a-z0-9]{4,})$/i);
            if (protoCentralMatch) {
              const protoNum = parseInt(protoCentralMatch[1], 10);
              if (Number.isFinite(protoNum) && protoNum > 0) pushMapArray(byProtocolo, protoNum, relSub);
              pushMapArray(byCentralCode, protoCentralMatch[2].toLowerCase(), relSub);
              continue;
            }
            const centralOnlyMatch = entry.name.match(/^([a-z]{2,3}[a-z0-9]{4,})$/i);
            if (centralOnlyMatch) {
              pushMapArray(byCentralCode, centralOnlyMatch[1].toLowerCase(), relSub);
              continue;
            }
            const numOnlyMatch = entry.name.match(/^0*([1-9]\d{2,7})$/);
            if (numOnlyMatch) {
              const protoNum = parseInt(numOnlyMatch[1], 10);
              if (Number.isFinite(protoNum) && protoNum > 0) pushMapArray(byProtocolo, protoNum, relSub);
            }
          }
        } catch {
          // Canal ausente ou inacessível: ignora silenciosamente
        }
      }),
    );

    const built: TitulosOnlineChannelIndex = {
      canonicalBase,
      builtAt: Date.now(),
      byProtocolo,
      byCentralCode,
    };
    titulosOnlineIndexCache.set(canonicalBase, built);
    return built;
  })().finally(() => {
    titulosOnlineIndexInFlight.delete(canonicalBase);
  });

  titulosOnlineIndexInFlight.set(canonicalBase, task);
  return task;
}

const tituloCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

async function collectValidFilesFromTituloDir(
  canonicalRoot: string,
  rootId: string,
  dirPath: string,
  maxFiles: number,
  seenKeys: Set<string>,
  out: DocumentMatch[],
): Promise<boolean> {
  let realDir: string;
  try {
    realDir = await fs.realpath(dirPath);
    if (!isWithinRoot(canonicalRoot, realDir)) return false;
    const st = await fs.stat(realDir);
    if (!st.isDirectory()) return false;
  } catch {
    return false;
  }

  const candidateNames: string[] = [];
  try {
    const handle = await fs.opendir(realDir);
    for await (const entry of handle) {
      if (entry.isSymbolicLink() || entry.isDirectory()) continue;
      if (isIgnoredTituloFolderOrFile(entry.name, false)) continue;
      candidateNames.push(entry.name);
      if (candidateNames.length >= 200) break;
    }
  } catch {
    return false;
  }

  candidateNames.sort((a, b) => tituloCollator.compare(a, b));
  let addedAny = false;
  let addedForDir = 0;

  for (const name of candidateNames) {
    if (addedForDir >= maxFiles) break;
    const full = path.join(realDir, name);
    try {
      const realFile = await fs.realpath(full);
      if (!isWithinRoot(canonicalRoot, realFile)) continue;
      const info = await fs.stat(realFile);
      if (!info.isFile() || isArquivoBloqueioOffice(name, info.size)) continue;
      const relativePath = path.relative(canonicalRoot, full);
      const dedupKey = `${rootId}:${relativePath.toLowerCase()}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);
      out.push({
        rootId,
        relativePath,
        name,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
      });
      addedForDir++;
      addedAny = true;
    } catch {}
  }
  return addedAny;
}

async function tryMatchDirectTituloFile(
  canonicalRoot: string,
  rootId: string,
  fullPath: string,
  seenKeys: Set<string>,
  out: DocumentMatch[],
): Promise<boolean> {
  const name = path.basename(fullPath);
  if (isIgnoredTituloFolderOrFile(name, false)) return false;
  try {
    const realFile = await fs.realpath(fullPath);
    if (!isWithinRoot(canonicalRoot, realFile)) return false;
    const info = await fs.stat(realFile);
    if (!info.isFile() || isArquivoBloqueioOffice(name, info.size)) return false;
    const relativePath = path.relative(canonicalRoot, fullPath);
    const dedupKey = `${rootId}:${relativePath.toLowerCase()}`;
    if (seenKeys.has(dedupKey)) return false;
    seenKeys.add(dedupKey);
    out.push({
      rootId,
      relativePath,
      name,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkDirectTitulosFiles(
  canonicalRoot: string,
  rootId: string,
  targets: TituloDirectTarget[],
  options?: {
    maxFilesPerProtocol?: number;
    skipVisualiza?: boolean;
    skipOnline?: boolean;
  },
): Promise<DocumentMatch[]> {
  if (rootId !== 'titulos_visualiza' && rootId !== 'titulos_online' && rootId !== 'imagens') {
    return [];
  }
  if (!targets || targets.length === 0) return [];

  const maxFilesPerProtocol = Math.max(1, options?.maxFilesPerProtocol ?? 25);
  const out: DocumentMatch[] = [];
  const seenKeys = new Set<string>();

  const normalizedTargets: Array<{ protocolo: number | null; protocoloCentral: string | null }> = [];
  const seenTargets = new Set<string>();
  for (const t of targets) {
    const proto = t.protocolo && Number.isFinite(t.protocolo) && t.protocolo > 0 ? Math.trunc(t.protocolo) : null;
    const central = t.protocoloCentral ? String(t.protocoloCentral).trim() : null;
    if (!proto && !central) continue;
    const tKey = `${proto ?? ''}|${(central || '').toLowerCase()}`;
    if (seenTargets.has(tKey)) continue;
    seenTargets.add(tKey);
    normalizedTargets.push({ protocolo: proto, protocoloCentral: central });
  }
  if (normalizedTargets.length === 0) return [];

  const resolveSubBase = async (candidate: string): Promise<string | null> => {
    try {
      const real = await fs.realpath(candidate);
      if (!isWithinRoot(canonicalRoot, real)) return null;
      const st = await fs.stat(real);
      return st.isDirectory() ? real : null;
    } catch {
      return null;
    }
  };

  const tvBase =
    rootId === 'titulos_visualiza'
      ? await resolveSubBase(canonicalRoot)
      : rootId === 'imagens' && !options?.skipVisualiza
      ? await resolveSubBase(path.join(canonicalRoot, 'TITULOS-VISUALIZA'))
      : null;

  const toBase =
    rootId === 'titulos_online'
      ? await resolveSubBase(canonicalRoot)
      : rootId === 'imagens' && !options?.skipOnline
      ? await resolveSubBase(path.join(canonicalRoot, 'Titulos_Online'))
      : null;

  // 1. TÍTULOS VISUALIZA (K:\IMAGENS\TITULOS-VISUALIZA\00BBB000\<pad8>.TIF | <block>\<proto>\*.pdf)
  if (tvBase) {
    for (const target of normalizedTargets) {
      if (!target.protocolo) continue;
      const p = target.protocolo;
      const block1000 = String(Math.floor(p / 1000) * 1000).padStart(8, '0');
      const pad8 = String(p).padStart(8, '0');
      const raw = String(p);
      const blockDir = path.join(tvBase, block1000);

      const fileCandidates = process.platform === 'win32'
        ? [`${pad8}.TIF`, `${pad8}.PDF`, `${raw}.TIF`, `${raw}.PDF`, `${pad8}.KEN`]
        : [
            `${pad8}.TIF`, `${pad8}.tif`,
            `${pad8}.PDF`, `${pad8}.pdf`,
            `${raw}.TIF`, `${raw}.tif`,
            `${raw}.PDF`, `${raw}.pdf`,
            `${pad8}.KEN`, `${pad8}.ken`,
          ];

      await Promise.all(
        fileCandidates.map(fname =>
          tryMatchDirectTituloFile(canonicalRoot, rootId, path.join(blockDir, fname), seenKeys, out),
        ),
      );

      const folderCandidates = raw === pad8 ? [raw] : [raw, pad8];
      for (const fName of folderCandidates) {
        await collectValidFilesFromTituloDir(
          canonicalRoot,
          rootId,
          path.join(blockDir, fName),
          maxFilesPerProtocol,
          seenKeys,
          out,
        );
      }
    }
  }

  // 2. TÍTULOS ONLINE (K:\IMAGENS\Titulos_Online\AC|PH|IN|ProcessosDigitais|00BBB000)
  if (toBase) {
    const unresolvedTargets: Array<{ protocolo: number | null; protocoloCentral: string | null }> = [];

    for (const target of normalizedTargets) {
      let matchedDirectCentral = false;
      if (target.protocolo) {
        const p = target.protocolo;
        const block1000 = String(Math.floor(p / 1000) * 1000).padStart(8, '0');
        const pad8 = String(p).padStart(8, '0');
        const raw = String(p);

        const onlineFileCandidates = process.platform === 'win32'
          ? [path.join(toBase, block1000, `${pad8}.PDF`), path.join(toBase, block1000, `${raw}.PDF`)]
          : [
              path.join(toBase, block1000, `${pad8}.PDF`),
              path.join(toBase, block1000, `${pad8}.pdf`),
              path.join(toBase, block1000, `${raw}.PDF`),
              path.join(toBase, block1000, `${raw}.pdf`),
            ];
        await Promise.all(
          onlineFileCandidates.map(fp => tryMatchDirectTituloFile(canonicalRoot, rootId, fp, seenKeys, out)),
        );

        const directDirs = [
          path.join(toBase, block1000, raw),
          ...(pad8 !== raw ? [path.join(toBase, block1000, pad8)] : []),
          path.join(toBase, 'IN', raw),
          path.join(toBase, 'ProcessosDigitais', pad8),
          ...(pad8 !== raw ? [path.join(toBase, 'ProcessosDigitais', raw)] : []),
          path.join(toBase, raw),
        ];
        for (const dPath of directDirs) {
          await collectValidFilesFromTituloDir(canonicalRoot, rootId, dPath, maxFilesPerProtocol, seenKeys, out);
        }

        if (target.protocoloCentral) {
          const cUpper = target.protocoloCentral.toUpperCase();
          const cPrefix = cUpper.slice(0, 2);
          if (cPrefix === 'AC' || cPrefix === 'PH' || cPrefix === 'IN') {
            const centralCandidates = [path.join(toBase, cPrefix, `${raw}-${cUpper}`)];
            if (pad8 !== raw) centralCandidates.push(path.join(toBase, cPrefix, `${pad8}-${cUpper}`));
            for (const cDir of centralCandidates) {
              const found = await collectValidFilesFromTituloDir(
                canonicalRoot,
                rootId,
                cDir,
                maxFilesPerProtocol,
                seenKeys,
                out,
              );
              if (found) matchedDirectCentral = true;
            }
          }
        }
      }

      if (!matchedDirectCentral) {
        unresolvedTargets.push(target);
      }
    }

    if (unresolvedTargets.length > 0) {
      const idx = await getOrBuildTitulosOnlineIndex(toBase);
      for (const target of unresolvedTargets) {
        const subPaths = new Set<string>();
        if (target.protocolo) {
          for (const relSub of idx.byProtocolo.get(target.protocolo) || []) subPaths.add(relSub);
        }
        if (target.protocoloCentral) {
          for (const relSub of idx.byCentralCode.get(target.protocoloCentral.toLowerCase()) || []) subPaths.add(relSub);
        }
        for (const relSub of subPaths) {
          await collectValidFilesFromTituloDir(
            canonicalRoot,
            rootId,
            path.join(toBase, relSub),
            maxFilesPerProtocol,
            seenKeys,
            out,
          );
        }
      }
    }
  }

  return out;
}

function extractDirectTituloCriterionInfo(texto: string): {
  isExplicitProtocolo: boolean;
  skipDirectTitulos: boolean;
  protocolosDiretos: number[];
  codigosCentral: string[];
} {
  const isExplicitMatriculaOrSetor = /\b(?:matr[ií]cula|transcri[çc][ãa]o|setor|quadra|sql|iptu)\b/i.test(texto);
  const isExplicitProtocolo =
    /\b(?:protocolo|prenota[çc][ãa]o|t[íi]tulo)\b/i.test(texto) ||
    /\b(?:ac|ph|in)[0-9]{5,12}[a-z0-9]?\b/i.test(texto);

  if (isExplicitMatriculaOrSetor && !isExplicitProtocolo) {
    return { isExplicitProtocolo: false, skipDirectTitulos: true, protocolosDiretos: [], codigosCentral: [] };
  }
  // Pesquisa textual de endereço/nome (ex.: "Rua Bruna 390") sem pedido de Protocolo não deve puxar Protocolo nº 390
  if (deveConsultarFullTextSiplanIa(texto) && !isExplicitProtocolo) {
    return { isExplicitProtocolo: false, skipDirectTitulos: true, protocolosDiretos: [], codigosCentral: [] };
  }

  const semProcesso = removerNumerosDeProcesso(texto);
  const codigosSet = new Set<string>();
  const centralMatches = semProcesso.match(/\b(?:ac|ph|in)[0-9]{5,12}[a-z0-9]?\b/gi) || [];
  for (const code of centralMatches) {
    codigosSet.add(code.toUpperCase());
  }

  const protosSet = new Set<number>();
  const dotted = semProcesso.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || [];
  for (const d of dotted) {
    const num = parseInt(d.replace(/\D+/g, ''), 10);
    if (Number.isFinite(num) && num >= 100 && num <= 99_999_999) protosSet.add(num);
  }
  const plain = semProcesso.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ').match(/\b\d{3,8}\b/g) || [];
  for (const d of plain) {
    const num = parseInt(d, 10);
    if (Number.isFinite(num) && num >= 100 && num <= 99_999_999) protosSet.add(num);
  }

  return {
    isExplicitProtocolo,
    skipDirectTitulos: false,
    protocolosDiretos: Array.from(protosSet),
    codigosCentral: Array.from(codigosSet),
  };
}

/** Pré-aquece em memória o índice das pastas de processos e minutas para buscas sub-segundo. */
export async function warmDocumentIndex(roots: DocumentRoot[]): Promise<void> {
  const indexable = roots.filter(
    r =>
      r.id !== 'imagens' &&
      r.id !== 'livro2' &&
      r.id !== 'titulos_visualiza' &&
      r.id !== 'titulos_online',
  );
  await Promise.all(indexable.map(r => buildRootDirectoryIndex(r.path).catch(() => null)));
}

// No path supplied by a browser is accepted. Only locally configured roots are traversed.
// Symlinks/junctions are skipped and each directory/file is checked against the canonical root.
export async function searchDocuments(
  roots: DocumentRoot[], query: string, limit = 100,
  budget = { maxEntries: 50000, timeoutMs: 25000 },
  options?: {
    webriResolver?: (params: {
      matriculas?: number[];
      processosCnj?: string[];
      protocolosDiretos?: number[];
      codigosCentral?: string[];
    }) => Promise<ProtocoloVinculadoWebri[]>;
    siplaniaTextSearchResolver?: (criterion: string, maxResults?: number) => Promise<number[]>;
  },
): Promise<DocumentSearchResult> {
  // Busca Cruzada: os campos chegam separados por "|" (ex.: "1124837-38.2022.8.26.0100 | 7987").
  // Cada campo é um critério independente: termos DENTRO do campo precisam casar juntos (E),
  // e o resultado final é a UNIÃO dos critérios (OU). Antes todos os termos eram exigidos no mesmo
  // caminho, então processo + matrícula nunca casavam com nenhum arquivo do processo.
  const criterios = query.split('|')
    .map(texto => ({ texto: texto.trim(), termos: normalize(texto).trim().split(/\s+/).filter(Boolean) }))
    .filter(c => c.termos.join(' ').length >= 2);
  const buscaCruzada = criterios.length > 1;
  if (criterios.length === 0 || query.length > 260 || limit < 1 || limit > 100) throw new Error('Pesquisa inválida.');

  const webriResolver = options?.webriResolver ?? consultarProtocolosVinculadosWebriReadOnly;
  const siplaniaTextSearchResolver = options?.siplaniaTextSearchResolver ?? pesquisarMatriculasTextoSiplanIaReadOnly;
  const criteriosEffectiveTerms = criterios.map(c => getEffectiveSearchTerms(c.termos));

  const termoCasa = (term: string, normRel: string, cleanRel: string): boolean => {
    if (/^[0-9.]+$/.test(term)) {
      const rawDigits = term.replace(/\./g, '');
      if (/^\d{2,8}$/.test(rawDigits)) {
        const semZeros = rawDigits.replace(/^0+/, '') || '0';
        const normMilhares = normRel
          .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
          .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
        if (rawDigits.length === 7 && !rawDigits.startsWith('0')) {
          return new RegExp(`(^|\\D)(?:0*${semZeros}(\\D|$)|${rawDigits}\\d{13}(\\D|$))`).test(normMilhares);
        }
        return new RegExp(`(^|\\D)0*${semZeros}(\\D|$)`).test(normMilhares);
      }
    }
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
  const hasDedicatedTv = roots.some(r => r.id === 'titulos_visualiza');
  const hasDedicatedTo = roots.some(r => r.id === 'titulos_online');

  const critTituloInfo = criterios.map(c => extractDirectTituloCriterionInfo(c.texto));
  const allDirectProtos = Array.from(new Set(critTituloInfo.flatMap(i => i.protocolosDiretos)));
  const allCentralCodes = Array.from(new Set(critTituloInfo.flatMap(i => i.codigosCentral)));
  const webriDirectTargets: ProtocoloVinculadoWebri[] =
    allDirectProtos.length > 0 || allCentralCodes.length > 0
      ? await webriResolver({
          protocolosDiretos: allDirectProtos,
          codigosCentral: allCentralCodes,
        }).catch(() => [] as ProtocoloVinculadoWebri[])
      : [];

  const directTituloMatchesByCrit = new Map<number, DocumentMatch[]>();
  const lv2DirectMatByCrit = new Set<number>();

  let visited = 0;
  const deadline = Date.now() + budget.timeoutMs;
  for (const root of roots) {
    let canonical: string;
    try { canonical = await fs.realpath(root.path); }
    catch { result.unavailableRoots.push(root.id); result.partial = true; continue; }
    const ehAcervoImagens =
      root.id === 'imagens' ||
      root.id === 'livro2' ||
      root.id === 'titulos_visualiza' ||
      root.id === 'titulos_online';
    const ehPastaSemImagens = root.id === 'minutas' || root.id === 'processos';
    const ehPastaExclusivaTitulos = root.id === 'titulos_visualiza' || root.id === 'titulos_online';

    // 1. Busca direta ultrarrápida para Plantas Fiscais (K:\IMAGENS\SETORES), Matrículas .KEN (LV2/LV3)
    //    e Títulos / Prenotações (TITULOS-VISUALIZA / Titulos_Online)
    const criteriosResolvidosDireto = new Set<number>();
    for (let i = 0; i < criterios.length && !ehPastaSemImagens; i++) {
      try {
        const setorMatches = await checkDirectSetorFiles(canonical, root.id, criterios[i].texto);
        for (const sm of setorMatches) {
          if (result.files.length >= limit) {
            result.partial = true;
            break;
          }
          const key = `${sm.rootId}:${sm.relativePath.toLowerCase()}`;
          chavesExplicitas.add(key);
          criteriosResolvidosDireto.add(i);
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push(sm);
          }
        }

        const textoCrit = criterios[i].texto.trim();
        const ehZerosParciaisProcesso = /^0+[1-9]\d*$/.test(textoCrit) && textoCrit.length < 8;
        const directMatches = await checkDirectMatriculaFiles(canonical, root.id, criterios[i].texto);
        for (const m of directMatches) {
          const ehDoLivro2 = m.rootId === 'livro2' || /^lv2[\\/]/i.test(m.relativePath);
          if (ehDoLivro2) {
            lv2DirectMatByCrit.add(i);
          }
          criteriosResolvidosDireto.add(i);
          if (result.files.length >= limit) {
            result.partial = true;
            break;
          }
          const key = `${m.rootId}:${m.relativePath.toLowerCase()}`;
          if (buscaCruzada || !ehZerosParciaisProcesso) {
            chavesExplicitas.add(key);
          }
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push(m);
          }
        }

        const cTit = critTituloInfo[i];
        if (
          !cTit.skipDirectTitulos &&
          (cTit.protocolosDiretos.length > 0 || cTit.codigosCentral.length > 0) &&
          (root.id === 'titulos_visualiza' || root.id === 'titulos_online' || root.id === 'imagens')
        ) {
          const targetsForCrit: TituloDirectTarget[] = [];
          for (const p of cTit.protocolosDiretos) {
            const enriched = webriDirectTargets.find(w => w.protocolo === p);
            targetsForCrit.push({
              protocolo: p,
              protocoloCentral: enriched?.protocoloCentral ?? null,
            });
          }
          for (const code of cTit.codigosCentral) {
            targetsForCrit.push({ protocoloCentral: code });
          }

          const titMatches = await checkDirectTitulosFiles(canonical, root.id, targetsForCrit, {
            maxFilesPerProtocol: 25,
            skipVisualiza: root.id === 'imagens' && hasDedicatedTv,
            skipOnline: root.id === 'imagens' && hasDedicatedTo,
          });
          if (titMatches.length > 0) {
            criteriosResolvidosDireto.add(i);
            const bucket = directTituloMatchesByCrit.get(i) || [];
            bucket.push(...titMatches);
            directTituloMatchesByCrit.set(i, bucket);
          }
        }
      } catch {}
    }

    // Pastas estruturadas de títulos nunca entram na varredura recursiva SMB
    if (ehPastaExclusivaTitulos) continue;

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
        const ok = criteriosParaVarrer.some(c => {
          const idx = criterios.indexOf(c);
          const terms = idx >= 0 ? criteriosEffectiveTerms[idx] : c.termos;
          return terms.every(term => termoCasa(term, item.normRel, item.cleanRel));
        });
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
        if (result.files.length >= limit) {
          result.partial = true;
          break;
        }
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
            if (
              ehAcervoImagens &&
              /^(?:lv2|titulos-visualiza|titulos_online|limpeza|backup|temp|\$recycle\.bin)$/i.test(entry.name)
            ) {
              continue;
            }
            queue.push(filePath);
            continue;
          }
          if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
          const relativePath = path.relative(canonical, filePath);
          const normRel = normalize(relativePath);
          const cleanRel = normRel.replace(/[.\-_/\s]/g, '');
          const matches = criteriosParaVarrer.some(c => {
            const idx = criterios.indexOf(c);
            const terms = idx >= 0 ? criteriosEffectiveTerms[idx] : c.termos;
            return terms.every(term => termoCasa(term, normRel, cleanRel));
          });
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

  // Consolida buscas diretas de Títulos (descartando colisão homônima quando nº nu era Matrícula LV2)
  const discoveredCentralProtos: TituloDirectTarget[] = [];
  for (const [critIdx, titMatches] of directTituloMatchesByCrit.entries()) {
    if (lv2DirectMatByCrit.has(critIdx) && !critTituloInfo[critIdx]?.isExplicitProtocolo) {
      continue;
    }
    for (const tm of titMatches) {
      if (result.files.length >= limit) {
        result.partial = true;
        break;
      }
      const key = `${tm.rootId}:${tm.relativePath.toLowerCase()}`;
      chavesExplicitas.add(key);
      if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
        result.files.push(tm);
      }
      const pFolderMatch = tm.relativePath.match(/(?:^|[\\/])0*([1-9]\d{2,7})-(?:ac|ph|in)[a-z0-9]+(?:[\\/]|$)/i);
      if (pFolderMatch) {
        const discoveredProto = parseInt(pFolderMatch[1], 10);
        if (Number.isFinite(discoveredProto) && discoveredProto > 0 && !allDirectProtos.includes(discoveredProto)) {
          discoveredCentralProtos.push({ protocolo: discoveredProto });
        }
      }
    }
  }

  // Se uma busca direta por código AC/PH/IN revelou o nº do protocolo, cruza automaticamente em TITULOS-VISUALIZA e WEBRI
  const discoveredProtoNums = Array.from(
    new Set(discoveredCentralProtos.map(p => p.protocolo).filter((n): n is number => Boolean(n && n > 0))),
  );
  if (discoveredProtoNums.length > 0) {
    const extraWebri = await webriResolver({ protocolosDiretos: discoveredProtoNums }).catch(
      () => [] as ProtocoloVinculadoWebri[],
    );
    for (const ew of extraWebri) {
      const existing = webriDirectTargets.find(w => w.protocolo === ew.protocolo);
      if (!existing) {
        webriDirectTargets.push(ew);
      } else {
        if (!existing.protocoloCentral && ew.protocoloCentral) existing.protocoloCentral = ew.protocoloCentral;
        if (ew.matriculasLv2?.length) {
          existing.matriculasLv2 = Array.from(new Set([...(existing.matriculasLv2 || []), ...ew.matriculasLv2]));
        }
        if (ew.transcricoesLv3?.length) {
          existing.transcricoesLv3 = Array.from(
            new Set([...(existing.transcricoesLv3 || []), ...ew.transcricoesLv3]),
          );
        }
      }
    }
  }

  if (discoveredCentralProtos.length > 0 && result.files.length < limit) {
    for (const root of roots) {
      if (root.id !== 'titulos_visualiza' && (root.id !== 'imagens' || hasDedicatedTv)) continue;
      try {
        const canonical = await fs.realpath(root.path);
        const tvMatches = await checkDirectTitulosFiles(canonical, root.id, discoveredCentralProtos, {
          maxFilesPerProtocol: 25,
          skipOnline: true,
        });
        for (const tm of tvMatches) {
          if (result.files.length >= limit) {
            result.partial = true;
            break;
          }
          const key = `${tm.rootId}:${tm.relativePath.toLowerCase()}`;
          chavesExplicitas.add(key);
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push(tm);
          }
        }
      } catch {}
    }
  }

  // Busca Full-Text no acervo de 269 mil matrículas LV2 já OCRizadas no SiplanIA (endereço, condomínio, CPF/CNPJ, nomes)
  const criteriosTextoIa = criterios.filter(c => deveConsultarFullTextSiplanIa(c.texto));
  if (criteriosTextoIa.length > 0 && result.files.length < limit) {
    const lv2Roots = roots.filter(r => r.id === 'livro2');
    const imagensRoots = roots.filter(r => r.id === 'imagens');
    const targetLv2Roots = lv2Roots.length > 0 ? lv2Roots : imagensRoots;
    if (targetLv2Roots.length > 0) {
      const ftsLimit = Math.min(25, Math.max(1, limit - result.files.length));
      const encontradosPorCrit = await Promise.all(
        criteriosTextoIa.map(c => siplaniaTextSearchResolver(c.texto, ftsLimit).catch(() => [] as number[])),
      );
      const numerosIaOrdenados: number[] = [];
      const seenIaNums = new Set<number>();
      for (const lista of encontradosPorCrit) {
        for (const n of lista) {
          if (Number.isFinite(n) && n > 0 && !seenIaNums.has(n)) {
            seenIaNums.add(n);
            numerosIaOrdenados.push(n);
          }
        }
      }

      if (numerosIaOrdenados.length > 0) {
        const candidatosIa = numerosIaOrdenados.slice(0, ftsLimit);
        const resolvedRoots = await Promise.all(
          targetLv2Roots.map(async root => {
            try {
              return { rootId: root.id, canonical: await fs.realpath(root.path) };
            } catch {
              return null;
            }
          }),
        );
        const validRoots = resolvedRoots.filter((r): r is { rootId: string; canonical: string } => r !== null);

        if (validRoots.length > 0) {
          const matchesPerNum = await Promise.all(
            candidatosIa.map(async num => {
              const allForNum: DocumentMatch[] = [];
              for (const vr of validRoots) {
                try {
                  const found = await checkDirectMatriculaFiles(vr.canonical, vr.rootId, String(num));
                  for (const m of found) {
                    const ehDoLivro2 = m.rootId === 'livro2' || /^lv2[\\/]/i.test(m.relativePath);
                    if (!ehDoLivro2) continue;
                    m.matricula = `Matrícula nº ${formatarMilharCartorio(num)}`;
                    allForNum.push(m);
                  }
                } catch {}
              }
              return allForNum;
            }),
          );

          for (const group of matchesPerNum) {
            for (const item of group) {
              if (result.files.length >= limit) {
                result.partial = true;
                break;
              }
              const key = `${item.rootId}:${item.relativePath.toLowerCase()}`;
              chavesExplicitas.add(key);
              if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
                result.files.push(item);
              }
            }
          }
        }
      }
    }
  }

  // Enriquecer os resultados identificando matrículas vinculadas aos arquivos encontrados
  const matriculasEncontradas = new Set<string>();
  const matriculasDosProcessos = new Set<string>();
  let matriculaPrincipalProcesso: string | undefined;
  let matriculaPrincipal: string | undefined;

  if (result.files.length > 0) {
    const arquivosNaoTitulo = result.files.filter(f => !isTituloAcervoMatch(f.rootId, f.relativePath));
    const filesToInspect = [
      ...arquivosNaoTitulo.filter(f => !/\.(?:ken|tiff?)$/i.test(f.name)),
      ...arquivosNaoTitulo.filter(f => /\.(?:ken|tiff?)$/i.test(f.name)),
      ...result.files.filter(f => isTituloAcervoMatch(f.rootId, f.relativePath)),
    ].slice(0, 20);

    await Promise.all(
      filesToInspect.map(async file => {
        try {
          const ext = path.extname(file.name).toLowerCase();
          const isImageFile = ext === '.ken' || ext === '.tif' || ext === '.tiff';
          const ehArquivoDeTitulo = isTituloAcervoMatch(file.rootId, file.relativePath);

          if (file.matricula) {
            matriculasEncontradas.add(file.matricula);
            if (!isImageFile && !ehArquivoDeTitulo) {
              matriculasDosProcessos.add(file.matricula);
              if (!matriculaPrincipalProcesso) matriculaPrincipalProcesso = file.matricula;
            }
            if (!matriculaPrincipal) matriculaPrincipal = file.matricula;
            return;
          }
          if (ehArquivoDeTitulo) {
            // Não extrair nº solto do nome do título/prenotação como se fosse nº de matrícula
            const explicitTitleMat = file.name.match(
              /\b(?:matr[ií]cula|matr\.|transcri[çc][ãa]o|transcr\.)\s*(?:n[ºo°.]*\s*)?[:.\s]*([0-9][0-9.]*)/i,
            );
            if (!explicitTitleMat) return;
          }
          const pathMat = extrairNumeroMatricula(file.relativePath);
          if (pathMat) {
            file.matricula = pathMat;
            matriculasEncontradas.add(pathMat);
            if (!isImageFile && !ehArquivoDeTitulo) {
              matriculasDosProcessos.add(pathMat);
              if (!matriculaPrincipalProcesso) matriculaPrincipalProcesso = pathMat;
            }
            if (!matriculaPrincipal) matriculaPrincipal = pathMat;
            return;
          }
          if (ehArquivoDeTitulo) return;
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
    // Se a busca encontrou documentos de processo (PDF, DOCX) ou protocolos WEBRI vinculados a
    // matrículas (ex: Protocolo 649109 -> Matrícula nº 229.534), localizamos a imagem digitalizada
    // (.KEN) correspondente no acervo do Livro 2 / Livro 3 e a incluímos no resultado.
    // -------------------------------------------------------------
    const matriculasViaProtocoloWebri = new Set<string>();
    const protosElegiveisWebri = new Set<number>(discoveredProtoNums);
    for (let critIdx = 0; critIdx < critTituloInfo.length; critIdx++) {
      if (lv2DirectMatByCrit.has(critIdx) && !critTituloInfo[critIdx]?.isExplicitProtocolo) continue;
      for (const p of critTituloInfo[critIdx].protocolosDiretos) {
        protosElegiveisWebri.add(p);
      }
    }
    for (const w of webriDirectTargets) {
      if (!protosElegiveisWebri.has(w.protocolo)) continue;
      for (const mNum of w.matriculasLv2 || []) {
        const fmt = `Matrícula nº ${formatarMilharCartorio(mNum)}`;
        matriculasViaProtocoloWebri.add(fmt);
        matriculasEncontradas.add(fmt);
      }
      for (const tNum of w.transcricoesLv3 || []) {
        const fmt = `Transcrição nº ${formatarMilharCartorio(tNum)}`;
        matriculasViaProtocoloWebri.add(fmt);
        matriculasEncontradas.add(fmt);
      }
    }

    const matriculasParaCruzar = new Set<string>();
    if (matriculaPrincipalProcesso) matriculasParaCruzar.add(matriculaPrincipalProcesso);
    for (const m of matriculasDosProcessos) matriculasParaCruzar.add(m);
    for (const m of matriculasViaProtocoloWebri) matriculasParaCruzar.add(m);
    if (matriculasParaCruzar.size === 0 && result.matriculaDetectada) {
      matriculasParaCruzar.add(result.matriculaDetectada);
    }

    const temDocumentosProcesso = result.files.some(f => {
      if (isTituloAcervoMatch(f.rootId, f.relativePath)) return false;
      const ext = path.extname(f.name).toLowerCase();
      return ext !== '.ken' && ext !== '.tif' && ext !== '.tiff';
    });

    if (matriculasParaCruzar.size > 0 && (temDocumentosProcesso || matriculasViaProtocoloWebri.size > 0)) {
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
          if (
            root.id === 'minutas' ||
            root.id === 'processos' ||
            root.id === 'titulos_visualiza' ||
            root.id === 'titulos_online'
          ) {
            continue;
          }
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
        if (isTituloAcervoMatch(f.rootId, f.relativePath)) return true;
        const ext = path.extname(f.name).toLowerCase();
        const isImg = ext === '.ken' || ext === '.tif' || ext === '.tiff';
        if (!isImg) return true; // Preserva todos os arquivos de processo (PDF, DOCX, TXT, etc.)
        // Matrícula digitada explicitamente sempre permanece
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
        if (result.files.length >= limit) {
          result.partial = true;
          break;
        }
        const key = `${cruzado.rootId}:${cruzado.relativePath.toLowerCase()}`;
        if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
          result.files.push(cruzado);
        }
      }

      // Atualizar lista final de matrículas
      const matriculasOrdenadas = Array.from(new Set([...matriculasParaCruzar]));
      result.matriculas = matriculasOrdenadas;
      result.matriculaDetectada = matriculaPrincipalProcesso || result.matriculaDetectada || matriculasOrdenadas[0];
    }
  }

  // -------------------------------------------------------------
  // BUSCA CRUZADA AUTOMÁTICA DE TÍTULOS VIA WEBRI (TITULOS-VISUALIZA + Titulos_Online):
  // A partir das matrículas confirmadas ou números de processo CNJ da pesquisa, consulta read-only
  // no SRVSQL\WEBRI os protocolos/prenotações vinculados e anexa os arquivos correspondentes em K:\.
  // -------------------------------------------------------------
  const matriculasParaWebri = new Set<number>();
  for (const mStr of [
    ...(result.matriculaDetectada ? [result.matriculaDetectada] : []),
    ...(result.matriculas || []),
    ...Array.from(matriculasEncontradas),
  ]) {
    if (/transcri[çc][ãa]o/i.test(mStr)) continue;
    const mNum = parseInt(mStr.replace(/\D+/g, ''), 10);
    if (Number.isFinite(mNum) && mNum > 0) matriculasParaWebri.add(mNum);
  }
  for (const c of criterios) {
    if (/\bmatr[ií]cula\b/i.test(c.texto)) {
      const semProc = removerNumerosDeProcesso(c.texto);
      const nums = semProc.replace(/\./g, '').match(/\b\d{2,7}\b/g) || [];
      for (const n of nums) {
        const mNum = parseInt(n, 10);
        if (Number.isFinite(mNum) && mNum > 0) matriculasParaWebri.add(mNum);
      }
    }
  }
  const processosCnjParaWebri = Array.from(
    new Set(
      (query.match(new RegExp(REGEX_PROCESSO_CNJ.source, 'g')) || [])
        .map(p => p.trim())
        .filter(p => p.replace(/\D+/g, '').length >= 9),
    ),
  );

  // Evita que busca exclusivamente de endereço/nome/CPF (sem nº de matrícula/protocolo/CNJ) traga 30 .TIFs de TITULOS-VISUALIZA acima das matrículas reais
  const ehBuscaApenasConteudoTextual =
    criterios.every(
      c =>
        deveConsultarFullTextSiplanIa(c.texto) &&
        !/\b(?:matr[ií]cula|protocolo|prenota[çc][ãa]o|processo)\b/i.test(c.texto),
    ) && processosCnjParaWebri.length === 0;

  if (
    !ehBuscaApenasConteudoTextual &&
    (matriculasParaWebri.size > 0 || processosCnjParaWebri.length > 0) &&
    result.files.length < limit
  ) {
    const hasTituloRoots = roots.some(
      r => r.id === 'titulos_visualiza' || r.id === 'titulos_online' || r.id === 'imagens',
    );
    if (hasTituloRoots) {
      const protocolosVinculados = await webriResolver({
        matriculas: Array.from(matriculasParaWebri),
        processosCnj: processosCnjParaWebri,
      }).catch(() => [] as ProtocoloVinculadoWebri[]);

      if (protocolosVinculados.length > 0) {
        const targets = protocolosVinculados.map(pv => ({
          protocolo: pv.protocolo,
          protocoloCentral: pv.protocoloCentral,
        }));
        const titulosCruzados: DocumentMatch[] = [];
        for (const root of roots) {
          if (root.id !== 'titulos_visualiza' && root.id !== 'titulos_online' && root.id !== 'imagens') {
            continue;
          }
          try {
            const canonical = await fs.realpath(root.path);
            const found = await checkDirectTitulosFiles(canonical, root.id, targets, {
              maxFilesPerProtocol: 8,
              skipVisualiza: root.id === 'imagens' && hasDedicatedTv,
              skipOnline: root.id === 'imagens' && hasDedicatedTo,
            });
            for (const item of found) {
              const key = `${item.rootId}:${item.relativePath.toLowerCase()}`;
              if (!titulosCruzados.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
                titulosCruzados.push(item);
              }
            }
          } catch {}
        }

        let addedCrossTitulos = 0;
        for (const item of titulosCruzados) {
          if (addedCrossTitulos >= 30 || result.files.length >= limit) {
            result.partial = true;
            break;
          }
          const key = `${item.rootId}:${item.relativePath.toLowerCase()}`;
          chavesExplicitas.add(key);
          if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
            result.files.push(item);
            addedCrossTitulos++;
          }
        }
      }
    }
  }

  // Deduplica arquivos idênticos quando raízes sobrepostas (ex.: K:\IMAGENS e K:\IMAGENS\LV2) apontam ao mesmo arquivo físico
  if (result.files.length > 1) {
    const prioridadeRoot = (id: string) =>
      id === 'livro2' || id === 'titulos_visualiza' || id === 'titulos_online'
        ? 3
        : id === 'minutas' || id === 'processos'
        ? 2
        : 1;
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

  // Ordena por relevância preservando ordem estável dentro de cada camada
  if (result.files.length > 1) {
    const queryNums = new Set<number>();
    for (const c of criterios) {
      if (
        deveConsultarFullTextSiplanIa(c.texto) &&
        !/\b(?:matr[ií]cula|transcri[çc][ãa]o|protocolo|prenota[çc][ãa]o)\b/i.test(c.texto)
      ) {
        continue;
      }
      const semProc = removerNumerosDeProcesso(c.texto);
      const dotted = semProc.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || [];
      for (const d of dotted) {
        const num = parseInt(d.replace(/\D+/g, ''), 10);
        if (Number.isFinite(num) && num > 0) queryNums.add(num);
      }
      const plain = semProc.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ').match(/\b\d{1,8}\b/g) || [];
      for (const p of plain) {
        const num = parseInt(p, 10);
        if (Number.isFinite(num) && num > 0) queryNums.add(num);
      }
    }
    const queryCentralCodes = new Set(critTituloInfo.flatMap(i => i.codigosCentral.map(c => c.toLowerCase())));
    const queriouTranscricao = criterios.some(c => /transcri[çc][ãa]o|transcr/i.test(c.texto));

    const calcularTierRelevancia = (item: DocumentMatch): number => {
      const rawExt = path.extname(item.name);
      const ext = rawExt.toLowerCase();
      const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
      const isTitulo = isTituloAcervoMatch(item.rootId, item.relativePath);
      const isLv2 = item.rootId === 'livro2' || /(?:^|[\\/])lv2[\\/]/i.test(item.relativePath);
      const isLv3 = /(?:^|[\\/])lv3[\\/]/i.test(item.relativePath);
      const isLv1 = /(?:^|[\\/])lv1[\\/]/i.test(item.relativePath);
      const baseName = rawExt ? item.name.slice(0, -rawExt.length) : item.name;
      const imgNumExact = /^\d{1,8}$/.test(baseName) ? parseInt(baseName, 10) : NaN;
      const temImgExataBuscada = !Number.isNaN(imgNumExact) && queryNums.has(imgNumExact);

      if (isKenOrTif && !isTitulo && temImgExataBuscada) {
        if ((queriouTranscricao && isLv3) || (!queriouTranscricao && isLv2)) return 0;
        if (isLv2 || isLv3 || isLv1) return 1;
      }

      if (isTitulo) {
        if (temImgExataBuscada) return 1;
        const pFolder = item.relativePath.match(/(?:^|[\\/])0*([1-9]\d{1,7})(?:-([a-z]{2,3}[a-z0-9]{4,}))?(?:[\\/]|$)/i);
        if (pFolder) {
          const folderNum = parseInt(pFolder[1], 10);
          if (queryNums.has(folderNum) || (pFolder[2] && queryCentralCodes.has(pFolder[2].toLowerCase()))) {
            return 1;
          }
        }
        const relLower = item.relativePath.toLowerCase();
        for (const code of queryCentralCodes) {
          if (relLower.includes(code)) return 1;
        }
      }

      if (queryNums.size > 0) {
        const normNameMilhares = normalize(item.name)
          .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
          .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
        for (const qn of queryNums) {
          if (new RegExp(`(^|\\D)0*${qn}(\\D|$)`).test(normNameMilhares)) {
            return 2;
          }
        }
      }

      if (isKenOrTif && !isTitulo && (isLv2 || isLv3 || isLv1)) {
        return 3;
      }

      return 4;
    };

    result.files = result.files
      .map((item, idx) => ({ item, idx, tier: calcularTierRelevancia(item) }))
      .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
      .map(v => v.item);
  }

  return result;
}

// Limite seguro (2,4 MB bruto ≈ 3,2 MB em base64) abaixo do teto de 4,5 MB das rotas serverless na nuvem
export const MAX_INLINE_PDF_BYTES = 2_516_582;
export const MAX_DOCUMENT_CHUNK_BYTES = 2_516_582;
export const MAX_STORAGE_OFFLOAD_BYTES = 48 * 1024 * 1024;
const MAX_KEN_BASE64_CHARS = 3_200_000;

export interface RenderedKenPageBuffer {
  pageNumber: number;
  pngBuffer: Buffer;
}

export interface RenderedKenBatchPayload {
  fileName: string;
  extension: string;
  size: number;
  mtimeMs: number;
  pageCount: number;
  loadedPageStart?: number;
  loadedPageEnd?: number;
  hasMorePages: boolean;
  pages: RenderedKenPageBuffer[];
}

function encodeTiffIfdToPngBuffer(buf: Buffer, page: any): Buffer {
  UTIF.decodeImage(buf, page);
  const rgba = UTIF.toRGBA8(page);
  return Buffer.from(UPNG.encode([rgba.buffer], page.width, page.height, 0));
}

export async function renderKenPagesAsPngBuffers(
  filePath: string,
  options?: { pageStart?: number; pageEnd?: number; maxPages?: number },
): Promise<RenderedKenBatchPayload> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const buf = await fs.readFile(filePath);
  const ifds = UTIF.decode(buf);
  const totalIfds = ifds.length;
  const startIdx = options?.pageStart ? Math.max(0, Math.min(totalIfds, options.pageStart - 1)) : 0;
  const maxPages = Math.max(1, Math.min(100, options?.maxPages ?? 25));
  const requestedEnd = options?.pageEnd ? Math.max(startIdx, Math.min(totalIfds, options.pageEnd)) : totalIfds;
  const maxEndIdx = Math.min(requestedEnd, startIdx + maxPages);

  const pages: RenderedKenPageBuffer[] = [];
  for (let i = startIdx; i < maxEndIdx; i++) {
    pages.push({ pageNumber: i + 1, pngBuffer: encodeTiffIfdToPngBuffer(buf, ifds[i]) });
  }

  const loadedEnd = pages.length > 0 ? startIdx + pages.length : startIdx;
  const hasMorePages = loadedEnd < totalIfds;

  return {
    fileName,
    extension: ext,
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    pageCount: totalIfds,
    loadedPageStart: pages.length > 0 ? startIdx + 1 : undefined,
    loadedPageEnd: pages.length > 0 ? loadedEnd : undefined,
    hasMorePages,
    pages,
  };
}

export type OcrWordTuple = [text: string, x: number, y: number, w: number, h: number];

export interface DocumentOcrPage {
  page: number;
  words: OcrWordTuple[];
}

export interface DocumentOcrPayload {
  fileName: string;
  pageCount: number;
  loadedPageStart: number;
  loadedPageEnd: number;
  hasMorePages: boolean;
  pages: DocumentOcrPage[];
}

interface OcrCacheEntry {
  mtimeMs: number;
  size: number;
  pageCount: number;
  pages: Map<number, OcrWordTuple[]>;
}

const OCR_CACHE_MAX_FILES = 60;
const OCR_SUPPORTED_EXTENSIONS = new Set(['.ken', '.tif', '.tiff', '.png', '.jpg', '.jpeg']);
const ocrDocumentCache = new Map<string, OcrCacheEntry>();

function getOrResetOcrCacheEntry(cacheKey: string, mtimeMs: number, size: number): OcrCacheEntry | null {
  const existing = ocrDocumentCache.get(cacheKey);
  if (!existing) return null;
  if (existing.mtimeMs !== mtimeMs || existing.size !== size) {
    ocrDocumentCache.delete(cacheKey);
    return null;
  }
  // Renova LRU
  ocrDocumentCache.delete(cacheKey);
  ocrDocumentCache.set(cacheKey, existing);
  return existing;
}

function storeOcrPagesInCache(
  cacheKey: string,
  mtimeMs: number,
  size: number,
  pageCount: number,
  pages: DocumentOcrPage[],
): void {
  let entry = getOrResetOcrCacheEntry(cacheKey, mtimeMs, size);
  if (!entry) {
    if (ocrDocumentCache.size >= OCR_CACHE_MAX_FILES) {
      const oldestKey = ocrDocumentCache.keys().next().value;
      if (oldestKey !== undefined) ocrDocumentCache.delete(oldestKey);
    }
    entry = { mtimeMs, size, pageCount, pages: new Map() };
    ocrDocumentCache.set(cacheKey, entry);
  }
  entry.pageCount = pageCount;
  for (const p of pages) {
    entry.pages.set(p.page, p.words);
  }
}

const WINRT_OCR_POWERSHELL_SCRIPT = [
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  '$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]',
  '$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]',
  '$null = [Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime]',
  '$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like "IAsyncOperation*" })[0]',
  'function Await($op, [Type]$t) { $asTaskGeneric.MakeGenericMethod($t).Invoke($null, @($op)).GetAwaiter().GetResult() }',
  '$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()',
  'if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("pt-BR")) }',
  '$job = $env:FIORIX_OCR_JOB | ConvertFrom-Json',
  'function Extract-WordsFromBitmap($bmp) {',
  '  $words = New-Object System.Collections.ArrayList',
  '  if (-not $engine -or $bmp.PixelWidth -le 0 -or $bmp.PixelHeight -le 0) { return $words }',
  '  $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])',
  '  $w = [double]$bmp.PixelWidth',
  '  $h = [double]$bmp.PixelHeight',
  '  foreach ($line in $res.Lines) {',
  '    foreach ($word in $line.Words) {',
  '      $r = $word.BoundingRect',
  '      $null = $words.Add(@([string]$word.Text, [Math]::Round($r.X / $w, 4), [Math]::Round($r.Y / $h, 4), [Math]::Round($r.Width / $w, 4), [Math]::Round($r.Height / $h, 4)))',
  '    }',
  '  }',
  '  return ,$words',
  '}',
  '$outPages = New-Object System.Collections.ArrayList',
  '$totalCount = 0',
  'if ($job.mode -eq "file") {',
  '  $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync([string]$job.filePath)) ([Windows.Storage.StorageFile])',
  '  $stream = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])',
  '  try {',
  '    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])',
  '    $totalCount = [int]$dec.FrameCount',
  '    $firstIdx = [Math]::Max(0, [int]$job.startPage - 1)',
  '    $lastIdx = [Math]::Min($totalCount - 1, [int]$job.endPage - 1)',
  '    for ($i = $firstIdx; $i -le $lastIdx; $i++) {',
  '      $frame = Await ($dec.GetFrameAsync([uint32]$i)) ([Windows.Graphics.Imaging.BitmapFrame])',
  '      $bmp = Await ($frame.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])',
  '      try {',
  '        $wlist = Extract-WordsFromBitmap $bmp',
  '        $null = $outPages.Add(@{ page = ($i + 1); words = $wlist })',
  '      } finally {',
  '        $bmp.Dispose()',
  '      }',
  '    }',
  '  } finally {',
  '    $stream.Dispose()',
  '  }',
  '} elseif ($job.mode -eq "png_dir") {',
  '  $totalCount = [int]$job.pageCount',
  '  foreach ($pNum in $job.pageNumbers) {',
  '    $pngPath = Join-Path ([string]$job.dirPath) ("$pNum.png")',
  '    $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pngPath)) ([Windows.Storage.StorageFile])',
  '    $stream = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])',
  '    try {',
  '      $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])',
  '      $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])',
  '      try {',
  '        $wlist = Extract-WordsFromBitmap $bmp',
  '        $null = $outPages.Add(@{ page = [int]$pNum; words = $wlist })',
  '      } finally {',
  '        $bmp.Dispose()',
  '      }',
  '    } finally {',
  '      $stream.Dispose()',
  '    }',
  '  }',
  '}',
  '@{ pageCount = $totalCount; pages = @($outPages) } | ConvertTo-Json -Depth 6 -Compress',
].join('\n');

function sanitizeOcrWords(rawWords: unknown): OcrWordTuple[] {
  if (!Array.isArray(rawWords)) return [];
  const words: OcrWordTuple[] = [];
  for (const w of rawWords) {
    if (!Array.isArray(w) || w.length < 5) continue;
    const text = String(w[0] ?? '').trim();
    if (!text) continue;
    const x = Math.max(0, Math.min(1, Number(w[1]) || 0));
    const y = Math.max(0, Math.min(1, Number(w[2]) || 0));
    const width = Math.max(0, Math.min(1, Number(w[3]) || 0));
    const height = Math.max(0, Math.min(1, Number(w[4]) || 0));
    words.push([text, Number(x.toFixed(4)), Number(y.toFixed(4)), Number(width.toFixed(4)), Number(height.toFixed(4))]);
  }
  return words;
}

async function runWinRtOcrScript(
  jobPayload:
    | { mode: 'file'; filePath: string; startPage: number; endPage: number }
    | { mode: 'png_dir'; dirPath: string; pageNumbers: number[]; pageCount: number },
): Promise<{ pageCount: number; pages: DocumentOcrPage[] }> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WINRT_OCR_POWERSHELL_SCRIPT],
    {
      env: { ...process.env, FIORIX_OCR_JOB: JSON.stringify(jobPayload) },
      encoding: 'utf8',
      timeout: 45_000,
      maxBuffer: 25 * 1024 * 1024,
      windowsHide: true,
    },
  );
  const rawJson = (stdout || '').trim();
  if (!rawJson) return { pageCount: 0, pages: [] };
  const parsed = JSON.parse(rawJson) as { pageCount?: number; pages?: Array<{ page?: number; words?: unknown }> };
  const pageCount = Math.max(0, Math.trunc(Number(parsed?.pageCount) || 0));
  const rawPages = Array.isArray(parsed?.pages) ? parsed.pages : parsed?.pages ? [parsed.pages] : [];
  const pages: DocumentOcrPage[] = [];
  for (const p of rawPages) {
    const pageNum = Math.trunc(Number(p?.page) || 0);
    if (pageNum <= 0) continue;
    pages.push({ page: pageNum, words: sanitizeOcrWords(p?.words) });
  }
  pages.sort((a, b) => a.page - b.page);
  return { pageCount, pages };
}

/**
 * Extrai texto com coordenadas normalizadas (`0..1`) de páginas de imagens digitalizadas (.KEN, .TIF, .PNG, .JPG).
 * Para matrículas LV2 (`.KEN`), consulta primeiro as posições já OCRizadas no SiplanIA (< 20 ms),
 * usando `Windows.Media.Ocr` (pt-BR) + `UTIF+UPNG` como fallback apenas nas páginas ausentes ou outros formatos.
 */
export async function extractDocumentOcrPages(
  filePath: string,
  options?: {
    pageStart?: number;
    pageEnd?: number;
    maxPages?: number;
    siplaniaOcrResolver?: (params: {
      numeroMatricula: number;
      pageStart: number;
      pageEnd: number;
    }) => Promise<SiplaniaOcrMatriculaResult | null>;
  },
): Promise<DocumentOcrPayload> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  const baseNameNoExt = ext ? fileName.slice(0, -ext.length) : fileName;
  const ehLv2Ken =
    ext === '.ken' &&
    /(?:^|[\\/])lv2[\\/]/i.test(filePath) &&
    /^\d{1,8}$/.test(baseNameNoExt);
  const numeroMatriculaLv2 = ehLv2Ken ? parseInt(baseNameNoExt, 10) : 0;

  if (!OCR_SUPPORTED_EXTENSIONS.has(ext) || (process.platform !== 'win32' && !options?.siplaniaOcrResolver && !ehLv2Ken)) {
    return { fileName, pageCount: 0, loadedPageStart: 0, loadedPageEnd: 0, hasMorePages: false, pages: [] };
  }

  const maxCap = ehLv2Ken ? 80 : 20;
  const defaultBatch = ehLv2Ken ? 60 : 12;
  const maxPages = Math.max(1, Math.min(maxCap, Math.trunc(options?.maxPages ?? defaultBatch)));
  const startPage = Math.max(1, Math.trunc(options?.pageStart ?? 1));
  const requestedEnd = options?.pageEnd ? Math.max(startPage, Math.trunc(options.pageEnd)) : startPage + maxPages - 1;
  const endPage = Math.min(requestedEnd, startPage + maxPages - 1);
  const cacheKey = filePath.toLowerCase();
  const mtimeMs = Math.trunc(stat.mtimeMs);

  const cached = getOrResetOcrCacheEntry(cacheKey, mtimeMs, stat.size);
  if (cached && cached.pageCount > 0) {
    const effectiveEnd = Math.min(endPage, cached.pageCount);
    if (startPage > cached.pageCount) {
      return {
        fileName,
        pageCount: cached.pageCount,
        loadedPageStart: 0,
        loadedPageEnd: 0,
        hasMorePages: false,
        pages: [],
      };
    }
    const allHit: DocumentOcrPage[] = [];
    for (let p = startPage; p <= effectiveEnd; p++) {
      const hit = cached.pages.get(p);
      if (!hit) {
        allHit.length = 0;
        break;
      }
      allHit.push({ page: p, words: hit });
    }
    if (allHit.length === effectiveEnd - startPage + 1) {
      return {
        fileName,
        pageCount: cached.pageCount,
        loadedPageStart: startPage,
        loadedPageEnd: effectiveEnd,
        hasMorePages: effectiveEnd < cached.pageCount,
        pages: allHit,
      };
    }
  }

  // Caminho rápido via SiplanIA (PostgreSQL 18 read-only) para matrículas LV2
  let siplanTotalDiskPages = 0;
  const siplanPagesMap = new Map<number, OcrWordTuple[]>();
  let fallbackStartPage = startPage;
  let fallbackEndPage = Math.min(endPage, startPage + 11);

  if (ehLv2Ken && numeroMatriculaLv2 > 0) {
    try {
      const buf = await fs.readFile(filePath);
      const ifds = UTIF.decode(buf);
      siplanTotalDiskPages = ifds.length;
    } catch {
      siplanTotalDiskPages = 0;
    }

    if (siplanTotalDiskPages > 0) {
      if (startPage > siplanTotalDiskPages) {
        return {
          fileName,
          pageCount: siplanTotalDiskPages,
          loadedPageStart: 0,
          loadedPageEnd: 0,
          hasMorePages: false,
          pages: [],
        };
      }

      const effectiveReqEnd = Math.min(endPage, siplanTotalDiskPages);
      const siplaniaResolver = options?.siplaniaOcrResolver ?? consultarPaginasOcrMatriculaSiplanIaReadOnly;
      const siplanRes = await siplaniaResolver({
        numeroMatricula: numeroMatriculaLv2,
        pageStart: startPage,
        pageEnd: effectiveReqEnd,
      }).catch(() => null);

      if (siplanRes && siplanRes.pages.size > 0) {
        for (const [pgNum, words] of siplanRes.pages.entries()) {
          if (pgNum >= startPage && pgNum <= effectiveReqEnd) {
            siplanPagesMap.set(pgNum, words);
          }
        }

        const missingPages: number[] = [];
        for (let p = startPage; p <= effectiveReqEnd; p++) {
          if (!siplanPagesMap.has(p)) missingPages.push(p);
        }

        if (missingPages.length === 0) {
          const pages = Array.from(siplanPagesMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([page, words]) => ({ page, words }));
          storeOcrPagesInCache(cacheKey, mtimeMs, stat.size, siplanTotalDiskPages, pages);
          return {
            fileName,
            pageCount: siplanTotalDiskPages,
            loadedPageStart: pages[0].page,
            loadedPageEnd: pages[pages.length - 1].page,
            hasMorePages: pages[pages.length - 1].page < siplanTotalDiskPages,
            pages,
          };
        }

        // Se o SiplanIA já tem o bloco inicial contíguo, entrega-o de imediato; caso contrário completa via WinRT até 12 páginas
        if (missingPages[0] > startPage) {
          const prefixPages = Array.from(siplanPagesMap.entries())
            .filter(([pg]) => pg >= startPage && pg < missingPages[0])
            .sort((a, b) => a[0] - b[0])
            .map(([page, words]) => ({ page, words }));
          if (prefixPages.length > 0) {
            storeOcrPagesInCache(cacheKey, mtimeMs, stat.size, siplanTotalDiskPages, prefixPages);
            return {
              fileName,
              pageCount: siplanTotalDiskPages,
              loadedPageStart: prefixPages[0].page,
              loadedPageEnd: prefixPages[prefixPages.length - 1].page,
              hasMorePages: prefixPages[prefixPages.length - 1].page < siplanTotalDiskPages,
              pages: prefixPages,
            };
          }
        }

        // Híbrido: completa apenas as páginas novas/ausentes respeitando limite de 12 páginas no WinRT
        fallbackStartPage = missingPages[0];
        fallbackEndPage = Math.min(missingPages[missingPages.length - 1], fallbackStartPage + 11);
      } else {
        fallbackStartPage = startPage;
        fallbackEndPage = Math.min(effectiveReqEnd, startPage + 11);
      }
    }
  }

  let extracted: { pageCount: number; pages: DocumentOcrPage[] } | null = null;
  if (process.platform === 'win32') {
    try {
      extracted = await runWinRtOcrScript({
        mode: 'file',
        filePath,
        startPage: fallbackStartPage,
        endPage: fallbackEndPage,
      });
    } catch {
      extracted = null;
    }
  }

  // Fallback automático com UTIF + UPNG quando o BitmapDecoder do Windows não decodifica frames do .KEN/.TIF
  if (
    process.platform === 'win32' &&
    (!extracted || (extracted.pageCount === 0 && extracted.pages.length === 0)) &&
    (ext === '.ken' || ext === '.tif' || ext === '.tiff')
  ) {
    const rendered = await renderKenPagesAsPngBuffers(filePath, {
      pageStart: fallbackStartPage,
      pageEnd: fallbackEndPage,
      maxPages: 12,
    });
    if (rendered.pageCount === 0 || rendered.pages.length === 0) {
      if (siplanPagesMap.size > 0 && siplanTotalDiskPages > 0) {
        const mergedOnlySiplan = Array.from(siplanPagesMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([page, words]) => ({ page, words }));
        storeOcrPagesInCache(cacheKey, mtimeMs, stat.size, siplanTotalDiskPages, mergedOnlySiplan);
        return {
          fileName,
          pageCount: siplanTotalDiskPages,
          loadedPageStart: mergedOnlySiplan[0].page,
          loadedPageEnd: mergedOnlySiplan[mergedOnlySiplan.length - 1].page,
          hasMorePages: mergedOnlySiplan[mergedOnlySiplan.length - 1].page < siplanTotalDiskPages,
          pages: mergedOnlySiplan,
        };
      }
      return {
        fileName,
        pageCount: rendered.pageCount,
        loadedPageStart: 0,
        loadedPageEnd: 0,
        hasMorePages: false,
        pages: [],
      };
    }
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiorix-ocr-'));
    try {
      const pageNumbers: number[] = [];
      await Promise.all(
        rendered.pages.map(async (p) => {
          pageNumbers.push(p.pageNumber);
          await fs.writeFile(path.join(tmpDir, `${p.pageNumber}.png`), p.pngBuffer);
        }),
      );
      pageNumbers.sort((a, b) => a - b);
      extracted = await runWinRtOcrScript({
        mode: 'png_dir',
        dirPath: tmpDir,
        pageNumbers,
        pageCount: rendered.pageCount,
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const finalPageCount = Math.max(siplanTotalDiskPages, extracted?.pageCount ?? 0);
  const mergedMap = new Map<number, OcrWordTuple[]>(siplanPagesMap);
  for (const p of extracted?.pages || []) {
    if (!mergedMap.has(p.page)) {
      mergedMap.set(p.page, p.words);
    }
  }

  if (finalPageCount === 0 || mergedMap.size === 0) {
    return {
      fileName,
      pageCount: finalPageCount,
      loadedPageStart: 0,
      loadedPageEnd: 0,
      hasMorePages: false,
      pages: [],
    };
  }

  const finalPages = Array.from(mergedMap.entries())
    .sort((a, b) => a[0] - b[0])
    .filter(([pg]) => pg >= fallbackStartPage || siplanPagesMap.has(pg))
    .map(([page, words]) => ({ page, words }));
  storeOcrPagesInCache(cacheKey, mtimeMs, stat.size, finalPageCount, finalPages);
  const loadedPageStart = finalPages[0].page;
  const loadedPageEnd = finalPages[finalPages.length - 1].page;
  return {
    fileName,
    pageCount: finalPageCount,
    loadedPageStart,
    loadedPageEnd,
    hasMorePages: loadedPageEnd < finalPageCount,
    pages: finalPages,
  };
}

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
  storagePath?: string;
  pageStoragePaths?: string[];
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
        const pngBuf = encodeTiffIfdToPngBuffer(buf, ifds[i]);
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
        html: `<p>Não foi possível carregar o arquivo PDF ${escapeHtmlEntities(fileName)}.</p>`,
        text: `[Erro ao carregar PDF ${fileName}]`,
      };
    }
  }

  // 3. Minutas em Word DOCX (.docx)
  if (ext === '.docx') {
    try {
      const htmlResult = await mammoth.convertToHtml({ path: filePath });
      const textResult = await mammoth.extractRawText({ path: filePath });
      const safeText = textResult.value || '';
      return {
        fileName,
        extension: ext,
        html: sanitizeDocumentHtml(htmlResult.value, safeText),
        text: safeText,
        size: stat.size,
      };
    } catch {
      const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
      return {
        fileName,
        extension: ext,
        html: plainTextToSafeHtml(raw),
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
      const html = `<div>${plainTextToSafeHtml(text)}</div>`;
      return {
        fileName,
        extension: ext,
        html,
        text: text || '',
        size: stat.size,
      };
    } catch {
      try {
        const htmlResult = await mammoth.convertToHtml({ path: filePath });
        const textResult = await mammoth.extractRawText({ path: filePath });
        const safeText = textResult.value || '';
        return {
          fileName,
          extension: ext,
          html: sanitizeDocumentHtml(htmlResult.value, safeText),
          text: safeText,
          size: stat.size,
        };
      } catch {
        const raw = await fs.readFile(filePath, 'latin1').catch(() => '');
        const clean = raw.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ');
        return {
          fileName,
          extension: ext,
          html: `<p>${escapeHtmlEntities(clean)}</p>`,
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
    html: `<pre>${escapeHtmlEntities(raw)}</pre>`,
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
  let limpo = valor
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove pontuações iniciais e traços
  limpo = limpo.replace(/^[\s\-–—:;."']+|[\s\-–—:;."']+$/g, '').trim();

  // Remove prefixos direcionais redundantes caso venham no texto capturado
  limpo = limpo.replace(/^(?:pelo\s+lado\s+direito|do\s+lado\s+direito|ao\s+lado\s+direito|lado\s+direito|pela\s+direita|à\s+direita|a\s+direita|direita)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|ao\s+lado\s+esquerdo|lado\s+esquerdo|pela\s+esquerda|à\s+esquerda|a\s+esquerda|esquerda)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos|fundos)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^[:\s\-–—]+/, '').trim();

  // Remove cláusulas intermediárias de ponto de vista ("de quem da rua olha para o imóvel, confronta com...")
  limpo = limpo.replace(
    /^(?:de\s+quem\s+(?:da\s+rua|do\s+im[óo]vel|de\s+frente|de\s+dentro|da\s+via\s+p[úu]blica)\s+olha\s+(?:para\s+)?(?:o\s+im[óo]vel|a\s+rua|o\s+terreno|o\s+lote)[,\s]*)/i,
    '',
  ).trim();
  limpo = limpo.replace(
    /^(?:mede\s+[0-9.,]+\s*(?:m|metros|ms)?(?:\s+da\s+frente\s+aos\s+fundos)?[,\s]*(?:e\s+)?)/i,
    '',
  ).trim();
  limpo = limpo.replace(
    /^(?:confronta(?:ndo)?(?:\s+com|\s+como)?|confina(?:ndo)?(?:\s+com)?|divide(?:\s+com)?|limita(?:-se)?(?:\s+com)?|com\s+o\s+im[óo]vel|como\s+im[óo]vel|com|como|:)\s*/i,
    (m) => (/im[óo]vel/i.test(m) ? 'com o imóvel ' : ''),
  ).trim();

  // Remove menções subsequentes a outras direções ou rodapés de página do TJSP
  limpo = limpo.replace(
    /\s+(?:,\s*)?(?:[234]\.\s*(?:ao\s+lado|a\s+frente|aos\s+fundos)|pelo\s+lado|do\s+lado|ao\s+lado|e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|e\s+fundos|\bfundos\b|lado\s+esquerdo|lado\s+direito|à\s+esquerda|à\s+direita|processo\s+\d{7}-\d{2}|para\s+conferir\s+o\s+original).*$/i,
    '',
  ).trim();

  // Remove traços ou pontuações finais remanescentes
  limpo = limpo.replace(/[\s\-–—:;.,]+$/, '').trim();

  if (!limpo || /^de\s+quem\s+da\s+rua/i.test(limpo)) return '';

  // Padroniza com 'com ' se não iniciar com 'com '
  if (!/^com\b/i.test(limpo)) {
    limpo = `com ${limpo}`;
  }
  return limpo;
}

export function extrairConfrontacoes(texto: string): ConfrontacoesExtraidas {
  if (!texto) return { ladoDireito: '', ladoEsquerdo: '', fundos: '' };

  const norm = texto
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ');

  let ladoDireito = '';
  let ladoEsquerdo = '';
  let fundos = '';

  const prefixoOlhar = `(?:de\\s+quem\\s+(?:da\\s+rua|do\\s+im[óo]vel|de\\s+frente|de\\s+dentro)\\s+olha\\s+(?:para\\s+)?(?:o\\s+im[óo]vel|a\\s+rua|o\\s+terreno)[,\\s]*)?`;
  const prefixoMedida = `(?:mede\\s+[0-9.,]+\\s*(?:m|metros|ms)?(?:\\s+da\\s+frente\\s+aos\\s+fundos)?[,\\s]*(?:e\\s+)?)?`;
  const prefixoVerbo = `(?:confronta(?:ndo)?(?:\\s+com|\\s+como)?|confina(?:ndo)?(?:\\s+com)?|divide(?:\\s+com)?|limita(?:-se)?(?:\\s+com)?|com|como|:)?`;

  // 1. Lado Direito
  const regexDir = new RegExp(
    `(?:pelo\\s+lado\\s+direito|do\\s+lado\\s+direito|ao\\s+lado\\s+direito|lado\\s+direito|pela\\s+direita|à\\s+direita|a\\s+direita|\\bdireito\\b)\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;]{2,160}?)(?=(?:,\\s*(?:pelo\\s+lado|do\\s+lado|ao\\s+lado|pela\\s+esquerda|e\\s+aos|aos\\s+fundos|e\\s+pelos|e\\s+nos|lado\\s+esquerdo|esquerdo|à\\s+esquerda)|;\\s*|\\.(?:\\s+[A-Z0-9]|$)|\\s+[234]\\.\\s+|$))`,
    'i',
  );
  const matchDir = norm.match(regexDir);
  if (matchDir && matchDir[1]) {
    ladoDireito = limparConfrontante(matchDir[1]);
  }
  if (!ladoDireito) {
    const invDir = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:da\s+direita|do\s+lado\s+direito|lado\s+direito)\s*\)/i);
    if (invDir && invDir[1]) ladoDireito = limparConfrontante(invDir[1]);
  }

  // 2. Lado Esquerdo
  const regexEsq = new RegExp(
    `(?:pelo\\s+lado\\s+esquerdo|do\\s+lado\\s+esquerdo|ao\\s+lado\\s+esquerdo|lado\\s+esquerdo|pela\\s+esquerda|à\\s+esquerda|a\\s+esquerda|\\besquerdo\\b)\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;]{2,160}?)(?=(?:,\\s*(?:pelo\\s+lado|do\\s+lado|ao\\s+lado|e\\s+aos|aos\\s+fundos|e\\s+pelos|e\\s+nos|e\\s+fundos|fundos)|;\\s*|\\s+e\\s+(?:aos\\s+|nos\\s+|pelos\\s+)?fundos|\\.(?:\\s+[A-Z0-9]|$)|\\s+[34]\\.\\s+|$))`,
    'i',
  );
  const matchEsq = norm.match(regexEsq);
  if (matchEsq && matchEsq[1]) {
    ladoEsquerdo = limparConfrontante(matchEsq[1]);
  }
  if (!ladoEsquerdo) {
    const invEsq = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:da\s+esquerda|do\s+lado\s+esquerdo|lado\s+esquerdo)\s*\)/i);
    if (invEsq && invEsq[1]) ladoEsquerdo = limparConfrontante(invEsq[1]);
  }

  // 3. Fundos
  const regexFundos = new RegExp(
    `(?:e\\s+aos\\s+fundos|aos\\s+fundos|e\\s+nos\\s+fundos|nos\\s+fundos|e\\s+pelos\\s+fundos|pelos\\s+fundos|e\\s+fundos|\\bfundos\\b(?=\\s*(?::|com\\b|confronta|confina|divide|mede)))\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;.]{2,160}?)(?=(?:;\\s*|\\.(?:\\s|$)|$))`,
    'i',
  );
  const matchFundos = norm.match(regexFundos);
  if (matchFundos && matchFundos[1]) {
    fundos = limparConfrontante(matchFundos[1]);
  }
  if (!fundos) {
    const invFundos = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:dos\s+fundos|de\s+fundos|fundos)\s*\)/i);
    if (invFundos && invFundos[1]) fundos = limparConfrontante(invFundos[1]);
  }

  return { ladoDireito, ladoEsquerdo, fundos };
}

async function lerTextoCacheOcrRecente(filePath: string, numeroProcesso?: string): Promise<string> {
  const chunks: string[] = [];
  try {
    const tmpDir = os.tmpdir();
    const entries = await fs.readdir(tmpDir);
    const cacheFiles = entries.filter(n => /^fiorix_ocr_peticao_[0-9a-f]+\.json$/i.test(n));
    const stats = await Promise.all(
      cacheFiles.map(async name => {
        try {
          const full = path.join(tmpDir, name);
          const st = await fs.stat(full);
          return { full, mtimeMs: st.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    const valid = stats.filter((x): x is { full: string; mtimeMs: number } => Boolean(x));
    valid.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const cnjDigits = (numeroProcesso || '').replace(/[^\d]/g, '');

    for (const item of valid.slice(0, 6)) {
      try {
        const raw = await fs.readFile(item.full, 'utf8');
        if (cnjDigits && cnjDigits.length >= 15 && !raw.replace(/[^\d]/g, '').includes(cnjDigits.slice(0, 13))) {
          // Se não é o cache recém-gerado nos últimos 45s e não contém o CNJ do processo, ignora
          if (Date.now() - item.mtimeMs > 45_000) continue;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.paginas === 'object') {
          const pageNums = Object.keys(parsed.paginas)
            .map(k => parseInt(k, 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
          for (const p of pageNums) {
            chunks.push(`[Pág. ${p}] ${String(parsed.paginas[String(p)] || '')}`);
          }
          if (chunks.length > 0) break;
        }
      } catch {}
    }
  } catch {}

  if (chunks.length === 0 && filePath.toLowerCase().endsWith('.pdf')) {
    try {
      const handle = await fs.open(filePath, 'r');
      const buf = Buffer.alloc(Math.min(512 * 1024, (await handle.stat()).size));
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      await handle.close();
      const rawLatin = buf.subarray(0, bytesRead).toString('latin1');
      const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = streamRegex.exec(rawLatin)) !== null && count < 25) {
        count++;
        try {
          const decomp = zlib.inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
          chunks.push(decomp);
        } catch {}
      }
    } catch {}
  }

  return chunks.join('\n');
}

export function ehEnderecoTimbreInstitucional(texto?: unknown): boolean {
  if (typeof texto !== 'string' || !texto) return false;
  const v = texto.replace(/\s+/g, ' ').trim();
  if (!v) return false;
  return (
    /rua\s+augusta[,\s]+(?:n[ºo°.]?\s*)?356\b/i.test(v) ||
    /\b(?:3218-0527|01304-000)\b/i.test(v) ||
    /\bav(?:enida|\.)?\s+(?:da\s+)?liberdade[,\s]+(?:n[ºo°.]?\s*)?32\b/i.test(v) ||
    /\b01502-000\b/i.test(v) ||
    /\bdefensoria\.sp\.def\.br\b/i.test(v) ||
    /\bunidade\s+c[íi]vel\s+central\s+da\s+capital\b/i.test(v) ||
    /\brua\s+boa\s+vista[,\s]+(?:n[ºo°.]?\s*)?(?:103|150|200)\b/i.test(v) ||
    /\brua\s+l[íi]bero\s+badar[óo][,\s]+(?:n[ºo°.]?\s*)?613\b/i.test(v) ||
    /\b(?:pra[çc]a|f[óo]rum)\s+jo[ãa]o\s+mendes\b/i.test(v) ||
    /\bviaduto\s+dona\s+paulina\b/i.test(v) ||
    /\brua\s+conde\s+de\s+sarzedas\b/i.test(v) ||
    /\brua\s+riachuelo[,\s]+(?:n[ºo°.]?\s*)?115\b/i.test(v) ||
    /\bviaduto\s+do\s+ch[áa][,\s]+(?:n[ºo°.]?\s*)?15\b/i.test(v)
  );
}

export function sanitizarDescricaoImovel(imovel?: unknown): string {
  if (typeof imovel !== 'string' || !imovel) return '';
  let limpo = imovel
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpo) return '';

  limpo = limpo
    .replace(
      /\s*(?:\b\d+\s+)?(?:[_\-.\s]*[ªº°]\s*VARA\b|\b\d+\s*VARA\b|\b[_\-]{2,}\s*[ªº°]?\s*VARA\b|\bVARA\s+(?:DE\s+REGISTROS\s+P[ÚU]BLICOS|C[ÍI]VEL|DA\s+FAZENDA|DE\s+FAM[ÍI]LIA|DO\s+JUIZADO|FEDERAL|CRIMINAL|EMPRESARIAL|[ÚU]NICA|DISTRITAL))[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*\b(?:EXCELENT[ÍI]SSIM[OA]|EXM[OA]\.?\s*SR|MERIT[ÍI]SSIM[OA]|MM\.?\s*JUIZ|DOUTOR[A]?\s+JUIZ|AO\s+JU[ÍI]ZO|JU[ÍI]ZO\s+DE\s+DIREITO|FORO\s+(?:CENTRAL|REGIONAL)|COMARCA\s+(?:DA\s+CAPITAL|DE\s+S[ÃA]O\s+PAULO)|UNIDADE\s+C[ÍI]VEL|DEFENSORIA\s+P[ÚU]BLICA|MINIST[ÉE]RIO\s+P[ÚU]BLICO|TRIBUNAL\s+DE\s+JUSTI[ÇC]A|PODER\s+JUDICI[ÁA]RIO)[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*(?:https?:\/\/\S+|www\.\S+|\b\S+\.(?:def|jus|gov|org|adv|com)\.br\S*)[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*\b(?:PROCESSO\s+(?:DIGITAL\s+|N[ºO°.]?\s*)?\d{7}-\d{2}|PARA\s+CONFERIR\s+O\s+ORIGINAL|ESTE\s+DOCUMENTO\s+[ÉE]\s+C[ÓO]PIA|ASSINADO\s+DIGITALMENTE)[\s\S]*$/i,
      '',
    )
    .replace(/[\s,;:\-–—/]+$/, '')
    .trim();

  if (/\bvara\b/i.test(limpo)) {
    limpo = limpo
      .replace(/\s*(?:\b\d+\s*)?[_\-.\sªº°]*\bvara\b[\s\S]*$/i, '')
      .replace(/[\s,;:\-–—/]+$/, '')
      .trim();
  }

  if (!limpo) return '';

  if (ehEnderecoTimbreInstitucional(limpo) || ehEnderecoTimbreInstitucional(imovel)) {
    const contemLogradouroInstitucional =
      /\b(?:rua\s+augusta|av(?:enida|\.)?\s+(?:da\s+)?liberdade|rua\s+boa\s+vista|rua\s+l[íi]bero\s+badar[óo]|pra[çc]a\s+jo[ãa]o\s+mendes|viaduto\s+dona\s+paulina|rua\s+conde\s+de\s+sarzedas|rua\s+riachuelo|viaduto\s+do\s+ch[áa])\b/i.test(
        limpo,
      );
    if (contemLogradouroInstitucional) return '';
  }

  if (
    /^(?:im[óo]vel(?:\s+usucapiendo)?(?:\s+situado|\s+localizado)?(?:\s+[àa]|\s+na|\s+no)?|situado\s+[àa]|localizado\s+na)$/i.test(
      limpo,
    )
  ) {
    return '';
  }

  return limpo;
}

export function sanitizarLogradouroConfrontacao(rua?: unknown, imovelOriginal?: unknown): string {
  if (typeof rua !== 'string' || !rua) return '';
  const limpo = sanitizarDescricaoImovel(rua);
  if (!limpo) return '';

  const ehRuaInstitucionalSemNumero =
    /^(?:rua\s+augusta|av(?:enida|\.)?\s+(?:da\s+)?liberdade|rua\s+boa\s+vista|rua\s+l[íi]bero\s+badar[óo]|pra[çc]a\s+jo[ãa]o\s+mendes|viaduto\s+dona\s+paulina|rua\s+conde\s+de\s+sarzedas|rua\s+riachuelo|viaduto\s+do\s+ch[áa])$/i.test(
      limpo.trim(),
    );

  if (ehRuaInstitucionalSemNumero && !sanitizarDescricaoImovel(imovelOriginal)) {
    return '';
  }
  return limpo;
}

export function extrairImovelDoTextoAutos(texto?: string | null): { imovel: string; rua: string } {
  if (!texto) return { imovel: '', rua: '' };
  const norm = texto
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ');

  const padroes = [
    /\b(?:im[óo]vel\s+(?:usucapiendo|objeto\s+da\s+presente|objeto\s+desta|em\s+quest[ãa]o|consistente)[^.;]{0,60}?(?:situado|localizado)\s+(?:na|no|[àa])\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^.;]{5,180})/gi,
    /\b(?:(?:im[óo]vel|terreno|pr[ée]dio|casa)\s+(?:situad[oa]|localizad[oa])\s+(?:na|no|[àa])\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^.;]{5,180})/gi,
    /\b(?:casa\s+que\s+recebeu\s+o\s+n[ºo°.]?\s*\d+\s+da\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Viela|Estrada)\s+[^.;,]{2,120}(?:,\s*com\s+a\s+[áa]rea\s+[^.;]{3,80})?)/gi,
  ];

  for (const regex of padroes) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(norm)) !== null) {
      const candidato = sanitizarDescricaoImovel(m[0]);
      if (candidato && candidato.length >= 12) {
        const ruaMatch = candidato.match(
          /\b((?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^,.;]+(?:\s*,\s*n[ºo°.]?\s*\d+[A-Za-z0-9\-]*)?)/i,
        );
        const rua = ruaMatch ? sanitizarLogradouroConfrontacao(ruaMatch[1], candidato) : '';
        return {
          imovel: /^im[óo]vel/i.test(candidato) ? candidato : `Imóvel: ${candidato}`,
          rua,
        };
      }
    }
  }

  return { imovel: '', rua: '' };
}

export function enrichPetitionData(
  data: Record<string, any>,
  relativePath?: string,
  extraFullText?: string,
): Record<string, any> {
  const result = { ...data };

  // Limpa ruídos comuns capturados pelo OCR em ofícios de resposta do próprio 7º RI e timbres institucionais (ex.: Defensoria Pública)
  if (typeof result.requerente === 'string' && result.requerente) {
    result.requerente = result.requerente
      .replace(/\s+(?:USUCAPI[ÃA]O|MERIT[ÍI]SSIM[OA]|MM\.?\s*JUIZ[A]?|EXCELENT[ÍI]SSIM[OA]|DOUTOR[A]?\s+JUIZ[A]?).*$/i, '')
      .trim();
  }
  const imovelOriginal = result.imovel;
  result.imovel = sanitizarDescricaoImovel(result.imovel);
  result.rua_olhar_confrontacao = sanitizarLogradouroConfrontacao(result.rua_olhar_confrontacao, imovelOriginal);
  if (Array.isArray(result.origem_campos)) {
    result.origem_campos = result.origem_campos.map((o: any) =>
      o?.campo === 'imovel' && o.trecho
        ? { ...o, trecho: sanitizarDescricaoImovel(o.trecho) }
        : o,
    );
  }
  if (!result.imovel && extraFullText) {
    const rec = extrairImovelDoTextoAutos(extraFullText);
    if (rec.imovel) result.imovel = rec.imovel;
    if (!result.rua_olhar_confrontacao && rec.rua) result.rua_olhar_confrontacao = rec.rua;
  }

  if ((!result.numero_processo || !String(result.numero_processo).trim()) && relativePath) {
    const cnjMatch = relativePath.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (cnjMatch) result.numero_processo = cnjMatch[1];
  }

  const origensTxt = Array.isArray(result.origem_campos)
    ? result.origem_campos.map((o: any) => o?.trecho || '').join(' ')
    : '';

  if (!result.vara || !String(result.vara).trim()) {
    const varaMatch = (origensTxt + ' ' + (extraFullText || '')).match(
      /(\d{1,2}\s*[ªaº°]?\s*Vara(?:\s+(?:C[íi]vel|de\s+Registros\s+P[úu]blicos|da\s+Fazenda\s+P[úu]blica))?(?:\s+(?:da\s+Comarca\s+)?de\s+[A-ZÀ-Úa-zà-ú\s]{3,25})?)/i,
    );
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
    origensTxt,
    extraFullText,
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

  // Confrontações do Imóvel (Petição Inicial e Matrícula/Certidão nos autos)
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

  if (Array.isArray(result.origem_campos)) {
    const pgPadrao = Number(result.pagina_inicial_detectada) || 1;
    const adicionarOrigem = (campo: string, valor: string) => {
      if (!valor || result.origem_campos.some((o: any) => o?.campo === campo)) return;
      result.origem_campos.push({
        campo,
        pagina: pgPadrao,
        trecho: `[Petição Inicial / Matrícula nos Autos] ${valor}`,
        confianca: 'alta',
      });
    };
    adicionarOrigem('confrontante_lado_direito', result.confrontante_lado_direito);
    adicionarOrigem('confrontante_lado_esquerdo', result.confrontante_lado_esquerdo);
    adicionarOrigem('confrontante_fundos', result.confrontante_fundos);
  }

  // Preenche o campo Conferência e Anotações com as confrontações apuradas caso esteja em branco
  if (!result.anotacoes_ficha_oficial || !String(result.anotacoes_ficha_oficial).trim()) {
    const linhasConfrontacao: string[] = [];
    if (result.rua_olhar_confrontacao) {
      linhasConfrontacao.push(`• Frente (Logradouro): ${result.rua_olhar_confrontacao}`);
    }
    if (result.confrontante_lado_direito) {
      linhasConfrontacao.push(`• Lado Direito: ${result.confrontante_lado_direito}`);
    }
    if (result.confrontante_lado_esquerdo) {
      linhasConfrontacao.push(`• Lado Esquerdo: ${result.confrontante_lado_esquerdo}`);
    }
    if (result.confrontante_fundos) {
      linhasConfrontacao.push(`• Fundos: ${result.confrontante_fundos}`);
    }
    if (linhasConfrontacao.length > 0) {
      result.anotacoes_ficha_oficial = `CONFRONTAÇÕES APURADAS (PETIÇÃO INICIAL / MATRÍCULA):\n${linhasConfrontacao.join('\n')}`;
    }
  }

  if (result.matricula_transcricao) {
    result.matricula_transcricao = String(result.matricula_transcricao)
      .replace(/(^|[^\d.])(?:0+\.)*0+([1-9]\d*)/g, '$1$2')
      .trim();
    if (relativePath) registrarMatriculaNoCache(relativePath, String(result.matricula_transcricao));
    if (result.numero_processo) registrarMatriculaNoCache(String(result.numero_processo), String(result.matricula_transcricao));
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
    const textoCache = await lerTextoCacheOcrRecente(filePath, cliResult?.numero_processo);
    return enrichPetitionData(cliResult, relativePath, textoCache);
  } catch (firstErr) {
    // Se o PDF for grande e não havia recorte de páginas explícito, tenta apenas as 18 páginas iniciais
    if (!options?.pageStart && !options?.pageEnd) {
      try {
        const retryResult = (await executeDocumentCli('extrair-peticao', filePath, {
          pageStart: 1,
          pageEnd: 18,
          timeoutMs: 60000,
        })) as Record<string, any>;
        const textoCache = await lerTextoCacheOcrRecente(filePath, retryResult?.numero_processo);
        return enrichPetitionData(retryResult, relativePath, textoCache);
      } catch {
        // segue para fallback em JS puro abaixo
      }
    }

    // Fallback resiliente em JS puro: nunca bloqueia a abertura do formulário de Manifestação
    const cnjMatch = relativePath.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    const numProcesso = cnjMatch ? cnjMatch[1] : '';
    const matDetectada = extrairNumeroMatricula(relativePath) || '';
    const textoCache = await lerTextoCacheOcrRecente(filePath, numProcesso);
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
    return enrichPetitionData(fallbackData, relativePath, textoCache);
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
  titulos_visualiza: 'Título Visualiza (K:\\TITULOS-VISUALIZA)',
  titulos_online: 'Títulos Online (K:\\Titulos_Online)',
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

