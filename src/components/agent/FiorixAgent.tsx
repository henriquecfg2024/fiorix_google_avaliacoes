'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

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
  itCodigo?: string;
  itVersao?: string;
  itDepartamento?: string;
  itPapel?: string;
  isResponsavel?: boolean;
}

// ─── Extrator dinâmico de contexto do DOM ─────────
function extractContext(): UserContext {
  if (typeof document === 'undefined') {
    return { name: 'Colaborador', role: 'COLABORADOR' };
  }

  const mainEl = document.querySelector('main[data-it-titulo]') || document.querySelector('[data-it-titulo]');
  const nameEl = document.querySelector('[data-user-name]');
  const roleEl = document.querySelector('[data-user-role]');

  const headerName = document.querySelector('.fiorix-user-name')?.textContent?.trim();
  const badgeRole = document.querySelector('.fiorix-user-role')?.textContent?.trim();

  return {
    name: mainEl?.getAttribute('data-user-name') || nameEl?.getAttribute('data-user-name') || headerName || 'Colaborador',
    role: mainEl?.getAttribute('data-user-role') || roleEl?.getAttribute('data-user-role') || badgeRole || 'COLABORADOR',
    itTitulo: mainEl?.getAttribute('data-it-titulo') || undefined,
    itCodigo: mainEl?.getAttribute('data-it-codigo') || undefined,
    itVersao: mainEl?.getAttribute('data-it-versao') || undefined,
    itDepartamento: mainEl?.getAttribute('data-it-departamento') || undefined,
    itPapel: mainEl?.getAttribute('data-it-papel') || undefined,
    isResponsavel: mainEl?.getAttribute('data-it-is-responsavel') === 'sim',
  };
}

// ─── Subtítulo do Header por Rota ─────────────────
function getHeaderSubtitle(pathname: string, ctx: UserContext): string {
  if (pathname.includes('/holerites')) return 'Meus Holerites • Online';
  if (pathname.includes('/ferias')) return 'Minhas Férias • Online';
  if (pathname.includes('/comunicados')) return 'Mural de Comunicados • Online';
  if (pathname.startsWith('/minha-it')) return ctx.itTitulo ? `IT: ${ctx.itTitulo}` : 'Minha IT • Online';
  if (pathname.startsWith('/administracao/its') || pathname.startsWith('/instrucoes-trabalho')) return 'Instruções de Trabalho • Online';
  if (pathname.startsWith('/avaliacoes')) return 'Avaliações Google • Online';
  if (pathname.startsWith('/gestao') || pathname.startsWith('/sistema')) return 'Gestão e RH • Online';
  if (pathname.startsWith('/minha-conta')) return 'Minha Conta • Online';
  return 'FIORIX • IA • Online';
}

