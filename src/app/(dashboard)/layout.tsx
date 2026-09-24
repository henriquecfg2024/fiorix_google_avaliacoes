'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { FiorixSidebar } from '@/components/layout/FiorixSidebar';
import { FiorixTopbar } from '@/components/layout/FiorixTopbar';
import { NavigationProgress } from '@/components/layout/NavigationProgress';

import { FiorixAgent } from '@/components/agent/FiorixAgent';
import { GlobalMessagingListener } from '@/components/mensagens/GlobalMessagingListener';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.remove('t1', 't2', 't3', 't4');
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#070A12] overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      {/* Barra de progresso no topo (estilo YouTube) */}
      <div className="print:hidden">
        <NavigationProgress />
      </div>

      {/* Sidebar - Desktop Only */}
      <div className="print:hidden">
        <FiorixSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden print:h-auto print:overflow-visible print:w-full print:block">
        <div className="print:hidden">
          <PwaInstallBanner />
          <FiorixTopbar />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative print:h-auto print:overflow-visible print:block print:p-0">
          {children}
        </main>
      </div>

      {/* Ouvinte global de mensagens em tempo real com alertas na área de trabalho e som */}
      <div className="print:hidden">
        <GlobalMessagingListener />
      </div>

      {/* Assistente FIORIX • IA — global em todas as páginas */}
      <div className="print:hidden">
        <FiorixAgent />
      </div>
    </div>
  );
}
