"use client";

import React from "react";
import { Shield, X, Download, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AuditEntry {
  id: string;
  colaboradorNome: string;
  setor?: string;
  email: string;
  visualizou?: boolean;
  dataCiencia: string;
  comprovanteHash?: string;
  ipMascarado: string;
  scrollPercent?: number;
  qrLink?: string;
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
  const destinatariosValidos = totalDestinatarios > 0 ? totalDestinatarios : auditorias.length;
  const taxaCiencia =
    destinatariosValidos > 0
      ? Math.min(100, Math.round((totalCiencias / destinatariosValidos) * 100))
      : 0;

  const handleExportCsv = () => {
    const headers = "Nome,Setor,Email,Visualizou,Data e Hora da Ciencia,IP Registrado\n";
    const rows = auditorias
      .map(
        (a) =>
          `"${(a.colaboradorNome || "").replace(/"/g, '""')}","${(a.setor || "Geral").replace(/"/g, '""')}","${(a.email || "").replace(/"/g, '""')}","${a.visualizou ? "Sim" : "Não"}","${a.dataCiencia || "Pendente"}","${a.ipMascarado || "—"}"`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `auditoria_comunicado_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d0d18] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-[#12141F]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                Trilha de Auditoria &amp; Provas de Ciência
              </h2>
              <p className="text-xs text-white/60 truncate max-w-xl">{comunicadoTitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-[#080A12] border-b border-slate-200 dark:border-white/5">
          <div className="p-4 bg-[#101019] rounded-xl border border-slate-200 dark:border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              Taxa de Adesão &amp; Ciência
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">{taxaCiencia}%</span>
              <span className="text-xs text-white/60 font-semibold">
                {totalCiencias} / {destinatariosValidos}{" "}
                {destinatariosValidos === 1 ? "colaborador" : "colaboradores"}
              </span>
            </div>
            <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-cyan-400 h-full transition-all" style={{ width: `${taxaCiencia}%` }} />
            </div>
          </div>

          <div className="p-4 bg-[#101019] rounded-xl border border-slate-200 dark:border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              Visualizações Registradas
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-400">{totalViews}</span>
              <span className="text-xs text-white/60 font-semibold">
                {totalViews === 1 ? "acesso nominal" : "acessos nominais"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5">
              Colaboradores que visualizaram este comunicado ({Math.max(0, destinatariosValidos - totalCiencias)} pendentes de ciência)
            </p>
          </div>
        </div>

        {/* Tabela de Trilha de Ciências */}
        <div className="flex-1 overflow-auto p-6 bg-[#05050a] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">
              Registros Detalhados por Colaborador ({auditorias.length}{" "}
              {auditorias.length === 1 ? "usuário monitorado" : "usuários monitorados"})
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs h-8 rounded-xl gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Auditoria (CSV)</span>
            </Button>
          </div>

          <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-[#101019]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="px-4 py-3">Colaborador / Setor</th>
                  <th className="px-4 py-3">Visualizou</th>
                  <th className="px-4 py-3">Data e Hora da Ciência</th>
                  <th className="px-4 py-3 text-right">IP Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {auditorias.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">
                      Nenhum colaborador vinculado a este comunicado.
                    </td>
                  </tr>
                ) : (
                  auditorias.map((item) => {
                    const confirmou = Boolean(item.dataCiencia && item.dataCiencia !== "Pendente");
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{item.colaboradorNome}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.setor || "Geral"} • {item.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.visualizou ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              ✓ SIM
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                              NÃO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {confirmou ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{item.dataCiencia}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-300/80">
                              <Clock className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                              <span>Pendente</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-white/50 text-right">
                          {item.ipMascarado || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0d0d18] border-t border-slate-200 dark:border-white/10 flex items-center justify-end">
          <Button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl"
          >
            Fechar Painel
          </Button>
        </div>
      </div>
    </div>
  );
}
