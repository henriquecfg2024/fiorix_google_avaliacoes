'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { FiorixSidebar } from '@/components/layout/FiorixSidebar';
import { FiorixTopbar } from '@/components/layout/FiorixTopbar';
import { NavigationProgress } from '@/components/layout/NavigationProgress';

import { FiorixAgent } from '@/components/agent/FiorixAgent';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.remove('t1', 't2', 't3', 't4');
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#070A12] overflow-hidden">
      {/* Barra de progresso no topo (estilo YouTube) */}
      <NavigationProgress />
      {/* Sidebar - Desktop Only */}
      <FiorixSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PwaInstallBanner />
        <FiorixTopbar />

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
        </main>
      </div>

      {/* Assistente FIORIX • IA — global em todas as páginas */}
      <FiorixAgent />
    </div>
  );
}
