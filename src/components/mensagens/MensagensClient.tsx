'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { MessageSquare, MessagesSquare, BellRing, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';
import { notifyNewMessage } from '@/lib/notifications/desktop';
import { playNotificationChime } from '@/lib/notifications/sound';
import { subscribeToPushNotifications } from '@/lib/pwa/push-client';

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

  const [conversations, setConversations] = useState<SerializedConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [notificationPermission, setNotificationPermission] = useState<
    'granted' | 'default' | 'denied' | 'unsupported'
  >('default');
  const [activatingNotifications, setActivatingNotifications] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Sincroniza permissão do navegador e garante registro em background se já concedido
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = Notification.permission;
      setNotificationPermission(perm);
      if (perm === 'granted') {
        subscribeToPushNotifications().catch(() => {});
      }
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (notificationPermission === 'denied') {
      toast.info(
        'As notificações estão bloqueadas no seu navegador. Clique no ícone de cadeado na barra de endereços (à esquerda da URL) e altere "Notificações" para "Permitir".',
        { duration: 9000 }
      );
      return;
    }

    setActivatingNotifications(true);
    try {
      const res = await subscribeToPushNotifications();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
      if (res.success || (typeof window !== 'undefined' && Notification.permission === 'granted')) {
        playNotificationChime();
        notifyNewMessage({
          title: 'FIORIX • Alertas Ativados',
          body: 'Seu computador agora emitirá som e alerta na tela quando você receber novas mensagens!',
        });
        toast.success('Alertas ativados com sucesso! Você será avisado de novas mensagens.');
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err: any) {
      toast.error('Erro ao ativar notificações no navegador.');
    } finally {
      setActivatingNotifications(false);
    }
  };

  const handleTestSound = () => {
    playNotificationChime();
    toast.success('Som de notificação emitido com sucesso!');
  };

  // Presença: usuários digitando por conversa e online
  const [typingByConversation, setTypingByConversation] = useState<Record<string, Record<string, string>>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Cache em memória de mensagens por conversa para navegação ultra-rápida (0ms)
  const messagesCacheRef = useRef<Map<string, SerializedMessage[]>>(new Map());

  // Ref para rastrear conversa ativa no closure dos listeners
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;

  // Inicializa a conversa ativa via query param ou primeira conversa apenas na montagem inicial
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const cParam = searchParams.get('c');
    if (cParam) {
      setActiveConversationId(cParam);
    } else if (initialConversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setActiveConversationId(initialConversations[0].id);
      window.history.replaceState(null, '', `/mensagens?c=${initialConversations[0].id}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suporte a navegação por histórico do navegador (voltar/avançar)
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('c');
      if (c) setActiveConversationId(c);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Carrega mensagens quando a conversa ativa muda (com cache instantâneo)
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    // Se já existem mensagens em cache, exibe instantaneamente sem bloquear a interface
    const cached = messagesCacheRef.current.get(activeConversationId);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }

    markAsRead(activeConversationId).catch(() => {});

    // Zera badge localmente
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
    );

    getMessages(activeConversationId)
      .then((res) => {
        if (res.success && res.messages) {
          messagesCacheRef.current.set(activeConversationId, res.messages);
          setMessages(res.messages);
        }
      })
      .catch((err) => console.error('[getMessages] Erro:', err))
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

        const newMsg: SerializedMessage = {
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
        };

        if (isCurrentActive) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.messageId)) return prev;

            // Se for do próprio usuário com ID temporário, substitui pelo definitivo
            const tempIdx = prev.findIndex(
              (m) => m.id.startsWith('temp_') && m.remetenteId === data.senderId && m.conteudo === data.conteudo
            );
            let updated: SerializedMessage[];
            if (tempIdx !== -1) {
              updated = [...prev];
              updated[tempIdx] = newMsg;
            } else {
              updated = [...prev, newMsg];
            }
            messagesCacheRef.current.set(data.conversationId, updated);
            return updated;
          });
          markAsRead(data.conversationId).catch(() => {});
        } else {
          // Atualiza cache da conversa caso já tenha sido aberta
          const cached = messagesCacheRef.current.get(data.conversationId);
          if (cached && !cached.some((m) => m.id === data.messageId)) {
            messagesCacheRef.current.set(data.conversationId, [...cached, newMsg]);
          }

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
                  window.history.replaceState(null, '', `/mensagens?c=${data.conversationId}`);
                },
              },
            });
          }
        }

        // Alertas sonoros e notificações de área de trabalho para mensagens recebidas
        const isFromMe = data.senderId === currentUserId;
        if (!isFromMe) {
          const conv = conversations.find((c) => c.id === data.conversationId);
          const isMuted = conv?.isMuted ?? false;

          if (!isMuted) {
            const isUserFocusedOnChat =
              isCurrentActive &&
              typeof document !== 'undefined' &&
              !document.hidden &&
              (typeof document.hasFocus === 'function' ? document.hasFocus() : true);

            const senderTitle = data.isGroup
              ? `${data.conversationTitle || 'Grupo'} (${data.senderName})`
              : data.senderName;

            if (!isUserFocusedOnChat) {
              notifyNewMessage({
                title: senderTitle,
                body: data.conteudo || (data.hasAttachments ? '📎 Enviou um anexo' : 'Nova mensagem'),
                conversationId: data.conversationId,
                onClick: () => {
                  setActiveConversationId(data.conversationId);
                  window.history.replaceState(null, '', `/mensagens?c=${data.conversationId}`);
                },
              });
            } else {
              // Conversa aberta e com foco ativo: apenas som de mensagem recebida
              playNotificationChime();
            }
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
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, conteudo: 'Mensagem removida' } : m
          );
          if (activeIdRef.current) {
            messagesCacheRef.current.set(activeIdRef.current, updated);
          }
          return updated;
        });
      })
      .on('broadcast', { event: 'message_edited' }, (payload: any) => {
        const { messageId, newConteudo, editedAt } = payload.payload || {};
        if (!messageId) return;
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === messageId ? { ...m, conteudo: newConteudo, editedAt } : m
          );
          if (activeIdRef.current) {
            messagesCacheRef.current.set(activeIdRef.current, updated);
          }
          return updated;
        });
      })
      .on('broadcast', { event: 'reaction' }, (payload: any) => {
        const { messageId, emoji, userId, action } = payload.payload || {};
        if (!messageId) return;
        setMessages((prev) => {
          const updated = prev.map((m) => {
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
          });
          if (activeIdRef.current) {
            messagesCacheRef.current.set(activeIdRef.current, updated);
          }
          return updated;
        });
      })
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const { userId, userName, conversationId } = payload.payload || {};
        if (!userId || userId === currentUserId || !conversationId) return;

        setTypingByConversation((prev) => {
          const convMap = prev[conversationId] || {};
          return {
            ...prev,
            [conversationId]: { ...convMap, [userId]: userName },
          };
        });

        setTimeout(() => {
          setTypingByConversation((prev) => {
            const convMap = prev[conversationId];
            if (!convMap || !convMap[userId]) return prev;
            const updated = { ...convMap };
            delete updated[userId];
            if (Object.keys(updated).length === 0) {
              const next = { ...prev };
              delete next[conversationId];
              return next;
            }
            return { ...prev, [conversationId]: updated };
          });
        }, 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, currentUserId]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    window.history.replaceState(null, '', `/mensagens?c=${id}`);
  }, []);

  const handleConversationCreated = useCallback(async (id: string) => {
    const res = await getConversations();
    if (res.success && res.conversations) setConversations(res.conversations);
    setActiveConversationId(id);
    window.history.replaceState(null, '', `/mensagens?c=${id}`);
  }, []);

  const handleConversationUpdated = useCallback(() => {
    getConversations().then((res) => {
      if (res.success && res.conversations) setConversations(res.conversations);
    });
  }, []);

  const handleMessageSent = useCallback((newMsg: SerializedMessage) => {
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      messagesCacheRef.current.set(newMsg.conversaId, updated);
      return updated;
    });
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

  const handleMessageUpdate = useCallback((tempId: string, realMsg: SerializedMessage) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === tempId ? realMsg : m));
      messagesCacheRef.current.set(realMsg.conversaId, updated);
      return updated;
    });
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === realMsg.conversaId);
      if (index === -1) return prev;
      const target = prev[index];
      if (target.lastMessage?.id === tempId) {
        const updated: SerializedConversation = {
          ...target,
          lastMessage: {
            id: realMsg.id,
            conteudo: realMsg.conteudo,
            remetenteId: realMsg.remetenteId,
            remetenteNome: realMsg.remetenteNome,
            createdAt: realMsg.createdAt,
            isDeleted: realMsg.isDeleted,
          },
        };
        const remaining = prev.filter((_, i) => i !== index);
        return [updated, ...remaining];
      }
      return prev;
    });
  }, []);

  const handleMessageDeleted = useCallback((msgId: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === msgId ? { ...m, isDeleted: true, conteudo: 'Mensagem removida' } : m));
      if (activeIdRef.current) {
        messagesCacheRef.current.set(activeIdRef.current, updated);
      }
      return updated;
    });
  }, []);

  const handleReactionToggled = useCallback((msgId: string, emoji: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) => {
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
      });
      if (activeIdRef.current) {
        messagesCacheRef.current.set(activeIdRef.current, updated);
      }
      return updated;
    });
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
  const typingList = activeConversationId && typingByConversation[activeConversationId]
    ? Object.values(typingByConversation[activeConversationId])
    : [];

  return (
    <div className="h-[calc(100vh-65px)] w-full flex flex-col bg-[#070A12] text-white relative overflow-hidden font-sans p-3 sm:p-4">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 via-indigo-500/8 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Banner de Ativação de Notificações no Computador */}
      {notificationPermission === 'default' && !bannerDismissed && (
        <div className="w-full bg-gradient-to-r from-emerald-950/80 via-slate-900/95 to-emerald-950/80 border border-emerald-500/30 rounded-2xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 text-xs text-emerald-100 shrink-0 z-20 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <BellRing className="w-3.5 h-3.5 animate-pulse" />
            </span>
            <span className="truncate">
              <strong>Ative os alertas no computador:</strong> Seja avisado com som e notificações na área de trabalho quando receber novas mensagens.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={activatingNotifications}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {activatingNotifications ? 'Ativando...' : 'Ativar Alertas'}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              title="Ignorar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full flex gap-3 sm:gap-4 overflow-hidden relative z-10 min-h-0">
        {/* Sidebar — esconde no mobile quando há conversa ativa */}
        <div className={`h-full shrink-0 md:flex ${activeConversationId ? 'hidden md:flex' : 'flex w-full'}`}>
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
            notificationPermission={notificationPermission}
            onEnableNotifications={handleEnableNotifications}
            onTestSound={handleTestSound}
            typingByConversation={typingByConversation}
          />
        </div>

        {/* Área Central do Chat */}
        <div
          className={`flex-1 h-full min-w-0 flex flex-col ${
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
                window.history.replaceState(null, '', '/mensagens');
              }}
              onMessageSent={handleMessageSent}
              onMessageUpdate={handleMessageUpdate}
              onMessageDeleted={handleMessageDeleted}
              onReactionToggled={handleReactionToggled}
              onConversationUpdated={handleConversationUpdated}
              onDraftSave={(text) => handleDraftSave(activeConversation.id, text)}
            />
          ) : (
            <div className="h-full flex-1 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-inner">
                <MessagesSquare className="w-10 h-10 text-emerald-400 stroke-[1.75]" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                Selecione uma conversa
              </h3>
              <p className="max-w-sm text-sm text-slate-400 mb-7 leading-relaxed">
                Escolha uma conversa na lista ou inicie uma nova.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-[0.98]"
              >
                <span className="text-base leading-none font-bold">+</span>
                <span>Nova conversa</span>
              </button>
            </div>
          )}
        </div>
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
