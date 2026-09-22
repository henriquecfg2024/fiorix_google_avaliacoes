'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCheck,
  Check,
  Pin,
  Archive,
  BellOff,
  Bell,
  BellRing,
  Volume2,
  MessageCircleDashed,
  MoreVertical,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { SerializedConversation } from '@/app/actions/mensagens';

export type SidebarFilter = 'all' | 'unread' | 'groups' | 'archived';

interface ConversasSidebarProps {
  conversations: SerializedConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNovaConversa: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUserId: string;
  filter: SidebarFilter;
  onFilterChange: (f: SidebarFilter) => void;
  onPin?: (id: string, pin: boolean) => void;
  onArchive?: (id: string, archive: boolean) => void;
  onMute?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  notificationPermission?: 'granted' | 'default' | 'denied' | 'unsupported';
  onEnableNotifications?: () => void;
  onTestSound?: () => void;
  typingByConversation?: Record<string, Record<string, string>>;
}

// Gera cor de avatar determinística com base no nome
function avatarColor(name: string) {
  const colors = [
    'bg-violet-600', 'bg-indigo-600', 'bg-blue-600', 'bg-cyan-600',
    'bg-teal-600', 'bg-emerald-600', 'bg-green-600', 'bg-amber-600',
    'bg-orange-600', 'bg-rose-600', 'bg-pink-600', 'bg-fuchsia-600',
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

function formatTime(isoString: string) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
}

const FILTER_TABS: { key: SidebarFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'groups', label: 'Grupos' },
  { key: 'archived', label: 'Arquivadas' },
];

interface ContextMenuState {
  conversaId: string;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  x: number;
  y: number;
}

