'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Smile, X, Reply, Trash2, FileText, Download,
  Users, ArrowLeft, Loader2, Shield, Search, Plus,
  Edit3, ChevronDown, Info, Lock, AlertTriangle,
  MoreVertical, Check, CheckCheck, ExternalLink,
} from 'lucide-react';
import {
  SerializedConversation, SerializedMessage,
  sendMessage, deleteMessage, toggleReaction,
  addMemberToConversation, getAvailableUsers,
  editMessage,
} from '@/app/actions/mensagens';
import { GroupInfoPanel } from './GroupInfoPanel';

interface ChatAreaProps {
  conversation: SerializedConversation;
  messages: SerializedMessage[];
  loading?: boolean;
  currentUserId: string;
  currentUserName?: string;
  typingUsers?: string[];
  onBackToConversations?: () => void;
  onMessageSent: (message: SerializedMessage) => void;
  onMessageDeleted: (messageId: string) => void;
  onReactionToggled: (messageId: string, emoji: string) => void;
  onConversationUpdated?: () => void;
  onDraftSave?: (text: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '👏', '😂', '✅', '⚠️', '🔒', '🚀'];

// Gera cor de avatar determinística
function avatarColor(name: string) {
  const colors = [
    'bg-violet-600', 'bg-indigo-600', 'bg-blue-600', 'bg-cyan-600',
    'bg-teal-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Hoje';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  return '📎';
}

export function ChatArea({
  conversation,
  messages,
  loading,
  currentUserId,
  currentUserName,
  typingUsers = [],
  onBackToConversations,
  onMessageSent,
  onMessageDeleted,
  onReactionToggled,
  onConversationUpdated,
  onDraftSave,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<SerializedMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Context menu de mensagem
  const [contextMenu, setContextMenu] = useState<{
    msg: SerializedMessage; x: number; y: number;
  } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Painel lateral (info do grupo, busca)
  const [sidePanel, setSidePanel] = useState<'none' | 'info' | 'search'>('none');
  const [searchQuery, setSearchQuery] = useState('');

  // Adicionar membro
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberUsers, setAddMemberUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  // Scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs p/ fechar menus
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Inicializa draft
  useEffect(() => {
    if (conversation.draft && !inputText) {
      setInputText(conversation.draft);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputText]);

  // Salva draft ao sair / digitar (debounce)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (val: string) => {
    setInputText(val);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      onDraftSave?.(val);
    }, 1500);
  };

  // Carrega usuários para adicionar membro
  useEffect(() => {
    if (!showAddMember) return;
    getAvailableUsers(conversation.id, addMemberSearch).then((res) => {
      if (res.success && res.users) setAddMemberUsers(res.users);
    });
  }, [showAddMember, addMemberSearch, conversation.id]);

  // ── Enviar mensagem de texto ─────────────────────────────────────────
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      const res = await sendMessage({
        conversationId: conversation.id,
        conteudo: text,
        replyToId: replyTo?.id,
      });

      if (res.success && res.message) {
        setInputText('');
        setReplyTo(null);
        onDraftSave?.('');
        onMessageSent(res.message);
      }
    } catch (err) {
      console.error('Erro ao enviar:', err);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, conversation.id, replyTo, onMessageSent, onDraftSave]);

  // ── Upload de arquivo ─────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_MB = 25;
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`Arquivo muito grande. Máximo: ${MAX_MB}MB.`);
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversation.id);

      const resp = await fetch('/api/mensagens/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setUploadError(data.error || 'Falha no upload.');
        return;
      }

      const res = await sendMessage({
        conversationId: conversation.id,
        conteudo: file.name,
        attachmentData: {
          nomeArquivo: file.name,
          tamanhoBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          storagePath: data.storagePath,
        },
      });

      if (res.success && res.message) onMessageSent(res.message);
    } catch (err) {
      setUploadError('Erro no upload. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [conversation.id, onMessageSent]);

  // ── Deletar mensagem ─────────────────────────────────────────────────
  const handleDelete = useCallback(async (msgId: string) => {
    setContextMenu(null);
    const res = await deleteMessage(msgId);
    if (res.success) onMessageDeleted(msgId);
  }, [onMessageDeleted]);

  // ── Editar mensagem ───────────────────────────────────────────────────
  const handleEditSave = useCallback(async (msgId: string) => {
    if (!editText.trim()) return;
    const res = await editMessage(msgId, editText.trim());
    if (res.success) {
      // A atualização chega via Realtime; limpa estado local
      setEditingId(null);
      setEditText('');
    }
  }, [editText]);

  // ── Reação ────────────────────────────────────────────────────────────
  const handleReaction = useCallback(async (msgId: string, emoji: string) => {
    setContextMenu(null);
    await toggleReaction(msgId, emoji);
    onReactionToggled(msgId, emoji);
  }, [onReactionToggled]);


  // ── Permissão de envio (grupo) ────────────────────────────────────────
  const canSend =
    conversation.tipo !== 'GROUP' ||
    conversation.permissaoEnvio !== 'ADMIN_ONLY' ||
    conversation.membros.find((m) => m.userId === currentUserId)?.papel === 'ADMIN';

  // ── Agrupamento de mensagens por data ─────────────────────────────────
  const grouped: Array<{ date: string; msgs: SerializedMessage[] }> = [];
  let currentDate = '';
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== currentDate) {
      currentDate = d;
      grouped.push({ date: d, msgs: [] });
    }
    grouped[grouped.length - 1].msgs.push(msg);
  }

  // Filtro de busca inline
  const searchFiltered = searchQuery
    ? messages.filter((m) =>
        !m.isDeleted && m.conteudo.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const isGroup = conversation.tipo === 'GROUP';
  const isAdmin =
    isGroup && conversation.membros.find((m) => m.userId === currentUserId)?.papel === 'ADMIN';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── MAIN CHAT COLUMN ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b1120]">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-[#111827] shrink-0">
          {onBackToConversations && (
            <button
              onClick={onBackToConversations}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/10 shrink-0 ${avatarColor(conversation.titulo)}`}
          >
            {isGroup ? <Users className="w-4 h-4" /> : initials(conversation.titulo)}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{conversation.titulo}</h2>
            {isGroup ? (
              <p className="text-[10px] text-slate-400 truncate">
                {conversation.membros.length} participante{conversation.membros.length !== 1 ? 's' : ''}
              </p>
            ) : (
              typingUsers.length > 0 && (
                <p className="text-[10px] text-emerald-400 animate-pulse">digitando…</p>
              )
            )}
          </div>

          {/* Ações do header */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidePanel(sidePanel === 'search' ? 'none' : 'search')}
              className={`p-1.5 rounded-lg transition ${
                sidePanel === 'search' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            {isGroup && (
              <button
                onClick={() => setSidePanel(sidePanel === 'info' ? 'none' : 'info')}
                className={`p-1.5 rounded-lg transition ${
                  sidePanel === 'info' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Busca inline */}
        {sidePanel === 'search' && (
          <div className="px-4 py-2 border-b border-white/10 bg-[#0d1117]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar nesta conversa…"
                className="w-full pl-8 pr-4 py-1.5 text-xs rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            {searchFiltered && (
              <p className="text-[10px] text-slate-500 mt-1">
                {searchFiltered.length} resultado{searchFiltered.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {uploadError}
            <button onClick={() => setUploadError(null)} className="ml-auto">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Mensagens ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : (searchFiltered ?? []).length === 0 && searchQuery ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Nenhuma mensagem encontrada.
            </div>
          ) : (
            <>
              {(searchFiltered ? [{ date: 'Resultados', msgs: searchFiltered }] : grouped).map(
                ({ date, msgs }) => (
                  <div key={date}>
                    {/* Separador de data */}
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-[10px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                        {date}
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>

                    {msgs.map((msg, idx) => {
                      const isMine = msg.remetenteId === currentUserId;
                      const prevMsg = msgs[idx - 1];
                      const isGrouped =
                        prevMsg?.remetenteId === msg.remetenteId &&
                        new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 120_000;
                      const color = avatarColor(msg.remetenteNome);

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2 group ${isMine ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!msg.isDeleted) setContextMenu({ msg, x: e.clientX, y: e.clientY });
                          }}
                        >
                          {/* Avatar (outros) */}
                          {!isMine && !isGrouped && (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/10 shrink-0 self-end ${color}`}
                            >
                              {initials(msg.remetenteNome)}
                            </div>
                          )}
                          {!isMine && isGrouped && <div className="w-8 shrink-0" />}

                          {/* Balão */}
                          <div
                            className={`max-w-[70%] relative ${
                              isMine ? 'items-end' : 'items-start'
                            } flex flex-col`}
                          >
                            {/* Remetente (grupos) */}
                            {isGroup && !isMine && !isGrouped && (
                              <span className="text-[10px] font-semibold text-emerald-400 ml-1 mb-0.5">
                                {msg.remetenteNome}
                              </span>
                            )}


                            {/* Resposta */}
                            {msg.respostaA && (
                              <div
                                className={`mb-1 mx-1 px-2 py-1 rounded-lg border-l-2 border-emerald-500 bg-white/[0.04] text-[10px] text-slate-400 cursor-pointer max-w-full`}
                              >
                                <p className="font-semibold text-emerald-400">{msg.respostaA.remetenteNome}</p>
                                <p className="truncate">{msg.respostaA.conteudo}</p>
                              </div>
                            )}

                            {/* Conteúdo do balão */}
                            {editingId === msg.id ? (
                              <div className="w-full">
                                <textarea
                                  autoFocus
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full bg-slate-800 border border-emerald-500/50 text-white text-xs rounded-lg px-3 py-2 focus:outline-none resize-none"
                                  rows={2}
                                />
                                <div className="flex gap-2 mt-1 justify-end">
                                  <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400 hover:text-white">
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => handleEditSave(msg.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed break-words relative ${
                                  isMine
                                    ? 'bg-emerald-600/25 border border-emerald-500/30 text-white rounded-br-sm'
                                    : 'bg-white/[0.06] border border-white/10 text-slate-100 rounded-bl-sm'
                                } ${msg.isDeleted ? 'opacity-50 italic' : ''}`}
                              >
                                <span className={msg.isDeleted ? 'text-slate-500' : ''}>
                                  {msg.conteudo}
                                </span>

                                {/* Anexos */}
                                {!msg.isDeleted && msg.anexos.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {msg.anexos.map((a) => (
                                      <div
                                        key={a.id}
                                        className="flex items-center gap-2 bg-black/20 rounded-lg px-2.5 py-2 border border-white/10"
                                      >
                                        <span className="text-base">{mimeIcon(a.mimeType)}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-medium text-white truncate">{a.nomeArquivo}</p>
                                          <p className="text-[10px] text-slate-400">{humanFileSize(a.tamanhoBytes)}</p>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Download via signed URL
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-emerald-400"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Timestamp + status */}
                                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                  {msg.editedAt && (
                                    <span className="text-[9px] text-slate-500 italic">editado</span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-mono">{formatTime(msg.createdAt)}</span>
                                  {isMine && <CheckCheck className="w-3 h-3 text-emerald-400" />}
                                </div>
                              </div>
                            )}

                            {/* Reações */}
                            {!msg.isDeleted && msg.reacoes.length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'} px-1`}>
                                {msg.reacoes.map((r) => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => handleReaction(msg.id, r.emoji)}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition ${
                                      r.hasReacted
                                        ? 'bg-emerald-600/20 border-emerald-500/50 text-white'
                                        : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10'
                                    }`}
                                  >
                                    {r.emoji} <span>{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ações rápidas hover (minha mensagem) */}
                          {!msg.isDeleted && isMine && (
                            <div className="opacity-0 group-hover:opacity-100 transition self-center flex gap-0.5">
                              <button
                                onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {!msg.isDeleted && !isMine && (
                            <div className="opacity-0 group-hover:opacity-100 transition self-center flex gap-0.5 order-first">
                              <button
                                onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Indicador de digitação */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400">
                    {initials(typingUsers[0])}
                  </div>
                  <div className="bg-white/[0.06] rounded-2xl px-3 py-2 text-xs text-slate-400 flex items-center gap-1">
                    {typingUsers[0]} está digitando
                    <span className="flex gap-0.5 ml-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── Barra de Composição ─────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/10 bg-[#111827] px-3 pb-3 pt-2">
          {/* Banner: sem permissão de envio */}
          {!canSend && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Somente administradores podem enviar mensagens neste grupo.
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/30">
              <Reply className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-emerald-400">{replyTo.remetenteNome}</p>
                <p className="text-[10px] text-slate-400 truncate">{replyTo.conteudo}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

            <form
              onSubmit={handleSend}
              className="flex items-end gap-2"
            >
              {/* Attach */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !canSend}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>

              {/* Textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={canSend ? 'Mensagem…' : 'Sem permissão de envio'}
                  disabled={!canSend}
                  className="w-full bg-slate-900/80 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/60 placeholder-slate-500 disabled:opacity-40 max-h-40 leading-relaxed"
                />
              </div>

              {/* Enviar */}
              <button
                type="submit"
                disabled={!inputText.trim() || sending || !canSend}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition shadow"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* ── PAINEL LATERAL (Info do Grupo) ──────────────────────────── */}
      {sidePanel === 'info' && isGroup && (
        <GroupInfoPanel
          conversation={conversation}
          currentUserId={currentUserId}
          isAdmin={isAdmin ?? false}
          onClose={() => setSidePanel('none')}
          onUpdated={onConversationUpdated}
        />
      )}

      {/* ── CONTEXT MENU ───────────────────────────────────────────── */}
      {contextMenu && (
        <div
          ref={contextRef}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-[#1a2236] border border-white/15 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
        >
          {/* Emojis rápidos */}
          <div className="flex gap-1 px-2 pt-1.5 pb-1 border-b border-white/10">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => handleReaction(contextMenu.msg.id, e)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-base transition"
              >
                {e}
              </button>
            ))}
          </div>

          {/* Ações */}
          {[
            { icon: Reply, label: 'Responder', action: () => { setReplyTo(contextMenu.msg); setContextMenu(null); textareaRef.current?.focus(); } },
            ...(contextMenu.msg.remetenteId === currentUserId ? [
              { icon: Edit3, label: 'Editar', action: () => { setEditingId(contextMenu.msg.id); setEditText(contextMenu.msg.conteudo); setContextMenu(null); } },
              { icon: Trash2, label: 'Apagar', action: () => handleDelete(contextMenu.msg.id), danger: true },
            ] : []),
          ].map(({ icon: Icon, label, action, danger }: any) => (
            <button
              key={label}
              onClick={action}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition ${
                danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
