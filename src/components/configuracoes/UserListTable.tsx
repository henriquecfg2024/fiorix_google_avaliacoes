'use client';

import React, { useState } from 'react';
import { resetUserPassword, updateUserRole, updateUserName } from '@/app/actions/admin';

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
}

export function UserListTable({
  usuarios,
  currentUserRole = 'USER'
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

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'USER') => {
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
        setMessage({ type: 'success', text: `Senha de ${selectedUser.name || selectedUser.email} alterada com sucesso!` });
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
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-300">
                        MASTER
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={updatingRoleId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as 'ADMIN' | 'USER')}
                        className="rounded-lg border border-white/12 bg-[#0A0F1E] px-2.5 py-1 text-xs font-semibold text-white focus:outline-hidden focus:border-amber-400/50"
                      >
                        <option value="USER">USER (Usuário)</option>
                        <option value="ADMIN">ADMIN (Administrador)</option>
                      </select>
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
                          className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
                        >
                          ✏️ Editar Nome
                        </button>
                        <button
                          onClick={() => handleOpenModal(u)}
                          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/18"
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

      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                🔑 Resetar Senha
              </h3>
              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
              Digite a nova senha para o usuário <strong>{selectedUser.name || selectedUser.email}</strong>.
            </p>

            {message && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  background: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                  color: message.type === 'error' ? '#991b1b' : '#166534'
                }}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Nova Senha *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Digite a nova senha (mín. 6 caracteres)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editNameUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                ✏️ Editar Nome do Usuário
              </h3>
              <button
                onClick={handleCloseNameModal}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
              Altere o nome cadastrado para o e-mail <strong>{editNameUser.email}</strong>.
            </p>

            {nameMessage && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  background: nameMessage.type === 'error' ? '#fee2e2' : '#dcfce7',
                  color: nameMessage.type === 'error' ? '#991b1b' : '#166534'
                }}
              >
                {nameMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveName}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  placeholder="Digite o nome correto"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseNameModal}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
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
