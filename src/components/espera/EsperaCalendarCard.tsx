'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import type { SenhaRecord } from '@/lib/espera/espera-service';

interface Props {
  allRecords: SenhaRecord[];
  selectedDate: string | null; // 'YYYY-MM-DD'
  onSelectDate: (date: string | null) => void;
  slaMinutes?: number;
}

export function EsperaCalendarCard({
  allRecords,
  selectedDate,
  onSelectDate,
  slaMinutes = 15,
}: Props) {
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }, []);

  // Mês exibido no calendário (inicializa no mês atual ou no mês do dia selecionado)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Mapa de senhas agrupadas por dia 'YYYY-MM-DD'
  const statsPorDia = useMemo(() => {
    const map: Record<string, { total: number; dentroSla: number; tempoEsperaTotal: number; countEspera: number }> = {};
    for (const r of allRecords) {
      const d = r.data || todayStr;
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
    return map;
  }, [allRecords, todayStr, slaMinutes]);

  // Navegação entre meses
  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(todayStr);
  };

  // Cálculo da grade do calendário para o mês corrente
  const { monthLabel, daysGrid, totalSenhasMes, diasComMovimentoMes } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); // 0 a 11

    const monthLabel = currentMonth.toLocaleDateString('pt-BR', {
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
      const stats = statsPorDia[iso];
      grid.push({
        dayNumber: dayNum,
        dateIso: iso,
        isCurrentMonth: false,
        isToday: iso === todayStr,
        totalSenhas: stats?.total || 0,
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    // Dias do mês corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const iso = date.toLocaleDateString('en-CA');
      const stats = statsPorDia[iso];
      const total = stats?.total || 0;
      if (total > 0) {
        senhasMes += total;
        diasMovimento += 1;
      }
      grid.push({
        dayNumber: day,
        dateIso: iso,
        isCurrentMonth: true,
        isToday: iso === todayStr,
        totalSenhas: total,
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    // Dias do próximo mês para fechar a última linha
    const remaining = 35 - grid.length;
    const finalRemaining = remaining < 0 ? 42 - grid.length : remaining;
    for (let day = 1; day <= finalRemaining; day++) {
      const nextDate = new Date(year, month + 1, day);
      const iso = nextDate.toLocaleDateString('en-CA');
      const stats = statsPorDia[iso];
      grid.push({
        dayNumber: day,
        dateIso: iso,
        isCurrentMonth: false,
        isToday: iso === todayStr,
        totalSenhas: stats?.total || 0,
        dentroSlaPerc: stats && stats.countEspera > 0 ? Math.round((stats.dentroSla / stats.countEspera) * 100) : 100,
      });
    }

    return {
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      daysGrid: grid,
      totalSenhasMes: senhasMes,
      diasComMovimentoMes: diasMovimento,
    };
  }, [currentMonth, statsPorDia, todayStr]);

  const weekHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-3.5 flex flex-col justify-between">
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
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-semibold text-white px-1.5 font-mono whitespace-nowrap min-w-[100px] text-center">
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="space-y-1.5">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekHeaders.map((w, idx) => (
            <span
              key={w}
              className={`text-[10px] font-mono font-semibold uppercase ${
                idx === 0 || idx === 6 ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {w}
            </span>
          ))}
        </div>

        {/* Dias do Mês */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map((c) => {
            const isSelected = selectedDate === c.dateIso;
            const hasMove = c.totalSenhas > 0;

            let bgClass = 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.07] border-white/5';
            if (!c.isCurrentMonth) {
              bgClass = 'bg-transparent text-slate-600 opacity-40 hover:opacity-80 border-transparent';
            }
            if (hasMove) {
              bgClass = 'bg-indigo-950/30 text-white border-indigo-500/25 hover:bg-indigo-900/40 hover:border-indigo-400/50';
            }
            if (c.isToday && !isSelected) {
              bgClass += ' ring-1 ring-emerald-500/50';
            }
            if (isSelected) {
              bgClass = 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold border-indigo-400 shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400 scale-[1.03] z-10';
            }

            return (
              <button
                key={c.dateIso}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onSelectDate(null); // Desmarca se já estiver ativo
                  } else {
                    onSelectDate(c.dateIso);
                  }
                }}
                className={`group relative h-10 rounded-xl border flex flex-col items-center justify-between p-1 transition-all cursor-pointer ${bgClass}`}
                title={
                  hasMove
                    ? `${c.dateIso}: ${c.totalSenhas} senhas geradas (${c.dentroSlaPerc}% dentro do SLA). Clique para filtrar!`
                    : `${c.dateIso}: Sem senhas registradas.`
                }
              >
                {/* Número do dia */}
                <div className="flex items-center justify-between w-full px-0.5">
                  <span className={`text-[11px] font-mono ${isSelected ? 'font-black text-white' : ''}`}>
                    {c.dayNumber}
                  </span>
                  {c.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Hoje" />
                  )}
                </div>

                {/* Badge ou ponto de movimento */}
                <div className="w-full flex items-center justify-center">
                  {hasMove ? (
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
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-[11px] text-indigo-300">
                Dia ativo: <strong className="text-white font-mono">{selectedDateLabel}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg border border-white/10 transition-all cursor-pointer"
            >
              <X className="w-3 h-3 text-slate-400" />
              <span>Ver todos</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-[11px] text-slate-400">
            <span>
              {diasComMovimentoMes > 0
                ? `${diasComMovimentoMes} dias com movimento no mês`
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