// ─── Renderizador de Mensagens (Markdown + Links) ─
function renderFormattedMessage(content: string, isUser: boolean) {
  return content.split('\n').map((line, lineIdx, arr) => {
    const tokens = line.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*)/);

    return (
      <span key={lineIdx}>
        {tokens.map((token, tokenIdx) => {
          // Link [Texto](url)
          const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
          if (linkMatch) {
            const [, label, rawHref] = linkMatch;
            const href = (rawHref || '').trim();
            const isInternal = href.startsWith('/');
            const isSafeExternal = href.startsWith('https://') || href.startsWith('http://');

            // Proteção contra esquemas maliciosos (javascript:, data:, vbscript:)
            if (!isInternal && !isSafeExternal) {
              return <span key={tokenIdx}>{label}</span>;
            }
            return isInternal ? (
              <Link
                key={tokenIdx}
                href={href}
                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md transition-all mx-0.5 my-0.5 text-[11px] shadow-2xs ${
                  isUser
                    ? 'bg-white/20 hover:bg-white/30 text-white underline underline-offset-2'
                    : 'bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 text-[#7c3aed] border border-[#7c3aed]/30 hover:border-[#7c3aed]/50 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <span>{label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            ) : (
              <a
                key={tokenIdx}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md transition-all mx-0.5 my-0.5 text-[11px] shadow-2xs ${
                  isUser
                    ? 'bg-white/20 hover:bg-white/30 text-white underline underline-offset-2'
                    : 'bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 text-[#7c3aed] border border-[#7c3aed]/30 hover:border-[#7c3aed]/50 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <span>{label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            );
          }

          // Bold **texto**
          if (token.startsWith('**') && token.endsWith('**')) {
            return (
              <strong key={tokenIdx} className="font-semibold text-inherit">
                {token.slice(2, -2)}
              </strong>
            );
          }

          return token;
        })}
        {lineIdx < arr.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Mensagens contextuais por rota ───────────────
function getContextMessage(pathname: string, ctx: UserContext): string {
  const nome = ctx.name?.split(' ')[0] || 'você';

  if (pathname.includes('/holerites')) {
    return `Olá, ${nome}! 👋 Aqui em **Holerites** você pode consultar e baixar seus comprovantes de rendimento mensais protegidos pela LGPD. Quer ajuda para filtrar por ano ou baixar seu PDF? 📄`;
  }
  if (pathname.includes('/ferias')) {
    return `Olá, ${nome}! 👋 Aqui em **Férias** você acompanha seu saldo de dias disponíveis e seus períodos aquisitivos. Posso te ajudar a navegar por esta área? 🏖️`;
  }
  if (pathname.includes('/comunicados')) {
    return `Olá, ${nome}! 👋 Aqui em **Comunicados** você confere todos os comunicados oficiais e novidades do 7º RISP. 📢`;
  }
  if (pathname.startsWith('/minha-it')) {
    if (ctx.itTitulo) {
      return `Olá, ${nome}! 👋 Sou o FIORIX! Vi que você está na IT **${ctx.itTitulo}**${ctx.isResponsavel ? ' como Responsável Técnico' : ''}. Quer tirar alguma dúvida sobre ela? ✨`;
    }
    return `Olá, ${nome}! 👋 Sou o FIORIX! Aqui na Minha IT você acompanha suas Instruções de Trabalho e ciências. Como posso ajudar? ✨`;
  }
  if (pathname.startsWith('/instrucoes-trabalho')) {
    return `Olá, ${nome}! 👋 Nesta área você encontra todo o acervo de Instruções de Trabalho do cartório. Posso te ajudar a buscar ou propor uma nova IT? 📋`;
  }
  if (pathname.startsWith('/avaliacoes')) {
    return `Olá, ${nome}! 👋 Aqui você gerencia as avaliações do Google Reviews. Quer saber como responder avaliações ou filtrar por estrelas? ⭐`;
  }
  if (pathname.startsWith('/dashboard')) {
    return `Olá, ${nome}! 👋 Bem-vindo ao FIORIX! Este é seu painel principal. Precisa de ajuda para navegar pelos módulos? 🚀`;
  }
  if (pathname.startsWith('/gestao') || pathname.startsWith('/sistema')) {
    return `Olá, ${nome}! 👋 Área de gestão de equipe e administração do cartório. Como posso te orientar? 👥`;
  }
  if (pathname.startsWith('/minha-conta')) {
    return `Olá, ${nome}! 👋 Aqui você gerencia seus dados de perfil e preferências. 👤`;
  }
  return `Olá, ${nome}! 👋 Sou o FIORIX, a inteligência artificial do sistema. Posso tirar dúvidas sobre qualquer tela ou função. Como posso te ajudar? 😊`;
}

function getSuggestions(pathname: string): string[] {
  if (pathname.includes('/holerites')) {
    return ['Como baixar meu holerite?', 'Filtrar por ano', 'Segurança e LGPD', 'Minha IT'];
  }
  if (pathname.includes('/ferias')) {
    return ['Como consultar saldo de férias?', 'Período aquisitivo', 'Minha IT', 'Holerites'];
  }
  if (pathname.includes('/comunicados')) {
    return ['Ver últimos comunicados', 'Minha IT', 'Holerites', 'Férias'];
  }
  if (pathname.startsWith('/minha-it')) {
    return ['Qual o nome de minha IT?', 'Sou responsável técnico?', 'Como criar nova versão?', 'O que é ciência?'];
  }
  if (pathname.startsWith('/avaliacoes')) {
    return ['Como responder avaliações?', 'Filtrar por nota', 'Métricas de satisfação'];
  }
  if (pathname.startsWith('/instrucoes-trabalho')) {
    return ['Como propor uma nova IT?', 'Como buscar uma IT?', 'Visualizar PDF'];
  }
  return ['Minha IT', 'Como ver holerite?', 'Minhas férias', 'Navegar pelo sistema'];
}

// ─── Respostas pré-definidas (fallback instantâneo) ───
function getQuickReply(question: string, ctx?: UserContext): string {
  const q = question.toLowerCase();

  // Holerites
  if (q.includes('holerite') || q.includes('comprovante') || q.includes('rendimento') || q.includes('pagamento') || q.includes('salario') || q.includes('salário')) {
    return 'Na tela de **Holerites** você pode consultar e emitir seus demonstrativos com proteção LGPD. Basta selecionar o ano desejado na tabela e clicar para visualizar ou baixar o PDF!\n\n👉 [Ir para Meus Holerites](/pessoas/holerites) 📄✨';
  }

  // Férias
  if (q.includes('férias') || q.includes('ferias') || q.includes('saldo')) {
    return 'Na tela de **Férias** você pode acompanhar seu saldo de dias disponíveis, verificar seu período aquisitivo vigente e conferir o histórico das suas solicitações.\n\n👉 [Ir para Minhas Férias](/pessoas/ferias) 🏖️✨';
  }

  // Comunicados
  if (q.includes('comunicado') || q.includes('comunicados') || q.includes('aviso')) {
    return 'Na tela de **Comunicados** você confere todos os comunicados oficiais, novidades e diretrizes emitidas pela gestão do 7º RISP.\n\n👉 [Ver Comunicados](/pessoas/comunicados) 📢';
  }

  // Avaliações
  if (q.includes('avaliaç') || q.includes('avaliac') || q.includes('google') || q.includes('reviews')) {
    return 'No módulo de **Avaliações**, você acompanha as notas do Google Reviews do cartório, filtra comentários de clientes e pode enviar respostas oficiais com apoio de IA.\n\n👉 [Ir para Avaliações](/avaliacoes) ⭐';
  }

  // Minha IT
  if (q.includes('nome') && (q.includes('it') || q.includes('minha'))) {
    const tit = ctx?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO';
    const v = ctx?.itVersao ? ` (versão ${ctx.itVersao})` : ' (versão 1.1)';
    const d = ctx?.itDepartamento ? ` do setor ${ctx.itDepartamento}` : '';
    return `A sua IT atual é **${tit}**${v}${d}.\n\n👉 [Ir para Minha IT](/minha-it) 📄✨`;
  }

  if (q.includes('responsável') || q.includes('responsavel')) {
    if (ctx?.isResponsavel) {
      return `Sim! Você é o **Responsável Técnico** desta IT (**${ctx?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO'}**). Você é o encarregado de mantê-la atualizada e gerenciar os participantes!\n\n👉 [Gerenciar Minha IT](/minha-it) 🛡️✨`;
    }
    if (ctx?.itPapel) {
      return `Nesta IT, seu papel é **${ctx.itPapel}**. ${ctx.itPapel === 'Responsável técnico' ? 'Sim, você é o responsável técnico!' : 'O responsável técnico é quem faz a gestão e atualização desta IT.'}\n\n👉 [Acessar Minha IT](/minha-it) 👤`;
    }
    return 'Sim! Você está vinculado a esta IT como Responsável Técnico. Você pode gerenciar participantes e criar novas versões no alerta amarelo!\n\n👉 [Acessar Minha IT](/minha-it) 🛡️';
  }

  if (q.includes('criar') && q.includes('it') && !q.includes('versão') && !q.includes('versao')) {
    return 'Para propor ou cadastrar uma nova IT:\n\n1. Acesse o menu **Instruções de Trabalho** na barra lateral\n2. Clique em **"+ Nova IT"** ou **"Cadastrar IT"**\n3. Preencha título, objetivo e anexe o arquivo PDF\n4. Envie para análise da supervisão!\n\n👉 [Ir para Instruções de Trabalho](/instrucoes-trabalho) 📋✨';
  }

  if (q.includes('nova versão') || q.includes('criar versão') || q.includes('atualizar it')) {
    return 'Para criar uma nova versão da sua IT:\n\n1. Acesse **Minha IT**\n2. Clique em **"+ Criar nova versão"** no alerta amarelo no topo\n3. Faça upload do novo PDF atualizado\n4. A versão será atualizada para todos os participantes automaticamente!\n\n👉 [Ir para Minha IT](/minha-it) 📄✨';
  }

  if (q.includes('ciência') || q.includes('ciencias')) {
    return 'A **ciência** confirma que um colaborador leu e entendeu a IT. Cada nova versão publicada requer nova ciência de todos os participantes. Acompanhe em **"Ver ciências"**.\n\n👉 [Ir para Minha IT](/minha-it) ✅';
  }

  if (q.includes('tour') || q.includes('guia') || q.includes('ajuda') || q.includes('navegar') || q.includes('sistema')) {
    return 'O FIORIX possui vários módulos para o seu dia a dia:\n\n📄 [Minha IT](/minha-it) — suas instruções e ciências\n📋 [Instruções de Trabalho](/instrucoes-trabalho) — acervo geral\n💵 [Holerites](/pessoas/holerites) — comprovantes com LGPD\n🏖️ [Férias](/pessoas/ferias) — saldo e períodos\n📢 [Comunicados](/pessoas/comunicados) — avisos internos\n⭐ [Avaliações](/avaliacoes) — Google Reviews';
  }

  return 'Como inteligência artificial do FIORIX, posso tirar dúvidas e te direcionar para qualquer tela:\n\n• [Minha IT](/minha-it)\n• [Holerites](/pessoas/holerites)\n• [Férias](/pessoas/ferias)\n• [Comunicados](/pessoas/comunicados)\n• [Avaliações](/avaliacoes)\n• [Dashboard](/dashboard)\n\nComo posso te ajudar? 😊';
}

// ─── Componente Principal ─────────────────────────
export function FiorixAgent() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<'right' | 'left'>('right');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userContext, setUserContext] = useState<UserContext>({ name: '', role: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega posição salva
  useEffect(() => {
    const savedPos = localStorage.getItem('fiorix-agent-pos') as 'right' | 'left';
    if (savedPos === 'left' || savedPos === 'right') {
      setPosition(savedPos);
    }
  }, []);

  const togglePosition = useCallback(() => {
    setPosition(prev => {
      const next = prev === 'right' ? 'left' : 'right';
      localStorage.setItem('fiorix-agent-pos', next);
      return next;
    });
  }, []);

  // Extrai contexto do DOM
  useEffect(() => {
    const updateContext = () => {
      const ctx = extractContext();
      setUserContext(ctx);
    };

    const timer = setTimeout(updateContext, 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Aparição do avatar
  useEffect(() => {
    const dismissedAt = localStorage.getItem('fiorix-agent-dismissed');
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (diff < sevenDays) return;
    }

    const showTimer = setTimeout(() => {
      setIsVisible(true);
      const bubbleTimer = setTimeout(() => setShowBubble(true), 800);
      return () => clearTimeout(bubbleTimer);
    }, 1200);

    return () => clearTimeout(showTimer);
  }, [pathname]);

  // Auto-dismiss do balão após 15s para não ficar cobrindo o texto
  useEffect(() => {
    if (showBubble && !isChatOpen) {
      const autoCloseTimer = setTimeout(() => {
        setShowBubble(false);
      }, 15000);
      return () => clearTimeout(autoCloseTimer);
    }
  }, [showBubble, isChatOpen]);

  // Scroll automático
  useEffect(() => {
    if (isChatOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen, isMinimized]);

  // Focus no input
  useEffect(() => {
    if (isChatOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isChatOpen, isMinimized]);

  const dismissFor7Days = useCallback(() => {
    localStorage.setItem('fiorix-agent-dismissed', Date.now().toString());
    setShowBubble(false);
    setIsVisible(false);
  }, []);

  const closeBubble = useCallback(() => {
    setShowBubble(false);
  }, []);

  const openChat = useCallback(() => {
    const freshCtx = extractContext();
    setUserContext(freshCtx);
    setShowBubble(false);
    setIsMinimized(false);
    setIsChatOpen(true);
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: getContextMessage(pathname, freshCtx),
        timestamp: new Date(),
      }]);
    }
  }, [pathname, messages.length]);

  const handleClearChat = useCallback(() => {
    const freshCtx = extractContext();
    setUserContext(freshCtx);
    setMessages([{
      id: `welcome-${Date.now()}`,
      role: 'agent',
      content: getContextMessage(pathname, freshCtx),
      timestamp: new Date(),
    }]);
  }, [pathname]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const freshCtx = extractContext();
    setUserContext(freshCtx);

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
            departamento: freshCtx.itDepartamento || freshCtx.role,
            itTitulo: freshCtx.itTitulo,
            itCodigo: freshCtx.itCodigo,
            itVersao: freshCtx.itVersao,
            itDepartamento: freshCtx.itDepartamento,
            itPapel: freshCtx.itPapel,
            isResponsavel: freshCtx.isResponsavel,
            pathname,
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || getQuickReply(text, freshCtx);

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch {
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: getQuickReply(text, freshCtx),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [pathname]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion);
  }, [handleSendMessage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  }, [inputValue, handleSendMessage]);

  if (!isVisible && !isChatOpen) return null;

  const suggestions = getSuggestions(pathname);

  // Classes de posicionamento dinâmico
  const positionClasses = position === 'left'
    ? 'bottom-6 left-4 lg:left-72 items-start'
    : 'bottom-6 right-4 lg:right-6 items-end';

  const chatPositionClasses = position === 'left'
    ? 'bottom-6 left-4 lg:left-72'
    : 'bottom-6 right-4 lg:right-6';

  return (
    <>
      {/* ─── CSS Animations ─── */}
      <style jsx global>{`
        @keyframes fiorix-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fiorix-slide-up {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-bubble-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-chat-in {
          0% { opacity: 0; transform: translateY(12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fiorix-typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .fiorix-float { animation: fiorix-float 3.5s ease-in-out infinite; }
        .fiorix-slide-up { animation: fiorix-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .fiorix-bubble-in { animation: fiorix-bubble-in 0.3s ease-out forwards; }
        .fiorix-chat-in { animation: fiorix-chat-in 0.25s ease-out forwards; }
        .fiorix-typing-dot:nth-child(1) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0s; }
        .fiorix-typing-dot:nth-child(2) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0.2s; }
        .fiorix-typing-dot:nth-child(3) { animation: fiorix-typing-dot 1.4s ease-in-out infinite 0.4s; }
      `}</style>

      {/* ─── Avatar Flutuante ─── */}
      {isVisible && !isChatOpen && (
        <div className={`fixed ${positionClasses} z-[9998] flex flex-col gap-2 fiorix-slide-up select-none`}>
          {/* Bubble de mensagem */}
          {showBubble && (
            <div className="fiorix-bubble-in relative mb-1">
              <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-2xl max-w-[290px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#7c3aed] uppercase tracking-wider">FIORIX • IA</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={togglePosition}
                      className="p-1 text-[#9ca3af] hover:text-[#7c3aed] transition-colors rounded"
                      title={position === 'right' ? 'Mover para a esquerda' : 'Mover para a direita'}
                      aria-label="Mover lado"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
                      </svg>
                    </button>
                    <button
                      onClick={closeBubble}
                      className="p-1 text-[#9ca3af] hover:text-[#111827] transition-colors rounded"
                      aria-label="Fechar aviso"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>

                {/* Mensagem */}
                <p className="text-[12px] text-[#374151] leading-relaxed mb-3">
                  {getContextMessage(pathname, userContext)}
                </p>

                {/* Botões de ação */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChat}
                    className="bg-gradient-to-r from-[#facc15] to-[#f59e0b] text-[#111827] font-bold rounded-full px-4 py-1.5 text-[12px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                  >
                    Tirar dúvida 😊
                  </button>
                  <button
                    onClick={dismissFor7Days}
                    className="text-[11px] text-[#9ca3af] hover:text-[#4b5563] transition-colors px-2 py-1"
                  >
                    Depois
                  </button>
                </div>
              </div>

              {/* Seta da Bubble */}
              <div className={`absolute -bottom-2 ${position === 'left' ? 'left-6' : 'right-6'} w-3.5 h-3.5 bg-white border-r border-b border-[#e5e7eb] transform rotate-45`} />
            </div>
          )}

          {/* Botão do Avatar */}
          <button
            onClick={openChat}
            className="relative group fiorix-float focus:outline-none"
            aria-label="Abrir assistente FIORIX IA"
          >
            <div className="w-[62px] h-[62px] rounded-2xl border-[2.5px] border-[#facc15] shadow-lg shadow-yellow-500/20 bg-white overflow-hidden transition-transform group-hover:scale-105">
              <Image
                src="/fiorix-avatar.jpg"
                alt="FIORIX IA"
                width={62}
                height={62}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            {/* Dot online */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-xs" />
          </button>

          {/* Badge */}
          <span className="bg-[#7c3aed] text-white rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
            FIORIX • IA
          </span>
        </div>
      )}

      {/* ─── Chat Minimizado (Barra Dock Discreta) ─── */}
      {isChatOpen && isMinimized && (
        <div className={`fixed ${chatPositionClasses} z-[9999] fiorix-chat-in select-none`}>
          <div className="bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white rounded-2xl shadow-xl px-3.5 py-2 flex items-center gap-2.5 border border-white/20">
            <div className="relative w-7 h-7 rounded-xl overflow-hidden border border-white/40 bg-white shrink-0">
              <Image src="/fiorix-avatar.jpg" alt="FIORIX" width={28} height={28} className="w-full h-full object-cover" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#7c3aed]" />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                FIORIX • IA
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              </span>
              <span className="text-[10px] text-white/70 truncate max-w-[130px]">
                {getHeaderSubtitle(pathname, userContext)}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button
                onClick={togglePosition}
                className="p-1 hover:bg-white/15 rounded-md text-white/80 hover:text-white transition-all"
                title={position === 'right' ? 'Mover para esquerda' : 'Mover para direita'}
                aria-label="Mover lado"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsMinimized(false)}
                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-md text-[11px] font-bold transition-all flex items-center gap-1"
              >
                <span>Abrir</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
              </button>
              <button
                onClick={() => { setIsMinimized(false); setIsChatOpen(false); }}
                className="p-1 hover:bg-white/15 rounded-md text-white/80 hover:text-white transition-all"
                title="Fechar"
                aria-label="Fechar"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Chat Expandido ─── */}
      {isChatOpen && !isMinimized && (
        <div className={`fixed ${chatPositionClasses} z-[9999] fiorix-chat-in`}>
          <div className="w-[340px] sm:w-[365px] max-h-[490px] bg-white rounded-3xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-4 py-3 flex items-center gap-2.5 shrink-0 select-none">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl border-2 border-white/30 bg-white overflow-hidden">
                  <Image src="/fiorix-avatar.jpg" alt="FIORIX" width={36} height={36} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-[1.5px] border-[#7c3aed]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-white text-xs font-bold leading-tight">FIORIX • IA</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                </div>
                <p className="text-white/70 text-[10px] truncate leading-tight mt-0.5">
                  {getHeaderSubtitle(pathname, userContext)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Botão de nova conversa / limpar */}
                <button
                  onClick={handleClearChat}
                  className="w-7 h-7 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 rounded-lg transition-all"
                  title="Nova conversa / Limpar chat"
                  aria-label="Nova conversa"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                </button>
                {/* Botão de mover lado */}
                <button
                  onClick={togglePosition}
                  className="w-7 h-7 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 rounded-lg transition-all"
                  title={position === 'right' ? 'Mover para esquerda (não cobrir a IT)' : 'Mover para direita'}
                  aria-label="Mover lado do chat"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
                  </svg>
                </button>
                {/* Botão de minimizar */}
                <button
                  onClick={() => setIsMinimized(true)}
                  className="w-7 h-7 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 rounded-lg transition-all text-xs font-bold"
                  title="Minimizar chat"
                  aria-label="Minimizar chat"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                {/* Botão de fechar */}
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 rounded-lg transition-all"
                  title="Fechar chat"
                  aria-label="Fechar chat"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-[180px] max-h-[290px] bg-[#fafafa]">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] px-3.5 py-2 text-[12.5px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#7c3aed] text-white rounded-2xl rounded-br-sm'
                      : 'bg-white text-[#374151] border border-[#e5e7eb] rounded-2xl rounded-bl-sm shadow-xs'
                  }`}>
                    {renderFormattedMessage(msg.content, msg.role === 'user')}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#e5e7eb] rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-xs flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#facc15] fiorix-typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#facc15] fiorix-typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#facc15] fiorix-typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-3.5 pb-2 flex flex-wrap gap-1 shrink-0 bg-[#fafafa]">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    className="text-[11px] bg-[#f3f4f6] hover:bg-[#facc15] hover:text-[#111827] text-[#4b5563] px-2.5 py-1 rounded-full transition-all font-medium border border-transparent hover:border-[#f59e0b]/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-2.5 border-t border-[#e5e7eb] shrink-0 bg-white">
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Pergunte ao FIORIX..."
                  className="flex-1 h-9 rounded-full border border-[#e5e7eb] px-3.5 text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#facc15] focus:ring-2 focus:ring-[#facc15]/20 focus:outline-none transition-all bg-[#fafafa]"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="w-9 h-9 rounded-full bg-gradient-to-r from-[#facc15] to-[#f59e0b] flex items-center justify-center text-[#111827] disabled:opacity-35 hover:scale-105 active:scale-95 transition-all shadow-xs shrink-0"
                  aria-label="Enviar mensagem"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-[#9ca3af] select-none">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Canal seguro & confidencial • 7º RISP</span>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
