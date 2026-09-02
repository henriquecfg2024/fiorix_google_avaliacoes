"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, Eye, Printer, Download, Lock, ShieldCheck, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";

export default function HoleritesPage() {
  const [selectedHolerite, setSelectedHolerite] = useState<{ mes: string; id: string } | null>(null);
  const [searchYear, setSearchYear] = useState("2026");
  const [lgpdFeedback, setLgpdFeedback] = useState<string | null>(null);

  const handleSolicitarLgpd = (tipo: "relatorio" | "exclusao") => {
    const protocolo = `LGPD-${Date.now().toString().slice(-6)}`;
    setLgpdFeedback(
      tipo === "relatorio"
        ? `Protocolo ${protocolo}: Sua solicitação de relatório de titularidade foi enviada ao DPO (dpo@7risp.com.br).`
        : `Protocolo ${protocolo}: Sua solicitação de exclusão/anonimização foi registrada para análise jurídica e regulatória do DPO.`
    );
    setTimeout(() => setLgpdFeedback(null), 8000);
  };

  const holerites = [
    { id: "1", mes: "08/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.420,15", hash: "f3a9c2e1d0b83e42aa881b9...", dataUpload: "28/08/2026" },
    { id: "2", mes: "07/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.420,15", hash: "a1b2c3d4e5f67a89bc012d3...", dataUpload: "28/07/2026" },
    { id: "3", mes: "06/2026", bruto: "R$ 6.840,00", liquido: "R$ 5.380,40", hash: "9f8e7d6c5b4a3f2e1d0c9b8...", dataUpload: "28/06/2026" },
    { id: "4", mes: "05/2026", bruto: "R$ 6.500,00", liquido: "R$ 5.150,00", hash: "1a2b3c4d5e6f7a8b9c0d1e2...", dataUpload: "28/05/2026" },
    { id: "5", mes: "04/2026", bruto: "R$ 6.500,00", liquido: "R$ 5.150,00", hash: "3e4f5a6b7c8d9e0f1a2b3c4...", dataUpload: "28/04/2026" },
  ];

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden pb-12">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/12 via-indigo-500/10 to-purple-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span className="text-slate-600">/</span>
              <Link href="/pessoas" className="hover:text-white transition-colors">Pessoas</Link>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-semibold">Holerites</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                MEUS HOLERITES E COMPROVANTES
              </h1>
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                ART. 464 CLT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Documento pessoal de acesso restrito e auditado com proteção de dados LGPD.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSolicitarLgpd("relatorio")}
              className="border-white/10 text-slate-200 hover:bg-white/10 text-xs rounded-xl cursor-pointer"
            >
              Solicitar Relatório LGPD
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSolicitarLgpd("exclusao")}
              className="border-white/10 text-slate-200 hover:bg-white/10 text-xs rounded-xl cursor-pointer"
            >
              Solicitar Exclusão
            </Button>
          </div>
        </div>

        {/* Feedback LGPD Temporário */}
        {lgpdFeedback && (
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{lgpdFeedback}</span>
          </div>
        )}

        {/* Banner LGPD */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Acesso Pessoal Protegido & Auditado</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada visualização ou impressão é registrada na trilha de auditoria.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-white/[0.04] px-3 py-1 rounded-full border border-white/8">DPO: dpo@7risp.com.br</span>
        </div>

        {/* Tabela de Holerites */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Competências ({searchYear})</h3>
            <div className="flex items-center gap-2">
              <select
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="bg-white/[0.04] border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="2026" className="bg-[#0B1020] text-white">Ano 2026</option>
                <option value="2025" className="bg-[#0B1020] text-white">Ano 2025</option>
              </select>
            </div>
          </div>

          <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#070A12]/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
                <tr>
                  <th className="px-5 py-3.5">Mês / Ano</th>
                  <th className="px-5 py-3.5">Valor Bruto</th>
                  <th className="px-5 py-3.5">Valor Líquido</th>
                  <th className="px-5 py-3.5">Hash SHA-256</th>
                  <th className="px-5 py-3.5">Data Disponibilização</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-slate-200">
                {holerites.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>{h.mes}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">{h.bruto}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-400">{h.liquido}</td>
                    <td className="px-5 py-3.5 font-mono text-cyan-300 text-[10px]">{h.hash}</td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">{h.dataUpload}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedHolerite({ mes: h.mes, id: h.id })}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3.5 gap-1.5 font-bold rounded-xl shadow-md shadow-indigo-500/20"
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
