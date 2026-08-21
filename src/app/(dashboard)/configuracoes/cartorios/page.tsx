import React from 'react';
import { getTenants, createTenant } from '@/app/actions/admin';
import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function CartoriosConfigPage() {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'MASTER') {
    redirect('/dashboard');
  }

  const cartorios = await getTenants();

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/configuracoes" className="hover:text-amber-300 transition-colors">
                Configurações
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Cartórios</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Gestão de Cartórios (Multi-Tenant)
              </h1>
              <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                MASTER ADMIN
              </Badge>
            </div>
          </div>

          <Link href="/configuracoes">
            <Button variant="outline" className="gap-2 border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para Configurações
            </Button>
          </Link>
        </div>

        <form action={createTenant} className="rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] space-y-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-white">
            <Building2 className="h-4 w-4 text-amber-300" />
            <span>Cadastrar Novo Cartório</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Nome do Cartório *
              </label>
              <input
                type="text"
                name="tenantName"
                required
                placeholder="Ex: 8º Cartório de Notas de SP"
                className="w-full h-10 px-3 rounded-lg border border-white/16 bg-[#0A0F1E] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                E-mail do Administrador *
              </label>
              <input
                type="email"
                name="adminEmail"
                required
                placeholder="admin@8cartorio.com.br"
                className="w-full h-10 px-3 rounded-lg border border-white/16 bg-[#0A0F1E] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Senha Inicial *
              </label>
              <input
                type="password"
                name="adminPassword"
                required
                placeholder="••••••••"
                className="w-full h-10 px-3 rounded-lg border border-white/16 bg-[#0A0F1E] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-xs transition-colors"
              >
                Cadastrar Cartório
              </Button>
            </div>
          </div>
        </form>

        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-extrabold text-white">
              Cartórios Cadastrados ({cartorios.length})
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/12">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/12 bg-[#0B1020] text-[11px] font-bold uppercase tracking-[0.16em] text-white/58">
                  <th className="p-3 pl-5 sm:p-4">Cartório</th>
                  <th className="p-3 sm:p-4">Usuários</th>
                  <th className="p-3 sm:p-4">Avaliações</th>
                  <th className="p-3 sm:p-4">Colaboradores</th>
                  <th className="p-3 pr-5 text-right sm:p-4">Data de Criação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 font-medium text-white/80">
                {cartorios.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="p-3 pl-5 font-bold text-white sm:p-4">{c.name}</td>
                    <td className="p-3 sm:p-4 text-cyan-300 font-semibold">{c._count.users}</td>
                    <td className="p-3 sm:p-4 text-emerald-300 font-semibold">{c._count.reviews}</td>
                    <td className="p-3 sm:p-4 text-amber-300 font-semibold">{c._count.colaboradores}</td>
                    <td className="p-3 pr-5 text-right text-white/60 sm:p-4">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
