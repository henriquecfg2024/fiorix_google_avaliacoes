'use client';

import React from 'react';
import { X } from 'lucide-react';

interface AlertaResponsavelTecnicoProps {
  codigo?: string;
  onDismiss: () => void;
}

export function AlertaResponsavelTecnico({ codigo = 'IT-PREP-001', onDismiss }: AlertaResponsavelTecnicoProps) {
  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-r from-[#FFD000] via-[#FFB800] to-[#FFA000] p-4 sm:p-5 shadow-[0_12px_32px_-4px_rgba(245,158,11,0.35)] border border-[#FFD000]/40 transition-all duration-300">
      <div className="flex items-start gap-3.5 sm:gap-4 pr-7">
        {/* Ícone Círculo Preto com Exclamação Amarela */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-[#FFD000] font-black text-xl leading-none select-none">!</span>
        </div>

        {/* Conteúdo do Alerta */}
        <div className="flex-1 min-w-0">
          {/* Linha de Título + Badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-sm sm:text-[15px] font-bold text-[#111827] flex items-center gap-1.5 tracking-tight">
              <span>⚠️</span>
              <span>Atenção, Responsável Técnico!</span>
            </h2>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#111827] text-white text-[10px] sm:text-[11px] font-bold tracking-wide border border-black/15 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Responsabilidade Técnica Ativa</span>
            </span>
          </div>

          {/* Mensagem Institucional */}
          <p className="text-xs sm:text-[13px] text-[#111827]/90 mt-1.5 leading-relaxed max-w-4xl">
            Sua Instrução de Trabalho <strong className="font-bold text-black">{codigo}</strong> deve ser mantida sempre atualizada. Você é o responsável técnico oficial pela conformidade deste procedimento perante o cartório.
          </p>

          {/* Ações: Botão Entendi + Microtexto */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onDismiss}
              className="px-4 py-1.5 rounded-full bg-white text-[#111827] hover:bg-[#111827] hover:text-white font-bold text-xs shadow-xs transition-all duration-200 cursor-pointer select-none active:scale-[0.97]"
            >
              Entendi
            </button>
            <span className="text-[11px] text-[#111827]/75 font-medium select-none">
              Dispensável nesta sessão
            </span>
          </div>
        </div>
      </div>

      {/* Botão Fechar (X) no Canto Superior Direito */}
      <button
        onClick={onDismiss}
        className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-7 h-7 rounded-full flex items-center justify-center text-[#111827]/70 hover:text-[#111827] hover:bg-black/10 transition-colors cursor-pointer"
        title="Fechar alerta"
      >
        <X className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
