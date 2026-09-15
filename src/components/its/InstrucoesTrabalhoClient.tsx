'use client';

import React, { useState, useTransition } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  X,
  Users,
  FileText,
  Eye,
  RotateCcw,
  Send,
} from 'lucide-react';
import { ITItem, AuditLogItem } from '@/app/actions/its';

// ═══════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════

interface ConformidadeItem {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  guardiaoNome: string;
  diasSemRevisao: number;
  totalEquipe: number;
  cientesCount: number;
  pendentesCount: number;
  pendentesNomes: string[];
}

interface InstrucoesTrabalhoData {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    departamento: string;
  };
  its: ITItem[];
  kpis: {
    totalIts: number;
    itsAtualizadas7d: number;
    itsAtualizadas30d: number;
    taxaConformidade: number;
    totalPendentes: number;
    itsVencidas: number;
  };
  conformidadePorIt: ConformidadeItem[];
}

interface InstrucoesTrabalhoClientProps {
  initialData: InstrucoesTrabalhoData;
  initialTab?: 'catalogo' | 'fiscalizacao';
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function getStatusRevisao(diasSemRevisao: number): {
  label: string;
  color: string;
  bg: string;
  urgente: boolean;
} {
  if (diasSemRevisao >= 120) {
    return { label: 'Revisão vencida', color: 'text-red-300', bg: 'bg-red-500/20 border-red-500/30', urgente: true };
  }
  if (diasSemRevisao >= 90) {
    const diasRestantes = 120 - diasSemRevisao;
    return { label: `Revisar em ${diasRestantes}d`, color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30', urgente: true };
  }
  return { label: 'Atualizada', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/25', urgente: false };
}

// ═══════════════════════════════════════════════
// MODAL — DETALHES DA IT
// ═══════════════════════════════════════════════

function ItDetailModal({
  it,
  onClose,
  canManage,
}: {
  it: ITItem;
  onClose: () => void;
  canManage: boolean;
}) {
  const revisao = getStatusRevisao(it.diasSemRevisao);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">{it.codigo}</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">versão {it.versao}</span>
              <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${revisao.bg} ${revisao.color}`}>
                {revisao.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{it.titulo}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{it.departamento}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {it.objetivo && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Objetivo</p>
              <p className="text-sm text-slate-300 leading-relaxed">{it.objetivo}</p>
            </div>
          )}
          {it.quandoUsar && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quando usar</p>
              <p className="text-sm text-slate-300 leading-relaxed">{it.quandoUsar}</p>
            </div>
          )}
          {it.passoAPasso && it.passoAPasso.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Passo a passo</p>
              <ol className="space-y-1.5">
                {it.passoAPasso.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span>{typeof p === 'string' ? p : p.titulo}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-white/8">
          <div className="flex items-center gap-2">
            {it.pdfOriginalUrl && (
              <a
                href={it.pdfOriginalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-semibold transition-colors border border-white/10"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver PDF
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-semibold transition-colors border border-white/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — VER PESSOAS PENDENTES
// ═══════════════════════════════════════════════

function PessoasPendentesModal({
  item,
  onClose,
}: {
  item: ConformidadeItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div>
            <h3 className="font-bold text-white text-sm">{item.titulo}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {item.pendentesCount} colaborador{item.pendentesCount !== 1 ? 'es' : ''} com ciência pendente
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto">
          {item.pendentesNomes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum pendente no momento.</p>
          ) : (
            <ul className="space-y-2">
              {item.pendentesNomes.map((nome, i) => (
                <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
                  <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-rose-300">{nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-slate-200">{nome}</span>
                  <span className="ml-auto text-xs text-rose-400 font-medium">Pendente</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-semibold transition-colors border border-white/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════

export function InstrucoesTrabalhoClient({
  initialData,
  initialTab = 'catalogo',
}: InstrucoesTrabalhoClientProps) {
  const { its, kpis, conformidadePorIt, currentUser } = initialData;
  const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

  const [activeTab, setActiveTab] = useState<'catalogo' | 'fiscalizacao'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSetor, setFilterSetor] = useState('TODOS');
  const [viewItModal, setViewItModal] = useState<ITItem | null>(null);
  const [pessoasModal, setPessoasModal] = useState<ConformidadeItem | null>(null);

  // Setores únicos para o filtro
  const setores = ['TODOS', ...Array.from(new Set(its.map((it) => it.departamento).filter(Boolean))).sort()];

  // ITs filtradas
  const itsFiltradas = its.filter((it) => {
    const termLower = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      it.titulo.toLowerCase().includes(termLower) ||
      it.codigo.toLowerCase().includes(termLower);
    const matchSetor = filterSetor === 'TODOS' || it.departamento === filterSetor;
    return matchSearch && matchSetor;
  });

  // Pendências da fiscalização
  const pendencias: Array<{ item: ConformidadeItem; tipo: 'revisao_vencida' | 'revisao_proxima' | 'ciencia_pendente' }> = [];
  for (const item of conformidadePorIt) {
    if (item.diasSemRevisao >= 120) {
      pendencias.push({ item, tipo: 'revisao_vencida' });
    } else if (item.diasSemRevisao >= 90) {
      pendencias.push({ item, tipo: 'revisao_proxima' });
    }
    if (item.pendentesCount > 0) {
      pendencias.push({ item, tipo: 'ciencia_pendente' });
    }
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white pb-16 font-sans relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/8 to-cyan-500/6 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6 pt-6">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-teal-400 uppercase mb-1">
              Governança de ITs
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Instruções de Trabalho
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Consulte documentos e acompanhe somente o que precisa de atenção.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 p-1 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'catalogo'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Catálogo
            </button>
            <button
              onClick={() => setActiveTab('fiscalizacao')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'fiscalizacao'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fiscalização
              {pendencias.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'fiscalizacao'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500/80 text-white'
                }`}>
                  {pendencias.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            ABA CATÁLOGO
        ════════════════════════════════════════════════ */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar IT por nome ou código"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/6 transition-all"
                />
              </div>

              <div className="relative">
                <select
                  value={filterSetor}
                  onChange={(e) => setFilterSetor(e.target.value)}
                  className="appearance-none w-full sm:w-48 pl-4 pr-8 py-2.5 rounded-xl border border-white/10 bg-white/4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/60 transition-all cursor-pointer"
                >
                  {setores.map((s) => (
                    <option key={s} value={s} className="bg-[#0D1424]">
                      {s === 'TODOS' ? 'Todos os setores' : s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {isGestao && (
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/30 shrink-0">
                  <Plus className="w-4 h-4" />
                  Nova IT
                </button>
              )}
            </div>

            {/* Contador */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {itsFiltradas.length} {itsFiltradas.length === 1 ? 'instrução de trabalho' : 'instruções de trabalho'}
            </p>

            {/* Lista */}
            {itsFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] py-16 text-center">
                <FileText className="mx-auto w-10 h-10 text-slate-600 mb-3" />
                <p className="text-base font-semibold text-slate-300">Nenhuma IT encontrada</p>
                <p className="text-sm text-slate-500 mt-1">Tente outro termo ou setor.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 overflow-hidden divide-y divide-white/6">
                {itsFiltradas.map((it) => {
                  const revisao = getStatusRevisao(it.diasSemRevisao);
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors group"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">
                          {it.titulo}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {it.codigo} • versão {it.versao}
                        </p>
                      </div>

                      {/* Setor */}
                      <span className="hidden sm:inline-flex shrink-0 text-xs text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">
                        {it.departamento}
                      </span>

                      {/* Badge status */}
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${revisao.bg} ${revisao.color}`}>
                        {revisao.label}
                      </span>

                      {/* Abrir */}
                      <button
                        onClick={() => setViewItModal(it)}
                        className="shrink-0 px-4 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                      >
                        Abrir
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ABA FISCALIZAÇÃO
        ════════════════════════════════════════════════ */}
        {activeTab === 'fiscalizacao' && (
          <div className="space-y-5">
            {/* 3 Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                <p className="text-3xl font-bold text-white">{pendencias.length}</p>
                <p className="text-sm text-slate-400 mt-1">itens precisam de atenção</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                <p className="text-3xl font-bold text-emerald-400">{kpis.taxaConformidade}%</p>
                <p className="text-sm text-slate-400 mt-1">leituras concluídas</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                <p className="text-3xl font-bold text-white">{kpis.totalIts}</p>
                <p className="text-sm text-slate-400 mt-1">ITs publicadas</p>
              </div>
            </div>

            {/* Pendências */}
            <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pendências — resolva uma de cada vez
                </p>
              </div>

              {pendencias.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500/50 mb-3" />
                  <p className="text-base font-semibold text-slate-300">Tudo em dia</p>
                  <p className="text-sm text-slate-500 mt-1">Nenhuma pendência no momento.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/6">
                  {pendencias.map(({ item, tipo }, idx) => {
                    const isVencida = tipo === 'revisao_vencida';
                    const isProxima = tipo === 'revisao_proxima';
                    const isCiencia = tipo === 'ciencia_pendente';

                    let motivo = '';
                    let badgeText = '';
                    let badgeColor = '';
                    let acaoLabel = '';

                    if (isVencida) {
                      motivo = 'Revisão vencida';
                      badgeText = `${item.diasSemRevisao - 120}d em atraso`;
                      badgeColor = 'bg-red-500/20 text-red-300 border-red-500/30';
                      acaoLabel = 'Revisar';
                    } else if (isProxima) {
                      const diasRestantes = 120 - item.diasSemRevisao;
                      motivo = 'Revisão próxima do vencimento';
                      badgeText = `${diasRestantes}d`;
                      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                      acaoLabel = 'Revisar';
                    } else {
                      motivo = `${item.pendentesCount} colaborador${item.pendentesCount !== 1 ? 'es' : ''} ainda não confirmaram a leitura`;
                      badgeText = `${item.pendentesCount} pendente${item.pendentesCount !== 1 ? 's' : ''}`;
                      badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                      acaoLabel = 'Ver pessoas';
                    }

                    return (
                      <div
                        key={`${item.id}-${tipo}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Ícone */}
                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                          isVencida ? 'bg-red-500/15' : isProxima ? 'bg-amber-500/15' : 'bg-rose-500/15'
                        }`}>
                          {(isVencida || isProxima)
                            ? <RotateCcw className={`w-4 h-4 ${isVencida ? 'text-red-400' : 'text-amber-400'}`} />
                            : <Users className="w-4 h-4 text-rose-400" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{item.titulo}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{motivo}</p>
                        </div>

                        {/* Setor */}
                        <span className="hidden sm:inline-flex shrink-0 text-xs text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">
                          {item.departamento}
                        </span>

                        {/* Badge urgência */}
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                          {badgeText}
                        </span>

                        {/* Ação */}
                        <button
                          onClick={() => {
                            if (isCiencia) setPessoasModal(item);
                          }}
                          className="shrink-0 px-4 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                        >
                          {acaoLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      {viewItModal && (
        <ItDetailModal
          it={viewItModal}
          onClose={() => setViewItModal(null)}
          canManage={isGestao}
        />
      )}
      {pessoasModal && (
        <PessoasPendentesModal
          item={pessoasModal}
          onClose={() => setPessoasModal(null)}
        />
      )}
    </div>
  );
}
