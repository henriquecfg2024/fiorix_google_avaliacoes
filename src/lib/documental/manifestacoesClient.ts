/**
 * Cliente (navegador) da API /api/gestao-documental/manifestacoes.
 * A fila "Formulários em Conferência" (status = conferencia) e o "ARQUIVO" / "Histórico"
 * (status = finalizada) ficam no banco do FIORIX, compartilhados entre as máquinas do setor.
 */
import type {
  ArquivoOrigemFicha,
  DadosManifestacao,
  FichaOficialPendente,
  ManifestacaoArquivada,
  MinutaModelo,
  PayloadFinalizacao,
} from '@/components/documental/FichaOficialView';
import {
  sanitizarDescricaoImovel,
  sanitizarLogradouroConfrontacao,
  sanitizarMatriculaTranscricao,
} from '@/lib/confrontacoes';

const ENDPOINT = '/api/gestao-documental/manifestacoes';

/** Linha devolvida pela API (datas chegam como texto ISO). */
export interface ManifestacaoApi {
  id: string;
  fichaId: string;
  status: 'conferencia' | 'finalizada';
  versao: number;
  versaoAnteriorId: string | null;
  numeroProcesso: string | null;
  requerente: string | null;
  matricula: string | null;
  subdistrito: string | null;
  escrevente: string | null;
  imovel: string | null;
  natureza?: string | null;
  cartorioOrigem?: string | null;
  conferidoPorNome?: string | null;
  conferidoEm?: string | null;
  impressaoConfirmadaEm?: string | null;
  criadoPorNome: string | null;
  atualizadoPorNome: string | null;
  finalizadoPorNome: string | null;
  hashSha256: string | null;
  createdAt: string;
  updatedAt: string;
  finalizadoEm: string | null;
}

export interface ManifestacaoCompletaApi extends ManifestacaoApi {
  dados: DadosManifestacao;
  arquivoOrigem: ArquivoOrigemFicha | null;
  minuta: MinutaModelo | null;
  textoFinal: string | null;
}

/** Ficha da fila com os dados de quem salvou e status de conferência (procedimentos antes da finalização da Etapa 2). */
export interface FichaEmConferencia extends FichaOficialPendente {
  /** id da linha no banco */
  registroId: string;
  criadoPorNome: string | null;
  atualizadoPorNome: string | null;
  statusConferencia: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO';
  conferidoPorNome: string | null;
  conferidoEm: string | null;
  statusBanco: 'conferencia' | 'finalizada';
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* resposta sem corpo */
  }
  if (!res.ok) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : `Falha na comunicação com o FIORIX (${res.status}).`,
    );
  }
  return body as T;
}

