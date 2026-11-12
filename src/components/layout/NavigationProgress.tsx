'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Barra de progresso fina no topo da tela (estilo NProgress/YouTube).
 * Aparece automaticamente durante navegação entre páginas ou filtros de URL (searchParams).
 */
function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() || '';
  const currentRouteKey = `${pathname || ''}${searchString ? `?${searchString}` : ''}`;

  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevRouteKeyRef = useRef(currentRouteKey);

  // Intercepta cliques em links para detectar início da navegação
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = (e.target as HTMLElement | null)?.closest?.('a');
      if (!target) return;
      if (target.target && target.target !== '_self') return;
      if (target.hasAttribute('download')) return;

      const href = target.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) {
        return;
      }

      try {
        const resolved = new URL(href, window.location.origin);
        if (resolved.origin !== window.location.origin) return;
        const targetRouteKey = `${resolved.pathname}${resolved.search}`;
        const activeRouteKey = `${window.location.pathname}${window.location.search}`;
        if (targetRouteKey === activeRouteKey) return;
      } catch {
        if (href === currentRouteKey) return;
      }

      // Início da navegação
      setIsNavigating(true);
      setProgress(0);
      setVisible(true);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [currentRouteKey]);

  // Progresso animado (cresce rápido no início, depois desacelera) + timeout de segurança
  useEffect(() => {
    if (!isNavigating) return;

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

    // Timeout de segurança: garante que a barra nunca fique presa caso a navegação seja abortada
    safetyTimeoutRef.current = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setIsNavigating(false);
        setProgress(0);
      }, 250);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [isNavigating]);

  // Detecta quando a navegação terminou (pathname OU searchParams mudaram)
  useEffect(() => {
    if (prevRouteKeyRef.current !== currentRouteKey) {
      prevRouteKeyRef.current = currentRouteKey;

      if (isNavigating) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        setProgress(100);
        const timer = setTimeout(() => {
          setVisible(false);
          setIsNavigating(false);
          setProgress(0);
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [currentRouteKey, isNavigating]);

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

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
