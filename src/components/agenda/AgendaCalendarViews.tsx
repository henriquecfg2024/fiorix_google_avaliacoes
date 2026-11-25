'use client';

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from 'lucide-react';
import type {
  AgendaCalendarView,
  AgendaCategoryDTO,
  AgendaOccurrenceView,
  AgendaSemesterMode,
} from '@/lib/agenda/types';
import { getDaysInMonth, getWeekdayOfLocalDate } from '@/lib/agenda/recurrence';
import {
  addDaysToLocalDate,
  formatCountdownLabel,
  formatHourShortBr,
  formatLocalDateBr,
} from '@/lib/agenda/timezone';
import { AgendaCategoryIcon, PRIORITY_LABEL, STATUS_LABEL } from './agenda-icons';

const MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

interface AgendaCalendarViewsProps {
  view: AgendaCalendarView;
  semesterMode: AgendaSemesterMode;
  onChangeSemesterMode: (mode: AgendaSemesterMode) => void;
  anchorDate: string; // YYYY-MM-DD
  selectedDate: string; // YYYY-MM-DD
  todayDate: string; // YYYY-MM-DD
  occurrences: AgendaOccurrenceView[];
  categories: AgendaCategoryDTO[];
  isDark?: boolean;
  canCreate: boolean;
  onSelectDate: (dateStr: string) => void;
  onNavigatePeriod: (delta: number) => void;
  onSelectYear: (year: number) => void;
  onGoToday: () => void;
  onOpenOccurrence: (occ: AgendaOccurrenceView) => void;
  onCreateOnDate: (dateStr: string) => void;
}

