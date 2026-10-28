'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export interface OrigemCampoUI {
  campo: string;
  pagina: number;
  trecho: string;
  confianca: 'alta' | 'media' | 'baixa' | 'ausente' | string;
}

interface ConfidenceReviewProps {
  idExtracao?: string;
  campos: OrigemCampoUI[];
  requerente?: string;
  onVerPagina?: (pagina: number) => void;
}

const NOMES: Record<string, string> = {
  vara: 'Vara de Origem',
  requerente: 'Requerente / Autor',
  imovel: 'Imóvel Usucapiendo',
  rua_olhar_confrontacao: 'Rua p/ Confrontação',
  contribuinte_sql: 'SQL / IPTU',
  matricula_transcricao: 'Matrícula / Transcrição',
  cartorio_origem: 'Cartório de Origem',
  titular_origem: 'Titular Tabular de Origem',
};

export function ConfidenceReview({ campos, onVerPagina }: ConfidenceReviewProps) {
  const [colapsado, setColapsado] = useState(false);

  if (!campos || campos.length === 0) return null;

  const cont = { alta: 0, media: 0, baixa: 0 };
  campos.forEach(c => {
    if (c.confianca === 'alta') cont.alta++;
    else if (c.confianca === 'media') cont.media++;
    else cont.baixa++;
  });

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-5 sm:p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60 shadow-sm shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base xl:text-lg font-bold text-white">
              Conferência de Origem e Nível de Confiança
            </h4>
            <p className="text-xs sm:text-sm text-slate-300">
              {campos.length} campos mapeados automaticamente no texto do PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cont.alta > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-emerald-300 border border-emerald-500/50">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {cont.alta} Alta
            </span>
          )}
          {cont.media > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-amber-300 border border-amber-500/50">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {cont.media} Média
            </span>
          )}
          {cont.baixa > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold text-rose-300 border border-rose-500/50">
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {cont.baixa} Baixa
            </span>
          )}

          <button
            type="button"
            onClick={() => setColapsado(!colapsado)}
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-100 hover:bg-slate-700 transition"
          >
            {colapsado ? (
              <>
                <ChevronDown className="h-4 w-4" />
                Expandir
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
                Recolher
              </>
            )}
          </button>
        </div>
      </div>

      {!colapsado && (
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {campos.map((c, i) => {
            const label = NOMES[c.campo] || c.campo;
            const isAlta = c.confianca === 'alta';
            const isMedia = c.confianca === 'media';

            return (
              <div
                key={i}
                className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-950 p-4 sm:p-5 shadow-md hover:border-cyan-500/60 transition group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-slate-100 text-xs sm:text-sm truncate group-hover:text-cyan-300 transition">
                      {label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 sm:px-2.5 py-0.5 font-bold text-[10px] sm:text-xs uppercase tracking-wider ${
                        isAlta
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isMedia
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {c.confianca}
                    </span>
                  </div>

                  {c.trecho ? (
                    <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 my-1">
                      <p className="line-clamp-4 text-slate-200 font-mono text-[11px] sm:text-xs leading-relaxed select-text">
                        "{c.trecho}"
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-2.5 sm:p-3 my-1">
                      <p className="text-slate-500 italic text-[11px] sm:text-xs">Nenhum trecho associado</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-cyan-300 font-mono font-medium border border-slate-800">
                    Página {c.pagina > 0 ? c.pagina : '—'}
                  </span>
                  {c.pagina > 0 && onVerPagina && (
                    <button
                      type="button"
                      onClick={() => onVerPagina(c.pagina)}
                      className="text-cyan-400 font-semibold hover:underline"
                    >
                      Ver página
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
