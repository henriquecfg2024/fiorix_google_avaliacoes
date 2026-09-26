"use client";

import React from "react";
import { X, History, User } from "lucide-react";
import { EscalaItem } from "@/lib/ferias/ferias-repository";

interface HistoricoFeriasModalProps {
  open: boolean;
  onClose: () => void;
  colaborador?: EscalaItem | null;
}

export function HistoricoFeriasModal({ open, onClose, colaborador }: HistoricoFeriasModalProps) {
  if (!open || !colaborador) return null;

  const historico = colaborador.historico || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/12 bg-white dark:bg-[#0c101c] p-6 shadow-2xl text-white space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Histórico de Férias • {colaborador.nome}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Setor: {colaborador.setor} • Escala Anual {colaborador.ano}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {historico.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              Nenhuma alteração registrada até o momento.
            </p>
          ) : (
            historico.map((h, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-indigo-400">{h.data}</span>
                  <span className="text-[10px] bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/8">
                    {h.por}
                  </span>
                </div>
                <div className="text-xs text-white">
                  <span className="text-slate-400">Período: </span>
                  <span className="font-medium">{h.para}</span>
                  {h.de && h.de !== "N/A" && (
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      (Anterior: {h.de})
                    </span>
                  )}
                </div>
                {h.motivo && (
                  <p className="text-[11px] text-slate-400 italic">
                    Motivo: {h.motivo}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/8">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
