import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import { isExportacaoElegivelComprovante } from '@/components/reurb/reurb-ui-helpers';
import { buildNomeArquivoComprovantePdf } from '@/components/reurb/reurb-comprovante-pdf';

export interface FsWritableFileStream {
  write: (data: BufferSource | Blob | string) => Promise<void>;
  close: () => Promise<void>;
}

export interface FsFileHandle {
  kind: 'file';
  name: string;
  createWritable: () => Promise<FsWritableFileStream>;
}

export interface FsDirectoryHandle {
  kind: 'directory';
  name: string;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FsDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FsFileHandle>;
  values: () => AsyncIterable<FsDirectoryHandle | FsFileHandle>;
}

export type ReurbBatchMode = 'comprovantes' | 'jsons' | 'ambos';

export interface ReurbBatchProgress {
  atual: number;
  total: number;
  arquivoAtual: string;
}

export type ReurbBatchItemStatus =
  | 'salvo'
  | 'ignorado_existente'
  | 'sem_pasta'
  | 'sem_data_registro'
  | 'nao_elegivel'
  | 'erro';

export interface ReurbBatchItemResult {
  exportacaoId: string;
  tipoArquivo: 'JSON' | 'PDF';
  arquivo: string | null;
  pastaDestino: string | null;
  status: ReurbBatchItemStatus;
  detalhe?: string;
}

export interface ReurbBatchSummary {
  mode: ReurbBatchMode;
  rootDirName: string;
  totalOperacoes: number;
  salvos: number;
  ignoradosExistentes: number;
  semPasta: number;
  semDataRegistro: number;
  naoElegiveis: number;
  erros: number;
  pastasAusentes: string[];
  detalhes: ReurbBatchItemResult[];
}

const MESES_PADRAO: Array<{ mes: number; nome: string; pastaPadrao: string }> = [
  { mes: 1, nome: 'JANEIRO', pastaPadrao: '01-JANEIRO' },
  { mes: 2, nome: 'FEVEREIRO', pastaPadrao: '02-FEVEREIRO' },
  { mes: 3, nome: 'MARCO', pastaPadrao: '03-MARÇO' },
  { mes: 4, nome: 'ABRIL', pastaPadrao: '04-ABRIL' },
  { mes: 5, nome: 'MAIO', pastaPadrao: '05-MAIO' },
  { mes: 6, nome: 'JUNHO', pastaPadrao: '06-JUNHO' },
  { mes: 7, nome: 'JULHO', pastaPadrao: '07-JULHO' },
  { mes: 8, nome: 'AGOSTO', pastaPadrao: '08-AGOSTO' },
  { mes: 9, nome: 'SETEMBRO', pastaPadrao: '09-SETEMBRO' },
  { mes: 10, nome: 'OUTUBRO', pastaPadrao: '10-OUTUBRO' },
  { mes: 11, nome: 'NOVEMBRO', pastaPadrao: '11-NOVEMBRO' },
  { mes: 12, nome: 'DEZEMBRO', pastaPadrao: '12-DEZEMBRO' },
];

/** Normaliza nome de pasta removendo acentos, espaços extras e caixa alta/baixa. */
export function normalizeFolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function detectExplicitMonthInFolderName(normalizedName: string): number | null {
  for (const item of MESES_PADRAO) {
    const tokenRegex = new RegExp(`(^|[^A-Z])${item.nome}([^A-Z]|$)`);
    if (tokenRegex.test(normalizedName)) {
      return item.mes;
    }
  }
  return null;
}

/**
 * Encontra a subpasta mensal existente que corresponde a `mes` (1..12).
 * Prioriza o nome do mês antes do prefixo numérico para tratar corretamente
 * casos reais como `09-NOVEMBRO` (mês 11) convivendo com `09-SETEMBRO` (mês 9).
 */
