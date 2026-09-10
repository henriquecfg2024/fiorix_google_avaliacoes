'use client';

import React from 'react';
import { X } from 'lucide-react';

interface AlertaResponsavelTecnicoProps {
  codigo?: string;
  onDismiss: () => void;
}

export function AlertaResponsavelTecnico({ codigo = 'IT-PREP-001', onDismiss }: AlertaResponsavelTecnicoProps) {
  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-r from-[#FFD000] via-[#FFB800] to-[#FFA000] p-5 sm:p-6 shadow-[0_12px_32px_-4px_rgba(245,158,11,0.35)] border border-[#FFD000]/40 transition-all duration-300">
      <div className="flex items-start gap-4 sm:gap-5 pr-8">
        {/* Ícone Círculo Preto com Exclamação Amarela */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-[#FFD000] font-black text-2xl leading-none select-none">!</span>
        </div>

        {/* Conteúdo do Alerta */}
        <div className="flex-1 min-w-0">
          {/* Linha de Título + Badge */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
            <h2 className="text-base sm:text-[18px] font-extrabold text-[#0A0A0A] flex items-center gap-2 tracking-tight">
              <span>⚠️</span>
              <span>Atenção, Responsável Técnico!</span>
            </h2>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111827] text-white text-xs sm:text-[12px] font-bold tracking-wide border border-black/20 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Responsabilidade Técnica Ativa</span>
            </span>
          </div>

          {/* Mensagem Institucional Legível */}
          <p className="text-[13.5px] sm:text-[15px] font-medium text-[#0A0A0A] mt-2 leading-relaxed max-w-4xl">
            Sua Instrução de Trabalho <strong className="font-bold text-black underline decoration-[#111827]/30 underline-offset-2">{codigo}</strong> deve ser mantida sempre atualizada. Você é o responsável técnico oficial pela conformidade deste procedimento perante o cartório.
          </p>

          {/* Ações: Botão Entendi + Microtexto */}
          <div className="mt-4 flex items-center gap-3.5">
            <button
              onClick={onDismiss}
              className="px-5 py-2 rounded-full bg-white text-[#0A0A0A] hover:bg-[#111827] hover:text-white font-bold text-xs sm:text-[13px] shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.97]"
            >
              Entendi
            </button>
            <span className="text-xs sm:text-[13px] text-[#0A0A0A]/80 font-medium select-none">
              Dispensável nesta sessão
            </span>
          </div>
        </div>
      </div>

      {/* Botão Fechar (X) no Canto Superior Direito */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors cursor-pointer"
        title="Fechar alerta"
      >
        <X className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}
