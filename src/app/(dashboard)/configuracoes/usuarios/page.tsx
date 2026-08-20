import React from 'react';
import { getUsers, createUser } from '@/app/actions/admin';
import Link from 'next/link';
import { UserListTable } from '@/components/configuracoes/UserListTable';
import { auth } from '@/auth';
import { ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function UsuariosConfigPage() {
  const session = await auth();
  const currentUserRole = session?.user?.role || 'USER';
  const usuarios = await getUsers();

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <Link href="/configuracoes" className="hover:text-amber-300 transition-colors">
              Configurações
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-amber-300">Usuários</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
                  Gestão de Usuários do Cartório
                </h1>
                <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 font-mono text-xs text-amber-300">
                  CONTROLE DE ACESSO
                </Badge>
              </div>
              <p className="max-w-4xl text-sm leading-relaxed text-white/58">
                Cadastre novos usuários para acessar e operar o sistema FIORIX neste cartório.
              </p>
            </div>

            <Link href="/configuracoes">
              <Button variant="outline" className="gap-2 border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                <ArrowLeft className="h-4 w-4" />
                Voltar para Configurações
              </Button>
            </Link>
          </div>

          <form action={createUser} className="mt-4 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <UserPlus className="h-4 w-4 text-amber-300" />
              <span>Cadastrar Novo Usuário</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Nome *
                </label>
                <Input
                  type="text"
                  name="name"
                  required
                  placeholder="Nome do usuário"
                  className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  E-mail de Acesso *
                </label>
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="usuario@cartorio.com.br"
                  className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Senha Inicial *
                </label>
                <Input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Função *
                </label>
                <select
                  name="role"
                  defaultValue="USER"
                  className="w-full h-10 px-3 rounded-md border border-white/12 bg-[#0A0F1E] text-sm text-white focus:outline-hidden focus:border-amber-400/50"
                >
                  <option value="USER">Usuário (USER)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white shadow-xs transition-colors hover:brightness-105"
                >
                  Cadastrar
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-extrabold text-white">
              Usuários Ativos ({usuarios.length})
            </h2>
          </div>

          <UserListTable usuarios={usuarios} currentUserRole={currentUserRole} />
        </div>
      </main>
    </div>
  );
}
