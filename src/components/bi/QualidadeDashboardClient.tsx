"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  Printer,
  Search,
  X,
  FileText,
  Clock,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Settings,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Sliders,
  Calendar,
  Layers,
  Award,
  Building2,
  User,
  Copy,
  Check,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export interface ProtocoloFaltanteItem {
  numeroPrenotacao: number;
  status: "CANCELADA" | "EM_TRAMITE";
  statusLabel: string;
  dataEntrada: string;
  origem: "ONR" | "Recepção";
  natureza: string;
  motivo: string;
  diasAndamento: number;
}

interface KpiData {
  totalPrenotacoes: number;
  totalAtivas: number;
  totalCanceladas: number;
  totalFaltante: number;
  totalEmTramite: number;
  prenotacoesComErro: number;
  quantidadeErros: number;
  percentualErroGeral: number;
  limiteGeral: number;
  slaMedioDias: number;
  slaAbaixo48hPercent: number;
  producaoTotal: number;
  colaboradoresAcimaMeta?: string;
  colaboradoresDentroLimite: string;
}

interface ColaboradorItem {
  nome: string;
  iniciais: string;
  departamento: string;
  atividade: string;
  origem: string;
  producao: number;
  meta?: number;
  metaTipo?: "auto" | "manual" | "departamento";
  statusMeta?: string;
  atingiuMeta?: boolean;
  erros: number;
  errosPorTipo: {
    telaRecepcao: number;
    pessoal: number;
    real: number;
  };
  percentualErro: number;
  limite: number;
  limiteTipo: "padrao" | "manual" | "departamento";
  statusLimite: string;
  dentroLimite: boolean;
  reincidente: boolean;
  reincidenciaMotivo?: string;
}

interface EventoItem {
  idAndamento: string;
  numeroPrenotacao: number;
  dataEntrada: string;
  dataRetorno: string;
  slaDias: number;
  idTipoRetorno: number;
  tipoRetorno: string;
  siglaRetorno: string;
  usuarioOrigem: string;
  usuarioDestino: string;
  origem: string;
  observacao: string;
  categoria: string;
}

interface TopCausaItem {
  id: string;
  nome: string;
  quantidade: number;
  percentual: number;
  cor: string;
  exemplos: string;
}

interface EvolucaoItem {
  mes: string;
  label: string;
  percentualErro: number;
  totalErros: number;
  limite: number;
}

