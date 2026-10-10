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
  User,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  ExternalLink,
  Info,
  X,
} from 'lucide-react';

import { EsperaCalendarCard } from './EsperaCalendarCard';
import { isWeekend, generateMonthRecords } from '@/lib/espera/historical-generator';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Periodo = 'hoje' | '7d' | 'mes';

type Aba =
  | 'visao_geral'
  | 'ao_vivo'
  | 'atendimentos'
  | 'pico'
  | 'agentes';

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
  data?: string;
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
  initialData?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAUGE CIRCULAR SVG
// ─────────────────────────────────────────────────────────────────────────────
function CircularSlaGauge({
  percentage,
  slaMinutes = 15,
  isOpen = false,
  onToggleOpen,
  onClose,
}: {
  percentage: number;
  slaMinutes?: number;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
}) {
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  const [isHovered, setIsHovered] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const showPopover = isOpen || isHovered;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsHovered(false);
        if (onClose) onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsHovered(false);
        if (onClose) onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center p-2 cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggleOpen?.()}
      title="Clique ou passe o cursor sobre o SLA Geral para ver os critérios explicativos"
    >
      <svg className="w-40 h-40 transform -rotate-90 group-hover:scale-[1.03] transition-transform duration-300">
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

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <span className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-emerald-300 transition-colors">
          {safePercentage}%
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-indigo-300 transition-colors">
            SLA Geral
          </span>
          <Info className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
        </div>
        <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${badgeBg}`}>
          {label}
        </span>
        <span className="text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors mt-0.5 font-medium">
          Ver critérios
        </span>
      </div>

      {/* POPUP FLUTUANTE COM QUADRO EXPLICATIVO */}
      {showPopover && (
        <div
          className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] max-w-[calc(100vw-2.5rem)] bg-[#0B1020]/95 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl shadow-black/95 animate-in fade-in zoom-in-95 duration-200 text-left cursor-default pointer-events-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho do Popover */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Critérios de Classificação do SLA Geral
                </h4>
                <p className="text-[10px] text-slate-400">
                  Índice Atual:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {safePercentage}% ({label})
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsHovered(false);
                if (onClose) onClose();
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabela de Classificação */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-2 px-2.5">Faixa de SLA</th>
                  <th className="py-2 px-2 text-center">Cor</th>
                  <th className="py-2 px-2">Status / Selo</th>
                  <th className="py-2 px-2.5">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {/* Linha >= 90% */}
                <tr
                  className={`transition-colors ${
                    safePercentage >= 90
                      ? 'bg-emerald-500/15 border-l-2 border-emerald-400 font-medium'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="py-2 px-2.5 font-mono font-bold text-white whitespace-nowrap">
                    ≥ 90%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                      <span className="text-[10px] text-slate-300 hidden sm:inline">Verde</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      Excelente
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-slate-300 text-[11px]">
                    Desempenho acima da média
                    {safePercentage >= 90 && (
                      <span className="ml-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                        ★ Atual
                      </span>
                    )}
                  </td>
                </tr>

                {/* Linha 80% a 89% */}
                <tr
                  className={`transition-colors ${
                    safePercentage >= 80 && safePercentage < 90
                      ? 'bg-emerald-500/15 border-l-2 border-emerald-400 font-medium'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="py-2 px-2.5 font-mono font-bold text-white whitespace-nowrap">
                    80% a 89%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                      <span className="text-[10px] text-slate-300 hidden sm:inline">Verde</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      Meta Atingida
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-slate-200 text-[11px]">
                    Cumprimento pleno do SLA
                    {safePercentage >= 80 && safePercentage < 90 && (
                      <span className="ml-1.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/25 px-1.5 py-0.5 rounded border border-emerald-500/40 inline-block">
                        ✓ Seu SLA ({safePercentage}%)
                      </span>
                    )}
                  </td>
                </tr>

                {/* Linha 65% a 79% */}
                <tr
                  className={`transition-colors ${
                    safePercentage >= 65 && safePercentage < 80
                      ? 'bg-amber-500/15 border-l-2 border-amber-400 font-medium'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="py-2 px-2.5 font-mono font-bold text-white whitespace-nowrap">
                    65% a 79%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                      <span className="text-[10px] text-slate-300 hidden sm:inline">Âmbar</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                      Atenção
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-slate-300 text-[11px]">
                    Ponto de observação operacional
                    {safePercentage >= 65 && safePercentage < 80 && (
                      <span className="ml-1 text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        ★ Atual
                      </span>
                    )}
                  </td>
                </tr>

                {/* Linha < 65% */}
                <tr
                  className={`transition-colors ${
                    safePercentage < 65
                      ? 'bg-rose-500/15 border-l-2 border-rose-400 font-medium'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="py-2 px-2.5 font-mono font-bold text-white whitespace-nowrap">
                    &lt; 65%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400/50" />
                      <span className="text-[10px] text-slate-300 hidden sm:inline">Vermelho</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                      Crítico
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-slate-300 text-[11px]">
                    Necessita intervenção imediata
                    {safePercentage < 65 && (
                      <span className="ml-1 text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">
                        ★ Atual
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Nota do Cálculo Ponderado */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
            <span className="text-amber-400 shrink-0">💡</span>
            <span>
              <strong className="text-slate-200">Cálculo Ponderado do SLA Geral:</strong>{' '}
              60% do SLA da Fila de Espera (Meta ≤ {slaMinutes} min) + 40% do SLA do Tempo no Guichê (Meta ≤ 15 min).
            </span>
          </div>
        </div>
      )}
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
      className={`py-3.5 px-4 cursor-pointer select-none transition-colors group ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
      } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
      title={`Clique para ordenar por ${label} (${isActive && currentDir === 'asc' ? 'Decrescente' : 'Crescente'})`}
    >
      <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end w-full' : ''}`}>
        <span>{label}</span>
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGES E TRATAMENTO DE SERVIÇOS PADRÃO FIORIX
// ─────────────────────────────────────────────────────────────────────────────
function cleanServiceName(name: string): string {
  if (!name || name === '—') return name;
  const upper = name.trim().toUpperCase();
  if (
    upper === 'NÃO AGENDADO' ||
    upper === 'NAO AGENDADO' ||
    upper === 'NÃO-AGENDADO' ||
    upper === 'NAO-AGENDADO' ||
    upper.includes('NÃO AGENDADO') ||
    upper.includes('NAO AGENDADO')
  ) {
    return 'TÍTULO';
  }
  if (
    upper === 'CERTIDÕES PRONTAS' ||
    upper === 'CERTIDOES PRONTAS' ||
    upper === 'CERTIDÕES NA HORA' ||
    upper === 'CERTIDOES NA HORA' ||
    upper.includes('CERTIDÕES PRONTAS') ||
    upper.includes('CERTIDOES PRONTAS') ||
    upper.includes('CERTIDÕES NA HORA') ||
    upper.includes('CERTIDOES NA HORA')
  ) {
    return 'CERTIDÕES NA HORA';
  }
  if (
    upper === 'CERTIDÃO' ||
    upper === 'CERTIDAO' ||
    upper === 'PEDIDO DE CERTIDÃO' ||
    upper === 'PEDIDO DE CERTIDAO' ||
    upper.includes('PEDIDO DE CERTID') ||
    upper === 'CERTIDÕES' ||
    upper === 'CERTIDOES'
  ) {
    return 'PEDIDO DE CERTIDÃO';
  }
  return name.trim();
}

function sanitizeRecord(r: SenhaRecord): SenhaRecord {
  return {
    ...r,
    servico: cleanServiceName(r.servico),
    fila: cleanServiceName(r.fila),
  };
}

function sanitizeRecords(records: SenhaRecord[]): SenhaRecord[] {
  return (records || []).map(sanitizeRecord);
}

function sanitizeRealtime(rt: RealtimeData): RealtimeData {
  return {
    fila: (rt?.fila || []).map(sanitizeRecord),
    emAtendimento: (rt?.emAtendimento || []).map(sanitizeRecord),
  };
}

function getSituacaoBadge(situacao: string) {
  if (!situacao || situacao === '—') {
    return <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>;
  }
  const s = situacao.toLowerCase();
  if (s.includes('atendimento')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shadow-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
        {situacao}
      </span>
    );
  }
  if (s.includes('chamado')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        {situacao}
      </span>
    );
  }
  if (s.includes('finalizado') || s.includes('conclu') || s.includes('realizado')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        {situacao}
      </span>
    );
  }
  if (s.includes('desist') || s.includes('cancel')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
        {situacao}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
      {situacao}
    </span>
  );
}

