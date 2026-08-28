"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FiorixKpiCard } from "@/components/fiorix/FiorixKpiCard";

interface TarefaRecord {
  protocolo: number;
  seqTitulo: number;
  dataEntrada: string | null;
  dtPrevisao: string | null;
  diasParaPrevisao: number;
  statusPrevisao: string;
  nivelRisco: string;
  idServico: string | null;
  numeroServico: string | null;
  itemServico: string | null;
  dataServico: string | null;
  vencimentoServico: string | null;
  idTarefa: string;
  tarefa: string;
  dataCadastroTarefa: string | null;
  statusTarefa: string | null;
  dataAbertura: string | null;
  dataFinalizacao: string | null;
  situacaoTarefa: string;
  idUsuario: string | null;
  responsavel: string;
  tipo: string;
  natureza: string;
}

type KpiFilter =
  | "VENCEM_HOJE"
  | "VENCEM_AMANHA"
  | "PROXIMOS_3_DIAS"
  | "ATRASADOS"
  | "RISCO_CRITICO"
  | "EM_ANDAMENTO";

type SortKey =
  | "protocolo"
  | "dtPrevisao"
  | "statusPrevisao"
  | "nivelRisco"
  | "tarefa"
  | "responsavel"
  | "situacaoTarefa"
  | "tipoNatureza";

type SortDirection = "asc" | "desc";

const tarefaCollator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

const kpiFilterLabels: Record<KpiFilter, string> = {
  VENCEM_HOJE: "Vencem Hoje",
  VENCEM_AMANHA: "Vencem Amanhã",
  PROXIMOS_3_DIAS: "Próximos 3 Dias",
  ATRASADOS: "Atrasados",
  RISCO_CRITICO: "Risco Crítico",
  EM_ANDAMENTO: "Em Andamento",
};

function matchesKpiFilter(
  tarefa: TarefaRecord,
  filter: KpiFilter | null,
  todayStr: string,
  tomorrowStr: string
) {
  if (!filter) return true;

  const situacao = (tarefa.situacaoTarefa || "").trim().toUpperCase();
  const statusPrev = (tarefa.statusPrevisao || "").trim().toUpperCase();
  const risco = (tarefa.nivelRisco || "").trim().toUpperCase();
  const dtStr = tarefa.dtPrevisao?.split("T")[0] || "";

  if (filter === "VENCEM_HOJE") return dtStr === todayStr;
  if (filter === "VENCEM_AMANHA") return dtStr === tomorrowStr;

  if (filter === "PROXIMOS_3_DIAS") {
    if (!tarefa.dtPrevisao) return false;
    const dNow = new Date();
    dNow.setHours(0, 0, 0, 0);
    const d3DaysLater = new Date(dNow);
    d3DaysLater.setDate(d3DaysLater.getDate() + 3);
    const dPrev = new Date(tarefa.dtPrevisao);
    dPrev.setHours(0, 0, 0, 0);
    return dPrev >= dNow && dPrev <= d3DaysLater;
  }

  if (filter === "ATRASADOS") return statusPrev === "ATRASADO" || statusPrev === "ESTOURADO";
  if (filter === "RISCO_CRITICO") return risco === "CRITICO" || risco === "CRÍTICO" || risco === "ALTO";

  return situacao === "EM ANDAMENTO" || situacao === "ABERTA" || situacao === "PENDENTE";
}

const taskPanelClass =
  "rounded-2xl border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)]";

