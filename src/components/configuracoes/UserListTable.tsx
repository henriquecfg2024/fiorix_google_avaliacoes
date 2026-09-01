'use client';

import React, { useState } from 'react';
import { resetUserPassword, updateUserRole, updateUserName } from '@/app/actions/admin';
import { ShieldCheck, ShieldAlert, Key, Edit3, X, AlertTriangle } from 'lucide-react';

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
}

type AppRole = 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN' | 'MASTER';

export function UserListTable({
  usuarios,
  currentUserRole = 'USER',
}: {
  usuarios: UserItem[];
  currentUserRole?: string;
}) {
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editNameUser, setEditNameUser] = useState<UserItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [nameMessage, setNameMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Modal de confirmação de alteração de função com elevação de privilégio
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: UserItem;
    newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN';
    impact: string;
  } | null>(null);

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
        return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
      default:
        return 'bg-white/5 text-white/70 border-white/10';
    }
  };

  const getRoleImpact = (oldRole: string, newRole: string): string | null => {
    if (newRole === 'ADMIN') {
      return 'O usuário terá acesso administrativo completo sobre usuários e configurações da organização.';
    }
    if (newRole === 'RH' && (oldRole === 'COLABORADOR' || oldRole === 'USER')) {
      return 'O usuário terá acesso à gestão de Comunicados, Férias e Holerites de todos os colaboradores.';
    }
    if (newRole === 'USER' && oldRole === 'COLABORADOR') {
      return 'O usuário terá acesso operacional ampliado aos módulos de BI, Avaliações e Relatórios.';
    }
    return null;
  };

  const onSelectRole = (user: UserItem, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN') => {
    if (user.role === newRole) return;

    const impact = getRoleImpact(user.role, newRole);
    if (impact) {
      setPendingRoleChange({ user, newRole, impact });
    } else {
      executeRoleChange(user.id, newRole);
    }
  };

  const executeRoleChange = async (userId: string, newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN') => {
    setUpdatingRoleId(userId);
    try {
      const res = await updateUserRole(userId, newRole);
      if (res?.error) {
        alert(res.error);
      }
    } catch (err) {
      alert('Erro ao alterar a função do usuário.');
    } finally {
      setUpdatingRoleId(null);
      setPendingRoleChange(null);
    }
  };

  const handleOpenNameModal = (user: UserItem) => {
    if (user.role === 'MASTER' && currentUserRole !== 'MASTER') {
      alert('Apenas usuários MASTER podem alterar contas MASTER.');
      return;
    }
    setEditNameUser(user);
    setNameInput(user.name || '');
    setNameMessage(null);
  };

  const handleCloseNameModal = () => {
    setEditNameUser(null);
    setNameInput('');
    setNameMessage(null);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNameUser) return;

    setLoading(true);
    setNameMessage(null);

    try {
      const res = await updateUserName(editNameUser.id, nameInput);
      if (res?.error) {
        setNameMessage({ type: 'error', text: res.error });
      } else {
        setNameMessage({ type: 'success', text: 'Nome atualizado com sucesso!' });
        setTimeout(() => {
          handleCloseNameModal();
        }, 1200);
      }
    } catch (err) {
      setNameMessage({ type: 'error', text: 'Erro ao atualizar o nome.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user: UserItem) => {
    if (user.role === 'MASTER' && currentUserRole !== 'MASTER') {
      alert('Apenas usuários MASTER podem alterar contas MASTER.');
      return;
    }
    setSelectedUser(user);
    setNewPassword('');
    setMessage(null);
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setNewPassword('');
    setMessage(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await resetUserPassword(selectedUser.id, newPassword);
      if (res?.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({
          type: 'success',
          text: `Senha de ${selectedUser.name || selectedUser.email} alterada com sucesso!`,
        });
        setTimeout(() => {
          handleCloseModal();
        }, 1800);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Erro ao redefinir a senha.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-white/12">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/12 bg-[#0B1020] text-[11px] font-bold uppercase tracking-[0.16em] text-white/58">
              <th className="p-3 pl-5 sm:p-4">Nome</th>
              <th className="p-3 sm:p-4">E-mail</th>
              <th className="p-3 sm:p-4">Função</th>
              <th className="p-3 sm:p-4">Data de Cadastro</th>
              <th className="p-3 pr-5 text-right sm:p-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 font-medium text-white/80">
            {usuarios.map((u) => {
              const isMasterTarget = u.role === 'MASTER';
              const canModifyMaster = currentUserRole === 'MASTER';
              const isProtected = isMasterTarget && !canModifyMaster;

              return (
                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 pl-5 font-bold text-white sm:p-4">
                    {u.name || 'Sem nome'}
                  </td>
                  <td className="p-3 sm:p-4 text-white/70">{u.email}</td>
                  <td className="p-3 sm:p-4">
                    {isMasterTarget ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-300 font-mono">
                        MASTER
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
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
                          <option value="COLABORADOR">Colaborador (COLABORADOR)</option>
                          <option value="USER">Usuário (USER)</option>
                          <option value="RH">RH (RH)</option>
                          <option value="ADMIN">Admin (ADMIN)</option>
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="p-3 sm:p-4 text-white/60">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-3 pr-5 text-right sm:p-4">
                    {isProtected ? (
                      <span className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs italic text-white/50">
                        🔒 Protegido (MASTER)
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenNameModal(u)}
                          className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08] cursor-pointer"
                        >
                          ✏️ Editar Nome
                        </button>
                        <button
                          onClick={() => handleOpenModal(u)}
                          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/18 cursor-pointer"
                        >
                          🔑 Resetar Senha
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

      {/* Modal de Confirmação de Elevação de Função (Privilege Escalation) */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.6)] space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Confirmar Alteração de Função</h3>
              </div>
              <button
                onClick={() => setPendingRoleChange(null)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Você está alterando os privilégios de acesso do usuário{' '}
              <strong className="text-white">
                {pendingRoleChange.user.name || pendingRoleChange.user.email}
              </strong>
              .
            </p>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Função Atual:</span>
                <span className="font-bold text-slate-300">{pendingRoleChange.user.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Nova Função:</span>
                <span className="font-bold text-amber-300">{pendingRoleChange.newRole}</span>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-amber-200/80 leading-relaxed">
                <strong>Impacto:</strong> {pendingRoleChange.impact}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingRoleChange(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  executeRoleChange(pendingRoleChange.user.id, pendingRoleChange.newRole)
                }
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer"
              >
                {loading ? 'Confirmando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reset de Senha */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.6)] space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Resetar Senha
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Digite a nova senha para o usuário{' '}
              <strong className="text-white">
                {selectedUser.name || selectedUser.email}
              </strong>
              .
            </p>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  message.type === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  Nova Senha *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Digite a nova senha (mín. 6 caracteres)"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/12 bg-[#070A12] text-xs text-white placeholder:text-white/30 focus:outline-hidden focus:border-cyan-400/50"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg cursor-pointer"
                >
                  {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Nome */}
      {editNameUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-[#0B1020] border border-white/12 rounded-[24px] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.6)] space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Editar Nome do Usuário
              </h3>
              <button
                onClick={handleCloseNameModal}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Altere o nome cadastrado para o e-mail{' '}
              <strong className="text-white">{editNameUser.email}</strong>.
            </p>

            {nameMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  nameMessage.type === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {nameMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  placeholder="Digite o nome correto"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/12 bg-[#070A12] text-xs text-white placeholder:text-white/30 focus:outline-hidden focus:border-indigo-400/50"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseNameModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg cursor-pointer"
                >
                  {loading ? 'Salvando...' : 'Salvar Nome'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
