import { Pool } from 'pg';

export type SiplaniaOcrWordTuple = [text: string, x: number, y: number, w: number, h: number];

export interface SiplaniaOcrMatriculaResult {
  qtdPaginasBanco: number;
  pages: Map<number, SiplaniaOcrWordTuple[]>;
}

export interface SiplanIaRichMatch {
  numero: number;
  qtdPaginas: number | null;
  paginaEncontrada: number | null;
  trechoOcr: string | null;
}

export interface SiplanIaPostgresTelemetry {
  postgresSqlAuthenticated: boolean;
  postgresSqlLatencyMs: number | null;
  postgresVersion: string | null;
  postgresUptimeSeconds: number | null;
  postgresDbSizeMb: number | null;
  postgresCacheHitPercent: number | null;
  postgresTotalConnections: number | null;
  postgresActiveQueries: number | null;
  postgresIdleInTxCount: number | null;
  postgresWaitingLocks: number | null;
  postgresLongQueries: number | null;
  postgresDeadlocks: number | null;
  postgresSharedBuffersMb: number | null;
  postgresMatriculasCount: number | null;
  postgresPaginasOcrCount: number | null;
  postgresDistinctClients: number | null;
  postgresSqlError: string | null;
}

const OCR_CACHE_TTL_MS = 5 * 60_000;
const OCR_CACHE_MAX_ENTRIES = 80;
const FTS_CACHE_TTL_MS = 60_000;
const FTS_CACHE_MAX_ENTRIES = 200;
const CONNECT_COOLDOWN_MS = 15_000;

interface OcrDbCacheEntry {
  expiresAt: number;
  qtdPaginasBanco: number;
  pages: Map<number, SiplaniaOcrWordTuple[]>;
}

interface FtsDbCacheEntry {
  expiresAt: number;
  numeros: number[];
}

interface RichFtsDbCacheEntry {
  expiresAt: number;
  matches: SiplanIaRichMatch[];
}

const ocrDbCache = new Map<number, OcrDbCacheEntry>();
const ftsDbCache = new Map<string, FtsDbCacheEntry>();
const richFtsDbCache = new Map<string, RichFtsDbCacheEntry>();

let sharedPool: Pool | null = null;
let sharedPoolKey = '';
let sharedPoolConnecting: Promise<Pool | null> | null = null;
let connectCooldownUntil = 0;

export function resetSiplaniaReadOnlyForTests(): void {
  ocrDbCache.clear();
  ftsDbCache.clear();
  richFtsDbCache.clear();
  connectCooldownUntil = 0;
  if (sharedPool) {
    void sharedPool.end().catch(() => {});
    sharedPool = null;
  }
  sharedPoolKey = '';
  sharedPoolConnecting = null;
}

function isNetworkOrTransientConnectError(err: unknown): boolean {
  const msg = String((err as any)?.code || (err as any)?.message || err || '').toUpperCase();
  return (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EHOSTUNREACH') ||
    msg.includes('ENETUNREACH') ||
    msg.includes('57P03') ||
    msg.includes('TIMEOUT')
  );
}

function sanitizePgErrorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Erro desconhecido');
  return raw
    .replace(/password\s*=[^;\s]+/gi, 'password=[redacted]')
    .replace(/pwd\s*=[^;\s]+/gi, 'pwd=[redacted]')
    .replace(/:\/\/([^:@\s]+):([^@\s]+)@/g, '://$1:[redacted]@')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

async function getSiplaniaReadOnlyPool(): Promise<Pool | null> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return null;
  }

  const { env } = await import('../config/env.js');
  if (env.SHADOW_MODE || !env.SIPLANIA_POSTGRES_ENABLED) {
    return null;
  }

  if (Date.now() < connectCooldownUntil) {
    return null;
  }

  const host = (env.SIPLANIA_HOST || '10.0.0.6').trim();
  const port = env.SIPLANIA_POSTGRES_PORT || 5432;
  const database = (env.SIPLANIA_POSTGRES_DB || 'SiplanIA').trim();
  const user = (env.SIPLANIA_POSTGRES_USER || 'fiorix_reader').trim();
  const password = env.SIPLANIA_POSTGRES_PASSWORD ? env.SIPLANIA_POSTGRES_PASSWORD : undefined;

  if (!host || !database || !user) {
    return null;
  }

  const key = `${host}|${port}|${database}|${user}|${password ? 'pwd' : 'nopwd'}`;
  if (sharedPool && sharedPoolKey === key) {
    return sharedPool;
  }
  if (sharedPoolConnecting) {
    return sharedPoolConnecting;
  }

  sharedPoolConnecting = (async () => {
    try {
      if (sharedPool) {
        await sharedPool.end().catch(() => {});
        sharedPool = null;
      }

      const pool = new Pool({
        host,
        port,
        database,
        user,
        password,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 2_800,
        statement_timeout: 10_000,
        query_timeout: 10_500,
        lock_timeout: 2_000,
        idle_in_transaction_session_timeout: 15_000,
        application_name: 'fiorix-connector-ro',
        options: '-c default_transaction_read_only=on',
        ssl: false,
      });

      pool.on('error', () => {
        if (sharedPool === pool) {
          sharedPool = null;
        }
      });

      sharedPool = pool;
      sharedPoolKey = key;
      return pool;
    } catch (err) {
      if (isNetworkOrTransientConnectError(err)) {
        connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
      }
      sharedPool = null;
      return null;
    } finally {
      sharedPoolConnecting = null;
    }
  })();

  return sharedPoolConnecting;
}

