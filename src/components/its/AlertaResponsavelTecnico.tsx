'use client';

import React from 'react';
import { AlertTriangle, Plus, X, Clock, CheckCircle2, FileEdit, AlertCircle } from 'lucide-react';

export type EstadoAlertaIt = 'preventivo' | 'proximo_vencimento' | 'vencido' | 'em_analise' | 'atualizada';

export interface AlertaResponsavelTecnicoProps {
  codigo?: string;
  titulo?: string;
  descricao?: string;
  dataUltimaRevisao?: string | null;
  estado?: EstadoAlertaIt;
  podeCriarNovaVersao?: boolean;
  onCriarNovaVersao?: () => void;
  onDismiss?: () => void;
}

interface EstiloConfig {
  containerBg: string;
  borderColor: string;
  borderLeftColor: string;
  textColor: string;
  titleColor: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  dismissColor: string;
  iconLabel: string;
}

const ESTILOS_POR_ESTADO: Record<EstadoAlertaIt, EstiloConfig> = {
  preventivo: {
    containerBg: '#FDE68A',
    borderColor: '#F59E0B40',
    borderLeftColor: '#D97706',
    textColor: '#1C1917',
    titleColor: '#1C1917',
    iconBg: '#D97706',
    iconColor: '#FFFFFF',
    badgeBg: '#FEF3C7',
    badgeText: '#78350F',
    badgeBorder: '#F59E0B60',
    buttonBg: '#292524',
    buttonHover: 'hover:bg-[#1C1917]',
    buttonText: '#FFFFFF',
    dismissColor: '#78350F',
    iconLabel: 'Aviso preventivo de atualização de instrução de trabalho',
  },
  proximo_vencimento: {
    containerBg: '#FCD34D',
    borderColor: '#D9770650',
    borderLeftColor: '#B45309',
    textColor: '#1C1917',
    titleColor: '#1C1917',
    iconBg: '#B45309',
    iconColor: '#FFFFFF',
    badgeBg: '#FEF3C7',
    badgeText: '#78350F',
    badgeBorder: '#D9770660',
    buttonBg: '#292524',
    buttonHover: 'hover:bg-[#1C1917]',
    buttonText: '#FFFFFF',
    dismissColor: '#78350F',
    iconLabel: 'Aviso de revisão próxima do vencimento',
  },
  vencido: {
    containerBg: '#FEE2E2',
    borderColor: '#EF444450',
    borderLeftColor: '#DC2626',
    textColor: '#450A0A',
    titleColor: '#7F1D1D',
    iconBg: '#DC2626',
    iconColor: '#FFFFFF',
    badgeBg: '#FEF2F2',
    badgeText: '#991B1B',
    badgeBorder: '#EF444460',
    buttonBg: '#991B1B',
    buttonHover: 'hover:bg-[#7F1D1D]',
    buttonText: '#FFFFFF',
    dismissColor: '#991B1B',
    iconLabel: 'Aviso de revisão vencida',
  },
  em_analise: {
    containerBg: '#DBEAFE',
    borderColor: '#3B82F650',
    borderLeftColor: '#2563EB',
    textColor: '#1E293B',
    titleColor: '#1E3A8A',
    iconBg: '#2563EB',
    iconColor: '#FFFFFF',
    badgeBg: '#EFF6FF',
    badgeText: '#1E40AF',
    badgeBorder: '#3B82F660',
    buttonBg: '#1E40AF',
    buttonHover: 'hover:bg-[#1E3A8A]',
    buttonText: '#FFFFFF',
    dismissColor: '#1E40AF',
    iconLabel: 'Atualização de instrução em análise ou elaboração',
  },
  atualizada: {
    containerBg: '#D1FAE5',
    borderColor: '#10B98150',
    borderLeftColor: '#059669',
    textColor: '#064E3B',
    titleColor: '#064E3B',
    iconBg: '#059669',
    iconColor: '#FFFFFF',
    badgeBg: '#ECFDF5',
    badgeText: '#065F46',
    badgeBorder: '#10B98160',
    buttonBg: '#065F46',
    buttonHover: 'hover:bg-[#064E3B]',
    buttonText: '#FFFFFF',
    dismissColor: '#065F46',
    iconLabel: 'Instrução de trabalho atualizada e em conformidade',
  },
};

