"use client";

import React from "react";
import { Clock, Calendar, CheckCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface FeriasEvento {
  id: string;
  data: string | Date;
  tipo: "criacao" | "alteracao" | "confirmacao";
  titulo: string;
  autorNome: string;
  detalhes?: string;
}

interface FeriasTimelineProps {
  eventos: FeriasEvento[];
}

export function FeriasTimeline({ eventos }: FeriasTimelineProps) {
  if (!eventos || eventos.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-[#101019] border border-white/5 text-center text-xs text-white/40">
        Nenhum evento registrado no histórico.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
      {eventos.map((ev, idx) => {
        const isConfirmado = ev.tipo === "confirmacao";
        const isAlterado = ev.tipo === "alteracao";

        return (
          <div key={ev.id || idx} className="relative group">
            {/* Dot Indicator */}
            <div
              className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d0d16] ${
                isConfirmado
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  : isAlterado
                  ? "bg-amber-400"
                  : "bg-cyan-400"
              }`}
            />

            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white/50 font-mono">
                  {(() => {
                    if (!ev.data) return "";
                    if (typeof ev.data === "string" && ev.data.includes("/")) {
                      return ev.data;
                    }
                    try {
                      const d = typeof ev.data === "string" ? new Date(ev.data) : ev.data;
                      if (!isNaN(d.getTime())) {
                        return format(d, "dd/MM/yyyy", { locale: ptBR });
                      }
                    } catch (e) {
                      // fallback
                    }
                    return String(ev.data);
                  })()}
                </span>
                <span className="font-bold text-white">{ev.titulo}</span>
              </div>
              <p className="text-[11px] text-white/60 mt-0.5">
                {ev.autorNome}
              </p>
              {ev.detalhes && (
                <p className="text-[11px] text-white/40 mt-1 bg-[#101019] p-2 rounded border border-white/5 font-mono">
                  {ev.detalhes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