function clamp01(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Number(Math.max(0, Math.min(1, val)).toFixed(4));
}

/**
 * Converte o JSON `ocr_posicoes_json` armazenado pelo SiplanIA (coordenadas em pixels)
 * para tuplas normalizadas `[texto, x, y, w, h]` no intervalo `[0..1]`.
 */
export function parseSiplaniaOcrPosicoesJson(rawJson: unknown): SiplaniaOcrWordTuple[] {
  if (!rawJson) return [];
  let parsed: unknown = rawJson;
  if (typeof rawJson === 'string') {
    const trimmed = rawJson.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  const obj = parsed as Record<string, unknown>;
  const pageW = Number(obj.Largura ?? obj.largura ?? obj.width ?? 0);
  const pageH = Number(obj.Altura ?? obj.altura ?? obj.height ?? 0);
  if (!Number.isFinite(pageW) || !Number.isFinite(pageH) || pageW <= 0 || pageH <= 0) {
    return [];
  }

  const rawWords = obj.Palavras ?? obj.palavras ?? obj.words;
  if (!Array.isArray(rawWords) || rawWords.length === 0) {
    return [];
  }

  const out: SiplaniaOcrWordTuple[] = [];
  for (const item of rawWords) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Record<string, unknown>;
    const text = String(w.Texto ?? w.texto ?? w.text ?? '').trim();
    if (!text) continue;

    const rawX = Number(w.X ?? w.x ?? 0);
    const rawY = Number(w.Y ?? w.y ?? 0);
    const rawW = Number(w.Largura ?? w.largura ?? w.width ?? 0);
    const rawH = Number(w.Altura ?? w.altura ?? w.height ?? 0);
    if (
      !Number.isFinite(rawX) ||
      !Number.isFinite(rawY) ||
      !Number.isFinite(rawW) ||
      !Number.isFinite(rawH) ||
      rawW <= 0 ||
      rawH <= 0
    ) {
      continue;
    }

    const x = clamp01(rawX / pageW);
    const y = clamp01(rawY / pageH);
    const width = clamp01(rawW / pageW);
    const height = clamp01(rawH / pageH);
    if (width <= 0 || height <= 0) continue;

    out.push([text, x, y, width, height]);
  }

  return out;
}

function getCachedOcrPages(
  numeroMatricula: number,
  pageStart: number,
  pageEnd: number,
): SiplaniaOcrMatriculaResult | null {
  const entry = ocrDbCache.get(numeroMatricula);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    ocrDbCache.delete(numeroMatricula);
    return null;
  }

  // Renova posição LRU
  ocrDbCache.delete(numeroMatricula);
  ocrDbCache.set(numeroMatricula, entry);

  const upperBound = entry.qtdPaginasBanco > 0 ? Math.min(pageEnd, entry.qtdPaginasBanco) : pageEnd;
  if (pageStart > upperBound) {
    return null;
  }

  const hitPages = new Map<number, SiplaniaOcrWordTuple[]>();
  for (let p = pageStart; p <= upperBound; p++) {
    const words = entry.pages.get(p);
    if (!words) {
      return null;
    }
    hitPages.set(p, words);
  }

  return {
    qtdPaginasBanco: entry.qtdPaginasBanco,
    pages: hitPages,
  };
}

function storeCachedOcrPages(
  numeroMatricula: number,
  qtdPaginasBanco: number,
  pages: Map<number, SiplaniaOcrWordTuple[]>,
): void {
  let entry = ocrDbCache.get(numeroMatricula);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (ocrDbCache.size >= OCR_CACHE_MAX_ENTRIES) {
      const oldestKey = ocrDbCache.keys().next().value;
      if (oldestKey !== undefined) ocrDbCache.delete(oldestKey);
    }
    entry = {
      expiresAt: Date.now() + OCR_CACHE_TTL_MS,
      qtdPaginasBanco,
      pages: new Map(),
    };
    ocrDbCache.set(numeroMatricula, entry);
  } else {
    entry.expiresAt = Date.now() + OCR_CACHE_TTL_MS;
    entry.qtdPaginasBanco = Math.max(entry.qtdPaginasBanco, qtdPaginasBanco);
  }

  for (const [pageNum, words] of pages.entries()) {
    entry.pages.set(pageNum, words);
  }
}

/**
 * Consulta estritamente somente-leitura as coordenadas OCR já processadas no SiplanIA
 * (`public.matricula` + `public.matricula_pagina`) para matrículas do Livro 2.
 */
