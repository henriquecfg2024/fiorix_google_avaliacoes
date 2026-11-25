'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarCheck2,
  CalendarX2,
  Clock,
  MoonStar,
  RefreshCw,
  Sun,
  Sunrise,
  X,
} from 'lucide-react';
import type { AgendaWelcomeResponse } from '@/lib/agenda/types';
import { formatHourShortBr } from '@/lib/agenda/timezone';

interface WelcomeLoginModalProps {
  open: boolean;
  loading: boolean;
  data: AgendaWelcomeResponse | null;
  onClose: () => void;
  onOpenAgenda: (quickFilter?: 'atrasados') => void;
  onRetry?: () => void;
}

/**
 * Modal global de Boas-Vindas Inteligentes alinhado aos Prints 1 e 2 (fundo claro,
 * cabeçalho institucional escuro com logo oficial do FIORIX, sem imagens fictícias).
 */
export function WelcomeLoginModal({
  open,
  loading,
  data,
  onClose,
  onOpenAgenda,
  onRetry,
}: WelcomeLoginModalProps) {
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    const timer = window.setTimeout(() => primaryBtnRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const TimeIcon =
    data?.timePeriod === 'NOITE'
      ? MoonStar
      : data?.timePeriod === 'TARDE'
        ? Sun
        : Sunrise;

  const isPurpleScenario =
    data?.scenario === 'A_UM_COMPROMISSO' ||
    data?.scenario === 'B_VARIOS_COMPROMISSOS';
  const isGreenScenario =
    data?.scenario === 'C_SEM_COMPROMISSOS' ||
    data?.scenario === 'D_TODOS_CONCLUIDOS';
  const isErrorScenario = data?.scenario === 'F_FALHA_CONSULTA';
  const isNoPermScenario = data?.scenario === 'G_SEM_PERMISSAO_AGENDA';

  const countText =
    data?.totalTodayScheduled === 1
      ? 'Você tem 1 compromisso agendado para hoje.'
      : `Você tem ${data?.totalTodayScheduled ?? 0} compromissos agendados para hoje.`;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas inteligentes do FIORIX"
    >
      <div className="w-full max-w-[560px] max-h-[92dvh] overflow-y-auto rounded-[28px] bg-[#0B1120] p-3.5 shadow-2xl border border-slate-800/80 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho escuro oficial FIORIX (idêntico aos Prints 1 e 2) */}
        <div className="flex items-center gap-3 px-3 pt-1.5 pb-3.5">
          <Image
            src="/logo-fiorix.png"
            alt="FIORIX — Enterprise Digital Governance"
            width={160}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        {/* Cartão branco claro principal */}
        <div className="rounded-[22px] bg-white text-slate-900 p-6 sm:p-7 shadow-lg space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              {data?.formattedDate || 'Carregando data...'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar boas-vindas"
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <TimeIcon className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-950 leading-tight">
              {data?.greetingTitle || 'Olá!'}
            </h2>
            <p className="text-sm text-slate-600">
              É um prazer ter você novamente no FIORIX.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center text-sm font-medium text-slate-600">
              Consultando sua agenda de hoje...
            </div>
          ) : isNoPermScenario ? null : isErrorScenario ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center space-y-3">
              <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/80 text-slate-700">
                <CalendarX2 className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-800">
                Não foi possível consultar sua agenda neste momento.
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </button>
              )}
            </div>
          ) : isGreenScenario ? (
            <div className="rounded-2xl border border-emerald-200 bg-[#ECFDF5] p-5 text-center space-y-2">
              <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl text-emerald-700">
                <CalendarCheck2 className="h-7 w-7" />
              </div>
              {data?.scenario === 'D_TODOS_CONCLUIDOS' ? (
                <>
                  <div className="text-lg font-extrabold text-emerald-900">
                    Parabéns{data.firstName ? `, ${data.firstName}` : ''}!
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-emerald-800">
                    Todos os seus {data.totalTodayScheduled} compromissos de hoje foram concluídos ({data.totalTodayCompleted}/{data.totalTodayScheduled}).
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-extrabold text-emerald-900">
                    Sua agenda está livre hoje!
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-emerald-800">
                    Você não possui compromissos agendados para hoje.
                  </p>
                </>
              )}
            </div>
          ) : isPurpleScenario || (data && data.todayItems.length > 0) ? (
            <div className="rounded-2xl border border-violet-200/80 bg-[#F3EEFE] p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#5B21B6] font-bold text-sm sm:text-base">
                <Calendar className="h-5 w-5 shrink-0" />
                <span>{countText}</span>
              </div>

              <div className="space-y-2">
                {data?.todayItems.map((item) => (
                  <button
                    key={item.occurrenceKey}
                    type="button"
                    onClick={() => onOpenAgenda()}
                    className="w-full rounded-xl bg-white border border-violet-100 px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:border-violet-300 hover:shadow-xs transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="h-4 w-4 text-violet-600 shrink-0" />
                      <span className="text-xs font-extrabold text-slate-900 tabular-nums shrink-0">
                        {formatHourShortBr(item.localStartTime, item.allDay)}
                      </span>
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {item.title}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>

              {data && data.remainingCount > 0 && (
                <div className="text-xs font-semibold text-violet-800 pl-1">
                  E mais {data.remainingCount}{' '}
                  {data.remainingCount === 1 ? 'compromisso' : 'compromissos'}
                </div>
              )}
            </div>
          ) : null}

          {data && data.totalOverdue > 0 && !isNoPermScenario && !isErrorScenario && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Atenção: você possui {data.totalOverdue}{' '}
                  {data.totalOverdue === 1 ? 'compromisso atrasado' : 'compromissos atrasados'}.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenAgenda('atrasados')}
                className="font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950"
              >
                Ver compromissos pendentes
              </button>
            </div>
          )}

          <p className="text-center text-xs italic text-slate-500">
            Desejamos a você um excelente dia de trabalho!
          </p>

          <div className="space-y-2.5 pt-1">
            {data?.canAccessAgenda && !isErrorScenario && !isNoPermScenario ? (
              <button
                ref={primaryBtnRef}
                type="button"
                onClick={() => onOpenAgenda()}
                className="w-full rounded-full bg-[#111827] px-5 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Ver minha agenda
              </button>
            ) : (
              <button
                ref={primaryBtnRef}
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#111827] px-5 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Continuar para o FIORIX
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