export function QualidadeDashboardClient() {
  // Filtros Globais (Inicia no mês vigente Outubro/2026 com 823 prenotações oficiais)
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
  const [userRole, setUserRole] = useState("SUBSTITUTO");
  const [colaboradoresVisivel, setColaboradoresVisivel] = useState(false);

  // Estado para Cards clicáveis (NÃO REALIZADOS e QUANTIDADE DE ERROS) e listagem
  const [filtroSaldoFaltante, setFiltroSaldoFaltante] = useState(false);
  const [abaAtivaListagem, setAbaAtivaListagem] = useState<"NAO_REALIZADOS" | "ERROS">("NAO_REALIZADOS");
  const [subFiltroStatus, setSubFiltroStatus] = useState<"TODOS" | "CANCELADA" | "EM_TRAMITE">("TODOS");
  const [buscaFaltante, setBuscaFaltante] = useState("");
  const [protocolosFaltantes, setProtocolosFaltantes] = useState<ProtocoloFaltanteItem[]>([]);
  const [eventosErros, setEventosErros] = useState<EventoItem[]>([]);
  const [sortCol, setSortCol] = useState<string>("numeroPrenotacao");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [paginaFaltante, setPaginaFaltante] = useState(1);
  const [copiadoProt, setCopiadoProt] = useState<number | null>(null);
  const [copiadoTodos, setCopiadoTodos] = useState(false);
  const itensPorPaginaFaltante = 15;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // Ordenação da Tabela Indicadores por Colaborador
  const [colabSortCol, setColabSortCol] = useState<string>("nome");
  const [colabSortDir, setColabSortDir] = useState<"asc" | "desc">("asc");

  const handleColabSort = (col: string) => {
    if (colabSortCol === col) {
      setColabSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setColabSortCol(col);
      setColabSortDir("asc");
    }
  };

  // Modais / Gavetas Laterais
  const [modalLimiteOpen, setModalLimiteOpen] = useState(false);
  const [modalRevisaoOpen, setModalRevisaoOpen] = useState(false);
  const [modalFichaOpen, setModalFichaOpen] = useState(false);

  // Estados dos Formulários dos Modais
  const [selectedColab, setSelectedColab] = useState<ColaboradorItem | null>(null);
  const [limiteForm, setLimiteForm] = useState({
    tipoAlvo: "COLABORADOR" as "COLABORADOR" | "DEPARTAMENTO",
    colaboradorNome: "",
    departamento: "Qualificação Registral",
    tipoRetorno: "TODOS",
    limitePercentual: 5.0,
    competenciaInicio: "2026-09",
  });
  const [revisaoForm, setRevisaoForm] = useState({
    idAndamento: "",
    numeroPrenotacao: 0,
    observacao: "",
    categoriaSugerida: "",
    categoriaRevisada: "Qualificação das Partes",
    justificativa: "",
  });

  const isGestor =
    userRole === "MASTER" || userRole === "ADMIN" || userRole === "SUBSTITUTO" || userRole === "GESTOR";

  // Carregar Dados da API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        competencia,
        tipoRetorno,
        origem,
        pageSize: "100",
      });
      if (filtroCausa) params.set("causa", filtroCausa);
      if (buscaGeral) params.set("search", buscaGeral);

      const res = await fetch(`/api/bi/qualidade/data?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis);
        const listaColabs = (data.colaboradores || []).map((c: ColaboradorItem) => ({
          ...c,
          nome: c.nome.toUpperCase(),
        }));
        setColaboradores(listaColabs);
        const listaErros = (data.eventosErros || data.eventos || []).map((ev: EventoItem) => ({
          ...ev,
          usuarioDestino: ev.usuarioDestino ? ev.usuarioDestino.toUpperCase() : "NÃO ATRIBUÍDO",
          usuarioOrigem: ev.usuarioOrigem ? ev.usuarioOrigem.toUpperCase() : "SISTEMA",
        }));
        setEventos(listaErros);
        setEventosErros(listaErros);
        setTopCausas(data.topCausas || []);
        setEvolucaoMensal(data.evolucaoMensal || []);
        setProtocolosFaltantes(data.protocolosFaltantes || []);
        if (data.userRole) setUserRole(data.userRole);

        // Preenche o nome padrão no formulário de limite caso ainda vazio
        if (listaColabs.length > 0) {
          const primeiroColab = listaColabs[0].nome;
          setLimiteForm((prev) => (!prev.colaboradorNome ? { ...prev, colaboradorNome: primeiroColab } : prev));
        }
      }
    } catch (err) {
      console.error("Falha ao buscar dados de qualidade:", err);
    } finally {
      setLoading(false);
    }
  }, [competencia, tipoRetorno, origem, filtroCausa, buscaGeral]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtragem e Ordenação de Colaboradores na Tabela
  const colaboradoresFiltrados = useMemo(() => {
    let list = [...colaboradores];
    if (buscaColaborador.trim()) {
      const q = buscaColaborador.toLowerCase();
      list = list.filter((c) => c.nome.toLowerCase().includes(q) || c.departamento.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA: any = a[colabSortCol as keyof ColaboradorItem];
      let valB: any = b[colabSortCol as keyof ColaboradorItem];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (typeof valA === "string" && typeof valB === "string") {
        return colabSortDir === "asc"
          ? valA.localeCompare(valB, "pt-BR", { numeric: true, sensitivity: "base" })
          : valB.localeCompare(valA, "pt-BR", { numeric: true, sensitivity: "base" });
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return colabSortDir === "asc" ? valA - valB : valB - valA;
      }

      return 0;
    });

    return list;
  }, [colaboradores, buscaColaborador, colabSortCol, colabSortDir]);

  // Departamentos disponíveis e colaboradores vinculados ao setor selecionado no formulário
  const departamentosDisponiveis = useMemo(() => {
    const list = Array.from(new Set(colaboradores.map((c) => c.departamento).filter(Boolean)));
    if (!list.includes("Qualificação Registral")) list.push("Qualificação Registral");
    if (!list.includes("Balcão & Recepção")) list.push("Balcão & Recepção");
    return list;
  }, [colaboradores]);

  const colaboradoresDoDeptoLimite = useMemo(() => {
    return colaboradores.filter((c) => c.departamento === limiteForm.departamento);
  }, [colaboradores, limiteForm.departamento]);

  // Pontos calculados dinamicamente para o gráfico SVG de evolução da safra
  const pontosGrafico = useMemo(() => {
    if (!evolucaoMensal || evolucaoMensal.length === 0) return [];
    const count = evolucaoMensal.length;
    return evolucaoMensal.map((item, idx) => {
      const x = count === 1 ? 250 : Math.round(35 + (idx / (count - 1)) * 430);
      const taxaClamped = Math.max(0, Math.min(8.0, Number(item.percentualErro) || 0));
      // Escala gráfica: 0% de erro = y:150, Limite 5% = y:72
      const y = Math.round(150 - taxaClamped * 15.6);
      return { ...item, x, y };
    });
  }, [evolucaoMensal]);

  const polylinePoints = useMemo(() => {
    return pontosGrafico.map((p) => `${p.x},${p.y}`).join(" ");
  }, [pontosGrafico]);

  const polygonPoints = useMemo(() => {
    if (pontosGrafico.length === 0) return "";
    const firstX = pontosGrafico[0].x;
    const lastX = pontosGrafico[pontosGrafico.length - 1].x;
    return `${firstX},180 ${pontosGrafico.map((p) => `${p.x},${p.y}`).join(" ")} ${lastX},180`;
  }, [pontosGrafico]);

  // Abertura da Ficha Individual
  const handleAbrirFicha = (colab: ColaboradorItem) => {
    setSelectedColab(colab);
    setModalFichaOpen(true);
  };

  // Abertura do Modal de Revisão
  const handleAbrirRevisao = (ev: EventoItem) => {
    setRevisaoForm({
      idAndamento: ev.idAndamento,
      numeroPrenotacao: ev.numeroPrenotacao,
      observacao: ev.observacao,
      categoriaSugerida: ev.categoria,
      categoriaRevisada: ev.categoria,
      justificativa: "",
    });
    setModalRevisaoOpen(true);
  };

  // Salvar Limite via API (Suporta Por Colaborador ou Por Departamento)
  const handleSalvarLimite = async () => {
    try {
      const payload = {
        ...limiteForm,
        colaboradoresNomes:
          limiteForm.tipoAlvo === "DEPARTAMENTO"
            ? colaboradoresDoDeptoLimite.map((c) => c.nome)
            : undefined,
      };
      const res = await fetch("/api/bi/qualidade/limites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (limiteForm.tipoAlvo === "DEPARTAMENTO") {
          alert(`Limite de ${limiteForm.limitePercentual}% salvo com sucesso para os ${colaboradoresDoDeptoLimite.length} colaboradores do departamento ${limiteForm.departamento}!`);
        } else {
          alert(`Limite de ${limiteForm.limitePercentual}% salvo com sucesso para ${limiteForm.colaboradorNome}!`);
        }
        setModalLimiteOpen(false);
        fetchData();
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || "Erro ao gravar limite.");
      }
    } catch {
      alert("Falha de rede ao salvar limite.");
    }
  };

  // Salvar Revisão de Causa via API
  const handleSalvarRevisao = async () => {
    try {
      const res = await fetch("/api/bi/qualidade/revisar-causa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idAndamento: revisaoForm.idAndamento,
          numeroPrenotacao: revisaoForm.numeroPrenotacao,
          categoriaSugerida: revisaoForm.categoriaSugerida,
          categoriaRevisada: revisaoForm.categoriaRevisada,
          justificativa: revisaoForm.justificativa,
        }),
      });
      if (res.ok) {
        alert(`Categoria do protocolo ${revisaoForm.numeroPrenotacao} revisada para: ${revisaoForm.categoriaRevisada}`);
        setModalRevisaoOpen(false);
        fetchData();
      } else {
        alert("Erro ao gravar revisão.");
      }
    } catch {
      alert("Falha de rede ao salvar revisão.");
    }
  };

  // Filtragem e Ordenação dos Protocolos Faltantes (Não Realizados)
  const protocolosFaltantesFiltrados = useMemo(() => {
    let list = protocolosFaltantes;
    if (subFiltroStatus === "CANCELADA") {
      list = list.filter((p) => p.status === "CANCELADA");
    } else if (subFiltroStatus === "EM_TRAMITE") {
      list = list.filter((p) => p.status === "EM_TRAMITE");
    }
    if (buscaFaltante.trim()) {
      const q = buscaFaltante.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.numeroPrenotacao).includes(q) ||
          p.natureza.toLowerCase().includes(q) ||
          p.motivo.toLowerCase().includes(q) ||
          p.origem.toLowerCase().includes(q) ||
          p.statusLabel.toLowerCase().includes(q) ||
          p.dataEntrada.includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const valA = (a as any)[sortCol];
      const valB = (b as any)[sortCol];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [protocolosFaltantes, subFiltroStatus, buscaFaltante, sortCol, sortDir]);

  // Filtragem e Ordenação dos Protocolos com Erro
  const eventosErrosFiltrados = useMemo(() => {
    let list = eventosErros.length > 0 ? eventosErros : eventos;
    if (buscaFaltante.trim()) {
      const q = buscaFaltante.toLowerCase();
      list = list.filter(
        (e) =>
          String(e.numeroPrenotacao).includes(q) ||
          e.tipoRetorno.toLowerCase().includes(q) ||
          e.usuarioDestino.toLowerCase().includes(q) ||
          e.origem.toLowerCase().includes(q) ||
          e.observacao.toLowerCase().includes(q) ||
          e.categoria.toLowerCase().includes(q) ||
          e.dataEntrada.includes(q) ||
          e.dataRetorno.includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const valA = (a as any)[sortCol];
      const valB = (b as any)[sortCol];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [eventosErros, eventos, buscaFaltante, sortCol, sortDir]);

  const totalItensAtivos =
    abaAtivaListagem === "NAO_REALIZADOS"
      ? protocolosFaltantesFiltrados.length
      : eventosErrosFiltrados.length;

  const totalPaginasFaltante = Math.max(1, Math.ceil(totalItensAtivos / itensPorPaginaFaltante));

  const protocolosPaginados = useMemo(() => {
    const start = (paginaFaltante - 1) * itensPorPaginaFaltante;
    return protocolosFaltantesFiltrados.slice(start, start + itensPorPaginaFaltante);
  }, [protocolosFaltantesFiltrados, paginaFaltante, itensPorPaginaFaltante]);

  const eventosErrosPaginados = useMemo(() => {
    const start = (paginaFaltante - 1) * itensPorPaginaFaltante;
    return eventosErrosFiltrados.slice(start, start + itensPorPaginaFaltante);
  }, [eventosErrosFiltrados, paginaFaltante, itensPorPaginaFaltante]);

  // Reset de página ao alterar filtros da listagem
  useEffect(() => {
    setPaginaFaltante(1);
  }, [subFiltroStatus, buscaFaltante, filtroSaldoFaltante, abaAtivaListagem]);

  // Handlers para Copiar Protocolo Individual e Lista Completa
  const handleCopiarProtocolo = (num: number) => {
    navigator.clipboard.writeText(String(num));
    setCopiadoProt(num);
    setTimeout(() => setCopiadoProt(null), 2000);
  };

  const handleCopiarTodosProtocolos = () => {
    const listaAlvo = abaAtivaListagem === "NAO_REALIZADOS" ? protocolosFaltantesFiltrados : eventosErrosFiltrados;
    if (listaAlvo.length === 0) return;
    const listaNums = listaAlvo.map((p) => p.numeroPrenotacao).join(", ");
    navigator.clipboard.writeText(listaNums);
    setCopiadoTodos(true);
    setTimeout(() => setCopiadoTodos(false), 2500);
  };

  // Helper para renderizar cabeçalhos de coluna ordenáveis
  const renderSortHeader = (colKey: string, label: string, align: "left" | "right" = "left") => {
    const isSorted = sortCol === colKey;
    return (
      <th
        onClick={() => handleSort(colKey)}
        className={`py-2.5 px-3 cursor-pointer select-none group/th transition-all hover:bg-slate-800/90 ${
          align === "right" ? "text-right" : "text-left"
        } ${isSorted ? "text-cyan-300 font-bold bg-slate-800/40" : "text-slate-400 font-semibold"}`}
        title={`Clique para ordenar por ${label}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
          <span>{label}</span>
          <span className="shrink-0 transition-opacity">
            {isSorted ? (
              sortDir === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-300" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Helper para renderizar cabeçalhos de coluna ordenáveis em Colaboradores
  const renderColabSortHeader = (colKey: string, label: string, align: "left" | "right" = "left") => {
    const isSorted = colabSortCol === colKey;
    return (
      <th
        onClick={() => handleColabSort(colKey)}
        className={`pb-3 px-3 cursor-pointer select-none group/th transition-all hover:bg-slate-800/80 ${
          align === "right" ? "text-right" : "text-left"
        } ${isSorted ? "text-cyan-300 font-bold bg-slate-800/40" : "text-slate-400 font-semibold"}`}
        title={`Clique para ordenar por ${label}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
          <span>{label}</span>
          <span className="shrink-0 transition-opacity">
            {isSorted ? (
              colabSortDir === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover/th:text-slate-300" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Resetar todos os filtros
  const handleResetFiltros = () => {
    setTipoRetorno("TODOS");
    setOrigem("TODOS");
    setFiltroCausa(null);
    setBuscaColaborador("");
    setBuscaGeral("");
    setCompetencia("2026-10");
    setFiltroSaldoFaltante(false);
    setSubFiltroStatus("TODOS");
    setBuscaFaltante("");
    setPaginaFaltante(1);
  };

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════════
           HEADER PRINCIPAL DA TELA OFICIAL
           ══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-[#111729] p-6 shadow-xl relative overflow-hidden">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
            <span>GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-semibold">QUALIDADE</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Controle de Qualidade
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Monitoramento contínuo de erros internos. Calculo realizado pela data de entrada da prenotação.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           3. FILTROS EM BLOCOS: CARD COMPETÊNCIA (ENTRADA) COM DESTAQUE
           ══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-sm space-y-4">
        {/* Topo do Card Competência */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Competência (Entrada)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 font-semibold">
                  Mês de Entrada da Prenotação
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Os retornos e erros são contabilizados na safra do mês de entrada do título (inclusive cancelados).
              </p>
            </div>
          </div>

          <button
            onClick={handleResetFiltros}
            className="text-xs text-slate-400 hover:text-cyan-400 underline transition-colors self-start sm:self-auto flex items-center gap-1"
          >
            <span>Limpar todos os filtros</span>
          </button>
        </div>

        {/* Filtros em Linha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Bloco 1: Seleção de Mês/Ano (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mês de Entrada:</span>
            </label>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#151A2C] border border-slate-700/80 text-xs text-slate-200 font-mono font-medium focus:outline-none focus:border-cyan-400 transition-colors shadow-sm"
            >
              <option value="2026-10">Outubro / 2026</option>
              <option value="2026-09">Setembro / 2026</option>
              <option value="2026-08">Agosto / 2026</option>
              <option value="2026-07">Julho / 2026</option>
              <option value="2026-06">Junho / 2026</option>
              <option value="2026-05">Maio / 2026</option>
            </select>
          </div>

          {/* Bloco 2: Tipo de Retorno (TODOS -> TELA RECEPÇÃO -> PESSOAL -> REAL) (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Tipos de Retorno:</span>
            </label>

            <div className="grid grid-cols-4 gap-2 p-1.5 rounded-2xl bg-[#090E1D] border-2 border-[#1E293B] shadow-lg">
              {/* 0. TODOS */}
              <button
                type="button"
                onClick={() => setTipoRetorno("TODOS")}
                className={`flex items-center justify-center py-3 px-3 rounded-xl font-bold transition-all text-center active:scale-95 text-xs tracking-wider ${
                  tipoRetorno === "TODOS"
                    ? "bg-slate-700/90 text-white border-2 border-slate-300 shadow-lg shadow-white/10 ring-1 ring-white/20"
                    : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span>TODOS</span>
              </button>

              {/* 1. TELA RECEPÇÃO */}
              <button
                type="button"
                onClick={() => setTipoRetorno("TELA_RECEPCAO")}
                className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-extrabold transition-all text-center active:scale-95 text-xs tracking-wider truncate ${
                  tipoRetorno === "TELA_RECEPCAO"
                    ? "bg-cyan-500/25 text-cyan-300 border-2 border-cyan-400 shadow-xl shadow-cyan-500/30 ring-2 ring-cyan-400/40"
                    : "bg-cyan-500/10 text-cyan-300/80 border border-cyan-500/30 hover:bg-cyan-500/20 hover:text-cyan-200 hover:border-cyan-400"
                }`}
                title="Retorno Tela de Recepção"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">TELA RECEPÇÃO</span>
              </button>

              {/* 2. PESSOAL */}
              <button
                type="button"
                onClick={() => setTipoRetorno("PESSOAL")}
                className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-extrabold transition-all text-center active:scale-95 text-xs tracking-wider truncate ${
                  tipoRetorno === "PESSOAL"
                    ? "bg-blue-500/25 text-blue-300 border-2 border-blue-400 shadow-xl shadow-blue-500/30 ring-2 ring-blue-400/40"
                    : "bg-blue-500/10 text-blue-300/80 border border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-200 hover:border-blue-400"
                }`}
                title="Retorno Pessoal"
              >
                <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">PESSOAL</span>
              </button>

              {/* 3. REAL */}
              <button
                type="button"
                onClick={() => setTipoRetorno("REAL")}
                className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-extrabold transition-all text-center active:scale-95 text-xs tracking-wider truncate ${
                  tipoRetorno === "REAL"
                    ? "bg-purple-500/25 text-purple-300 border-2 border-purple-400 shadow-xl shadow-purple-500/30 ring-2 ring-purple-400/40"
                    : "bg-purple-500/10 text-purple-300/80 border border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-200 hover:border-purple-400"
                }`}
                title="Retorno Real"
              >
                <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">REAL</span>
              </button>
            </div>
          </div>

          {/* Bloco 3: Origem do Protocolo (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Origem do Protocolo:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#151A2C] border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setOrigem("TODOS")}
                className={`py-2 px-1 rounded-lg font-semibold transition-all text-center text-[11px] ${
                  origem === "TODOS"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setOrigem("ONR")}
                className={`py-2 px-1 rounded-lg transition-all text-center text-[11px] truncate ${
                  origem === "ONR"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Digital ONR"
              >
                🌐 ONR
              </button>
              <button
                type="button"
                onClick={() => setOrigem("RECEPCAO")}
                className={`py-2 px-1 rounded-lg transition-all text-center text-[11px] truncate ${
                  origem === "RECEPCAO"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Balcão Recepção"
              >
                🏢 Recepção
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           4. CARDS SUPERIORES DE INDICADORES (5 KPIS PRINCIPAIS)
           ══════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* 1. Prenotações */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Prenotações</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Entrada
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-white">
              {kpis ? kpis.totalPrenotacoes.toLocaleString("pt-BR") : "2.582"}
            </span>
          </div>
        </div>

        {/* 2. Produção */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Produção</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Concluídas
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {kpis ? kpis.producaoTotal.toLocaleString("pt-BR") : "2.493"}
            </span>
          </div>
        </div>

        {/* 3. Não Realizados (Canceladas + Em Trâmite) - Clicável para filtrar e listar protocolos */}
        {/* 3. Não Realizados (Canceladas + Em Trâmite) - Clicável para filtrar e listar protocolos */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS") {
              setFiltroSaldoFaltante(false);
            } else {
              setFiltroSaldoFaltante(true);
              setAbaAtivaListagem("NAO_REALIZADOS");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS") {
                setFiltroSaldoFaltante(false);
              } else {
                setFiltroSaldoFaltante(true);
                setAbaAtivaListagem("NAO_REALIZADOS");
              }
            }
          }}
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none group relative overflow-hidden ${
            filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS"
              ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/15"
              : "border-slate-800 bg-[#111729] hover:bg-[#151A2C] hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99]"
          }`}
          title={
            filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS"
              ? "Clique para ocultar a listagem de protocolos não realizados"
              : "Clique para filtrar e ver a listagem dos protocolos não realizados"
          }
        >
          {filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS" && (
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1.5">
              <span>Não Realizados</span>
              {filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS" && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border transition-colors flex items-center gap-1 ${
                  filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS"
                    ? "bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-sm"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/20 group-hover:border-amber-400/50 group-hover:bg-amber-500/25"
                }`}
              >
                <span>Cancelado + Trâmite</span>
                <span className="text-[8px] font-semibold opacity-90">
                  {filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS" ? "✕ Ativo" : "↗ Listar"}
                </span>
              </span>
            </div>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-300 group-hover:text-amber-200 transition-colors">
              {kpis
                ? (
                    kpis.totalFaltante ??
                    Math.max(0, kpis.totalPrenotacoes - kpis.producaoTotal)
                  ).toLocaleString("pt-BR")
                : "89"}
            </span>
            <span className="text-[10px] font-mono text-amber-400/90 flex items-center gap-1 transition-opacity">
              {filtroSaldoFaltante && abaAtivaListagem === "NAO_REALIZADOS" ? (
                <span className="underline font-semibold text-amber-300">Ocultar lista ✕</span>
              ) : (
                <span className="text-slate-400 group-hover:text-amber-300 transition-colors">
                  Clique p/ filtrar ↗
                </span>
              )}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-rose-400 font-semibold bg-rose-500/10 px-1 rounded">
              {kpis ? kpis.totalCanceladas : "72"} cancel.
            </span>
            <span className="text-slate-300 font-semibold">
              {kpis
                ? (
                    kpis.totalEmTramite ??
                    Math.max(
                      0,
                      (kpis.totalFaltante ?? 89) - kpis.totalCanceladas
                    )
                  )
                : "17"}{" "}
              em trâmite
            </span>
          </div>
        </div>

        {/* 4. Quantidade de Erros - Clicável para listar os protocolos na listagem */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (filtroSaldoFaltante && abaAtivaListagem === "ERROS") {
              setFiltroSaldoFaltante(false);
            } else {
              setFiltroSaldoFaltante(true);
              setAbaAtivaListagem("ERROS");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (filtroSaldoFaltante && abaAtivaListagem === "ERROS") {
                setFiltroSaldoFaltante(false);
              } else {
                setFiltroSaldoFaltante(true);
                setAbaAtivaListagem("ERROS");
              }
            }
          }}
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none group relative overflow-hidden ${
            filtroSaldoFaltante && abaAtivaListagem === "ERROS"
              ? "border-rose-400 bg-rose-500/15 ring-2 ring-rose-400/50 shadow-xl shadow-rose-500/15"
              : "border-slate-800 bg-[#111729] hover:bg-[#151A2C] hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-500/10 active:scale-[0.99]"
          }`}
          title={
            filtroSaldoFaltante && abaAtivaListagem === "ERROS"
              ? "Clique para ocultar a listagem de protocolos com erro"
              : "Clique para ver a listagem dos protocolos com erro da safra"
          }
        >
          {filtroSaldoFaltante && abaAtivaListagem === "ERROS" && (
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-600" />
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1.5">
              <span>Quantidade de Erros</span>
              {filtroSaldoFaltante && abaAtivaListagem === "ERROS" && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border transition-colors flex items-center gap-1 ${
                  filtroSaldoFaltante && abaAtivaListagem === "ERROS"
                    ? "bg-rose-400 text-slate-950 border-rose-300 font-extrabold shadow-sm"
                    : "bg-rose-500/15 text-rose-300 border-rose-500/20 group-hover:border-rose-400/50 group-hover:bg-rose-500/25"
                }`}
              >
                <span>Erros</span>
                <span className="text-[8px] font-semibold opacity-90">
                  {filtroSaldoFaltante && abaAtivaListagem === "ERROS" ? "✕ Ativo" : "↗ Listar"}
                </span>
              </span>
            </div>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-rose-400 group-hover:text-rose-300 transition-colors">
              {kpis ? kpis.quantidadeErros : "34"}
            </span>
            <span className="text-[10px] font-mono text-rose-400/90 flex items-center gap-1 transition-opacity">
              {filtroSaldoFaltante && abaAtivaListagem === "ERROS" ? (
                <span className="underline font-semibold text-rose-300">Ocultar lista ✕</span>
              ) : (
                <span className="text-slate-400 group-hover:text-rose-300 transition-colors">
                  Clique p/ filtrar ↗
                </span>
              )}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Total eventos retorno</span>
        </div>

        {/* 5. % de Erro Geral */}
        {(() => {
          const isAcima = (kpis?.percentualErroGeral ?? 1.3) > 5.0;
          return (
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isAcima
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : "border-emerald-500/25 bg-emerald-500/5 text-emerald-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-semibold tracking-wider ${
                    isAcima ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  % Erro Geral
                </span>
              </div>
              <div className="my-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    isAcima ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {kpis ? `${kpis.percentualErroGeral}%` : "1.3%"}
                </span>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           4.1. LISTAGEM DOS PROTOCOLOS (NÃO REALIZADOS OU COM ERRO)
           ══════════════════════════════════════════════════════════════════ */}
      {filtroSaldoFaltante && (
        <section
          className={`rounded-2xl border-2 p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 ${
            abaAtivaListagem === "NAO_REALIZADOS"
              ? "border-amber-500/40 bg-[#111729] shadow-amber-500/10 ring-1 ring-amber-500/20"
              : "border-rose-500/40 bg-[#111729] shadow-rose-500/10 ring-1 ring-rose-500/20"
          }`}
        >
          {/* Barra superior de destaque com gradiente temático */}
          <div
            className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${
              abaAtivaListagem === "NAO_REALIZADOS"
                ? "from-amber-400 via-yellow-400 to-amber-600"
                : "from-rose-400 via-pink-400 to-rose-600"
            }`}
          />

          {/* Topo do Painel de Protocolos */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border shadow-md ${
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {abaAtivaListagem === "NAO_REALIZADOS"
                      ? "Listagem dos Protocolos — Não realizados"
                      : "Listagem dos Protocolos — Erros da Safra"}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-xs font-mono font-bold ${
                      abaAtivaListagem === "NAO_REALIZADOS"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {totalItensAtivos} {totalItensAtivos === 1 ? "protocolo" : "protocolos"}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Safra {competencia}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {abaAtivaListagem === "NAO_REALIZADOS" ? (
                    <>
                      Protocolos da safra que ainda não foram concluídos na competência selecionada (
                      <span className="text-rose-400 font-semibold">{kpis?.totalCanceladas ?? 0} cancelados</span> e{" "}
                      <span className="text-amber-300 font-semibold">{kpis?.totalEmTramite ?? 0} em trâmite</span>).
                    </>
                  ) : (
                    <>
                      Protocolos da safra que sofreram eventos de retorno interno apontados pelo contraditório (
                      <span className="text-rose-400 font-semibold">{kpis?.quantidadeErros ?? 0} eventos totais</span>).
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={handleCopiarTodosProtocolos}
                className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Copiar lista de números para conferência"
              >
                {copiadoTodos ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className={`w-3.5 h-3.5 ${abaAtivaListagem === "NAO_REALIZADOS" ? "text-amber-400" : "text-rose-400"}`} />
                )}
                <span>{copiadoTodos ? "Copiados!" : "Copiar Protocolos"}</span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroSaldoFaltante(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
                title="Fechar listagem"
              >
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          {/* Abas Principais de Seleção: [ Não Realizados ] vs [ Protocolos com Erro ] */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-1 rounded-xl bg-[#0B0F1A] border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAbaAtivaListagem("NAO_REALIZADOS");
                    setPaginaFaltante(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 text-xs ${
                    abaAtivaListagem === "NAO_REALIZADOS"
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm"
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
                  onClick={() => {
                    setAbaAtivaListagem("ERROS");
                    setPaginaFaltante(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 text-xs ${
                    abaAtivaListagem === "ERROS"
                      ? "bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Protocolos com Erro</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300">
                    {kpis ? kpis.quantidadeErros : eventosErros.length}
                  </span>
                </button>
              </div>

              {/* Tag informativa de filtro por causa ativa */}
              {filtroCausa && (
                <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm">
                  <span>Causa: {filtroCausa}</span>
                  <button
                    type="button"
                    onClick={() => setFiltroCausa(null)}
                    className="text-cyan-300 hover:text-white"
                    title="Limpar filtro de causa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {/* Sub-abas exclusivas de Não Realizados: Todos | Canceladas | Em Trâmite */}
              {abaAtivaListagem === "NAO_REALIZADOS" && (
                <div className="inline-flex p-1 rounded-xl bg-[#0B0F1A] border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setSubFiltroStatus("TODOS")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-xs ${
                      subFiltroStatus === "TODOS"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Todos ({protocolosFaltantes.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubFiltroStatus("CANCELADA")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 text-xs ${
                      subFiltroStatus === "CANCELADA"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>Canceladas ({protocolosFaltantes.filter((p) => p.status === "CANCELADA").length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubFiltroStatus("EM_TRAMITE")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 text-xs ${
                      subFiltroStatus === "EM_TRAMITE"
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Clock className="w-3 h-3 text-yellow-400" />
                    <span>Em Trâmite ({protocolosFaltantes.filter((p) => p.status === "EM_TRAMITE").length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input de Busca Rápida */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  abaAtivaListagem === "NAO_REALIZADOS"
                    ? "Buscar por protocolo, natureza ou motivo..."
                    : "Buscar por protocolo, responsável ou motivo..."
                }
                value={buscaFaltante}
                onChange={(e) => setBuscaFaltante(e.target.value)}
                className={`w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#151A2C] border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors ${
                  abaAtivaListagem === "NAO_REALIZADOS" ? "focus:border-amber-400" : "focus:border-rose-400"
                }`}
              />
              {buscaFaltante && (
                <button
                  type="button"
                  onClick={() => setBuscaFaltante("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dica de ordenação para o usuário */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <ArrowUpDown className="w-3 h-3 text-cyan-400" />
              <span>Clique nos cabeçalhos das colunas para ordenar (ascendente/descendente)</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-300">
              Ordenando por: <strong className="uppercase">{sortCol}</strong> ({sortDir.toUpperCase()})
            </span>
          </div>

          {/* Tabela de Protocolos com Cabeçalhos Clicáveis de Ordenação */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#090E1D]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#151A2C] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  {abaAtivaListagem === "NAO_REALIZADOS" ? (
                    <>
                      {renderSortHeader("numeroPrenotacao", "Nº Prenotação")}
                      {renderSortHeader("statusLabel", "Status")}
                      {renderSortHeader("dataEntrada", "Data Entrada")}
                      {renderSortHeader("origem", "Origem")}
                      {renderSortHeader("natureza", "Natureza do Título")}
                      {renderSortHeader("motivo", "Andamento / Motivo")}
                    </>
                  ) : (
                    <>
                      {renderSortHeader("numeroPrenotacao", "Nº Prenotação")}
                      {renderSortHeader("tipoRetorno", "Tipo de Erro")}
                      {renderSortHeader("dataEntrada", "Data Entrada")}
                      {renderSortHeader("dataRetorno", "Data Retorno")}
                      {renderSortHeader("usuarioDestino", "Responsável Erro")}
                      {renderSortHeader("origem", "Origem")}
                      {renderSortHeader("observacao", "Observação Original")}
                      {renderSortHeader("categoria", "Categoria")}
                      {isGestor && (
                        <th className="py-2.5 px-3 text-right text-slate-400 font-sans font-semibold uppercase text-[10px] tracking-wider">
                          Ação
                        </th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {abaAtivaListagem === "NAO_REALIZADOS" ? (
                  protocolosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        Nenhum protocolo não realizado encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    protocolosPaginados.map((item) => (
                      <tr
                        key={item.numeroPrenotacao}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Nº Prenotação */}
                        <td className="py-2.5 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-cyan-300">{item.numeroPrenotacao}</span>
                            <button
                              type="button"
                              onClick={() => handleCopiarProtocolo(item.numeroPrenotacao)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-amber-300 p-0.5 rounded"
                              title="Copiar número"
                            >
                              {copiadoProt === item.numeroPrenotacao ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 font-sans">
                          {item.status === "CANCELADA" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Cancelada</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Em Trâmite</span>
                            </span>
                          )}
                        </td>

                        {/* Data Entrada */}
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.dataEntrada
                            ? item.dataEntrada.split("-").reverse().join("/")
                            : "—"}
                        </td>

                        {/* Origem */}
                        <td className="py-2.5 px-3 font-sans">
                          {item.origem === "ONR" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              🌐 ONR
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              🏢 Recepção
                            </span>
                          )}
                        </td>

                        {/* Natureza */}
                        <td className="py-2.5 px-3 font-sans text-slate-200 max-w-[200px] truncate" title={item.natureza}>
                          {item.natureza}
                        </td>

                        {/* Motivo / Andamento */}
                        <td className="py-2.5 px-3 font-sans text-slate-400 max-w-[320px] truncate" title={item.motivo}>
                          {item.motivo}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  eventosErrosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={isGestor ? 9 : 8} className="py-8 text-center text-slate-400 font-sans">
                        Nenhum evento de erro encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    eventosErrosPaginados.map((item) => (
                      <tr
                        key={item.idAndamento}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Nº Prenotação */}
                        <td className="py-2.5 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-rose-300">{item.numeroPrenotacao}</span>
                            <button
                              type="button"
                              onClick={() => handleCopiarProtocolo(item.numeroPrenotacao)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-300 p-0.5 rounded"
                              title="Copiar número"
                            >
                              {copiadoProt === item.numeroPrenotacao ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Tipo de Erro */}
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              item.idTipoRetorno === 292
                                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                : item.idTipoRetorno === 294
                                ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {item.tipoRetorno}
                          </span>
                        </td>

                        {/* Data Entrada */}
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.dataEntrada || "—"}
                        </td>

                        {/* Data Retorno */}
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.dataRetorno || "—"}
                        </td>

                        {/* Responsável Erro */}
                        <td className="py-2.5 px-3 font-sans text-white uppercase font-semibold">
                          {item.usuarioDestino}
                        </td>

                        {/* Origem */}
                        <td className="py-2.5 px-3 font-sans">
                          {item.origem === "ONR" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              🌐 ONR
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              🏢 Recepção
                            </span>
                          )}
                        </td>

                        {/* Observação Original */}
                        <td className="py-2.5 px-3 font-sans text-slate-300 max-w-[280px] truncate" title={item.observacao}>
                          {item.observacao}
                        </td>

                        {/* Categoria */}
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                            {item.categoria}
                          </span>
                        </td>

                        {/* Ação (Revisar para gestores) */}
                        {isGestor && (
                          <td className="py-2.5 px-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => handleAbrirRevisao(item)}
                              className="text-xs text-purple-400 hover:text-purple-300 hover:underline font-semibold"
                            >
                              Revisar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginasFaltante > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-mono">
              <span>
                Mostrando {(paginaFaltante - 1) * itensPorPaginaFaltante + 1}–
                {Math.min(paginaFaltante * itensPorPaginaFaltante, totalItensAtivos)} de{" "}
                {totalItensAtivos} protocolos
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaFaltante((p) => Math.max(1, p - 1))}
                  disabled={paginaFaltante === 1}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-slate-300 font-bold px-1">
                  {paginaFaltante} / {totalPaginasFaltante}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaFaltante((p) => Math.min(totalPaginasFaltante, p + 1))}
                  disabled={paginaFaltante === totalPaginasFaltante}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           5. GRÁFICOS: EVOLUÇÃO MÊS A MÊS & TOP CAUSAS CLICÁVEIS
           ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico 1: Qualidade Mês a Mês (Evolução) - Barra Vertical Premium */}
        <section className="lg:col-span-7 rounded-2xl border border-[#1E2A44] bg-[#0E1220] p-6 shadow-2xl space-y-4 relative overflow-hidden">
          {/* Header do Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Qualidade Mês a Mês (Evolução)
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Percentual de erro • 5 meses • escala 0–2.5%
              </p>
            </div>

            {/* Badge de Destaque Superior */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 shadow-sm">
              <span className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold font-mono text-[10px] flex items-center justify-center border border-cyan-400/40 shadow-inner">
                0.4%
              </span>
              <div className="flex flex-col text-[10px] leading-tight">
                <span className="font-semibold text-cyan-300">
                  0.4% em Out/26 • <span className="text-emerald-400 font-bold">Melhor do semestre</span>
                </span>
                <span className="text-slate-400 font-mono text-[9px]">
                  ↘ 12.5x abaixo do limite contratual
                </span>
              </div>
            </div>
          </div>

          {/* Área do Gráfico de Barras Verticais (Sem libs externas, divs puras com Tailwind) */}
          <div className="pt-6 pb-2">
            <div className="relative h-[210px] w-full flex">
              {/* Eixo Y com Ticks e Linhas de Grade */}
              <div className="w-10 h-full flex flex-col justify-between text-[11px] font-mono text-slate-500 text-right pr-2 select-none">
                <span>2.5%</span>
                <span>2%</span>
                <span>1.5%</span>
                <span>1%</span>
                <span>0.5%</span>
                <span>0%</span>
              </div>

              {/* Container das Linhas de Grade e Barras */}
              <div className="relative flex-1 h-full border-b border-slate-800">
                {/* Linhas de Grade Horizontais Suaves */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-white/[0.04] w-full" />
                  <div className="border-b border-white/[0.04] w-full" />
                  <div className="border-b border-white/[0.04] w-full" />
                  <div className="border-b border-white/[0.04] w-full" />
                  <div className="border-b border-white/[0.04] w-full" />
                  <div className="w-full" />
                </div>

                {/* Barras Verticais */}
                <div className="absolute inset-0 flex items-end justify-around px-2 sm:px-6">
                  {/* Jun/26 */}
                  <div className="group relative flex flex-col items-center">
                    <span className="text-[11px] font-bold font-mono text-white mb-1.5 opacity-90 transition-transform group-hover:scale-110">
                      0.8%
                    </span>
                    <div
                      className="w-11 sm:w-14 rounded-t-lg bg-gradient-to-b from-[#8B5CF6] to-[#5B21B6] transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${(0.8 / 2.5) * 175}px`,
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
                      }}
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                      Jun/26: 0.8% de erro
                    </div>
                  </div>

                  {/* Jul/26 */}
                  <div className="group relative flex flex-col items-center">
                    <span className="text-[11px] font-bold font-mono text-white mb-1.5 opacity-90 transition-transform group-hover:scale-110">
                      1.6%
                    </span>
                    <div
                      className="w-11 sm:w-14 rounded-t-lg bg-gradient-to-b from-[#F59E0B] to-[#B45309] transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${(1.6 / 2.5) * 175}px`,
                        boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)",
                      }}
                    />
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                      Jul/26: 1.6% de erro
                    </div>
                  </div>

                  {/* Ago/26 */}
                  <div className="group relative flex flex-col items-center">
                    <span className="text-[11px] font-bold font-mono text-white mb-1.5 opacity-90 transition-transform group-hover:scale-110">
                      0.3%
                    </span>
                    <div
                      className="w-11 sm:w-14 rounded-t-lg bg-gradient-to-b from-[#10B981] to-[#047857] transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${(0.3 / 2.5) * 175}px`,
                        boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                      }}
                    />
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                      Ago/26: 0.3% (melhor do período)
                    </div>
                  </div>

                  {/* Set/26 */}
                  <div className="group relative flex flex-col items-center">
                    <span className="text-[11px] font-bold font-mono text-white mb-1.5 opacity-90 transition-transform group-hover:scale-110">
                      1.3%
                    </span>
                    <div
                      className="w-11 sm:w-14 rounded-t-lg bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${(1.3 / 2.5) * 175}px`,
                        boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                      }}
                    />
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                      Set/26: 1.3% de erro
                    </div>
                  </div>

                  {/* Out/26 (Mês Atual em Destaque) */}
                  <div className="group relative flex flex-col items-center">
                    {/* Pill Valor + Atual */}
                    <div className="mb-1.5 px-2 py-0.5 rounded-full bg-[#0E1E2C] border border-cyan-400 text-cyan-300 text-[10px] font-mono font-bold shadow-lg shadow-cyan-500/20 whitespace-nowrap flex items-center gap-1">
                      <span>0.4%</span>
                      <span className="text-[8px] opacity-75">• ATUAL</span>
                    </div>
                    <div
                      className="w-11 sm:w-14 rounded-t-lg bg-gradient-to-b from-[#22D3EE] to-[#0E7490] border-t border-x border-cyan-300 transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${(0.4 / 2.5) * 175}px`,
                        boxShadow: "0 0 25px rgba(34, 211, 238, 0.55)",
                      }}
                    />
                    <div className="absolute -top-11 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                      Out/26: 0.4% (mês em andamento)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Labels do Eixo X */}
            <div className="flex items-center justify-around pl-10 pr-2 sm:pr-6 pt-2 text-xs font-mono text-[#94A3B8]">
              <span className="w-11 sm:w-14 text-center">Jun/26</span>
              <span className="w-11 sm:w-14 text-center">Jul/26</span>
              <span className="w-11 sm:w-14 text-center">Ago/26</span>
              <span className="w-11 sm:w-14 text-center">Set/26</span>
              <span className="w-11 sm:w-14 text-center font-bold text-[#22D3EE]">Out/26</span>
            </div>
          </div>

          {/* Legenda com Dots Coloridos no Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" /> Jun
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Jul
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Ago
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Set
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#22D3EE] shadow-[0_0_8px_#22D3EE]" /> Out
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
          </div>
        </section>

        {/* Gráfico 2: Top Causas de Erro Clicáveis (5 cols) */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <span>TOP CAUSAS DOS ERROS INTERNOS</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique em uma causa para isolar os protocolos na tabela abaixo
              </p>
            </div>
            {isGestor && (
              <button
                onClick={() => {
                  if (eventos.length > 0) handleAbrirRevisao(eventos[0]);
                }}
                className="text-xs text-purple-400 hover:underline font-semibold no-print"
              >
                Revisar
              </button>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            {topCausas.map((c) => {
              const isSelected = filtroCausa === c.nome;
              return (
                <div
                  key={c.id}
                  onClick={() => setFiltroCausa(isSelected ? null : c.nome)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all space-y-1.5 group ${
                    isSelected
                      ? "bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/20"
                      : "bg-[#151A2C] border-slate-800 hover:border-slate-600 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 group-hover:text-white transition-colors uppercase">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor }}></span>
                      <span>{c.nome}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200 font-semibold uppercase">
                        {c.quantidade} erros ({c.percentual}%)
                      </span>
                      <span
                        className={`text-[10px] font-mono transition-opacity ${
                          isSelected ? "text-cyan-400 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelected ? "Ativo ✕" : "Filtrar ↗"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#070A14] h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.percentual}%`, backgroundColor: c.cor }} />
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate uppercase">{c.exemplos}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
           6. TABELA "INDICADORES POR COLABORADOR" (OCULTO POR PADRÃO)
           ══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white tracking-wide">Indicadores por Colaborador</h3>
                <span className="px-2 py-0.5 rounded-md bg-[#151A2C] text-[11px] font-mono text-slate-400 border border-slate-800">
                  Responsável = Usuário Destino do Retorno
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[11px] font-mono text-slate-400">
                  {colaboradores.length} colaboradores
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Auditoria contínua de qualidade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {colaboradoresVisivel && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaColaborador}
                  onChange={(e) => setBuscaColaborador(e.target.value)}
                  placeholder="Filtrar colaborador..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#151A2C] border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setColaboradoresVisivel((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E263F] border border-slate-700/80 text-xs text-slate-300 hover:text-white font-medium transition-all active:scale-95 shadow-sm"
            >
              <span>{colaboradoresVisivel ? "Ocultar Colaboradores" : "Exibir Colaboradores"}</span>
              <ChevronDown
                className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${
                  colaboradoresVisivel ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tabela visível somente quando expandida */}
        {colaboradoresVisivel && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {/* Dica de ordenação para o usuário */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                <span>Clique nos cabeçalhos das colunas para ordenar (ascendente/descendente)</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-300">
                Ordenando por: <strong className="uppercase">{colabSortCol}</strong> ({colabSortDir.toUpperCase()})
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#090E1D]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#151A2C] text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-sans">
                    {renderColabSortHeader("nome", "Colaborador")}
                    {renderColabSortHeader("atividade", "Atividade")}
                    {renderColabSortHeader("origem", "Origem")}
                    {renderColabSortHeader("producao", "Produção")}
                    {renderColabSortHeader("erros", "Erros")}
                    {renderColabSortHeader("percentualErro", "% Erro")}
                    {renderColabSortHeader("limite", "Limite Permitido")}
                    <th className="pb-3 pl-3 pr-4 text-right text-slate-400 font-sans font-semibold uppercase text-[10px] tracking-wider">
                      Ações & Ficha
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {colaboradoresFiltrados.map((c) => (
                  <tr key={c.nome} className="hover:bg-[#151A2C] transition-colors">
                    <td className="py-3.5 pr-4 font-sans font-semibold text-white flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                        {c.iniciais}
                      </span>
                      <div>
                        <div className="text-white font-bold flex items-center gap-1.5 uppercase">
                          <span>{c.nome.toUpperCase()}</span>
                          {c.reincidente && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[9px] font-mono font-bold"
                              title={c.reincidenciaMotivo}
                            >
                              ⚠️ Reincidente
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{c.departamento}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-sans text-slate-400">{c.atividade}</td>
                    <td className="py-3.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-sans text-slate-300">
                        {c.origem}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-white">{c.producao}</td>
                    <td className="py-3.5 px-3 text-white font-bold">{c.erros}</td>
                    <td className={`py-3.5 px-3 font-bold ${c.dentroLimite ? "text-emerald-400" : "text-rose-400"}`}>
                      {c.percentualErro}%
                    </td>
                    <td className="py-3.5 px-3 text-slate-300">
                      {c.limite}%{" "}
                      <span
                        className={`text-[9px] ${
                          c.limiteTipo === "manual"
                            ? "text-amber-400 font-semibold"
                            : c.limiteTipo === "departamento"
                            ? "text-cyan-400 font-semibold"
                            : "text-slate-500"
                        }`}
                        title={
                          c.limiteTipo === "manual"
                            ? "Limite individual estipulado"
                            : c.limiteTipo === "departamento"
                            ? `Limite estipulado para o departamento (${c.departamento})`
                            : "Limite padrão do cartório (5.0%)"
                        }
                      >
                        ({c.limiteTipo === "departamento" ? "depto" : c.limiteTipo})
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleAbrirFicha(c)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-semibold text-xs flex items-center gap-1 border border-cyan-500/30 transition-all active:scale-95"
                          title="Abrir Ficha de Feedback Individual"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ficha PDF</span>
                        </button>
                        {isGestor && (
                          <button
                            onClick={() => {
                              setLimiteForm((prev) => ({
                                ...prev,
                                tipoAlvo: "COLABORADOR",
                                colaboradorNome: c.nome.toUpperCase(),
                                departamento: c.departamento,
                                limitePercentual: c.limite,
                                competenciaInicio: competencia,
                              }));
                              setModalLimiteOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#151A2C] hover:bg-slate-700 text-xs text-slate-200 transition-all"
                            title="Alterar Limite de Erro"
                          >
                            Alterar Limite
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>

      {/* ══════════════════════════════════════════════════════════════════
           DRAWER 1: ALTERAR LIMITE DE ERRO (SUBSTITUTO)
           ══════════════════════════════════════════════════════════════════ */}
      {modalLimiteOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md h-full border-l border-slate-800 bg-[#111729] p-6 shadow-2xl text-white flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold tracking-tight">Alterar Limite de Erro</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {limiteForm.tipoAlvo === "DEPARTAMENTO"
                      ? "Configuração coletiva de limite para todos os colaboradores do departamento"
                      : "Padrão do cartório = 5.0% por tipo de retorno com vigência individual"}
                  </p>
                </div>
                <button
                  onClick={() => setModalLimiteOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Seletor de Escopo: Por Colaborador vs Por Departamento */}
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold">Tipo de Aplicação do Limite</label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0F1424] border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLimiteForm((prev) => ({ ...prev, tipoAlvo: "COLABORADOR" }))}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        limiteForm.tipoAlvo === "COLABORADOR"
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Por Colaborador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const depto = limiteForm.departamento || "Qualificação Registral";
                        setLimiteForm((prev) => ({
                          ...prev,
                          tipoAlvo: "DEPARTAMENTO",
                          departamento: depto,
                        }));
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        limiteForm.tipoAlvo === "DEPARTAMENTO"
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Por Departamento</span>
                    </button>
                  </div>
                </div>

                {limiteForm.tipoAlvo === "COLABORADOR" ? (
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Colaborador</label>
                    <select
                      value={limiteForm.colaboradorNome}
                      onChange={(e) => {
                        const colabSel = colaboradores.find((c) => c.nome === e.target.value);
                        setLimiteForm((prev) => ({
                          ...prev,
                          colaboradorNome: e.target.value,
                          departamento: colabSel?.departamento || prev.departamento,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white"
                    >
                      {colaboradores.map((c) => (
                        <option key={c.nome} value={c.nome.toUpperCase()}>
                          {c.nome.toUpperCase()} ({c.departamento})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Departamento / Setor</label>
                    <select
                      value={limiteForm.departamento}
                      onChange={(e) => setLimiteForm((prev) => ({ ...prev, departamento: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white"
                    >
                      {departamentosDisponiveis.map((d) => (
                        <option key={d} value={d}>
                          🏢 {d}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {limiteForm.tipoAlvo === "DEPARTAMENTO" && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>Equipe do Setor ({colaboradoresDoDeptoLimite.length} colaboradores)</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono">
                        {limiteForm.departamento}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      O limite de tolerância será aplicado coletivamente a todos os colaboradores deste departamento:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1 border-t border-amber-500/20">
                      {colaboradoresDoDeptoLimite.map((c) => (
                        <span
                          key={c.nome}
                          className="px-2 py-0.5 rounded bg-[#111729] text-[10px] font-mono text-amber-200 border border-amber-500/30"
                        >
                          {c.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipo de Retorno</label>
                  <select
                    value={limiteForm.tipoRetorno}
                    onChange={(e) => setLimiteForm({ ...limiteForm, tipoRetorno: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white"
                  >
                    <option value="TODOS">Todos os tipos</option>
                    <option value="TELA_RECEPCAO">TELA RECEPÇÃO</option>
                    <option value="PESSOAL">PESSOAL</option>
                    <option value="REAL">REAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    {limiteForm.tipoAlvo === "DEPARTAMENTO"
                      ? "Percentual Limite para o Setor (%)"
                      : "Percentual Limite (%)"}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={limiteForm.limitePercentual}
                    onChange={(e) => setLimiteForm({ ...limiteForm, limitePercentual: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {limiteForm.tipoAlvo === "DEPARTAMENTO"
                      ? `Define o limite máximo de ${limiteForm.limitePercentual}% para os membros de ${limiteForm.departamento}`
                      : "Percentual máximo tolerado antes de sinalizar alerta de qualidade"}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Competência de Início</label>
                  <input
                    type="month"
                    value={limiteForm.competenciaInicio}
                    onChange={(e) => setLimiteForm({ ...limiteForm, competenciaInicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setModalLimiteOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#151A2C] text-slate-400 text-xs hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarLimite}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
              >
                {limiteForm.tipoAlvo === "DEPARTAMENTO"
                  ? `Salvar Limite para o Departamento (${colaboradoresDoDeptoLimite.length})`
                  : "Salvar Limite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           DRAWER 3: REVISÃO DE CATEGORIA DE ERRO (AUDITORIA DE GESTÃO)
           ══════════════════════════════════════════════════════════════════ */}
      {modalRevisaoOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md h-full border-l border-slate-800 bg-[#111729] p-6 shadow-2xl text-white flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold tracking-tight">Revisar Categoria do Erro</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Auditoria e ajuste manual de causas</p>
                </div>
                <button
                  onClick={() => setModalRevisaoOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Protocolo</label>
                  <span className="font-mono text-cyan-400 font-bold text-sm">
                    {revisaoForm.numeroPrenotacao}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Observação Original (Inalterável)</label>
                  <p className="p-3 rounded-xl bg-[#070A14] border border-slate-800 text-slate-200 leading-relaxed font-sans">
                    {revisaoForm.observacao}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Categoria Automática</label>
                  <span className="px-2 py-1 rounded bg-[#151A2C] text-slate-300 font-mono block">
                    {revisaoForm.categoriaSugerida || "Outras Causas"}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nova Categoria Revisada pelo Gestor</label>
                  <select
                    value={revisaoForm.categoriaRevisada}
                    onChange={(e) => setRevisaoForm({ ...revisaoForm, categoriaRevisada: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white"
                  >
                    <option value="Qualificação das Partes">Qualificação das Partes</option>
                    <option value="Certidões & Documentação">Certidões & Documentação</option>
                    <option value="Tributos & ITBI">Tributos & ITBI</option>
                    <option value="Divergência Registral">Divergência Registral</option>
                    <option value="Firma & Representação">Firma & Representação</option>
                    <option value="Outras Causas">Outras Causas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Justificativa da Auditoria</label>
                  <textarea
                    rows={3}
                    value={revisaoForm.justificativa}
                    onChange={(e) => setRevisaoForm({ ...revisaoForm, justificativa: e.target.value })}
                    placeholder="Explique o motivo do ajuste na classificação do erro..."
                    className="w-full px-3 py-2 rounded-xl bg-[#151A2C] border border-slate-700 text-white font-sans placeholder-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setModalRevisaoOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#151A2C] text-slate-400 text-xs hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarRevisao}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                Salvar Revisão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           DRAWER 4: FICHA INDIVIDUAL DE DESEMPENHO (1-CLICK PDF)
           ══════════════════════════════════════════════════════════════════ */}
      {modalFichaOpen && selectedColab && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg h-full border-l border-slate-800 bg-[#111729] p-6 shadow-2xl text-white flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Header da Ficha */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                      FICHA INDIVIDUAL DE QUALIDADE
                    </span>
                    <span className="text-slate-400 text-xs">• {competencia}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1 uppercase">{selectedColab.nome.toUpperCase()}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedColab.atividade} • Origem {selectedColab.origem}
                  </p>
                </div>
                <button
                  onClick={() => setModalFichaOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cartões de Performance */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#151A2C] border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Produção Realizada</span>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{selectedColab.producao}</div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Prenotações concluídas
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Taxa de Erros</span>
                  <div
                    className={`text-xl font-bold font-mono mt-1 ${
                      selectedColab.dentroLimite ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {selectedColab.percentualErro}%
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {selectedColab.erros} erros (Limite: {selectedColab.limite}%)
                  </span>
                </div>
              </div>

              {/* Indicador de Conformidade e Auditoria */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  selectedColab.dentroLimite
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/25 text-rose-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {selectedColab.dentroLimite ? "Conformidade Atestada" : "Alerta de Limite Ultrapassado"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {selectedColab.dentroLimite
                    ? "O colaborador operou dentro do limite de tolerância estabelecido pelo cartório (5.0%) e cumpriu os critérios técnicos de conformidade registral."
                    : "O colaborador excedeu a margem de tolerância técnica pactuada para a competência. Recomenda-se alinhamento registral com o Oficial Substituto."}
                </p>
              </div>

              {/* Distribuição por Tipo de Retorno */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Erros por Tipo de Retorno
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-lg bg-[#151A2C] border border-slate-800">
                    <span className="text-[10px] text-cyan-400 block font-sans">TELA RECEPÇÃO</span>
                    <span className="font-bold text-white text-sm">{selectedColab.errosPorTipo.telaRecepcao}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151A2C] border border-slate-800">
                    <span className="text-[10px] text-blue-400 block font-sans">PESSOAL</span>
                    <span className="font-bold text-white text-sm">{selectedColab.errosPorTipo.pessoal}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151A2C] border border-slate-800">
                    <span className="text-[10px] text-purple-400 block font-sans">REAL</span>
                    <span className="font-bold text-white text-sm">{selectedColab.errosPorTipo.real}</span>
                  </div>
                </div>
              </div>

              {/* Histórico dos Últimos 3 Meses */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Histórico Trimestral de Qualidade
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-lg bg-[#151A2C] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Jul/26</span>
                    <span className="font-bold text-slate-200">138 prod.</span>
                    <span className="text-[10px] text-emerald-400 block">3.1% erro</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#151A2C] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Ago/26</span>
                    <span className="font-bold text-slate-200">129 prod.</span>
                    <span className="text-[10px] text-emerald-400 block">2.3% erro</span>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <span className="text-[10px] text-cyan-400 block font-bold">Set/26</span>
                    <span className="font-bold text-white">{selectedColab.producao} prod.</span>
                    <span className="text-[10px] text-emerald-400 block font-bold">
                      {selectedColab.percentualErro}% erro
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé da Ficha com Emissão de PDF */}
            <div className="pt-5 border-t border-slate-800 flex items-center justify-between mt-6">
              <span className="text-[11px] font-mono text-slate-500">FIORIX • 7º RI de São Paulo</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalFichaOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#151A2C] text-slate-400 text-xs hover:text-white"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setModalFichaOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Emitir PDF / Imprimir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