export async function consultarPaginasOcrMatriculaSiplanIaReadOnly(params: {
  numeroMatricula: number;
  pageStart: number;
  pageEnd: number;
}): Promise<SiplaniaOcrMatriculaResult | null> {
  const num = Math.trunc(Number(params.numeroMatricula));
  const pageStart = Math.max(1, Math.trunc(Number(params.pageStart) || 1));
  const pageEnd = Math.max(pageStart, Math.trunc(Number(params.pageEnd) || pageStart));
  if (!Number.isFinite(num) || num <= 0 || num > 99_999_999) {
    return null;
  }

  const cached = getCachedOcrPages(num, pageStart, pageEnd);
  if (cached) {
    return cached;
  }

  const pool = await getSiplaniaReadOnlyPool();
  if (!pool) return null;

  try {
    const res = await pool.query<{
      qtdpaginas: number;
      pagina: string;
      ocr_posicoes_json: unknown;
    }>(
      `
      SELECT COALESCE(m.qtdpaginas, 0)::int AS qtdpaginas,
             mp.pagina,
             mp.ocr_posicoes_json
      FROM public.matricula m
      JOIN public.matricula_pagina mp ON mp.matricula_id = m.id
      WHERE m.numero = $1
        AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
        AND mp.pagina ~ '^[0-9]+$'
        AND mp.pagina::int BETWEEN $2 AND $3
        AND mp.ocr_posicoes_json IS NOT NULL
      ORDER BY mp.pagina::int ASC
      `,
      [num, pageStart, pageEnd],
    );

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    let qtdPaginasBanco = 0;
    const pages = new Map<number, SiplaniaOcrWordTuple[]>();
    for (const row of res.rows) {
      const q = Math.trunc(Number(row.qtdpaginas) || 0);
      if (q > qtdPaginasBanco) qtdPaginasBanco = q;

      const pgNum = Math.trunc(Number(row.pagina));
      if (!Number.isFinite(pgNum) || pgNum <= 0) continue;

      const words = parseSiplaniaOcrPosicoesJson(row.ocr_posicoes_json);
      if (words.length > 0) {
        pages.set(pgNum, words);
      }
    }

    if (pages.size === 0) {
      return null;
    }

    storeCachedOcrPages(num, qtdPaginasBanco, pages);
    return { qtdPaginasBanco, pages };
  } catch (err) {
    if (isNetworkOrTransientConnectError(err)) {
      connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
    }
    return null;
  }
}

const REGEX_PROCESSO_CNJ_GLOBAL =
  /\b(?:\d{7}-\d{2}(?:\.\d{4}(?:\.\d(?:\.\d{2}(?:\.\d{4})?)?)?)?|\d{7}\d{2}(?:19|20)\d{2}(?:\d\d{2}\d{4})?)\b/g;
const REGEX_CODIGO_CENTRAL_GLOBAL = /\b(?:ac|ph|in)[0-9a-z]{5,}\b/gi;
const REGEX_DOC_FORMATADO =
  /(?:\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{4}-\d\b)/;

const ROTULOS_GENERICOS_FTS = new Set([
  'matricula',
  'matr',
  'mat',
  'protocolo',
  'prenotacao',
  'processo',
  'transcricao',
  'transcr',
  'titulo',
  'livro',
  'lv2',
  'lv3',
  'setor',
  'quadra',
  'planta',
  'numero',
  'no',
]);

function normalizeCriterionText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Decide se um critério de busca merece consulta Full-Text Search (GIN) nas 269 mil
 * matrículas do SiplanIA, evitando disparar FTS para buscas numéricas diretas
 * (nº de matrícula, protocolo, transcrição, processo CNJ ou código AC/PH/IN).
 */
export function deveConsultarFullTextSiplanIa(rawCriterion: string): boolean {
  const trimmed = String(rawCriterion || '').trim();
  if (trimmed.length < 3 || trimmed.length > 180) return false;

  // Remove primeiro o nº de processo CNJ para não confundir parte do CNJ com CPF/SQL
  const semCnj = trimmed.replace(REGEX_PROCESSO_CNJ_GLOBAL, ' ').trim();

  // Documento oficial formatado (CPF, CNPJ ou Contribuinte SQL)
  if (REGEX_DOC_FORMATADO.test(semCnj)) {
    return true;
  }

  // Números puros ou com separador de milhar ("40000", "229.534") nunca devem virar FTS
  if (/^[0-9.\-\s]+$/.test(trimmed)) return false;

  // Remove números de processo CNJ, códigos da Central e rótulos genéricos antes de verificar texto
  const semIdentificadores = normalizeCriterionText(trimmed)
    .replace(REGEX_PROCESSO_CNJ_GLOBAL, ' ')
    .replace(REGEX_CODIGO_CENTRAL_GLOBAL, ' ')
    .replace(/\bn[ºo°]\.?/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ');

  const tokens = semIdentificadores.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (ROTULOS_GENERICOS_FTS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    // Ao menos 1 palavra alfabética significativa (nome, rua, condomínio, cartório etc.)
    if (/[a-z]{3,}/.test(tok)) {
      return true;
    }
  }

  return false;
}

function getCachedFts(key: string): number[] | null {
  const hit = ftsDbCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    ftsDbCache.delete(key);
    return null;
  }
  return [...hit.numeros];
}

function setCachedFts(key: string, numeros: number[]): void {
  if (ftsDbCache.size >= FTS_CACHE_MAX_ENTRIES) {
    const oldestKey = ftsDbCache.keys().next().value;
    if (oldestKey !== undefined) ftsDbCache.delete(oldestKey);
  }
  ftsDbCache.set(key, {
    expiresAt: Date.now() + FTS_CACHE_TTL_MS,
    numeros: [...numeros],
  });
}

