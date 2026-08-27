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
    <>
      <PwaInstallBanner />
      <FiorixHeader />

      {children}

      <div className="footer-strip">
        FIORIX · Preview v0.1 · 7º Cartório de Registro de Imóveis de São Paulo
      </div>
    </>
  );
}
