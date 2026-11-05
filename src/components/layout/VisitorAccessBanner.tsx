'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, Eye } from 'lucide-react';
import { loadCurrentUserOnce } from '@/lib/navigation/client-data';

interface VisitorAccessBannerProps {
  variant?: 'default' | 'compact';
}

export function VisitorAccessBanner({ variant = 'default' }: VisitorAccessBannerProps) {
  const [visitorUser, setVisitorUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    loadCurrentUserOnce()
      .then((user) => {
        if (mounted && user && String(user.role).toUpperCase() === 'VISITANTE') {
          setVisitorUser({
            name: user.name || 'Visitante Autorizado',
            email: user.email || '',
            role: user.role,
          });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (!visitorUser) return null;

  if (variant === 'compact') {
    return (
      <div
        role="status"
        aria-label="Aviso de acesso provisório de visitante"
        className="w-full border-b border-amber-400/35 bg-[#0B1020]/95 px-4 py-2 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2 print:hidden z-50"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wider text-amber-300">
            Credencial de Visitante • Acesso Provisório
          </span>
          <span className="hidden md:inline text-white/65">
            — Escopo restrito e monitorado ({visitorUser.name})
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
          <Eye className="h-3 w-3" />
          Sessão Auditada
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Credencial de visitante com acesso provisório"
      className="mx-auto max-w-[1750px] w-full px-4 sm:px-6 lg:px-8 pt-4 print:hidden"
    >
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-500/[0.12] via-[#0B1020]/95 to-teal-500/[0.10] px-4 py-3.5 sm:px-5 shadow-[0_8px_30px_rgba(245,158,11,0.08)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/15 text-amber-300 shadow-inner">
              <ShieldAlert className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/45 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Acesso de Visitante • Provisório
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-400/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                  <Clock className="h-3 w-3" />
                  Credencial Temporária
                </span>
              </div>

              <p className="text-xs text-slate-200/90 leading-relaxed">
                Sessão concedida em caráter <strong className="text-amber-200">provisório e restrito</strong> para{' '}
                <strong className="text-white">{visitorUser.name}</strong>
                {visitorUser.email ? ` (${visitorUser.email})` : ''}. Os módulos liberados obedecem à política de privilégio mínimo do{' '}
                <strong className="text-white">7º Registro de Imóveis de São Paulo</strong>, com rastreabilidade e auditoria ativa de segurança.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80">
              <Eye className="h-3.5 w-3.5 text-teal-300" />
              <span>Ambiente Monitorado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

