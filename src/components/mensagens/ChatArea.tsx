'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Smile, X, Reply, Trash2, FileText, Download,
  Users, ArrowLeft, Loader2, Shield, Search, Plus,
  Edit3, ChevronDown, Info, Lock, AlertTriangle,
  MoreVertical, Check, CheckCheck, ExternalLink, Clock,
  UploadCloud, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SerializedConversation, SerializedMessage,
  sendMessage, deleteMessage, toggleReaction,
  addMemberToConversation, getAvailableUsers,
  editMessage,
} from '@/app/actions/mensagens';
import { GroupInfoPanel } from './GroupInfoPanel';
import { MediaPreviewModal } from './MediaPreviewModal';

interface ChatAreaProps {
  conversation: SerializedConversation;
  messages: SerializedMessage[];
  loading?: boolean;
  currentUserId: string;
  currentUserName?: string;
  typingUsers?: string[];
  onBackToConversations?: () => void;
  onMessageSent: (message: SerializedMessage) => void;
  onMessageUpdate?: (tempId: string, message: SerializedMessage) => void;
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
  onMessageUpdate,
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

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Lightbox / Preview de Mídia e PDFs
  const [previewAnexo, setPreviewAnexo] = useState<SerializedMessage['anexos'][number] | null>(null);

  // Botão flutuante Rolar para o Fim com Contador
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

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

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
    setUnreadBelowCount(0);
    setShowScrollBottom(false);
    isAtBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 100;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollBottom(false);
      setUnreadBelowCount(0);
    } else {
      setShowScrollBottom(true);
    }
  }, []);

  // Auto-scroll e monitoramento de novas mensagens abaixo
  useEffect(() => {
    if (!loading) {
      if (isAtBottomRef.current) {
        scrollToBottom(false);
      } else {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.remetenteId !== currentUserId) {
          setUnreadBelowCount((c) => c + 1);
        }
      }
    }
  }, [messages, loading, currentUserId, scrollToBottom]);

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

  // ── Enviar mensagem de texto (Envio Otimista / 0ms de espera) ─────────
  const handleSend = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // 1. Limpa textarea e reseta altura instantaneamente (0ms)
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 2. Limpa rascunho instantaneamente
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    onDraftSave?.('');

    // 3. Monta mensagem otimista e exibe no chat instantaneamente (0ms)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const currentReply = replyTo;
    setReplyTo(null);

    const optimisticMsg: SerializedMessage = {
      id: tempId,
      conversaId: conversation.id,
      remetenteId: currentUserId,
      remetenteNome: currentUserName || 'Você',
      remetenteRole: 'USER',
      conteudo: text,
      tipo: 'TEXT',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      respostaA: currentReply
        ? {
            id: currentReply.id,
            conteudo: currentReply.conteudo,
            remetenteNome: currentReply.remetenteNome,
          }
        : null,
      anexos: [],
      reacoes: [],
    };

    onMessageSent(optimisticMsg);

    // 4. Executa o envio ao servidor em background
    try {
      const res = await sendMessage({
        conversationId: conversation.id,
        conteudo: text,
        replyToId: currentReply?.id,
      });

      if (res.success && res.message) {
        onMessageUpdate?.(tempId, res.message);
      } else {
        toast.error(res.error || 'Falha ao entregar mensagem.');
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      toast.error('Erro de conexão ao entregar mensagem.');
    }
  }, [inputText, conversation.id, replyTo, currentUserId, currentUserName, onMessageSent, onMessageUpdate, onDraftSave]);

  // ── Upload unificado de arquivo (com suporte a Drag & Drop e Input) ────
  const uploadAndSendFile = useCallback(async (file: File) => {
    const MAX_MB = 25;
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`Arquivo muito grande. Máximo permitido: ${MAX_MB}MB.`);
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
        setUploadError(data.error || 'Falha no upload do arquivo.');
        return;
      }

      const res = await sendMessage({
        conversationId: conversation.id,
        conteudo: file.name,
        attachmentData: {
          nomeArquivo: file.name,
          tamanhoBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          storagePath: data.attachment.storagePath,
        },
      });

      if (res.success && res.message) {
        onMessageSent(res.message);
        toast.success(`Arquivo enviado: ${file.name}`);
      }
    } catch (err) {
      console.error('[uploadAndSendFile] Erro:', err);
      setUploadError('Erro de conexão no upload. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [conversation.id, onMessageSent]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndSendFile(file);
    }
  }, [uploadAndSendFile]);

  // Handlers para Drag & Drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      await uploadAndSendFile(file);
    }
  }, [uploadAndSendFile]);

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
    <div
      className="flex h-full w-full rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── MAIN CHAT COLUMN ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070A12]/40 relative">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 border-b border-white/10 bg-white/[0.02] shrink-0 h-14">
          {onBackToConversations && (
            <button
              type="button"
              onClick={onBackToConversations}
              aria-label="Voltar para lista de conversas"
              className="md:hidden p-2 -ml-1 mr-1 rounded-xl text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/10 transition cursor-pointer"
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
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-0 custom-scrollbar relative"
        >
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
                                        onClick={() => setPreviewAnexo(a)}
                                        title="Clique para visualizar o anexo"
                                        className="flex items-center gap-2.5 bg-black/30 hover:bg-black/45 rounded-xl px-3 py-2 border border-white/10 hover:border-emerald-500/40 cursor-pointer transition group/anexo"
                                      >
                                        <span className="text-lg shrink-0">{mimeIcon(a.mimeType)}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-medium text-white truncate group-hover/anexo:text-emerald-300 transition">
                                            {a.nomeArquivo}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-mono">
                                            {humanFileSize(a.tamanhoBytes)}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 group-hover/anexo:text-emerald-400 font-medium px-2 py-0.5 rounded-md bg-white/[0.04]">
                                            <Eye className="w-3 h-3" />
                                            <span>Visualizar</span>
                                          </span>
                                          <button
                                            type="button"
                                            title="Baixar anexo"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const res = await fetch(`/api/mensagens/anexo/${a.id}`, {
                                                  headers: { 'Accept': 'application/json' },
                                                });
                                                const data = await res.json();
                                                if (data.signedUrl) {
                                                  const fileRes = await fetch(data.signedUrl);
                                                  const blob = await fileRes.blob();
                                                  const blobUrl = URL.createObjectURL(blob);
                                                  const link = document.createElement('a');
                                                  link.href = blobUrl;
                                                  link.download = data.fileName || a.nomeArquivo;
                                                  document.body.appendChild(link);
                                                  link.click();
                                                  document.body.removeChild(link);
                                                  URL.revokeObjectURL(blobUrl);
                                                } else {
                                                  setUploadError(data.error || 'Falha ao gerar link de download.');
                                                }
                                              } catch {
                                                setUploadError('Erro ao baixar anexo.');
                                              }
                                            }}
                                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
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
                                  {isMine && (
                                    msg.id.startsWith('temp_') ? (
                                      <Clock className="w-3 h-3 text-slate-400 animate-pulse" />
                                    ) : (
                                      <CheckCheck className="w-3 h-3 text-emerald-400" />
                                    )
                                  )}
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
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition"
                                title="Responder"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setContextMenu({ msg, x: Math.max(10, rect.left - 100), y: rect.bottom + 4 });
                                }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition"
                                title="Opções da mensagem"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {!msg.isDeleted && !isMine && (
                            <div className="opacity-0 group-hover:opacity-100 transition self-center flex gap-0.5 order-first">
                              <button
                                onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition"
                                title="Responder"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setContextMenu({ msg, x: rect.left, y: rect.bottom + 4 });
                                }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition"
                                title="Opções da mensagem"
                              >
                                <MoreVertical className="w-3 h-3" />
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
        <div className="shrink-0 border-t border-white/10 bg-[#0B1020]/90 backdrop-blur-md px-3.5 pb-3 pt-2.5">
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
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/60 placeholder-slate-500 disabled:opacity-40 max-h-40 leading-relaxed"
                />
              </div>

              {/* Enviar */}
              <button
                type="submit"
                disabled={!inputText.trim() || !canSend}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition shadow cursor-pointer"
              >
                <Send className="w-4 h-4" />
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

      {/* ── BOTÃO FLUTUANTE ROLAR PARA O FIM COM CONTADOR ──────────── */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Rolar para o fim da conversa"
          title="Rolar para as mensagens mais recentes"
          className="absolute bottom-20 right-6 z-30 w-10 h-10 rounded-full bg-[#111827]/90 hover:bg-[#1f2937] text-slate-200 hover:text-white border border-white/15 shadow-2xl backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          {unreadBelowCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg border border-[#111827] animate-pulse">
              {unreadBelowCount > 9 ? '9+' : unreadBelowCount}
            </span>
          )}
        </button>
      )}

      {/* ── OVERLAY DE DRAG & DROP ────────────────────────────────────── */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-[#070A12]/85 backdrop-blur-sm border-2 border-dashed border-emerald-500/80 rounded-2xl m-3 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150 pointer-events-none shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-500/25 animate-bounce">
            <UploadCloud className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-white tracking-wide">
            Solte o arquivo aqui para enviar
          </p>
          <p className="text-xs text-slate-400 font-mono">
            PDFs, Imagens, Documentos até 25MB
          </p>
        </div>
      )}

      {/* ── MODAL DE PREVIEW / LIGHTBOX ─────────────────────────────── */}
      <MediaPreviewModal
        isOpen={!!previewAnexo}
        onClose={() => setPreviewAnexo(null)}
        anexo={previewAnexo}
      />
    </div>
  );
}
