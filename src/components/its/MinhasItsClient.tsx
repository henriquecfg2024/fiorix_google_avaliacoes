'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Layers,
  FileCheck2,
  Building2,
  User,
} from 'lucide-react';
import { MinhasItsPageData, MinhaItCardItem } from '@/app/actions/its';

interface MinhasItsClientProps {
  initialData: MinhasItsPageData;
}

export function MinhasItsClient({ initialData }: MinhasItsClientProps) {
  const { currentUser, its, stats } = initialData;

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'cientes' | 'guardiao'>('todos');

  // Filtragem dinâmica
  const itsFiltradas = useMemo(() => {
    return its.filter((it) => {
      // Filtro de texto (código ou título ou objetivo)
      const matchTexto =
        !busca.trim() ||
        it.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        it.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        it.objetivo.toLowerCase().includes(busca.toLowerCase());

      if (!matchTexto) return false;

      // Filtro de status
      if (filtroStatus === 'pendentes') return it.statusCiencia === 'pendente';
      if (filtroStatus === 'cientes') return it.statusCiencia === 'ciente';
      if (filtroStatus === 'guardiao') return it.isGuardiao;

      return true;
    });
  }, [its, busca, filtroStatus]);

  const percentualCiente = stats.total > 0 ? Math.round((stats.cientes / stats.total) * 100) : 100;

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-[#070A12] text-white relative min-h-screen">
      {/* Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 space-y-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <Link href="/pessoas" className="hover:text-zinc-200 transition-colors">
                Minha Central
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-emerald-400 font-semibold">Minhas Instruções de Trabalho</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <BookOpen className="w-7 h-7 text-emerald-400" />
                Minhas Instruções de Trabalho
              </h1>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                {currentUser.departamento}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Rotinas operacionais vigentes atribuídas ao seu setor e custódias sob sua responsabilidade técnica no 7º RI SP.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>Colaborador:</span>
                <span className="font-semibold text-white">{currentUser.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Setor:</span>
                <span className="font-semibold text-emerald-300">{currentUser.departamento}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas de Conformidade Pessoal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Rotinas do Meu Setor</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Instruções vinculadas</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Ciências Confirmadas</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.cientes}</p>
              <p className="text-[11px] text-emerald-500/80 mt-0.5">{percentualCiente}% em conformidade</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Pendentes de Leitura</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pendentes}</p>
              <p className="text-[11px] text-amber-500/80 mt-0.5">
                {stats.pendentes > 0 ? 'Exigem sua atenção' : 'Tudo em dia'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Minhas Custódias</p>
              <p className="text-2xl font-bold text-teal-400 mt-1">{stats.custodias}</p>
              <p className="text-[11px] text-teal-500/80 mt-0.5">
                {stats.custodias > 0 ? 'Você é Guardião Oficial' : 'Colaborador da equipe'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/40 p-2.5 rounded-2xl border border-zinc-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filtroStatus === 'todos'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              Todas ({stats.total})
            </button>
            <button
              onClick={() => setFiltroStatus('pendentes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                filtroStatus === 'pendentes'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Pendentes ({stats.pendentes})
            </button>
            <button
              onClick={() => setFiltroStatus('cientes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                filtroStatus === 'cientes'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cientes ({stats.cientes})
            </button>
            {stats.custodias > 0 && (
              <button
                onClick={() => setFiltroStatus('guardiao')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  filtroStatus === 'guardiao'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-zinc-400 hover:text-teal-300 hover:bg-zinc-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Minhas Custódias ({stats.custodias})
              </button>
            )}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código ou título..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Lista / Grid de ITs */}
        {itsFiltradas.length === 0 ? (
          <div className="py-16 text-center bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhuma Instrução de Trabalho Encontrada</h3>
            <p className="text-sm text-zinc-400 mt-1 max-w-md mx-auto">
              {busca || filtroStatus !== 'todos'
                ? 'Nenhuma instrução corresponde aos filtros selecionados. Tente limpar os termos de busca.'
                : 'Não há instruções cadastradas para o seu setor no momento. Entre em contato com o seu gestor ou com o RH.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {itsFiltradas.map((it) => {
              const isPendente = it.statusCiencia === 'pendente';

              return (
                <div
                  key={it.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-300 p-5 ${
                    isPendente
                      ? 'bg-zinc-900/70 border-amber-500/30 shadow-lg shadow-amber-950/20 hover:border-amber-500/60'
                      : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80'
                  }`}
                >
                  {/* Top Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700">
                          {it.codigo}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-md">
                          v{it.versao}
                        </span>
                        {it.isGuardiao && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            Guardião
                          </span>
                        )}
                      </div>

                      {/* Status de Ciência */}
                      {isPendente ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Ciente
                        </span>
                      )}
                    </div>

                    {/* Título */}
                    <h2 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {it.titulo}
                    </h2>

                    {/* Objetivo */}
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                      {it.objetivo || it.quandoUsar || 'Procedimento padronizado do cartório.'}
                    </p>
                  </div>

                  {/* Detalhes e Rodapé */}
                  <div className="mt-5 pt-4 border-t border-zinc-800/60 space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>~{it.tempoLeituraMin} min de leitura</span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {it.statusCiencia === 'ciente' && it.cienteEm ? `Ciente em ${it.cienteEm}` : it.departamento}
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <Link
                      href={`/instrucoes-trabalho/${it.id}`}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                        isPendente
                          ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-950/50'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white border border-zinc-700'
                      }`}
                    >
                      {isPendente ? (
                        <>
                          Ler e Confirmar Ciência <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Acessar Procedimento <ExternalLink className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
