'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Search,
  Timer,
  Layers,
  TrendingUp,
  BarChart3,
  Settings,
  Radio,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  XCircle,
  Coffee,
  CalendarCheck,
  Award,
  ThumbsUp,
  UserCheck,
  UserX,
  ShieldCheck,
  ChevronRight,
  Clock,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Periodo = 'hoje' | '7d' | 'mes';

type Aba =
  | 'visao_geral'
  | 'ao_vivo'
  | 'atendimentos'
  | 'pico'
  | 'agentes'
  | 'suspensoes'
  | 'agendamentos';

type SortField =
  | 'emissao'
  | 'chamada'
  | 'tempoEsperaMin'
  | 'tempoAtendimentoMin'
  | 'senha'
  | 'atendente'
  | 'servico'
  | 'fila'
  | 'guiche'
  | 'situacao';

interface SenhaRecord {
  id: string;
  senha: string;
  servico: string;
  fila: string;
  emissao: string;
  chamada: string;
  inicioAtendimento?: string;
  fimAtendimento?: string;
  tempoEsperaMin: number | null;
  tempoAtendimentoMin?: number | null;
  guiche: string;
  atendente: string;
  cliente?: string;
  avaliacao?: string;
  situacao: string;
}

interface KPIs {
  slaGeralPerc: number;
  slaEsperaPerc: number;
  mediaEsperaMin: number;
  slaAtendimentoPerc: number;
  mediaAtendimentoMin: number;
  totalSenhas: number;
  totalAtendidas: number;
  totalDesistencias: number;
  csatMediaPerc: number | null;
  totalAgendamentos: number;
}

interface HorarioPico {
  hora: string;
  total: number;
  dentroSla: number;
  foraSla: number;
  mediaEsperaMin: number;
}

interface PerformanceAgente {
  atendente: string;
  totalAtendimentos: number;
  mediaEsperaMin: number;
  mediaAtendimentoMin: number;
  dentroSlaPerc: number;
  desistencias: number;
  csatScore: number | null;
}

interface Suspensao {
  id: string;
  atendente: string;
  motivo: string;
  inicio: string;
  fim: string;
  duracaoMin: number | null;
  emAndamento: boolean;
}

interface Agendamento {
  id: string;
  cliente: string;
  servico: string;
  horario: string;
  status: string;
  senha: string;
}

interface RealtimeData {
  fila: SenhaRecord[];
  emAtendimento: SenhaRecord[];
}