function prepareFullTextQueryInput(rawCriterion: string): string {
  // Remove prefixos puramente cartoriais quando acompanhados de termos reais (ex: "cpf 123.456.789-00")
  return String(rawCriterion || '')
    .replace(/\b(?:cpf|cnpj|sql|iptu)\s*[:.]?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pesquisa Full-Text no índice GIN `idx_matricula_texto` de `public.matricula` no SiplanIA,
 * retornando os números de matrícula do Livro 2 ordenados por relevância.
 */
export async function pesquisarMatriculasTextoSiplanIaReadOnly(
  rawCriterion: string,
  maxResults = 25,
): Promise<number[]> {
  if (!deveConsultarFullTextSiplanIa(rawCriterion)) {
    return [];
  }

  const limit = Math.max(1, Math.min(50, Math.trunc(maxResults)));
  const preparedQuery = prepareFullTextQueryInput(rawCriterion);
  if (preparedQuery.length < 3) return [];

  const cacheKey = `${preparedQuery.toLowerCase()}|${limit}`;
  const cached = getCachedFts(cacheKey);
  if (cached) return cached;

  const pool = await getSiplaniaReadOnlyPool();
  if (!pool) return [];

  try {
    // 1. Primeiro tenta busca por proximidade léxica (tokens válidos dentro de até 4 posições entre si no GIN)
    //    Evita falsos positivos como "Jerônimo ... ficha 75" em matrículas de condomínio grandes.
    const nearRes = await pool.query<{ numero: number }>(
      `
      WITH RECURSIVE valid_toks AS (
        SELECT tok, phraseto_tsquery('portuguese', tok) AS pq, ord
        FROM unnest(regexp_split_to_array(trim(unaccent($1)), '\\s+')) WITH ORDINALITY AS u(tok, ord)
        WHERE length(tok) > 0
          AND phraseto_tsquery('portuguese', tok) <> ''::tsquery
      ),
      toks AS (
        SELECT row_number() OVER (ORDER BY ord) AS rn, tok, pq
        FROM valid_toks
      ),
      chain AS (
        SELECT rn, pq AS acc FROM toks WHERE rn = 1
        UNION ALL
        SELECT t.rn,
               (
                 tsquery_phrase(c.acc, t.pq, 1) ||
                 tsquery_phrase(c.acc, t.pq, 2) ||
                 tsquery_phrase(c.acc, t.pq, 3) ||
                 tsquery_phrase(c.acc, t.pq, 4)
               )
        FROM chain c
        JOIN toks t ON t.rn = c.rn + 1
        WHERE t.rn <= 6
      ),
      q AS (
        SELECT
          (SELECT COUNT(*)::int FROM toks) AS tok_cnt,
          (SELECT acc FROM chain ORDER BY rn DESC LIMIT 1) AS near_q
      ),
      raw_cands AS MATERIALIZED (
        SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
        FROM public.matricula m, q
        WHERE q.tok_cnt >= 2
          AND q.near_q IS NOT NULL
          AND m.textotsvector @@ q.near_q
          AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
          AND m.numero BETWEEN 1 AND 99999999
        LIMIT 250
      )
      SELECT rc.numero
      FROM raw_cands rc
      JOIN public.matricula m2 ON m2.id = rc.id, q
      ORDER BY ts_rank_cd(m2.textotsvector, q.near_q, 32) DESC,
               rc.qtdpaginas ASC,
               rc.numero ASC
      LIMIT $2
      `,
      [preparedQuery, limit],
    );

    let numeros = (nearRes.rows || [])
      .map((r) => Math.trunc(Number(r.numero)))
      .filter((n) => Number.isFinite(n) && n > 0);

    // 2. Fallback para consultas não-contíguas (ex.: "Nome Completo + CPF/Condomínio" na mesma página) ou termo único
    if (numeros.length === 0) {
      const res = await pool.query<{ numero: number }>(
        `
        WITH q AS (
          SELECT websearch_to_tsquery('portuguese', unaccent($1)) AS tsq
        ),
        raw_cands AS MATERIALIZED (
          SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
          FROM public.matricula m, q
          WHERE q.tsq <> ''::tsquery
            AND m.textotsvector @@ q.tsq
            AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
            AND m.numero BETWEEN 1 AND 99999999
            AND (m.qtdpaginas IS NULL OR m.qtdpaginas <= 120)
          LIMIT 250
        ),
        cands AS (
          SELECT rc.id,
                 rc.numero,
                 rc.qtdpaginas,
                 ts_rank_cd(m2.textotsvector, q.tsq, 32) AS base_rank
          FROM raw_cands rc
          JOIN public.matricula m2 ON m2.id = rc.id, q
          ORDER BY base_rank DESC, rc.qtdpaginas ASC
          LIMIT 40
        )
        SELECT c.numero
        FROM cands c, q
        WHERE EXISTS (
          SELECT 1
          FROM public.matricula_pagina mp
          WHERE mp.matricula_id = c.id
            AND to_tsvector('portuguese', unaccent(COALESCE(mp.texto, ''))) @@ q.tsq
        )
        ORDER BY c.base_rank DESC, c.qtdpaginas ASC, c.numero ASC
        LIMIT $2
        `,
        [preparedQuery, limit],
      );

      numeros = (res.rows || [])
        .map((r) => Math.trunc(Number(r.numero)))
        .filter((n) => Number.isFinite(n) && n > 0);
    }

    setCachedFts(cacheKey, numeros);
    return numeros;
  } catch (err) {
    if (isNetworkOrTransientConnectError(err)) {
      connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
    }
    return [];
  }
}

const STOPWORDS_SNIPPET = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'ao', 'rua', 'av', 'avenida',
]);

/**
 * Extrai um trecho legível (~200 caracteres) da página OCRizada ao redor dos termos pesquisados.
 */
