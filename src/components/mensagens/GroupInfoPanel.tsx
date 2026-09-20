'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Users, Shield, Link2, Copy, Check, RefreshCw, Trash2, Plus,
  Crown, UserMinus, ChevronDown, QrCode, Lock, Unlock, Edit3, Loader2,
} from 'lucide-react';
import {
  SerializedConversation,
  updateGroupSettings, updateGroupPrivacy,
  removeMemberFromConversation, changeMemberRole,
  generateGroupInviteLink, revokeGroupInviteLink, getGroupInviteLinks,
  addMemberToConversation, getAvailableUsers,
} from '@/app/actions/mensagens';
import { toast } from 'sonner';

interface GroupInfoPanelProps {
  conversation: SerializedConversation;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

type Tab = 'members' | 'links' | 'settings';

export function GroupInfoPanel({
  conversation,
  currentUserId,
  isAdmin,
  onClose,
  onUpdated,
}: GroupInfoPanelProps) {
  const [tab, setTab] = useState<Tab>('members');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Settings
  const [titulo, setTitulo] = useState(conversation.titulo);
  const [descricao, setDescricao] = useState(conversation.descricao ?? '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [permEnvio, setPermEnvio] = useState<'ALL' | 'ADMIN_ONLY'>(
    (conversation.permissaoEnvio as 'ALL' | 'ADMIN_ONLY') ?? 'ALL'
  );
  const [permEdicao, setPermEdicao] = useState<'ALL' | 'ADMIN_ONLY'>(
    (conversation.permissaoEdicaoDados as 'ALL' | 'ADMIN_ONLY') ?? 'ALL'
  );

  // Invite links
  const [links, setLinks] = useState<
    { token: string; usageCount: number; maxUses: number | null; expiresAt: string | null; createdAt: string }[]
  >([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'links' && isAdmin) {
      loadLinks();
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    if (!showAddMember) return;
    getAvailableUsers(conversation.id, addSearch).then((res) => {
      if (res.success && res.users) setAvailableUsers(res.users);
    });
  }, [showAddMember, addSearch, conversation.id]);

  const loadLinks = async () => {
    setLoadingLinks(true);
    const res = await getGroupInviteLinks(conversation.id);
    if (res.success && res.links) setLinks(res.links);
    setLoadingLinks(false);
  };

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/mensagens/convite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    const res = await generateGroupInviteLink(conversation.id);
    if (res.success) {
      toast.success('Link gerado com sucesso!');
      await loadLinks();
    } else {
      toast.error(res.error ?? 'Falha ao gerar link.');
    }
    setGeneratingLink(false);
  };

  const handleRevokeLink = async (token: string) => {
    const res = await revokeGroupInviteLink(token);
    if (res.success) {
      toast.success('Link revogado.');
      await loadLinks();
    } else {
      toast.error(res.error ?? 'Falha ao revogar.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const [r1, r2] = await Promise.all([
      updateGroupSettings(conversation.id, { titulo, descricao }),
      updateGroupPrivacy(conversation.id, { permissaoEnvio: permEnvio, permissaoEdicaoDados: permEdicao }),
    ]);
    if (r1.success && r2.success) {
      toast.success('Configurações salvas.');
      onUpdated?.();
    } else {
      toast.error(r1.error ?? r2.error ?? 'Falha ao salvar.');
    }
    setSavingSettings(false);
  };

  const handleRemoveMember = async (userId: string) => {
    const res = await removeMemberFromConversation(conversation.id, userId);
    if (res.success) {
      toast.success('Participante removido.');
      onUpdated?.();
    } else {
      toast.error(res.error ?? 'Falha ao remover.');
    }
  };

  const handleChangeRole = async (userId: string, papel: 'ADMIN' | 'MEMBER') => {
    const res = await changeMemberRole(conversation.id, userId, papel);
    if (res.success) {
      toast.success(papel === 'ADMIN' ? 'Promovido a admin.' : 'Rebaixado a membro.');
      onUpdated?.();
    } else {
      toast.error(res.error ?? 'Falha.');
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingId(userId);
    const res = await addMemberToConversation(conversation.id, userId);
    if (res.success) {
      toast.success('Participante adicionado.');
      onUpdated?.();
      setShowAddMember(false);
    } else {
      toast.error(res.error ?? 'Falha ao adicionar.');
    }
    setAddingId(null);
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'members', label: 'Membros', icon: Users },
    ...(isAdmin ? [
      { key: 'links' as Tab, label: 'Convites', icon: Link2 },
      { key: 'settings' as Tab, label: 'Config.', icon: Shield },
    ] : []),
  ];

