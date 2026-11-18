'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BotaoVoltarTelaAnteriorProps {
  fallbackHref?: string;
  className?: string;
  label?: string;
  compact?: boolean;
}

const COMPACT_CLASSES =
  'h-7 px-2 rounded-md border border-amber-400/70 bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-bold text-amber-100 hover:text-white inline-flex items-center gap-1.5 transition cursor-pointer shrink-0';

const DEFAULT_CLASSES =
  'group inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/65 bg-amber-500/15 hover:bg-amber-500/25 px-3 text-xs font-bold text-amber-100 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer shrink-0';

export function BotaoVoltarTelaAnterior({
  fallbackHref = '/cartorio-virtual',
  className,
  label = 'Voltar',
  compact = false,
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

  const resolvedClassName = className ?? (compact ? COMPACT_CLASSES : DEFAULT_CLASSES);

  return (
    <button
      type="button"
      onClick={handleVoltar}
      title="Clique para voltar à tela anterior"
      className={resolvedClassName}
    >
      <ArrowLeft className="h-3.5 w-3.5 text-amber-300 shrink-0 transition-transform group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  );
}
