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
} from 'lucide-react';
import { EquipeCienciaItem } from '@/app/actions/minha-it';
import {
  getEquipeLeitorIt,
  adicionarParticipanteIt,
  removerParticipanteIt,
  buscarColaboradoresParaVincular,
  PapelNaIt,
} from '@/app/actions/its';

type Modo = 'ciencias' | 'equipe' | 'adicionar';

interface MembroEquipe {
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
  onEquipeUpdated?: () => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
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
  onEquipeUpdated,
  triggerButtonRef,
}: CienciasDrawerProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'cientes' | 'pendentes'>('todos');
  const [modo, setModo] = useState<Modo>('ciencias');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);

  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [erroMembros, setErroMembros] = useState('');
  const [buscaEquipe, setBuscaEquipe] = useState('');

  const [termoBusca, setTermoBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Array<{ id: string; nome: string; email: string; departamento: string; cargo: string; mesmoSetor: boolean }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [adicionando, setAdicionando] = useState(false);
  const [erroAdicionar, setErroAdicionar] = useState('');
  const [sucessoAdicionar, setSucessoAdicionar] = useState('');

  const [desvinculando, setDesvinculando] = useState<string | null>(null);
  const [confirmDesvinc, setConfirmDesvinc] = useState<MembroEquipe | null>(null);
  const [motivoDesvinc, setMotivoDesvinc] = useState('');
  const [erroDesvinc, setErroDesvinc] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmDesvinc) { setConfirmDesvinc(null); return; }
        if (modo === 'adicionar') { setModo('equipe'); return; }
        if (modo === 'equipe') { setModo('ciencias'); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    setTimeout(() => { (modo === 'ciencias' ? closeButtonRef : backButtonRef).current?.focus(); }, 60);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      triggerButtonRef?.current?.focus();
    };
  }, [isOpen, modo, confirmDesvinc, onClose, triggerButtonRef]);

  useEffect(() => {
    if (!isOpen) {
      setModo('ciencias'); setBusca(''); setFiltroStatus('todos');
      setMembros([]); setErroMembros(''); setBuscaEquipe('');
      setTermoBusca(''); setResultadosBusca([]); setSelecionados(new Set());
      setErroAdicionar(''); setSucessoAdicionar('');
      setConfirmDesvinc(null); setMotivoDesvinc(''); setErroDesvinc('');
    }
  }, [isOpen]);

  const carregarMembros = useCallback(async () => {
    if (!itId) return;
    setLoadingMembros(true); setErroMembros('');
    const res = await getEquipeLeitorIt(itId);
    if (res.success) setMembros(res.membros || []);
    else setErroMembros(res.error || 'Erro ao carregar equipe.');
    setLoadingMembros(false);
  }, [itId]);

  function irParaEquipe() { setModo('equipe'); carregarMembros(); }

  const carregarColaboradoresParaAdicionar = useCallback(async (termo: string = '') => {
    if (!itId) return;
    setBuscando(true);
    setErroAdicionar('');
    const res = await buscarColaboradoresParaVincular(itId, termo);
    if (res.success) {
      setResultadosBusca(res.usuarios || []);
    } else {
      setErroAdicionar(res.error || 'Erro ao carregar colaboradores.');
    }
    setBuscando(false);
  }, [itId]);

  function irParaAdicionar() {
    setModo('adicionar');
    setTermoBusca('');
    setSelecionados(new Set());
    setErroAdicionar('');
    setSucessoAdicionar('');
    carregarColaboradoresParaAdicionar('');
  }

  async function handleBuscarParaAdicionar() {
    carregarColaboradoresParaAdicionar(termoBusca);
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAdicionarSelecionados() {
    if (!itId || selecionados.size === 0) return;
    setAdicionando(true); setErroAdicionar(''); setSucessoAdicionar('');
    const erros: string[] = [];
    for (const uid of selecionados) {
      const res = await adicionarParticipanteIt({ itId, usuarioId: uid, papel: 'LEITOR' });
      if (!res.success) erros.push(res.error || 'Erro ao adicionar.');
    }
    setAdicionando(false);
    if (erros.length) { setErroAdicionar(erros.join(' | ')); }
    else {
      const qtd = selecionados.size;
      setSucessoAdicionar(`${qtd} colaborador${qtd > 1 ? 'es vinculados' : ' vinculado'} com sucesso.`);
      setSelecionados(new Set());
      setTermoBusca('');
      await carregarMembros();
      await carregarColaboradoresParaAdicionar('');
      onEquipeUpdated?.();
    }
  }

  async function handleDesvincular() {
    if (!itId || !confirmDesvinc || !motivoDesvinc.trim()) return;
    setDesvinculando(confirmDesvinc.usuarioId); setErroDesvinc('');
    const res = await removerParticipanteIt(itId, confirmDesvinc.usuarioId, motivoDesvinc.trim());
    setDesvinculando(null);
    if (res.success) { setConfirmDesvinc(null); setMotivoDesvinc(''); await carregarMembros(); onEquipeUpdated?.(); }
    else { setErroDesvinc(res.error || 'Erro ao desvincular.'); }
  }

  if (!isOpen) return null;

  const colaboradoresFiltrados = equipeCiencias.filter(c => {
    const m = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cargo.toLowerCase().includes(busca.toLowerCase());
    if (!m) return false;
    if (filtroStatus === 'cientes') return c.ciente;
    if (filtroStatus === 'pendentes') return !c.ciente;
    return true;
  });

  const membrosFiltrados = membros.filter(m =>
    m.nome.toLowerCase().includes(buscaEquipe.toLowerCase()) || m.cargo.toLowerCase().includes(buscaEquipe.toLowerCase())
  );

  const papelLabel: Record<string, string> = { RESPONSAVEL_PRINCIPAL: 'Responsável', CORRESPONSAVEL: 'Corresponsável', LEITOR: 'Equipe' };
  const tituloPainel = modo === 'ciencias' ? 'Equipe e ciências' : modo === 'equipe' ? 'Gerenciar equipe' : 'Adicionar colaboradores';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="ciencias-drawer-title">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={() => {
          if (confirmDesvinc) { setConfirmDesvinc(null); return; }
          if (modo === 'adicionar') { setModo('equipe'); return; }
          if (modo === 'equipe') { setModo('ciencias'); return; }
          onClose();
        }}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside className="w-screen max-w-md sm:max-w-lg bg-[#0B1020] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/8 bg-[#0E1626]/80 flex items-center gap-3 shrink-0">
            {modo !== 'ciencias' ? (
              <button ref={backButtonRef} type="button" onClick={() => modo === 'adicionar' ? setModo('equipe') : setModo('ciencias')}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0" aria-label="Voltar">
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 id="ciencias-drawer-title" className="text-base font-bold text-white truncate">{tituloPainel}</h2>
              <p className="text-xs text-slate-400 truncate">{titulo || 'Instrução de Trabalho'}{versao ? ` • Versão ${versao}` : ''}</p>
            </div>
            <button ref={modo === 'ciencias' ? closeButtonRef : undefined} type="button" onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
              title="Fechar (Esc)" aria-label="Fechar painel">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* MODO CIÊNCIAS */}
          {modo === 'ciencias' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {podeGerenciar && (
                <div className="space-y-2.5">
                  <button type="button" id="btn-gerenciar-equipe" onClick={irParaEquipe}
                    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 hover:border-indigo-400/60 text-indigo-300 hover:text-white font-semibold text-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">Gerenciar equipe</span>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                  </button>
                  <div className="space-y-1 px-0.5">
                    <p className="text-xs text-slate-400">Vincule ou desvincule colaboradores desta IT.</p>
                    <p className="text-xs text-slate-500 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
                      Desvincular não apaga o histórico de ciências.
                    </p>
                  </div>
                  <div className="border-t border-white/6" />
                </div>
              )}

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ciência do Responsável Confirmada</p>
                    <p className="text-xs text-slate-200 mt-0.5">{responsavelCienteEm ? `Registrada em ${responsavelCienteEm}` : 'Ciência registrada pelo responsável técnico.'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Adesão Total da Equipe</span>
                  <span className="font-mono font-bold text-white text-sm">{adesaoPercentual}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" style={{ width: `${adesaoPercentual}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/6">
                  <span><strong className="text-emerald-400 font-semibold">{totalCientes}</strong> ciente{totalCientes !== 1 ? 's' : ''}</span>
                  <span><strong className="text-amber-400 font-semibold">{pendentesCount}</strong> pendente{pendentesCount !== 1 ? 's' : ''}</span>
                  <span className="text-slate-500">Total: {totalColaboradores}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar colaborador ou cargo..." value={busca} onChange={e => setBusca(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all" />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {(['todos', 'cientes', 'pendentes'] as const).map(f => {
                    const count = f === 'todos' ? equipeCiencias.length : f === 'cientes' ? totalCientes : pendentesCount;
                    const label = f === 'todos' ? 'Todos' : f === 'cientes' ? 'Cientes' : 'Pendentes';
                    const active = filtroStatus === f;
                    return (
                      <button key={f} type="button" onClick={() => setFiltroStatus(f)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${active ? (f === 'todos' ? 'bg-white/15 text-white border border-white/20' : f === 'cientes' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30') : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {colaboradoresFiltrados.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-white/8 bg-white/[0.02]">
                    <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-slate-400">Nenhum colaborador encontrado.</p>
                  </div>
                ) : colaboradoresFiltrados.map(colab => (
                  <div key={colab.usuarioId} className="flex items-center justify-between p-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      {colab.ciente ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0"><Check className="w-3 h-3 stroke-[3]" /></div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0"><Clock className="w-2.5 h-2.5 text-slate-500" /></div>
                      )}
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${colab.isCurrentUser ? 'font-bold text-white' : 'text-slate-200'}`}>{colab.nome}</p>
                        <p className="text-[10px] text-slate-500 truncate">{colab.cargo}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colab.ciente ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                        {colab.ciente ? 'Ciente' : 'Pendente'}
                      </span>
                      {colab.cienteEm && <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{colab.cienteEm.split(' ')[0]}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODO EQUIPE */}
          {modo === 'equipe' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="space-y-3">
                <button type="button" onClick={irParaAdicionar}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 hover:border-emerald-400/60 text-emerald-300 hover:text-white font-semibold text-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                  <UserPlus className="w-4 h-4" />
                  Adicionar colaboradores
                </button>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar por nome ou cargo..." value={buscaEquipe} onChange={e => setBuscaEquipe(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
                </div>
              </div>
              {erroMembros && (
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erroMembros}
                </div>
              )}
              {confirmDesvinc && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-300">Desvincular colaborador</p>
                  <p className="text-xs text-slate-300 leading-relaxed">Deseja desvincular <strong className="text-white">{confirmDesvinc.nome}</strong> desta IT? A conta permanecerá ativa e o histórico de ciências será preservado.</p>
                  <textarea placeholder="Justificativa (obrigatória)..." value={motivoDesvinc} onChange={e => setMotivoDesvinc(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none transition-all" />
                  {erroDesvinc && <p className="text-[11px] text-red-300">{erroDesvinc}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setConfirmDesvinc(null); setMotivoDesvinc(''); setErroDesvinc(''); }} disabled={!!desvinculando}
                      className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/8 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">Cancelar</button>
                    <button type="button" onClick={handleDesvincular} disabled={!motivoDesvinc.trim() || !!desvinculando}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
                      {desvinculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}Desvincular
                    </button>
                  </div>
                </div>
              )}
              {loadingMembros ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />Carregando equipe...
                </div>
              ) : membrosFiltrados.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-white/8 bg-white/[0.02]">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">{membros.length === 0 ? 'Nenhum colaborador vinculado.' : 'Nenhum resultado para a busca.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {membrosFiltrados.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0 select-none">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{m.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">{m.cargo || m.departamento}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${m.papel === 'RESPONSAVEL_PRINCIPAL' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : m.papel === 'CORRESPONSAVEL' ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                        {papelLabel[m.papel] || m.papel}
                      </span>
                      {m.papel !== 'RESPONSAVEL_PRINCIPAL' && (
                        <button
                          type="button"
                          onClick={() => { setConfirmDesvinc(m); setErroDesvinc(''); setMotivoDesvinc(''); }}
                          disabled={!!desvinculando}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer text-[11px] font-semibold shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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

          {/* MODO ADICIONAR */}
          {modo === 'adicionar' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">Selecione colaboradores ativos da sua organização para vincular a esta IT. Eles receberão pendência de ciência para a versão <strong className="text-white">{versao}</strong>.</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, cargo ou setor..."
                      value={termoBusca}
                      onChange={e => {
                        const val = e.target.value;
                        setTermoBusca(val);
                        if (val === '') {
                          carregarColaboradoresParaAdicionar('');
                        }
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleBuscarParaAdicionar()}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarParaAdicionar}
                    disabled={buscando}
                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>
              </div>
              {erroAdicionar && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{erroAdicionar}
                </div>
              )}
              {sucessoAdicionar && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <CheckCheck className="w-4 h-4 shrink-0" />{sucessoAdicionar}
                </div>
              )}
              {buscando ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  Carregando colaboradores disponíveis...
                </div>
              ) : resultadosBusca.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    <span>{resultadosBusca.length} colaborador{resultadosBusca.length !== 1 ? 'es' : ''} disponível{resultadosBusca.length !== 1 ? 'is' : ''}</span>
                    {selecionados.size > 0 && (
                      <span className="text-emerald-400 normal-case">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {resultadosBusca.map(u => {
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
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          sel ? 'border-emerald-400 bg-emerald-500' : 'border-white/30'
                        }`}>
                          {sel && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.nome}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.cargo ? `${u.cargo} • ` : ''}{u.departamento}</p>
                        </div>
                        {u.mesmoSetor ? (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            Mesmo setor
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            Outro setor
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : !buscando ? (
                <div className="p-8 text-center rounded-2xl border border-white/8 bg-white/[0.02]">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">
                    {termoBusca ? 'Nenhum resultado para a busca. Tente outro termo.' : 'Todos os colaboradores ativos já estão vinculados a esta IT.'}
                  </p>
                </div>
              ) : null}
              {selecionados.size > 0 && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-3">
                  <p className="text-xs font-semibold text-emerald-300">{selecionados.size} colaborador{selecionados.size !== 1 ? 'es' : ''} selecionado{selecionados.size !== 1 ? 's' : ''}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Serão vinculados como <strong className="text-white">Equipe</strong> na versão <strong className="text-white">{versao}</strong>. Ciência não é registrada automaticamente.</p>
                  <button type="button" onClick={handleAdicionarSelecionados} disabled={adicionando}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
                    {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {adicionando ? 'Vinculando...' : `Vincular ${selecionados.size} colaborador${selecionados.size !== 1 ? 'es' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-white/8 bg-[#0E1626]/80 flex items-center gap-3 shrink-0">
            {modo !== 'ciencias' && (
              <button type="button" onClick={() => modo === 'adicionar' ? setModo('equipe') : setModo('ciencias')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/8 text-xs font-semibold transition-colors cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" />Voltar
              </button>
            )}
            <button type="button" onClick={onClose}
              className="ml-auto px-5 py-2 rounded-xl border border-white/10 hover:bg-white/8 text-white text-xs font-semibold transition-colors cursor-pointer">
              Fechar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
