/**
 * Adaptador Híbrido Estritamente SOMENTE LEITURA — Central REURB & ONR v1.4
 *
 * Fontes:
 * - SRVSQL\WEBRI (SQL Server 2012 SP4): SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED,
 *   LOCK_TIMEOUT 2000, WITH (NOLOCK), gravação restrita exclusivamente a #temp (tempdb).
 * - SRVSIPLANIA\SiplanIA (PostgreSQL 18): fiorix_reader com default_transaction_read_only = on
 *   e consultas estritamente indexadas por numero = ANY($1::bigint[]).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { Client } from 'pg';
import { env } from '../config/env.js';
import { runtimeDirective } from '../services/runtime-directive.js';
import { logger } from '../utils/logger.js';
import { EMBEDDED_REURB_SQL } from './reurb-sql-embedded.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ReurbFonteCampoPayload {
  campo: string;
  valor: string;
  origem: string;
  trechoOcr: string | null;
  exigeConferencia: boolean;
}

export interface ReurbAtoVinculadoPayload {
  atoId: number;
  seqAto: number;
  seqLabel: string;
  avReg: string;
  tipoAto: string;
  negId: number | null;
  negocioDescricao: string;
  dataAto: string | null;
}

export interface ReurbDerivadaPayload {
  matriculaDerivada: number;
  complMatricula: string | null;
  dataAbertura: string | null;
  dataRegistro: string | null;
  tipoInteresse: number;
  incluirNoJson: boolean;
  ehAreaPublica: boolean;
  ehCondominioIntermediario: boolean;
  categoriaArea: string;
  vinculoMetodo: string | null;
  motivoExclusao: string | null;
  fonteOcr: string | null;
}

export interface ReurbPendenciaPayload {
  matriculaDerivada: number | null;
  campo: string;
  severidade: string;
  motivo: string;
  fonte: string;
  acaoNecessaria: string | null;
  exigeConferencia: boolean;
}

export interface ReurbSyncRecord {
  prenotacao: number;
  matricula: number;
  complMatricula: string | null;
  protocolo: string;
  empreendimento: string | null;
  empreendimentoFonte: string | null;
  empreendimentoTrechoOcr: string | null;
  negId: number;
  classificacaoFinal: string;
  modalidade: 'REURB_S' | 'REURB_E' | 'ART_69';
  tipoInteresse: number;
  dataRegistro: string | null;
  dataPrenotacao: string | null;
  municipio: string | null;
  distrito: string | null;
  subdistrito: string | null;
  bairro: string | null;
  bairroSugerido: string | null;
  tipoLocalizacao: string | null;
  quantidadeUnidades: number;
  qtdDerivadasLista: number;
  qtdAreasPublicasExcluidas: number;
  tipoAgente: number | null;
  agente: string | null;
  situacaoValidacao: 'APTO' | 'PENDENTE';
  qtdBloqueios: number;
  qtdAlertas: number;
  ehArt69: boolean;
  fontes: ReurbFonteCampoPayload[];
  atosVinculados: ReurbAtoVinculadoPayload[];
  derivadas: ReurbDerivadaPayload[];
  pendencias: ReurbPendenciaPayload[];
}

export interface ExtrairReurbOptions {
  dataRegistroDe?: string | null;
  dataRegistroAte?: string | null;
  dataPrenotacaoDe?: string | null;
  dataPrenotacaoAte?: string | null;
  prenotacoes?: number[];
  incluirArt69?: boolean;
  incluirCondominio616?: boolean;
  semFiliacao?: boolean;
  semOcr?: boolean;
}

export interface RevalidarReurbResult {
  sucesso: boolean;
  revalidadoEm: string;
  duracaoMs: number;
  ocrConsultado: boolean;
  registros: ReurbSyncRecord[];
  erro?: string | null;
}

export function resolveReurbSqlPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'sql', 'reurb_onr_importar_em_lote.sql'),
    path.resolve(__dirname, '../../sql', 'reurb_onr_importar_em_lote.sql'),
    path.resolve(__dirname, '../sql', 'reurb_onr_importar_em_lote.sql'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Arquivo sql/reurb_onr_importar_em_lote.sql não encontrado no diretório do Connector.');
}

export function loadReurbSqlScript(): string {
  const candidates = [
    path.resolve(process.cwd(), 'sql', 'reurb_onr_importar_em_lote.sql'),
    path.resolve(__dirname, '../../sql', 'reurb_onr_importar_em_lote.sql'),
    path.resolve(__dirname, '../sql', 'reurb_onr_importar_em_lote.sql'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return fs.readFileSync(c, 'utf8').replace(/^\uFEFF/, '');
    }
  }
  if (EMBEDDED_REURB_SQL) {
    return EMBEDDED_REURB_SQL.replace(/^\uFEFF/, '');
  }
  throw new Error('Script sql/reurb_onr_importar_em_lote.sql indisponível (disco e bundle embutido).');
}

function getReadOnlySqlConfig(): sql.config {
  const remoteCfg = runtimeDirective.getRemoteConfig();
  return {
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    database: remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE || 'WEBRI',
    server: remoteCfg.sqlHost || env.SQL_SERVER_HOST,
    port: Number(process.env.SQL_SERVER_PORT || 1433),
    requestTimeout: 180000,
    connectionTimeout: 15000,
    pool: {
      max: 4,
      min: 0,
      idleTimeoutMillis: 15000,
    },
    options: {
      encrypt:
        process.env.SQL_SERVER_ENCRYPT !== undefined
          ? process.env.SQL_SERVER_ENCRYPT === 'true'
          : env.SQL_SERVER_ENCRYPT,
      trustServerCertificate:
        process.env.SQL_SERVER_TRUST_CERT !== undefined
          ? process.env.SQL_SERVER_TRUST_CERT !== 'false'
          : env.SQL_SERVER_TRUST_CERT,
      readOnlyIntent: true,
      requestTimeout: 180000,
    },
  };
}

function sqlStr(val: unknown, maxLen = 380): string {
  if (val === null || val === undefined) return 'NULL';
  const clean = String(val)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  if (!clean) return 'NULL';
  return `N'${clean.replace(/'/g, "''")}'`;
}

function sqlInt(val: unknown): string {
  return typeof val === 'number' && Number.isInteger(val) ? String(val) : 'NULL';
}

function sqlBit(val: unknown): string {
  return val ? '1' : '0';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function parseBrDotInt(raw: string): number | null {
  const n = parseInt(String(raw).replace(/\./g, ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function buildPrenPattern(pren: number): string {
  const s = String(pren);
  return s.length >= 4 ? `${s.slice(0, s.length - 3)}[\\.\\s]?${s.slice(-3)}` : s;
}

export function stripOcrPageHeaders(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\(\s*cont[ií]nua\s+n[ao]\s+(?:ficha\s+\d+|verso)\s*\)[\s\S]{0,280}?(?:20\d{2}|verso\.?)/gi, ' ')
    .replace(/-\s*matr[ií]cula\s*-?\s*ficha[\s\S]{0,220}?(?:verso\.?|CNM:\s*[0-9\.\-]+)/gi, ' ')
    .replace(
      /[LM]?[IÍ]VRO\s+N\.?[º°o]?\s*2\s*-\s*REGISTRO\s+GERAL[\s\S]{0,220}?CNS\s*[-–]?\s*12459[-–]?4(?:\s+\d{1,3}\.\d{3})?(?:\s+\d{2})?(?:\s+CNM:\s*[0-9\.\-]+)?(?:\s+S[aã]o\s+Paulo,?(?:\s+\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})?)?/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPrenContext(texto: string, pren: number): string {
  if (!texto) return '';
  const pPat = buildPrenPattern(pren);
  const re = new RegExp(`PRENOTA[CÇ][AÃ]O\\s*n?[º°o\\.]*\\s*${pPat}(?!\\d)`, 'gi');
  const matches = [...texto.matchAll(re)];
  if (!matches.length) return '';

  const firstIdx = matches[0].index ?? 0;
  const lastIdx = matches[matches.length - 1].index ?? 0;
  const start = Math.max(0, firstIdx - 140);
  const afterLast = texto.slice(lastIdx + 20);
  const nextDiffPren = afterLast.match(
    new RegExp(`PRENOTA[CÇ][AÃ]O\\s*n?[º°o\\.]*\\s*(?!${pPat}(?!\\d))[0-9\\.\\s]{4,9}`, 'i'),
  );
  const end = nextDiffPren && nextDiffPren.index !== undefined
    ? Math.min(texto.length, lastIdx + 20 + nextDiffPren.index)
    : Math.min(texto.length, lastIdx + 3800);
  return stripOcrPageHeaders(texto.slice(start, end));
}

function extractSnippet(text: string, regex: RegExp, radius = 140): string {
  if (!text) return '';
  const m = text.match(regex);
  if (!m) return text.slice(0, 240);
  const idx = m.index ?? 0;
  return text
    .slice(Math.max(0, idx - 60), Math.min(text.length, idx + m[0].length + radius))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKnownPublicAgent(raw: string | null | undefined): {
  agente: string | null;
  tipoAgente: number | null;
} {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return { agente: null, tipoAgente: null };
  if (/MUNICIPALIDADE\s+DE\s+S[AÃ]O\s+PAULO/i.test(s)) {
    return { agente: 'MUNICIPALIDADE DE SÃO PAULO', tipoAgente: 1 };
  }
  if (/SECRETARIA\s+MUNICIPAL\s+D[EA]\s+HABITA[CÇ][AÃ]O.*S[AÃ]O\s+PAULO|SEHAB/i.test(s)) {
    return { agente: 'SECRETARIA MUNICIPAL DA HABITAÇÃO DA PREFEITURA DE SÃO PAULO - SEHAB', tipoAgente: 1 };
  }
  if (/PREFEITURA\s+(?:DO\s+MUNIC[IÍ]PIO\s+)?DE\s+S[AÃ]O\s+PAULO|MUNIC[IÍ]PIO\s+DE\s+S[AÃ]O\s+PAULO/i.test(s)) {
    return { agente: 'PREFEITURA DO MUNICÍPIO DE SÃO PAULO', tipoAgente: 1 };
  }
  if (/CDHU|COMPANHIA\s+DE\s+DESENVOLVIMENTO\s+HABITACIONAL/i.test(s)) {
    return { agente: 'COMPANHIA DE DESENVOLVIMENTO HABITACIONAL E URBANO DO ESTADO DE SÃO PAULO - CDHU', tipoAgente: 1 };
  }
  if (/COHAB|COMPANHIA\s+METROPOLITANA\s+DE\s+HABITA/i.test(s)) {
    return { agente: 'COMPANHIA METROPOLITANA DE HABITAÇÃO DE SÃO PAULO - COHAB/SP', tipoAgente: 1 };
  }
  if (
    /PREFEITURA|MUNICIPALIDADE|MUNIC[IÍ]PIO\s+DE|SECRETARIA|GOVERNO\s+DO\s+ESTADO|FAZENDA\s+DO\s+ESTADO|UNI[AÃ]O\s+FEDERAL|PODER\s+P[UÚ]BLICO|C[AÂ]MARA\s+MUNICIPAL/i.test(
      s,
    )
  ) {
    return { agente: s.slice(0, 100), tipoAgente: 1 };
  }
  return { agente: s, tipoAgente: null };
}

export function extractAgentFromOcr(prenText: string): {
  agente: string | null;
  tipoAgente: number | null;
  trecho: string | null;
} {
  if (!prenText) return { agente: null, tipoAgente: null, trecho: null };

  const patterns = [
    /firmad[oa]s?\s+pel[oa]s?\.?\s+([^;]{4,220})/i,
    /(?:Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b)[^;]{0,140}?expedid[oa]\s+(?:em\s+[0-9\/\.\s]+\s*,?\s*)?pel[oa]\.?\s+([^;]{4,220})/i,
    /expedid[oa]s?\s+(?:em\s+[0-9\/\.\s]+\s*,?\s*)?pel[oa]\.?\s+((?:Coordenadoria|Secretaria|Prefeitura|Municipalidade|Munic[ií]pio)[^;]{4,220})/i,
  ];

  for (const re of patterns) {
    const m = prenText.match(re);
    if (!m) continue;
    const rawClause = m[1]
      .split(/\s*,?\s*(?:fa[cç]o\s+constar|j[aá]\s+qualificad|inscrit[oa]|com\s+sede|atrav[eé]s|por\s+sua|por\s+meio|acompanhad[oa]|resultante\s+da|Processo\s+n)/i)[0]
      .replace(/^\.+/, '')
      .trim();
    const norm = normalizeKnownPublicAgent(rawClause);
    if (norm.agente) {
      return { agente: norm.agente, tipoAgente: norm.tipoAgente, trecho: extractSnippet(prenText, re, 110) };
    }
  }

  const fallbackPublic = prenText.match(
    /(MUNICIPALIDADE\s+DE\s+S[AÃ]O\s+PAULO|PREFEITURA\s+(?:DO\s+MUNIC[IÍ]PIO\s+)?DE\s+S[AÃ]O\s+PAULO|SECRETARIA\s+MUNICIPAL\s+D[EA]\s+HABITA[CÇ][AÃ]O[^,.;]{0,70}|COMPANHIA\s+DE\s+DESENVOLVIMENTO\s+HABITACIONAL[^,.;]{0,70}|COMPANHIA\s+METROPOLITANA\s+DE\s+HABITA[CÇ][AÃ]O[^,.;]{0,70})/i,
  );
  if (fallbackPublic) {
    const norm = normalizeKnownPublicAgent(fallbackPublic[1]);
    return {
      agente: norm.agente,
      tipoAgente: norm.tipoAgente,
      trecho: extractSnippet(
        prenText,
        new RegExp(fallbackPublic[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        100,
      ),
    };
  }

  return { agente: null, tipoAgente: null, trecho: null };
}

export function extractBairroFromOcr(texto: string, prenText: string): {
  bairroExpresso: string | null;
  bairroSugestao: string | null;
  trechoBairro: string | null;
} {
  const head = (texto || '').slice(0, 1800).replace(/\s+/g, ' ');
  const imovelMatch = head.match(
    /[IV]M[OÓ]VEL\s*:\s*([\s\S]*?)(?:com\s+a\s+se[gq]uinte\s+descri|partindo[\s-]se|inicia[\s-]se|tem\s+in[ií]cio|confrontando|mede\s+)/i,
  );
  const clause = imovelMatch ? imovelMatch[1] : head.slice(0, 450);

  const explicit = `${clause} ${prenText || ''}`.match(
    /\bno\s+bairro\s+(?:d[eao]\s+)?["“]?([A-Za-zÀ-ÿ0-9\s\.\-\/]{3,60}?)(?:["”]|,|\.|;|\s+n[oa]\s+distrito|\s+em\s+Guaianazes|\s+desta)/i,
  );
  const bairroExpresso = explicit ? explicit[1].trim() : null;

  const sugMatch = clause.match(
    /(?:N[úu]cleo(?:\s+Urbano(?:\s+Informal)?)?|Conjunto\s+Habitacional|loteamento)\s+(?:denominad[oa]\s+)?["“]?([^,"”;\.]{3,70})["”]?/i,
  );
  const bairroSugestao = sugMatch
    ? sugMatch[0]
        .replace(/\bdenominad[oa]\s+/i, '')
        .replace(/["“”]/g, '')
        .replace(/\s+em\s+[A-ZÀ-Ÿ\s]+$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    : null;

  return {
    bairroExpresso,
    bairroSugestao,
    trechoBairro: clause.slice(0, 260).trim() || null,
  };
}

export function extractEmpreendimentoFromOcr(texto: string, prenText: string): {
  empreendimentoOcr: string | null;
  trechoEmpreendimento: string | null;
} {
  const scope = `${prenText || ''} ${(texto || '').slice(0, 2200)}`.replace(/\s+/g, ' ');
  const patterns = [
    /(?:n[úu]cleo\s+urbano\s+informal(?:\s+consolidado)?|conjunto\s+habitacional|condom[ií]nio(?:\s+edil[ií]cio|\s+residencial)?|loteamento|parcelamento)\s+(?:denominad[oa]\s+|conhecid[oa]\s+como\s+)["“']?([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\.\-\/']{2,90}?)["”']?(?:[,;.\)]|\s+(?:com|situad|localizad|matriculad|no\s+distrito|neste|desta))/i,
    /(?:denominad[oa]|conhecid[oa]\s+como)\s+["“']([A-Za-zÀ-ÿ0-9][^"”']{2,90})["”']/i,
  ];
  for (const re of patterns) {
    const m = scope.match(re);
    if (m && m[1]) {
      const nome = m[1].replace(/\s+/g, ' ').trim().slice(0, 180);
      if (nome.length >= 3) {
        return {
          empreendimentoOcr: nome,
          trechoEmpreendimento: extractSnippet(scope, re, 110),
        };
      }
    }
  }
  return { empreendimentoOcr: null, trechoEmpreendimento: null };
}

export function extractInterestFromOcr(prenText: string, fallbackText: string): {
  temArt69: boolean;
  tipoInteresseOcr: number | null;
  trecho: string | null;
} {
  const scope = prenText || '';
  const hasArt69 =
    /art(?:igo|\.)?\s*69\b.{0,50}13\.?465|13\.?465.{0,80}art(?:igo|\.)?\s*69|\bREURB-I\b|\bREURB\s+INOMINAD|(?:implantad[oa]|anterior)\s+(?:antes\s+de|a|à)\s+19[\/\s]+(?:12|dezembro)[\/\s]+(?:de\s+)?1979/i.test(
      scope,
    );
  if (hasArt69) {
    return {
      temArt69: true,
      tipoInteresseOcr: 3,
      trecho: extractSnippet(scope, /art(?:igo|\.)?\s*69\b|REURB-I|REURB\s+INOMINAD|19[\/\s]+(?:12|dezembro)[\/\s]+(?:de\s+)?1979/i, 120),
    };
  }
  const source = scope || fallbackText || '';
  const isS = /\bREURB[\s-]*["“]?S["”]?\b|Interesse\s+Social/i.test(source);
  const isE = /\bREURB[\s-]*["“]?E["”]?\b|Interesse\s+Espec[ií]fico/i.test(source);
  if (isS && !isE) return { temArt69: false, tipoInteresseOcr: 1, trecho: null };
  if (isE && !isS) return { temArt69: false, tipoInteresseOcr: 2, trecho: null };
  return { temArt69: false, tipoInteresseOcr: null, trecho: null };
}

function extractOpenedRangesFromOcr(
  prenText: string,
  allowedDerivadasSet: Set<number>,
): Array<{ matriculaDerivada: number; trecho: string }> {
  if (!prenText) return [];
  const linked = new Map<number, string>();
  const abRe = /(?:FORAM\s+ABERTAS|Foram\s+abertas)[^;]{0,900}?(?:selo:|escrevente|$)/gi;
  for (const m of prenText.matchAll(abRe)) {
    const seg = m[0];
    for (const rm of seg.matchAll(/([0-9]{2,3}\.[0-9]{3})\s+(?:a|à)\s+([0-9]{2,3}\.[0-9]{3})/gi)) {
      const start = parseBrDotInt(rm[1]);
      const end = parseBrDotInt(rm[2]);
      if (start && end && end >= start && end - start <= 5000) {
        const snippet = seg.slice(0, 260).replace(/\s+/g, ' ').trim();
        for (let num = start; num <= end; num++) {
          if (allowedDerivadasSet.has(num) && !linked.has(num)) linked.set(num, snippet);
        }
      }
    }
    for (const pm of seg.matchAll(/([0-9]{2,3}\.[0-9]{3})\s+e\s+([0-9]{2,3}\.[0-9]{3})/gi)) {
      const snippet = seg.slice(0, 260).replace(/\s+/g, ' ').trim();
      for (const raw of [pm[1], pm[2]]) {
        const num = parseBrDotInt(raw);
        if (num && allowedDerivadasSet.has(num) && !linked.has(num)) linked.set(num, snippet);
      }
    }
  }
  return [...linked.entries()].map(([matriculaDerivada, trecho]) => ({ matriculaDerivada, trecho }));
}

export function classifyMatrixOcr(
  row: { Prenotacao: number; Matricula: number; NegId: number; Tem71: number; QtdSeq0: number },
  texto: string,
) {
  const prenText = extractPrenContext(texto, row.Prenotacao);
  const interest = extractInterestFromOcr(prenText, texto);
  const agent = extractAgentFromOcr(prenText);
  const bairro = extractBairroFromOcr(texto, prenText);
  const empreend = extractEmpreendimentoFromOcr(texto, prenText);
  const docRef = `SiplanIA.matricula ${row.Matricula}`;

  if (row.NegId === 947) {
    if (!texto) {
      const fallbackInd = row.Tem71 > 0 && row.QtdSeq0 === 0;
      return {
        Prenotacao: row.Prenotacao,
        Matricula: row.Matricula,
        NegId: 947,
        Classificacao: fallbackInd ? 'TITULACAO_INDIVIDUAL_947' : 'MATRIZ_947',
        TemReurb: false,
        TemCrf: false,
        TemArt69: false,
        TipoInteresseOcr: null as number | null,
        AgenteOcr: null as string | null,
        TipoAgenteOcr: null as number | null,
        BairroExpressoOcr: null as string | null,
        BairroSugestaoOcr: null as string | null,
        MotivoClassificacao: 'Matrícula sem OCR no SiplanIA; classificação baseada no WEBRI',
        DocumentoOcr: docRef,
        TrechoAgente: null as string | null,
        TrechoBairro: null as string | null,
        TrechoClassificacao: 'Sem texto OCR no SiplanIA',
        EmpreendimentoOcr: null as string | null,
        TrechoEmpreendimento: null as string | null,
      };
    }

    const scope = prenText || stripOcrPageHeaders(texto.slice(-3200));
    const hasAbertura = /FORAM\s+ABERTAS|abertas,?\s*nesta\s+data|receberam\s+os\s+n['º°o]/i.test(scope);
    const hasProjeto = /Projeto\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|subdividindo\s+a\s+[aá]rea\s+em/i.test(scope);
    const hasLegit = /TITULA[CÇG][AÃ]O\s+por|LEGITIM[A-Z]{1,6}[CÇ][AÃ]O\s+FUNDI[AÁ]R|[IL1]istagem\s+de\s+Benefici[aá]r|\bart\.?\s*23\b.{0,40}13\.?465/i.test(scope);
    const temReurb = /\bREURB(?:-[SEI])?\b|Regulariza[cç][aã]o\s+Fundi[aá]ria|13\.?465/i.test(scope);
    const temCrf = /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(scope);

    let classificacao = 'MATRIZ_947';
    let motivo = 'Matriz com registro de Projeto de Regularização Fundiária / CRF';
    if (
      (hasLegit && !hasAbertura && !hasProjeto) ||
      (!hasAbertura && !hasProjeto && row.Tem71 > 0 && row.QtdSeq0 === 0)
    ) {
      classificacao = 'TITULACAO_INDIVIDUAL_947';
      motivo = 'Ato 947 é titulação individual por legitimação fundiária (art. 23 Lei 13.465/2017)';
    }

    const trechoClass = extractSnippet(
      scope,
      classificacao === 'TITULACAO_INDIVIDUAL_947'
        ? /TITULA[CÇG][AÃ]O|LEGITIM[A-Z]{1,6}[CÇ][AÃ]O\s+FUNDI[AÁ]R|[IL1]istagem\s+de\s+Benefici[aá]r/i
        : /Regulariza[cç][aã]o\s+Fundi[aá]ria|Certid[aã]o\s+de\s+Regulariza[cç][aã]o|FORAM\s+ABERTAS/i,
      160,
    );

    return {
      Prenotacao: row.Prenotacao,
      Matricula: row.Matricula,
      NegId: 947,
      Classificacao: classificacao,
      TemReurb: temReurb,
      TemCrf: temCrf,
      TemArt69: interest.temArt69,
      TipoInteresseOcr: interest.tipoInteresseOcr,
      AgenteOcr: agent.agente,
      TipoAgenteOcr: agent.tipoAgente,
      BairroExpressoOcr: bairro.bairroExpresso,
      BairroSugestaoOcr: bairro.bairroSugestao,
      MotivoClassificacao: motivo,
      DocumentoOcr: docRef,
      TrechoAgente: agent.trecho,
      TrechoBairro: bairro.trechoBairro,
      TrechoClassificacao: interest.trecho || trechoClass,
      EmpreendimentoOcr: empreend.empreendimentoOcr,
      TrechoEmpreendimento: empreend.trechoEmpreendimento,
    };
  }

  if (!texto) {
    return {
      Prenotacao: row.Prenotacao,
      Matricula: row.Matricula,
      NegId: 616,
      Classificacao: 'CONDOMINIO_616_INCONCLUSIVO',
      TemReurb: false,
      TemCrf: false,
      TemArt69: false,
      TipoInteresseOcr: null,
      AgenteOcr: null,
      TipoAgenteOcr: null,
      BairroExpressoOcr: null,
      BairroSugestaoOcr: null,
      MotivoClassificacao: 'Condomínio 616 sem OCR disponível no SiplanIA para confirmar REURB',
      DocumentoOcr: docRef,
      TrechoAgente: null,
      TrechoBairro: null,
      TrechoClassificacao: 'Sem texto OCR no SiplanIA',
      EmpreendimentoOcr: null,
      TrechoEmpreendimento: null,
    };
  }

  const prenHasReurb =
    /\bREURB(?:-[SEI])?\b|Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b|Lei\s+(?:Federal\s+)?n[º°o\.]*\s*13\.?465/i.test(
      prenText,
    );
  const prenHasCrf = /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(prenText);
  const docHasReurb13465 = /\bREURB(?:-[SEI])?\b|Regulariza[cç][aã]o\s+Fundi[aá]ria.{0,120}(?:REURB|13\.?465)/i.test(texto);
  const docHas11977 = /11\.?977\/?2009/i.test(texto);
  const docHasRegularizacao = /regulariza[cç][aã]o/i.test(texto);

  let classificacao = 'CONDOMINIO_616_NAO_REURB';
  let motivo = 'Especificação de condomínio (616) sem menção a REURB/CRF no OCR';
  let trechoClass = prenText ? prenText.slice(0, 260) : texto.slice(-300);

  if (prenHasReurb || (docHasReurb13465 && prenText)) {
    classificacao = 'CONDOMINIO_616_REURB';
    motivo = prenHasCrf
      ? 'Condomínio 616 vinculado à REURB com CRF confirmada no OCR da prenotação'
      : 'Condomínio 616 vinculado à REURB (Lei 13.465/2017) confirmada no OCR da matrícula';
    trechoClass = extractSnippet(
      prenHasReurb ? prenText : texto,
      /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bREURB(?:-[SEI])?\b|13\.?465/i,
      160,
    );
  } else if (docHasReurb13465 || docHas11977 || docHasRegularizacao) {
    classificacao = 'CONDOMINIO_616_INCONCLUSIVO';
    motivo =
      docHas11977 && !docHasReurb13465
        ? 'Matrícula cita Lei 11.977/2009 sem menção clara a REURB/CRF na prenotação — encaminhado para revisão'
        : 'Menção a regularização fora do trecho da prenotação — encaminhado para revisão';
    trechoClass = extractSnippet(texto, /regulariza[cç][aã]o|11\.?977|13\.?465|REURB/i, 160);
  }

  let agentFinal = agent;
  if (!agentFinal.agente && classificacao === 'CONDOMINIO_616_REURB') {
    const abReurb = extractSnippet(texto, /REURB|Regulariza[cç][aã]o\s+Fundi[aá]ria/i, 220);
    const ag2 = extractAgentFromOcr(abReurb);
    if (ag2.agente) agentFinal = ag2;
  }

  return {
    Prenotacao: row.Prenotacao,
    Matricula: row.Matricula,
    NegId: 616,
    Classificacao: classificacao,
    TemReurb: prenHasReurb || docHasReurb13465,
    TemCrf: prenHasCrf || /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(texto),
    TemArt69: interest.temArt69,
    TipoInteresseOcr: interest.tipoInteresseOcr,
    AgenteOcr: agentFinal.agente,
    TipoAgenteOcr: agentFinal.tipoAgente,
    BairroExpressoOcr: bairro.bairroExpresso,
    BairroSugestaoOcr: bairro.bairroSugestao,
    MotivoClassificacao: motivo,
    DocumentoOcr: docRef,
    TrechoAgente: agentFinal.trecho,
    TrechoBairro: bairro.trechoBairro,
    TrechoClassificacao: interest.trecho || trechoClass,
    EmpreendimentoOcr: empreend.empreendimentoOcr,
    TrechoEmpreendimento: empreend.trechoEmpreendimento,
  };
}

export function classifyDerivadaHeader(mat: number, headTexto: string) {
  const norm = (headTexto || '').replace(/\s+/g, ' ').trim();
  const docRef = `SiplanIA.matricula ${mat}`;
  if (!norm) {
    return {
      Matricula: mat,
      Categoria: 'UNIDADE',
      EhAreaPublica: false,
      MotivoExclusao: null as string | null,
      DocumentoOcr: docRef,
      TrechoOcr: 'Sem texto OCR no SiplanIA',
    };
  }
  const imovelIdx = norm.search(/[IV]M[OÓ]VEL\s*:/i);
  const body = imovelIdx >= 0 ? norm.slice(imovelIdx) : norm;
  const clause = body
    .split(/com\s+a\s+se[gq]uinte\s+descri|partindo[\s-]se|inicia[\s-]se|tem\s+in[ií]cio|confrontando|mede\s+/i)[0]
    .trim();

  const checks = [
    {
      cat: 'APM',
      re: /\bAPM[\s-]?\d*\b|\b[AÁ]REA\s+P[UÚ]BLICA\b/i,
      motivo: 'Área Pública Municipal (APM) excluída da lista de unidades habitacionais',
    },
    {
      cat: 'VIA_PUBLICA',
      re: /\bleito\s+d[aeo]s?\b|\bsistema\s+vi[aá]rio\b|\bvia\s+p[uú]blica\b|\bleito\s+vi[aá]rio\b|\bviela\b|\bpra[cç]a\b|\bbal[aã]o\s+de\s+retorno\b/i,
      motivo: 'Via pública / sistema viário excluído da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_INSTITUCIONAL',
      re: /\b[AÁ]REA\s+INSTITUCIONAL\b|\bEQUIPAMENTO\s+COMUNIT[AÁ]RIO\b/i,
      motivo: 'Área institucional excluída da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_VERDE',
      re: /\b[AÁ]REA\s+VERDE\b|\bESPA[CÇ]O\s+LIVRE\b/i,
      motivo: 'Área verde / espaço livre excluído da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_REMANESCENTE',
      re: /\b[AÁ]REA\s+REMANESCENTE\b/i,
      motivo: 'Área remanescente excluída da lista de unidades habitacionais',
    },
  ];

  for (const chk of checks) {
    if (chk.re.test(clause)) {
      return {
        Matricula: mat,
        Categoria: chk.cat,
        EhAreaPublica: true,
        MotivoExclusao: chk.motivo,
        DocumentoOcr: docRef,
        TrechoOcr: clause.slice(0, 260),
      };
    }
  }

  return {
    Matricula: mat,
    Categoria: 'UNIDADE',
    EhAreaPublica: false,
    MotivoExclusao: null,
    DocumentoOcr: docRef,
    TrechoOcr: clause.slice(0, 180),
  };
}

export function validateOnrJsonV14(
  parsed: unknown,
  options: { incluirArt69?: boolean } = {},
): string[] {
  const errors: string[] = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['Raiz do JSON deve ser um objeto'];
  }
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'regularizacoes' || !Array.isArray(obj.regularizacoes)) {
    return ['Raiz do JSON deve conter apenas a chave "regularizacoes" (array)'];
  }
  const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (let i = 0; i < obj.regularizacoes.length; i++) {
    const r = obj.regularizacoes[i] as Record<string, any>;
    const pfx = `regularizacoes[${i}] (mat=${r?.matricula})`;
    if (!Number.isInteger(r?.matricula) || r.matricula <= 0) {
      errors.push(`${pfx}: matricula deve ser inteiro > 0`);
    }
    for (const [f, max] of [
      ['municipio', 100],
      ['distrito', 30],
      ['bairro', 30],
      ['agente', 100],
    ] as const) {
      if (typeof r?.[f] !== 'string' || !r[f].trim()) {
        errors.push(`${pfx}: ${f} obrigatório não vazio`);
      } else if (r[f].length > max) {
        errors.push(`${pfx}: ${f} excede ${max} caracteres (${r[f].length})`);
      }
    }
    if (r?.subdistrito !== undefined && (typeof r.subdistrito !== 'string' || r.subdistrito.length > 30 || !r.subdistrito.trim())) {
      errors.push(`${pfx}: subdistrito opcional inválido`);
    }
    if (r?.tipoLocalizacao !== 'U' && r?.tipoLocalizacao !== 'R') {
      errors.push(`${pfx}: tipoLocalizacao deve ser 'U' ou 'R'`);
    }
    if (!Number.isInteger(r?.quantidadeUnidades) || r.quantidadeUnidades <= 0) {
      errors.push(`${pfx}: quantidadeUnidades deve ser inteiro > 0`);
    }
    if (typeof r?.dataRegistro !== 'string' || !isoDateRe.test(r.dataRegistro)) {
      errors.push(`${pfx}: dataRegistro inválida (${r?.dataRegistro})`);
    }
    if (typeof r?.dataPrenotacao !== 'string' || !isoDateRe.test(r.dataPrenotacao)) {
      errors.push(`${pfx}: dataPrenotacao inválida (${r?.dataPrenotacao})`);
    }
    if (![1, 2, 3].includes(r?.tipoInteresse)) {
      errors.push(`${pfx}: tipoInteresse inválido (${r?.tipoInteresse})`);
    }
    if (r?.tipoInteresse === 3 && !options.incluirArt69) {
      errors.push(`${pfx}: tipoInteresse=3 bloqueado sem permissão explícita para Art. 69`);
    }
    if (![1, 2].includes(r?.tipoAgente)) {
      errors.push(`${pfx}: tipoAgente inválido (${r?.tipoAgente})`);
    }
    if (!Array.isArray(r?.derivadas) || r.derivadas.length === 0) {
      errors.push(`${pfx}: derivadas deve ter ao menos 1 item`);
    } else {
      const seenDer = new Set<number>();
      for (let j = 0; j < r.derivadas.length; j++) {
        const d = r.derivadas[j];
        const dpfx = `${pfx}.derivadas[${j}] (mat=${d?.matricula})`;
        if (!Number.isInteger(d?.matricula) || d.matricula <= 0) {
          errors.push(`${dpfx}: matricula deve ser inteiro > 0`);
        }
        if (seenDer.has(d?.matricula)) {
          errors.push(`${dpfx}: matrícula derivada duplicada`);
        }
        seenDer.add(d?.matricula);
        if (d?.dataAbertura !== null && d?.dataAbertura !== undefined && (typeof d.dataAbertura !== 'string' || !isoDateRe.test(d.dataAbertura))) {
          errors.push(`${dpfx}: dataAbertura deve ser yyyy-mm-dd ou null (${d?.dataAbertura})`);
        }
        if (d?.dataRegistro !== null && d?.dataRegistro !== undefined && (typeof d.dataRegistro !== 'string' || !isoDateRe.test(d.dataRegistro))) {
          errors.push(`${dpfx}: dataRegistro deve ser yyyy-mm-dd ou null (${d?.dataRegistro})`);
        }
        if (![1, 2, 3].includes(d?.tipoInteresse)) {
          errors.push(`${dpfx}: tipoInteresse inválido (${d?.tipoInteresse})`);
        }
      }
    }
  }
  return errors;
}

function buildFontesPorRegistro(row: any, exigeConferenciaMap: Map<string, boolean>): ReurbFonteCampoPayload[] {
  const fields: Array<{ campo: string; valor: unknown; origem: unknown; trecho?: unknown }> = [
    { campo: 'classificacao', valor: row.ClassificacaoFinal, origem: row.FonteClassificacao, trecho: row.TrechoClassificacaoOcr },
    { campo: 'empreendimento', valor: row.Empreendimento, origem: row.FonteEmpreendimento, trecho: row.TrechoEmpreendimentoOcr },
    { campo: 'municipio', valor: row.Municipio, origem: row.FonteMunicipio },
    { campo: 'distrito', valor: row.Distrito, origem: row.FonteDistrito },
    { campo: 'subdistrito', valor: row.Subdistrito, origem: row.FonteSubdistrito },
    { campo: 'bairro', valor: row.Bairro ?? (row.BairroSugerido ? `Sugestão: ${row.BairroSugerido}` : null), origem: row.FonteBairro ?? row.FonteBairroSugerido, trecho: row.TrechoBairroOcr },
    { campo: 'tipoLocalizacao', valor: row.TipoLocalizacao, origem: row.FonteTipoLocalizacao },
    { campo: 'dataRegistro', valor: row.dataRegistro, origem: row.FonteDataRegistro },
    { campo: 'dataPrenotacao', valor: row.dataPrenotacao, origem: row.FonteDataPrenotacao },
    { campo: 'tipoInteresse', valor: row.TipoInteresse, origem: row.FonteTipoInteresse },
    { campo: 'tipoAgente', valor: row.TipoAgente, origem: row.FonteTipoAgente },
    { campo: 'agente', valor: row.Agente, origem: row.FonteAgente, trecho: row.TrechoAgenteOcr },
  ];
  return fields.map((f) => ({
    campo: f.campo,
    valor: f.valor !== null && f.valor !== undefined && String(f.valor).trim() !== '' ? String(f.valor).trim() : 'Não identificado',
    origem: f.origem ? String(f.origem).trim() : 'WEBRI / OCR',
    trechoOcr: f.trecho ? String(f.trecho).trim() : null,
    exigeConferencia: Boolean(exigeConferenciaMap.get(f.campo)),
  }));
}

export async function extrairLoteReurbReadOnly(
  options: ExtrairReurbOptions = {},
): Promise<{ registros: ReurbSyncRecord[]; ocrConsultado: boolean; duracaoMs: number }> {
  const startedAt = Date.now();
  const prenList = Array.isArray(options.prenotacoes)
    ? [...new Set(options.prenotacoes.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
    : [];
  const effectiveRegDe = options.dataRegistroDe !== undefined ? options.dataRegistroDe : '2009-03-25';
  const effectiveRegAte = options.dataRegistroAte ?? null;
  const effectivePrenDe = options.dataPrenotacaoDe ?? null;
  const effectivePrenAte = options.dataPrenotacaoAte ?? null;
  const incluirArt69 = options.incluirArt69 === true;
  const incluirCondominio616 = options.incluirCondominio616 !== false;
  const usarFiliacao = options.semFiliacao !== true;

  let script = loadReurbSqlScript();
  script = script.replace(
    'DECLARE @ModoCentral                      BIT          = 0;',
    'DECLARE @ModoCentral                      BIT          = 1;',
  );
  if (!usarFiliacao) {
    script = script.replace('DECLARE @UsarFiliacao                     BIT          = 1;', 'DECLARE @UsarFiliacao                     BIT          = 0;');
  }
  if (!incluirCondominio616) {
    script = script.replace('DECLARE @IncluirCondominio616             BIT          = 1;', 'DECLARE @IncluirCondominio616             BIT          = 0;');
  }
  if (incluirArt69) {
    script = script.replace('DECLARE @IncluirArt69                     BIT          = 0;', 'DECLARE @IncluirArt69                     BIT          = 1;');
  }
  if (prenList.length === 1) {
    script = script
      .replace('DECLARE @PrenotacaoDe                     INT          = NULL;', `DECLARE @PrenotacaoDe                     INT          = ${prenList[0]};`)
      .replace('DECLARE @PrenotacaoAte                    INT          = NULL;', `DECLARE @PrenotacaoAte                    INT          = ${prenList[0]};`);
  } else if (prenList.length > 1) {
    script = script.replace(
      'DECLARE @PrenotacoesLista                 VARCHAR(MAX) = NULL;',
      `DECLARE @PrenotacoesLista                 VARCHAR(MAX) = '${prenList.join(',')}';`,
    );
  }
  script = script.replace(
    "DECLARE @DataRegistroDe                   DATE         = '2017-07-11';",
    `DECLARE @DataRegistroDe                   DATE         = ${effectiveRegDe ? `'${effectiveRegDe}'` : 'NULL'};`,
  );
  if (effectiveRegAte) {
    script = script.replace('DECLARE @DataRegistroAte                  DATE         = NULL;', `DECLARE @DataRegistroAte                  DATE         = '${effectiveRegAte}';`);
  }
  if (effectivePrenDe) {
    script = script.replace('DECLARE @DataPrenotacaoDe                 DATE         = NULL;', `DECLARE @DataPrenotacaoDe                 DATE         = '${effectivePrenDe}';`);
  }
  if (effectivePrenAte) {
    script = script.replace('DECLARE @DataPrenotacaoAte                DATE         = NULL;', `DECLARE @DataPrenotacaoAte                DATE         = '${effectivePrenAte}';`);
  }

  let pool: sql.ConnectionPool | undefined;
  let ocrConsultado = false;
  try {
    pool = await sql.connect(getReadOnlySqlConfig());

    const canTryOcr =
      options.semOcr !== true &&
      env.SIPLANIA_POSTGRES_ENABLED !== false &&
      Boolean(env.SIPLANIA_POSTGRES_PASSWORD || process.env.SIPLANIA_POSTGRES_PASSWORD);

    if (canTryOcr) {
      const req = pool.request();
      req.input('regDe', sql.Date, effectiveRegDe);
      req.input('regAte', sql.Date, effectiveRegAte);
      req.input('prenDe', sql.Date, effectivePrenDe);
      req.input('prenAte', sql.Date, effectivePrenAte);
      req.input('prenLista', sql.VarChar(sql.MAX), prenList.length ? prenList.join(',') : null);

      const candMatRs = await req.query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SET LOCK_TIMEOUT 2000;

        DECLARE @Pf TABLE (Pren INT PRIMARY KEY);
        IF @prenLista IS NOT NULL
        BEGIN
          DECLARE @x XML = CAST('<x>' + REPLACE(@prenLista, ',', '</x><x>') + '</x>' AS XML);
          INSERT INTO @Pf (Pren)
          SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
          FROM @x.nodes('/x') AS t(n)
          WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;
        END;
        DECLARE @TemPf BIT = CASE WHEN EXISTS (SELECT 1 FROM @Pf) THEN 1 ELSE 0 END;

        ;WITH base AS (
          SELECT
            rc.PK_FlagRecepcao AS Flag,
            rc.PK_Recepcao AS Prenotacao,
            r.PK_Num_Livro AS Matricula,
            an.FK_tblWRINegocios_Id AS NegId,
            MIN(a.DataAto) AS DataRegistro,
            MAX(rc.DtPrenotacao) AS DtPrenotacao,
            MIN(an.PK_ID) AS AtoNegId
          FROM dbo.tblWRIAtos a WITH (NOLOCK)
          JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id AND an.FK_tblWRINegocios_Id IN (947, 616)
          JOIN dbo.tblWRIReal r WITH (NOLOCK)          ON r.PK_Id = a.FK_tblWRIReal_Id AND r.FK_tblWRILivro_Id = 2
          JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK)  ON at.FK_tblWRIAtos_Id = a.PK_Id
          JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)     ON rc.PK_FlagRecepcao = at.FK_tblWRIRecepcaoFlagRecepcao AND rc.PK_Recepcao = at.FK_tblWRIRecepcaoRecepcao
          WHERE rc.TipoPrenotacao IN (13, 27)
            AND (@TemPf = 0 OR EXISTS (SELECT 1 FROM @Pf pf WHERE pf.Pren = rc.PK_Recepcao))
            AND (@prenDe IS NULL OR rc.DtPrenotacao >= @prenDe)
            AND (@prenAte IS NULL OR rc.DtPrenotacao < DATEADD(DAY, 1, @prenAte))
          GROUP BY rc.PK_FlagRecepcao, rc.PK_Recepcao, r.PK_Num_Livro, an.FK_tblWRINegocios_Id
        )
        SELECT
          b.Flag,
          b.Prenotacao,
          b.Matricula,
          b.NegId,
          (SELECT COUNT(*) FROM dbo.tblWRIAtosParticipantes p WITH (NOLOCK) WHERE p.FK_tblWRIAtosNegocios_Id = b.AtoNegId AND p.FK_tblWRITpParticipacao_Id = 71) AS Tem71,
          (SELECT COUNT(DISTINCT ab.FK_tblWRIReal_Id) FROM dbo.tblWRIAtosTitulos at0 WITH (NOLOCK) JOIN dbo.tblWRIAtos ab WITH (NOLOCK) ON ab.PK_Id = at0.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0 JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2 WHERE at0.FK_tblWRIRecepcaoFlagRecepcao = b.Flag AND at0.FK_tblWRIRecepcaoRecepcao = b.Prenotacao) AS QtdSeq0
        FROM base b
        WHERE (@regDe IS NULL OR (b.DataRegistro IS NOT NULL AND CONVERT(date, b.DataRegistro) >= @regDe) OR (b.DataRegistro IS NULL AND CONVERT(date, b.DtPrenotacao) >= @regDe))
          AND (@regAte IS NULL OR (b.DataRegistro IS NOT NULL AND CONVERT(date, b.DataRegistro) <= @regAte) OR (b.DataRegistro IS NULL AND CONVERT(date, b.DtPrenotacao) <= @regAte));
      `);

      const candMatrizes = candMatRs.recordset || [];
      const prenDoFiltro = [...new Set(candMatrizes.map((r: any) => Number(r.Prenotacao)))];

      let candDerivadas: Array<{ Prenotacao: number; Matricula: number }> = [];
      if (prenDoFiltro.length > 0) {
        for (const pBatch of chunkArray(prenDoFiltro, 500)) {
          const reqDer = pool.request();
          reqDer.input('prenLista', sql.VarChar(sql.MAX), pBatch.join(','));
          const candDerRs = await reqDer.query(`
            SET NOCOUNT ON;
            SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
            SET LOCK_TIMEOUT 2000;

            DECLARE @Pf TABLE (Pren INT PRIMARY KEY);
            DECLARE @x XML = CAST('<x>' + REPLACE(@prenLista, ',', '</x><x>') + '</x>' AS XML);
            INSERT INTO @Pf (Pren)
            SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
            FROM @x.nodes('/x') AS t(n)
            WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;

            SELECT DISTINCT rc.PK_Recepcao AS Prenotacao, rd.PK_Num_Livro AS Matricula
            FROM @Pf pf
            JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)    ON rc.PK_Recepcao = pf.Pren AND rc.TipoPrenotacao IN (13, 27)
            JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = rc.PK_FlagRecepcao AND at.FK_tblWRIRecepcaoRecepcao = rc.PK_Recepcao
            JOIN dbo.tblWRIAtos ab WITH (NOLOCK)        ON ab.PK_Id = at.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0
            JOIN dbo.tblWRIReal rd WITH (NOLOCK)        ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2;
          `);
          candDerivadas = candDerivadas.concat(candDerRs.recordset || []);
        }
      }

      const pg = new Client({
        host: env.SIPLANIA_HOST || '10.0.0.6',
        port: Number(env.SIPLANIA_POSTGRES_PORT || 5432),
        database: env.SIPLANIA_POSTGRES_DB || 'SiplanIA',
        user: env.SIPLANIA_POSTGRES_USER || 'fiorix_reader',
        password: env.SIPLANIA_POSTGRES_PASSWORD,
        connectionTimeoutMillis: 3500,
        statement_timeout: 120000,
      });

      try {
        await pg.connect();
        await pg.query('SET default_transaction_read_only = on');
        ocrConsultado = true;

        const matNums = [...new Set(candMatrizes.map((r: any) => Number(r.Matricula)))];
        const matrixTextMap = new Map<number, string>();
        for (const batch of chunkArray(matNums, 500)) {
          const r = await pg.query('SELECT numero::int AS mat, texto FROM matricula WHERE numero = ANY($1::bigint[])', [batch]);
          for (const row of r.rows) matrixTextMap.set(Number(row.mat), row.texto || '');
        }

        const derByPren = new Map<number, Set<number>>();
        for (const d of candDerivadas) {
          if (!derByPren.has(d.Prenotacao)) derByPren.set(d.Prenotacao, new Set());
          derByPren.get(d.Prenotacao)!.add(d.Matricula);
        }

        const ocrMatrizRows = candMatrizes.map((row: any) => classifyMatrixOcr(row, matrixTextMap.get(Number(row.Matricula)) || ''));
        const validMatricesByPren = new Map<number, Set<number>>();
        for (const r of ocrMatrizRows) {
          if (r.Classificacao === 'TITULACAO_INDIVIDUAL_947' || r.Classificacao === 'CONDOMINIO_616_NAO_REURB') continue;
          if (!validMatricesByPren.has(r.Prenotacao)) validMatricesByPren.set(r.Prenotacao, new Set());
          validMatricesByPren.get(r.Prenotacao)!.add(r.Matricula);
        }
        const multiMatrixPrens = new Set(
          [...validMatricesByPren.entries()].filter(([, s]) => s.size > 1).map(([pren]) => pren),
        );

        const ocrOrigemRows: Array<Record<string, unknown>> = [];
        const seenOrigemKeys = new Set<string>();
        const avCovered = new Set<string>();
        const pushOrigem = (item: {
          Prenotacao: number;
          MatriculaDerivada: number;
          MatriculaMatriz: number;
          Metodo: string;
          DocumentoOcr: string;
          TrechoOcr: string | null;
        }) => {
          const key = `${item.Prenotacao}|${item.MatriculaDerivada}|${item.MatriculaMatriz}|${item.Metodo}`;
          if (seenOrigemKeys.has(key)) return;
          seenOrigemKeys.add(key);
          ocrOrigemRows.push(item);
        };

        for (const info of ocrMatrizRows) {
          if (!multiMatrixPrens.has(info.Prenotacao)) continue;
          const texto = matrixTextMap.get(info.Matricula) || '';
          if (!texto) continue;
          const prenText = extractPrenContext(texto, info.Prenotacao);
          const allowedDer = derByPren.get(info.Prenotacao) || new Set<number>();
          for (const rg of extractOpenedRangesFromOcr(prenText, allowedDer)) {
            if (rg.matriculaDerivada === info.Matricula) continue;
            avCovered.add(`${info.Prenotacao}|${rg.matriculaDerivada}`);
            pushOrigem({
              Prenotacao: info.Prenotacao,
              MatriculaDerivada: rg.matriculaDerivada,
              MatriculaMatriz: info.Matricula,
              Metodo: 'AV_FAIXA_MATRIZ',
              DocumentoOcr: info.DocumentoOcr,
              TrechoOcr: null,
            });
          }
        }

        const derNums = [...new Set(candDerivadas.map((d) => Number(d.Matricula)))];
        const derHeadMap = new Map<number, string>();
        for (const batch of chunkArray(derNums, 2000)) {
          const r = await pg.query('SELECT numero::int AS mat, left(texto, 1600) AS head FROM matricula WHERE numero = ANY($1::bigint[])', [batch]);
          for (const row of r.rows) derHeadMap.set(Number(row.mat), row.head || '');
        }

        const ocrDerivadaRows = derNums
          .map((mat) => classifyDerivadaHeader(mat, derHeadMap.get(mat) || ''))
          .filter((x) => x.EhAreaPublica);

        const uncoveredMultiDer = candDerivadas.filter(
          (d) => multiMatrixPrens.has(d.Prenotacao) && !avCovered.has(`${d.Prenotacao}|${d.Matricula}`),
        );
        const uncoveredDerNums = [...new Set(uncoveredMultiDer.map((d) => Number(d.Matricula)))];
        const derOrigMap = new Map<number, string>();
        for (const batch of chunkArray(uncoveredDerNums, 1000)) {
          const r = await pg.query(
            `SELECT numero::int AS mat,
                    substring(left(texto, 7000) from '(?i)(?:matr[ií]cula\\s+de\\s+origem.{0,80}|REGISTROS?\\s+ANTERIOR(?:ES)?\\s*:.{0,250}.{0,250}.{0,200})') AS orig_trecho
             FROM matricula
             WHERE numero = ANY($1::bigint[])`,
            [batch],
          );
          for (const row of r.rows) derOrigMap.set(Number(row.mat), row.orig_trecho || '');
        }

        for (const d of uncoveredMultiDer) {
          const origTrecho = derOrigMap.get(d.Matricula);
          if (!origTrecho) continue;
          const t = origTrecho.split(/\bselo\b|\bAv\.\s*0?1\b/i)[0];
          const matsInPren = validMatricesByPren.get(d.Prenotacao) || new Set<number>();
          const cited = new Set<number>();
          for (const mm of t.matchAll(/matr[ií]culas?\s*n?\S{0,4}\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,7})/gi)) {
            const n = parseBrDotInt(mm[1]);
            if (n && n !== d.Matricula && matsInPren.has(n)) cited.add(n);
          }
          for (const mm of t.matchAll(/origem\s+(?:de\s+)?n\S{0,2}\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,7})/gi)) {
            const n = parseBrDotInt(mm[1]);
            if (n && n !== d.Matricula && matsInPren.has(n)) cited.add(n);
          }
          for (const matOrigem of cited) {
            pushOrigem({
              Prenotacao: d.Prenotacao,
              MatriculaDerivada: d.Matricula,
              MatriculaMatriz: matOrigem,
              Metodo: 'OCR_MATRICULA_ORIGEM',
              DocumentoOcr: `SiplanIA.matricula ${d.Matricula}`,
              TrechoOcr: null,
            });
          }
        }

        let insMatriz = '';
        for (const batch of chunkArray(ocrMatrizRows, 200)) {
          insMatriz +=
            'INSERT INTO #OcrMatriz (Prenotacao,Matricula,NegId,Classificacao,TemReurb,TemCrf,TemArt69,TipoInteresseOcr,AgenteOcr,TipoAgenteOcr,BairroExpressoOcr,BairroSugestaoOcr,MotivoClassificacao,DocumentoOcr,TrechoAgente,TrechoBairro,TrechoClassificacao,EmpreendimentoOcr,TrechoEmpreendimento) VALUES\n' +
            batch
              .map(
                (r) =>
                  `(${sqlInt(r.Prenotacao)},${sqlInt(r.Matricula)},${sqlInt(r.NegId)},${sqlStr(r.Classificacao, 40)},${sqlBit(r.TemReurb)},${sqlBit(r.TemCrf)},${sqlBit(r.TemArt69)},${sqlInt(r.TipoInteresseOcr)},${sqlStr(r.AgenteOcr, 200)},${sqlInt(r.TipoAgenteOcr)},${sqlStr(r.BairroExpressoOcr, 200)},${sqlStr(r.BairroSugestaoOcr, 200)},${sqlStr(r.MotivoClassificacao, 300)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoAgente, 390)},${sqlStr(r.TrechoBairro, 390)},${sqlStr(r.TrechoClassificacao, 390)},${sqlStr(r.EmpreendimentoOcr, 180)},${sqlStr(r.TrechoEmpreendimento, 390)})`,
              )
              .join(',\n') +
            ';\n';
        }

        let insOrigem = '';
        for (const batch of chunkArray(ocrOrigemRows, 400)) {
          insOrigem +=
            'INSERT INTO #OcrOrigem (Prenotacao,MatriculaDerivada,MatriculaMatriz,Metodo,DocumentoOcr,TrechoOcr) VALUES\n' +
            batch
              .map(
                (r) =>
                  `(${sqlInt(r.Prenotacao)},${sqlInt(r.MatriculaDerivada)},${sqlInt(r.MatriculaMatriz)},${sqlStr(r.Metodo, 40)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoOcr, 290)})`,
              )
              .join(',\n') +
            ';\n';
        }

        let insDerivada = '';
        for (const batch of chunkArray(ocrDerivadaRows, 300)) {
          insDerivada +=
            'INSERT INTO #OcrDerivada (Matricula,Categoria,EhAreaPublica,MotivoExclusao,DocumentoOcr,TrechoOcr) VALUES\n' +
            batch
              .map(
                (r) =>
                  `(${sqlInt(r.Matricula)},${sqlStr(r.Categoria, 30)},${sqlBit(r.EhAreaPublica)},${sqlStr(r.MotivoExclusao, 200)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoOcr, 290)})`,
              )
              .join(',\n') +
            ';\n';
        }

        script = script
          .replace('-- @@OCR_MATRIZ@@', insMatriz)
          .replace('-- @@OCR_ORIGEM@@', insOrigem)
          .replace('-- @@OCR_DERIVADA@@', insDerivada);
      } catch (pgErr: any) {
        logger.warn(`[REURB_RO] SiplanIA indisponível; executando somente WEBRI (${pgErr?.message || pgErr}).`);
      } finally {
        await pg.end().catch(() => {});
      }
    }

    const res = await pool.request().query(script);
    const recordsets = (res.recordsets || []) as Array<Array<Record<string, any>>>;
    const alertasRs = recordsets[1] || [];
    const origensRs = recordsets[4] || [];
    const derivadasRs = recordsets[5] || [];
    const atosRs = recordsets[6] || [];

    const alertasByKey = new Map<string, ReurbPendenciaPayload[]>();
    const reviewFieldsByKey = new Map<string, Map<string, boolean>>();
    for (const a of alertasRs) {
      if (!a.Prenotacao) continue;
      const matReg = a.MatriculaRegularizacao !== null && a.MatriculaRegularizacao !== undefined ? Number(a.MatriculaRegularizacao) : null;
      const key = `${a.Prenotacao}|${matReg ?? 'PREN'}`;
      const list = alertasByKey.get(key) || [];
      const sev = String(a.Severidade || 'INFO');
      const exigeConf = sev === 'BLOQUEIA' || sev === 'ALTA' || sev === 'MEDIA';
      list.push({
        matriculaDerivada: a.MatriculaDerivada != null ? Number(a.MatriculaDerivada) : null,
        campo: String(a.Campo || 'geral'),
        severidade: sev,
        motivo: String(a.Motivo || ''),
        fonte: String(a.Fonte || 'WEBRI'),
        acaoNecessaria: a.AcaoNecessaria ? String(a.AcaoNecessaria) : null,
        exigeConferencia: exigeConf,
      });
      alertasByKey.set(key, list);

      if (exigeConf && matReg !== null) {
        const fmap = reviewFieldsByKey.get(`${a.Prenotacao}|${matReg}`) || new Map<string, boolean>();
        fmap.set(String(a.Campo || ''), true);
        reviewFieldsByKey.set(`${a.Prenotacao}|${matReg}`, fmap);
      }
    }

    const derivadasByKey = new Map<string, ReurbDerivadaPayload[]>();
    for (const d of derivadasRs) {
      const key = `${d.Prenotacao}|${d.MatriculaRegularizacao}`;
      const list = derivadasByKey.get(key) || [];
      list.push({
        matriculaDerivada: Number(d.MatriculaDerivada),
        complMatricula: d.ComplMatricula ? String(d.ComplMatricula).trim() : null,
        dataAbertura: d.dataAbertura ? String(d.dataAbertura).slice(0, 10) : null,
        dataRegistro: d.dataRegistro ? String(d.dataRegistro).slice(0, 10) : null,
        tipoInteresse: Number(d.tipoInteresse || 1),
        incluirNoJson: Boolean(d.IncluirNaListaDerivadas),
        ehAreaPublica: Boolean(d.EhAreaPublica),
        ehCondominioIntermediario: Boolean(d.EhCondominioIntermediario),
        categoriaArea: String(d.CategoriaArea || 'UNIDADE'),
        vinculoMetodo: d.VinculoMetodo ? String(d.VinculoMetodo) : null,
        motivoExclusao: d.MotivoExclusao ? String(d.MotivoExclusao) : null,
        fonteOcr: d.DocumentoOcr ? String(d.DocumentoOcr) : null,
      });
      derivadasByKey.set(key, list);
    }

    const atosByKey = new Map<string, ReurbAtoVinculadoPayload[]>();
    for (const a of atosRs) {
      const key = `${a.Prenotacao}|${a.MatriculaRegularizacao}`;
      const list = atosByKey.get(key) || [];
      const avReg = String(a.AvReg || '').trim();
      const seq = Number(a.SeqAto ?? 0);
      const prefix = seq === 0 ? 'Ab.' : avReg ? `${avReg}.` : 'Ato';
      list.push({
        atoId: Number(a.AtoId || 0),
        seqAto: seq,
        seqLabel: seq === 0 ? `Mat.${a.MatriculaRegularizacao} (Abertura)` : `${prefix}${seq}/${a.MatriculaRegularizacao}`,
        avReg,
        tipoAto: String(a.TipoAto || ''),
        negId: a.NegId != null ? Number(a.NegId) : null,
        negocioDescricao: String(a.NegocioDescricao || ''),
        dataAto: a.DataAto ? String(a.DataAto).slice(0, 10) : null,
      });
      atosByKey.set(key, list);
    }

    const registros: ReurbSyncRecord[] = origensRs.map((row) => {
      const pren = Number(row.Prenotacao);
      const mat = Number(row.Matricula);
      const key = `${pren}|${mat}`;
      const prenLevelKey = `${pren}|PREN`;
      const pendencias = [...(alertasByKey.get(key) || []), ...(alertasByKey.get(prenLevelKey) || [])];
      const reviewMap = reviewFieldsByKey.get(key) || new Map<string, boolean>();
      const ehArt69 = Boolean(row.EhArt69) || Number(row.TipoInteresse) === 3;
      const tipoInteresse = Number(row.TipoInteresse || (Number(row.TipoPrenotacao) === 27 ? 2 : 1));
      const modalidade: 'REURB_S' | 'REURB_E' | 'ART_69' = ehArt69
        ? 'ART_69'
        : tipoInteresse === 2
          ? 'REURB_E'
          : 'REURB_S';
      const qtdBloqueios = pendencias.filter((p) => p.severidade === 'BLOQUEIA').length;
      const qtdAlertas = pendencias.filter((p) => p.severidade === 'ALTA' || p.severidade === 'MEDIA').length;
      const derivadas = derivadasByKey.get(key) || [];
      const apto = Boolean(row.Apto) && qtdBloqueios === 0;

      return {
        prenotacao: pren,
        matricula: mat,
        complMatricula: row.ComplMatricula ? String(row.ComplMatricula).trim() : null,
        protocolo: String(pren),
        empreendimento: row.Empreendimento ? String(row.Empreendimento).trim() : null,
        empreendimentoFonte: row.FonteEmpreendimento ? String(row.FonteEmpreendimento).trim() : null,
        empreendimentoTrechoOcr: row.TrechoEmpreendimentoOcr ? String(row.TrechoEmpreendimentoOcr).trim() : null,
        negId: Number(row.NegId),
        classificacaoFinal: String(row.ClassificacaoFinal || 'MATRIZ_947'),
        modalidade,
        tipoInteresse,
        dataRegistro: row.dataRegistro ? String(row.dataRegistro).slice(0, 10) : null,
        dataPrenotacao: row.dataPrenotacao ? String(row.dataPrenotacao).slice(0, 10) : null,
        municipio: row.Municipio ? String(row.Municipio).trim() : null,
        distrito: row.Distrito ? String(row.Distrito).trim() : null,
        subdistrito: row.Subdistrito ? String(row.Subdistrito).trim() : null,
        bairro: row.Bairro ? String(row.Bairro).trim() : null,
        bairroSugerido: row.BairroSugerido ? String(row.BairroSugerido).trim() : null,
        tipoLocalizacao: row.TipoLocalizacao ? String(row.TipoLocalizacao).trim() : null,
        quantidadeUnidades: Number(row.QtdUnidades || 0),
        qtdDerivadasLista: Number(row.QtdDerivadasLista || 0),
        qtdAreasPublicasExcluidas: Number(row.QtdAreasPublicasExcluidas || 0),
        tipoAgente: row.TipoAgente != null ? Number(row.TipoAgente) : null,
        agente: row.Agente ? String(row.Agente).trim() : null,
        situacaoValidacao: apto ? 'APTO' : 'PENDENTE',
        qtdBloqueios,
        qtdAlertas,
        ehArt69,
        fontes: buildFontesPorRegistro(row, reviewMap),
        atosVinculados: atosByKey.get(key) || [],
        derivadas,
        pendencias,
      };
    });

    return {
      registros,
      ocrConsultado,
      duracaoMs: Date.now() - startedAt,
    };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

export async function revalidarPrenotacoesReurbReadOnly(
  prenotacoes: number[],
): Promise<RevalidarReurbResult> {
  const startedAt = Date.now();
  const cleanPrenotacoes = [
    ...new Set((prenotacoes || []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)),
  ];
  if (cleanPrenotacoes.length === 0) {
    return {
      sucesso: true,
      revalidadoEm: new Date().toISOString(),
      duracaoMs: 0,
      ocrConsultado: false,
      registros: [],
      erro: null,
    };
  }

  try {
    const out = await extrairLoteReurbReadOnly({
      prenotacoes: cleanPrenotacoes,
      dataRegistroDe: null,
      incluirArt69: false,
      incluirCondominio616: true,
    });
    return {
      sucesso: true,
      revalidadoEm: new Date().toISOString(),
      duracaoMs: out.duracaoMs,
      ocrConsultado: out.ocrConsultado,
      registros: out.registros,
      erro: null,
    };
  } catch (err: any) {
    logger.warn(`[REURB_RO] Falha ao revalidar prenotaçōes REURB: ${err?.message || err}`);
    return {
      sucesso: false,
      revalidadoEm: new Date().toISOString(),
      duracaoMs: Date.now() - startedAt,
      ocrConsultado: false,
      registros: [],
      erro: String(err?.message || err).slice(0, 220),
    };
  }
}
