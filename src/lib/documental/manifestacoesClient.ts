/**
 * Cliente (navegador) da API /api/gestao-documental/manifestacoes.
 * A fila "Formulários em Conferência" e o Histórico ficam no banco do FIORIX,
 * compartilhados entre as máquinas do setor de Usucapião.
 */
import type {
  ArquivoOrigemFicha,
  DadosManifestacao,
  FichaOficialPendente,
  ManifestacaoArquivada,
  MinutaModelo,
  PayloadFinalizacao,
} from '@/components/documental/FichaOficialView';

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

/** Ficha da fila com os dados de quem salvou (compartilhada entre as máquinas). */
export interface FichaEmConferencia extends FichaOficialPendente {
  /** id da linha no banco (usado para remover) */
  registroId: string;
  criadoPorNome: string | null;
  atualizadoPorNome: string | null;
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `Falha na comunicação com o FIORIX (${res.status}).`);
  return body as T;
}

const postar = <T>(corpo: unknown) =>
  chamar<T>(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

/** Só os campos aceitos pela API (o arquivo de origem pode trazer tamanho/data do Connector). */
export function origemParaApi(origem?: { name: string; relativePath: string; rootId?: string } | null): ArquivoOrigemFicha | null {
  if (!origem?.relativePath) return null;
  const rootId = origem.rootId && /^[a-z0-9_-]{1,32}$/.test(origem.rootId) ? origem.rootId : undefined;
  return { name: String(origem.name || '').slice(0, 255), relativePath: origem.relativePath, ...(rootId ? { rootId } : {}) };
}

const FICHA_ID_VALIDO = /^[A-Za-z0-9_.:-]{1,80}$/;
export function fichaIdValido(id: string | undefined | null): id is string {
  return typeof id === 'string' && FICHA_ID_VALIDO.test(id);
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

function paraFicha(m: ManifestacaoCompletaApi): FichaEmConferencia {
  const dados = (m.dados || {}) as DadosManifestacao;
  return {
    id: m.fichaId,
    registroId: m.id,
    numero_processo: m.numeroProcesso || 'Processo sem número',
    requerente: m.requerente || 'Interessado a definir',
    imovel: dados.imovel || m.imovel || '',
    subdistrito: m.subdistrito || '—',
    matricula_transcricao: m.matricula || '-',
    data_criacao: formatarDataHora(m.updatedAt),
    dados,
    arquivoOrigem: m.arquivoOrigem,
    criadoPorNome: m.criadoPorNome,
    atualizadoPorNome: m.atualizadoPorNome,
  };
}

/** Fila "Formulários em Conferência com o Oficial" (todas as máquinas). */
export async function carregarFilaConferencia(): Promise<FichaEmConferencia[]> {
  // Para a fila, a API já devolve os dados do formulário junto com o resumo
  const { itens } = await chamar<{ itens: ManifestacaoCompletaApi[] }>(`${ENDPOINT}?status=conferencia&limite=200`);
  return itens.filter(m => m.dados).map(paraFicha);
}

export async function salvarFichaConferencia(dados: DadosManifestacao, origem?: { name: string; relativePath: string; rootId?: string } | null) {
  const fichaId = fichaIdValido(dados.id_ficha) ? dados.id_ficha : `FICHA-${Date.now()}`;
  const { ficha } = await postar<{ ficha: ManifestacaoApi }>({
    acao: 'salvar_fila',
    fichaId,
    dados: { ...dados, id_ficha: fichaId },
    arquivoOrigem: origemParaApi(origem),
  });
  return ficha;
}

export async function removerFichaConferencia(registroId: string): Promise<void> {
  await chamar(`${ENDPOINT}?id=${encodeURIComponent(registroId)}`, { method: 'DELETE' });
}

export async function finalizarManifestacaoApi(payload: PayloadFinalizacao): Promise<ManifestacaoArquivada> {
  const fichaId = fichaIdValido(payload.fichaId) ? payload.fichaId : `FICHA-${Date.now()}`;
  const { manifestacao } = await postar<{ manifestacao: ManifestacaoCompletaApi }>({
    acao: 'finalizar',
    fichaId,
    dados: { ...payload.dados, id_ficha: fichaId },
    arquivoOrigem: origemParaApi(payload.arquivoOrigem),
    minuta: payload.minuta,
    textoFinal: payload.textoFinal,
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
  const { manifestacao } = await chamar<{ manifestacao: ManifestacaoCompletaApi }>(`${ENDPOINT}?id=${encodeURIComponent(id)}`);
  return manifestacao;
}

export interface FiltrosHistorico {
  busca?: string;
  escrevente?: string;
  de?: string;
  ate?: string;
  limite?: number;
  deslocamento?: number;
}

export async function listarHistorico(filtros: FiltrosHistorico): Promise<{ itens: ManifestacaoApi[]; total: number }> {
  const params = new URLSearchParams({ status: 'finalizada' });
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v).trim());
  }
  return chamar(`${ENDPOINT}?${params.toString()}`);
}

/** Migra uma única vez a fila antiga (que ficava só neste navegador) para o banco. */
export async function importarFilaAntiga(fichas: FichaOficialPendente[]): Promise<number> {
  const validas = fichas
    .filter(f => fichaIdValido(f.id) && f.dados)
    .slice(0, 200)
    .map(f => ({ fichaId: f.id, dados: { ...f.dados, id_ficha: f.id }, arquivoOrigem: origemParaApi(f.arquivoOrigem) }));
  if (validas.length === 0) return 0;
  const { importadas } = await postar<{ importadas: number }>({ acao: 'importar_fila_local', fichas: validas });
  return importadas;
}
