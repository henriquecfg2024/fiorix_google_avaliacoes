'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Barra de progresso fina no topo da tela (estilo NProgress/YouTube).
 * Aparece automaticamente durante navegação entre páginas.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevPathRef = useRef(pathname);

  // Intercepta cliques em links para detectar início da navegação
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
      if (href === pathname) return;

      // Início da navegação
      setIsNavigating(true);
      setProgress(0);
      setVisible(true);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  // Progresso animado (cresce rápido no início, depois desacelera)
  useEffect(() => {
    if (!isNavigating) return;

    // Inicia progresso
    setProgress(15);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Para em 90% até a página carregar
        if (prev < 40) return prev + 8;  // Rápido no início
        if (prev < 60) return prev + 4;  // Médio
        if (prev < 80) return prev + 1;  // Lento
        return prev + 0.3;               // Muito lento perto de 90%
      });
    }, 200);

    // Adiciona cursor wait no body
    document.body.style.cursor = 'wait';

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.body.style.cursor = '';
    };
  }, [isNavigating]);

  // Detecta quando a navegação terminou (pathname mudou)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;

      if (isNavigating) {
        // Completa a barra rapidamente
        setProgress(100);
        setTimeout(() => {
          setVisible(false);
          setIsNavigating(false);
          setProgress(0);
        }, 300);
      }
    }
  }, [pathname, isNavigating]);

  if (!visible) return null;

  return (
    <>
      {/* Barra de progresso */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Glow pulsante na ponta */}
        {progress < 100 && (
          <div
            className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-amber-400/50 to-transparent animate-pulse"
            style={{ right: `${100 - progress}%` }}
          />
        )}
      </div>

      {/* Overlay sutil para indicar carregamento */}
      {progress < 100 && (
        <div className="fixed inset-0 z-[9998] bg-black/5 pointer-events-none" />
      )}
    </>
  );
}
