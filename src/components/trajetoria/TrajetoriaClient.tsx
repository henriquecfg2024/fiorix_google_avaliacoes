'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MapPin, Search, X, RotateCcw, Check, AlertCircle,
  FileText, Clock, Loader2, Info, AlertTriangle, Copy,
  User, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import type { TrajetoriaData } from '@/lib/trajetoria/engine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'sem registro de horário';
  try {
    const d = new Date(iso);
    const dt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dt} às ${hr}`;
  } catch { return '—'; }
}

// ─── Trajectory map (Dinâmico e Reativo) ──────────────────────────────────────

const SETORES_COORDS: { num: number; x: number; y: number }[] = [
  { num: 1,  x: 9.19,  y: 23.48 }, // Entrada
  { num: 2,  x: 25.64, y: 23.08 }, // Digitalização
  { num: 3,  x: 41.37, y: 22.67 }, // Contraditório
  { num: 4,  x: 57.30, y: 23.08 }, // Extrato
  { num: 5,  x: 73.65, y: 22.67 }, // Qualificação
  { num: 6,  x: 91.42, y: 23.08 }, // Pré-Cálculo
  { num: 7,  x: 91.22, y: 76.92 }, // Registro
  { num: 8,  x: 68.74, y: 77.73 }, // Devolução
  { num: 9,  x: 49.64, y: 77.73 }, // Impressão Matrícula
  { num: 10, x: 30.54, y: 76.52 }, // Preparação
  { num: 11, x: 9.81,  y: 76.92 }, // Saída
];

function TrajetoriaMap({ data }: { data: TrajetoriaData }) {
  const ultimoSetorTexto = data.ultimoSetorNum > 0
    ? `Último setor identificado: ${data.ultimoSetorLabel}`
    : 'Sem evidência de localização';

  return (
    <div
      className="relative overflow-hidden rounded-[24px] border border-white/12 w-full shadow-[0_20px_60px_rgba(0,0,0,0.3)] select-none"
      style={{
        backgroundImage: "url('/trajetoria-salas-clean.jpg')",
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        aspectRatio: '979 / 247',
      }}
      role="img"
      aria-label={`Trajetória do título ${data.protocolo} pelos 11 setores do Cartório — ${ultimoSetorTexto}`}
    >
      {SETORES_COORDS.map(({ num, x, y }) => {
        const setor = data.setores.find(s => s.num === num);
        const status = setor?.status ?? (num === data.ultimoSetorNum ? 'ATUAL' : num < data.ultimoSetorNum ? 'PERCORRIDO' : 'FUTURO');

        // ── 1. SETOR ATUAL ──
        if (status === 'ATUAL') {
          // Caso específico: Setor 8 (Devolução atual)
          if (num === 8) {
            return (
              <div
                key={num}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-full
                  bg-gradient-to-br from-amber-600 to-amber-700 text-white font-black text-xs sm:text-sm md:text-base
                  border-2 border-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.95),inset_0_0_8px_rgba(255,255,255,0.4)]
                  flex items-center justify-center z-20 cursor-default"
                title="Setor 8: Devolução — Último setor identificado (Título Devolvido)"
              >
                <span>{num}</span>
                <span className="absolute -inset-1 rounded-full border-2 border-amber-400/60 animate-ping opacity-35 pointer-events-none" />
                <span className="absolute -right-1 -bottom-1 w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full bg-amber-500 border border-amber-200 flex items-center justify-center text-slate-950 shadow-sm">
                  <RotateCcw className="w-2 h-2 sm:w-2.5 sm:h-2.5" strokeWidth={3.5} />
                </span>
              </div>
            );
          }

          // Caso padrão: Setor atual em azul
          return (
            <div
              key={num}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-full
                bg-gradient-to-br from-blue-600 to-blue-700 text-white font-black text-xs sm:text-sm md:text-base
                border-2 border-cyan-400 shadow-[0_0_24px_rgba(59,130,246,0.95),inset_0_0_8px_rgba(255,255,255,0.4)]
                flex items-center justify-center z-20 cursor-default"
              title={`Setor ${num} — ${setor?.label || 'Identificado'} (Último setor identificado)`}
            >
              <span>{num}</span>
              <span className="absolute -inset-1 rounded-full border-2 border-cyan-400/60 animate-ping opacity-30 pointer-events-none" />
            </div>
          );
        }

        // ── 2. SETOR PERCORRIDO ──
        if (status === 'PERCORRIDO') {
          // Caso específico: Setor 8 (Devolução percorrida)
          if (num === 8) {
            return (
              <div
                key={num}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full
                  bg-[#2b1704] text-amber-200 font-black text-xs sm:text-sm md:text-base
                  border-2 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.85)]
                  flex items-center justify-center z-10 cursor-default"
                title="Setor 8: Devolução — Percorrido (Título Devolvido)"
              >
                <span>{num}</span>
                <span className="absolute -right-1 -bottom-1 w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full bg-amber-500 border border-amber-200 flex items-center justify-center text-slate-950 shadow-sm">
                  <RotateCcw className="w-2 h-2 sm:w-2.5 sm:h-2.5" strokeWidth={3.5} />
                </span>
              </div>
            );
          }

          // Caso específico: Setor 7 (Registro percorrido)
          if (num === 7) {
            return (
              <div
                key={num}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full
                  bg-[#032e22] text-emerald-200 font-black text-xs sm:text-sm md:text-base
                  border-2 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.85)]
                  flex items-center justify-center z-10 cursor-default"
                title="Setor 7: Registro — Percorrido (Título Registrado)"
              >
                <span>{num}</span>
                <span className="absolute -right-1 -bottom-1 w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full bg-emerald-500 border border-emerald-300 flex items-center justify-center text-white shadow-sm">
                  <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5" strokeWidth={3.5} />
                </span>
              </div>
            );
          }

          // Demais setores comuns percorridos (1..6, 9, 10, 11)
          return (
            <div
              key={num}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full
                bg-[#04281f] text-white font-black text-xs sm:text-sm md:text-base
                border-2 border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.7)]
                flex items-center justify-center z-10 cursor-default"
              title={`Setor ${num} — ${setor?.label || ''} (Percorrido)`}
            >
              <span>{num}</span>
              <span className="absolute -right-1 -bottom-1 w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 rounded-full bg-emerald-500 border border-emerald-300 flex items-center justify-center text-white shadow-sm">
                <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5" strokeWidth={3.5} />
              </span>
            </div>
          );
        }

        // ── 3. SETOR NÃO APLICÁVEL AO FLUXO (DESVIADO) ──
        if (status === 'NAO_APLICAVEL') {
          const motivoDesvio = data.desfecho === 'REGISTRADO'
            ? 'Título seguiu fluxo de Registro'
            : 'Título seguiu fluxo de Devolução';

          return (
            <div
              key={num}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full
                bg-[#080c16]/75 text-slate-500 font-bold text-xs sm:text-sm md:text-base
                border border-dashed border-slate-600/50 shadow-inner opacity-40 hover:opacity-80 transition-opacity
                flex items-center justify-center z-10 cursor-default"
              title={`Setor ${num} — ${setor?.label || ''} (Não aplicável: ${motivoDesvio})`}
            >
              <span>{num}</span>
            </div>
          );
        }

        // ── 4. PRÓXIMA ETAPA (FUTURO) ──
        return (
          <div
            key={num}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full
              bg-[#0d131f]/95 text-white/70 font-extrabold text-xs sm:text-sm md:text-base
              border border-slate-500/70 shadow-inner
              flex items-center justify-center z-10 cursor-default"
            title={`Setor ${num} — ${setor?.label || ''} (Próxima etapa)`}
          >
            <span>{num}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Protocol summary strip ───────────────────────────────────────────────────

function ProtocoloStrip({ data }: { data: TrajetoriaData }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(String(data.protocolo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusColor =
    data.ultimoSetorNum === 0
      ? 'bg-white/10 text-white/50'
      : data.ultimoSetorNum === 11
      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
      : 'bg-blue-500/15 text-blue-400 border border-blue-500/25';

  return (
    <div className="rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
        {/* Protocolo */}
        <div className="flex flex-col justify-between gap-2 sm:pr-4">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Protocolo
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-black text-white tracking-tight">
              {data.protocolo}
            </span>
            {data.tipo && (
              <span className="text-[9px] font-black uppercase tracking-wider
                bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                {data.tipo}
              </span>
            )}

            {/* Badge de Desfecho Cartorial (Registrado / Devolvido) */}
            {data.desfecho === 'REGISTRADO' && (
              <span className="text-[9px] font-black uppercase tracking-wider
                bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                Registrado
              </span>
            )}
            {data.desfecho === 'DEVOLVIDO' && (
              <span className="text-[9px] font-black uppercase tracking-wider
                bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <RotateCcw className="w-2.5 h-2.5" strokeWidth={3} />
                Devolvido {data.dtDevolucao ? `(${fmtDate(data.dtDevolucao)})` : ''}
              </span>
            )}
            {data.dtRetirada && (
              <span className="text-[9px] font-black uppercase tracking-wider
                bg-sky-500/20 text-sky-300 border border-sky-400/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                Retirado ({fmtDate(data.dtRetirada)})
              </span>
            )}

            <button
              onClick={handleCopy}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Copiar protocolo"
            >
              <Copy className="w-2.5 h-2.5" />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          {data.desfecho === 'DEVOLVIDO' ? (
            data.dtRetirada ? (
              <span className="text-[10px] font-bold text-sky-400 inline-flex items-center gap-1 mt-0.5">
                <Check className="w-2.5 h-2.5" />
                Título entregue e retirado no balcão
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 inline-flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                Disponível para retirada no balcão
              </span>
            )
          ) : (
            <span className="text-[10px] font-bold text-emerald-400 inline-flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              Prazo Legal: No Prazo
            </span>
          )}
        </div>

        {/* Último setor identificado */}
        <div className="flex flex-col justify-between gap-2 pt-3 sm:pt-0 sm:px-4">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Último Setor Identificado
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap my-auto">
            <span className="text-base font-black text-white leading-tight">
              {data.ultimoSetorNum > 0 ? data.ultimoSetorLabel : 'Sem evidência'}
            </span>
            {data.ultimoSetorNum > 0 && (
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                {data.ultimoSetorNum === 11 ? 'Concluído' : 'Em andamento'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/40">
            {data.ultimoSetorNum > 0 ? `Setor oficial ${data.ultimoSetorNum}` : 'Aguardando registro'}
          </p>
        </div>

        {/* Evidência */}
        <div className="flex flex-col justify-between gap-2 pt-3 sm:pt-0 sm:px-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Evidência
            </span>
          </div>
          <p className="text-sm font-semibold text-white/90 leading-tight my-auto">
            {data.ultimoSetorEvidencia
              ? `Evidência em ${fmtDateTime(data.ultimoSetorEvidencia)}`
              : 'Localização comprovada sem registro de horário'}
          </p>
          <p className="text-[10px] text-white/40">
            Rastreabilidade WORM e carimbo de data/hora
          </p>
        </div>

        {/* Natureza */}
        <div className="flex flex-col justify-between gap-2 pt-3 sm:pt-0 sm:pl-4">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Natureza
            </span>
          </div>
          <p className="text-sm font-bold text-white leading-tight truncate my-auto" title={data.natureza}>
            {data.natureza}
          </p>
          {data.dataEntrada ? (
            <p className="text-[10px] text-white/40">
              Entrada em {fmtDateTime(data.dataEntrada)}
            </p>
          ) : (
            <p className="text-[10px] text-white/40">Entrada formal no protocolo</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/50 pt-1">
      {/* Título Registrado */}
      <div className="flex items-center gap-1.5" title="Setor 7 — Registro efetuado">
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-emerald-300 flex items-center justify-center text-white text-[8px] shadow-[0_0_8px_rgba(16,185,129,0.5)]">
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
        <span className="font-semibold text-emerald-400">Título Registrado (Setor 7)</span>
      </div>

      {/* Título Devolvido */}
      <div className="flex items-center gap-1.5" title="Setor 8 — Devolução por nota devolutiva / exigência">
        <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-amber-300 flex items-center justify-center text-slate-950 text-[8px] shadow-[0_0_8px_rgba(245,158,11,0.5)]">
          <RotateCcw className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
        <span className="font-semibold text-amber-400">Título Devolvido (Setor 8)</span>
      </div>

      {/* Setor percorrido */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-emerald-500/60 border border-emerald-400/60 flex items-center justify-center text-white text-[8px]">
          <Check className="w-2 h-2" strokeWidth={3} />
        </span>
        <span>Setor percorrido</span>
      </div>

      {/* Último setor identificado */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-blue-500 border border-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        <span className="text-white/70">Último setor identificado</span>
      </div>

      {/* Não aplicável ao fluxo */}
      <div className="flex items-center gap-1.5" title="Etapa não percorrida conforme o desfecho do título (Registro ou Devolução)">
        <span className="w-3 h-3 rounded-full bg-slate-800/60 border border-dashed border-slate-500/60 opacity-60" />
        <span className="text-white/40">Não aplicável ao fluxo</span>
      </div>

      {/* Próxima etapa */}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-[#0d131f] border border-slate-600" />
        <span className="text-white/40">Próxima etapa</span>
      </div>

      {/* Info helper */}
      <div className="flex items-center gap-1.5 ml-auto text-white/30 hidden xl:flex">
        <Info className="w-3 h-3" />
        <span>Baseado na última evidência disponível no sistema</span>
      </div>
    </div>
  );
}

// ─── Immediate Location Response (Missão 4.3.7) ──────────────────────────────

const NOMES_SETORES_OFICIAIS: Record<number, string> = {
  1: 'Entrada',
  2: 'Digitalização',
  3: 'Contraditório',
  4: 'Extrato',
  5: 'Qualificação',
  6: 'Pré-Cálculo',
  7: 'Registro',
  8: 'Devolução',
  9: 'Impressão Matrícula',
  10: 'Preparação',
  11: 'Saída',
};

function RespostaImediataLocalizacao({ data }: { data: TrajetoriaData }) {
  const isIdentificado = data.ultimoSetorNum >= 1 && data.ultimoSetorNum <= 11;
  const nomeSetor = isIdentificado
    ? NOMES_SETORES_OFICIAIS[data.ultimoSetorNum]
    : null;

  // Tratamento de destaque para títulos Devolvidos
  if (data.desfecho === 'DEVOLVIDO') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 sm:p-6 rounded-[24px]
          bg-gradient-to-r from-amber-950/45 via-[#0B1020]/90 to-[#0B1020]/75
          border border-amber-500/35 shadow-[0_20px_60px_rgba(245,158,11,0.15)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-slate-950 font-black shrink-0 shadow-lg shadow-amber-600/30">
            <RotateCcw className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400/90 block">
              STATUS CARTORIAL:
            </span>
            <span className="text-2xl font-black text-amber-300 tracking-tight uppercase block leading-tight">
              {data.dtRetirada ? 'TÍTULO DEVOLVIDO E RETIRADO' : 'TÍTULO DEVOLVIDO'}
            </span>
          </div>
        </div>

        <div className="hidden lg:block h-10 w-px bg-white/10 mx-2" />
        <p className="text-xs text-white/70 leading-relaxed max-w-md">
          {data.dtRetirada
            ? `Devolução formalizada em ${fmtDate(data.dtDevolucao)} e retirada no balcão em ${fmtDate(data.dtRetirada)}.`
            : `Devolução formalizada em ${fmtDate(data.dtDevolucao)}. O documento está disponível no balcão para retirada.`}
        </p>

        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-950/40 border border-amber-500/25 text-white/90 shrink-0 md:ml-auto shadow-sm">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-left leading-tight">
            <p className="text-xs font-bold text-white">
              {data.dtRetirada ? 'Retirado na Saída (Setor 11)' : 'Aguardando no Balcão (Setor 8)'}
            </p>
            <p className="text-[10px] text-white/50">Consulte o percurso completo abaixo.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isIdentificado && nomeSetor) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 sm:p-6 rounded-[24px]
          bg-gradient-to-r from-blue-950/45 via-[#0B1020]/90 to-[#0B1020]/75
          border border-blue-500/35 shadow-[0_20px_60px_rgba(59,130,246,0.15)] backdrop-blur-xl"
      >
        {/* Left: Ícone azul + Título + Departamento */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/30">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400/90 block">
              SEU TÍTULO ESTÁ EM:
            </span>
            <span className="text-2xl font-black text-sky-400 tracking-tight uppercase block leading-tight">
              {nomeSetor}
            </span>
          </div>
        </div>

        {/* Middle: Divisor vertical + Subtexto defensivo */}
        <div className="hidden lg:block h-10 w-px bg-white/10 mx-2" />
        <p className="text-xs text-white/60 leading-relaxed max-w-md">
          Última localização conhecida com base nas evidências disponíveis no sistema.
        </p>

        {/* Right: Info pill com convite para mapa */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-950/40 border border-blue-500/25 text-white/90 shrink-0 md:ml-auto shadow-sm">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="text-left leading-tight">
            <p className="text-xs font-bold text-white">Consulte a trajetória abaixo</p>
            <p className="text-[10px] text-white/50">para visualizar o percurso completo.</p>
          </div>
        </div>
      </div>
    );
  }

  // Estado sem evidência
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 sm:p-6 rounded-[24px]
        bg-[#0B1020]/72 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/40 shrink-0">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 block">
            LOCALIZAÇÃO NÃO IDENTIFICADA
          </span>
          <span className="text-lg font-bold text-white/80 tracking-tight block leading-tight">
            Nenhum departamento confirmado
          </span>
        </div>
      </div>

      <p className="text-xs text-white/50 leading-relaxed max-w-md">
        Não há evidência suficiente para identificar a localização atual do título.
      </p>

      <span className="text-[11px] font-medium text-white/40 px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/8 shrink-0 md:ml-auto">
        Sem evidência no sistema
      </span>
    </div>
  );
}

// ─── Histórico de Tarefas & Setores Percorridos ───────────────────────────────

function HistoricoTarefas({ tarefas }: { tarefas?: TrajetoriaData['tarefas'] }) {
  const [expandido, setExpandido] = useState(true);

  // Consolidação de tarefas repetidas para a mesma etapa/nome:
  // Se houver tarefas com o mesmo nome para a mesma etapa (uma em aberto e outra finalizada),
  // exibe apenas a tarefa consolidada mais recente (Finalizada), evitando itens repetidos no quadro.
  const tarefasExibidas = useMemo(() => {
    if (!tarefas || tarefas.length === 0) return [];

    const grupos = new Map<string, NonNullable<TrajetoriaData['tarefas']>>();
    for (const t of tarefas) {
      if (!t.tarefa) continue;
      const key = t.tarefa.trim().toUpperCase();
      const list = grupos.get(key) ?? [];
      list.push(t);
      grupos.set(key, list);
    }

    const isFinalizada = (sit?: string) => {
      const s = (sit || '').toUpperCase();
      return s === 'FINALIZADA' || s === 'CONCLUÍDA' || s === 'CONCLUIDA';
    };

    const getTimestamp = (d?: string | null) => (d ? new Date(d).getTime() : 0);

    const res: NonNullable<TrajetoriaData['tarefas']> = [];
    for (const [, grupo] of grupos.entries()) {
      if (grupo.length === 1) {
        res.push(grupo[0]);
        continue;
      }
      const finalizadas = grupo.filter(t => isFinalizada(t.situacao));
      const emAberto = grupo.filter(t => !isFinalizada(t.situacao));

      if (finalizadas.length > 0) {
        finalizadas.sort((a, b) => getTimestamp(b.data) - getTimestamp(a.data));
        res.push(finalizadas[0]);
      } else {
        emAberto.sort((a, b) => getTimestamp(b.data) - getTimestamp(a.data));
        res.push(emAberto[0]);
      }
    }

    return res.sort((a, b) => getTimestamp(a.data) - getTimestamp(b.data));
  }, [tarefas]);

  if (!tarefasExibidas || tarefasExibidas.length === 0) return null;

  return (
    <div className="mt-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] overflow-hidden transition-all">
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/12 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Evidências & Tarefas Cartoriais ({tarefasExibidas.length})
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Trilha de execução e carimbos de auditoria</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/50 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8">
          <span>{expandido ? 'Ocultar detalhes' : 'Ver todas'}</span>
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expandido && (
        <div className="p-5 pt-0 border-t border-white/8 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
            {tarefasExibidas.map((t, idx) => (
              <div
                key={idx}
                className="group rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/8 hover:border-white/15 p-4 flex flex-col justify-between gap-3 transition-all duration-200 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-white leading-tight truncate group-hover:text-white" title={t.tarefa}>
                    {t.tarefa}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      t.situacao === 'FINALIZADA'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {t.situacao}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-white/60">
                  {t.setorNum && (
                    <div className="flex items-center gap-1.5 text-sky-400 font-medium">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{NOMES_SETORES_OFICIAIS[t.setorNum]} (Setor {t.setorNum})</span>
                    </div>
                  )}
                  {t.responsavel && (
                    <div className="flex items-center gap-1.5 text-white/50">
                      <User className="w-3 h-3 shrink-0 text-white/30" />
                      <span className="truncate">{t.responsavel}</span>
                    </div>
                  )}
                  {t.data && (
                    <div className="flex items-center gap-1.5 text-white/40">
                      <Clock className="w-3 h-3 shrink-0 text-white/30" />
                      <span>{fmtDateTime(t.data)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

interface TrajetoriaClientProps {
  initialProtocolo?: string;
}

export function TrajetoriaClient({ initialProtocolo }: TrajetoriaClientProps) {
  const [inputValue, setInputValue]   = useState(initialProtocolo ?? '');
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<TrajetoriaData | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [recentes, setRecentes]       = useState<string[]>([]);
  const inputRef                      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fiorix_recent_protocolos');
      if (saved) {
        setRecentes(JSON.parse(saved));
      } else {
        setRecentes(['642967', '642910', '641882', '640551', '639204']);
      }
    } catch {
      setRecentes(['642967', '642910', '641882', '640551', '639204']);
    }
  }, []);

  const salvarRecente = useCallback((proto: string) => {
    setRecentes((prev) => {
      const filtered = prev.filter((p) => p !== proto);
      const next = [proto, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('fiorix_recent_protocolos', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const fetchTrajetoria = useCallback(async (proto: string) => {
    const trimmed = proto.trim();
    if (!trimmed) return;
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num <= 0) {
      setError('Informe um número de protocolo válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/trajetoria/${num}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao consultar protocolo.');
      setData(json.data as TrajetoriaData);
      salvarRecente(String(num));

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('p', String(num));
        window.history.replaceState(null, '', url.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar protocolo.');
    } finally {
      setLoading(false);
    }
  }, [salvarRecente]);

  useEffect(() => {
    if (initialProtocolo && initialProtocolo.trim()) {
      fetchTrajetoria(initialProtocolo);
    }
  }, [initialProtocolo, fetchTrajetoria]);

  const handleConsultar = useCallback(() => {
    fetchTrajetoria(inputValue);
  }, [inputValue, fetchTrajetoria]);

  const handleLimpar = useCallback(() => {
    setInputValue('');
    setData(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleConsultar();
    },
    [handleConsultar]
  );

  return (
    <div className="space-y-6">
      {/* ── Search bar ── */}
      <div
        className="rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] flex flex-col sm:flex-row gap-3 items-center"
      >
        <div className="relative flex-1 w-full">
          <label htmlFor="protocolo-input" className="sr-only">
            Número do protocolo
          </label>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="protocolo-input"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Número do protocolo"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/[0.04] border border-white/10
              text-white placeholder-white/30 text-sm font-semibold
              focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40
              disabled:opacity-50 transition-all"
          />
          {inputValue && !loading && (
            <button
              onClick={() => setInputValue('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2
                text-white/30 hover:text-white/70 transition-colors cursor-pointer"
              aria-label="Limpar campo"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          id="btn-consultar"
          onClick={handleConsultar}
          disabled={loading || !inputValue.trim()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-6 rounded-xl
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:brightness-95
            text-white text-sm font-bold
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 cursor-pointer"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Search className="w-4 h-4" />}
          Consultar
        </button>

        <button
          id="btn-limpar"
          onClick={handleLimpar}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 h-11 px-5 rounded-xl
            border border-white/12 bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white
            text-sm font-semibold disabled:opacity-40 transition-all duration-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpar
        </button>
      </div>

      {/* Recentes sugeridos */}
      {recentes.length > 0 && (
        <div className="flex items-center gap-2 text-xs -mt-3 px-1 overflow-x-auto">
          <span className="text-white/40 text-[11px] font-semibold shrink-0">Recentes:</span>
          {recentes.map((p) => (
            <button
              key={p}
              onClick={() => {
                setInputValue(p);
                fetchTrajetoria(p);
              }}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                inputValue === p
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/35 shadow-sm'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/8 hover:border-white/15'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-xl
          bg-red-500/8 border border-red-500/20 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{error}</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              Verifique o número e tente novamente.
            </p>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-64 rounded-xl bg-white/[0.04]" />
        </div>
      )}

      {/* ── Results ── */}
      {!loading && data && (
        <div className="space-y-5">
          {/* Protocol summary strip */}
          <ProtocoloStrip data={data} />

          {/* Reingresso — indicador compacto contextual */}
          {data.temReingresso && (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider
                  text-amber-300 bg-amber-500/15 border border-amber-500/25
                  rounded-full px-3 py-1 cursor-default shadow-sm"
                title="A trajetória exibida representa a última fase ativa do título. Ciclos anteriores não são exibidos nesta visão."
                aria-label="Reingresso identificado. A trajetória representa a última fase ativa do título."
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M10 6A4 4 0 0 1 2.34 8.5M2 6a4 4 0 0 1 7.66-2.5M10 10V7H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Reingresso identificado
              </span>
            </div>
          )}

          {/* Resposta Imediata de Localização (Missão 4.3.7) */}
          <RespostaImediataLocalizacao data={data} />

          {/* Trajectory section */}
          <div className="space-y-4 pt-1">
            {/* Section header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl
                  bg-blue-500/12 border border-blue-500/25 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white tracking-wide uppercase">
                    Trajetória do Título
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Acompanhe a última localização conhecida do título no Cartório.
                  </p>
                </div>
              </div>
              {data.ultimoSetorNum === 0 && (
                <span className="flex items-center gap-1.5 text-[11px] text-amber-400/80
                  bg-amber-500/8 border border-amber-500/20 rounded-lg px-2.5 py-1.5 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  Sem evidência de localização
                </span>
              )}
            </div>

            {/* The map */}
            <TrajetoriaMap data={data} />

            {/* Legend */}
            <Legenda />

            {/* Histórico & Evidências Cartoriais */}
            <HistoricoTarefas tarefas={data.tarefas} />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-16
          rounded-xl border border-dashed border-white/[0.08] text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08]
            flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white/20" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/30">
              Informe o número do protocolo para iniciar a consulta
            </p>
            <p className="text-xs text-white/20 mt-1">
              A trajetória será exibida com base nas evidências disponíveis no sistema.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
