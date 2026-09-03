'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { FiorixSidebar } from '@/components/layout/FiorixSidebar';
import { FiorixTopbar } from '@/components/layout/FiorixTopbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.remove('t1', 't2', 't3', 't4');
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#070A12] overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <FiorixSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PwaInstallBanner />
        <FiorixTopbar />

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
          
          <footer className="footer-strip sticky bottom-0 z-10 bg-[#070A12]/90 backdrop-blur-sm border-t border-white/5 py-2 px-4 text-center text-xs text-white/40">
            FIORIX
          </footer>
        </main>
      </div>
    </div>
  );
}
