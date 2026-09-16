'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────
interface Message {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
}

interface UserContext {
  name: string;
  role: string;
  itTitulo?: string;
}

// ─── Mensagens contextuais por rota ───────────────
function getContextMessage(pathname: string, ctx: UserContext): string {
  const nome = ctx.name?.split(' ')[0] || 'você';

  if (pathname.startsWith('/minha-it')) {
    if (ctx.itTitulo) {
      return `Olá, ${nome}! 👋 Sou o FIORIX, seu tutor digital! Vi que você participa da IT **${ctx.itTitulo}**. Quer uma dica rápida de 20s para manter ela sempre atualizada? ✨`;
    }
    return `Olá, ${nome}! 👋 Sou o FIORIX! Aqui na Minha IT você cadastra e acompanha suas Instruções de Trabalho. Posso te ajudar? ✨`;
  }
  if (pathname.startsWith('/dashboard')) {
    return `Olá, ${nome}! 👋 Bem-vindo ao FIORIX! Este é seu painel principal. Precisa de ajuda para navegar? 🚀`;
  }
  if (pathname.startsWith('/avaliacoes')) {
    return `Olá, ${nome}! 👋 Aqui você gerencia as avaliações do Google. Quer saber como responder uma avaliação? ⭐`;
  }
  if (pathname.startsWith('/instrucoes-trabalho')) {
    return `Olá, ${nome}! 👋 Nesta área você encontra todas as Instruções de Trabalho do cartório. Posso te guiar? 📋`;
  }
  if (pathname.startsWith('/gestao')) {
    return `Olá, ${nome}! 👋 Área de gestão de equipe e colaboradores. Precisa de ajuda? 👥`;
  }
  return `Olá, ${nome}! 👋 Sou o FIORIX, seu tutor digital. Como posso te ajudar hoje? 😊`;
}

function getSuggestions(pathname: string): string[] {
  if (pathname.startsWith('/minha-it')) {
    return ['Como criar nova versão?', 'O que é ciência?', 'Tour pela página'];
  }
  if (pathname.startsWith('/avaliacoes')) {
    return ['Como responder avaliações?', 'Filtrar por período', 'Exportar relatório'];
  }
  if (pathname.startsWith('/instrucoes-trabalho')) {
    return ['Como buscar uma IT?', 'Entender versionamento', 'Visualizar PDF'];
  }
  return ['Navegar pelo sistema', 'Minha IT', 'Minhas avaliações'];
}

// ─── Respostas pré-definidas (fallback sem API) ───
function getQuickReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('nova versão') || q.includes('criar versão')) {
    return 'Para criar uma nova versão da sua IT:\n\n1. Acesse **Minha IT**\n2. Clique em **"Criar nova versão"** no alerta amarelo\n3. Faça upload do novo PDF\n4. A versão será atualizada para todos os participantes automaticamente! 📄✨';
  }
  if (q.includes('ciência') || q.includes('ciencias')) {
    return 'A **ciência** confirma que um colaborador leu e entendeu a IT. Cada vez que uma nova versão é publicada, todos os participantes precisam dar ciência novamente. Você acompanha o progresso em **"Ver ciências"**. ✅';
  }
  if (q.includes('tour') || q.includes('guia')) {
    return 'Na página **Minha IT** você encontra:\n\n📄 **Card principal** — resumo da sua IT com título, versão e objetivo\n👁️ **Visualizar na Íntegra** — abre o PDF completo\n👥 **Gerenciar responsáveis** — adiciona/remove participantes\n✅ **Ver ciências** — acompanha quem já leu a IT';
  }
  if (q.includes('responder avaliação') || q.includes('responder avaliacoes')) {
    return 'Para responder uma avaliação do Google:\n\n1. Acesse **Avaliações**\n2. Clique na avaliação pendente\n3. Use o campo de resposta sugerida ou escreva a sua\n4. Clique em **Enviar** 💬';
  }
  if (q.includes('navegar') || q.includes('sistema')) {
    return 'O FIORIX tem várias áreas:\n\n🏠 **Dashboard** — visão geral\n📄 **Minha IT** — suas Instruções de Trabalho\n⭐ **Avaliações** — Google Reviews\n📊 **Estatísticas** — métricas e relatórios\n👥 **Gestão** — equipe e colaboradores';
  }
  return 'Boa pergunta! Infelizmente ainda estou aprendendo sobre esse tema. Em breve terei mais informações para te ajudar. 🧠✨';
}