function escapePrintValue(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function TarefasDashboardClient() {
  const [tarefas, setTarefas] = useState<TarefaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRangeDays, setFilterRangeDays] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarefa, setSelectedTarefa] = useState<string>("ALL");
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("ALL");
  const [selectedRisco, setSelectedRisco] = useState<string>("ALL");
  const [selectedStatusPrevisao, setSelectedStatusPrevisao] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeKpiFilter, setActiveKpiFilter] = useState<KpiFilter | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/bi/tarefas/data");
      const data = await res.json();
      if (data.success) {
        setTarefas(data.tarefas || []);
      } else {
        toast.error("Erro ao carregar dados de tarefas: " + (data.error || ""));
      }
    } catch (err: any) {
      toast.error("Falha ao comunicar com o servidor: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Datas de referência
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  // Métricas dos 6 KPI Cards
  const kpis = useMemo(() => {
    const hojeProtSet = new Set<number>();
    const amanhaProtSet = new Set<number>();
    const prox3DiasProtSet = new Set<number>();
    const atrasadosProtSet = new Set<number>();
    const riscoCriticoProtSet = new Set<number>();
    let tarefasEmAndamentoCount = 0;

    const dNow = new Date();
    dNow.setHours(0, 0, 0, 0);

    const d3DaysLater = new Date(dNow);
    d3DaysLater.setDate(d3DaysLater.getDate() + 3);

    tarefas.forEach((t) => {
      const p = t.protocolo;
      const situacao = (t.situacaoTarefa || "").trim().toUpperCase();
      const statusPrev = (t.statusPrevisao || "").trim().toUpperCase();
      const risco = (t.nivelRisco || "").trim().toUpperCase();

      if (situacao === "EM ANDAMENTO" || situacao === "ABERTA" || situacao === "PENDENTE") {
        tarefasEmAndamentoCount++;
      }

      if (statusPrev === "ATRASADO" || statusPrev === "ESTOURADO") {
        if (p > 0) atrasadosProtSet.add(p);
      }

      if (risco === "CRITICO" || risco === "CRÍTICO" || risco === "ALTO") {
        if (p > 0) riscoCriticoProtSet.add(p);
      }

      if (t.dtPrevisao) {
        const dtStr = t.dtPrevisao.split("T")[0];
        if (dtStr === todayStr && p > 0) hojeProtSet.add(p);
        if (dtStr === tomorrowStr && p > 0) amanhaProtSet.add(p);

        const dPrev = new Date(t.dtPrevisao);
        dPrev.setHours(0, 0, 0, 0);
        if (dPrev >= dNow && dPrev <= d3DaysLater && p > 0) {
          prox3DiasProtSet.add(p);
        }
      }
    });

    return {
      vencemHoje: hojeProtSet.size,
      vencemAmanha: amanhaProtSet.size,
      prox3Dias: prox3DiasProtSet.size,
      atrasados: atrasadosProtSet.size,
      riscoCritico: riscoCriticoProtSet.size,
      tarefasEmAndamento: tarefasEmAndamentoCount,
    };
  }, [tarefas, todayStr, tomorrowStr]);

  // Gráfico 1: Previsão de Protocolos por Dia
  const chartPrevisaoPorDia = useMemo(() => {
    const mapDays: Record<string, Set<number>> = {};
    const dNow = new Date();
    dNow.setHours(0, 0, 0, 0);

    for (let i = 0; i < filterRangeDays; i++) {
      const d = new Date(dNow);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      mapDays[key] = new Set<number>();
    }

    tarefas.forEach((t) => {
      if (t.dtPrevisao && t.protocolo > 0) {
        const dtKey = t.dtPrevisao.split("T")[0];
        if (mapDays[dtKey]) {
          mapDays[dtKey].add(t.protocolo);
        }
      }
    });

    return Object.entries(mapDays).map(([dateStr, protSet]) => {
      const [y, m, d] = dateStr.split("-");
      return {
        dataLabel: `${d}/${m}`,
        fullDate: dateStr,
        protocolos: protSet.size,
      };
    });
  }, [tarefas, filterRangeDays]);

  // Gráfico 2: Carga Atual por Tarefa
  const chartCargaPorTarefa = useMemo(() => {
    const mapTarefas: Record<string, { tarefasCount: number; protSet: Set<number> }> = {};

    tarefas.forEach((t) => {
      const name = (t.tarefa || "Outros").trim().toUpperCase();
      if (!mapTarefas[name]) {
        mapTarefas[name] = { tarefasCount: 0, protSet: new Set<number>() };
      }
      mapTarefas[name].tarefasCount++;
      if (t.protocolo > 0) mapTarefas[name].protSet.add(t.protocolo);
    });

    return Object.entries(mapTarefas)
      .map(([nome, val]) => ({
        nome,
        tarefasCount: val.tarefasCount,
        protocolos: val.protSet.size,
      }))
      .sort((a, b) => b.tarefasCount - a.tarefasCount)
      .slice(0, 10);
  }, [tarefas]);

  // Lista de Opções para Filtros
  const listaTarefasUnicas = useMemo(() => {
    const setT = new Set<string>();
    tarefas.forEach((t) => t.tarefa && setT.add(t.tarefa.trim().toUpperCase()));
    return Array.from(setT).sort();
  }, [tarefas]);

  const listaResponsaveisUnicos = useMemo(() => {
    const setR = new Set<string>();
    tarefas.forEach((t) => t.responsavel && setR.add(t.responsavel.trim()));
    return Array.from(setR).sort();
  }, [tarefas]);

  // Tabela Sintética: Carga por Responsável
  const cargaPorResponsavel = useMemo(() => {
    const mapResp: Record<
      string,
      {
        responsavel: string;
        tarefasCount: number;
        protSet: Set<number>;
        vencemHoje: Set<number>;
        vencemAmanha: Set<number>;
        riscoCritico: Set<number>;
      }
    > = {};

    tarefas.filter((t) => matchesKpiFilter(t, activeKpiFilter, todayStr, tomorrowStr)).forEach((t) => {
      const resp = (t.responsavel || "Não Atribuído").trim();
      if (!mapResp[resp]) {
        mapResp[resp] = {
          responsavel: resp,
          tarefasCount: 0,
          protSet: new Set<number>(),
          vencemHoje: new Set<number>(),
          vencemAmanha: new Set<number>(),
          riscoCritico: new Set<number>(),
        };
      }

      mapResp[resp].tarefasCount++;
      if (t.protocolo > 0) {
        mapResp[resp].protSet.add(t.protocolo);
        if (t.dtPrevisao) {
          const dtStr = t.dtPrevisao.split("T")[0];
          if (dtStr === todayStr) mapResp[resp].vencemHoje.add(t.protocolo);
          if (dtStr === tomorrowStr) mapResp[resp].vencemAmanha.add(t.protocolo);
        }
        const risco = (t.nivelRisco || "").toUpperCase();
        if (risco === "CRITICO" || risco === "CRÍTICO" || risco === "ALTO") {
          mapResp[resp].riscoCritico.add(t.protocolo);
        }
      }
    });

    return Object.values(mapResp)
      .map((r) => ({
        responsavel: r.responsavel,
        tarefasCount: r.tarefasCount,
        protocolos: r.protSet.size,
        vencemHoje: r.vencemHoje.size,
        vencemAmanha: r.vencemAmanha.size,
        riscoCritico: r.riscoCritico.size,
      }))
      .sort((a, b) => b.tarefasCount - a.tarefasCount);
  }, [tarefas, todayStr, tomorrowStr, activeKpiFilter]);

  const responsaveisExibidos = activeKpiFilter ? cargaPorResponsavel : cargaPorResponsavel.slice(0, 10);

  // Tabela Filtrada de Tarefas
  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const protStr = String(t.protocolo);
        const respStr = (t.responsavel || "").toLowerCase();
        const tarStr = (t.tarefa || "").toLowerCase();
        const natStr = (t.natureza || "").toLowerCase();
        const tipoStr = (t.tipo || "").toLowerCase();

        if (
          !protStr.includes(q) &&
          !respStr.includes(q) &&
          !tarStr.includes(q) &&
          !natStr.includes(q) &&
          !tipoStr.includes(q)
        ) {
          return false;
        }
      }

      if (selectedTarefa !== "ALL" && t.tarefa.trim().toUpperCase() !== selectedTarefa) {
        return false;
      }

      if (selectedResponsavel !== "ALL" && t.responsavel.trim() !== selectedResponsavel) {
        return false;
      }

      if (selectedRisco !== "ALL") {
        const r = (t.nivelRisco || "").toUpperCase();
        if (selectedRisco === "CRITICO" && !r.includes("CRITIC")) return false;
        if (selectedRisco === "NORMAL" && r.includes("CRITIC")) return false;
      }

      if (selectedStatusPrevisao !== "ALL") {
        const s = (t.statusPrevisao || "").toUpperCase();
        if (selectedStatusPrevisao === "ATRASADO" && !s.includes("ATRASAD")) return false;
        if (selectedStatusPrevisao === "NO_PRAZO" && s.includes("ATRASAD")) return false;
      }

      if (!matchesKpiFilter(t, activeKpiFilter, todayStr, tomorrowStr)) return false;

      return true;
    });
  }, [
    tarefas,
    searchQuery,
    selectedTarefa,
    selectedResponsavel,
    selectedRisco,
    selectedStatusPrevisao,
    activeKpiFilter,
    todayStr,
    tomorrowStr,
  ]);

  const tarefasOrdenadas = useMemo(() => {
    if (!sortConfig) return tarefasFiltradas;

    const getSortValue = (tarefa: TarefaRecord): string | number | null => {
      switch (sortConfig.key) {
        case "protocolo":
          return tarefa.protocolo;
        case "dtPrevisao": {
          if (!tarefa.dtPrevisao) return null;
          const timestamp = new Date(tarefa.dtPrevisao).getTime();
          return Number.isNaN(timestamp) ? null : timestamp;
        }
        case "statusPrevisao":
          return (tarefa.statusPrevisao || "").toUpperCase().includes("ATRASAD")
            ? "ATRASADO"
            : "NO PRAZO";
        case "nivelRisco":
          return (tarefa.nivelRisco || "").toUpperCase().includes("CRITIC")
            ? "CRITICO"
            : "NORMAL";
        case "tarefa":
          return tarefa.tarefa;
        case "responsavel":
          return tarefa.responsavel;
        case "situacaoTarefa":
          return tarefa.situacaoTarefa;
        case "tipoNatureza":
          return `${tarefa.tipo || ""} ${tarefa.natureza || ""}`.trim();
      }
    };

    return tarefasFiltradas
      .map((tarefa, originalIndex) => ({ tarefa, originalIndex }))
      .sort((a, b) => {
        const valueA = getSortValue(a.tarefa);
        const valueB = getSortValue(b.tarefa);

        const isEmptyA = valueA === null || valueA === "";
        const isEmptyB = valueB === null || valueB === "";
        if (isEmptyA && isEmptyB) return a.originalIndex - b.originalIndex;
        if (isEmptyA) return 1;
        if (isEmptyB) return -1;

        const comparison =
          typeof valueA === "number" && typeof valueB === "number"
            ? valueA - valueB
            : tarefaCollator.compare(String(valueA), String(valueB));

        if (comparison === 0) return a.originalIndex - b.originalIndex;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      })
      .map(({ tarefa }) => tarefa);
  }, [tarefasFiltradas, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(tarefasOrdenadas.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startItem = tarefasOrdenadas.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(safeCurrentPage * pageSize, tarefasOrdenadas.length);
  const tarefasPaginadas = useMemo(
    () => tarefasOrdenadas.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [tarefasOrdenadas, safeCurrentPage, pageSize]
  );

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />;
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
    );
  };

  const getAriaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortConfig?.key !== key) return "none";
    return sortConfig.direction === "asc" ? "ascending" : "descending";
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTarefa, selectedResponsavel, selectedRisco, selectedStatusPrevisao, activeKpiFilter, pageSize]);

  const handleKpiFilter = (filter: KpiFilter) => {
    const nextFilter = activeKpiFilter === filter ? null : filter;
    setActiveKpiFilter(nextFilter);
    if (nextFilter) {
      setSearchQuery("");
      setSelectedTarefa("ALL");
      setSelectedResponsavel("ALL");
      setSelectedRisco("ALL");
      setSelectedStatusPrevisao("ALL");
    }
    setCurrentPage(1);
    window.requestAnimationFrame(() => {
      document.getElementById("tarefas-detalhamento")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Exportação CSV
  const handleExportCSV = () => {
    if (tarefasFiltradas.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const headers = [
      "PROTOCOLO",
      "SEQ_TITULO",
      "DT_PREVISAO",
      "STATUS_PREVISAO",
      "NIVEL_RISCO",
      "TAREFA",
      "RESPONSAVEL",
      "SITUACAO_TAREFA",
      "DATA_ABERTURA",
      "TIPO",
      "NATUREZA",
    ];

    const csvRows = [
      headers.join(";"),
      ...tarefasOrdenadas.map((r) =>
        [
          r.protocolo,
          r.seqTitulo,
          r.dtPrevisao ? new Date(r.dtPrevisao).toLocaleDateString("pt-BR") : "-",
          r.statusPrevisao,
          r.nivelRisco,
          `"${r.tarefa || ""}"`,
          `"${r.responsavel || ""}"`,
          r.situacaoTarefa,
          r.dataAbertura ? new Date(r.dataAbertura).toLocaleDateString("pt-BR") : "-",
          `"${r.tipo || ""}"`,
          `"${r.natureza || ""}"`,
        ].join(";")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fiorix_tarefas_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório CSV de Tarefas exportado com sucesso!");
  };

  const handlePrintReport = () => {
    if (tarefasFiltradas.length === 0) {
      toast.error("Nenhum registro para imprimir com os filtros atuais.");
      return;
    }

    const criticality =
      activeKpiFilter === "RISCO_CRITICO" || selectedRisco === "CRITICO"
        ? "Crítico / Alto"
        : selectedRisco === "NORMAL"
          ? "Normal / Baixo"
          : "Todas as criticidades";
    const rows = tarefasOrdenadas
      .map(
        (row) => `<tr>
          <td>#${escapePrintValue(row.protocolo)}</td>
          <td>${escapePrintValue(row.dtPrevisao ? new Date(row.dtPrevisao).toLocaleDateString("pt-BR") : "-")}</td>
          <td>${escapePrintValue(row.statusPrevisao)}</td>
          <td>${escapePrintValue(row.nivelRisco)}</td>
          <td>${escapePrintValue(row.tarefa)}</td>
          <td>${escapePrintValue(row.responsavel)}</td>
          <td>${escapePrintValue(row.situacaoTarefa)}</td>
          <td>${escapePrintValue(`${row.tipo}${row.natureza ? ` • ${row.natureza}` : ""}`)}</td>
        </tr>`
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) {
      toast.error("Permita pop-ups para imprimir o relatório.");
      return;
    }

    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Relatório de Tarefas — ${escapePrintValue(criticality)}</title>
      <style>
        @page { size: landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; font: 10px Arial, sans-serif; }
        h1 { margin: 0 0 4px; font-size: 18px; }
        p { margin: 0 0 14px; color: #4b5563; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 7px 6px; border: 1px solid #cbd5e1; background: #e5e7eb; text-align: left; font-size: 9px; text-transform: uppercase; }
        td { padding: 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        footer { margin-top: 12px; color: #64748b; font-size: 9px; }
      </style></head><body>
      <h1>Relatório de Tarefas por Criticidade</h1>
      <p>Criticidade: <strong>${escapePrintValue(criticality)}</strong> · ${tarefasFiltradas.length.toLocaleString("pt-BR")} registros · Gerado em ${escapePrintValue(new Date().toLocaleString("pt-BR"))}</p>
      <table><thead><tr><th>Protocolo</th><th>Previsão</th><th>Status</th><th>Nível de risco</th><th>Tarefa</th><th>Responsável</th><th>Situação</th><th>Tipo / Natureza</th></tr></thead><tbody>${rows}</tbody></table>
      <footer>FIORIX · Relatório gerado a partir dos filtros aplicados na tela Tarefas.</footer>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Botão de Atualizar */}
      <div className="flex justify-end">
        <Button
          onClick={fetchData}
          disabled={isLoading}
          variant="outline"
          className="h-9 gap-2 rounded-xl border-white/8 bg-white/[0.04] text-xs font-medium text-white shadow-sm hover:bg-white/[0.08]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar Previsões
        </Button>
      </div>

      {/* 6 KPI Cards no Padrão Oficial FIORIX */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <FiorixKpiCard
          title="Vencem Hoje"
          value={kpis.vencemHoje}
          subtitle="Protocolos com previsão de entrega hoje"
          variant="danger"
          icon={Clock}
          onClick={() => handleKpiFilter("VENCEM_HOJE")}
          isActive={activeKpiFilter === "VENCEM_HOJE"}
        />
        <FiorixKpiCard
          title="Vencem Amanhã"
          value={kpis.vencemAmanha}
          subtitle="Protocolos com previsão de entrega amanhã"
          variant="warning"
          icon={Calendar}
          onClick={() => handleKpiFilter("VENCEM_AMANHA")}
          isActive={activeKpiFilter === "VENCEM_AMANHA"}
        />
        <FiorixKpiCard
          title="Próximos 3 Dias"
          value={kpis.prox3Dias}
          subtitle="Protocolos com entrega nos próximos 3 dias"
          variant="default"
          icon={Layers}
          onClick={() => handleKpiFilter("PROXIMOS_3_DIAS")}
          isActive={activeKpiFilter === "PROXIMOS_3_DIAS"}
        />
        <FiorixKpiCard
          title="Atrasados"
          value={kpis.atrasados}
          subtitle="Protocolos com previsão de entrega estourada"
          variant="danger"
          icon={AlertTriangle}
          onClick={() => handleKpiFilter("ATRASADOS")}
          isActive={activeKpiFilter === "ATRASADOS"}
        />
        <FiorixKpiCard
          title="Risco Crítico"
          value={kpis.riscoCritico}
          subtitle="Tarefas com nível de risco crítico"
          variant="danger"
          icon={AlertTriangle}
          onClick={() => handleKpiFilter("RISCO_CRITICO")}
          isActive={activeKpiFilter === "RISCO_CRITICO"}
        />
        <FiorixKpiCard
          title="Em Andamento"
          value={kpis.tarefasEmAndamento}
          subtitle="Total de tarefas operacionais ativas"
          variant="success"
          icon={CheckCircle2}
          onClick={() => handleKpiFilter("EM_ANDAMENTO")}
          isActive={activeKpiFilter === "EM_ANDAMENTO"}
        />
      </div>

      {/* Painel Duplo de Gráficos Analíticos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Gráfico 1: Previsão por Dia */}
        <section className={`${taskPanelClass} space-y-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Calendar className="h-4 w-4 text-purple-400" />
                Previsão de Protocolos por Dia
              </h2>
              <p className="text-xs text-white/50">Volume previsto de entregas de recepção</p>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-1">
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setFilterRangeDays(days)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    filterRangeDays === days
                      ? "bg-purple-500/25 text-purple-100 shadow-sm"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full min-w-0 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPrevisaoPorDia}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="dataLabel" stroke="#ffffff50" fontSize={11} tickLine={false} />
                <YAxis stroke="#ffffff50" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B1020",
                    borderColor: "#ffffff20",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  formatter={(val: any) => [`${val} protocolos`, "Quantidade"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                />
                <Area
                  type="monotone"
                  dataKey="protocolos"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#purpleGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Gráfico 2: Carga por Tarefa */}
        <section className={`${taskPanelClass} space-y-4`}>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Layers className="h-4 w-4 text-cyan-400" />
              Carga Atual por Tarefa
            </h2>
            <p className="text-xs text-white/50">Distribuição de tarefas abertas por fase</p>
          </div>

          <div className="h-64 w-full min-w-0 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCargaPorTarefa} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="nome" stroke="#ffffff50" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#ffffff50" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B1020",
                    borderColor: "#ffffff20",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  formatter={(val: any) => [`${val} tarefas`, "Quantidade"]}
                />
                <Bar dataKey="tarefasCount" fill="#06B6D4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Seção Sintética: Carga por Responsável */}
      <section className={`${taskPanelClass} space-y-4`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 text-amber-300" />
            <div>
              <h2 className="text-base font-semibold text-white">Carga por Responsável</h2>
              {activeKpiFilter && (
                <p className="mt-0.5 text-xs text-white/50">
                  {cargaPorResponsavel.length.toLocaleString("pt-BR")} responsáveis afetados pelo filtro selecionado
                </p>
              )}
            </div>
          </div>
          {activeKpiFilter && (
            <span className="self-start rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200 sm:self-auto">
              {kpiFilterLabels[activeKpiFilter]}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0B1020]/72">
          <table className="w-full text-left text-xs">
            <thead className="select-none border-b border-white/8 bg-[#0B1020] text-[11px] uppercase tracking-wider text-white/58">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Responsável</th>
                <th className="px-4 py-3.5 text-center font-semibold">Tarefas Abertas</th>
                <th className="px-4 py-3.5 text-center font-semibold">Protocolos Distintos</th>
                <th className="px-4 py-3.5 text-center font-semibold">Vencem Hoje</th>
                <th className="px-4 py-3.5 text-center font-semibold">Vencem Amanhã</th>
                <th className="px-4 py-3.5 text-center font-semibold">Risco Crítico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {responsaveisExibidos.map((row, idx) => (
                <tr key={idx} className="transition-colors hover:bg-white/[0.035]">
                  <td className="py-3 px-4 font-semibold text-white">{row.responsavel}</td>
                  <td className="py-3 px-4 text-center font-bold text-cyan-300">{row.tarefasCount}</td>
                  <td className="py-3 px-4 text-center text-purple-300">{row.protocolos}</td>
                  <td className="py-3 px-4 text-center">
                    {row.vencemHoje > 0 ? (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">{row.vencemHoje}</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.vencemAmanha > 0 ? (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">{row.vencemAmanha}</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.riscoCritico > 0 ? (
                      <Badge className="bg-red-600/30 text-red-200 border-red-500">{row.riscoCritico}</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {responsaveisExibidos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-white/40">
                    Nenhum responsável afetado pelo filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tabela Detalhada com Filtros */}
      <section
        id="tarefas-detalhamento"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/12 bg-[#0B1020]/72 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
      >
        <div className="flex flex-col gap-4 border-b border-white/8 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Filter className="h-4 w-4 text-purple-400" />
              Detalhamento de Tarefas e Previsões
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs text-white/50">
                Exibindo {tarefasFiltradas.length.toLocaleString("pt-BR")} de {tarefas.length.toLocaleString("pt-BR")} tarefas encontradas
              </p>
              {activeKpiFilter && (
                <button
                  type="button"
                  onClick={() => setActiveKpiFilter(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200 transition-colors hover:bg-purple-400/15"
                  title="Remover filtro rápido"
                >
                  Filtro: {kpiFilterLabels[activeKpiFilter]}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <Button
              onClick={handlePrintReport}
              variant="outline"
              className="h-9 gap-2 rounded-xl border-white/8 bg-white/[0.04] text-xs font-medium text-white shadow-sm hover:bg-white/[0.08]"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Criticidade
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="h-9 gap-2 rounded-xl border-emerald-500/20 bg-emerald-500/10 text-xs font-medium text-emerald-300 shadow-sm hover:bg-emerald-500/15"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Filtrados (CSV)
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 gap-3 border-b border-white/8 bg-[#0B1020]/92 px-6 py-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Busca por Protocolo / Texto */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Buscar protocolo, responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/8 bg-[#0C1323] pl-9 pr-3 text-xs text-white shadow-sm placeholder:text-white/40 focus:border-purple-400 focus:outline-none"
            />
          </div>

          {/* Filtro por Tarefa */}
          <select
            value={selectedTarefa}
            onChange={(e) => setSelectedTarefa(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/8 bg-[#0C1323] px-3 text-xs text-white shadow-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="ALL">Todas as Tarefas</option>
            {listaTarefasUnicas.map((tar) => (
              <option key={tar} value={tar}>
                {tar}
              </option>
            ))}
          </select>

          {/* Filtro por Responsável */}
          <select
            value={selectedResponsavel}
            onChange={(e) => setSelectedResponsavel(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/8 bg-[#0C1323] px-3 text-xs text-white shadow-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="ALL">Todos os Responsáveis</option>
            {listaResponsaveisUnicos.map((resp) => (
              <option key={resp} value={resp}>
                {resp}
              </option>
            ))}
          </select>

          {/* Filtro por Status Previsão */}
          <select
            value={selectedStatusPrevisao}
            onChange={(e) => setSelectedStatusPrevisao(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/8 bg-[#0C1323] px-3 text-xs text-white shadow-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ATRASADO">Somente Atrasados</option>
            <option value="NO_PRAZO">No Prazo</option>
          </select>

          {/* Filtro por Risco */}
          <select
            value={selectedRisco}
            onChange={(e) => setSelectedRisco(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/8 bg-[#0C1323] px-3 text-xs text-white shadow-sm focus:border-purple-400 focus:outline-none"
          >
            <option value="ALL">Todos os Riscos</option>
            <option value="CRITICO">Risco Crítico / Alto</option>
            <option value="NORMAL">Normal / Baixo</option>
          </select>
        </div>

        {/* Tabela de Dados */}
        <div className="max-h-[600px] overflow-auto bg-[#0B1020]/72 [scrollbar-color:rgba(148,163,184,0.55)_transparent] [scrollbar-width:thin]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 select-none border-b border-white/8 bg-[#0B1020] text-[11px] uppercase tracking-wider text-white/58 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
              <tr>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("protocolo")}>
                  <button type="button" onClick={() => handleSort("protocolo")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por protocolo">
                    Protocolo {renderSortIcon("protocolo")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("dtPrevisao")}>
                  <button type="button" onClick={() => handleSort("dtPrevisao")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por previsão">
                    Previsão {renderSortIcon("dtPrevisao")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("statusPrevisao")}>
                  <button type="button" onClick={() => handleSort("statusPrevisao")} className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por status da previsão">
                    Status Previsão {renderSortIcon("statusPrevisao")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("nivelRisco")}>
                  <button type="button" onClick={() => handleSort("nivelRisco")} className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por nível de risco">
                    Nível Risco {renderSortIcon("nivelRisco")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("tarefa")}>
                  <button type="button" onClick={() => handleSort("tarefa")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por tarefa">
                    Tarefa {renderSortIcon("tarefa")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("responsavel")}>
                  <button type="button" onClick={() => handleSort("responsavel")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por responsável">
                    Responsável {renderSortIcon("responsavel")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("situacaoTarefa")}>
                  <button type="button" onClick={() => handleSort("situacaoTarefa")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por situação">
                    Situação {renderSortIcon("situacaoTarefa")}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" aria-sort={getAriaSort("tipoNatureza")}>
                  <button type="button" onClick={() => handleSort("tipoNatureza")} className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70" title="Ordenar por tipo e natureza">
                    Tipo / Natureza {renderSortIcon("tipoNatureza")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/50">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-purple-400" />
                    Carregando dados de previsão de tarefas...
                  </td>
                </tr>
              ) : tarefasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/50">
                    Nenhuma tarefa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                tarefasPaginadas.map((row, idx) => {
                  const isAtrasado = (row.statusPrevisao || "").toUpperCase().includes("ATRASAD");
                  const isCritico = (row.nivelRisco || "").toUpperCase().includes("CRITIC");

                  return (
                    <tr key={`${row.idTarefa}-${row.protocolo}-${idx}`} className="transition-colors hover:bg-white/[0.035]">
                      <td className="py-3 px-4 font-bold text-white">#{row.protocolo}</td>
                      <td className="py-3 px-4 font-medium text-slate-300">
                        {row.dtPrevisao ? new Date(row.dtPrevisao).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isAtrasado ? (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                            ATRASADO
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                            NO PRAZO
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCritico ? (
                          <Badge className="border-red-500/30 bg-red-500/15 font-semibold text-red-200">
                            CRÍTICO
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-500/10 text-slate-300 border-slate-500/20">
                            NORMAL
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-purple-300">{row.tarefa}</td>
                      <td className="py-3 px-4 text-slate-300">{row.responsavel}</td>
                      <td className="py-3 px-4 text-slate-400">{row.situacaoTarefa}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {row.tipo} {row.natureza ? `• ${row.natureza}` : ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 text-xs text-white/60 sm:flex-row">
          <span className="text-center sm:text-left">
            Exibindo <strong className="text-white">{startItem.toLocaleString("pt-BR")}</strong> a{" "}
            <strong className="text-white">{endItem.toLocaleString("pt-BR")}</strong> de{" "}
            <strong className="text-white">{tarefasFiltradas.length.toLocaleString("pt-BR")}</strong> registros
          </span>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
            <div className="flex items-center gap-1.5">
              <span>Exibir:</span>
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                {[10, 20, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      pageSize === size
                        ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-xs"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="Primeira página"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                title="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[90px] px-2 text-center font-medium text-white">
                Página {safeCurrentPage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                title="Próxima página"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Última página"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
