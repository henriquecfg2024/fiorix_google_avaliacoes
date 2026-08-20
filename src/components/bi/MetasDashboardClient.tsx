"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from "recharts";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { 
  Target, AlertCircle, Clock, TrendingUp, Search, Filter, Loader2, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet,
  X, AlertTriangle, Calendar, Activity, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldAlert, CheckCircle2, XCircle
} from "lucide-react";

type SortField = 
  | "protocolo" 
  | "natureza"
  | "status" 
  | "atraso" 
  | "d1Protocolo" 
  | "d3Extrato" 
  | "d4Qualificacao" 
  | "d5Calculo" 
  | "d8Impressao" 
  | "d10Entrega" 
  | "gargalo";

type SortOrder = "asc" | "desc";
type BalcaoFilter = "TODOS" | "SEM_REG" | "SEM_DEV";

type MetasData = {
  protocolo: number;
  natureza?: string;
  tipo?: string;
  dataApresentado?: string;
  dtPrevisao?: string;
  dtEntregaReal?: string;
  status?: string;
  statusMeta?: string | null;
  atrasoDias?: number;
  diasAtraso?: number | null;
  diasCorridos?: number | null;
  d1Protocolo?: string;
  d1Escaneamento?: string;
  d2Contraditorio?: string;
  d3Extrato?: string;
  d4Qualificacao?: string;
  d5Calculo?: string;
  d8Impressao?: string;
  d9Preparacao?: string;
  d9Conferencia?: string;
  d10Entrega?: string;
  dBalcaoRegistrado?: string;
  dBalcaoDevolvido?: string;
  hasRegistro?: boolean;
  hasDevolucao?: boolean;
  qtdRetrabalho?: number;
  diasD1D2?: number | null;
  diasD2D3?: number | null;
  diasD3D4?: number | null;
  diasD4D5?: number | null;
  diasD5D8?: number | null;
  diasD8D9?: number | null;
  [key: string]: unknown;
};

type PhaseChartDatum = {
  name: string;
  fullName: string;
  label: string;
  key: string;
  phaseName: string;
  dias: number;
  count: number;
  isBottleneck: boolean;
  status: "Principal gargalo" | "Atenção" | "Fluxo regular";
};

const formatDays = (value: number) => {
  const rounded = Number(value.toFixed(1));
  return `${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;
};

function PremiumBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  payload,
  selectedPhase,
  reduceMotion,
  onSelect,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: PhaseChartDatum;
  selectedPhase: string;
  reduceMotion: boolean;
  onSelect: (phaseName: string) => void;
}) {
  if (!payload || width <= 0 || height <= 0) return null;

  const isSelected = selectedPhase === payload.phaseName;
  const isBottleneck = payload.isBottleneck;
  const fillUrl = isBottleneck ? "url(#bottleneckGradient)" : "url(#phaseGradient)";

  return (
    <g
      onClick={() => onSelect(payload.phaseName)}
      className="cursor-pointer transition-opacity hover:opacity-90"
      tabIndex={0}
      role="button"
      aria-label={`${payload.label}: ${formatDays(payload.dias)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(payload.phaseName);
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fillUrl}
        filter={isBottleneck ? "url(#bottleneckGlow)" : undefined}
        stroke={isSelected ? "#F59E0B" : isBottleneck ? "rgba(245, 158, 11, 0.8)" : "none"}
        strokeWidth={isSelected ? 2 : isBottleneck ? 1.5 : 0}
      />
    </g>
  );
}

function ChartValueLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (value === undefined || value === null) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="rgba(255, 255, 255, 0.9)"
      textAnchor="middle"
      fontSize={10}
      fontWeight={700}
    >
      {formatDays(Number(value))}
    </text>
  );
}

