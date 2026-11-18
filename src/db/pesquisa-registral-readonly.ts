import sql from 'mssql';
import { env } from '../config/env.js';
import { runtimeDirective } from '../services/runtime-directive.js';
import {
  consultarSnippetsMatriculasSiplanIaReadOnly,
  pesquisarMatriculasComTrechoSiplanIaReadOnly,
  type SiplanIaRichMatch,
} from './siplania-readonly.js';

export type ModoPesquisaNome =
  | 'exata'
  | 'comecar_com'
  | 'primeiro_sobrenome'
  | 'sobrenome'
  | 'qualquer_parte';

export interface FiltrosPesquisaImovel {
  contribuinte?: string;
  maiorArea?: boolean;
  tipoImovelId?: number | null;
  tipoImovelTexto?: string;
  unidade?: string;
  distritoId?: number | null;
  distritoTexto?: string;
  subdistritoId?: number | null;
  subdistritoTexto?: string;
  cep?: string;
  cidade?: string;
  bairro?: string;
  tipoLogradouroId?: number | null;
  tipoLogradouroTexto?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  andar?: string;
  pavimento?: string;
  vaga?: string;
  distanciaEsquina?: string;
  edificioCondominio?: string;
  loteamento?: string;
  bloco?: string;
  setor?: string;
  lote?: string;
  quadra?: string;
  gleba?: string;
  logradouroAnterior?: string;
  tipoAreaId?: number | null;
  tipoAreaTexto?: string;
  tipoConfrontanteId?: number | null;
  tipoConfrontanteTexto?: string;
  confrontante?: string;
  tipoMedidaId?: number | null;
  tipoMedidaTexto?: string;
  medida?: string;
  incra?: string;
  car?: string;
  irf?: string;
  mf?: string;
  mr?: string;
  qmf?: string;
  qmr?: string;
  fraMin?: string;
  descricaoImovel?: string;
}

export interface FiltrosPesquisaPropriedade {
  somenteContraditorioIndisponibilidade?: boolean;
  livroId?: number | null;
  numeroLivro?: number | null;
  livroCompl?: string;
  livroAntigo?: number | null;
  livroAntigoCompl?: string;
  folha?: number | null;
  folhaCompl?: string;
  nome?: string;
  modoNome?: ModoPesquisaNome;
  aplicarSubstituicao?: boolean;
  nomeMaisDocumento?: boolean;
  documento1?: string;
  documento2?: string;
  dtRegInicial?: string;
  dtRegFinal?: string;
}

export interface InputPesquisaRegistral {
  aba: 'imovel' | 'propriedade';
  filtrosImovel?: FiltrosPesquisaImovel;
  filtrosPropriedade?: FiltrosPesquisaPropriedade;
  limite?: number;
}

export interface CatalogoOpcao {
  id: number;
  sigla?: string | null;
  descricao: string;
}

export interface CatalogosPesquisaRegistral {
  livros: CatalogoOpcao[];
  tiposImovel: CatalogoOpcao[];
  distritos: CatalogoOpcao[];
  subdistritos: CatalogoOpcao[];
  tiposLogradouro: CatalogoOpcao[];
  tiposArea: CatalogoOpcao[];
  tiposConfrontante: CatalogoOpcao[];
  unidadesMedida: CatalogoOpcao[];
  origemBanco: 'webri' | 'padrao';
  avisoPermissaoWebri: boolean;
}

export interface ItemResultadoPesquisaRegistral {
  id: string;
  origem: 'ambos' | 'webri' | 'siplania';
  sessao: string;
  livroRotulo: string;
  numeroLivro: number | null;
  complementoLivro: string | null;
  matriculaOrigemCitada: number | null;
  atoResumo: string | null;
  protocoloVinculado: number | null;
  contraditorioIndisponibilidade: 'livre' | 'contraditorio' | 'indisponivel';
  contraditorioDetalhe: string | null;
  contribuinte: string | null;
  tipoImovel: string | null;
  unidade: string | null;
  subdistrito: string | null;
  caracteristicasResumo: string;
  participanteNome: string | null;
  participanteDocumento: string | null;
  participanteQualificacao: string | null;
  localizacaoResumo: string;
  confrontantesResumo: string | null;
  medidasResumo: string | null;
  paginaOcrEncontrada: number | null;
  qtdPaginasOcr: number | null;
  trechoOcr: string | null;
  termoDestaqueSugerido: string;
}

export interface ResultadoPesquisaRegistral {
  aba: 'imovel' | 'propriedade';
  itens: ItemResultadoPesquisaRegistral[];
  total: number;
  duracaoMs: number;
  contadores: {
    webri: number;
    siplania: number;
    ambos: number;
  };
  fontesConsultadas: {
    webriOk: boolean;
    webriLocationTablesOk: boolean;
    siplaniaOk: boolean;
  };
  avisoPermissaoWebri: boolean;
  erroDiagnostico: string | null;
}

const CATALOGOS_PADRAO: Omit<CatalogosPesquisaRegistral, 'origemBanco' | 'avisoPermissaoWebri'> = {
  livros: [
    { id: 0, sigla: 'TODOS', descricao: 'Todos os Livros' },
    { id: 2, sigla: 'LV2', descricao: 'Matrícula (Livro 2)' },
    { id: 3, sigla: 'LV3', descricao: 'Registro Auxiliar (Livro 3)' },
    { id: 1, sigla: 'TRA', descricao: 'Transcrição (Livro Anterior)' },
  ],
  tiposImovel: [
    { id: 2, descricao: 'Apartamento' },
    { id: 1, descricao: 'Casa' },
    { id: 3, descricao: 'Terreno' },
    { id: 4, descricao: 'Prédio' },
    { id: 5, descricao: 'Vaga de Garagem' },
    { id: 6, descricao: 'Conjunto / Sala Comercial' },
    { id: 7, descricao: 'Galpão' },
    { id: 8, descricao: 'Gleba / Área' },
  ],
  distritos: [
    { id: 1, descricao: 'SÃO PAULO (CAPITAL)' },
  ],
  subdistritos: [
    { id: 1, descricao: '10º SUBDISTRITO – BELENZINHO' },
    { id: 2, descricao: '33º SUBDISTRITO – ALTO DA MOOCA' },
    { id: 3, descricao: '18º SUBDISTRITO – IPIRANGA / MOOCA' },
    { id: 4, descricao: 'ITAQUERA / GUAIANAZES (ATÉ 1938)' },
    { id: 5, descricao: 'SÃO MIGUEL PAULISTA / ERMELINO' },
  ],
  tiposLogradouro: [
    { id: 1, descricao: 'Rua' },
    { id: 2, descricao: 'Avenida' },
    { id: 3, descricao: 'Alameda' },
    { id: 4, descricao: 'Praça' },
    { id: 5, descricao: 'Travessa' },
    { id: 6, descricao: 'Estrada' },
    { id: 7, descricao: 'Viela' },
    { id: 8, descricao: 'Largo' },
  ],
  tiposArea: [
    { id: 1, descricao: 'Área Privativa' },
    { id: 2, descricao: 'Área Comum' },
    { id: 3, descricao: 'Área Total' },
    { id: 4, descricao: 'Área de Terreno' },
    { id: 5, descricao: 'Área Construída' },
  ],
  tiposConfrontante: [
    { id: 1, descricao: 'Frente' },
    { id: 2, descricao: 'Lado Direito' },
    { id: 3, descricao: 'Lado Esquerdo' },
    { id: 4, descricao: 'Fundos' },
  ],
  unidadesMedida: [
    { id: 1, sigla: 'm', descricao: 'Metros (m)' },
    { id: 2, sigla: 'm²', descricao: 'Metros quadrados (m²)' },
    { id: 3, sigla: 'ha', descricao: 'Hectares (ha)' },
  ],
};

const CATALOG_CACHE_TTL_MS = 30 * 60_000;
const SEARCH_CACHE_TTL_MS = 30_000;
const MAX_SEARCH_CACHE = 120;
const SQL_PREFIX = 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 2000; ';

let catalogCache: { expiresAt: number; data: CatalogosPesquisaRegistral } | null = null;
const pesquisaCache = new Map<string, { expiresAt: number; result: ResultadoPesquisaRegistral }>();

let sharedPool: sql.ConnectionPool | null = null;
let sharedPoolKey = '';
let sharedPoolConnecting: Promise<sql.ConnectionPool | null> | null = null;

export function resetPesquisaRegistralForTests(): void {
  catalogCache = null;
  pesquisaCache.clear();
  if (sharedPool) {
    void sharedPool.close().catch(() => {});
    sharedPool = null;
  }
  sharedPoolKey = '';
  sharedPoolConnecting = null;
}

export function isSqlPermissionDenied229(err: unknown): boolean {
  const rec = err as any;
  if (!rec) return false;
  if (rec.number === 229 || rec.originalError?.info?.number === 229) return true;
  if (Array.isArray(rec.precedingErrors)) {
    for (const p of rec.precedingErrors) {
      if (p?.number === 229 || p?.originalError?.info?.number === 229) return true;
    }
  }
  const msg = String(rec.message || '');
  return /permission was denied/i.test(msg);
}

