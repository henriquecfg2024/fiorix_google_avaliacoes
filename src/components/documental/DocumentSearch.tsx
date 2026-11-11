'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  ShieldCheck,
  Loader2,
  Sparkles,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  Zap,
  RotateCw,
  Search,
  SlidersHorizontal,
  Layers,
  Copy,
  Check,
  FileCode,
  ArrowLeft,
  History,
  X,
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreVertical,
  MonitorUp,
  Star,
  Folder,
  Clock,
} from 'lucide-react';
import {
  RAIZES_DOCUMENTAL,
  UNIDADES_PRINCIPAIS,
  arquivoPertenceAPasta,
  lerPastasFavoritas,
  PASTAS_FAVORITAS_PADRAO,
  alternarPastaFavoritaNoStorage,
  verificarPastaFavorita,
  EVENTO_FAVORITOS_ATUALIZADOS,
  normalizarTermoPesquisaDocumental,
  chaveCachePesquisaDocumental,
  type RaizId,
  type PastaFavorita,
} from '@/lib/documental/pastasFavoritas';
import {
  sanitizarDescricaoImovel,
  sanitizarLogradouroConfrontacao,
  extrairImovelDoTextoAutos,
} from '@/lib/confrontacoes';
import {
  FichaOficialView,
  DadosManifestacao,
  criarDadosManifestacaoPadrao,
  lerFilaFichasOficial,
  montarMinuta,
  CHAVE_FILA_FICHAS_OFICIAL,
  type PayloadFinalizacao,
} from './FichaOficialView';
import {
  baixarDocManifestacao,
  baixarDocxManifestacao,
} from '@/lib/documental/generateManifestacaoWord';
import {
  alternarConferenciaFicha,
  carregarFilaConferencia,
  finalizarManifestacaoApi,
  importarFilaAntiga,
  obterManifestacaoApi,
  removerFichaConferencia,
  salvarFichaConferencia,
  type FichaEmConferencia,
} from '@/lib/documental/manifestacoesClient';
import { AssinaturasModal, AnaliseAssinaturaPdf } from './AssinaturasModal';
import { DocumentPreviewModal, DocumentTextResult } from './DocumentPreviewModal';
import {
  abrirDocumentoEmJanela,
  lerPreferenciasJanelas,
  listarMonitores,
  suportaSelecaoDeMonitor,
  tipoDoDocumento,
  type MonitorDisponivel,
} from '@/lib/documental/janelasDocumento';
import {
  copiarTextoSeguro,
  LinkLocalExpiradoError,
  resolverPdfParaNavegador,
} from '@/lib/documental/pdfTransfer';

interface Connector {
  id: string;
  name: string;
  lastSeenAt: string | null;
  role?: 'PRIMARY' | 'SECONDARY';
  operationalState?: 'ACTIVE' | 'STANDBY' | 'PAUSED';
  lanUrl?: string | null;
  isPrimaryActive?: boolean;
}
export function isConnectorOnline(c: Connector): boolean {
  if (!c.lastSeenAt) return false;
  const ts = new Date(c.lastSeenAt).getTime();
  return !Number.isNaN(ts) && Date.now() - ts < 120000;
}
function connectorPriorityScore(c: Connector): number {
  const online = isConnectorOnline(c);
  if (c.operationalState === 'ACTIVE' && online) return 4;
  if (c.operationalState === 'ACTIVE') return 3;
  if (c.operationalState !== 'PAUSED' && online) return 2;
  if (online) return 1;
  return 0;
}
interface Match {
  rootId: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedAt: string;
  matricula?: string;
}
interface SearchState {
  id: string;
  status: string;
  expiresAt: string;
  result: {
    files: Match[];
    partial: boolean;
    unavailableRoots: string[];
    matriculaDetectada?: string;
    matriculas?: string[];
  } | null;
}

interface HistoricoNavegacao {
  query: string;
  job: SearchState | null;
  searchMode: 'simples' | 'cruzada';
  cruzadaParams?: {
    processo: string;
    matricula: string;
    contribuinte: string;
    requerente: string;
  };
  origemTitulo?: string;
  totalDocumentos?: number;
  timestamp: number;
}

export interface RootConfigDisplay {
  label: string;
  drive: string;
  fullName: string;
  pathDisplay: string;
  badgeClass: string;
  dotClass: string;
}

export function getRootInfo(rootId: string, relativePath?: string): RootConfigDisplay {
  const norm = (rootId || '').toLowerCase().trim();
  const relClean = (relativePath || '').replace(/^[\\/]+/, '');
  if (norm === 'livro2' || ((norm === 'imagens' || norm === 'acervo') && /^lv2(?:[\\/]|$)/i.test(relClean))) {
    return {
      label: 'Livro 2 (K:)',
      drive: 'K:',
      fullName: 'Matrículas Digitalizadas do Livro 2 (Registro Geral)',
      pathDisplay: 'K:\\IMAGENS\\LV2',
      badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-amber-500/10 hover:bg-amber-900/60',
      dotClass: 'bg-amber-400',
    };
  }
  if (norm === 'setores' || ((norm === 'imagens' || norm === 'acervo') && /^setores(?:[\\/]|$)/i.test(relClean))) {
    return {
      label: 'Setores (K:)',
      drive: 'K:',
      fullName: 'Plantas Fiscais de Setores e Quadras (K:\\IMAGENS\\SETORES)',
      pathDisplay: 'K:\\IMAGENS\\SETORES',
      badgeClass: 'bg-teal-950/70 text-teal-300 border-teal-500/40 shadow-teal-500/10 hover:bg-teal-900/60',
      dotClass: 'bg-teal-400',
    };
  }
  if (norm === 'vol1' || norm === 'h') {
    return {
      label: 'VOL1 (H:)',
      drive: 'H:',
      fullName: 'VOL1 — Acervo Geral (\\SrvFiles\VOL1)',
      pathDisplay: 'H:',
      badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10 hover:bg-emerald-900/60',
      dotClass: 'bg-emerald-400',
    };
  }
  if (norm === 'deptos' || norm === 'dep' || norm === 'w') {
    return {
      label: 'DEP (W:)',
      drive: 'W:',
      fullName: 'DEP / DEPTOS — Departamentos e Escreventes (\\SrvFiles\DEPTOS)',
      pathDisplay: 'W:',
      badgeClass: 'bg-violet-950/70 text-violet-300 border-violet-500/40 shadow-violet-500/10 hover:bg-violet-900/60',
      dotClass: 'bg-violet-400',
    };
  }
  if (norm === 'minutas' || norm === 'usucapiao') {
    return {
      label: 'Minutas (W:)',
      drive: 'W:',
      fullName: 'Minutas de Usucapião (Escreventes)',
      pathDisplay: 'W:\\USUCAPIAO',
      badgeClass: 'bg-violet-950/70 text-violet-300 border-violet-500/40 shadow-violet-500/10 hover:bg-violet-900/60',
      dotClass: 'bg-violet-400',
    };
  }
  if (norm === 'processos' || norm === 'processos-email' || norm === 'email') {
    return {
      label: 'Processos (H:)',
      drive: 'H:',
      fullName: 'Processos da Vara (Enviados por E-mail)',
      pathDisplay: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL',
      badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10 hover:bg-emerald-900/60',
      dotClass: 'bg-emerald-400',
    };
  }
  if (norm === 'imagens' || norm === 'acervo') {
    return {
      label: 'Imagens (K:)',
      drive: 'K:',
      fullName: 'Acervo Geral de Imagens (K:\\IMAGENS)',
      pathDisplay: 'K:\\IMAGENS',
      badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-amber-500/10 hover:bg-amber-900/60',
      dotClass: 'bg-amber-400',
    };
  }
  return {
    label: rootId || 'Local',
    drive: '',
    fullName: rootId,
    pathDisplay: rootId,
    badgeClass: 'bg-[#080D1A] text-cyan-300 border-white/15',
    dotClass: 'bg-cyan-400',
  };
}

