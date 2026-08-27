"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Users,
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

export function TarefasDashboardClient() {
  const [tarefas, setTarefas] = useState<TarefaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRangeDays, setFilterRangeDays] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarefa, setSelectedTarefa] = useState<string>("ALL");
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("ALL");
  const [selectedRisco, setSelectedRisco] = useState<string>("ALL");
  const [selectedStatusPrevisao, setSelectedStatusPrevisao] = useState<string>("ALL");

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

    tarefas.forEach((t) => {
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
  }, [tarefas, todayStr, tomorrowStr]);

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

      return true;
    });
  }, [tarefas, searchQuery, selectedTarefa, selectedResponsavel, selectedRisco, selectedStatusPrevisao]);

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
      ...tarefasFiltradas.map((r) =>
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

  return (
    <div className="space-y-6">
      {/* Botão de Atualizar */}
      <div className="flex justify-end">
        <Button
          onClick={fetchData}
          disabled={isLoading}
          variant="outline"
          className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar Previsões
        </Button>
      </div>

      {/* 6 KPI Cards — 3 colunas × 2 fileiras */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. VENCEM HOJE */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-red-500 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(239,68,68,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-red-300">
            <span>Vencem Hoje</span>
            <Clock className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-red-400">{kpis.vencemHoje}</div>
          <div className="mt-1.5 text-[11px] text-white/50">protocolos distintos</div>
        </div>

        {/* 2. VENCEM AMANHÃ */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-amber-500 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(245,158,11,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            <span>Vencem Amanhã</span>
            <Calendar className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-400">{kpis.vencemAmanha}</div>
          <div className="mt-1.5 text-[11px] text-white/50">protocolos distintos</div>
        </div>

        {/* 3. PRÓXIMOS 3 DIAS */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-cyan-500 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(6,182,212,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            <span>Próximos 3 Dias</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-cyan-400">{kpis.prox3Dias}</div>
          <div className="mt-1.5 text-[11px] text-white/50">protocolos distintos</div>
        </div>

        {/* 4. ATRASADOS */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-rose-500 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(225,29,72,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-300">
            <span>Atrasados</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-rose-400">{kpis.atrasados}</div>
          <div className="mt-1.5 text-[11px] text-white/50">previsão estourada</div>
        </div>

        {/* 5. RISCO CRÍTICO */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-red-600 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(239,68,68,0.15)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-red-200">
            <span>Risco Crítico</span>
            <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-red-500">{kpis.riscoCritico}</div>
          <div className="mt-1.5 text-[11px] text-white/50">atenção imediata</div>
        </div>

        {/* 6. TAREFAS EM ANDAMENTO */}
        <div className="rounded-2xl border border-white/8 border-l-4 border-l-emerald-500 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:shadow-[0_0_24px_rgba(16,185,129,0.12)]">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            <span>Em Andamento</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-400">{kpis.tarefasEmAndamento}</div>
          <div className="mt-1.5 text-[11px] text-white/50">tarefas ativas</div>
        </div>
      </div>

      {/* Painel Duplo de Gráficos Analíticos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico 1: Previsão por Dia */}
        <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                Previsão de Protocolos por Dia
              </h2>
              <p className="text-xs text-white/50">Volume previsto de entregas de recepção</p>
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setFilterRangeDays(days)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    filterRangeDays === days
                      ? "bg-purple-600 text-white shadow"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full pt-4">
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
        </div>

        {/* Gráfico 2: Carga por Tarefa */}
        <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Carga Atual por Tarefa
            </h2>
            <p className="text-xs text-white/50">Distribuição de tarefas abertas por fase</p>
          </div>

          <div className="h-64 w-full pt-4">
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
        </div>
      </div>

      {/* Seção Sintética: Carga por Responsável */}
      <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Carga por Responsável</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-300 font-semibold border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4 text-center">Tarefas Abertas</th>
                <th className="py-3 px-4 text-center">Protocolos Distintos</th>
                <th className="py-3 px-4 text-center">Vencem Hoje</th>
                <th className="py-3 px-4 text-center">Vencem Amanhã</th>
                <th className="py-3 px-4 text-center">Risco Crítico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {cargaPorResponsavel.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Detalhada com Filtros */}
      <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Filter className="h-4 w-4 text-purple-400" />
              Detalhamento de Tarefas e Previsões
            </h2>
            <p className="text-xs text-white/50">
              Exibindo {tarefasFiltradas.length} de {tarefas.length} tarefas encontradas
            </p>
          </div>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs gap-2 self-start md:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Filtrados (CSV)
          </Button>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Busca por Protocolo / Texto */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar protocolo, responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Filtro por Tarefa */}
          <select
            value={selectedTarefa}
            onChange={(e) => setSelectedTarefa(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
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
            className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
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
            className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ATRASADO">Somente Atrasados</option>
            <option value="NO_PRAZO">No Prazo</option>
          </select>

          {/* Filtro por Risco */}
          <select
            value={selectedRisco}
            onChange={(e) => setSelectedRisco(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="ALL">Todos os Riscos</option>
            <option value="CRITICO">Risco Crítico / Alto</option>
            <option value="NORMAL">Normal / Baixo</option>
          </select>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-300 font-semibold border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Protocolo</th>
                <th className="py-3 px-4">Previsão</th>
                <th className="py-3 px-4 text-center">Status Previsão</th>
                <th className="py-3 px-4 text-center">Nível Risco</th>
                <th className="py-3 px-4">Tarefa</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Tipo / Natureza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
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
                tarefasFiltradas.slice(0, 100).map((row, idx) => {
                  const isAtrasado = (row.statusPrevisao || "").toUpperCase().includes("ATRASAD");
                  const isCritico = (row.nivelRisco || "").toUpperCase().includes("CRITIC");

                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
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
                          <Badge className="bg-red-600/30 text-red-200 border-red-500 animate-pulse">
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
      </div>
    </div>
  );
}
