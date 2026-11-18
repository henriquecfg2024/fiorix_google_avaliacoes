'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Eye,
  FileSearch,
  Filter,
  Info,
  Loader2,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  abrirMatriculaLv2EmOutroMonitor,
  construirUrlVisualizadorMatriculaLv2,
} from '@/lib/documental/janelasDocumento';
import { getFichaRotulo } from './DocumentPreviewModal';

type AbaPesquisa = 'imovel' | 'propriedade';

type ModoPesquisaNome =
  | 'exata'
  | 'comecar_com'
  | 'primeiro_sobrenome'
  | 'sobrenome'
  | 'qualquer_parte';

interface CatalogoOpcao {
  id: number;
  sigla?: string | null;
  descricao: string;
}

interface CatalogosPesquisaRegistral {
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

interface FiltrosImovelState {
  contribuinte: string;
  maiorArea: boolean;
  tipoImovelId: string;
  unidade: string;
  distritoId: string;
  subdistritoId: string;
  cep: string;
  cidade: string;
  bairro: string;
  tipoLogradouroId: string;
  logradouro: string;
  numero: string;
  complemento: string;
  andar: string;
  pavimento: string;
  vaga: string;
  distanciaEsquina: string;
  edificioCondominio: string;
  loteamento: string;
  bloco: string;
  setor: string;
  lote: string;
  quadra: string;
  gleba: string;
  logradouroAnterior: string;
  tipoAreaId: string;
  tipoConfrontanteId: string;
  confrontante: string;
  tipoMedidaId: string;
  medida: string;
  incra: string;
  car: string;
  irf: string;
  mf: string;
  mr: string;
  qmf: string;
  qmr: string;
  fraMin: string;
  descricaoImovel: string;
}

interface FiltrosPropriedadeState {
  somenteContraditorioIndisponibilidade: boolean;
  livroId: string;
  numeroLivro: string;
  livroCompl: string;
  livroAntigo: string;
  livroAntigoCompl: string;
  folha: string;
  folhaCompl: string;
  nome: string;
  modoNome: ModoPesquisaNome;
  aplicarSubstituicao: boolean;
  nomeMaisDocumento: boolean;
  documento1: string;
  documento2: string;
  dtRegInicial: string;
  dtRegFinal: string;
}

interface ItemResultadoPesquisaRegistral {
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

interface ResultadoPesquisaRegistral {
  aba: AbaPesquisa;
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

interface ConnectorApiItem {
  id: string;
  name: string;
  lastSeenAt?: string | null;
  operationalState?: string | null;
}

const CATALOGOS_INICIAIS: CatalogosPesquisaRegistral = {
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
  distritos: [{ id: 1, descricao: 'SÃO PAULO (CAPITAL)' }],
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
  origemBanco: 'padrao',
  avisoPermissaoWebri: false,
};

const FILTROS_IMOVEL_VAZIO: FiltrosImovelState = {
  contribuinte: '',
  maiorArea: false,
  tipoImovelId: '',
  unidade: '',
  distritoId: '',
  subdistritoId: '',
  cep: '',
  cidade: '',
  bairro: '',
  tipoLogradouroId: '',
  logradouro: '',
  numero: '',
  complemento: '',
  andar: '',
  pavimento: '',
  vaga: '',
  distanciaEsquina: '',
  edificioCondominio: '',
  loteamento: '',
  bloco: '',
  setor: '',
  lote: '',
  quadra: '',
  gleba: '',
  logradouroAnterior: '',
  tipoAreaId: '',
  tipoConfrontanteId: '',
  confrontante: '',
  tipoMedidaId: '',
  medida: '',
  incra: '',
  car: '',
  irf: '',
  mf: '',
  mr: '',
  qmf: '',
  qmr: '',
  fraMin: '',
  descricaoImovel: '',
};

const FILTROS_PROPRIEDADE_VAZIO: FiltrosPropriedadeState = {
  somenteContraditorioIndisponibilidade: false,
  livroId: '2',
  numeroLivro: '',
  livroCompl: '',
  livroAntigo: '',
  livroAntigoCompl: '',
  folha: '',
  folhaCompl: '',
  nome: '',
  modoNome: 'primeiro_sobrenome',
  aplicarSubstituicao: true,
  nomeMaisDocumento: false,
  documento1: '',
  documento2: '',
  dtRegInicial: '',
  dtRegFinal: '',
};

const MODOS_NOME: Array<{ valor: ModoPesquisaNome; label: string }> = [
  { valor: 'exata', label: 'Exata' },
  { valor: 'comecar_com', label: 'Começar com' },
  { valor: 'primeiro_sobrenome', label: 'Primeiro+Sobrenome' },
  { valor: 'sobrenome', label: 'Sobrenome' },
  { valor: 'qualquer_parte', label: 'Qualquer parte' },
];

const INTERVALOS_POLL_MS = [180, 220, 300, 450, 650, 900, 1200, 1500];
const SEARCH_CACHE_TTL_MS = 30_000;

function isConnectorOnline(c: ConnectorApiItem): boolean {
  if (!c.lastSeenAt) return false;
  const ts = Date.parse(c.lastSeenAt);
  return Number.isFinite(ts) && Date.now() - ts < 180_000;
}

function parseInteiroOpcional(valor: string): number | undefined {
  const limpo = valor.trim();
  if (!limpo) return undefined;
  const num = Number.parseInt(limpo, 10);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

function textoOpcional(valor: string): string | undefined {
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

function buscarDescricaoOpcao(opcoes: CatalogoOpcao[], idStr: string): string | undefined {
  const id = parseInteiroOpcional(idStr);
  if (id === undefined || id === 0) return undefined;
  return opcoes.find(o => o.id === id)?.descricao;
}

const STOPWORDS_DESTAQUE = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'ao',
  'aos',
  'ou',
  'um',
  'uma',
  'por',
  'com',
]);

function normalizarSemAcento(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenParaRegexAcentuado(tokenNorm: string): string {
  return escapeRegExp(tokenNorm)
    .replace(/a/g, '[aáàâãä]')
    .replace(/e/g, '[eéèêë]')
    .replace(/i/g, '[iíìîï]')
    .replace(/o/g, '[oóòôõö]')
    .replace(/u/g, '[uúùûü]')
    .replace(/c/g, '[cç]')
    .replace(/n/g, '[nñ]');
}

/**
 * Destaca termos pesquisados dentro de um trecho OCR usando nós React (<mark>),
 * com tolerância a acentuação e sem qualquer uso de dangerouslySetInnerHTML.
 */
function DestacarTrechoSeguro({ texto, termosBruto }: { texto: string; termosBruto: string }) {
  const { tokensNorm, tokensSet } = useMemo(() => {
    const lista = Array.from(
      new Set(
        termosBruto
          .split(/[\s,;|]+/)
          .map(t => t.trim())
          .filter(t => t.length >= 2)
          .filter(t => /\d/.test(t) || !STOPWORDS_DESTAQUE.has(normalizarSemAcento(t)))
          .map(t => normalizarSemAcento(t)),
      ),
    ).slice(0, 8);
    return { tokensNorm: lista, tokensSet: new Set(lista) };
  }, [termosBruto]);

  if (!tokensNorm.length) {
    return <>{texto}</>;
  }

  const pattern = new RegExp(`(${tokensNorm.map(tokenParaRegexAcentuado).join('|')})`, 'gi');
  const partes = texto.split(pattern);

  return (
    <>
      {partes.map((parte, idx) => {
        const match = parte ? tokensSet.has(normalizarSemAcento(parte)) : false;
        return match ? (
          <mark
            key={`${idx}-${parte}`}
            className="rounded bg-amber-300/90 px-0.5 font-semibold text-slate-950"
          >
            {parte}
          </mark>
        ) : (
          <React.Fragment key={`${idx}-${parte}`}>{parte}</React.Fragment>
        );
      })}
    </>
  );
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700/80 bg-[#0A0F1D] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition-colors';

const LABEL_CLASS = 'block text-[11px] font-medium text-slate-300 mb-1';

export function PesquisaRegistralClient() {
  const [abaAtiva, setAbaAtiva] = useState<AbaPesquisa>('imovel');
  const [avancadoAberto, setAvancadoAberto] = useState(false);

  const [connector, setConnector] = useState<ConnectorApiItem | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<'carregando' | 'online' | 'offline'>('carregando');

  const [catalogos, setCatalogos] = useState<CatalogosPesquisaRegistral>(CATALOGOS_INICIAIS);
  const [carregandoCatalogos, setCarregandoCatalogos] = useState(false);

  const [filtrosImovel, setFiltrosImovel] = useState<FiltrosImovelState>(FILTROS_IMOVEL_VAZIO);
  const [filtrosPropriedade, setFiltrosPropriedade] =
    useState<FiltrosPropriedadeState>(FILTROS_PROPRIEDADE_VAZIO);

  const [pesquisando, setPesquisando] = useState(false);
  const [erroPesquisa, setErroPesquisa] = useState('');
  const [resultado, setResultado] = useState<ResultadoPesquisaRegistral | null>(null);
  const [filtroOrigemResultado, setFiltroOrigemResultado] = useState<'todos' | 'ambos' | 'webri' | 'siplania'>('todos');
  const [filtroTextoResultado, setFiltroTextoResultado] = useState('');
  const [avisoPermissaoExpandido, setAvisoPermissaoExpandido] = useState(false);

  const abortSearchRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef(
    new Map<string, { expiresAt: number; data: ResultadoPesquisaRegistral }>(),
  );

  const executarJobDocumental = useCallback(
    async <T,>(
      payload: Record<string, unknown>,
      signal?: AbortSignal,
      timeoutMs = 35_000,
    ): Promise<T> => {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Falha ao enviar consulta ao Connector.');
      }

      if (body.status === 'complete' && body.result) {
        return body.result as T;
      }

      if (!body.id) {
        throw new Error('Identificador da consulta não retornado pelo servidor.');
      }

      const deadline = Date.now() + timeoutMs;
      let attempt = 0;

      while (Date.now() < deadline) {
        if (signal?.aborted) {
          throw new DOMException('Consulta cancelada', 'AbortError');
        }
        const waitMs = INTERVALOS_POLL_MS[Math.min(attempt, INTERVALOS_POLL_MS.length - 1)];
        attempt += 1;
        await new Promise<void>(resolve => {
          const onAbort = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, waitMs);
          signal?.addEventListener('abort', onAbort, { once: true });
        });

        if (signal?.aborted) {
          throw new DOMException('Consulta cancelada', 'AbortError');
        }

        const pollRes = await fetch(`/api/gestao-documental?id=${encodeURIComponent(body.id)}`, {
          cache: 'no-store',
          signal,
        });
        const pollBody = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(pollBody?.error || 'Erro ao acompanhar andamento da consulta.');
        }

        if (pollBody.status === 'complete' && pollBody.result) {
          return pollBody.result as T;
        }
        if (pollBody.status === 'failed') {
          throw new Error(
            pollBody.error ||
              'O Connector não conseguiu concluir a consulta nas bases WEBRI / SiplanIA.',
          );
        }
      }

      throw new Error('Tempo limite excedido aguardando resposta do Connector local.');
    },
    [],
  );

  const carregarConectorECatalogos = useCallback(async () => {
    setConnectorStatus('carregando');
    try {
      const res = await fetch('/api/gestao-documental', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao verificar conectores.');
      const lista: ConnectorApiItem[] = Array.isArray(data?.connectors) ? data.connectors : [];
      const escolhido =
        lista.find(c => c.operationalState === 'ACTIVE' && isConnectorOnline(c)) ||
        lista.find(c => isConnectorOnline(c)) ||
        lista.find(c => c.operationalState === 'ACTIVE') ||
        lista[0] ||
        null;

      setConnector(escolhido);
      setConnectorStatus(escolhido && isConnectorOnline(escolhido) ? 'online' : 'offline');

      const connId = escolhido?.id || 'auto';
      setCarregandoCatalogos(true);
      try {
        const cat = await executarJobDocumental<CatalogosPesquisaRegistral>({
          type: 'pesquisa_registral_catalogos',
          connectorId: connId,
        });
        if (cat && Array.isArray(cat.livros)) {
          setCatalogos(cat);
        }
      } catch {
        // Mantém catálogos padrão offline em silêncio caso o connector esteja temporariamente ocupado
      } finally {
        setCarregandoCatalogos(false);
      }
    } catch {
      setConnectorStatus('offline');
    }
  }, [executarJobDocumental]);

  useEffect(() => {
    void carregarConectorECatalogos();
    return () => {
      abortSearchRef.current?.abort();
    };
  }, [carregarConectorECatalogos]);

  const qtdCamposAvancadosPreenchidos = useMemo(() => {
    const campos = [
      filtrosImovel.setor,
      filtrosImovel.lote,
      filtrosImovel.quadra,
      filtrosImovel.gleba,
      filtrosImovel.logradouroAnterior,
      filtrosImovel.tipoAreaId,
      filtrosImovel.tipoConfrontanteId,
      filtrosImovel.confrontante,
      filtrosImovel.tipoMedidaId,
      filtrosImovel.medida,
      filtrosImovel.incra,
      filtrosImovel.car,
      filtrosImovel.irf,
      filtrosImovel.mf,
      filtrosImovel.mr,
      filtrosImovel.qmf,
      filtrosImovel.qmr,
      filtrosImovel.fraMin,
      filtrosImovel.descricaoImovel,
    ];
    return campos.filter(v => v.trim() !== '').length;
  }, [filtrosImovel]);

  const construirPayloadPesquisa = useCallback(
    (forceFresh = false) => {
      const connId = connector?.id || 'auto';

      if (abaAtiva === 'imovel') {
        const tipoImovelId = parseInteiroOpcional(filtrosImovel.tipoImovelId);
        const distritoId = parseInteiroOpcional(filtrosImovel.distritoId);
        const subdistritoId = parseInteiroOpcional(filtrosImovel.subdistritoId);
        const tipoLogradouroId = parseInteiroOpcional(filtrosImovel.tipoLogradouroId);
        const tipoAreaId = parseInteiroOpcional(filtrosImovel.tipoAreaId);
        const tipoConfrontanteId = parseInteiroOpcional(filtrosImovel.tipoConfrontanteId);
        const tipoMedidaId = parseInteiroOpcional(filtrosImovel.tipoMedidaId);

        const filtros = {
          ...(textoOpcional(filtrosImovel.contribuinte)
            ? { contribuinte: filtrosImovel.contribuinte.trim() }
            : {}),
          ...(filtrosImovel.maiorArea ? { maiorArea: true } : {}),
          ...(tipoImovelId ? { tipoImovelId, tipoImovelTexto: buscarDescricaoOpcao(catalogos.tiposImovel, filtrosImovel.tipoImovelId) } : {}),
          ...(textoOpcional(filtrosImovel.unidade) ? { unidade: filtrosImovel.unidade.trim() } : {}),
          ...(distritoId ? { distritoId, distritoTexto: buscarDescricaoOpcao(catalogos.distritos, filtrosImovel.distritoId) } : {}),
          ...(subdistritoId ? { subdistritoId, subdistritoTexto: buscarDescricaoOpcao(catalogos.subdistritos, filtrosImovel.subdistritoId) } : {}),
          ...(textoOpcional(filtrosImovel.cep) ? { cep: filtrosImovel.cep.trim() } : {}),
          ...(textoOpcional(filtrosImovel.cidade) ? { cidade: filtrosImovel.cidade.trim() } : {}),
          ...(textoOpcional(filtrosImovel.bairro) ? { bairro: filtrosImovel.bairro.trim() } : {}),
          ...(tipoLogradouroId
            ? {
                tipoLogradouroId,
                tipoLogradouroTexto: buscarDescricaoOpcao(catalogos.tiposLogradouro, filtrosImovel.tipoLogradouroId),
              }
            : {}),
          ...(textoOpcional(filtrosImovel.logradouro) ? { logradouro: filtrosImovel.logradouro.trim() } : {}),
          ...(textoOpcional(filtrosImovel.numero) ? { numero: filtrosImovel.numero.trim() } : {}),
          ...(textoOpcional(filtrosImovel.complemento) ? { complemento: filtrosImovel.complemento.trim() } : {}),
          ...(textoOpcional(filtrosImovel.andar) ? { andar: filtrosImovel.andar.trim() } : {}),
          ...(textoOpcional(filtrosImovel.pavimento) ? { pavimento: filtrosImovel.pavimento.trim() } : {}),
          ...(textoOpcional(filtrosImovel.vaga) ? { vaga: filtrosImovel.vaga.trim() } : {}),
          ...(textoOpcional(filtrosImovel.distanciaEsquina)
            ? { distanciaEsquina: filtrosImovel.distanciaEsquina.trim() }
            : {}),
          ...(textoOpcional(filtrosImovel.edificioCondominio)
            ? { edificioCondominio: filtrosImovel.edificioCondominio.trim() }
            : {}),
          ...(textoOpcional(filtrosImovel.loteamento) ? { loteamento: filtrosImovel.loteamento.trim() } : {}),
          ...(textoOpcional(filtrosImovel.bloco) ? { bloco: filtrosImovel.bloco.trim() } : {}),
          ...(textoOpcional(filtrosImovel.setor) ? { setor: filtrosImovel.setor.trim() } : {}),
          ...(textoOpcional(filtrosImovel.lote) ? { lote: filtrosImovel.lote.trim() } : {}),
          ...(textoOpcional(filtrosImovel.quadra) ? { quadra: filtrosImovel.quadra.trim() } : {}),
          ...(textoOpcional(filtrosImovel.gleba) ? { gleba: filtrosImovel.gleba.trim() } : {}),
          ...(textoOpcional(filtrosImovel.logradouroAnterior)
            ? { logradouroAnterior: filtrosImovel.logradouroAnterior.trim() }
            : {}),
          ...(tipoAreaId
            ? { tipoAreaId, tipoAreaTexto: buscarDescricaoOpcao(catalogos.tiposArea, filtrosImovel.tipoAreaId) }
            : {}),
          ...(tipoConfrontanteId
            ? {
                tipoConfrontanteId,
                tipoConfrontanteTexto: buscarDescricaoOpcao(catalogos.tiposConfrontante, filtrosImovel.tipoConfrontanteId),
              }
            : {}),
          ...(textoOpcional(filtrosImovel.confrontante) ? { confrontante: filtrosImovel.confrontante.trim() } : {}),
          ...(tipoMedidaId
            ? {
                tipoMedidaId,
                tipoMedidaTexto: buscarDescricaoOpcao(catalogos.unidadesMedida, filtrosImovel.tipoMedidaId),
              }
            : {}),
          ...(textoOpcional(filtrosImovel.medida) ? { medida: filtrosImovel.medida.trim() } : {}),
          ...(textoOpcional(filtrosImovel.incra) ? { incra: filtrosImovel.incra.trim() } : {}),
          ...(textoOpcional(filtrosImovel.car) ? { car: filtrosImovel.car.trim() } : {}),
          ...(textoOpcional(filtrosImovel.irf) ? { irf: filtrosImovel.irf.trim() } : {}),
          ...(textoOpcional(filtrosImovel.mf) ? { mf: filtrosImovel.mf.trim() } : {}),
          ...(textoOpcional(filtrosImovel.mr) ? { mr: filtrosImovel.mr.trim() } : {}),
          ...(textoOpcional(filtrosImovel.qmf) ? { qmf: filtrosImovel.qmf.trim() } : {}),
          ...(textoOpcional(filtrosImovel.qmr) ? { qmr: filtrosImovel.qmr.trim() } : {}),
          ...(textoOpcional(filtrosImovel.fraMin) ? { fraMin: filtrosImovel.fraMin.trim() } : {}),
          ...(textoOpcional(filtrosImovel.descricaoImovel)
            ? { descricaoImovel: filtrosImovel.descricaoImovel.trim() }
            : {}),
        };

        return {
          connectorId: connId,
          type: 'pesquisa_registral' as const,
          aba: 'imovel' as const,
          filtrosImovel: filtros,
          limite: 80,
          ...(forceFresh ? { forceFresh: true } : {}),
        };
      }

      const livroId = parseInteiroOpcional(filtrosPropriedade.livroId);
      const numeroLivro = parseInteiroOpcional(filtrosPropriedade.numeroLivro);
      const livroAntigo = parseInteiroOpcional(filtrosPropriedade.livroAntigo);
      const folha = parseInteiroOpcional(filtrosPropriedade.folha);

      const filtrosProp = {
        ...(filtrosPropriedade.somenteContraditorioIndisponibilidade
          ? { somenteContraditorioIndisponibilidade: true }
          : {}),
        ...(livroId !== undefined ? { livroId } : {}),
        ...(numeroLivro ? { numeroLivro } : {}),
        ...(textoOpcional(filtrosPropriedade.livroCompl)
          ? { livroCompl: filtrosPropriedade.livroCompl.trim() }
          : {}),
        ...(livroAntigo ? { livroAntigo } : {}),
        ...(textoOpcional(filtrosPropriedade.livroAntigoCompl)
          ? { livroAntigoCompl: filtrosPropriedade.livroAntigoCompl.trim() }
          : {}),
        ...(folha ? { folha } : {}),
        ...(textoOpcional(filtrosPropriedade.folhaCompl)
          ? { folhaCompl: filtrosPropriedade.folhaCompl.trim() }
          : {}),
        ...(textoOpcional(filtrosPropriedade.nome) ? { nome: filtrosPropriedade.nome.trim() } : {}),
        modoNome: filtrosPropriedade.modoNome,
        aplicarSubstituicao: filtrosPropriedade.aplicarSubstituicao,
        ...(filtrosPropriedade.nomeMaisDocumento ? { nomeMaisDocumento: true } : {}),
        ...(textoOpcional(filtrosPropriedade.documento1)
          ? { documento1: filtrosPropriedade.documento1.trim() }
          : {}),
        ...(textoOpcional(filtrosPropriedade.documento2)
          ? { documento2: filtrosPropriedade.documento2.trim() }
          : {}),
        ...(textoOpcional(filtrosPropriedade.dtRegInicial)
          ? { dtRegInicial: filtrosPropriedade.dtRegInicial.trim() }
          : {}),
        ...(textoOpcional(filtrosPropriedade.dtRegFinal)
          ? { dtRegFinal: filtrosPropriedade.dtRegFinal.trim() }
          : {}),
      };

      return {
        connectorId: connId,
        type: 'pesquisa_registral' as const,
        aba: 'propriedade' as const,
        filtrosPropriedade: filtrosProp,
        limite: 80,
        ...(forceFresh ? { forceFresh: true } : {}),
      };
    },
    [abaAtiva, catalogos, connector?.id, filtrosImovel, filtrosPropriedade],
  );

  const executarPesquisa = useCallback(
    async (forceFresh = false) => {
      const payload = construirPayloadPesquisa(forceFresh);

      const temFiltroImovel =
        payload.aba === 'imovel' &&
        Object.keys(payload.filtrosImovel || {}).some(
          k => k !== 'maiorArea' && k !== 'distritoId',
        );
      const temFiltroPropriedade =
        payload.aba === 'propriedade' &&
        Boolean(
          payload.filtrosPropriedade?.numeroLivro ||
            payload.filtrosPropriedade?.livroAntigo ||
            payload.filtrosPropriedade?.folha ||
            payload.filtrosPropriedade?.nome ||
            payload.filtrosPropriedade?.documento1 ||
            payload.filtrosPropriedade?.documento2 ||
            payload.filtrosPropriedade?.somenteContraditorioIndisponibilidade,
        );

      if (!temFiltroImovel && !temFiltroPropriedade) {
        setErroPesquisa(
          abaAtiva === 'imovel'
            ? 'Preencha ao menos Contribuinte, Logradouro, Número, Edifício, Unidade ou Descrição do Imóvel.'
            : 'Preencha ao menos Nº da Matrícula/Livro, Nome, CPF/CNPJ ou marque Contraditório/Indisponibilidade.',
        );
        return;
      }

      const chaveCache = JSON.stringify({ ...payload, forceFresh: false });
      if (!forceFresh) {
        const hit = searchCacheRef.current.get(chaveCache);
        if (hit && hit.expiresAt > Date.now()) {
          setErroPesquisa('');
          setResultado(hit.data);
          setFiltroOrigemResultado('todos');
          return;
        }
      }

      abortSearchRef.current?.abort();
      const controller = new AbortController();
      abortSearchRef.current = controller;

      setPesquisando(true);
      setErroPesquisa('');

      try {
        const data = await executarJobDocumental<ResultadoPesquisaRegistral>(
          payload,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        searchCacheRef.current.set(chaveCache, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          data,
        });
        setResultado(data);
        setFiltroOrigemResultado('todos');
        setFiltroTextoResultado('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErroPesquisa(
          err instanceof Error ? err.message : 'Erro inesperado ao executar pesquisa registral.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setPesquisando(false);
        }
      }
    },
    [abaAtiva, construirPayloadPesquisa, executarJobDocumental],
  );

  const limparFiltros = () => {
    setErroPesquisa('');
    setResultado(null);
    setFiltroTextoResultado('');
    setFiltroOrigemResultado('todos');
    if (abaAtiva === 'imovel') {
      setFiltrosImovel(FILTROS_IMOVEL_VAZIO);
    } else {
      setFiltrosPropriedade(FILTROS_PROPRIEDADE_VAZIO);
    }
  };

  const itensFiltrados = useMemo(() => {
    if (!resultado?.itens) return [];
    const termo = normalizarSemAcento(filtroTextoResultado.trim());
    return resultado.itens.filter(item => {
      if (filtroOrigemResultado !== 'todos' && item.origem !== filtroOrigemResultado) {
        return false;
      }
      if (!termo) return true;
      const textoCombinado = normalizarSemAcento(
        [
          item.numeroLivro ? String(item.numeroLivro) : '',
          item.matriculaOrigemCitada ? String(item.matriculaOrigemCitada) : '',
          item.contribuinte || '',
          item.caracteristicasResumo,
          item.participanteNome || '',
          item.participanteDocumento || '',
          item.localizacaoResumo,
          item.trechoOcr || '',
          item.atoResumo || '',
          item.contraditorioDetalhe || '',
        ].join(' '),
      );
      return textoCombinado.includes(termo);
    });
  }, [filtroOrigemResultado, filtroTextoResultado, resultado]);

  return (
    <div className="space-y-5">
      {/* Barra superior de Abas + Ações */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0D1322]/90 backdrop-blur-md p-4 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Abas Imóvel / Propriedade */}
          <div className="inline-flex rounded-xl border border-slate-800 bg-[#070A12] p-1">
            <button
              type="button"
              onClick={() => {
                setAbaAtiva('imovel');
                setErroPesquisa('');
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                abaAtiva === 'imovel'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Imóvel (Indicador Real)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAbaAtiva('propriedade');
                setErroPesquisa('');
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                abaAtiva === 'propriedade'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Propriedade (Pessoas & Livros)</span>
            </button>
          </div>

          {/* Status Connector + Botões de Pesquisa */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                connectorStatus === 'online'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : connectorStatus === 'carregando'
                    ? 'border-slate-700 bg-slate-800/60 text-slate-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>
                {connectorStatus === 'online'
                  ? `${connector?.name || 'Connector'} Online`
                  : connectorStatus === 'carregando'
                    ? 'Conectando...'
                    : 'Connector Offline'}
              </span>
              {carregandoCatalogos && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </button>

            <button
              type="button"
              onClick={() => void executarPesquisa(true)}
              disabled={pesquisando}
              title="Ignorar cache de 30s e consultar bases ao vivo"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pesquisando ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void executarPesquisa(false)}
              disabled={pesquisando}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-60 transition-all"
            >
              {pesquisando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>{pesquisando ? 'Pesquisando bases...' : 'Pesquisar'}</span>
            </button>
          </div>
        </div>

        {/* Formulário ativo */}
        <form
          onSubmit={e => {
            e.preventDefault();
            void executarPesquisa(false);
          }}
          className="mt-5 pt-5 border-t border-slate-800/80 space-y-4"
        >
          {abaAtiva === 'imovel' ? (
            <>
              {/* Linha 1: Contribuinte, Tipo de Imóvel, Unidade, Distrito, Subdistrito */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pr-contribuinte" className="text-[11px] font-medium text-slate-300">
                      Contribuinte (SQL/IPTU)
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filtrosImovel.maiorArea}
                        onChange={e =>
                          setFiltrosImovel(prev => ({ ...prev, maiorArea: e.target.checked }))
                        }
                        className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-400"
                      />
                      <span>Maior área</span>
                    </label>
                  </div>
                  <input
                    id="pr-contribuinte"
                    type="text"
                    value={filtrosImovel.contribuinte}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, contribuinte: e.target.value }))
                    }
                    placeholder="Ex: 031.108.0184-1"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-tipo-imovel" className={LABEL_CLASS}>
                    Tipo de Imóvel
                  </label>
                  <select
                    id="pr-tipo-imovel"
                    value={filtrosImovel.tipoImovelId}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, tipoImovelId: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Todos</option>
                    {catalogos.tiposImovel.map(op => (
                      <option key={op.id} value={String(op.id)}>
                        {op.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-unidade" className={LABEL_CLASS}>
                    Unidade
                  </label>
                  <input
                    id="pr-unidade"
                    type="text"
                    value={filtrosImovel.unidade}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, unidade: e.target.value }))
                    }
                    placeholder="Ex: 104, 105, Ap 42"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-distrito" className={LABEL_CLASS}>
                    Distrito
                  </label>
                  <select
                    id="pr-distrito"
                    value={filtrosImovel.distritoId}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, distritoId: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Todos</option>
                    {catalogos.distritos.map(op => (
                      <option key={op.id} value={String(op.id)}>
                        {op.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label htmlFor="pr-subdistrito" className={LABEL_CLASS}>
                    Subdistrito
                  </label>
                  <select
                    id="pr-subdistrito"
                    value={filtrosImovel.subdistritoId}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, subdistritoId: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Todos</option>
                    {catalogos.subdistritos.map(op => (
                      <option key={op.id} value={String(op.id)}>
                        {op.descricao}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 2: Localização Principal */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-2">
                  <label htmlFor="pr-tipo-logradouro" className={LABEL_CLASS}>
                    Tipo Logradouro
                  </label>
                  <select
                    id="pr-tipo-logradouro"
                    value={filtrosImovel.tipoLogradouroId}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, tipoLogradouroId: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Todos</option>
                    {catalogos.tiposLogradouro.map(op => (
                      <option key={op.id} value={String(op.id)}>
                        {op.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label htmlFor="pr-logradouro" className={LABEL_CLASS}>
                    Logradouro
                  </label>
                  <input
                    id="pr-logradouro"
                    type="text"
                    value={filtrosImovel.logradouro}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, logradouro: e.target.value }))
                    }
                    placeholder="Ex: Jerônimo de Mendonça"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-numero" className={LABEL_CLASS}>
                    Número
                  </label>
                  <input
                    id="pr-numero"
                    type="text"
                    value={filtrosImovel.numero}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, numero: e.target.value }))
                    }
                    placeholder="165"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-compl" className={LABEL_CLASS}>
                    Complemento
                  </label>
                  <input
                    id="pr-compl"
                    type="text"
                    value={filtrosImovel.complemento}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, complemento: e.target.value }))
                    }
                    placeholder="Casa, Fundos..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-cep" className={LABEL_CLASS}>
                    CEP
                  </label>
                  <input
                    id="pr-cep"
                    type="text"
                    value={filtrosImovel.cep}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, cep: e.target.value }))
                    }
                    placeholder="03189-050"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-bairro" className={LABEL_CLASS}>
                    Bairro / Cidade
                  </label>
                  <input
                    id="pr-bairro"
                    type="text"
                    value={filtrosImovel.bairro}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, bairro: e.target.value }))
                    }
                    placeholder="Mooca, Belenzinho..."
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Linha 3: Condomínio, Loteamento, Bloco, Andar, Pavimento, Vaga, Esquina */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
                <div className="col-span-2 lg:col-span-3">
                  <label htmlFor="pr-edificio" className={LABEL_CLASS}>
                    Edifício / Condomínio
                  </label>
                  <input
                    id="pr-edificio"
                    type="text"
                    value={filtrosImovel.edificioCondominio}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, edificioCondominio: e.target.value }))
                    }
                    placeholder="Ex: Conjunto Residencial da Mooca"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="col-span-2 lg:col-span-2">
                  <label htmlFor="pr-loteamento" className={LABEL_CLASS}>
                    Loteamento
                  </label>
                  <input
                    id="pr-loteamento"
                    type="text"
                    value={filtrosImovel.loteamento}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, loteamento: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-bloco" className={LABEL_CLASS}>
                    Bloco
                  </label>
                  <input
                    id="pr-bloco"
                    type="text"
                    value={filtrosImovel.bloco}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, bloco: e.target.value }))
                    }
                    placeholder="Ex: A-6"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-andar" className={LABEL_CLASS}>
                    Andar
                  </label>
                  <input
                    id="pr-andar"
                    type="text"
                    value={filtrosImovel.andar}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, andar: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-pavimento" className={LABEL_CLASS}>
                    Pavimento
                  </label>
                  <input
                    id="pr-pavimento"
                    type="text"
                    value={filtrosImovel.pavimento}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, pavimento: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-vaga" className={LABEL_CLASS}>
                    Vaga
                  </label>
                  <input
                    id="pr-vaga"
                    type="text"
                    value={filtrosImovel.vaga}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, vaga: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="col-span-2 lg:col-span-2">
                  <label htmlFor="pr-esquina" className={LABEL_CLASS}>
                    Distância da Esquina
                  </label>
                  <input
                    id="pr-esquina"
                    type="text"
                    value={filtrosImovel.distanciaEsquina}
                    onChange={e =>
                      setFiltrosImovel(prev => ({ ...prev, distanciaEsquina: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Botão expansível Campos Avançados */}
              <div>
                <button
                  type="button"
                  onClick={() => setAvancadoAberto(prev => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0A0F1D] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Campos avançados (Setor/Quadra/Lote, Confrontantes, Rural & Descrição OCR)</span>
                  {qtdCamposAvancadosPreenchidos > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {qtdCamposAvancadosPreenchidos} preenchido(s)
                    </span>
                  )}
                  {avancadoAberto ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {avancadoAberto && (
                  <div className="mt-3 rounded-xl border border-slate-800/90 bg-[#080C18] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div>
                        <label htmlFor="pr-cidade" className={LABEL_CLASS}>
                          Cidade
                        </label>
                        <input
                          id="pr-cidade"
                          type="text"
                          value={filtrosImovel.cidade}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, cidade: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-setor" className={LABEL_CLASS}>
                          Setor
                        </label>
                        <input
                          id="pr-setor"
                          type="text"
                          value={filtrosImovel.setor}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, setor: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-quadra" className={LABEL_CLASS}>
                          Quadra
                        </label>
                        <input
                          id="pr-quadra"
                          type="text"
                          value={filtrosImovel.quadra}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, quadra: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-lote" className={LABEL_CLASS}>
                          Lote
                        </label>
                        <input
                          id="pr-lote"
                          type="text"
                          value={filtrosImovel.lote}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, lote: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-gleba" className={LABEL_CLASS}>
                          Gleba
                        </label>
                        <input
                          id="pr-gleba"
                          type="text"
                          value={filtrosImovel.gleba}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, gleba: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-log-ant" className={LABEL_CLASS}>
                          Logradouro Anterior
                        </label>
                        <input
                          id="pr-log-ant"
                          type="text"
                          value={filtrosImovel.logradouroAnterior}
                          onChange={e =>
                            setFiltrosImovel(prev => ({
                              ...prev,
                              logradouroAnterior: e.target.value,
                            }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <label htmlFor="pr-tipo-area" className={LABEL_CLASS}>
                          Tipo de Área
                        </label>
                        <select
                          id="pr-tipo-area"
                          value={filtrosImovel.tipoAreaId}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, tipoAreaId: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">Todos</option>
                          {catalogos.tiposArea.map(op => (
                            <option key={op.id} value={String(op.id)}>
                              {op.descricao}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="pr-tipo-confrontante" className={LABEL_CLASS}>
                          Tipo de Confrontante
                        </label>
                        <select
                          id="pr-tipo-confrontante"
                          value={filtrosImovel.tipoConfrontanteId}
                          onChange={e =>
                            setFiltrosImovel(prev => ({
                              ...prev,
                              tipoConfrontanteId: e.target.value,
                            }))
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">Todos</option>
                          {catalogos.tiposConfrontante.map(op => (
                            <option key={op.id} value={String(op.id)}>
                              {op.descricao}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="pr-confrontante" className={LABEL_CLASS}>
                          Confrontante
                        </label>
                        <input
                          id="pr-confrontante"
                          type="text"
                          value={filtrosImovel.confrontante}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, confrontante: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="pr-tipo-medida" className={LABEL_CLASS}>
                          Tipo de Medida
                        </label>
                        <select
                          id="pr-tipo-medida"
                          value={filtrosImovel.tipoMedidaId}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, tipoMedidaId: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="">Todos</option>
                          {catalogos.unidadesMedida.map(op => (
                            <option key={op.id} value={String(op.id)}>
                              {op.descricao}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="pr-medida" className={LABEL_CLASS}>
                          Medida
                        </label>
                        <input
                          id="pr-medida"
                          type="text"
                          value={filtrosImovel.medida}
                          onChange={e =>
                            setFiltrosImovel(prev => ({ ...prev, medida: e.target.value }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                      <div>
                        <label htmlFor="pr-incra" className={LABEL_CLASS}>INCRA</label>
                        <input id="pr-incra" type="text" value={filtrosImovel.incra} onChange={e => setFiltrosImovel(prev => ({ ...prev, incra: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-car" className={LABEL_CLASS}>CAR</label>
                        <input id="pr-car" type="text" value={filtrosImovel.car} onChange={e => setFiltrosImovel(prev => ({ ...prev, car: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-irf" className={LABEL_CLASS}>IRF</label>
                        <input id="pr-irf" type="text" value={filtrosImovel.irf} onChange={e => setFiltrosImovel(prev => ({ ...prev, irf: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-mf" className={LABEL_CLASS}>MF</label>
                        <input id="pr-mf" type="text" value={filtrosImovel.mf} onChange={e => setFiltrosImovel(prev => ({ ...prev, mf: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-mr" className={LABEL_CLASS}>MR</label>
                        <input id="pr-mr" type="text" value={filtrosImovel.mr} onChange={e => setFiltrosImovel(prev => ({ ...prev, mr: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-qmf" className={LABEL_CLASS}>QMF</label>
                        <input id="pr-qmf" type="text" value={filtrosImovel.qmf} onChange={e => setFiltrosImovel(prev => ({ ...prev, qmf: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-qmr" className={LABEL_CLASS}>QMR</label>
                        <input id="pr-qmr" type="text" value={filtrosImovel.qmr} onChange={e => setFiltrosImovel(prev => ({ ...prev, qmr: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                      <div>
                        <label htmlFor="pr-framin" className={LABEL_CLASS}>Fra. Mín.</label>
                        <input id="pr-framin" type="text" value={filtrosImovel.fraMin} onChange={e => setFiltrosImovel(prev => ({ ...prev, fraMin: e.target.value }))} className={INPUT_CLASS} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="pr-desc-imovel" className={LABEL_CLASS}>
                        Descrição do Imóvel / Termo Livre nas Fichas (OCR SiplanIA + WEBRI)
                      </label>
                      <input
                        id="pr-desc-imovel"
                        type="text"
                        value={filtrosImovel.descricaoImovel}
                        onChange={e =>
                          setFiltrosImovel(prev => ({ ...prev, descricaoImovel: e.target.value }))
                        }
                        placeholder="Ex: garagem determinada, servidão de passagem, usucapião..."
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Aba Propriedade */}
              <div className="flex flex-wrap items-center gap-3 pb-1">
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0A0F1D] px-3 py-1.5 text-xs text-slate-200 cursor-pointer hover:border-amber-500/40">
                  <input
                    type="checkbox"
                    checked={filtrosPropriedade.somenteContraditorioIndisponibilidade}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({
                        ...prev,
                        somenteContraditorioIndisponibilidade: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-400"
                  />
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Somente Contraditório ou Indisponibilidade</span>
                </label>
              </div>

              {/* Linha 1: Livro, Número, Livro Comp., Livro Antigo, Livro Comp., Folha, Folha Comp. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
                <div className="col-span-2 lg:col-span-3">
                  <label htmlFor="pr-prop-livro" className={LABEL_CLASS}>
                    Livro
                  </label>
                  <select
                    id="pr-prop-livro"
                    value={filtrosPropriedade.livroId}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, livroId: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  >
                    {catalogos.livros.map(op => (
                      <option key={op.id} value={String(op.id)}>
                        {op.descricao}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-num" className={LABEL_CLASS}>
                    Número (Matrícula / Registro)
                  </label>
                  <input
                    id="pr-prop-num"
                    type="text"
                    value={filtrosPropriedade.numeroLivro}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, numeroLivro: e.target.value }))
                    }
                    placeholder="Ex: 40000"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-prop-lcompl" className={LABEL_CLASS}>
                    Livro Comp.
                  </label>
                  <input
                    id="pr-prop-lcompl"
                    type="text"
                    value={filtrosPropriedade.livroCompl}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, livroCompl: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-lant" className={LABEL_CLASS}>
                    Livro Antigo
                  </label>
                  <input
                    id="pr-prop-lant"
                    type="text"
                    value={filtrosPropriedade.livroAntigo}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, livroAntigo: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-prop-lacompl" className={LABEL_CLASS}>
                    Comp. Ant.
                  </label>
                  <input
                    id="pr-prop-lacompl"
                    type="text"
                    value={filtrosPropriedade.livroAntigoCompl}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, livroAntigoCompl: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-folha" className={LABEL_CLASS}>
                    Folha
                  </label>
                  <input
                    id="pr-prop-folha"
                    type="text"
                    value={filtrosPropriedade.folha}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, folha: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label htmlFor="pr-prop-fcompl" className={LABEL_CLASS}>
                    Folha Comp.
                  </label>
                  <input
                    id="pr-prop-fcompl"
                    type="text"
                    value={filtrosPropriedade.folhaCompl}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, folhaCompl: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Linha 2: Nome a pesquisar, Documento 1, Documento 2, Dt. Reg. Inicial, Dt. Reg. Final */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label htmlFor="pr-prop-nome" className={LABEL_CLASS}>
                    Nome a pesquisar
                  </label>
                  <input
                    id="pr-prop-nome"
                    type="text"
                    value={filtrosPropriedade.nome}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, nome: e.target.value }))
                    }
                    placeholder="Nome completo ou razão social..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-doc1" className={LABEL_CLASS}>
                    Documento (CPF / CNPJ / RG)
                  </label>
                  <input
                    id="pr-prop-doc1"
                    type="text"
                    value={filtrosPropriedade.documento1}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, documento1: e.target.value }))
                    }
                    placeholder="Ex: 123.456.789-00"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-doc2" className={LABEL_CLASS}>
                    Documento Secundário
                  </label>
                  <input
                    id="pr-prop-doc2"
                    type="text"
                    value={filtrosPropriedade.documento2}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, documento2: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-dtini" className={LABEL_CLASS}>
                    Dt. Reg. Inicial
                  </label>
                  <input
                    id="pr-prop-dtini"
                    type="date"
                    value={filtrosPropriedade.dtRegInicial}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, dtRegInicial: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="pr-prop-dtfim" className={LABEL_CLASS}>
                    Dt. Reg. Final
                  </label>
                  <input
                    id="pr-prop-dtfim"
                    type="date"
                    value={filtrosPropriedade.dtRegFinal}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({ ...prev, dtRegFinal: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Linha 3: Radios + Checkboxes WebRI de correspondência de nome */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800/80 bg-[#080C18] px-3.5 py-2.5 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-4">
                  {MODOS_NOME.map(m => (
                    <label key={m.valor} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modoNomePropriedade"
                        value={m.valor}
                        checked={filtrosPropriedade.modoNome === m.valor}
                        onChange={() =>
                          setFiltrosPropriedade(prev => ({ ...prev, modoNome: m.valor }))
                        }
                        className="border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-400"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>

                <div className="h-4 w-px bg-slate-800 hidden sm:block" />

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filtrosPropriedade.aplicarSubstituicao}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({
                        ...prev,
                        aplicarSubstituicao: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Aplicar substituição</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filtrosPropriedade.nomeMaisDocumento}
                    onChange={e =>
                      setFiltrosPropriedade(prev => ({
                        ...prev,
                        nomeMaisDocumento: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Nome+Documento</span>
                </label>
              </div>
            </>
          )}

          {/* Submit oculto para permitir Enter em qualquer campo */}
          <button type="submit" className="hidden" aria-hidden="true">
            Pesquisar
          </button>
        </form>

        {erroPesquisa && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{erroPesquisa}</span>
          </div>
        )}
      </div>

      {/* Área de Resultados */}
      {resultado && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0D1322]/90 backdrop-blur-md p-4 shadow-xl space-y-4">
          {/* Cabeçalho do Resultado + Filtros Rápidos */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-white mr-1">
                <FileSearch className="h-4 w-4 text-amber-400" />
                <span>{resultado.total} resultado(s)</span>
                <span className="text-xs font-normal text-slate-400">
                  em {resultado.duracaoMs} ms
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFiltroOrigemResultado('todos')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  filtroOrigemResultado === 'todos'
                    ? 'bg-slate-200 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todos ({resultado.itens.length})
              </button>

              <button
                type="button"
                onClick={() => setFiltroOrigemResultado('ambos')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  filtroOrigemResultado === 'ambos'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}
              >
                WEBRI + SiplanIA ({resultado.contadores.ambos})
              </button>

              <button
                type="button"
                onClick={() => setFiltroOrigemResultado('webri')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  filtroOrigemResultado === 'webri'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                }`}
              >
                WEBRI ({resultado.contadores.webri})
              </button>

              <button
                type="button"
                onClick={() => setFiltroOrigemResultado('siplania')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  filtroOrigemResultado === 'siplania'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                }`}
              >
                SiplanIA OCR ({resultado.contadores.siplania})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[230px]">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={filtroTextoResultado}
                  onChange={e => setFiltroTextoResultado(e.target.value)}
                  placeholder="Filtrar nos resultados..."
                  className="w-full rounded-lg border border-slate-700/80 bg-[#0A0F1D] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none"
                />
              </div>

              {resultado.avisoPermissaoWebri && (
                <button
                  type="button"
                  onClick={() => setAvisoPermissaoExpandido(prev => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Detalhes WEBRI SQL</span>
                </button>
              )}
            </div>
          </div>

          {avisoPermissaoExpandido && resultado.avisoPermissaoWebri && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
              <p className="font-semibold text-amber-300">
                Modo Híbrido Ativo — Tabelas auxiliares de logradouro/pessoas no SQL WEBRI aguardando GRANT SELECT
              </p>
              <p className="mt-1 text-slate-200/90">
                A consulta já enriqueceu Contribuinte, Unidade, Matrícula e Contraditório/Indisponibilidade no WEBRI e pesquisou todo o acervo OCR no SiplanIA. Para habilitar também a busca SQL direta em logradouros e CPFs sem OCR no WEBRI, execute o script somente leitura{' '}
                <code className="rounded bg-slate-900 px-1 py-0.5 text-amber-300">
                  sql/grant_select_pesquisa_registral_webri.sql
                </code>{' '}
                no SRVSQL.
              </p>
            </div>
          )}

          {resultado.erroDiagnostico && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              Diagnóstico: {resultado.erroDiagnostico}
            </div>
          )}

          {/* Tabela Unificada */}
          {itensFiltrados.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0A0F1D] p-8 text-center text-xs text-slate-400">
              Nenhum registro encontrado para os critérios informados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/90">
              <table className="min-w-full divide-y divide-slate-800/80 text-left text-xs">
                <thead className="bg-[#080C18] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Origem</th>
                    <th className="px-3 py-2.5">Sessão / Livro</th>
                    <th className="px-3 py-2.5">Ato / Status</th>
                    <th className="px-3 py-2.5">Características / Imóvel</th>
                    <th className="px-3 py-2.5">Localização, Partes & Trecho OCR</th>
                    <th className="px-3 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 bg-[#0B101E]">
                  {itensFiltrados.map((item, idx) => {
                    const numLivro = item.numeroLivro && item.numeroLivro > 0 ? item.numeroLivro : null;
                    const sessaoImagemDireta = item.sessao === 'LV2' || item.sessao === 'LV3';
                    const paginaAlvo =
                      item.paginaOcrEncontrada && item.paginaOcrEncontrada > 0
                        ? item.paginaOcrEncontrada
                        : undefined;
                    const rotuloFicha = paginaAlvo
                      ? getFichaRotulo(paginaAlvo - 1).codigo
                      : null;

                    const urlMesmaGuia = numLivro && sessaoImagemDireta
                      ? construirUrlVisualizadorMatriculaLv2(numLivro, {
                          sessao: item.sessao || 'LV2',
                          termoDestaque: item.termoDestaqueSugerido,
                          pagina: paginaAlvo,
                          janela: false,
                        })
                      : null;

                    return (
                      <tr key={`${item.id}-${idx}`} className="align-top hover:bg-slate-800/35 transition-colors">
                        {/* Origem */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {item.origem === 'ambos' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" />
                              Ambos
                            </span>
                          ) : item.origem === 'webri' ? (
                            <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 border border-sky-500/30">
                              WEBRI
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/30">
                              OCR
                            </span>
                          )}
                        </td>

                        {/* Sessão / Livro */}
                        <td className="px-3 py-3 whitespace-nowrap space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                              {item.sessao || item.livroRotulo}
                            </span>
                            <span className="font-mono text-sm font-bold text-white">
                              {numLivro ? numLivro.toLocaleString('pt-BR') : 'S/Vínculo'}
                            </span>
                            {item.complementoLivro && (
                              <span className="text-[11px] text-slate-400">{item.complementoLivro}</span>
                            )}
                          </div>
                          {item.matriculaOrigemCitada && item.matriculaOrigemCitada > 0 && (
                            <div className="text-[11px] text-sky-300/90">
                              Origem: Mat. {item.matriculaOrigemCitada.toLocaleString('pt-BR')}
                            </div>
                          )}
                        </td>

                        {/* Ato / Contraditório */}
                        <td className="px-3 py-3 space-y-1">
                          {item.contraditorioIndisponibilidade === 'livre' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Livre
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-500/30">
                              <ShieldAlert className="h-3 w-3" />
                              {item.contraditorioIndisponibilidade === 'indisponivel'
                                ? 'Indisponível'
                                : 'Contraditório'}
                            </span>
                          )}
                          {item.atoResumo && (
                            <div className="text-[11px] text-slate-300">{item.atoResumo}</div>
                          )}
                          {item.contraditorioDetalhe && (
                            <div className="text-[11px] text-rose-200/90">{item.contraditorioDetalhe}</div>
                          )}
                        </td>

                        {/* Características / Imóvel */}
                        <td className="px-3 py-3 space-y-1 max-w-[260px]">
                          {item.contribuinte && (
                            <div className="font-mono text-xs font-semibold text-amber-200">
                              SQL: {item.contribuinte}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-200">
                            {[item.tipoImovel, item.unidade ? `Unid. ${item.unidade}` : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                          {item.subdistrito && (
                            <div className="text-[11px] text-slate-400">{item.subdistrito}</div>
                          )}
                          {item.caracteristicasResumo && !item.contribuinte && (
                            <div className="text-[11px] text-slate-300">{item.caracteristicasResumo}</div>
                          )}
                        </td>

                        {/* Localização / Partes / Trecho OCR */}
                        <td className="px-3 py-3 space-y-1.5 max-w-[440px]">
                          {(item.participanteNome || item.participanteDocumento) && (
                            <div className="rounded-lg bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-200">
                              <span className="font-semibold text-white">
                                {item.participanteNome || 'Parte não informada'}
                              </span>
                              {item.participanteDocumento && (
                                <span className="ml-2 font-mono text-sky-300">
                                  {item.participanteDocumento}
                                </span>
                              )}
                              {item.participanteQualificacao && (
                                <span className="ml-2 text-slate-400">
                                  ({item.participanteQualificacao})
                                </span>
                              )}
                            </div>
                          )}

                          {item.localizacaoResumo && (
                            <div className="text-[11px] text-slate-200 leading-relaxed">
                              {item.localizacaoResumo}
                            </div>
                          )}

                          {item.confrontantesResumo && (
                            <div className="text-[11px] text-slate-400">
                              Confrontantes: {item.confrontantesResumo}
                            </div>
                          )}

                          {item.trechoOcr && (
                            <div className="rounded-lg border border-amber-500/20 bg-[#070A12] p-2 text-[11px] leading-relaxed text-slate-200">
                              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-amber-300/90">
                                <span className="font-semibold uppercase tracking-wider">
                                  Trecho OCR {rotuloFicha ? `• Ficha ${rotuloFicha}` : ''}
                                  {paginaAlvo ? ` (Pág. ${paginaAlvo}${item.qtdPaginasOcr ? `/${item.qtdPaginasOcr}` : ''})` : ''}
                                </span>
                              </div>
                              <p className="line-clamp-3">
                                <DestacarTrechoSeguro
                                  texto={item.trechoOcr}
                                  termosBruto={item.termoDestaqueSugerido}
                                />
                              </p>
                            </div>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          {numLivro && urlMesmaGuia ? (
                            <div className="inline-flex flex-col items-end gap-1.5">
                              <div className="inline-flex items-center gap-1.5">
                                <Link
                                  href={urlMesmaGuia}
                                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Visualizar</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirMatriculaLv2EmOutroMonitor(numLivro, {
                                      sessao: item.sessao || 'LV2',
                                      termoDestaque: item.termoDestaqueSugerido,
                                      pagina: paginaAlvo,
                                    })
                                  }
                                  title="Abrir matrícula no Visualizador do 2º Monitor"
                                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25 transition-colors"
                                >
                                  <Monitor className="h-3.5 w-3.5" />
                                  <span>2º Monitor</span>
                                </button>

                                <a
                                  href={urlMesmaGuia}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir matrícula em nova guia"
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          ) : numLivro ? (
                            <span className="inline-block rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                              Livro {item.sessao || item.livroRotulo} (acervo físico)
                            </span>
                          ) : (
                            <span className="inline-block rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-500">
                              Sem imagem vinculada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
