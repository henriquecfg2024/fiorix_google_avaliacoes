'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BotaoVoltarTelaAnteriorProps {
  fallbackHref?: string;
  className?: string;
  label?: string;
}

export function BotaoVoltarTelaAnterior({
  fallbackHref = '/cartorio-virtual',
  className = 'inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.1] px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm active:scale-95 cursor-pointer',
  label = 'Voltar à Tela Anterior',
}: BotaoVoltarTelaAnteriorProps) {
  const router = useRouter();

  const handleVoltar = () => {
    if (typeof window === 'undefined') return;

    // Se a janela tem histórico de navegação próprio, volta para a tela anterior
    if (window.history.length > 1) {
      router.back();
      return;
    }

    // Se foi aberta como janela/aba destacada a partir de outra tela (ex.: Cartório Virtual),
    // devolve o foco para a janela de origem e fecha a janela destacada
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
      } catch {
        /* ignora restrições cross-origin */
      }
      try {
        window.close();
        return;
      } catch {
        /* fallback abaixo caso o navegador bloqueie window.close */
      }
    }

    if (document.referrer && document.referrer.startsWith(window.location.origin)) {
      window.location.href = document.referrer;
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleVoltar}
      title="Voltar à tela anterior"
      className={className}
    >
      <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
      <span>{label}</span>
    </button>
  );
}
