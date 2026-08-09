'use client';

import React, { useState } from 'react';
import { resetUserPassword, updateUserRole, updateUserName } from '@/app/actions/admin';
import { formatDate } from '@/lib/format';

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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Nome</th>
              <th style={{ padding: '12px 16px' }}>E-mail</th>
              <th style={{ padding: '12px 16px' }}>Função</th>
              <th style={{ padding: '12px 16px' }}>Data de Cadastro</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const isMasterTarget = u.role === 'MASTER';
              const canModifyMaster = currentUserRole === 'MASTER';
              const isProtected = isMasterTarget && !canModifyMaster;

              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {u.name || 'Sem nome'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{u.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {isMasterTarget ? (
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                        MASTER
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={updatingRoleId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as 'ADMIN' | 'USER')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          background: u.role === 'ADMIN' ? '#dbeafe' : '#f1f5f9',
                          color: u.role === 'ADMIN' ? '#1e40af' : '#334155',
                          border: u.role === 'ADMIN' ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="USER">USER (Usuário)</option>
                        <option value="ADMIN">ADMIN (Administrador)</option>
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {isProtected ? (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        🔒 Protegido (MASTER)
                      </span>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenNameModal(u)}
                          style={{
                            background: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.2s'
                          }}
                        >
                          ✏️ Editar Nome
                        </button>
                        <button
                          onClick={() => handleOpenModal(u)}
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.2s'
                          }}
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

