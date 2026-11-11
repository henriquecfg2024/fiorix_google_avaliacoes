'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  FolderArchive,
  Loader2,
  Printer,
  RotateCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  DadosManifestacao,
  MinutaModelo,
  Segmento,
} from '@/components/documental/FichaOficialView';
import {
  POR_PAGINA_ARQUIVO,
  formatarDataHora,
  listarArquivoManifestacoes,
  obterManifestacaoApi,
  type ManifestacaoApi,
  type ManifestacaoCompletaApi,
} from '@/lib/documental/manifestacoesClient';
import {
  baixarDocManifestacao,
  baixarDocxManifestacao,
} from '@/lib/documental/generateManifestacaoWord';
import {
  LOGO_7RI_MANIFESTACAO_DATA_URI,
  LOGO_7RI_MANIFESTACAO_HEIGHT_PX,
  LOGO_7RI_MANIFESTACAO_WIDTH_PX,
} from '@/lib/documental/logo7riManifestacao';
import { resolverPlantaSetorQuadra, sanitizarDescricaoImovel } from '@/lib/confrontacoes';

export { POR_PAGINA_ARQUIVO };

const CSS_IMPRESSAO_ARQUIVO = `
  @media screen { #fiorix-arquivo-print-root { display: none !important; } }
  @media print {
    @page { size: A4 portrait; margin: 0mm !important; }
    :root, html { color-scheme: light !important; }
    html, body {
      background: #ffffff !important;
      background-image: none !important;
      width: auto !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    body::before, body::after { content: none !important; display: none !important; }
    body > *:not(#fiorix-arquivo-print-root) { display: none !important; }
    #fiorix-arquivo-print-root {
      display: block !important;
      position: static !important;
      color: #000 !important;
      background: #fff !important;
      padding: 15mm !important;
    }
    #fiorix-arquivo-print-root * {
      box-sizing: border-box !important;
      color: #000 !important;
      animation: none !important;
      transition: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

interface EventoHistorico {
  tipo?: string;
  dataHora?: string;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  confirmouImpressao?: boolean;
  descricao?: string;
}

type DadosArquivados = Partial<DadosManifestacao> & {
  conferido_por_nome?: string | null;
  conferido_em?: string | null;
  impressao_confirmada?: boolean;
  impressao_confirmada_em?: string | null;
  impressao_confirmada_por_nome?: string | null;
  arquivado_em?: string | null;
  arquivado_por_nome?: string | null;
  historico_eventos?: EventoHistorico[];
};

async function calcularSha256Navegador(texto: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function temFormularioConferidoPreservado(dados: DadosArquivados | null | undefined): boolean {
  if (!dados || typeof dados !== 'object') return false;
  const chavesUteis = [
    'numero_processo',
    'requerente',
    'imovel',
    'matricula_transcricao',
    'contribuinte_sql',
    'anotacoes_ficha_oficial',
    'confrontante_lado_direito',
    'confrontante_lado_esquerdo',
    'confrontante_fundos',
  ] as const;
  return chavesUteis.some(k => Boolean(String(dados[k] || '').trim())) || Boolean(dados.id_ficha);
}

function temManifestacaoFinalPreservada(m: ManifestacaoCompletaApi | null): boolean {
  if (!m) return false;
  const temMinuta = Boolean(m.minuta && typeof m.minuta === 'object' && m.minuta.cabecalho);
  const temTexto = Boolean(m.textoFinal && m.textoFinal.trim().length > 0);
  return temMinuta || temTexto;
}

export function ArquivoManifestacoes() {
  const [termoDigitado, setTermoDigitado] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [pagina, setPagina] = useState(1);
  const [itens, setItens] = useState<ManifestacaoApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Detalhes e consulta do procedimento arquivado
  const [carregandoDetalheId, setCarregandoDetalheId] = useState<string | null>(null);
  const [aberta, setAberta] = useState<ManifestacaoCompletaApi | null>(null);
  const [abaDetalhe, setAbaDetalhe] = useState<'resumo' | 'manifestacao' | 'formulario'>('resumo');
  const [modoImpressao, setModoImpressao] = useState<'manifestacao' | 'formulario' | null>(null);
  const [integridade, setIntegridade] = useState<'verificando' | 'integra' | 'divergente' | 'indisponivel'>('verificando');
  const [copiado, setCopiado] = useState(false);

  const cacheDetalhesRef = useRef(new Map<string, ManifestacaoCompletaApi>());
  const jaAbriuQueryIdRef = useRef(false);

  // Debounce na digitação da busca (300ms) e retorno automático à 1ª página
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAtiva(prev => {
        const novo = termoDigitado.trim();
        if (prev !== novo) {
          setPagina(1);
        }
        return novo;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [termoDigitado]);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await listarArquivoManifestacoes({
        busca: buscaAtiva || undefined,
        pagina,
        porPagina: POR_PAGINA_ARQUIVO,
      });
      setItens(resposta.itens);
      setTotal(resposta.total);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os procedimentos arquivados.',
      );
    } finally {
      setCarregando(false);
    }
  }, [buscaAtiva, pagina]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const abrirDetalhes = useCallback(
    async (id: string, abaInicial: 'resumo' | 'manifestacao' | 'formulario' = 'resumo') => {
      setCarregandoDetalheId(id);
      setErro(null);
      try {
        const emCache = cacheDetalhesRef.current.get(id);
        const registro = emCache ?? (await obterManifestacaoApi(id));
        if (registro.status === 'finalizada') {
          cacheDetalhesRef.current.set(id, registro);
        }
        setAberta(registro);
        setAbaDetalhe(abaInicial);
      } catch (err) {
        setErro(
          err instanceof Error
            ? err.message
            : 'Não foi possível abrir os detalhes deste procedimento arquivado.',
        );
      } finally {
        setCarregandoDetalheId(null);
      }
    },
    [],
  );

  // Permite acesso direto via /gestao-documental/arquivo?id=<uuid> (ex.: após finalizar Etapa 2)
  useEffect(() => {
    if (jaAbriuQueryIdRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const idUrl = params.get('id');
    if (idUrl && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idUrl)) {
      jaAbriuQueryIdRef.current = true;
      void abrirDetalhes(idUrl, 'resumo');
    }
  }, [abrirDetalhes]);

  // Verifica integridade SHA-256 do documento arquivado ao abrir detalhes
  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    setIntegridade('verificando');
    if (!aberta.textoFinal || !aberta.hashSha256) {
      setIntegridade('indisponivel');
      return;
    }
    void calcularSha256Navegador(aberta.textoFinal).then(calculado => {
      if (!ativo) return;
      if (!calculado) setIntegridade('indisponivel');
      else if (calculado === aberta.hashSha256) setIntegridade('integra');
      else setIntegridade('divergente');
    });
    return () => {
      ativo = false;
    };
  }, [aberta]);

  // Controle de impressão isolada (somente conteúdo documental em A4, sem menus ou botões)
  useEffect(() => {
    if (!modoImpressao) return;
    const encerrar = () => setModoImpressao(null);
    window.addEventListener('afterprint', encerrar);
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
    const aoMudar = (ev: MediaQueryListEvent) => {
      if (!ev.matches) encerrar();
    };
    mql?.addEventListener?.('change', aoMudar);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', encerrar);
      mql?.removeEventListener?.('change', aoMudar);
    };
  }, [modoImpressao]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_ARQUIVO));
  const inicioIntervalo = total === 0 ? 0 : (pagina - 1) * POR_PAGINA_ARQUIVO + 1;
  const fimIntervalo = total === 0 ? 0 : Math.min(pagina * POR_PAGINA_ARQUIVO, total);

  const acionarReimpressaoManifestacao = () => {
    if (!aberta) return;
    if (!temManifestacaoFinalPreservada(aberta)) {
      setAviso('O documento final da manifestação não está disponível neste registro arquivado.');
      return;
    }
    setAbaDetalhe('manifestacao');
    setModoImpressao('manifestacao');
  };

  const acionarImpressaoFormularioConferido = () => {
    if (!aberta) return;
    const dados = (aberta.dados || {}) as DadosArquivados;
    if (!temFormularioConferidoPreservado(dados)) {
      setAviso('O formulário de conferência não está disponível neste registro arquivado.');
      return;
    }
    setAbaDetalhe('formulario');
    setModoImpressao('formulario');
  };

  const copiarTextoArquivado = async () => {
    if (!aberta?.textoFinal) {
      setAviso('O texto final da manifestação não está disponível para cópia neste registro.');
      return;
    }
    try {
      await navigator.clipboard.writeText(aberta.textoFinal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setAviso('Não foi possível copiar para a área de transferência.');
    }
  };

  const exportarDocxArquivado = () => {
    if (!aberta?.minuta) {
      setAviso('A estrutura da manifestação não está disponível para exportação .DOCX neste registro.');
      return;
    }
    baixarDocxManifestacao(
      aberta.minuta,
      aberta.finalizadoEm
        ? {
            id: aberta.id,
            versao: aberta.versao,
            finalizadoEm: aberta.finalizadoEm,
            finalizadoPorNome: aberta.finalizadoPorNome,
            hashSha256: aberta.hashSha256 || '',
          }
        : null,
      aberta.numeroProcesso || aberta.dados?.numero_processo,
    );
  };

  const exportarDocArquivado = () => {
    if (!aberta?.minuta) {
      setAviso('A estrutura da manifestação não está disponível para exportação .DOC neste registro.');
      return;
    }
    baixarDocManifestacao(
      aberta.minuta,
      aberta.finalizadoEm
        ? {
            id: aberta.id,
            versao: aberta.versao,
            finalizadoEm: aberta.finalizadoEm,
            finalizadoPorNome: aberta.finalizadoPorNome,
            hashSha256: aberta.hashSha256 || '',
          }
        : null,
      aberta.numeroProcesso || aberta.dados?.numero_processo,
    );
  };

  const exportarPdfArquivado = async () => {
    if (!aberta?.minuta) {
      setAviso('A estrutura da manifestação não está disponível para exportação PDF neste registro.');
      return;
    }
    const { baixarPdfManifestacao } = await import('@/lib/pdf/generateManifestacaoPdf');
    baixarPdfManifestacao(
      aberta.minuta,
      aberta.finalizadoEm
        ? {
            id: aberta.id,
            versao: aberta.versao,
            finalizadoEm: aberta.finalizadoEm,
            finalizadoPorNome: aberta.finalizadoPorNome,
            hashSha256: aberta.hashSha256 || '',
          }
        : null,
      aberta.numeroProcesso || aberta.dados?.numero_processo,
    );
  };

  const dadosAberta = useMemo(
    () => ((aberta?.dados && typeof aberta.dados === 'object' ? aberta.dados : {}) as DadosArquivados),
    [aberta],
  );

  const historicoEventos = useMemo(() => {
    if (!aberta) return [];
    const registrados = Array.isArray(dadosAberta.historico_eventos)
      ? dadosAberta.historico_eventos
      : [];
    const lista: Array<{ titulo: string; dataHora: string | null; responsavel: string | null; detalhe?: string }> = [];

    lista.push({
      titulo: 'Procedimento criado / registrado na fila',
      dataHora: aberta.createdAt,
      responsavel: aberta.criadoPorNome || aberta.escrevente || null,
    });

    const confEm = dadosAberta.conferido_em || aberta.conferidoEm || null;
    const confPor = dadosAberta.conferido_por_nome || aberta.conferidoPorNome || null;
    const temEventoConf = registrados.some(e => e.tipo === 'CONFERENCIA_CONCLUIDA');
    if ((confEm || confPor) && !temEventoConf) {
      lista.push({
        titulo: 'Conferência oficial concluída (CONFERIDO)',
        dataHora: confEm,
        responsavel: confPor,
      });
    }

    for (const ev of registrados) {
      lista.push({
        titulo:
          ev.tipo === 'CONFERENCIA_CONCLUIDA'
            ? 'Conferência oficial concluída (CONFERIDO)'
            : ev.tipo === 'CONFERENCIA_REABERTA'
              ? 'Retornado para Aguardando Conferência'
              : ev.tipo === 'ETAPA2_FINALIZADA_E_ARQUIVADA'
                ? 'Etapa 2 finalizada e procedimento arquivado'
                : ev.descricao || 'Evento do procedimento',
        dataHora: ev.dataHora || null,
        responsavel: ev.usuarioNome || null,
        detalhe: ev.confirmouImpressao
          ? 'Confirmação de impressão registrada pelo usuário ao finalizar a Etapa 2.'
          : ev.descricao,
      });
    }

    const temEventoArq = registrados.some(e => e.tipo === 'ETAPA2_FINALIZADA_E_ARQUIVADA');
    if (!temEventoArq && aberta.finalizadoEm) {
      lista.push({
        titulo: 'Etapa 2 concluída e procedimento arquivado',
        dataHora: aberta.finalizadoEm,
        responsavel: aberta.finalizadoPorNome || aberta.escrevente || null,
        detalhe: dadosAberta.impressao_confirmada
          ? 'Confirmação de impressão registrada pelo usuário.'
          : undefined,
      });
    }

    return lista;
  }, [aberta, dadosAberta]);

  return (
    <section className="space-y-4" aria-labelledby="arquivo-manifestacoes-titulo">
      {/* Barra superior compacta: título, contador e pesquisa com debounce */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4 text-white shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FolderArchive className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
              <h2 id="arquivo-manifestacoes-titulo" className="text-sm font-bold tracking-wide text-white">
                ARQUIVO — Procedimentos de Manifestação Finalizados
              </h2>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                {total} {total === 1 ? 'procedimento' : 'procedimentos'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Consulta e reimpressão de procedimentos com conferência concluída e Etapa 2 finalizada.
            </p>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto md:min-w-[380px] lg:min-w-[440px]">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="arquivo-pesquisa-input"
                type="search"
                value={termoDigitado}
                onChange={e => setTermoDigitado(e.target.value)}
                placeholder="Pesquisar processo, requerente ou matrícula…"
                aria-label="Pesquisar processo, requerente ou matrícula"
                maxLength={120}
                className="w-full rounded-xl border border-white/15 bg-[#080D1A] py-2 pl-9 pr-8 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              {termoDigitado && (
                <button
                  type="button"
                  onClick={() => {
                    setTermoDigitado('');
                    setBuscaAtiva('');
                    setPagina(1);
                  }}
                  aria-label="Limpar pesquisa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => void carregarLista()}
              disabled={carregando}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white disabled:opacity-50"
              title="Atualizar listagem do Arquivo"
            >
              <RotateCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mensagens de feedback ou falha recuperável */}
      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-2.5 text-xs font-medium text-amber-200"
        >
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="text-amber-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {erro && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{erro}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void carregarLista()}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500/30"
            >
              <RotateCw className="h-3 w-3" aria-hidden="true" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Listagem compacta (Desktop: tabela de 5 colunas | Mobile: linhas compactas de 2-3 linhas) */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-sm backdrop-blur-xl">
        {carregando && itens.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 px-4 py-12 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden="true" />
            <span>Carregando procedimentos arquivados…</span>
          </div>
        ) : itens.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FolderArchive className="mx-auto mb-2 h-7 w-7 text-slate-500" aria-hidden="true" />
            {buscaAtiva ? (
              <>
                <p className="text-sm font-semibold text-slate-200">
                  Nenhum resultado encontrado para “{buscaAtiva}”.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Verifique o número do processo, nome do requerente ou matrícula/transcrição pesquisada.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-200">
                  Nenhum procedimento arquivado até o momento.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Os procedimentos passam para esta aba automaticamente quando a Etapa 2 é finalizada e arquivada.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* DESKTOP: Tabela compacta de linha única por manifestação */}
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left text-xs text-slate-200">
                <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="w-[24%] px-4 py-2.5 font-semibold">
                      Processo
                    </th>
                    <th scope="col" className="w-[34%] px-3 py-2.5 font-semibold">
                      Requerente/interessado
                    </th>
                    <th scope="col" className="w-[18%] px-3 py-2.5 font-semibold">
                      Matrícula/transcrição
                    </th>
                    <th scope="col" className="w-[15%] px-3 py-2.5 font-semibold">
                      Arquivado em
                    </th>
                    <th scope="col" className="w-[9%] px-4 py-2.5 text-right font-semibold">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {itens.map(m => {
                    const processoExibicao = m.numeroProcesso?.trim() || 'Sem número';
                    const semNumero = !m.numeroProcesso?.trim();
                    const requerenteExibicao = m.requerente?.trim() || 'Não informado';
                    const matriculaExibicao = m.matricula?.trim() || '—';
                    const arquivadoEmExibicao = formatarDataHora(m.finalizadoEm || m.updatedAt);
                    const abrindoEste = carregandoDetalheId === m.id;

                    return (
                      <tr
                        key={m.id}
                        data-registro-id={m.id}
                        data-ficha-id={m.fichaId}
                        className="transition-colors hover:bg-white/[0.035]"
                      >
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`truncate font-mono text-[12.5px] font-semibold ${
                                semNumero ? 'italic text-slate-400' : 'text-white'
                              }`}
                              title={`${processoExibicao} • Ref. interna: ${m.fichaId}`}
                            >
                              {processoExibicao}
                            </span>
                            {semNumero && (
                              <span
                                className="shrink-0 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                                title={`Identificador interno estável: ${m.fichaId}`}
                              >
                                {m.fichaId.slice(0, 14)}
                              </span>
                            )}
                            {m.versao > 1 && (
                              <span className="shrink-0 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                                v{m.versao}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div
                            className="truncate text-[12.5px] font-medium text-slate-100"
                            title={requerenteExibicao}
                          >
                            {requerenteExibicao}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div
                            className="truncate font-mono text-xs text-slate-300"
                            title={matriculaExibicao}
                          >
                            {matriculaExibicao}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-slate-300">
                          {arquivadoEmExibicao}
                        </td>
                        <td className="px-4 py-2.5 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => void abrirDetalhes(m.id)}
                            disabled={abrindoEste}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-500/40 hover:bg-cyan-500/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
                            aria-label={`Ver detalhes do procedimento ${processoExibicao} (${m.fichaId})`}
                          >
                            {abrindoEste ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" aria-hidden="true" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                            )}
                            <span>Ver</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE: Cards compactos de 2 a 3 linhas sem rolagem horizontal */}
            <div className="divide-y divide-white/[0.06] md:hidden">
              {itens.map(m => {
                const processoExibicao = m.numeroProcesso?.trim() || 'Sem número';
                const semNumero = !m.numeroProcesso?.trim();
                const requerenteExibicao = m.requerente?.trim() || 'Não informado';
                const matriculaExibicao = m.matricula?.trim() || '—';
                const arquivadoEmExibicao = formatarDataHora(m.finalizadoEm || m.updatedAt);
                const abrindoEste = carregandoDetalheId === m.id;

                return (
                  <div
                    key={m.id}
                    data-registro-id={m.id}
                    className="flex flex-col gap-1.5 p-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`truncate font-mono text-xs font-bold ${
                            semNumero ? 'italic text-slate-400' : 'text-white'
                          }`}
                        >
                          {processoExibicao}
                        </span>
                        {m.versao > 1 && (
                          <span className="shrink-0 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                            v{m.versao}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void abrirDetalhes(m.id)}
                        disabled={abrindoEste}
                        className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white active:bg-cyan-500/20 disabled:opacity-50"
                        aria-label={`Ver detalhes do procedimento ${processoExibicao}`}
                      >
                        {abrindoEste ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                        )}
                        <span>Ver</span>
                      </button>
                    </div>
                    <div
                      className="truncate text-xs font-medium text-slate-200"
                      title={requerenteExibicao}
                    >
                      {requerenteExibicao}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate font-mono">Matr./Transc.: {matriculaExibicao}</span>
                      <span className="shrink-0">{arquivadoEmExibicao}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Rodapé de paginação (20 registros por página) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
          <div>
            {total > 0 ? (
              <span>
                Exibindo <strong className="text-slate-200">{inicioIntervalo}–{fimIntervalo}</strong> de{' '}
                <strong className="text-slate-200">{total}</strong> registro(s) encontrado(s)
              </span>
            ) : (
              <span>0 registros encontrados</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagina <= 1 || carregando}
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Anterior</span>
            </button>
            <span className="px-1 text-xs font-medium text-slate-300">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={pagina >= totalPaginas || carregando}
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Próxima</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Consulta e Reimpressão do Procedimento Arquivado */}
      {aberta && (
        <div
          data-no-print="true"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-2 sm:p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="arquivo-detalhe-titulo"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0B1020] text-white shadow-2xl"
          >
            {/* Cabeçalho do modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0F172A] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    <span>Arquivado — Etapa 2 concluída</span>
                  </span>
                  <h3 id="arquivo-detalhe-titulo" className="font-mono text-sm font-bold text-white">
                    {aberta.numeroProcesso?.trim() || 'Sem número'}
                  </h3>
                  <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-300">
                    Versão {aberta.versao} • ID {aberta.fichaId}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-300">
                  {aberta.requerente || 'Requerente não informado'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!temFormularioConferidoPreservado(dadosAberta)) {
                      setAviso('O formulário de conferência não está disponível para este registro.');
                      return;
                    }
                    setAbaDetalhe('formulario');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    abaDetalhe === 'formulario'
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-white'
                      : 'border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/10'
                  }`}
                >
                  <ScrollText className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                  <span>Consultar formulário conferido</span>
                </button>

                <button
                  type="button"
                  onClick={acionarReimpressaoManifestacao}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-cyan-500"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reimprimir manifestação</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAberta(null)}
                  aria-label="Fechar detalhes"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sub-abas internas do detalhe */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#080D1A] px-4 py-2">
              <div role="tablist" aria-label="Visualizações do procedimento arquivado" className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['resumo', 'Dados, Responsáveis e Histórico'],
                    ['manifestacao', 'Documento Final da Manifestação (Etapa 2)'],
                    ['formulario', 'Formulário Conferido (Etapa 1)'],
                  ] as const
                ).map(([idAba, rotuloAba]) => (
                  <button
                    key={idAba}
                    type="button"
                    role="tab"
                    aria-selected={abaDetalhe === idAba}
                    onClick={() => setAbaDetalhe(idAba)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      abaDetalhe === idAba
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    {rotuloAba}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {abaDetalhe === 'formulario' && temFormularioConferidoPreservado(dadosAberta) && (
                  <button
                    type="button"
                    onClick={acionarImpressaoFormularioConferido}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-white/[0.1]"
                  >
                    <Printer className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                    <span>Imprimir formulário conferido</span>
                  </button>
                )}
                {aberta.minuta && (
                  <>
                    <button
                      type="button"
                      onClick={exportarDocxArquivado}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                      <FileText className="h-3 w-3 text-blue-400" aria-hidden="true" />
                      <span>.DOCX</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportarDocArquivado}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                      <FileText className="h-3 w-3 text-indigo-400" aria-hidden="true" />
                      <span>.DOC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportarPdfArquivado()}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                      <Download className="h-3 w-3" aria-hidden="true" />
                      <span>PDF</span>
                    </button>
                  </>
                )}
                {aberta.textoFinal && (
                  <button
                    type="button"
                    onClick={() => void copiarTextoArquivado()}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                  >
                    {copiado ? (
                      <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>{copiado ? 'Copiado' : 'Copiar texto'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Corpo do modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {abaDetalhe === 'resumo' && (
                <div className="space-y-5 text-xs">
                  {/* Bloco 1: Identificação e Origem */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        Dados de Identificação
                      </h4>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Processo</dt>
                          <dd className="font-mono text-xs font-bold text-white">
                            {aberta.numeroProcesso?.trim() || 'Sem número'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Natureza do procedimento</dt>
                          <dd className="font-semibold text-slate-200">
                            {dadosAberta.natureza_processo ||
                              dadosAberta.tipo_processo ||
                              aberta.natureza ||
                              'USUCAPIÃO'}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] text-slate-400">Requerente / Interessado</dt>
                          <dd className="font-semibold text-white break-words">
                            {aberta.requerente?.trim() || 'Não informado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Matrícula / Transcrição</dt>
                          <dd className="font-mono font-semibold text-slate-200">
                            {aberta.matricula?.trim() || dadosAberta.matricula_transcricao || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">SQL / Contribuinte</dt>
                          <dd className="font-mono text-slate-200">
                            {dadosAberta.contribuinte_sql || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Subdistrito</dt>
                          <dd className="text-slate-200">
                            {aberta.subdistrito || dadosAberta.subdistrito || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Vara</dt>
                          <dd className="text-slate-200">{dadosAberta.vara || '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] text-slate-400">Imóvel</dt>
                          <dd className="text-slate-300 break-words">
                            {sanitizarDescricaoImovel(aberta.imovel || dadosAberta.imovel) || '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        Origem e Responsáveis
                      </h4>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] text-slate-400">Cartório / Empresa de origem</dt>
                          <dd className="font-semibold text-slate-200">
                            {dadosAberta.cartorio_origem ||
                              aberta.cartorioOrigem ||
                              '7º Oficial de Registro de Imóveis da Capital – SP'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Quem realizou a conferência</dt>
                          <dd className="font-semibold text-slate-200">
                            {dadosAberta.conferido_por_nome ||
                              aberta.conferidoPorNome ||
                              'Não registrado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Data/hora da conferência</dt>
                          <dd className="text-slate-200">
                            {dadosAberta.conferido_em || aberta.conferidoEm
                              ? formatarDataHora(dadosAberta.conferido_em || aberta.conferidoEm)
                              : 'Não disponível'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Finalizado por (Escrevente)</dt>
                          <dd className="font-semibold text-white">
                            {aberta.finalizadoPorNome || aberta.escrevente || 'Não registrado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] text-slate-400">Data/hora da finalização</dt>
                          <dd className="font-semibold text-emerald-300">
                            {formatarDataHora(aberta.finalizadoEm)}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[10.5px] text-slate-400">Confirmação de impressão (Etapa 2)</dt>
                          <dd className="text-slate-200">
                            {dadosAberta.impressao_confirmada_em || aberta.impressaoConfirmadaEm ? (
                              <span>
                                Confirmada pelo usuário em{' '}
                                <strong>
                                  {formatarDataHora(
                                    dadosAberta.impressao_confirmada_em ||
                                      aberta.impressaoConfirmadaEm,
                                  )}
                                </strong>
                                {dadosAberta.impressao_confirmada_por_nome
                                  ? ` (${dadosAberta.impressao_confirmada_por_nome})`
                                  : ''}
                              </span>
                            ) : (
                              'Registrada no arquivamento da Etapa 2'
                            )}
                          </dd>
                        </div>
                        {aberta.arquivoOrigem && (
                          <div className="sm:col-span-2">
                            <dt className="text-[10.5px] text-slate-400">Procedimento / Arquivo de origem</dt>
                            <dd className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-300">
                              <span className="truncate" title={aberta.arquivoOrigem.relativePath}>
                                {aberta.arquivoOrigem.name} ({aberta.arquivoOrigem.relativePath})
                              </span>
                              <Link
                                href={`/gestao-documental/visualizador?busca=${encodeURIComponent(
                                  aberta.numeroProcesso || aberta.arquivoOrigem.name,
                                )}`}
                                className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-sans text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                              >
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                <span>Consultar procedimento original</span>
                              </Link>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Bloco 2: Integridade documental e Ações Rápidas */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {integridade === 'integra' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          <span>Versão final preservada e íntegra (SHA-256 verificado)</span>
                        </span>
                      ) : integridade === 'divergente' ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-300 font-semibold">
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                          <span>Divergência detectada no hash SHA-256</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-400">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          <span>Registro arquivado de forma imutável</span>
                        </span>
                      )}
                      {aberta.hashSha256 && (
                        <span className="font-mono text-[10.5px] text-slate-500">
                          • SHA-256: {aberta.hashSha256.slice(0, 20)}…
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/gestao-documental?reabrir=${encodeURIComponent(aberta.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white"
                        title="Cria uma nova versão vinculada para correção sem alterar nem reabrir o registro arquivado"
                      >
                        <FilePlus2 className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                        <span>Nova versão (correção)</span>
                      </Link>
                    </div>
                  </div>

                  {/* Bloco 3: Histórico de Conferência e Finalização */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                      Histórico de Conferência e Finalização
                    </h4>
                    <ol className="space-y-2.5">
                      {historicoEventos.map((ev, i) => (
                        <li
                          key={`${ev.titulo}-${i}`}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                              <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                              <span>{ev.titulo}</span>
                            </div>
                            {ev.detalhe && <p className="pl-5 text-[11px] text-slate-400">{ev.detalhe}</p>}
                          </div>
                          <div className="text-right text-[11px] text-slate-400">
                            <div>{ev.dataHora ? formatarDataHora(ev.dataHora) : 'Data não registrada'}</div>
                            {ev.responsavel && (
                              <div className="font-medium text-slate-300">{ev.responsavel}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {abaDetalhe === 'manifestacao' && (
                <div>
                  {temManifestacaoFinalPreservada(aberta) ? (
                    <FolhaManifestacaoArquivada manifestacao={aberta} paraImpressao={false} />
                  ) : (
                    <div
                      role="alert"
                      className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-6 text-center text-xs text-amber-200"
                    >
                      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" aria-hidden="true" />
                      <p className="font-semibold">
                        O documento final da manifestação não está disponível neste registro arquivado.
                      </p>
                      <p className="mt-1 text-slate-400">
                        Para preservar a fidelidade documental, o sistema não regenera substitutos silenciosamente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {abaDetalhe === 'formulario' && (
                <div>
                  {temFormularioConferidoPreservado(dadosAberta) ? (
                    <FolhaFormularioConferidoArquivado dados={dadosAberta} />
                  ) : (
                    <div
                      role="alert"
                      className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-6 text-center text-xs text-amber-200"
                    >
                      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" aria-hidden="true" />
                      <p className="font-semibold">
                        O formulário conferido da Etapa 1 não está disponível neste registro arquivado.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Portal isolado de impressão (somente o documento arquivado em A4, sem menus, abas ou botões) */}
      {modoImpressao &&
        aberta &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="fiorix-arquivo-print-root">
            <style>{CSS_IMPRESSAO_ARQUIVO}</style>
            {modoImpressao === 'formulario' ? (
              <FolhaFormularioConferidoArquivado dados={dadosAberta} />
            ) : (
              <FolhaManifestacaoArquivada manifestacao={aberta} paraImpressao={true} />
            )}
          </div>,
          document.body,
        )}
    </section>
  );
}

function RenderSegmentosArquivados({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => {
        const bold = Boolean(s.negrito ?? s.destaque);
        const under = Boolean(s.sublinhado ?? s.destaque);
        if (bold && under) {
          return (
            <span key={i} className="font-bold underline">
              {s.t}
            </span>
          );
        }
        if (bold) {
          return (
            <strong key={i} className="font-bold">
              {s.t}
            </strong>
          );
        }
        if (under) {
          return (
            <span key={i} className="underline">
              {s.t}
            </span>
          );
        }
        return <React.Fragment key={i}>{s.t}</React.Fragment>;
      })}
    </>
  );
}

/**
 * Renderiza estritamente a versão final arquivada da Manifestação (snapshot `minuta` ou `textoFinal`),
 * sem regenerar silenciosamente a partir de novos modelos.
 */
function FolhaManifestacaoArquivada({
  manifestacao,
  paraImpressao,
}: {
  manifestacao: ManifestacaoCompletaApi;
  paraImpressao: boolean;
}) {
  const m: MinutaModelo | null =
    manifestacao.minuta && typeof manifestacao.minuta === 'object' && manifestacao.minuta.cabecalho
      ? manifestacao.minuta
      : null;

  if (!m) {
    return (
      <article
        className={
          paraImpressao
            ? 'mx-auto max-w-[820px] bg-white px-6 py-5 font-sans text-[12pt] leading-normal text-black'
            : 'mx-auto max-w-[820px] rounded-xl border border-gray-300 bg-white p-8 font-sans text-[11pt] leading-relaxed text-black shadow-md'
        }
      >
        <div className="mb-5 flex flex-col items-center">
          <img
            src={LOGO_7RI_MANIFESTACAO_DATA_URI}
            alt="7º Oficial de Registro de Imóveis da Capital - SP"
            width={LOGO_7RI_MANIFESTACAO_WIDTH_PX}
            height={LOGO_7RI_MANIFESTACAO_HEIGHT_PX}
            className="h-auto w-full max-w-[680px] object-contain select-none"
          />
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-black">
          {manifestacao.textoFinal || ''}
        </pre>
      </article>
    );
  }

  return (
    <article
      className={
        paraImpressao
          ? 'mx-auto max-w-[820px] bg-white px-6 py-5 font-sans text-[12pt] leading-normal text-black'
          : 'mx-auto max-w-[820px] rounded-xl border border-gray-300 bg-white p-8 font-sans text-[11pt] leading-relaxed text-black shadow-md space-y-4'
      }
    >
      <div className="mb-5 flex flex-col items-center">
        <img
          src={LOGO_7RI_MANIFESTACAO_DATA_URI}
          alt="7º Oficial de Registro de Imóveis da Capital - SP"
          width={LOGO_7RI_MANIFESTACAO_WIDTH_PX}
          height={LOGO_7RI_MANIFESTACAO_HEIGHT_PX}
          className="h-auto w-full max-w-[680px] object-contain select-none"
        />
      </div>

      <div className="text-xs space-y-0.5 mb-3">
        <div>
          <strong>{m.cabecalho.processoRotulo}</strong> {m.cabecalho.processoValor}
        </div>
        <div>
          <strong>{m.cabecalho.vara}</strong>
        </div>
        <div>
          <strong>{m.cabecalho.interessadosRotulo}</strong> <b>{m.cabecalho.interessadosValor}</b>
        </div>
        <div>
          <strong>{m.cabecalho.natureza}</strong>
        </div>
      </div>

      <div className="font-bold pt-2 mb-3">{m.saudacao}</div>

      {m.corpoTextoLivre && m.corpoTextoLivre.trim().length > 0 ? (
        <div className="text-justify space-y-3 text-xs leading-normal">
          {m.corpoTextoLivre
            .split(/\r?\n\s*\r?\n/)
            .map(b => b.trim())
            .filter(Boolean)
            .map((bloco, idx) => (
              <p key={`livre-${idx}`} className="indent-8 whitespace-pre-line">
                {bloco}
              </p>
            ))}
        </div>
      ) : (
        <div className="text-justify space-y-3 text-xs leading-normal">
          {m.paragrafosAntes.map((p, i) => (
            <p key={`a${i}`} className="indent-8">
              <RenderSegmentosArquivados segmentos={p} />
            </p>
          ))}
          <p className="indent-8">{m.introConfrontacoes}</p>
          <div className="pl-12 space-y-0.5">
            {m.confrontacoes.map(c => (
              <div key={c.campo}>
                {c.rotulo} {c.valor}
                {c.pontuacao}
              </div>
            ))}
          </div>
          {m.paragrafosDepois.map((p, i) => (
            <p key={`d${i}`} className="indent-8">
              <RenderSegmentosArquivados segmentos={p} />
            </p>
          ))}
        </div>
      )}

      <div className="pt-6 text-right text-xs">{m.local}</div>

      <div className="pt-8 text-center">
        <div className="text-xs mb-8">{m.assinatura.titulo || 'O Oficial,'}</div>
        <div className="border-t border-black w-64 max-w-full mx-auto pt-1 font-bold text-xs">
          {m.assinatura.nome}
        </div>
        <div className="text-[10px] text-gray-500">{m.assinatura.cargo}</div>
      </div>
    </article>
  );
}

/**
 * Renderiza o Formulário de Conferência do Oficial (Etapa 1) preservado no momento do arquivamento.
 */
function FolhaFormularioConferidoArquivado({ dados }: { dados: DadosArquivados }) {
  const imovelLimpo = sanitizarDescricaoImovel(dados.imovel);
  const plantaSetor = resolverPlantaSetorQuadra(dados.contribuinte_sql, imovelLimpo);
  const linhaPontilhada = (altura = 18) => (
    <span style={{ display: 'block', borderBottom: '1px dotted #555', height: altura }} />
  );

  return (
    <div
      style={{
        fontFamily: "'Times New Roman', Times, serif",
        color: '#000',
        background: '#fff',
        border: '2.5px solid #000',
        padding: 26,
        maxWidth: 820,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #000',
          paddingBottom: 10,
          marginBottom: 18,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 'bold',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          7º Cartório de Registro de Imóveis
        </h2>
        <p style={{ fontSize: 13, fontStyle: 'italic', margin: '2px 0 0' }}>Comarca da Capital</p>
        <p style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1.2, margin: '4px 0 0' }}>
          OFICIAL ADEMAR FIORANELLI
        </p>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            borderBottom: '1px dotted #555',
            paddingBottom: 4,
          }}
        >
          <span>
            <strong>Buscas feitas em:</strong> {dados.buscas_feitas_em || '___/___/______'}
          </span>
          <span>
            <strong>Processo:</strong> {dados.tipo_processo || 'USUCAPIÃO'} &nbsp;|&nbsp;{' '}
            <strong>Número:</strong> {dados.numero_processo || 'Sem número'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            borderBottom: '1px dotted #555',
            padding: '4px 0',
          }}
        >
          <span>
            <strong>{dados.vara || '____'} Vara</strong> de Registros Públicos da Capital
          </span>
          <span>
            <strong>Chegada em:</strong> {dados.data_chegada || '___/___/______'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Requerente:</p>
        <p
          style={{
            fontSize: 13,
            borderBottom: '1px dotted #555',
            minHeight: 22,
            padding: '2px 4px',
            margin: 0,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {dados.requerente || '\u00a0'}
        </p>
        {linhaPontilhada()}
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Imóvel:</p>
        <p
          style={{
            fontSize: 12,
            borderBottom: '1px dotted #555',
            minHeight: 22,
            padding: '2px 4px',
            margin: 0,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {imovelLimpo || '\u00a0'}{' '}
          {dados.contribuinte_sql ? (
            <>
              – <strong>SQL:</strong> {dados.contribuinte_sql}
              {dados.contribuinte_nao_averbado !== false
                ? ' (não averbado na matrícula de origem)'
                : ''}
            </>
          ) : null}
        </p>
        {linhaPontilhada()}
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Matrícula / Transcrição:</p>
        <p
          style={{
            fontSize: 12,
            borderBottom: '1px dotted #555',
            minHeight: 22,
            padding: '2px 4px',
            margin: 0,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {dados.matricula_transcricao ? (
            <strong>{dados.matricula_transcricao}</strong>
          ) : (
            '____________________'
          )}
          {dados.cartorio_origem ? ` (${dados.cartorio_origem})` : ''}
          {dados.titular_origem ? (
            <>
              {' '}
              – Titular: <strong>{dados.titular_origem}</strong>
            </>
          ) : null}
        </p>
        {linhaPontilhada()}
      </div>

      <span style={{ display: 'block', height: 3, background: '#000', margin: '20px 0 14px' }} />

      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            letterSpacing: 0.8,
            margin: '0 0 6px',
            textTransform: 'uppercase',
          }}
        >
          Conferência e Anotações:
        </p>
        {(dados.confrontante_lado_direito ||
          dados.confrontante_lado_esquerdo ||
          dados.confrontante_fundos ||
          dados.rua_olhar_confrontacao) &&
        !(dados.anotacoes_ficha_oficial || '').includes('CONFRONTAÇÕES') ? (
          <div
            style={{
              fontSize: 11.5,
              fontFamily: 'Arial, sans-serif',
              padding: '4px 6px',
              marginBottom: 6,
              border: '1px solid #888',
              background: '#fafafa',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
              CONFRONTAÇÕES DO IMÓVEL USUCAPIENDO:
            </div>
            {dados.rua_olhar_confrontacao ? (
              <div>
                • <strong>Frente (Logradouro):</strong> {dados.rua_olhar_confrontacao}
              </div>
            ) : null}
            {dados.confrontante_lado_direito ? (
              <div>
                • <strong>Pelo Lado Direito:</strong> {dados.confrontante_lado_direito}
              </div>
            ) : null}
            {dados.confrontante_lado_esquerdo ? (
              <div>
                • <strong>Pelo Lado Esquerdo:</strong> {dados.confrontante_lado_esquerdo}
              </div>
            ) : null}
            {dados.confrontante_fundos ? (
              <div>
                • <strong>Aos Fundos:</strong> {dados.confrontante_fundos}
              </div>
            ) : null}
            {plantaSetor ? (
              <div>
                • <strong>Planta Fiscal (Setores):</strong> {plantaSetor.caminhoCompleto}
              </div>
            ) : null}
          </div>
        ) : null}
        {dados.anotacoes_ficha_oficial ? (
          <p
            style={{
              fontSize: 12,
              fontFamily: 'Arial, sans-serif',
              minHeight: 40,
              padding: '2px 4px',
              margin: '0 0 6px',
              whiteSpace: 'pre-wrap',
              borderBottom: '1px dotted #777',
            }}
          >
            {dados.anotacoes_ficha_oficial}
          </p>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: dados.anotacoes_ficha_oficial ? 8 : 12 }).map((_, i) => (
            <span
              key={i}
              style={{ display: 'block', borderBottom: '1px dotted #888', paddingTop: 20 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
