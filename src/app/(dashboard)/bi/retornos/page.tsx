import React from "react";
import { Metadata } from "next";
import { RetornosDashboardClient } from "@/components/bi/RetornosDashboardClient";

export const metadata: Metadata = {
  title: "Retornos — Gestão de Prazos | FIORIX",
  description: "Consulte os retornos, responsáveis e observações dos títulos.",
};

export default function RetornosPage() {
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden print:bg-white print:text-black print:min-h-0 print:p-0">
      {/* Luzes de fundo atmosféricas do Design System FIORIX (Ocultadas na Impressão) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
        <div className="absolute -top-32 left-1/3 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute top-1/4 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1750px] w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 print:max-w-none print:w-full print:p-0 print:m-0">
        <RetornosDashboardClient />
      </div>
    </div>
  );
}
