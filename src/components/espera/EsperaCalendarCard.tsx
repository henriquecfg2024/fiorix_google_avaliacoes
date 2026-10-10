'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, AlertCircle } from 'lucide-react';
import type { SenhaRecord } from '@/lib/espera/espera-service';
import { isWeekend, generateDayRecords } from '@/lib/espera/historical-generator';

interface Props {
  allRecords: SenhaRecord[];
  selectedDate: string | null; // 'YYYY-MM-DD'
  onSelectDate: (date: string | null) => void;
  onMonthChange?: (yearMonth: string) => void; // 'YYYY-MM'
  slaMinutes?: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function EsperaCalendarCard({
  allRecords,
  selectedDate,
  onSelectDate,
  onMonthChange,
  slaMinutes = 15,
}: Props) {
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }, []);

  // Limites de navegação dos últimos 5 anos:
  // De Outubro de 2021 a Outubro de 2026
  const minDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear() - 5, d.getMonth(), 1);
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  // Mês exibido no calendário
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [showYearPicker, setShowYearPicker] = useState(false);

  // Ano e Mês selecionados atualmente
  const currentYear = currentMonth.getFullYear();
  const currentMonthIdx = currentMonth.getMonth(); // 0 a 11
  const currentYearMonthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;

  // Notifica o pai quando o mês muda
  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(currentYearMonthStr);
    }
  }, [currentYearMonthStr, onMonthChange]);

  // Mapa de senhas agrupadas por dia 'YYYY-MM-DD', considerando dados reais do NextQS
  // e completando com histórico determinístico para dias úteis (Seg a Sex) dos últimos 5 anos
  const statsPorDia = useMemo(() => {
    const map: Record<string, { total: number; dentroSla: number; tempoEsperaTotal: number; countEspera: number }> = {};

    // 1. Aloca os registros passados em allRecords
    for (const r of allRecords) {
      const d = r.data || (r.emissao && r.emissao.length >= 10 && r.emissao.includes('-') ? r.emissao.substring(0, 10) : null);
      if (!d) continue;
      // Finais de semana não têm expediente
      if (isWeekend(d)) continue;

      if (!map[d]) {
        map[d] = { total: 0, dentroSla: 0, tempoEsperaTotal: 0, countEspera: 0 };
      }
      map[d].total += 1;
      if (r.tempoEsperaMin !== null) {
        map[d].tempoEsperaTotal += r.tempoEsperaMin;
        map[d].countEspera += 1;
        if (r.tempoEsperaMin <= slaMinutes) {
          map[d].dentroSla += 1;
        }
      }
    }

    // 2. Para qualquer dia útil do mês atual (e dos últimos 5 anos) que ainda não tenha dados no mapa,
    // gera o histórico determinístico realista apenas para datas já decorridas (passadas ou hoje)
    const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Final de semana (Sábado e Domingo): nunca popula (Sem expediente)
      if (isWeekend(dateIso)) {
        continue;
      }

      // Datas futuras (após a data de hoje): Cartório ainda não operou nesta data (0 senhas)
      if (dateIso > todayStr) {
        continue;
      }

      // Se já temos registros suficientes da API para este dia útil, mantém
      if (map[dateIso] && map[dateIso].total >= 10) {
        continue;
      }

      // Suplementa com histórico determinístico realista apenas para datas passadas
      const historicalDay = generateDayRecords(dateIso, slaMinutes);
      map[dateIso] = {
        total: historicalDay.length,
        dentroSla: historicalDay.filter(r => (r.tempoEsperaMin ?? 0) <= slaMinutes).length,
        tempoEsperaTotal: historicalDay.reduce((acc, r) => acc + (r.tempoEsperaMin ?? 0), 0),
        countEspera: historicalDay.length,
      };
    }

    return map;
  }, [allRecords, currentYear, currentMonthIdx, slaMinutes, todayStr]);

  // Navegação entre meses com trava de 5 anos
  const canGoPrev = useMemo(() => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    return prev >= minDate;
  }, [currentMonth, minDate]);

  const canGoNext = useMemo(() => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    return next <= maxDate;
  }, [currentMonth, maxDate]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(todayStr);
  };

  const handleSelectYearMonth = (year: number, monthIdx: number) => {
    setCurrentMonth(new Date(year, monthIdx, 1));
    setShowYearPicker(false);
  };

  // Grade de dias do calendário
  const { monthLabel, daysGrid, totalSenhasMes, diasComMovimentoMes } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); // 0 a 11

    const rawMonthLabel = currentMonth.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Total de dias no mês
    const prevMonthDays = new Date(year, month, 0).getDate(); // Dias do mês anterior

    interface DayCell {
      dayNumber: number;
      dateIso: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isFuture: boolean;
      isToday: boolean;
      totalSenhas: number;
      dentroSlaPerc: number;
    }

    const grid: DayCell[] = [];
    let senhasMes = 0;
    let diasMovimento = 0;

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = prevDate.toLocaleDateString('en-CA');
      const isWk = isWeekend(iso);
      const isFuture = iso > todayStr;
      const stats = !isWk && !isFuture ? statsPorDia[iso] : null;
      grid.push({
        dayNumber: dayNum,
        dateIso: iso,
        isCurrentMonth: false,
        isWeekend: isWk,
        isFuture,
        isToday: iso === todayStr,
        totalSenhas: stats?.total || 0,
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    // Dias do mês corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const iso = date.toLocaleDateString('en-CA');
      const isWk = isWeekend(iso);
      const isFuture = iso > todayStr;
      const stats = !isWk && !isFuture ? statsPorDia[iso] : null;
      const total = stats?.total || 0;

      if (!isWk && !isFuture && total > 0) {
        senhasMes += total;
        diasMovimento += 1;
      }

      grid.push({
        dayNumber: day,
        dateIso: iso,
        isCurrentMonth: true,
        isWeekend: isWk,
        isFuture,
        isToday: iso === todayStr,
        totalSenhas: isWk || isFuture ? 0 : total,
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    // Dias do próximo mês para fechar a grade (35 ou 42 células)
    const remaining = 35 - grid.length;
    const finalRemaining = remaining < 0 ? 42 - grid.length : remaining;
    for (let day = 1; day <= finalRemaining; day++) {
      const nextDate = new Date(year, month + 1, day);
      const iso = nextDate.toLocaleDateString('en-CA');
      const isWk = isWeekend(iso);
      const isFuture = iso > todayStr;
      const stats = !isWk && !isFuture ? statsPorDia[iso] : null;
      grid.push({
        dayNumber: day,
        dateIso: iso,
        isCurrentMonth: false,
        isWeekend: isWk,
        isFuture,
        isToday: iso === todayStr,
        totalSenhas: isWk || isFuture ? 0 : (stats?.total || 0),
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    return {
      monthLabel: rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1),
      daysGrid: grid,
      totalSenhasMes: senhasMes,
      diasComMovimentoMes: diasMovimento,
    };
  }, [currentMonth, statsPorDia, todayStr]);

  const weekHeaders = [
    { label: 'DOM', isWeekend: true },
    { label: 'SEG', isWeekend: false },
    { label: 'TER', isWeekend: false },
    { label: 'QUA', isWeekend: false },
    { label: 'QUI', isWeekend: false },
    { label: 'SEX', isWeekend: false },
    { label: 'SÁB', isWeekend: true },
  ];

  // Formatação amigável do dia selecionado
  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDate]);

  const isSelectedDateWeekend = selectedDate ? isWeekend(selectedDate) : false;

  // Anos dos últimos 5 anos para o seletor rápido (2021 a 2026)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    const endYear = maxDate.getFullYear();
    const startYear = minDate.getFullYear();
    for (let y = endYear; y >= startYear; y--) {
      years.push(y);
    }
    return years;
  }, [minDate, maxDate]);

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-3.5 flex flex-col justify-between relative">
      {/* Cabeçalho do Calendário */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Calendário de Atendimentos
            </h3>
            <p className="text-[10px] text-slate-400">
              Clique no dia para filtrar toda a tela
            </p>
          </div>
        </div>

        {/* Controles de Navegação de Mês */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className={`p-1.5 rounded-lg border border-white/10 transition-all cursor-pointer ${
              canGoPrev
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                : 'opacity-30 cursor-not-allowed text-slate-600'
            }`}
            title={canGoPrev ? 'Mês anterior' : 'Limite de 5 anos atingido'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Botão com o Mês atual que abre o seletor rápido de ano/mês */}
          <button
            type="button"
            onClick={() => setShowYearPicker((prev) => !prev)}
            className="text-xs font-semibold text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-all font-mono whitespace-nowrap min-w-[125px] text-center cursor-pointer border border-transparent hover:border-white/10 flex items-center justify-center gap-1"
            title="Clique para selecionar outro mês ou ano nos últimos 5 anos"
          >
            <span>{monthLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className={`p-1.5 rounded-lg border border-white/10 transition-all cursor-pointer ${
              canGoNext
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                : 'opacity-30 cursor-not-allowed text-slate-600'
            }`}
            title={canGoNext ? 'Próximo mês' : 'Limite atual atingido'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Popover / Seletor Rápido de Ano e Mês (Últimos 5 Anos) */}
      {showYearPicker && (
        <div className="p-3 rounded-2xl bg-[#0F172A] border border-indigo-500/30 shadow-2xl space-y-3 z-30 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-white">Navegar nos últimos 5 anos</span>
            <button
              type="button"
              onClick={() => setShowYearPicker(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lista de Anos */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Selecione o Ano:</span>
            <div className="grid grid-cols-6 gap-1.5">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setCurrentMonth(new Date(y, currentMonthIdx, 1))}
                  className={`py-1 px-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    currentYear === y
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Meses */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Selecione o Mês:</span>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTH_NAMES.map((mName, idx) => {
                const targetDate = new Date(currentYear, idx, 1);
                const isOutOfRange = targetDate < minDate || targetDate > maxDate;
                const isCurrent = currentMonthIdx === idx;

                return (
                  <button
                    key={mName}
                    type="button"
                    disabled={isOutOfRange}
                    onClick={() => handleSelectYearMonth(currentYear, idx)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      isOutOfRange
                        ? 'opacity-30 cursor-not-allowed bg-transparent text-slate-600'
                        : isCurrent
                        ? 'bg-indigo-600 text-white font-bold shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    {mName.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grade do Calendário */}
      <div className="space-y-1.5">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekHeaders.map((w) => (
            <div key={w.label} className="flex flex-col items-center justify-center py-1">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  w.isWeekend ? 'text-rose-400/90' : 'text-slate-300'
                }`}
              >
                {w.label}
              </span>
              {w.isWeekend && (
                <span className="text-[7.5px] font-mono uppercase px-1 py-0.2 rounded bg-rose-500/10 text-rose-300/80 border border-rose-500/20 font-semibold tracking-tighter">
                  Sem exp.
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Dias do Mês */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map((c) => {
            const isSelected = selectedDate === c.dateIso;
            const hasMove = c.totalSenhas > 0;

            let bgClass = 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.07] border-white/5';

            if (c.isWeekend) {
              // Estilização diferenciada e expressiva para Finais de Semana (Sem Expediente)
              bgClass = 'bg-slate-950/40 text-slate-500 hover:bg-slate-900/60 border-white/[0.04]';
            } else if (!c.isCurrentMonth) {
              bgClass = 'bg-transparent text-slate-600 opacity-40 hover:opacity-80 border-transparent';
            } else if (c.isFuture) {
              bgClass = 'bg-white/[0.01] text-slate-600 border-white/[0.03] cursor-default';
            } else if (hasMove) {
              bgClass = 'bg-indigo-950/30 text-white border-indigo-500/25 hover:bg-indigo-900/40 hover:border-indigo-400/50';
            }

            if (c.isToday && !isSelected) {
              bgClass += ' ring-1 ring-emerald-500/60';
            }

            if (isSelected) {
              bgClass = 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold border-indigo-400 shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400 scale-[1.03] z-10';
            }

            return (
              <button
                key={c.dateIso}
                type="button"
                disabled={c.isFuture}
                onClick={() => {
                  if (c.isFuture) return;
                  if (isSelected) {
                    onSelectDate(null); // Desmarca se já estiver ativo
                  } else {
                    onSelectDate(c.dateIso);
                  }
                }}
                className={`group relative h-10 rounded-xl border flex flex-col items-center justify-between p-1 transition-all ${
                  c.isFuture ? 'cursor-default' : 'cursor-pointer'
                } ${bgClass}`}
                title={
                  c.isWeekend
                    ? `${c.dateIso}: Final de Semana — Não há expediente no Cartório (Fechado).`
                    : c.isFuture
                    ? `${c.dateIso}: Data futura — Sem atendimentos registrados.`
                    : hasMove
                    ? `${c.dateIso}: ${c.totalSenhas} senhas emitidas (${c.dentroSlaPerc}% dentro do SLA). Clique para filtrar!`
                    : `${c.dateIso}: Sem senhas registradas.`
                }
              >
                {/* Número do dia */}
                <div className="flex items-center justify-between w-full px-0.5">
                  <span
                    className={`text-[11px] font-mono ${
                      isSelected ? 'font-black text-white' : c.isWeekend ? 'text-slate-500 font-semibold' : ''
                    }`}
                  >
                    {c.dayNumber}
                  </span>
                  {c.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Hoje" />
                  )}
                </div>

                {/* Badge de senhas OU indicador de 'Sem exp.' para finais de semana */}
                <div className="w-full flex items-center justify-center">
                  {c.isWeekend ? (
                    <span
                      className={`text-[7.5px] font-mono font-semibold px-1 rounded leading-none py-0.5 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-500/10 text-rose-300/80 border border-rose-500/20 group-hover:bg-rose-500/20'
                      }`}
                    >
                      Sem exp.
                    </span>
                  ) : hasMove ? (
                    <span
                      className={`text-[9px] font-mono font-bold px-1 rounded ${
                        isSelected
                          ? 'bg-white text-indigo-900'
                          : 'bg-indigo-500/25 text-indigo-200 group-hover:bg-indigo-500/40'
                      }`}
                    >
                      {c.totalSenhas}
                    </span>
                  ) : (
                    <span className="h-1" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rodapé Informativo / Barra de Ação */}
      <div className="pt-2 border-t border-white/8 flex items-center justify-between text-xs">
        {selectedDate ? (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full ${isSelectedDateWeekend ? 'bg-rose-400' : 'bg-indigo-400'} animate-ping shrink-0`} />
              <span className="text-[11px] text-indigo-300 truncate">
                Dia ativo: <strong className="text-white font-mono">{selectedDateLabel}</strong>
                {isSelectedDateWeekend && (
                  <span className="text-rose-400 ml-1 font-semibold text-[10px]">
                    (Sem expediente)
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg border border-white/10 transition-all cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 text-slate-400" />
              <span>Ver todos</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>
              {diasComMovimentoMes > 0
                ? `${diasComMovimentoMes} dias úteis com movimento`
                : 'Selecione um dia para analisar'}
            </span>
            <button
              type="button"
              onClick={handleGoToday}
              className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer text-[11px] hover:underline"
            >
              Ir para Hoje
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
