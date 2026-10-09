import React from "react";
import { Metadata } from "next";
import { QualidadeDashboardClient } from "@/components/bi/QualidadeDashboardClient";

export const metadata: Metadata = {
  title: "Qualidade — Gestão de Prazos | FIORIX",
  description: "Controle de qualidade, retornos internos e limites de erro.",
};

export default function QualidadePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white transition-colors duration-300 relative overflow-hidden print:bg-white print:text-black print:min-h-0 print:p-0">
      {/* Luzes de fundo atmosféricas do Design System FIORIX (Ocultadas na Impressão) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/8 blur-3xl" />
        <div className="absolute top-1/4 right-0 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1750px] w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 print:max-w-none print:w-full print:p-0 print:m-0">
        <QualidadeDashboardClient />
      </div>
    </div>
  );
}
