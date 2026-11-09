"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  FileCheck2,
  Eye,
  EyeOff,
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
  Calendar,
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
  extrairEspeciesDistintasPedidos,
  interpretarSelecaoPedidosLote,
  obterPrenotacoesContraditorioDoPedido,
  type EstadoOperacionalPedido,
  type FiltroConferenciaEscrevente,
  type FiltroTipoCertidaoValor,
  type MarcacaoVisualDocumentoPedido,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";
import { CardSelecaoLotePedidos } from "@/components/cartorio-virtual/CardSelecaoLotePedidos";
import { DocumentoPedidoInterativo } from "@/components/cartorio-virtual/DocumentoPedidoInterativo";
import {
  SeletorDataPedidoCartorioVirtual,
  correspondeFiltroDataPedido,
} from "@/components/cartorio-virtual/SeletorDataPedidoCartorioVirtual";
import {
  BarraFiltrosWebriCartorioVirtual,
  ESTADO_INICIAL_FILTROS_WEBRI,
  correspondeFiltrosAvancadosWebri,
  type EstadoFiltrosAvancadosWebri,
} from "@/components/cartorio-virtual/BarraFiltrosWebriCartorioVirtual";
import { useCartorioVirtualTopoVisivel } from "@/components/cartorio-virtual/CartorioVirtualTopBar";

interface FiltrosIniciaisImpressao {
  tipoCertidao?: FiltroTipoCertidaoValor;
  origem?: "ONR" | "BALCAO" | "TODAS";
  dataPedido?: string;
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
  const [filtroOrigem, setFiltroOrigem] = useState<"TODAS" | "ONR" | "BALCAO">(
    filtrosIniciais?.origem || "TODAS"
  );
  const [filtroDataPedido, setFiltroDataPedido] = useState<string>(
    filtrosIniciais?.dataPedido || "TODAS"
  );
  const [filtroConferencia, setFiltroConferencia] = useState<FiltroConferenciaEscrevente>(
    filtrosIniciais?.statusConferencia || "NAO_CONFERIDO"
  );
  const [filtrosWebri, setFiltrosWebri] = useState<EstadoFiltrosAvancadosWebri>(
    ESTADO_INICIAL_FILTROS_WEBRI
  );
  const { tresLinhasVisiveis, alternarTresLinhas } = useCartorioVirtualTopoVisivel();

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
    const basePadrao = pedidos.filter((p) =>
      correspondeFiltrosAvancadosWebri(p, ESTADO_INICIAL_FILTROS_WEBRI)
    );
    const listaCandidata = basePadrao.length > 0 ? basePadrao : pedidos;
    const statusIni = filtrosIniciais?.statusConferencia || "NAO_CONFERIDO";
    if (statusIni === "NAO_CONFERIDO") {
      const primeiroNaoConf = listaCandidata.find(
        (p) => !p.conferidoPeloEscrevente && !p.devolvidoPeloEscrevente
      );
      if (primeiroNaoConf) return primeiroNaoConf.id;
    }
    return listaCandidata[0]?.id || pedidos[0]?.id || "";
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