// ─── Componente Principal ─────────────────────────
export function FiorixAgent() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userContext, setUserContext] = useState<UserContext>({ name: '', role: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca contexto do usuário da página
  useEffect(() => {
    // Tenta extrair dados do DOM (nomes, cargo, IT título)
    const tryExtractContext = () => {
      const nameEl = document.querySelector('[data-user-name]');
      const roleEl = document.querySelector('[data-user-role]');
      const itEl = document.querySelector('[data-it-titulo]');

      // Fallback: busca do header/topbar
      const headerName = document.querySelector('.fiorix-user-name')?.textContent;
      const badgeRole = document.querySelector('.fiorix-user-role')?.textContent;

      setUserContext({
        name: nameEl?.getAttribute('data-user-name') || headerName || 'Colaborador',
        role: roleEl?.getAttribute('data-user-role') || badgeRole || 'COLABORADOR',
        itTitulo: itEl?.getAttribute('data-it-titulo') || undefined,
      });
    };

    // Pequeno delay para garantir que o DOM está renderizado
    const timer = setTimeout(tryExtractContext, 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Controla aparição e "não mostrar por 7 dias"
  useEffect(() => {
    const dismissedAt = localStorage.getItem('fiorix-agent-dismissed');
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (diff < sevenDays) return;
    }

    const showTimer = setTimeout(() => {
      setIsVisible(true);
      // Bubble aparece após a animação de entrada do avatar
      const bubbleTimer = setTimeout(() => setShowBubble(true), 600);
      return () => clearTimeout(bubbleTimer);
    }, 1500);

    return () => clearTimeout(showTimer);
  }, [pathname]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus no input ao abrir chat
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isChatOpen]);

  const dismissFor7Days = useCallback(() => {
    localStorage.setItem('fiorix-agent-dismissed', Date.now().toString());
    setShowBubble(false);
    setIsVisible(false);
  }, []);

  const closeBubble = useCallback(() => {
    setShowBubble(false);
  }, []);

  const openChat = useCallback(() => {
    setShowBubble(false);
    setIsChatOpen(true);
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: getContextMessage(pathname, userContext),
        timestamp: new Date(),
      }]);
    }
  }, [pathname, userContext, messages.length]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/fiorix-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: {
            departamento: userContext.role,
            itTitulo: userContext.itTitulo,
            pathname,
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Desculpe, não consegui processar sua pergunta.';

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch {
      // Fallback local se a API falhar
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: getQuickReply(text),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [pathname, userContext]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion);
  }, [handleSendMessage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  }, [inputValue, handleSendMessage]);

  if (!isVisible && !isChatOpen) return null;

  const suggestions = getSuggestions(pathname);

  return (
    <>
      {/* ─── CSS Animations ─── */}
      <style jsx global>{`
        @keyframes fiorix-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes fiorix-slide-up {
          0% { opacity: 0; transform: translateY(24px) scale(0.9); }
          70% { transform: translateY(-4px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-bubble-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-chat-in {
          0% { opacity: 0; transform: translateY(16px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .fiorix-float { animation: fiorix-float 3s ease-in-out infinite; }
        .fiorix-slide-up { animation: fiorix-slide-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .fiorix-bubble-in { animation: fiorix-bubble-in 0.4s ease-out forwards; }
        .fiorix-chat-in { animation: fiorix-chat-in 0.35s ease-out forwards; }
        .fiorix-typing-dot:nth-child(1) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0s; }
        .fiorix-typing-dot:nth-child(2) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0.2s; }
        .fiorix-typing-dot:nth-child(3) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0.4s; }
      `}</style>

      {/* ─── Avatar Flutuante ─── */}
      {isVisible && !isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-center gap-2 fiorix-slide-up">
          {/* Bubble de mensagem */}
          {showBubble && (
            <div className="fiorix-bubble-in relative mb-2">
              <div className="bg-white border border-[#e5e7eb] rounded-2xl rounded-br-none p-5 shadow-2xl max-w-[360px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#7c3aed] uppercase tracking-widest">FIORIX • seu tutor</span>
                    <span className="text-[10px] text-[#9ca3af]">agora</span>
                  </div>
                  <button
                    onClick={closeBubble}
                    className="w-5 h-5 flex items-center justify-center text-[#9ca3af] hover:text-[#111827] transition-colors"
                    aria-label="Fechar"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>

                {/* Mensagem */}
                <p className="text-[13px] text-[#374151] leading-relaxed mb-4">
                  {getContextMessage(pathname, userContext)}
                </p>

                {/* Botões de ação */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={openChat}
                    className="bg-gradient-to-r from-[#facc15] to-[#f59e0b] text-[#111827] font-bold rounded-full px-5 py-2.5 text-[13px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-yellow-500/20"
                  >
                    Sim, me mostra! 😊
                  </button>
                  <button
                    onClick={dismissFor7Days}
                    className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors"
                  >
                    Depois
                  </button>
                </div>
              </div>
              {/* Seta apontando para avatar */}
              <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r border-b border-[#e5e7eb] transform rotate-45" />
            </div>
          )}

          {/* Avatar */}
          <button
            onClick={openChat}
            className="relative group fiorix-float"
            aria-label="Abrir FIORIX tutor"
          >
            <div className="w-[72px] h-[72px] rounded-2xl border-[3px] border-[#facc15] shadow-xl shadow-yellow-500/20 bg-white overflow-hidden transition-transform group-hover:scale-105">
              <Image
                src="/fiorix-avatar.jpg"
                alt="FIORIX tutor"
                width={72}
                height={72}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            {/* Dot online */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
          </button>

          {/* Badge */}
          <span className="bg-[#7c3aed] text-white rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-md">
            FIORIX
          </span>
        </div>
      )}

      {/* ─── Chat Expandido ─── */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] fiorix-chat-in">
          <div className="w-[400px] max-h-[560px] bg-white rounded-3xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-4 flex items-center gap-3 shrink-0">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl border-2 border-white/30 bg-white overflow-hidden">
                  <Image src="/fiorix-avatar.jpg" alt="FIORIX" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-[1.5px] border-[#7c3aed]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-sm font-bold">FIORIX</h3>
                <p className="text-white/60 text-[11px]">Seu tutor digital • Online</p>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                aria-label="Fechar chat"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[340px] bg-[#fafafa]">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#7c3aed] text-white rounded-2xl rounded-br-sm'
                      : 'bg-white text-[#374151] border border-[#e5e7eb] rounded-2xl rounded-bl-sm shadow-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <span key={i}>
                        {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                          part.startsWith('**') && part.endsWith('**')
                            ? <strong key={j}>{part.slice(2, -2)}</strong>
                            : part
                        )}
                        {i < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#e5e7eb] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#facc15] fiorix-typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#facc15] fiorix-typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#facc15] fiorix-typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0 bg-[#fafafa]">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    className="text-[12px] bg-[#f3f4f6] hover:bg-[#facc15] hover:text-[#111827] text-[#6b7280] px-3 py-1.5 rounded-full transition-all font-medium border border-transparent hover:border-[#f59e0b]/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-[#e5e7eb] shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Pergunte ao FIORIX..."
                  className="flex-1 h-11 rounded-full border border-[#e5e7eb] px-4 text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#facc15] focus:ring-2 focus:ring-[#facc15]/20 focus:outline-none transition-all bg-[#fafafa]"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="w-11 h-11 rounded-full bg-gradient-to-r from-[#facc15] to-[#f59e0b] flex items-center justify-center text-[#111827] disabled:opacity-40 hover:scale-105 active:scale-95 transition-all shadow-md shadow-yellow-500/20"
                  aria-label="Enviar mensagem"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
