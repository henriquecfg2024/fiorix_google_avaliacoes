"use client";

import React from "react";
import { Shield, CheckCircle2, Eye, UserCheck, X, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  colaboradorNome: string;
  email: string;
  dataCiencia: string;
  comprovanteHash: string;
  ipMascarado: string;
  scrollPercent: number;
}

interface ComunicadoAuditModalProps {
  comunicadoTitulo: string;
  totalDestinatarios: number;
  totalViews: number;
  totalCiencias: number;
  auditorias: AuditEntry[];
  onClose: () => void;
}

export function ComunicadoAuditModal({
  comunicadoTitulo,
  totalDestinatarios,
  totalViews,
  totalCiencias,
  auditorias,
  onClose,
}: ComunicadoAuditModalProps) {
  const taxaCiencia = Math.round((totalCiencias / (totalDestinatarios || 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#0d0d16] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141F]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Trilha de Auditoria & Ciências
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  IMUTÁVEL
                </span>
              </h2>
              <p className="text-xs text-white/50 truncate max-w-lg">{comunicadoTitulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs Resumo */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-[#080A12] border-b border-white/5">
          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase">Taxa de Adesão</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">{taxaCiencia}%</span>
              <span className="text-xs text-white/60">{totalCiencias}/{totalDestinatarios}</span>
            </div>
          </div>

          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase">Visualizações</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-400">{totalViews}</span>
              <span className="text-xs text-white/60">registradas</span>
            </div>
          </div>

          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase">Hashes Validados</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{totalCiencias}</span>
              <span className="text-xs text-emerald-400/70">100% íntegros</span>
            </div>
          </div>
        </div>

        {/* Tabela de Trilha de Ciências */}
        <div className="flex-1 overflow-auto p-6 bg-[#05050a]">
          <h4 className="text-xs font-bold text-white/70 uppercase mb-3">Registros de Ciência ({auditorias.length})</h4>
          <div className="border border-white/5 rounded-xl overflow-hidden bg-[#101019]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Data e Hora</th>
                  <th className="px-4 py-3">IP Registrado</th>
                  <th className="px-4 py-3">Scroll</th>
                  <th className="px-4 py-3">Hash SHA-256 da Ciência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {auditorias.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{item.colaboradorNome}</div>
                      <div className="text-[10px] text-white/40">{item.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/70">{item.dataCiencia}</td>
                    <td className="px-4 py-3 font-mono text-white/50">{item.ipMascarado}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-mono font-semibold">{item.scrollPercent}%</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400 text-[10px]">
                      {item.comprovanteHash.substring(0, 16)}...{item.comprovanteHash.substring(item.comprovanteHash.length - 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0d0d16] border-t border-white/10 flex justify-end">
          <Button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