export function matchExistingMonthFolderName(folderNames: string[], mes: number): string | null {
  const mesInfo = MESES_PADRAO.find((item) => item.mes === mes);
  if (!mesInfo) return null;

  const normalizedEntries = folderNames.map((original) => ({
    original,
    normalized: normalizeFolderName(original),
  }));

  // 1. Correspondência exata ou por nome explícito do mês (ex.: "09-NOVEMBRO" -> 11)
  for (const entry of normalizedEntries) {
    if (detectExplicitMonthInFolderName(entry.normalized) === mes) {
      return entry.original;
    }
  }

  // 2. Fallback por prefixo numérico apenas quando a pasta não contém o nome de outro mês
  const prefixRegex = new RegExp(`^0?${mes}(?:[-_\\s]|$)`);
  for (const entry of normalizedEntries) {
    const explicitMonth = detectExplicitMonthInFolderName(entry.normalized);
    if (explicitMonth !== null && explicitMonth !== mes) {
      continue;
    }
    if (prefixRegex.test(entry.normalized)) {
      return entry.original;
    }
  }

  return null;
}

export function getDefaultMonthFolderName(mes: number): string {
  const found = MESES_PADRAO.find((item) => item.mes === mes);
  return found ? found.pastaPadrao : `${String(mes).padStart(2, '0')}`;
}

export function sanitizeBatchFileName(raw: string): string {
  const leaf = raw.trim().split(/[\\/]/).pop() || '';
  return leaf.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Resolve ano/mês de destino a partir da data de registro das regularizações da exportação. */
export function resolveCompetenciaExportacao(exp: ReurbExportacaoDTO): {
  ano: number;
  mes: number;
  mista: boolean;
} | null {
  if (
    typeof exp.competenciaAno === 'number' &&
    Number.isInteger(exp.competenciaAno) &&
    typeof exp.competenciaMes === 'number' &&
    exp.competenciaMes >= 1 &&
    exp.competenciaMes <= 12
  ) {
    return {
      ano: exp.competenciaAno,
      mes: exp.competenciaMes,
      mista: Boolean(exp.competenciaMista),
    };
  }

  const itens = exp.itens || [];
  const incluidos = itens.filter((it) => it.incluidaNoJson);
  const base = incluidos.length > 0 ? incluidos : itens;
  const counts = new Map<string, { ano: number; mes: number; count: number }>();

  for (const item of base) {
    const iso = item.dataRegistro ? String(item.dataRegistro).slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const ano = Number.parseInt(iso.slice(0, 4), 10);
    const mes = Number.parseInt(iso.slice(5, 7), 10);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) continue;
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { ano, mes, count: 1 });
    }
  }

  if (counts.size === 0) return null;
  const sorted = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.ano !== a.ano) return b.ano - a.ano;
    return b.mes - a.mes;
  });
  return {
    ano: sorted[0].ano,
    mes: sorted[0].mes,
    mista: counts.size > 1,
  };
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

export async function pickReurbRootDirectory(): Promise<FsDirectoryHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (options?: {
        id?: string;
        mode?: 'read' | 'readwrite';
      }) => Promise<FsDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) {
    throw new Error('Navegador não suporta seleção direta de pasta.');
  }
  return picker({ id: 'fiorix-reurb-destino', mode: 'readwrite' });
}

async function listSubdirectoryNames(dir: FsDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      names.push(entry.name);
    }
  }
  return names;
}

/**
 * Localiza a pasta existente `<ANO>/<MÊS>` sem criar subpastas faltantes.
 * Aceita a pasta do mês diretamente (`09-SETEMBRO`), a pasta do ano (`2026`),
 * a pasta raiz `W:\REURB` ou a raiz do volume (`W:\`) contendo `REURB\2026\...`.
 */
