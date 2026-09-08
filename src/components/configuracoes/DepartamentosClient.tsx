'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  FileText,
  ArrowLeft,
  X,
  Check,
  Palette,
  Hash,
  GripVertical,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  DepartamentoItem,
  criarDepartamento,
  atualizarDepartamento,
  excluirDepartamento,
} from '@/app/actions/departamentos';

interface DepartamentosClientProps {
  initialData: DepartamentoItem[];
}

const CORES_PRESET = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#64748b',
  '#a855f7', '#6366f1', '#84cc16', '#e11d48', '#0ea5e9',
];

export function DepartamentosClient({ initialData }: DepartamentosClientProps) {
  const [deptos, setDeptos] = useState<DepartamentoItem[]>(initialData);
  const [isPending, startTransition] = useTransition();

  // Modal criar
  const [showCreate, setShowCreate] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newSigla, setNewSigla] = useState('');
  const [newCor, setNewCor] = useState('#6366f1');

  // Modal editar
  const [editDepto, setEditDepto] = useState<DepartamentoItem | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSigla, setEditSigla] = useState('');
  const [editCor, setEditCor] = useState('');

  // Modal excluir
  const [deleteDepto, setDeleteDepto] = useState<DepartamentoItem | null>(null);

  // Erro
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showMsg = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const handleCreate = () => {
    if (!newNome.trim()) {
      showMsg('O nome do departamento é obrigatório.', true);
      return;
    }

    startTransition(async () => {
      try {
        await criarDepartamento({ nome: newNome, sigla: newSigla, cor: newCor });
        showMsg(`Departamento "${newNome}" criado com sucesso!`);
        setShowCreate(false);
        setNewNome('');
        setNewSigla('');
        setNewCor('#6366f1');
        // Recarregar a página para pegar os dados frescos
        window.location.reload();
      } catch (err: any) {
        showMsg(err.message || 'Erro ao criar departamento.', true);
      }
    });
  };

  const handleUpdate = () => {
    if (!editDepto) return;

    startTransition(async () => {
      try {
        await atualizarDepartamento(editDepto.id, {
          nome: editNome,
          sigla: editSigla,
          cor: editCor,
        });
        showMsg(`Departamento atualizado com sucesso!`);
        setEditDepto(null);
        window.location.reload();
      } catch (err: any) {
        showMsg(err.message || 'Erro ao atualizar departamento.', true);
      }
    });
  };

  const handleDelete = () => {
    if (!deleteDepto) return;

    startTransition(async () => {
      try {
        await excluirDepartamento(deleteDepto.id);
        showMsg(`Departamento "${deleteDepto.nome}" excluído.`);
        setDeleteDepto(null);
        window.location.reload();
      } catch (err: any) {
        showMsg(err.message || 'Erro ao excluir departamento.', true);
      }
    });
  };

  const handleToggleAtivo = (depto: DepartamentoItem) => {
    startTransition(async () => {
      try {
        await atualizarDepartamento(depto.id, { ativo: !depto.ativo });
        window.location.reload();
      } catch (err: any) {
        showMsg(err.message || 'Erro ao alterar status.', true);
      }
    });
  };

  const openEdit = (d: DepartamentoItem) => {
    setEditDepto(d);
    setEditNome(d.nome);
    setEditSigla(d.sigla || '');
    setEditCor(d.cor);
  };

  const totalAtivos = deptos.filter(d => d.ativo).length;
  const totalInativos = deptos.filter(d => !d.ativo).length;
  const totalColabs = deptos.reduce((s, d) => s + d.totalColaboradores, 0);

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/configuracoes" className="hover:text-amber-300 transition-colors">
                Configurações
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Departamentos</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Gestão de Departamentos
              </h1>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                ESTRUTURA ORGANIZACIONAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white text-xs shadow-lg hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Departamento
            </button>
            <Link
              href="/configuracoes"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] text-xs font-medium transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
          </div>
        </div>

        {/* Alertas */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalAtivos}</p>
              <p className="text-[11px] text-slate-400">Departamentos Ativos</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalColabs}</p>
              <p className="text-[11px] text-slate-400">Colaboradores Distribuídos</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{deptos.reduce((s, d) => s + d.totalIts, 0)}</p>
              <p className="text-[11px] text-slate-400">ITs Vinculadas</p>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-300" />
            <h2 className="text-lg font-extrabold text-white">
              Departamentos Cadastrados ({deptos.length})
            </h2>
            {totalInativos > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                {totalInativos} inativo(s)
              </span>
            )}
          </div>

          {deptos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-8 text-center text-sm text-white/50">
              Nenhum departamento cadastrado. Clique em &quot;Novo Departamento&quot; para adicionar.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/12">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/12 bg-[#080811] text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">
                    <th className="p-3 pl-5 w-10">#</th>
                    <th className="p-3">Cor</th>
                    <th className="p-3">Departamento</th>
                    <th className="p-3">Sigla</th>
                    <th className="p-3 text-center">Colaboradores</th>
                    <th className="p-3 text-center">ITs</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-medium text-white/80">
                  {deptos.map((d, i) => (
                    <tr key={d.id} className={`hover:bg-white/[0.03] transition-colors ${!d.ativo ? 'opacity-50' : ''}`}>
                      <td className="p-3 pl-5 text-slate-500 font-mono text-[10px]">
                        {i + 1}
                      </td>
                      <td className="p-3">
                        <div
                          className="w-5 h-5 rounded-md border border-white/20"
                          style={{ backgroundColor: d.cor }}
                        />
                      </td>
                      <td className="p-3 font-bold text-white">
                        {d.nome}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                          {d.sigla || '—'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] font-bold text-cyan-300">{d.totalColaboradores}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] font-bold text-amber-300">{d.totalIts}</span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleAtivo(d)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 cursor-pointer"
                          title={d.ativo ? 'Desativar departamento' : 'Ativar departamento'}
                        >
                          {d.ativo ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-emerald-400" />
                              <span className="text-[10px] font-bold text-emerald-300">Ativo</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-500" />
                              <span className="text-[10px] font-bold text-slate-500">Inativo</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteDepto(d)}
                            disabled={d.totalColaboradores > 0 || d.totalIts > 0}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={d.totalColaboradores > 0 || d.totalIts > 0 ? 'Departamento possui vínculos' : 'Excluir'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Criar */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0B1020] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                Novo Departamento
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Nome do Departamento *
                </label>
                <input
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: Protocolo"
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Sigla
                </label>
                <input
                  type="text"
                  value={newSigla}
                  onChange={(e) => setNewSigla(e.target.value.toUpperCase())}
                  placeholder="Ex: PRT"
                  maxLength={5}
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Cor Identificadora
                </label>
                <div className="flex flex-wrap gap-2">
                  {CORES_PRESET.map((cor) => (
                    <button
                      key={cor}
                      onClick={() => setNewCor(cor)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${
                        newCor === cor ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !newNome.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white text-xs shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isPending ? 'Criando...' : 'Criar Departamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editDepto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0B1020] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-300" />
                Editar Departamento
              </h3>
              <button onClick={() => setEditDepto(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Nome do Departamento *
                </label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50"
                />
                {editNome !== editDepto.nome && (
                  <p className="text-[10px] text-amber-300/80 mt-1">
                    ⚠ Renomear atualizará automaticamente todos os colaboradores e ITs vinculados.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Sigla
                </label>
                <input
                  type="text"
                  value={editSigla}
                  onChange={(e) => setEditSigla(e.target.value.toUpperCase())}
                  maxLength={5}
                  className="w-full bg-[#070A12] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Cor Identificadora
                </label>
                <div className="flex flex-wrap gap-2">
                  {CORES_PRESET.map((cor) => (
                    <button
                      key={cor}
                      onClick={() => setEditCor(cor)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${
                        editCor === cor ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditDepto(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={isPending || !editNome.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white text-xs shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {deleteDepto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0B1020] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Excluir Departamento</h3>
            <p className="text-sm text-slate-300">
              Tem certeza que deseja excluir o departamento <strong className="text-red-300">{deleteDepto.nome}</strong>?
            </p>
            <p className="text-[11px] text-slate-500">
              Esta ação não pode ser desfeita. O departamento só pode ser excluído se não possuir colaboradores ou ITs vinculados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteDepto(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-red-600 font-bold text-white text-xs shadow-lg hover:bg-red-500 transition-all disabled:opacity-50"
              >
                {isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
