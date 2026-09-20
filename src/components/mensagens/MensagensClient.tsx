'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  SerializedConversation,
  SerializedMessage,
  getConversations,
  getMessages,
  markAsRead,
} from '@/app/actions/mensagens';
import { ConversasSidebar } from './ConversasSidebar';
import { ChatArea } from './ChatArea';
import { NovaConversaModal } from './NovaConversaModal';
import { MessageSquare, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface MensagensClientProps {
  initialConversations: SerializedConversation[];
  currentUserId: string;
  tenantId: string;
}

export function MensagensClient({
  initialConversations,
  currentUserId,
  tenantId,
}: MensagensClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [conversations, setConversations] = useState<SerializedConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Inicializa a conversa ativa via query param ou primeira conversa
  useEffect(() => {
    const cParam = searchParams.get('c');
    if (cParam) {
      setActiveConversationId(cParam);
    } else if (initialConversations.length > 0 && window.innerWidth >= 768) {
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

    // Atualiza badge de não lidas localmente
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
    );

    getMessages(activeConversationId)
      .then((res) => {
        if (res.success && res.messages) {
          setMessages(res.messages);
        }
      })
      .finally(() => setLoadingMessages(false));
  }, [activeConversationId]);

  // Listener de Tempo Real via Supabase Channel isolado: user_${tenantId}_${currentUserId}
  useEffect(() => {
    if (!tenantId || !currentUserId) return;

    const channelName = `user_${tenantId}_${currentUserId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const data = payload.payload;
        if (!data) return;

        const isCurrentActive = data.conversationId === activeConversationId;

        if (isCurrentActive) {
          // Adiciona mensagem ao chat ativo
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
                isDeleted: false,
                createdAt: data.createdAt,
                anexos: [],
                reacoes: [],
              },
            ];
          });
          // Marca como lida no servidor
          markAsRead(data.conversationId).catch(() => {});
        } else {
          // Exibe Toast In-App se estiver em outra conversa
          toast(data.isGroup ? data.conversationTitle || 'Grupo' : data.senderName, {
            description: data.conteudo.length > 60 ? `${data.conteudo.substring(0, 60)}...` : data.conteudo,
            icon: <MessageSquare className="w-4 h-4 text-indigo-400" />,
            action: {
              label: 'Ver mensagem',
              onClick: () => {
                setActiveConversationId(data.conversationId);
                router.replace(`/mensagens?c=${data.conversationId}`);
              },
            },
          });
        }

        // Atualiza a lista de conversas com a última mensagem e incrementa badge se não estiver ativa
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === data.conversationId);
          if (index === -1) {
            // Se for uma conversa nova não listada ainda, recarrega
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, currentUserId, activeConversationId, router]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    router.replace(`/mensagens?c=${id}`);
  };

  const handleConversationCreated = (id: string) => {
    getConversations().then((res) => {
      if (res.success && res.conversations) {
        setConversations(res.conversations);
      }
    });
    setActiveConversationId(id);
    router.replace(`/mensagens?c=${id}`);
  };

  const handleMessageSent = (newMsg: SerializedMessage) => {
    setMessages((prev) => [...prev, newMsg]);

    // Atualiza lista de conversas localmente
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === newMsg.conversaId);
      if (index === -1) return prev;
      const target = prev[index];
      const updated: SerializedConversation = {
        ...target,
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
  };

  const handleMessageDeleted = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isDeleted: true, conteudo: 'Mensagem removida' } : m
      )
    );
  };

  const handleReactionToggled = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const exists = m.reacoes.find((r) => r.emoji === emoji);
        if (exists) {
          if (exists.hasReacted) {
            // Remove reação
            return {
              ...m,
              reacoes: m.reacoes
                .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r))
                .filter((r) => r.count > 0),
            };
          } else {
            // Adiciona reação
            return {
              ...m,
              reacoes: m.reacoes.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r
              ),
            };
          }
        } else {
          return {
            ...m,
            reacoes: [...m.reacoes, { emoji, count: 1, hasReacted: true }],
          };
        }
      })
    );
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="h-[calc(100vh-65px)] w-full flex bg-[#070A12] overflow-hidden">
      {/* Mobile: Se houver conversa ativa, esconde a lista. Se não, exibe a lista full. */}
      <div className={`h-full md:flex ${activeConversationId ? 'hidden md:flex' : 'flex w-full'}`}>
        <ConversasSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNovaConversa={() => setIsModalOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentUserId={currentUserId}
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
            currentUserId={currentUserId}
            onBackToConversations={() => setActiveConversationId(null)}
            onMessageSent={handleMessageSent}
            onMessageDeleted={handleMessageDeleted}
            onReactionToggled={handleReactionToggled}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4 text-slate-400">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Módulo Mensagens FIORIX</h3>
            <p className="max-w-md text-xs text-slate-400 mb-6">
              Selecione uma conversa ao lado ou inicie um novo diálogo corporativo seguro com um colega da sua organização.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition cursor-pointer"
            >
              Nova Conversa
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