/** Formata Contribuinte IPTU/SQL de São Paulo (ex.: 03110801450 -> 031.108.0145-0). */
export function formatarContribuinteSp(raw: string | null | undefined): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 10)}-${digits.slice(10, 11)}`;
  }
  return trimmed;
}

/** Formata CPF (11 dígitos) ou CNPJ (14 dígitos) mantendo strings já formatadas ou outros documentos. */
export function formatarDocumentoCpfCnpj(raw: string | null | undefined): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 11 && /^\d+$/.test(trimmed.replace(/[.\-/\s]/g, ''))) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  if (digits.length === 14 && /^\d+$/.test(trimmed.replace(/[.\-/\s]/g, ''))) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return trimmed;
}

/** Extrai o número da matrícula citada textualmente (ex.: "Com origem na Matrícula nº 33.605"). */
export function extrairMatriculaOrigemCitada(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const match = String(texto).match(
    /(?:origem\s+na\s+)?matr[ií]cula\s*(?:n[ºo°.]*\s*)?([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{1,8})/i,
  );
  if (!match) return null;
  const parsed = parseInt(match[1].replace(/\D+/g, ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 99_999_999) return null;
  return parsed;
}

function escapeSqlLikeLiteral(raw: string): string {
  return raw
    .replace(/\[/g, '[[]')
    .replace(/%/g, '[%]')
    .replace(/_/g, '[_]');
}

/**
 * Aplica classes de equivalência fonética do Registro Civil / WebRI mantendo prefixo indexável
 * no SQL Server (ex.: "MARIA SYLVIA" -> "MARIA S[IY]LV[IY]A").
 */
export function aplicarSubstituicaoFoneticaLike(rawText: string): string {
  const escaped = escapeSqlLikeLiteral(rawText.trim().replace(/\s+/g, ' ').toUpperCase());
  const chars = Array.from(escaped);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    // Não expande dentro de sequências já escapadas como [%]
    if (ch === '[' && chars[i + 2] === ']') {
      out += ch + chars[i + 1] + chars[i + 2];
      i += 2;
      continue;
    }
    if ('AÁÀÂÃÄ'.includes(ch)) out += '[AÁÀÂÃÄ]';
    else if ('EÉÈÊË'.includes(ch)) out += '[EÉÈÊË]';
    else if ('IÍÌÎÏY'.includes(ch)) out += '[IÍÌÎÏY]';
    else if ('OÓÒÔÕÖ'.includes(ch)) out += '[OÓÒÔÕÖ]';
    else if ('UÚÙÛÜ'.includes(ch)) out += '[UÚÙÛÜ]';
    else if ('CÇ'.includes(ch)) out += '[CÇ]';
    else if ('SZ'.includes(ch)) out += i === 0 ? ch : '[SZ]';
    else if ('WV'.includes(ch)) out += i === 0 ? ch : '[WV]';
    else out += ch;
  }
  return out;
}

/** Monta predicados parametrizados e seguros para pesquisa em `tblWRIPessoas.Nome`. */
export function montarFiltroNomeSql(
  rawNome: string,
  modoNome: ModoPesquisaNome = 'primeiro_sobrenome',
  aplicarSubstituicao = true,
): { sqlClause: string; params: Record<string, string> } | null {
  const limpo = String(rawNome || '').trim().replace(/\s+/g, ' ');
  if (limpo.length < 2) return null;

  const transform = (part: string) =>
    aplicarSubstituicao ? aplicarSubstituicaoFoneticaLike(part) : escapeSqlLikeLiteral(part.toUpperCase());

  if (modoNome === 'exata') {
    return {
      sqlClause: 'p.Nome = @NomeExato',
      params: { NomeExato: limpo },
    };
  }

  if (modoNome === 'comecar_com') {
    return {
      sqlClause: 'p.Nome LIKE @NomePrefix',
      params: { NomePrefix: `${transform(limpo)}%` },
    };
  }

  if (modoNome === 'sobrenome') {
    return {
      sqlClause: 'p.Nome LIKE @SobrenomePattern',
      params: { SobrenomePattern: `% ${transform(limpo)}%` },
    };
  }

  if (modoNome === 'qualquer_parte') {
    return {
      sqlClause: 'p.Nome LIKE @QualquerPattern',
      params: { QualquerPattern: `%${transform(limpo)}%` },
    };
  }

  // Padrão WebRI: 'primeiro_sobrenome' (Prefix Seek em p.Nome + termo do último sobrenome)
  const partes = limpo.split(' ').filter(Boolean);
  if (partes.length === 1) {
    return {
      sqlClause: 'p.Nome LIKE @PrimeiroPrefix',
      params: { PrimeiroPrefix: `${transform(partes[0])}%` },
    };
  }

  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return {
    sqlClause: '(p.Nome LIKE @PrimeiroPrefix AND (p.Nome LIKE @UltimoMidPattern OR p.Nome LIKE @UltimoEndPattern))',
    params: {
      PrimeiroPrefix: `${transform(primeiro)}%`,
      UltimoMidPattern: `% ${transform(ultimo)} %`,
      UltimoEndPattern: `% ${transform(ultimo)}`,
    },
  };
}

/** Monta a consulta de texto FTS para o SiplanIA a partir dos campos estruturados da aba Imóvel. */
export function montarCriterioSiplanIaParaImovel(filtros: FiltrosPesquisaImovel): string {
  const partes: string[] = [];

  const logradouro = String(filtros.logradouro || '').trim();
  const numero = String(filtros.numero || '').trim();
  if (logradouro) {
    partes.push(numero ? `${logradouro} ${numero}` : logradouro);
  } else if (filtros.logradouroAnterior?.trim()) {
    partes.push(filtros.logradouroAnterior.trim());
  }

  if (filtros.edificioCondominio?.trim()) partes.push(filtros.edificioCondominio.trim());
  if (filtros.loteamento?.trim()) partes.push(filtros.loteamento.trim());
  if (filtros.confrontante?.trim()) partes.push(filtros.confrontante.trim());
  if (filtros.descricaoImovel?.trim()) partes.push(filtros.descricaoImovel.trim());

  if (filtros.contribuinte?.trim()) {
    const sqlFmt = formatarContribuinteSp(filtros.contribuinte);
    if (sqlFmt) partes.unshift(sqlFmt);
  }
  if (partes.length === 0 && filtros.car?.trim()) partes.push(filtros.car.trim());
  if (partes.length === 0 && filtros.incra?.trim()) partes.push(filtros.incra.trim());
  if (partes.length === 0 && filtros.irf?.trim()) partes.push(filtros.irf.trim());
  if (partes.length === 0 && filtros.bairro?.trim()) partes.push(filtros.bairro.trim());
  if (partes.length === 0 && filtros.cep?.trim()) {
    const cepDigits = filtros.cep.replace(/\D+/g, '');
    if (cepDigits.length >= 5) partes.push(cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : cepDigits);
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function getLabelLivro(livroId: number | null | undefined, catalogs?: CatalogosPesquisaRegistral): { sessao: string; rotulo: string } {
  const id = Number(livroId || 0);
  const encontrado = catalogs?.livros.find((l) => l.id === id);
  if (encontrado) {
    const sess = encontrado.sigla || (id === 2 ? 'LV2' : id === 3 ? 'LV3' : id === 1 ? 'TRA' : `LV${id}`);
    return { sessao: sess, rotulo: encontrado.descricao };
  }
  if (id === 2) return { sessao: 'LV2', rotulo: 'Matrícula' };
  if (id === 3) return { sessao: 'LV3', rotulo: 'Registro Auxiliar' };
  if (id === 1) return { sessao: 'TRA', rotulo: 'Transcrição' };
  if (id > 0) return { sessao: `LV${id}`, rotulo: `Livro ${id}` };
  return { sessao: '', rotulo: '(S/Vínculo)' };
}

function formatDateBr(raw: unknown): string | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function getReadOnlyWebriPool(): Promise<sql.ConnectionPool | null> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test' || env.SHADOW_MODE) {
    return null;
  }

  const remoteCfg = runtimeDirective.getRemoteConfig();
  const server = remoteCfg.sqlHost || env.SQL_SERVER_HOST;
  const database = remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE;
  const encrypt =
    process.env.SQL_SERVER_ENCRYPT !== undefined
      ? process.env.SQL_SERVER_ENCRYPT === 'true'
      : env.SQL_SERVER_ENCRYPT;
  const trustServerCertificate =
    process.env.SQL_SERVER_TRUST_CERT !== undefined
      ? process.env.SQL_SERVER_TRUST_CERT !== 'false'
      : env.SQL_SERVER_TRUST_CERT;

  const key = `${server}|${database}|${env.SQL_SERVER_USER}`;
  if (sharedPool && sharedPool.connected && sharedPoolKey === key) {
    return sharedPool;
  }
  if (sharedPoolConnecting) {
    return sharedPoolConnecting;
  }

  sharedPoolConnecting = (async () => {
    try {
      if (sharedPool) {
        await sharedPool.close().catch(() => {});
        sharedPool = null;
      }
      const pool = await new sql.ConnectionPool({
        user: env.SQL_SERVER_USER,
        password: env.SQL_SERVER_PASSWORD,
        server,
        database,
        ...(process.env.SQL_SERVER_PORT ? { port: Number(process.env.SQL_SERVER_PORT) } : {}),
        connectionTimeout: 3500,
        requestTimeout: 9000,
        pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
        options: { encrypt, trustServerCertificate, requestTimeout: 9000 },
      });
      await pool.connect();
      sharedPool = pool;
      sharedPoolKey = key;
      return pool;
    } catch {
      return null;
    } finally {
      sharedPoolConnecting = null;
    }
  })();

  return sharedPoolConnecting;
}

/**
 * Carrega os catálogos dos seletores (Livros, Tipos de Imóvel, Distritos, Subdistritos, etc.)
 * do SRVSQL\WEBRI (somente leitura) com fallback para o catálogo canônico do 7º RI em caso de erro SQL 229.
 */
export async function listarCatalogosPesquisaRegistralReadOnly(): Promise<CatalogosPesquisaRegistral> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.data;
  }

  const fallback: CatalogosPesquisaRegistral = {
    ...CATALOGOS_PADRAO,
    origemBanco: 'padrao',
    avisoPermissaoWebri: false,
  };

  const pool = await getReadOnlyWebriPool();
  if (!pool) return fallback;

  try {
    const res = await pool.request().query(`
      ${SQL_PREFIX}
      SELECT PK_Id AS id, Sigla AS sigla, Descricao AS descricao FROM dbo.tblWRILivro WITH (NOLOCK) ORDER BY PK_Id;
      SELECT PK_Id AS id, TipoImovel AS descricao FROM dbo.tblWRITipoImovel WITH (NOLOCK) ORDER BY TipoImovel;
      SELECT PK_ID AS id, Distrito AS descricao FROM dbo.tblWRIDistritos WITH (NOLOCK) ORDER BY Distrito;
      SELECT PK_ID AS id, Subdistrito AS descricao FROM dbo.tblWRISubdistritos WITH (NOLOCK) ORDER BY Subdistrito;
      SELECT PK_Id AS id, TipoLogradouro AS descricao FROM dbo.tblWRITipoLogradouro WITH (NOLOCK) ORDER BY TipoLogradouro;
      SELECT PK_Id AS id, TipoArea AS descricao FROM dbo.tblWRITipoArea WITH (NOLOCK) ORDER BY TipoArea;
      SELECT PK_Id AS id, Tipo AS descricao FROM dbo.tblWRITipoConfrontante WITH (NOLOCK) ORDER BY Tipo;
      SELECT PK_Id AS id, Representacao AS sigla, UnidadeMedida AS descricao FROM dbo.tblWRIUnidadeMedida WITH (NOLOCK) ORDER BY UnidadeMedida;
    `);

    const toOpts = (rows: any[] | undefined, def: CatalogoOpcao[]): CatalogoOpcao[] => {
      if (!rows || rows.length === 0) return def;
      return rows.map((r) => ({
        id: Number(r.id),
        ...(r.sigla ? { sigla: String(r.sigla).trim() } : {}),
        descricao: String(r.descricao || '').trim(),
      }));
    };

    const recordsets = Array.isArray(res.recordsets) ? res.recordsets : [];
    const livrosDb = toOpts(recordsets[0], []);
    const catalog: CatalogosPesquisaRegistral = {
      livros: [{ id: 0, sigla: 'TODOS', descricao: 'Todos os Livros' }, ...livrosDb],
      tiposImovel: toOpts(recordsets[1], CATALOGOS_PADRAO.tiposImovel),
      distritos: toOpts(recordsets[2], CATALOGOS_PADRAO.distritos),
      subdistritos: toOpts(recordsets[3], CATALOGOS_PADRAO.subdistritos),
      tiposLogradouro: toOpts(recordsets[4], CATALOGOS_PADRAO.tiposLogradouro),
      tiposArea: toOpts(recordsets[5], CATALOGOS_PADRAO.tiposArea),
      tiposConfrontante: toOpts(recordsets[6], CATALOGOS_PADRAO.tiposConfrontante),
      unidadesMedida: toOpts(recordsets[7], CATALOGOS_PADRAO.unidadesMedida),
      origemBanco: 'webri',
      avisoPermissaoWebri: false,
    };
    catalogCache = { expiresAt: Date.now() + CATALOG_CACHE_TTL_MS, data: catalog };
    return catalog;
  } catch (err) {
    const isPerm = isSqlPermissionDenied229(err);
    const out: CatalogosPesquisaRegistral = {
      ...CATALOGOS_PADRAO,
      origemBanco: 'padrao',
      avisoPermissaoWebri: isPerm,
    };
    if (isPerm) {
      catalogCache = { expiresAt: Date.now() + 5 * 60_000, data: out };
    }
    return out;
  }
}

interface EnrichedMatriculaRealMeta {
  pkReal: number;
  livroId: number;
  numLivro: number;
  complLivro: string | null;
  situacao: number | null;
  contribuinte: string | null;
  unidade: string | null;
  tipoImovelId: number | null;
  subdistritoId: number | null;
  descricaoImovel: string | null;
  temContrLivro: boolean;
  dataBloqueio: Date | null;
  dataCancelIndisp: Date | null;
  contraditorioTipo: 'livre' | 'contraditorio' | 'indisponivel';
  contraditorioDetalhe: string | null;
  protocoloVinculado: number | null;
}

/**
 * Enriquece um lote de números de matrícula (LV2) usando exclusivamente as tabelas já autorizadas
 * (`tblWRIReal`, `tblWRIImovel`, `tblWRITitulosReal`, `tblWRITitulos`, `tblWRIRecepcao`, `tblWRITipoPrenotacao`).
 */
async function enriquecerMatriculasWebriEmLote(
  pool: sql.ConnectionPool,
  numerosLv2: number[],
): Promise<Map<number, EnrichedMatriculaRealMeta>> {
  const out = new Map<number, EnrichedMatriculaRealMeta>();
  const limpos = Array.from(new Set(numerosLv2.filter((n) => Number.isFinite(n) && n > 0))).slice(0, 80);
  if (limpos.length === 0) return out;

  const req = pool.request();
  const placeholders: string[] = [];
  limpos.forEach((n, idx) => {
    const pname = `M${idx}`;
    req.input(pname, sql.Int, n);
    placeholders.push(`@${pname}`);
  });

  const qRes = await req.query(`
    ${SQL_PREFIX}
    SELECT
      r.PK_Id AS pkReal,
      r.FK_tblWRILivro_Id AS livroId,
      r.PK_Num_Livro AS numLivro,
      NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Num_Livro, ''))), '') AS complLivro,
      r.Situacao AS situacao,
      ISNULL(r.TemContrLivro, 0) AS temContrLivro,
      r.DataBloqueio AS dataBloqueio,
      r.DataCancelIndisponibilidade AS dataCancelIndisp,
      NULLIF(LTRIM(RTRIM(ISNULL(im.Contribuinte, ''))), '') AS contribuinte,
      NULLIF(LTRIM(RTRIM(ISNULL(im.Unidade, ''))), '') AS unidade,
      im.FK_tblWRITipoIMovel_Id AS tipoImovelId,
      im.FK_tblWRISubdistritos_Id AS subdistritoId,
      NULLIF(LTRIM(RTRIM(ISNULL(im.Descricao, ''))), '') AS descricaoImovel,
      prot.numRecepcao AS protocoloVinculado,
      prot.tipoPrenotacao AS tipoPrenotacao,
      prot.tipoPrenotacaoDesc AS tipoPrenotacaoDesc
    FROM dbo.tblWRIReal r WITH (NOLOCK)
    OUTER APPLY (
      SELECT TOP (1)
        i.Contribuinte,
        i.Unidade,
        i.FK_tblWRITipoIMovel_Id,
        i.FK_tblWRISubdistritos_Id,
        i.Descricao
      FROM dbo.tblWRIImovel i WITH (NOLOCK)
      WHERE i.FK_tblWRIImovelBase_Id = r.FK_tblWRIImovelBase_Id
      ORDER BY i.PK_Versao DESC
    ) im
    OUTER APPLY (
      SELECT TOP (1)
        rec.PK_Recepcao AS numRecepcao,
        rec.TipoPrenotacao AS tipoPrenotacao,
        tp.TipoPrenotacao AS tipoPrenotacaoDesc
      FROM dbo.tblWRITitulosReal tr WITH (NOLOCK)
      INNER JOIN dbo.tblWRITitulos t WITH (NOLOCK)
        ON t.FK_tblWRIRecepcaoFlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
       AND t.FK_tblWRIRecepcaoRecepcao = tr.FK_tblWRIRecepcaoRecepcao
       AND t.PK_SeqTitulo = tr.PK_SeqTitulo
      INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
        ON rec.PK_FlagRecepcao = t.FK_tblWRIRecepcaoFlagRecepcao
       AND rec.PK_Recepcao = t.FK_tblWRIRecepcaoRecepcao
      LEFT JOIN dbo.tblWRITipoPrenotacao tp WITH (NOLOCK)
        ON tp.PK_ID = rec.TipoPrenotacao
      WHERE tr.FK_tblWRIReal_Id = r.PK_Id
        AND rec.DtCancelamento IS NULL
        AND t.DataUltimoRegistro IS NULL
        AND (rec.DtExpiraPrn IS NULL OR rec.DtExpiraPrn >= CAST(GETDATE() AS date) OR ISNULL(tp.NuncaExpira, 0) = 1)
      ORDER BY CASE WHEN rec.TipoPrenotacao IN (4, 11, 18) THEN 0 ELSE 1 END ASC, rec.PK_Recepcao DESC
    ) prot
    WHERE r.FK_tblWRILivro_Id = 2
      AND r.PK_Num_Livro IN (${placeholders.join(', ')});
  `);

  for (const row of qRes.recordset || []) {
    const numLivro = Number(row.numLivro);
    if (!Number.isFinite(numLivro) || numLivro <= 0) continue;
    const tpPren = Number(row.tipoPrenotacao || 0);
    const hasIndisp =
      tpPren === 4 ||
      tpPren === 11 ||
      tpPren === 18 ||
      Boolean(row.dataBloqueio);
    const hasContr = Boolean(row.protocoloVinculado) || Boolean(row.temContrLivro && !row.dataCancelIndisp);
    const contraditorioTipo: 'livre' | 'contraditorio' | 'indisponivel' = hasIndisp
      ? 'indisponivel'
      : hasContr
      ? 'contraditorio'
      : 'livre';
    const contraditorioDetalhe = row.protocoloVinculado
      ? `Prenotação ${row.protocoloVinculado}${row.tipoPrenotacaoDesc ? ` (${String(row.tipoPrenotacaoDesc).trim()})` : ''}`
      : hasIndisp
      ? 'Bloqueio / Indisponibilidade registrada'
      : hasContr
      ? 'Contraditório sinalizado no livro'
      : null;

    out.set(numLivro, {
      pkReal: Number(row.pkReal),
      livroId: Number(row.livroId || 2),
      numLivro,
      complLivro: row.complLivro ? String(row.complLivro).trim() : null,
      situacao: row.situacao !== null && row.situacao !== undefined ? Number(row.situacao) : null,
      contribuinte: formatarContribuinteSp(row.contribuinte),
      unidade: row.unidade ? String(row.unidade).trim() : null,
      tipoImovelId: row.tipoImovelId !== null && row.tipoImovelId !== undefined ? Number(row.tipoImovelId) : null,
      subdistritoId: row.subdistritoId !== null && row.subdistritoId !== undefined ? Number(row.subdistritoId) : null,
      descricaoImovel: row.descricaoImovel ? String(row.descricaoImovel).trim() : null,
      temContrLivro: Boolean(row.temContrLivro),
      dataBloqueio: row.dataBloqueio ? new Date(row.dataBloqueio) : null,
      dataCancelIndisp: row.dataCancelIndisp ? new Date(row.dataCancelIndisp) : null,
      contraditorioTipo,
      contraditorioDetalhe,
      protocoloVinculado: row.protocoloVinculado ? Number(row.protocoloVinculado) : null,
    });
  }

  return out;
}

function resolveNomePorCatalogo(id: number | null | undefined, lista: CatalogoOpcao[]): string | null {
  if (!id) return null;
  const hit = lista.find((x) => x.id === id);
  return hit ? hit.descricao : null;
}

function buildCaracteristicasResumo(params: {
  contribuinte?: string | null;
  tipoImovel?: string | null;
  unidade?: string | null;
  subdistrito?: string | null;
}): string {
  const parts: string[] = [];
  if (params.contribuinte) parts.push(`Contribuinte: ${params.contribuinte}`);
  if (params.tipoImovel) parts.push(params.tipoImovel);
  if (params.unidade) parts.push(`Unidade: ${params.unidade}`);
  if (params.subdistrito) parts.push(params.subdistrito);
  return parts.join(' • ') || '—';
}

function hasAnyImovelFilter(f: FiltrosPesquisaImovel): boolean {
  const strKeys: (keyof FiltrosPesquisaImovel)[] = [
    'contribuinte', 'tipoImovelTexto', 'unidade', 'distritoTexto', 'subdistritoTexto',
    'cep', 'cidade', 'bairro', 'tipoLogradouroTexto', 'logradouro', 'numero', 'complemento',
    'andar', 'pavimento', 'vaga', 'distanciaEsquina', 'edificioCondominio', 'loteamento',
    'bloco', 'setor', 'lote', 'quadra', 'gleba', 'logradouroAnterior', 'tipoAreaTexto',
    'tipoConfrontanteTexto', 'confrontante', 'tipoMedidaTexto', 'medida', 'incra', 'car',
    'irf', 'mf', 'mr', 'qmf', 'qmr', 'fraMin', 'descricaoImovel',
  ];
  for (const k of strKeys) {
    const v = f[k];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  return Boolean(
    f.tipoImovelId ||
    f.distritoId ||
    f.subdistritoId ||
    f.tipoLogradouroId ||
    f.tipoAreaId ||
    f.tipoConfrontanteId ||
    f.tipoMedidaId,
  );
}

function hasAnyPropriedadeFilter(f: FiltrosPesquisaPropriedade): boolean {
  return Boolean(
    f.somenteContraditorioIndisponibilidade ||
    (f.numeroLivro && f.numeroLivro > 0) ||
    (f.livroAntigo && f.livroAntigo > 0) ||
    (f.folha && f.folha > 0) ||
    (f.nome && f.nome.trim().length >= 2) ||
    (f.documento1 && f.documento1.trim().length >= 3) ||
    (f.documento2 && f.documento2.trim().length >= 3),
  );
}

async function pesquisarImovelEstruturadoWebri(
  pool: sql.ConnectionPool,
  filtros: FiltrosPesquisaImovel,
  catalogs: CatalogosPesquisaRegistral,
  limite: number,
): Promise<{
  itens: ItemResultadoPesquisaRegistral[];
  locationTablesOk: boolean;
  permissionDenied229: boolean;
}> {
  const req = pool.request();
  req.input('TopN', sql.Int, Math.max(10, Math.min(100, limite)));

  const conds: string[] = [];

  const contribDig = String(filtros.contribuinte || '').replace(/\D+/g, '');
  if (contribDig.length >= 4) {
    req.input('ContribPrefix', sql.VarChar(50), `${contribDig}%`);
    conds.push('i.Contribuinte LIKE @ContribPrefix');
  }
  if (filtros.maiorArea) {
    conds.push('ISNULL(i.MaiorArea, 0) = 1');
  }
  if (filtros.tipoImovelId) {
    req.input('TipoImovelId', sql.Int, filtros.tipoImovelId);
    conds.push('i.FK_tblWRITipoIMovel_Id = @TipoImovelId');
  }
  if (filtros.unidade?.trim()) {
    req.input('Unidade', sql.VarChar(50), `%${filtros.unidade.trim()}%`);
    conds.push('i.Unidade LIKE @Unidade');
  }
  if (filtros.distritoId) {
    req.input('DistritoId', sql.Int, filtros.distritoId);
    conds.push('i.FK_tblWRIDistritos_Id = @DistritoId');
  }
  if (filtros.subdistritoId) {
    req.input('SubdistritoId', sql.Int, filtros.subdistritoId);
    conds.push('i.FK_tblWRISubdistritos_Id = @SubdistritoId');
  }
  if (filtros.cep?.trim()) {
    const cepDigits = filtros.cep.replace(/\D+/g, '');
    if (cepDigits.length >= 5) {
      req.input('Cep', sql.VarChar(20), `${cepDigits.slice(0, 5)}%`);
      conds.push("REPLACE(REPLACE(ISNULL(loc.Cep, ISNULL(logr.Cep, '')), '-', ''), '.', '') LIKE @Cep");
    }
  }
  if (filtros.cidade?.trim()) {
    req.input('Cidade', sql.VarChar(100), `%${filtros.cidade.trim()}%`);
    conds.push('(cid.Cidade LIKE @Cidade OR cidLoc.Cidade LIKE @Cidade)');
  }
  if (filtros.bairro?.trim()) {
    req.input('Bairro', sql.VarChar(50), `%${filtros.bairro.trim()}%`);
    conds.push('logr.Bairro LIKE @Bairro');
  }
  if (filtros.tipoLogradouroId) {
    req.input('TipoLogrId', sql.Int, filtros.tipoLogradouroId);
    conds.push('logr.FK_tblWRITipoLogradouro_Id = @TipoLogrId');
  }
  if (filtros.logradouro?.trim()) {
    req.input('LogradouroPrefix', sql.VarChar(80), `%${filtros.logradouro.trim()}%`);
    conds.push('logr.Logradouro LIKE @LogradouroPrefix');
  }
  if (filtros.logradouroAnterior?.trim()) {
    req.input('LogrAnt', sql.VarChar(80), `%${filtros.logradouroAnterior.trim()}%`);
    conds.push('logrPai.Logradouro LIKE @LogrAnt');
  }
  if (filtros.numero?.trim()) {
    const numInt = parseInt(filtros.numero.replace(/\D+/g, ''), 10);
    if (Number.isFinite(numInt) && numInt > 0) {
      req.input('NumeroLoc', sql.Int, numInt);
      conds.push('loc.Numero = @NumeroLoc');
    }
  }
  if (filtros.complemento?.trim()) {
    req.input('Complemento', sql.VarChar(80), `%${filtros.complemento.trim()}%`);
    conds.push('loc.Complemento LIKE @Complemento');
  }
  if (filtros.andar?.trim()) {
    req.input('Andar', sql.VarChar(50), `%${filtros.andar.trim()}%`);
    conds.push('loc.Andar LIKE @Andar');
  }
  if (filtros.pavimento?.trim()) {
    req.input('Pavimento', sql.VarChar(50), `%${filtros.pavimento.trim()}%`);
    conds.push('loc.Pavimento LIKE @Pavimento');
  }
  if (filtros.vaga?.trim()) {
    req.input('Vaga', sql.VarChar(50), `%${filtros.vaga.trim()}%`);
    conds.push('loc.Vaga LIKE @Vaga');
  }
  if (filtros.distanciaEsquina?.trim()) {
    req.input('DistEsquina', sql.VarChar(50), `%${filtros.distanciaEsquina.trim()}%`);
    conds.push('loc.DistanciaEsquina LIKE @DistEsquina');
  }
  if (filtros.edificioCondominio?.trim()) {
    req.input('Condominio', sql.VarChar(200), `%${filtros.edificioCondominio.trim()}%`);
    conds.push('cond.Condominio LIKE @Condominio');
  }
  if (filtros.loteamento?.trim()) {
    req.input('Loteamento', sql.VarChar(200), `%${filtros.loteamento.trim()}%`);
    conds.push('lot.Loteamento LIKE @Loteamento');
  }
  if (filtros.bloco?.trim()) {
    req.input('Bloco', sql.VarChar(50), `%${filtros.bloco.trim()}%`);
    conds.push('blk.Bloco LIKE @Bloco');
  }
  if (filtros.setor?.trim()) {
    req.input('Setor', sql.VarChar(100), `%${filtros.setor.trim()}%`);
    conds.push('setor.Setor LIKE @Setor');
  }
  if (filtros.lote?.trim()) {
    req.input('Lote', sql.VarChar(50), `%${filtros.lote.trim()}%`);
    conds.push('loc.Lote LIKE @Lote');
  }
  if (filtros.quadra?.trim()) {
    req.input('Quadra', sql.VarChar(50), `%${filtros.quadra.trim()}%`);
    conds.push('loc.Quadra LIKE @Quadra');
  }
  if (filtros.gleba?.trim()) {
    req.input('Gleba', sql.VarChar(50), `%${filtros.gleba.trim()}%`);
    conds.push('loc.Gleba LIKE @Gleba');
  }
  if (filtros.incra?.trim()) {
    req.input('Incra', sql.VarChar(60), `${filtros.incra.trim()}%`);
    conds.push('i.Incra LIKE @Incra');
  }
  if (filtros.car?.trim()) {
    req.input('Car', sql.VarChar(60), `${filtros.car.trim()}%`);
    conds.push('car.NumeroCAR LIKE @Car');
  }
  if (filtros.irf?.trim()) {
    req.input('Irf', sql.VarChar(30), `${filtros.irf.trim()}%`);
    conds.push('i.IRF LIKE @Irf');
  }
  if (filtros.confrontante?.trim()) {
    req.input('Confrontante', sql.VarChar(250), `%${filtros.confrontante.trim()}%`);
    conds.push(
      `EXISTS (
        SELECT 1 FROM dbo.tblWRIConfrontantes cf WITH (NOLOCK)
        WHERE cf.FK_tblWRIImovel_Id = i.FK_tblWRIImovelBase_Id
          AND cf.FK_tblWRIImovel_Versao = i.PK_Versao
          AND cf.Confrontante LIKE @Confrontante
          ${filtros.tipoConfrontanteId ? 'AND cf.FK_tblWRITipoConfrontante_Id = @TipoConfId' : ''}
      )`,
    );
    if (filtros.tipoConfrontanteId) req.input('TipoConfId', sql.Int, filtros.tipoConfrontanteId);
  }
  if (filtros.medida?.trim()) {
    req.input('Medida', sql.VarChar(120), `%${filtros.medida.trim()}%`);
    conds.push(
      `EXISTS (
        SELECT 1 FROM dbo.tblWRIMedidas md WITH (NOLOCK)
        WHERE md.FK_tblWRIImovel_Id = i.FK_tblWRIImovelBase_Id
          AND md.FK_tblWRIImovel_Versao = i.PK_Versao
          AND md.Medida LIKE @Medida
          ${filtros.tipoMedidaId ? 'AND md.FK_tblWRIUnidadeMedida_Id = @TipoMedId' : ''}
      )`,
    );
    if (filtros.tipoMedidaId) req.input('TipoMedId', sql.Int, filtros.tipoMedidaId);
  }
  if (filtros.descricaoImovel?.trim()) {
    req.input('DescImovel', sql.VarChar(250), `%${filtros.descricaoImovel.trim()}%`);
    conds.push('(i.Descricao LIKE @DescImovel OR i.Denominacao LIKE @DescImovel OR loc.InformacaoAdic LIKE @DescImovel)');
  }

  if (conds.length === 0) {
    return { itens: [], locationTablesOk: true, permissionDenied229: false };
  }

  try {
    const q = await req.query(`
      ${SQL_PREFIX}
      SELECT TOP (@TopN)
        r.PK_Id AS pkReal,
        r.FK_tblWRILivro_Id AS livroId,
        r.PK_Num_Livro AS numLivro,
        NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Num_Livro, ''))), '') AS complLivro,
        ISNULL(r.TemContrLivro, 0) AS temContrLivro,
        r.DataBloqueio AS dataBloqueio,
        r.DataCancelIndisponibilidade AS dataCancelIndisp,
        i.FK_tblWRIImovelBase_Id AS pkImovelBase,
        i.PK_Versao AS pkVersao,
        NULLIF(LTRIM(RTRIM(ISNULL(i.Contribuinte, ''))), '') AS contribuinte,
        NULLIF(LTRIM(RTRIM(ISNULL(i.Unidade, ''))), '') AS unidade,
        i.FK_tblWRITipoIMovel_Id AS tipoImovelId,
        tpIm.TipoImovel AS tipoImovelDesc,
        i.FK_tblWRISubdistritos_Id AS subdistritoId,
        sub.Subdistrito AS subdistritoDesc,
        tl.TipoLogradouro AS tipoLogradouro,
        logr.Logradouro AS logradouro,
        loc.Numero AS numeroLoc,
        loc.Complemento AS complLoc,
        logr.Bairro AS bairro,
        COALESCE(cid.Cidade, cidLoc.Cidade) AS cidade,
        COALESCE(cid.UF, cidLoc.UF) AS uf,
        COALESCE(NULLIF(loc.Cep, ''), NULLIF(logr.Cep, '')) AS cep,
        blk.Bloco AS bloco,
        loc.Andar AS andar,
        loc.Pavimento AS pavimento,
        loc.Vaga AS vaga,
        loc.Ordem AS ordem,
        cond.Condominio AS condominio,
        lot.Loteamento AS loteamento,
        loc.Quadra AS quadra,
        loc.Lote AS lote,
        loc.Gleba AS gleba,
        loc.InformacaoAdic AS informacaoAdic,
        ato.PK_SeqAto AS seqAto,
        ato.DataAto AS dataAto,
        atoTit.FK_tblWRIRecepcaoRecepcao AS protoAto,
        prot.numRecepcao AS protoContraditorio,
        prot.tipoPrenotacao AS tipoPrenotacao,
        protTp.TipoPrenotacao AS tipoPrenotacaoDesc
      FROM dbo.tblWRILocalizacao loc WITH (NOLOCK)
      INNER JOIN dbo.tblWRIImovel i WITH (NOLOCK)
        ON i.FK_tblWRIImovelBase_Id = loc.FK_tblWRIImovelBase_Id
       AND i.PK_Versao = loc.FK_tblWRIImovel_Versao
      LEFT JOIN dbo.tblWRIReal r WITH (NOLOCK)
        ON r.FK_tblWRIImovelBase_Id = i.FK_tblWRIImovelBase_Id
      LEFT JOIN dbo.tblWRILogradouros logr WITH (NOLOCK)
        ON logr.PK_Id = loc.FK_tblWRILogradouros_Id
      LEFT JOIN dbo.tblWRITipoLogradouro tl WITH (NOLOCK)
        ON tl.PK_Id = logr.FK_tblWRITipoLogradouro_Id
      LEFT JOIN dbo.tblWRILogradouros logrPai WITH (NOLOCK)
        ON logrPai.PK_Id = logr.FK_tblWRILogradouro_Pai
      LEFT JOIN dbo.tblWRICidades cid WITH (NOLOCK)
        ON cid.PK_Id = logr.FK_tblWRICidades_Id
      LEFT JOIN dbo.tblWRICidades cidLoc WITH (NOLOCK)
        ON cidLoc.PK_Id = loc.FK_tblWRICidades_Id
      LEFT JOIN dbo.tblWRICondominio cond WITH (NOLOCK)
        ON cond.PK_ID = loc.FK_tblWRICondominio_Id
      LEFT JOIN dbo.tblWRIBlocos blk WITH (NOLOCK)
        ON blk.PK_Id = loc.FK_tblWRIBlocos_Id
      LEFT JOIN dbo.tblWRILoteamento lot WITH (NOLOCK)
        ON lot.PK_Id = loc.FK_tblWRILoteamento_Id
      LEFT JOIN dbo.tblWRISetores setor WITH (NOLOCK)
        ON setor.PK_ID = loc.FK_tblWRISetores_Id
      LEFT JOIN dbo.tblWRITipoImovel tpIm WITH (NOLOCK)
        ON tpIm.PK_Id = i.FK_tblWRITipoIMovel_Id
      LEFT JOIN dbo.tblWRISubdistritos sub WITH (NOLOCK)
        ON sub.PK_ID = i.FK_tblWRISubdistritos_Id
      LEFT JOIN dbo.tblWRICadastroAmbientalRural car WITH (NOLOCK)
        ON car.FK_tblWRIImovelBase_Id = i.FK_tblWRIImovelBase_Id AND car.Adicional = 0
      OUTER APPLY (
        SELECT TOP (1) a.PK_Id, a.PK_SeqAto, a.DataAto
        FROM dbo.tblWRIAtos a WITH (NOLOCK)
        WHERE a.FK_tblWRIImovel_Id = i.FK_tblWRIImovelBase_Id
          AND a.FK_tblWRIImovel_Versao = i.PK_Versao
        ORDER BY a.PK_Id DESC
      ) ato
      OUTER APPLY (
        SELECT TOP (1) atit.FK_tblWRIRecepcaoRecepcao
        FROM dbo.tblWRIAtosTitulos atit WITH (NOLOCK)
        WHERE atit.FK_tblWRIAtos_Id = ato.PK_Id
      ) atoTit
      OUTER APPLY (
        SELECT TOP (1) rec.PK_Recepcao AS numRecepcao, rec.TipoPrenotacao AS tipoPrenotacao
        FROM dbo.tblWRITitulosReal tr WITH (NOLOCK)
        INNER JOIN dbo.tblWRITitulos t WITH (NOLOCK)
          ON t.FK_tblWRIRecepcaoFlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
         AND t.FK_tblWRIRecepcaoRecepcao = tr.FK_tblWRIRecepcaoRecepcao
         AND t.PK_SeqTitulo = tr.PK_SeqTitulo
        INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
          ON rec.PK_FlagRecepcao = t.FK_tblWRIRecepcaoFlagRecepcao
         AND rec.PK_Recepcao = t.FK_tblWRIRecepcaoRecepcao
        WHERE tr.FK_tblWRIReal_Id = r.PK_Id
          AND rec.DtCancelamento IS NULL
          AND t.DataUltimoRegistro IS NULL
        ORDER BY rec.PK_Recepcao DESC
      ) prot
      LEFT JOIN dbo.tblWRITipoPrenotacao protTp WITH (NOLOCK)
        ON protTp.PK_ID = prot.tipoPrenotacao
      WHERE ${conds.join(' AND ')}
      ORDER BY CASE WHEN r.PK_Num_Livro IS NOT NULL THEN 0 ELSE 1 END ASC,
               ISNULL(r.PK_Num_Livro, 0) ASC,
               i.PK_Versao DESC;
    `);

    const grouped = new Map<string, ItemResultadoPesquisaRegistral>();
    for (const row of q.recordset || []) {
      const numLivro = row.numLivro ? Number(row.numLivro) : null;
      const livroInfo = numLivro
        ? getLabelLivro(row.livroId, catalogs)
        : { sessao: '', rotulo: '(S/Vínculo)' };
      const groupKey = numLivro
        ? `${livroInfo.sessao}:${numLivro}:${row.complLivro || ''}`
        : `sv:${row.pkImovelBase}:${row.pkVersao}`;

      const locParts: string[] = [];
      const endPrincipal = [row.tipoLogradouro, row.logradouro].filter(Boolean).join(' ').trim();
      if (endPrincipal) locParts.push(endPrincipal);
      if (row.numeroLoc && Number(row.numeroLoc) > 0) locParts.push(String(row.numeroLoc));
      if (row.complLoc) locParts.push(String(row.complLoc).trim());
      if (row.bairro) locParts.push(String(row.bairro).trim());
      if (row.cidade) locParts.push(row.uf ? `${row.cidade}/${row.uf}` : String(row.cidade));
      if (row.cep) locParts.push(`Cep:${row.cep}`);
      if (row.bloco) locParts.push(`Bloco:${row.bloco}`);
      if (row.andar) locParts.push(`Andar:${row.andar}`);
      if (row.pavimento) locParts.push(`Pavimento:${row.pavimento}`);
      if (row.vaga) locParts.push(`Vaga:${row.vaga}`);
      if (row.loteamento) locParts.push(`Loteamento:${row.loteamento}`);
      if (row.quadra) locParts.push(`Quadra:${row.quadra}`);
      if (row.lote) locParts.push(`Lote:${row.lote}`);
      if (row.gleba) locParts.push(`Gleba:${row.gleba}`);
      if (row.ordem) locParts.push(`Ordem:${row.ordem}`);
      if (row.condominio) locParts.push(`Condomínio:${row.condominio}`);
      if (row.informacaoAdic) locParts.push(`Inf.Adicionais:${String(row.informacaoAdic).trim()}`);
      const locStr = locParts.join(', ');

      const origemCitada = !numLivro ? extrairMatriculaOrigemCitada(row.informacaoAdic || locStr) : null;
      const prev = grouped.get(groupKey);
      if (prev) {
        if (locStr && !prev.localizacaoResumo.includes(locStr)) {
          prev.localizacaoResumo = `${prev.localizacaoResumo} | ${locStr}`;
        }
        if (!prev.matriculaOrigemCitada && origemCitada) {
          prev.matriculaOrigemCitada = origemCitada;
        }
        continue;
      }

      const contrib = formatarContribuinteSp(row.contribuinte);
      const tipoImovel =
        (row.tipoImovelDesc ? String(row.tipoImovelDesc).trim() : null) ||
        resolveNomePorCatalogo(row.tipoImovelId, catalogs.tiposImovel);
      const unidade = row.unidade ? String(row.unidade).trim() : null;
      const subdistrito =
        (row.subdistritoDesc ? String(row.subdistritoDesc).trim() : null) ||
        resolveNomePorCatalogo(row.subdistritoId, catalogs.subdistritos);

      const tpPren = Number(row.tipoPrenotacao || 0);
      const isIndisp = tpPren === 4 || tpPren === 11 || tpPren === 18 || Boolean(row.dataBloqueio);
      const isContr = Boolean(row.protoContraditorio) || Boolean(row.temContrLivro && !row.dataCancelIndisp);
      const dtAtoBr = formatDateBr(row.dataAto);
      const atoResumo = row.seqAto
        ? `Ato: ${row.seqAto}${dtAtoBr ? ` (${dtAtoBr})` : ''}${row.protoAto ? ` • Recep. ${row.protoAto}` : ''}`
        : numLivro
        ? 'Ato: (S/Vínculo)'
        : 'Ato: (S/Vínculo)';

      grouped.set(groupKey, {
        id: `webri:${groupKey}`,
        origem: 'webri',
        sessao: livroInfo.sessao,
        livroRotulo: livroInfo.rotulo,
        numeroLivro: numLivro,
        complementoLivro: row.complLivro ? String(row.complLivro).trim() : null,
        matriculaOrigemCitada: origemCitada,
        atoResumo,
        protocoloVinculado: row.protoContraditorio ? Number(row.protoContraditorio) : row.protoAto ? Number(row.protoAto) : null,
        contraditorioIndisponibilidade: isIndisp ? 'indisponivel' : isContr ? 'contraditorio' : 'livre',
        contraditorioDetalhe: row.protoContraditorio
          ? `Prenotação ${row.protoContraditorio}${row.tipoPrenotacaoDesc ? ` (${row.tipoPrenotacaoDesc})` : ''}`
          : isIndisp
          ? 'Indisponibilidade / Bloqueio'
          : null,
        contribuinte: contrib,
        tipoImovel,
        unidade,
        subdistrito,
        caracteristicasResumo: buildCaracteristicasResumo({
          contribuinte: contrib,
          tipoImovel,
          unidade,
          subdistrito,
        }),
        participanteNome: null,
        participanteDocumento: null,
        participanteQualificacao: null,
        localizacaoResumo: locStr || '—',
        confrontantesResumo: null,
        medidasResumo: null,
        paginaOcrEncontrada: null,
        qtdPaginasOcr: null,
        trechoOcr: null,
        termoDestaqueSugerido: [filtros.logradouro, filtros.numero, filtros.contribuinte, filtros.edificioCondominio]
          .filter(Boolean)
          .join(' ')
          .trim(),
      });
    }

    return {
      itens: Array.from(grouped.values()).slice(0, limite),
      locationTablesOk: true,
      permissionDenied229: false,
    };
  } catch (err) {
    if (isSqlPermissionDenied229(err)) {
      return { itens: [], locationTablesOk: false, permissionDenied229: true };
    }
    return { itens: [], locationTablesOk: false, permissionDenied229: false };
  }
}

async function pesquisarPropriedadeWebri(
  pool: sql.ConnectionPool,
  filtros: FiltrosPesquisaPropriedade,
  catalogs: CatalogosPesquisaRegistral,
  limite: number,
): Promise<{
  itens: ItemResultadoPesquisaRegistral[];
  webriOk: boolean;
  permissionDenied229: boolean;
}> {
  const results: ItemResultadoPesquisaRegistral[] = [];
  const seenResultIds = new Set<string>();
  let permissionDenied229 = false;
  let webriOk = true;

  // 1. Consulta direta por Livro / Nº / Livro Antigo / Folha ou filtro isolado Contraditório/Indisponibilidade em tblWRIReal
  const temFiltroLivroNumero = Boolean(
    (filtros.numeroLivro && filtros.numeroLivro > 0) ||
    (filtros.livroAntigo && filtros.livroAntigo > 0) ||
    (filtros.folha && filtros.folha > 0),
  );
  const somenteContrStandalone = Boolean(
    filtros.somenteContraditorioIndisponibilidade &&
    !temFiltroLivroNumero &&
    !filtros.nome?.trim() &&
    !filtros.documento1?.trim() &&
    !filtros.documento2?.trim(),
  );

  if (temFiltroLivroNumero || somenteContrStandalone) {
    try {
      const req = pool.request();
      req.input('TopN', sql.Int, Math.max(10, Math.min(100, limite)));
      const conds: string[] = [];
      if (filtros.livroId && filtros.livroId > 0) {
        req.input('LivroId', sql.SmallInt, filtros.livroId);
        conds.push('r.FK_tblWRILivro_Id = @LivroId');
      }
      if (temFiltroLivroNumero) {
        if (filtros.numeroLivro && filtros.numeroLivro > 0) {
          req.input('NumLivro', sql.Int, filtros.numeroLivro);
          conds.push('r.PK_Num_Livro = @NumLivro');
        }
        if (filtros.livroCompl?.trim()) {
          req.input('ComplLivro', sql.VarChar(50), filtros.livroCompl.trim());
          conds.push('r.PK_Compl_Num_Livro = @ComplLivro');
        }
        if (filtros.livroAntigo && filtros.livroAntigo > 0) {
          req.input('LivroAnt', sql.Int, filtros.livroAntigo);
          conds.push('r.PK_Livro_Antigo = @LivroAnt');
        }
        if (filtros.livroAntigoCompl?.trim()) {
          req.input('ComplLivroAnt', sql.VarChar(50), filtros.livroAntigoCompl.trim());
          conds.push('r.PK_Compl_Livro_Antigo = @ComplLivroAnt');
        }
        if (filtros.folha && filtros.folha > 0) {
          req.input('FolhaAnt', sql.Int, filtros.folha);
          conds.push('r.PK_Folha_Antigo = @FolhaAnt');
        }
        if (filtros.folhaCompl?.trim()) {
          req.input('ComplFolhaAnt', sql.VarChar(50), filtros.folhaCompl.trim());
          conds.push('r.PK_Compl_Folha_Antigo = @ComplFolhaAnt');
        }
      } else if (somenteContrStandalone) {
        conds.push(
          '(r.DataBloqueio IS NOT NULL OR (ISNULL(r.TemContrLivro, 0) = 1 AND r.DataCancelIndisponibilidade IS NULL) OR prot.numRecepcao IS NOT NULL)',
        );
      }

      const orderClause = somenteContrStandalone
        ? 'ORDER BY r.PK_Id DESC'
        : 'ORDER BY r.FK_tblWRILivro_Id ASC, r.PK_Num_Livro ASC';

      const realRes = await req.query(`
        ${SQL_PREFIX}
        SELECT TOP (@TopN)
          r.PK_Id AS pkReal,
          r.FK_tblWRILivro_Id AS livroId,
          r.PK_Num_Livro AS numLivro,
          NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Num_Livro, ''))), '') AS complLivro,
          r.PK_Livro_Antigo AS livroAntigo,
          NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Livro_Antigo, ''))), '') AS complLivroAntigo,
          r.PK_Folha_Antigo AS folhaAntigo,
          r.Situacao AS situacao,
          ISNULL(r.TemContrLivro, 0) AS temContrLivro,
          r.DataBloqueio AS dataBloqueio,
          r.DataCancelIndisponibilidade AS dataCancelIndisp,
          NULLIF(LTRIM(RTRIM(ISNULL(im.Contribuinte, ''))), '') AS contribuinte,
          NULLIF(LTRIM(RTRIM(ISNULL(im.Unidade, ''))), '') AS unidade,
          im.FK_tblWRITipoIMovel_Id AS tipoImovelId,
          im.FK_tblWRISubdistritos_Id AS subdistritoId,
          NULLIF(LTRIM(RTRIM(ISNULL(im.Descricao, ''))), '') AS descricaoImovel,
          prot.numRecepcao AS protoContraditorio,
          prot.tipoPrenotacao AS tipoPrenotacao,
          protTp.TipoPrenotacao AS tipoPrenotacaoDesc
        FROM dbo.tblWRIReal r WITH (NOLOCK)
        OUTER APPLY (
          SELECT TOP (1)
            i.Contribuinte,
            i.Unidade,
            i.FK_tblWRITipoIMovel_Id,
            i.FK_tblWRISubdistritos_Id,
            i.Descricao
          FROM dbo.tblWRIImovel i WITH (NOLOCK)
          WHERE i.FK_tblWRIImovelBase_Id = r.FK_tblWRIImovelBase_Id
          ORDER BY i.PK_Versao DESC
        ) im
        OUTER APPLY (
          SELECT TOP (1) rec.PK_Recepcao AS numRecepcao, rec.TipoPrenotacao AS tipoPrenotacao
          FROM dbo.tblWRITitulosReal tr WITH (NOLOCK)
          INNER JOIN dbo.tblWRITitulos t WITH (NOLOCK)
            ON t.FK_tblWRIRecepcaoFlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
           AND t.FK_tblWRIRecepcaoRecepcao = tr.FK_tblWRIRecepcaoRecepcao
           AND t.PK_SeqTitulo = tr.PK_SeqTitulo
          INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
            ON rec.PK_FlagRecepcao = t.FK_tblWRIRecepcaoFlagRecepcao
           AND rec.PK_Recepcao = t.FK_tblWRIRecepcaoRecepcao
          WHERE tr.FK_tblWRIReal_Id = r.PK_Id
            AND rec.DtCancelamento IS NULL
            AND t.DataUltimoRegistro IS NULL
          ORDER BY rec.PK_Recepcao DESC
        ) prot
        LEFT JOIN dbo.tblWRITipoPrenotacao protTp WITH (NOLOCK)
          ON protTp.PK_ID = prot.tipoPrenotacao
        WHERE ${conds.join(' AND ')}
        ${orderClause};
      `);

      for (const row of realRes.recordset || []) {
        const numLivro = Number(row.numLivro || 0);
        const livroInfo = getLabelLivro(row.livroId, catalogs);
        const contrib = formatarContribuinteSp(row.contribuinte);
        const tipoImovel = resolveNomePorCatalogo(row.tipoImovelId, catalogs.tiposImovel);
        const unidade = row.unidade ? String(row.unidade).trim() : null;
        const subdistrito = resolveNomePorCatalogo(row.subdistritoId, catalogs.subdistritos);
        const tpPren = Number(row.tipoPrenotacao || 0);
        const isIndisp = tpPren === 4 || tpPren === 11 || tpPren === 18 || Boolean(row.dataBloqueio);
        const isContr = Boolean(row.protoContraditorio) || Boolean(row.temContrLivro && !row.dataCancelIndisp);
        if (filtros.somenteContraditorioIndisponibilidade && !isIndisp && !isContr) {
          continue;
        }
        const situacaoStr =
          row.situacao === 2 ? 'Encerrada' : row.situacao === 1 ? 'Empreendimento' : 'Em Aberto';
        const livroAntDesc =
          row.livroAntigo && Number(row.livroAntigo) > 0
            ? `Liv.Antigo ${row.livroAntigo}${row.folhaAntigo ? ` Fls. ${row.folhaAntigo}` : ''}`
            : null;
        const rowId = `webri:${livroInfo.sessao}:${numLivro}:${row.complLivro || ''}`;
        if (seenResultIds.has(rowId)) continue;
        seenResultIds.add(rowId);

        results.push({
          id: rowId,
          origem: 'webri',
          sessao: livroInfo.sessao,
          livroRotulo: livroInfo.rotulo,
          numeroLivro: numLivro > 0 ? numLivro : null,
          complementoLivro: row.complLivro ? String(row.complLivro).trim() : null,
          matriculaOrigemCitada: null,
          atoResumo: [situacaoStr, livroAntDesc].filter(Boolean).join(' • '),
          protocoloVinculado: row.protoContraditorio ? Number(row.protoContraditorio) : null,
          contraditorioIndisponibilidade: isIndisp ? 'indisponivel' : isContr ? 'contraditorio' : 'livre',
          contraditorioDetalhe: row.protoContraditorio
            ? `Prenotação ${row.protoContraditorio}${row.tipoPrenotacaoDesc ? ` (${row.tipoPrenotacaoDesc})` : ''}`
            : isIndisp
            ? 'Indisponibilidade / Bloqueio'
            : isContr
            ? 'Contraditório sinalizado no livro'
            : null,
          contribuinte: contrib,
          tipoImovel,
          unidade,
          subdistrito,
          caracteristicasResumo: buildCaracteristicasResumo({
            contribuinte: contrib,
            tipoImovel,
            unidade,
            subdistrito,
          }),
          participanteNome: null,
          participanteDocumento: null,
          participanteQualificacao: null,
          localizacaoResumo: row.descricaoImovel ? String(row.descricaoImovel).slice(0, 220) : `${livroInfo.rotulo} ${numLivro || ''}`,
          confrontantesResumo: null,
          medidasResumo: null,
          paginaOcrEncontrada: null,
          qtdPaginasOcr: null,
          trechoOcr: null,
          termoDestaqueSugerido: numLivro > 0 ? String(numLivro) : '',
        });
      }
    } catch (err) {
      if (isSqlPermissionDenied229(err)) permissionDenied229 = true;
      else webriOk = false;
    }
  }

  // 2. Pesquisa no Indicador Pessoal (Nome + CPF/CNPJ + Período) — 100% READ-ONLY (sem gravar tblWRILogOcorrencias!)
  const nomeFiltro = filtros.nome?.trim()
    ? montarFiltroNomeSql(filtros.nome, filtros.modoNome, filtros.aplicarSubstituicao ?? true)
    : null;
  const doc1Raw = String(filtros.documento1 || '').trim();
  const doc2Raw = String(filtros.documento2 || '').trim();
  const temDoc = doc1Raw.length >= 3 || doc2Raw.length >= 3;

  if (nomeFiltro || temDoc) {
    try {
      const req = pool.request();
      req.input('TopN', sql.Int, Math.max(10, Math.min(100, limite)));
      if (nomeFiltro) {
        for (const [k, v] of Object.entries(nomeFiltro.params)) {
          req.input(k, sql.VarChar(300), v);
        }
      }

      const docClauses: string[] = [];
      const addDocVariants = (prefix: string, val: string) => {
        const clean = val.trim();
        const digits = clean.replace(/\D+/g, '');
        const fmt = formatarDocumentoCpfCnpj(clean);
        const variants = Array.from(new Set([clean, digits, fmt].filter((x): x is string => Boolean(x && x.length >= 3))));
        const sub: string[] = [];
        variants.forEach((v, idx) => {
          const pName = `${prefix}_${idx}`;
          req.input(pName, sql.VarChar(40), `${escapeSqlLikeLiteral(v)}%`);
          sub.push(`d.Numero_Documento LIKE @${pName}`);
        });
        if (sub.length > 0) docClauses.push(`(${sub.join(' OR ')})`);
      };
      if (doc1Raw.length >= 3) addDocVariants('Doc1', doc1Raw);
      if (doc2Raw.length >= 3) addDocVariants('Doc2', doc2Raw);

      let personClause = '';
      if (nomeFiltro && docClauses.length > 0) {
        const docExists = `EXISTS (SELECT 1 FROM dbo.tblWRIDocumentos d WITH (NOLOCK) WHERE d.FK_tblWRIPessoas_Id = p.PK_id AND (${docClauses.join(' OR ')}))`;
        personClause = filtros.nomeMaisDocumento
          ? `(${nomeFiltro.sqlClause} AND ${docExists})`
          : `(${nomeFiltro.sqlClause} OR ${docExists})`;
      } else if (nomeFiltro) {
        personClause = nomeFiltro.sqlClause;
      } else if (docClauses.length > 0) {
        personClause = `EXISTS (SELECT 1 FROM dbo.tblWRIDocumentos d WITH (NOLOCK) WHERE d.FK_tblWRIPessoas_Id = p.PK_id AND (${docClauses.join(' OR ')}))`;
      }

      const actConds: string[] = ['a.DataAto IS NOT NULL', '(partTp.NaoConsultaIndicador = 0 OR partTp.NaoConsultaIndicador IS NULL)'];
      if (filtros.livroId && filtros.livroId > 0) {
        req.input('LivroIdAct', sql.SmallInt, filtros.livroId);
        actConds.push('r.FK_tblWRILivro_Id = @LivroIdAct');
      }
      if (filtros.dtRegInicial?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dtRegInicial.trim())) {
        req.input('DtIni', sql.VarChar(10), filtros.dtRegInicial.trim());
        actConds.push('a.DataAto >= CONVERT(smalldatetime, @DtIni, 120)');
      }
      if (filtros.dtRegFinal?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dtRegFinal.trim())) {
        req.input('DtFim', sql.VarChar(10), filtros.dtRegFinal.trim());
        actConds.push('a.DataAto <= DATEADD(day, 1, CONVERT(smalldatetime, @DtFim, 120))');
      }

      const qPessoas = await req.query(`
        ${SQL_PREFIX}
        WITH PessoasCand AS (
          SELECT TOP (60) p.PK_id, p.Nome, p.DocumentosFull
          FROM dbo.tblWRIPessoas p WITH (NOLOCK)
          WHERE ${personClause}
        )
        SELECT TOP (@TopN)
          pc.PK_id AS pessoaId,
          pc.Nome AS pessoaNome,
          pc.DocumentosFull AS pessoaDocs,
          partTp.Participacao AS participacao,
          r.FK_tblWRILivro_Id AS livroId,
          liv.Indisponibilidade AS livroIndisponibilidade,
          r.PK_Num_Livro AS numLivro,
          NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Num_Livro, ''))), '') AS complLivro,
          ISNULL(r.TemContrLivro, 0) AS temContrLivro,
          r.DataBloqueio AS dataBloqueio,
          r.DataCancelIndisponibilidade AS dataCancelIndispReal,
          ap.DataCancelIndisponibilidade AS dataCancelIndispPart,
          ta.Tipo AS tipoAto,
          a.PK_SeqAto AS seqAto,
          a.CompleAto AS compleAto,
          a.DataAto AS dataAto,
          neg.Negocio AS negocio,
          atoTit.FK_tblWRIRecepcaoRecepcao AS protoAto,
          NULLIF(LTRIM(RTRIM(ISNULL(im.Contribuinte, ''))), '') AS contribuinte,
          NULLIF(LTRIM(RTRIM(ISNULL(im.Unidade, ''))), '') AS unidade,
          im.FK_tblWRITipoIMovel_Id AS tipoImovelId,
          im.FK_tblWRISubdistritos_Id AS subdistritoId,
          prot.numRecepcao AS protoContraditorio,
          prot.tipoPrenotacao AS tipoPrenotacao,
          protTp.TipoPrenotacao AS tipoPrenotacaoDesc
        FROM PessoasCand pc
        INNER JOIN dbo.tblWRIAtosParticipantes ap WITH (NOLOCK)
          ON ap.FK_tblWRIPessoas_Id = pc.PK_id
        INNER JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK)
          ON an.PK_ID = ap.FK_tblWRIAtosNegocios_Id
        INNER JOIN dbo.tblWRIAtos a WITH (NOLOCK)
          ON a.PK_Id = an.FK_tblWRIAtos_Id
        INNER JOIN dbo.tblWRIReal r WITH (NOLOCK)
          ON r.PK_Id = a.FK_tblWRIReal_Id
        LEFT JOIN dbo.tblWRILivro liv WITH (NOLOCK)
          ON liv.PK_Id = r.FK_tblWRILivro_Id
        INNER JOIN dbo.tblWRINegocios neg WITH (NOLOCK)
          ON neg.PK_Id = an.FK_tblWRINegocios_Id
        INNER JOIN dbo.tblWRITipoAtos ta WITH (NOLOCK)
          ON ta.PK_Id = neg.FK_tblWRITipoatos_id
        INNER JOIN dbo.tblWRITpParticipacao partTp WITH (NOLOCK)
          ON partTp.PK_Id = ap.FK_tblWRITpParticipacao_Id
        OUTER APPLY (
          SELECT TOP (1) atit.FK_tblWRIRecepcaoRecepcao
          FROM dbo.tblWRIAtosTitulos atit WITH (NOLOCK)
          WHERE atit.FK_tblWRIAtos_Id = a.PK_Id
        ) atoTit
        OUTER APPLY (
          SELECT TOP (1)
            i.Contribuinte,
            i.Unidade,
            i.FK_tblWRITipoIMovel_Id,
            i.FK_tblWRISubdistritos_Id
          FROM dbo.tblWRIImovel i WITH (NOLOCK)
          WHERE i.FK_tblWRIImovelBase_Id = r.FK_tblWRIImovelBase_Id
          ORDER BY i.PK_Versao DESC
        ) im
        OUTER APPLY (
          SELECT TOP (1) rec.PK_Recepcao AS numRecepcao, rec.TipoPrenotacao AS tipoPrenotacao
          FROM dbo.tblWRITitulosReal tr WITH (NOLOCK)
          INNER JOIN dbo.tblWRITitulos t WITH (NOLOCK)
            ON t.FK_tblWRIRecepcaoFlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
           AND t.FK_tblWRIRecepcaoRecepcao = tr.FK_tblWRIRecepcaoRecepcao
           AND t.PK_SeqTitulo = tr.PK_SeqTitulo
          INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
            ON rec.PK_FlagRecepcao = t.FK_tblWRIRecepcaoFlagRecepcao
           AND rec.PK_Recepcao = t.FK_tblWRIRecepcaoRecepcao
          WHERE tr.FK_tblWRIReal_Id = r.PK_Id
            AND rec.DtCancelamento IS NULL
            AND t.DataUltimoRegistro IS NULL
          ORDER BY rec.PK_Recepcao DESC
        ) prot
        LEFT JOIN dbo.tblWRITipoPrenotacao protTp WITH (NOLOCK)
          ON protTp.PK_ID = prot.tipoPrenotacao
        WHERE ${actConds.join(' AND ')}
        ORDER BY r.PK_Num_Livro DESC, a.PK_SeqAto ASC;
      `);

      for (const row of qPessoas.recordset || []) {
        const numLivro = Number(row.numLivro || 0);
        const livroInfo = getLabelLivro(row.livroId, catalogs);
        const tpPren = Number(row.tipoPrenotacao || 0);
        const isIndispLivro =
          Boolean(row.livroIndisponibilidade) &&
          (!row.dataCancelIndispReal || !row.dataCancelIndispPart);
        const isIndisp =
          isIndispLivro ||
          tpPren === 4 ||
          tpPren === 11 ||
          tpPren === 18 ||
          Boolean(row.dataBloqueio);
        const isContr = Boolean(row.protoContraditorio) || Boolean(row.temContrLivro && !row.dataCancelIndispReal);
        if (filtros.somenteContraditorioIndisponibilidade && !isIndisp && !isContr) {
          continue;
        }

        const contrib = formatarContribuinteSp(row.contribuinte);
        const tipoImovel = resolveNomePorCatalogo(row.tipoImovelId, catalogs.tiposImovel);
        const unidade = row.unidade ? String(row.unidade).trim() : null;
        const subdistrito = resolveNomePorCatalogo(row.subdistritoId, catalogs.subdistritos);
        const dtAtoBr = formatDateBr(row.dataAto);
        const atoStr = [
          row.tipoAto ? `${String(row.tipoAto).trim()} ${row.seqAto || ''}`.trim() : null,
          row.compleAto ? String(row.compleAto).trim() : null,
          dtAtoBr ? `(${dtAtoBr})` : null,
          row.negocio ? String(row.negocio).trim() : null,
        ]
          .filter(Boolean)
          .join(' ');

        const nomeP = row.pessoaNome ? String(row.pessoaNome).trim() : null;
        const docsP = row.pessoaDocs ? String(row.pessoaDocs).trim() : null;
        const qualP = row.participacao ? String(row.participacao).trim() : null;
        const rowId = `webri:${livroInfo.sessao}:${numLivro}:${row.complLivro || ''}:${row.pessoaId}:${row.seqAto || 0}:${qualP || ''}`;
        if (seenResultIds.has(rowId)) continue;
        seenResultIds.add(rowId);

        results.push({
          id: rowId,
          origem: 'webri',
          sessao: livroInfo.sessao,
          livroRotulo: livroInfo.rotulo,
          numeroLivro: numLivro > 0 ? numLivro : null,
          complementoLivro: row.complLivro ? String(row.complLivro).trim() : null,
          matriculaOrigemCitada: null,
          atoResumo: atoStr || '—',
          protocoloVinculado: row.protoContraditorio
            ? Number(row.protoContraditorio)
            : row.protoAto
            ? Number(row.protoAto)
            : null,
          contraditorioIndisponibilidade: isIndisp ? 'indisponivel' : isContr ? 'contraditorio' : 'livre',
          contraditorioDetalhe: row.protoContraditorio
            ? `Prenotação ${row.protoContraditorio}${row.tipoPrenotacaoDesc ? ` (${row.tipoPrenotacaoDesc})` : ''}`
            : isIndisp
            ? 'Indisponibilidade / Bloqueio'
            : null,
          contribuinte: contrib,
          tipoImovel,
          unidade,
          subdistrito,
          caracteristicasResumo: buildCaracteristicasResumo({
            contribuinte: contrib,
            tipoImovel,
            unidade,
            subdistrito,
          }),
          participanteNome: nomeP,
          participanteDocumento: docsP,
          participanteQualificacao: qualP,
          localizacaoResumo: [nomeP, docsP, qualP ? `(${qualP})` : null, row.negocio].filter(Boolean).join(' • '),
          confrontantesResumo: null,
          medidasResumo: null,
          paginaOcrEncontrada: null,
          qtdPaginasOcr: null,
          trechoOcr: null,
          termoDestaqueSugerido: (filtros.nome || filtros.documento1 || filtros.documento2 || nomeP || '').trim(),
        });
      }
    } catch (err) {
      if (isSqlPermissionDenied229(err)) permissionDenied229 = true;
      else webriOk = false;
    }
  }

  return { itens: results, webriOk, permissionDenied229 };
}

/**
 * Fallback somente-leitura usando apenas as tabelas já liberadas (`tblWRIImovel` + `tblWRIReal`)
 * quando o usuário preenche atributos diretos de imóvel e as tabelas auxiliares de logradouros ainda estão com erro 229.
 */
async function pesquisarImovelBasicoWebriFallback(
  pool: sql.ConnectionPool,
  filtros: FiltrosPesquisaImovel,
  catalogs: CatalogosPesquisaRegistral,
  limite: number,
): Promise<ItemResultadoPesquisaRegistral[]> {
  const req = pool.request();
  req.input('TopN', sql.Int, Math.max(10, Math.min(50, limite)));
  const conds: string[] = [];

  const contribDig = String(filtros.contribuinte || '').replace(/\D+/g, '');
  if (contribDig.length >= 6) {
    req.input('ContribPrefix', sql.VarChar(50), `${contribDig}%`);
    conds.push('i.Contribuinte LIKE @ContribPrefix');
  }
  if (filtros.unidade?.trim()) {
    req.input('Unidade', sql.VarChar(50), `%${filtros.unidade.trim()}%`);
    conds.push('i.Unidade LIKE @Unidade');
  }
  if (filtros.incra?.trim()) {
    req.input('Incra', sql.VarChar(60), `${filtros.incra.trim()}%`);
    conds.push('i.Incra LIKE @Incra');
  }
  if (filtros.irf?.trim()) {
    req.input('Irf', sql.VarChar(30), `${filtros.irf.trim()}%`);
    conds.push('i.IRF LIKE @Irf');
  }
  // Exige pelo menos 1 critério altamente seletivo neste fallback sem JOIN de logradouros
  if (conds.length === 0) return [];

  if (filtros.maiorArea) conds.push('ISNULL(i.MaiorArea, 0) = 1');
  if (filtros.tipoImovelId && catalogs.origemBanco === 'webri') {
    req.input('TipoImovelId', sql.Int, filtros.tipoImovelId);
    conds.push('i.FK_tblWRITipoIMovel_Id = @TipoImovelId');
  }
  if (filtros.subdistritoId && catalogs.origemBanco === 'webri') {
    req.input('SubdistritoId', sql.Int, filtros.subdistritoId);
    conds.push('i.FK_tblWRISubdistritos_Id = @SubdistritoId');
  }

  try {
    const q = await req.query(`
      ${SQL_PREFIX}
      SELECT TOP (@TopN)
        r.FK_tblWRILivro_Id AS livroId,
        r.PK_Num_Livro AS numLivro,
        NULLIF(LTRIM(RTRIM(ISNULL(r.PK_Compl_Num_Livro, ''))), '') AS complLivro,
        ISNULL(r.TemContrLivro, 0) AS temContrLivro,
        r.DataBloqueio AS dataBloqueio,
        r.DataCancelIndisponibilidade AS dataCancelIndisp,
        NULLIF(LTRIM(RTRIM(ISNULL(i.Contribuinte, ''))), '') AS contribuinte,
        NULLIF(LTRIM(RTRIM(ISNULL(i.Unidade, ''))), '') AS unidade,
        i.FK_tblWRITipoIMovel_Id AS tipoImovelId,
        i.FK_tblWRISubdistritos_Id AS subdistritoId,
        NULLIF(LTRIM(RTRIM(ISNULL(i.Descricao, ''))), '') AS descricaoImovel
      FROM dbo.tblWRIImovel i WITH (NOLOCK)
      INNER JOIN dbo.tblWRIReal r WITH (NOLOCK)
        ON r.FK_tblWRIImovelBase_Id = i.FK_tblWRIImovelBase_Id
      WHERE ${conds.join(' AND ')}
      ORDER BY r.FK_tblWRILivro_Id ASC, r.PK_Num_Livro ASC, i.PK_Versao DESC;
    `);

    const items: ItemResultadoPesquisaRegistral[] = [];
    const seen = new Set<string>();
    for (const row of q.recordset || []) {
      const numLivro = Number(row.numLivro || 0);
      if (numLivro <= 0) continue;
      const livroInfo = getLabelLivro(row.livroId, catalogs);
      const key = `${livroInfo.sessao}:${numLivro}:${row.complLivro || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const contrib = formatarContribuinteSp(row.contribuinte);
      const tipoImovel = resolveNomePorCatalogo(row.tipoImovelId, catalogs.tiposImovel);
      const unidade = row.unidade ? String(row.unidade).trim() : null;
      const subdistrito = resolveNomePorCatalogo(row.subdistritoId, catalogs.subdistritos);
      const isIndisp = Boolean(row.dataBloqueio);
      const isContr = Boolean(row.temContrLivro && !row.dataCancelIndisp);

      items.push({
        id: `webri:${key}`,
        origem: 'webri',
        sessao: livroInfo.sessao,
        livroRotulo: livroInfo.rotulo,
        numeroLivro: numLivro,
        complementoLivro: row.complLivro ? String(row.complLivro).trim() : null,
        matriculaOrigemCitada: null,
        atoResumo: null,
        protocoloVinculado: null,
        contraditorioIndisponibilidade: isIndisp ? 'indisponivel' : isContr ? 'contraditorio' : 'livre',
        contraditorioDetalhe: isIndisp ? 'Indisponibilidade / Bloqueio' : null,
        contribuinte: contrib,
        tipoImovel,
        unidade,
        subdistrito,
        caracteristicasResumo: buildCaracteristicasResumo({
          contribuinte: contrib,
          tipoImovel,
          unidade,
          subdistrito,
        }),
        participanteNome: null,
        participanteDocumento: null,
        participanteQualificacao: null,
        localizacaoResumo: row.descricaoImovel ? String(row.descricaoImovel).slice(0, 220) : `${livroInfo.rotulo} ${numLivro}`,
        confrontantesResumo: null,
        medidasResumo: null,
        paginaOcrEncontrada: null,
        qtdPaginasOcr: null,
        trechoOcr: null,
        termoDestaqueSugerido: contrib || unidade || String(numLivro),
      });
    }
    return items;
  } catch {
    return [];
  }
}

