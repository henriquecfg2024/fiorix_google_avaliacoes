'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Users,
  Check,
  CheckCheck,
} from 'lucide-react';
import { SerializedConversation } from '@/app/actions/mensagens';

interface ConversasSidebarProps {
  conversations: SerializedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNovaConversa: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUserId: string;
}

export function ConversasSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNovaConversa,
  isCollapsed,
  onToggleCollapse,
  currentUserId,
}: ConversasSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const titleMatch = c.titulo.toLowerCase().includes(search.toLowerCase());
    const memberMatch = c.membros.some((m) =>
      m.name.toLowerCase().includes(search.toLowerCase())
    );
    return titleMatch || memberMatch;
  });

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <aside
      className={`h-full border-r border-white/10 bg-[#0c101c] flex flex-col transition-all duration-300 select-none ${
        isCollapsed ? 'w-16' : 'w-full md:w-80 lg:w-[320px]'
      }`}
    >
      {/* Header da Sidebar */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#111627]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">Conversas</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
              {conversations.length}
            </span>
          </div>
        )}

        <div className={`flex items-center gap-1 ${isCollapsed ? 'mx-auto' : ''}`}>
          <button
            type="button"
            onClick={onOpenNovaConversa}
            title="Nova Conversa"
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir conversas' : 'Recolher conversas'}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Busca rápida (visível apenas quando expandido) */}
      {!isCollapsed && (
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>
      )}

      {/* Lista de Conversas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            {!isCollapsed && (search ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa iniciada.')}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.id === activeConversationId;
            const initials = c.titulo.substring(0, 2).toUpperCase();
            const isGroup = c.tipo === 'GROUP';

            if (isCollapsed) {
              return (
                <div key={c.id} className="relative flex justify-center py-1">
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    title={`${c.titulo}${c.unreadCount > 0 ? ` (${c.unreadCount} não lidas)` : ''}`}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition border ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                        : 'bg-slate-800 border-white/10 text-slate-300 hover:border-indigo-500/50'
                    }`}
                  >
                    {isGroup ? <Users className="w-4 h-4" /> : <span className="text-xs font-bold">{initials}</span>}

                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#0c101c]">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white shadow-sm'
                    : 'hover:bg-white/5 border-transparent text-slate-300'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border ${
                      isGroup
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {isGroup ? <Users className="w-4 h-4" /> : initials}
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0c101c]">
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  )}
                </div>

                {/* Conteúdo da conversa */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className="text-xs font-semibold text-white truncate">{c.titulo}</h3>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {formatTime(c.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                    {c.lastMessage ? (
                      <>
                        {c.lastMessage.remetenteId === currentUserId && (
                          <span className="text-indigo-400 inline-flex shrink-0">
                            <CheckCheck className="w-3 h-3" />
                          </span>
                        )}
                        <span className="truncate">{c.lastMessage.conteudo}</span>
                      </>
                    ) : (
                      <span className="italic text-slate-500">Conversa iniciada</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