export async function resolveTargetDirectoryHandle(
  rootDir: FsDirectoryHandle,
  ano: number,
  mes: number
): Promise<{ handle: FsDirectoryHandle | null; expectedPath: string }> {
  const anoStr = String(ano);
  const defaultMonth = getDefaultMonthFolderName(mes);
  const rootNameTrimmed = rootDir.name.trim();

  // 1. Pasta do mês selecionada diretamente (ex.: "09-SETEMBRO", "09-NOVEMBRO", "Novembro_2026")
  const explicitYearInRoot = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(rootNameTrimmed)?.[1] ?? null;
  const matchedRootAsMonth = matchExistingMonthFolderName([rootNameTrimmed], mes);
  if (matchedRootAsMonth) {
    if (explicitYearInRoot && explicitYearInRoot !== anoStr) {
      return { handle: null, expectedPath: `${anoStr}/${defaultMonth}` };
    }
    return { handle: rootDir, expectedPath: rootNameTrimmed };
  }

  // Se o usuário selecionou diretamente uma pasta explícita de outro mês (ex.: "09-SETEMBRO" para mês 10),
  // não gravar fora da competência nem tentar resolver como ano/raiz.
  const anyExplicitMonthInRoot = detectExplicitMonthInFolderName(
    normalizeFolderName(rootNameTrimmed)
  );
  if (anyExplicitMonthInRoot !== null && anyExplicitMonthInRoot !== mes) {
    return { handle: null, expectedPath: `${anoStr}/${defaultMonth}` };
  }

  // 2. Pasta do ano selecionada diretamente (ex.: "2026")
  let yearDir: FsDirectoryHandle | null = null;
  if (rootNameTrimmed === anoStr || explicitYearInRoot === anoStr) {
    yearDir = rootDir;
  } else {
    const rootSubdirs = await listSubdirectoryNames(rootDir);
    const matchedYear = rootSubdirs.find((name) => name.trim() === anoStr);
    if (matchedYear) {
      yearDir = await rootDir.getDirectoryHandle(matchedYear);
    } else {
      // 3. Raiz do drive / compartilhamento (ex.: "W:\" contendo subpasta "REURB")
      const reurbSubdir = rootSubdirs.find(
        (name) => normalizeFolderName(name) === 'REURB'
      );
      if (reurbSubdir) {
        const reurbHandle = await rootDir.getDirectoryHandle(reurbSubdir);
        const reurbSubdirs = await listSubdirectoryNames(reurbHandle);
        const yearInsideReurb = reurbSubdirs.find((name) => name.trim() === anoStr);
        if (yearInsideReurb) {
          yearDir = await reurbHandle.getDirectoryHandle(yearInsideReurb);
        }
      }
    }
  }

  if (!yearDir) {
    return { handle: null, expectedPath: `${anoStr}/${defaultMonth}` };
  }

  const monthSubdirs = await listSubdirectoryNames(yearDir);
  const matchedMonth = matchExistingMonthFolderName(monthSubdirs, mes);
  if (!matchedMonth) {
    return { handle: null, expectedPath: `${anoStr}/${defaultMonth}` };
  }

  const handle = await yearDir.getDirectoryHandle(matchedMonth);
  return { handle, expectedPath: `${anoStr}/${matchedMonth}` };
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'NotFoundError'
  );
}

export async function fileExistsInDirectory(
  dir: FsDirectoryHandle,
  fileName: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(fileName);
    return true;
  } catch (err) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

async function writeFileIfNotExists(
  dir: FsDirectoryHandle,
  fileName: string,
  content: Uint8Array | string
): Promise<'salvo' | 'ignorado_existente'> {
  if (await fileExistsInDirectory(dir, fileName)) {
    return 'ignorado_existente';
  }
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  if (typeof content === 'string') {
    await writable.write(content);
  } else {
    const copy = new Uint8Array(content.byteLength);
    copy.set(content);
    await writable.write(copy.buffer);
  }
  await writable.close();
  return 'salvo';
}

function isComprovanteElegivel(exp: ReurbExportacaoDTO): boolean {
  return isExportacaoElegivelComprovante(exp);
}