  return (
    <div className="w-72 border-l border-white/10 bg-[#0d1117] flex flex-col shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Info do Grupo</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition border-b-2 ${
              tab === key
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {/* ── MEMBROS ── */}
        {tab === 'members' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {conversation.membros.length} participante{conversation.membros.length !== 1 ? 's' : ''}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showAddMember && (
              <div className="mb-3">
                <input
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Pesquisar usuário…"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
                {availableUsers.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {availableUsers.slice(0, 5).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleAddMember(u.id)}
                        disabled={addingId === u.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs text-slate-300 transition"
                      >
                        {addingId === u.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3 text-emerald-400" />
                        )}
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {conversation.membros.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white border border-white/10 shrink-0">
                  {m.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-500">{m.role}</p>
                </div>
                {m.papel === 'ADMIN' && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Admin
                  </span>
                )}
                {isAdmin && m.userId !== currentUserId && (
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition shrink-0">
                    <button
                      onClick={() => handleChangeRole(m.userId, m.papel === 'ADMIN' ? 'MEMBER' : 'ADMIN')}
                      title={m.papel === 'ADMIN' ? 'Rebaixar' : 'Promover a Admin'}
                      className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
                    >
                      <Crown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      title="Remover"
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <UserMinus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── LINKS DE CONVITE ── */}
        {tab === 'links' && isAdmin && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Links Ativos</p>
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50"
              >
                {generatingLink ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Novo link
              </button>
            </div>

            <div className="text-[10px] text-slate-500 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
              <strong className="text-amber-400">Atenção:</strong> Possuir o link não garante acesso automático. 
              O usuário deve estar autenticado e pertencer à sua organização.
            </div>

            {loadingLinks ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-4">Nenhum link ativo.</p>
            ) : (
              links.map((l) => (
                <div key={l.token} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-[10px] text-emerald-400 bg-black/20 px-2 py-0.5 rounded font-mono truncate flex-1">
                      {l.token.substring(0, 16)}…
                    </code>
                    <button
                      onClick={() => handleCopyLink(l.token)}
                      className="p-1 rounded text-slate-400 hover:text-emerald-400 transition"
                    >
                      {copiedToken === l.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleRevokeLink(l.token)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                      title="Revogar link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-3 text-[9px] text-slate-500">
                    <span>{l.usageCount} uso{l.usageCount !== 1 ? 's' : ''}{l.maxUses ? ` / ${l.maxUses}` : ''}</span>
                    {l.expiresAt && (
                      <span>Expira: {new Date(l.expiresAt).toLocaleDateString('pt-BR')}</span>
                    )}
                    <span>Criado: {new Date(l.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── CONFIGURAÇÕES ── */}
        {tab === 'settings' && isAdmin && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Nome do grupo</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/60"
                maxLength={80}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/60 resize-none"
                maxLength={500}
              />
            </div>

            <div className="border-t border-white/10 pt-3 space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Permissões</p>

              {[
                {
                  label: 'Quem pode enviar mensagens',
                  value: permEnvio,
                  onChange: (v: string) => setPermEnvio(v as 'ALL' | 'ADMIN_ONLY'),
                },
                {
                  label: 'Quem pode editar dados do grupo',
                  value: permEdicao,
                  onChange: (v: string) => setPermEdicao(v as 'ALL' | 'ADMIN_ONLY'),
                },
              ].map(({ label, value, onChange }) => (
                <div key={label}>
                  <label className="text-[10px] text-slate-500 block mb-1">{label}</label>
                  <div className="flex gap-2">
                    {(['ALL', 'ADMIN_ONLY'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => onChange(opt)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold border transition ${
                          value === opt
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt === 'ALL' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {opt === 'ALL' ? 'Todos' : 'Só Admins'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Salvar Configurações
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
