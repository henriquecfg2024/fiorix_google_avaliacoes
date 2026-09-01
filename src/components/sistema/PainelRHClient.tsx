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

interface PainelRHClientProps {
  userRole?: string;
  userName?: string;
}

export function PainelRHClient({ userRole = "ADMIN", userName = "Administrador" }: PainelRHClientProps) {
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
      views: 45,
      ciencias: 18,
      total: 45,
      status: "PUBLICADO",
    },
  ];

  const handlePublicar = async () => {
    if (!novoTitulo || !novoConteudo) {
      alert("Por favor, preencha o título e o conteúdo.");
      return;
    }

    setPublicando(true);
    try {
      const res = await fetch("/api/comunicados/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novoTitulo,
          conteudo: novoConteudo,
          prioridade: novoPrioridade,
          exigeCiencia: true,
          destinatarios: "TODOS",
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
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-20">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-8">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Administração</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400">Painel RH</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                PAINEL DE GOVERNANÇA RH
              </h1>
              <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                ÁREA RESTRITA • 7º RI SP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gestão de comunicados institucionais, upload em lote de holerites e validação legal de férias.
            </p>
          </div>

          {/* Subtabs de navegação interna */}
          <div className="flex gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/8 text-xs font-bold">
            <button
              onClick={() => setCurrentTab("comunicados")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === "comunicados" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Comunicados</span>
            </button>
            <button
              onClick={() => setCurrentTab("holerites")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === "holerites" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Holerites</span>
            </button>
            <button
              onClick={() => setCurrentTab("ferias")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === "ferias" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Férias</span>
            </button>
          </div>
        </div>

        {/* KPIs Resumo Geral */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa Geral de Ciência</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400">84%</span>
              <span className="text-xs text-slate-400 font-semibold">76 / 118 ciências</span>
            </div>
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full mt-3.5 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full w-[84%]" />
            </div>
          </div>

          <div className="p-6 rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hashes Válidos</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">100%</span>
              <span className="text-xs text-emerald-400/80 font-semibold">Integridade confirmada</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-3.5">Trilha SHA-256 sem divergências</p>
          </div>

          <div className="p-6 rounded-[28px] border border-rose-500/30 bg-[#140a12]/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendentes Críticos</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-400">3</span>
              <span className="text-xs text-rose-400/80 font-semibold">Expiram em até 48h</span>
            </div>
            <p className="text-[11px] text-rose-400/80 mt-3.5">Notificações automáticas enviadas</p>
          </div>
        </div>

        {/* Conteúdo por Aba */}
        {currentTab === "comunicados" && (
          <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gestão de Comunicados Internos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Monitore adesão, ciências e provas criptográficas por documento</p>
              </div>

              <Button
                onClick={() => setNovoModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Comunicado</span>
              </Button>
            </div>

            <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#070A12]/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
                  <tr>
                    <th className="px-5 py-3.5">Título</th>
                    <th className="px-5 py-3.5">Data</th>
                    <th className="px-5 py-3.5">Autor</th>
                    <th className="px-5 py-3.5">Destinatários</th>
                    <th className="px-5 py-3.5">Adesão / Ciências</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-slate-200">
                  {comunicadosRH.map((item) => {
                    const percent = Math.round((item.ciencias / item.total) * 100);
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.04] transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">{item.titulo}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-400">{item.data}</td>
                        <td className="px-5 py-3.5 text-slate-300">{item.autor}</td>
                        <td className="px-5 py-3.5 text-slate-400">{item.destinatarios}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">{item.ciencias}/{item.total}</span>
                            <span className="text-[10px] text-slate-400">({percent}%)</span>
                          </div>
                          <div className="w-24 bg-slate-700/60 h-1 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-cyan-400 h-full" style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAuditModalOpen(true)}
                            className="border-white/10 text-slate-200 hover:bg-white/10 text-xs h-7 px-3 gap-1 rounded-xl"
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
          <div className="relative w-full max-w-2xl bg-[#0B1020] border border-white/12 rounded-[28px] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.5)] p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Publicar Novo Comunicado com Prova de Integridade</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Título *</label>
                <Input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Alteração no Horário de Atendimento"
                  className="bg-white/[0.04] border-white/10 text-white text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Prioridade *</label>
                <select
                  value={novoPrioridade}
                  onChange={(e) => setNovoPrioridade(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/10 text-white text-xs rounded-xl p-2.5"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="IMPORTANTE">IMPORTANTE</option>
                  <option value="URGENTE">URGENTE</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Conteúdo do Comunicado *</label>
                <textarea
                  value={novoConteudo}
                  onChange={(e) => setNovoConteudo(e.target.value)}
                  rows={5}
                  placeholder="Escreva as diretrizes, orientações ou regras..."
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-xs rounded-2xl p-3.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setNovoModalOpen(false)} className="text-xs text-slate-400 hover:text-white">
                Cancelar
              </Button>
              <Button
                onClick={handlePublicar}
                disabled={publicando}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20"
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
              comprovanteHash: "a1b2c3d4e5f67a89bc012d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
              ipMascarado: "177.18.***.***",
              scrollPercent: 95,
            },
          ]}
          onClose={() => setAuditModalOpen(false)}
        />
      )}
    </div>
  );
}
