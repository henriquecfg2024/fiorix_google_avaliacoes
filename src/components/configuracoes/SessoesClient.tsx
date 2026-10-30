'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  X,
  Check,
  RotateCcw,
  Shield,
  HardDrive,
  Network,
  Hash,
  Sliders,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CadastroSessao,
  SalvarSessaoInput,
  salvarSessao,
  excluirSessao,
  restaurarSessoesPadrao,
} from '@/app/actions/sessoes';

interface SessoesClientProps {
  initialData: CadastroSessao[];
}

const PADRAO_LABELS: Record<string, { label: string; desc: string; cor: string }> = {
  milhar: {
    label: 'Milhar do documento',
    desc: 'Blocos de 1.000 docs (ex: 00000000, 00268000)',
    cor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  tomo: {
    label: 'Tomo encadernado',
    desc: 'Tomos encadernados (ex: 4, 4A, 8, 8A)',
    cor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  protocolo: {
    label: 'Protocolo / Prenotação',
    desc: 'Subpastas com número de protocolo',
    cor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  processo: {
    label: 'Processo / Procedimento',
    desc: 'Subpastas de autos processuais',
    cor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  direto: {
    label: 'Direto na pasta',
    desc: 'Arquivos gravados na raiz da sessão',
    cor: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
};

export function SessoesClient({ initialData }: SessoesClientProps) {
  const [sessoes, setSessoes] = useState<CadastroSessao[]>(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroPadrao, setFiltroPadrao] = useState('TODOS');
  const [isPending, startTransition] = useTransition();

  // Modal Novo / Editar
  const [modalAberto, setModalAberto] = useState(false);
  const [sessaoEditando, setSessaoEditando] = useState<CadastroSessao | null>(null);

  // Form State (Idêntico aos campos do Siplan)
  const [formNome, setFormNome] = useState('');
  const [formGrupo, setFormGrupo] = useState('Sessões sem Grupo');
  const [formDescricao, setFormDescricao] = useState('');
  const [formSequencia, setFormSequencia] = useState(0);
  const [formPadrao, setFormPadrao] = useState<'milhar' | 'tomo' | 'protocolo' | 'processo' | 'direto'>('milhar');
  const [formCaminhoUnc, setFormCaminhoUnc] = useState('\\\\SRVFILES\\imagens\\IMAGENS\\');
  const [formPastaLocal, setFormPastaLocal] = useState('K:\\IMAGENS\\');
  const [formConfidencial, setFormConfidencial] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Exclusão
  const [sessaoExcluindo, setSessaoExcluindo] = useState<CadastroSessao | null>(null);

  const abrirNovoModal = () => {
    setSessaoEditando(null);
    setFormNome('');
    setFormGrupo('Sessões sem Grupo');
    setFormDescricao('');
    setFormSequencia(sessoes.length);
    setFormPadrao('milhar');
    setFormCaminhoUnc('\\\\SRVFILES\\imagens\\IMAGENS\\');
    setFormPastaLocal('K:\\IMAGENS\\');
    setFormConfidencial(false);
    setFormError('');
    setModalAberto(true);
  };

  const abrirEditarModal = (s: CadastroSessao) => {
    setSessaoEditando(s);
    setFormNome(s.nome);
    setFormGrupo(s.grupo || 'Sessões sem Grupo');
    setFormDescricao(s.descricao || '');
    setFormSequencia(s.sequencia || 0);
    setFormPadrao(s.padraoLocalizacao || 'milhar');
    setFormCaminhoUnc(s.caminhoUnc || '');
    setFormPastaLocal(s.pastaLocal || '');
    setFormConfidencial(Boolean(s.confidencial));
    setFormError('');
    setModalAberto(true);
  };

  // Atualizar caminhos automaticamente conforme o nome digitado no modo criação
  const handleNomeChange = (val: string) => {
    setFormNome(val);
    if (!sessaoEditando) {
      const nomeLimpo = val.trim();
      setFormCaminhoUnc(`\\\\SRVFILES\\imagens\\IMAGENS\\${nomeLimpo}`);
      setFormPastaLocal(`K:\\IMAGENS\\${nomeLimpo}`);
      if (!formDescricao) {
        setFormDescricao(nomeLimpo);
      }
    }
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formNome.trim()) {
      setFormError('Informe o Nome da Sessão.');
      return;
    }
    if (!formCaminhoUnc.trim()) {
      setFormError('Informe o Caminho UNC de Rede.');
      return;
    }

    setFormError('');

    startTransition(async () => {
      try {
        const payload: SalvarSessaoInput = {
          id: sessaoEditando?.id,
          nome: formNome.trim(),
          grupo: formGrupo.trim() || 'Sessões sem Grupo',
          descricao: formDescricao.trim() || formNome.trim(),
          sequencia: Number(formSequencia) || 0,
          padraoLocalizacao: formPadrao,
          caminhoUnc: formCaminhoUnc.trim(),
          pastaLocal: formPastaLocal.trim(),
          confidencial: formConfidencial,
        };

        const res = await salvarSessao(payload);
        if (res.success) {
          toast.success(
            sessaoEditando
              ? `Sessão "${payload.nome}" atualizada com sucesso!`
              : `Nova sessão "${payload.nome}" cadastrada com sucesso!`
          );
          setModalAberto(false);
          // Recarregar os dados
          window.location.reload();
        }
      } catch (err: any) {
        setFormError(err.message || 'Erro ao salvar sessão.');
      }
    });
  };

  const handleExcluir = () => {
    if (!sessaoExcluindo) return;

    startTransition(async () => {
      try {
        await excluirSessao(sessaoExcluindo.id);
        toast.success(`Sessão "${sessaoExcluindo.nome}" excluída.`);
        setSessaoExcluindo(null);
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao excluir sessão.');
      }
    });
  };

  const handleRestaurarPadrao = () => {
    if (
      !confirm(
        'Deseja recarregar o catálogo padrão de 44 sessões oficiais do Siplan? Nenhuma sessão personalizada será apagada, apenas as padrões serão restauradas.'
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await restaurarSessoesPadrao();
        toast.success(`${res.total} sessões do Siplan restauradas com sucesso!`);
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao restaurar catálogo.');
      }
    });
  };

  // Filtro
  const sessoesFiltradas = sessoes.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchTerm =
      !searchTerm ||
      s.nome.toLowerCase().includes(term) ||
      (s.descricao && s.descricao.toLowerCase().includes(term)) ||
      (s.caminhoUnc && s.caminhoUnc.toLowerCase().includes(term)) ||
      (s.pastaLocal && s.pastaLocal.toLowerCase().includes(term));

    const matchPadrao = filtroPadrao === 'TODOS' || s.padraoLocalizacao === filtroPadrao;

    return matchTerm && matchPadrao;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/12 via-indigo-500/10 to-purple-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">SISTEMA & TECNOLOGIA</span>
            <span className="text-slate-600">/</span>
            <Link
              href="/configuracoes"
              className="text-slate-400 hover:text-white transition-colors tracking-wider"
            >
              CONFIGURAÇÕES
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">CADASTRO DE SESSÕES</span>
            <h1 className="sr-only">Cadastro de Sessões</h1>
          </div>

          <Link
            href="/configuracoes"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
        </div>

        {/* CABEÇALHO COM TÍTULO E BOTÃO NOVO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <FolderTree className="w-6 h-6 text-cyan-400" />
              Cadastro de Sessões do Acervo
              <span className="text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-normal">
                Exclusivo Master e Admin
              </span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Diretórios de rede, padrões de busca e mapeamento Siplan com tradução transparente para o conector local.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRestaurarPadrao}
              disabled={isPending}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              title="Restaurar as 44 sessões oficiais do Siplan"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Restaurar Siplan</span>
            </button>

            <button
              onClick={abrirNovoModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-cyan-900/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Sessão</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sessão por nome, descrição ou caminho de rede..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-[#0B1020]/90 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por Padrão de Localização */}
          <div className="relative sm:w-64">
            <select
              value={filtroPadrao}
              onChange={(e) => setFiltroPadrao(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#0B1020]/90 text-xs text-white focus:outline-none focus:border-cyan-400 transition-all cursor-pointer"
            >
              <option value="TODOS">Todos os padrões</option>
              <option value="milhar">Milhar do documento</option>
              <option value="tomo">Tomo encadernado</option>
              <option value="protocolo">Protocolo / Prenotação</option>
              <option value="processo">Processo / Procedimento</option>
              <option value="direto">Direto na pasta</option>
            </select>
          </div>
        </div>

        {/* CONTADOR DE RESULTADOS */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            {sessoesFiltradas.length}{' '}
            {sessoesFiltradas.length === 1 ? 'sessão cadastrada' : 'sessões cadastradas'}
          </p>
          <span className="text-xs text-slate-500">
            Grupo padrão: <strong className="text-slate-300">Sessões sem Grupo</strong>
          </span>
        </div>

        {/* LISTAGEM DE SESSÕES */}
        {sessoesFiltradas.length === 0 ? (
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 py-16 text-center shadow-sm backdrop-blur-xl">
            <FolderTree className="mx-auto w-12 h-12 text-slate-600 mb-3" />
            <p className="text-base font-semibold text-white">Nenhuma sessão encontrada</p>
            <p className="text-xs text-slate-400 mt-1">Tente ajustar o termo de busca ou limpar os filtros.</p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 shadow-sm backdrop-blur-xl overflow-hidden divide-y divide-white/8">
            {sessoesFiltradas.map((sessao) => {
              const padraoInfo = PADRAO_LABELS[sessao.padraoLocalizacao] || PADRAO_LABELS.direto;

              return (
                <div
                  key={sessao.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Informações Principais */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                        {sessao.nome}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        {sessao.grupo || 'Sessões sem Grupo'}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${padraoInfo.cor}`}
                        title={padraoInfo.desc}
                      >
                        {padraoInfo.label}
                      </span>
                      {sessao.confidencial && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 font-medium flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Confidencial
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        Seq: {sessao.sequencia}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white leading-tight">
                      {sessao.descricao || sessao.nome}
                    </p>

                    {/* Caminhos UNC e Local */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono truncate" title={sessao.caminhoUnc}>
                        <Network className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{sessao.caminhoUnc}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono truncate" title={sessao.pastaLocal}>
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{sessao.pastaLocal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => abrirEditarModal(sessao)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>

                    <button
                      onClick={() => setSessaoExcluindo(sessao)}
                      className="p-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                      title={`Excluir sessão ${sessao.nome}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* MODAL: NOVA / EDITAR SESSÃO                      */}
        {/* ═══════════════════════════════════════════════ */}
        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => !isPending && setModalAberto(false)}
            />

            <div className="relative w-full max-w-2xl my-8 rounded-[24px] border border-white/20 bg-[#0B1020]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col z-10">
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-white/10 bg-gradient-to-r from-cyan-950/30 via-transparent to-blue-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                      {sessaoEditando ? `Editar Sessão — ${sessaoEditando.nome}` : 'Cadastrar Nova Sessão de Documentos'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Parâmetros idênticos ao Siplan com mapeamento de rede e drive local.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => !isPending && setModalAberto(false)}
                  disabled={isPending}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSalvar} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <div className="flex-1">{formError}</div>
                  </div>
                )}

                {/* Linha 1: Nome da Sessão + Nome do Grupo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Nome da Sessão *
                    </label>
                    <input
                      type="text"
                      value={formNome}
                      onChange={(e) => handleNomeChange(e.target.value)}
                      placeholder="Ex.: LV2, LOTEAMENTO, USUCAPIAO"
                      disabled={isPending}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 font-mono text-sm text-cyan-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all uppercase disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Nome do Grupo
                    </label>
                    <input
                      type="text"
                      value={formGrupo}
                      onChange={(e) => setFormGrupo(e.target.value)}
                      placeholder="Sessões sem Grupo"
                      disabled={isPending}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Linha 2: Descrição da Sessão */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Descrição da Sessão
                  </label>
                  <input
                    type="text"
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Ex.: Livro nº 2 — Registro Geral (Matrículas)"
                    disabled={isPending}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Linha 3: Sequência + Padrão de Localização */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Sequência
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formSequencia}
                      onChange={(e) => setFormSequencia(parseInt(e.target.value, 10) || 0)}
                      disabled={isPending}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white font-mono focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Padrão de Localização *
                    </label>
                    <select
                      value={formPadrao}
                      onChange={(e) => setFormPadrao(e.target.value as any)}
                      disabled={isPending}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#121828] text-xs text-white focus:outline-none focus:border-cyan-400 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <option value="milhar">Milhar do documento (ex: 00000000, 00268000)</option>
                      <option value="tomo">Tomo encadernado (ex: 4, 4A, 8, 8A)</option>
                      <option value="protocolo">Protocolo / Prenotação</option>
                      <option value="processo">Processo / Autos</option>
                      <option value="direto">Direto na pasta</option>
                    </select>
                  </div>
                </div>

                {/* Linha 4: Caminho UNC (Rede) */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-cyan-400" />
                      Local das Imagens (Caminho UNC de Rede) *
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Oficial do servidor</span>
                  </label>
                  <input
                    type="text"
                    value={formCaminhoUnc}
                    onChange={(e) => setFormCaminhoUnc(e.target.value)}
                    placeholder="\\\\SRVFILES\\imagens\\IMAGENS\\LV2"
                    disabled={isPending}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Linha 5: Pasta Local Mapeada (Drive) */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                      Pasta Local Mapeada (Drive do Conector)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Ex: K:\IMAGENS ou W:\</span>
                  </label>
                  <input
                    type="text"
                    value={formPastaLocal}
                    onChange={(e) => setFormPastaLocal(e.target.value)}
                    placeholder="K:\\IMAGENS\\LV2"
                    disabled={isPending}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                  />
                </div>

                {/* Linha 6: Confidencial Checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formConfidencial}
                      onChange={(e) => setFormConfidencial(e.target.checked)}
                      disabled={isPending}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">Sessão Confidencial</span>
                      <p className="text-slate-400 text-[11px]">
                        Restringe a visualização apenas a operadores e perfis com nível de segurança elevado.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    disabled={isPending}
                    className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/40 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{sessaoEditando ? 'Salvar Alterações' : 'Cadastrar Sessão'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* MODAL: CONFIRMAR EXCLUSÃO                        */}
        {/* ═══════════════════════════════════════════════ */}
        {sessaoExcluindo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => !isPending && setSessaoExcluindo(null)}
            />

            <div className="relative w-full max-w-md rounded-[24px] border border-red-500/30 bg-[#0B1020]/95 shadow-2xl backdrop-blur-xl p-6 text-white space-y-4 z-10">
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Excluir Sessão</h3>
                  <p className="text-xs text-slate-400">Esta ação é irreversível.</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Tem certeza que deseja excluir a sessão <strong className="text-white">"{sessaoExcluindo.nome}"</strong> ({sessaoExcluindo.caminhoUnc})?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSessaoExcluindo(null)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-900/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
