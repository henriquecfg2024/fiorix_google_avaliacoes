"use client";

import React, { useState } from "react";
import { FileText, Eye, Printer, Download, Lock, ShieldCheck, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";

export default function HoleritesPage() {
  const [selectedHolerite, setSelectedHolerite] = useState<{ mes: string; id: string } | null>(null);
  const [searchYear, setSearchYear] = useState("2026");

  const holerites = [
    { id: "1", mes: "08/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.420,15", hash: "f3a9c2e1d0b83e42aa881b9...", dataUpload: "28/08/2026" },
    { id: "2", mes: "07/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.420,15", hash: "a1b2c3d4e5f67a89bc012d3...", dataUpload: "28/07/2026" },
    { id: "3", mes: "06/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.380,40", hash: "9f8e7d6c5b4a3f2e1d0c9b8...", dataUpload: "28/06/2026" },
    { id: "4", mes: "05/2026", bruto: "R$ 6.500,00", liquido: "R$ 5.150,00", hash: "1a2b3c4d5e6f7a8b9c0d1e2...", dataUpload: "28/05/2026" },
    { id: "5", mes: "04/2026", bruto: "R$ 6.500,00", liquido: "R$ 5.150,00", hash: "3e4f5a6b7c8d9e0f1a2b3c4...", dataUpload: "28/04/2026" },
  ];

  return (
    <div className="flex-1 w-full bg-[#05050a] min-h-[calc(100vh-56px)] text-white pb-16">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#080A12]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              MEUS HOLERITES & COMPROVANTES
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Documento pessoal de acesso restrito. Em conformidade com o Art. 464 da CLT e LGPD.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-white/80 text-xs">
              Solicitar Relatório LGPD
            </Button>
            <Button variant="outline" size="sm" className="border-white/10 text-white/80 text-xs">
              Solicitar Exclusão
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 space-y-6">
        {/* Banner LGPD */}
        <div className="p-4 bg-[#0d0d16] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Acesso Pessoal Protegido & Auditado</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Cada visualização ou impressão gera registro imutável com carimbo de tempo e IP do usuário.
              </p>
            </div>
          </div>
          <span className="text-xs text-white/40 font-mono">DPO: dpo@7risp.com.br</span>
        </div>

        {/* Tabela de Holerites */}
        <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white/70 uppercase">Histórico de Competências ({searchYear})</h3>
            <div className="flex items-center gap-2">
              <select
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="bg-[#12141F] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5"
              >
                <option value="2026">Ano 2026</option>
                <option value="2025">Ano 2025</option>
              </select>
            </div>
          </div>

          <div className="border border-white/5 rounded-xl overflow-hidden bg-[#101019]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Mês / Ano</th>
                  <th className="px-4 py-3">Valor Bruto</th>
                  <th className="px-4 py-3">Valor Líquido</th>
                  <th className="px-4 py-3">Hash SHA-256</th>
                  <th className="px-4 py-3">Data Disponibilização</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {holerites.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>{h.mes}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">{h.bruto}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">{h.liquido}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400 text-[10px]">{h.hash}</td>
                    <td className="px-4 py-3 text-white/50 font-mono text-[11px]">{h.dataUpload}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedHolerite({ mes: h.mes, id: h.id })}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3 gap-1.5 font-bold rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizar PDF</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedHolerite && (
        <SecurePDFViewer
          documentTitle={`Holerite - Competência ${selectedHolerite.mes}`}
          documentType="holerite"
          documentId={selectedHolerite.id}
          fileUrl={`/api/holerites/${selectedHolerite.id}/download?mes=${encodeURIComponent(selectedHolerite.mes)}`}
          userName="Henrique Gama"
          allowDownload={true}
          onClose={() => setSelectedHolerite(null)}
        />
      )}
    </div>
  );
}
