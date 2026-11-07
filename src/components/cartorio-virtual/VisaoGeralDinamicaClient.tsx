"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ClipboardCheck,
  PauseCircle,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Printer,
  Search,
  ListChecks,
  ArrowRight,
  Filter,
  Eye,
  EyeOff,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { ResumoVisaoGeralCartorioVirtual } from "@/lib/cartorio-virtual/repository";
import {
  correspondeFiltroTipoCertidao,
  extrairEspeciesDistintasPedidos,
  obterPrenotacoesContraditorioDoPedido,
  type EstadoOperacionalPedido,
  type FiltroConferenciaEscrevente,
  type FiltroTipoCertidaoValor,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";
import {
  LinkMatriculaLv2,
  LinkPrenotacaoWebri,
  renderizarTextoComLinksMatriculaLv2,
} from "./LinkMatriculaLv2";
import { CardSelecaoLotePedidos } from "@/components/cartorio-virtual/CardSelecaoLotePedidos";

export type FiltroKpiVisaoGeral =
  | "TODOS"
  | "REVISAO"
  | "ATUALIZACAO"
  | "DEVOLVIDO";

export type ColunaOrdenacaoPedidos =
  | "PEDIDO"
  | "DATA"
  | "CONFERENCIA"
  | "ESPECIE"
  | "PRENOTACAO"
  | "SOLICITANTE"
  | "SITUACAO"
  | "VERIFICACAO";

const LABELS_KPI: Record<FiltroKpiVisaoGeral, string> = {
  TODOS: "Todos os Pedidos",
  REVISAO: "Pedidos em Revisão & Contraditório",
  ATUALIZACAO: "Pedidos Aguardando Atualização de Matrícula",
  DEVOLVIDO: "Pedidos Devolvidos (DEVOLVIDO)",
};

export function VisaoGeralDinamicaClient({
  resumo,
  pedidos,
  contagemAnotacoesPorPedido,
  kpiInicial = "TODOS",
  conferenciaInicial = "TODOS",
  buscaInicial = "",
}: {
  resumo: ResumoVisaoGeralCartorioVirtual;
  pedidos: PedidoCertidaoDetalheDTO[];
  contagemAnotacoesPorPedido: Record<string, number>;
  kpiInicial?: FiltroKpiVisaoGeral;
  conferenciaInicial?: FiltroConferenciaEscrevente;
  buscaInicial?: string;
}) {
  const [kpiAtivo, setKpiAtivo] = useState<FiltroKpiVisaoGeral>(kpiInicial);
  const [filtroConferencia, setFiltroConferencia] =
    useState<FiltroConferenciaEscrevente>(conferenciaInicial);
  const [busca, setBusca] = useState<string>(buscaInicial);
  const [filtroDataPedido, setFiltroDataPedido] = useState<string>("TODAS");
  const [filtroOrigem, setFiltroOrigem] = useState<"TODAS" | "ONR" | "BALCAO">("TODAS");
  const [filtroTipoCertidao, setFiltroTipoCertidao] =
    useState<FiltroTipoCertidaoValor>("TODOS");
  const [colunaOrdenacao, setColunaOrdenacao] =
    useState<ColunaOrdenacaoPedidos>("PEDIDO");
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<"asc" | "desc">("asc");
  const [mostrarCardLote, setMostrarCardLote] = useState<boolean>(false);

  const alternarOrdenacaoColuna = (col: ColunaOrdenacaoPedidos) => {
    if (colunaOrdenacao === col) {
      setDirecaoOrdenacao((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setColunaOrdenacao(col);
      setDirecaoOrdenacao("asc");
    }
  };
  const [exibirTodosDocumentosCompletos, setExibirTodosDocumentosCompletos] =
    useState<boolean>(false);
  const [documentosReveladosPorPedido, setDocumentosReveladosPorPedido] = useState<
    Record<string, boolean>
  >({});

  const alternarDocumentoPedido = (pedidoId: string) => {
    setDocumentosReveladosPorPedido((prev) => ({
      ...prev,
      [pedidoId]: !(prev[pedidoId] ?? exibirTodosDocumentosCompletos),
    }));
  };

  const alternarTodosDocumentos = () => {
    const proximo = !exibirTodosDocumentosCompletos;
    setExibirTodosDocumentosCompletos(proximo);
    setDocumentosReveladosPorPedido({});
  };

  const secaoListagemRef = useRef<HTMLDivElement | null>(null);

  const rolarParaListagem = () => {
    requestAnimationFrame(() => {
      secaoListagemRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const selecionarCardKpi = (novoKpi: FiltroKpiVisaoGeral) => {
    setKpiAtivo(novoKpi);
    rolarParaListagem();
  };

  const selecionarFiltroConferencia = (novoStatus: FiltroConferenciaEscrevente) => {
    setFiltroConferencia(novoStatus);
    rolarParaListagem();
  };

  const totalDevolvidos = useMemo(
    () => pedidos.filter((p) => Boolean(p.devolvidoPeloEscrevente)).length,
    [pedidos]
  );

  const baseParaDatas = useMemo(() => {
    return pedidos.filter((p) => {
      if (!correspondeAoKpi(p, kpiAtivo)) return false;
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      return true;
    });
  }, [pedidos, kpiAtivo, filtroOrigem, filtroTipoCertidao, filtroConferencia]);

  const datasPedidoDisponiveis = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of baseParaDatas) {
      if (p.dataPedidoBr) {
        mapa.set(p.dataPedidoBr, (mapa.get(p.dataPedidoBr) || 0) + 1);
      }
    }
    return Array.from(mapa.entries()).map(([dataBr, qtd]) => ({ dataBr, qtd }));
  }, [baseParaDatas]);

  const baseParaTiposCertidao = useMemo(() => {
    return pedidos.filter((p) => {
      if (!correspondeAoKpi(p, kpiAtivo)) return false;
      if (filtroDataPedido !== "TODAS" && p.dataPedidoBr !== filtroDataPedido) return false;
      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) return false;
      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) return false;
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) return false;
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      )
        return false;
      return true;
    });
  }, [pedidos, kpiAtivo, filtroDataPedido, filtroOrigem, filtroConferencia]);

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

  useEffect(() => {
    if (
      filtroTipoCertidao !== "TODOS" &&
      !opcoesTipoCertidaoDinamicas.some((op) => op.valor === filtroTipoCertidao)
    ) {
      setFiltroTipoCertidao("TODOS");
    }
  }, [filtroTipoCertidao, opcoesTipoCertidaoDinamicas]);

  useEffect(() => {
    if (
      filtroDataPedido !== "TODAS" &&
      !datasPedidoDisponiveis.some((d) => d.dataBr === filtroDataPedido)
    ) {
      setFiltroDataPedido("TODAS");
    }
  }, [filtroDataPedido, datasPedidoDisponiveis]);

  const contagensOrigem = useMemo(() => {
    const base = pedidos.filter((p) => {
      if (!correspondeAoKpi(p, kpiAtivo)) return false;
      if (filtroDataPedido !== "TODAS" && p.dataPedidoBr !== filtroDataPedido) return false;
      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) return false;
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
  }, [pedidos, kpiAtivo, filtroDataPedido, filtroTipoCertidao, filtroConferencia]);

  const contagensConferenciaNoKpi = useMemo(() => {
    const baseKpi = pedidos.filter(
      (p) =>
        correspondeAoKpi(p, kpiAtivo) &&
        (filtroDataPedido === "TODAS" || p.dataPedidoBr === filtroDataPedido) &&
        (filtroOrigem === "TODAS" || p.origem === filtroOrigem) &&
        correspondeFiltroTipoCertidao(p, filtroTipoCertidao)
    );
    const conferidos = baseKpi.filter((p) => Boolean(p.conferidoPeloEscrevente)).length;
    const devolvidos = baseKpi.filter((p) => Boolean(p.devolvidoPeloEscrevente)).length;
    return {
      total: baseKpi.length,
      conferidos,
      devolvidos,
      naoConferidos: Math.max(0, baseKpi.length - conferidos - devolvidos),
    };
  }, [pedidos, kpiAtivo, filtroDataPedido, filtroOrigem, filtroTipoCertidao]);

  const pedidosFiltrados = useMemo(() => {
    const q = busca.trim().replace(/^#+/, "").toLowerCase();
    const filtrados = pedidos.filter((p) => {
      if (!correspondeAoKpi(p, kpiAtivo)) return false;

      if (filtroDataPedido !== "TODAS" && p.dataPedidoBr !== filtroDataPedido) {
        return false;
      }

      if (filtroOrigem !== "TODAS" && p.origem !== filtroOrigem) {
        return false;
      }

      if (!correspondeFiltroTipoCertidao(p, filtroTipoCertidao)) {
        return false;
      }

      if (filtroConferencia === "CONFERIDO" && !p.conferidoPeloEscrevente) {
        return false;
      }
      if (filtroConferencia === "DEVOLVIDO" && !p.devolvidoPeloEscrevente) {
        return false;
      }
      if (
        filtroConferencia === "NAO_CONFERIDO" &&
        (Boolean(p.conferidoPeloEscrevente) || Boolean(p.devolvidoPeloEscrevente))
      ) {
        return false;
      }

      if (q) {
        const bateNumero =
          p.numeroPedido.toLowerCase().includes(q) ||
          (p.protocoloExterno || "").toLowerCase().includes(q);
        const bateNome =
          p.requerente.nome.toLowerCase().includes(q) ||
          (p.requerente.documentoFormatado || "").toLowerCase().includes(q) ||
          (p.requerente.documentoMascarado || "").toLowerCase().includes(q);
        const bateEspecie = p.especieSolicitada.toLowerCase().includes(q);
        const bateMat = p.itens.some((it) =>
          String(it.numeroMatricula || "").toLowerCase().includes(q)
        );
        const batePrenotacao = obterPrenotacoesContraditorioDoPedido(p).some(
          (pr) =>
            pr.numeroPrenotacao.toLowerCase().includes(q) ||
            (pr.protocoloMagnetico || "").toLowerCase().includes(q) ||
            (pr.tipoPrenotacaoDescricao || "").toLowerCase().includes(q) ||
            pr.naturezaTitulo.toLowerCase().includes(q)
        );
        if (!bateNumero && !bateNome && !bateEspecie && !bateMat && !batePrenotacao)
          return false;
      }

      return true;
    });

    const fator = direcaoOrdenacao === "asc" ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      switch (colunaOrdenacao) {
        case "PEDIDO": {
          const na = Number(a.numeroPedido.replace(/\D/g, "")) || 0;
          const nb = Number(b.numeroPedido.replace(/\D/g, "")) || 0;
          return (na - nb) * fator;
        }
        case "DATA": {
          const da = `${a.dataPedidoIso || a.dataPedidoBr} ${a.horaPedidoBr}`;
          const db = `${b.dataPedidoIso || b.dataPedidoBr} ${b.horaPedidoBr}`;
          return da.localeCompare(db, "pt-BR") * fator;
        }
        case "CONFERENCIA": {
          const peso = (p: PedidoCertidaoDetalheDTO) =>
            p.conferidoPeloEscrevente ? 1 : p.devolvidoPeloEscrevente ? 2 : 3;
          return (peso(a) - peso(b)) * fator;
        }
        case "ESPECIE": {
          const ea = `${a.especieSolicitada} ${a.itens[0]?.numeroMatricula || ""}`;
          const eb = `${b.especieSolicitada} ${b.itens[0]?.numeroMatricula || ""}`;
          return ea.localeCompare(eb, "pt-BR") * fator;
        }
        case "PRENOTACAO": {
          const pa = obterPrenotacoesContraditorioDoPedido(a)[0]?.numeroPrenotacao || "";
          const pb = obterPrenotacoesContraditorioDoPedido(b)[0]?.numeroPrenotacao || "";
          return pa.localeCompare(pb, "pt-BR", { numeric: true }) * fator;
        }
        case "SOLICITANTE":
          return a.requerente.nome.localeCompare(b.requerente.nome, "pt-BR") * fator;
        case "SITUACAO": {
          const sa =
            a.estadoOperacional === "EM_REVISAO_HUMANA"
              ? "Aguardando revisão do Escrevente"
              : a.estadoOperacionalLabel;
          const sb =
            b.estadoOperacional === "EM_REVISAO_HUMANA"
              ? "Aguardando revisão do Escrevente"
              : b.estadoOperacionalLabel;
          return sa.localeCompare(sb, "pt-BR") * fator;
        }
        case "VERIFICACAO": {
          const ma = (a.marcacoesDocumento || []).length;
          const mb = (b.marcacoesDocumento || []).length;
          if (ma !== mb) return (mb - ma) * fator;
          return a.numeroPedido.localeCompare(b.numeroPedido, "pt-BR", { numeric: true }) * fator;
        }
        default:
          return 0;
      }
    });
  }, [
    pedidos,
    kpiAtivo,
    filtroDataPedido,
    filtroOrigem,
    filtroTipoCertidao,
    filtroConferencia,
    busca,
    colunaOrdenacao,
    direcaoOrdenacao,
  ]);

  const linkFilaNaCentral = useMemo(() => {
    const qs = new URLSearchParams();
    if (filtroConferencia !== "TODOS") qs.set("conferencia", filtroConferencia);
    else if (kpiAtivo === "DEVOLVIDO") qs.set("conferencia", "DEVOLVIDO");
    if (filtroDataPedido !== "TODAS") qs.set("data", filtroDataPedido);
    if (filtroOrigem !== "TODAS") qs.set("origem", filtroOrigem);
    if (filtroTipoCertidao !== "TODOS") qs.set("tipo", filtroTipoCertidao);
    if (kpiAtivo === "REVISAO") qs.set("estado", "EM_REVISAO_HUMANA");
    if (kpiAtivo === "ATUALIZACAO") qs.set("estado", "AGUARDANDO_ATUALIZACAO_MATRICULA");
    if (busca.trim()) qs.set("busca", busca.trim());
    const str = qs.toString();
    return str ? `/cartorio-virtual/impressao?${str}` : "/cartorio-virtual/impressao";
  }, [filtroConferencia, filtroDataPedido, filtroOrigem, filtroTipoCertidao, kpiAtivo, busca]);

  const corEstadoBadge = (est: EstadoOperacionalPedido) => {
    if (est === "APTO_EMISSAO")
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (est === "EM_REVISAO_HUMANA")
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    if (est === "AGUARDANDO_ATUALIZACAO_MATRICULA")
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  };

  const renderIconeOrdenacao = (col: ColunaOrdenacaoPedidos) => {
    if (colunaOrdenacao !== col) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
    return direcaoOrdenacao === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
    );
  };

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTRO CONFERIDO / NÃO CONFERIDO + BUSCA RÁPIDA E SELEÇÃO EM LOTE (CENTRALIZADA E ADAPTÁVEL AO MONITOR VERTICAL) */}
      <div className="rounded-[24px] border border-emerald-500/25 bg-gradient-to-br from-[#0B1224] via-[#090E1B] to-[#0B1020] px-3 py-2.5 space-y-2">
        {/* Linha 1: somente os 3 primeiros filtros (Data do Pedido, ONR/Presencial e Tipos de Certidões) */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Card / Seletor DATA DO PEDIDO no lado esquerdo */}
          <div className="h-9 px-3 rounded-xl border border-cyan-400/55 bg-[#080D1A] inline-flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-cyan-200 whitespace-nowrap">
              DATA DO PEDIDO:
            </span>
            <select
              aria-label="Filtrar por Data do Pedido"
              value={filtroDataPedido}
              onChange={(e) => setFiltroDataPedido(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-extrabold text-white focus:outline-none cursor-pointer"
            >
              <option value="TODAS" className="bg-[#080D1A] text-white">
                Todas ({baseParaDatas.length})
              </option>
              {datasPedidoDisponiveis.map((d) => (
                <option key={d.dataBr} value={d.dataBr} className="bg-[#080D1A] text-white">
                  {d.dataBr} ({d.qtd})
                </option>
              ))}
            </select>
          </div>

          {/* Seletor ONR / PRESENCIAL idêntico à Verificação do Escrevente */}
          <select
            aria-label="Filtrar por Origem do Pedido (ONR ou Presencial)"
            value={filtroOrigem}
            onChange={(e) =>
              setFiltroOrigem(e.target.value as "TODAS" | "ONR" | "BALCAO")
            }
            className="h-9 px-3 rounded-xl bg-[#080D1A] border border-indigo-400/55 text-xs sm:text-sm font-extrabold text-indigo-200 cursor-pointer shrink-0"
            title="Filtrar pedidos por origem: ONR ou Presencial"
          >
            <option value="TODAS" className="bg-[#080D1A] text-white">
              ONR / PRESENCIAL ({contagensOrigem.todas})
            </option>
            <option value="ONR" className="bg-[#080D1A] text-white">
              ONR ({contagensOrigem.onr})
            </option>
            <option value="BALCAO" className="bg-[#080D1A] text-white">
              PRESENCIAL ({contagensOrigem.presencial})
            </option>
          </select>

          {/* Seletor dinâmico TIPOS DE CERTIDÕES idêntico à Verificação do Escrevente */}
          <select
            aria-label="Filtrar por Tipo de Certidão"
            value={filtroTipoCertidao}
            onChange={(e) => setFiltroTipoCertidao(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#080D1A] border border-cyan-400/45 text-xs sm:text-sm font-extrabold text-white cursor-pointer shrink-0"
          >
            {opcoesTipoCertidaoDinamicas.map((op) => (
              <option
                key={op.valor}
                value={op.valor}
                className="bg-[#080D1A] text-white"
              >
                {op.rotulo}
              </option>
            ))}
          </select>
        </div>

        {/* Linha 2: Pesquisa + Conferência + Imprimir + Verificação do Escrevente */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <div className="relative w-56 shrink-0">
            <Search className="w-4 h-4 text-cyan-300 stroke-[2.5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar Pedido, Prenotação, ONR..."
              className="w-full h-9 pl-9 pr-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 focus:bg-[#080D1A] border-2 border-cyan-400/70 focus:border-cyan-300 text-xs text-white font-semibold placeholder:text-cyan-100/80 focus:outline-none transition"
            />
          </div>

          <button
            type="button"
            onClick={() => selecionarFiltroConferencia("TODOS")}
            className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
              filtroConferencia === "TODOS"
                ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/20"
                : "bg-[#080D1A] border-white/15 text-slate-200 hover:bg-white/[0.06]"
            }`}
          >
            Todos ({contagensConferenciaNoKpi.total})
          </button>

          <button
            type="button"
            onClick={() => selecionarFiltroConferencia("CONFERIDO")}
            className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
              filtroConferencia === "CONFERIDO"
                ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/25"
                : "bg-emerald-500/10 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            CONFERIDO ({contagensConferenciaNoKpi.conferidos})
          </button>

          <button
            type="button"
            onClick={() => selecionarFiltroConferencia("DEVOLVIDO")}
            className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
              filtroConferencia === "DEVOLVIDO"
                ? "bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/25"
                : "bg-rose-500/10 border-rose-500/35 text-rose-200 hover:bg-rose-500/20"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            DEVOLVIDO ({contagensConferenciaNoKpi.devolvidos})
          </button>

          <button
            type="button"
            onClick={() => selecionarFiltroConferencia("NAO_CONFERIDO")}
            className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
              filtroConferencia === "NAO_CONFERIDO"
                ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/25"
                : "bg-amber-500/10 border-amber-500/35 text-amber-200 hover:bg-amber-500/20"
            }`}
          >
            <Clock3 className="w-3.5 h-3.5" />
            NÃO CONFERIDO ({contagensConferenciaNoKpi.naoConferidos})
          </button>

          <button
            type="button"
            onClick={() => setMostrarCardLote((v) => !v)}
            className="h-9 px-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-300" />
            {mostrarCardLote ? "Ocultar IMPRIMIR" : "IMPRIMIR"}
          </button>

          <Link
            href={linkFilaNaCentral}
            className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Verificação do Escrevente ({pedidosFiltrados.length})
          </Link>
        </div>
      </div>

      {mostrarCardLote && (
        <CardSelecaoLotePedidos
          pedidos={pedidos}
          contagemAnotacoesPorPedido={contagemAnotacoesPorPedido}
        />
      )}

      {/* 3. LISTAGEM DINÂMICA DOS PEDIDOS RESPECTIVOS */}
      <div
        id="listagem-pedidos"
        ref={secaoListagemRef}
        className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 overflow-hidden scroll-mt-4"
      >
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white">
                {LABELS_KPI[kpiAtivo]} ({pedidosFiltrados.length})
              </h2>
              {filtroConferencia === "CONFERIDO" && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border border-emerald-400/50 bg-emerald-500/20 text-emerald-200">
                  ✓ CONFERIDO
                </span>
              )}
              {filtroConferencia === "DEVOLVIDO" && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border border-rose-400/50 bg-rose-500/20 text-rose-200">
                  ↩ DEVOLVIDO
                </span>
              )}
              {filtroConferencia === "NAO_CONFERIDO" && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border border-amber-400/50 bg-amber-500/20 text-amber-200">
                  NÃO CONFERIDO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Clique em qualquer Pedido para abrir o documento em tela cheia, grifar, adicionar texto, conferir e imprimir em Frente e Verso.
            </p>
          </div>

          {(kpiAtivo !== "TODOS" ||
            filtroDataPedido !== "TODAS" ||
            filtroOrigem !== "TODAS" ||
            filtroTipoCertidao !== "TODOS" ||
            filtroConferencia !== "TODOS" ||
            busca.trim() !== "") && (
            <button
              type="button"
              onClick={() => {
                setKpiAtivo("TODOS");
                setFiltroDataPedido("TODAS");
                setFiltroOrigem("TODAS");
                setFiltroTipoCertidao("TODOS");
                setFiltroConferencia("TODOS");
                setBusca("");
              }}
              className="px-3 py-1.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Nenhum Pedido encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080D1A] text-slate-100 uppercase font-mono text-[11px] xl:text-xs font-extrabold border-b border-white/15">
                <tr>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("PEDIDO")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Pedido"
                    >
                      <span>Pedido</span>
                      {renderIconeOrdenacao("PEDIDO")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("DATA")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Data do Pedido"
                    >
                      <span>Data do Pedido</span>
                      {renderIconeOrdenacao("DATA")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("CONFERENCIA")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Conferência"
                    >
                      <span>Conferência</span>
                      {renderIconeOrdenacao("CONFERENCIA")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("ESPECIE")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Espécie & Critério"
                    >
                      <span>Espécie & Critério</span>
                      {renderIconeOrdenacao("ESPECIE")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("PRENOTACAO")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Prenotação (Contraditório)"
                    >
                      <span>Prenotação (Contraditório)</span>
                      {renderIconeOrdenacao("PRENOTACAO")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoColuna("SOLICITANTE")}
                        className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                        title="Ordenar por Solicitante"
                      >
                        <span>Solicitante</span>
                        {renderIconeOrdenacao("SOLICITANTE")}
                      </button>
                      <button
                        type="button"
                        onClick={alternarTodosDocumentos}
                        className="px-1.5 py-0.5 rounded-md border border-cyan-500/35 bg-cyan-500/12 hover:bg-cyan-500/25 text-cyan-200 text-[9px] font-bold normal-case inline-flex items-center gap-1 cursor-pointer transition"
                        title={
                          exibirTodosDocumentosCompletos
                            ? "Ocultar números completos de CPF/CNPJ"
                            : "Exibir números completos de CPF/CNPJ de todos os solicitantes"
                        }
                      >
                        {exibirTodosDocumentosCompletos ? (
                          <>
                            <EyeOff className="w-3 h-3 text-cyan-300" />
                            Ocultar CPF/CNPJ
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-cyan-300" />
                            Ver CPF/CNPJ
                          </>
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-2.5 py-3">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("SITUACAO")}
                      className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-left"
                      title="Ordenar por Situação"
                    >
                      <span>Situação</span>
                      {renderIconeOrdenacao("SITUACAO")}
                    </button>
                  </th>
                  <th className="px-2.5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => alternarOrdenacaoColuna("VERIFICACAO")}
                      className="inline-flex items-center justify-end gap-1 hover:text-cyan-300 cursor-pointer uppercase font-extrabold text-right ml-auto"
                      title="Ordenar por Verificação do Escrevente"
                    >
                      <span>Verificação do Escrevente</span>
                      {renderIconeOrdenacao("VERIFICACAO")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {pedidosFiltrados.map((p) => {
                  const qtdMarcacoes = (p.marcacoesDocumento || []).length;
                  const prenotacoesContraditorio = obterPrenotacoesContraditorioDoPedido(p);
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-2.5 py-2.5">
                        <div className="font-mono font-bold text-sm text-white">
                          {p.numeroPedido}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.origem === "ONR" ? "ONR" : "PRESENCIAL"}{" "}
                          {p.protocoloExterno ? `• ${p.protocoloExterno}` : ""}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="inline-flex flex-col rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1">
                          <span className="font-mono font-bold text-[11px] text-cyan-200 flex items-center gap-1 whitespace-nowrap">
                            <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                            {p.dataPedidoBr}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {p.horaPedidoBr}
                          </span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {p.conferidoPeloEscrevente ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-emerald-400/60 bg-emerald-500/20 text-emerald-200 text-[10px] font-black tracking-wide whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                              CONFERIDO
                            </span>
                            {p.conferidoPorNome && (
                              <div className="text-[9px] text-emerald-300/80">
                                {p.conferidoPorNome} • {p.conferidoEmBr}
                              </div>
                            )}
                          </div>
                        ) : p.devolvidoPeloEscrevente ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-rose-400/60 bg-rose-500/20 text-rose-200 text-[10px] font-black tracking-wide whitespace-nowrap">
                              <RotateCcw className="w-3 h-3 text-rose-300" />
                              DEVOLVIDO
                            </span>
                            {p.devolvidoPorNome && (
                              <div className="text-[9px] text-rose-300/80">
                                {p.devolvidoPorNome} • {p.devolvidoEmBr}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-200 text-[10px] font-bold whitespace-nowrap">
                            <Clock3 className="w-3 h-3" />
                            NÃO CONFERIDO
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="font-semibold text-slate-200 leading-tight">
                          {p.especieSolicitada}
                        </div>
                        <div className="text-[11px] text-cyan-300/90 font-mono">
                          {p.itens.length > 1 ? (
                            <span>
                              {p.itens.length} itens (Mat.{" "}
                              {p.itens[0]?.numeroMatricula ? (
                                <LinkMatriculaLv2
                                  numeroMatricula={p.itens[0].numeroMatricula}
                                  variante="dark"
                                />
                              ) : (
                                "—"
                              )}
                              ...)
                            </span>
                          ) : p.itens[0]?.numeroMatricula ? (
                            <span>
                              Matrícula nº{" "}
                              <LinkMatriculaLv2
                                numeroMatricula={p.itens[0].numeroMatricula}
                                variante="dark"
                              />
                            </span>
                          ) : (
                            renderizarTextoComLinksMatriculaLv2(p.criterioSolicitacao, "dark")
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {prenotacoesContraditorio.length > 0 ? (
                          <div className="space-y-1">
                            {prenotacoesContraditorio.map((pr, idxPr) => (
                              <div
                                key={`${pr.numeroPrenotacao}-${idxPr}`}
                                title="Origem SQL: tblWRIRecepcao, tblWRITitulos, tblWRICertidaoResultadoContraditorio, tblWRITipoPrenotacao, tblWRITitulosReal, tblWRIReal, tblWRIImovelBase, tblWRIImovel"
                                className={`rounded-lg border px-2 py-1 ${
                                  pr.emProcessamentoAtoNaMatricula
                                    ? "border-rose-400/50 bg-rose-500/12 text-rose-200"
                                    : "border-amber-400/50 bg-amber-500/12 text-amber-200"
                                }`}
                              >
                                <div className="font-mono font-extrabold text-[11px] flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-baseline gap-1">
                                    <span>Prenotação nº</span>
                                    <LinkPrenotacaoWebri
                                      numeroPrenotacao={pr.numeroPrenotacao}
                                      variante="dark"
                                    />
                                  </span>
                                  {pr.livroContraditorio && (
                                    <span className="px-1 py-0.2 rounded bg-black/30 text-[10px] text-cyan-300">
                                      {renderizarTextoComLinksMatriculaLv2(
                                        pr.livroContraditorio,
                                        "dark"
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-300 leading-tight">
                                  {pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"} •{" "}
                                  {pr.naturezaTitulo}
                                  {pr.protocoloMagnetico ? ` • ${pr.protocoloMagnetico}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : p.ultimaConferencia?.contraditorioStatus === "NADA_CONSTA" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                            Nada Consta (Livre)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Verificação manual
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="text-slate-200 font-medium leading-tight" title={p.requerente.nome}>
                          {p.requerente.nome}
                        </div>
                        <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <span>
                            {p.requerente.tipoDocumento}:{" "}
                            {(documentosReveladosPorPedido[p.id] ??
                            exibirTodosDocumentosCompletos)
                              ? p.requerente.documentoFormatado ||
                                p.requerente.documentoMascarado ||
                                "—"
                              : p.requerente.documentoMascarado ||
                                p.requerente.documentoFormatado ||
                                "—"}
                          </span>
                          {p.requerente.documentoFormatado && (
                            <button
                              type="button"
                              onClick={() => alternarDocumentoPedido(p.id)}
                              className="p-0.5 rounded hover:bg-white/10 text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 cursor-pointer transition"
                              title={
                                (documentosReveladosPorPedido[p.id] ??
                                exibirTodosDocumentosCompletos)
                                  ? "Ocultar número do documento"
                                  : "Ver número completo do documento"
                              }
                            >
                              {(documentosReveladosPorPedido[p.id] ??
                              exibirTodosDocumentosCompletos) ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border leading-tight ${corEstadoBadge(
                            p.estadoOperacional
                          )}`}
                        >
                          {p.estadoOperacional === "EM_REVISAO_HUMANA"
                            ? "Aguardando revisão do Escrevente"
                            : p.estadoOperacionalLabel}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {qtdMarcacoes > 0 && (
                            <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-bold whitespace-nowrap">
                              {qtdMarcacoes} marc.
                            </span>
                          )}
                          <Link
                            href={`/cartorio-virtual/impressao?pedido=${p.numeroPedido}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 font-bold text-[11px] whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Abrir
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function correspondeAoKpi(
  p: PedidoCertidaoDetalheDTO,
  kpi: FiltroKpiVisaoGeral
): boolean {
  switch (kpi) {
    case "REVISAO":
      return p.estadoOperacional === "EM_REVISAO_HUMANA";
    case "ATUALIZACAO":
      return (
        p.estadoOperacional === "AGUARDANDO_ATUALIZACAO_MATRICULA" ||
        Boolean(p.pausadoPorAtoProcessamento)
      );
    case "DEVOLVIDO":
      return Boolean(p.devolvidoPeloEscrevente);
    case "TODOS":
    default:
      return true;
  }
}

