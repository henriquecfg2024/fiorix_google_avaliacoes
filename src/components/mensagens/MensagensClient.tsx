'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  SerializedConversation,
  SerializedMessage,
  getConversations,
  getMessages,
  markAsRead,
  pinConversation,
  archiveConversation,
  markConversationUnread,
  silenceConversation,
  saveDraft,
} from '@/app/actions/mensagens';
import { ConversasSidebar, SidebarFilter } from './ConversasSidebar';
import { ChatArea } from './ChatArea';
import { NovaConversaModal } from './NovaConversaModal';
import { MessageSquare, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';

interface MensagensClientProps {
  initialConversations: SerializedConversation[];
  currentUserId: string;
  tenantId: string;
  currentUserName?: string;
}

export function MensagensClient({
  initialConversations,
  currentUserId,
  tenantId,
  currentUserName,
}: MensagensClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [conversations, setConversations] = useState<SerializedConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');

  // Presença: usuários digitando e online
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Ref para rastrear conversa ativa no closure dos listeners
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;

  // Inicializa a conversa ativa via query param ou primeira conversa (desktop)
  useEffect(() => {
    const cParam = searchParams.get('c');
    if (cParam) {
      setActiveConversationId(cParam);
    } else if (initialConversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setActiveConversationId(initialConversations[0].id);
    }
  }, [searchParams, initialConversations]);

  // Carrega mensagens quando a conversa ativa muda
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    markAsRead(activeConversationId).catch(() => {});

    // Zera badge localmente
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
    );

    getMessages(activeConversationId)
      .then((res) => {
        if (res.success && res.messages) setMessages(res.messages);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeConversationId]);

  // ── Realtime: mensagens + reações + deleções ──────────────────────────
  useEffect(() => {
    if (!tenantId || !currentUserId) return;

    const channelName = `user_${tenantId}_${currentUserId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const data = payload.payload;
        if (!data) return;

        const isCurrentActive = data.conversationId === activeIdRef.current;

        if (isCurrentActive) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.messageId)) return prev;
            return [
              ...prev,
              {
                id: data.messageId,
                conversaId: data.conversationId,
                remetenteId: data.senderId,
                remetenteNome: data.senderName,
                remetenteRole: 'USER',
                conteudo: data.conteudo,
                tipo: 'TEXT',
                isDeleted: false,
                createdAt: data.createdAt,
                anexos: [],
                reacoes: [],
              },
            ];
          });
          markAsRead(data.conversationId).catch(() => {});
        } else {
          const conv = conversations.find((c) => c.id === data.conversationId);
          const isMuted = conv?.isMuted ?? false;
          if (!isMuted) {
            toast(data.isGroup ? data.conversationTitle || 'Grupo' : data.senderName, {
              description:
                data.conteudo.length > 60 ? `${data.conteudo.substring(0, 60)}...` : data.conteudo,
              icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
              action: {
                label: 'Ver',
                onClick: () => {
                  setActiveConversationId(data.conversationId);
                  router.replace(`/mensagens?c=${data.conversationId}`);
                },
              },
            });
          }
        }

        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === data.conversationId);
          if (index === -1) {
            getConversations().then((res) => {
              if (res.success && res.conversations) setConversations(res.conversations);
            });
            return prev;
          }

          const target = prev[index];
          const updated: SerializedConversation = {
            ...target,
            lastMessageAt: data.createdAt,
            unreadCount: isCurrentActive ? 0 : target.unreadCount + 1,
            lastMessage: {
              id: data.messageId,
              conteudo: data.conteudo,
              remetenteId: data.senderId,
              remetenteNome: data.senderName,
              createdAt: data.createdAt,
              isDeleted: false,
            },
          };

          const remaining = prev.filter((_, i) => i !== index);
          return [updated, ...remaining];
        });
      })
      .on('broadcast', { event: 'message_deleted' }, (payload: any) => {
        const { messageId } = payload.payload || {};
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, conteudo: 'Mensagem removida' } : m
          )
        );
      })
      .on('broadcast', { event: 'message_edited' }, (payload: any) => {
        const { messageId, newConteudo, editedAt } = payload.payload || {};
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, conteudo: newConteudo, editedAt } : m
          )
        );
      })
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        const { messageId, emoji, userId, action } = payload.payload || {};
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const exists = m.reacoes.find((r) => r.emoji === emoji);
            if (action === 'add') {
              if (exists) {
                return {
                  ...m,
                  reacoes: m.reacoes.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, hasReacted: userId === currentUserId ? true : r.hasReacted }
                      : r
                  ),
                };
              }
              return {
                ...m,
                reacoes: [...m.reacoes, { emoji, count: 1, hasReacted: userId === currentUserId }],
              };
            } else {
              return {
                ...m,
                reacoes: m.reacoes
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: Math.max(0, r.count - 1), hasReacted: userId === currentUserId ? false : r.hasReacted }
                      : r
                  )
                  .filter((r) => r.count > 0),
              };
            }
          })
        );
      })
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const { userId, userName, conversationId } = payload.payload || {};
        if (!userId || userId === currentUserId) return;
        if (conversationId !== activeIdRef.current) return;

        setTypingUsers((prev) => ({ ...prev, [userId]: userName }));
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }, 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, currentUserId, router]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    router.replace(`/mensagens?c=${id}`, { scroll: false });
  }, [router]);

  const handleConversationCreated = useCallback((id: string) => {
    getConversations().then((res) => {
      if (res.success && res.conversations) setConversations(res.conversations);
    });
    setActiveConversationId(id);
    router.replace(`/mensagens?c=${id}`, { scroll: false });
  }, [router]);

  const handleConversationUpdated = useCallback(() => {
    getConversations().then((res) => {
      if (res.success && res.conversations) setConversations(res.conversations);
    });
  }, []);

  const handleMessageSent = useCallback((newMsg: SerializedMessage) => {
    setMessages((prev) => [...prev, newMsg]);
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === newMsg.conversaId);
      if (index === -1) return prev;
      const target = prev[index];
      const updated: SerializedConversation = {
        ...target,
        draft: null,
        lastMessageAt: newMsg.createdAt,
        lastMessage: {
          id: newMsg.id,
          conteudo: newMsg.conteudo,
          remetenteId: newMsg.remetenteId,
          remetenteNome: newMsg.remetenteNome,
          createdAt: newMsg.createdAt,
          isDeleted: false,
        },
      };
      const remaining = prev.filter((_, i) => i !== index);
      return [updated, ...remaining];
    });
  }, []);

  const handleMessageDeleted = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isDeleted: true, conteudo: 'Mensagem removida' } : m))
    );
  }, []);

  const handleReactionToggled = useCallback((msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const exists = m.reacoes.find((r) => r.emoji === emoji);
        if (exists) {
          if (exists.hasReacted) {
            return {
              ...m,
              reacoes: m.reacoes
                .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r))
                .filter((r) => r.count > 0),
            };
          } else {
            return {
              ...m,
              reacoes: m.reacoes.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r
              ),
            };
          }
        } else {
          return { ...m, reacoes: [...m.reacoes, { emoji, count: 1, hasReacted: true }] };
        }
      })
    );
  }, []);

  // ── Ações de Sidebar ─────────────────────────────────────────────────
  const handlePin = useCallback(async (id: string, pin: boolean) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinnedAt: pin ? new Date().toISOString() : null } : c))
    );
    await pinConversation(id, pin);
  }, []);

  const handleArchive = useCallback(async (id: string, archive: boolean) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archivedAt: archive ? new Date().toISOString() : null } : c))
    );
    if (archive && activeConversationId === id) setActiveConversationId(null);
    await archiveConversation(id, archive);
  }, [activeConversationId]);

  const handleMute = useCallback(async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    const isMuted = conv?.isMuted ?? false;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isMuted: !isMuted } : c))
    );
    const until = isMuted ? null : new Date(Date.now() + 8 * 3_600_000);
    await silenceConversation(id, until);
  }, [conversations]);

  const handleMarkUnread = useCallback(async (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: Math.max(1, c.unreadCount) } : c))
    );
    await markConversationUnread(id);
  }, []);

  const handleDraftSave = useCallback(async (conversationId: string, text: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, draft: text || null } : c))
    );
    await saveDraft(conversationId, text);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const typingList = Object.values(typingUsers);

  return (
    <div className="h-[calc(100vh-65px)] w-full flex bg-[#070A12] overflow-hidden">
      {/* Sidebar — esconde no mobile quando há conversa ativa */}
      <div className={`h-full md:flex ${activeConversationId ? 'hidden md:flex' : 'flex w-full'}`}>
        <ConversasSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNovaConversa={() => setIsModalOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentUserId={currentUserId}
          filter={sidebarFilter}
          onFilterChange={setSidebarFilter}
          onPin={handlePin}
          onArchive={handleArchive}
          onMute={handleMute}
          onMarkUnread={handleMarkUnread}
        />
      </div>

      {/* Área Central do Chat */}
      <div
        className={`flex-1 h-full flex flex-col ${
          !activeConversationId ? 'hidden md:flex' : 'flex w-full'
        }`}
      >
        {activeConversation ? (
          <ChatArea
            conversation={activeConversation}
            messages={messages}
            loading={loadingMessages}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            typingUsers={typingList}
            onBackToConversations={() => {
              setActiveConversationId(null);
              router.replace('/mensagens', { scroll: false });
            }}
            onMessageSent={handleMessageSent}
            onMessageDeleted={handleMessageDeleted}
            onReactionToggled={handleReactionToggled}
            onConversationUpdated={handleConversationUpdated}
            onDraftSave={(text) => handleDraftSave(activeConversation.id, text)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6">
              <MessagesSquare className="w-9 h-9 text-emerald-500/60" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">FIORIX Mensagens</h3>
            <p className="max-w-xs text-xs text-slate-500 mb-6 leading-relaxed">
              Comunicação corporativa segura. Selecione uma conversa ou inicie um novo diálogo.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              + Nova Conversa
            </button>
          </div>
        )}
      </div>

      {/* Modal Nova Conversa */}
      <NovaConversaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
