"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  Layers,
  AlertTriangle,
  Copy,
  Check,
  X,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Users,
  CheckCircle2,
  TrendingDown,
  Printer,
  ShieldCheck,
  Building2,
  User,
  ArrowRight,
  Eye,
  RefreshCw,
} from "lucide-react";

// Tipagem dos KPIs e dados
interface KpiData {
  prenotacoes: number;
  totalPrenotacoesMes?: number;
  totalProducaoGeral?: number;
  totalNaoRealizados?: number;
  totalCanceladas?: number;
  totalEmTramite?: number;
  quantidadeErros: number;
  percentualErroGeral: number;
  taxaLimiteOficial?: number;
  totalCartorioMes?: number;
  totalOnrMes?: number;
  totalRecepcaoMes?: number;
  totalPrenotacoesPeriodoReal?: number;
}

interface ColaboradorItem {
  nome: string;
  departamento: string;
  atividade: string;
  origem: string;
  erros: number;
  producao: number;
  percentualErro: number;
  limite: number;
  dentroLimite: boolean;
  errosPorTipo: { telaRecepcao: number; pessoal: number; real: number };
}

interface EventoItem {
  id: string;
  prenotacao: string;
  responsavel: string;
  dataEntrada: string;
  dataRetorno: string;
  motivoOriginal: string;
  tipoRetorno: "TELA_RECEPCAO" | "PESSOAL" | "REAL";
  origem: "ONR" | "RECEPCAO";
  categoriaErro: string;
}

interface TopCausaItem {
  causa: string;
  quantidade: number;
  percentual: number;
}

interface EvolucaoItem {
  competencia: string;
  mes: string;
  percentualErro: number;
  totalErros: number;
  prenotacoes: number;
}

interface ProtocoloFaltanteItem {
  numeroPrenotacao: string;
  status: "CANCELADA" | "EM_TRAMITE";
  dataPrenotacao: string;
  departamento: string;
  origem: "ONR" | "RECEPCAO";
}

// 5 meses do gráfico com cores da identidade visual
const MESES_GRAFICO_EVOLUCAO = [
  {
    key: "2026-06",
    label: "Jun/26",
    shortLabel: "Jun",
    value: 0.8,
    colorFrom: "#8B5CF6",
    colorTo: "#5B21B6",
    borderActive: "border-purple-400",
    ringColor: "ring-purple-500/50",
    shadowColor: "rgba(139, 92, 246, 0.6)",
    glowColor: "rgba(139, 92, 246, 0.4)",
    dotColor: "#8B5CF6",
    tooltip: "Jun/26: 0.8% de erro (Clique para filtrar)",
    badgeHighlight: "Consolidado",
    badgeRatio: "6.2x abaixo do limite",
  },
  {
    key: "2026-07",
    label: "Jul/26",
    shortLabel: "Jul",
    value: 1.6,
    colorFrom: "#F59E0B",
    colorTo: "#B45309",
    borderActive: "border-amber-400",
    ringColor: "ring-amber-500/50",
    shadowColor: "rgba(245, 158, 11, 0.6)",
    glowColor: "rgba(245, 158, 11, 0.4)",
    dotColor: "#F59E0B",
    tooltip: "Jul/26: 1.6% de erro (Clique para filtrar)",
    badgeHighlight: "Consolidado",
    badgeRatio: "3.1x abaixo do limite",
  },
  {
    key: "2026-08",
    label: "Ago/26",
    shortLabel: "Ago",
    value: 0.3,
    colorFrom: "#10B981",
    colorTo: "#047857",
    borderActive: "border-emerald-400",
    ringColor: "ring-emerald-500/50",
    shadowColor: "rgba(16, 185, 129, 0.6)",
    glowColor: "rgba(16, 185, 129, 0.4)",
    dotColor: "#10B981",
    tooltip: "Ago/26: 0.3% (Melhor do semestre - Recorde histórico)",
    badgeHighlight: "Melhor do semestre (Menor Erro)",
    badgeRatio: "16.6x abaixo do limite",
  },
  {
    key: "2026-09",
    label: "Set/26",
    shortLabel: "Set",
    value: 1.3,
    colorFrom: "#3B82F6",
    colorTo: "#1D4ED8",
    borderActive: "border-blue-400",
    ringColor: "ring-blue-500/50",
    shadowColor: "rgba(59, 130, 246, 0.6)",
    glowColor: "rgba(59, 130, 246, 0.4)",
    dotColor: "#3B82F6",
    tooltip: "Set/26: 1.3% de erro (Clique para filtrar)",
    badgeHighlight: "Consolidado",
    badgeRatio: "3.8x abaixo do limite",
  },
  {
    key: "2026-10",
    label: "Out/26",
    shortLabel: "Out",
    value: 0.4,
    colorFrom: "#22D3EE",
    colorTo: "#0E7490",
    borderActive: "border-cyan-300",
    ringColor: "ring-cyan-400/50",
    shadowColor: "rgba(34, 211, 238, 0.65)",
    glowColor: "rgba(34, 211, 238, 0.55)",
    dotColor: "#22D3EE",
    tooltip: "Out/26: 0.4% (Mês em andamento - Clique para filtrar)",
    badgeHighlight: "Mês Vigente em Andamento",
    badgeRatio: "12.5x abaixo do limite",
  },
];

