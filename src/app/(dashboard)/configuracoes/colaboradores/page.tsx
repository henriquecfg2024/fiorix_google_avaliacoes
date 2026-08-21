import React from 'react';
import { getColaboradores, addColaborador, toggleColaboradorActive, deleteColaborador } from '@/app/actions/colaboradores';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Users, Trash2, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function ColaboradoresConfigPage() {
  const colaboradores = await getColaboradores();

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
              <span className="text-amber-300">Colaboradores</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Gestão de Colaboradores
              </h1>
              <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                MONITORAMENTO DE RESENHAS
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

          <form action={addColaborador} className="mt-4 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <UserPlus className="h-4 w-4 text-amber-300" />
              <span>Cadastrar Novo Colaborador</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Nome Completo / Exibição *
                </label>
                <Input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: Carlos Eduardo ou Maria Silva"
                  className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
                />
              </div>

              <div className="md:col-span-5 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Apelidos / Variações de Nome (separados por vírgula)
                </label>
                <Input
                  type="text"
                  name="aliases"
                  placeholder="Ex: Carlinhos, Cadu"
                  className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-amber-400/50"
                />
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
              Colaboradores Cadastrados ({colaboradores.length})
            </h2>
          </div>

          {colaboradores.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-8 text-center text-sm text-white/50">
              Nenhum colaborador cadastrado ainda. Preencha o formulário acima para adicionar o primeiro.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/12">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/12 bg-[#0B1020] text-[11px] font-bold uppercase tracking-[0.16em] text-white/58">
                    <th className="p-3 pl-5 sm:p-4">Nome</th>
                    <th className="p-3 sm:p-4">Apelidos / Variações</th>
                    <th className="p-3 sm:p-4">Status</th>
                    <th className="p-3 pr-5 text-right sm:p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-medium text-white/80">
                  {colaboradores.map((colab) => (
                    <tr key={colab.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-3 pl-5 font-bold text-white sm:p-4">
                        {colab.name}
                      </td>
                      <td className="p-3 sm:p-4 text-white/60">
                        {colab.aliases && colab.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {colab.aliases.map((alias, i) => (
                              <span key={i} className="rounded-lg border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/80">
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-white/40">Sem apelidos</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          colab.active
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/20 bg-red-500/10 text-red-300'
                        }`}>
                          {colab.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3 pr-5 text-right sm:p-4">
                        <div className="flex items-center justify-end gap-2">
                          <form action={toggleColaboradorActive.bind(null, colab.id, colab.active)}>
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="h-8 border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:bg-white/[0.08] hover:text-white"
                            >
                              {colab.active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </form>

                          <form action={deleteColaborador.bind(null, colab.id)}>
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="h-8 border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200"
                            >
                              Excluir
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
