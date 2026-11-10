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
  className = 'group inline-flex items-center gap-2.5 rounded-xl border-2 border-amber-400/85 bg-gradient-to-r from-amber-500/25 via-amber-500/20 to-amber-600/25 hover:from-amber-500/40 hover:to-amber-500/30 px-4 py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-amber-100 hover:text-white transition-all shadow-lg shadow-amber-950/50 ring-2 ring-amber-400/20 hover:ring-amber-300/40 active:scale-95 cursor-pointer',
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
      title="Clique para voltar à tela anterior"
      className={className}
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-950 shadow-sm group-hover:-translate-x-0.5 transition-transform">
        <ArrowLeft className="h-4 w-4 stroke-[2.75]" />
      </span>
      <span>{label}</span>
    </button>
  );
}