export function formatCartorioPath(rootId: string, relativePath: string): string {
  const info = getRootInfo(rootId, relativePath);
  const rel = (relativePath || '').replace(/^[\\/]+/, '').replace(/\//g, '\\');
  if (info.pathDisplay.endsWith('\\LV2') && rel.toLowerCase().startsWith('lv2\\')) {
    return `${info.pathDisplay}\\${rel.slice(4)}`;
  }
  if (info.pathDisplay.endsWith('\\SETORES') && rel.toLowerCase().startsWith('setores\\')) {
    return `${info.pathDisplay}\\${rel.slice(8)}`;
  }
  return `${info.pathDisplay}\\${rel}`;
}

const CHAVE_FILA_VISIVEL = 'fiorix_fila_fichas_visivel';
const CHAVE_TEMPOS_BUSCA = 'fiorix_tempos_busca';

/** Registro de tempo de cada pesquisa (como no app original: "Última pesquisa: 0,9s · 8 resultado(s)") */
interface TempoBusca {
  termo: string;
  ms: number;
  quando: number;
  resultados: number;
  cache?: boolean;
}

function fmtDuracaoBusca(ms: number): string {
  if (ms < 10000) {
    return `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`;
  }
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

function fmtQuandoBusca(ts: number): string {
  return new Date(ts)
    .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');
}

/** Quantos PDFs baixados do Connector (até ~200 MB cada) ficam em memória para reabrir na hora */
const MAX_PDFS_LOCAIS_EM_MEMORIA = 4;

/** Deduplica resultados quando raízes sobrepostas (ex.: Imagens K: e Livro 2 K:) apontam ao mesmo arquivo físico */
function normalizarEstadoBusca(state: SearchState | null): SearchState | null {
  if (!state?.result?.files || state.result.files.length <= 1) return state;
  const prioridade = (id: string) => {
    const n = (id || '').toLowerCase();
    return n === 'livro2' ? 3 : n === 'minutas' || n === 'processos' ? 2 : 1;
  };
  const mapa = new Map<string, { idx: number; item: Match }>();
  state.result.files.forEach((f, idx) => {
    const chave = formatCartorioPath(f.rootId, f.relativePath).replace(/\//g, '\\').toLowerCase();
    const atual = mapa.get(chave);
    if (!atual || prioridade(f.rootId) > prioridade(atual.item.rootId)) {
      mapa.set(chave, { idx: atual ? atual.idx : idx, item: f });
    }
  });
  const filesUnicos = Array.from(mapa.values())
    .sort((a, b) => a.idx - b.idx)
    .map(v => v.item);
  if (filesUnicos.length === state.result.files.length) return state;
  return {
    ...state,
    result: {
      ...state.result,
      files: filesUnicos,
    },
  };
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

export function DocumentSearch({
  modo = 'manifestacoes',
}: {
  modo?: 'manifestacoes' | 'conferencia';
} = {}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorId, setConnectorId] = useState('');
  const [query, setQuery] = useState('');
  const [job, setJob] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historicoBuscas, setHistoricoBuscas] = useState<HistoricoNavegacao[]>([]);

  // Seletor de pasta (VOL1, IMAGENS, DEP ou Favoritos)
  const [pastaFiltro, setPastaFiltro] = useState<{ rootId: RaizId; relativePath: string; rotulo: string } | null>(null);
  const [pastasFavoritas, setPastasFavoritas] = useState<PastaFavorita[]>(PASTAS_FAVORITAS_PADRAO);

  function toggleFavoritoBusca(rootId: RaizId, relativePath: string, rotulo?: string, e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const { favoritos } = alternarPastaFavoritaNoStorage(rootId, relativePath, rotulo);
    setPastasFavoritas(favoritos);
  }

  useEffect(() => {
    setPastasFavoritas(lerPastasFavoritas());
    const sync = () => setPastasFavoritas(lerPastasFavoritas());
    window.addEventListener(EVENTO_FAVORITOS_ATUALIZADOS, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENTO_FAVORITOS_ATUALIZADOS, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Modo de Busca: Simples ou Cruzada
  const [searchMode, setSearchMode] = useState<'simples' | 'cruzada'>('simples');
  const [cruzadaProcesso, setCruzadaProcesso] = useState('');
  const [cruzadaMatricula, setCruzadaMatricula] = useState('');
  const [cruzadaContribuinte, setCruzadaContribuinte] = useState('');
  const [cruzadaRequerente, setCruzadaRequerente] = useState('');

  // Opções de Intervalo de Páginas do OCR
  const [ocrModoPagina, setOcrModoPagina] = useState<'padrao' | 'personalizado' | 'todas'>('padrao');
  const [ocrPaginaInicio, setOcrPaginaInicio] = useState(1);
  const [ocrPaginaFim, setOcrPaginaFim] = useState(15);
  const [mostrarOpcoesOcr, setMostrarOpcoesOcr] = useState(false);

  // Estados para Extração, Assinaturas e Leitura de DOCX
  const [processandoAcao, setProcessandoAcao] = useState<{
    id: string;
    tipo: 'extracao' | 'assinatura' | 'leitura';
    fileName: string;
  } | null>(null);
  const [fichaAberta, setFichaAberta] = useState<DadosManifestacao | null>(null);
  const [fichaAbertaFile, setFichaAbertaFile] = useState<Match | null>(null);
  // Remonta o formulário ao trocar de ficha (Novo Formulário / reabrir da fila)
  const [fichaSessao, setFichaSessao] = useState(0);

  // Fila "Fichas em Conferência com o Oficial": gravada no banco do FIORIX e compartilhada entre as máquinas
  const [fichasPendentes, setFichasPendentes] = useState<FichaEmConferencia[]>([]);
  const [filaCarregando, setFilaCarregando] = useState(true);
  const [filaErro, setFilaErro] = useState('');
  const [fichaRegistroId, setFichaRegistroId] = useState<string | null>(null);
  const [conferindoIds, setConferindoIds] = useState<Record<string, boolean>>({});
  const [filtroStatusConferencia, setFiltroStatusConferencia] = useState<'TODOS' | 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO'>('TODOS');
  const [buscaFiscalizacao, setBuscaFiscalizacao] = useState('');
  const [paginaConferencia, setPaginaConferencia] = useState(1);
  // Quando a ficha aberta é correção de uma manifestação arquivada (Histórico › Nova versão)
  const [fichaVersaoAnteriorId, setFichaVersaoAnteriorId] = useState<string | null>(null);
  // Card da fila oculto por padrão; o usuário pode exibi-lo (preferência persistida)
  const [filaVisivel, setFilaVisivel] = useState(false);
  // Cards das 6 Pastas do Servidor sempre iniciam ocultos por padrão na tela de Manifestações
  const [mostrarCardsPastasServidor, setMostrarCardsPastasServidor] = useState(false);

  async function recarregarFila() {
    try {
      setFichasPendentes(await carregarFilaConferencia());
      setFilaErro('');
    } catch (err) {
      setFilaErro(err instanceof Error ? err.message : 'Não foi possível carregar a fila de conferência.');
    } finally {
      setFilaCarregando(false);
    }
  }

  useEffect(() => {
    try {
      setFilaVisivel(window.localStorage.getItem(CHAVE_FILA_VISIVEL) === '1');
    } catch {
      /* localStorage indisponível: mantém oculto */
    }

    let ativo = true;
    (async () => {
      // Migração única: fichas que estavam apenas neste navegador vão para o banco
      const antigas = lerFilaFichasOficial();
      if (antigas.length > 0) {
        try {
          await importarFilaAntiga(antigas);
          window.localStorage.removeItem(CHAVE_FILA_FICHAS_OFICIAL);
        } catch {
          /* mantém a fila antiga no navegador para tentar novamente na próxima abertura */
        }
      }
      if (!ativo) return;
      await recarregarFila();

      // Histórico › "Nova versão": /gestao-documental?reabrir=<id>
      const url = new URL(window.location.href);
      const reabrir = url.searchParams.get('reabrir');
      if (reabrir) {
        url.searchParams.delete('reabrir');
        window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
        try {
          const m = await obterManifestacaoApi(reabrir);
          if (!ativo) return;
          const origem = m.arquivoOrigem;
          const arquivo: Match | null = origem
            ? { rootId: origem.rootId || 'processos', relativePath: origem.relativePath, name: origem.name, size: 0, modifiedAt: '' }
            : null;
          if (m.status === 'conferencia') {
            abrirFicha(
              { ...m.dados, id_ficha: m.fichaId || m.dados.id_ficha || `FICHA-${Date.now()}`, etapa_ativa_salva: 'manifestacao' },
              arquivo,
              null,
              m.id,
            );
          } else {
            abrirFicha(
              { ...m.dados, id_ficha: `FICHA-${Date.now()}`, etapa_ativa_salva: 'manifestacao' },
              arquivo,
              m.id,
            );
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não foi possível reabrir a manifestação arquivada.');
        }
      }
    })();

    // Fila compartilhada: atualiza ao voltar para a aba e a cada minuto
    const aoFocar = () => { if (document.visibilityState === 'visible') void recarregarFila(); };
    document.addEventListener('visibilitychange', aoFocar);
    const intervalo = window.setInterval(aoFocar, 60000);
    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', aoFocar);
      window.clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarFilaVisivel() {
    setFilaVisivel(v => {
      const novo = !v;
      try {
        window.localStorage.setItem(CHAVE_FILA_VISIVEL, novo ? '1' : '0');
      } catch {
        /* ignora falha de persistência */
      }
      return novo;
    });
  }

  function normalizarDadosExtraidos(raw: DadosManifestacao, arquivo: Match | null): DadosManifestacao {
    const limpo: DadosManifestacao = { ...criarDadosManifestacaoPadrao(), ...raw };
    if (limpo.requerente) {
      limpo.requerente = limpo.requerente
        .replace(/\s+(?:USUCAPI[ÃA]O|MERIT[ÍI]SSIM[OA]|MM\.?\s*JUIZ[A]?|EXCELENT[ÍI]SSIM[OA]|DOUTOR[A]?\s+JUIZ[A]?).*$/i, '')
        .trim();
    }
    const imovelOriginal = limpo.imovel;
    limpo.imovel = sanitizarDescricaoImovel(limpo.imovel);
    limpo.rua_olhar_confrontacao = sanitizarLogradouroConfrontacao(limpo.rua_olhar_confrontacao, imovelOriginal);
    if (Array.isArray(limpo.origem_campos)) {
      limpo.origem_campos = limpo.origem_campos.map(o =>
        o?.campo === 'imovel' && o.trecho
          ? { ...o, trecho: sanitizarDescricaoImovel(o.trecho) }
          : o,
      );
    }
    if (!limpo.imovel) {
      const textoAux = [
        limpo.anotacoes_ficha_oficial,
        ...(limpo.origem_campos || []).map(o => o?.trecho || ''),
      ]
        .filter(Boolean)
        .join('\n');
      const rec = extrairImovelDoTextoAutos(textoAux);
      if (rec.imovel) limpo.imovel = rec.imovel;
      if (!limpo.rua_olhar_confrontacao && rec.rua) limpo.rua_olhar_confrontacao = rec.rua;
    }
    const refCaminho = `${arquivo?.relativePath || ''} ${arquivo?.name || ''}`;
    if (!limpo.numero_processo?.trim()) {
      const cnj = refCaminho.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      if (cnj) limpo.numero_processo = cnj[1];
    }
    if (!limpo.vara?.trim() && Array.isArray(limpo.origem_campos)) {
      const origensTxt = limpo.origem_campos.map(o => o?.trecho || '').join(' ');
      const varaMatch = origensTxt.match(/(\d{1,2}\s*[ªaº°]?\s*Vara(?:\s+(?:C[íi]vel|de\s+Registros\s+P[úu]blicos|da\s+Fazenda\s+P[úu]blica))?(?:\s+(?:da\s+Comarca\s+)?de\s+[A-ZÀ-Úa-zà-ú\s]{3,25})?)/i);
      if (varaMatch) limpo.vara = varaMatch[1].replace(/\s+/g, ' ').trim();
    }
    if (!limpo.matricula_transcricao?.trim() && arquivo?.matricula) {
      limpo.matricula_transcricao = arquivo.matricula;
    }
    return limpo;
  }

  function abrirFicha(
    dados: DadosManifestacao,
    arquivo: Match | null,
    versaoAnteriorId: string | null = null,
    registroIdExistente: string | null = null,
  ) {
    const normalizada: DadosManifestacao = {
      ...normalizarDadosExtraidos(dados, arquivo),
      status_conferencia: dados.status_conferencia === 'CONFERIDO' ? 'CONFERIDO' : 'AGUARDANDO_CONFERENCIA',
    };
    setFichaAberta(normalizada);
    setFichaAbertaFile(arquivo);
    setFichaVersaoAnteriorId(versaoAnteriorId);
    setFichaRegistroId(registroIdExistente);
    setFichaSessao(s => s + 1);

    // Toda vez que o colaborador gerar o formulário de MANIFESTAÇÃO, classifica e arquiva
    // automaticamente como AGUARDANDO CONFERÊNCIA (selo vermelho) para fiscalização.
    if (!registroIdExistente && (arquivo || normalizada.numero_processo?.trim())) {
      void (async () => {
        try {
          const salva = await salvarFichaConferencia(normalizada, arquivo);
          setFichaRegistroId(salva.id);
          await recarregarFila();
        } catch {
          /* se falhar o auto-salvamento silencioso, o botão Salvar na Fila permanece disponível */
        }
      })();
    }

    // Sempre que houver número de matrícula no processo de usucapião, garante que o arquivo da imagem
    // (LV2 em K:\IMAGENS\LV2) esteja incluído no resultado da busca
    if (normalizada.matricula_transcricao && !/transcri[çc][ãa]o/i.test(normalizada.matricula_transcricao)) {
      void anexarImagemLv2AoResultado(normalizada.matricula_transcricao, arquivo);
    }
  }

  function abrirNovoFormulario() {
    abrirFicha(criarDadosManifestacaoPadrao(), null);
  }

  async function salvarFichaNaFila(dados: DadosManifestacao) {
    // Erros sobem para o formulário, que exibe o aviso ao usuário
    const salva = await salvarFichaConferencia(
      {
        ...dados,
        status_conferencia: dados.status_conferencia === 'CONFERIDO' ? 'CONFERIDO' : 'AGUARDANDO_CONFERENCIA',
      },
      fichaAbertaFile,
    );
    setFichaRegistroId(salva.id);
    await recarregarFila();
  }

  async function alternarConferenciaCard(ficha: FichaEmConferencia) {
    const novoStatus = ficha.statusConferencia === 'CONFERIDO' ? 'AGUARDANDO_CONFERENCIA' : 'CONFERIDO';
    setConferindoIds(prev => ({ ...prev, [ficha.registroId]: true }));
    try {
      const atualizada = await alternarConferenciaFicha(ficha.registroId, novoStatus);
      setFichasPendentes(prev => prev.map(item => (item.registroId === ficha.registroId ? atualizada : item)));
      setFilaErro('');
    } catch (err) {
      setFilaErro(err instanceof Error ? err.message : 'Não foi possível atualizar o carimbo de conferência.');
    } finally {
      setConferindoIds(prev => ({ ...prev, [ficha.registroId]: false }));
    }
  }

  async function alternarConferenciaFichaAberta(
    novoStatus: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO',
  ) {
    let regId = fichaRegistroId;
    if (!regId && fichaAberta) {
      const salva = await salvarFichaConferencia(
        { ...fichaAberta, status_conferencia: novoStatus },
        fichaAbertaFile,
      );
      regId = salva.id;
      setFichaRegistroId(regId);
    }
    if (!regId) return;
    await alternarConferenciaFicha(regId, novoStatus);
    await recarregarFila();
  }

  async function finalizarFicha(payload: PayloadFinalizacao) {
    const arquivada = await finalizarManifestacaoApi(payload);
    // Retira imediatamente da lista local "Em Conferência" e sincroniza contadores com o servidor
    setFichasPendentes(prev =>
      prev.filter(item => item.registroId !== arquivada.id && item.id !== payload.fichaId),
    );
    await recarregarFila();
    return arquivada;
  }

  async function removerFichaDaFila(ficha: FichaEmConferencia) {
    if (!window.confirm(`Remover o processo ${ficha.numero_processo} da fila de conferência?\nA fila é compartilhada: ele sairá da lista em todas as máquinas.`)) return;
    try {
      await removerFichaConferencia(ficha.registroId);
    } catch (err) {
      setFilaErro(err instanceof Error ? err.message : 'Não foi possível remover a ficha da fila.');
    }
    await recarregarFila();
  }

  function reabrirFichaDaFila(ficha: FichaEmConferencia) {
    const arquivo: Match | null = ficha.arquivoOrigem
      ? { rootId: ficha.arquivoOrigem.rootId || 'processos', relativePath: ficha.arquivoOrigem.relativePath, name: ficha.arquivoOrigem.name, size: 0, modifiedAt: '' }
      : null;
    abrirFicha(
      {
        ...ficha.dados,
        id_ficha: ficha.id,
        status_conferencia: ficha.statusConferencia,
        conferido_por_nome: ficha.dados.conferido_por_nome ?? ficha.conferidoPorNome ?? undefined,
        conferido_em: ficha.dados.conferido_em ?? undefined,
      },
      arquivo,
      null,
      ficha.registroId,
    );
  }
  const [assinaturaAberta, setAssinaturaAberta] = useState<{ nome: string; analise: AnaliseAssinaturaPdf } | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<DocumentTextResult | null>(null);
  const [documentoAbertoFile, setDocumentoAbertoFile] = useState<Match | null>(null);

  // Feedback de cópia do caminho
  const [caminhoCopiado, setCaminhoCopiado] = useState<string | null>(null);

  // Menu suspenso de ações dos três pontinhos por linha
  const [menuAbertoKey, setMenuAbertoKey] = useState<string | null>(null);
  // Posição fixa na viewport (desktop) ou bottom-sheet responsivo (mobile < 768px)
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number; mobile?: boolean } | null>(null);

  function alternarMenuAcoes(fileKey: string, botao: HTMLElement) {
    if (menuAbertoKey === fileKey) { setMenuAbertoKey(null); return; }
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileViewport) {
      setMenuPos({
        right: 8,
        maxHeight: Math.max(240, Math.floor(window.innerHeight * 0.78)),
        mobile: true,
      });
      setMenuAbertoKey(fileKey);
      return;
    }
    const r = botao.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    const espacoAcima = r.top;
    const abrirParaCima = espacoAbaixo < 380 && espacoAcima > espacoAbaixo;
    setMenuPos({
      ...(abrirParaCima ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      right: Math.max(8, window.innerWidth - r.right),
      maxHeight: Math.max(160, (abrirParaCima ? espacoAcima : espacoAbaixo) - 14),
      mobile: false,
    });
    setMenuAbertoKey(fileKey);
  }

  useEffect(() => {
    if (!menuAbertoKey) return;
    const fechar = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-acoes]')) setMenuAbertoKey(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbertoKey(null);
    };
    // Menu fixo no desktop não acompanha a rolagem da página/tabela (no mobile é bottom-sheet fixo e ignora bounce do Safari)
    const fecharAoRolar = (e: Event) => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      const target = e.target;
      if (target instanceof Element && target.closest('[data-menu-acoes]')) return;
      setMenuAbertoKey(null);
    };
    const fecharAoRedimensionar = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      setMenuAbertoKey(null);
    };
    window.addEventListener('mousedown', fechar);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', fecharAoRolar, true);
    window.addEventListener('resize', fecharAoRedimensionar);
    return () => {
      window.removeEventListener('mousedown', fechar);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', fecharAoRolar, true);
      window.removeEventListener('resize', fecharAoRedimensionar);
    };
  }, [menuAbertoKey]);

  // Cronômetro de tempo decorrido e tempo restante estimado para ações pesadas
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tempoEstimado, setTempoEstimado] = useState(12);
  // Progresso do download do PDF direto do Connector (rede interna)
  const [downloadPdf, setDownloadPdf] = useState<{ recebido: number; total: number } | null>(null);

  useEffect(() => {
    if (!processandoAcao) {
      setTempoDecorrido(0);
      return;
    }
    const inicio = Date.now();
    const interval = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicio) / 1000);
      setTempoDecorrido(segundos);
    }, 500);

    return () => clearInterval(interval);
  }, [processandoAcao]);

  const tempoRestante = Math.max(0, tempoEstimado - tempoDecorrido);

  // Cronômetro para Busca Documental
  const [tempoBuscaDecorrido, setTempoBuscaDecorrido] = useState(0);
  const TEMPO_ESTIMADO_BUSCA = 8;

  useEffect(() => {
    if (!busy) {
      setTempoBuscaDecorrido(0);
      return;
    }
    const inicio = Date.now();
    const interval = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicio) / 1000);
      setTempoBuscaDecorrido(segundos);
    }, 500);

    return () => clearInterval(interval);
  }, [busy]);

  const tempoBuscaRestante = Math.max(0, TEMPO_ESTIMADO_BUSCA - tempoBuscaDecorrido);

  function formatTempoMMSS(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Histórico de tempos de pesquisa (persistido localmente)
  const [temposBusca, setTemposBusca] = useState<TempoBusca[]>([]);
  const [mostrarTemposBusca, setMostrarTemposBusca] = useState(false);
  const [duracaoJobMs, setDuracaoJobMs] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE_TEMPOS_BUSCA);
      if (raw) setTemposBusca(JSON.parse(raw) as TempoBusca[]);
    } catch {
      /* histórico indisponível */
    }
  }, []);

  function registrarTempoBusca(item: TempoBusca) {
    setDuracaoJobMs(item.ms);
    setTemposBusca(prev => {
      const novo = [item, ...prev].slice(0, 10);
      try {
        window.localStorage.setItem(CHAVE_TEMPOS_BUSCA, JSON.stringify(novo));
      } catch {
        /* ignora falha de persistência */
      }
      return novo;
    });
  }

  // Cache em memória e armazenamento persistente para respostas instantâneas
  const searchCacheRef = useRef<Map<string, SearchState>>(new Map());
  const extrairCacheRef = useRef<Map<string, DadosManifestacao>>(new Map());
  const assinaturasCacheRef = useRef<Map<string, { nome: string; analise: AnaliseAssinaturaPdf }>>(new Map());
  const leituraCacheRef = useRef<Map<string, DocumentTextResult>>(new Map());
  // PDFs baixados do Connector ficam só em memória (blob:), limitados para não estourar a RAM
  const pdfsLocaisRef = useRef<{ fileKey: string; url: string }[]>([]);
  const [isCacheHit, setIsCacheHit] = useState(false);

  useEffect(() => () => {
    for (const p of pdfsLocaisRef.current) URL.revokeObjectURL(p.url);
    pdfsLocaisRef.current = [];
  }, []);

  const EXT_CACHE_PREFIX = 'fiorix_ext_v3_';

  function isExtracaoValida(data: DadosManifestacao | null | undefined): boolean {
    if (!data) return false;
    if (!data.requerente || /\[page:\d+\]|camscanner/i.test(data.imovel || '')) return false;
    return !!(data.imovel || data.contribuinte_sql || data.matricula_transcricao || data.titular_origem);
  }

  function getCachedExtracao(fileKey: string): DadosManifestacao | null {
    if (extrairCacheRef.current.has(fileKey)) {
      const mem = extrairCacheRef.current.get(fileKey)!;
      if (isExtracaoValida(mem)) return mem;
      extrairCacheRef.current.delete(fileKey);
    }
    try {
      const sess = sessionStorage.getItem(EXT_CACHE_PREFIX + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (isExtracaoValida(parsed)) {
          extrairCacheRef.current.set(fileKey, parsed);
          return parsed;
        } else {
          sessionStorage.removeItem(EXT_CACHE_PREFIX + fileKey);
        }
      }
      const loc = localStorage.getItem(EXT_CACHE_PREFIX + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000) {
          if (isExtracaoValida(parsed.data)) {
            extrairCacheRef.current.set(fileKey, parsed.data);
            return parsed.data;
          } else {
            localStorage.removeItem(EXT_CACHE_PREFIX + fileKey);
          }
        }
      }
    } catch {}
    return null;
  }

  function setCachedExtracao(fileKey: string, data: DadosManifestacao) {
    if (!isExtracaoValida(data)) return;
    extrairCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem(EXT_CACHE_PREFIX + fileKey, JSON.stringify(data));
      localStorage.setItem(EXT_CACHE_PREFIX + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  function getCachedAssinatura(fileKey: string): { nome: string; analise: AnaliseAssinaturaPdf } | null {
    if (assinaturasCacheRef.current.has(fileKey)) {
      return assinaturasCacheRef.current.get(fileKey)!;
    }
    try {
      const sess = sessionStorage.getItem('fiorix_ass_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        assinaturasCacheRef.current.set(fileKey, parsed);
        return parsed;
      }
      const loc = localStorage.getItem('fiorix_ass_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000) {
          assinaturasCacheRef.current.set(fileKey, parsed.data);
          return parsed.data;
        }
      }
    } catch {}
    return null;
  }

  function setCachedAssinatura(fileKey: string, data: { nome: string; analise: AnaliseAssinaturaPdf }) {
    assinaturasCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem('fiorix_ass_' + fileKey, JSON.stringify(data));
      localStorage.setItem('fiorix_ass_' + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  function getCachedLeitura(fileKey: string): DocumentTextResult | null {
    const lower = fileKey.toLowerCase();
    const isKen = lower.endsWith('.ken') || lower.endsWith('.tif') || lower.endsWith('.tiff');
    const isPdf = lower.endsWith('.pdf');

    const isValid = (data: DocumentTextResult | null | undefined, fromDiskStorage = false): boolean => {
      if (!data) return false;
      if (isKen && (!data.pages || data.pages.length === 0)) return false;
      if (isPdf) {
        if (!data.pdfDataUrl) return false;
        if (fromDiskStorage && data.pdfDataUrl.startsWith('blob:')) return false;
      }
      return true;
    };

    if (leituraCacheRef.current.has(fileKey)) {
      const cached = leituraCacheRef.current.get(fileKey)!;
      if (isValid(cached, false)) return cached;
      leituraCacheRef.current.delete(fileKey);
    }
    try {
      const sess = sessionStorage.getItem('fiorix_doc_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (isValid(parsed, true)) {
          leituraCacheRef.current.set(fileKey, parsed);
          return parsed;
        } else {
          sessionStorage.removeItem('fiorix_doc_' + fileKey);
        }
      }
      const loc = localStorage.getItem('fiorix_doc_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000 && isValid(parsed.data, true)) {
          leituraCacheRef.current.set(fileKey, parsed.data);
          return parsed.data;
        } else {
          localStorage.removeItem('fiorix_doc_' + fileKey);
        }
      }
    } catch {}
    return null;
  }

  function setCachedLeitura(fileKey: string, data: DocumentTextResult) {
    leituraCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem('fiorix_doc_' + fileKey, JSON.stringify(data));
      localStorage.setItem('fiorix_doc_' + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const carregar = () => {
      fetch('/api/gestao-documental', { cache: 'no-store', signal: controller.signal })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          const raw: Connector[] = body.connectors || [];
          const ordenados = [...raw].sort((a, b) => connectorPriorityScore(b) - connectorPriorityScore(a));
          const activeOnline = ordenados.find(c => c.operationalState === 'ACTIVE' && isConnectorOnline(c));
          const activeAny = ordenados.find(c => c.operationalState === 'ACTIVE');
          const online = ordenados.find(c => isConnectorOnline(c) && c.operationalState !== 'PAUSED');
          const efetivo = activeOnline ?? activeAny ?? online ?? ordenados[0] ?? null;
          setConnectors(efetivo ? [efetivo] : []);
          setConnectorId(efetivo?.id || '');
        })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    };

    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => {
      controller.abort();
      clearInterval(intervalo);
      abort.current?.abort();
    };
  }, []);

  async function executeSearch(termoBusca: string, forceFresh = false) {
    const trimmed = termoBusca.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Informe um termo de busca com no mínimo 2 caracteres.');
      return;
    }

    abort.current?.abort();
    const inicioBusca = performance.now();
    setDuracaoJobMs(null);
    const queryNormalizada = normalizarTermoPesquisaDocumental(trimmed);
    const cacheKey = `${connectorId}:${chaveCachePesquisaDocumental(trimmed)}`;
    if (!forceFresh && searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setJob(cached);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
      registrarTempoBusca({
        termo: trimmed,
        ms: Math.round(performance.now() - inicioBusca),
        quando: Date.now(),
        resultados: cached.result?.files.length ?? 0,
        cache: true,
      });
      return;
    }

    setIsCacheHit(false);
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setError(''); setJob(null);
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId, type: 'search', query: queryNormalizada, forceFresh }), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.status === 'complete' && body.result) {
        const state = normalizarEstadoBusca({ id: body.id, status: 'complete', expiresAt: '', result: body.result })!;
        setJob(state);
        setIsCacheHit(Boolean(body.cached));
        searchCacheRef.current.set(cacheKey, state);
        registrarTempoBusca({
          termo: trimmed,
          ms: Math.round(performance.now() - inicioBusca),
          quando: Date.now(),
          resultados: body.result?.files?.length ?? 0,
          cache: Boolean(body.cached),
        });
        return;
      }
      const deadline = Date.now() + 125000;
      let tentativa = 0;
      while (!controller.signal.aborted && Date.now() < deadline) {
        const esperaMs = tentativa === 0 ? 220 : tentativa < 5 ? 350 : 500;
        tentativa++;
        await new Promise<void>(resolve => {
          const onAbort = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', onAbort); resolve(); }, esperaMs);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        if (controller.signal.aborted) return;
        const result = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store', signal: controller.signal });
        const rawState = await result.json();
        if (!result.ok) throw new Error(rawState.error);
        const state = normalizarEstadoBusca(rawState)!;
        setJob(state);
        if (state.status === 'failed') throw new Error('Não foi possível pesquisar. Verifique o acesso do Connector às pastas.');
        if (state.status === 'complete') {
          searchCacheRef.current.set(cacheKey, state);
          registrarTempoBusca({
            termo: trimmed,
            ms: Math.round(performance.now() - inicioBusca),
            quando: Date.now(),
            resultados: state.result?.files?.length ?? 0,
          });
          return;
        }
      }
      if (!controller.signal.aborted) throw new Error('Pesquisa expirada. Verifique se o módulo documental está habilitado no Connector.');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha na pesquisa.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function salvarHistoricoAtual(origemTitulo?: string) {
    if (!query && !job) return;
    setHistoricoBuscas(prev => {
      if (prev.length > 0 && prev[prev.length - 1].query === query) {
        return prev;
      }
      return [
        ...prev,
        {
          query,
          job,
          searchMode,
          cruzadaParams: searchMode === 'cruzada' ? {
            processo: cruzadaProcesso,
            matricula: cruzadaMatricula,
            contribuinte: cruzadaContribuinte,
            requerente: cruzadaRequerente,
          } : undefined,
          origemTitulo: origemTitulo || `Processo / Termo "${query}"`,
          totalDocumentos: job?.result?.files?.length ?? 0,
          timestamp: Date.now(),
        }
      ];
    });
  }

  function handleSearchSimples(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (job?.status === 'complete' && job.result) {
      const topoQuery = historicoBuscas[historicoBuscas.length - 1]?.query;
      if (query && query !== trimmed && query !== topoQuery) {
        salvarHistoricoAtual(`Pesquisa "${query}"`);
      }
    }
    executeSearch(trimmed);
  }

  function handleSearchCruzada(event: FormEvent) {
    event.preventDefault();
    const termos = [
      cruzadaProcesso.trim(),
      cruzadaMatricula.trim(),
      cruzadaContribuinte.trim(),
      cruzadaRequerente.trim(),
    ].filter(Boolean);

    if (termos.length === 0) {
      setError('Preencha ao menos um dos campos da Busca Cruzada (Processo, Matrícula, SQL ou Requerente).');
      return;
    }
    // " | " separa os campos: o Connector trata cada um como critério próprio e une os resultados
    // (arquivos do processo + imagem da matrícula no Livro 2), em vez de exigir todos no mesmo arquivo.
    const combinedQuery = termos.join(' | ');
    if (job?.status === 'complete' && job.result && query && query !== combinedQuery) {
      salvarHistoricoAtual(`Busca "${query}"`);
    }
    setQuery(combinedQuery);
    executeSearch(combinedQuery);
  }

  function buscarMatriculaNoLivro2(termoMatricula: string, tituloOrigem?: string) {
    const numeros = termoMatricula.replace(/[^\d]/g, '');
    const queryBusca = numeros && numeros.length >= 2 ? numeros : termoMatricula.trim();
    if (!queryBusca || queryBusca.length < 2) return;

    if (query && query !== queryBusca) {
      salvarHistoricoAtual(tituloOrigem || (query ? `Processo / Termo "${query}"` : 'Pesquisa anterior'));
    }

    setQuery(queryBusca);
    setSearchMode('simples');
    executeSearch(queryBusca);
  }

  // Controle das buscas automáticas de imagens LV2 (K:\IMAGENS\LV2) e extrações silenciosas de matrícula
  const lv2AnexadasRef = useRef<Set<string>>(new Set());
  const extracaoBgTentadaRef = useRef<Set<string>>(new Set());

  async function anexarImagemLv2AoResultado(termoMatricula: string, arquivoProcesso?: Match | null) {
    if (!termoMatricula || /transcri[çc][ãa]o/i.test(termoMatricula)) return;
    const numeros = termoMatricula.replace(/[^\d]/g, '');
    const numInt = parseInt(numeros, 10);
    if (!numeros || numeros.length < 2 || isNaN(numInt) || numInt <= 0) return;

    const rotuloMatricula = /matr[ií]cula/i.test(termoMatricula)
      ? termoMatricula.trim()
      : `Matrícula nº ${numeros}`;

    // Atualiza o metadado da matrícula no arquivo do processo caso tenha vindo da extração
    if (arquivoProcesso) {
      setJob(prev => {
        if (!prev?.result) return prev;
        const atualizadoFiles = prev.result.files.map(f =>
          f.rootId === arquivoProcesso.rootId && f.relativePath === arquivoProcesso.relativePath && !f.matricula
            ? { ...f, matricula: rotuloMatricula }
            : f,
        );
        return {
          ...prev,
          result: {
            ...prev.result,
            matriculaDetectada: prev.result.matriculaDetectada || rotuloMatricula,
            files: atualizadoFiles,
          },
        };
      });
    }

    const chaveLv2 = `${connectorId || 'auto'}:${numInt}`;
    if (lv2AnexadasRef.current.has(chaveLv2)) return;
    lv2AnexadasRef.current.add(chaveLv2);

    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'search',
          query: `Matrícula ${numeros}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        lv2AnexadasRef.current.delete(chaveLv2);
        return;
      }

      let arquivosRetornados: Match[] | null = null;
      if (body.status === 'complete' && body.result?.files) {
        arquivosRetornados = body.result.files as Match[];
      } else if (body.id) {
        const deadline = Date.now() + 35000;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 450));
          const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
          const state = await res.json();
          if (!res.ok || state.status === 'failed') break;
          if (state.status === 'complete' && state.result?.files) {
            arquivosRetornados = state.result.files as Match[];
            break;
          }
        }
      }

      if (!arquivosRetornados || arquivosRetornados.length === 0) return;

      const imagensLv2 = arquivosRetornados.filter(f => {
        const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
        if (ext !== '.ken' && ext !== '.tif' && ext !== '.tiff') return false;
        const ehLv2 =
          f.rootId === 'livro2' ||
          /(?:^|[\\/])lv2[\\/]/i.test(f.relativePath) ||
          f.rootId === 'imagens';
        if (!ehLv2) return false;
        const fNum = parseInt(f.name.replace(/[^\d]/g, ''), 10);
        return !isNaN(fNum) && fNum === numInt;
      });

      if (imagensLv2.length === 0) return;

      setJob(prev => {
        if (!prev || prev.status !== 'complete' || !prev.result) return prev;
        const merged = normalizarEstadoBusca({
          ...prev,
          result: {
            ...prev.result,
            matriculaDetectada: prev.result.matriculaDetectada || rotuloMatricula,
            matriculas: Array.from(new Set([...(prev.result.matriculas || []), rotuloMatricula])),
            files: [...prev.result.files, ...imagensLv2],
          },
        });
        if (merged && query.trim()) {
          searchCacheRef.current.set(`${connectorId}:${chaveCachePesquisaDocumental(query.trim())}`, merged);
        }
        return merged;
      });
    } catch {
      lv2AnexadasRef.current.delete(chaveLv2);
    }
  }

  // Sempre que o resultado da busca trouxer processo(s) de usucapião, verifica a matrícula vinculada
  // (nos metadados, cache de extração, fila de conferência ou extração em background) e inclui
  // automaticamente o arquivo da imagem de K:\IMAGENS\LV2 no resultado da busca.
  useEffect(() => {
    if (!job || job.status !== 'complete' || !job.result || !connectorId) return;
    const files = job.result.files || [];
    if (files.length === 0) return;

    const ehImagemAcervo = (nome: string) => /\.(?:ken|tiff?)$/i.test(nome);
    const arquivosProcesso = files.filter(f => !ehImagemAcervo(f.name));
    if (arquivosProcesso.length === 0) return;

    const matriculasConhecidas = new Map<number, { texto: string; origem?: Match }>();
    const registrarSeMatricula = (val?: string | null, origem?: Match) => {
      if (!val || /transcri[çc][ãa]o/i.test(val)) return;
      const num = parseInt(val.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num >= 10 && !matriculasConhecidas.has(num)) {
        matriculasConhecidas.set(num, { texto: val, origem });
      }
    };

    registrarSeMatricula(job.result.matriculaDetectada);
    for (const m of job.result.matriculas || []) registrarSeMatricula(m);

    for (const arq of arquivosProcesso) {
      const fileKey = `${arq.rootId}:${arq.relativePath}`;
      registrarSeMatricula(arq.matricula, arq);
      const cachedExt = getCachedExtracao(fileKey);
      if (cachedExt?.matricula_transcricao) {
        registrarSeMatricula(cachedExt.matricula_transcricao, arq);
      }
      // Cruza também com as fichas salvas na fila de conferência pelo nº do processo ou arquivo de origem
      const cnjArq = `${arq.relativePath} ${arq.name}`.replace(/[^\d]/g, '');
      const fichaCorrespondente = fichasPendentes.find(fp => {
        if (fp.arquivoOrigem && fp.arquivoOrigem.relativePath === arq.relativePath) return true;
        const cnjFicha = (fp.numero_processo || '').replace(/[^\d]/g, '');
        return Boolean(cnjFicha.length >= 15 && cnjArq.includes(cnjFicha));
      });
      if (fichaCorrespondente?.matricula_transcricao) {
        registrarSeMatricula(fichaCorrespondente.matricula_transcricao, arq);
      }
    }

    for (const [numInt, info] of matriculasConhecidas.entries()) {
      const jaTemImagemLv2 = files.some(f => {
        if (!ehImagemAcervo(f.name)) return false;
        const fNum = parseInt(f.name.replace(/[^\d]/g, ''), 10);
        return !isNaN(fNum) && fNum === numInt;
      });
      if (!jaTemImagemLv2) {
        lv2AnexadasRef.current.delete(`${connectorId || 'auto'}:${numInt}`);
        void anexarImagemLv2AoResultado(info.texto, info.origem);
      }
    }

    // Se a pesquisa retornou até 3 arquivos de processo (.pdf/.doc/.docx) e ainda não temos a matrícula
    // em cache, consulta silenciosamente a extração da petição para descobrir a matrícula e anexar o arquivo LV2
    if (matriculasConhecidas.size === 0 && arquivosProcesso.length <= 3 && !processandoAcao) {
      const candidato = arquivosProcesso.find(f => /\.(?:pdf|docx?)$/i.test(f.name));
      if (candidato) {
        const fileKey = `${candidato.rootId}:${candidato.relativePath}`;
        if (!extracaoBgTentadaRef.current.has(fileKey)) {
          extracaoBgTentadaRef.current.add(fileKey);
          void (async () => {
            try {
              const res = await fetch('/api/gestao-documental', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectorId,
                  type: 'extract_petition',
                  rootId: candidato.rootId,
                  relativePath: candidato.relativePath,
                }),
              });
              const body = await res.json();
              if (!res.ok) return;
              let extraido: DadosManifestacao | null = null;
              if (body.status === 'complete' && body.result) {
                extraido = body.result as DadosManifestacao;
              } else if (body.id) {
                const deadline = Date.now() + 65000;
                while (Date.now() < deadline) {
                  await new Promise(r => setTimeout(r, 600));
                  const poll = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
                  const st = await poll.json();
                  if (!poll.ok || st.status === 'failed') break;
                  if (st.status === 'complete' && st.result) {
                    extraido = st.result as DadosManifestacao;
                    break;
                  }
                }
              }
              if (extraido) {
                const normalizado = normalizarDadosExtraidos(extraido, candidato);
                setCachedExtracao(fileKey, normalizado);
                if (normalizado.matricula_transcricao && !/transcri[çc][ãa]o/i.test(normalizado.matricula_transcricao)) {
                  await anexarImagemLv2AoResultado(normalizado.matricula_transcricao, candidato);
                }
              }
            } catch {
              /* falha silenciosa em background */
            }
          })();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.result?.files.length, connectorId, fichasPendentes.length]);

  function voltarTelaAnterior() {
    if (historicoBuscas.length === 0) return;
    const novoHistorico = [...historicoBuscas];
    const anterior = novoHistorico.pop()!;
    setHistoricoBuscas(novoHistorico);

    setQuery(anterior.query);
    setSearchMode(anterior.searchMode);
    if (anterior.cruzadaParams) {
      setCruzadaProcesso(anterior.cruzadaParams.processo);
      setCruzadaMatricula(anterior.cruzadaParams.matricula);
      setCruzadaContribuinte(anterior.cruzadaParams.contribuinte);
      setCruzadaRequerente(anterior.cruzadaParams.requerente);
    }
    if (anterior.job) {
      setJob(anterior.job);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
    } else {
      executeSearch(anterior.query);
    }
  }

  async function extrairPeticao(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedExtracao(fileKey);
      if (cached) {
        abrirFicha(cached, file);
        return;
      }
    } else {
      extrairCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem(EXT_CACHE_PREFIX + fileKey);
        localStorage.removeItem(EXT_CACHE_PREFIX + fileKey);
      } catch {}
    }

    // Em modo 'padrao', deixa undefined para o motor Rust detectar automaticamente
    // o início/fim da Petição Inicial (e o volume Parte 1 em processos divididos) sem OCR supérfluo.
    let pageStart: number | undefined = undefined;
    let pageEnd: number | undefined = undefined;
    if (ocrModoPagina === 'personalizado') {
      pageStart = Math.max(1, ocrPaginaInicio);
      pageEnd = Math.max(pageStart, ocrPaginaFim);
    } else if (ocrModoPagina === 'todas') {
      pageStart = 1;
      pageEnd = 40;
    }

    setTempoEstimado(file.size > 5 * 1024 * 1024 ? 14 : 4);
    setProcessandoAcao({ id: fileKey, tipo: 'extracao', fileName: file.name });
    setError('');

    const requisitarExtracao = async (
      pStart: number | undefined,
      pEnd: number | undefined,
      fresh: boolean,
    ): Promise<DadosManifestacao> => {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'extract_petition',
          rootId: file.rootId,
          relativePath: file.relativePath,
          pageStart: pStart,
          pageEnd: pEnd,
          forceFresh: fresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Falha ao iniciar extração.');

      if (body.status === 'complete' && body.result) {
        return body.result as DadosManifestacao;
      }

      const deadline = Date.now() + 95000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 200 : tentativa < 5 ? 350 : 600));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error || 'Falha ao consultar extração.');
        if (state.status === 'complete' && state.result) {
          return state.result as DadosManifestacao;
        }
        if (state.status === 'failed') {
          const serverErr =
            state.result && typeof state.result === 'object' && 'error' in state.result
              ? String((state.result as { error?: unknown }).error || '')
              : '';
          throw new Error(
            serverErr ||
              state.error ||
              'Falha na extração no servidor local. Verifique se o arquivo é um documento legível (PDF, DOC ou DOCX).',
          );
        }
      }
      throw new Error('Tempo limite excedido na extração da petição.');
    };

    try {
      let extraido: DadosManifestacao | null = null;
      try {
        extraido = await requisitarExtracao(pageStart, pageEnd, forceFresh);
      } catch (firstErr) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        if (isPdf && pageStart === undefined && pageEnd === undefined) {
          try {
            extraido = await requisitarExtracao(1, 18, true);
          } catch {
            // Se o PDF for digitalizado sem OCR legível ou exceder o tempo, abre o formulário pré-preenchido
            extraido = null;
          }
        } else if (!isPdf) {
          throw firstErr;
        }
      }

      if (extraido) {
        const normalizado = normalizarDadosExtraidos(extraido, file);
        setCachedExtracao(fileKey, normalizado);
        abrirFicha(normalizado, file);
        return;
      }

      // Fallback seguro para PDFs digitalizados/pesados: abre o formulário pré-preenchido com nº CNJ e pasta
      const fallback = normalizarDadosExtraidos(criarDadosManifestacaoPadrao(), file);
      abrirFicha(fallback, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao extrair dados da petição.');
    } finally {
      setProcessandoAcao(null);
    }
  }

  async function analisarAssinaturas(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedAssinatura(fileKey);
      if (cached) {
        setAssinaturaAberta(cached);
        return;
      }
    } else {
      assinaturasCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem('fiorix_ass_' + fileKey);
        localStorage.removeItem('fiorix_ass_' + fileKey);
      } catch {}
    }
    setTempoEstimado(8);
    setProcessandoAcao({ id: fileKey, tipo: 'assinatura', fileName: file.name });
    setError('');
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'analyze_signatures',
          rootId: file.rootId,
          relativePath: file.relativePath,
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      if (body.status === 'complete' && body.result) {
        const item = { nome: file.name, analise: body.result };
        setCachedAssinatura(fileKey, item);
        setAssinaturaAberta(item);
        return;
      }

      const deadline = Date.now() + 60000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 200 : tentativa < 5 ? 350 : 550));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const item = { nome: file.name, analise: state.result };
          setCachedAssinatura(fileKey, item);
          setAssinaturaAberta(item);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha na auditoria de assinaturas no servidor local.');
        }
      }
      throw new Error('Tempo limite excedido na análise de assinaturas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao analisar assinaturas.');
    } finally {
      setProcessandoAcao(null);
    }
  }

  /** Mostra o documento no visualizador ou, se o usuário preferir, direto em janela separada (outro monitor) */
  async function exibirDocumento(resultado: DocumentTextResult, file: Match) {
    const pref = lerPreferenciasJanelas();
    if (pref.sempreEmJanela) {
      const indice = pref.monitorPorTipo[tipoDoDocumento(resultado)];
      let monitor: MonitorDisponivel | null = null;
      if (indice !== undefined && suportaSelecaoDeMonitor()) {
        const monitores = await listarMonitores();
        monitor = monitores.find(m => m.indice === indice) ?? null;
      }
      const item = { documento: resultado, relativePath: file.relativePath, rootId: file.rootId };
      if (abrirDocumentoEmJanela(item, monitor)) return;
      // No Safari/Firefox pop-ups após chamadas assíncronas são bloqueados; abre no modal sobreposto sem erro intrusivo
    }
    setDocumentoAberto(resultado);
    setDocumentoAbertoFile(file);
  }

  async function visualizarDocumento(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedLeitura(fileKey);
      if (cached) {
        void exibirDocumento(cached, file);
        return;
      }
    } else {
      leituraCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem('fiorix_doc_' + fileKey);
        localStorage.removeItem('fiorix_doc_' + fileKey);
      } catch {}
    }
    setTempoEstimado(5);
    setProcessandoAcao({ id: fileKey, tipo: 'leitura', fileName: file.name });
    setError('');
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'read_document_text',
          rootId: file.rootId,
          relativePath: file.relativePath,
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      if (body.status === 'complete' && body.result) {
        await abrirResultadoLeitura(fileKey, body.result, file);
        return;
      }

      const deadline = Date.now() + 60000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 200 : tentativa < 5 ? 350 : 550));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          await abrirResultadoLeitura(fileKey, state.result, file);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha ao processar a leitura do documento no servidor local.');
        }
      }
      throw new Error('Tempo limite excedido na leitura do documento.');
    } catch (err) {
      if (err instanceof LinkLocalExpiradoError && !forceFresh) {
        // Ticket expirado ou Connector reiniciado: pede um novo link uma única vez
        setDownloadPdf(null);
        await visualizarDocumento(file, true);
        return;
      }
      // Tenta via /api/documental/ken e garante abertura no Visualizador Claro (Siplan)
      const relUpper = (file.relativePath || '').toUpperCase();
      const rootLower = (file.rootId || '').toLowerCase();
      const sessaoInferida =
        rootLower === 'setores' || relUpper.includes('SETORES')
          ? 'SETORES'
          : rootLower === 'lv3' || relUpper.includes('LV3')
          ? 'LV3'
          : rootLower === 'processos'
          ? 'PROCESSOS'
          : rootLower === 'minutas' || rootLower === 'usucapiao'
          ? 'USUCAPIAO_EXTRAJUD'
          : 'LV2';
      const termoDoc = (file.name || '').replace(/\.[^/.]+$/, '').trim() || '1';
      try {
        const kenRes = await fetch(
          `/api/documental/ken?doc=${encodeURIComponent(termoDoc)}&sessao=${encodeURIComponent(sessaoInferida)}`,
        );
        if (kenRes.ok) {
          const data = await kenRes.json();
          if (data.success && (data.pages?.length > 0 || data.pdfDataUrl || data.html || data.text)) {
            const resultadoKen: DocumentTextResult = {
              fileName: data.fileName || file.name,
              extension: data.extension || (data.pdfDataUrl ? '.pdf' : '.KEN'),
              html: data.html || '',
              text: data.text || '',
              pageTexts: data.pageTexts || [],
              size: data.size || file.size || 0,
              pageCount: data.pageCount || data.pages?.length || 1,
              pages: data.pages || (data.pdfDataUrl ? [data.pdfDataUrl] : []),
              pdfDataUrl: data.pdfDataUrl,
              downloadUrl: data.downloadUrl,
              notFound: false,
            };
            setCachedLeitura(fileKey, resultadoKen);
            await exibirDocumento(resultadoKen, file);
            return;
          }
        }
      } catch {
        // Continua para abertura padrão no visualizador claro com estado notFound
      }

      const extNome = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.KEN';
      await exibirDocumento(
        {
          fileName: file.name || `${termoDoc}.KEN`,
          extension: extNome,
          html: '',
          text: '',
          pageTexts: [],
          size: 0,
          pageCount: 0,
          pages: [],
          notFound: true,
          searchedTerm: termoDoc,
          searchedLocation: formatCartorioPath(file.rootId || 'imagens', file.relativePath || ''),
        },
        file,
      );
    } finally {
      setDownloadPdf(null);
      setProcessandoAcao(null);
    }
  }

  async function carregarPaginasKenRestantes(inicial: DocumentTextResult, file: Match): Promise<DocumentTextResult> {
    if (!inicial.hasMorePages || !inicial.pageCount || !inicial.pages) return inicial;
    let todasPaginas = [...inicial.pages];
    let proxInicio = (inicial.loadedPageEnd ?? todasPaginas.length) + 1;
    let seguranca = 0;
    while (proxInicio <= inicial.pageCount && seguranca < 15) {
      seguranca++;
      const res = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'read_document_text',
          rootId: file.rootId,
          relativePath: file.relativePath,
          pageStart: proxInicio,
        }),
      });
      if (!res.ok) break;
      const body = await res.json();
      let lote: DocumentTextResult | null = body.status === 'complete' ? body.result : null;
      if (!lote && body.id) {
        const deadline = Date.now() + 30000;
        let tent = 0;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, tent === 0 ? 180 : 350));
          tent++;
          const pr = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
          if (!pr.ok) break;
          const st = await pr.json();
          if (st.status === 'complete' && st.result) { lote = st.result; break; }
          if (st.status === 'failed') break;
        }
      }
      if (!lote?.pages?.length) break;
      todasPaginas = todasPaginas.concat(lote.pages);
      if (!lote.hasMorePages) break;
      proxInicio = (lote.loadedPageEnd ?? todasPaginas.length) + 1;
    }
    return { ...inicial, pages: todasPaginas, pageCount: todasPaginas.length, hasMorePages: false };
  }

  async function abrirResultadoLeitura(fileKey: string, result: DocumentTextResult, file: Match) {
    const extLower = (result.extension || file.name || '').toLowerCase();
    const ehPdf = extLower.endsWith('.pdf') || Boolean(result.localUrl) || Boolean(result.pdfDataUrl);
    if (ehPdf && (result.localUrl || result.pdfDataUrl)) {
      const resolvido = await resolverPdfParaNavegador(result, {
        connectorId,
        rootId: file.rootId,
        relativePath: file.relativePath,
        tamanhoEsperado: result.size || file.size || 0,
        onProgress: (recebido, total) => setDownloadPdf({ recebido, total }),
      });
      if (resolvido) {
        const pronto: DocumentTextResult = {
          ...result,
          pdfDataUrl: resolvido.url,
          pdfBlob: resolvido.blob,
          localUrl: undefined,
        };
        if (resolvido.url.startsWith('blob:')) {
          pdfsLocaisRef.current.push({ fileKey, url: resolvido.url });
          while (pdfsLocaisRef.current.length > MAX_PDFS_LOCAIS_EM_MEMORIA) {
            const antigo = pdfsLocaisRef.current.shift()!;
            if (leituraCacheRef.current.get(antigo.fileKey)?.pdfDataUrl === antigo.url) {
              leituraCacheRef.current.delete(antigo.fileKey);
            }
            URL.revokeObjectURL(antigo.url);
          }
        }
        // Só em memória: blob: não sobrevive a recarregar a página e o PDF não deve ir para o storage
        leituraCacheRef.current.set(fileKey, pronto);
        void exibirDocumento(pronto, file);
        return;
      }
    }

    const completo = result.hasMorePages ? await carregarPaginasKenRestantes(result, file) : result;
    setCachedLeitura(fileKey, completo);
    void exibirDocumento(completo, file);
  }

  function copiarCaminho(file: Match) {
    const fullPath = formatCartorioPath(file.rootId, file.relativePath);
    void copiarTextoSeguro(fullPath).then(ok => {
      if (ok) {
        setCaminhoCopiado(file.relativePath);
        setTimeout(() => setCaminhoCopiado(null), 2500);
      }
    });
  }

  return (
    <section className="space-y-6">
      {/* Estação: Formulário para Manifestação (Ficha do Oficial + Manifestação) */}
      {fichaAberta && (
        <div className="space-y-3">
          {processandoAcao && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/40 bg-[#0B1020]/95 px-4 py-3 text-xs text-white shadow-md backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                <span className="font-semibold text-cyan-200">
                  {processandoAcao.tipo === 'leitura'
                    ? `Abrindo documento do acervo: ${processandoAcao.fileName}…`
                    : `Processando ${processandoAcao.fileName}…`}
                </span>
              </div>
              <span className="font-mono text-[11px] text-cyan-300">{formatTempoMMSS(tempoDecorrido)}</span>
            </div>
          )}
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-[#0B1020]/95 px-4 py-3 text-xs text-rose-200 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}
          <FichaOficialView
            key={fichaSessao}
            dadosIniciais={fichaAberta}
            arquivoOrigem={fichaAbertaFile}
            connectorId={connectorId || 'auto'}
            onClose={() => {
              setFichaAberta(null);
              setFichaAbertaFile(null);
            }}
            onReextrair={fichaAbertaFile ? () => {
              const targetFile = fichaAbertaFile;
              setFichaAberta(null);
              setFichaAbertaFile(null);
              extrairPeticao(targetFile, true);
            } : undefined}
            onBuscarMatriculaNaLista={(matricula) => {
              salvarHistoricoAtual(`Ficha de Conferência / ${fichaAbertaFile?.name || 'Processo'}`);
              setSearchMode('cruzada');
              setCruzadaMatricula(matricula);
              setQuery(matricula);
              executeSearch(matricula);
              setFichaAberta(null);
              setFichaAbertaFile(null);
            }}
            onVisualizarDocumento={(file) => {
              visualizarDocumento(file);
            }}
            onSalvarNaFila={salvarFichaNaFila}
            onAlternarConferencia={alternarConferenciaFichaAberta}
            onNovoFormulario={abrirNovoFormulario}
            onFinalizar={finalizarFicha}
            versaoAnteriorId={fichaVersaoAnteriorId}
          />
        </div>
      )}

      <div className={fichaAberta ? 'hidden' : 'space-y-4'}>
      {modo === 'manifestacoes' && (
      /* Card Principal de Pesquisa + Pastas do Servidor — Mesma formatação visual, tamanhos, cores e identificações do Visualizador */
      <div className="rounded-2xl border border-white/10 bg-[#0B1020] text-white shadow-2xl overflow-hidden">
        {/* Barra Superior de Identificação + Seletor do Servidor + Modo de Busca */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900/90 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
                Pesquisa de Processos e Manifestações
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Selecione uma pasta ou pesquise uma matrícula / processo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id="seletor-servidor-cartorio"
              value={connectorId}
              onChange={event => {
                setConnectorId(event.target.value);
                if (error.includes('sem sinal')) setError('');
              }}
              disabled={busy || !!processandoAcao}
              title="Servidor do cartório"
              aria-label="Servidor do cartório"
              className="h-8 min-w-0 max-w-[210px] rounded-lg border border-white/15 bg-slate-950 px-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {connectors.length === 0 ? (
                <option value="" disabled className="bg-slate-950 text-slate-400">
                  Localizando servidores…
                </option>
              ) : (
                connectors.map(connector => {
                  const online = isConnectorOnline(connector);
                  return (
                    <option key={connector.id} value={connector.id} className="bg-slate-950 text-white">
                      {online ? '🟢' : '🔴'} {connector.name} {online ? '' : '(Sem sinal)'}
                    </option>
                  );
                })
              )}
            </select>

            {/* Abas: Busca Simples vs Busca Cruzada */}
            <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-700/70 bg-slate-950 p-0.5" role="tablist" aria-label="Tipo de busca">
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === 'simples'}
                onClick={() => setSearchMode('simples')}
                title="Busca simples"
                className={`inline-flex h-full items-center gap-1 rounded-md px-2 sm:px-2.5 text-[11px] font-semibold transition ${
                  searchMode === 'simples'
                    ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className={`h-3.5 w-3.5 ${searchMode === 'simples' ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>Simples</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === 'cruzada'}
                onClick={() => setSearchMode('cruzada')}
                title="Busca cruzada (multicritérios)"
                className={`inline-flex h-full items-center gap-1 rounded-md px-2 sm:px-2.5 text-[11px] font-semibold transition ${
                  searchMode === 'cruzada'
                    ? 'bg-amber-950/70 text-amber-200 border border-amber-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className={`h-3.5 w-3.5 ${searchMode === 'cruzada' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Cruzada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={abrirNovoFormulario}
              title="Abrir formulário de manifestação em branco"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/70 px-2.5 text-xs font-semibold text-cyan-300 transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Novo Formulário</span>
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa em Alto Destaque + Seletor de Pasta (idêntico ao Visualizador) */}
        <div className="border-b border-white/10 bg-[#0B1020] px-3 py-2.5 space-y-2">
          {searchMode === 'simples' ? (
            <form onSubmit={handleSearchSimples} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 flex items-center h-10 rounded-xl border-2 border-cyan-400/75 bg-[#060C1C] shadow-md shadow-cyan-950/50 focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-400/30 transition">
                  <div className="flex items-center gap-1.5 pl-3 pr-2 text-cyan-300 select-none pointer-events-none border-r border-cyan-500/25">
                    <Search className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="hidden md:inline text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                      Pesquisar
                    </span>
                  </div>
                  <input
                    id="campo-pesquisa-simples"
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    minLength={2}
                    maxLength={120}
                    placeholder={
                      pastaFiltro
                        ? `Digite matrícula, processo ou arquivo em ${pastaFiltro.rotulo}…`
                        : 'Digite o nº da matrícula, processo ou nome do arquivo para pesquisar…'
                    }
                    aria-label="Pesquisar processo, matrícula ou nome de arquivo"
                    required
                    disabled={busy || !!processandoAcao}
                    className="w-full h-full bg-transparent pl-2.5 pr-8 text-xs sm:text-sm font-medium text-white placeholder:text-slate-300/75 focus:outline-none"
                  />
                  {busy ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-amber-400" />
                  ) : query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Limpar pesquisa"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {historicoBuscas.length > 0 && (
                  <button
                    type="button"
                    onClick={voltarTelaAnterior}
                    title={`Voltar para pesquisa anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                    aria-label="Voltar para pesquisa anterior"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-950/60 text-amber-300 hover:bg-amber-900/70 hover:text-white transition active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={busy || !connectorId || !!processandoAcao}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-blue-400/50 bg-blue-600 hover:bg-blue-500 px-4 sm:px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-950/60 transition disabled:opacity-50 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span className="font-mono">{formatTempoMMSS(tempoBuscaDecorrido)}</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 text-white" />
                      <span>Pesquisar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSearchCruzada} className="flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
              <input
                value={cruzadaProcesso}
                onChange={event => setCruzadaProcesso(event.target.value)}
                placeholder="Processo / CNJ"
                aria-label="Processo Judicial / CNJ"
                title="Processo Judicial / CNJ (ex.: 1035968-12 ou 0000001)"
                disabled={busy || !!processandoAcao}
                className="h-10 w-full sm:w-auto sm:min-w-[150px] sm:flex-1 rounded-xl border-2 border-cyan-400/60 bg-[#060C1C] px-3 text-xs sm:text-sm font-medium text-white focus:border-cyan-300 focus:outline-none placeholder:text-slate-300/75"
              />
              <input
                value={cruzadaMatricula}
                onChange={event => setCruzadaMatricula(event.target.value)}
                placeholder="Matrícula / Transcrição"
                aria-label="Matrícula ou Transcrição"
                title="Matrícula ou Transcrição (ex.: 123.456 ou 45.890)"
                disabled={busy || !!processandoAcao}
                className="h-10 w-full sm:w-auto sm:min-w-[150px] sm:flex-1 rounded-xl border-2 border-cyan-400/60 bg-[#060C1C] px-3 text-xs sm:text-sm font-medium text-white focus:border-cyan-300 focus:outline-none placeholder:text-slate-300/75"
              />
              <input
                value={cruzadaContribuinte}
                onChange={event => setCruzadaContribuinte(event.target.value)}
                placeholder="Contribuinte (SQL / IPTU)"
                aria-label="Contribuinte (SQL / IPTU)"
                title="Contribuinte (SQL / IPTU) (ex.: 012.345.6789-1)"
                disabled={busy || !!processandoAcao}
                className="h-10 w-full sm:w-auto sm:min-w-[150px] sm:flex-1 rounded-xl border-2 border-cyan-400/60 bg-[#060C1C] px-3 text-xs sm:text-sm font-medium text-white focus:border-cyan-300 focus:outline-none placeholder:text-slate-300/75"
              />
              <input
                value={cruzadaRequerente}
                onChange={event => setCruzadaRequerente(event.target.value)}
                placeholder="Requerente / Parte"
                aria-label="Requerente ou Parte"
                title="Requerente ou Parte (ex.: Basilio, Ficticia)"
                disabled={busy || !!processandoAcao}
                className="h-10 w-full sm:w-auto sm:min-w-[150px] sm:flex-1 rounded-xl border-2 border-cyan-400/60 bg-[#060C1C] px-3 text-xs sm:text-sm font-medium text-white focus:border-cyan-300 focus:outline-none placeholder:text-slate-300/75"
              />
              <div className="flex w-full sm:w-auto shrink-0 items-center justify-end gap-2">
                {historicoBuscas.length > 0 && (
                  <button
                    type="button"
                    onClick={voltarTelaAnterior}
                    title={`Voltar para pesquisa anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                    aria-label="Voltar para pesquisa anterior"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-950/60 text-amber-300 hover:bg-amber-900/70 hover:text-white transition active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy || !connectorId || !!processandoAcao}
                  className="inline-flex h-10 flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-xl border border-blue-400/50 bg-blue-600 hover:bg-blue-500 px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-950/60 disabled:opacity-50 transition cursor-pointer"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Pesquisando…</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 text-white" />
                      <span>Pesquisar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Seletor rápido da pasta + Favoritos + Cards Compactos das 6 Pastas do Servidor (Sempre ocultos por padrão; expansíveis pelo botão Desocultar) */}
        </div>

        <div className="bg-slate-950/90 px-3 py-2 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMostrarCardsPastasServidor(v => !v)}
              aria-expanded={mostrarCardsPastasServidor}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-cyan-300 transition cursor-pointer"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 text-cyan-400 transition-transform ${
                  mostrarCardsPastasServidor ? '' : '-rotate-90'
                }`}
              />
              <span>Pastas do Servidor e Favoritos (VOL1, IMAGENS ou DEP)</span>
              {pastaFiltro && (
                <span className="rounded-md border border-cyan-500/40 bg-cyan-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                  Filtro ativo: {pastaFiltro.rotulo}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              {mostrarCardsPastasServidor && (
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  Clique em uma pasta para filtrar ou pesquise diretamente no campo acima
                </span>
              )}
              <button
                type="button"
                onClick={() => setMostrarCardsPastasServidor(v => !v)}
                aria-expanded={mostrarCardsPastasServidor}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200 transition cursor-pointer"
              >
                <Eye className="h-3 w-3 text-cyan-400" />
                <span>{mostrarCardsPastasServidor ? 'Ocultar' : 'Desocultar'}</span>
              </button>
            </div>
          </div>

          {mostrarCardsPastasServidor && (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Pasta da pesquisa:</span>
                  <button
                    type="button"
                    onClick={() => setPastaFiltro(null)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition ${
                      !pastaFiltro
                        ? 'border-cyan-500/60 bg-cyan-950/70 text-cyan-200 shadow-sm'
                        : 'border-white/10 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                    title="Pesquisar em todas as pastas do acervo (VOL1, IMAGENS e DEP)"
                  >
                    <HardDrive className="h-3 w-3 text-cyan-400" />
                    <span>Todas</span>
                  </button>
                  {UNIDADES_PRINCIPAIS.map(u => {
                    const selecionada = pastaFiltro?.rootId === u.id && !pastaFiltro.relativePath;
                    return (
                      <button
                        key={`ds-unit-${u.id}`}
                        type="button"
                        onClick={() => setPastaFiltro(selecionada ? null : { rootId: u.id, relativePath: '', rotulo: u.rotuloCurto })}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition ${
                          selecionada
                            ? 'border-amber-500/70 bg-amber-950/70 text-amber-200 shadow-sm'
                            : 'border-white/10 bg-slate-900/80 text-slate-300 hover:border-amber-500/40 hover:text-white'
                        }`}
                        title={`Selecionar e pesquisar na pasta ${u.rotulo} — ${u.descricao}`}
                      >
                        <Folder className="h-3 w-3 text-amber-400 fill-amber-400/20" />
                        <span>{u.sigla}</span>
                        <span className="font-mono text-[9px] opacity-75">({u.caminho.replace('\\', '')})</span>
                      </button>
                    );
                  })}
                </div>

                {pastasFavoritas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300/90">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      Favoritos:
                    </span>
                    {pastasFavoritas.map(fav => {
                      const ativo =
                        pastaFiltro &&
                        pastaFiltro.rootId === fav.rootId &&
                        pastaFiltro.relativePath === fav.relativePath;
                      return (
                        <div
                          key={`ds-fav-${fav.id}`}
                          className={`inline-flex items-center rounded-lg border text-[11px] transition ${
                            ativo
                              ? 'border-amber-400/70 bg-amber-950/80 text-amber-100 shadow-sm'
                              : 'border-amber-500/25 bg-slate-900/90 text-slate-200 hover:border-amber-500/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPastaFiltro(
                                ativo
                                  ? null
                                  : { rootId: fav.rootId, relativePath: fav.relativePath, rotulo: fav.rotulo },
                              )
                            }
                            title={`Filtrar pesquisa pela pasta favorita ${fav.caminhoExibicao}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 font-medium hover:text-white"
                          >
                            <span className="rounded bg-amber-500/20 px-1 font-mono text-[9px] font-bold text-amber-300">
                              {fav.unidade}
                            </span>
                            <span className="max-w-[150px] truncate">{fav.rotulo}</span>
                          </button>
                          <button
                            type="button"
                            onClick={e => toggleFavoritoBusca(fav.rootId, fav.relativePath, fav.rotulo, e)}
                            title={`Retirar "${fav.rotulo}" dos favoritos`}
                            className="px-1.5 py-0.5 text-amber-400 hover:text-rose-300 transition border-l border-white/10"
                          >
                            <Star className="h-3 w-3 fill-amber-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                {RAIZES_DOCUMENTAL.map(r => {
                  const isFav = verificarPastaFavorita(pastasFavoritas, r.id, '');
                  const selecionada = pastaFiltro?.rootId === r.id && !pastaFiltro.relativePath;
                  return (
                    <div
                      key={`m-${r.id}`}
                      onClick={() => {
                        setPastaFiltro(
                          selecionada ? null : { rootId: r.id, relativePath: '', rotulo: r.rotuloCurto || r.rotulo },
                        );
                        document.getElementById('campo-pesquisa-simples')?.focus();
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setPastaFiltro(
                            selecionada ? null : { rootId: r.id, relativePath: '', rotulo: r.rotuloCurto || r.rotulo },
                          );
                        }
                      }}
                      title={`${r.rotulo} (${r.caminho}) — ${r.descricao}`}
                      className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition hover:-translate-y-0.5 cursor-pointer ${
                        selecionada
                          ? 'border-cyan-400 bg-cyan-950/50 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-950/50'
                          : r.principal
                          ? 'border-cyan-500/30 bg-gradient-to-br from-slate-900 via-[#0D1528] to-slate-950 hover:border-cyan-400/60 hover:shadow-md hover:shadow-cyan-950/40'
                          : 'border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-950/40'
                      }`}
                    >
                      <div
                        className={`h-8 w-8 shrink-0 rounded-lg flex flex-col items-center justify-center ${
                          r.principal
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <HardDrive className="h-3.5 w-3.5" />
                        <span className="font-mono text-[8px] font-black leading-none mt-0.5">{r.sigla}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate">{r.rotuloCurto || r.rotulo}</p>
                        <p className="font-mono text-[10px] text-slate-400 truncate">{r.caminho}</p>
                      </div>
                      <button
                        type="button"
                        onClick={e => toggleFavoritoBusca(r.id, '', r.rotuloCurto, e)}
                        title={isFav ? 'Retirar dos favoritos' : 'Colocar nos favoritos'}
                        aria-label={isFav ? `Retirar ${r.rotulo} dos favoritos` : `Favoritar ${r.rotulo}`}
                        className={`h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-md border transition ${
                          isFav
                            ? 'border-amber-500/50 bg-amber-950/60 text-amber-400'
                            : 'border-white/10 bg-slate-900/80 text-slate-500 hover:border-amber-500/40 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`h-3 w-3 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtros e tempos de pesquisa */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 pt-2 text-[11px]">
            <button
              type="button"
              id="toggle-filtros-pesquisa"
              onClick={() => setMostrarOpcoesOcr(!mostrarOpcoesOcr)}
              aria-expanded={mostrarOpcoesOcr}
              className="inline-flex items-center gap-1 font-semibold text-white/65 hover:text-cyan-300 transition"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarOpcoesOcr ? '' : '-rotate-90'}`} />
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <span>Filtros</span>
              <span className="font-normal text-white/40">
                · OCR {ocrModoPagina === 'padrao' ? 'automático' : ocrModoPagina === 'personalizado' ? `págs ${ocrPaginaInicio} a ${ocrPaginaFim}` : 'ampliado (1 a 40)'}
              </span>
            </button>

            {busy ? (
              <span className="inline-flex items-center gap-1 text-white/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                Pesquisando… <strong className="font-mono text-cyan-300">{formatTempoMMSS(tempoBuscaDecorrido)}</strong>
              </span>
            ) : temposBusca.length > 0 ? (
              <button
                type="button"
                id="toggle-tempos-pesquisa"
                onClick={() => setMostrarTemposBusca(v => !v)}
                aria-expanded={mostrarTemposBusca}
                className="inline-flex items-center gap-1 font-semibold text-white/65 hover:text-cyan-300 transition"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarTemposBusca ? '' : '-rotate-90'}`} />
                <History className="h-3.5 w-3.5 text-cyan-400" />
                <span>
                  Última pesquisa: <strong className="text-white/85">{fmtDuracaoBusca(temposBusca[0].ms)}</strong> · {temposBusca[0].resultados} resultado(s)
                  {temposBusca[0].cache && <span className="font-normal text-cyan-400/70"> · cache</span>}
                </span>
              </button>
            ) : null}
          </div>

          {mostrarTemposBusca && !busy && temposBusca.length > 0 && (
            <ul id="historico-tempos-busca" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 animate-in slide-in-from-top-1 duration-200">
              {temposBusca.map((t, i) => (
                <li key={`${t.quando}-${i}`}>
                  <button
                    type="button"
                    onClick={() => { setSearchMode('simples'); setQuery(t.termo); executeSearch(t.termo); }}
                    title={`Repetir pesquisa "${t.termo}"`}
                    className="w-full rounded-lg border border-white/10 bg-[#080D1A] px-2.5 py-1.5 text-left text-[11px] transition hover:border-cyan-500/40"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-white/85">{t.termo || '(sem termo)'}</span>
                      <span className="shrink-0 font-mono font-bold text-cyan-300">{fmtDuracaoBusca(t.ms)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-white/40">
                      <span>{fmtQuandoBusca(t.quando)}</span>
                      <span>{t.resultados} resultado(s)</span>
                      {t.cache && <span className="text-cyan-400/70">cache</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {mostrarOpcoesOcr && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-[#080D1A] px-3 py-2.5 animate-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] leading-relaxed text-white/50">
                Busca recursiva em <strong className="text-white/75">W:\USUCAPIAO</strong> (minutas dos escreventes),{' '}
                <strong className="text-white/75">H:\PROCESSOS - ENVIADOS POR E-MAIL</strong> e{' '}
                <strong className="text-white/75">K:\IMAGENS\LV2</strong>. Processamento local: nenhum arquivo original deixa a rede do cartório.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-white/70">OCR dos PDFs:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="ocrModo"
                    value="padrao"
                    checked={ocrModoPagina === 'padrao'}
                    onChange={() => setOcrModoPagina('padrao')}
                    className="text-cyan-500 focus:ring-0"
                  />
                  <span>Automático — Petição Inicial (Rápido)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="ocrModo"
                    value="personalizado"
                    checked={ocrModoPagina === 'personalizado'}
                    onChange={() => setOcrModoPagina('personalizado')}
                    className="text-cyan-500 focus:ring-0"
                  />
                  <span>Intervalo personalizado</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="ocrModo"
                    value="todas"
                    checked={ocrModoPagina === 'todas'}
                    onChange={() => setOcrModoPagina('todas')}
                    className="text-cyan-500 focus:ring-0"
                  />
                  <span>Arquivo completo</span>
                </label>

                {ocrModoPagina === 'personalizado' && (
                  <div className="inline-flex items-center gap-2 pl-3 border-l border-white/15">
                    <span className="text-white/50">De pág:</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={ocrPaginaInicio}
                      onChange={e => setOcrPaginaInicio(parseInt(e.target.value) || 1)}
                      className="w-16 rounded-lg border border-white/20 bg-[#0B1020] px-2 py-1 text-center font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-white/50">até:</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={ocrPaginaFim}
                      onChange={e => setOcrPaginaFim(parseInt(e.target.value) || 1)}
                      className="w-16 rounded-lg border border-white/20 bg-[#0B1020] px-2 py-1 text-center font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ABA DEDICADA: FORMULÁRIOS EM CONFERÊNCIA E ARQUIVO DE FISCALIZAÇÃO */}
      {modo === 'conferencia' && (() => {
        const POR_PAGINA_CONFERENCIA = 20;
        const totalAguardando = fichasPendentes.filter(f => f.statusConferencia !== 'CONFERIDO').length;
        const totalConferidos = fichasPendentes.filter(f => f.statusConferencia === 'CONFERIDO').length;
        const termoFiscal = buscaFiscalizacao.trim().toLowerCase();
        const termoFiscalSemPont = termoFiscal.replace(/[.\-\s]/g, '');
        const fichasFiltradas = fichasPendentes.filter(ficha => {
          if (filtroStatusConferencia === 'AGUARDANDO_CONFERENCIA' && ficha.statusConferencia === 'CONFERIDO') return false;
          if (filtroStatusConferencia === 'CONFERIDO' && ficha.statusConferencia !== 'CONFERIDO') return false;
          if (!termoFiscal) return true;
          const alvo = `${ficha.numero_processo} ${ficha.requerente} ${ficha.matricula_transcricao} ${ficha.subdistrito} ${ficha.imovel} ${ficha.criadoPorNome} ${ficha.atualizadoPorNome} ${ficha.conferidoPorNome}`.toLowerCase();
          if (alvo.includes(termoFiscal)) return true;
          if (termoFiscalSemPont.length >= 2 && alvo.replace(/[.\-\s]/g, '').includes(termoFiscalSemPont)) return true;
          return false;
        });

        const totalPaginas = Math.max(1, Math.ceil(fichasFiltradas.length / POR_PAGINA_CONFERENCIA));
        const paginaSegura = Math.min(paginaConferencia, totalPaginas);
        const indiceInicio = fichasFiltradas.length === 0 ? 0 : (paginaSegura - 1) * POR_PAGINA_CONFERENCIA + 1;
        const indiceFim = Math.min(paginaSegura * POR_PAGINA_CONFERENCIA, fichasFiltradas.length);
        const fichasPaginadas = fichasFiltradas.slice(
          (paginaSegura - 1) * POR_PAGINA_CONFERENCIA,
          paginaSegura * POR_PAGINA_CONFERENCIA
        );

        return (
      <div id="fila-fichas-oficial" className="space-y-4">
        {/* Cabeçalho e Filtros — Identidade Âmbar/Azul (Fila Operacional) */}
        <div className="rounded-2xl border border-amber-500/20 bg-[#0B1020]/90 p-4 text-white shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-wide text-white">
                  EM CONFERÊNCIA — Procedimentos em Revisão e Fiscalização
                </h2>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                  {fichasPendentes.length} {fichasPendentes.length === 1 ? 'em conferência' : 'em conferência'}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Fila operacional compartilhada para conferência do Oficial ou Substituto antes da finalização na Etapa 2.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={buscaFiscalizacao}
                  onChange={e => {
                    setBuscaFiscalizacao(e.target.value);
                    setPaginaConferencia(1);
                  }}
                  placeholder="Pesquisar processo, requerente ou matrícula…"
                  aria-label="Pesquisar processo, requerente ou matrícula"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-7 text-xs text-white placeholder-white/40 transition focus:border-amber-500/50 focus:bg-white/[0.06] focus:outline-none"
                />
                {buscaFiscalizacao && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaFiscalizacao('');
                      setPaginaConferencia(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={abrirNovoFormulario}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 cursor-pointer"
                title="Criar novo formulário de manifestação em branco"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Novo Formulário</span>
              </button>

              <button
                type="button"
                onClick={() => { setFilaCarregando(true); void recarregarFila(); }}
                disabled={filaCarregando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50 cursor-pointer"
                title="Atualizar a lista de formulários em conferência"
              >
                <RotateCw className={`h-3.5 w-3.5 ${filaCarregando ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Barra secundária de filtros rápidos (Todos / Aguardando Conferência / Conferido) */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => {
                  setFiltroStatusConferencia('TODOS');
                  setPaginaConferencia(1);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  filtroStatusConferencia === 'TODOS'
                    ? 'border border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-2xs'
                    : 'border border-transparent text-white/65 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <span>Todos</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filtroStatusConferencia === 'TODOS'
                      ? 'bg-amber-500/25 text-amber-100'
                      : 'bg-white/10 text-white/65'
                  }`}
                >
                  {fichasPendentes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroStatusConferencia('AGUARDANDO_CONFERENCIA');
                  setPaginaConferencia(1);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  filtroStatusConferencia === 'AGUARDANDO_CONFERENCIA'
                    ? 'border border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-2xs'
                    : 'border border-transparent text-white/65 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                </span>
                <span>Aguardando Conferência</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filtroStatusConferencia === 'AGUARDANDO_CONFERENCIA'
                      ? 'bg-rose-500/25 text-rose-100'
                      : 'bg-white/10 text-white/65'
                  }`}
                >
                  {totalAguardando}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFiltroStatusConferencia('CONFERIDO');
                  setPaginaConferencia(1);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  filtroStatusConferencia === 'CONFERIDO'
                    ? 'border border-sky-500/40 bg-sky-500/15 text-sky-200 shadow-2xs'
                    : 'border border-transparent text-white/65 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span>Conferido</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filtroStatusConferencia === 'CONFERIDO'
                      ? 'bg-sky-500/25 text-sky-100'
                      : 'bg-white/10 text-white/65'
                  }`}
                >
                  {totalConferidos}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-white/45">
              Clique em <strong className="font-semibold text-white/70">Abrir</strong> para revisar a ficha, avançar para a Etapa 2 ou exportar (.DOCX / .DOC).
            </div>
          </div>
        </div>

        {/* Listagem Compacta — Tabela Operacional Escura */}
        <div id="fila-fichas-oficial-conteudo" className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-sm backdrop-blur-xl">
          {filaErro && (
            <div role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-200">
              {filaErro}
            </div>
          )}

          {filaCarregando && fichasPendentes.length === 0 ? (
            <div className="p-8 text-center text-xs text-white/60">
              Carregando procedimentos em conferência…
            </div>
          ) : fichasFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="mx-auto h-7 w-7 text-white/25" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-white/80">
                {fichasPendentes.length === 0
                  ? 'Nenhum procedimento em conferência no momento.'
                  : 'Nenhum procedimento encontrado para o filtro ou pesquisa informados.'}
              </p>
              <p className="mt-1 text-[11px] text-white/50">
                {fichasPendentes.length === 0
                  ? 'Os formulários salvos na Etapa 1 aparecerão aqui para conferência do Oficial ou Substituto.'
                  : 'Tente ajustar o filtro de status acima ou limpar o campo de pesquisa.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      <th className="py-3 pl-4 pr-3">Processo</th>
                      <th className="px-3 py-3">Requerente/Interessado</th>
                      <th className="px-3 py-3">Matrícula/Transcrição</th>
                      <th className="px-3 py-3">Situação</th>
                      <th className="px-3 py-3">Atualizado em</th>
                      <th className="py-3 pl-3 pr-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {fichasPaginadas.map(ficha => {
                      const isConferido = ficha.statusConferencia === 'CONFERIDO';
                      const processandoCard = Boolean(conferindoIds[ficha.registroId]);
                      return (
                        <tr
                          key={ficha.registroId}
                          onClick={() => reabrirFichaDaFila(ficha)}
                          className={`group cursor-pointer border-l-[3px] transition-colors hover:bg-white/[0.04] ${
                            isConferido ? 'border-l-sky-500' : 'border-l-rose-500'
                          }`}
                        >
                          <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-white">
                                {ficha.numero_processo || 'Sem número'}
                              </span>
                              {ficha.subdistrito && (
                                <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                                  {ficha.subdistrito}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 max-w-[300px]">
                            <div
                              className="truncate font-medium text-white/90"
                              title={ficha.requerente || 'Não informado'}
                            >
                              {ficha.requerente || 'Não informado'}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-white/45 truncate">
                              {(ficha.atualizadoPorNome || ficha.criadoPorNome) && (
                                <span>Salvo por {ficha.atualizadoPorNome || ficha.criadoPorNome}</span>
                              )}
                              {isConferido && ficha.conferidoPorNome && (
                                <span className="text-sky-300/90">
                                  • Conferido por {ficha.conferidoPorNome}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 max-w-[200px]">
                            <div
                              className="truncate text-white/75"
                              title={ficha.matricula_transcricao || '—'}
                            >
                              {ficha.matricula_transcricao || '—'}
                            </div>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isConferido ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200"
                                title={
                                  ficha.conferidoPorNome
                                    ? `Conferido por ${ficha.conferidoPorNome}${ficha.conferidoEm ? ` em ${new Date(ficha.conferidoEm).toLocaleString('pt-BR')}` : ''}`
                                    : 'Formulário conferido pelo Oficial ou seu Substituto'
                                }
                              >
                                <CheckCircle2 className="h-3 w-3 text-sky-400 shrink-0" />
                                <span>Conferido</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200"
                                title="Aguardando conferência pelo Oficial ou seu Substituto"
                              >
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                                </span>
                                <span>Aguardando Conferência</span>
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap text-white/65">
                            {ficha.data_criacao || '—'}
                          </td>

                          <td
                            className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={processandoCard}
                                onClick={() => void alternarConferenciaCard(ficha)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                  isConferido
                                    ? 'border-white/10 bg-white/[0.04] text-white/75 hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-200'
                                    : 'border-sky-500/35 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                                }`}
                                title={
                                  isConferido
                                    ? 'Retornar status para Aguardando Conferência'
                                    : 'Marcar formulário como Conferido'
                                }
                              >
                                {isConferido ? (
                                  <Clock className="h-3.5 w-3.5 text-rose-300 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                                )}
                                <span>
                                  {processandoCard
                                    ? 'Salvando…'
                                    : isConferido
                                    ? 'Voltar p/ Aguardando'
                                    : 'Marcar Conferido'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => reabrirFichaDaFila(ficha)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
                                title="Abrir formulário para conferência ou Etapa 2"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Abrir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Compact List */}
              <div className="divide-y divide-white/[0.06] md:hidden">
                {fichasPaginadas.map(ficha => {
                  const isConferido = ficha.statusConferencia === 'CONFERIDO';
                  const processandoCard = Boolean(conferindoIds[ficha.registroId]);
                  return (
                    <div
                      key={ficha.registroId}
                      onClick={() => reabrirFichaDaFila(ficha)}
                      className={`flex flex-col gap-2 border-l-[3px] p-3.5 transition-colors hover:bg-white/[0.04] ${
                        isConferido ? 'border-l-sky-500' : 'border-l-rose-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-white">
                              {ficha.numero_processo || 'Sem número'}
                            </span>
                            {isConferido ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                <CheckCircle2 className="h-2.5 w-2.5 text-sky-400" />
                                Conferido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                                <Clock className="h-2.5 w-2.5 text-rose-400" />
                                Aguardando
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-xs font-medium text-white/90">
                            {ficha.requerente || 'Não informado'}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                            {ficha.matricula_transcricao && (
                              <span className="truncate max-w-[180px]">{ficha.matricula_transcricao}</span>
                            )}
                            <span>• {ficha.data_criacao}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-end gap-1.5 pt-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={processandoCard}
                          onClick={() => void alternarConferenciaCard(ficha)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isConferido
                              ? 'border-white/10 bg-white/[0.04] text-white/75'
                              : 'border-sky-500/35 bg-sky-500/15 text-sky-200'
                          }`}
                        >
                          <span>
                            {processandoCard
                              ? 'Salvando…'
                              : isConferido
                              ? 'Voltar p/ Aguardando'
                              : 'Marcar Conferido'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => reabrirFichaDaFila(ficha)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Abrir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/70">
                <div>
                  Exibindo <strong className="text-white">{indiceInicio}</strong>–
                  <strong className="text-white">{indiceFim}</strong> de{' '}
                  <strong className="text-white">{fichasFiltradas.length}</strong> procedimento(s) em conferência
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaSegura <= 1}
                    onClick={() => setPaginaConferencia(p => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2 text-[11px] text-white/60">
                    Página <strong className="text-white">{paginaSegura}</strong> de{' '}
                    <strong className="text-white">{totalPaginas}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={paginaSegura >= totalPaginas}
                    onClick={() => setPaginaConferencia(p => Math.min(totalPaginas, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
        );
      })()}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-[#0B1020]/95 p-4 text-xs text-rose-200 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">{error}</p>
              {error.includes('sem sinal') && (
                <p className="mt-0.5 text-[11px] text-rose-300/80">
                  O servidor selecionado não respondeu nos últimos 2 minutos. Certifique-se de selecionar o conector que está ativo (🟢 <strong>Connector 7º RI SP - Produção</strong>).
                </p>
              )}
            </div>
          </div>
          {error.includes('sem sinal') && connectors.some(isConnectorOnline) && (
            <button
              type="button"
              onClick={() => {
                const online = connectors.find(isConnectorOnline);
                if (online) {
                  setConnectorId(online.id);
                  setError('');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-sm"
            >
              <span>Alternar para conector online (🟢)</span>
            </button>
          )}
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
        {/* Barra de Progresso da Busca */}
        {busy && (
          <div className="rounded-[24px] border border-cyan-500/30 bg-[#0B1020]/95 p-5 sm:p-6 text-white shadow-sm backdrop-blur-xl transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-200">
                    Pesquisando documentos nos discos autorizados do servidor local…
                  </h4>
                  <p className="text-[11px] font-mono text-white/50">
                    Termo: <strong className="text-white font-semibold">"{query}"</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#080D1A] px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoBuscaDecorrido)}</strong>
                </div>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoBuscaRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoBuscaRestante > 0 ? `~${formatTempoMMSS(tempoBuscaRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(95, Math.max(8, Math.round((tempoBuscaDecorrido / TEMPO_ESTIMADO_BUSCA) * 100)))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Card de Progresso de Extração / Assinaturas / Leitura */}
        {processandoAcao && (
          <div className="rounded-[24px] border border-cyan-500/30 bg-[#0B1020]/95 p-5 sm:p-6 text-white shadow-sm backdrop-blur-xl transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-200">
                    {processandoAcao.tipo === 'extracao'
                      ? 'Extraindo Formulário do Oficial via CLI Rust local…'
                      : processandoAcao.tipo === 'assinatura'
                      ? 'Auditando assinaturas eletrônicas PAdES via CLI Rust…'
                      : downloadPdf
                      ? 'Baixando PDF direto do Connector (rede interna)…'
                      : 'Carregando minuta / documento via Mammoth…'}
                  </h4>
                  <p className="text-[11px] font-mono text-white/50 truncate max-w-md">
                    {processandoAcao.fileName}
                    {downloadPdf && (
                      <span className="ml-2 text-cyan-300">
                        {fmtMB(downloadPdf.recebido)} de {fmtMB(downloadPdf.total)}
                        {downloadPdf.total > 0 && ` (${Math.min(100, Math.round((downloadPdf.recebido / downloadPdf.total) * 100))}%)`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#080D1A] px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoDecorrido)}</strong>
                </div>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoRestante > 0 ? `~${formatTempoMMSS(tempoRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: downloadPdf && downloadPdf.total > 0
                    ? `${Math.min(100, Math.max(3, Math.round((downloadPdf.recebido / downloadPdf.total) * 100)))}%`
                    : `${Math.min(95, Math.max(8, Math.round((tempoDecorrido / tempoEstimado) * 100)))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Tabela de Resultados */}
        {job?.status === 'complete' && job.result && (() => {
          const arquivosFiltradosPorPasta = pastaFiltro
            ? job.result.files.filter(f =>
                arquivoPertenceAPasta(f.rootId, f.relativePath, pastaFiltro.rootId, pastaFiltro.relativePath),
              )
            : job.result.files;
          const ocultadosPorPasta = job.result.files.length - arquivosFiltradosPorPasta.length;

          return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between text-xs text-white/70 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  <strong className="text-white">{arquivosFiltradosPorPasta.length}</strong> documento(s) localizado(s)
                  {pastaFiltro && (
                    <>
                      {' '}em <strong className="text-amber-300">{pastaFiltro.rotulo}</strong>
                    </>
                  )}
                  {duracaoJobMs !== null && <> em <strong className="text-cyan-300">{fmtDuracaoBusca(duracaoJobMs)}</strong></>}
                  {job.result.partial && ' (resultado parcial devido a limite de pesquisa)'}.
                </span>
                {pastaFiltro && ocultadosPorPasta > 0 && (
                  <button
                    type="button"
                    onClick={() => setPastaFiltro(null)}
                    className="rounded-lg border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/60 transition"
                  >
                    Mostrar todos ({job.result.files.length})
                  </button>
                )}
                {isCacheHit && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/90 border border-cyan-500/50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    ⚡ Resposta instantânea (Cache em memória)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isCacheHit && (
                  <button
                    type="button"
                    onClick={() => executeSearch(query, true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold transition"
                  >
                    Buscar novamente no disco
                  </button>
                )}
                {job.result.unavailableRoots.length > 0 && (
                  <span className="text-amber-400">Pastas sem acesso: {job.result.unavailableRoots.join(', ')}</span>
                )}
              </div>
            </div>

            {/* Destaque da Matrícula Vinculada aos Autos (somente Matrículas reais do Livro 2, nunca Transcrições) */}
            {(() => {
              const ehMatriculaLivro2 = (valor?: string | null): valor is string =>
                Boolean(valor && !/transcri[çc][ãa]o/i.test(valor));
              const ehImagemAcervo = (nomeArquivo: string) => /\.(?:ken|tiff?)$/i.test(nomeArquivo);
              const arquivosProcesso = job.result.files.filter(f => !ehImagemAcervo(f.name));

              const arquivoComMatriculaReal =
                arquivosProcesso.find(f => ehMatriculaLivro2(f.matricula)) ||
                arquivosProcesso.find(f => ehMatriculaLivro2(getCachedExtracao(`${f.rootId}:${f.relativePath}`)?.matricula_transcricao));

              const matriculaProcesso = ehMatriculaLivro2(job.result.matriculaDetectada)
                ? job.result.matriculaDetectada
                : arquivoComMatriculaReal
                ? (ehMatriculaLivro2(arquivoComMatriculaReal.matricula)
                    ? arquivoComMatriculaReal.matricula
                    : getCachedExtracao(`${arquivoComMatriculaReal.rootId}:${arquivoComMatriculaReal.relativePath}`)?.matricula_transcricao)
                : null;

              const arquivoOrigemMatricula = arquivoComMatriculaReal?.name;

              if (!matriculaProcesso || !ehMatriculaLivro2(matriculaProcesso)) return null;

              // Se a consulta atual já for a própria matrícula ou os arquivos encontrados já forem imagens do Livro 2 (.KEN / .TIF),
              // não exibir o card repetido para localizar no Livro 2 (evita excesso e redundância)
              const queryDigits = query.replace(/\D/g, '');
              const matDigits = matriculaProcesso.replace(/\D/g, '');
              const apenasImagensMatricula =
                job.result.files.length > 0 &&
                job.result.files.every(f => {
                  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                  return ext === '.ken' || ext === '.tif' || ext === '.tiff';
                });

              if (apenasImagensMatricula || (queryDigits && matDigits && (queryDigits === matDigits || matDigits.endsWith(queryDigits) || queryDigits.endsWith(matDigits)))) {
                return null;
              }

              const arquivoKenLocalizado = job.result.files.find(f => {
                const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                if (ext !== '.ken' && ext !== '.tif' && ext !== '.tiff') return false;
                const ehDoLivro2 = f.rootId === 'livro2' || /(?:^|[\\/])lv2[\\/]/i.test(f.relativePath);
                if (!ehDoLivro2) return false;
                const fNum = f.name.replace(/[^\d]/g, '');
                const mNum = matriculaProcesso.replace(/[^\d]/g, '');
                return Boolean(fNum && mNum && parseInt(fNum, 10) === parseInt(mNum, 10));
              });

              return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B1020]/90 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                          {matriculaProcesso}
                        </h3>
                        <span className="text-[11px] text-white/40">Livro 2</span>
                      </div>
                      {arquivoOrigemMatricula && (
                        <p className="break-words line-clamp-2 sm:truncate text-[11px] leading-snug text-white/50 mt-0.5" title={arquivoOrigemMatricula}>
                          Identificada em {arquivoOrigemMatricula}
                        </p>
                      )}
                    </div>
                  </div>

                  {arquivoKenLocalizado ? (
                    <button
                      type="button"
                      onClick={() => visualizarDocumento(arquivoKenLocalizado)}
                      title={`Visualizar imagem digitalizada da matrícula ${matriculaProcesso} (${arquivoKenLocalizado.name})`}
                      className="inline-flex w-full sm:w-auto justify-center shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 sm:py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Ver matrícula</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buscarMatriculaNoLivro2(matriculaProcesso)}
                      title="Buscar imagem digitalizada da matrícula em K:\IMAGENS\LV2"
                      className="inline-flex w-full sm:w-auto justify-center shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 sm:py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition active:scale-95"
                    >
                      <Search className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Localizar no Livro 2</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {arquivosFiltradosPorPasta.length === 0 ? (
              <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-8 sm:p-12 text-center text-white/60 shadow-sm backdrop-blur-xl">
                <FileText className="mx-auto h-12 w-12 text-white/30" />
                <h4 className="mt-3 text-base font-bold text-white">Nenhum documento localizado</h4>
                <p className="mt-1 text-xs text-white/50 max-w-md mx-auto">
                  Não encontramos arquivos para os termos pesquisados. Verifique se o termo está correto ou tente a Busca Cruzada.
                </p>
              </div>
            ) : (
              <>
                {/* LISTA MOBILE RESPONSIVA (< md: iPhone / celulares, sem cortar nome, caminho, tamanho ou data) */}
                <div className="md:hidden divide-y divide-white/10 rounded-2xl border border-white/15 bg-[#0B1020]/90 text-white shadow-sm backdrop-blur-xl overflow-hidden">
                  {arquivosFiltradosPorPasta.map(file => {
                    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    const isPdf = ext === '.pdf';
                    const isDocx = ext === '.docx' || ext === '.doc' || ext === '.rtf' || ext === '.txt';
                    const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
                    const podeFormulario = isPdf || ext === '.docx' || ext === '.doc';
                    const fileKey = `${file.rootId}:${file.relativePath}`;
                    const emProcessamento = processandoAcao?.id === fileKey;
                    const jaExtraido = !!getCachedExtracao(fileKey);
                    const jaLido = !!getCachedLeitura(fileKey);
                    const rootInfo = getRootInfo(file.rootId, file.relativePath);
                    const tamanhoFormatado =
                      file.size >= 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
                        : `${Math.max(1, Math.ceil(file.size / 1024))} KB`;
                    const fileMatricula = !isKenOrTif
                      ? file.matricula ||
                        getCachedExtracao(fileKey)?.matricula_transcricao ||
                        file.name.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*([0-9.\-]+)/i)?.[0]
                      : null;

                    return (
                      <div key={fileKey} className="p-3.5 space-y-2.5">
                        {/* Nome completo do arquivo + Caminho completo */}
                        <div className="flex items-start gap-2.5 min-w-0">
                          <FileText
                            className={`h-4 w-4 shrink-0 mt-0.5 ${
                              isPdf ? 'text-rose-400' : isDocx ? 'text-sky-400' : isKenOrTif ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => visualizarDocumento(file)}
                              className="block w-full text-left text-[13px] leading-snug font-semibold text-white hover:text-cyan-300 break-words transition"
                            >
                              {file.name}
                            </button>
                            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/50 break-all">
                              {formatCartorioPath(file.rootId, file.relativePath)}
                            </p>
                          </div>
                        </div>

                        {/* Linha de metadados completos (Pasta, Tamanho, Data e Matrícula identificada) */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border shadow-xs ${rootInfo.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${rootInfo.dotClass}`} />
                            <span>{rootInfo.label}</span>
                          </span>
                          <span className="font-mono text-white/70">{tamanhoFormatado}</span>
                          <span className="text-white/30">•</span>
                          <span className="font-mono text-white/70">
                            {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                          </span>
                          {fileMatricula && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-[10.5px] font-semibold text-cyan-200">
                              <FileText className="h-3 w-3 text-cyan-400 shrink-0" />
                              <span>{fileMatricula}</span>
                            </span>
                          )}
                        </div>

                        {/* Barra de Ações Mobile com alvos de toque confortáveis */}
                        <div className="flex items-center gap-2 pt-0.5" data-menu-acoes>
                          <button
                            type="button"
                            disabled={!!processandoAcao}
                            onClick={() => visualizarDocumento(file)}
                            className={`h-9 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                              jaLido
                                ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-200'
                                : 'border-slate-700 bg-slate-800/90 text-slate-100 hover:bg-slate-700'
                            }`}
                          >
                            {emProcessamento && processandoAcao?.tipo === 'leitura' ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                                <span className="font-mono">{formatTempoMMSS(tempoDecorrido)}</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                                <span>Visualizar</span>
                              </>
                            )}
                          </button>

                          {podeFormulario && (
                            <button
                              type="button"
                              disabled={!!processandoAcao}
                              onClick={() => extrairPeticao(file)}
                              className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition active:scale-[0.98] disabled:opacity-50"
                            >
                              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span>{jaExtraido ? 'Abrir Form.' : 'Formulário'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={e => alternarMenuAcoes(fileKey, e.currentTarget)}
                            aria-label="Mais opções"
                            aria-expanded={menuAbertoKey === fileKey}
                            className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border transition active:scale-95 ${
                              menuAbertoKey === fileKey
                                ? 'border-cyan-500 bg-cyan-950 text-cyan-200 shadow'
                                : 'border-slate-700 bg-slate-800/90 text-slate-300'
                            }`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TABELA DESKTOP (>= md: preservada integralmente para as estações do cartório) */}
                <div className="hidden md:block overflow-x-auto rounded-[24px] border border-white/20 bg-[#0B1020]/90 text-white shadow-sm backdrop-blur-xl">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed">
                    <thead className="bg-[#080D1A] text-white/70 font-semibold border-b border-white/10 text-[11px] sm:text-xs">
                      <tr>
                        <th className="p-3.5 sm:p-4 min-w-[320px]">Arquivo / Caminho</th>
                        <th className="p-3.5 sm:p-4 w-36 whitespace-nowrap">Pasta</th>
                        <th className="p-3.5 sm:p-4 w-24 whitespace-nowrap">Tamanho</th>
                        <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Modificado</th>
                        <th className="sticky right-0 bg-[#080D1A] p-3 w-20 min-w-[80px] max-w-[80px] text-right whitespace-nowrap z-20 border-l border-white/10 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)]">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {arquivosFiltradosPorPasta.map(file => {
                        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                        const isPdf = ext === '.pdf';
                        const isDocx = ext === '.docx' || ext === '.doc' || ext === '.rtf' || ext === '.txt';
                        const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
                        const fileKey = `${file.rootId}:${file.relativePath}`;
                        const emProcessamento = processandoAcao?.id === fileKey;
                        const jaLido = !!getCachedLeitura(fileKey);

                        return (
                          <tr key={fileKey} className="group hover:bg-white/[0.04] transition">
                            <td className="p-3.5 sm:p-4 font-medium text-white overflow-hidden">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <FileText
                                  className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 ${
                                    isPdf ? 'text-rose-400' : isDocx ? 'text-sky-400' : isKenOrTif ? 'text-amber-400' : 'text-slate-400'
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => visualizarDocumento(file)}
                                    className="truncate max-w-full block font-semibold text-white hover:text-cyan-300 transition text-left group/fn"
                                    title={`Visualizar ${file.name} para conferência visual direta`}
                                  >
                                    <span className="hover:underline">{file.name}</span>
                                    <Eye className="inline ml-1.5 h-3 w-3 text-white/40 group-hover/fn:text-cyan-400 opacity-60 group-hover/fn:opacity-100 shrink-0 transition" />
                                  </button>
                                  {(() => {
                                    const partes = (file.relativePath || '').split(/[\\/]/).filter(Boolean);
                                    const pastaPaiRel = partes.slice(0, -1).join('\\');
                                    const rotuloPastaPai = partes.length > 1 ? partes[partes.length - 2] : getRootInfo(file.rootId, file.relativePath).label;
                                    const rootIdCast = (file.rootId as RaizId) || 'vol1';
                                    const isPastaFav = verificarPastaFavorita(pastasFavoritas, rootIdCast, pastaPaiRel);
                                    return (
                                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                        <span
                                          className="truncate font-mono text-[11px] text-white/50"
                                          title={formatCartorioPath(file.rootId, file.relativePath)}
                                        >
                                          {formatCartorioPath(file.rootId, file.relativePath)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={e => toggleFavoritoBusca(rootIdCast, pastaPaiRel, rotuloPastaPai, e)}
                                          title={
                                            isPastaFav
                                              ? `Retirar pasta "${rotuloPastaPai}" dos favoritos`
                                              : `Colocar pasta "${rotuloPastaPai}" nos favoritos`
                                          }
                                          className={`shrink-0 inline-flex items-center justify-center rounded p-0.5 transition ${
                                            isPastaFav
                                              ? 'text-amber-400 opacity-100'
                                              : 'text-slate-500 opacity-50 group-hover:opacity-100 hover:text-amber-300'
                                          }`}
                                        >
                                          <Star className={`h-3 w-3 ${isPastaFav ? 'fill-amber-400' : ''}`} />
                                        </button>
                                      </div>
                                    );
                                  })()}

                                  {(() => {
                                    // Arquivos de imagem de matrícula (.KEN / .TIF) já são o documento final do Livro 2
                                    if (isKenOrTif) return null;

                                    const fileMatricula =
                                      file.matricula ||
                                      getCachedExtracao(fileKey)?.matricula_transcricao ||
                                      (file.name.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*([0-9.\-]+)/i)?.[0]);

                                    if (!fileMatricula) return null;

                                    return (
                                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <span
                                          className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 shadow-sm"
                                          title={`${/transcri[çc][ãa]o/i.test(fileMatricula) ? 'Transcrição' : 'Matrícula'} identificada neste documento: ${fileMatricula}`}
                                        >
                                          <FileText className="h-3 w-3 text-cyan-400 shrink-0" />
                                          <span>{fileMatricula}</span>
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 sm:p-4 whitespace-nowrap">
                              {(() => {
                                const rootInfo = getRootInfo(file.rootId, file.relativePath);
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition shadow-sm ${rootInfo.badgeClass}`}
                                    title={`${rootInfo.fullName} • ${rootInfo.pathDisplay}`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${rootInfo.dotClass}`} />
                                    <span>{rootInfo.label}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-3.5 sm:p-4 text-white/70 text-xs sm:text-sm whitespace-nowrap">
                              {Math.ceil(file.size / 1024)} KB
                            </td>
                            <td className="p-3.5 sm:p-4 text-white/70 text-xs sm:text-sm whitespace-nowrap">
                              {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                            </td>

                            {/* Coluna de Ações: Botão Direto de Visualizar + Três Pontinhos */}
                            <td className="sticky right-0 bg-[#0B1020] group-hover:bg-[#0E1528] p-3 text-right whitespace-nowrap z-10 border-l border-white/10 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)] w-20 min-w-[80px] max-w-[80px]">
                              <div className="flex items-center justify-end gap-1.5" data-menu-acoes>
                                {/* Botão de Visualização Rápida */}
                                <button
                                  type="button"
                                  disabled={!!processandoAcao}
                                  onClick={() => visualizarDocumento(file)}
                                  title={
                                    emProcessamento && processandoAcao?.tipo === 'leitura'
                                      ? `Carregando documento… ${formatTempoMMSS(tempoDecorrido)}`
                                      : `Visualizar ${file.name}`
                                  }
                                  aria-label={`Visualizar ${file.name}`}
                                  className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                                    jaLido
                                      ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-300 hover:bg-cyan-900/80 shadow-sm'
                                      : 'border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  }`}
                                >
                                  {emProcessamento && processandoAcao?.tipo === 'leitura' ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>

                                {/* Botão de Três Pontinhos */}
                                <div className="relative inline-block text-left">
                                  <button
                                    type="button"
                                    onClick={e => alternarMenuAcoes(fileKey, e.currentTarget)}
                                    title="Outras ações para este arquivo"
                                    aria-label="Mais opções"
                                    aria-expanded={menuAbertoKey === fileKey}
                                    className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition ${
                                      menuAbertoKey === fileKey
                                        ? 'border-cyan-500 bg-cyan-950 text-cyan-200 shadow'
                                        : 'border-slate-700/80 bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
                                    }`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PORTAL UNIFICADO DO MENU DE AÇÕES (Popover fixo no Desktop | Bottom-Sheet no Mobile/iPhone) */}
                {(() => {
                  if (!menuAbertoKey || !menuPos) return null;
                  const file = job.result.files.find(f => `${f.rootId}:${f.relativePath}` === menuAbertoKey);
                  if (!file) return null;
                  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                  const isPdf = ext === '.pdf';
                  const podeFormulario = isPdf || ext === '.docx' || ext === '.doc';
                  const fileKey = `${file.rootId}:${file.relativePath}`;
                  const jaExtraido = !!getCachedExtracao(fileKey);
                  const jaAuditado = !!getCachedAssinatura(fileKey);
                  const jaLido = !!getCachedLeitura(fileKey);
                  const pathFoiCopiado = caminhoCopiado === file.relativePath;

                  const conteudoMenu = (
                    <>
                      <div className="flex items-start justify-between gap-2 px-2.5 py-1.5 border-b border-slate-800 mb-1.5 text-left">
                        <p
                          className={`font-mono text-[11px] sm:text-[10px] text-slate-300 sm:text-slate-400 ${
                            menuPos.mobile ? 'break-words leading-snug flex-1' : 'truncate max-w-[250px]'
                          }`}
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        {menuPos.mobile && (
                          <button
                            type="button"
                            onClick={() => setMenuAbertoKey(null)}
                            aria-label="Fechar menu"
                            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Formulário de Manifestação em destaque no topo */}
                      {podeFormulario && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuAbertoKey(null);
                              extrairPeticao(file);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2.5 sm:py-2 text-left transition hover:bg-amber-500/20 hover:text-white"
                          >
                            <Zap className="h-4 w-4 text-amber-400 shrink-0 fill-amber-400/20" />
                            <div className="flex-1">
                              <span className="font-semibold text-amber-100">
                                {jaExtraido ? 'Abrir Formulário de Manifestação' : 'Preencher Formulário de Manifestação'}
                              </span>
                              <span className="block text-[10px] text-amber-200/60 font-normal">
                                {jaExtraido ? 'Já preenchido • abre o formulário salvo' : 'Extrai os dados da petição e abre o formulário'}
                              </span>
                            </div>
                          </button>
                          {jaExtraido && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuAbertoKey(null);
                                extrairPeticao(file, true);
                              }}
                              className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 sm:py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                            >
                              <RotateCw className="h-4 w-4 text-amber-400/70 shrink-0" />
                              <div className="flex-1">
                                <span>Reprocessar formulário</span>
                                <span className="block text-[10px] text-slate-500 font-normal">Descarta o preenchimento salvo e relê o arquivo</span>
                              </div>
                            </button>
                          )}
                          <div className="my-1 border-t border-slate-800" />
                        </>
                      )}

                      {/* 1. Visualizar */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuAbertoKey(null);
                          visualizarDocumento(file);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 sm:py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                      >
                        <Eye className="h-4 w-4 text-cyan-400 shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">Visualizar documento</span>
                          {jaLido && <span className="block text-[10px] text-emerald-400 font-normal">Pronto em cache</span>}
                        </div>
                      </button>

                      {/* 2. Recarregar do Disco */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuAbertoKey(null);
                          visualizarDocumento(file, true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 sm:py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                      >
                        <RotateCw className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="flex-1">
                          <span>Recarregar do disco</span>
                          <span className="block text-[10px] text-slate-500 font-normal">Descartar cache e reler do servidor</span>
                        </div>
                      </button>

                      {/* 3. Abrir em outro monitor / janela separada (apenas telas >= sm) */}
                      {!menuPos.mobile && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            setMenuAbertoKey(null);
                            const cached = getCachedLeitura(fileKey);
                            if (cached) {
                              abrirDocumentoEmJanela({ documento: cached, relativePath: file.relativePath, rootId: file.rootId });
                            } else {
                              await visualizarDocumento(file);
                            }
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                        >
                          <MonitorUp className="h-4 w-4 text-cyan-300 shrink-0" />
                          <div className="flex-1">
                            <span>Abrir em outro monitor</span>
                            <span className="block text-[10px] text-slate-500 font-normal">Janela própria para conferência lado a lado</span>
                          </div>
                        </button>
                      )}

                      {/* Ações Específicas para Processos / PDFs */}
                      {isPdf && (
                        <>
                          <div className="my-1 border-t border-slate-800" />

                          {/* Auditar Assinaturas Eletrônicas PAdES */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuAbertoKey(null);
                              analisarAssinaturas(file, jaAuditado);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 sm:py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                          >
                            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                            <div className="flex-1">
                              <span className="font-medium">{jaAuditado ? 'Re-auditar Assinaturas' : 'Auditar Assinaturas (PAdES)'}</span>
                              <span className="block text-[10px] text-slate-500 font-normal">
                                {jaAuditado ? 'Auditoria em cache • clique para reprocessar' : 'PAdES / ICP-Brasil / ITI'}
                              </span>
                            </div>
                          </button>
                        </>
                      )}

                      <div className="my-1 border-t border-slate-800" />

                      {/* Copiar Caminho */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          copiarCaminho(file);
                          setTimeout(() => setMenuAbertoKey(null), 800);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 sm:py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                      >
                        {pathFoiCopiado ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span className="font-semibold text-emerald-300">Caminho copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>Copiar caminho no cartório</span>
                          </>
                        )}
                      </button>
                    </>
                  );

                  if (menuPos.mobile) {
                    return createPortal(
                      <div
                        className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-xs p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                        onClick={() => setMenuAbertoKey(null)}
                      >
                        <div
                          role="menu"
                          data-menu-acoes
                          onClick={e => e.stopPropagation()}
                          style={{ maxHeight: menuPos.maxHeight }}
                          className="w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 shadow-2xl animate-in slide-in-from-bottom-4 duration-150"
                        >
                          {conteudoMenu}
                        </div>
                      </div>,
                      document.body,
                    );
                  }

                  return createPortal(
                    <div
                      role="menu"
                      data-menu-acoes
                      style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, maxHeight: menuPos.maxHeight }}
                      className="z-[300] w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      {conteudoMenu}
                    </div>,
                    document.body,
                  );
                })()}
              </>
            )}
          </div>
        );
        })()}
      </div>
      </div>

      {/* Modal Auditoria de Assinaturas */}
      {assinaturaAberta && (
        <AssinaturasModal
          nomeArquivo={assinaturaAberta.nome}
          analise={assinaturaAberta.analise}
          onClose={() => setAssinaturaAberta(null)}
        />
      )}

      {/* Modal Visualizador de DOCX / Minuta */}
      {documentoAberto && (
        <DocumentPreviewModal
          documento={documentoAberto}
          relativePath={documentoAbertoFile?.relativePath}
          rootId={documentoAbertoFile?.rootId}
          connectorId={connectorId}
          onClose={() => {
            setDocumentoAberto(null);
            setDocumentoAbertoFile(null);
          }}
        />
      )}
    </section>
  );
}
