'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { FiorixHeader } from '@/components/fiorix/FiorixHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.remove('t1', 't2', 't3', 't4');
    localStorage.removeItem('fiorix_theme');
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#070A12]">
      <div className="flex-1 flex flex-col">
        <PwaInstallBanner />
        <FiorixHeader />

        <main className="flex-1">
          {children}
        </main>
      </div>

      <footer className="footer-strip">
        FIORIX · Preview v0.1 · 7º Cartório de Registro de Imóveis de São Paulo
      </footer>
    </div>
  );
}