export function extrairTrechoOcrLimpo(textoPagina: string | null | undefined, queryText: string): string | null {
  const limpo = String(textoPagina || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo) return null;

  const normTexto = limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = String(queryText || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9./-]+/)
    .map((t) => t.replace(/^[-./]+|[-./]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOPWORDS_SNIPPET.has(t));

  let melhorIdx = -1;
  for (const tok of tokens) {
    const idx = normTexto.indexOf(tok);
    if (idx >= 0) {
      melhorIdx = idx;
      break;
    }
  }

  if (melhorIdx < 0) {
    // Tenta buscar prefixos numéricos (ex.: radical do CPF/Contribuinte antes do hífen)
    for (const tok of tokens) {
      const raiz = tok.split('-')[0];
      if (raiz && raiz.length >= 5) {
        const idx = normTexto.indexOf(raiz);
        if (idx >= 0) {
          melhorIdx = idx;
          break;
        }
      }
    }
  }

  const maxLen = 210;
  if (melhorIdx < 0) {
    return limpo.length > maxLen ? `${limpo.slice(0, maxLen).trim()}…` : limpo;
  }

  const start = Math.max(0, melhorIdx - 55);
  const end = Math.min(limpo.length, start + maxLen);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < limpo.length ? '…' : '';
  return `${prefix}${limpo.slice(start, end).trim()}${suffix}`;
}

function getCachedRichFts(key: string): SiplanIaRichMatch[] | null {
  const hit = richFtsDbCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    richFtsDbCache.delete(key);
    return null;
  }
  return hit.matches.map((m) => ({ ...m }));
}

function setCachedRichFts(key: string, matches: SiplanIaRichMatch[]): void {
  if (richFtsDbCache.size >= FTS_CACHE_MAX_ENTRIES) {
    const oldestKey = richFtsDbCache.keys().next().value;
    if (oldestKey !== undefined) richFtsDbCache.delete(oldestKey);
  }
  richFtsDbCache.set(key, {
    expiresAt: Date.now() + FTS_CACHE_TTL_MS,
    matches: matches.map((m) => ({ ...m })),
  });
}

