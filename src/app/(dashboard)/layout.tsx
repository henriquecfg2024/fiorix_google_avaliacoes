'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { handleSignOut } from '@/app/actions/auth';
import { getPendingCount } from '@/app/actions/reviews';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('5');
  const [showMenu, setShowMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem('fiorix_theme') || '5';
    setTheme(savedTheme);
    applyTheme(savedTheme);

    // Fetch live pending count
    getPendingCount().then((count) => setPendingCount(count)).catch(() => {});
  }, [pathname]);

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

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-icon">F</div>
          <span className="logo-text">FIORIX</span>
        </div>

        <nav>
          <Link className={isActive('/dashboard')} href="/dashboard">Home</Link>
          <Link className={isActive('/avaliacoes')} href="/avaliacoes">Avaliações</Link>
          <Link className={isActive('/estatisticas')} href="/estatisticas">Estatísticas</Link>
          <Link className={isActive('/relatorios')} href="/relatorios">Relatórios</Link>
          <Link className={isActive('/configuracoes')} href="/configuracoes">Configurações</Link>
        </nav>

        <div className="header-right">
          {/* THEME SWITCHER */}
          <div className="theme-switcher">
            <span className="theme-switcher-label">Tema</span>
            {[1, 2, 3, 4, 5].map((t) => (
              <div
                key={t}
                className={`theme-dot ${theme === String(t) ? 'active' : ''}`}
                data-t={t}
                onClick={() => applyTheme(String(t))}
              ></div>
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
              transition: 'background 0.3s ease'
            }}
          >
            {pendingCount > 0 ? `${pendingCount} pendente(s)` : '✓ 0 pendências'}
          </Link>
          
          <div className="tenant-selector">🏢 <span>7º RI São Paulo</span> ▾</div>
          
          {/* AVATAR WITH LOGOUT DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <div 
              className="avatar" 
              onClick={() => setShowMenu(!showMenu)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Menu do Usuário"
            >
              HM
            </div>

            {showMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '48px',
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '8px 0',
                width: '160px',
                zIndex: 999
              }}>
                <div style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>
                  Henrique Master
                </div>

                <form action={handleSignOut}>
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
      </header>

      {children}

      <div className="footer-strip">FIORIX · Preview v0.1 · 7º Cartório de Registro de Imóveis de São Paulo</div>
    </>
  );
}