  // Base filtrada por Origem, Conferência e Tipo para harmonizar as Datas disponíveis
  const baseParaDatas = useMemo(() => {
    return pedidosState.filter((p) => {
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (!correspondeFiltrosAvancadosWebri(p, filtrosWebri)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      return true;
    });
  }, [pedidosState, filtroOrigem, filtroTipoCertidao, filtroConferencia, filtrosWebri]);

  const datasPedidoDisponiveis = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of baseParaDatas) {
      if (p.dataPedidoBr) {
        mapa.set(p.dataPedidoBr, (mapa.get(p.dataPedidoBr) || 0) + 1);
      }
    }
    return Array.from(mapa.entries()).map(([dataBr, qtd]) => ({ dataBr, qtd }));
  }, [baseParaDatas]);

  // Base filtrada por Data, Origem e Conferência para harmonizar dinamicamente os TIPOS DE CERTIDÕES
  const baseParaTiposCertidao = useMemo(() => {
    return pedidosState.filter((p) => {
      if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (!correspondeFiltrosAvancadosWebri(p, filtrosWebri)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      return true;
    });
  }, [pedidosState, filtroDataPedido, filtroOrigem, filtroConferencia, filtrosWebri]);

  const opcoesTipoCertidaoDinamicas = useMemo(() => {
    const especiesDistintas = extrairEspeciesDistintasPedidos(baseParaTiposCertidao).sort(
      (a, b) => b.quantidade - a.quantidade || a.especie.localeCompare(b.especie, "pt-BR")
    );
    return [
      {
        valor: "TODOS",
        rotulo: `TIPOS DE CERTIDÕES (${baseParaTiposCertidao.length})`,
      },
      ...especiesDistintas.map((item) => ({
        valor: `ESPECIE:${item.especie}`,
        rotulo: `${item.especie} (${item.quantidade})`,
      })),
    ];
  }, [baseParaTiposCertidao]);

  // Garante que, ao trocar ONR/PRESENCIAL, Data ou Conferência, um Tipo inexistente no novo conjunto volte para TODOS
  useEffect(() => {
    if (
      filtroTipoCertidao !== "TODOS" &&
      !opcoesTipoCertidaoDinamicas.some((op) => op.valor === filtroTipoCertidao)
    ) {
      setFiltroTipoCertidao("TODOS");
    }
  }, [filtroTipoCertidao, opcoesTipoCertidaoDinamicas]);

  const contagensConferencia = useMemo(() => {
    const base = pedidosState.filter((p) => {
      if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (!correspondeFiltrosAvancadosWebri(p, filtrosWebri)) return false;
      return true;
    });
    const conf = base.filter((p) => Boolean(p.conferidoPeloEscrevente)).length;
    const dev = base.filter((p) => Boolean(p.devolvidoPeloEscrevente)).length;
    return {
      total: base.length,
      conferidos: conf,
      devolvidos: dev,
      naoConferidos: Math.max(0, base.length - conf - dev),
    };
  }, [pedidosState, filtroDataPedido, filtroOrigem, filtroTipoCertidao, filtrosWebri]);

  const contagensOrigem = useMemo(() => {
    const base = pedidosState.filter((p) => {
      if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (!correspondeFiltrosAvancadosWebri(p, filtrosWebri)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      return true;
    });
    const onr = base.filter((p) => p.origem === "ONR").length;
    const presencial = base.filter((p) => p.origem !== "ONR").length;
    return {
      todas: base.length,
      onr,
      presencial,
    };
  }, [pedidosState, filtroDataPedido, filtroTipoCertidao, filtroConferencia, filtrosWebri]);

  // Fila ativa na Mesa: respeita seleção em lote ou filtros ativos (incluindo DATA, CONFERIDO / DEVOLVIDO / NÃO CONFERIDO, ONR / PRESENCIAL e Filtros WEBRI)
  const pedidosFilaAtiva = useMemo(() => {
    if (selecaoLoteIds.length > 0) {
      const posMap = new Map(selecaoLoteIds.map((id, idx) => [id, idx]));
      return pedidosState
        .filter((p) => posMap.has(p.id))
        .sort((a, b) => (posMap.get(a.id) ?? 0) - (posMap.get(b.id) ?? 0));
    }

    return pedidosState.filter((p) => {
      if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (!correspondeFiltrosAvancadosWebri(p, filtrosWebri)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      if (
        filtrosIniciais?.estadoOperacional &&
        filtrosIniciais.estadoOperacional !== "TODOS" &&
        p.estadoOperacional !== filtrosIniciais.estadoOperacional
      ) {
        return false;
      }
      return true;
    });
  }, [
    pedidosState,
    selecaoLoteIds,
    filtroDataPedido,
    filtroOrigem,
    filtroTipoCertidao,
    filtroConferencia,
    filtrosWebri,
    filtrosIniciais,
  ]);

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
        {/* Barra Superior em Duas Linhas Centralizadas do Card do Pedido */}
        <div className="flex flex-col items-center justify-center gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
          {tresLinhasVisiveis && (
            <>
              {/* Linha 1: Navegação < > + Filtro de Data + Conferência + Origem + Tipo */}
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

            {/* Filtro de Data + Filtro de Conferência + Origem + Tipo (na 1ª linha) */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              {/* Seletor DATA DO PEDIDO estruturado por Dia / Mês / Ano + Calendário */}
              <SeletorDataPedidoCartorioVirtual
                valor={filtroDataPedido}
                onChange={(novaData) => {
                  setSelecaoLoteIds([]);
                  setFiltroDataPedido(novaData);
                  const primeiroDaNovaFila = pedidosState.find((p) => {
                    if (!correspondeFiltroDataPedido(p, novaData)) return false;
                    if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
                    if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
                    if (filtroConferencia === "CONFERIDO")
                      return Boolean(p.conferidoPeloEscrevente);
                    if (filtroConferencia === "DEVOLVIDO")
                      return Boolean(p.devolvidoPeloEscrevente);
                    if (filtroConferencia === "NAO_CONFERIDO") {
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
                pedidosBaseParaContagem={baseParaDatas}
                alturaClasse="h-8"
              />

              <select
                aria-label="Filtrar por Conferência do Escrevente"
                value={filtroConferencia}
                onChange={(e) => {
                  const novoFiltro = e.target.value as FiltroConferenciaEscrevente;
                  setSelecaoLoteIds([]);
                  setFiltroConferencia(novoFiltro);
                  const primeiroDaNovaFila = pedidosState.find((p) => {
                    if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
                    if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
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
                aria-label="Filtrar por Origem do Pedido (ONR ou Presencial)"
                value={filtroOrigem}
                onChange={(e) => {
                  const novaOrigem = e.target.value as "TODAS" | "ONR" | "BALCAO";
                  setSelecaoLoteIds([]);
                  setFiltroOrigem(novaOrigem);
                  const primeiroDaNovaFila = pedidosState.find((p) => {
                    if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
                    if (novaOrigem !== "TODAS" && p.origem !== novaOrigem) return false;
                    if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
                    if (filtroConferencia === "CONFERIDO")
                      return Boolean(p.conferidoPeloEscrevente);
                    if (filtroConferencia === "DEVOLVIDO")
                      return Boolean(p.devolvidoPeloEscrevente);
                    if (filtroConferencia === "NAO_CONFERIDO") {
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
                className="h-8 px-3 rounded-xl bg-[#080D1A] border border-indigo-400/55 text-xs sm:text-sm font-extrabold text-indigo-200 cursor-pointer"
                title="Filtrar pedidos por origem: ONR ou Presencial"
              >
                <option value="TODAS">
                  ONR / PRESENCIAL ({contagensOrigem.todas})
                </option>
                <option value="ONR">ONR ({contagensOrigem.onr})</option>
                <option value="BALCAO">
                  PRESENCIAL ({contagensOrigem.presencial})
                </option>
              </select>

              <select
                aria-label="Filtrar fila por Tipo de Pedido"
                value={filtroTipoCertidao}
                onChange={(e) => {
                  const novoTipo = e.target.value;
                  setSelecaoLoteIds([]);
                  setFiltroTipoCertidao(novoTipo);
                  const primeiroDaNovaFila = pedidosState.find((p) => {
                    if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
                    if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
                    if (!correspondeFiltroTipoCertidao(p, novoTipo)) return false;
                    if (filtroConferencia === "CONFERIDO")
                      return Boolean(p.conferidoPeloEscrevente);
                    if (filtroConferencia === "DEVOLVIDO")
                      return Boolean(p.devolvidoPeloEscrevente);
                    if (filtroConferencia === "NAO_CONFERIDO") {
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
                className="h-8 px-3 rounded-xl bg-[#080D1A] border border-cyan-400/45 text-xs sm:text-sm font-extrabold text-white cursor-pointer"
              >
                {opcoesTipoCertidaoDinamicas.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Pesquisa Nº Pedido (ao lado esquerdo de IMPRIMIR) + IMPRIMIR + EM LOTE + FRENTE/VERSO + Ocultar Lateral + Tela Cheia */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 shrink-0">
            <form onSubmit={handleBuscaRapidaSubmit} className="relative w-56 shrink-0">
              <Search className="w-4 h-4 text-cyan-300 stroke-[2.5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaRapidaNumero}
                onChange={(e) => setBuscaRapidaNumero(e.target.value)}
                placeholder="Pesquisar Pedido, Prenotação, ONR..."
                title="Digite o Nº do Pedido, Prenotação ou ONR e pressione Enter"
                className="w-full h-8 pl-9 pr-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 focus:bg-[#080D1A] border-2 border-cyan-400/70 focus:border-cyan-300 text-xs text-white font-semibold placeholder:text-cyan-100/80 focus:outline-none transition"
              />
            </form>
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

            <button
              type="button"
              onClick={alternarTresLinhas}
              className="h-8 px-2.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-white/[0.08] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Ocultar as 3 linhas superiores de uma vez"
            >
              <EyeOff className="w-3.5 h-3.5 text-cyan-300" />
              <span>Ocultar 3 Linhas</span>
            </button>
          </div>
            </>
          )}

          {/* Painel Completo de Filtros WEBRI na Verificação do Escrevente */}
          <BarraFiltrosWebriCartorioVirtual
            filtros={filtrosWebri}
            onChange={(novosFiltros) => {
              setSelecaoLoteIds([]);
              setFiltrosWebri(novosFiltros);
              const primeiroDaNovaFila = pedidosState.find((p) => {
                if (!correspondeFiltroDataPedido(p, filtroDataPedido)) return false;
                if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
                if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
                if (!correspondeFiltrosAvancadosWebri(p, novosFiltros)) return false;
                if (filtroConferencia === "CONFERIDO")
                  return Boolean(p.conferidoPeloEscrevente);
                if (filtroConferencia === "DEVOLVIDO")
                  return Boolean(p.devolvidoPeloEscrevente);
                if (filtroConferencia === "NAO_CONFERIDO") {
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
            pedidosBase={pedidosState}
            pedidosFiltrados={pedidosFilaAtiva}
            compacto={true}
            abertoPorPadrao={true}
          />
        </div>

        {/* Corpo Principal: Card do Pedido ocupando o máximo da tela + Barra Lateral Direita compacta (~196px) */}
        <div className="flex flex-col lg:flex-row gap-2.5 pt-2 flex-1 min-h-0">
          <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-white/15 bg-[#121826] flex flex-col h-full min-h-0">
            {/* Barra de Zoom, Frente e Verso (Duplex) e Exportação PDF (Centralizada) */}
            <div className="min-h-9 py-1 px-3 bg-[#090E1B] border-b border-white/10 flex flex-wrap items-center justify-center gap-2.5 text-xs shrink-0">
              {!tresLinhasVisiveis && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={irParaPedidoAnterior}
                    disabled={indiceFocoNaFila <= 0}
                    className="h-7 px-2 rounded-lg border border-cyan-400/50 bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-35 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                    title="Pedido anterior na fila"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={irParaProximoPedido}
                    disabled={
                      indiceFocoNaFila < 0 || indiceFocoNaFila >= pedidosFilaAtiva.length - 1
                    }
                    className="h-7 px-2 rounded-lg border border-cyan-400/50 bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-35 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                    title="Próximo Pedido na fila"
                  >
                    <span>Próximo</span>
                    <ChevronRight className="w-3.5 h-3.5 text-cyan-300" />
                  </button>
                  {indiceFocoNaFila >= 0 && (
                    <span className="text-[11px] text-slate-300 font-mono font-bold px-1 shrink-0">
                      ({indiceFocoNaFila + 1}/{pedidosFilaAtiva.length})
                    </span>
                  )}
                  {pedidoEmFoco && (
                    <div className="inline-flex h-7 items-center rounded-lg border border-white/15 bg-[#080D1A] p-0.5 text-[10px] whitespace-nowrap ml-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModoVisor("PEDIDO_EM_FOCO");
                          setPaginaPdfFoco(1);
                        }}
                        className={`px-2 py-0.5 rounded-md font-extrabold cursor-pointer transition ${
                          modoVisor === "PEDIDO_EM_FOCO" && paginaPdfFoco === 1
                            ? "bg-cyan-600 text-white"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        FRENTE
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModoVisor("PEDIDO_EM_FOCO");
                          setPaginaPdfFoco(2);
                        }}
                        className={`px-2 py-0.5 rounded-md font-extrabold cursor-pointer transition ${
                          modoVisor === "PEDIDO_EM_FOCO" && paginaPdfFoco === 2
                            ? "bg-cyan-600 text-white"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        VERSO
                      </button>
                    </div>
                  )}
                  <span className="text-slate-600 mx-0.5">|</span>
                </div>
              )}

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

          {/* ── BARRA LATERAL DIREITA ELEGANTE (288px): CONFERIDO / DEVOLVIDO / CONTRADITÓRIO COM ROLAGEM COMPLETA ── */}
          {barraLateralDireitaAberta && (
            <aside className="w-full lg:w-[288px] shrink-0 flex flex-col min-h-0 h-full">
              <div className="rounded-2xl border border-emerald-500/35 bg-[#080D1A] p-3 flex flex-col gap-2.5 shadow-xl h-full min-h-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
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
                    {/* Status Visual Atual da Conferência / Devolução (fixo no topo) */}
                    <div className="shrink-0">
                      {pedidoEmFoco.conferidoPeloEscrevente ? (
                        <div className="rounded-xl border border-emerald-400/60 bg-emerald-950/35 p-2.5 text-center space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-black tracking-wide">
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
                        <div className="rounded-xl border border-rose-400/60 bg-rose-950/35 p-2.5 text-center space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-black tracking-wide">
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
                        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-2.5 text-center space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-black tracking-wide">
                            <Clock3 className="w-3.5 h-3.5 text-amber-300" />
                            NÃO CONFERIDO
                          </div>
                          <p className="text-[11px] font-semibold text-slate-300 leading-tight">
                            Pedido {pedidoEmFoco.numeroPedido} •{" "}
                            <span className="text-indigo-300 font-bold">
                              {pedidoEmFoco.origem === "ONR" ? "ONR" : "PRESENCIAL"}
                            </span>
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
                    </div>

                    {/* Prenotações em Contraditório vinculadas ao Pedido (área rolável para exibir 100% das prenotações e seus dados) */}
                    {obterPrenotacoesContraditorioDoPedido(pedidoEmFoco).length > 0 && (
                      <div className="rounded-xl border border-amber-400/55 bg-amber-950/30 p-2.5 flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center justify-between shrink-0">
                          <span>Prenotação em Contraditório</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/50 text-amber-200 font-mono text-[10px]">
                            {obterPrenotacoesContraditorioDoPedido(pedidoEmFoco).length}
                          </span>
                        </div>
                        <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
                          {obterPrenotacoesContraditorioDoPedido(pedidoEmFoco).map(
                            (pr, idxPr) => {
                              const ehHashHex = /^[0-9A-F]{12}$/i.test(
                                (pr.naturezaTitulo || "").trim()
                              );
                              return (
                                <div
                                  key={`${pr.numeroPrenotacao}-${idxPr}`}
                                  className="rounded-xl bg-[#070B14]/95 border border-amber-400/35 p-2.5 space-y-1.5 shadow-inner"
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

                                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-300">
                                    <span>Entrada:</span>
                                    <span className="font-bold text-white">
                                      {pr.dataApresentacaoBr || "—"}
                                    </span>
                                  </div>

                                  <div className="text-[11px] font-extrabold text-amber-100 leading-snug">
                                    {pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"}
                                  </div>

                                  {pr.naturezaTitulo &&
                                    pr.naturezaTitulo !== pr.tipoPrenotacaoDescricao &&
                                    !ehHashHex && (
                                      <div className="text-[10px] text-slate-200 leading-snug break-words bg-white/[0.04] rounded-lg px-2 py-1 border border-white/10">
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

                                  <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-1 text-[10px]">
                                    <span className="text-slate-400 font-mono">Situação:</span>
                                    <span
                                      className={`font-bold text-right leading-tight ${
                                        pr.emProcessamentoAtoNaMatricula
                                          ? "text-rose-300"
                                          : "text-emerald-300"
                                      }`}
                                    >
                                      {pr.emProcessamentoAtoNaMatricula
                                        ? "ATO EM PROCESSAMENTO"
                                        : pr.etapaAtual || "Em tramitação"}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ações: CONFERIDO, DEVOLVIDO e Estornar (sempre visíveis na base do card) */}
                    <div className="space-y-1.5 shrink-0 pt-1">
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
