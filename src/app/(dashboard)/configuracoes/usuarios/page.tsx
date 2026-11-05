import React from 'react';
import { getUsers } from '@/app/actions/admin';
import { listarNomesDepartamentos } from '@/app/actions/departamentos';
import Link from 'next/link';
import { UserListTable } from '@/components/configuracoes/UserListTable';
import { CreateUserForm } from '@/components/configuracoes/CreateUserForm';
import { auth } from '@/auth';
import { ArrowLeft, Users, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function UsuariosConfigPage() {
  const session = await auth();
  const currentUserRole = session?.user?.role || 'USER';
  const usuarios = await getUsers();
  let departamentosDb: string[] = [];
  try {
    departamentosDb = await listarNomesDepartamentos();
  } catch (e) {
    // Fallback: usar departamentos dos próprios usuários
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-amber-500/30 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/configuracoes" className="hover:text-amber-300 transition-colors">
                Configurações
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Usuários</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
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
        <CreateUserForm departamentosDb={departamentosDb} />

        {/* Tabela de Usuários Cadastrados */}
        <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-extrabold text-white">
                Quadro Oficial de Colaboradores & Usuários ({usuarios.length})
              </h2>
            </div>
          </div>

          <UserListTable usuarios={usuarios} currentUserRole={currentUserRole} departamentosDisponiveis={departamentosDb} />
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