function getServicoBadge(servico: string) {
  if (!servico || servico === '—') return <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>;
  const cleaned = cleanServiceName(servico);
  const s = cleaned.toUpperCase();
  let badgeStyle = 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10';
  if (s.includes('PRIORIDADE')) {
    badgeStyle = 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30';
  } else if (s.includes('CERTID')) {
    badgeStyle = 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30';
  } else if (s.includes('RETIRADA')) {
    badgeStyle = 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30';
  } else if (s.includes('AGENDADO') || s.includes('TÍTULO') || s.includes('TITULO')) {
    badgeStyle = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25';
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badgeStyle} whitespace-nowrap shadow-xs`}>
      {cleaned}
    </span>
  );
}

function getFilaBadge(fila: string) {
  if (!fila || fila === '—') return <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>;
  const cleaned = cleanServiceName(fila);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 whitespace-nowrap">
      {cleaned}
    </span>
  );
}

function getAtendenteAvatar(name: string) {
  if (!name || name === '—') return null;
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '');
  return initials.toUpperCase();
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function GestaoEsperaClient({ isAdmin = false, isConfigured = true, initialData }: Props) {
  const [configured, setConfigured] = useState(isConfigured);
  const [periodo, setPeriodo] = useState<string>('mes');
  const [activeAba, setActiveAba] = useState<Aba>('visao_geral');

  // Filtros da tabela analítica
  const [filtroServico, setFiltroServico] = useState('');
  const [filtroFila, setFiltroFila] = useState('');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('emissao');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Estados para o Card "Últimas Senhas Processadas"
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [previewFiltroSituacao, setPreviewFiltroSituacao] = useState('ALL');
  const [previewFiltroServico, setPreviewFiltroServico] = useState('ALL');

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

  // Estados de dados da API inicializados diretamente com dados do servidor (0ms de latência percebida)
  const [allRecords, setAllRecords] = useState<SenhaRecord[]>(sanitizeRecords(initialData?.records || []));
  const [kpis, setKpis] = useState<KPIs | null>(initialData?.kpis || null);
  const [realtime, setRealtime] = useState<RealtimeData>(sanitizeRealtime(initialData?.realtime || { fila: [], emAtendimento: [] }));
  const [horariosPico, setHorariosPico] = useState<HorarioPico[]>(initialData?.horariosPico || []);
  const [performanceAgentes, setPerformanceAgentes] = useState<PerformanceAgente[]>(initialData?.performanceAgentes || []);
  const [suspensoes, setSuspensoes] = useState<Suspensao[]>(initialData?.suspensoes || []);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(initialData?.agendamentos || []);
  const [slaMinutes, setSlaMinutes] = useState(initialData?.slaMinutes || 15);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialData?.lastSyncAt || null);
  const [siteLabel, setSiteLabel] = useState<string | null>(initialData?.siteLabel || null);
  const [isLoading, setIsLoading] = useState(!initialData?.records || initialData.records.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSlaInfo, setShowSlaInfo] = useState(false);

  // Evita refetch imediato na montagem se já recebemos dados SSR do servidor
  const hasMountedInitial = React.useRef(!!(initialData?.records && initialData.records.length > 0));

  // Hidratação instantânea a partir do cache local de sessão (0ms de carregamento ao trocar de abas)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`fiorix_espera_${periodo}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.records && Array.isArray(data.records) && data.records.length > 0) {
          setAllRecords(sanitizeRecords(data.records));
          if (data.kpis) setKpis(data.kpis);
          if (data.realtime) setRealtime(sanitizeRealtime(data.realtime));
          if (data.horariosPico) setHorariosPico(data.horariosPico);
          if (data.performanceAgentes) setPerformanceAgentes(data.performanceAgentes);
          if (data.suspensoes) setSuspensoes(data.suspensoes);
          if (data.agendamentos) setAgendamentos(data.agendamentos);
          if (data.siteLabel) setSiteLabel(data.siteLabel);
          setIsLoading(false);
        }
      }
    } catch {}
  }, [periodo]);

  // Buscar dados reais da API com suporte a cache e refresh forçado
  const fetchData = useCallback(async (showRefresh = false) => {
    setIsRefreshing(true);
    setApiError(null);

    try {
      const refreshParam = showRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/v1/espera/senhas?periodo=${periodo}${refreshParam}`);
      const data = await res.json();

      if (data.configured === false) {
        setConfigured(false);
      } else if (data.configured === true || (data.records && res.ok)) {
        setConfigured(true);
      }

      if (!res.ok) {
        setApiError(data.error || 'Erro ao carregar dados.');
        return;
      }

      if (data.error && data.records?.length === 0) {
        setApiError(data.error);
      }

      if (Array.isArray(data.records)) {
        setAllRecords(sanitizeRecords(data.records));
        try {
          sessionStorage.setItem(`fiorix_espera_${periodo}`, JSON.stringify(data));
        } catch {}
      }
      setKpis(data.kpis || null);
      setRealtime(sanitizeRealtime(data.realtime || { fila: [], emAtendimento: [] }));
      setHorariosPico(data.horariosPico || []);
      setPerformanceAgentes(data.performanceAgentes || []);
      setSuspensoes(data.suspensoes || []);
      setAgendamentos(data.agendamentos || []);
      setSlaMinutes(data.slaMinutes || 15);
      setLastSyncAt(data.lastSyncAt || null);
      setSiteLabel(data.siteLabel || null);
    } catch {
      setApiError('Erro de rede ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    if (hasMountedInitial.current && periodo === 'hoje') {
      hasMountedInitial.current = false;
      return;
    }
    fetchData();
  }, [periodo, fetchData]);

  // Registros do mês completo para garantir que o Calendário exiba os números de todos os dias
  // e permita filtrar qualquer dia com 0ms de latência
  const [monthRecords, setMonthRecords] = useState<SenhaRecord[]>(() => {
    try {
      const cached = sessionStorage.getItem('fiorix_espera_mes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.records && Array.isArray(parsed.records) && parsed.records.length > 0) {
          return sanitizeRecords(parsed.records);
        }
      }
    } catch {}
    return [];
  });

  // Busca dados do mês em background para manter o calendário sempre preenchido com dados reais
  useEffect(() => {
    if (periodo === 'mes' && allRecords.length > 0) {
      setMonthRecords(allRecords);
      try {
        sessionStorage.setItem('fiorix_espera_mes', JSON.stringify({ records: allRecords }));
      } catch {}
      return;
    }

    let isCancelled = false;
    fetch('/api/v1/espera/senhas?periodo=mes')
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.records && Array.isArray(data.records) && data.records.length > 0) {
          const sanitized = sanitizeRecords(data.records);
          setMonthRecords(sanitized);
          try {
            sessionStorage.setItem('fiorix_espera_mes', JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [periodo, allRecords]);

  // Estado de data selecionada no calendário interativo
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Limpa filtro de data ao alternar período
  useEffect(() => {
    setSelectedDate(null);
  }, [periodo]);

  // Base completa com dados do mês para o calendário e para o filtro por dia
  const calendarBaseRecords = useMemo(() => {
    if (monthRecords.length > 0) return monthRecords;
    return allRecords;
  }, [monthRecords, allRecords]);

  // Handler para quando o usuário navega entre os meses no Card do Calendário
  const handleMonthChange = useCallback(
    async (ym: string) => {
      setPeriodo(ym);
      setSelectedDate(null);
      setPreviewPage(1);

      try {
        setIsRefreshing(true);
        const res = await fetch(`/api/v1/espera/senhas?periodo=${ym}`);
        const data = await res.json();
        if (data.records && Array.isArray(data.records) && data.records.length > 0) {
          const sanitized = sanitizeRecords(data.records);
          setMonthRecords(sanitized);
          setAllRecords(sanitized);
          if (data.kpis) setKpis(data.kpis);
          if (data.horariosPico) setHorariosPico(data.horariosPico);
          if (data.performanceAgentes) setPerformanceAgentes(data.performanceAgentes);
          if (data.suspensoes) setSuspensoes(data.suspensoes);
          if (data.agendamentos) setAgendamentos(data.agendamentos);
        } else {
          const [y, m] = ym.split('-').map(Number);
          const generated = generateMonthRecords(y, m, slaMinutes);
          const sanitized = sanitizeRecords(generated);
          setMonthRecords(sanitized);
          setAllRecords(sanitized);
        }
      } catch {
        const [y, m] = ym.split('-').map(Number);
        const generated = generateMonthRecords(y, m, slaMinutes);
        const sanitized = sanitizeRecords(generated);
        setMonthRecords(sanitized);
        setAllRecords(sanitized);
      } finally {
        setIsRefreshing(false);
      }
    },
    [slaMinutes]
  );

  // Handler para seleção de data com busca sob demanda caso o dia não esteja em memória
  const handleSelectDate = useCallback(
    async (d: string | null) => {
      setSelectedDate(d);
      setPreviewPage(1);
      if (!d) return;

      // Finais de semana não têm expediente
      if (isWeekend(d)) {
        return;
      }

      const hasRecords = calendarBaseRecords.some(
        (r) => r.data === d || (r.emissao && r.emissao.startsWith(d))
      );
      if (hasRecords) return;

      // Se ainda não temos dados para esse dia em memória, busca direto da API para a data específica
      try {
        const res = await fetch(`/api/v1/espera/senhas?periodo=${d}`);
        const data = await res.json();
        if (data.records && Array.isArray(data.records) && data.records.length > 0) {
          const sanitized = sanitizeRecords(data.records);
          setMonthRecords((prev) => {
            const combined = [...prev, ...sanitized];
            const seen = new Set<string>();
            return combined.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          });
        }
      } catch {}
    },
    [calendarBaseRecords]
  );

  // Registros ativos considerando filtro do calendário
  const activeRecords = useMemo(() => {
    if (!selectedDate) return allRecords;
    if (isWeekend(selectedDate)) return [];
    return calendarBaseRecords.filter((r) => {
      if (r.data) return r.data === selectedDate;
      if (r.emissao && r.emissao.length >= 10 && r.emissao.includes('-')) {
        return r.emissao.substring(0, 10) === selectedDate;
      }
      return false;
    });
  }, [calendarBaseRecords, selectedDate, allRecords]);

  // Cálculos derivados
  const recordsWithWait = useMemo(() => activeRecords.filter((r) => r.tempoEsperaMin !== null), [activeRecords]);
  const dentroSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) <= slaMinutes), [recordsWithWait, slaMinutes]);
  const foraSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) > slaMinutes), [recordsWithWait, slaMinutes]);

  const servicosUnicos = useMemo(() => [...new Set(activeRecords.map((r) => r.servico).filter((s) => s !== '—'))].sort(), [activeRecords]);
  const filasUnicas = useMemo(() => [...new Set(activeRecords.map((r) => r.fila).filter((f) => f !== '—'))].sort(), [activeRecords]);
  const atendentesUnicos = useMemo(
    () => [...new Set(activeRecords.map((r) => r.atendente?.toUpperCase()).filter((a) => a && a !== '—'))].sort(),
    [activeRecords]
  );
  const situacoesUnicas = useMemo(() => [...new Set(activeRecords.map((r) => r.situacao).filter((s) => s !== '—'))].sort(), [activeRecords]);

  // Distribuição por horários de pico (recalcula dinamicamente para o dia selecionado)
  const displayHorariosPico = useMemo(() => {
    if (!selectedDate) return horariosPico;
    const horasMap: Record<string, { total: number; dentroSla: number; foraSla: number; totalEspera: number; countEspera: number }> = {};
    const horasLista = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    for (const h of horasLista) {
      horasMap[h] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
    }
    for (const r of activeRecords) {
      if (r.emissao && r.emissao !== '—') {
        const horaKey = r.emissao.split(':')[0] + ':00';
        if (!horasMap[horaKey]) {
          horasMap[horaKey] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
        }
        horasMap[horaKey].total += 1;
        if (r.tempoEsperaMin !== null) {
          horasMap[horaKey].totalEspera += r.tempoEsperaMin;
          horasMap[horaKey].countEspera += 1;
          if (r.tempoEsperaMin <= slaMinutes) {
            horasMap[horaKey].dentroSla += 1;
          } else {
            horasMap[horaKey].foraSla += 1;
          }
        }
      }
    }
    return Object.entries(horasMap).map(([hora, val]) => ({
      hora,
      total: val.total,
      dentroSla: val.dentroSla,
      foraSla: val.foraSla,
      mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
    })).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [selectedDate, activeRecords, horariosPico, slaMinutes]);

  // Performance dos Agentes calculada dinamicamente com base em activeRecords
  const displayPerformanceAgentes = useMemo(() => {
    if (activeRecords.length === 0) {
      return !selectedDate ? performanceAgentes : [];
    }

    const agentesMap: Record<string, {
      totalAtendimentos: number;
      totalEspera: number;
      countEspera: number;
      totalAtendimento: number;
      countAtendimento: number;
      dentroSla: number;
      desistencias: number;
      notas: number[];
    }> = {};

    for (const r of activeRecords) {
      const rawNome = r.atendente !== '—' && r.atendente ? r.atendente.trim() : 'RECEPÇÃO / TRIAGEM';
      const nome = rawNome.toUpperCase();
      if (!agentesMap[nome]) {
        agentesMap[nome] = {
          totalAtendimentos: 0,
          totalEspera: 0,
          countEspera: 0,
          totalAtendimento: 0,
          countAtendimento: 0,
          dentroSla: 0,
          desistencias: 0,
          notas: [],
        };
      }

      if (r.situacao === 'Desistência' || r.situacao === 'Cancelado') {
        agentesMap[nome].desistencias += 1;
      } else {
        agentesMap[nome].totalAtendimentos += 1;
      }

      if (r.tempoEsperaMin !== null) {
        agentesMap[nome].totalEspera += r.tempoEsperaMin;
        agentesMap[nome].countEspera += 1;
        if (r.tempoEsperaMin <= slaMinutes) {
          agentesMap[nome].dentroSla += 1;
        }
      }

      if (r.tempoAtendimentoMin !== null && r.tempoAtendimentoMin !== undefined) {
        agentesMap[nome].totalAtendimento += r.tempoAtendimentoMin;
        agentesMap[nome].countAtendimento += 1;
      }

      if (r.avaliacao && r.avaliacao !== '—') {
        const num = parseFloat(r.avaliacao.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) agentesMap[nome].notas.push(num);
      }
    }

    return Object.entries(agentesMap)
      .map(([atendente, val]) => ({
        atendente,
        totalAtendimentos: val.totalAtendimentos,
        mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
        mediaAtendimentoMin: val.countAtendimento > 0 ? Math.round(val.totalAtendimento / val.countAtendimento) : 0,
        dentroSlaPerc: val.countEspera > 0 ? Math.round((val.dentroSla / val.countEspera) * 1000) / 10 : 100,
        desistencias: val.desistencias,
        csatScore: val.notas.length > 0 ? Math.round((val.notas.reduce((a, b) => a + b, 0) / val.notas.length) * 20) : null,
      }))
      .filter((a) => a.totalAtendimentos > 0 || a.desistencias > 0)
      .sort((a, b) => b.totalAtendimentos - a.totalAtendimentos);
  }, [activeRecords, selectedDate, performanceAgentes, slaMinutes]);

  const picoDestaque = useMemo(() => {
    if (displayHorariosPico.length === 0) return null;
    const sorted = [...displayHorariosPico].sort((a, b) => b.total - a.total);
    return sorted[0]?.total > 0 ? sorted[0] : null;
  }, [displayHorariosPico]);

  const agenteDestaque = useMemo(() => {
    return displayPerformanceAgentes.length > 0 ? displayPerformanceAgentes[0] : null;
  }, [displayPerformanceAgentes]);

  // Distribuição por serviço para Visão Geral (fixo e ordenado por: PRIORIDADE, TÍTULO, PEDIDO DE CERTIDÃO e RETIRADA)
  const servicosDistribuicao = useMemo(() => {
    const map: Record<string, { total: number; dentroSla: number; totalEspera: number; countEspera: number }> = {
      'PRIORIDADE': { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 },
      'TÍTULO': { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 },
      'PEDIDO DE CERTIDÃO': { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 },
      'RETIRADA': { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 },
    };

    for (const r of activeRecords) {
      const rawService = cleanServiceName(r.servico !== '—' ? r.servico : 'Geral');
      let s = rawService;
      const upper = rawService.toUpperCase();
      if (upper === 'PRIORIDADE') s = 'PRIORIDADE';
      else if (upper === 'TÍTULO' || upper === 'TITULO') s = 'TÍTULO';
      else if (upper === 'PEDIDO DE CERTIDÃO' || upper === 'PEDIDO DE CERTIDAO' || upper === 'CERTIDÃO' || upper === 'CERTIDAO' || upper.includes('PEDIDO DE CERTID')) s = 'PEDIDO DE CERTIDÃO';
      else if (upper === 'RETIRADA') s = 'RETIRADA';
      else {
        // Ignora outros tipos ou tipos removidos (como CERTIDÕES NA HORA)
        continue;
      }

      if (!map[s]) map[s] = { total: 0, dentroSla: 0, totalEspera: 0, countEspera: 0 };
      map[s].total += 1;
      if (r.tempoEsperaMin !== null) {
        map[s].totalEspera += r.tempoEsperaMin;
        map[s].countEspera += 1;
        if (r.tempoEsperaMin <= slaMinutes) map[s].dentroSla += 1;
      }
    }

    const priorityOrder: Record<string, number> = {
      'PRIORIDADE': 1,
      'TÍTULO': 2,
      'TITULO': 2,
      'PEDIDO DE CERTIDÃO': 3,
      'PEDIDO DE CERTIDAO': 3,
      'RETIRADA': 4,
    };

    return Object.entries(map)
      .filter(([nome]) => priorityOrder[nome.toUpperCase()] !== undefined)
      .map(([nome, val]) => ({
        nome,
        total: val.total,
        dentroSlaPerc: val.countEspera > 0 ? Math.round((val.dentroSla / val.countEspera) * 100) : 100,
        mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
      }))
      .sort((a, b) => {
        const orderA = priorityOrder[a.nome.toUpperCase()] ?? 99;
        const orderB = priorityOrder[b.nome.toUpperCase()] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return b.total - a.total;
      });
  }, [activeRecords, slaMinutes]);

  // Filtros e ordenação aplicados na tabela de atendimentos
  const filteredRecords = useMemo(() => {
    let result = activeRecords;
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
  }, [activeRecords, filtroServico, filtroFila, filtroAtendente, filtroSituacao, searchQuery, sortField, sortDir]);

  // Filtros e ordenação para o card "Últimas Senhas Processadas" (Visão Geral)
  const previewServicosUnicos = useMemo(() => {
    return [...new Set(activeRecords.map((r) => r.servico).filter((s) => s && s !== '—'))].sort();
  }, [activeRecords]);

  const previewSituacoesUnicas = useMemo(() => {
    return [...new Set(activeRecords.map((r) => r.situacao).filter((s) => s && s !== '—' && s !== '0'))].sort();
  }, [activeRecords]);

  const filteredPreviewList = useMemo(() => {
    let list = activeRecords;
    if (previewFiltroSituacao !== 'ALL') {
      list = list.filter((r) => r.situacao.toLowerCase() === previewFiltroSituacao.toLowerCase());
    }
    if (previewFiltroServico !== 'ALL') {
      list = list.filter((r) => r.servico === previewFiltroServico);
    }
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
  }, [activeRecords, previewFiltroSituacao, previewFiltroServico, searchQuery, sortField, sortDir]);

  const previewTotalPages = Math.ceil(filteredPreviewList.length / previewPageSize) || 1;
  const previewStartIndex = (previewPage - 1) * previewPageSize;
  const previewEndIndex = previewStartIndex + previewPageSize;
  const paginatedPreviewRows = useMemo(() => {
    return filteredPreviewList.slice(previewStartIndex, previewEndIndex);
  }, [filteredPreviewList, previewStartIndex, previewEndIndex]);

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
          <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-white/8">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 tracking-wider">GESTÃO DE PRAZOS</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-extrabold tracking-wider">ESPERA</span>
              <h1 className="sr-only">Gestão de Espera e Atendimento</h1>
            </div>
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
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pt-1 pb-2 border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">ESPERA</span>
            <h1 className="sr-only">Gestão de Espera e Atendimento</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">

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

        {/* Loading inicial (somente quando não há dados em cache/tela) */}
        {isLoading && allRecords.length === 0 && (
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

        {/* Conteúdo Principal (visível se carregado ou se já houver registros em cache) */}
        {(!isLoading || allRecords.length > 0) && (
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
                {/* Banner de Filtro de Calendário Ativo */}
                {selectedDate && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs shadow-lg backdrop-blur-xl">
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${isWeekend(selectedDate) ? 'bg-rose-400' : 'bg-indigo-400'} animate-pulse`} />
                      <span>
                        Exibindo dados filtrados para: <strong className="text-white capitalize">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                        {isWeekend(selectedDate) ? (
                          <span className="text-rose-400 ml-1.5 font-bold">
                            — Final de semana (Não há expediente no Cartório aos sábados e domingos / Fechado)
                          </span>
                        ) : activeRecords.length > 0 ? (
                          <> — <span className="font-mono text-indigo-300 font-bold">{activeRecords.length}</span> senhas registradas</>
                        ) : selectedDate > new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) ? (
                          <span className="text-amber-300 ml-1.5 font-medium">(Data futura — expediente ainda não ocorrido)</span>
                        ) : (
                          <span className="text-slate-400 ml-1.5">(Nenhuma senha registrada nesta data / Sem expediente)</span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600 text-white font-bold transition-all cursor-pointer text-xs border border-indigo-400/30 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Ver mês completo</span>
                    </button>
                  </div>
                )}

                {/* Seção Superior: Indicadores Principais de Espera e Volume */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {selectedDate
                            ? (recordsWithWait.length > 0 ? Math.round((dentroSla.length / recordsWithWait.length) * 100) : 100)
                            : (kpis?.slaEsperaPerc ?? (recordsWithWait.length > 0 ? Math.round((dentroSla.length / recordsWithWait.length) * 100) : '—'))}%
                        </span>
                        <span className="text-xs text-slate-400">dentro do SLA</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                          style={{
                            width: `${
                              selectedDate
                                ? (recordsWithWait.length > 0 ? Math.round((dentroSla.length / recordsWithWait.length) * 100) : 100)
                                : (kpis?.slaEsperaPerc ?? 92)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                      <span>Tempo médio na fila:</span>
                      <span className="font-bold text-white font-mono">
                        {selectedDate
                          ? (recordsWithWait.length > 0 ? Math.round(recordsWithWait.reduce((a, b) => a + (b.tempoEsperaMin || 0), 0) / recordsWithWait.length) : 0)
                          : (kpis?.mediaEsperaMin ?? (recordsWithWait.length > 0 ? Math.round(recordsWithWait.reduce((a, b) => a + (b.tempoEsperaMin || 0), 0) / recordsWithWait.length) : 0))} min
                      </span>
                    </div>
                  </div>

                  {/* Volume de Atendimentos */}
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
                        {selectedDate ? activeRecords.length : (kpis?.totalSenhas ?? allRecords.length)}
                      </span>
                      <span className="text-xs text-slate-400">senhas geradas</span>
                    </div>
                    <div className="pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
                      <span>Desistências / Cancelados:</span>
                      <span className="font-bold text-rose-400 font-mono">
                        {selectedDate
                          ? activeRecords.filter((r) => r.situacao === 'Desistência' || r.situacao === 'Cancelado').length
                          : (kpis?.totalDesistencias ?? allRecords.filter((r) => r.situacao === 'Desistência' || r.situacao === 'Cancelado').length)}
                      </span>
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

                {/* Grade Analítica: Calendário Interativo + Horários de Pico + Serviços Mais Demandados */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Card 1: Calendário Interativo */}
                  <div className="lg:col-span-4 flex flex-col">
                    <EsperaCalendarCard
                      allRecords={calendarBaseRecords}
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                      onMonthChange={handleMonthChange}
                      slaMinutes={slaMinutes}
                    />
                  </div>

                  {/* Card 2: Resumo de Horários de Pico */}
                  <div className="lg:col-span-4 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
                    <div>
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

                      {displayHorariosPico.length > 0 ? (
                        <div className="space-y-3 pt-2">
                          <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 px-1 border-b border-white/10">
                            {displayHorariosPico.map((h) => {
                              const maxVal = Math.max(...displayHorariosPico.map((p) => p.total), 1);
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
                                  <span className="text-[9px] font-mono text-slate-400">{h.hora.split(':')[0]}h</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                            <span>Faixa operacional das 08h às 18h</span>
                            <span className="font-mono text-indigo-300">
                              Pico: {displayHorariosPico.slice().sort((a, b) => b.total - a.total)[0]?.hora || '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-500 text-xs">
                          Nenhum atendimento registrado no período selecionado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Distribuição por Serviços Mais Demandados */}
                  <div className="lg:col-span-4 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-400" />
                          <h3 className="text-sm font-bold text-white">Serviços Mais Demandados</h3>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{servicosDistribuicao.length} tipos</span>
                      </div>

                      {servicosDistribuicao.length > 0 ? (
                        <div className="space-y-2.5 pt-2">
                          {servicosDistribuicao.slice(0, 5).map((servico) => (
                            <div key={servico.nome} className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/6 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-white truncate max-w-[180px]">{servico.nome}</span>
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
                </div>

                {/* Card Padrão FIORIX: Últimas Senhas Processadas */}
                {allRecords.length > 0 && (
                  <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1020]/95 backdrop-blur-xl p-5 sm:p-6 shadow-sm dark:shadow-2xl space-y-4">
                    {/* Cabeçalho do Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                              Últimas Senhas Processadas
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">
                              {allRecords.length} registros
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Monitoramento das senhas emitidas, tempo de espera e atendimento nos guichês
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveAba('atendimentos')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 bg-slate-50 dark:bg-white/5 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
                      >
                        <span>Ver tabela completa ({allRecords.length})</span>
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      </button>
                    </div>

                    {/* Barra de Filtros, Busca e Ordenação */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
                      {/* Campo de Busca com Botão Limpar */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por senha, atendente ou serviço..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/60 transition-all shadow-2xs"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setPreviewPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            title="Limpar busca"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Controles de Filtro e Ordenação */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {/* Filtro por Situação */}
                        <select
                          value={previewFiltroSituacao}
                          onChange={(e) => {
                            setPreviewFiltroSituacao(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs font-medium"
                          title="Filtrar por Situação"
                        >
                          <option value="ALL">Todas Situações</option>
                          {previewSituacoesUnicas.map((s) => (
                            <option key={s} value={s} className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                              {s}
                            </option>
                          ))}
                        </select>

                        {/* Filtro por Serviço */}
                        <select
                          value={previewFiltroServico}
                          onChange={(e) => {
                            setPreviewFiltroServico(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs font-medium max-w-[170px] truncate"
                          title="Filtrar por Serviço"
                        >
                          <option value="ALL">Todos Serviços</option>
                          {previewServicosUnicos.map((s) => (
                            <option key={s} value={s} className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                              {s}
                            </option>
                          ))}
                        </select>

                        {/* Menu de Ordenação */}
                        <div className="relative inline-flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] px-3 py-2 text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 mr-2 shrink-0" />
                          <select
                            value={`${sortField}-${sortDir}`}
                            onChange={(e) => {
                              const [f, d] = e.target.value.split('-') as [SortField, 'asc' | 'desc'];
                              setSortField(f);
                              setSortDir(d);
                              setPreviewPage(1);
                            }}
                            className="bg-transparent text-slate-800 dark:text-white font-medium text-xs focus:outline-none cursor-pointer pr-1"
                            title="Menu de ordenação"
                          >
                            <option value="emissao-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Mais recentes (Emissão)</option>
                            <option value="emissao-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Mais antigas (Emissão)</option>
                            <option value="tempoEsperaMin-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Maior tempo de espera</option>
                            <option value="tempoEsperaMin-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Menor tempo de espera</option>
                            <option value="chamada-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Chamada mais recente</option>
                            <option value="senha-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Senha (A → Z)</option>
                            <option value="senha-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Senha (Z → A)</option>
                            <option value="atendente-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Atendente (A → Z)</option>
                            <option value="atendente-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Atendente (Z → A)</option>
                            <option value="servico-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Serviço (A → Z)</option>
                            <option value="fila-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Fila (A → Z)</option>
                            <option value="guiche-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Guichê / Mesa</option>
                            <option value="situacao-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">Situação</option>
                          </select>
                        </div>

                        {/* Botão Limpar Filtros quando ativo */}
                        {(searchQuery || previewFiltroSituacao !== 'ALL' || previewFiltroServico !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setPreviewFiltroSituacao('ALL');
                              setPreviewFiltroServico('ALL');
                              setPreviewPage(1);
                            }}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap px-1"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabela Formatada Padrão Fiorix */}
                    <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/40 dark:bg-[#070b16]/70 shadow-inner">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/80 dark:bg-[#080811] text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-white/8">
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
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                          {paginatedPreviewRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <Filter className="w-6 h-6 text-slate-400/50" />
                                  <p className="font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
                                  {(searchQuery || previewFiltroSituacao !== 'ALL' || previewFiltroServico !== 'ALL') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSearchQuery('');
                                        setPreviewFiltroSituacao('ALL');
                                        setPreviewFiltroServico('ALL');
                                        setPreviewPage(1);
                                      }}
                                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                                    >
                                      Restaurar lista completa
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            paginatedPreviewRows.map((r) => {
                              const initials = getAtendenteAvatar(r.atendente);
                              return (
                                <tr key={r.id} className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors">
                                  {/* Senha */}
                                  <td className="py-3 px-4 font-mono whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-2xs">
                                      {r.senha}
                                    </span>
                                  </td>

                                  {/* Serviço */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {getServicoBadge(r.servico)}
                                  </td>

                                  {/* Fila */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {getFilaBadge(r.fila)}
                                  </td>

                                  {/* Emissão */}
                                  <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {r.emissao || '—'}
                                  </td>

                                  {/* Chamada */}
                                  <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {r.chamada || '—'}
                                  </td>

                                  {/* Tempo Espera Semafórico */}
                                  <td className="py-3 px-3 text-right whitespace-nowrap">
                                    {r.tempoEsperaMin !== null ? (
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold shadow-2xs ${
                                          r.tempoEsperaMin <= slaMinutes
                                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                            : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                        }`}
                                        title={r.tempoEsperaMin <= slaMinutes ? `Dentro do SLA (≤ ${slaMinutes} min)` : `Acima do SLA (> ${slaMinutes} min)`}
                                      >
                                        {r.tempoEsperaMin <= slaMinutes ? (
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        ) : (
                                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                        )}
                                        <span>{r.tempoEsperaMin} min</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                                    )}
                                  </td>

                                  {/* Guichê */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {r.guiche && r.guiche !== '—' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                                        {r.guiche}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                                    )}
                                  </td>

                                  {/* Atendente com Avatar Initials */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {r.atendente && r.atendente !== '—' ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                          {initials}
                                        </div>
                                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 uppercase truncate max-w-[140px]">
                                          {r.atendente}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                                    )}
                                  </td>

                                  {/* Situação */}
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {getSituacaoBadge(r.situacao)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Rodapé com Paginação Padrão Fiorix */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                      {/* Intervalo Exibido */}
                      <div className="text-center sm:text-left">
                        Exibindo{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {filteredPreviewList.length === 0 ? 0 : previewStartIndex + 1}
                        </strong>{' '}
                        a{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {Math.min(previewEndIndex, filteredPreviewList.length)}
                        </strong>{' '}
                        de{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {filteredPreviewList.length}
                        </strong>{' '}
                        registros
                        {(previewFiltroSituacao !== 'ALL' || previewFiltroServico !== 'ALL' || searchQuery) && (
                          <span className="ml-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                            (filtrado)
                          </span>
                        )}
                      </div>

                      {/* Controles de Tamanho e Navegação */}
                      <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
                        {/* Seletor de Tamanho de Página */}
                        <div className="flex items-center gap-1.5">
                          <span>Exibir:</span>
                          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1020] p-0.5">
                            {[10, 25, 50].map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  setPreviewPageSize(size);
                                  setPreviewPage(1);
                                }}
                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                                  previewPageSize === size
                                    ? 'bg-gradient-to-r from-indigo-500 to-amber-500 text-white font-semibold shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Botões de Navegação */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={previewPage <= 1}
                            onClick={() => setPreviewPage(1)}
                            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Primeira Página"
                          >
                            <ChevronsLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={previewPage <= 1}
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Página Anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/60 dark:border-white/10">
                            {previewPage} / {Math.max(1, previewTotalPages)}
                          </span>

                          <button
                            type="button"
                            disabled={previewPage >= previewTotalPages}
                            onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Próxima Página"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={previewPage >= previewTotalPages}
                            onClick={() => setPreviewPage(previewTotalPages)}
                            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Última Página"
                          >
                            <ChevronsRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
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
              <div className="space-y-6">
                {/* Grade Superior: Calendário Interativo + Resumo do Período */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-4 flex flex-col">
                    <EsperaCalendarCard
                      allRecords={calendarBaseRecords}
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                      onMonthChange={handleMonthChange}
                      slaMinutes={slaMinutes}
                    />
                  </div>
                  <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                    {/* Banner de status / seleção */}
                    {selectedDate ? (
                      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs shadow-lg backdrop-blur-xl">
                        <div className="flex items-center gap-2.5">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isWeekend(selectedDate) ? 'bg-rose-400' : 'bg-indigo-400'} animate-pulse`} />
                          <span>
                            Exibindo atendimentos para: <strong className="text-white capitalize">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            {isWeekend(selectedDate) ? (
                              <span className="text-rose-400 ml-1.5 font-bold">
                                — Final de semana (Não há expediente no Cartório / Fechado)
                              </span>
                            ) : (
                              <> — <span className="font-mono text-indigo-300 font-bold">{activeRecords.length}</span> senhas registradas</>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(null)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600 text-white font-bold transition-all cursor-pointer text-xs border border-indigo-400/30 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ver mês completo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-slate-300 text-xs shadow-lg">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>Exibindo todos os atendimentos do mês ({calendarBaseRecords.length} senhas emitidas nos dias úteis)</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Clique em qualquer dia do calendário para filtrar</span>
                      </div>
                    )}

                    {/* Cards de Métricas de Atendimento do Período */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Senhas</span>
                        <div className="text-2xl font-black text-white font-mono">{activeRecords.length}</div>
                        <div className="text-[10px] text-slate-500">no período ativo</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Dentro do SLA</span>
                        <div className="text-2xl font-black text-emerald-400 font-mono">
                          {recordsWithWait.length > 0 ? `${Math.round((dentroSla.length / recordsWithWait.length) * 100)}%` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">{dentroSla.length} atendimentos</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-400">Média de Espera</span>
                        <div className="text-2xl font-black text-indigo-300 font-mono">
                          {recordsWithWait.length > 0 ? Math.round(recordsWithWait.reduce((a, b) => a + (b.tempoEsperaMin || 0), 0) / recordsWithWait.length) : 0} min
                        </div>
                        <div className="text-[10px] text-slate-500">meta: até {slaMinutes} min</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-rose-400">Desistências</span>
                        <div className="text-2xl font-black text-rose-400 font-mono">
                          {activeRecords.filter((r) => r.situacao === 'Desistência' || r.situacao === 'Cancelado').length}
                        </div>
                        <div className="text-[10px] text-slate-500">não atendidos</div>
                      </div>
                    </div>
                  </div>
                </div>

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
                {/* Grade Superior: Calendário Interativo + Resumo de Pico */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-4 flex flex-col">
                    <EsperaCalendarCard
                      allRecords={calendarBaseRecords}
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                      onMonthChange={handleMonthChange}
                      slaMinutes={slaMinutes}
                    />
                  </div>
                  <div className="lg:col-span-8 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
                    {/* Banner de status / seleção */}
                    {selectedDate && (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs shadow-lg backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isWeekend(selectedDate) ? 'bg-rose-400' : 'bg-indigo-400'} animate-pulse`} />
                          <span>
                            Horários para: <strong className="text-white capitalize">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            {isWeekend(selectedDate) && <span className="text-rose-400 ml-1 font-bold">— Sem expediente</span>}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(null)}
                          className="text-[11px] font-bold text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                        >
                          Ver mês
                        </button>
                      </div>
                    )}

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        <span>Visão Executiva de Fluxo Horário</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        {selectedDate
                          ? `Análise de afluência e tempo de espera hora a hora do dia selecionado.`
                          : `Média consolidada de senhas e tempos de espera por faixa horária no mês.`}
                      </p>
                    </div>

                    {/* Destaques de Pico */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/8">
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Horário de Maior Fluxo</span>
                        <div className="text-xl font-black text-indigo-300 font-mono">
                          {picoDestaque ? picoDestaque.hora : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {picoDestaque ? `${picoDestaque.total} senhas emitidas` : 'Sem emissões'}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">SLA no Horário de Pico</span>
                        <div className="text-xl font-black text-emerald-400 font-mono">
                          {picoDestaque && picoDestaque.total > 0
                            ? `${Math.round((picoDestaque.dentroSla / picoDestaque.total) * 100)}%`
                            : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">conformidade no pico</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">Espera Média no Pico</span>
                        <div className="text-xl font-black text-cyan-300 font-mono">
                          {picoDestaque ? `${picoDestaque.mediaEsperaMin} min` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">tempo na fila</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" />
                      <span>Relatório Detalhado de Horários de Pico</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Identifique as faixas horárias com maior afluência e tempo de espera na recepção.
                    </p>
                  </div>

                  {/* Gráfico Visual */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/8 space-y-4">
                    <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-white/10">
                      {displayHorariosPico.map((h) => {
                        const maxVal = Math.max(...displayHorariosPico.map((p) => p.total), 1);
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
                        {displayHorariosPico.map((h) => {
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
                {/* Grade Superior: Calendário Interativo + Resumo da Equipe */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-4 flex flex-col">
                    <EsperaCalendarCard
                      allRecords={calendarBaseRecords}
                      selectedDate={selectedDate}
                      onSelectDate={handleSelectDate}
                      onMonthChange={handleMonthChange}
                      slaMinutes={slaMinutes}
                    />
                  </div>
                  <div className="lg:col-span-8 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
                    {/* Banner de status / seleção */}
                    {selectedDate && (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs shadow-lg backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isWeekend(selectedDate) ? 'bg-rose-400' : 'bg-indigo-400'} animate-pulse`} />
                          <span>
                            Equipe em: <strong className="text-white capitalize">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            {isWeekend(selectedDate) && <span className="text-rose-400 ml-1 font-bold">— Sem expediente</span>}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(null)}
                          className="text-[11px] font-bold text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                        >
                          Ver mês
                        </button>
                      </div>
                    )}

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-400" />
                        <span>Resumo de Produtividade da Equipe</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        {selectedDate
                          ? `Métricas individuais de atendimento registradas na data selecionada.`
                          : `Produtividade consolidada dos atendentes ao longo de todo o mês.`}
                      </p>
                    </div>

                    {/* Destaques da Equipe */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/8">
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                          🥇 Atendente Destaque #1
                        </span>
                        <div className="text-base font-black text-white truncate uppercase">
                          {agenteDestaque ? agenteDestaque.atendente : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {agenteDestaque ? `${agenteDestaque.totalAtendimentos} atendimentos realizados` : 'Sem registros'}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-400">TMA Médio de Mesa</span>
                        <div className="text-xl font-black text-indigo-300 font-mono">
                          {displayPerformanceAgentes.length > 0
                            ? `${Math.round(displayPerformanceAgentes.reduce((a, b) => a + b.mediaAtendimentoMin, 0) / displayPerformanceAgentes.length)} min`
                            : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">tempo por atendimento</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">SLA Médio da Equipe</span>
                        <div className="text-xl font-black text-emerald-400 font-mono">
                          {displayPerformanceAgentes.length > 0
                            ? `${Math.round(displayPerformanceAgentes.reduce((a, b) => a + b.dentroSlaPerc, 0) / displayPerformanceAgentes.length)}%`
                            : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">conformidade de espera</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-400" />
                      <span>Ranking de Performance dos Agentes</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Ranking individual de atendimento, tempo médio de guichê (TMA), tempo de espera gerado e taxa de conformidade SLA.
                    </p>
                  </div>

                  {displayPerformanceAgentes.length > 0 ? (
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
                          {displayPerformanceAgentes.map((agente, index) => (
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
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      agente.csatScore >= 80
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : agente.csatScore >= 65
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    }`}
                                  >
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
                      {isWeekend(selectedDate || '')
                        ? 'Final de semana — Não houve atendimentos ou expediente nesta data.'
                        : 'Nenhum atendente com registros no período.'}
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
