'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { loadCurrentUserOnce } from '@/lib/navigation/client-data';
import { notifyNewMessage } from '@/lib/notifications/desktop';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

export function GlobalMessagingListener() {
  const router = useRouter();

  useEffect(() => {
    let channel: any = null;

    loadCurrentUserOnce()
      .then((user) => {
        if (!user?.id || !user?.tenantId) return;

        const channelName = `user_${user.tenantId}_${user.id}`;
        channel = supabase.channel(channelName);

        channel
          .on('broadcast', { event: 'new_message' }, (payload: any) => {
            const data = payload.payload;
            if (!data || data.senderId === user.id) return;

            // Se o usuário já estiver na tela de mensagens, o MensagensClient trata o evento
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/mensagens')) {
              return;
            }

            const senderTitle = data.isGroup
              ? `${data.conversationTitle || 'Grupo'} (${data.senderName})`
              : data.senderName;

            // 1. Notificação nativa no Desktop (Windows/OS) + Som Corporativo
            notifyNewMessage({
              title: senderTitle,
              body: data.conteudo,
              conversationId: data.conversationId,
              onClick: () => {
                router.push(`/mensagens?c=${data.conversationId}`);
              },
            });

            // 2. Toast interativo na tela
            toast(senderTitle, {
              description:
                data.conteudo.length > 70 ? `${data.conteudo.substring(0, 70)}...` : data.conteudo,
              icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  router.push(`/mensagens?c=${data.conversationId}`);
                },
              },
            });
          })
          .subscribe();
      })
      .catch(() => {});

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  return null;
}
