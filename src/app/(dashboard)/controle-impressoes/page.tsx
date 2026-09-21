import React from 'react';
import { Metadata } from 'next';
import { ControleImpressoesClient } from '@/components/controle-impressoes/ControleImpressoesClient';

export const metadata: Metadata = {
  title: 'Impressões | FIORIX',
  description: 'Painel de produtividade das impressões com base na data do último registro e data das impressões realizadas.',
};

export default function ControleImpressoesPage() {
  return (
    <div className="min-h-full bg-[#070A12] text-white relative overflow-x-hidden">
      {/* Luzes de fundo atmosféricas (Design System FIORIX) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-purple-500/8 blur-3xl" />
        <div className="absolute top-1/4 right-0 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1850px] w-full px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <ControleImpressoesClient />
      </div>
    </div>
  );
}
