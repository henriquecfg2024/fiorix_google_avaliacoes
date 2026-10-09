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
} from "lucide-react";

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
        setEventos(
          (data.eventos || []).map((ev: EventoItem) => ({
            ...ev,
            usuarioDestino: ev.usuarioDestino ? ev.usuarioDestino.toUpperCase() : "NÃO ATRIBUÍDO",
            usuarioOrigem: ev.usuarioOrigem ? ev.usuarioOrigem.toUpperCase() : "SISTEMA",
          }))
        );
        setTopCausas(data.topCausas || []);
        setEvolucaoMensal(data.evolucaoMensal || []);
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

  // Filtragem de Colaboradores na Tabela
  const colaboradoresFiltrados = useMemo(() => {
    let list = colaboradores;
    if (buscaColaborador.trim()) {
      const q = buscaColaborador.toLowerCase();
      list = list.filter((c) => c.nome.toLowerCase().includes(q) || c.departamento.toLowerCase().includes(q));
    }
    return list;
  }, [colaboradores, buscaColaborador]);

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

  // Resetar todos os filtros
  const handleResetFiltros = () => {
    setTipoRetorno("TODOS");
    setOrigem("TODOS");
    setFiltroCausa(null);
    setBuscaColaborador("");
    setBuscaGeral("");
    setCompetencia("2026-10");
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
        {/* 1. Prenotações (com Subtotal de Canceladas) */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Prenotações</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Safra Entrada
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-white">
              {kpis ? kpis.totalPrenotacoes.toLocaleString("pt-BR") : "2.582"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-300 font-semibold">
              {kpis ? kpis.totalAtivas.toLocaleString("pt-BR") : "2.510"} ativas
            </span>
            <span className="text-rose-400 font-semibold bg-rose-500/10 px-1 rounded">
              {kpis ? kpis.totalCanceladas : "72"} cancel.
            </span>
          </div>
        </div>

        {/* 2. Produção Total */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Produção Total</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Concluídas
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {kpis ? kpis.producaoTotal.toLocaleString("pt-BR") : "2.493"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">Caixa + Contraditório</span>
        </div>

        {/* 3. Saldo Faltante (Canceladas + Em Trâmite) */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Saldo Faltante</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/20">
              Trâmite + Cancel.
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-amber-300">
              {kpis ? (kpis.totalFaltante ?? Math.max(0, kpis.totalPrenotacoes - kpis.producaoTotal)).toLocaleString("pt-BR") : "89"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-rose-400 font-semibold bg-rose-500/10 px-1 rounded">
              {kpis ? kpis.totalCanceladas : "72"} cancel.
            </span>
            <span className="text-slate-300 font-semibold">
              {kpis ? (kpis.totalEmTramite ?? Math.max(0, (kpis.totalFaltante ?? 89) - kpis.totalCanceladas)) : "17"} em trâmite
            </span>
          </div>
        </div>

        {/* 4. Quantidade de Erros */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#111729] flex flex-col justify-between hover:bg-[#151A2C] transition-all">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Quantidade de Erros</span>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-rose-400">
              {kpis ? kpis.quantidadeErros : "34"}
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
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                    isAcima
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  Limite 5%
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
              <span
                className={`text-[10px] font-mono ${
                  isAcima ? "text-rose-400/90 font-semibold" : "text-emerald-400/80"
                }`}
              >
                {isAcima
                  ? "⚠️ Acima do Limite de 5.0%"
                  : `${kpis ? kpis.prenotacoesComErro : 34} / ${
                      kpis ? kpis.totalPrenotacoes.toLocaleString("pt-BR") : "2.582"
                    } no mês`}
              </span>
            </div>
          );
        })()}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           5. GRÁFICOS: EVOLUÇÃO MÊS A MÊS & TOP CAUSAS CLICÁVEIS
           ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico 1: Qualidade Mês a Mês (7 cols) */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Qualidade Mês a Mês (Evolução)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Percentual de erro
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span> % Erro
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400 border border-rose-400"></span> Limite 5%
              </span>
            </div>
          </div>

          <div className="h-52 w-full pt-4">
            <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradQualidade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="36" x2="500" y2="36" stroke="#1E293B" strokeDasharray="3 3" />
              <line x1="0" y1="72" x2="500" y2="72" stroke="#1E293B" strokeDasharray="3 3" />
              <line x1="0" y1="108" x2="500" y2="108" stroke="#1E293B" strokeDasharray="3 3" />
              <line x1="0" y1="144" x2="500" y2="144" stroke="#1E293B" strokeDasharray="3 3" />

              {/* Linha Limite 5.0% */}
              <line x1="0" y1="72" x2="500" y2="72" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="440" y="66" fill="#F43F5E" fontSize="10" fontFamily="JetBrains Mono">
                Limite: 5%
              </text>

              {/* Área e Linha da Curva de Qualidade Dinâmica */}
              {polygonPoints && <polygon points={polygonPoints} fill="url(#gradQualidade)" />}
              {polylinePoints && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="2.5"
                />
              )}

              {/* Pontos da Série Dinâmicos */}
              {pontosGrafico.map((p, idx) => (
                <g key={p.mes}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={idx === pontosGrafico.length - 1 ? 5.5 : 4}
                    fill={idx === pontosGrafico.length - 1 ? "#22D3EE" : "#06B6D4"}
                    stroke="#0F172A"
                    strokeWidth="1.5"
                  />
                  <text
                    x={p.x}
                    y={p.y - 8}
                    fill={idx === pontosGrafico.length - 1 ? "#22D3EE" : "#94A3B8"}
                    fontSize="10"
                    fontWeight={idx === pontosGrafico.length - 1 ? "bold" : "normal"}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {p.percentualErro}%
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
            {evolucaoMensal.map((item, idx) => (
              <span
                key={item.mes}
                className={idx === evolucaoMensal.length - 1 ? "text-cyan-400 font-semibold" : ""}
              >
                {item.label} ({item.percentualErro}%)
              </span>
            ))}
          </div>
        </section>

        {/* Gráfico 2: Top Causas de Erro Clicáveis (5 cols) */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#111729] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <span>Top Causas dos Erros Internos</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                  Clicável para filtrar
                </span>
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
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 group-hover:text-white transition-colors">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor }}></span>
                      <span>{c.nome}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200 font-semibold">
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
                  <span className="text-[10px] text-slate-400 block truncate">{c.exemplos}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
           6. DETALHAMENTO DOS EVENTOS DE RETORNO (DESTAQUE PRINCIPAL)
           ══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border-2 border-cyan-500/40 bg-[#111729] p-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-cyan-500/20 space-y-4 relative overflow-hidden">
        {/* Barra superior de destaque com gradiente */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-md">
              <AlertTriangle className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Detalhamento dos Eventos de Retorno (Erros Internos)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
                  {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}
                </span>
                {filtroCausa && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm">
                    <span>Filtro Causa: {filtroCausa}</span>
                    <button onClick={() => setFiltroCausa(null)} className="text-amber-300 hover:text-white" title="Limpar filtro">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cada linha representa um retorno interno apontado no protocolo (Responsável = destino do retorno)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20 shrink-0 shadow-sm">
            {eventos.length} eventos no período
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-sans">
                <th className="pb-3 pr-4">Prenotação</th>
                <th className="pb-3 px-3">Data Entrada</th>
                <th className="pb-3 px-3">Data Retorno</th>
                <th className="pb-3 px-3">Tipo</th>
                <th className="pb-3 px-3">Responsável Erro</th>
                <th className="pb-3 px-3">Origem</th>
                <th className="pb-3 px-3">Observação Original</th>
                <th className="pb-3 px-3">Categoria</th>
                {isGestor && <th className="pb-3 pl-3 text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {eventos.map((ev) => (
                <tr key={ev.idAndamento} className="hover:bg-[#151A2C] transition-colors">
                  <td className="py-3 pr-4 font-bold text-white">{ev.numeroPrenotacao}</td>
                  <td className="py-3 px-3">{ev.dataEntrada}</td>
                  <td className="py-3 px-3 text-slate-200">{ev.dataRetorno}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        ev.idTipoRetorno === 292
                          ? "bg-cyan-500/15 text-cyan-300"
                          : ev.idTipoRetorno === 294
                          ? "bg-blue-500/15 text-blue-300"
                          : "bg-purple-500/15 text-purple-300"
                      }`}
                    >
                      {ev.tipoRetorno}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-white uppercase">{ev.usuarioDestino.toUpperCase()}</td>
                  <td className="py-3 px-3">{ev.origem}</td>
                  <td className="py-3 px-3 font-sans text-slate-300 max-w-xs truncate" title={ev.observacao}>
                    {ev.observacao}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {ev.categoria}
                    </span>
                  </td>
                  {isGestor && (
                    <td className="py-3 pl-3 text-right">
                      <button
                        onClick={() => handleAbrirRevisao(ev)}
                        className="text-xs text-purple-400 hover:underline font-semibold"
                      >
                        Revisar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           7. TABELA "INDICADORES POR COLABORADOR" (OCULTO POR PADRÃO)
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
          <div className="overflow-x-auto pt-2 border-t border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-sans">
                  <th className="pb-3 pr-4">Colaborador</th>
                  <th className="pb-3 px-3">Atividade</th>
                  <th className="pb-3 px-3">Origem</th>
                  <th className="pb-3 px-3">Produção</th>
                  <th className="pb-3 px-3">Erros</th>
                  <th className="pb-3 px-3">% Erro</th>
                  <th className="pb-3 px-3">Limite Permitido</th>
                  <th className="pb-3 pl-3 text-right">Ações & Ficha</th>
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
