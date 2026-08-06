'use client';

import React, { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('5');

  useEffect(() => {
    const savedTheme = localStorage.getItem('fiorix_theme') || '5';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (t: string) => {
    document.body.className = t === '5' ? '' : `t${t}`;
    localStorage.setItem('fiorix_theme', t);
    setTheme(t);
  };

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-icon">F</div>
          <span className="logo-text">FIORIX</span>
        </div>

        <nav>
          <a className="active" href="/dashboard">Home</a>
          <a href="/avaliacoes">Avaliações</a>
          <a href="/estatisticas">Estatísticas</a>
          <a href="/relatorios">Relatórios</a>
          <a href="/configuracoes">Configurações</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
          
          <div className="badge-new">3 novas avaliações</div>
          <div className="tenant-selector">🏢 <span>7º RI São Paulo</span> ▾</div>
          <div className="avatar">HM</div>
        </div>
      </header>

      {children}

      <div className="footer-strip">FIORIX · Preview v0.1 · 7º Cartório de Registro de Imóveis de São Paulo</div>
    </>
  );
}
