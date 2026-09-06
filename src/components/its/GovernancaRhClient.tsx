'use client';

import React, { useState, useRef, useEffect, useTransition } from 'react';
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
  Plus,
  Trash2,
  Pencil,
  UserPlus,
  UserMinus,
  Lock,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AuditLogItem,
  updateColumnLabel,
  criarItRapida,
  excluirItGovernanca,
  adicionarColaboradorCiencia,
  removerColaboradorCiencia,
  getColaboradoresParaCiencia,
  ColaboradorCienciaOption,
} from '@/app/actions/its';

// ═══════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════

interface ColaboradorTenant {
  id: string;
  name: string;
  email: string;
  departamento: string;
  cargo: string;
}

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
    columnConfig: Record<string, string>;
    colaboradoresTenant: ColaboradorTenant[];
  };
  currentUserRole?: string;
}

// ═══════════════════════════════════════════════════
// EDITABLE COLUMN HEADER
// ═══════════════════════════════════════════════════

function EditableColumnHeader({
  colunaKey,
  label,
  canEdit,
  onUpdate,
  className = '',
}: {
  colunaKey: string;
  label: string;
  canEdit: boolean;
  onUpdate: (key: string, newLabel: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== label) {
      onUpdate(colunaKey, trimmed);
    } else {
      setValue(label);
    }
    setEditing(false);
  };

  if (!canEdit) {
    return <th className={`py-3 px-4 ${className}`}>{label}</th>;
  }

  if (editing) {
    return (
      <th className={`py-3 px-4 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setValue(label); setEditing(false); }
          }}
          className="bg-zinc-800 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-white w-full min-w-[80px] focus:outline-none focus:border-emerald-400"
        />
      </th>
    );
  }

  return (
    <th className={`py-3 px-4 group/col ${className}`}>
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors w-full text-left"
        title="Clique para renomear esta coluna"
      >
        <span>{label}</span>
        <Pencil className="w-3 h-3 opacity-0 group-hover/col:opacity-60 transition-opacity" />
      </button>
    </th>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function GovernancaRhClient({ initialData, currentUserRole = 'ADMIN' }: GovernancaDataProps) {
  const { kpis, timelineAudit, conformidadePorIt, columnConfig, colaboradoresTenant } = initialData;
  const canAdmin = ['ADMIN', 'RH', 'MASTER'].includes(currentUserRole);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepto, setFilterDepto] = useState('TODOS');
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [diffModalLog, setDiffModalLog] = useState<AuditLogItem | null>(null);
  const [pendentesModalIt, setPendentesModalIt] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  // Column labels state
  const [colLabels, setColLabels] = useState<Record<string, string>>(columnConfig);

  // Modal states
  const [showNovaItModal, setShowNovaItModal] = useState(false);
  const [showExcluirModal, setShowExcluirModal] = useState<string | null>(null);
  const [showCienciaModal, setShowCienciaModal] = useState<any | null>(null);

  // Nova IT form
  const [novaItForm, setNovaItForm] = useState({
    codigo: '',
    titulo: '',
    departamento: 'Atendimento',
    guardiaoId: '',
  });

  // Excluir IT form
  const [excluirForm, setExcluirForm] = useState({ motivo: '', senha: '' });

  // Ciência management
  const [cienciaColaboradores, setCienciaColaboradores] = useState<ColaboradorCienciaOption[]>([]);
  const [cienciaSearch, setCienciaSearch] = useState('');
  const [cienciaFilterDepto, setCienciaFilterDepto] = useState('TODOS');
  const [loadingCiencia, setLoadingCiencia] = useState(false);

  // ─── Handlers ───

  const handleCopyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    toast.success('Hash SHA-256 copiado para a área de transferência!');
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleNotificarPendentes = (itCodigo: string, pendentesNomes: string[]) => {
    toast.success(
      `Notificação disparada para ${pendentesNomes.length} colaborador(es) pendente(s) na ${itCodigo}!`
    );
  };

  const handleExportarCnj = () => {
    window.print();
  };

  // Column rename
  const handleColumnUpdate = (key: string, newLabel: string) => {
    setColLabels(prev => ({ ...prev, [key]: newLabel }));
    startTransition(async () => {
      try {
        await updateColumnLabel(key, newLabel);
        toast.success(`Coluna renomeada para "${newLabel}"`);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao renomear coluna');
        setColLabels(prev => ({ ...prev, [key]: columnConfig[key] }));
      }
    });
  };

  // Nova IT
  const handleCriarIt = () => {
    startTransition(async () => {
      try {
        await criarItRapida(novaItForm);
        toast.success(`IT "${novaItForm.codigo}" criada com sucesso!`);
        setShowNovaItModal(false);
        setNovaItForm({ codigo: '', titulo: '', departamento: 'Atendimento', guardiaoId: '' });
        // Force reload to see new data
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao criar IT');
      }
    });
  };

  // Excluir IT
  const handleExcluirIt = () => {
    if (!showExcluirModal) return;
    startTransition(async () => {
      try {
        await excluirItGovernanca(showExcluirModal, excluirForm.motivo, excluirForm.senha);
        toast.success('IT excluída com sucesso!');
        setShowExcluirModal(null);
        setExcluirForm({ motivo: '', senha: '' });
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao excluir IT');
      }
    });
  };

  // Open ciência modal
  const handleOpenCienciaModal = async (it: any) => {
    setShowCienciaModal(it);
    setLoadingCiencia(true);
    setCienciaSearch('');
    setCienciaFilterDepto('TODOS');
    try {
      const data = await getColaboradoresParaCiencia(it.id, it.versao || '1.0');
      setCienciaColaboradores(data);
    } catch (err: any) {
      toast.error('Erro ao carregar colaboradores');
      setCienciaColaboradores([]);
    }
    setLoadingCiencia(false);
  };

  // Add collaborator to ciência
  const handleAddCiencia = async (userId: string) => {
    if (!showCienciaModal) return;
    startTransition(async () => {
      try {
        await adicionarColaboradorCiencia(showCienciaModal.id, userId, showCienciaModal.versao || '1.0');
        setCienciaColaboradores(prev =>
          prev.map(c => c.id === userId ? { ...c, jaIncluso: true, status: 'pendente' } : c)
        );
        toast.success('Colaborador adicionado à equipe de ciência!');
      } catch (err: any) {
        toast.error(err.message || 'Erro ao adicionar colaborador');
      }
    });
  };

  // Remove collaborator from ciência
  const handleRemoveCiencia = async (userId: string) => {
    if (!showCienciaModal) return;
    startTransition(async () => {
      try {
        await removerColaboradorCiencia(showCienciaModal.id, userId, showCienciaModal.versao || '1.0');
        setCienciaColaboradores(prev =>
          prev.map(c => c.id === userId ? { ...c, jaIncluso: false, status: undefined, cienteEm: undefined } : c)
        );
        toast.success('Colaborador removido da equipe de ciência.');
      } catch (err: any) {
        toast.error(err.message || 'Erro ao remover colaborador');
      }
    });
  };

  // Filtragem
  const filteredIts = conformidadePorIt.filter((it) => {
    const matchesSearch =
      it.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.guardiaoNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepto = filterDepto === 'TODOS' || it.departamento === filterDepto;
    return matchesSearch && matchesDepto;
  });

  const departamentos = Array.from(new Set(conformidadePorIt.map((i) => i.departamento)));

  // Ciência modal filtered
  const filteredCienciaColab = cienciaColaboradores.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(cienciaSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(cienciaSearch.toLowerCase());
    const matchDepto = cienciaFilterDepto === 'TODOS' || c.departamento === cienciaFilterDepto;
    return matchSearch && matchDepto;
  });

  const allDeptos = Array.from(new Set(colaboradoresTenant.map(c => c.departamento)));

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
            <span className="text-xs text-zinc-400 font-mono">Gestão &amp; Auditoria WORM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            Governança &amp; Monitoramento de Instruções de Trabalho
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
              {canAdmin && (
                <span className="text-emerald-500/60 ml-2">
                  <Settings className="w-3 h-3 inline" /> Clique nos títulos das colunas para renomear
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Botão Nova IT */}
            {canAdmin && (
              <Button
                size="sm"
                onClick={() => setShowNovaItModal(true)}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Nova IT
              </Button>
            )}

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
                <EditableColumnHeader colunaKey="codigo" label={colLabels.codigo} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="setor" label={colLabels.setor} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="versao" label={colLabels.versao} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="guardiao" label={colLabels.guardiao} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="revisao" label={colLabels.revisao} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="ciencia" label={colLabels.ciencia} canEdit={canAdmin} onUpdate={handleColumnUpdate} />
                <EditableColumnHeader colunaKey="acoes" label={colLabels.acoes} canEdit={canAdmin} onUpdate={handleColumnUpdate} className="text-right" />
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
                      <div className="flex items-center gap-2 mt-0.5">
                        {it.pendentesCount > 0 && (
                          <button
                            onClick={() => setPendentesModalIt(it)}
                            className="text-[11px] text-amber-400 hover:underline"
                          >
                            Ver {it.pendentesCount} pendente(s)
                          </button>
                        )}
                        {canAdmin && (
                          <button
                            onClick={() => handleOpenCienciaModal(it)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                            title="Gerenciar equipe de ciência"
                          >
                            <Settings className="w-3 h-3" /> Gerenciar
                          </button>
                        )}
                      </div>
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
                        {canAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowExcluirModal(it.id)}
                            className="text-[11px] h-7 px-2 border-rose-800/50 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                            title="Excluir IT"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredIts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 italic">
                    Nenhuma instrução de trabalho encontrada.
                  </td>
                </tr>
              )}
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

      {/* ══════════════════════════════════════════════════ */}
      {/* MODAL: LISTA DE PENDENTES                        */}
      {/* ══════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════ */}
      {/* MODAL: NOVA IT                                   */}
      {/* ══════════════════════════════════════════════════ */}
      {showNovaItModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Cadastrar Nova Instrução de Trabalho
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Criação rápida via painel de Governança</p>
              </div>
              <button onClick={() => setShowNovaItModal(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={novaItForm.codigo}
                    onChange={(e) => setNovaItForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="IT-ATD-005"
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    Departamento *
                  </label>
                  <select
                    value={novaItForm.departamento}
                    onChange={(e) => setNovaItForm(prev => ({ ...prev, departamento: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    {allDeptos.length > 0 ? allDeptos.map(d => (
                      <option key={d} value={d}>{d}</option>
                    )) : (
                      <option value="Atendimento">Atendimento</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Título da Instrução de Trabalho *
                </label>
                <input
                  type="text"
                  value={novaItForm.titulo}
                  onChange={(e) => setNovaItForm(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Procedimento de Atendimento ao Público"
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Guardião Responsável
                </label>
                <select
                  value={novaItForm.guardiaoId}
                  onChange={(e) => setNovaItForm(prev => ({ ...prev, guardiaoId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Eu mesmo (autor)</option>
                  {colaboradoresTenant.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.departamento}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => setShowNovaItModal(false)} className="text-zinc-300">
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isPending || !novaItForm.codigo.trim() || !novaItForm.titulo.trim()}
                onClick={handleCriarIt}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Criando...</span>
                ) : (
                  <><Plus className="w-3.5 h-3.5 mr-1" /> Cadastrar IT</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODAL: EXCLUIR IT (COM SENHA)                    */}
      {/* ══════════════════════════════════════════════════ */}
      {showExcluirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121212] border border-rose-800/30 rounded-2xl p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-rose-300">Excluir Instrução de Trabalho</h3>
                  <p className="text-xs text-zinc-400">Esta ação requer confirmação por senha</p>
                </div>
              </div>
              <button onClick={() => { setShowExcluirModal(null); setExcluirForm({ motivo: '', senha: '' }); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-950/20 border border-rose-800/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-rose-300">
                <strong>⚠️ Atenção:</strong> A IT será marcada como excluída (soft-delete). O registro permanece no log de auditoria WORM para conformidade CNJ.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Motivo da Exclusão *
                </label>
                <input
                  type="text"
                  value={excluirForm.motivo}
                  onChange={(e) => setExcluirForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ex: IT obsoleta, substituída por IT-ATD-006"
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  <Lock className="w-3 h-3 inline mr-1" /> Senha do Administrador *
                </label>
                <input
                  type="password"
                  value={excluirForm.senha}
                  onChange={(e) => setExcluirForm(prev => ({ ...prev, senha: e.target.value }))}
                  placeholder="Digite sua senha para confirmar"
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => { setShowExcluirModal(null); setExcluirForm({ motivo: '', senha: '' }); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isPending || !excluirForm.motivo.trim() || !excluirForm.senha.trim()}
                onClick={handleExcluirIt}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50"
              >
                {isPending ? (
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Excluindo...</span>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5 mr-1" /> Confirmar Exclusão</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODAL: GESTÃO DA EQUIPE DE CIÊNCIA               */}
      {/* ══════════════════════════════════════════════════ */}
      {showCienciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Gerenciar Equipe de Ciência
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {showCienciaModal.codigo} — v{showCienciaModal.versao}
                  <span className="text-zinc-500 ml-2 font-sans">| {showCienciaModal.titulo}</span>
                </p>
              </div>
              <button onClick={() => setShowCienciaModal(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cienciaSearch}
                  onChange={(e) => setCienciaSearch(e.target.value)}
                  placeholder="Buscar colaborador por nome ou e-mail..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={cienciaFilterDepto}
                onChange={(e) => setCienciaFilterDepto(e.target.value)}
                className="px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white"
              >
                <option value="TODOS">Todos</option>
                {allDeptos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Na Equipe (Ciente)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Na Equipe (Pendente)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-600" /> Fora da Equipe
              </span>
            </div>

            {/* Collaborator List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
              {loadingCiencia ? (
                <div className="py-8 text-center text-zinc-500 text-sm">
                  <span className="w-5 h-5 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin inline-block mr-2" />
                  Carregando colaboradores...
                </div>
              ) : filteredCienciaColab.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm italic">
                  Nenhum colaborador encontrado.
                </div>
              ) : (
                filteredCienciaColab.map(colab => (
                  <div
                    key={colab.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      colab.jaIncluso
                        ? colab.status === 'ciente'
                          ? 'bg-emerald-950/10 border-emerald-800/30'
                          : 'bg-amber-950/10 border-amber-800/30'
                        : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        colab.jaIncluso
                          ? colab.status === 'ciente'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {colab.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{colab.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {colab.departamento} • {colab.cargo}
                          {colab.jaIncluso && colab.status === 'ciente' && colab.cienteEm && (
                            <span className="text-emerald-500 ml-2">✓ Ciente em {colab.cienteEm}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {colab.jaIncluso ? (
                        <>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            colab.status === 'ciente'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {colab.status === 'ciente' ? 'Ciente' : 'Pendente'}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleRemoveCiencia(colab.id)}
                            className="text-[11px] h-7 px-2 border-rose-800/50 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40"
                            title="Remover da equipe"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleAddCiencia(colab.id)}
                          className="text-[11px] h-7 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                          title="Adicionar à equipe"
                        >
                          <UserPlus className="w-3 h-3 mr-1" /> Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary bar */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
              <div className="text-xs text-zinc-400">
                <span className="text-emerald-400 font-bold">{cienciaColaboradores.filter(c => c.jaIncluso && c.status === 'ciente').length}</span> cientes
                <span className="mx-2 text-zinc-600">|</span>
                <span className="text-amber-400 font-bold">{cienciaColaboradores.filter(c => c.jaIncluso && c.status === 'pendente').length}</span> pendentes
                <span className="mx-2 text-zinc-600">|</span>
                <span className="font-bold text-white">{cienciaColaboradores.filter(c => c.jaIncluso).length}</span> na equipe
              </div>
              <Button size="sm" onClick={() => setShowCienciaModal(null)} className="bg-zinc-800 hover:bg-zinc-700 text-white">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* MODAL: VISUALIZAÇÃO DO DIFF DE AUDITORIA         */}
      {/* ══════════════════════════════════════════════════ */}
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
