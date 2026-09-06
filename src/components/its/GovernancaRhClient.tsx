'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Users,
  Search,
  Filter,
  Eye,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Printer,
  Sparkles,
  Download,
  Layers,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AuditLogItem } from '@/app/actions/its';

interface GovernancaDataProps {
  initialData: {
    kpis: {
      totalIts: number;
      itsAtualizadas7d: number;
      itsAtualizadas30d: number;
      taxaConformidade: number;
      totalPendentes: number;
      itsVencidas: number;
    };
    timelineAudit: AuditLogItem[];
    conformidadePorIt: Array<{
      id: string;
      codigo: string;
      titulo: string;
      departamento: string;
      versao: string;
      guardiaoNome: string;
      diasSemRevisao: number;
      totalEquipe: number;
      cientesCount: number;
      pendentesCount: number;
      pendentesNomes: string[];
    }>;
  };
}

export function GovernancaRhClient({ initialData }: GovernancaDataProps) {
  const { kpis, timelineAudit, conformidadePorIt } = initialData;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepto, setFilterDepto] = useState('TODOS');
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [diffModalLog, setDiffModalLog] = useState<AuditLogItem | null>(null);
  const [pendentesModalIt, setPendentesModalIt] = useState<any | null>(null);

  // Copiar Hash
  const handleCopyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    toast.success('Hash SHA-256 copiado para a área de transferência!');
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  // Notificar Equipe Pendente
  const handleNotificarPendentes = (itCodigo: string, pendentesNomes: string[]) => {
    toast.success(
      `Notificação disparada para ${pendentesNomes.length} colaborador(es) pendente(s) na ${itCodigo}!`
    );
  };

  // Exportar Dossiê CNJ (Imprimir relatório limpo)
  const handleExportarCnj = () => {
    window.print();
  };

  // Filtragem de ITs
  const filteredIts = conformidadePorIt.filter((it) => {
    const matchesSearch =
      it.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.guardiaoNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepto = filterDepto === 'TODOS' || it.departamento === filterDepto;
    return matchesSearch && matchesDepto;
  });

  const departamentos = Array.from(new Set(conformidadePorIt.map((i) => i.departamento)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto text-white">
      {/* HEADER DA GOVERNANÇA */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              7º Registro de Imóveis de SP
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 font-mono">Gestão & Auditoria WORM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            Governança & Monitoramento de Instruções de Trabalho
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Acompanhamento de conformidade operacional, guardiões responsáveis e trilha de auditoria imutável CNJ.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center print:hidden">
          <Button
            variant="outline"
            onClick={handleExportarCnj}
            className="text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Dossiê CNJ (Imprimir)
          </Button>
          <Link href="/administracao/its">
            <Button
              size="sm"
              className="text-xs bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-md shadow-emerald-500/20"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Módulo Operacional Geral
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 CARDS DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Taxa de Conformidade */}
        <div className="bg-[#121212] border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Conformidade Geral
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">{kpis.taxaConformidade}%</div>
          <p className="text-xs text-zinc-400 mt-1">Colaboradores cientes da versão vigente</p>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${kpis.taxaConformidade}%` }}
            />
          </div>
        </div>

        {/* KPI 2: ITs Atualizadas Recentes */}
        <div className="bg-[#121212] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Revisões Recentes
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">{kpis.itsAtualizadas30d}</div>
          <p className="text-xs text-zinc-400 mt-1">
            Atualizadas nos últimos 30 dias ({kpis.itsAtualizadas7d} nos últimos 7d)
          </p>
        </div>

        {/* KPI 3: Leituras Pendentes */}
        <div className="bg-[#121212] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Ciências Pendentes
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono">{kpis.totalPendentes}</div>
          <p className="text-xs text-zinc-400 mt-1">Colaboradores com leitura pendente de nova versão</p>
        </div>

        {/* KPI 4: ITs Vencidas */}
        <div className="bg-[#121212] border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Revisão Vencida
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-400 font-mono">{kpis.itsVencidas}</div>
          <p className="text-xs text-zinc-400 mt-1">ITs sem validação do guardião há &gt; 120 dias</p>
        </div>
      </div>

      {/* SEÇÃO 1: TABELA DE CONFORMIDADE OPERACIONAL POR IT */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Controle de Conformidade por Procedimento
            </h2>
            <p className="text-xs text-zinc-400">
              Acompanhamento do Guardião Titular e das confirmações de leitura de cada equipe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Busca */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar IT, código ou guardião..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filtro de Departamento */}
            <select
              value={filterDepto}
              onChange={(e) => setFilterDepto(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            >
              <option value="TODOS">Todos os Setores</option>
              {departamentos.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela de ITs */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Código / IT</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4">Versão</th>
                <th className="py-3 px-4">Guardião Responsável</th>
                <th className="py-3 px-4">Última Revisão</th>
                <th className="py-3 px-4">Ciência da Equipe</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredIts.map((it) => {
                const percent = it.totalEquipe > 0 ? Math.round((it.cientesCount / it.totalEquipe) * 100) : 100;
                return (
                  <tr key={it.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-emerald-400">{it.codigo}</div>
                      <div className="font-medium text-white truncate max-w-xs">{it.titulo}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">{it.departamento}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-zinc-200">v{it.versao}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-white">{it.guardiaoNome}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          it.diasSemRevisao <= 60
                            ? 'text-emerald-400 bg-emerald-950/30'
                            : it.diasSemRevisao <= 120
                            ? 'text-amber-400 bg-amber-950/30'
                            : 'text-rose-400 bg-rose-950/30 font-bold'
                        }`}
                      >
                        <Clock className="w-3 h-3" /> {it.diasSemRevisao}d atrás
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-200">{percent}%</span>
                        <span className="text-zinc-500">
                          ({it.cientesCount}/{it.totalEquipe})
                        </span>
                      </div>
                      {it.pendentesCount > 0 && (
                        <button
                          onClick={() => setPendentesModalIt(it)}
                          className="text-[11px] text-amber-400 hover:underline mt-0.5 block"
                        >
                          Ver {it.pendentesCount} pendente(s)
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {it.pendentesCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleNotificarPendentes(it.codigo, it.pendentesNomes)}
                            className="text-[11px] h-7 px-2 border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white"
                          >
                            <Send className="w-3 h-3 mr-1 text-emerald-400" /> Notificar
                          </Button>
                        )}
                        <Link href={`/instrucoes-trabalho/${it.id}`}>
                          <Button
                            size="sm"
                            className="text-[11px] h-7 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Abrir
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 2: TIMELINE DE AUDITORIA IMUTÁVEL (WORM) */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Trilha de Auditoria Imutável (WORM Log para o CNJ)
            </h2>
            <p className="text-xs text-zinc-400">
              Histórico cronológico inviolável de todas as publicações e revisões de ITs da serventia.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Procedimento</th>
                <th className="py-3 px-4">Versão</th>
                <th className="py-3 px-4">Autor / Guardião</th>
                <th className="py-3 px-4">Motivo / Base Legal</th>
                <th className="py-3 px-4">Hash SHA-256</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {timelineAudit.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4 text-zinc-400">{log.createdAt}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className="font-bold text-emerald-400">{log.itCodigo}</span>
                    <span className="text-zinc-500 ml-1.5">•</span>
                    <span className="text-zinc-300 ml-1.5 truncate max-w-xs">{log.itTitulo}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-zinc-500">v{log.versaoAnterior}</span>
                    <span className="text-zinc-600 mx-1">→</span>
                    <span className="font-bold text-emerald-400">v{log.versaoNova}</span>
                  </td>
                  <td className="py-3 px-4 font-sans text-white">{log.autorNome}</td>
                  <td className="py-3 px-4 font-sans text-zinc-300 max-w-xs truncate" title={log.motivo}>
                    {log.motivo}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <span className="truncate w-24 select-all">{log.hashSha256}</span>
                      <button
                        onClick={() => handleCopyHash(log.id, log.hashSha256)}
                        className="hover:text-white p-0.5"
                      >
                        {copiedHashId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDiffModalLog(log)}
                      className="text-[11px] h-7 px-2 border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white"
                    >
                      Ver Diff
                    </Button>
                  </td>
                </tr>
              ))}
              {timelineAudit.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500 italic font-sans">
                    Nenhum registro de auditoria gravado até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE LISTA DE PENDENTES */}
      {pendentesModalIt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base">Colaboradores Pendentes de Leitura</h3>
                <p className="text-xs text-zinc-400 font-mono">{pendentesModalIt.codigo} - v{pendentesModalIt.versao}</p>
              </div>
              <button
                onClick={() => setPendentesModalIt(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {pendentesModalIt.pendentesNomes.map((nome: string, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{nome}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                    Pendente
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendentesModalIt(null)}>
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleNotificarPendentes(pendentesModalIt.codigo, pendentesModalIt.pendentesNomes);
                  setPendentesModalIt(null);
                }}
                className="bg-emerald-500 text-black font-bold"
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Notificar Todos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DO DIFF DE AUDITORIA */}
      {diffModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#0F172A] border border-slate-700 rounded-2xl p-6 text-white shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400">{diffModalLog.itCodigo}</span>
                <h3 className="font-bold text-base">Snapshot de Alteração Gravado (WORM)</h3>
                <p className="text-xs text-slate-400">
                  v{diffModalLog.versaoAnterior} → v{diffModalLog.versaoNova} • Autor: {diffModalLog.autorNome}
                </p>
              </div>
              <button
                onClick={() => setDiffModalLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Motivo da Alteração:
                </span>
                <p className="text-slate-200">{diffModalLog.motivo}</p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Hash SHA-256 Imutável:
                </span>
                <p className="text-emerald-400 select-all">{diffModalLog.hashSha256}</p>
              </div>

              <div className="bg-[#FAF9F6] text-slate-900 p-4 rounded-xl border border-slate-300">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Conteúdo do Diff Snapshot:
                </span>
                <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap font-mono p-3 bg-white rounded-lg border border-slate-200">
                  {JSON.stringify(diffModalLog.diffSnapshot, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button size="sm" onClick={() => setDiffModalLog(null)} className="bg-slate-800 text-white hover:bg-slate-700">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
