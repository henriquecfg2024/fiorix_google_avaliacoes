'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  User,
  Users,
  MessageSquare,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import {
  getAvailableUsers,
  createDirectConversation,
  createGroupConversation,
} from '@/app/actions/mensagens';

interface NovaConversaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NovaConversaModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NovaConversaModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [search, setSearch] = useState('');

  // Estados do Grupo
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha modal ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoadingUsers(true);
      getAvailableUsers()
        .then((res) => {
          if (res.success && res.users) {
            setUsers(res.users);
          } else {
            setError(res.error || 'Não foi possível carregar os contatos.');
          }
        })
        .catch(() => setError('Erro de conexão ao buscar contatos.'))
        .finally(() => setLoadingUsers(false));
    } else {
      setSearch('');
      setGroupTitle('');
      setGroupDesc('');
      setSelectedUserIds([]);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartDirect = async (targetUserId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await createDirectConversation(targetUserId);
      if (res.success && res.conversationId) {
        onConversationCreated(res.conversationId);
        onClose();
      } else {
        setError(res.error || 'Falha ao iniciar conversa.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) {
      setError('Informe o título do grupo.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Selecione pelo menos um colega para o grupo.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await createGroupConversation({
        titulo: groupTitle,
        descricao: groupDesc,
        memberUserIds: selectedUserIds,
      });

      if (res.success && res.conversationId) {
        onConversationCreated(res.conversationId);
        onClose();
      } else {
        setError(res.error || 'Falha ao criar grupo.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111827] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#151C2F]">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Nova Conversa</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
              tab === 'direct'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Conversa Direta
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
              tab === 'group'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Criar Grupo
          </button>
        </div>

        {error && (
          <div className="p-3 mx-4 mt-3 text-xs rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
            {error}
          </div>
        )}

        {/* Tab 1: Conversa Direta */}
        {tab === 'direct' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar colega pelo nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 dark:bg-slate-900 dark:border-white/10 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {loadingUsers ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Carregando colegas...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhum colega encontrado com esse nome.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleStartDirect(u.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 dark:hover:bg-white/5 dark:hover:border-white/5 text-left transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300 transition">
                          {u.name}
                        </p>
                        <span className="text-[10px] uppercase font-mono text-slate-400">
                          {u.role}
                        </span>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Criar Grupo */}
        {tab === 'group' && (
          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Equipe de Registro, Diretoria, etc."
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 dark:bg-slate-900 dark:border-white/10 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Finalidade deste grupo..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 dark:bg-slate-900 dark:border-white/10 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Selecionar Participantes ({selectedUserIds.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl p-2 bg-slate-50 dark:bg-slate-950/40">
              {loadingUsers ? (
                <div className="py-8 flex justify-center text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                </div>
              ) : (
                users.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{u.name}</p>
                          <p className="text-[10px] text-slate-400">{u.role}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !groupTitle.trim() || selectedUserIds.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando Grupo...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    <span>Criar Grupo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