export async function salvarArquivosReurbEmPastasExistentes(params: {
  exportacoes: ReurbExportacaoDTO[];
  mode: ReurbBatchMode;
  rootDir: FsDirectoryHandle;
  fetchJsonBytes: (exportacaoId: string) => Promise<Uint8Array>;
  generatePdfBytes: (exp: ReurbExportacaoDTO) => Uint8Array;
  onProgress?: (progress: ReurbBatchProgress) => void;
}): Promise<ReurbBatchSummary> {
  const detalhes: ReurbBatchItemResult[] = [];
  const pastasAusentesSet = new Set<string>();
  const dirCache = new Map<string, { handle: FsDirectoryHandle | null; expectedPath: string }>();

  let salvos = 0;
  let ignoradosExistentes = 0;
  let semPasta = 0;
  let semDataRegistro = 0;
  let naoElegiveis = 0;
  let erros = 0;

  const wantJson = params.mode === 'jsons' || params.mode === 'ambos';
  const wantPdf = params.mode === 'comprovantes' || params.mode === 'ambos';
  const totalOps =
    params.exportacoes.length * (wantJson && wantPdf ? 2 : 1);
  let currentOp = 0;

  async function resolveDirCached(ano: number, mes: number) {
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    const cached = dirCache.get(key);
    if (cached) return cached;
    const resolved = await resolveTargetDirectoryHandle(params.rootDir, ano, mes);
    dirCache.set(key, resolved);
    return resolved;
  }

  for (const exp of params.exportacoes) {
    const comp = resolveCompetenciaExportacao(exp);

    if (wantJson) {
      currentOp += 1;
      const jsonFileName = exp.nomeArquivoJson ? sanitizeBatchFileName(exp.nomeArquivoJson) : '';
      params.onProgress?.({
        atual: currentOp,
        total: totalOps,
        arquivoAtual: jsonFileName || exp.id,
      });

      if (exp.statusGeracao !== 'GERADO' || !jsonFileName) {
        naoElegiveis += 1;
        detalhes.push({
          exportacaoId: exp.id,
          tipoArquivo: 'JSON',
          arquivo: jsonFileName || null,
          pastaDestino: null,
          status: 'nao_elegivel',
          detalhe: 'Exportação sem arquivo JSON gerado.',
        });
      } else if (!comp) {
        semDataRegistro += 1;
        detalhes.push({
          exportacaoId: exp.id,
          tipoArquivo: 'JSON',
          arquivo: jsonFileName,
          pastaDestino: null,
          status: 'sem_data_registro',
          detalhe: 'Data de registro da regularização não informada.',
        });
      } else {
        const resolved = await resolveDirCached(comp.ano, comp.mes);
        if (!resolved.handle) {
          semPasta += 1;
          pastasAusentesSet.add(resolved.expectedPath);
          detalhes.push({
            exportacaoId: exp.id,
            tipoArquivo: 'JSON',
            arquivo: jsonFileName,
            pastaDestino: resolved.expectedPath,
            status: 'sem_pasta',
            detalhe: 'Pasta mensal não existe no diretório selecionado.',
          });
        } else {
          try {
            const exists = await fileExistsInDirectory(resolved.handle, jsonFileName);
            if (exists) {
              ignoradosExistentes += 1;
              detalhes.push({
                exportacaoId: exp.id,
                tipoArquivo: 'JSON',
                arquivo: jsonFileName,
                pastaDestino: resolved.expectedPath,
                status: 'ignorado_existente',
              });
            } else {
              const bytes = await params.fetchJsonBytes(exp.id);
              const writeResult = await writeFileIfNotExists(resolved.handle, jsonFileName, bytes);
              if (writeResult === 'salvo') {
                salvos += 1;
                detalhes.push({
                  exportacaoId: exp.id,
                  tipoArquivo: 'JSON',
                  arquivo: jsonFileName,
                  pastaDestino: resolved.expectedPath,
                  status: 'salvo',
                });
              } else {
                ignoradosExistentes += 1;
                detalhes.push({
                  exportacaoId: exp.id,
                  tipoArquivo: 'JSON',
                  arquivo: jsonFileName,
                  pastaDestino: resolved.expectedPath,
                  status: 'ignorado_existente',
                });
              }
            }
          } catch (err) {
            erros += 1;
            detalhes.push({
              exportacaoId: exp.id,
              tipoArquivo: 'JSON',
              arquivo: jsonFileName,
              pastaDestino: resolved.expectedPath,
              status: 'erro',
              detalhe: err instanceof Error ? err.message : 'Falha ao salvar JSON.',
            });
          }
        }
      }
    }

    if (wantPdf) {
      currentOp += 1;
      const pdfFileName = sanitizeBatchFileName(buildNomeArquivoComprovantePdf(exp));
      params.onProgress?.({
        atual: currentOp,
        total: totalOps,
        arquivoAtual: pdfFileName,
      });

      if (!isComprovanteElegivel(exp)) {
        naoElegiveis += 1;
        detalhes.push({
          exportacaoId: exp.id,
          tipoArquivo: 'PDF',
          arquivo: pdfFileName,
          pastaDestino: null,
          status: 'nao_elegivel',
          detalhe: 'Exportação com falha ou pendências; não elegível para comprovante.',
        });
      } else if (!comp) {
        semDataRegistro += 1;
        detalhes.push({
          exportacaoId: exp.id,
          tipoArquivo: 'PDF',
          arquivo: pdfFileName,
          pastaDestino: null,
          status: 'sem_data_registro',
          detalhe: 'Data de registro da regularização não informada.',
        });
      } else {
        const resolved = await resolveDirCached(comp.ano, comp.mes);
        if (!resolved.handle) {
          semPasta += 1;
          pastasAusentesSet.add(resolved.expectedPath);
          detalhes.push({
            exportacaoId: exp.id,
            tipoArquivo: 'PDF',
            arquivo: pdfFileName,
            pastaDestino: resolved.expectedPath,
            status: 'sem_pasta',
            detalhe: 'Pasta mensal não existe no diretório selecionado.',
          });
        } else {
          try {
            const exists = await fileExistsInDirectory(resolved.handle, pdfFileName);
            if (exists) {
              ignoradosExistentes += 1;
              detalhes.push({
                exportacaoId: exp.id,
                tipoArquivo: 'PDF',
                arquivo: pdfFileName,
                pastaDestino: resolved.expectedPath,
                status: 'ignorado_existente',
              });
            } else {
              const pdfBytes = params.generatePdfBytes(exp);
              const writeResult = await writeFileIfNotExists(resolved.handle, pdfFileName, pdfBytes);
              if (writeResult === 'salvo') {
                salvos += 1;
                detalhes.push({
                  exportacaoId: exp.id,
                  tipoArquivo: 'PDF',
                  arquivo: pdfFileName,
                  pastaDestino: resolved.expectedPath,
                  status: 'salvo',
                });
              } else {
                ignoradosExistentes += 1;
                detalhes.push({
                  exportacaoId: exp.id,
                  tipoArquivo: 'PDF',
                  arquivo: pdfFileName,
                  pastaDestino: resolved.expectedPath,
                  status: 'ignorado_existente',
                });
              }
            }
          } catch (err) {
            erros += 1;
            detalhes.push({
              exportacaoId: exp.id,
              tipoArquivo: 'PDF',
              arquivo: pdfFileName,
              pastaDestino: resolved.expectedPath,
              status: 'erro',
              detalhe: err instanceof Error ? err.message : 'Falha ao salvar comprovante PDF.',
            });
          }
        }
      }
    }
  }

  return {
    mode: params.mode,
    rootDirName: params.rootDir.name,
    totalOperacoes: currentOp,
    salvos,
    ignoradosExistentes,
    semPasta,
    semDataRegistro,
    naoElegiveis,
    erros,
    pastasAusentes: [...pastasAusentesSet].sort(),
    detalhes,
  };
}

