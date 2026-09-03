import React from 'react';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { FiorixSidebar } from '@/components/layout/FiorixSidebar';
import { FiorixTopbar } from '@/components/layout/FiorixTopbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#070A12] overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <FiorixSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PwaInstallBanner />
        <FiorixTopbar />

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