function PremiumChartTooltip({
  active,
  payload,
  totalProtocols,
  selectedPhase,
}: {
  active?: boolean;
  payload?: Array<{ payload: PhaseChartDatum }>;
  totalProtocols: number;
  selectedPhase: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const dataPoint = payload[0].payload;
  const percentage = totalProtocols > 0 ? (dataPoint.count / totalProtocols) * 100 : 0;
  const isSelected = selectedPhase === dataPoint.phaseName;

  return (
    <div className="rounded-xl border border-white/12 bg-[#0C1324]/95 p-3 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 font-bold text-amber-300">
        <span>{dataPoint.label}</span>
      </div>
      <p className="mt-1 text-sm font-extrabold text-white">
        Média: {formatDays(dataPoint.dias)}
      </p>
      <p className="mt-1 text-white/65">
        {dataPoint.count.toLocaleString("pt-BR")} protocolos • Afeta {percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da base
      </p>
      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-white/45">
        {isSelected ? "Clique para remover o filtro" : "Clique para filtrar os protocolos desta fase"}
      </p>
    </div>
  );
}

export function MetasDashboardClient() {
  const prefersReducedMotion = useReducedMotion();
  const [data, setData] = useState<MetasData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [metaFilter, setMetaFilter] = useState("ALL");
  const [gargaloFilter, setGargaloFilter] = useState("ALL");
  const [balcaoFilter, setBalcaoFilter] = useState<BalcaoFilter>("TODOS");
  const [sortField, setSortField] = useState<SortField>("protocolo");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Drawer/Modal State
  const [selectedProtocol, setSelectedProtocol] = useState<MetasData | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/bi/metas/data");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to load metas data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, metaFilter, gargaloFilter, balcaoFilter, itemsPerPage, sortField, sortOrder]);

  // Helper universal para pegar valor ignorando casing e aliases
  const getVal = useCallback((record: Record<string, unknown> | null | undefined, ...keys: string[]) => {
    if (!record) return null;
    for (const k of keys) {
      if (record[k] !== undefined && record[k] !== null) return record[k];
    }
    return null;
  }, []);

  const getDateKey = useCallback((value: unknown) => {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  }, []);

  const parseDateSafe = useCallback((value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const str = String(value).trim();
    if (!str || str.toUpperCase() === "NULL" || str === "undefined") return null;

    if (str.includes("/")) {
      const parts = str.split(" ");
      const dateParts = parts[0].split("/");
      const timePart = parts[1] || "00:00:00";
      if (dateParts.length === 3) {
        const isoStr = `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}T${timePart}`;
        const dt = new Date(isoStr);
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }

    const dt = new Date(str);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }, []);

  // Lógica principal de recalcular Status e Atraso com mapeamento oficial da procedure pr_Fiorix_BI_METAS
  const getMetasStatusAndAtraso = useCallback((record: MetasData) => {
    const rawStatusMeta = String(getVal(record, "statusMeta", "STATUS_META", "status_meta") || "").trim().toUpperCase();
    const diasAtrasoVal = getVal(record, "diasAtraso", "DIAS_ATRASO", "atrasoDias", "ATRASO_DIAS");
    const parsedAtraso = diasAtrasoVal !== null && diasAtrasoVal !== undefined ? Number(diasAtrasoVal) : null;

    if (rawStatusMeta === "NO PRAZO - PENDENTE") {
      return {
        status: "Em dia",
        statusMeta: "NO PRAZO - PENDENTE",
        atrasoDias: parsedAtraso !== null && parsedAtraso < 0 ? parsedAtraso : 0,
        badge: { text: "Em dia", bgClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 backdrop-blur-md" }
      };
    }

    if (rawStatusMeta === "ATRASADO - PENDENTE") {
      return {
        status: "Atrasado",
        statusMeta: "ATRASADO - PENDENTE",
        atrasoDias: parsedAtraso !== null && parsedAtraso > 0 ? parsedAtraso : 1,
        badge: { text: "Atrasado", bgClass: "bg-red-500/10 text-red-300 border border-red-500/20 backdrop-blur-md" }
      };
    }

    if (rawStatusMeta === "META ESTOURADA") {
      return {
        status: "Entregue com Atraso",
        statusMeta: "META ESTOURADA",
        atrasoDias: parsedAtraso !== null && parsedAtraso > 0 ? parsedAtraso : 1,
        badge: { text: "Entregue com atraso", bgClass: "bg-amber-500/10 text-amber-300 border border-amber-500/20 backdrop-blur-md" }
      };
    }

    if (rawStatusMeta === "META BATIDA") {
      return {
        status: "Em dia",
        statusMeta: "META BATIDA",
        atrasoDias: parsedAtraso !== null && parsedAtraso < 0 ? parsedAtraso : 0,
        badge: { text: "No prazo", bgClass: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 backdrop-blur-md" }
      };
    }

    // Fallback gracioso para cargas sem STATUS_META
    const rawStatus = String(getVal(record, "status", "STATUS") || "").trim();
    const rawStatusLower = rawStatus.toLowerCase();
    const d10 = getVal(
      record,
      "d10Entrega",
      "D10_ENTREGA",
      "D10_ENT",
      "dtEntregaReal",
      "DT_ENTREGA_REAL",
      "dBalcaoDevolvido",
      "D_BALCAO_DEVOLVIDO",
      "d_balcao_devolvido"
    );
    const dtPrev = getVal(record, "dtPrevisao", "DT_PREVISAO", "dt_previsao", "DtPrevisaoEntrega");
    const dataApres = getVal(record, "dataApresentado", "DATA_APRESENTADO", "data_apresentado", "DataDoTituloApresentado");
    const d1Protocolo = getVal(record, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT", "d1_protocolo");
    const atrasoDiasRaw = Number(getVal(record, "atrasoDias", "ATRASO_DIAS", "atraso_dias") || 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    if (
      (rawStatusLower.includes("entregue") && rawStatusLower.includes("atraso")) ||
      (rawStatusLower.includes("concluid") && rawStatusLower.includes("atraso")) ||
      (rawStatusLower.includes("finaliz") && rawStatusLower.includes("atraso")) ||
      (rawStatusLower.includes("devolv") && rawStatusLower.includes("atraso")) ||
      (atrasoDiasRaw > 0 && (rawStatusLower.includes("entregue") || rawStatusLower.includes("devolv") || rawStatusLower.includes("concluid") || rawStatusLower.includes("finaliz")))
    ) {
      return {
        status: "Entregue com Atraso",
        statusMeta: "META ESTOURADA",
        atrasoDias: atrasoDiasRaw > 0 ? atrasoDiasRaw : 1,
        badge: { text: "Entregue com atraso", bgClass: "bg-amber-500/10 text-amber-300 border border-amber-500/20 backdrop-blur-md" }
      };
    }

    if ([dataApres, d1Protocolo].some((value) => getDateKey(value) === hojeKey)) {
      try {
        return {
          status: "Em dia",
          statusMeta: "NO PRAZO - PENDENTE",
          atrasoDias: 0,
          badge: { text: "Em dia", bgClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 backdrop-blur-md" }
        };
      } catch {}
    }

    const d10Date = parseDateSafe(d10);
    const prevDate = parseDateSafe(dtPrev);

    if (d10Date && prevDate) {
      d10Date.setHours(0, 0, 0, 0);
      prevDate.setHours(0, 0, 0, 0);

      const diffEnt = Math.floor((d10Date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffEnt <= 0) {
        return {
          status: "Em dia",
          statusMeta: "META BATIDA",
          atrasoDias: diffEnt,
          badge: { text: "No prazo", bgClass: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 backdrop-blur-md" }
        };
      } else {
        return {
          status: "Entregue com Atraso",
          statusMeta: "META ESTOURADA",
          atrasoDias: diffEnt,
          badge: { text: "Entregue com atraso", bgClass: "bg-amber-500/10 text-amber-300 border border-amber-500/20 backdrop-blur-md" }
        };
      }
    }

    if (prevDate) {
      prevDate.setHours(0, 0, 0, 0);

      const diffDias = Math.floor((hoje.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) {
        return {
          status: "Em dia",
          statusMeta: "NO PRAZO - PENDENTE",
          atrasoDias: diffDias,
          badge: { text: "Em dia", bgClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 backdrop-blur-md" }
        };
      } else {
        return {
          status: "Atrasado",
          statusMeta: "ATRASADO - PENDENTE",
          atrasoDias: diffDias,
          badge: { text: "Atrasado", bgClass: "bg-red-500/10 text-red-300 border border-red-500/20 backdrop-blur-md" }
        };
      }
    }

    return {
      status: "Em dia",
      statusMeta: "NO PRAZO - PENDENTE",
      atrasoDias: 0,
      badge: { text: "Em dia", bgClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 backdrop-blur-md" }
    };
  }, [getDateKey, getVal, parseDateSafe]);

  const getBalcaoAuditState = useCallback((record: MetasData) => {
    const d8Impressao = getVal(record, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
    const d10Entrega = getVal(record, "d10Entrega", "D10_ENTREGA", "D10_ENT");
    const dBalcaoRegistrado = getVal(record, "dBalcaoRegistrado", "D_BALCAO_REGISTRADO");
    const dBalcaoDevolvido = getVal(record, "dBalcaoDevolvido", "D_BALCAO_DEVOLVIDO");
    const hasRegistro = Boolean(getVal(record, "hasRegistro", "has_registro"));
    const hasDevolucao = Boolean(getVal(record, "hasDevolucao", "has_devolucao"));
    const isAtrasado = getMetasStatusAndAtraso(record).status === "Atrasado";

    return {
      dBalcaoRegistrado,
      dBalcaoDevolvido,
      semRegistro: hasRegistro
        ? !dBalcaoRegistrado
        : isAtrasado && Boolean(d8Impressao) && !d10Entrega && !dBalcaoRegistrado,
      semDevolucao: hasDevolucao && !dBalcaoDevolvido,
    };
  }, [getMetasStatusAndAtraso, getVal]);

  const formatDateFull = (val: unknown) => {
    if (!val) return "-";
    try {
      const d = parseDateSafe(val);
      if (!d || isNaN(d.getTime())) return "-";
      return format(d, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  // Safe diff calculation in days (com Math.max(0, ...) para evitar dias negativos por datas invertidas)
  const calculateDaysBetween = useCallback((startVal: unknown, endVal: unknown, givenDaysVal: unknown, isLastActivePhase: boolean = false) => {
    if (givenDaysVal !== null && givenDaysVal !== undefined) {
      return Math.max(0, Number(givenDaysVal));
    }
    if (!startVal) return null;
    
    try {
      const dStart = new Date(String(startVal)).getTime();
      if (isNaN(dStart)) return null;

      if (endVal) {
        const dEnd = new Date(String(endVal)).getTime();
        if (isNaN(dEnd)) return null;
        return Math.max(0, Math.floor((dEnd - dStart) / (1000 * 60 * 60 * 24)));
      }

      if (isLastActivePhase) {
        const now = new Date().getTime();
        return Math.max(0, Math.floor((now - dStart) / (1000 * 60 * 60 * 24)));
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  // Determine all 9 phase transitions & bottleneck for a given record
  const getPhasesForRecord = useCallback((record: MetasData) => {
    if (!record) {
      return {
        phases: [],
        topGargalo: { key: "NONE", label: "-", name: "Nenhum", dias: 0 }
      };
    }

    const d1 = getVal(record, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");
    const d1E = getVal(record, "d1Escaneamento", "D1_ESCANEAMENTO", "D1_ESCAN");
    const d2 = getVal(record, "d2Contraditorio", "D2_CONTRADITORIO", "D2_CONTRAD");
    const d3 = getVal(record, "d3Extrato", "D3_EXTRATO", "D3_EXTR");
    const d4 = getVal(record, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI");
    const d5 = getVal(record, "d5Calculo", "D5_CALCULO", "D5_CALC");
    const d8 = getVal(record, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
    const d9 = getVal(record, "d9Preparacao", "D9_PREPARACAO", "D9_PREP");
    const d9C = getVal(record, "d9Conferencia", "D9_CONFERENCIA", "D9_CONF");
    const d10 = getVal(record, "d10Entrega", "D10_ENTREGA", "D10_ENT", "dtEntregaReal", "DT_ENTREGA_REAL");

    const isP1Active = Boolean(d1 && !d1E);
    const isP2Active = Boolean(d1E && !d2);
    const isP3Active = Boolean(d2 && !d3);
    const isP4Active = Boolean(d3 && !d4);
    const isP5Active = Boolean(d4 && !d5);
    const isP6Active = Boolean(d5 && !d8);
    const isP7Active = Boolean(d8 && !d9);
    const isP8Active = Boolean(d9 && !d9C);
    const isP9Active = Boolean(d9C && !d10);

    const phases = [
      { key: "D1_D1E", label: "Prot. -> Escan.", name: "PROTOCOLO -> ESCANEAMENTO", dias: calculateDaysBetween(d1, d1E, getVal(record, "diasD1D1E", "DIAS_D1_D1ESCAN"), isP1Active) },
      { key: "D1E_D2", label: "Escan. -> Contrad.", name: "ESCANEAMENTO -> CONTRADITORIO", dias: calculateDaysBetween(d1E, d2, getVal(record, "diasD1ED2", "DIAS_D1ESCAN_D2"), isP2Active) },
      { key: "D2_D3", label: "Contrad. -> Extr.", name: "CONTRADITORIO -> EXTRATO", dias: calculateDaysBetween(d2, d3, getVal(record, "diasD2D3", "DIAS_D2_D3"), isP3Active) },
      { key: "D3_D4", label: "Extr. -> Qualif.", name: "EXTRATO -> QUALIFICACAO", dias: calculateDaysBetween(d3, d4, getVal(record, "diasD3D4", "DIAS_D3_D4"), isP4Active) },
      { key: "D4_D5", label: "Qualif. -> Calc.", name: "QUALIFICACAO -> CALCULO", dias: calculateDaysBetween(d4, d5, getVal(record, "diasD4D5", "DIAS_D4_D5"), isP5Active) },
      { key: "D5_D8", label: "Calc. -> Impres.", name: "CALCULO -> IMPRESSAO", dias: calculateDaysBetween(d5, d8, getVal(record, "diasD5D8", "DIAS_D5_D8"), isP6Active) },
      { key: "D8_D9", label: "Impres. -> Prep.", name: "IMPRESSAO -> PREPARACAO", dias: calculateDaysBetween(d8, d9, getVal(record, "diasD8D9", "DIAS_D8_D9"), isP7Active) },
      { key: "D9_D9C", label: "Prep. -> Conf.", name: "PREPARACAO -> CONFERENCIA", dias: calculateDaysBetween(d9, d9C, getVal(record, "diasD9D9C", "DIAS_D9PREP_D9CONF"), isP8Active) },
      { key: "D9C_D10", label: "Conf. -> Entrega", name: "CONFERENCIA -> ENTREGA", dias: d10 ? calculateDaysBetween(d9C, d10, getVal(record, "diasD9CD10", "DIAS_D9CONF_D10"), false) : null },
    ];

    let max = phases[0] || { key: "NONE", label: "-", name: "Nenhum", dias: 0 };
    for (const phase of phases) {
      if (phase && (phase.dias || 0) > (max.dias || 0)) {
        max = phase;
      }
    }
    return { phases, topGargalo: max || { key: "NONE", label: "-", name: "Nenhum", dias: 0 } };
  }, [calculateDaysBetween, getVal]);

  const getGargaloForRecord = useCallback((record: MetasData) => {
    return getPhasesForRecord(record)?.topGargalo || { key: "NONE", label: "-", name: "Nenhum", dias: 0 };
  }, [getPhasesForRecord]);

  // Calculate chart data & KPIs considerando as 9 transições completas
  const { chartData, kpis, statuses, gargaloTypes } = useMemo(() => {
    const emptyKpis = {
      total: 0,
      atrasados: 0,
      entregueComAtraso: 0,
      topGargalo: { name: "Nenhum", count: 0 }
    };
    if (!data || data.length === 0) return { chartData: [], kpis: emptyKpis, statuses: [], gargaloTypes: [] };

    let atrasados = 0;
    let entregueComAtraso = 0;
    
    const phaseSums: Record<string, { sum: number; count: number }> = {
      D1_D1E: { sum: 0, count: 0 },
      D1E_D2: { sum: 0, count: 0 },
      D2_D3: { sum: 0, count: 0 },
      D3_D4: { sum: 0, count: 0 },
      D4_D5: { sum: 0, count: 0 },
      D5_D8: { sum: 0, count: 0 },
      D8_D9: { sum: 0, count: 0 },
      D9_D9C: { sum: 0, count: 0 },
      D9C_D10: { sum: 0, count: 0 },
    };

    const statusSet = new Set<string>();
    const gargaloSet = new Set<string>();
    const gargaloCounts: Record<string, number> = {};

    data.forEach(item => {
      if (!item) return;
      const { status, statusMeta, badge } = getMetasStatusAndAtraso(item);
      if (badge && badge.text) {
        statusSet.add(badge.text);
      }

      if (statusMeta === "ATRASADO - PENDENTE" || status === "Atrasado") {
        atrasados++;
      } else if (statusMeta === "META ESTOURADA" || status === "Entregue com Atraso") {
        entregueComAtraso++;
      }

      const { phases, topGargalo } = getPhasesForRecord(item);
      if (topGargalo && topGargalo.name) {
        gargaloSet.add(topGargalo.name);
        gargaloCounts[topGargalo.name] = (gargaloCounts[topGargalo.name] || 0) + 1;
      }

      (phases || []).forEach(p => {
        if (p && p.dias !== null && p.dias !== undefined) {
          if (phaseSums[p.key]) {
            phaseSums[p.key].sum += Math.max(0, p.dias);
            phaseSums[p.key].count++;
          }
        }
      });
    });

    let topGargaloName = "Nenhum";
    let topGargaloCount = 0;
    Object.entries(gargaloCounts).forEach(([name, count]) => {
      if (count > topGargaloCount) {
        topGargaloName = name;
        topGargaloCount = count;
      }
    });

    const chartBase = [
      { name: "D1->D1E", fullName: "Prot.->Escan.", label: "Protocolo -> Escaneamento", key: "D1_D1E", phaseName: "PROTOCOLO -> ESCANEAMENTO" },
      { name: "D1E->D2", fullName: "Escan.->Contrad.", label: "Escaneamento -> Contraditório", key: "D1E_D2", phaseName: "ESCANEAMENTO -> CONTRADITORIO" },
      { name: "D2->D3", fullName: "Contrad.->Extr.", label: "Contraditório -> Extrato", key: "D2_D3", phaseName: "CONTRADITORIO -> EXTRATO" },
      { name: "D3->D4", fullName: "Extr.->Qualif.", label: "Extrato -> Qualificação", key: "D3_D4", phaseName: "EXTRATO -> QUALIFICACAO" },
      { name: "D4->D5", fullName: "Qualif.->Calc.", label: "Qualificação -> Cálculo", key: "D4_D5", phaseName: "QUALIFICACAO -> CALCULO" },
      { name: "D5->D8", fullName: "Calc.->Impres.", label: "Cálculo -> Impressão", key: "D5_D8", phaseName: "CALCULO -> IMPRESSAO" },
      { name: "D8->D9", fullName: "Impres.->Prep.", label: "Impressão -> Preparação", key: "D8_D9", phaseName: "IMPRESSAO -> PREPARACAO" },
      { name: "D9->D9C", fullName: "Prep.->Conf.", label: "Preparação -> Conferência", key: "D9_D9C", phaseName: "PREPARACAO -> CONFERENCIA" },
      { name: "D9C->D10", fullName: "Conf.->Entrega", label: "Conferência -> Entrega", key: "D9C_D10", phaseName: "CONFERENCIA -> ENTREGA" },
    ].map((item) => {
      const stats = phaseSums[item.key] || { sum: 0, count: 0 };
      const dias = stats.count > 0 ? stats.sum / stats.count : 0;
      return {
        ...item,
        dias: Number(dias.toFixed(1)),
        count: stats.count,
      };
    });

    const bottleneck = chartBase.reduce((prev, curr) => (
      curr.dias > prev.dias ? curr : prev
    ), chartBase[0]);
    const attentionThreshold = bottleneck.dias * 0.5;
    const chart: PhaseChartDatum[] = chartBase.map((item) => ({
      ...item,
      isBottleneck: item.key === bottleneck.key && bottleneck.dias > 0,
      status: item.key === bottleneck.key && bottleneck.dias > 0
        ? "Principal gargalo"
        : item.dias >= attentionThreshold && item.dias > 0
          ? "Atenção"
          : "Fluxo regular",
    }));

    return {
      chartData: chart,
      kpis: {
        total: data.length,
        atrasados,
        entregueComAtraso,
        topGargalo: { name: topGargaloName, count: topGargaloCount }
      },
      statuses: Array.from(statusSet).sort(),
      gargaloTypes: Array.from(gargaloSet).sort(),
    };
  }, [data, getMetasStatusAndAtraso, getPhasesForRecord]);

  const chartBottleneck = useMemo(() => (
    chartData.find((item) => item.isBottleneck) || null
  ), [chartData]);

  const balcaoAudit = useMemo(() => data.reduce((counts, item) => {
    const audit = getBalcaoAuditState(item);
    if (audit.semRegistro) counts.semRegistro++;
    if (audit.semDevolucao) counts.semDevolucao++;
    return counts;
  }, { semRegistro: 0, semDevolucao: 0 }), [data, getBalcaoAuditState]);

  const handleBalcaoFilter = (filter: Exclude<BalcaoFilter, "TODOS">) => {
    const nextFilter = balcaoFilter === filter ? "TODOS" : filter;
    setBalcaoFilter(nextFilter);

    const count = filter === "SEM_REG" ? balcaoAudit.semRegistro : balcaoAudit.semDevolucao;
    if (nextFilter === "TODOS") {
      toast.info("Filtro de auditoria do balcão removido.");
    } else {
      const label = filter === "SEM_REG" ? "BALCÃO REGISTRADO (ID 76)" : "BALCÃO DEVOLVIDO (ID 75)";
      toast.info(`Mostrando ${count.toLocaleString("pt-BR")} protocolos sem ${label}`);
      window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const handleChartClick = (phaseName: string) => {
    if (!phaseName) return;
    if (gargaloFilter === phaseName) {
      setGargaloFilter("ALL");
    } else {
      setGargaloFilter(phaseName);
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    const filtered = data.filter(item => {
      const prot = String(getVal(item, "protocolo", "PROTOCOLO") || "");
      const nat = String(getVal(item, "natureza", "NATUREZA") || "").toLowerCase();
      const { badge, statusMeta } = getMetasStatusAndAtraso(item);
      
      const searchLower = search.toLowerCase();
      const matchSearch = search ? (prot.includes(search) || nat.includes(searchLower)) : true;
      const matchStatus = statusFilter !== "ALL" ? badge.text === statusFilter : true;
      const matchMeta = metaFilter !== "ALL"
        ? (statusMeta === metaFilter || String(getVal(item, "statusMeta", "STATUS_META") || "").toUpperCase() === metaFilter)
        : true;
      const matchGargalo = gargaloFilter !== "ALL" ? getGargaloForRecord(item).name === gargaloFilter : true;
      const audit = getBalcaoAuditState(item);
      const matchBalcao = balcaoFilter === "SEM_REG"
        ? audit.semRegistro
        : balcaoFilter === "SEM_DEV"
          ? audit.semDevolucao
          : true;
      
      return matchSearch && matchStatus && matchMeta && matchGargalo && matchBalcao;
    });

    return [...filtered].sort((a, b) => {
      let valA: unknown = null;
      let valB: unknown = null;

      switch (sortField) {
        case "protocolo":
          valA = Number(getVal(a, "protocolo", "PROTOCOLO")) || 0;
          valB = Number(getVal(b, "protocolo", "PROTOCOLO")) || 0;
          break;
        case "natureza":
          valA = getVal(a, "natureza", "NATUREZA") || "";
          valB = getVal(b, "natureza", "NATUREZA") || "";
          break;
        case "atraso":
          valA = getMetasStatusAndAtraso(a).atrasoDias;
          valB = getMetasStatusAndAtraso(b).atrasoDias;
          break;
        case "status":
          valA = getMetasStatusAndAtraso(a).badge.text;
          valB = getMetasStatusAndAtraso(b).badge.text;
          break;
        case "gargalo":
          valA = getGargaloForRecord(a).name;
          valB = getGargaloForRecord(b).name;
          break;
        case "d1Protocolo":
          valA = getVal(a, "d1Protocolo", "D1_PROTOCOLO", "DATA_APRESENTADO");
          valB = getVal(b, "d1Protocolo", "D1_PROTOCOLO", "DATA_APRESENTADO");
          break;
        case "d3Extrato":
          valA = getVal(a, "d3Extrato", "D3_EXTRATO");
          valB = getVal(b, "d3Extrato", "D3_EXTRATO");
          break;
        case "d4Qualificacao":
          valA = getVal(a, "d4Qualificacao", "D4_QUALIFICACAO");
          valB = getVal(b, "d4Qualificacao", "D4_QUALIFICACAO");
          break;
        case "d5Calculo":
          valA = getVal(a, "d5Calculo", "D5_CALCULO");
          valB = getVal(b, "d5Calculo", "D5_CALCULO");
          break;
        case "d8Impressao":
          valA = getVal(a, "d8Impressao", "D8_IMPRESSAO");
          valB = getVal(b, "d8Impressao", "D8_IMPRESSAO");
          break;
        case "d10Entrega":
          valA = getVal(a, "d10Entrega", "D10_ENTREGA");
          valB = getVal(b, "d10Entrega", "D10_ENTREGA");
          break;
        default:
          valA = getVal(a, sortField);
          valB = getVal(b, sortField);
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === "") return 1;
      if (valB === null || valB === undefined || valB === "") return -1;

      let res = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        res = valA - valB;
      } else {
        res = String(valA).localeCompare(String(valB), "pt-BR", { numeric: true });
      }

      return sortOrder === "asc" ? res : -res;
    });
  }, [data, search, statusFilter, gargaloFilter, balcaoFilter, sortField, sortOrder, getBalcaoAuditState, getGargaloForRecord, getMetasStatusAndAtraso, getVal]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "atraso" || field === "protocolo" || field.startsWith("d") ? "desc" : "asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-white/30 group-hover:text-white/70 transition-colors inline ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-amber-300 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-amber-300 inline ml-1" />
    );
  };

  // Pagination Calculations
  const totalFiltered = filteredData.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);
  
  const paginatedData = useMemo(() => {
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const paginationRange = useMemo(() => {
    const range: (number | string)[] = [];
    const delta = 2;

    let start = Math.max(1, currentPage - delta);
    let end = Math.min(totalPages, currentPage + delta);

    if (currentPage <= delta) {
      end = Math.min(totalPages, 1 + delta * 2);
    }
    if (currentPage + delta >= totalPages) {
      start = Math.max(1, totalPages - delta * 2);
    }

    if (start > 1) {
      range.push(1);
      if (start > 2) range.push("...");
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) range.push("...");
      range.push(totalPages);
    }

    return range;
  }, [currentPage, totalPages]);

  // CSV Export Helper
  const handleExportCSV = (exportList: MetasData[], filename: string) => {
    if (exportList.length === 0) return;

    const headers = [
      "PROTOCOLO", "NATUREZA", "STATUS_META", "STATUS", "DIAS_ATRASO", "DIAS_CORRIDOS", "DATA_APRESENTADO", "DT_PREVISAO", 
      "D10_ENTREGA", "D1_PROTOCOLO", "D3_EXTRATO", "D4_QUALIFICACAO", 
      "D5_CALCULO", "D8_IMPRESSAO", "D_BALCAO_REGISTRADO",
      "D_BALCAO_DEVOLVIDO", "GARGALO", "DIAS_GARGALO"
    ];

    const rows = exportList.map(item => {
      const g = getGargaloForRecord(item);
      const prot = getVal(item, "protocolo", "PROTOCOLO");
      const nat = getVal(item, "natureza", "NATUREZA") || "";
      const { status, statusMeta, atrasoDias } = getMetasStatusAndAtraso(item);
      const diasCorridosVal = getVal(item, "diasCorridos", "DIAS_CORRIDOS");
      const d10Val = getVal(item, "d10Entrega", "D10_ENTREGA", "D10_ENT", "dtEntregaReal", "DT_ENTREGA_REAL");

      return [
        prot,
        `"${String(nat).replace(/"/g, '""')}"`,
        `"${String(statusMeta || "").replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`,
        atrasoDias !== undefined && atrasoDias !== null ? atrasoDias : 0,
        diasCorridosVal !== null && diasCorridosVal !== undefined ? diasCorridosVal : "",
        `"${getVal(item, "dataApresentado", "DATA_APRESENTADO") || ""}"`,
        `"${getVal(item, "dtPrevisao", "DT_PREVISAO") || ""}"`,
        `"${d10Val || ""}"`,
        `"${getVal(item, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT") || ""}"`,
        `"${getVal(item, "d3Extrato", "D3_EXTRATO", "D3_EXTR") || ""}"`,
        `"${getVal(item, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI") || ""}"`,
        `"${getVal(item, "d5Calculo", "D5_CALCULO", "D5_CALC") || ""}"`,
        `"${getVal(item, "d8Impressao", "D8_IMPRESSAO", "D8_IMP") || ""}"`,
        `"${getVal(item, "dBalcaoRegistrado", "D_BALCAO_REGISTRADO") || ""}"`,
        `"${getVal(item, "dBalcaoDevolvido", "D_BALCAO_DEVOLVIDO") || ""}"`,
        `"${g.name}"`,
        g.dias !== null ? g.dias : 0
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/60">
            <Target className="w-4 h-4 text-cyan-300" /> TOTAL
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.total ? kpis.total.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-rose-300">
            <AlertCircle className="w-4 h-4" /> ATRASADOS
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.atrasados ? kpis.atrasados.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Clock className="w-4 h-4" /> ENTREGUE COM ATRASO
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.entregueComAtraso ? kpis.entregueComAtraso.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
          <p className="mb-1 flex items-center gap-2 truncate pr-6 text-xs font-semibold text-amber-300" title="Gargalo Principal">
            <TrendingUp className="w-4 h-4" /> PRINCIPAL GARGALO
          </p>
          <h3 className="text-lg font-bold text-white truncate pr-2 mt-2" title={kpis?.topGargalo?.name}>
            {kpis?.topGargalo?.name || "-"}
          </h3>
          <p className="text-xs text-white/50 mt-1">
            Afeta {kpis?.topGargalo?.count?.toLocaleString("pt-BR") || 0} protocolos
          </p>
        </div>
      </div>

      {/* Gráfico de Média de Dias por Fase (9 Transições) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => handleBalcaoFilter("SEM_REG")}
          aria-pressed={balcaoFilter === "SEM_REG"}
          className={`min-h-[104px] w-full rounded-[28px] border p-4 text-left transition-all shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
            balcaoFilter === "SEM_REG"
              ? "border-amber-400/40 bg-[#0B1020]/80"
              : "border-white/12 bg-[#0B1020]/72 hover:border-white/20 hover:bg-[#0B1020]/80"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Sem Balcão Registrado</p>
                  <span className="rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">ID 76</span>
                </div>
                <p className="mt-1 text-xs text-white/50">Protocolos atrasados e impressos sem baixa</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-bold text-amber-100">{balcaoAudit.semRegistro.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[10px] text-amber-300/70">protocolos</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleBalcaoFilter("SEM_DEV")}
          aria-pressed={balcaoFilter === "SEM_DEV"}
          className={`min-h-[104px] w-full rounded-[28px] border p-4 text-left transition-all shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
            balcaoFilter === "SEM_DEV"
              ? "border-rose-400/40 bg-[#0B1020]/80"
              : "border-white/12 bg-[#0B1020]/72 hover:border-white/20 hover:bg-[#0B1020]/80"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-300">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-300">Sem Balcão Devolvido</p>
                  <span className="rounded border border-rose-400/20 bg-rose-400/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">ID 75</span>
                </div>
                <p className="mt-1 text-xs text-white/50">Registrados e atrasados sem baixa de retirada</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-bold text-rose-100">{balcaoAudit.semDevolucao.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[10px] text-rose-300/70">protocolos</p>
            </div>
          </div>
        </button>
      </div>

      <motion.section
        className="overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-sm font-semibold text-white sm:text-base">Média de Dias por Fase</h3>
              <span className="rounded-md border border-white/8 bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase text-white/55">
                9 Transições de Esteira
              </span>
            </div>
            <p className="mt-2 text-xs text-white/40">
              Clique em qualquer barra do gráfico para filtrar a lista de protocolos na tabela abaixo.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {chartBottleneck && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-[10px] font-semibold uppercase text-amber-200 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                <span className={`h-1.5 w-1.5 rounded-full bg-amber-400 ${prefersReducedMotion ? "" : "animate-pulse"}`} />
                <span>Principal gargalo</span>
                <span className="text-white/35">•</span>
                <span className="normal-case text-white/70">
                  {chartBottleneck.count.toLocaleString("pt-BR")} protocolos
                </span>
              </div>
            )}

            {gargaloFilter !== "ALL" && (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] text-cyan-200">
                <span>Filtrado por: <strong>{gargaloFilter}</strong></span>
                <button
                  type="button"
                  onClick={() => setGargaloFilter("ALL")}
                  className="rounded p-0.5 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  title="Remover filtro do gráfico"
                  aria-label="Remover filtro do gráfico"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="h-[310px] min-w-[820px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 34, right: 16, left: -12, bottom: 6 }}>
                <defs>
                  <linearGradient id="phaseGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#14B8A6" />
                    <stop offset="55%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                  <linearGradient id="bottleneckGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                  <filter id="bottleneckGlow" x="-60%" y="-30%" width="220%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F59E0B" floodOpacity="0.45" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
                <XAxis
                  dataKey="fullName"
                  stroke="rgba(255,255,255,0.45)"
                  fontSize={10}
                  fontWeight={500}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.38)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(Number(value))}d`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.025)", radius: 8 }}
                  content={(
                    <PremiumChartTooltip
                      totalProtocols={kpis?.total || 0}
                      selectedPhase={gargaloFilter}
                    />
                  )}
                />
                <Bar
                  dataKey="dias"
                  maxBarSize={52}
                  isAnimationActive={false}
                  shape={(shapeProps) => (
                    <PremiumBarShape
                      x={Number(shapeProps.x) || 0}
                      y={Number(shapeProps.y) || 0}
                      width={Number(shapeProps.width) || 0}
                      height={Number(shapeProps.height) || 0}
                      index={Number(shapeProps.index) || 0}
                      payload={shapeProps.payload as PhaseChartDatum}
                      selectedPhase={gargaloFilter}
                      reduceMotion={Boolean(prefersReducedMotion)}
                      onSelect={handleChartClick}
                    />
                  )}
                >
                  <LabelList dataKey="dias" content={<ChartValueLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.section>

      {/* Tabela Container */}
      <div ref={tableRef} className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0B1020]/72 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl scroll-mt-24">

        {/* Toolbar de Busca, Filtros e Exportação CSV */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-white/[0.01] p-4">
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/40" />
            </div>
            <input
              type="text"
              placeholder="Buscar por Protocolo..."
              className="w-full rounded-lg border border-white/10 bg-[#0C1323] pl-10 pr-4 py-2 text-sm text-white transition-all placeholder:text-white/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {balcaoFilter !== "TODOS" && (
              <button
                type="button"
                onClick={() => setBalcaoFilter("TODOS")}
                className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/15"
              >
                {balcaoFilter === "SEM_REG" ? "Sem registro ID 76" : "Sem devolução ID 75"}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {/* Filtro Status */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1323] px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Status</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Filtro Meta (STATUS_META) */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1323] px-3 py-1.5">
              <Target className="h-3.5 w-3.5 text-cyan-300" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4 max-w-[170px] truncate"
                value={metaFilter}
                onChange={(e) => setMetaFilter(e.target.value)}
              >
                <option value="ALL">Todas as Metas</option>
                <option value="NO PRAZO - PENDENTE">No Prazo (Pendente)</option>
                <option value="ATRASADO - PENDENTE">Atrasado (Pendente)</option>
                <option value="META BATIDA">Meta Batida</option>
                <option value="META ESTOURADA">Meta Estourada</option>
              </select>
            </div>

            {/* Filtro Gargalo */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1323] px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4 max-w-[150px] truncate"
                value={gargaloFilter}
                onChange={(e) => setGargaloFilter(e.target.value)}
              >
                <option value="ALL">Qualquer Gargalo</option>
                {gargaloTypes.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1323] px-3 py-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-amber-300" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4 max-w-[170px] truncate"
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <option value="protocolo-desc">Protocolo (Decrescente)</option>
                <option value="protocolo-asc">Protocolo (Crescente)</option>
                <option value="natureza-asc">Natureza (A-Z)</option>
                <option value="natureza-desc">Natureza (Z-A)</option>
                <option value="atraso-desc">Maior Atraso</option>
                <option value="atraso-asc">Menor Atraso</option>
                <option value="d1Protocolo-desc">D1 Prot (Mais Recente)</option>
                <option value="d1Protocolo-asc">D1 Prot (Mais Antigo)</option>
                <option value="status-asc">Status (A-Z)</option>
                <option value="status-desc">Status (Z-A)</option>
                <option value="gargalo-asc">Gargalo (A-Z)</option>
              </select>
            </div>

            {/* Botões Exportar CSV */}
            <button
              onClick={() => handleExportCSV(paginatedData, `metas_pagina_${currentPage}`)}
              title="Exportar registros visíveis na página atual para CSV"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/[0.08]"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" /> Exportar Página (CSV)
            </button>

            <button
              onClick={() => handleExportCSV(filteredData, "metas_filtradas")}
              title="Exportar todos os registros filtrados para CSV"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition-all hover:bg-cyan-500/16"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" /> Exportar Filtrados (CSV)
            </button>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="select-none bg-white/[0.03] text-xs uppercase text-white/60">
              <tr>
                <th 
                  onClick={() => handleSort("protocolo")}
                  className="group cursor-pointer px-4 py-3 font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    Protocolo {renderSortIcon("protocolo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("natureza")}
                  className="group cursor-pointer px-4 py-3 font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    Natureza {renderSortIcon("natureza")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("status")}
                  className="group cursor-pointer px-4 py-3 font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    Status {renderSortIcon("status")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("atraso")}
                  className="group cursor-pointer px-4 py-3 font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    Atraso {renderSortIcon("atraso")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d1Protocolo")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D1 Prot {renderSortIcon("d1Protocolo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d3Extrato")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D3 Extr {renderSortIcon("d3Extrato")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d4Qualificacao")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D4 Quali {renderSortIcon("d4Qualificacao")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d5Calculo")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D5 Calc {renderSortIcon("d5Calculo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d8Impressao")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D8 Imp {renderSortIcon("d8Impressao")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d10Entrega")}
                  className="group cursor-pointer bg-white/[0.01] px-4 py-3 text-center font-semibold transition-colors hover:bg-white/8 hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    D10 Ent {renderSortIcon("d10Entrega")}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01] whitespace-nowrap">
                  Balcão Reg. <span className="text-amber-300/70">(76)</span>
                </th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01] whitespace-nowrap">
                  Balcão Dev. <span className="text-rose-300/70">(75)</span>
                </th>
                <th 
                  onClick={() => handleSort("gargalo")}
                  className="group cursor-pointer px-4 py-3 font-semibold transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    Gargalo {renderSortIcon("gargalo")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => {
                const prot = String(getVal(row, "protocolo", "PROTOCOLO") || "");
                const natVal = String(getVal(row, "natureza", "NATUREZA", "TIPO_DETALHADO", "tipo_detalhado") || "");
                const { atrasoDias, badge, statusMeta } = getMetasStatusAndAtraso(row);

                const gargalo = getGargaloForRecord(row);
                
                const d1Val = getVal(row, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");
                const d3Val = getVal(row, "d3Extrato", "D3_EXTRATO", "D3_EXTR");
                const d4Val = getVal(row, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI");
                const d5Val = getVal(row, "d5Calculo", "D5_CALCULO", "D5_CALC");
                const d8Val = getVal(row, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
                const d10Val = getVal(row, "d10Entrega", "D10_ENTREGA", "D10_ENT", "dtEntregaReal", "DT_ENTREGA_REAL");
                const balcao = getBalcaoAuditState(row);
                const hasAuditPending = balcao.semRegistro || balcao.semDevolucao;

                return (
                  <tr 
                    key={prot} 
                    onClick={() => setSelectedProtocol(row)}
                    title="Clique para ver o detalhamento completo do protocolo"
                    className={`cursor-pointer border-b border-white/5 transition-colors ${
                      hasAuditPending ? "bg-amber-500/[0.045] hover:bg-amber-500/[0.08]" : "hover:bg-white/[0.045]"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-amber-300 underline decoration-amber-300/30 underline-offset-4">{prot}</td>
                    <td className="px-4 py-3 text-xs text-white/80 max-w-[160px] truncate" title={natVal || "-"}>
                      {natVal || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bgClass}`}
                        title={statusMeta ? `Status ERP: ${statusMeta}` : `Status: ${badge.text}`}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${atrasoDias > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-medium'}`}>
                      {atrasoDias > 0 ? `${atrasoDias}d` : '0d'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]" title={d1Val ? formatDateFull(d1Val) : "-"}>{formatDate(d1Val)}</td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]" title={d3Val ? formatDateFull(d3Val) : "-"}>{formatDate(d3Val)}</td>
                    <td className={`px-4 py-3 text-[11px] text-center bg-white/[0.01] ${gargalo.name.includes("EXTRATO -> QUALIFICACAO") ? "text-orange-400 font-bold" : "text-white/70"}`} title={d4Val ? formatDateFull(d4Val) : "-"}>
                      {formatDate(d4Val)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]" title={d5Val ? formatDateFull(d5Val) : "-"}>{formatDate(d5Val)}</td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]" title={d8Val ? formatDateFull(d8Val) : "-"}>{formatDate(d8Val)}</td>
                    <td className={`px-4 py-3 text-[11px] text-center bg-white/[0.01] ${d10Val ? "text-white/90 font-medium" : "text-white/30"}`} title={d10Val ? formatDateFull(d10Val) : "-"}>
                      {d10Val ? formatDate(d10Val) : "-"}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-center bg-white/[0.01]">
                      {balcao.dBalcaoRegistrado ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {formatDate(balcao.dBalcaoRegistrado)}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${balcao.semRegistro ? "font-semibold text-amber-300" : "text-white/35"}`}>
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-center bg-white/[0.01]">
                      {balcao.dBalcaoDevolvido ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {formatDate(balcao.dBalcaoDevolvido)}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${balcao.semDevolucao ? "font-semibold text-rose-300" : "text-white/35"}`}>
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium text-amber-200">
                      {gargalo.name} ({gargalo.dias !== null ? `${gargalo.dias}d` : '0d'})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="p-8 text-center text-white/50">
              Nenhum protocolo encontrado com os filtros atuais.
            </div>
          )}
        </div>

        {/* Rodapé com Barra de Paginação Completa */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 sm:flex-row">
          {/* Informação de intervalo */}
          <div className="text-xs text-white/60 text-center sm:text-left">
            Exibindo <strong className="text-white">{totalFiltered > 0 ? (startIndex + 1).toLocaleString("pt-BR") : "0"}</strong> a{" "}
            <strong className="text-white">{endIndex.toLocaleString("pt-BR")}</strong> de{" "}
            <strong className="text-white">{totalFiltered.toLocaleString("pt-BR")}</strong> registros
          </div>

          {/* Controles de Paginação & Itens Por Página */}
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
            {/* Seletor de Tamanho de Página */}
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <span>Exibir:</span>
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                {[10, 20, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                      itemsPerPage === size
                        ? "bg-gradient-to-r from-indigo-500 to-amber-400 font-semibold text-white shadow-xs"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Navegação de Páginas */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={currentPage <= 1}
                title="Primeira Página"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronsLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Página Anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>

              <span className="text-xs px-2 font-medium text-white min-w-[90px] text-center">
                Página {currentPage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                title="Próxima Página"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage >= totalPages}
                title="Última Página"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL / DRAWER LATERAL DIREITO - DETALHAMENTO DO PROTOCOLO */}
      {selectedProtocol && (() => {
        const protNum = String(getVal(selectedProtocol, "protocolo", "PROTOCOLO") || "-");
        const { atrasoDias, badge } = getMetasStatusAndAtraso(selectedProtocol);
        const retrabalho = Number(getVal(selectedProtocol, "qtdRetrabalho", "QTD_RETRABALHO", "qtd_retrabalho") || 0);

        // Seção 1: Mapeamento de Datas das 10 Fases
        const datesMap = [
          { label: "D1_PROTOCOLO", val: getVal(selectedProtocol, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT") },
          { label: "D1_ESCANEAMENTO", val: getVal(selectedProtocol, "d1Escaneamento", "D1_ESCANEAMENTO", "D1_ESCAN") },
          { label: "D2_CONTRADITORIO", val: getVal(selectedProtocol, "d2Contraditorio", "D2_CONTRADITORIO", "D2_CONTRAD") },
          { label: "D3_EXTRATO", val: getVal(selectedProtocol, "d3Extrato", "D3_EXTRATO", "D3_EXTR") },
          { label: "D4_QUALIFICACAO", val: getVal(selectedProtocol, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI") },
          { label: "D5_CALCULO", val: getVal(selectedProtocol, "d5Calculo", "D5_CALCULO", "D5_CALC") },
          { label: "D8_IMPRESSAO", val: getVal(selectedProtocol, "d8Impressao", "D8_IMPRESSAO", "D8_IMP") },
          { label: "D9_PREPARACAO", val: getVal(selectedProtocol, "d9Preparacao", "D9_PREPARACAO", "D9_PREP") },
          { label: "D9_CONFERENCIA", val: getVal(selectedProtocol, "d9Conferencia", "D9_CONFERENCIA", "D9_CONF") },
          { label: "D10_ENTREGA", val: getVal(selectedProtocol, "d10Entrega", "D10_ENTREGA", "D10_ENT") },
        ];

        // Seção 2: Cálculo dos Dias pelas 9 Transições
        const { phases } = getPhasesForRecord(selectedProtocol);
        let totalDiasSoma = 0;
        let temAlgumDia = false;
        phases.forEach(p => {
          if (p.dias !== null && p.dias !== undefined) {
            totalDiasSoma += Math.max(0, p.dias);
            temAlgumDia = true;
          }
        });

        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-[#05070D]/75 backdrop-blur-sm transition-opacity animate-in fade-in"
              onClick={() => setSelectedProtocol(null)}
            />

            {/* Painel Lateral */}
            <div className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-white/8 bg-[#0B1020]/96 shadow-2xl shadow-black/30 animate-in slide-in-from-right duration-300">
              
              {/* Header do Drawer */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] p-6">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                    Protocolo <span className="text-amber-300">{protNum}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-white/50">Linha do Tempo e Detalhamento por Fase</p>
                </div>

                <button
                  onClick={() => setSelectedProtocol(null)}
                  className="cursor-pointer rounded-xl bg-white/[0.05] p-2 text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Conteúdo com Scroll */}
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                
                {/* Badges de Status & Atraso Sem Duplicidade */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Status do Pedido</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bgClass}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Dias de Atraso</p>
                    <span className={`text-sm font-bold ${atrasoDias > 0 ? 'text-rose-300' : 'text-emerald-400'}`}>
                      {atrasoDias > 0 ? `${atrasoDias}d` : '0d'}
                    </span>
                  </div>
                </div>

                {/* Alerta de Retrabalho */}
                {retrabalho > 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 text-yellow-300 text-xs font-medium">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
                    <div>
                      <p className="font-bold">Atenção: Retrabalho Registrado ({retrabalho})</p>
                      <p className="text-yellow-300/80 text-[11px] mt-0.5">
                        Este protocolo passou por {retrabalho} reanálise(s) de retrabalho.
                      </p>
                    </div>
                  </div>
                )}

                {/* Seção 1 - Datas das Fases (10 Fases) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" /> Seção 1 - Datas das Fases
                  </h3>
                  
                  <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5 text-xs">
                    {datesMap.map((d, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <span className="text-white/60 font-mono">{d.label}:</span>
                        <span className={`font-medium ${d.val ? 'text-white' : 'text-white/30'}`}>
                          {formatDate(d.val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seção 2 - Quadro de Dias por Fase (9 Transições) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" /> Seção 2 - Quadro de Dias por Fase
                  </h3>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 text-xs">
                    {phases.map((phase, idx) => {
                      const hasDays = phase.dias !== null && phase.dias !== undefined;
                      const isGargalo = hasDays && (phase.dias ?? 0) > 3;

                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-white/70 font-medium">{phase.label}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isGargalo ? "text-rose-300" : hasDays ? "text-white" : "text-white/30"}`}>
                              {hasDays ? `${phase.dias}d` : "-"}
                            </span>
                            {isGargalo && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                                Gargalo
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* TOTAL */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between font-bold text-sm text-white">
                      <span className="text-purple-300">TOTAL DE DIAS NA ESTEIRA:</span>
                      <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-lg">
                        {temAlgumDia ? `${totalDiasSoma} dias` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer do Drawer */}
              <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
                <button
                  onClick={() => setSelectedProtocol(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