function ymd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function AgendaCalendarViews({
  view,
  semesterMode,
  onChangeSemesterMode,
  anchorDate,
  selectedDate,
  todayDate,
  occurrences,
  categories,
  isDark = false,
  canCreate,
  onSelectDate,
  onNavigatePeriod,
  onSelectYear,
  onGoToday,
  onOpenOccurrence,
  onCreateOnDate,
}: AgendaCalendarViewsProps) {
  const [anchorYear, anchorMonth] = anchorDate.split('-').map(Number);

  // Agrupa ocorrências por data local para consultas O(1)
  const byDate = new Map<string, AgendaOccurrenceView[]>();
  for (const occ of occurrences) {
    const startD = occ.localStartDate;
    const endD = occ.localEndDate >= startD ? occ.localEndDate : startD;
    let cursor = startD;
    let guard = 0;
    while (cursor <= endD && guard < 31) {
      guard += 1;
      const arr = byDate.get(cursor) ?? [];
      arr.push(occ);
      byDate.set(cursor, arr);
      cursor = addDaysToLocalDate(cursor, 1);
    }
  }

  const cardSurface = isDark
    ? 'bg-[#0D1322] border-white/10 text-slate-100'
    : 'bg-white border-slate-200/80 text-slate-900 shadow-xs';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const btnOutline = isDark
    ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  const periodTitle =
    view === 'DIARIO'
      ? formatLocalDateBr(selectedDate)
      : view === 'SEMANAL'
        ? `Semana de ${formatLocalDateBr(anchorDate)}`
        : view === 'SEMESTRAL'
          ? semesterMode === 'FIRST_HALF'
            ? `1º Semestre de ${anchorYear}`
            : semesterMode === 'SECOND_HALF'
              ? `2º Semestre de ${anchorYear}`
              : `6 meses a partir de ${MONTHS_FULL[anchorMonth - 1]} / ${anchorYear}`
          : view === 'ANUAL'
            ? `Ano ${anchorYear}`
            : `${MONTHS_FULL[anchorMonth - 1]} de ${anchorYear}`;

  const yearsOptions: number[] = [];
  for (let y = anchorYear - 2; y <= anchorYear + 5; y += 1) {
    yearsOptions.push(y);
  }

  const selectedDayOccurrences = byDate.get(selectedDate) ?? [];

  // ── Renderização Mensal ───────────────────────────────────────────────
  function renderMonthGrid(year: number, month: number, compact = false) {
    const daysCount = getDaysInMonth(year, month);
    const firstWeekday = getWeekdayOfLocalDate(ymd(year, month, 1));
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthDays = getDaysInMonth(prevYear, prevMonth);

    const cells: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];
    for (let i = firstWeekday - 1; i >= 0; i -= 1) {
      const day = prevMonthDays - i;
      cells.push({ dateStr: ymd(prevYear, prevMonth, day), day, inMonth: false });
    }
    for (let day = 1; day <= daysCount; day += 1) {
      cells.push({ dateStr: ymd(year, month, day), day, inMonth: true });
    }
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({
        dateStr: ymd(nextYear, nextMonth, nextDay),
        day: nextDay,
        inMonth: false,
      });
      nextDay += 1;
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS_SHORT.map((wd) => (
            <div
              key={wd}
              className={`py-1 text-[10px] font-bold tracking-wider ${mutedText}`}
            >
              {compact ? wd.slice(0, 1) : wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const list = byDate.get(cell.dateStr) ?? [];
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayDate;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => onSelectDate(cell.dateStr)}
                className={`group relative flex flex-col items-center justify-center rounded-xl transition ${
                  compact ? 'h-9 text-xs' : 'h-12 sm:h-14 text-sm'
                } ${
                  isSelected
                    ? 'bg-[#43239D] text-white font-bold shadow-sm'
                    : isToday
                      ? isDark
                        ? 'border border-violet-400/60 bg-violet-500/20 text-violet-200 font-bold'
                        : 'border border-violet-300 bg-violet-50 text-violet-900 font-bold'
                      : cell.inMonth
                        ? isDark
                          ? 'hover:bg-white/5 text-slate-200 font-medium'
                          : 'hover:bg-slate-100 text-slate-800 font-medium'
                        : isDark
                          ? 'text-slate-600'
                          : 'text-slate-300'
                }`}
              >
                <span className="tabular-nums">{cell.day}</span>
                {list.length > 0 && (
                  <div className="mt-1 flex items-center gap-0.5">
                    {list.slice(0, 3).map((item) => (
                      <span
                        key={item.occurrenceKey}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: isSelected ? '#FFFFFF' : item.color,
                        }}
                      />
                    ))}
                    {list.length > 3 && (
                      <span
                        className={`text-[9px] font-bold ${
                          isSelected ? 'text-white' : mutedText
                        }`}
                      >
                        +
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border p-4 sm:p-5 space-y-4 ${cardSurface}`}>
      {/* Barra de navegação do período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigatePeriod(-1)}
            aria-label="Período anterior"
            className={`rounded-xl border p-2 transition ${btnOutline}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigatePeriod(1)}
            aria-label="Próximo período"
            className={`rounded-xl border p-2 transition ${btnOutline}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight ml-1">
            {periodTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'SEMESTRAL' && (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              {(
                [
                  ['FIRST_HALF', '1º Sem'],
                  ['SECOND_HALF', '2º Sem'],
                  ['ROLLING_6', '6 meses móveis'],
                ] as Array<[AgendaSemesterMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeSemesterMode(mode)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    semesterMode === mode
                      ? 'bg-[#43239D] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <select
            aria-label="Selecionar ano"
            value={anchorYear}
            onChange={(e) => onSelectYear(Number(e.target.value))}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${btnOutline}`}
          >
            {yearsOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onGoToday}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${btnOutline}`}
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Modos de visualização */}
      {view === 'MENSAL' && (
        <div className="space-y-4">
          {renderMonthGrid(anchorYear, anchorMonth, false)}

          {/* Lista resumida da data selecionada */}
          <div
            className={`rounded-2xl border p-3.5 space-y-2.5 ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold">
                Compromissos em {formatLocalDateBr(selectedDate)} ({selectedDayOccurrences.length})
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => onCreateOnDate(selectedDate)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#43239D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#5B21B6]"
                >
                  <Plus className="h-3 w-3" />
                  Novo nesta data
                </button>
              )}
            </div>
            {selectedDayOccurrences.length === 0 ? (
              <p className={`text-xs ${mutedText}`}>
                Nenhum compromisso cadastrado para esta data.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedDayOccurrences.map((occ) => (
                  <button
                    key={occ.occurrenceKey}
                    type="button"
                    onClick={() => onOpenOccurrence(occ)}
                    className={`rounded-xl border p-2.5 text-left flex items-center gap-2.5 transition ${
                      isDark
                        ? 'border-white/10 bg-[#070A12] hover:border-white/25'
                        : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-2xs'
                    }`}
                  >
                    <span
                      className="h-8 w-8 rounded-lg text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: occ.color }}
                    >
                      <AgendaCategoryIcon iconName={occ.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{occ.title}</div>
                      <div className={`text-[11px] ${mutedText} flex items-center gap-1.5`}>
                        <span>{formatHourShortBr(occ.localStartTime, occ.allDay)}</span>
                        <span>·</span>
                        <span>{STATUS_LABEL[occ.effectiveStatus]}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'DIARIO' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${mutedText}`}>
              Visão cronológica de {formatLocalDateBr(selectedDate)}
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={() => onCreateOnDate(selectedDate)}
                className="inline-flex items-center gap-1 rounded-xl bg-[#43239D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B21B6]"
              >
                <Plus className="h-3.5 w-3.5" />
                Agendar neste dia
              </button>
            )}
          </div>
          {selectedDayOccurrences.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center text-xs ${mutedText}`}>
              Agenda livre em {formatLocalDateBr(selectedDate)}.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDayOccurrences.map((occ) => (
                <button
                  key={occ.occurrenceKey}
                  type="button"
                  onClick={() => onOpenOccurrence(occ)}
                  className={`w-full rounded-2xl border p-3.5 text-left flex flex-wrap items-center justify-between gap-3 transition ${
                    isDark
                      ? 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: occ.color }}
                    >
                      <AgendaCategoryIcon iconName={occ.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{occ.title}</div>
                      <div className={`text-xs ${mutedText} flex flex-wrap items-center gap-2`}>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3" />
                          {occ.allDay ? 'Dia inteiro' : `${occ.localStartTime} – ${occ.localEndTime}`}
                        </span>
                        <span>· {occ.categoryName}</span>
                        {occ.location && <span>· {occ.location}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-slate-200/80 text-slate-800 px-2.5 py-0.5">
                      {PRIORITY_LABEL[occ.priority]}
                    </span>
                    <span className="rounded-full bg-violet-100 text-violet-900 px-2.5 py-0.5">
                      {formatCountdownLabel(occ)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'SEMANAL' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
          {Array.from({ length: 7 }, (_, idx) => {
            const wd = getWeekdayOfLocalDate(anchorDate);
            const weekStart = addDaysToLocalDate(anchorDate, -wd);
            const dayStr = addDaysToLocalDate(weekStart, idx);
            const items = byDate.get(dayStr) ?? [];
            const isToday = dayStr === todayDate;
            const isSelected = dayStr === selectedDate;

            return (
              <div
                key={dayStr}
                className={`rounded-2xl border p-2.5 flex flex-col gap-2 min-h-[160px] ${
                  isSelected
                    ? isDark
                      ? 'border-violet-400 bg-violet-500/10'
                      : 'border-violet-400 bg-violet-50/50'
                    : isDark
                      ? 'border-white/10 bg-white/[0.02]'
                      : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectDate(dayStr)}
                    className="text-left"
                  >
                    <div className={`text-[10px] font-bold ${mutedText}`}>
                      {WEEKDAYS_SHORT[idx]}
                    </div>
                    <div
                      className={`text-sm font-extrabold ${
                        isToday ? 'text-violet-700' : ''
                      }`}
                    >
                      {dayStr.slice(8, 10)}/{dayStr.slice(5, 7)}
                    </div>
                  </button>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => onCreateOnDate(dayStr)}
                      aria-label={`Novo compromisso em ${dayStr}`}
                      className={`rounded-lg p-1 ${mutedText} hover:bg-violet-100 hover:text-violet-800`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  {items.length === 0 ? (
                    <span className={`text-[11px] ${mutedText}`}>Livre</span>
                  ) : (
                    items.map((occ) => (
                      <button
                        key={occ.occurrenceKey}
                        type="button"
                        onClick={() => onOpenOccurrence(occ)}
                        className="w-full rounded-xl p-1.5 text-left text-white text-[11px] shadow-2xs hover:opacity-95"
                        style={{ backgroundColor: occ.color }}
                      >
                        <div className="font-bold truncate">{occ.title}</div>
                        <div className="opacity-90 text-[10px]">
                          {formatHourShortBr(occ.localStartTime, occ.allDay)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'SEMESTRAL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, idx) => {
            const startMonthIdx =
              semesterMode === 'FIRST_HALF'
                ? 0
                : semesterMode === 'SECOND_HALF'
                  ? 6
                  : anchorMonth - 1;
            const totalM = anchorYear * 12 + startMonthIdx + idx;
            const y = Math.floor(totalM / 12);
            const m = (totalM % 12) + 1;

            return (
              <div
                key={`${y}-${m}`}
                className={`rounded-2xl border p-3 ${
                  isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="text-xs font-extrabold mb-2 text-center">
                  {MONTHS_FULL[m - 1]} {y}
                </div>
                {renderMonthGrid(y, m, true)}
              </div>
            );
          })}
        </div>
      )}

      {view === 'ANUAL' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {Array.from({ length: 12 }, (_, idx) => {
            const m = idx + 1;
            const monthPrefix = `${String(anchorYear).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
            const monthCount = occurrences.filter((o) =>
              o.localStartDate.startsWith(monthPrefix)
            ).length;

            return (
              <div
                key={m}
                className={`rounded-2xl border p-3 ${
                  isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold">{MONTHS_FULL[idx]}</span>
                  {monthCount > 0 && (
                    <span className="rounded-full bg-violet-100 text-violet-900 px-2 py-0.5 text-[10px] font-bold">
                      {monthCount}
                    </span>
                  )}
                </div>
                {renderMonthGrid(anchorYear, m, true)}
              </div>
            );
          })}
        </div>
      )}

      {view === 'LISTA' && (
        <div className="space-y-2.5">
          {occurrences.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center text-xs ${mutedText}`}>
              Nenhum compromisso encontrado para os filtros aplicados.
            </div>
          ) : (
            occurrences.map((occ) => (
              <button
                key={occ.occurrenceKey}
                type="button"
                onClick={() => onOpenOccurrence(occ)}
                className="w-full rounded-2xl p-3.5 text-left text-white flex flex-wrap items-center justify-between gap-3 shadow-xs hover:opacity-95 transition"
                style={{ backgroundColor: occ.color }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <AgendaCategoryIcon iconName={occ.icon} className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold truncate">{occ.title}</div>
                    <div className="text-xs text-white/90">
                      {formatLocalDateBr(occ.localStartDate)} ·{' '}
                      {occ.allDay ? 'Dia inteiro' : `${occ.localStartTime} – ${occ.localEndTime}`} ·{' '}
                      {occ.categoryName}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold">{formatCountdownLabel(occ)}</div>
                  <div className="text-[11px] text-white/85">
                    {STATUS_LABEL[occ.effectiveStatus]} · {PRIORITY_LABEL[occ.priority]}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Legenda de categorias com ícone e cor (acessibilidade: cor + texto) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-200/70">
        {categories.slice(0, 8).map((cat) => (
          <div key={cat.id} className={`inline-flex items-center gap-1.5 text-[11px] ${mutedText}`}>
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            <AgendaCategoryIcon iconName={cat.icon} className="h-3 w-3" />
            <span className="font-medium">{cat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
