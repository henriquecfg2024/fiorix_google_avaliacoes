'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Search,
  BadgeCheck,
  Eye,
  UserMinus,
  ArrowLeftRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
} from 'lucide-react';
import {
  getParticipantesIt,
  adicionarParticipanteIt,
  removerParticipanteIt,
  transferirResponsabilidadeIt,
  buscarColaboradoresParaVincular,
  ItParticipante,
  PapelNaIt,
} from '@/app/actions/its';

export interface GerenciarResponsaveisModalProps {
  isOpen: boolean;
  itId: string | null;
  itCodigo?: string;
  itTitulo?: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export function GerenciarResponsaveisModal({
  isOpen,
  itId,
  itCodigo,
  itTitulo,
  currentUser,
  onClose,
  onSuccess,
}: GerenciarResponsaveisModalProps) {
  const [participantes, setParticipantes] = useState<ItParticipante[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscaParticipante, setBuscaParticipante] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<
    Array<{ id: string; nome: string; email: string; departamento: string; cargo: string; mesmoSetor: boolean }>
  >([]);
  const [buscandoUser, setBuscandoUser] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Transferência de responsabilidade principal
  const [transferirModal, setTransferirModal] = useState(false);
  const [transferirParaId, setTransferirParaId] = useState('');
  const [transferirMotivo, setTransferirMotivo] = useState('');
  const [transferirManter, setTransferirManter] = useState(true);
  const [transferindo, setTransferindo] = useState(false);

  // Fechamento com Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Carregar participantes ao abrir
  useEffect(() => {
    if (!isOpen || !itId) return;

    let cancelado = false;
    async function carregar() {
      setLoading(true);
      setModalError('');
      setModalSuccess('');
      setBuscaParticipante('');
      setResultadosBusca([]);
      setTransferirModal(false);

      const res = await getParticipantesIt(itId!);
      if (!cancelado) {
        if (res.success) {
          setParticipantes(res.participantes || []);
        } else {
          setModalError(res.error || 'Erro ao carregar participantes.');
        }
        setLoading(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [isOpen, itId]);

  if (!isOpen || !itId) return null;

  const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);
  const meuParticipante = participantes.find((x) => x.usuarioId === currentUser.id);
  const souResponsavelPrincipal = meuParticipante?.papel === 'RESPONSAVEL_PRINCIPAL';
  const podeGerenciar = isGestao || souResponsavelPrincipal;

  async function handleBuscar(setor?: string) {
    if (!itId) return;
    setBuscandoUser(true);
    setModalError('');
    const res = await buscarColaboradoresParaVincular(
      itId,
      buscaParticipante,
      setor !== undefined ? setor : filtroSetor
    );
    if (res.success) {
      setResultadosBusca(res.usuarios || []);
      if (res.setoresDisponiveis && res.setoresDisponiveis.length) {
        setSetoresDisponiveis(res.setoresDisponiveis);
      }
    } else {
      setModalError(res.error || 'Erro na busca de colaboradores.');
    }
    setBuscandoUser(false);
  }

  async function handleAdicionar(usuarioId: string, papel: PapelNaIt) {
    if (!itId) return;
    setAdicionandoId(usuarioId);
    setModalError('');
    setModalSuccess('');

    const res = await adicionarParticipanteIt({ itId, usuarioId, papel });
    if (res.success) {
      setModalSuccess('Participante vinculado com sucesso!');
      setResultadosBusca([]);
      setBuscaParticipante('');
      const reload = await getParticipantesIt(itId);
      if (reload.success) setParticipantes(reload.participantes || []);
      if (onSuccess) onSuccess();
    } else {
      setModalError(res.error || 'Erro ao adicionar participante.');
    }
    setAdicionandoId(null);
  }

  async function handleRemover(usuarioId: string, nome: string) {
    if (!itId) return;
    const motivo = prompt(`Motivo para remover ${nome} desta IT (obrigatório):`);
    if (!motivo?.trim()) return;

    setModalError('');
    setModalSuccess('');
    const res = await removerParticipanteIt(itId, usuarioId, motivo.trim());
    if (res.success) {
      setModalSuccess(`Participante ${nome} removido.`);
      const reload = await getParticipantesIt(itId);
      if (reload.success) setParticipantes(reload.participantes || []);
      if (onSuccess) onSuccess();
    } else {
      setModalError(res.error || 'Erro ao remover participante.');
    }
  }

  async function handleTransferir() {
    if (!itId || !transferirParaId || !transferirMotivo.trim()) {
      setModalError('Selecione o novo responsável e informe o motivo da transferência.');
      return;
    }

    setTransferindo(true);
    setModalError('');
    setModalSuccess('');

    const res = await transferirResponsabilidadeIt({
      itId,
      novoResponsavelId: transferirParaId,
      motivo: transferirMotivo.trim(),
      manterComoCorresponsavel: transferirManter,
    });

    if (res.success) {
      setModalSuccess('Responsabilidade transferida com sucesso!');
      setTransferirModal(false);
      const reload = await getParticipantesIt(itId);
      if (reload.success) setParticipantes(reload.participantes || []);
      if (onSuccess) onSuccess();
    } else {
      setModalError(res.error || 'Erro ao transferir responsabilidade.');
    }
    setTransferindo(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/8 bg-[#0B1020]/70 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                Responsáveis pela IT
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {itCodigo ? `${itCodigo} • ` : ''}{itTitulo || 'Gerencie quem tem acesso a este documento'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          
          {/* Mensagens de Feedback */}
          {modalError && (
            <div className="flex items-start gap-2.5 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="flex-1">{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="flex-1">{modalSuccess}</span>
            </div>
          )}

          {/* Lista de Participantes Atuais */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Participantes Atuais ({participantes.length})
              </h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Carregando participantes...
              </div>
            ) : participantes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
                Nenhum participante registrado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {participantes.map((p) => {
                  const papelCfg = {
                    RESPONSAVEL_PRINCIPAL: {
                      label: 'Responsável principal',
                      color: 'text-indigo-300',
                      bg: 'bg-indigo-500/15 border-indigo-500/25',
                      icon: BadgeCheck,
                    },
                    CORRESPONSAVEL: {
                      label: 'Corresponsável',
                      color: 'text-violet-300',
                      bg: 'bg-violet-500/15 border-violet-500/25',
                      icon: Users,
                    },
                    LEITOR: {
                      label: 'Leitor',
                      color: 'text-slate-300',
                      bg: 'bg-slate-500/15 border-slate-500/25',
                      icon: Eye,
                    },
                  }[p.papel] || {
                    label: p.papel,
                    color: 'text-slate-300',
                    bg: 'bg-slate-500/15 border-slate-500/25',
                    icon: Users,
                  };
                  const PapelIcon = papelCfg.icon;
                  const isMe = p.usuarioId === currentUser.id;
                  const podeRemover = podeGerenciar && p.papel !== 'RESPONSAVEL_PRINCIPAL';

                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/6 hover:border-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-200 text-xs font-bold shrink-0">
                        {p.nome.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">
                            {p.nome}
                          </p>
                          {isMe && (
                            <span className="text-[10px] text-indigo-300 font-medium px-1.5 py-0.2 rounded bg-indigo-500/20">
                              você
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {p.departamento}{p.cargo ? ` · ${p.cargo}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${papelCfg.bg} ${papelCfg.color}`}>
                          <PapelIcon className="w-3 h-3" />
                          <span>{papelCfg.label}</span>
                        </span>

                        {podeRemover && (
                          <button
                            type="button"
                            onClick={() => handleRemover(p.usuarioId, p.nome)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer text-[11px] font-semibold"
                            title={`Desvincular ${p.nome}`}
                            aria-label={`Desvincular ${p.nome}`}
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Desvincular</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adicionar Colaborador (Apenas para Responsável Principal ou Gestão) */}
          {podeGerenciar && (
            <div className="border-t border-white/8 pt-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Adicionar Colaborador
              </h3>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Campo de Busca */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={buscaParticipante}
                    onChange={(e) => setBuscaParticipante(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                </div>

                {/* Filtro por Setor */}
                {setoresDisponiveis.length > 0 && (
                  <div className="relative shrink-0 sm:w-44">
                    <select
                      value={filtroSetor}
                      onChange={(e) => {
                        setFiltroSetor(e.target.value);
                        handleBuscar(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0B1020] text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
                    >
                      <option value="TODOS">Todos os setores</option>
                      {setoresDisponiveis.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleBuscar()}
                  disabled={buscandoUser}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{buscandoUser ? 'Buscando...' : 'Buscar'}</span>
                </button>
              </div>

              {/* Resultados da Busca */}
              {resultadosBusca.length > 0 && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {resultadosBusca.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/6"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{u.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {u.departamento}{u.cargo ? ` · ${u.cargo}` : ''}
                        </p>
                        {!u.mesmoSetor && (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            ⚠ Outro setor — requer aprovação administrativa
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdicionar(u.id, 'CORRESPONSAVEL')}
                          disabled={adicionandoId === u.id}
                          className="px-2.5 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-[10px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          title="Adicionar como corresponsável"
                        >
                          + Corresponsável
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdicionar(u.id, 'LEITOR')}
                          disabled={adicionandoId === u.id}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-600/80 hover:bg-slate-500 text-white text-[10px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          title="Adicionar como leitor"
                        >
                          + Leitor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transferir Responsabilidade Principal */}
          {podeGerenciar && (
            <div className="border-t border-white/8 pt-4">
              {!transferirModal ? (
                <button
                  type="button"
                  onClick={() => {
                    setTransferirModal(true);
                    setTransferirParaId('');
                    setTransferirMotivo('');
                  }}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transferir responsabilidade principal</span>
                </button>
              ) : (
                <div className="space-y-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                  <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Transferir Responsabilidade Principal
                  </p>

                  <select
                    value={transferirParaId}
                    onChange={(e) => setTransferirParaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0B1020] text-xs text-white focus:outline-none focus:border-indigo-500/60"
                  >
                    <option value="">Selecione o novo responsável...</option>
                    {participantes
                      .filter(
                        (p) =>
                          p.usuarioId !== currentUser.id &&
                          p.papel !== 'RESPONSAVEL_PRINCIPAL'
                      )
                      .map((p) => (
                        <option key={p.usuarioId} value={p.usuarioId}>
                          {p.nome} ({p.papel === 'CORRESPONSAVEL' ? 'Corresponsável' : 'Leitor'})
                        </option>
                      ))}
                  </select>

                  <textarea
                    placeholder="Motivo da transferência (obrigatório)..."
                    value={transferirMotivo}
                    onChange={(e) => setTransferirMotivo(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0B1020] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 resize-none"
                  />

                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferirManter}
                      onChange={(e) => setTransferirManter(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    <span>Manter responsável atual como corresponsável</span>
                  </label>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTransferir}
                      disabled={transferindo || !transferirParaId || !transferirMotivo.trim()}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {transferindo ? 'Transferindo...' : 'Confirmar transferência'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferirModal(false)}
                      className="px-4 py-2 rounded-xl border border-white/15 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/8 bg-[#0B1020]/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/8 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
