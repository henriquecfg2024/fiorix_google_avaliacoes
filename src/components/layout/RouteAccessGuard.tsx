'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { checkRouteAccessAction } from '@/app/actions/nav-permissions';

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    // Rotas sempre livres
    if (!pathname || pathname === '/dashboard' || pathname === '/') {
      setIsAllowed(true);
      return;
    }

    let isMounted = true;
    setChecking(true);

    checkRouteAccessAction(pathname)
      .then((allowed) => {
        if (isMounted) {
          setIsAllowed(allowed);
        }
      })
      .catch(() => {
        // Em caso de erro na verificação, mantém acessível para evitar travamentos
        if (isMounted) {
          setIsAllowed(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pathname]);

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
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
