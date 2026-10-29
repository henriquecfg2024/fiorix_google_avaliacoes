import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import mammoth from 'mammoth';

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

export async function resolveAuthorizedFile(
  roots: DocumentRoot[],
  rootId: string,
  relativePath: string,
): Promise<string> {
  const root = roots.find(r => r.id === rootId);
  if (!root) throw new Error('Pasta não autorizada.');
  const canonicalRoot = await fs.realpath(root.path);
  const target = path.resolve(canonicalRoot, relativePath);
  const canonicalTarget = await fs.realpath(target);
  if (!isWithinRoot(canonicalRoot, canonicalTarget)) {
    throw new Error('Acesso fora da pasta autorizada negado.');
  }
  return canonicalTarget;
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

// Localização direta e ultrarrápida de imagens de matrículas no padrão do 7º RI (K:\IMAGENS\LV2).
// Todas as matrículas no acervo do Livro 2 são arquivos .KEN de 8 dígitos divididos em blocos de 1.000.
export async function checkDirectMatriculaFiles(
  canonicalRoot: string,
  rootId: string,
  query: string,
): Promise<DocumentMatch[]> {
  const matches: DocumentMatch[] = [];
  const numbersToTry = new Set<number>();

  // 1. Se contiver número formatado com pontos (ex: "123.456", "45.890"), extrai o número unificado sem quebrar nos pontos
  const formattedMatches = query.match(/\b\d{1,3}(?:\.\d{3})+(?:-\d+)?\b/g);
  if (formattedMatches) {
    for (const f of formattedMatches) {
      const num = parseInt(f.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num > 0) numbersToTry.add(num);
    }
  }

  // 2. Extrai número completo desconsiderando pontos e traços (ex: "123.456" -> 123456, "45.890" -> 45890)
  const fullDigits = query.replace(/[^\d]/g, '');
  if (fullDigits.length >= 2 && fullDigits.length <= 8) {
    numbersToTry.add(parseInt(fullDigits, 10));
  }

  // 3. Extrai sequências isoladas de 3 a 8 dígitos caso a consulta contenha outros termos NÃO separados por pontos
  const unpunctQuery = query.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ');
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
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (terms.join(' ').length < 2 || query.length > 120 || limit < 1 || limit > 100) throw new Error('Pesquisa inválida.');
  const result: DocumentSearchResult = { files: [], partial: false, unavailableRoots: [] };
  let visited = 0;
  const deadline = Date.now() + budget.timeoutMs;
  for (const root of roots) {
    let canonical: string;
    try { canonical = await fs.realpath(root.path); }
    catch { result.unavailableRoots.push(root.id); result.partial = true; continue; }

    // 1. Busca direta ultrarrápida para matrículas .KEN (resolve K:\IMAGENS\LV2 em poucos ms)
    let directCount = 0;
    try {
      const directMatches = await checkDirectMatriculaFiles(canonical, root.id, query);
      for (const m of directMatches) {
        const key = `${m.rootId}:${m.relativePath.toLowerCase()}`;
        if (!result.files.some(f => `${f.rootId}:${f.relativePath.toLowerCase()}` === key)) {
          result.files.push(m);
          directCount++;
        }
      }
    } catch {}

    // Se este root for o acervo de imagens e já localizamos arquivos diretos .KEN no Livro 2,
    // evitamos varredura pesada de 50.000 diretórios na rede SMB
    if (directCount > 0 && (root.id === 'imagens' || root.id === 'livro2')) {
      continue;
    }

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
          const cleanRel = normRel.replace(/[.\-/]/g, '');
          const matches = terms.every(term => {
            if (normRel.includes(term)) return true;
            const cleanTerm = term.replace(/[.\-/]/g, '');
            return cleanTerm.length >= 2 && cleanRel.includes(cleanTerm);
          }) || (terms.length > 1 && terms.some(term => {
            if (term.length >= 3) {
              if (normRel.includes(term)) return true;
              const cleanTerm = term.replace(/[.\-/]/g, '');
              return cleanTerm.length >= 3 && cleanRel.includes(cleanTerm);
            }
            return false;
          }));
          if (!matches) continue;

          // Validação canônica e stat apenas para arquivos que realmente correspondem aos filtros
          const resolved = await fs.realpath(filePath);
          if (!isWithinRoot(canonical, resolved)) continue;
          const info = await fs.stat(filePath);

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

export async function readDocumentText(filePath: string): Promise<{
  fileName: string;
  extension: string;
  html: string;
  text: string;
  size: number;
}> {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (ext === '.ken' || ext === '.tif' || ext === '.tiff') {
    return {
      fileName,
      extension: ext,
      html: `<div style="text-align: center; padding: 30px; font-family: sans-serif;">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #0284c7;">
          Imagem Digitalizada da Matrícula (Livro 2 – Registro Geral)
        </div>
        <div style="font-family: monospace; font-size: 14px; color: #334155; margin-bottom: 12px;">
          ${fileName} &bull; ${Math.round(stat.size / 1024)} KB
        </div>
        <div style="font-size: 12px; color: #64748b; max-width: 500px; margin: 0 auto; line-height: 1.5;">
          Arquivo no padrão oficial de imagens <strong>Wang TIFF / Kenta (.KEN)</strong>.<br/>
          Armazenado no servidor do cartório em <code>K:\\IMAGENS\\LV2</code>.
        </div>
      </div>`,
      text: `[Imagem Digitalizada da Matrícula: ${fileName} (Formato Wang TIFF/KEN)]`,
      size: stat.size,
    };
  }

  if (ext === '.docx' || ext === '.doc') {
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
  const { value: text } = await mammoth.extractRawText({ path: filePath });

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

