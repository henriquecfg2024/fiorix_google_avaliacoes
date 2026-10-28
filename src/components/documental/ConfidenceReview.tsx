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
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">
              Conferência de Origem e Nível de Confiança
            </h4>
            <p className="text-xs text-slate-400">
              {campos.length} campos mapeados automaticamente no texto do PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cont.alta > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/70 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-800/50">
              <CheckCircle2 className="h-3 w-3" />
              {cont.alta} Alta
            </span>
          )}
          {cont.media > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/70 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-800/50">
              <AlertTriangle className="h-3 w-3" />
              {cont.media} Média
            </span>
          )}
          {cont.baixa > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-950/70 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-800/50">
              <AlertCircle className="h-3 w-3" />
              {cont.baixa} Baixa
            </span>
          )}

          <button
            type="button"
            onClick={() => setColapsado(!colapsado)}
            className="ml-2 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 transition"
          >
            {colapsado ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Expandir
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Recolher
              </>
            )}
          </button>
        </div>
      </div>

      {!colapsado && (
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {campos.map((c, i) => {
            const label = NOMES[c.campo] || c.campo;
            const isAlta = c.confianca === 'alta';
            const isMedia = c.confianca === 'media';

            return (
              <div
                key={i}
                className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-semibold text-slate-200 truncate">{label}</span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 font-medium ${
                        isAlta
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                          : isMedia
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                      }`}
                    >
                      {c.confianca}
                    </span>
                  </div>

                  {c.trecho ? (
                    <p className="line-clamp-2 text-slate-400 italic font-mono text-[11px] bg-slate-900/80 p-1.5 rounded border border-slate-800/60">
                      "{c.trecho}"
                    </p>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">Nenhum trecho associado</p>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Página {c.pagina > 0 ? c.pagina : 'não especificada'}</span>
                  {c.pagina > 0 && onVerPagina && (
                    <button
                      type="button"
                      onClick={() => onVerPagina(c.pagina)}
                      className="text-cyan-400 hover:underline"
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