function podeConsultarRichFtsSiplanIa(rawCriterion: string, permitirNumericoPuro: boolean): boolean {
  const trimmed = String(rawCriterion || '').trim();
  if (trimmed.length < 3 || trimmed.length > 240) return false;
  if (!permitirNumericoPuro) {
    return deveConsultarFullTextSiplanIa(trimmed);
  }
  const hasLetters = /[a-z]{3,}/i.test(trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const digits = trimmed.replace(/\D+/g, '');
  return hasLetters || digits.length >= 5;
}

/**
 * Pesquisa Full-Text no SiplanIA retornando matrícula, total de páginas,
 * nº da página onde o termo foi localizado e o trecho OCRizado correspondente.
 */
export async function pesquisarMatriculasComTrechoSiplanIaReadOnly(
  rawCriterion: string,
  options?: {
    maxResults?: number;
    modoExatoOuFrase?: boolean;
    permitirNumericoPuro?: boolean;
  },
): Promise<SiplanIaRichMatch[]> {
  const permitirNumerico = Boolean(options?.permitirNumericoPuro);
  if (!podeConsultarRichFtsSiplanIa(rawCriterion, permitirNumerico)) {
    return [];
  }

  const limit = Math.max(1, Math.min(50, Math.trunc(options?.maxResults ?? 35)));
  const modoExato = Boolean(options?.modoExatoOuFrase);
  const preparedQuery = prepareFullTextQueryInput(rawCriterion);
  if (preparedQuery.length < 3) return [];

  const cacheKey = `${modoExato ? 'exact' : 'near'}|${preparedQuery.toLowerCase()}|${limit}`;
  const cached = getCachedRichFts(cacheKey);
  if (cached) return cached;

  const pool = await getSiplaniaReadOnlyPool();
  if (!pool) return [];

  try {
    let baseCandidates: Array<{ id: number; numero: number; qtdpaginas: number | null }> = [];

    if (modoExato) {
      const exactRes = await pool.query<{ id: number; numero: number; qtdpaginas: number | null }>(
        `
        WITH q AS (
          SELECT phraseto_tsquery('portuguese', unaccent($1)) AS tsq
        ),
        raw_cands AS MATERIALIZED (
          SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
          FROM public.matricula m, q
          WHERE q.tsq <> ''::tsquery
            AND m.textotsvector @@ q.tsq
            AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
            AND m.numero BETWEEN 1 AND 99999999
          LIMIT 250
        )
        SELECT rc.id, rc.numero, rc.qtdpaginas
        FROM raw_cands rc
        JOIN public.matricula m2 ON m2.id = rc.id, q
        ORDER BY ts_rank_cd(m2.textotsvector, q.tsq, 32) DESC, rc.qtdpaginas ASC, rc.numero ASC
        LIMIT $2
        `,
        [preparedQuery, limit],
      );
      baseCandidates = exactRes.rows || [];
    } else {
      const nearRes = await pool.query<{ id: number; numero: number; qtdpaginas: number | null }>(
        `
        WITH RECURSIVE valid_toks AS (
          SELECT tok, phraseto_tsquery('portuguese', tok) AS pq, ord
          FROM unnest(regexp_split_to_array(trim(unaccent($1)), '\\s+')) WITH ORDINALITY AS u(tok, ord)
          WHERE length(tok) > 0
            AND phraseto_tsquery('portuguese', tok) <> ''::tsquery
        ),
        toks AS (
          SELECT row_number() OVER (ORDER BY ord) AS rn, tok, pq
          FROM valid_toks
        ),
        chain AS (
          SELECT rn, pq AS acc FROM toks WHERE rn = 1
          UNION ALL
          SELECT t.rn,
                 (
                   tsquery_phrase(c.acc, t.pq, 1) ||
                   tsquery_phrase(c.acc, t.pq, 2) ||
                   tsquery_phrase(c.acc, t.pq, 3) ||
                   tsquery_phrase(c.acc, t.pq, 4)
                 )
          FROM chain c
          JOIN toks t ON t.rn = c.rn + 1
          WHERE t.rn <= 6
        ),
        q AS (
          SELECT
            (SELECT COUNT(*)::int FROM toks) AS tok_cnt,
            (SELECT acc FROM chain ORDER BY rn DESC LIMIT 1) AS near_q
        ),
        raw_cands AS MATERIALIZED (
          SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
          FROM public.matricula m, q
          WHERE q.tok_cnt >= 2
            AND q.near_q IS NOT NULL
            AND m.textotsvector @@ q.near_q
            AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
            AND m.numero BETWEEN 1 AND 99999999
          LIMIT 250
        )
        SELECT rc.id, rc.numero, rc.qtdpaginas
        FROM raw_cands rc
        JOIN public.matricula m2 ON m2.id = rc.id, q
        ORDER BY ts_rank_cd(m2.textotsvector, q.near_q, 32) DESC,
                 rc.qtdpaginas ASC,
                 rc.numero ASC
        LIMIT $2
        `,
        [preparedQuery, limit],
      );
      baseCandidates = nearRes.rows || [];

      if (baseCandidates.length === 0) {
        const fallbackRes = await pool.query<{ id: number; numero: number; qtdpaginas: number | null }>(
          `
          WITH q AS (
            SELECT websearch_to_tsquery('portuguese', unaccent($1)) AS tsq
          ),
          raw_cands AS MATERIALIZED (
            SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
            FROM public.matricula m, q
            WHERE q.tsq <> ''::tsquery
              AND m.textotsvector @@ q.tsq
              AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
              AND m.numero BETWEEN 1 AND 99999999
              AND (m.qtdpaginas IS NULL OR m.qtdpaginas <= 120)
            LIMIT 250
          ),
          cands AS (
            SELECT rc.id,
                   rc.numero,
                   rc.qtdpaginas,
                   ts_rank_cd(m2.textotsvector, q.tsq, 32) AS base_rank
            FROM raw_cands rc
            JOIN public.matricula m2 ON m2.id = rc.id, q
            ORDER BY base_rank DESC, rc.qtdpaginas ASC
            LIMIT 40
          )
          SELECT c.id, c.numero, c.qtdpaginas
          FROM cands c, q
          WHERE EXISTS (
            SELECT 1
            FROM public.matricula_pagina mp
            WHERE mp.matricula_id = c.id
              AND to_tsvector('portuguese', unaccent(COALESCE(mp.texto, ''))) @@ q.tsq
          )
          ORDER BY c.base_rank DESC, c.qtdpaginas ASC, c.numero ASC
          LIMIT $2
          `,
          [preparedQuery, limit],
        );
        baseCandidates = fallbackRes.rows || [];
      }
    }

    if (baseCandidates.length === 0) {
      setCachedRichFts(cacheKey, []);
      return [];
    }

    const ids = baseCandidates.map((c) => Number(c.id)).filter((n) => Number.isFinite(n) && n > 0);
    const pageHitsRes = await pool.query<{
      matricula_id: number;
      pagina_num: number;
      texto: string;
    }>(
      `
      WITH q AS (
        SELECT COALESCE(
          NULLIF(websearch_to_tsquery('portuguese', unaccent($2)), ''::tsquery),
          plainto_tsquery('portuguese', unaccent($2))
        ) AS tsq
      )
      SELECT DISTINCT ON (mp.matricula_id)
        mp.matricula_id::bigint AS matricula_id,
        CASE WHEN mp.pagina ~ '^[0-9]+$' THEN mp.pagina::int ELSE 1 END AS pagina_num,
        COALESCE(mp.texto, '') AS texto
      FROM public.matricula_pagina mp, q
      WHERE mp.matricula_id = ANY($1::bigint[])
        AND mp.texto IS NOT NULL
        AND q.tsq IS NOT NULL
        AND q.tsq <> ''::tsquery
        AND to_tsvector('portuguese', unaccent(mp.texto)) @@ q.tsq
      ORDER BY mp.matricula_id,
               CASE WHEN mp.pagina ~ '^[0-9]+$' THEN mp.pagina::int ELSE 999999 END ASC
      `,
      [ids, preparedQuery],
    );

    const hitByMatId = new Map<number, { pagina: number; snippet: string | null }>();
    for (const row of pageHitsRes.rows || []) {
      const mId = Number(row.matricula_id);
      if (!hitByMatId.has(mId)) {
        hitByMatId.set(mId, {
          pagina: Math.max(1, Math.trunc(Number(row.pagina_num) || 1)),
          snippet: extrairTrechoOcrLimpo(row.texto, preparedQuery),
        });
      }
    }

    const finalMatches: SiplanIaRichMatch[] = [];
    const seenNums = new Set<number>();
    for (const cand of baseCandidates) {
      const num = Math.trunc(Number(cand.numero));
      if (!Number.isFinite(num) || num <= 0 || seenNums.has(num)) continue;
      seenNums.add(num);
      const hit = hitByMatId.get(Number(cand.id));
      finalMatches.push({
        numero: num,
        qtdPaginas: cand.qtdpaginas !== null && cand.qtdpaginas !== undefined ? Math.trunc(Number(cand.qtdpaginas)) : null,
        paginaEncontrada: hit ? hit.pagina : 1,
        trechoOcr: hit ? hit.snippet : null,
      });
    }

    setCachedRichFts(cacheKey, finalMatches);
    return finalMatches;
  } catch (err) {
    if (isNetworkOrTransientConnectError(err)) {
      connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
    }
    return [];
  }
}

/**
 * Busca rápida de resumo OCR (total de páginas + trecho/página opcional) para números de matrícula conhecidos.
 */
export async function consultarSnippetsMatriculasSiplanIaReadOnly(
  numeros: number[],
  queryHint?: string,
): Promise<Map<number, { qtdPaginas: number | null; paginaEncontrada: number | null; trechoOcr: string | null }>> {
  const out = new Map<number, { qtdPaginas: number | null; paginaEncontrada: number | null; trechoOcr: string | null }>();
  const limpos = Array.from(
    new Set(numeros.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0 && n <= 99_999_999)),
  ).slice(0, 60);
  if (limpos.length === 0) return out;

  const pool = await getSiplaniaReadOnlyPool();
  if (!pool) return out;

  try {
    const matsRes = await pool.query<{ id: number; numero: number; qtdpaginas: number | null }>(
      `
      SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
      FROM public.matricula m
      WHERE m.numero = ANY($1::int[])
        AND (m.tipos_de_documentos_id = 1 OR m.tipos_de_documentos_id IS NULL)
      `,
      [limpos],
    );

    const idToNum = new Map<number, number>();
    for (const row of matsRes.rows || []) {
      const id = Number(row.id);
      const num = Math.trunc(Number(row.numero));
      idToNum.set(id, num);
      out.set(num, {
        qtdPaginas: row.qtdpaginas !== null && row.qtdpaginas !== undefined ? Math.trunc(Number(row.qtdpaginas)) : null,
        paginaEncontrada: null,
        trechoOcr: null,
      });
    }

    const preparedHint = queryHint ? prepareFullTextQueryInput(queryHint) : '';
    const ids = Array.from(idToNum.keys());
    if (ids.length > 0 && preparedHint.length >= 3) {
      const pagesRes = await pool.query<{ matricula_id: number; pagina_num: number; texto: string }>(
        `
        WITH q AS (
          SELECT COALESCE(
            NULLIF(websearch_to_tsquery('portuguese', unaccent($2)), ''::tsquery),
            plainto_tsquery('portuguese', unaccent($2))
          ) AS tsq
        )
        SELECT DISTINCT ON (mp.matricula_id)
          mp.matricula_id::bigint AS matricula_id,
          CASE WHEN mp.pagina ~ '^[0-9]+$' THEN mp.pagina::int ELSE 1 END AS pagina_num,
          COALESCE(mp.texto, '') AS texto
        FROM public.matricula_pagina mp, q
        WHERE mp.matricula_id = ANY($1::bigint[])
          AND mp.texto IS NOT NULL
          AND q.tsq IS NOT NULL
          AND q.tsq <> ''::tsquery
          AND to_tsvector('portuguese', unaccent(mp.texto)) @@ q.tsq
        ORDER BY mp.matricula_id,
                 CASE WHEN mp.pagina ~ '^[0-9]+$' THEN mp.pagina::int ELSE 999999 END ASC
        `,
        [ids, preparedHint],
      );
      for (const row of pagesRes.rows || []) {
        const num = idToNum.get(Number(row.matricula_id));
        if (!num) continue;
        const atual = out.get(num);
        if (atual) {
          atual.paginaEncontrada = Math.max(1, Math.trunc(Number(row.pagina_num) || 1));
          atual.trechoOcr = extrairTrechoOcrLimpo(row.texto, preparedHint);
        }
      }
    } else if (ids.length > 0 && ids.length <= 25) {
      // Quando consultado diretamente pelo nº da matrícula sem termo textual, retorna prévia da Pág. 1
      const p1Res = await pool.query<{ matricula_id: number; texto: string }>(
        `
        SELECT DISTINCT ON (mp.matricula_id)
          mp.matricula_id::bigint AS matricula_id,
          left(COALESCE(mp.texto, ''), 600) AS texto
        FROM public.matricula_pagina mp
        WHERE mp.matricula_id = ANY($1::bigint[])
          AND mp.pagina IN ('1', '01')
          AND mp.texto IS NOT NULL
        ORDER BY mp.matricula_id
        `,
        [ids],
      );
      for (const row of p1Res.rows || []) {
        const num = idToNum.get(Number(row.matricula_id));
        if (!num) continue;
        const atual = out.get(num);
        if (atual) {
          atual.paginaEncontrada = 1;
          atual.trechoOcr = extrairTrechoOcrLimpo(row.texto, '');
        }
      }
    }
  } catch (err) {
    if (isNetworkOrTransientConnectError(err)) {
      connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
    }
  }

  return out;
}

