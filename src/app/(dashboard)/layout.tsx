'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { handleSignOut, getCurrentUser } from '@/app/actions/auth';
import { getPendingCount } from '@/app/actions/reviews';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { Menu, X, LogOut, Building2, Clock, CheckCircle } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('5');
  const [showMenu, setShowMenu] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem('fiorix_theme') || '5';
    setTheme(savedTheme);
    applyTheme(savedTheme);

    // Fetch live user session details
    getCurrentUser()
      .then((user) => {
        if (user) setCurrentUser(user);
      })
      .catch(() => {});

    // Fetch live pending count
    getPendingCount()
      .then((count) => setPendingCount(count))
      .catch(() => {});
  }, [pathname]);

  // Close drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false);
    setShowMenu(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyTheme = (t: string) => {
    document.body.className = t === '5' ? '' : `t${t}`;
    localStorage.setItem('fiorix_theme', t);
    setTheme(t);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return 'active';
    if (path !== '/dashboard' && pathname?.startsWith(path)) return 'active';
    return '';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const navLinks = [
    { href: '/dashboard', label: 'Home' },
    { href: '/avaliacoes', label: 'Avaliações', badge: pendingCount },
    { href: '/estatisticas', label: 'Estatísticas' },
    { href: '/relatorios', label: 'Relatórios' },
    { href: '/bi', label: 'Módulo BI' },
  ];

  if (currentUser?.role && currentUser.role !== 'USER') {
    navLinks.push({ href: '/configuracoes', label: 'Configurações' });
  }

  return (
    <>
      <PwaInstallBanner />
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="header-inner">
          <div className="header-left flex items-center justify-between w-full lg:w-auto">
            <div className="logo flex items-center gap-2">
              <div className="logo-icon">F</div>
              <span className="logo-text">FIORIX</span>
              <span className="logo-tagline hidden md:inline-flex items-center gap-1">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ marginRight: '5px', verticalAlign: 'middle' }}
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                Respostas Google Avaliações
              </span>
            </div>

            {/* MOBILE HAMBURGER BUTTON */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              )}
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </button>

            {/* DESKTOP NAV */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link className={isActive('/dashboard')} href="/dashboard">
                Home
              </Link>
              <Link className={isActive('/avaliacoes')} href="/avaliacoes">
                Avaliações
              </Link>
              <Link className={isActive('/estatisticas')} href="/estatisticas">
                Estatísticas
              </Link>
              <Link className={isActive('/relatorios')} href="/relatorios">
                Relatórios
              </Link>
              <Link className={isActive('/bi')} href="/bi">
                Módulo BI
              </Link>
              {currentUser?.role && currentUser.role !== 'USER' && (
                <Link className={isActive('/configuracoes')} href="/configuracoes">
                  Configurações
                </Link>
              )}
            </nav>
          </div>

          {/* DESKTOP HEADER RIGHT */}
          <div className="header-right hidden lg:flex">
            {/* THEME SWITCHER */}
            <div className="theme-switcher">
              <span className="theme-switcher-label">Tema</span>
              {[1, 2, 3, 4, 5].map((t) => (
                <div
                  key={t}
                  className={`theme-dot ${theme === String(t) ? 'active' : ''}`}
                  data-t={t}
                  onClick={() => applyTheme(String(t))}
                />
              ))}
            </div>

            <Link
              href="/avaliacoes?status=PENDING"
              className="badge-new"
              style={{
                textDecoration: 'none',
                cursor: 'pointer',
                display: 'inline-block',
                background: pendingCount > 0 ? '#ef4444' : '#10b981',
                color: 'white',
                transition: 'background 0.3s ease',
              }}
            >
              {pendingCount > 0
                ? `${pendingCount} aguardando resposta`
                : '✓ Todas respondidas'}
            </Link>

            <div className="tenant-selector">
              🏢 <span>7º RI São Paulo</span> ▾
            </div>

            {/* AVATAR WITH LOGOUT DROPDOWN */}
            <div style={{ position: 'relative' }}>
              <div
                className="avatar"
                onClick={() => setShowMenu(!showMenu)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title={currentUser?.name || 'Menu do Usuário'}
              >
                {getInitials(currentUser?.name)}
              </div>

              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '48px',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    padding: '12px 0',
                    width: '200px',
                    zIndex: 999,
                  }}
                >
                  <div
                    style={{
                      padding: '0 16px 10px 16px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentUser?.name || 'Usuário'}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '2px',
                      }}
                    >
                      {currentUser?.email}
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background:
                            currentUser?.role === 'MASTER'
                              ? '#fef3c7'
                              : currentUser?.role === 'ADMIN'
                              ? '#dbeafe'
                              : '#f1f5f9',
                          color:
                            currentUser?.role === 'MASTER'
                              ? '#92400e'
                              : currentUser?.role === 'ADMIN'
                              ? '#1e40af'
                              : '#334155',
                          border:
                            currentUser?.role === 'MASTER'
                              ? '1px solid #fde68a'
                              : currentUser?.role === 'ADMIN'
                              ? '1px solid #bfdbfe'
                              : '1px solid #cbd5e1',
                        }}
                      >
                        {currentUser?.role || 'USER'}
                      </span>
                    </div>
                  </div>

                  <form action={handleSignOut} style={{ marginTop: '4px' }}>
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        fontSize: '13px',
                        color: '#dc2626',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      🚪 Sair (Logout)
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER OVERLAY & PANEL */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out lg:hidden ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* DRAWER TOP HEADER */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="logo-icon">F</div>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight block">
                FIORIX
              </span>
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-blue-600" />
                7º RI São Paulo
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Fechar menu"
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DRAWER NAV LINKS */}
        <div className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          {navLinks.map((link) => {
            const active = isActive(link.href) === 'active';
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{link.label}</span>
                {link.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      link.badge > 0
                        ? active
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-700'
                        : active
                        ? 'bg-emerald-500 text-white'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {link.badge > 0 ? `${link.badge} pendente` : '✓ 0'}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* DRAWER FOOTER (USER & THEME & LOGOUT) */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/70 space-y-4">
          {/* THEME SWITCHER IN DRAWER */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tema Visual:
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  onClick={() => applyTheme(String(t))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    theme === String(t)
                      ? 'border-blue-600 scale-110 shadow-xs'
                      : 'border-white opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    background:
                      t === 1
                        ? '#2563eb'
                        : t === 2
                        ? '#059669'
                        : t === 3
                        ? '#7c3aed'
                        : t === 4
                        ? '#d97706'
                        : '#0f172a',
                  }}
                  title={`Tema ${t}`}
                />
              ))}
            </div>
          </div>

          {/* USER INFO */}
          <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
              {getInitials(currentUser?.name)}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">
                {currentUser?.name || 'Usuário'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser?.email}
              </div>
            </div>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0">
              {currentUser?.role || 'USER'}
            </span>
          </div>

          {/* LOGOUT BUTTON */}
          <form action={handleSignOut} className="pt-1">
            <button
              type="submit"
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-red-200/80 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair do Sistema</span>
            </button>
          </form>
        </div>
      </div>

      {children}

      <div className="footer-strip">
        FIORIX · Preview v0.1 · 7º Cartório de Registro de Imóveis de São Paulo
      </div>
    </>
  );
}

