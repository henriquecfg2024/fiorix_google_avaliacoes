'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  BadgeCheck,
  Eye,
  UserMinus,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
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

  // Confirmação in-modal para revogação/remoção de acesso
  const [confirmarRemocao, setConfirmarRemocao] = useState<{
    usuarioId: string;
    nome: string;
    papel: string;
  } | null>(null);
  const [motivoRemocao, setMotivoRemocao] = useState('');
  const [removendo, setRemovendo] = useState(false);

  // Transferência de responsabilidade principal
  const [transferirModal, setTransferirModal] = useState(false);
  const [transferirParaId, setTransferirParaId] = useState('');
  const [transferirMotivo, setTransferirMotivo] = useState('');
  const [transferirManter, setTransferirManter] = useState(true);
  const [transferindo, setTransferindo] = useState(false);

  const userRole = String(currentUser.role || '').toUpperCase();
  const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(userRole);
  const meuParticipante = participantes.find((x) => x.usuarioId === currentUser.id);
  const souResponsavelPrincipal = meuParticipante?.papel === 'RESPONSAVEL_PRINCIPAL';
  const podeGerenciar = isGestao || souResponsavelPrincipal;

  // Fechamento com Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmarRemocao) {
          setConfirmarRemocao(null);
        } else if (transferirModal) {
          setTransferirModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmarRemocao, transferirModal]);

  // Função para buscar colaboradores
  async function carregarBusca(setor?: string, termo?: string) {
    if (!itId) return;
    setBuscandoUser(true);
    setModalError('');
    try {
      const res = await buscarColaboradoresParaVincular(
        itId,
        termo !== undefined ? termo : buscaParticipante,
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
    } catch (err: any) {
      setModalError(err?.message || 'Erro ao carregar colaboradores.');
    } finally {
      setBuscandoUser(false);
    }
  }

  // Carregar participantes e candidatos ao abrir
  useEffect(() => {
    if (!isOpen || !itId) return;

    let cancelado = false;
    async function carregar() {
      setLoading(true);
      setModalError('');
      setModalSuccess('');
      setBuscaParticipante('');
      setResultadosBusca([]);
      setConfirmarRemocao(null);
      setTransferirModal(false);

      const res = await getParticipantesIt(itId!);
      if (!cancelado) {
        if (res.success) {
          setParticipantes(res.participantes || []);
        } else {
          setModalError(res.error || 'Erro ao carregar participantes.');
        }
        setLoading(false);
        // Pré-carrega colaboradores disponíveis
        carregarBusca('TODOS', '');
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [isOpen, itId]);

  if (!isOpen || !itId) return null;

  async function handleAdicionar(usuarioId: string, papel: PapelNaIt) {
    if (!itId) return;
    setAdicionandoId(usuarioId);
    setModalError('');
    setModalSuccess('');

    const res = await adicionarParticipanteIt({ itId, usuarioId, papel });
    if (res.success) {
      setModalSuccess(
        papel === 'LEITOR'
          ? 'Acesso de leitura concedido com sucesso!'
          : 'Participante adicionado com sucesso!'
      );
      const reload = await getParticipantesIt(itId);
      if (reload.success) setParticipantes(reload.participantes || []);
      // Atualiza lista de colaboradores disponíveis
      carregarBusca(filtroSetor, buscaParticipante);
      if (onSuccess) onSuccess();
    } else {
      setModalError(res.error || 'Erro ao adicionar participante.');
    }
    setAdicionandoId(null);
  }

  function iniciarRemocao(usuarioId: string, nome: string, papel: string) {
    setConfirmarRemocao({ usuarioId, nome, papel });
    setMotivoRemocao(
      userRole === 'SUBSTITUTO'
        ? 'Acesso revogado pelo Oficial Substituto'
        : 'Acesso revogado pela gestão'
    );
    setModalError('');
    setModalSuccess('');
  }

  async function executarRemocao() {
    if (!itId || !confirmarRemocao) return;
    if (!motivoRemocao.trim()) {
      setModalError('Informe o motivo da remoção.');
      return;
    }

    setRemovendo(true);
    setModalError('');
    setModalSuccess('');

    const res = await removerParticipanteIt(itId, confirmarRemocao.usuarioId, motivoRemocao.trim());
    if (res.success) {
      setModalSuccess(`Acesso de ${confirmarRemocao.nome} retirado com sucesso.`);
      setConfirmarRemocao(null);
      const reload = await getParticipantesIt(itId);
      if (reload.success) setParticipantes(reload.participantes || []);
      carregarBusca(filtroSetor, buscaParticipante);
      if (onSuccess) onSuccess();
    } else {
      setModalError(res.error || 'Erro ao remover participante.');
    }
    setRemovendo(false);
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
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-[24px] border border-white/20 bg-[#0B1020]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-[90vh] text-white animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">
                  Gestão de Acessos e Leitores da IT
                </h2>
                {userRole === 'SUBSTITUTO' && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    <ShieldCheck className="w-3 h-3" /> Substituto
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {itCodigo ? `${itCodigo} • ` : ''}{itTitulo || 'Conceda ou retire acesso de leitura para colaboradores'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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

          {/* Diálogo de Confirmação de Revogação de Acesso */}
          {confirmarRemocao && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-3 animate-in fade-in-50">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Confirmar Retirada de Acesso
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Deseja retirar o acesso de leitura de <strong className="text-white">{confirmarRemocao.nome}</strong> desta Instrução de Trabalho?
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Motivo da revogação (obrigatório para auditoria):
                </label>
                <input
                  type="text"
                  value={motivoRemocao}
                  onChange={(e) => setMotivoRemocao(e.target.value)}
                  placeholder="Ex: Acesso revogado pelo Oficial Substituto"
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[#0B1020]/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmarRemocao(null)}
                  disabled={removendo}
                  className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executarRemocao}
                  disabled={removendo || !motivoRemocao.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {removendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                  <span>Confirmar Retirada</span>
                </button>
              </div>
            </div>
          )}

          {/* Lista de Participantes Atuais */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Colaboradores com Acesso ({participantes.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                {participantes.filter(p => p.papel === 'LEITOR').length} leitor(es)
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Carregando participantes...</span>
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
                      label: 'Acesso de Leitura',
                      color: 'text-emerald-300',
                      bg: 'bg-emerald-500/15 border-emerald-500/25',
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
                      className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/10 hover:border-white/20 transition-colors"
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
                            onClick={() => iniciarRemocao(p.usuarioId, p.nome, p.papel)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer text-[11px] font-semibold"
                            title={`Retirar acesso de ${p.nome}`}
                            aria-label={`Retirar acesso de ${p.nome}`}
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Retirar acesso</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conceder Acesso a Colaborador (Apenas para Responsável Principal ou Gestão/Substituto) */}
          {podeGerenciar && (
            <div className="border-t border-white/10 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Conceder Acesso a Novo Colaborador
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Como {userRole === 'SUBSTITUTO' ? 'Oficial Substituto' : 'gestor'}, você pode conceder acesso de leitura a qualquer colaborador.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Campo de Busca */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, e-mail ou cargo..."
                    value={buscaParticipante}
                    onChange={(e) => {
                      setBuscaParticipante(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && carregarBusca(filtroSetor, buscaParticipante)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                </div>

                {/* Filtro por Setor */}
                {setoresDisponiveis.length > 0 && (
                  <div className="relative shrink-0 sm:w-44">
                    <select
                      value={filtroSetor}
                      onChange={(e) => {
                        const s = e.target.value;
                        setFiltroSetor(s);
                        carregarBusca(s, buscaParticipante);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[#0B1020]/90 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
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
                  onClick={() => carregarBusca(filtroSetor, buscaParticipante)}
                  disabled={buscandoUser}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {buscandoUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{buscandoUser ? 'Buscando...' : 'Buscar'}</span>
                </button>
              </div>

              {/* Resultados da Busca */}
              {resultadosBusca.length > 0 ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {resultadosBusca.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{u.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {u.departamento}{u.cargo ? ` · ${u.cargo}` : ''}
                        </p>
                        {!u.mesmoSetor && !isGestao && (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            ⚠ Outro setor — requer aprovação administrativa
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        {/* Botão Conceder Leitura (principal) */}
                        <button
                          type="button"
                          onClick={() => handleAdicionar(u.id, 'LEITOR')}
                          disabled={adicionandoId === u.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                          title="Conceder acesso de leitura"
                        >
                          {adicionandoId === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          <span>+ Conceder Leitura</span>
                        </button>

                        {/* Botão Corresponsável */}
                        <button
                          type="button"
                          onClick={() => handleAdicionar(u.id, 'CORRESPONSAVEL')}
                          disabled={adicionandoId === u.id}
                          className="px-2.5 py-1.5 rounded-lg bg-violet-600/70 hover:bg-violet-500 text-white text-[10px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          title="Adicionar como corresponsável técnico"
                        >
                          + Corresponsável
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !buscandoUser && (
                  <p className="text-[11px] text-slate-500 italic py-2">
                    Nenhum outro colaborador disponível encontrado para os filtros selecionados.
                  </p>
                )
              )}
            </div>
          )}

          {/* Transferir Responsabilidade Principal */}
          {podeGerenciar && (
            <div className="border-t border-white/10 pt-4">
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
                    className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[#0B1020]/90 text-xs text-white focus:outline-none focus:border-indigo-500/60 cursor-pointer"
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
                    className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[#0B1020]/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 resize-none"
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
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
