'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Globe2,
  History,
  Plus,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  addDaysToLocalDate,
  formatCountdownLabel,
  formatHourShortBr,
  formatLocalDateBr,
} from '@/lib/agenda/timezone';
import type {
  AgendaAuditLogDTO,
  AgendaCategoryDTO,
  AgendaOccurrenceView,
  AgendaPriority,
  AgendaRecurrenceType,
} from '@/lib/agenda/types';
import {
  AgendaCategoryIcon,
  PRIORITY_LABEL,
  RECURRENCE_LABEL,
  STATUS_LABEL,
  VISIBILITY_LABEL,
} from './agenda-icons';

type HorizonFilter = 'todos' | 'atrasados' | 'hoje' | 'amanha' | 'proximos7' | 'proximos30';
type CollaborativeTab = 'todos' | 'compartilhados' | 'setoriais' | 'institucionais';
type HistoryTab = 'encerrados' | 'auditoria';
type HistoryStatusFilter = 'todos' | 'CONCLUIDO' | 'CANCELADO' | 'PASSADO';

function getSectionTheme(isDark: boolean) {
  return {
    cardSurface: isDark
      ? 'bg-[#0D1322] border-white/10 text-slate-100 [color-scheme:dark]'
      : 'bg-white border-slate-200/80 text-slate-900 shadow-xs [color-scheme:light]',
    mutedText: isDark ? 'text-slate-400' : 'text-slate-500',
    inputCls: isDark
      ? 'border-white/15 bg-[#070A12] text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none [color-scheme:dark]'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#43239D] focus:outline-none [color-scheme:light]',
    subtleBg: isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200/80',
  };
}

interface AgendaProximosSectionProps {
  occurrences: AgendaOccurrenceView[];
  categories: AgendaCategoryDTO[];
  todayDate: string;
  search: string;
  onSearchChange: (val: string) => void;
  categoryId: string;
  onCategoryChange: (val: string) => void;
  priority: AgendaPriority | '';
  onPriorityChange: (val: AgendaPriority | '') => void;
  recurrenceType: AgendaRecurrenceType | '';
  onRecurrenceChange: (val: AgendaRecurrenceType | '') => void;
  isDark?: boolean;
  canCreate: boolean;
  loading: boolean;
  onOpenOccurrence: (occ: AgendaOccurrenceView) => void;
  onQuickConclude: (occ: AgendaOccurrenceView) => Promise<void> | void;
  onCreateNew: () => void;
}