export default function PreviewQualidadeHeroPage() {
  // Filtros Globais
  const [competencia, setCompetencia] = useState("2026-10");
  const [tipoRetorno, setTipoRetorno] = useState<"TODOS" | "TELA_RECEPCAO" | "PESSOAL" | "REAL">("TODOS");
  const [origem, setOrigem] = useState<"TODOS" | "ONR" | "RECEPCAO">("TODOS");
  const [filtroCausa, setFiltroCausa] = useState<string | null>(null);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [buscaGeral, setBuscaGeral] = useState("");

  // Estado dos Dados
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [colaboradores, setColaboradores] = useState<ColaboradorItem[]>([]);
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [topCausas, setTopCausas] = useState<TopCausaItem[]>([]);
  const [evolucaoMensal, setEvolucaoMensal] = useState<EvolucaoItem[]>([]);
  const [protocolosFaltantes, setProtocolosFaltantes] = useState<ProtocoloFaltanteItem[]>([]);

  // Visualização e Gaveta de Listagem
  const [filtroSaldoFaltante, setFiltroSaldoFaltante] = useState(false);
  const [abaAtivaListagem, setAbaAtivaListagem] = useState<"NAO_REALIZADOS" | "ERROS">("ERROS");
  const [copiadoTodos, setCopiadoTodos] = useState(false);
  const [paginaFaltante, setPaginaFaltante] = useState(1);
  const listagemRef = useRef<HTMLDivElement | null>(null);

  // Ordenação das tabelas
  const [colabSortCol, setColabSortCol] = useState<"nome" | "departamento" | "producao" | "erros" | "percentualErro">("percentualErro");
  const [colabSortDir, setColabSortDir] = useState<"asc" | "desc">("desc");
  const [ordemColuna, setOrdemColuna] = useState<"numeroPrenotacao" | "tipoRetorno" | "dataEntrada" | "dataRetorno" | "responsavel">("numeroPrenotacao");
  const [ordemDirecao, setOrdemDirecao] = useState<"asc" | "desc">("desc");

  // Melhores do Semestre
  const melhorMesSemestre = useMemo(() => {
    return [...MESES_GRAFICO_EVOLUCAO].sort((a, b) => a.value - b.value)[0];
  }, []);

  const mesSelecionadoInfo = useMemo(() => {
    const item = MESES_GRAFICO_EVOLUCAO.find((m) => m.key === competencia);
    const taxa = item ? item.value : (kpis ? kpis.percentualErroGeral : 0.4);
    const label = item ? item.label : competencia;
    const dotColor = item ? item.dotColor : "#22D3EE";
    const isMelhor = taxa === melhorMesSemestre.value;
    const isAtual = competencia === "2026-10";

    let highlight = item ? item.badgeHighlight : "Consolidado";
    if (isMelhor) {
      highlight = "Melhor do semestre (Menor Erro)";
    } else if (isAtual) {
      highlight = `Mês Vigente em Andamento • Recorde: ${melhorMesSemestre.label} (${melhorMesSemestre.value}%)`;
    } else {
      highlight = `Consolidado • Recorde: ${melhorMesSemestre.label} (${melhorMesSemestre.value}%)`;
    }

    const multLimite = (5.0 / Math.max(0.1, taxa)).toFixed(1);

    return {
      key: competencia,
      label,
      shortLabel: item ? item.shortLabel : competencia.split("-")[1],
      value: taxa,
      dotColor,
      badgeHighlight: highlight,
      badgeRatio: `${multLimite}x abaixo do limite`,
    };
  }, [competencia, kpis, melhorMesSemestre]);

  // Carregar Dados da API Real
  useEffect(() => {
    let cancel = false;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          competencia,
          tipoRetorno,
          origem,
        });
        if (filtroCausa) params.append("causa", filtroCausa);

        const res = await fetch(`/api/bi/qualidade/data?${params.toString()}`);
        if (!res.ok) throw new Error("Falha ao buscar dados");
        const json = await res.json();

        if (!cancel) {
          setKpis(json.kpis);
          setColaboradores(json.colaboradores || []);
          setEventos(json.eventos || []);
          setTopCausas(json.topCausas || []);
          setEvolucaoMensal(json.evolucaoMensal || []);
          setProtocolosFaltantes(json.protocolosFaltantes || []);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancel = true;
    };
  }, [competencia, tipoRetorno, origem, filtroCausa]);

  // Efeito de rolagem suave até a listagem quando o usuário a abre
  const abrirListagemComAba = (aba: "NAO_REALIZADOS" | "ERROS") => {
    setAbaAtivaListagem(aba);
    setFiltroSaldoFaltante(true);
    setTimeout(() => {
      listagemRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Colaboradores Ordenados
  const colaboradoresOrdenados = useMemo(() => {
    let list = [...colaboradores];
    if (buscaColaborador.trim()) {
      const q = buscaColaborador.toLowerCase();
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.departamento.toLowerCase().includes(q) ||
          c.atividade.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let valA: string | number = a[colabSortCol];
      let valB: string | number = b[colabSortCol];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return colabSortDir === "asc" ? -1 : 1;
      if (valA > valB) return colabSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [colaboradores, buscaColaborador, colabSortCol, colabSortDir]);

  // Eventos com Erro
  const eventosErros = useMemo(() => {
    return eventos.filter((e) => {
      if (filtroCausa && e.categoriaErro !== filtroCausa) return false;
      if (tipoRetorno !== "TODOS" && e.tipoRetorno !== tipoRetorno) return false;
      if (origem !== "TODOS" && e.origem !== origem) return false;
      return true;
    });
  }, [eventos, filtroCausa, tipoRetorno, origem]);

  // Copiar Lista de Protocolos
  const handleCopiarProtocolos = () => {
    const lista =
      abaAtivaListagem === "NAO_REALIZADOS"
        ? protocolosFaltantes.map((p) => p.numeroPrenotacao)
        : eventosErros.map((e) => e.prenotacao);
    navigator.clipboard.writeText(lista.join("\n"));
    setCopiadoTodos(true);
    setTimeout(() => setCopiadoTodos(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      {/* ── BARRA FIXA DE CONTROLE DO PREVIEW ── */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-cyan-950 via-[#0B1222] to-indigo-950 text-white border-b border-cyan-500/30 px-4 py-2.5 shadow-xl backdrop-blur-md">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/40">
              P
            </span>
            <div>
              <span className="text-xs font-bold tracking-wide text-white">
                PREVIEW INTERATIVO: NOVO HERO NO TOPO
              </span>
              <span className="text-[11px] text-cyan-300 ml-2 font-mono">
                [Qualidade Mês a Mês (Evolução) como Card Principal]
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/bi/qualidade"
              className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 transition-colors"
            >
              ← Voltar para Versão Atual
            </Link>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Data Ativa
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ══════════════════════════════════════════════════════════════════
             1. HEADER DA PÁGINA: GESTÃO DE PRAZOS / CONTROLE DE QUALIDADE
             ══════════════════════════════════════════════════════════════════ */}
        <section className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 tracking-wider uppercase">
            <span>GESTÃO DE PRAZOS</span>
            <span>/</span>
            <span className="text-slate-400">QUALIDADE REGISTRAL</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <span>Controle de Qualidade</span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  7º RI São Paulo
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Painel gerencial de auditoria do contraditório interno e cumprimento dos limites técnicos de conformidade registral.
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Atualizando dados do mês...</span>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             2. [HERO] CARD PRINCIPAL: QUALIDADE MÊS A MÊS (EVOLUÇÃO)
             ══════════════════════════════════════════════════════════════════ */}
        <section className="w-full rounded-2xl border-2 border-[#1E2A44] bg-[#0E1220] p-6 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-cyan-500/40 hover:shadow-cyan-500/10">
          {/* Efeito Glow Atmosférico no Topo */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-cyan-500/15 blur-3xl rounded-full" />

          {/* Topo do Hero: Título + Call-to-action Interativo + Pill de Insight Dinâmico */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  Qualidade Mês a Mês (Evolução)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Filtro Mestre Ativo
                </span>
              </div>

              {/* Instrução em Destaque Visível no Topo */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#151C2E] border border-cyan-500/30 text-xs font-semibold text-cyan-300 shadow-sm animate-pulse">
                  <span>👆 Clique em qualquer mês para filtrar todo o painel</span>
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  • Escala oficial de 0 a 2.5% • Limite tolerado: 5.0%
                </span>
              </div>
            </div>

            {/* Insight Dinâmico do Mês Selecionado */}
            <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[#090D1A] border border-cyan-500/30 shadow-lg">
              <span
                className="h-8 w-8 rounded-xl font-bold font-mono text-xs flex items-center justify-center border shadow-inner transition-colors"
                style={{
                  backgroundColor: `${mesSelecionadoInfo.dotColor}25`,
                  borderColor: `${mesSelecionadoInfo.dotColor}80`,
                  color: mesSelecionadoInfo.dotColor,
                }}
              >
                {mesSelecionadoInfo.value}%
              </span>
              <div className="flex items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span style={{ color: mesSelecionadoInfo.dotColor }}>{mesSelecionadoInfo.label}</span>
                  <span className="text-slate-400 font-normal">•</span>
                  <span>{mesSelecionadoInfo.badgeHighlight}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Área do Gráfico de Barras Verticais */}
          <div className="pt-6 pb-2 relative z-10">
            <div className="relative h-[220px] w-full flex">
              {/* Eixo Y com Ticks */}
              <div className="w-12 h-full flex flex-col justify-between text-xs font-mono text-slate-500 text-right pr-2.5 select-none font-semibold">
                <span>2.5%</span>
                <span>2.0%</span>
                <span>1.5%</span>
                <span>1.0%</span>
                <span>0.5%</span>
                <span>0.0%</span>
              </div>

              {/* Grid e Barras */}
              <div className="relative flex-1 h-full border-b-2 border-slate-700/80">
                {/* Linhas de Grade Horizontais Faint */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-white/[0.05] w-full" />
                  <div className="border-b border-white/[0.05] w-full" />
                  <div className="border-b border-white/[0.05] w-full" />
                  <div className="border-b border-white/[0.05] w-full" />
                  <div className="border-b border-white/[0.05] w-full" />
                  <div className="w-full" />
                </div>

                {/* Barras Verticais Interativas */}
                <div className="absolute inset-0 flex items-end justify-around px-4 sm:px-12">
                  {MESES_GRAFICO_EVOLUCAO.map((m) => {
                    const isSelected = competencia === m.key;
                    const isMelhor = m.key === melhorMesSemestre.key;
                    const isOut = m.key === "2026-10";

                    return (
                      <div
                        key={m.key}
                        onClick={() => setCompetencia(m.key)}
                        className="group relative flex flex-col items-center cursor-pointer select-none"
                      >
                        {/* Indicador no topo da barra */}
                        {isSelected ? (
                          <div
                            className="mb-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-xl whitespace-nowrap flex items-center gap-1.5 transition-all scale-105"
                            style={{
                              backgroundColor: "#0B1322",
                              border: `2px solid ${m.dotColor}`,
                              color: m.dotColor,
                              boxShadow: `0 0 20px ${m.glowColor}`,
                            }}
                          >
                            <span>{m.value}%</span>
                            <span className="text-[9px] opacity-90 font-sans uppercase tracking-wider font-extrabold">
                              • {isMelhor ? "RECORDE" : isOut ? "VIGENTE" : "ATIVO"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold font-mono text-slate-300 mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                            {m.value}%
                          </span>
                        )}

                        {/* A Barra */}
                        <div
                          className={`w-12 sm:w-16 rounded-t-xl transition-all duration-300 ${
                            isSelected
                              ? `scale-105 sm:scale-110 z-10 brightness-110 border-t-2 border-x-2 ${m.borderActive} ring-4 ${m.ringColor}`
                              : "opacity-75 hover:opacity-100 hover:scale-105"
                          }`}
                          style={{
                            background: `linear-gradient(to bottom, ${m.colorFrom}, ${m.colorTo})`,
                            height: `${(m.value / 2.5) * 180}px`,
                            boxShadow: isSelected
                              ? `0 0 30px ${m.shadowColor}, 0 0 50px ${m.glowColor}`
                              : `0 0 15px ${m.glowColor}`,
                          }}
                        />

                        {/* Tooltip ao passar o mouse */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono px-3 py-1 rounded-lg shadow-2xl pointer-events-none z-30 whitespace-nowrap flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.dotColor }} />
                          <span>{m.tooltip}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Labels do Eixo X - Clicáveis */}
            <div className="flex items-center justify-around pl-12 pr-4 sm:pr-12 pt-3 text-xs sm:text-sm font-mono text-[#94A3B8]">
              {MESES_GRAFICO_EVOLUCAO.map((m) => {
                const isSelected = competencia === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setCompetencia(m.key)}
                    className={`w-12 sm:w-16 text-center cursor-pointer transition-all hover:scale-110 py-1 rounded-md ${
                      isSelected
                        ? "font-black text-[#22D3EE] drop-shadow-[0_0_10px_rgba(34,211,238,0.9)] underline underline-offset-8 decoration-cyan-400 decoration-2"
                        : "hover:text-white"
                    }`}
                    title={`Filtrar dashboard para ${m.label}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             2. TOP CAUSAS DOS ERROS INTERNOS (LOGO ABAIXO DO HERO MÊS A MÊS)
             ══════════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>TOP CAUSAS DOS ERROS INTERNOS</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique em uma causa para isolar os protocolos na tabela
              </p>
            </div>
            {filtroCausa && (
              <button
                type="button"
                onClick={() => setFiltroCausa(null)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:bg-cyan-500/25 transition-all"
              >
                Limpar filtro ({filtroCausa}) ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
            {topCausas.length > 0 ? (
              topCausas.map((tc, idx) => (
                <div
                  key={tc.causa}
                  onClick={() => setFiltroCausa(filtroCausa === tc.causa ? null : tc.causa)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 group ${
                    filtroCausa === tc.causa
                      ? "bg-cyan-500/15 border-cyan-500/40 ring-1 ring-cyan-500/30 shadow-md shadow-cyan-500/20"
                      : "bg-[#090E1D] border-slate-800 hover:border-slate-700 hover:bg-[#0E1528]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-200 flex items-center gap-2 group-hover:text-white uppercase">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>{tc.causa}</span>
                    </span>
                    <span className="font-mono text-slate-200 font-bold uppercase">
                      {tc.quantidade} ({tc.percentual}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${Math.min(100, tc.percentual * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 col-span-3">Nenhum evento registrado</div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             3. BARRA DE FILTROS SECUNDÁRIOS: CARDS EM DESTAQUE PARA TIPOS DE RETORNO
             ══════════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-lg space-y-4">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            {/* Bloco 1: Indicador de Mês Selecionado (Sincronizado) */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                  Competência Ativa:
                </span>
                <span className="text-base font-extrabold text-white font-mono flex items-center gap-2">
                  <span>{mesSelecionadoInfo.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Sincronizado com Hero
                  </span>
                </span>
              </div>
            </div>

            {/* Bloco 2: Tipo de Retorno (Cards com Destaque Forte) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 max-w-3xl">
              <span className="text-[11px] text-slate-200 font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>Tipos de Retorno:</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full p-1.5 rounded-2xl bg-[#090E1D] border-2 border-[#1E293B] shadow-inner">
                {/* 0. TODOS */}
                <button
                  type="button"
                  onClick={() => setTipoRetorno("TODOS")}
                  className={`flex items-center justify-center py-2.5 px-3 rounded-xl font-bold transition-all text-xs tracking-wider active:scale-95 ${
                    tipoRetorno === "TODOS"
                      ? "bg-slate-700 text-white border-2 border-slate-300 shadow-lg shadow-white/10 ring-2 ring-white/20"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <span>TODOS</span>
                </button>

                {/* 1. TELA RECEPÇÃO */}
                <button
                  type="button"
                  onClick={() => setTipoRetorno("TELA_RECEPCAO")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold transition-all text-xs tracking-wider active:scale-95 ${
                    tipoRetorno === "TELA_RECEPCAO"
                      ? "bg-cyan-500 text-slate-950 border-2 border-cyan-200 shadow-xl shadow-cyan-500/40 ring-2 ring-cyan-300/50 scale-[1.02]"
                      : "bg-cyan-950/40 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/20 hover:text-cyan-100 hover:border-cyan-400"
                  }`}
                  title="Retorno Tela de Recepção"
                >
                  <Layers className={`w-4 h-4 shrink-0 ${tipoRetorno === "TELA_RECEPCAO" ? "text-slate-950" : "text-cyan-400"}`} />
                  <span className="truncate">TELA RECEPÇÃO</span>
                </button>

                {/* 2. PESSOAL */}
                <button
                  type="button"
                  onClick={() => setTipoRetorno("PESSOAL")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold transition-all text-xs tracking-wider active:scale-95 ${
                    tipoRetorno === "PESSOAL"
                      ? "bg-blue-600 text-white border-2 border-blue-200 shadow-xl shadow-blue-500/40 ring-2 ring-blue-300/50 scale-[1.02]"
                      : "bg-blue-950/40 text-blue-300 border border-blue-500/40 hover:bg-blue-500/20 hover:text-blue-100 hover:border-blue-400"
                  }`}
                  title="Retorno Pessoal"
                >
                  <Users className={`w-4 h-4 shrink-0 ${tipoRetorno === "PESSOAL" ? "text-white" : "text-blue-400"}`} />
                  <span className="truncate">PESSOAL</span>
                </button>

                {/* 3. REAL */}
                <button
                  type="button"
                  onClick={() => setTipoRetorno("REAL")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold transition-all text-xs tracking-wider active:scale-95 ${
                    tipoRetorno === "REAL"
                      ? "bg-purple-600 text-white border-2 border-purple-200 shadow-xl shadow-purple-500/40 ring-2 ring-purple-300/50 scale-[1.02]"
                      : "bg-purple-950/40 text-purple-300 border border-purple-500/40 hover:bg-purple-500/20 hover:text-purple-100 hover:border-purple-400"
                  }`}
                  title="Retorno Real"
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${tipoRetorno === "REAL" ? "text-white" : "text-purple-400"}`} />
                  <span className="truncate">REAL</span>
                </button>
              </div>
            </div>

            {/* Bloco 3: Origem do Protocolo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Origem:
              </span>
              <div className="inline-flex p-1 rounded-xl bg-[#090E1D] border border-slate-800 text-xs">
                {(["TODOS", "ONR", "RECEPCAO"] as const).map((ori) => (
                  <button
                    key={ori}
                    type="button"
                    onClick={() => setOrigem(ori)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                      origem === ori
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {ori === "TODOS" ? "Todos" : ori === "ONR" ? "ONR" : "Recepção"}
                  </button>
                ))}
              </div>

              {/* Botão Limpar Filtros */}
              <button
                type="button"
                onClick={() => {
                  setCompetencia("2026-10");
                  setTipoRetorno("TODOS");
                  setOrigem("TODOS");
                  setFiltroCausa(null);
                  setBuscaColaborador("");
                  setBuscaGeral("");
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 underline transition-colors ml-1"
                title="Restaurar padrão"
              >
                Limpar
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             4. LINHA DE KPIS (5 CARDS) COM TRANSIÇÃO SUAVE DE 300MS
             ══════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: PRENOTAÇÕES */}
          <div className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Prenotações
            </span>
            <div className="text-3xl font-extrabold font-mono text-white mt-2 transition-all duration-300">
              {kpis ? (kpis.totalPrenotacoesMes ?? kpis.prenotacoes) : 823}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total de títulos prenotados no mês</p>
          </div>

          {/* Card 2: PRODUÇÃO GERAL */}
          <div className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Produção Geral
            </span>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-2 transition-all duration-300">
              {kpis ? (kpis.totalProducaoGeral ?? 796) : 796}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Concluídos com registro ou exame</p>
          </div>

          {/* Card 3: NÃO REALIZADOS (Clicável para abrir Listagem) */}
          <div
            onClick={() => abrirListagemComAba("NAO_REALIZADOS")}
            className={`rounded-2xl border p-5 shadow-lg relative overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.99] ${
              filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS"
                ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-amber-500/20"
                : "border-slate-800 bg-[#111729] hover:bg-[#151A2C] hover:border-amber-500/50"
            }`}
            title="Clique para ver os protocolos cancelados e em trâmite"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Cancelado + Trâmite
              </span>
              <span className="text-[10px] font-mono text-amber-400 underline">Ver Lista ↗</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-2 transition-all duration-300">
              {kpis ? (kpis.totalNaoRealizados ?? 27) : 27}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {kpis ? `${kpis.totalCanceladas ?? 0} cancelados • ${kpis.totalEmTramite ?? 0} em trâmite` : "27 cancelados"}
            </p>
          </div>

          {/* Card 4: QUANTIDADE DE ERROS (Clicável para abrir Listagem) */}
          <div
            onClick={() => abrirListagemComAba("ERROS")}
            className={`rounded-2xl border p-5 shadow-lg relative overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.99] ${
              filtroSaldoFaltante && abaAtivaListagem === "ERROS"
                ? "border-rose-400 bg-rose-500/15 ring-2 ring-rose-400/50 shadow-rose-500/20"
                : "border-slate-800 bg-[#111729] hover:bg-[#151A2C] hover:border-rose-500/50"
            }`}
            title="Clique para ver os protocolos com erro"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Quantidade de Erros
              </span>
              <span className="text-[10px] font-mono text-rose-400 underline">Ver Lista ↗</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-rose-400 mt-2 transition-all duration-300">
              {kpis ? kpis.quantidadeErros : 3}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Eventos de retorno apontados</p>
          </div>

          {/* Card 5: % ERRO GERAL */}
          <div className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              % Erro Geral
            </span>
            <div className="text-3xl font-extrabold font-mono text-cyan-400 mt-2 transition-all duration-300">
              {kpis ? `${kpis.percentualErroGeral}%` : "0.4%"}
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-semibold">
              ✓ Limite oficial: 5.0%
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             5. LISTAGEM DE PROTOCOLOS (ON-DEMAND / EXPANSÍVEL)
             ══════════════════════════════════════════════════════════════════ */}
        {filtroSaldoFaltante && (
          <div ref={listagemRef}>
            <section className="rounded-2xl border-2 border-slate-800 bg-[#0E1322] p-6 shadow-2xl space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      abaAtivaListagem === "NAO_REALIZADOS"
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                        : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    }`}
                  >
                    {abaAtivaListagem === "NAO_REALIZADOS" ? (
                      <Layers className="h-5 w-5 text-amber-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      {abaAtivaListagem === "NAO_REALIZADOS"
                        ? "Listagem dos Protocolos — Não Realizados"
                        : "Listagem dos Protocolos — Erros"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {abaAtivaListagem === "NAO_REALIZADOS"
                        ? "Protocolos pendentes ou cancelados na competência selecionada."
                        : "Protocolos com eventos de retorno interno apontados pelo contraditório."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopiarProtocolos}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    {copiadoTodos ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiadoTodos ? "Copiados!" : "Copiar Protocolos"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroSaldoFaltante(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>

              {/* Seletor de Abas da Listagem */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAbaAtivaListagem("NAO_REALIZADOS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    abaAtivaListagem === "NAO_REALIZADOS"
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Não Realizados</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                    {protocolosFaltantes.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaAtivaListagem("ERROS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    abaAtivaListagem === "ERROS"
                      ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Com Erro</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300">
                    {kpis ? kpis.quantidadeErros : eventosErros.length}
                  </span>
                </button>
              </div>

              {/* Tabela de Protocolos */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A0E1A] text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Nº Prenotação</th>
                      <th className="py-2.5 px-4 font-bold">Tipo / Causa</th>
                      <th className="py-2.5 px-4 font-bold">Data Entrada</th>
                      <th className="py-2.5 px-4 font-bold">Data Retorno</th>
                      <th className="py-2.5 px-4 font-bold">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {abaAtivaListagem === "ERROS" ? (
                      eventosErros.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-rose-400">{e.prenotacao}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-[10px]">
                              {e.tipoRetorno}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-300">{e.dataEntrada}</td>
                          <td className="py-2.5 px-4 text-slate-300">{e.dataRetorno}</td>
                          <td className="py-2.5 px-4 text-slate-200 font-sans">{e.responsavel}</td>
                        </tr>
                      ))
                    ) : (
                      protocolosFaltantes.map((p) => (
                        <tr key={p.numeroPrenotacao} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-amber-400">{p.numeroPrenotacao}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[10px]">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-300">{p.dataPrenotacao}</td>
                          <td className="py-2.5 px-4 text-slate-400">—</td>
                          <td className="py-2.5 px-4 text-slate-200 font-sans">{p.departamento}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
             5. INDICADORES POR COLABORADOR
             ══════════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-[#111729] p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Indicadores por Colaborador
                </h3>
                <p className="text-xs text-slate-400">Desempenho individual e taxa de erro ponderada</p>
              </div>

              {/* Busca rápida */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar colaborador..."
                  value={buscaColaborador}
                  onChange={(e) => setBuscaColaborador(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#090E1D] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 w-48 font-sans"
                />
              </div>
            </div>

            {/* Tabela de Colaboradores com Ordenação */}
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0A0E1A] text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th
                      onClick={() => {
                        if (colabSortCol === "nome") setColabSortDir(colabSortDir === "asc" ? "desc" : "asc");
                        else {
                          setColabSortCol("nome");
                          setColabSortDir("asc");
                        }
                      }}
                      className="py-2.5 px-3 font-bold cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Colaborador</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (colabSortCol === "producao") setColabSortDir(colabSortDir === "asc" ? "desc" : "asc");
                        else {
                          setColabSortCol("producao");
                          setColabSortDir("desc");
                        }
                      }}
                      className="py-2.5 px-3 font-bold cursor-pointer hover:text-white text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Produção</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (colabSortCol === "erros") setColabSortDir(colabSortDir === "asc" ? "desc" : "asc");
                        else {
                          setColabSortCol("erros");
                          setColabSortDir("desc");
                        }
                      }}
                      className="py-2.5 px-3 font-bold cursor-pointer hover:text-white text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Erros</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (colabSortCol === "percentualErro") setColabSortDir(colabSortDir === "asc" ? "desc" : "asc");
                        else {
                          setColabSortCol("percentualErro");
                          setColabSortDir("desc");
                        }
                      }}
                      className="py-2.5 px-3 font-bold cursor-pointer hover:text-white text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>% Erro</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {colaboradoresOrdenados.slice(0, 10).map((c) => (
                    <tr key={c.nome} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white">
                        <div>{c.nome}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.departamento}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-bold">{c.producao}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-bold">{c.erros}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={c.dentroLimite ? "text-emerald-400" : "text-rose-400"}>
                          {c.percentualErro}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            c.dentroLimite
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {c.dentroLimite ? "Em Limite" : "Excedido"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </section>
      </div>
    </div>
  );
}
