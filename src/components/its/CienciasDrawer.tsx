'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Check,
  Clock,
  Search,
  Users,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  UserMinus,
  ArrowLeft,
  Loader2,
  Info,
  CheckCheck,
  ChevronRight,
  ArrowLeftRight,
  CheckCircle2,
  BadgeCheck,
  Filter,
} from 'lucide-react';
import { EquipeCienciaItem } from '@/app/actions/minha-it';
import {
  getEquipeLeitorIt,
  adicionarParticipanteIt,
  removerParticipanteIt,
  transferirResponsabilidadeIt,
  buscarColaboradoresParaVincular,
  PapelNaIt,
} from '@/app/actions/its';

export interface MembroEquipe {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  departamento: string;
  cargo: string;
  papel: PapelNaIt;
  vinculadoEm: string;
}

export interface CienciasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itId?: string;
  codigo?: string;
  titulo?: string;
  versao?: string;
  responsavelCienteEm?: string | null;
  adesaoPercentual: number;
  totalCientes: number;
  totalColaboradores: number;
  pendentesCount: number;
  equipeCiencias: EquipeCienciaItem[];
  podeGerenciar?: boolean;
  currentUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onEquipeUpdated?: () => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
  initialTab?: 'ciencias' | 'equipe';
}

export function CienciasDrawer({
  isOpen,
  onClose,
  itId,
  codigo,
  titulo,
  versao,
  responsavelCienteEm,
  adesaoPercentual,
  totalCientes,
  totalColaboradores,
  pendentesCount,
  equipeCiencias,
  podeGerenciar,
  currentUser,
  onEquipeUpdated,
  triggerButtonRef,
  initialTab = 'ciencias',
}: CienciasDrawerProps) {
  // Aba principal: Ciências vs Gestão da Equipe
  const [abaAtiva, setAbaAtiva] = useState<'ciencias' | 'equipe'>('ciencias');
  // Submodo dentro de Gestão da Equipe
  const [subModoEquipe, setSubModoEquipe] = useState<'lista' | 'adicionar' | 'transferir'>('lista');

  // Filtros e busca na aba Ciências
  const [buscaCiencias, setBuscaCiencias] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'cientes' | 'pendentes'>('todos');

  // Gestão de Membros da Equipe
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [erroMembros, setErroMembros] = useState('');
  const [buscaEquipe, setBuscaEquipe] = useState('');

  // Adicionar Colaboradores
  const [termoBuscaAdd, setTermoBuscaAdd] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<
    Array<{ id: string; nome: string; email: string; departamento: string; cargo: string; mesmoSetor: boolean }>
  >([]);
  const [buscandoAdd, setBuscandoAdd] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [papelAdicionar, setPapelAdicionar] = useState<PapelNaIt>('LEITOR');
  const [adicionando, setAdicionando] = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState('');
  const [sucessoAdicionar, setSucessoAdicionar] = useState('');

  // Desvincular Colaborador
  const [desvinculando, setDesvinculando] = useState<string | null>(null);
  const [confirmDesvinc, setConfirmDesvinc] = useState<MembroEquipe | null>(null);
  const [motivoDesvinc, setMotivoDesvinc] = useState('');
  const [erroDesvinc, setErroDesvinc] = useState('');

  // Transferência de Responsabilidade Principal
  const [transferirParaId, setTransferirParaId] = useState('');
  const [transferirMotivo, setTransferirMotivo] = useState('');
  const [transferirManter, setTransferirManter] = useState(true);
  const [transferindo, setTransferindo] = useState(false);
  const [erroTransferir, setErroTransferir] = useState('');
  const [sucessoTransferir, setSucessoTransferir] = useState('');

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Fechamento e Teclado (Esc)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmDesvinc) {
          setConfirmDesvinc(null);
          return;
        }
        if (subModoEquipe !== 'lista') {
          setSubModoEquipe('lista');
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      triggerButtonRef?.current?.focus();
    };
  }, [isOpen, subModoEquipe, confirmDesvinc, onClose, triggerButtonRef]);

  // Carregar dados ao abrir
  useEffect(() => {
    if (isOpen) {
      setAbaAtiva(initialTab);
      setSubModoEquipe('lista');
      setBuscaCiencias('');
      setFiltroStatus('todos');
      setConfirmDesvinc(null);
      setErroTransferir('');
      setSucessoTransferir('');
      if (itId) {
        carregarMembros();
      }
    }
  }, [isOpen, itId, initialTab]);

  // Carregar Membros
  const carregarMembros = useCallback(async () => {
    if (!itId) return;
    setLoadingMembros(true);
    setErroMembros('');
    const res = await getEquipeLeitorIt(itId);
    if (res.success) {
      setMembros(res.membros || []);
    } else {
      setErroMembros(res.error || 'Erro ao carregar equipe.');
    }
    setLoadingMembros(false);
  }, [itId]);

  // Buscar Colaboradores para Adicionar
  const carregarColaboradoresParaAdicionar = useCallback(
    async (termo: string = '', setor?: string) => {
      if (!itId) return;
      setBuscandoAdd(true);
      setErroAdicionar('');
      const res = await buscarColaboradoresParaVincular(
        itId,
        termo,
        setor !== undefined ? (setor === 'TODOS' ? '' : setor) : (filtroSetor === 'TODOS' ? '' : filtroSetor)
      );
      if (res.success) {
        setResultadosBusca(res.usuarios || []);
        if (res.setoresDisponiveis && res.setoresDisponiveis.length) {
          setSetoresDisponiveis(res.setoresDisponiveis);
        }
      } else {
        setErroAdicionar(res.error || 'Erro ao carregar colaboradores.');
      }
      setBuscandoAdd(false);
    },
    [itId, filtroSetor]
  );

  function irParaAdicionar() {
    setSubModoEquipe('adicionar');
    setTermoBuscaAdd('');
    setFiltroSetor('TODOS');
    setSelecionados(new Set());
    setErroAdicionar('');
    setSucessoAdicionar('');
    carregarColaboradoresParaAdicionar('', 'TODOS');
  }

  function irParaTransferir() {
    setSubModoEquipe('transferir');
    setTransferirParaId('');
    setTransferirMotivo('');
    setTransferirManter(true);
    setErroTransferir('');
    setSucessoTransferir('');
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleAdicionarSelecionados() {
    if (!itId || selecionados.size === 0) return;
    setAdicionando(true);
    setErroAdicionar('');
    setSucessoAdicionar('');

    const erros: string[] = [];
    for (const uid of selecionados) {
      const res = await adicionarParticipanteIt({ itId, usuarioId: uid, papel: papelAdicionar });
      if (!res.success) erros.push(res.error || 'Erro ao adicionar.');
    }

    setAdicionando(false);
    if (erros.length) {
      setErroAdicionar(erros.join(' | '));
    } else {
      const qtd = selecionados.size;
      setSucessoAdicionar(`${qtd} colaborador${qtd > 1 ? 'es vinculados' : ' vinculado'} com sucesso.`);
      setSelecionados(new Set());
      setTermoBuscaAdd('');
      await carregarMembros();
      await carregarColaboradoresParaAdicionar('', filtroSetor);
      onEquipeUpdated?.();
      setTimeout(() => {
        setSubModoEquipe('lista');
      }, 1200);
    }
  }

  async function handleDesvincular() {
    if (!itId || !confirmDesvinc || !motivoDesvinc.trim()) return;
    setDesvinculando(confirmDesvinc.usuarioId);
    setErroDesvinc('');
    const res = await removerParticipanteIt(itId, confirmDesvinc.usuarioId, motivoDesvinc.trim());
    setDesvinculando(null);
    if (res.success) {
      setConfirmDesvinc(null);
      setMotivoDesvinc('');
      await carregarMembros();
      onEquipeUpdated?.();
    } else {
      setErroDesvinc(res.error || 'Erro ao desvincular.');
    }
  }

  async function handleTransferirResponsabilidade() {
    if (!itId || !transferirParaId || !transferirMotivo.trim()) {
      setErroTransferir('Selecione o novo responsável e informe o motivo da transferência.');
      return;
    }

    setTransferindo(true);
    setErroTransferir('');
    setSucessoTransferir('');

    const res = await transferirResponsabilidadeIt({
      itId,
      novoResponsavelId: transferirParaId,
      motivo: transferirMotivo.trim(),
      manterComoCorresponsavel: transferirManter,
    });

    setTransferindo(false);
    if (res.success) {
      setSucessoTransferir('Responsabilidade transferida com sucesso!');
      await carregarMembros();
      onEquipeUpdated?.();
      setTimeout(() => {
        setSubModoEquipe('lista');
      }, 1400);
    } else {
      setErroTransferir(res.error || 'Erro ao transferir responsabilidade.');
    }
  }

  // Filtragem na aba Ciências
  const cienciasFiltradas = (equipeCiencias || []).filter((item) => {
    const matchBusca =
      item.nome.toLowerCase().includes(buscaCiencias.toLowerCase()) ||
      (item.cargo || '').toLowerCase().includes(buscaCiencias.toLowerCase());

    if (filtroStatus === 'cientes') return matchBusca && item.ciente;
    if (filtroStatus === 'pendentes') return matchBusca && !item.ciente;
    return matchBusca;
  });

  // Filtragem na aba Equipe
  const membrosFiltrados = membros.filter(
    (m) =>
      m.nome.toLowerCase().includes(buscaEquipe.toLowerCase()) ||
      (m.cargo || '').toLowerCase().includes(buscaEquipe.toLowerCase()) ||
      (m.departamento || '').toLowerCase().includes(buscaEquipe.toLowerCase())
  );

  const papelLabel: Record<string, string> = {
    RESPONSAVEL_PRINCIPAL: 'Responsável',
    CORRESPONSAVEL: 'Corresponsável',
    LEITOR: 'Leitor',
  };

  const isGestao = currentUser && ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);
  const respPrincipalAtual = membros.find((m) => m.papel === 'RESPONSAVEL_PRINCIPAL');
  const souResponsavelPrincipal = currentUser && respPrincipalAtual?.usuarioId === currentUser.id;
  const podeTransferir = Boolean(isGestao || souResponsavelPrincipal);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="ciencias-drawer-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={() => {
          if (confirmDesvinc) {
            setConfirmDesvinc(null);
            return;
          }
          if (subModoEquipe !== 'lista') {
            setSubModoEquipe('lista');
            return;
          }
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside className="w-screen max-w-md sm:max-w-lg bg-white dark:bg-[#0B1020] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header Superior */}
          <div className="p-5 sm:p-6 border-b border-white/8 bg-[#0E1626]/80 flex items-center gap-3 shrink-0">
            {subModoEquipe !== 'lista' ? (
              <button
                type="button"
                onClick={() => setSubModoEquipe('lista')}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
                aria-label="Voltar para a lista"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 id="ciencias-drawer-title" className="text-base font-bold text-white truncate">
                {subModoEquipe === 'adicionar'
                  ? 'Vincular Colaboradores'
                  : subModoEquipe === 'transferir'
                  ? 'Transferir Responsabilidade'
                  : 'Equipe e Ciências'}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {codigo ? `${codigo} • ` : ''}
                {titulo || 'Instrução de Trabalho'}
                {versao ? ` (v${versao})` : ''}
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
              title="Fechar (Esc)"
              aria-label="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas de Navegação (quando não estiver em subfluxos como adicionar/transferir) */}
          {subModoEquipe === 'lista' && (
            <div className="flex border-b border-slate-200 dark:border-white/10 px-5 sm:px-6 bg-[#0E1626]/40 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('ciencias');
                  setConfirmDesvinc(null);
                }}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  abaAtiva === 'ciencias'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCheck className="w-4 h-4" />
                <span>Ciências & Adesão</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                  {adesaoPercentual}%
                </span>
              </button>

              {podeGerenciar && (
                <button
                  type="button"
                  onClick={() => {
                    setAbaAtiva('equipe');
                    carregarMembros();
                  }}
                  className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    abaAtiva === 'equipe'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Gestão de Integrantes</span>
                  {membros.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                      {membros.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ABA 1: CIÊNCIAS & ADESÃO
             ══════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'ciencias' && subModoEquipe === 'lista' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              
              {/* Confirmação do Responsável */}
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-2">
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

              {/* Adesão Total e Estatísticas */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/[0.03] p-4 space-y-3">
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
                    <strong className="text-emerald-400 font-semibold">{totalCientes}</strong> ciente
                    {totalCientes !== 1 ? 's' : ''}
                  </span>
                  <span>
                    <strong className="text-amber-400 font-semibold">{pendentesCount}</strong> pendente
                    {pendentesCount !== 1 ? 's' : ''}
                  </span>
                  <span>
                    Total: <strong className="text-white font-semibold">{totalColaboradores}</strong>
                  </span>
                </div>
              </div>

              {/* Busca e Filtros de Ciências */}
              <div className="space-y-3 pt-1">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador ou cargo..."
                    value={buscaCiencias}
                    onChange={(e) => setBuscaCiencias(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>

                {/* Chips de Filtro */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('todos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      filtroStatus === 'todos'
                        ? 'bg-white/15 text-white border-white/25'
                        : 'bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:text-white'
                    }`}
                  >
                    Todos ({totalColaboradores})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('cientes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      filtroStatus === 'cientes'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:text-emerald-300'
                    }`}
                  >
                    Cientes ({totalCientes})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('pendentes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      filtroStatus === 'pendentes'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:text-amber-300'
                    }`}
                  >
                    Pendentes ({pendentesCount})
                  </button>
                </div>
              </div>

              {/* Lista Nominal de Ciências */}
              <div className="space-y-2">
                {cienciasFiltradas.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </div>
                ) : (
                  cienciasFiltradas.map((colab) => (
                    <div
                      key={colab.usuarioId}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            colab.ciente
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {colab.ciente ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{colab.nome}</p>
                          <p className="text-[10px] text-slate-400 truncate">{colab.cargo || 'Colaborador'}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            colab.ciente
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {colab.ciente ? 'Ciente' : 'Pendente'}
                        </span>
                        {colab.cienteEm && (
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">{colab.cienteEm}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ABA 2: GESTÃO DE INTEGRANTES (LISTA PRINCIPAL)
             ══════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'equipe' && subModoEquipe === 'lista' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              
              {/* Botões de Ação Administrativa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={irParaAdicionar}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 hover:border-emerald-400/60 text-emerald-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Adicionar Integrantes</span>
                </button>

                {podeTransferir && (
                  <button
                    type="button"
                    onClick={irParaTransferir}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 hover:border-indigo-400/60 text-indigo-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Transferir Responsabilidade</span>
                  </button>
                )}
              </div>

              {/* Informação Legal de Auditoria */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6 text-slate-400 text-xs space-y-1">
                <p className="flex items-start gap-1.5 text-slate-400">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
                  <span>Desvincular um participante não apaga as ciências que ele já assinou no passado.</span>
                </p>
              </div>

              {/* Barra de Busca de Membros */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar na equipe por nome ou cargo..."
                  value={buscaEquipe}
                  onChange={(e) => setBuscaEquipe(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>

              {/* Erros */}
              {erroMembros && (
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {erroMembros}
                </div>
              )}

              {/* Confirmação de Desvinculação */}
              {confirmDesvinc && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-300">Desvincular participante</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Deseja desvincular <strong className="text-white">{confirmDesvinc.nome}</strong> desta IT?
                    A conta permanecerá ativa e o histórico de ciências será preservado (Prov. 213/2026).
                  </p>
                  <textarea
                    placeholder="Justificativa da desvinculação (obrigatória para auditoria)..."
                    value={motivoDesvinc}
                    onChange={(e) => setMotivoDesvinc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none transition-all"
                  />
                  {erroDesvinc && <p className="text-[11px] text-red-300">{erroDesvinc}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDesvinc(null);
                        setMotivoDesvinc('');
                        setErroDesvinc('');
                      }}
                      disabled={Boolean(desvinculando)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-300 hover:text-white hover:bg-white/8 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDesvincular}
                      disabled={!motivoDesvinc.trim() || Boolean(desvinculando)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {desvinculando ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="w-3.5 h-3.5" />
                      )}
                      Desvincular
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Membros */}
              {loadingMembros ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  Carregando participantes...
                </div>
              ) : membrosFiltrados.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-white/8 bg-white/[0.02]">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">
                    {membros.length === 0 ? 'Nenhum colaborador vinculado.' : 'Nenhum resultado para a busca.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {membrosFiltrados.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0 select-none">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{m.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {m.cargo ? `${m.cargo} • ` : ''}
                          {m.departamento}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          m.papel === 'RESPONSAVEL_PRINCIPAL'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : m.papel === 'CORRESPONSAVEL'
                            ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                            : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {papelLabel[m.papel] || m.papel}
                      </span>
                      {m.papel !== 'RESPONSAVEL_PRINCIPAL' && podeGerenciar && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDesvinc(m);
                            setErroDesvinc('');
                            setMotivoDesvinc('');
                          }}
                          disabled={Boolean(desvinculando)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer text-[11px] font-semibold shrink-0 disabled:opacity-50"
                          title={`Desvincular ${m.nome}`}
                          aria-label={`Desvincular ${m.nome}`}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Desvincular</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUBMODO: ADICIONAR INTEGRANTES
             ══════════════════════════════════════════════════════════════════ */}
          {subModoEquipe === 'adicionar' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Selecione colaboradores do cartório para vincular a esta IT. Eles receberão notificação para registrar ciência na versão{' '}
                  <strong className="text-white">{versao || 'atual'}</strong>.
                </p>

                {/* Filtro por Setor se houver */}
                {setoresDisponiveis.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={filtroSetor}
                      onChange={(e) => {
                        setFiltroSetor(e.target.value);
                        carregarColaboradoresParaAdicionar(termoBuscaAdd, e.target.value);
                      }}
                      className="w-full bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
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

                {/* Campo de Busca */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou cargo..."
                      value={termoBuscaAdd}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTermoBuscaAdd(val);
                        if (val === '') {
                          carregarColaboradoresParaAdicionar('', filtroSetor);
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && carregarColaboradoresParaAdicionar(termoBuscaAdd, filtroSetor)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => carregarColaboradoresParaAdicionar(termoBuscaAdd, filtroSetor)}
                    disabled={buscandoAdd}
                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-slate-200 dark:border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {buscandoAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>

                {/* Seleção de Papel */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Vincular como:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPapelAdicionar('LEITOR')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        papelAdicionar === 'LEITOR'
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Leitor
                    </button>
                    <button
                      type="button"
                      onClick={() => setPapelAdicionar('CORRESPONSAVEL')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        papelAdicionar === 'CORRESPONSAVEL'
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                          : 'bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Corresponsável
                    </button>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              {erroAdicionar && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {erroAdicionar}
                </div>
              )}
              {sucessoAdicionar && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <CheckCheck className="w-4 h-4 shrink-0" />
                  {sucessoAdicionar}
                </div>
              )}

              {/* Resultados da Busca */}
              {buscandoAdd ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  Carregando colaboradores disponíveis...
                </div>
              ) : resultadosBusca.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    <span>{resultadosBusca.length} disponível(is)</span>
                    {selecionados.size > 0 && (
                      <span className="text-emerald-400 normal-case">{selecionados.size} selecionado(s)</span>
                    )}
                  </div>
                  {resultadosBusca.map((u) => {
                    const sel = selecionados.has(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleSelecionado(u.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          sel ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/6 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            sel ? 'border-emerald-400 bg-emerald-500' : 'border-white/30'
                          }`}
                        >
                          {sel && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.nome}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {u.cargo ? `${u.cargo} • ` : ''}
                            {u.departamento}
                          </p>
                        </div>
                        {u.mesmoSetor ? (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            Mesmo setor
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            Outro setor
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : !buscandoAdd ? (
                <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-white/8 bg-white/[0.02]">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">
                    {termoBuscaAdd
                      ? 'Nenhum resultado para a busca. Tente outro termo.'
                      : 'Todos os colaboradores ativos deste setor já estão vinculados a esta IT.'}
                  </p>
                </div>
              ) : null}

              {/* Botão de Conclusão */}
              {selecionados.size > 0 && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-3 sticky bottom-0">
                  <p className="text-xs font-semibold text-emerald-300">
                    {selecionados.size} colaborador{selecionados.size !== 1 ? 'es' : ''} selecionado
                    {selecionados.size !== 1 ? 's' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={handleAdicionarSelecionados}
                    disabled={adicionando}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {adicionando
                      ? 'Vinculando...'
                      : `Vincular como ${papelAdicionar === 'CORRESPONSAVEL' ? 'Corresponsável' : 'Leitor'}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUBMODO: TRANSFERIR RESPONSABILIDADE
             ══════════════════════════════════════════════════════════════════ */}
          {subModoEquipe === 'transferir' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <BadgeCheck className="w-4 h-4" />
                  <span>Transferência de Custódia Técnica</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O novo responsável passará a ser o custodiante formal desta Instrução de Trabalho. Esta alteração é registrada com hash imutável na trilha de auditoria (Prov. 213/2026).
                </p>
              </div>

              {erroTransferir && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {erroTransferir}
                </div>
              )}
              {sucessoTransferir && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <CheckCheck className="w-4 h-4 shrink-0" />
                  {sucessoTransferir}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Novo Responsável Principal *
                  </label>
                  <select
                    value={transferirParaId}
                    onChange={(e) => setTransferirParaId(e.target.value)}
                    className="w-full bg-[#0E1626] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Selecione um integrante da equipe...</option>
                    {membros
                      .filter((m) => m.papel !== 'RESPONSAVEL_PRINCIPAL')
                      .map((m) => (
                        <option key={m.usuarioId} value={m.usuarioId}>
                          {m.nome} ({m.cargo || m.departamento})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Justificativa formal da transferência *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Mudança de atribuição de setor, licença ou promoção..."
                    value={transferirMotivo}
                    onChange={(e) => setTransferirMotivo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none transition-all"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferirManter}
                    onChange={(e) => setTransferirManter(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Manter o responsável atual como Corresponsável da IT</span>
                </label>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTransferirResponsabilidade}
                    disabled={!transferirParaId || !transferirMotivo.trim() || transferindo}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-900/30"
                  >
                    {transferindo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="w-4 h-4" />
                    )}
                    {transferindo ? 'Registrando Transferência...' : 'Confirmar e Assinar Transferência'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="p-4 border-t border-slate-200 dark:border-white/8 bg-[#0E1626]/80 flex items-center gap-3 shrink-0">
            {subModoEquipe !== 'lista' && (
              <button
                type="button"
                onClick={() => setSubModoEquipe('lista')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-300 hover:text-white hover:bg-white/8 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-5 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-white/8 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}
