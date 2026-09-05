import React from 'react';
import { getUsers, createUser } from '@/app/actions/admin';
import Link from 'next/link';
import { UserListTable } from '@/components/configuracoes/UserListTable';
import { auth } from '@/auth';
import { ArrowLeft, UserPlus, Users, ShieldCheck, CheckCircle2, Info } from 'lucide-react';
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
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/configuracoes" className="hover:text-amber-300 transition-colors">
                Configurações
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Usuários</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Gestão de Usuários do Cartório
              </h1>
              <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                FONTE ÚNICA 7º RI
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

        {/* Card Informativo Origem dos Dados */}
        <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 text-xs text-slate-300 flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold mb-0.5">Origem Oficial de Dados do Cartório</strong>
            Todos os colaboradores cadastrados nesta tela são automaticamente sincronizados e utilizados pelo RH para{' '}
            <strong className="text-indigo-300">Comunicados Internos</strong>,{' '}
            <strong className="text-indigo-300">Validação 1-para-1 de Holerites por CPF</strong>,{' '}
            <strong className="text-indigo-300">Planejamento de Férias</strong> e na{' '}
            <strong className="text-indigo-300">Matriz de Polivalência de ITs</strong>.
          </div>
        </div>

        {/* Formulário Cadastrar Novo Usuário */}
        <form action={createUser} className="mt-4 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <UserPlus className="h-4 w-4 text-amber-300" />
              <span>Cadastrar Novo Usuário do Cartório</span>
            </h4>
            <span className="text-[11px] text-white/40">* Campos obrigatórios</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Nome Completo *
              </label>
              <Input
                type="text"
                name="name"
                required
                placeholder="Ex: João da Silva"
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
                placeholder="nome.sobrenome@7risp.com.br"
                className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                CPF (Validação RH) *
              </label>
              <Input
                type="text"
                name="cpf"
                required
                placeholder="000.000.000-00"
                className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50 font-mono"
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
                defaultValue="Fiorix@2026"
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
                defaultValue="COLABORADOR"
                className="w-full h-10 px-3 rounded-md border border-white/12 bg-[#0A0F1E] text-xs text-white focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
              >
                <option value="COLABORADOR">Colaborador (COLABORADOR)</option>
                <option value="USER">Usuário (USER)</option>
                <option value="RH">RH (RH)</option>
                <option value="ADMIN">Admin (ADMIN - Restrito)</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Departamento *
              </label>
              <select
                name="departamento"
                defaultValue="Atendimento"
                className="w-full h-10 px-3 rounded-md border border-white/12 bg-[#0A0F1E] text-xs text-white focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
              >
                <option value="Atendimento">Atendimento</option>
                <option value="Registro">Registro</option>
                <option value="Financeiro">Financeiro</option>
                <option value="RH">RH</option>
                <option value="Administração">Administração</option>
                <option value="TI">TI</option>
                <option value="Indisponibilidade">Indisponibilidade</option>
                <option value="Intimação">Intimação</option>
                <option value="Ofício">Ofício</option>
                <option value="Impressão/Arquivo">Impressão/Arquivo</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Cargo *
              </label>
              <Input
                type="text"
                name="cargo"
                required
                defaultValue="auxiliar"
                placeholder="auxiliar, escrevente, Oficial Substituto..."
                className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Ramal
              </label>
              <Input
                type="text"
                name="ramal"
                placeholder="Ex: 204"
                className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
              />
            </div>

            <div className="md:col-span-2 flex items-center h-10 mt-6 gap-2">
              <input
                type="checkbox"
                name="podeSerTutor"
                id="podeSerTutor"
                className="rounded border-white/20 bg-[#0A0F1E] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="podeSerTutor" className="text-xs text-white/80 cursor-pointer select-none">
                Pode ser Tutor de IT?
              </label>
            </div>

            <div className="md:col-span-2 flex items-end">
              <Button 
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white shadow-xs transition-colors hover:brightness-105 cursor-pointer"
              >
                Cadastrar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-white/6 text-[11px] text-white/50">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="font-bold text-cyan-400 block">Colaborador (COLABORADOR):</span>
              <span>Acesso somente a Comunicados, Férias e Holerites pessoais.</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="font-bold text-blue-400 block">Usuário (USER):</span>
              <span>Acesso operacional padrão do FIORIX.</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="font-bold text-purple-400 block">RH (RH):</span>
              <span>Gerenciamento de Comunicados, Férias e Holerites.</span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="font-bold text-indigo-400 block">Admin (ADMIN):</span>
              <span>Acesso administrativo geral (Henrique Cesar Ferreira Gama).</span>
            </div>
          </div>
        </form>

        {/* Tabela de Usuários Cadastrados */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-extrabold text-white">
                Quadro Oficial de Colaboradores & Usuários ({usuarios.length})
              </h2>
            </div>
          </div>

          <UserListTable usuarios={usuarios} currentUserRole={currentUserRole} />
        </div>

        {/* Card Verde Final */}
        <div className="p-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <strong className="text-white">Base Única Oficial (7º RI SP):</strong> Estes colaboradores constituem a base fidedigna integrada para o Painel de Governança RH, Instruções de Trabalho (ITs) e Matriz de Polivalência.
          </div>
        </div>
      </main>
    </div>
  );
}