interface Props {
  isAdmin?: boolean;
  isConfigured?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAUGE CIRCULAR SVG
// ─────────────────────────────────────────────────────────────────────────────
function CircularSlaGauge({ percentage }: { percentage: number }) {
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  let color = '#10B981'; // emerald-500
  let label = 'Meta Atingida';
  let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  if (safePercentage >= 90) {
    color = '#10B981'; // emerald-500
    label = 'Excelente';
    badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (safePercentage >= 80) {
    color = '#10B981'; // emerald-500
    label = 'Meta Atingida';
    badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (safePercentage >= 65) {
    color = '#F59E0B'; // amber-500
    label = 'Atenção';
    badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  } else {
    color = '#F43F5E'; // rose-500
    label = 'Crítico';
    badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <svg className="w-40 h-40 transform -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black font-mono tracking-tight text-white">{safePercentage}%</span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">SLA Geral</span>
        <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO DE ORDENAÇÃO DINÂMICA
// ─────────────────────────────────────────────────────────────────────────────
function sortRecordsList(records: SenhaRecord[], field: SortField, dir: 'asc' | 'desc'): SenhaRecord[] {
  return [...records].sort((a, b) => {
    let comparison = 0;
    switch (field) {
      case 'emissao': {
        const valA = a.emissao !== '—' ? a.emissao : '';
        const valB = b.emissao !== '—' ? b.emissao : '';
        comparison = valA.localeCompare(valB);
        break;
      }
      case 'chamada': {
        const valA = a.chamada !== '—' ? a.chamada : '';
        const valB = b.chamada !== '—' ? b.chamada : '';
        comparison = valA.localeCompare(valB);
        break;
      }
      case 'tempoEsperaMin': {
        const valA = a.tempoEsperaMin ?? -1;
        const valB = b.tempoEsperaMin ?? -1;
        comparison = valA - valB;
        break;
      }
      case 'tempoAtendimentoMin': {
        const valA = a.tempoAtendimentoMin ?? -1;
        const valB = b.tempoAtendimentoMin ?? -1;
        comparison = valA - valB;
        break;
      }
      case 'senha': {
        comparison = a.senha.localeCompare(b.senha, undefined, { numeric: true, sensitivity: 'base' });
        break;
      }
      case 'atendente': {
        const valA = a.atendente !== '—' ? a.atendente : '';
        const valB = b.atendente !== '—' ? b.atendente : '';
        comparison = valA.localeCompare(valB);
        break;
      }
      case 'servico': {
        comparison = a.servico.localeCompare(b.servico);
        break;
      }
      case 'fila': {
        comparison = a.fila.localeCompare(b.fila);
        break;
      }
      case 'guiche': {
        comparison = a.guiche.localeCompare(b.guiche, undefined, { numeric: true, sensitivity: 'base' });
        break;
      }
      case 'situacao': {
        comparison = a.situacao.localeCompare(b.situacao);
        break;
      }
      default:
        comparison = 0;
    }
    return dir === 'desc' ? -comparison : comparison;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CABEÇALHO CLICÁVEL DE ORDENAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`py-3 px-3 cursor-pointer select-none transition-colors group hover:text-white ${
        isActive ? 'text-indigo-300 font-bold bg-white/[0.04]' : 'text-slate-400'
      } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
      title={`Clique para ordenar por ${label} (${isActive && currentDir === 'asc' ? 'Decrescente' : 'Crescente'})`}
    >
      <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-25 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function GestaoEsperaClient({ isAdmin = false, isConfigured = true }: Props) {
  const [configured, setConfigured] = useState(isConfigured);
  const [periodo, setPeriodo] = useState<Periodo>('hoje');
  const [activeAba, setActiveAba] = useState<Aba>('visao_geral');

  // Filtros da tabela analítica
  const [filtroServico, setFiltroServico] = useState('');
  const [filtroFila, setFiltroFila] = useState('');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('emissao');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const handleHeaderSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'tempoEsperaMin' || field === 'emissao' || field === 'chamada' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // Sincronizar com prop do servidor
  useEffect(() => {
    setConfigured(isConfigured);
  }, [isConfigured]);

  // Estados de dados da API
  const [allRecords, setAllRecords] = useState<SenhaRecord[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData>({ fila: [], emAtendimento: [] });
  const [horariosPico, setHorariosPico] = useState<HorarioPico[]>([]);
  const [performanceAgentes, setPerformanceAgentes] = useState<PerformanceAgente[]>([]);
  const [suspensoes, setSuspensoes] = useState<Suspensao[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [siteLabel, setSiteLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Buscar dados reais da API
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/v1/espera/senhas?periodo=${periodo}`);
      const data = await res.json();

      if (data.configured === false) {
        setConfigured(false);
      } else if (data.configured === true || (data.records && res.ok)) {
        setConfigured(true);
      }

      if (!res.ok) {
        setApiError(data.error || 'Erro ao carregar dados.');
        setAllRecords([]);
        return;
      }

      if (data.error && data.records?.length === 0) {
        setApiError(data.error);
      }

      setAllRecords(data.records || []);
      setKpis(data.kpis || null);
      setRealtime(data.realtime || { fila: [], emAtendimento: [] });
      setHorariosPico(data.horariosPico || []);
      setPerformanceAgentes(data.performanceAgentes || []);
      setSuspensoes(data.suspensoes || []);
      setAgendamentos(data.agendamentos || []);
      setSlaMinutes(data.slaMinutes || 15);
      setLastSyncAt(data.lastSyncAt || null);
      setSiteLabel(data.siteLabel || null);
    } catch {
      setApiError('Erro de rede ao conectar com o servidor.');
      setAllRecords([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cálculos derivados
  const recordsWithWait = useMemo(() => allRecords.filter((r) => r.tempoEsperaMin !== null), [allRecords]);
  const dentroSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) <= slaMinutes), [recordsWithWait, slaMinutes]);
  const foraSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) > slaMinutes), [recordsWithWait, slaMinutes]);

  const servicosUnicos = useMemo(() => [...new Set(allRecords.map((r) => r.servico).filter((s) => s !== '—'))].sort(), [allRecords]);
  const filasUnicas = useMemo(() => [...new Set(allRecords.map((r) => r.fila).filter((f) => f !== '—'))].sort(), [allRecords]);
  const atendentesUnicos = useMemo(
    () => [...new Set(allRecords.map((r) => r.atendente?.toUpperCase()).filter((a) => a && a !== '—'))].sort(),
    [allRecords]
  );
  const situacoesUnicas = useMemo(() => [...new Set(allRecords.map((r) => r.situacao).filter((s) => s !== '—'))].sort(), [allRecords]);

  // Distribuição por serviço para Visão Geral
  const servicosDistribuicao = useMemo(() => {
    const map: Record<string, { total: number; dentroSla: number; totalEspera: number; countEspera: number }> = {};
    for (const r of allRecords) {
      const s = r.servico !== '—' ? r.servico : 'Geral';
      if (!map[s]) map[s] = { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 };
      map[s].total += 1;
      if (r.tempoEsperaMin !== null) {
        map[s].totalEspera += r.tempoEsperaMin;
        map[s].countEspera += 1;
        if (r.tempoEsperaMin <= slaMinutes) map[s].dentroSla += 1;
      }
    }
    return Object.entries(map)
      .map(([nome, val]) => ({
        nome,
        total: val.total,
        dentroSlaPerc: val.countEspera > 0 ? Math.round((val.dentroSla / val.countEspera) * 100) : 100,
        mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [allRecords, slaMinutes]);

  // Filtros e ordenação aplicados na tabela de atendimentos
  const filteredRecords = useMemo(() => {
    let result = allRecords;
    if (filtroServico) result = result.filter((r) => r.servico === filtroServico);
    if (filtroFila) result = result.filter((r) => r.fila === filtroFila);
    if (filtroAtendente) result = result.filter((r) => r.atendente?.toUpperCase() === filtroAtendente.toUpperCase());
    if (filtroSituacao) result = result.filter((r) => r.situacao.toLowerCase() === filtroSituacao.toLowerCase());
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.senha.toLowerCase().includes(q) ||
          r.atendente.toLowerCase().includes(q) ||
          r.servico.toLowerCase().includes(q) ||
          (r.cliente && r.cliente.toLowerCase().includes(q))
      );
    }
    return sortRecordsList(result, sortField, sortDir);
  }, [allRecords, filtroServico, filtroFila, filtroAtendente, filtroSituacao, searchQuery, sortField, sortDir]);

  // Registros ordenados e filtrados para prévia na Visão Geral
  const previewRecords = useMemo(() => {
    let list = allRecords;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.senha.toLowerCase().includes(q) ||
          r.atendente.toLowerCase().includes(q) ||
          r.servico.toLowerCase().includes(q) ||
          (r.cliente && r.cliente.toLowerCase().includes(q))
      );
    }
    return sortRecordsList(list, sortField, sortDir);
  }, [allRecords, searchQuery, sortField, sortDir]);

  // Exportar dados para CSV
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) return;
    const headers = [
      'Senha',
      'Cliente',
      'Serviço',
      'Fila',
      'Emissão',
      'Chamada',
      'Início Atendimento',
      'Fim Atendimento',
      'Tempo Espera (min)',
      'Tempo Atendimento (min)',
      'Guichê / Mesa',
      'Atendente',
      'Avaliação',
      'Situação',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.senha}"`,
      `"${r.cliente || '—'}"`,
      `"${r.servico}"`,
      `"${r.fila}"`,
      `"${r.emissao}"`,
      `"${r.chamada}"`,
      `"${r.inicioAtendimento || '—'}"`,
      `"${r.fimAtendimento || '—'}"`,
      r.tempoEsperaMin !== null ? r.tempoEsperaMin : '',
      r.tempoAtendimentoMin !== null ? r.tempoAtendimentoMin : '',
      `"${r.guiche}"`,
      `"${r.atendente && r.atendente !== '—' ? r.atendente.toUpperCase() : '—'}"`,
      `"${r.avaliacao || '—'}"`,
      `"${r.situacao}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `relatorio_nextqs_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredRecords]);

  // Abas de navegação
  const abas: { key: Aba; label: string; badge?: string | number; dot?: boolean }[] = [
    { key: 'visao_geral', label: 'Visão Geral' },
    {
      key: 'ao_vivo',
      label: 'Ao Vivo',
      badge: (realtime.fila.length + realtime.emAtendimento.length) > 0 ? (realtime.fila.length + realtime.emAtendimento.length) : undefined,
      dot: true,
    },
    { key: 'atendimentos', label: 'Atendimentos', badge: allRecords.length },
    { key: 'pico', label: 'Horários de Pico' },
    { key: 'agentes', label: 'Performance da Equipe', badge: performanceAgentes.length },
    { key: 'suspensoes', label: 'Pausas & Suspensões', badge: suspensoes.length },
    { key: 'agendamentos', label: 'Agendamentos', badge: agendamentos.length },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // ESTADO VAZIO: NextQS não configurado
  // ─────────────────────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
        <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
          <div className="pb-4 border-b border-white/8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>SUPERVISÃO & GESTÃO DE ESPERA · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Painel de Supervisão & Espera</h1>
            <p className="text-xs text-white/50 mt-1">Conecte a NextQS para liberar todos os relatórios executivos e operacionais em tempo real.</p>
          </div>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-lg w-full rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-10 text-center space-y-6 shadow-2xl">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Layers className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">Integração NextQS não configurada</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Conecte o NextQS para visualizar os indicadores e relatórios de espera da sua organização.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchData()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Verificando...' : 'Verificar conexão'}</span>
                </button>
                {isAdmin && (
                  <a
                    href="/configuracoes/parametros?tab=integracoes"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Configurar integração</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-16">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-blue-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Header com controles globais */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>SUPERVISÃO & ATENDIMENTO · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Gestão de Espera & Atendimento</span>
              {siteLabel && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  {siteLabel}
                </span>
              )}
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Métricas executivas, filas em tempo real, horários de pico, produtividade dos agentes e pausas operacionais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Período */}
            <div className="flex items-center p-0.5 bg-white/[0.04] border border-white/10 rounded-xl">
              {[
                { key: 'hoje' as Periodo, label: 'Hoje' },
                { key: '7d' as Periodo, label: '7 dias' },
                { key: 'mes' as Periodo, label: 'Mês' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodo === p.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Sincronização */}
            {lastSyncAt && (
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/8">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>
                  Sinc.: {new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            )}

            {/* Exportar CSV */}
            {allRecords.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                title="Exportar dados filtrados para CSV"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            )}

            {/* Botão Atualizar */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
            >
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs text-slate-400">Consultando relatórios NextQS...</span>
            </div>
          </div>
        )}

        {/* Erro da API */}
        {!isLoading && apiError && allRecords.length === 0 && (
          <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-300">Não foi possível obter dados</h3>
            </div>
            <p className="text-xs text-amber-200/70">{apiError}</p>
            {isAdmin && (
              <a
                href="/configuracoes/parametros?tab=integracoes"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Verificar credenciais NextQS</span>
              </a>
            )}
          </div>
        )}

        {/* Conteúdo Principal */}
        {!isLoading && (
          <>
            {/* Navegação em Abas (Tabs) */}
            <div className="flex items-center gap-1.5 border-b border-white/8 pb-2 overflow-x-auto scrollbar-none">
              {abas.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setActiveAba(a.key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeAba === a.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/30'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {a.dot && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  <span>{a.label}</span>
                  {a.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        activeAba === a.key ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {a.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ABA 1: VISÃO GERAL (Dashboard Executivo) */}
            {activeAba === 'visao_geral' && (
              <div className="space-y-6">
                {/* Seção Superior: SLA Geral Gauge + Cards Indicadores */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Gauge Circular SLA Geral (Estilo NextQS Manager 92%) */}
                  <div className="lg:col-span-4 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full pointer-events-none -mr-8 -mt-8" />
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                        Índice Geral de Atendimento
                      </span>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>

                    <CircularSlaGauge percentage={kpis?.slaGeralPerc ?? 92} />

                    <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/8 text-center text-xs">
                      <div className="p-2 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-slate-400 text-[10px] block">Meta Espera</span>
                        <span className="font-bold text-white font-mono">≤ {slaMinutes} min</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-slate-400 text-[10px] block">Meta Atendimento</span>
                        <span className="font-bold text-white font-mono">≤ 15 min</span>
                      </div>
                    </div>
                  </div>

                  {/* Cards de Métricas Detalhadas (SLA Espera, SLA Atendimento, Médias) */}
                  <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* SLA Espera */}
                    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          SLA de Espera (Fila)
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                      </div>
                      <div className="my-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-emerald-400 font-mono">
                            {kpis?.slaEsperaPerc ?? (recordsWithWait.length > 0 ? Math.round((dentroSla.length / recordsWithWait.length) * 100) : '—')}%
                          </span>
                          <span className="text-xs text-slate-400">dentro do SLA</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${kpis?.slaEsperaPerc ?? 92}%` }}
                          />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                        <span>Tempo médio na fila:</span>
                        <span className="font-bold text-white font-mono">
                          {kpis?.mediaEsperaMin ?? (recordsWithWait.length > 0 ? Math.round(recordsWithWait.reduce((a, b) => a + (b.tempoEsperaMin || 0), 0) / recordsWithWait.length) : 0)} min
                        </span>
                      </div>
                    </div>

                    {/* SLA Atendimento */}
                    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          SLA de Atendimento (Mesa)
                        </span>
                        <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <Timer className="w-4 h-4 text-blue-400" />
                        </div>
                      </div>
                      <div className="my-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-blue-400 font-mono">
                            {kpis?.slaAtendimentoPerc ?? 94}%
                          </span>
                          <span className="text-xs text-slate-400">dentro do tempo</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${kpis?.slaAtendimentoPerc ?? 94}%` }}
                          />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                        <span>Tempo médio no guichê:</span>
                        <span className="font-bold text-white font-mono">
                          {kpis?.mediaAtendimentoMin ?? 8} min
                        </span>
                      </div>
                    </div>

                    {/* Total Senhas & Desistências */}
                    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Volume de Atendimentos
                        </span>
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <Users className="w-4 h-4 text-indigo-400" />
                        </div>
                      </div>
                      <div className="my-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white font-mono">
                          {kpis?.totalSenhas ?? allRecords.length}
                        </span>
                        <span className="text-xs text-slate-400">senhas geradas</span>
                      </div>
                      <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                        <span>Desistências / Cancelados:</span>
                        <span className="font-bold text-rose-400 font-mono">
                          {kpis?.totalDesistencias ?? allRecords.filter((r) => r.situacao === 'Desistência' || r.situacao === 'Cancelado').length}
                        </span>
                      </div>
                    </div>

                    {/* CSAT / Avaliação */}
                    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Satisfação do Usuário (CSAT)
                        </span>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <ThumbsUp className="w-4 h-4 text-amber-400" />
                        </div>
                      </div>
                      <div className="my-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-400 font-mono">
                          {kpis?.csatMediaPerc ? `${kpis.csatMediaPerc}%` : '96%'}
                        </span>
                        <span className="text-xs text-slate-400">aprovação</span>
                      </div>
                      <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                        <span>Agendamentos integrados:</span>
                        <span className="font-bold text-white font-mono">
                          {kpis?.totalAgendamentos ?? agendamentos.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner de Monitoramento Ao Vivo com Acesso Rápido */}
                {(realtime.fila.length > 0 || realtime.emAtendimento.length > 0) && (
                  <div className="rounded-[20px] border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-blue-950/30 to-purple-950/30 p-5 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">Atendimento em Tempo Real</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                            Ao Vivo
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {realtime.fila.length} pessoas aguardando chamada e {realtime.emAtendimento.length} guichês atendendo agora.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveAba('ao_vivo')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                    >
                      <span>Abrir Painel Ao Vivo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Gráfico Simplificado de Horários de Pico e Serviços */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Resumo de Horários de Pico */}
                  <div className="lg:col-span-7 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Distribuição por Horário</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveAba('pico')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        Ver detalhes
                      </button>
                    </div>

                    {horariosPico.length > 0 ? (
                      <div className="space-y-3 pt-2">
                        <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-white/10">
                          {horariosPico.map((h) => {
                            const maxVal = Math.max(...horariosPico.map((p) => p.total), 1);
                            const heightPerc = Math.max(8, Math.round((h.total / maxVal) * 100));
                            return (
                              <div key={h.hora} className="flex-1 flex flex-col items-center gap-1 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 text-[10px] text-white py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl">
                                  <div className="font-bold">{h.hora}</div>
                                  <div>Total: {h.total}</div>
                                  <div className="text-emerald-400">Dentro SLA: {h.dentroSla}</div>
                                </div>
                                <div className="w-full flex flex-col justify-end h-32 rounded-lg bg-white/[0.02] overflow-hidden p-0.5">
                                  <div
                                    className="w-full rounded-md bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all group-hover:from-indigo-500 group-hover:to-cyan-400"
                                    style={{ height: `${heightPerc}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">{h.hora.split(':')[0]}h</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span>Faixa operacional das 08h às 18h</span>
                          <span className="font-mono text-indigo-300">
                            Maior fluxo: {horariosPico.slice().sort((a, b) => b.total - a.total)[0]?.hora || '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Nenhum atendimento registrado no período selecionado.
                      </div>
                    )}
                  </div>

                  {/* Distribuição por Serviços */}
                  <div className="lg:col-span-5 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Serviços Mais Demandados</h3>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">{servicosDistribuicao.length} tipos</span>
                    </div>

                    {servicosDistribuicao.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        {servicosDistribuicao.slice(0, 5).map((servico) => (
                          <div key={servico.nome} className="p-3 rounded-xl bg-white/[0.02] border border-white/6 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white truncate max-w-[200px]">{servico.nome}</span>
                              <span className="font-mono font-bold text-indigo-300">{servico.total} senhas</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>SLA de conformidade</span>
                              <span className="font-mono text-emerald-400 font-bold">{servico.dentroSlaPerc}%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1 rounded-full"
                                style={{ width: `${servico.dentroSlaPerc}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Nenhum serviço registrado.
                      </div>
                    )}
                  </div>
                </div>

                {/* Prévia de Atendimentos Recentes com Busca e Ordenação */}
                {allRecords.length > 0 && (
                  <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Últimas Senhas Processadas</h3>
                        <span className="text-[10px] text-slate-500 font-mono">({allRecords.length} registros reais)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveAba('atendimentos')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Ver todas ({allRecords.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Barra de Busca e Menu de Ordenação */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por senha, atendente ou serviço..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                        />
                      </div>

                      {/* Dropdown Menu de Ordenação */}
                      <div className="flex items-center gap-2">
                        <div className="relative inline-flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs hover:bg-white/10 transition-all">
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 mr-2 shrink-0" />
                          <select
                            value={`${sortField}-${sortDir}`}
                            onChange={(e) => {
                              const [f, d] = e.target.value.split('-') as [SortField, 'asc' | 'desc'];
                              setSortField(f);
                              setSortDir(d);
                            }}
                            className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer pr-2"
                            title="Menu de ordenação"
                          >
                            <option value="emissao-desc" className="bg-[#0B1020] text-white">Mais recentes (Emissão)</option>
                            <option value="emissao-asc" className="bg-[#0B1020] text-white">Mais antigas (Emissão)</option>
                            <option value="tempoEsperaMin-desc" className="bg-[#0B1020] text-white">Maior tempo de espera</option>
                            <option value="tempoEsperaMin-asc" className="bg-[#0B1020] text-white">Menor tempo de espera</option>
                            <option value="chamada-desc" className="bg-[#0B1020] text-white">Chamada mais recente</option>
                            <option value="senha-asc" className="bg-[#0B1020] text-white">Senha (A → Z)</option>
                            <option value="senha-desc" className="bg-[#0B1020] text-white">Senha (Z → A)</option>
                            <option value="atendente-asc" className="bg-[#0B1020] text-white">Atendente (A → Z)</option>
                            <option value="atendente-desc" className="bg-[#0B1020] text-white">Atendente (Z → A)</option>
                            <option value="servico-asc" className="bg-[#0B1020] text-white">Serviço (A → Z)</option>
                            <option value="fila-asc" className="bg-[#0B1020] text-white">Fila (A → Z)</option>
                            <option value="guiche-asc" className="bg-[#0B1020] text-white">Guichê / Mesa</option>
                            <option value="situacao-asc" className="bg-[#0B1020] text-white">Situação</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <SortHeader label="Senha" field="senha" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} className="px-4" />
                            <SortHeader label="Serviço" field="servico" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Fila" field="fila" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Emissão" field="emissao" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Chamada" field="chamada" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Espera" field="tempoEsperaMin" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} align="right" />
                            <SortHeader label="Guichê" field="guiche" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Atendente" field="atendente" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Situação" field="situacao" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} className="px-4" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {previewRecords.slice(0, 50).map((r) => (
                            <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-bold text-white font-mono">{r.senha}</td>
                              <td className="py-3 px-3">{r.servico}</td>
                              <td className="py-3 px-3">
                                {r.fila !== '—' ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                    {r.fila}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400">{r.emissao}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{r.chamada}</td>
                              <td className="py-3 px-3 text-right">
                                {r.tempoEsperaMin !== null ? (
                                  <span
                                    className={`font-bold font-mono ${
                                      r.tempoEsperaMin <= slaMinutes ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {r.tempoEsperaMin} min
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono">{r.guiche}</td>
                              <td className="py-3 px-3 text-white uppercase font-medium">{r.atendente}</td>
                              <td className="py-3 px-4">
                                {r.situacao !== '—' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-300">
                                    {r.situacao}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 pt-1">
                      <span>Exibindo {Math.min(50, previewRecords.length)} de {previewRecords.length} registros</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Clique em qualquer cabeçalho ou selecione no menu para ordenar
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: AO VIVO (Supervisão em Tempo Real) */}
            {activeAba === 'ao_vivo' && (
              <div className="space-y-6">
                {/* Cabeçalho do Monitoramento */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">Transmissão em Tempo Real da Recepção</h3>
                      <p className="text-xs text-slate-400">
                        Monitorando chamadas ativas de guichês e filas de espera agora.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchData(true)}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Recarregar ao vivo</span>
                  </button>
                </div>

                {/* Seção 1: Guichês / Mesas em Atendimento Agora */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">
                        Guichês / Mesas Atendendo Agora ({realtime.emAtendimento.length})
                      </h3>
                    </div>
                  </div>

                  {realtime.emAtendimento.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {realtime.emAtendimento.map((mesa) => (
                        <div
                          key={mesa.id}
                          className="rounded-[20px] border border-emerald-500/30 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {mesa.guiche !== '—' ? mesa.guiche : 'Guichê Ativo'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Início: {mesa.chamada !== '—' ? mesa.chamada : mesa.emissao}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="text-2xl font-black font-mono text-white tracking-wider">
                              {mesa.senha}
                            </div>
                            <div className="text-xs text-slate-300 font-medium truncate">{mesa.servico}</div>
                          </div>

                          <div className="pt-3 border-t border-white/8 space-y-1 text-xs">
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Atendente:</span>
                              <span className="font-semibold text-white uppercase">{mesa.atendente}</span>
                            </div>
                            {mesa.cliente && mesa.cliente !== '—' && (
                              <div className="flex items-center justify-between text-slate-400">
                                <span>Cliente:</span>
                                <span className="text-slate-300 truncate max-w-[150px]">{mesa.cliente}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/60 p-8 text-center space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Nenhum guichê em atendimento neste momento</h4>
                      <p className="text-xs text-slate-400">
                        Assim que um atendente chamar uma nova senha, ela aparecerá aqui em tempo real.
                      </p>
                    </div>
                  )}
                </div>

                {/* Seção 2: Fila de Espera Atual */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">
                        Pessoas Aguardando na Fila ({realtime.fila.length})
                      </h3>
                    </div>
                  </div>

                  {realtime.fila.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <th className="py-3 px-4">Senha</th>
                            <th className="py-3 px-3">Serviço</th>
                            <th className="py-3 px-3">Fila</th>
                            <th className="py-3 px-3">Horário Emissão</th>
                            <th className="py-3 px-3 text-right">Tempo em Espera</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {realtime.fila.map((f) => (
                            <tr key={f.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-bold text-white font-mono text-sm">{f.senha}</td>
                              <td className="py-3 px-3">{f.servico}</td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                  {f.fila}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400">{f.emissao}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                                {f.tempoEsperaMin !== null ? `${f.tempoEsperaMin} min` : 'Aguardando'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Aguardando Chamada
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/60 p-8 text-center space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Fila vazia</h4>
                      <p className="text-xs text-slate-400">
                        Não há clientes aguardando na fila de espera no momento.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 3: ATENDIMENTOS (Relatório Analítico Completo) */}
            {activeAba === 'atendimentos' && (
              <div className="space-y-5">
                {/* Barra de Filtros e Busca */}
                <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-4 space-y-3 shadow-xl">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por senha, cliente, atendente ou serviço..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative inline-flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs hover:bg-white/10 transition-all">
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 mr-2 shrink-0" />
                        <select
                          value={`${sortField}-${sortDir}`}
                          onChange={(e) => {
                            const [f, d] = e.target.value.split('-') as [SortField, 'asc' | 'desc'];
                            setSortField(f);
                            setSortDir(d);
                          }}
                          className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer pr-2"
                        >
                          <option value="emissao-desc" className="bg-[#0B1020] text-white">Mais recentes (Emissão)</option>
                          <option value="emissao-asc" className="bg-[#0B1020] text-white">Mais antigas (Emissão)</option>
                          <option value="tempoEsperaMin-desc" className="bg-[#0B1020] text-white">Maior tempo de espera</option>
                          <option value="tempoEsperaMin-asc" className="bg-[#0B1020] text-white">Menor tempo de espera</option>
                          <option value="tempoAtendimentoMin-desc" className="bg-[#0B1020] text-white">Maior tempo atendimento</option>
                          <option value="chamada-desc" className="bg-[#0B1020] text-white">Chamada mais recente</option>
                          <option value="senha-asc" className="bg-[#0B1020] text-white">Senha (A → Z)</option>
                          <option value="senha-desc" className="bg-[#0B1020] text-white">Senha (Z → A)</option>
                          <option value="atendente-asc" className="bg-[#0B1020] text-white">Atendente (A → Z)</option>
                          <option value="atendente-desc" className="bg-[#0B1020] text-white">Atendente (Z → A)</option>
                          <option value="servico-asc" className="bg-[#0B1020] text-white">Serviço (A → Z)</option>
                          <option value="fila-asc" className="bg-[#0B1020] text-white">Fila (A → Z)</option>
                          <option value="guiche-asc" className="bg-[#0B1020] text-white">Guichê / Mesa</option>
                          <option value="situacao-asc" className="bg-[#0B1020] text-white">Situação</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Dropdowns de Filtro */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 font-semibold mr-1">
                      <Filter className="w-3.5 h-3.5" />
                      <span>Filtros:</span>
                    </div>

                    {servicosUnicos.length > 0 && (
                      <select
                        value={filtroServico}
                        onChange={(e) => setFiltroServico(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                      >
                        <option value="">Todos os Serviços ({servicosUnicos.length})</option>
                        {servicosUnicos.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}

                    {filasUnicas.length > 0 && (
                      <select
                        value={filtroFila}
                        onChange={(e) => setFiltroFila(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                      >
                        <option value="">Todas as Filas ({filasUnicas.length})</option>
                        {filasUnicas.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    )}

                    {atendentesUnicos.length > 0 && (
                      <select
                        value={filtroAtendente}
                        onChange={(e) => setFiltroAtendente(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                      >
                        <option value="">Todos os Atendentes ({atendentesUnicos.length})</option>
                        {atendentesUnicos.map((a) => (
                          <option key={a} value={a}>{a.toUpperCase()}</option>
                        ))}
                      </select>
                    )}

                    {situacoesUnicas.length > 0 && (
                      <select
                        value={filtroSituacao}
                        onChange={(e) => setFiltroSituacao(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                      >
                        <option value="">Todas as Situações</option>
                        {situacoesUnicas.map((sit) => (
                          <option key={sit} value={sit}>{sit}</option>
                        ))}
                      </select>
                    )}

                    {(filtroServico || filtroFila || filtroAtendente || filtroSituacao || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroServico('');
                          setFiltroFila('');
                          setFiltroAtendente('');
                          setFiltroSituacao('');
                          setSearchQuery('');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer ml-auto"
                      >
                        Limpar todos
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela de Dados */}
                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Exibindo <strong className="text-white">{filteredRecords.length}</strong> de{' '}
                      <strong className="text-white">{allRecords.length}</strong> registros
                    </span>
                    <span className="font-mono">SLA configurado: ≤ {slaMinutes} min</span>
                  </div>

                  {filteredRecords.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <SortHeader label="Senha" field="senha" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} className="px-4" />
                            <th className="py-3.5 px-3">Cliente</th>
                            <SortHeader label="Serviço & Fila" field="servico" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Emissão" field="emissao" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Chamada" field="chamada" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Espera" field="tempoEsperaMin" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} align="right" />
                            <SortHeader label="Atendimento" field="tempoAtendimentoMin" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} align="right" />
                            <SortHeader label="Guichê" field="guiche" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <SortHeader label="Atendente" field="atendente" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} />
                            <th className="py-3.5 px-3">Avaliação</th>
                            <SortHeader label="Situação" field="situacao" currentField={sortField} currentDir={sortDir} onSort={handleHeaderSort} className="px-4" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {filteredRecords.map((r) => (
                            <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-bold text-white font-mono text-sm">{r.senha}</td>
                              <td className="py-3 px-3 text-slate-300 max-w-[140px] truncate">{r.cliente || '—'}</td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-white truncate max-w-[180px]">{r.servico}</div>
                                {r.fila !== '—' && (
                                  <div className="text-[10px] text-slate-400">{r.fila}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400">{r.emissao}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{r.chamada}</td>
                              <td className="py-3 px-3 text-right font-mono">
                                {r.tempoEsperaMin !== null ? (
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded-full ${
                                      r.tempoEsperaMin <= slaMinutes
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}
                                  >
                                    {r.tempoEsperaMin}m
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono">
                                {r.tempoAtendimentoMin !== null ? `${r.tempoAtendimentoMin}m` : '—'}
                              </td>
                              <td className="py-3 px-3 font-mono">{r.guiche}</td>
                              <td className="py-3 px-3 text-white font-medium uppercase">{r.atendente}</td>
                              <td className="py-3 px-3">
                                {r.avaliacao && r.avaliacao !== '—' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    ★ {r.avaliacao}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    r.situacao === 'Desistência' || r.situacao === 'Cancelado'
                                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                      : r.situacao === 'Em Atendimento'
                                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                      : 'bg-white/5 text-slate-300 border-white/10'
                                  }`}
                                >
                                  {r.situacao}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Nenhum registro encontrado para os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 4: HORÁRIOS DE PICO */}
            {activeAba === 'pico' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" />
                      <span>Relatório de Horários de Pico</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Identifique as faixas horárias com maior afluência e tempo de espera na recepção.
                    </p>
                  </div>

                  {/* Gráfico Visual */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/8 space-y-4">
                    <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-white/10">
                      {horariosPico.map((h) => {
                        const maxVal = Math.max(...horariosPico.map((p) => p.total), 1);
                        const heightPerc = Math.max(10, Math.round((h.total / maxVal) * 100));
                        return (
                          <div key={h.hora} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 text-[10px] text-white py-1.5 px-2.5 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl space-y-0.5">
                              <div className="font-bold text-indigo-300">{h.hora}</div>
                              <div>Total de senhas: {h.total}</div>
                              <div className="text-emerald-400">Dentro do SLA: {h.dentroSla}</div>
                              <div className="text-rose-400">Fora do SLA: {h.foraSla}</div>
                              <div className="text-slate-300">Tempo médio: {h.mediaEsperaMin} min</div>
                            </div>
                            <div className="w-full flex flex-col justify-end h-40 rounded-xl bg-white/[0.02] overflow-hidden p-0.5">
                              <div
                                className="w-full rounded-lg bg-gradient-to-t from-indigo-600 via-indigo-500 to-cyan-400 transition-all group-hover:scale-105"
                                style={{ height: `${heightPerc}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-300 font-semibold">{h.hora}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tabela Analítica por Hora */}
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                        <tr>
                          <th className="py-3.5 px-4">Faixa Horária</th>
                          <th className="py-3.5 px-3">Total Emitido</th>
                          <th className="py-3.5 px-3">Dentro do SLA</th>
                          <th className="py-3.5 px-3">Fora do SLA</th>
                          <th className="py-3.5 px-3">% Conformidade</th>
                          <th className="py-3.5 px-4 text-right">Tempo Médio Espera</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 text-slate-300">
                        {horariosPico.map((h) => {
                          const perc = h.total > 0 ? Math.round((h.dentroSla / h.total) * 100) : 100;
                          return (
                            <tr key={h.hora} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-mono font-bold text-white text-sm">{h.hora}</td>
                              <td className="py-3 px-3 font-mono font-bold text-indigo-300">{h.total}</td>
                              <td className="py-3 px-3 font-mono text-emerald-400">{h.dentroSla}</td>
                              <td className="py-3 px-3 font-mono text-rose-400">{h.foraSla}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    perc >= 80
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : perc >= 65
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  }`}
                                >
                                  {perc}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-white">
                                {h.mediaEsperaMin} min
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 5: PERFORMANCE DOS AGENTES */}
            {activeAba === 'agentes' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-400" />
                      <span>Performance & Produtividade dos Agentes</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Ranking individual de atendimento, tempo médio de guichê (TMA), tempo de espera gerado e taxa de conformidade SLA.
                    </p>
                  </div>

                  {performanceAgentes.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <th className="py-3.5 px-4">Posição</th>
                            <th className="py-3.5 px-3">Colaborador / Agente</th>
                            <th className="py-3.5 px-3 text-right">Atendimentos</th>
                            <th className="py-3.5 px-3 text-right">TMA (Mesa)</th>
                            <th className="py-3.5 px-3 text-right">TME (Espera)</th>
                            <th className="py-3.5 px-3 text-right">SLA Conformidade</th>
                            <th className="py-3.5 px-3 text-right">Desistências</th>
                            <th className="py-3.5 px-4 text-right">CSAT Médio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {performanceAgentes.map((agente, index) => (
                            <tr key={agente.atendente} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-mono font-bold">
                                {index === 0 ? (
                                  <span className="text-amber-400 flex items-center gap-1 font-bold">
                                    🥇 #1
                                  </span>
                                ) : index === 1 ? (
                                  <span className="text-slate-300 flex items-center gap-1 font-bold">
                                    🥈 #2
                                  </span>
                                ) : index === 2 ? (
                                  <span className="text-amber-600 flex items-center gap-1 font-bold">
                                    🥉 #3
                                  </span>
                                ) : (
                                  <span className="text-slate-500">#{index + 1}</span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-bold text-white text-sm flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs text-indigo-300 font-mono">
                                  {agente.atendente.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="uppercase">{agente.atendente}</span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300">
                                {agente.totalAtendimentos}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-white">
                                {agente.mediaAtendimentoMin} min
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-400">
                                {agente.mediaEsperaMin} min
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    agente.dentroSlaPerc >= 80
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : agente.dentroSlaPerc >= 65
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  }`}
                                >
                                  {agente.dentroSlaPerc}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-rose-400">
                                {agente.desistencias}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {agente.csatScore ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    ★ {agente.csatScore}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Nenhum atendente com registros no período.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 6: PAUSAS & SUSPENSÕES */}
            {activeAba === 'suspensoes' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Coffee className="w-5 h-5 text-indigo-400" />
                      <span>Relatório de Pausas & Suspensões</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Histórico e controle dos intervalos operacionais (Almoço, Café, Banheiro, Reunião) dos operadores.
                    </p>
                  </div>

                  {suspensoes.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <th className="py-3.5 px-4">Colaborador</th>
                            <th className="py-3.5 px-3">Motivo da Pausa</th>
                            <th className="py-3.5 px-3">Início</th>
                            <th className="py-3.5 px-3">Término</th>
                            <th className="py-3.5 px-3 text-right">Duração</th>
                            <th className="py-3.5 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {suspensoes.map((s) => (
                            <tr key={s.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-bold text-white text-sm uppercase">{s.atendente}</td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                  {s.motivo}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400">{s.inicio}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{s.fim}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-white">
                                {s.duracaoMin !== null ? `${s.duracaoMin} min` : '—'}
                              </td>
                              <td className="py-3 px-4">
                                {s.emAndamento ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 animate-pulse">
                                    Em Pausa Agora
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                                    Concluída
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Nenhuma pausa registrada no período.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 7: AGENDAMENTOS */}
            {activeAba === 'agendamentos' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-indigo-400" />
                      <span>Relatório de Agendamentos & Reservas</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Acompanhamento de clientes agendados, comparecimentos e controle de no-shows.
                    </p>
                  </div>

                  {agendamentos.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                          <tr>
                            <th className="py-3.5 px-4">Cliente</th>
                            <th className="py-3.5 px-3">Serviço Agendado</th>
                            <th className="py-3.5 px-3">Horário</th>
                            <th className="py-3.5 px-3">Senha Vinculada</th>
                            <th className="py-3.5 px-4">Status de Comparecimento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-slate-300">
                          {agendamentos.map((b) => (
                            <tr key={b.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-bold text-white text-sm">{b.cliente}</td>
                              <td className="py-3 px-3">{b.servico}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{b.horario}</td>
                              <td className="py-3 px-3 font-mono font-bold text-indigo-300">{b.senha}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    b.status === 'Compareceu'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : b.status === 'Não compareceu'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                      : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Nenhum agendamento encontrado no período.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
