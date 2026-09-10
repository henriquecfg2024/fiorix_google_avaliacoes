'use client';

import React from 'react';
import { X, Shield, BookOpen, Lightbulb } from 'lucide-react';

interface AlertaResponsavelTecnicoProps {
  codigo?: string;
  onDismiss: () => void;
}

export function AlertaResponsavelTecnico({ onDismiss }: AlertaResponsavelTecnicoProps) {
  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-r from-[#FFD000] via-[#FFC000] to-[#FFAA00] p-5 sm:p-6 shadow-[0_12px_32px_-4px_rgba(245,158,11,0.35)] border border-[#FFD000]/40 transition-all duration-300">
      
      {/* Botão Fechar (X) no Canto Superior Direito */}
      <button
        onClick={onDismiss}
        className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors cursor-pointer"
        title="Fechar alerta"
      >
        <X className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Grid Principal: Esquerda/Centro + Bloco Importante */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-8 pr-6 sm:pr-8">
        
        {/* Lado Esquerdo: Ícone + Conteúdo Principal */}
        <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
          {/* Círculo Preto com Exclamação Amarela */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0E1626] flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-[#FFD000] font-black text-2xl sm:text-3xl leading-none select-none">!</span>
          </div>

          <div className="space-y-3 flex-1 min-w-0">
            {/* Título */}
            <h2 className="text-xl sm:text-2xl font-black text-[#0A0A0A] tracking-tight leading-none">
              Atenção:
            </h2>

            {/* Badge com Escudo */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0E1626] text-white text-xs sm:text-[12.5px] font-bold tracking-wide border border-black/20 shadow-xs">
                <Shield className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                <span>Responsabilidade Técnica Ativa</span>
              </span>
            </div>

            {/* Mensagem com palavras destacadas */}
            <p className="text-[14px] sm:text-[15px] text-[#0A0A0A] leading-relaxed max-w-2xl font-normal">
              Mantenha esta Instrução de Trabalho <strong className="font-bold text-black">atualizada, revisada e em conformidade</strong> com os procedimentos vigentes do cartório.
            </p>

            {/* Botão Entendi com Ícone de Livro */}
            <div className="pt-1">
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#0A0A0A] hover:bg-[#0E1626] hover:text-white font-bold text-sm shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
              >
                <BookOpen className="w-4 h-4 stroke-[2.2]" />
                <span>Entendi</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito: Bloco "Importante" com Lâmpada */}
        <div className="w-full lg:w-[320px] lg:border-l lg:border-black/10 lg:pl-6 flex-shrink-0">
          <div className="rounded-2xl bg-white/45 border border-amber-300/40 p-4 sm:p-4.5 backdrop-blur-xs shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FFD54F] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Lightbulb className="w-4 h-4 text-[#0A0A0A] stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-[#0A0A0A] text-sm sm:text-[15px]">
                Importante
              </h3>
            </div>
            <p className="text-xs sm:text-[12.5px] text-[#1C1A17] leading-relaxed font-normal">
              A versão vigente deste documento está sob sua responsabilidade e deve refletir o procedimento efetivamente adotado pelo seu setor.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
