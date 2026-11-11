'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  DadosManifestacaoSegurancaInput,
  enriquecerEValidarOrigemCampos,
  OrigemCampoSegurancaUI,
} from '@/lib/documental/securityValidators';

export interface OrigemCampoUI {
  campo: string;
  pagina: number;
  trecho: string;
  confianca: 'alta' | 'media' | 'baixa' | 'ausente' | string;
  valorExtraido?: string;
  verificacaoSeguranca?: string;
  regraMatematicaOk?: boolean;
  ruidoDescartado?: boolean;
  origemVerificacao?: string;
}

interface ConfidenceReviewProps {
  idExtracao?: string;
  campos: OrigemCampoUI[];
  requerente?: string;
  dados?: DadosManifestacaoSegurancaInput;
  onVerPagina?: (pagina: number) => void;
}

const NOMES: Record<string, string> = {
  numero_processo: 'Processo Judicial (CNJ)',
  vara: 'Vara / Juízo de Origem',
  requerente: 'Requerente / Autor(a)',
  imovel: 'Imóvel Usucapiendo',
  rua_olhar_confrontacao: 'Logradouro de Frente (Confrontação)',
  contribuinte_sql: 'SQL / IPTU (Cadastro PMSP)',
  matricula_transcricao: 'Matrícula / Transcrição (LV2)',
  cartorio_origem: 'Cartório de Origem',
  titular_origem: 'Titular Tabular de Origem',
};

export function ConfidenceReview({ campos, requerente, dados, onVerPagina }: ConfidenceReviewProps) {
  const [colapsado, setColapsado] = useState(false);

  const camposValidados = useMemo<OrigemCampoSegurancaUI[]>(() => {
    if (dados) {
      return enriquecerEValidarOrigemCampos(campos, dados);
    }
    if (!campos || campos.length === 0) return [];
    return enriquecerEValidarOrigemCampos(campos, { requerente });
  }, [campos, dados, requerente]);

  if (!camposValidados || camposValidados.length === 0) return null;

  const cont = { alta: 0, media: 0, baixa: 0, ruidosInterceptados: 0, regrasMatematicas: 0 };
  camposValidados.forEach(c => {
    if (c.confianca === 'alta') cont.alta++;
    else if (c.confianca === 'media') cont.media++;
    else cont.baixa++;
    if (c.ruidoDescartado) cont.ruidosInterceptados++;
    if (c.regraMatematicaOk) cont.regrasMatematicas++;
  });

  return (
    <div className="rounded-2xl border border-slate-700/90 bg-slate-900/95 p-4 sm:p-5 shadow-xl space-y-4">
      {/* Cabeçalho da Conferência de Origem e Segurança */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60 shadow-sm shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-white">
                Conferência de Origem, Cruzamento e Nível de Confiança
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                <ShieldCheck className="h-3 w-3 text-cyan-400" />
                Auditoria Cruzada Ativa
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {camposValidados.length} campos auditados com validação matemática (CNJ Mod-97 / SQL Mod-11), acervo LV2/SETORES e filtro anti-timbre e-SAJ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {cont.alta > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/50">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {cont.alta} Alta
            </span>
          )}
          {cont.media > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/50">
              <AlertTriangle className="h-3.5 w-3.5" />
              {cont.media} Média
            </span>
          )}
          {cont.baixa > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-500/50">
              <AlertCircle className="h-3.5 w-3.5" />
              {cont.baixa} Baixa
            </span>
          )}

          <button
            type="button"
            onClick={() => setColapsado(!colapsado)}
            className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition cursor-pointer"
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

      {/* Barra de Blindagem Contra Ruído de Cabeçalho/Rodapé */}
      {cont.ruidosInterceptados > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-3.5 py-2.5 text-xs text-cyan-200">
          <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Blindagem Anti-Ruído Institucional:</strong>{' '}
            {cont.ruidosInterceptados}{' '}
            {cont.ruidosInterceptados === 1
              ? 'trecho contaminado por carimbo lateral/rodapé do e-SAJ ou timbre institucional (ex.: Av. Liberdade 32 / www.tjsp.jus.br) foi interceptado e substituído'
              : 'trechos contaminados por carimbos laterais/rodapés do e-SAJ ou timbres institucionais foram interceptados e substituídos'}{' '}
            pela validação cruzada oficial do processo.
          </div>
        </div>
      )}

      {!colapsado && (
        <div className="grid grid-cols-1 gap-3">
          {camposValidados.map((c, i) => {
            const label = c.rotulo || NOMES[c.campo] || c.campo;
            const isAlta = c.confianca === 'alta';
            const isMedia = c.confianca === 'media';

            return (
              <div
                key={`${c.campo}-${i}`}
                className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-950/95 p-3.5 sm:p-4 shadow-md hover:border-cyan-500/50 transition space-y-2.5"
              >
                {/* Linha 1: Nome do Campo + Selo de Confiança + Página */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-cyan-400 shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] text-cyan-300 font-mono font-medium border border-slate-800">
                      Página {c.pagina > 0 ? c.pagina : '—'}
                    </span>
                    {c.pagina > 0 && onVerPagina && (
                      <button
                        type="button"
                        onClick={() => onVerPagina(c.pagina)}
                        className="text-xs text-cyan-400 font-semibold hover:underline cursor-pointer"
                      >
                        Ver página
                      </button>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold text-[10px] sm:text-xs uppercase tracking-wider ${
                        isAlta
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isMedia
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {c.confianca === 'alta' ? 'ALTA' : c.confianca === 'media' ? 'MÉDIA' : 'BAIXA'}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Valor Extraído e Validado no Formulário */}
                {c.valorExtraido && (
                  <div className="rounded-lg bg-slate-900/70 border border-slate-800/80 px-3 py-2 text-xs">
                    <span className="text-slate-400 font-medium">Valor no formulário: </span>
                    <span className="font-semibold text-white break-words">{c.valorExtraido}</span>
                  </div>
                )}

                {/* Linha 3: Trecho / Evidência Documental */}
                {c.trecho ? (
                  <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Evidência / Trecho Mapeado
                    </div>
                    <p className="text-slate-200 font-mono text-xs leading-relaxed break-words select-text">
                      &ldquo;{c.trecho}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2">
                    <p className="text-slate-500 italic text-xs">Nenhum trecho textual associado a este campo</p>
                  </div>
                )}

                {/* Linha 4: Parecer de Segurança / Regra Matemática */}
                {c.verificacaoSeguranca && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <ShieldCheck
                        className={`h-3.5 w-3.5 shrink-0 ${
                          c.regraMatematicaOk ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      />
                      <span>{c.verificacaoSeguranca}</span>
                    </div>
                    {c.origemVerificacao && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Fonte: {c.origemVerificacao}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
