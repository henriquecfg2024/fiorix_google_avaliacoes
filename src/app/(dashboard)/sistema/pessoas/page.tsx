"use client";

import React, { useState } from "react";
import {
  Users,
  FileText,
  Briefcase,
  Shield,
  Plus,
  Search,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoleriteUploader } from "@/components/rh/HoleriteUploader";
import { CLT135Validator } from "@/components/rh/CLT135Validator";
import { ComunicadoAuditModal } from "@/components/rh/ComunicadoAuditModal";

export default function PainelRHPage() {
  const [currentTab, setCurrentTab] = useState<"comunicados" | "holerites" | "ferias">("comunicados");
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);

  // Form states para Novo Comunicado
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoPrioridade, setNovoPrioridade] = useState("NORMAL");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [publicando, setPublicando] = useState(false);

  const comunicadosRH = [
    {
      id: "com-1",
      titulo: "Alteração de Horário - Plantão de Fim de Ano",
      data: "30/08/2026 09:00",
      autor: "Maria Silva (RH)",
      destinatarios: "Todos (45 colaboradores)",
      views: 40,
      ciencias: 32,
      total: 45,
      status: "PUBLICADO",
    },
    {
      id: "com-2",
      titulo: "Nova Política de Atendimento - Prov. 213/2026",
      data: "28/08/2026 14:30",
      autor: "Henrique Gama (Admin)",
      destinatarios: "Escreventes (28 colaboradores)",
      views: 28,
      ciencias: 26,
      total: 28,
      status: "PUBLICADO",
    },
    {
      id: "com-3",
      titulo: "Campanha Setembro Amarelo - Saúde Mental",
      data: "27/08/2026 10:15",
      autor: "RH (Bem Estar)",
      destinatarios: "Todos (45 colaboradores)",
      views: 35,
      ciencias: 18,
      total: 45,
      status: "PUBLICADO",
    },
  ];

  const handlePublicar = async () => {
    if (!novoTitulo || !novoConteudo) {
      alert("Preencha o título e o conteúdo");
      return;
    }

    setPublicando(true);
    try {
      const res = await fetch("/api/comunicados/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novoTitulo,
          prioridade: novoPrioridade,
          conteudo: novoConteudo,
          destinatarios: ["TODOS"],
          exigeCiencia: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Comunicado publicado com integridade SHA-256 gravada!");
        setNovoModalOpen(false);
        setNovoTitulo("");
        setNovoConteudo("");
      } else {
        alert(data.error || "Erro ao publicar.");
      }
    } catch (err) {
      alert("Falha na comunicação com o servidor.");
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#05050a] min-h-[calc(100vh-56px)] text-white pb-16">
      {/* Top Header */}
      <div className="border-b border-white/5 bg-[#080A12]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold uppercase">
                Área Restrita
              </span>
              <span className="text-xs text-white/40">7º RI São Paulo</span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">PAINEL DE GOVERNANÇA RH</h1>
            <p className="text-xs text-white/50">
              Gestão de comunicados, publicação de holerites e validação legal de férias.
            </p>
          </div>

          {/* Subtabs de navegação interna */}
          <div className="flex gap-1.5 p-1 bg-[#12141F] rounded-xl border border-white/5 text-xs font-bold">
            <button
              onClick={() => setCurrentTab("comunicados")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === "comunicados" ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Comunicados</span>
            </button>
            <button
              onClick={() => setCurrentTab("holerites")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === "holerites" ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Holerites</span>
            </button>
            <button
              onClick={() => setCurrentTab("ferias")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === "ferias" ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Férias</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 space-y-6">
        {/* KPIs Resumo Geral */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#0d0d16] border border-white/5">
            <span className="text-xs font-bold text-white/50 uppercase">Taxa Geral de Ciência</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400">84%</span>
              <span className="text-xs text-white/40">76 / 118 ciências</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full w-[84%]" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d0d16] border border-white/5">
            <span className="text-xs font-bold text-white/50 uppercase">Hashes Válidos</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">100%</span>
              <span className="text-xs text-emerald-400/80">Integridade confirmada</span>
            </div>
            <p className="text-[11px] text-white/40 mt-3">Trilha SHA-256 sem divergências</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d0d16] border border-white/5">
            <span className="text-xs font-bold text-white/50 uppercase">Pendentes Críticos</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-400">3</span>
              <span className="text-xs text-red-400/80">Expiram em até 48h</span>
            </div>
            <p className="text-[11px] text-white/40 mt-3">Notificações automáticas enviadas</p>
          </div>
        </div>

        {/* Conteúdo por Aba */}
        {currentTab === "comunicados" && (
          <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gestão de Comunicados Internos</h3>
                <p className="text-xs text-white/50 mt-0.5">Monitore adesão, ciências e provas criptográficas por documento</p>
              </div>

              <Button
                onClick={() => setNovoModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Comunicado</span>
              </Button>
            </div>

            <div className="border border-white/5 rounded-xl overflow-hidden bg-[#101019]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Autor</th>
                    <th className="px-4 py-3">Destinatários</th>
                    <th className="px-4 py-3">Adesão / Ciências</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {comunicadosRH.map((item) => {
                    const percent = Math.round((item.ciencias / item.total) * 100);
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-bold text-white">{item.titulo}</td>
                        <td className="px-4 py-3 font-mono text-white/60">{item.data}</td>
                        <td className="px-4 py-3 text-white/70">{item.autor}</td>
                        <td className="px-4 py-3 text-white/60">{item.destinatarios}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">{item.ciencias}/{item.total}</span>
                            <span className="text-[10px] text-white/40">({percent}%)</span>
                          </div>
                          <div className="w-24 bg-white/5 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-cyan-400 h-full" style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAuditModalOpen(true)}
                            className="border-white/10 text-white/80 text-xs h-7 px-2.5 gap-1"
                          >
                            <Shield className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Auditoria</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentTab === "holerites" && <HoleriteUploader />}

        {currentTab === "ferias" && (
          <div className="space-y-6">
            <CLT135Validator />
          </div>
        )}
      </div>

      {/* Modal Novo Comunicado */}
      {novoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#0d0d16] border border-white/10 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Publicar Novo Comunicado com Prova de Integridade</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Título *</label>
                <Input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Alteração no Horário de Atendimento"
                  className="bg-[#12141F] border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1">Prioridade *</label>
                <select
                  value={novoPrioridade}
                  onChange={(e) => setNovoPrioridade(e.target.value)}
                  className="w-full bg-[#12141F] border border-white/10 text-white text-xs rounded-lg p-2"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="IMPORTANTE">IMPORTANTE</option>
                  <option value="URGENTE">URGENTE</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1">Conteúdo do Comunicado *</label>
                <textarea
                  value={novoConteudo}
                  onChange={(e) => setNovoConteudo(e.target.value)}
                  rows={5}
                  placeholder="Escreva as diretrizes, orientações ou regras..."
                  className="w-full bg-[#12141F] border border-white/10 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setNovoModalOpen(false)} className="text-xs text-white/60">
                Cancelar
              </Button>
              <Button
                onClick={handlePublicar}
                disabled={publicando}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {publicando ? "Publicando e Gerando SHA-256..." : "Publicar com Prova de Integridade"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Auditoria */}
      {auditModalOpen && (
        <ComunicadoAuditModal
          comunicadoTitulo="Alteração de Horário - Plantão de Fim de Ano"
          totalDestinatarios={45}
          totalViews={40}
          totalCiencias={32}
          auditorias={[
            {
              id: "1",
              colaboradorNome: "Henrique Gama",
              email: "henrique.gama@7risp.com.br",
              dataCiencia: "30/08/2026 10:14:22",
              comprovanteHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              ipMascarado: "189.40.***.***",
              scrollPercent: 100,
            },
            {
              id: "2",
              colaboradorNome: "Maria Silva",
              email: "maria.silva@7risp.com.br",
              dataCiencia: "30/08/2026 09:45:10",
              comprovanteHash: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
              ipMascarado: "177.20.***.***",
              scrollPercent: 95,
            },
          ]}
          onClose={() => setAuditModalOpen(false)}
        />
      )}
    </div>
  );
}