function emptyTelemetry(errorMsg: string | null): SiplanIaPostgresTelemetry {
  return {
    postgresSqlAuthenticated: false,
    postgresSqlLatencyMs: null,
    postgresVersion: null,
    postgresUptimeSeconds: null,
    postgresDbSizeMb: null,
    postgresCacheHitPercent: null,
    postgresTotalConnections: null,
    postgresActiveQueries: null,
    postgresIdleInTxCount: null,
    postgresWaitingLocks: null,
    postgresLongQueries: null,
    postgresDeadlocks: null,
    postgresSharedBuffersMb: null,
    postgresMatriculasCount: null,
    postgresPaginasOcrCount: null,
    postgresDistinctClients: null,
    postgresSqlError: errorMsg,
  };
}

/**
 * Coleta métricas reais de saúde e catálogo do PostgreSQL 18 no SRVSIPLANIA (10.0.0.6)
 * usando `fiorix_reader` + `pg_read_all_stats` em uma única consulta read-only.
 */
export async function coletarTelemetriaPostgresSiplanIaReadOnly(): Promise<SiplanIaPostgresTelemetry> {
  const pool = await getSiplaniaReadOnlyPool();
  if (!pool) {
    return emptyTelemetry(null);
  }

  const startedAt = Date.now();
  try {
    const res = await pool.query<{
      pg_version: string;
      uptime_sec: string | number;
      db_size_mb: number;
      total_connections: number;
      cache_hit_pct: number | null;
      deadlocks: string | number;
      active_queries: number;
      idle_in_tx: number;
      waiting_locks: number;
      long_queries: number;
      distinct_clients: number;
      shared_buffers_mb: number | null;
      matriculas_count: string | number | null;
      paginas_ocr_count: string | number | null;
    }>(`
      SELECT
        COALESCE(substring(version() FROM 'PostgreSQL [0-9]+\\.[0-9]+'), split_part(version(), ' ', 1)) AS pg_version,
        GREATEST(0, EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint) AS uptime_sec,
        ROUND(pg_database_size(current_database()) / 1048576.0, 1)::float AS db_size_mb,
        db.numbackends::int AS total_connections,
        ROUND(100.0 * db.blks_hit / NULLIF(db.blks_hit + db.blks_read, 0), 2)::float AS cache_hit_pct,
        db.deadlocks::bigint AS deadlocks,
        COALESCE(act.active_queries, 0)::int AS active_queries,
        COALESCE(act.idle_in_tx, 0)::int AS idle_in_tx,
        COALESCE(act.waiting_locks, 0)::int AS waiting_locks,
        COALESCE(act.long_queries, 0)::int AS long_queries,
        COALESCE(act.distinct_clients, 0)::int AS distinct_clients,
        (
          SELECT CASE
            WHEN setting ~ '^[0-9]+$' AND unit = '8kB' THEN ROUND((setting::numeric * 8.0) / 1024.0)::int
            WHEN setting ~ '^[0-9]+$' AND unit = 'MB' THEN setting::int
            ELSE NULL
          END
          FROM pg_settings
          WHERE name = 'shared_buffers'
        ) AS shared_buffers_mb,
        (
          SELECT c.reltuples::bigint
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'matricula'
        ) AS matriculas_count,
        (
          SELECT c.reltuples::bigint
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'matricula_pagina'
        ) AS paginas_ocr_count
      FROM pg_stat_database db
      CROSS JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE state = 'active')::int AS active_queries,
          COUNT(*) FILTER (WHERE state LIKE 'idle in transaction%')::int AS idle_in_tx,
          COUNT(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting_locks,
          COUNT(*) FILTER (WHERE state = 'active' AND now() - query_start > interval '60 seconds')::int AS long_queries,
          COUNT(DISTINCT host(client_addr)) FILTER (WHERE client_addr IS NOT NULL)::int AS distinct_clients
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND backend_type = 'client backend'
      ) act
      WHERE db.datname = current_database()
      LIMIT 1
    `);

    const sqlLatencyMs = Math.max(1, Date.now() - startedAt);
    const row = res.rows?.[0];
    if (!row) {
      return emptyTelemetry('Consulta de telemetria PostgreSQL retornou vazio');
    }

    const toNullableNum = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const matriculasRaw = toNullableNum(row.matriculas_count);
    const paginasRaw = toNullableNum(row.paginas_ocr_count);

    return {
      postgresSqlAuthenticated: true,
      postgresSqlLatencyMs: sqlLatencyMs,
      postgresVersion: row.pg_version || 'PostgreSQL 18',
      postgresUptimeSeconds: toNullableNum(row.uptime_sec),
      postgresDbSizeMb: toNullableNum(row.db_size_mb),
      postgresCacheHitPercent: toNullableNum(row.cache_hit_pct),
      postgresTotalConnections: toNullableNum(row.total_connections),
      postgresActiveQueries: toNullableNum(row.active_queries),
      postgresIdleInTxCount: toNullableNum(row.idle_in_tx),
      postgresWaitingLocks: toNullableNum(row.waiting_locks),
      postgresLongQueries: toNullableNum(row.long_queries),
      postgresDeadlocks: toNullableNum(row.deadlocks),
      postgresSharedBuffersMb: toNullableNum(row.shared_buffers_mb),
      postgresMatriculasCount: matriculasRaw !== null && matriculasRaw >= 0 ? Math.trunc(matriculasRaw) : null,
      postgresPaginasOcrCount: paginasRaw !== null && paginasRaw >= 0 ? Math.trunc(paginasRaw) : null,
      postgresDistinctClients: toNullableNum(row.distinct_clients),
      postgresSqlError: null,
    };
  } catch (err) {
    if (isNetworkOrTransientConnectError(err)) {
      connectCooldownUntil = Date.now() + CONNECT_COOLDOWN_MS;
    }
    return emptyTelemetry(sanitizePgErrorText(err));
  }
}
