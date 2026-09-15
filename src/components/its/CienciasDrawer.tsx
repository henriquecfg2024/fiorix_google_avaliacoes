'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Clock, Search, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { EquipeCienciaItem } from '@/app/actions/minha-it';

export interface CienciasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  codigo?: string;
  titulo?: string;
  responsavelCienteEm?: string | null;
  adesaoPercentual: number;
  totalCientes: number;
  totalColaboradores: number;
  pendentesCount: number;
  equipeCiencias: EquipeCienciaItem[];
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CienciasDrawer({
  isOpen,
  onClose,
  codigo,
  titulo,
  responsavelCienteEm,
  adesaoPercentual,
  totalCientes,
  totalColaboradores,
  pendentesCount,
  equipeCiencias,
  triggerButtonRef,
}: CienciasDrawerProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'cientes' | 'pendentes'>('todos');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Foco e tecla Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto foco no botão fechar
    setTimeout(() => closeButtonRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restaurar foco no botão acionador ao fechar
      triggerButtonRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerButtonRef]);

  if (!isOpen) return null;

  const colaboradoresFiltrados = equipeCiencias.filter((colab) => {
    const matchTexto =
      colab.nome.toLowerCase().includes(busca.toLowerCase()) ||
      colab.cargo.toLowerCase().includes(busca.toLowerCase());
    if (!matchTexto) return false;

    if (filtroStatus === 'cientes') return colab.ciente;
    if (filtroStatus === 'pendentes') return !colab.ciente;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="ciencias-drawer-title">
      {/* Backdrop com Blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel Deslizante pela Direita */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside className="w-screen max-w-md sm:max-w-lg bg-[#0B1020] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/8 bg-[#0E1626]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h2 id="ciencias-drawer-title" className="text-base font-bold text-white truncate">
                  Ciências da Equipe
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  {codigo ? `${codigo} • ` : ''}{titulo || 'Instrução de Trabalho'}
                </p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Fechar painel de ciências (Esc)"
              aria-label="Fechar painel de ciências"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

            {/* Card de Ciência do Responsável */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4.5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Ciência do Responsável Confirmada
                  </p>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {responsavelCienteEm ? `Registrada em ${responsavelCienteEm}` : 'Ciência registrada pelo responsável técnico.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de Progresso e Métricas */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Adesão Total da Equipe</span>
                <span className="font-mono font-bold text-white text-sm">{adesaoPercentual}%</span>
              </div>

              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  style={{ width: `${adesaoPercentual}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/6">
                <span>
                  <strong className="text-emerald-400 font-semibold">{totalCientes}</strong> ciente{totalCientes !== 1 ? 's' : ''}
                </span>
                <span>
                  <strong className="text-amber-400 font-semibold">{pendentesCount}</strong> pendente{pendentesCount !== 1 ? 's' : ''}
                </span>
                <span className="text-slate-500">
                  Total: {totalColaboradores}
                </span>
              </div>
            </div>

            {/* Busca e Filtros Rápidos */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador ou cargo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filtroStatus === 'todos'
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Todos ({equipeCiencias.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('cientes')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filtroStatus === 'cientes'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                >
                  Cientes ({totalCientes})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('pendentes')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filtroStatus === 'pendentes'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  Pendentes ({pendentesCount})
                </button>
              </div>
            </div>

            {/* Lista de Colaboradores */}
            <div className="space-y-2">
              {colaboradoresFiltrados.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-white/8 bg-white/[0.02]">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">Nenhum colaborador encontrado.</p>
                </div>
              ) : (
                colaboradoresFiltrados.map((colab) => (
                  <div
                    key={colab.usuarioId}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      {colab.ciente ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className={`text-xs truncate ${colab.isCurrentUser ? 'font-bold text-white' : 'text-slate-200'}`}>
                          {colab.nome}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {colab.cargo}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          colab.ciente
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {colab.ciente ? 'Ciente' : 'Pendente'}
                      </span>
                      {colab.cienteEm && (
                        <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                          {colab.cienteEm.split(' ')[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/8 bg-[#0E1626]/80 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/8 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}