export function AgendaProximosSection({
  occurrences,
  categories,
  todayDate,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  priority,
  onPriorityChange,
  recurrenceType,
  onRecurrenceChange,
  isDark = false,
  canCreate,
  loading,
  onOpenOccurrence,
  onQuickConclude,
  onCreateNew,
}: AgendaProximosSectionProps) {
  const [horizon, setHorizon] = useState<HorizonFilter>('todos');
  const { cardSurface, mutedText, inputCls, subtleBg } = getSectionTheme(isDark);

  const tomorrowDate = useMemo(() => addDaysToLocalDate(todayDate, 1), [todayDate]);
  const next7Date = useMemo(() => addDaysToLocalDate(todayDate, 7), [todayDate]);
  const next30Date = useMemo(() => addDaysToLocalDate(todayDate, 30), [todayDate]);

  const activeUpcoming = useMemo(
    () =>
      occurrences.filter(
        (o) =>
          o.effectiveStatus !== 'CONCLUIDO' &&
          o.effectiveStatus !== 'CANCELADO' &&
          (o.localEndDate >= todayDate || o.isOverdue)
      ),
    [occurrences, todayDate]
  );

  const horizonCounts = useMemo(
    () => ({
      todos: activeUpcoming.length,
      atrasados: activeUpcoming.filter((o) => o.isOverdue).length,
      hoje: activeUpcoming.filter((o) => o.localStartDate <= todayDate && o.localEndDate >= todayDate).length,
      amanha: activeUpcoming.filter(
        (o) => o.localStartDate <= tomorrowDate && o.localEndDate >= tomorrowDate
      ).length,
      proximos7: activeUpcoming.filter(
        (o) => o.localStartDate >= todayDate && o.localStartDate <= next7Date
      ).length,
      proximos30: activeUpcoming.filter(
        (o) => o.localStartDate >= todayDate && o.localStartDate <= next30Date
      ).length,
    }),
    [activeUpcoming, todayDate, tomorrowDate, next7Date, next30Date]
  );

  const filteredUpcoming = useMemo(() => {
    return activeUpcoming.filter((o) => {
      if (horizon === 'atrasados') return o.isOverdue;
      if (horizon === 'hoje') return o.localStartDate <= todayDate && o.localEndDate >= todayDate;
      if (horizon === 'amanha') return o.localStartDate <= tomorrowDate && o.localEndDate >= tomorrowDate;
      if (horizon === 'proximos7') return o.localStartDate >= todayDate && o.localStartDate <= next7Date;
      if (horizon === 'proximos30') return o.localStartDate >= todayDate && o.localStartDate <= next30Date;
      return true;
    });
  }, [activeUpcoming, horizon, todayDate, tomorrowDate, next7Date, next30Date]);

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; badgeCls: string; items: AgendaOccurrenceView[] }> = [
      { key: 'atrasados', label: 'Atrasados', badgeCls: 'bg-rose-100 text-rose-800', items: [] },
      { key: 'hoje', label: 'Hoje', badgeCls: 'bg-sky-100 text-sky-800', items: [] },
      { key: 'amanha', label: 'Amanhã', badgeCls: 'bg-indigo-100 text-indigo-800', items: [] },
      { key: 'semana', label: 'Próximos 7 dias', badgeCls: 'bg-violet-100 text-violet-800', items: [] },
      { key: 'mes', label: 'Próximos 30 dias', badgeCls: 'bg-emerald-100 text-emerald-800', items: [] },
      { key: 'futuro', label: 'Mais adiante', badgeCls: 'bg-slate-100 text-slate-700', items: [] },
    ];

    for (const occ of filteredUpcoming) {
      if (occ.isOverdue) groups[0]!.items.push(occ);
      else if (occ.localStartDate <= todayDate && occ.localEndDate >= todayDate) groups[1]!.items.push(occ);
      else if (occ.localStartDate <= tomorrowDate && occ.localEndDate >= tomorrowDate) groups[2]!.items.push(occ);
      else if (occ.localStartDate <= next7Date) groups[3]!.items.push(occ);
      else if (occ.localStartDate <= next30Date) groups[4]!.items.push(occ);
      else groups[5]!.items.push(occ);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredUpcoming, todayDate, tomorrowDate, next7Date, next30Date]);

  return (
    <div className="space-y-4">
      {/* Faixa clicável de horizontes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {(
          [
            ['todos', 'Todos próximos', horizonCounts.todos, 'bg-violet-50 border-violet-200 text-violet-900'],
            [
              'atrasados',
              'Atrasados',
              horizonCounts.atrasados,
              horizonCounts.atrasados > 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-white border-slate-200 text-slate-700',
            ],
            ['hoje', 'Hoje', horizonCounts.hoje, 'bg-sky-50 border-sky-200 text-sky-900'],
            ['amanha', 'Amanhã', horizonCounts.amanha, 'bg-indigo-50 border-indigo-200 text-indigo-900'],
            ['proximos7', 'Próximos 7 dias', horizonCounts.proximos7, 'bg-amber-50 border-amber-200 text-amber-900'],
            ['proximos30', 'Próximos 30 dias', horizonCounts.proximos30, 'bg-emerald-50 border-emerald-200 text-emerald-900'],
          ] as Array<[HorizonFilter, string, number, string]>
        ).map(([key, label, count, lightTone]) => {
          const active = horizon === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setHorizon(key)}
              className={`rounded-2xl border p-3 text-left transition ${
                isDark ? subtleBg : lightTone
              } ${active ? 'ring-2 ring-[#43239D] shadow-sm' : 'hover:shadow-2xs'}`}
            >
              <div className="text-[11px] font-bold opacity-85">{label}</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros enxutos */}
      <div className={`rounded-2xl border p-3.5 ${cardSurface}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar compromisso próximo..."
              className={`w-full rounded-xl border pl-8 pr-3 py-2 ${inputCls}`}
            />
          </div>
          <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
          <select
            aria-label="Filtrar por categoria"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
          >
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prioridade"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as AgendaPriority | '')}
            className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
          >
            <option value="">Todas prioridades</option>
            {(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as AgendaPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por recorrência"
            value={recurrenceType}
            onChange={(e) => onRecurrenceChange(e.target.value as AgendaRecurrenceType | '')}
            className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
          >
            <option value="">Todas recorrências</option>
            {(Object.keys(RECURRENCE_LABEL) as AgendaRecurrenceType[]).map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista agrupada por horizonte */}
      {loading ? (
        <div className={`rounded-3xl border p-12 text-center text-sm ${cardSurface}`}>
          Carregando próximos compromissos...
        </div>
      ) : grouped.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center space-y-3 ${cardSurface}`}>
          <CalendarClock className="h-9 w-9 mx-auto text-violet-600/80" />
          <div className="text-sm font-bold">Nenhum próximo compromisso pendente neste horizonte.</div>
          <p className={`text-xs ${mutedText}`}>
            Ajuste os filtros acima ou agende um novo compromisso para acompanhar a contagem regressiva.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 rounded-full bg-[#43239D] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6] transition"
            >
              <Plus className="h-4 w-4" />
              Novo compromisso
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.key} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${group.badgeCls}`}>
                  {group.label}
                </span>
                <span className={`text-xs font-semibold ${mutedText}`}>
                  {group.items.length} {group.items.length === 1 ? 'compromisso' : 'compromissos'}
                </span>
              </div>

              <div className="space-y-2.5">
                {group.items.map((occ) => (
                  <div
                    key={occ.occurrenceKey}
                    className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition hover:shadow-sm ${cardSurface}`}
                    style={{ borderLeftWidth: '5px', borderLeftColor: occ.color }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ backgroundColor: occ.color }}
                      >
                        <AgendaCategoryIcon iconName={occ.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold truncate">{occ.title}</span>
                          <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                            {occ.categoryName}
                          </span>
                          <span className="rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-[10px] font-bold">
                            {PRIORITY_LABEL[occ.priority]}
                          </span>
                          {occ.recurrenceType !== 'UNICO' && (
                            <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-bold">
                              {RECURRENCE_LABEL[occ.recurrenceType]}
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">
                            {VISIBILITY_LABEL[occ.visibility]}
                          </span>
                        </div>
                        <div className={`text-xs flex flex-wrap items-center gap-3 ${mutedText}`}>
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            {formatLocalDateBr(occ.localStartDate)} ·{' '}
                            {formatHourShortBr(occ.localStartTime, occ.allDay)}
                          </span>
                          {occ.location && <span className="truncate">Local: {occ.location}</span>}
                          {occ.ownerName && <span>Resp.: {occ.ownerName}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`rounded-xl px-3 py-1.5 text-xs font-extrabold ${
                          occ.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-violet-50 text-[#43239D]'
                        }`}
                      >
                        {formatCountdownLabel(occ)}
                      </span>
                      {occ.canConclude && (
                        <button
                          type="button"
                          onClick={() => void onQuickConclude(occ)}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenOccurrence(occ)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Detalhes
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AgendaCompartilhadosSectionProps {
  occurrences: AgendaOccurrenceView[];
  categories: AgendaCategoryDTO[];
  currentUserId: string;
  search: string;
  onSearchChange: (val: string) => void;
  categoryId: string;
  onCategoryChange: (val: string) => void;
  priority: AgendaPriority | '';
  onPriorityChange: (val: AgendaPriority | '') => void;
  isDark?: boolean;
  canCreate: boolean;
  loading: boolean;
  onOpenOccurrence: (occ: AgendaOccurrenceView) => void;
  onRespondRsvp: (occ: AgendaOccurrenceView, status: 'CONFIRMADO' | 'RECUSADO') => Promise<void> | void;
  onCreateNew: () => void;
}

export function AgendaCompartilhadosSection({
  occurrences,
  categories,
  currentUserId,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  priority,
  onPriorityChange,
  isDark = false,
  canCreate,
  loading,
  onOpenOccurrence,
  onRespondRsvp,
  onCreateNew,
}: AgendaCompartilhadosSectionProps) {
  const [collabTab, setCollabTab] = useState<CollaborativeTab>('todos');
  const { cardSurface, mutedText, inputCls, subtleBg } = getSectionTheme(isDark);

  const collaborativeAll = useMemo(
    () =>
      occurrences.filter(
        (o) => o.visibility !== 'INDIVIDUAL' || o.participants.length > 1
      ),
    [occurrences]
  );

  const counts = useMemo(
    () => ({
      compartilhados: collaborativeAll.filter(
        (o) => o.visibility === 'COMPARTILHADO' || o.participants.length > 1
      ).length,
      setoriais: collaborativeAll.filter((o) => o.visibility === 'SETORIAL').length,
      institucionais: collaborativeAll.filter((o) => o.visibility === 'INSTITUCIONAL').length,
    }),
    [collaborativeAll]
  );

  const filtered = useMemo(() => {
    return collaborativeAll.filter((o) => {
      if (collabTab === 'compartilhados') {
        return o.visibility === 'COMPARTILHADO' || o.participants.length > 1;
      }
      if (collabTab === 'setoriais') return o.visibility === 'SETORIAL';
      if (collabTab === 'institucionais') return o.visibility === 'INSTITUCIONAL';
      return true;
    });
  }, [collaborativeAll, collabTab]);

  return (
    <div className="space-y-4">
      {/* 3 KPIs de colaboração clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[
          {
            key: 'compartilhados' as const,
            label: 'Compartilhados',
            desc: 'Compromissos com participantes convidados',
            value: counts.compartilhados,
            bg: isDark ? 'bg-sky-500/15 border-sky-400/30 text-sky-200' : 'bg-[#EAF2FF] border-[#D6E6FF] text-[#1E3A8A]',
            icon: Users,
          },
          {
            key: 'setoriais' as const,
            label: 'Setoriais',
            desc: 'Visíveis para todo o departamento',
            value: counts.setoriais,
            bg: isDark ? 'bg-violet-500/15 border-violet-400/30 text-violet-200' : 'bg-[#F3EEFE] border-[#E4D8FC] text-[#5B21B6]',
            icon: CalendarClock,
          },
          {
            key: 'institucionais' as const,
            label: 'Institucionais',
            desc: 'Eventos gerais da Serventia (7º RI-SP)',
            value: counts.institucionais,
            bg: isDark ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' : 'bg-[#E9F9EE] border-[#CCF0D8] text-[#166534]',
            icon: Globe2,
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const active = collabTab === kpi.key;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => setCollabTab((prev) => (prev === kpi.key ? 'todos' : kpi.key))}
              className={`rounded-2xl border p-4 text-left transition ${kpi.bg} ${
                active ? 'ring-2 ring-[#43239D]' : 'hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-bold">
                  <Icon className="h-4 w-4" />
                  {kpi.label}
                </span>
                <span className="text-2xl font-extrabold tabular-nums">{kpi.value}</span>
              </div>
              <div className="mt-1 text-[11px] opacity-80">{kpi.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Abas colaborativas + filtros */}
      <div className={`rounded-2xl border p-3.5 space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['todos', `Todos colaborativos (${collaborativeAll.length})`],
              ['compartilhados', `Compartilhados (${counts.compartilhados})`],
              ['setoriais', `Setoriais (${counts.setoriais})`],
              ['institucionais', `Institucionais (${counts.institucionais})`],
            ] as Array<[CollaborativeTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCollabTab(key)}
              className={`rounded-xl border px-3 py-1.5 font-bold transition ${
                collabTab === key
                  ? 'bg-[#43239D] text-white border-[#43239D]'
                  : isDark
                    ? 'border-white/10 text-slate-300 hover:bg-white/5'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título, responsável ou setor..."
              className={`w-full rounded-xl border pl-8 pr-3 py-2 ${inputCls}`}
            />
          </div>
          <select
            aria-label="Filtrar por categoria"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
          >
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prioridade"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as AgendaPriority | '')}
            className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
          >
            <option value="">Todas prioridades</option>
            {(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as AgendaPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista colaborativa */}
      {loading ? (
        <div className={`rounded-3xl border p-12 text-center text-sm ${cardSurface}`}>
          Carregando compromissos compartilhados...
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center space-y-3 ${cardSurface}`}>
          <Users className="h-9 w-9 mx-auto text-violet-600/80" />
          <div className="text-sm font-bold">Nenhum compromisso compartilhado, setorial ou institucional encontrado.</div>
          <p className={`text-xs ${mutedText}`}>
            Crie um compromisso com visibilidade Compartilhado, Setorial ou Institucional para colaborar com a equipe.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 rounded-full bg-[#43239D] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6] transition"
            >
              <Plus className="h-4 w-4" />
              Novo compromisso colaborativo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filtered.map((occ) => {
            const confirmedCount = occ.participants.filter((p) => p.rsvpStatus === 'CONFIRMADO').length;
            const myPart = currentUserId
              ? occ.participants.find((p) => p.userId === currentUserId)
              : undefined;
            const canReplyRsvp =
              Boolean(myPart) &&
              occ.ownerUserId !== currentUserId &&
              occ.effectiveStatus !== 'CONCLUIDO' &&
              occ.effectiveStatus !== 'CANCELADO';

            return (
              <div
                key={occ.occurrenceKey}
                className={`rounded-3xl border p-4 space-y-3 ${cardSurface}`}
                style={{ borderTopWidth: '4px', borderTopColor: occ.color }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: occ.color }}
                    >
                      <AgendaCategoryIcon iconName={occ.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{occ.title}</div>
                      <div className={`text-xs ${mutedText}`}>
                        {formatLocalDateBr(occ.localStartDate)} ·{' '}
                        {formatHourShortBr(occ.localStartTime, occ.allDay)}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-xl bg-violet-50 text-[#43239D] px-2.5 py-1 text-[11px] font-extrabold shrink-0">
                    {formatCountdownLabel(occ)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 font-bold">
                    {VISIBILITY_LABEL[occ.visibility]}
                  </span>
                  {occ.department && (
                    <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 font-semibold">
                      Setor: {occ.department}
                    </span>
                  )}
                  <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${subtleBg}`}>
                    {confirmedCount}/{occ.participants.length} confirmado(s)
                  </span>
                  {occ.ownerName && (
                    <span className={mutedText}>Responsável: {occ.ownerName}</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {myPart && (
                      <span className="text-[11px] font-semibold text-slate-600">
                        Sua resposta:{' '}
                        <strong>
                          {myPart.rsvpStatus === 'CONFIRMADO'
                            ? 'Confirmado'
                            : myPart.rsvpStatus === 'RECUSADO'
                              ? 'Recusado'
                              : 'Pendente'}
                        </strong>
                      </span>
                    )}
                    {canReplyRsvp && (
                      <>
                        <button
                          type="button"
                          onClick={() => void onRespondRsvp(occ, 'CONFIRMADO')}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Confirmar presença
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRespondRsvp(occ, 'RECUSADO')}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <XCircle className="h-3 w-3" />
                          Recusar
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenOccurrence(occ)}
                    className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Detalhes
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AgendaHistoricoSectionProps {
  occurrences: AgendaOccurrenceView[];
  categories: AgendaCategoryDTO[];
  auditLogs: AgendaAuditLogDTO[];
  todayDate: string;
  search: string;
  onSearchChange: (val: string) => void;
  categoryId: string;
  onCategoryChange: (val: string) => void;
  isDark?: boolean;
  loading: boolean;
  onOpenOccurrence: (occ: AgendaOccurrenceView) => void;
}

export function AgendaHistoricoSection({
  occurrences,
  categories,
  auditLogs,
  todayDate,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  isDark = false,
  loading,
  onOpenOccurrence,
}: AgendaHistoricoSectionProps) {
  const [historyTab, setHistoryTab] = useState<HistoryTab>('encerrados');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('todos');
  const { cardSurface, mutedText, inputCls } = getSectionTheme(isDark);

  const closedOccurrences = useMemo(
    () =>
      occurrences
        .filter(
          (o) =>
            o.effectiveStatus === 'CONCLUIDO' ||
            o.effectiveStatus === 'CANCELADO' ||
            o.localEndDate < todayDate
        )
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [occurrences, todayDate]
  );

  const concludedCount = useMemo(
    () => closedOccurrences.filter((o) => o.effectiveStatus === 'CONCLUIDO').length,
    [closedOccurrences]
  );
  const cancelledCount = useMemo(
    () => closedOccurrences.filter((o) => o.effectiveStatus === 'CANCELADO').length,
    [closedOccurrences]
  );

  const filteredClosed = useMemo(() => {
    return closedOccurrences.filter((o) => {
      if (statusFilter === 'CONCLUIDO') return o.effectiveStatus === 'CONCLUIDO';
      if (statusFilter === 'CANCELADO') return o.effectiveStatus === 'CANCELADO';
      if (statusFilter === 'PASSADO') {
        return o.localEndDate < todayDate && o.effectiveStatus !== 'CONCLUIDO' && o.effectiveStatus !== 'CANCELADO';
      }
      return true;
    });
  }, [closedOccurrences, statusFilter, todayDate]);

  return (
    <div className="space-y-4">
      {/* 3 KPIs exclusivos de histórico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div
          className={`rounded-2xl border p-4 ${
            isDark ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' : 'bg-[#E9F9EE] border-[#CCF0D8] text-[#166534]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="h-4 w-4" />
            Concluídos
          </div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{concludedCount}</div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            isDark ? 'bg-rose-500/15 border-rose-400/30 text-rose-200' : 'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <XCircle className="h-4 w-4" />
            Cancelados
          </div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{cancelledCount}</div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            isDark ? 'bg-violet-500/15 border-violet-400/30 text-violet-200' : 'bg-[#F3EEFE] border-[#E4D8FC] text-[#5B21B6]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck className="h-4 w-4" />
            Registros na Auditoria (SHA-256)
          </div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{auditLogs.length}</div>
        </div>
      </div>

      {/* Abas: Compromissos Encerrados | Trilha de Auditoria */}
      <div className={`rounded-2xl border p-3.5 space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setHistoryTab('encerrados')}
              className={`rounded-xl border px-3.5 py-2 font-bold transition ${
                historyTab === 'encerrados'
                  ? 'bg-[#43239D] text-white border-[#43239D]'
                  : isDark
                    ? 'border-white/10 text-slate-300'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Compromissos Encerrados ({closedOccurrences.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('auditoria')}
              className={`rounded-xl border px-3.5 py-2 font-bold transition inline-flex items-center gap-1.5 ${
                historyTab === 'auditoria'
                  ? 'bg-[#43239D] text-white border-[#43239D]'
                  : isDark
                    ? 'border-white/10 text-slate-300'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Trilha de Auditoria SHA-256 ({auditLogs.length})
            </button>
          </div>
        </div>

        {historyTab === 'encerrados' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Pesquisar no histórico..."
                className={`w-full rounded-xl border pl-8 pr-3 py-2 ${inputCls}`}
              />
            </div>
            <select
              aria-label="Filtrar status do histórico"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as HistoryStatusFilter)}
              className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
            >
              <option value="todos">Todos os status</option>
              <option value="CONCLUIDO">Concluídos</option>
              <option value="CANCELADO">Cancelados</option>
              <option value="PASSADO">Passados não concluídos</option>
            </select>
            <select
              aria-label="Filtrar por categoria"
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
            >
              <option value="">Todas categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {historyTab === 'encerrados' ? (
        loading ? (
          <div className={`rounded-3xl border p-12 text-center text-sm ${cardSurface}`}>
            Carregando histórico da agenda...
          </div>
        ) : filteredClosed.length === 0 ? (
          <div className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}>
            <History className="h-9 w-9 mx-auto text-violet-600/80" />
            <div className="text-sm font-bold">Nenhum compromisso encerrado encontrado.</div>
            <p className={`text-xs ${mutedText}`}>
              Compromissos concluídos, cancelados ou de datas anteriores serão listados aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className={`rounded-3xl border divide-y divide-slate-200/70 overflow-hidden ${cardSurface}`}>
            {filteredClosed.map((occ) => (
              <div
                key={occ.occurrenceKey}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: occ.color }}
                  >
                    <AgendaCategoryIcon iconName={occ.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{occ.title}</div>
                    <div className={`text-xs ${mutedText}`}>
                      {formatLocalDateBr(occ.localStartDate)} ·{' '}
                      {formatHourShortBr(occ.localStartTime, occ.allDay)} · {occ.categoryName}
                      {occ.ownerName ? ` · Resp.: ${occ.ownerName}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      occ.effectiveStatus === 'CONCLUIDO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : occ.effectiveStatus === 'CANCELADO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {STATUS_LABEL[occ.effectiveStatus]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenOccurrence(occ)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : auditLogs.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}>
          <ShieldCheck className="h-9 w-9 mx-auto text-violet-600/80" />
          <div className="text-sm font-bold">Nenhum registro na trilha de auditoria ainda.</div>
          <p className={`text-xs ${mutedText}`}>
            Todas as criações, alterações, conclusões e exclusões da agenda geram registro íntegro SHA-256 aqui.
          </p>
        </div>
      ) : (
        <div className={`rounded-3xl border divide-y divide-slate-200/70 overflow-hidden ${cardSurface}`}>
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-violet-100 text-violet-900 px-2 py-0.5 font-extrabold text-[11px]">
                    {log.action}
                  </span>
                  <span className="font-semibold">{log.summary}</span>
                </div>
                <div className={`text-[11px] ${mutedText}`}>
                  Por {log.actorName || log.actorUserId} ·{' '}
                  {new Date(log.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </div>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                SHA-256: {log.sha256.slice(0, 14)}…
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
