'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { checkRouteAccessCached } from '@/lib/navigation/client-data';
import { VisitorAccessBanner } from '@/components/layout/VisitorAccessBanner';

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean>(true);
  const [fallbackHref, setFallbackHref] = useState<string>('/dashboard');

  useEffect(() => {
    // Rotas estruturalmente livres para sessão autenticada
    if (!pathname || pathname === '/' || pathname === '/minha-conta') {
      setIsAllowed(true);
      return;
    }

    let isMounted = true;

    checkRouteAccessCached(pathname)
      .then((res) => {
        if (!isMounted) return;
        setFallbackHref(res.fallbackHref || '/minha-conta');
        if (!res.allowed && pathname === '/dashboard' && res.fallbackHref && res.fallbackHref !== '/dashboard') {
          router.replace(res.fallbackHref);
          return;
        }
        setIsAllowed(res.allowed);
      })
      .catch(() => {
        if (isMounted) {
          setIsAllowed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (!isAllowed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0B1020]/95 backdrop-blur-xl p-8 shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Acesso Não Autorizado</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              O acesso a este menu ou rota foi desativado para o seu perfil pelo MASTER ou Administrador do Cartório.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={fallbackHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Ir para Módulo Autorizado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <VisitorAccessBanner />
      {children}
    </>
  );
}
