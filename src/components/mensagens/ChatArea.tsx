'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Reply,
  Trash2,
  FileText,
  Download,
  Users,
  Check,
  CheckCheck,
  ArrowLeft,
  Loader2,
  Shield,
  AlertTriangle,
  Search,
  Plus,
} from 'lucide-react';
import {
  SerializedConversation,
  SerializedMessage,
  sendMessage,
  deleteMessage,
  toggleReaction,
  addMemberToConversation,
  getAvailableUsers,
} from '@/app/actions/mensagens';

interface ChatAreaProps {
  conversation: SerializedConversation;
  messages: SerializedMessage[];
  currentUserId: string;
  onBackToConversations?: () => void;
  onMessageSent: (message: SerializedMessage) => void;
  onMessageDeleted: (messageId: string) => void;
  onReactionToggled: (messageId: string, emoji: string) => void;
  onConversationUpdated?: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '👏', '😂', '⚠️', '🔒'];

export function ChatArea({
  conversation,
  messages,
  currentUserId,
  onBackToConversations,
  onMessageSent,
  onMessageDeleted,
  onReactionToggled,
  onConversationUpdated,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<SerializedMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  // Estados para adicionar participante
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberUsers, setAddMemberUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loadingAddUsers, setLoadingAddUsers] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rola para a mensagem mais recente quando a lista é atualizada
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
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
        onMessageSent(res.message);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversation.id);

      const res = await fetch('/api/mensagens/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || 'Falha no envio do anexo.');
        return;
      }

      // Envia a mensagem associada ao anexo
      const sendRes = await sendMessage({
        conversationId: conversation.id,
        conteudo: inputText.trim() || `📎 ${data.attachment.nomeArquivo}`,
        replyToId: replyTo?.id,
        attachmentData: data.attachment,
      });

      if (sendRes.success && sendRes.message) {
        setInputText('');
        setReplyTo(null);
        onMessageSent(sendRes.message);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Erro inesperado no envio de anexo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('Deseja realmente remover esta mensagem para todos?')) return;
    const res = await deleteMessage(msgId);
    if (res.success) {
      onMessageDeleted(msgId);
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    const res = await toggleReaction(msgId, emoji);
    if (res.success) {
      onReactionToggled(msgId, emoji);
    }
  };

  const isGroup = conversation.tipo === 'GROUP';
  const otherMember = conversation.otherMember;

  const existingMemberIds = new Set(conversation.membros.map((m) => m.userId));

  const openAddMember = () => {
    setShowAddMember(true);
    setAddMemberSearch('');
    setAddMemberError(null);
    setLoadingAddUsers(true);
    getAvailableUsers()
      .then((res) => {
        if (res.success && res.users) {
          // Filtra usuários que já são membros
          setAddMemberUsers(res.users.filter((u) => !existingMemberIds.has(u.id)));
        }
      })
      .catch(() => setAddMemberError('Erro ao carregar contatos.'))
      .finally(() => setLoadingAddUsers(false));
  };

  const handleAddMember = async (targetUserId: string) => {
    if (addingMemberId) return;
    setAddingMemberId(targetUserId);
    setAddMemberError(null);
    try {
      const res = await addMemberToConversation(conversation.id, targetUserId);
      if (res.success) {
        setShowAddMember(false);
        setShowMembers(false);
        onConversationUpdated?.();
      } else {
        setAddMemberError(res.error || 'Não foi possível adicionar o participante.');
      }
    } catch {
      setAddMemberError('Erro inesperado ao adicionar participante.');
    } finally {
      setAddingMemberId(null);
    }
  };

  const filteredAddUsers = addMemberUsers.filter((u) =>
    u.name.toLowerCase().includes(addMemberSearch.toLowerCase())
  );

  return (
    <div className="flex-1 h-full flex flex-col bg-[#070A12] relative overflow-hidden select-text">
      {/* Header do Chat */}
      <header className="px-4 py-3 border-b border-white/10 bg-[#111827] flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToConversations && (
            <button
              onClick={onBackToConversations}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition mr-1"
              title="Voltar às conversas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
              isGroup
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {isGroup ? <Users className="w-4 h-4" /> : conversation.titulo.substring(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate">{conversation.titulo}</h2>
              {isGroup && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                  Grupo
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isGroup
                ? `${conversation.membros.length} participantes da organização`
                : otherMember?.role || 'Colaborador'}
            </p>
          </div>
        </div>

        {/* Ações do cabeçalho */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowMembers(!showMembers)}
            title={showMembers ? 'Ocultar detalhes' : 'Ver participantes'}
            className={`p-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              showMembers
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isGroup ? `${conversation.membros.length} membros` : 'Participantes'}
            </span>
          </button>
        </div>
      </header>

      {/* Painel lateral sob demanda com detalhes dos participantes */}
      {showMembers && (
        <div className="absolute right-0 top-[57px] bottom-0 w-72 bg-[#0e1424] border-l border-white/10 p-4 z-20 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
          {!showAddMember ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Participantes ({conversation.membros.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowMembers(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {conversation.membros.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {m.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {m.name} {m.userId === currentUserId && '(Você)'}
                        </p>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {m.role}
                        </span>
                      </div>
                    </div>

                    {m.papel === 'ADMIN' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Botão adicionar participante */}
              <button
                type="button"
                onClick={openAddMember}
                className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-white text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar participante
              </button>

              <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Isolamento estrito ativo: todas as comunicações são restritas a colaboradores autorizados da sua organização.
                </span>
              </div>
            </>
          ) : (
            /* Painel de adicionar participante */
            <>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Adicionar Participante
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              {!isGroup && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Adicionar alguém aqui vai converter esta conversa em um <strong>grupo</strong>.</span>
                </div>
              )}

              {addMemberError && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                  {addMemberError}
                </div>
              )}

              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {loadingAddUsers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                </div>
              ) : filteredAddUsers.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">
                  {addMemberSearch ? 'Nenhum colaborador encontrado.' : 'Todos os colaboradores já são participantes.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {filteredAddUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!!addingMemberId}
                      onClick={() => handleAddMember(u.id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-indigo-600/10 hover:border-indigo-500/30 transition text-left disabled:opacity-50 cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {addingMemberId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          u.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">{u.name}</p>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{u.role}</span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Alerta de erro de upload se houver */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Área Central de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 text-xs">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-3 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-300 text-sm">Início da conversa</p>
            <p className="max-w-xs mt-1 text-slate-500">
              Envie uma mensagem ou documento para se comunicar com sua equipe em tempo real.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.remetenteId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col group ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {/* Cabeçalho da mensagem (remetente em grupos ou mensagens recebidas) */}
                {!isSelf && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-slate-300">{msg.remetenteNome}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {msg.remetenteRole}
                    </span>
                  </div>
                )}

                {/* Balão de Mensagem */}
                <div
                  className={`relative max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs leading-relaxed transition ${
                    isSelf
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm border border-indigo-500/40'
                      : 'bg-[#182035] text-slate-100 rounded-tl-sm border border-white/10'
                  }`}
                >
                  {/* Resposta citada */}
                  {msg.respostaA && (
                    <div className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-indigo-400 text-[11px] text-slate-300">
                      <p className="font-bold text-indigo-300 mb-0.5">{msg.respostaA.remetenteNome}</p>
                      <p className="truncate opacity-90">{msg.respostaA.conteudo}</p>
                    </div>
                  )}

                  {/* Conteúdo textual */}
                  <p className={`whitespace-pre-wrap break-words ${msg.isDeleted ? 'italic text-slate-400' : ''}`}>
                    {msg.conteudo}
                  </p>

                  {/* Anexos */}
                  {msg.anexos && msg.anexos.length > 0 && !msg.isDeleted && (
                    <div className="mt-2 space-y-1.5">
                      {msg.anexos.map((anexo) => (
                        <a
                          key={anexo.id}
                          href={`/api/mensagens/anexo/${anexo.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-black/30 hover:bg-black/40 border border-white/10 text-white transition group/anexo"
                        >
                          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate group-hover/anexo:underline">
                              {anexo.nomeArquivo}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {(anexo.tamanhoBytes / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-slate-400 group-hover/anexo:text-white shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Horário e confirmação */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/50">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isSelf && (
                      <span className="text-indigo-200">
                        <CheckCheck className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Barra de Reações Abaixo do Balão */}
                  {msg.reacoes && msg.reacoes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/10">
                      {msg.reacoes.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => handleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                            r.hasReacted
                              ? 'bg-indigo-500/30 border-indigo-400 text-white'
                              : 'bg-black/20 border-white/10 text-slate-300 hover:border-white/30'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Barra de Ações Hover (Responder, Reagir, Deletar) */}
                  {!msg.isDeleted && (
                    <div
                      className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/10 shadow-lg backdrop-blur z-10 ${
                        isSelf ? 'right-2' : 'left-2'
                      }`}
                    >
                      {/* Emojis Rápidos */}
                      <div className="flex items-center gap-0.5 pr-1 border-r border-white/10">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="p-1 hover:scale-125 transition text-xs"
                            title={`Reagir com ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Responder */}
                      <button
                        onClick={() => setReplyTo(msg)}
                        title="Responder"
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>

                      {/* Excluir (somente autor ou admin) */}
                      {(isSelf || conversation.membros.some((m) => m.userId === currentUserId && m.papel === 'ADMIN')) && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          title="Remover mensagem"
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra Inferior Fixa de Envio de Mensagem */}
      <footer className="p-3 border-t border-white/10 bg-[#111827] shrink-0">
        {/* Banner de resposta citada */}
        {replyTo && (
          <div className="flex items-center justify-between p-2 mb-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-indigo-300">{replyTo.remetenteNome}: </span>
                <span className="text-slate-400 truncate">{replyTo.conteudo}</span>
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.csv"
          />

          {/* Botão de Anexo */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Anexar documento ou imagem"
            className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 transition shrink-0 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          {/* Campo de Texto */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={sending}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={sending || (!inputText.trim() && !uploading)}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