// ---------------------------------------------------------------------------
// ZIP STORE puro em TypeScript (sem dependências externas) para fallback / download por mês
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  return { dosTime, dosDate };
}

/** Constrói um arquivo ZIP válido usando método STORE (sem compressão) com suporte UTF-8. */
export function buildStoredZipBytes(
  entries: Array<{ path: string; data: Uint8Array }>,
  modifiedAt = new Date()
): Uint8Array {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(modifiedAt);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/^\/+/, '').replace(/\\/g, '/');
    const nameBytes = encoder.encode(cleanPath);
    const data = entry.data;
    const checksum = crc32(data);

    // Local File Header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // compression method: STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, data.byteLength, true);
    lv.setUint32(22, data.byteLength, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central Directory Header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, 0, true); // STORE
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, data.byteLength, true);
    cv.setUint32(24, data.byteLength, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((acc, part) => acc + part.byteLength, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.byteLength;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.byteLength;
  }
  output.set(eocd, cursor);
  return output;
}

export async function gerarZipReurbPorMes(params: {
  exportacoes: ReurbExportacaoDTO[];
  mode: ReurbBatchMode;
  fetchJsonBytes: (exportacaoId: string) => Promise<Uint8Array>;
  generatePdfBytes: (exp: ReurbExportacaoDTO) => Uint8Array;
  onProgress?: (progress: ReurbBatchProgress) => void;
}): Promise<{ blob: Blob; totalArquivos: number; semDataRegistro: number; naoElegiveis: number }> {
  const wantJson = params.mode === 'jsons' || params.mode === 'ambos';
  const wantPdf = params.mode === 'comprovantes' || params.mode === 'ambos';
  const entries: Array<{ path: string; data: Uint8Array }> = [];
  const seenPaths = new Set<string>();
  const totalOps = params.exportacoes.length * (wantJson && wantPdf ? 2 : 1);
  let currentOp = 0;
  let semDataRegistro = 0;
  let naoElegiveis = 0;

  for (const exp of params.exportacoes) {
    const comp = resolveCompetenciaExportacao(exp);
    const folderPrefix = comp
      ? `${comp.ano}/${getDefaultMonthFolderName(comp.mes)}`
      : 'SEM_DATA_REGISTRO';

    if (wantJson) {
      currentOp += 1;
      const jsonFileName = exp.nomeArquivoJson ? sanitizeBatchFileName(exp.nomeArquivoJson) : '';
      params.onProgress?.({
        atual: currentOp,
        total: totalOps,
        arquivoAtual: jsonFileName || exp.id,
      });

      if (exp.statusGeracao !== 'GERADO' || !jsonFileName) {
        naoElegiveis += 1;
      } else {
        if (!comp) semDataRegistro += 1;
        const zipPath = `${folderPrefix}/${jsonFileName}`;
        if (!seenPaths.has(zipPath)) {
          seenPaths.add(zipPath);
          const data = await params.fetchJsonBytes(exp.id);
          entries.push({ path: zipPath, data });
        }
      }
    }

    if (wantPdf) {
      currentOp += 1;
      const pdfFileName = sanitizeBatchFileName(buildNomeArquivoComprovantePdf(exp));
      params.onProgress?.({
        atual: currentOp,
        total: totalOps,
        arquivoAtual: pdfFileName,
      });

      if (!isComprovanteElegivel(exp)) {
        naoElegiveis += 1;
      } else {
        if (!comp) semDataRegistro += 1;
        const zipPath = `${folderPrefix}/${pdfFileName}`;
        if (!seenPaths.has(zipPath)) {
          seenPaths.add(zipPath);
          const data = params.generatePdfBytes(exp);
          entries.push({ path: zipPath, data });
        }
      }
    }
  }

  const zipBytes = buildStoredZipBytes(entries);
  const copy = new Uint8Array(zipBytes.byteLength);
  copy.set(zipBytes);
  return {
    blob: new Blob([copy.buffer], { type: 'application/zip' }),
    totalArquivos: entries.length,
    semDataRegistro,
    naoElegiveis,
  };
}
