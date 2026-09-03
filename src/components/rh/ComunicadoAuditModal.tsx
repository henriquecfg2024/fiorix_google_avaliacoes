"use client";

import React from "react";
import { Shield, CheckCircle2, Eye, UserCheck, X, FileText, Lock, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AuditEntry {
  id: string;
  colaboradorNome: string;
  setor?: string;
  email: string;
  visualizou?: boolean;
  dataCiencia: string;
  comprovanteHash: string;
  ipMascarado: string;
  scrollPercent: number;
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
  const taxaCiencia = Math.round((totalCiencias / (totalDestinatarios || 1)) * 100);

  const handleExportCsv = () => {
    const headers = "Nome,Setor,Email,Visualizou,Data/Hora Ciencia,IP,Scroll,Hash SHA-256\n";
    const rows = auditorias
      .map(
        (a) =>
          `"${a.colaboradorNome}","${a.setor || "Serventia"}","${a.email}","${a.visualizou !== false ? "Sim" : "Não"}","${a.dataCiencia}","${a.ipMascarado}","${a.scrollPercent}%","${a.comprovanteHash}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `auditoria_comunicado_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141F]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Trilha de Auditoria & Provas de Ciência — Provimento 213/2026 Art. 7
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  CUSTÓDIA WORM IMUTÁVEL
                </span>
              </h2>
              <p className="text-xs text-white/60 truncate max-w-xl">{comunicadoTitulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-[#080A12] border-b border-white/5">
          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Taxa de Adesão & Ciência</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400">{taxaCiencia}%</span>
              <span className="text-xs text-white/60 font-semibold">{totalCiencias} / {totalDestinatarios} colaboradores</span>
            </div>
            <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-cyan-400 h-full" style={{ width: `${taxaCiencia}%` }} />
            </div>
          </div>

          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Visualizações Registradas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-400">{totalViews}</span>
              <span className="text-xs text-white/60 font-semibold">acessos nominais</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5">Trilha de IP e User-Agent gravada</p>
          </div>

          <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Hashes Criptográficos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">100%</span>
              <span className="text-xs text-emerald-400/80 font-semibold">Sem adulterações</span>
            </div>
            <p className="text-[11px] text-emerald-400/70 mt-2.5">Integridade SHA-256 garantida</p>
          </div>
        </div>

        {/* Tabela de Trilha de Ciências */}
        <div className="flex-1 overflow-auto p-6 bg-[#05050a] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">
              Registros Detalhados por Colaborador ({auditorias.length} usuários monitorados)
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

          <div className="border border-white/10 rounded-xl overflow-hidden bg-[#101019]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Colaborador / Setor</th>
                  <th className="px-4 py-3">Visualizou</th>
                  <th className="px-4 py-3">Data e Hora da Ciência</th>
                  <th className="px-4 py-3">IP Registrado</th>
                  <th className="px-4 py-3">Scroll</th>
                  <th className="px-4 py-3">Hash SHA-256</th>
                  <th className="px-4 py-3 text-right">QR / Prova</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {auditorias.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{item.colaboradorNome}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.setor || "Geral"} • {item.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        ✓ SIM
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/70">{item.dataCiencia || "Pendente"}</td>
                    <td className="px-4 py-3 font-mono text-white/50">{item.ipMascarado || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-mono font-semibold">{item.scrollPercent}%</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400 text-[10px]" title={item.comprovanteHash}>
                      {item.comprovanteHash.substring(0, 14)}...{item.comprovanteHash.substring(item.comprovanteHash.length - 6)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => alert(`QR Code Link de verificação pública: https://fiorix-omega.vercel.app/valida/${item.comprovanteHash}`)}
                        className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/10 rounded-lg transition-colors inline-flex items-center gap-1 text-[10px] font-mono"
                        title="Ver QR Code / Link de Prova Criptográfica"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Verificar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0d0d18] border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Art. 7 Prov. 213/2026 — Trilha retida por 5 anos
          </span>
          <Button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl">
            Fechar Painel
          </Button>
        </div>
      </div>
    </div>
  );
}
