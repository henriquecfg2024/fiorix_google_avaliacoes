'use client';

import React, { useState, useMemo } from 'react';
import {
  resetUserPassword,
  updateUserRole,
  updateUserName,
  updateUserCpf,
  toggleUserStatus,
} from '@/app/actions/admin';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Edit3,
  X,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  UserX,
  UserCheck,
  Building,
} from 'lucide-react';

export interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
  cpf?: string | null;
  departamento?: string | null;
  cargo?: string | null;
  ramal?: string | null;
  podeSerTutor?: boolean;
  status?: string | null;
}

export function UserListTable({
  usuarios,
  currentUserRole = 'USER',
}: {
  usuarios: UserItem[];
  currentUserRole?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepto, setSelectedDepto] = useState<string>('TODOS');
  const [selectedRole, setSelectedRole] = useState<string>('TODOS');
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, boolean>>({});

  // Modais
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Modal Confirmação de Função
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: UserItem;
    newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN';
    impact: string;
  } | null>(null);

  const formatCpfMask = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const maskCpfDisplay = (cpf: string | null | undefined, isRevealed: boolean) => {
    if (!cpf) return 'Não informado';
    if (isRevealed) return cpf;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return `***.${clean.slice(3, 6)}.***-${clean.slice(9, 11)}`;
    }
    return '***.***.***-**';
  };

  const toggleRevealCpf = (userId: string) => {
    setRevealedCpfs((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'COLABORADOR':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
      case 'USER':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
      case 'RH':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
      case 'ADMIN':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
      case 'MASTER':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20';
      default:
        return 'bg-white/5 text-white/70 border-white/10';
    }
  };

  const getDeptoBadge = (depto?: string | null) => {
    switch (depto) {
      case 'Atendimento':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Registro':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'RH':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'TI':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Administração':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Impressão/Arquivo':
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
      case 'Indisponibilidade':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Intimação':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Ofício':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-white/5 text-white/70 border-white/10';
    }
  };

  const onSelectRole = (user: UserItem, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN') => {
    if (user.role === newRole) return;
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser alterado.');
      return;
    }

    if (newRole === 'ADMIN' && !user.name?.toLowerCase().includes('henrique cesar')) {
      alert('Apenas Henrique Cesar Ferreira Gama possui prerrogativa de ADMIN na organização.');
      return;
    }

    executeRoleChange(user.id, newRole);
  };

  const executeRoleChange = async (userId: string, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN') => {
    setUpdatingRoleId(userId);
    try {
      const res = await updateUserRole(userId, newRole);
      if (res?.error) {
        alert(res.error);
      }
    } catch {
      alert('Erro ao alterar a função do usuário.');
    } finally {
      setUpdatingRoleId(null);
      setPendingRoleChange(null);
    }
  };

  const handleOpenEditModal = (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser alterado.');
      return;
    }
    setEditUser(user);
    setEditName(user.name || '');
    setEditCpf(user.cpf || '');
    setModalMessage(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setLoading(true);
    setModalMessage(null);

    try {
      if (editName.trim() !== (editUser.name || '')) {
        const resName = await updateUserName(editUser.id, editName);
        if (resName.error) {
          setModalMessage({ type: 'error', text: resName.error });
          setLoading(false);
          return;
        }
      }

      if (editCpf.trim() !== (editUser.cpf || '')) {
        const resCpf = await updateUserCpf(editUser.id, editCpf);
        if (resCpf.error) {
          setModalMessage({ type: 'error', text: resCpf.error });
          setLoading(false);
          return;
        }
      }

      setModalMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
      setTimeout(() => setEditUser(null), 1000);
    } catch {
      setModalMessage({ type: 'error', text: 'Falha ao atualizar dados.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPasswordModal = (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ter senha alterada por esta tela.');
      return;
    }
    setSelectedUser(user);
    setNewPassword('');
    setModalMessage(null);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    setModalMessage(null);

    try {
      const res = await resetUserPassword(selectedUser.id, newPassword);
      if (res.error) {
        setModalMessage({ type: 'error', text: res.error });
      } else {
        setModalMessage({ type: 'success', text: 'Senha redefinida com sucesso!' });
        setTimeout(() => setSelectedUser(null), 1000);
      }
    } catch {
      setModalMessage({ type: 'error', text: 'Erro ao resetar senha.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    if (user.role === 'MASTER' || user.email === 'admin@fiorix.com.br') {
      alert('Usuário MASTER protegido - não pode ser desativado.');
      return;
    }
    const confirm = window.confirm(`Deseja alterar o status do colaborador ${user.name}?`);
    if (!confirm) return;

    try {
      const res = await toggleUserStatus(user.id);
      if (!res.success) {
        alert('Falha ao alterar status.');
      }
    } catch {
      alert('Erro inesperado de rede.');
    }
  };

  // Filtragem dos Usuários
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const term = searchTerm.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(term);
      const matchEmail = u.email.toLowerCase().includes(term);
      const matchCpf = (u.cpf || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
      const matchCargo = (u.cargo || '').toLowerCase().includes(term);

      const matchesSearch = !searchTerm || matchName || matchEmail || matchCpf || matchCargo;
      const matchesDepto = selectedDepto === 'TODOS' || u.departamento === selectedDepto;
      const matchesRole = selectedRole === 'TODOS' || u.role === selectedRole;

      return matchesSearch && matchesDepto && matchesRole;
    });
  }, [usuarios, searchTerm, selectedDepto, selectedRole]);

  const departamentos = [
    'TODOS',
    'Atendimento',
    'Registro',
    'Financeiro',
    'RH',
    'Administração',
    'TI',
    'Indisponibilidade',
    'Intimação',
    'Ofício',
    'Impressão/Arquivo',
  ];

  return (
    <div className="space-y-4">
      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/8 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por Nome, E-mail, CPF ou Cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#070A12] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-hidden focus:border-amber-400/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#070A12] border border-white/10 rounded-xl px-3 py-1 text-xs">
            <Building className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedDepto}
              onChange={(e) => setSelectedDepto(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
            >
              {departamentos.map((d) => (
                <option key={d} value={d} className="bg-[#0A0F1E] text-white">
                  Depto: {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#070A12] border border-white/10 rounded-xl px-3 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="TODOS" className="bg-[#0A0F1E]">Função: Todas</option>
              <option value="MASTER" className="bg-[#0A0F1E]">MASTER</option>
              <option value="ADMIN" className="bg-[#0A0F1E]">ADMIN</option>
              <option value="RH" className="bg-[#0A0F1E]">RH</option>
              <option value="USER" className="bg-[#0A0F1E]">USER</option>
              <option value="COLABORADOR" className="bg-[#0A0F1E]">COLABORADOR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-x-auto rounded-2xl border border-white/12">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/12 bg-[#0B1020] text-[11px] font-bold uppercase tracking-[0.16em] text-white/58">
              <th className="p-3 pl-5 sm:p-4">Colaborador / Nome</th>
              <th className="p-3 sm:p-4">E-mail</th>
              <th className="p-3 sm:p-4">CPF (Validação RH)</th>
              <th className="p-3 sm:p-4">Departamento</th>
              <th className="p-3 sm:p-4">Função</th>
              <th className="p-3 sm:p-4">Cargo</th>
              <th className="p-3 sm:p-4">Status</th>
              <th className="p-3 pr-5 text-right sm:p-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 font-medium text-white/80">
            {filteredUsers.map((u) => {
              const isMaster = u.role === 'MASTER' || u.email === 'admin@fiorix.com.br';
              const isRevealed = Boolean(revealedCpfs[u.id]);

              return (
                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 pl-5 sm:p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600/40 to-purple-600/40 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                        {u.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.name || 'Sem nome'}</span>
                          {isMaster && (
                            <span
                              title="Usuário MASTER protegido - não pode ser alterado"
                              className="cursor-help"
                            >
                              🔒
                            </span>
                          )}
                        </div>
                        {u.ramal && (
                          <div className="text-[10px] text-white/40">Ramal: {u.ramal}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 sm:p-4 text-white/70 font-mono text-[11px]">
                    {u.email}
                  </td>

                  {/* CPF com Reveal Eye */}
                  <td className="p-3 sm:p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/90">
                        {maskCpfDisplay(u.cpf, isRevealed)}
                      </span>
                      {u.cpf && (
                        <button
                          type="button"
                          onClick={() => toggleRevealCpf(u.id)}
                          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                          title={isRevealed ? 'Ocultar CPF' : 'Revelar CPF'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Departamento Badge */}
                  <td className="p-3 sm:p-4">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${getDeptoBadge(u.departamento)}`}>
                      {u.departamento || 'Geral'}
                    </span>
                  </td>

                  {/* Função */}
                  <td className="p-3 sm:p-4">
                    {isMaster ? (
                      <span
                        title="Usuário MASTER protegido - não pode ser alterado"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 font-extrabold text-[10px] font-mono tracking-wider shadow-xs shadow-amber-500/20"
                      >
                        <Lock className="w-3 h-3 text-amber-300" />
                        MASTER
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={updatingRoleId === u.id}
                        onChange={(e) =>
                          onSelectRole(
                            u,
                            e.target.value as 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN'
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-hidden focus:border-amber-400/50 cursor-pointer bg-[#0A0F1E] ${getRoleBadge(
                          u.role
                        )}`}
                      >
                        <option value="COLABORADOR">Colaborador</option>
                        <option value="USER">Usuário</option>
                        <option value="RH">RH</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    )}
                  </td>

                  {/* Cargo */}
                  <td className="p-3 sm:p-4 text-white/70 text-xs capitalize">
                    {u.cargo || 'auxiliar'}
                  </td>

                  {/* Status */}
                  <td className="p-3 sm:p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'inativo'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'inativo' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      {u.status === 'inativo' ? 'Inativo' : 'Ativo'}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="p-3 pr-5 text-right sm:p-4 whitespace-nowrap">
                    {isMaster ? (
                      <span
                        title="Usuário MASTER protegido - não pode ser alterado"
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300 inline-flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" /> Intocável
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-xs text-white hover:bg-white/[0.08] transition-colors"
                          title="Editar Nome e CPF"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(u)}
                          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                          title="Resetar Senha"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded-lg border p-1.5 text-xs transition-colors ${
                            u.status === 'inativo'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                          }`}
                          title={u.status === 'inativo' ? 'Ativar Colaborador' : 'Desativar Colaborador'}
                        >
                          {u.status === 'inativo' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Editar Nome & CPF */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Editar Colaborador
              </h3>
              <button
                onClick={() => setEditUser(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  modalMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  CPF (Validação 1-para-1 do RH)
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={editCpf}
                  onChange={(e) => setEditCpf(formatCpfMask(e.target.value))}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400/50 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 text-white text-xs font-bold shadow-md hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetar Senha */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Resetar Senha de Acesso
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/70">
              Redefina a senha de acesso para o colaborador{' '}
              <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email}):
            </p>

            {modalMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  modalMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-white/60 mb-1">
                  Nova Senha (Mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/12 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-cyan-400/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Confirmar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