const postar = <T>(corpo: unknown) =>
  chamar<T>(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

/** Só os campos aceitos pela API (o arquivo de origem pode trazer tamanho/data do Connector). */
export function origemParaApi(
  origem?: { name: string; relativePath: string; rootId?: string } | null,
): ArquivoOrigemFicha | null {
  if (!origem?.relativePath) return null;
  const rootId =
    origem.rootId && /^[a-z0-9_-]{1,32}$/.test(origem.rootId) ? origem.rootId : undefined;
  return {
    name: String(origem.name || '').slice(0, 255),
    relativePath: origem.relativePath,
    ...(rootId ? { rootId } : {}),
  };
}

const FICHA_ID_VALIDO = /^[A-Za-z0-9_.:-]{1,80}$/;
export function fichaIdValido(id: string | undefined | null): id is string {
  return typeof id === 'string' && FICHA_ID_VALIDO.test(id);
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

function paraFicha(m: ManifestacaoCompletaApi): FichaEmConferencia {
  const dadosBrutos = (m.dados || {}) as DadosManifestacao & {
    status_conferencia?: string;
    conferido_por_nome?: string | null;
    conferido_em?: string | null;
  };
  const imovelLimpo = sanitizarDescricaoImovel(dadosBrutos.imovel || m.imovel || '');
  const ruaLimpa = sanitizarLogradouroConfrontacao(dadosBrutos.rua_olhar_confrontacao, dadosBrutos.imovel || m.imovel || '');
  const matriculaLimpa = sanitizarMatriculaTranscricao(dadosBrutos.matricula_transcricao || m.matricula || '');
  const dados = {
    ...dadosBrutos,
    imovel: imovelLimpo,
    rua_olhar_confrontacao: ruaLimpa,
    matricula_transcricao: matriculaLimpa || dadosBrutos.matricula_transcricao,
  };
  const ehConferido = m.status === 'finalizada' || dados.status_conferencia === 'CONFERIDO';
  const dataConferenciaIso = dados.conferido_em || m.conferidoEm || null;
  return {
    id: m.fichaId,
    registroId: m.id,
    numero_processo: m.numeroProcesso || 'Processo sem número',
    requerente: m.requerente || 'Interessado a definir',
    imovel: imovelLimpo,
    subdistrito: m.subdistrito || '—',
    matricula_transcricao: matriculaLimpa || '-',
    data_criacao: formatarDataHora(m.updatedAt),
    dados,
    arquivoOrigem: m.arquivoOrigem,
    criadoPorNome: m.criadoPorNome,
    atualizadoPorNome: m.atualizadoPorNome,
    statusConferencia: ehConferido ? 'CONFERIDO' : 'AGUARDANDO_CONFERENCIA',
    conferidoPorNome: dados.conferido_por_nome || m.conferidoPorNome || null,
    conferidoEm: dataConferenciaIso ? formatarDataHora(dataConferenciaIso) : null,
    statusBanco: m.status,
  };
}

/**
 * Fila "Em Conferência": retorna exclusivamente procedimentos ainda em andamento (status = conferencia),
 * englobando tanto "Aguardando Conferência" quanto "Conferido" (pronto para finalizar a Etapa 2).
 * Procedimentos finalizados após a Etapa 2 saem desta fila e passam para a aba ARQUIVO.
 */
export async function carregarFilaConferencia(): Promise<FichaEmConferencia[]> {
  const { itens } = await chamar<{ itens: ManifestacaoCompletaApi[] }>(
    `${ENDPOINT}?status=conferencia&limite=200`,
  );
  return itens.filter(m => m.dados && m.status === 'conferencia').map(paraFicha);
}

export async function salvarFichaConferencia(
  dados: DadosManifestacao,
  origem?: { name: string; relativePath: string; rootId?: string } | null,
) {
  const fichaId = fichaIdValido(dados.id_ficha) ? dados.id_ficha : `FICHA-${Date.now()}`;
  const { ficha } = await postar<{ ficha: ManifestacaoApi }>({
    acao: 'salvar_fila',
    fichaId,
    dados: { ...dados, id_ficha: fichaId },
    arquivoOrigem: origemParaApi(origem),
  });
  return ficha;
}

export async function alternarConferenciaFicha(
  registroId: string,
  statusConferencia: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO',
): Promise<FichaEmConferencia> {
  const { manifestacao } = await postar<{ manifestacao: ManifestacaoCompletaApi }>({
    acao: 'conferir_ficha',
    registroId,
    statusConferencia,
  });
  return paraFicha(manifestacao);
}

export async function removerFichaConferencia(registroId: string): Promise<void> {
  await chamar(`${ENDPOINT}?id=${encodeURIComponent(registroId)}`, { method: 'DELETE' });
}

export async function finalizarManifestacaoApi(
  payload: PayloadFinalizacao,
): Promise<ManifestacaoArquivada> {
  const fichaId = fichaIdValido(payload.fichaId) ? payload.fichaId : `FICHA-${Date.now()}`;
  const { manifestacao } = await postar<{ manifestacao: ManifestacaoCompletaApi }>({
    acao: 'finalizar',
    fichaId,
    dados: { ...payload.dados, id_ficha: fichaId },
    arquivoOrigem: origemParaApi(payload.arquivoOrigem),
    minuta: payload.minuta,
    textoFinal: payload.textoFinal,
    confirmouImpressao: payload.confirmouImpressao === true,
    versaoAnteriorId: payload.versaoAnteriorId,
  });
  return {
    id: manifestacao.id,
    versao: manifestacao.versao,
    numeroProcesso: manifestacao.numeroProcesso,
    finalizadoEm: manifestacao.finalizadoEm || new Date().toISOString(),
    finalizadoPorNome: manifestacao.finalizadoPorNome,
    hashSha256: manifestacao.hashSha256 || '',
  };
}

export async function obterManifestacaoApi(id: string): Promise<ManifestacaoCompletaApi> {
  const { manifestacao } = await chamar<{ manifestacao: ManifestacaoCompletaApi }>(
    `${ENDPOINT}?id=${encodeURIComponent(id)}`,
  );
  return manifestacao;
}

export interface FiltrosHistorico {
  status?: 'conferencia' | 'finalizada' | 'todas';
  busca?: string;
  escrevente?: string;
  de?: string;
  ate?: string;
  limite?: number;
  deslocamento?: number;
}

export async function listarHistorico(
  filtros: FiltrosHistorico,
): Promise<{ itens: ManifestacaoApi[]; total: number }> {
  const params = new URLSearchParams({ status: filtros.status || 'todas' });
  for (const [k, v] of Object.entries(filtros)) {
    if (k === 'status') continue;
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v).trim());
    }
  }
  return chamar(`${ENDPOINT}?${params.toString()}`);
}