export function AlertaResponsavelTecnico({
  codigo,
  titulo = 'Mantenha sua Instrução de Trabalho atualizada',
  descricao = 'Revise esta IT sempre que houver mudança nas atividades, procedimentos, sistemas ou na forma de execução do trabalho.',
  dataUltimaRevisao,
  estado = 'preventivo',
  podeCriarNovaVersao = false,
  onCriarNovaVersao,
  onDismiss,
}: AlertaResponsavelTecnicoProps) {
  const estilo = ESTILOS_POR_ESTADO[estado] || ESTILOS_POR_ESTADO.preventivo;

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="relative w-full rounded-[12px] p-4 sm:p-5 shadow-sm transition-all duration-200 motion-reduce:transition-none"
      style={{
        backgroundColor: estilo.containerBg,
        borderColor: estilo.borderColor,
        borderLeftWidth: '6px',
        borderLeftColor: estilo.borderLeftColor,
        borderStyle: 'solid',
        borderWidth: '1px 1px 1px 6px',
      }}
    >
      {/* Botão fechar (X) opcional */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 p-1 rounded-lg transition-colors cursor-pointer hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
          style={{ color: estilo.dismissColor }}
          title="Fechar lembrete"
          aria-label="Fechar lembrete"
        >
          <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-5 pr-6 sm:pr-8">
        
        {/* Lado Esquerdo: Área 1 (Identificação) + Área 2 (Principal) */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          
          {/* 1. Área de Identificação: Bloco âmbar escuro com ícone de atenção */}
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5"
            style={{
              backgroundColor: estilo.iconBg,
              color: estilo.iconColor,
            }}
            role="img"
            aria-label={estilo.iconLabel}
          >
            {estado === 'em_analise' ? (
              <FileEdit className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            ) : estado === 'atualizada' ? (
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            ) : estado === 'vencido' ? (
              <AlertCircle className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            )}
            <span className="sr-only">{estilo.iconLabel}</span>
          </div>

          {/* 2. Área Principal: Título e Descrição */}
          <div className="space-y-1 flex-1 min-w-0">
            <h2
              className="text-sm sm:text-base font-bold tracking-tight leading-snug"
              style={{ color: estilo.titleColor }}
            >
              {titulo}
            </h2>
            <p
              className="text-xs sm:text-[13px] leading-relaxed font-normal"
              style={{ color: estilo.textColor }}
            >
              {descricao}
            </p>
          </div>
        </div>

        {/* 3. Área de Ação: Data da última revisão + Botão Criar nova versão */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 shrink-0">
          
          {/* Etiqueta discreta da última revisão */}
          {dataUltimaRevisao && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 select-none shadow-2xs self-start sm:self-auto"
              style={{
                backgroundColor: estilo.badgeBg,
                color: estilo.badgeText,
                borderColor: estilo.badgeBorder,
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
              <span>Última revisão: {dataUltimaRevisao}</span>
            </div>
          )}

          {/* Botão de Ação Principal: "Criar nova versão" */}
          {podeCriarNovaVersao && onCriarNovaVersao && (
            <button
              type="button"
              onClick={onCriarNovaVersao}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold shadow-xs transition-colors cursor-pointer select-none active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transition-none ${estilo.buttonHover}`}
              style={{
                backgroundColor: estilo.buttonBg,
                color: estilo.buttonText,
              }}
              title={codigo ? `Criar nova versão para ${codigo}` : 'Criar nova versão desta IT'}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>Criar nova versão</span>
            </button>
          )}
        </div>

      </div>
    </aside>
  );
}
