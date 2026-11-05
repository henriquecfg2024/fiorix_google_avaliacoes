'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Eye, Check, X } from 'lucide-react';
import { loadCurrentUserOnce } from '@/lib/navigation/client-data';

interface VisitorAccessBannerProps {
  variant?: 'default' | 'compact';
}

const STORAGE_KEY_PREFIX = 'fiorix:visitor-banner-hidden:';
export const VISITOR_BANNER_TOGGLE_EVENT = 'fiorix:toggle-visitor-banner';

export function VisitorAccessBanner({ variant = 'default' }: VisitorAccessBannerProps) {
  const [visitorUser, setVisitorUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  const getStorageKey = useCallback((email: string) => {
    return `${STORAGE_KEY_PREFIX}${(email || 'default').toLowerCase()}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    loadCurrentUserOnce()
      .then((user) => {
        if (mounted && user && String(user.role).toUpperCase() === 'VISITANTE') {
          const email = user.email || '';
          try {
            if (typeof window !== 'undefined' && window.sessionStorage.getItem(getStorageKey(email)) === '1') {
              setIsHidden(true);
            }
          } catch {}
          setVisitorUser({
            name: user.name || 'Visitante Autorizado',
            email,
            role: user.role,
          });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [getStorageKey]);

  const setHiddenPersist = useCallback(
    (nextHidden: boolean) => {
      setIsHidden(nextHidden);
      if (!visitorUser) return;
      try {
        const key = getStorageKey(visitorUser.email);
        if (nextHidden) {
          window.sessionStorage.setItem(key, '1');
        } else {
          window.sessionStorage.removeItem(key);
        }
      } catch {}
    },
    [getStorageKey, visitorUser]
  );

  useEffect(() => {
    const handleToggle = () => {
      setIsHidden((prev) => {
        const next = !prev;
        if (visitorUser) {
          try {
            const key = getStorageKey(visitorUser.email);
            if (next) window.sessionStorage.setItem(key, '1');
            else window.sessionStorage.removeItem(key);
          } catch {}
        }
        return next;
      });
    };
    window.addEventListener(VISITOR_BANNER_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(VISITOR_BANNER_TOGGLE_EVENT, handleToggle);
  }, [getStorageKey, visitorUser]);

  if (!visitorUser || isHidden) return null;

  if (variant === 'compact') {
    return (
      <div
        role="status"
        aria-label="Aviso de acesso provisório de visitante"
        className="w-full border-b border-amber-400/30 bg-[#0B1020]/95 px-4 py-1.5 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2 print:hidden z-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="font-bold text-amber-200 truncate">
            Credencial temporária ({visitorUser.name}) — acesso restrito e monitorado
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHiddenPersist(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] px-2.5 py-0.5 text-[11px] font-semibold text-white/85 hover:text-white transition-colors cursor-pointer"
          title="Ocultar aviso durante esta sessão"
        >
          <X className="h-3 w-3" />
          <span>Ocultar</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Aviso de credencial temporária de visitante"
      className="mx-auto max-w-[1750px] w-full px-4 sm:px-6 lg:px-8 pt-3 print:hidden"
    >
      <div className="relative overflow-hidden rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/[0.10] via-[#0B1020]/95 to-teal-500/[0.08] px-3.5 py-2.5 sm:px-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/35 bg-amber-400/15 text-amber-300">
              <ShieldAlert className="h-4 w-4" />
            </div>

            <p className="text-xs text-slate-200/90 leading-snug">
              <strong className="text-amber-200">Credencial temporária</strong> concedida a{' '}
              <strong className="text-white">{visitorUser.name}</strong> — acesso restrito aos módulos liberados pelo{' '}
              <strong className="text-white">7º RI de São Paulo</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/75">
              <Eye className="h-3.5 w-3.5 text-teal-300" />
              <span>Ambiente Monitorado</span>
            </span>

            <button
              type="button"
              onClick={() => setHiddenPersist(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-400/15 hover:bg-amber-400/25 px-3 py-1 text-[11px] font-bold text-amber-100 hover:text-white transition-colors cursor-pointer"
              title="Ocultar este aviso após a leitura (clique no selo VISITANTE no topo caso queira rever)"
            >
              <Check className="h-3.5 w-3.5 text-amber-300" />
              <span>Ciente · Ocultar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
