"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  FileCheck2,
  Eye,
  Loader2,
  ListChecks,
  Search,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  ZoomOut,
  Download,
  CheckCircle2,
  RotateCcw,
  Clock3,
} from "lucide-react";
import {
  alternarConferenciaPedidoAction,
  gerarLoteImpressaoAction,
  salvarMarcacoesDocumentoPedidoAction,
} from "@/app/actions/cartorio-virtual";
import {
  LinkMatriculaLv2,
  LinkPrenotacaoWebri,
  renderizarTextoComLinksMatriculaLv2,
} from "./LinkMatriculaLv2";
import type {
  AnotacaoTarefaDTO,
  LoteImpressaoResumoDTO,
} from "@/lib/cartorio-virtual/repository";
import {
  correspondeFiltroTipoCertidao,
  interpretarSelecaoPedidosLote,
  obterPrenotacoesContraditorioDoPedido,
  OPCOES_FILTRO_TIPO_CERTIDAO,
  type EstadoOperacionalPedido,
  type FiltroConferenciaEscrevente,
  type FiltroTipoCertidaoValor,
  type MarcacaoVisualDocumentoPedido,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";
import { CardSelecaoLotePedidos } from "@/components/cartorio-virtual/CardSelecaoLotePedidos";
import { DocumentoPedidoInterativo } from "@/components/cartorio-virtual/DocumentoPedidoInterativo";

interface FiltrosIniciaisImpressao {
  tipoCertidao?: FiltroTipoCertidaoValor;
  origem?: "ONR" | "BALCAO" | "TODAS";
  estadoOperacional?: EstadoOperacionalPedido | "TODOS";
  busca?: string;
  statusConferencia?: FiltroConferenciaEscrevente;
}

const NIVEIS_ZOOM_PDF = ["FitH", 100, 115, 130, 150, 175] as const;
type NivelZoomPdf = (typeof NIVEIS_ZOOM_PDF)[number];

export function CentralImpressaoClient({
  pedidos,
  lotesIniciais: _lotesIniciais,
  anotacoesIniciais = [],
  pedidoInicialQuery = "",
  selecaoInicialQuery = "",
  filtrosIniciais,
}: {
  pedidos: PedidoCertidaoDetalheDTO[];
  lotesIniciais: LoteImpressaoResumoDTO[];
  anotacoesIniciais?: AnotacaoTarefaDTO[];
  pedidoInicialQuery?: string;
  selecaoInicialQuery?: string;
  filtrosIniciais?: FiltrosIniciaisImpressao;
}) {
  const router = useRouter();

  // Estado reativo local dos Pedidos (sincroniza conferência CONFERIDO / Estornar CONFERIDO e marcações do documento)
  const [pedidosState, setPedidosState] = useState<PedidoCertidaoDetalheDTO[]>(pedidos);
  useEffect(() => {
    setPedidosState(pedidos);
  }, [pedidos]);

  // Seleção em lote recém-pesquisada (via "De tanto a tanto" ou "Ponto e vírgula ;")
  const idsSelecaoInicial = useMemo(() => {
    if (!selecaoInicialQuery.trim()) return [];
    return interpretarSelecaoPedidosLote({
      pedidosDisponiveis: pedidosState,
      listaPontoEVirgula: selecaoInicialQuery,
    }).idsEncontrados;
  }, [pedidosState, selecaoInicialQuery]);

  const [selecaoLoteIds, setSelecaoLoteIds] = useState<string[]>(idsSelecaoInicial);
  const [expressaoSelecaoAtiva, setExpressaoSelecaoAtiva] =
    useState<string>(selecaoInicialQuery);
  const [modalSelecaoLoteAberto, setModalSelecaoLoteAberto] = useState<boolean>(false);

  // Busca rápida de nº do Pedido, filtro de Tipo e filtro CONFERIDO / NÃO CONFERIDO
  const [buscaRapidaNumero, setBuscaRapidaNumero] = useState<string>(
    filtrosIniciais?.busca || ""
  );
  const [filtroTipoCertidao, setFiltroTipoCertidao] = useState<FiltroTipoCertidaoValor>(
    filtrosIniciais?.tipoCertidao || "TODOS"
  );
  const [filtroConferencia, setFiltroConferencia] = useState<FiltroConferenciaEscrevente>(
    filtrosIniciais?.statusConferencia || "NAO_CONFERIDO"
  );

  // Pedido atualmente aberto no Card em Tela Cheia
  const resolverPedidoInicialId = () => {
    if (pedidoInicialQuery.trim()) {
      const q = pedidoInicialQuery.trim().replace(/^#+/, "").toLowerCase();
      const achado = pedidos.find(
        (p) =>
          p.id.toLowerCase() === q ||
          p.numeroPedido.toLowerCase() === q ||
          (p.protocoloExterno || "").toLowerCase() === q
      );
      if (achado) return achado.id;
    }
    if (idsSelecaoInicial.length > 0) {
      return idsSelecaoInicial[0];
    }
    const statusIni = filtrosIniciais?.statusConferencia || "NAO_CONFERIDO";
    if (statusIni === "NAO_CONFERIDO") {
      const primeiroNaoConf = pedidos.find(
        (p) => !p.conferidoPeloEscrevente && !p.devolvidoPeloEscrevente
      );
      if (primeiroNaoConf) return primeiroNaoConf.id;
    }
    return pedidos[0]?.id || "";
  };

  const [pedidoFocoId, setPedidoFocoId] = useState<string>(resolverPedidoInicialId);
  const [modoVisor, setModoVisor] = useState<"PEDIDO_EM_FOCO" | "LOTE_GERADO">(
    "PEDIDO_EM_FOCO"
  );

  useEffect(() => {
    if (!pedidoInicialQuery.trim()) return;
    const q = pedidoInicialQuery.trim().replace(/^#+/, "").toLowerCase();
    const achado = pedidos.find(
      (p) =>
        p.id.toLowerCase() === q ||
        p.numeroPedido.toLowerCase() === q ||
        (p.protocoloExterno || "").toLowerCase() === q
    );
    if (achado) {
      setPedidoFocoId(achado.id);
      setModoVisor("PEDIDO_EM_FOCO");
    }
  }, [pedidoInicialQuery, pedidos]);
  const [loteVisualizadoUrl, setLoteVisualizadoUrl] = useState<string | null>(null);
  const [paginaPdfFoco, setPaginaPdfFoco] = useState<1 | 2>(1);
  const [zoomPdf, setZoomPdf] = useState<NivelZoomPdf>("FitH");
  const [versaoPdfCacheBust, setVersaoPdfCacheBust] = useState<number>(1);
  const [telaCheiaLeitura, setTelaCheiaLeitura] = useState<boolean>(false);
  const [barraLateralDireitaAberta, setBarraLateralDireitaAberta] =
    useState<boolean>(true);
  const [gerando, setGerando] = useState<boolean>(false);
  const [salvandoConferencia, setSalvandoConferencia] = useState<boolean>(false);
  const [salvandoMarcacoes, setSalvandoMarcacoes] = useState<boolean>(false);

  const iframeImpressaoRef = useRef<HTMLIFrameElement | null>(null);
  const iframeLoteRef = useRef<HTMLIFrameElement | null>(null);

  // Mapa pedidoId -> anotações textuais anteriores (para exibição na Pág. 2 se existirem)
  const anotacoesPorPedidoMap = useMemo(() => {
    const mapa = new Map<string, AnotacaoTarefaDTO[]>();
    for (const a of anotacoesIniciais) {
      if (!a.pedidoId) continue;
      const lista = mapa.get(a.pedidoId) || [];
      lista.push(a);
      mapa.set(a.pedidoId, lista);
    }
    return mapa;
  }, [anotacoesIniciais]);

  const contagemAnotacoesObj = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const [k, lista] of anotacoesPorPedidoMap.entries()) {
      obj[k] = lista.length;
    }
    return obj;
  }, [anotacoesPorPedidoMap]);

  const contagensConferencia = useMemo(() => {
    const conf = pedidosState.filter((p) => Boolean(p.conferidoPeloEscrevente)).length;
    const dev = pedidosState.filter((p) => Boolean(p.devolvidoPeloEscrevente)).length;
    return {
      total: pedidosState.length,
      conferidos: conf,
      devolvidos: dev,
      naoConferidos: Math.max(0, pedidosState.length - conf - dev),
    };
  }, [pedidosState]);

  // Fila ativa na Mesa: respeita seleção em lote ou filtros ativos (incluindo CONFERIDO / DEVOLVIDO / NÃO CONFERIDO)
  const pedidosFilaAtiva = useMemo(() => {
    if (selecaoLoteIds.length > 0) {
      const posMap = new Map(selecaoLoteIds.map((id, idx) => [id, idx]));
      return pedidosState
        .filter((p) => posMap.has(p.id))
        .sort((a, b) => (posMap.get(a.id) ?? 0) - (posMap.get(b.id) ?? 0));
    }

    return pedidosState.filter((p) => {
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      if (
        filtrosIniciais?.origem &&
        filtrosIniciais.origem !== "TODAS" &&
        p.origem !== filtrosIniciais.origem
      ) {
        return false;
      }
      if (
        filtrosIniciais?.estadoOperacional &&
        filtrosIniciais.estadoOperacional !== "TODOS" &&
        p.estadoOperacional !== filtrosIniciais.estadoOperacional
      ) {
        return false;
      }
      return true;
    });
  }, [pedidosState, selecaoLoteIds, filtroTipoCertidao, filtroConferencia, filtrosIniciais]);

  const pedidoEmFoco = useMemo(() => {
    return (
      pedidosFilaAtiva.find((p) => p.id === pedidoFocoId) ||
      pedidosState.find((p) => p.id === pedidoFocoId) ||
      pedidosFilaAtiva[0] ||
      pedidosState[0] ||
      null
    );
  }, [pedidosFilaAtiva, pedidosState, pedidoFocoId]);

  const indiceFocoNaFila = useMemo(() => {
    if (!pedidoEmFoco) return -1;
    return pedidosFilaAtiva.findIndex((p) => p.id === pedidoEmFoco.id);
  }, [pedidosFilaAtiva, pedidoEmFoco]);

  const anotacoesDoPedidoEmFoco = useMemo(() => {
    if (!pedidoEmFoco) return [];
    return anotacoesPorPedidoMap.get(pedidoEmFoco.id) || [];
  }, [anotacoesPorPedidoMap, pedidoEmFoco]);

  const urlPdfPedidoReal = useMemo(() => {
    if (!pedidoEmFoco) return null;
    return `/api/cartorio-virtual/pedidos/${pedidoEmFoco.id}/pdf?v=${versaoPdfCacheBust}`;
  }, [pedidoEmFoco, versaoPdfCacheBust]);

  const urlPdfDownloadOuNovaGuia = useMemo(() => {
    if (modoVisor === "LOTE_GERADO" && loteVisualizadoUrl) return loteVisualizadoUrl;
    return urlPdfPedidoReal;
  }, [modoVisor, loteVisualizadoUrl, urlPdfPedidoReal]);

  const alterarZoom = (direcao: "MENOS" | "MAIS") => {
    const idxAtual = NIVEIS_ZOOM_PDF.indexOf(zoomPdf);
    if (direcao === "MAIS" && idxAtual < NIVEIS_ZOOM_PDF.length - 1) {
      setZoomPdf(NIVEIS_ZOOM_PDF[idxAtual + 1]);
    } else if (direcao === "MENOS" && idxAtual > 0) {
      setZoomPdf(NIVEIS_ZOOM_PDF[idxAtual - 1]);
    }
  };

  useEffect(() => {
    if (!telaCheiaLeitura && !modalSelecaoLoteAberto) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (modalSelecaoLoteAberto) setModalSelecaoLoteAberto(false);
        else setTelaCheiaLeitura(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [telaCheiaLeitura, modalSelecaoLoteAberto]);

  const selecionarPedidoParaLeitura = (pedidoId: string, pagina: 1 | 2 = 1) => {
    setPedidoFocoId(pedidoId);
    setModoVisor("PEDIDO_EM_FOCO");
    setPaginaPdfFoco(pagina);
  };

  const irParaPedidoAnterior = () => {
    if (indiceFocoNaFila > 0) {
      selecionarPedidoParaLeitura(pedidosFilaAtiva[indiceFocoNaFila - 1].id, 1);
    }
  };

  const irParaProximoPedido = () => {
    if (indiceFocoNaFila >= 0 && indiceFocoNaFila < pedidosFilaAtiva.length - 1) {
      selecionarPedidoParaLeitura(pedidosFilaAtiva[indiceFocoNaFila + 1].id, 1);
    }
  };

  const handleBuscaRapidaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const termo = buscaRapidaNumero.trim().replace(/^#+/, "").toLowerCase();
    if (!termo) return;

    if (termo.includes(";") || /^\d+\s*(?:-|a|até|ate|\.\.)\s*\d+$/i.test(termo)) {
      const res = interpretarSelecaoPedidosLote({
        pedidosDisponiveis: pedidosState,
        listaPontoEVirgula: buscaRapidaNumero,
      });
      if (res.idsEncontrados.length > 0) {
        setSelecaoLoteIds(res.idsEncontrados);
        setExpressaoSelecaoAtiva(res.numerosEncontrados.join(";"));
        selecionarPedidoParaLeitura(res.idsEncontrados[0], 1);
        toast.success(
          `Seleção carregada: ${res.idsEncontrados.length} Pedido(s) prontos para leitura e impressão em lote.`
        );
        return;
      }
    }

    const encontradoDireto = pedidosState.find(
      (p) =>
        p.numeroPedido.toLowerCase() === termo ||
        p.numeroPedido.toLowerCase().includes(termo) ||
        (p.protocoloExterno || "").toLowerCase().includes(termo) ||
        p.itens.some((it) => String(it.numeroMatricula || "") === termo) ||
        obterPrenotacoesContraditorioDoPedido(p).some(
          (pr) =>
            pr.numeroPrenotacao.toLowerCase().includes(termo) ||
            (pr.protocoloMagnetico || "").toLowerCase().includes(termo)
        )
    );

    const flex =
      !encontradoDireto
        ? interpretarSelecaoPedidosLote({
            pedidosDisponiveis: pedidosState,
            listaPontoEVirgula: termo,
          })
        : null;
    const encontrado =
      encontradoDireto ||
      (flex && flex.idsEncontrados.length > 0
        ? pedidosState.find((p) => p.id === flex.idsEncontrados[0])
        : undefined);

    if (encontrado) {
      selecionarPedidoParaLeitura(encontrado.id, 1);
      toast.success(`Pedido #${encontrado.numeroPedido} aberto na mesa.`);
    } else {
      toast.error(`Pedido "${buscaRapidaNumero}" não localizado.`);
    }
  };

  const handleDefinirConferenciaPedido = async (
    novoStatus: "CONFERIDO" | "NAO_CONFERIDO" | "DEVOLVIDO"
  ) => {
    if (!pedidoEmFoco) return;
    setSalvandoConferencia(true);
    try {
      const res = await alternarConferenciaPedidoAction({
        pedidoId: pedidoEmFoco.id,
        status: novoStatus,
        conferido: novoStatus === "CONFERIDO",
      });

      setPedidosState((prev) =>
        prev.map((p) => (p.id === pedidoEmFoco.id ? res.pedido : p))
      );
      setVersaoPdfCacheBust((v) => v + 1);

      if (novoStatus === "CONFERIDO") {
        toast.success(
          `Pedido #${pedidoEmFoco.numeroPedido} marcado como CONFERIDO (marca d'água verde aplicada).`
        );
      } else if (novoStatus === "DEVOLVIDO") {
        toast.success(
          `Pedido #${pedidoEmFoco.numeroPedido} marcado como DEVOLVIDO (marca d'água aplicada).`
        );
      } else {
        toast.success(
          `Status do Pedido #${pedidoEmFoco.numeroPedido} estornado para NÃO CONFERIDO.`
        );
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível atualizar a conferência do Pedido.");
    } finally {
      setSalvandoConferencia(false);
    }
  };

  const handleSalvarMarcacoesDocumento = async (
    novasMarcacoes: MarcacaoVisualDocumentoPedido[]
  ) => {
    if (!pedidoEmFoco) return;
    const alvoId = pedidoEmFoco.id;

    // Atualização otimista imediata na tela
    setPedidosState((prev) =>
      prev.map((p) =>
        p.id === alvoId ? { ...p, marcacoesDocumento: novasMarcacoes } : p
      )
    );

    setSalvandoMarcacoes(true);
    try {
      const res = await salvarMarcacoesDocumentoPedidoAction({
        pedidoId: alvoId,
        marcacoes: novasMarcacoes,
      });
      setPedidosState((prev) => prev.map((p) => (p.id === alvoId ? res.pedido : p)));
      setVersaoPdfCacheBust((v) => v + 1);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gravar marcações no documento.");
    } finally {
      setSalvandoMarcacoes(false);
    }
  };

  const handleImprimirPedidoIndividual = async (pedidoAlvo: PedidoCertidaoDetalheDTO) => {
    setGerando(true);
    try {
      const res = await gerarLoteImpressaoAction({
        modoSelecao: "INDIVIDUAL",
        pedidosIds: [pedidoAlvo.id],
        duplexFrenteNovaFolha: true,
        modoDadosImpressao: "ATUAL_RECONSTRUIDO",
        criterioOrdenacao: "NUMERO_PEDIDO_ASC",
      });
      const urlLote = `/api/cartorio-virtual/impressao/${res.lote.id}/pdf`;
      toast.success(
        `Impressão Frente e Verso do Pedido #${pedidoAlvo.numeroPedido} preparada (${res.lote.codigoLote}).`
      );

      // Dispara impressão nativa Frente e Verso (DuplexFlipLongEdge) no PDF vetorial recém-sincronizado
      const janelaImpressao = iframeImpressaoRef.current?.contentWindow;
      if (pedidoEmFoco?.id === pedidoAlvo.id && janelaImpressao) {
        janelaImpressao.focus();
        janelaImpressao.print();
      } else {
        window.open(urlLote, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao preparar impressão do Pedido.");
    } finally {
      setGerando(false);
    }
  };

  const handleImprimirSelecaoAtivaEmLote = async () => {
    if (selecaoLoteIds.length === 0) return;
    setGerando(true);
    try {
      const res = await gerarLoteImpressaoAction({
        modoSelecao: "SELECIONADOS",
        pedidosIds: selecaoLoteIds,
        duplexFrenteNovaFolha: true,
        modoDadosImpressao: "ATUAL_RECONSTRUIDO",
        criterioOrdenacao: "ORDEM_DIGITADA",
      });
      const urlLote = `/api/cartorio-virtual/impressao/${res.lote.id}/pdf`;
      setLoteVisualizadoUrl(urlLote);
      toast.success(
        `Lote ${res.lote.codigoLote} gerado com ${res.lote.totalPedidos} Pedido(s) em Frente e Verso.`
      );
      window.open(urlLote, "_blank", "noopener,noreferrer");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao imprimir lote selecionado.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      {/* Iframe invisível com o PDF vetorial oficial (DuplexFlipLongEdge + Selo CONFERIDO + Grifos + Textos) pronto para impressão direta */}
      {urlPdfPedidoReal && (
        <iframe
          ref={iframeImpressaoRef}
          key={urlPdfPedidoReal}
          src={urlPdfPedidoReal}
          title="Buffer de Impressão Duplex SIPLAN"
          className="fixed w-0 h-0 opacity-0 pointer-events-none border-0"
          aria-hidden="true"
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          CARD ÚNICO EM TELA CHEIA:
          DOCUMENTO INTERATIVO (GRIFAR + TEXTO) + BARRA LATERAL RETRÁTIL (CONFERIDO)
      ═══════════════════════════════════════════════════════════════════════════ */}
      <section
        className={
          telaCheiaLeitura
            ? "fixed inset-1 z-50 rounded-2xl border-2 border-cyan-400/50 bg-[#070B16] p-2.5 flex flex-col shadow-2xl overflow-hidden"
            : "w-full h-[calc(100vh-66px)] min-h-[720px] rounded-2xl border border-white/20 bg-[#0B1020]/95 p-2.5 flex flex-col overflow-hidden"
        }
      >
        {/* Barra Superior em Linha Única Compacta e Centralizada do Card do Pedido (adaptável a monitor vertical sem cortar) */}
        <div className="flex flex-wrap items-center justify-center gap-2 pb-1.5 border-b border-white/10 shrink-0">
          {/* Esquerda: Navegação < > + Busca + Filtros */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={irParaPedidoAnterior}
                disabled={indiceFocoNaFila <= 0}
                className="h-8 px-2.5 rounded-xl border-2 border-cyan-400/60 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-35 disabled:border-white/15 disabled:bg-[#080D1A] text-white font-extrabold text-[11px] inline-flex items-center gap-1 shadow-sm shadow-cyan-500/10 cursor-pointer transition whitespace-nowrap"
                title="Pedido anterior na fila"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-cyan-300 stroke-[2.75]" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={irParaProximoPedido}
                disabled={
                  indiceFocoNaFila < 0 || indiceFocoNaFila >= pedidosFilaAtiva.length - 1
                }
                className="h-8 px-2.5 rounded-xl border-2 border-cyan-400/60 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-35 disabled:border-white/15 disabled:bg-[#080D1A] text-white font-extrabold text-[11px] inline-flex items-center gap-1 shadow-sm shadow-cyan-500/10 cursor-pointer transition whitespace-nowrap"
                title="Próximo Pedido na fila"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5 text-cyan-300 stroke-[2.75]" />
              </button>
              {indiceFocoNaFila >= 0 && (
                <span className="text-[11px] text-slate-300 font-mono font-bold px-1 shrink-0">
                  ({indiceFocoNaFila + 1}/{pedidosFilaAtiva.length})
                </span>
              )}
            </div>

            {/* Busca rápida + Filtro de Conferência + Filtro de Tipo (na mesma linha) */}
            <form
              onSubmit={handleBuscaRapidaSubmit}
              className="flex items-center gap-1.5 flex-nowrap shrink-0"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-cyan-300 stroke-[2.75] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={buscaRapidaNumero}
                  onChange={(e) => setBuscaRapidaNumero(e.target.value)}
                  placeholder="Nº Pedido..."
                  title="Digite o Nº do Pedido e pressione Enter"
                  className="w-36 h-8 pl-8 pr-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 focus:bg-[#0B172A] border-2 border-cyan-400/75 focus:border-cyan-300 text-xs text-white font-mono font-extrabold placeholder:text-cyan-100/85 placeholder:font-bold shadow-sm shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 transition"
                />
              </div>

              <select
                aria-label="Filtrar por Conferência do Escrevente"
                value={filtroConferencia}
                onChange={(e) => {
                  const novoFiltro = e.target.value as FiltroConferenciaEscrevente;
                  setSelecaoLoteIds([]);
                  setFiltroConferencia(novoFiltro);
                  const primeiroDaNovaFila = pedidosState.find((p) => {
                    if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
                    if (novoFiltro === "CONFERIDO") return Boolean(p.conferidoPeloEscrevente);
                    if (novoFiltro === "DEVOLVIDO") return Boolean(p.devolvidoPeloEscrevente);
                    if (novoFiltro === "NAO_CONFERIDO") {
                      return !p.conferidoPeloEscrevente && !p.devolvidoPeloEscrevente;
                    }
                    return true;
                  });
                  if (primeiroDaNovaFila) {
                    setPedidoFocoId(primeiroDaNovaFila.id);
                    setModoVisor("PEDIDO_EM_FOCO");
                    setPaginaPdfFoco(1);
                  }
                }}
                className="h-8 px-3 rounded-xl bg-[#080D1A] border border-emerald-500/45 text-xs sm:text-sm font-extrabold text-emerald-200 cursor-pointer"
              >
                <option value="NAO_CONFERIDO">
                  NÃO CONFERIDO ({contagensConferencia.naoConferidos})
                </option>
                <option value="TODOS">Todos ({contagensConferencia.total})</option>
                <option value="CONFERIDO">
                  ✓ CONFERIDO ({contagensConferencia.conferidos})
                </option>
                <option value="DEVOLVIDO">
                  ↩ DEVOLVIDO ({contagensConferencia.devolvidos})
                </option>
              </select>

              <select
                aria-label="Filtrar fila por Tipo de Pedido"
                value={filtroTipoCertidao}
                onChange={(e) => {
                  setSelecaoLoteIds([]);
                  setFiltroTipoCertidao(e.target.value);
                }}
                className="h-8 px-3 rounded-xl bg-[#080D1A] border border-cyan-400/45 text-xs sm:text-sm font-extrabold text-white cursor-pointer"
              >
                {OPCOES_FILTRO_TIPO_CERTIDAO.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </form>
          </div>

          {/* Direita: EM LOTE + Páginas 1/2 + PEDIDO + Ocultar Lateral + Tela Cheia (tudo na mesma linha) */}
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
            {selecaoLoteIds.length > 0 && (
              <div className="inline-flex items-center gap-1 px-2 h-8 rounded-xl border border-emerald-500/35 bg-emerald-500/12 text-[11px] whitespace-nowrap">
                <span className="text-emerald-200 font-bold">
                  ({selecaoLoteIds.length})
                </span>
                <button
                  type="button"
                  disabled={gerando}
                  onClick={handleImprimirSelecaoAtivaEmLote}
                  className="px-1.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  EM LOTE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelecaoLoteIds([]);
                    setExpressaoSelecaoAtiva("");
                  }}
                  className="text-slate-300 hover:text-white cursor-pointer"
                  title="Sair da seleção em lote"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {pedidoEmFoco && (
              <button
                type="button"
                disabled={gerando}
                onClick={() => handleImprimirPedidoIndividual(pedidoEmFoco)}
                className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer whitespace-nowrap"
                title="Imprimir este Pedido em Frente e Verso"
              >
                {gerando ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                IMPRIMIR
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalSelecaoLoteAberto(true)}
              className="h-8 px-2.5 rounded-xl border border-cyan-500/45 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Selecionar e imprimir pedidos em lote (De tanto a tanto ou separados por ;)"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-300" />
              EM LOTE
            </button>

            {pedidoEmFoco && (
              <div className="inline-flex h-8 items-center rounded-xl border border-white/15 bg-[#080D1A] p-0.5 text-[11px] whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setModoVisor("PEDIDO_EM_FOCO");
                    setPaginaPdfFoco(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer transition ${
                    modoVisor === "PEDIDO_EM_FOCO" && paginaPdfFoco === 1
                      ? "bg-cyan-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Folha Frente (Página 1)"
                >
                  FRENTE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoVisor("PEDIDO_EM_FOCO");
                    setPaginaPdfFoco(2);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer transition ${
                    modoVisor === "PEDIDO_EM_FOCO" && paginaPdfFoco === 2
                      ? "bg-cyan-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Folha Verso (Página 2)"
                >
                  VERSO
                </button>
              </div>
            )}

            {/* Botão explícito para Ocultar / Exibir a Barra Lateral Direita */}
            <button
              type="button"
              onClick={() => setBarraLateralDireitaAberta((v) => !v)}
              className="h-8 px-2.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-white/[0.08] text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title={
                barraLateralDireitaAberta
                  ? "Ocultar a barra lateral direita para ampliar o documento"
                  : "Exibir a barra lateral direita (CONFERIDO / DEVOLVIDO)"
              }
            >
              {barraLateralDireitaAberta ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5 text-cyan-400" />
                  Ocultar Lateral
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5 text-emerald-400" />
                  Exibir Conferência
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTelaCheiaLeitura((v) => !v)}
              className="h-8 px-2.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-white/[0.08] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Ocupar 100% da janela do navegador (ESC para sair)"
            >
              {telaCheiaLeitura ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  Sair
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  Tela Cheia
                </>
              )}
            </button>
          </div>
        </div>

        {/* Corpo Principal: Card do Pedido ocupando o máximo da tela + Barra Lateral Direita compacta (~196px) */}
        <div className="flex flex-col lg:flex-row gap-2.5 pt-2 flex-1 min-h-0">
          <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-white/15 bg-[#121826] flex flex-col h-full min-h-0">
            {/* Barra de Zoom, Frente e Verso (Duplex) e Exportação PDF (Centralizada) */}
            <div className="h-9 px-3 bg-[#090E1B] border-b border-white/10 flex items-center justify-center gap-3 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => alterarZoom("MENOS")}
                  disabled={NIVEIS_ZOOM_PDF.indexOf(zoomPdf) <= 0}
                  className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-35 text-slate-200 cursor-pointer"
                  title="Reduzir zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPdf("FitH")}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] cursor-pointer ${
                    zoomPdf === "FitH"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 font-bold"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                  title="Restaurar zoom 100%"
                >
                  {zoomPdf === "FitH" ? "ZOOM 100%" : `ZOOM ${zoomPdf}%`}
                </button>
                <button
                  type="button"
                  onClick={() => alterarZoom("MAIS")}
                  disabled={NIVEIS_ZOOM_PDF.indexOf(zoomPdf) >= NIVEIS_ZOOM_PDF.length - 1}
                  className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-35 text-slate-200 cursor-pointer"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-600 mx-1">|</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Padrão: Frente e Verso (Duplex)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {urlPdfDownloadOuNovaGuia && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (pedidoEmFoco && modoVisor === "PEDIDO_EM_FOCO") {
                          handleImprimirPedidoIndividual(pedidoEmFoco);
                        } else if (iframeLoteRef.current?.contentWindow) {
                          iframeLoteRef.current.contentWindow.focus();
                          iframeLoteRef.current.contentWindow.print();
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-semibold text-[11px] cursor-pointer"
                      title="Imprimir em Frente e Verso"
                    >
                      <Printer className="w-3 h-3 text-emerald-400" />
                      Imprimir Frente e Verso
                    </button>
                    <a
                      href={urlPdfDownloadOuNovaGuia}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.1] text-cyan-300 text-[11px] font-semibold"
                    >
                      PDF ↗
                    </a>
                    <a
                      href={urlPdfDownloadOuNovaGuia}
                      download={
                        pedidoEmFoco
                          ? `Pedido-${pedidoEmFoco.numeroPedido}-7RI.pdf`
                          : "Lote-Pedidos-7RI.pdf"
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.1] text-slate-300 text-[11px]"
                      title="Baixar PDF com todas as marcações e selo CONFERIDO"
                    >
                      <Download className="w-3 h-3 text-cyan-400" />
                      Baixar
                    </a>
                  </>
                )}
              </div>
            </div>

            {modoVisor === "LOTE_GERADO" && loteVisualizadoUrl ? (
              <iframe
                ref={iframeLoteRef}
                key={loteVisualizadoUrl}
                src={`${loteVisualizadoUrl}#view=FitH&toolbar=0&navpanes=0`}
                title="Pré-Visualização do Lote SIPLAN"
                className="w-full h-full flex-1 bg-white"
              />
            ) : pedidoEmFoco ? (
              <DocumentoPedidoInterativo
                pedido={pedidoEmFoco}
                paginaAtiva={paginaPdfFoco}
                onMudarPaginaAtiva={(novaPag) => setPaginaPdfFoco(novaPag)}
                escalaZoom={zoomPdf}
                anotacoesLegadas={anotacoesDoPedidoEmFoco}
                marcacoes={pedidoEmFoco.marcacoesDocumento || []}
                salvandoMarcacoes={salvandoMarcacoes}
                onSalvarMarcacoes={handleSalvarMarcacoesDocumento}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-10">
                Nenhum Pedido encontrado para o filtro selecionado.
              </div>
            )}
          </div>

          {/* ── BARRA LATERAL DIREITA ELEGANTE (256px): CONFERIDO / DEVOLVIDO / CONTRADITÓRIO ── */}
          {barraLateralDireitaAberta && (
            <aside className="w-full lg:w-[256px] lg:mt-[90px] shrink-0 flex flex-col min-h-0">
              <div className="rounded-2xl border border-emerald-500/35 bg-[#080D1A] p-3 space-y-3 shadow-xl">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CONFERÊNCIA</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBarraLateralDireitaAberta(false)}
                    className="px-2 py-1 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                    title="Ocultar barra lateral direita"
                  >
                    <PanelRightClose className="w-3 h-3 text-cyan-400" />
                    Ocultar
                  </button>
                </div>

                {pedidoEmFoco ? (
                  <>
                    {/* Status Visual Atual da Conferência / Devolução */}
                    {pedidoEmFoco.conferidoPeloEscrevente ? (
                      <div className="rounded-xl border border-emerald-400/60 bg-emerald-950/35 p-3 text-center space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-black tracking-wide">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          CONFERIDO
                        </div>
                        {pedidoEmFoco.conferidoPorNome && (
                          <p className="text-[10px] text-emerald-300/85 font-mono truncate">
                            {pedidoEmFoco.conferidoPorNome} • {pedidoEmFoco.conferidoEmBr}
                          </p>
                        )}
                      </div>
                    ) : pedidoEmFoco.devolvidoPeloEscrevente ? (
                      <div className="rounded-xl border border-rose-400/60 bg-rose-950/35 p-3 text-center space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-black tracking-wide">
                          <RotateCcw className="w-3.5 h-3.5 text-rose-300" />
                          DEVOLVIDO
                        </div>
                        {pedidoEmFoco.devolvidoPorNome && (
                          <p className="text-[10px] text-rose-300/85 font-mono truncate">
                            {pedidoEmFoco.devolvidoPorNome} • {pedidoEmFoco.devolvidoEmBr}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-3 text-center space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-black tracking-wide">
                          <Clock3 className="w-3.5 h-3.5 text-amber-300" />
                          NÃO CONFERIDO
                        </div>
                        <p className="text-[11px] font-semibold text-slate-300 leading-tight">
                          Pedido {pedidoEmFoco.numeroPedido} pendente
                        </p>
                        {pedidoEmFoco.itens[0]?.numeroMatricula && (
                          <div className="pt-0.5 flex items-center justify-center">
                            <LinkMatriculaLv2
                              numeroMatricula={pedidoEmFoco.itens[0].numeroMatricula}
                              prefixo="Matrícula nº "
                              variante="badge"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prenotações em Contraditório vinculadas ao Pedido */}
                    {obterPrenotacoesContraditorioDoPedido(pedidoEmFoco).length > 0 && (
                      <div className="rounded-xl border border-amber-400/55 bg-amber-950/30 p-2.5 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center justify-between">
                          <span>Prenotação em Contraditório</span>
                        </div>
                        {obterPrenotacoesContraditorioDoPedido(pedidoEmFoco).map((pr, idxPr) => (
                          <div
                            key={`${pr.numeroPrenotacao}-${idxPr}`}
                            className="rounded-xl bg-[#070B14]/90 border border-amber-400/30 p-2.5 space-y-1.5 shadow-inner"
                          >
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="inline-flex items-baseline gap-1 font-mono font-black text-amber-200 text-xs">
                                <span>Nº</span>
                                <LinkPrenotacaoWebri
                                  numeroPrenotacao={pr.numeroPrenotacao}
                                  variante="dark"
                                  className="text-sm"
                                />
                              </span>
                              {pr.livroContraditorio && (
                                <span className="px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-400/45 text-[10px] font-mono font-extrabold text-cyan-200">
                                  {renderizarTextoComLinksMatriculaLv2(
                                    pr.livroContraditorio,
                                    "dark"
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] font-extrabold text-white leading-snug">
                              {pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"}
                            </div>

                            {pr.naturezaTitulo &&
                              pr.naturezaTitulo !== pr.tipoPrenotacaoDescricao && (
                                <div className="text-[10px] font-mono text-slate-300 break-all leading-tight">
                                  {pr.naturezaTitulo}
                                </div>
                              )}

                            {pr.protocoloMagnetico && (
                              <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-1 text-[10px] font-mono">
                                <span className="text-slate-400">Protocolo:</span>
                                <span className="font-bold text-cyan-300">
                                  {pr.protocoloMagnetico}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ações: CONFERIDO, DEVOLVIDO e Estornar */}
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={
                          salvandoConferencia || Boolean(pedidoEmFoco.conferidoPeloEscrevente)
                        }
                        onClick={() => handleDefinirConferenciaPedido("CONFERIDO")}
                        className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-black text-[11px] tracking-wide inline-flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer transition"
                      >
                        {salvandoConferencia ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        CONFERIDO
                      </button>

                      <button
                        type="button"
                        disabled={
                          salvandoConferencia || Boolean(pedidoEmFoco.devolvidoPeloEscrevente)
                        }
                        onClick={() => handleDefinirConferenciaPedido("DEVOLVIDO")}
                        className="w-full h-9 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-black text-[11px] tracking-wide inline-flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25 cursor-pointer transition"
                      >
                        {salvandoConferencia ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        DEVOLVIDO
                      </button>

                      <button
                        type="button"
                        disabled={
                          salvandoConferencia ||
                          (!pedidoEmFoco.conferidoPeloEscrevente &&
                            !pedidoEmFoco.devolvidoPeloEscrevente)
                        }
                        onClick={() => handleDefinirConferenciaPedido("NAO_CONFERIDO")}
                        className="w-full h-8 rounded-xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-35 disabled:cursor-not-allowed text-slate-200 font-bold text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        {salvandoConferencia ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Estornar CONFERIDO
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400 text-center py-3">
                    Selecione um Pedido.
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* Modal sob demanda do Card Elegante de Seleção em Lote (De tanto a tanto ou Ponto e Vírgula) */}
      {modalSelecaoLoteAberto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <CardSelecaoLotePedidos
              pedidos={pedidosState}
              contagemAnotacoesPorPedido={contagemAnotacoesObj}
              selecaoInicialLista={expressaoSelecaoAtiva}
              modoCompactoModal
              onFecharModal={() => setModalSelecaoLoteAberto(false)}
              onAplicarSelecaoNaMesa={(ids, expr) => {
                setSelecaoLoteIds(ids);
                setExpressaoSelecaoAtiva(expr);
                if (ids.length > 0) {
                  selecionarPedidoParaLeitura(ids[0], 1);
                }
              }}
              onLoteGerado={(urlPdf) => {
                setLoteVisualizadoUrl(urlPdf);
                setModalSelecaoLoteAberto(false);
                window.open(urlPdf, "_blank", "noopener,noreferrer");
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