function buildQuerySiplanIaPropriedade(filtros: FiltrosPesquisaPropriedade): {
  queryText: string;
  modoExatoOuFrase: boolean;
  permitirNumericoPuro: boolean;
} {
  const nome = String(filtros.nome || '').trim();
  const doc1 = formatarDocumentoCpfCnpj(filtros.documento1) || String(filtros.documento1 || '').trim();
  const doc2 = formatarDocumentoCpfCnpj(filtros.documento2) || String(filtros.documento2 || '').trim();
  const docAtivo = doc1 || doc2;

  if (filtros.nomeMaisDocumento && nome && docAtivo) {
    return {
      queryText: `${nome} ${docAtivo}`,
      modoExatoOuFrase: false,
      permitirNumericoPuro: true,
    };
  }
  if (docAtivo && !nome) {
    return {
      queryText: docAtivo,
      modoExatoOuFrase: false,
      permitirNumericoPuro: true,
    };
  }
  return {
    queryText: nome,
    modoExatoOuFrase: filtros.modoNome === 'exata',
    permitirNumericoPuro: false,
  };
}

function cloneResultado(res: ResultadoPesquisaRegistral): ResultadoPesquisaRegistral {
  return {
    ...res,
    itens: res.itens.map((i) => ({ ...i })),
    contadores: { ...res.contadores },
    fontesConsultadas: { ...res.fontesConsultadas },
  };
}