export const POR_PAGINA_ARQUIVO = 20;

export interface FiltrosArquivoManifestacoes {
  busca?: string;
  pagina?: number;
  porPagina?: number;
}

/**
 * Consulta paginada no servidor para a aba ARQUIVO (20 registros por página por padrão,
 * apenas procedimentos com Etapa 2 concluída e arquivados).
 */
export async function listarArquivoManifestacoes(
  filtros: FiltrosArquivoManifestacoes = {},
): Promise<{ itens: ManifestacaoApi[]; total: number }> {
  const porPagina = filtros.porPagina ?? POR_PAGINA_ARQUIVO;
  const pagina = Math.max(filtros.pagina ?? 1, 1);
  const deslocamento = (pagina - 1) * porPagina;
  const params = new URLSearchParams({
    status: 'finalizada',
    limite: String(porPagina),
    deslocamento: String(deslocamento),
  });
  if (filtros.busca && filtros.busca.trim()) {
    params.set('busca', filtros.busca.trim());
  }
  return chamar(`${ENDPOINT}?${params.toString()}`);
}

/** Migra uma única vez a fila antiga (que ficava só neste navegador) para o banco. */
export async function importarFilaAntiga(fichas: FichaOficialPendente[]): Promise<number> {
  const validas = fichas
    .filter(f => fichaIdValido(f.id) && f.dados)
    .slice(0, 200)
    .map(f => ({
      fichaId: f.id,
      dados: { ...f.dados, id_ficha: f.id },
      arquivoOrigem: origemParaApi(f.arquivoOrigem),
    }));
  if (validas.length === 0) return 0;
  const { importadas } = await postar<{ importadas: number }>({
    acao: 'importar_fila_local',
    fichas: validas,
  });
  return importadas;
}

export interface LogGestaoDocumentalApi {
  id: string;
  dataHora: string;
  modulo: 'GESTÃO DOCUMENTAL';
  acao: string;
  categoria:
  | 'PESQUISA'
  | 'EXTRACAO_PETICAO'
  | 'LEITURA_ACERVO'
  | 'VALIDACAO_ASSINATURA'
  | 'RASCUNHO_CONFERENCIA'
  | 'CONFERENCIA_OFICIAL'
  | 'ARQUIVAMENTO'
  | 'AUDITORIA';
  processo: string | null;
  matricula: string | null;
  requerente: string | null;
  usuarioNome: string | null;
  descricao: string;
  status: string | null;
  manifestacaoId?: string | null;
}

export interface FiltrosLogsGestaoDocumentalApi {
  busca?: string;
  tipo?: string;
  de?: string;
  ate?: string;
  ordem?: 'desc' | 'asc';
  limite?: number;
}

export async function listarLogsGestaoDocumentalApi(
  filtros: FiltrosLogsGestaoDocumentalApi = {},
): Promise<{ itens: LogGestaoDocumentalApi[]; total: number }> {
  const params = new URLSearchParams({ modo: 'logs' });
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v).trim());
    }
  }
  return chamar(`${ENDPOINT}?${params.toString()}`);
}