export function ConversasSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNovaConversa,
  isCollapsed,
  onToggleCollapse,
  currentUserId,
  filter,
  onFilterChange,
  onPin,
  onArchive,
  onMute,
  onMarkUnread,
  notificationPermission,
  onEnableNotifications,
  onTestSound,
  typingByConversation,
}: ConversasSidebarProps) {
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Fecha context menu ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, c: SerializedConversation) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        conversaId: c.id,
        isPinned: !!c.pinnedAt,
        isArchived: !!c.archivedAt,
        isMuted: c.isMuted ?? false,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  // Filtragem
  const filtered = conversations
    .filter((c) => {
      const q = search.toLowerCase();
      const titleMatch = c.titulo.toLowerCase().includes(q);
      const memberMatch = c.membros.some((m) => m.name.toLowerCase().includes(q));
      if (q && !titleMatch && !memberMatch) return false;

      if (filter === 'unread') return c.unreadCount > 0 && !c.archivedAt;
      if (filter === 'groups') return c.tipo === 'GROUP' && !c.archivedAt;
      if (filter === 'archived') return !!c.archivedAt;
      return !c.archivedAt; // 'all'
    })
    // Fixadas primeiro
    .sort((a, b) => {
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

  const unreadTotal = conversations.filter((c) => c.unreadCount > 0 && !c.archivedAt).length;

  return (
    <aside
      className={`h-full border-r border-white/[0.08] bg-[#0d1117] flex flex-col transition-all duration-300 select-none relative shrink-0 ${
        isCollapsed ? 'w-16 min-w-16 max-w-16' : 'w-full md:w-[360px] md:min-w-[360px] md:max-w-[360px]'
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/[0.08] bg-[#0d1117] shrink-0 h-14">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Mensagens</span>
            {unreadTotal > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadTotal > 9 ? '9+' : unreadTotal}
              </span>
            )}
          </div>
        )}

        <div className={`flex items-center gap-1.5 ${isCollapsed ? 'mx-auto' : ''}`}>
          {/* Status / Teste de Alertas de Desktop e Som */}
          {notificationPermission === 'granted' ? (
            <button
              type="button"
              onClick={onTestSound}
              title="Alertas ativados. Clique para testar o som no seu computador"
              className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          ) : notificationPermission === 'denied' ? (
            <button
              type="button"
              onClick={onEnableNotifications}
              title="Notificações bloqueadas no navegador. Clique para ver instruções."
              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <BellOff className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnableNotifications}
              title="Ativar alertas de novas mensagens no computador"
              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/20 transition cursor-pointer animate-pulse"
            >
              <BellRing className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNovaConversa}
            title="Nova Conversa"
            className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
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

      {!isCollapsed && (
        <>
          {/* ── Busca ── */}
          <div className="px-3.5 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-900/90 border border-white/[0.08] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-base leading-none p-0.5"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* ── Filtros em linha única sem rolagem horizontal ── */}
          <div className="grid grid-cols-4 gap-1.5 px-3.5 pb-2 shrink-0 overflow-hidden">
            {FILTER_TABS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onFilterChange(tab.key)}
                  className={`py-1.5 px-1 rounded-full text-[11px] font-semibold transition text-center truncate flex items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.04]'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  {tab.key === 'unread' && unreadTotal > 0 && (
                    <span className={`text-[10px] font-mono px-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {unreadTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lista de conversas ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1 overflow-x-hidden">
        {filtered.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-4">
            {!isCollapsed && (
              <p className="text-xs text-slate-500 font-normal">
                Nenhuma conversa encontrada
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {filtered.map((c) => {
              const isActive = c.id === activeConversationId;
              const isGroup = c.tipo === 'GROUP';
              const ini = initials(c.titulo);
              const color = avatarColor(c.titulo);
              const isPinned = !!c.pinnedAt;
              const isMuted = c.isMuted ?? false;
              const hasDraft = !!c.draft;

              const typingUsersInConv = typingByConversation?.[c.id]
                ? Object.values(typingByConversation[c.id])
                : [];
              const isTyping = typingUsersInConv.length > 0;
              const typingLabel = isGroup && typingUsersInConv[0]
                ? `${typingUsersInConv[0].split(' ')[0]} está digitando…`
                : 'digitando…';

              if (isCollapsed) {
                return (
                  <div key={c.id} className="flex justify-center py-1">
                    <button
                      onClick={() => onSelectConversation(c.id)}
                      title={c.titulo}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition border ${
                        isActive
                          ? 'border-emerald-400 shadow-lg shadow-emerald-500/20'
                          : 'border-white/10 hover:border-emerald-500/40'
                      } ${color} text-white`}
                    >
                      {isGroup ? <Users className="w-4 h-4" /> : <span className="text-xs font-bold">{ini}</span>}
                      {c.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#0d1117]">
                          {c.unreadCount > 9 ? '9+' : c.unreadCount}
                        </span>
                      )}
                      {isTyping && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d1117] animate-pulse" />
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  onContextMenu={(e) => handleContextMenu(e, c)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition group ${
                    isActive
                      ? 'bg-emerald-600/15 border border-emerald-500/30 shadow-sm'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/10 ${color}`}
                    >
                      {isGroup ? <Users className="w-5 h-5" /> : ini}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0d1117]">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isPinned && <Pin className="w-3 h-3 text-emerald-400 shrink-0" />}
                        <h3 className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                          {c.titulo}
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {formatTime(c.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate min-w-0">
                        {isTyping ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                            <span className="truncate">{typingLabel}</span>
                            <span className="inline-flex gap-0.5 items-center shrink-0">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" />
                            </span>
                          </span>
                        ) : hasDraft ? (
                          <span className="text-amber-400 italic truncate">Rascunho: {c.draft}</span>
                        ) : c.lastMessage ? (
                          <>
                            {c.lastMessage.remetenteId === currentUserId ? (
                              <span className="inline-flex shrink-0">
                                <CheckCheck className="w-3 h-3 text-emerald-400" />
                              </span>
                            ) : isGroup && c.lastMessage.remetenteNome ? (
                              <span className="shrink-0 text-slate-500">{c.lastMessage.remetenteNome.split(' ')[0]}:</span>
                            ) : null}
                            <span className={`truncate ${c.unreadCount > 0 ? 'text-white font-medium' : ''}`}>
                              {c.lastMessage.isDeleted ? (
                                <em className="text-slate-500">Mensagem apagada</em>
                              ) : (
                                c.lastMessage.conteudo
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="italic text-slate-500">Conversa iniciada</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isMuted && <BellOff className="w-3 h-3 text-slate-500" />}
                        {c.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unreadCount > 9 ? '9+' : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botão de contexto (hover) */}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition shrink-0 p-0.5 rounded text-slate-500 hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e as any, c);
                    }}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          ref={contextRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          className="bg-[#1a2236] border border-white/15 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
        >
          {[
            {
              icon: Pin,
              label: contextMenu.isPinned ? 'Desafixar' : 'Fixar conversa',
              action: () => onPin?.(contextMenu.conversaId, !contextMenu.isPinned),
            },
            {
              icon: Archive,
              label: contextMenu.isArchived ? 'Desarquivar' : 'Arquivar',
              action: () => onArchive?.(contextMenu.conversaId, !contextMenu.isArchived),
            },
            {
              icon: contextMenu.isMuted ? Bell : BellOff,
              label: contextMenu.isMuted ? 'Reativar notificações' : 'Silenciar',
              action: () => onMute?.(contextMenu.conversaId),
            },
            {
              icon: MessageCircleDashed,
              label: 'Marcar como não lida',
              action: () => onMarkUnread?.(contextMenu.conversaId),
            },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={() => { action(); setContextMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              {label}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