/**
 * Executa a Pesquisa Registral Híbrida 100% Somente-Leitura unindo SRVSQL\WEBRI + OCR SiplanIA.
 */
export async function executarPesquisaRegistralHibridaReadOnly(
  input: InputPesquisaRegistral,
): Promise<ResultadoPesquisaRegistral> {
  const inicio = Date.now();
  const aba: 'imovel' | 'propriedade' = input.aba === 'propriedade' ? 'propriedade' : 'imovel';
  const limite = Math.max(10, Math.min(100, Math.trunc(input.limite ?? 80)));

  if (aba === 'imovel' && !hasAnyImovelFilter(input.filtrosImovel || {})) {
    throw new Error('Informe ao menos um campo do imóvel ou endereço para pesquisar.');
  }
  if (aba === 'propriedade' && !hasAnyPropriedadeFilter(input.filtrosPropriedade || {})) {
    throw new Error('Informe ao menos o nº do livro, nome da parte ou documento para pesquisar.');
  }

  const cacheKey = JSON.stringify({ aba, i: input.filtrosImovel, p: input.filtrosPropriedade, limite });
  const hit = pesquisaCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return cloneResultado(hit.result);
  }

  const catalogs = await listarCatalogosPesquisaRegistralReadOnly();
  const pool = await getReadOnlyWebriPool();

  let webriItens: ItemResultadoPesquisaRegistral[] = [];
  let webriOk = Boolean(pool);
  let webriLocationTablesOk = !catalogs.avisoPermissaoWebri;
  let avisoPermissaoWebri = catalogs.avisoPermissaoWebri;
  let siplaniaMatches: SiplanIaRichMatch[] = [];
  let siplaniaOk = false;

  if (aba === 'imovel') {
    const f = input.filtrosImovel || {};
    const criterioIa = montarCriterioSiplanIaParaImovel(f);
    const hasRichTextCriterion = criterioIa.length >= 3;

    const [webriRes, ocrRes] = await Promise.all([
      pool
        ? pesquisarImovelEstruturadoWebri(pool, f, catalogs, limite)
        : Promise.resolve({ itens: [] as ItemResultadoPesquisaRegistral[], locationTablesOk: false, permissionDenied229: false }),
      hasRichTextCriterion
        ? pesquisarMatriculasComTrechoSiplanIaReadOnly(criterioIa, {
            maxResults: Math.min(45, limite),
            permitirNumericoPuro: true,
          }).then((rows) => {
            siplaniaOk = true;
            return rows;
          })
        : Promise.resolve([] as SiplanIaRichMatch[]),
    ]);

    webriItens = webriRes.itens;
    siplaniaMatches = ocrRes;
    if (webriRes.permissionDenied229) {
      avisoPermissaoWebri = true;
      webriLocationTablesOk = false;
      if (pool) {
        webriItens = await pesquisarImovelBasicoWebriFallback(pool, f, catalogs, limite);
      }
    }
  } else {
    const f = input.filtrosPropriedade || {};
    const iaSpec = buildQuerySiplanIaPropriedade(f);
    const permitirOcrLivro2 = !f.livroId || f.livroId === 0 || f.livroId === 2;

    const [webriRes, ocrRes] = await Promise.all([
      pool
        ? pesquisarPropriedadeWebri(pool, f, catalogs, limite)
        : Promise.resolve({ itens: [] as ItemResultadoPesquisaRegistral[], webriOk: false, permissionDenied229: false }),
      permitirOcrLivro2 && iaSpec.queryText.length >= 3
        ? pesquisarMatriculasComTrechoSiplanIaReadOnly(iaSpec.queryText, {
            maxResults: Math.min(45, limite),
            modoExatoOuFrase: iaSpec.modoExatoOuFrase,
            permitirNumericoPuro: iaSpec.permitirNumericoPuro,
          }).then((rows) => {
            siplaniaOk = true;
            return rows;
          })
        : Promise.resolve([] as SiplanIaRichMatch[]),
    ]);

    webriItens = webriRes.itens;
    webriOk = webriRes.webriOk;
    siplaniaMatches = ocrRes;
    if (webriRes.permissionDenied229) {
      avisoPermissaoWebri = true;
      webriLocationTablesOk = false;
    }
  }

  // Para matrículas encontradas no WebRI em LV2 sem snippet OCR ainda, busca rapidamente o total de páginas/trecho no SiplanIA
  const termoHintGlobal =
    aba === 'imovel'
      ? montarCriterioSiplanIaParaImovel(input.filtrosImovel || {})
      : buildQuerySiplanIaPropriedade(input.filtrosPropriedade || {}).queryText;

  const lv2NumsParaEnriquecerWebri = Array.from(
    new Set([
      ...webriItens
        .filter((w) => w.sessao === 'LV2' && w.numeroLivro && w.numeroLivro > 0)
        .map((w) => w.numeroLivro as number),
      ...siplaniaMatches.map((m) => m.numero),
    ]),
  );

  const [metaPorLv2, snippetsPorLv2] = await Promise.all([
    pool && lv2NumsParaEnriquecerWebri.length > 0
      ? enriquecerMatriculasWebriEmLote(pool, lv2NumsParaEnriquecerWebri).catch(() => new Map<number, EnrichedMatriculaRealMeta>())
      : Promise.resolve(new Map<number, EnrichedMatriculaRealMeta>()),
    webriItens.length > 0
      ? consultarSnippetsMatriculasSiplanIaReadOnly(
          webriItens.filter((w) => w.sessao === 'LV2' && w.numeroLivro).map((w) => w.numeroLivro as number),
          termoHintGlobal,
        )
      : Promise.resolve(new Map<number, { qtdPaginas: number | null; paginaEncontrada: number | null; trechoOcr: string | null }>()),
  ]);

  if (snippetsPorLv2.size > 0) {
    siplaniaOk = true;
  }

  // Combina WebRI + SiplanIA por chave única de livro (preservando múltiplos participantes se houver no WebRI)
  const ocrByNum = new Map<number, SiplanIaRichMatch>(siplaniaMatches.map((m) => [m.numero, m]));
  const lv2PresentesWebri = new Set<number>();
  const finalItens: ItemResultadoPesquisaRegistral[] = [];

  for (const w of webriItens) {
    const item = { ...w };
    if (item.sessao === 'LV2' && item.numeroLivro) {
      lv2PresentesWebri.add(item.numeroLivro);
      const ocrMatch = ocrByNum.get(item.numeroLivro);
      const snip = snippetsPorLv2.get(item.numeroLivro);
      if (ocrMatch) {
        item.origem = 'ambos';
        item.paginaOcrEncontrada = ocrMatch.paginaEncontrada;
        item.qtdPaginasOcr = ocrMatch.qtdPaginas;
        item.trechoOcr = ocrMatch.trechoOcr;
      } else if (snip) {
        item.qtdPaginasOcr = snip.qtdPaginas;
        if (snip.paginaEncontrada) item.paginaOcrEncontrada = snip.paginaEncontrada;
        if (snip.trechoOcr) item.trechoOcr = snip.trechoOcr;
      }
    }
    finalItens.push(item);
  }

  // Adiciona resultados exclusivos encontrados no OCR SiplanIA (e enriquece com Contribuinte/Unidade/Contraditório do WebRI)
  for (const ocr of siplaniaMatches) {
    if (lv2PresentesWebri.has(ocr.numero)) continue;
    const meta = metaPorLv2.get(ocr.numero);
    if (
      aba === 'propriedade' &&
      input.filtrosPropriedade?.somenteContraditorioIndisponibilidade &&
      (!meta || meta.contraditorioTipo === 'livre')
    ) {
      continue;
    }

    // Se usuário filtrou unidade ou contribuinte na aba Imóvel junto com logradouro, aplica filtro suave quando metadata existir
    if (aba === 'imovel' && meta) {
      const f = input.filtrosImovel || {};
      const contribFilter = String(f.contribuinte || '').replace(/\D+/g, '');
      const contribMeta = String(meta.contribuinte || '').replace(/\D+/g, '');
      if (contribFilter.length >= 6 && contribMeta && !contribMeta.startsWith(contribFilter)) {
        continue;
      }
      const unidFilter = String(f.unidade || '').trim().toLowerCase();
      const unidMeta = String(meta.unidade || '').trim().toLowerCase();
      if (unidFilter && unidMeta && !unidMeta.includes(unidFilter)) {
        continue;
      }
    }

    const tipoImovel = meta ? resolveNomePorCatalogo(meta.tipoImovelId, catalogs.tiposImovel) : null;
    const subdistrito = meta ? resolveNomePorCatalogo(meta.subdistritoId, catalogs.subdistritos) : null;

    finalItens.push({
      id: `siplania:LV2:${ocr.numero}`,
      origem: 'siplania',
      sessao: 'LV2',
      livroRotulo: 'Matrícula',
      numeroLivro: ocr.numero,
      complementoLivro: meta?.complLivro ?? null,
      matriculaOrigemCitada: null,
      atoResumo: meta?.protocoloVinculado
        ? `Recepção ${meta.protocoloVinculado}`
        : ocr.qtdPaginas
        ? `${ocr.qtdPaginas} pág(s) digitalizadas`
        : null,
      protocoloVinculado: meta?.protocoloVinculado ?? null,
      contraditorioIndisponibilidade: meta?.contraditorioTipo ?? 'livre',
      contraditorioDetalhe: meta?.contraditorioDetalhe ?? null,
      contribuinte: meta?.contribuinte ?? null,
      tipoImovel,
      unidade: meta?.unidade ?? null,
      subdistrito,
      caracteristicasResumo: meta
        ? buildCaracteristicasResumo({
            contribuinte: meta.contribuinte,
            tipoImovel,
            unidade: meta.unidade,
            subdistrito,
          })
        : 'Registro digitalizado no acervo LV2',
      participanteNome: null,
      participanteDocumento: null,
      participanteQualificacao: null,
      localizacaoResumo:
        meta?.descricaoImovel?.slice(0, 220) ||
        (meta?.contribuinte || meta?.unidade
          ? `Dados estruturados WebRI (${[
              meta?.contribuinte ? `SQL ${meta.contribuinte}` : null,
              meta?.unidade ? `Unidade ${meta.unidade}` : null,
            ]
              .filter(Boolean)
              .join(' • ')})`
          : `Localizado no texto OCR da Matrícula ${ocr.numero} (Pág. ${ocr.paginaEncontrada ?? 1})`),
      confrontantesResumo: null,
      medidasResumo: null,
      paginaOcrEncontrada: ocr.paginaEncontrada,
      qtdPaginasOcr: ocr.qtdPaginas,
      trechoOcr: ocr.trechoOcr,
      termoDestaqueSugerido: termoHintGlobal || String(ocr.numero),
    });
  }

  const sliced = finalItens.slice(0, limite);
  const contadores = { webri: 0, siplania: 0, ambos: 0 };
  for (const item of sliced) {
    contadores[item.origem]++;
  }

  const resultado: ResultadoPesquisaRegistral = {
    aba,
    itens: sliced,
    total: sliced.length,
    duracaoMs: Date.now() - inicio,
    contadores,
    fontesConsultadas: {
      webriOk,
      webriLocationTablesOk,
      siplaniaOk,
    },
    avisoPermissaoWebri,
    erroDiagnostico: null,
  };

  if (pesquisaCache.size >= MAX_SEARCH_CACHE) {
    const oldest = pesquisaCache.keys().next().value;
    if (oldest !== undefined) pesquisaCache.delete(oldest);
  }
  pesquisaCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, result: cloneResultado(resultado) });

  return resultado;
}

