'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  BookOpen,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Printer,
  Sparkles,
  Users,
  ChevronDown,
  ChevronUp,
  UserCheck,
  HelpCircle,
  Plus,
  ArrowRight,
  Copy,
  Check,
  Share2,
  Calendar,
  Layers,
  FileText,
  Lock,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ITDetailData,
  registrarCienciaIt,
  delegarGuardiaoTemporario,
  adicionarFaqExcecao,
} from '@/app/actions/its';
import { UniversalITUploader } from './UniversalITUploader';
import { ItDiffModal } from './ItDiffModal';

export function ItDetailViewClient({ initialData }: { initialData: ITDetailData }) {
  const [data, setData] = useState<ITDetailData>(initialData);
  const { it, currentUser, isGuardiao, minhaCiencia, equipeCiencias, colegasDepto, historicoAudit } = data;

  // Modos de Exibição
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'a4' | 'checklist'>('a4');
  const [readerTheme, setReaderTheme] = useState<'paper' | 'dark'>('paper');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Checklists marcados pelo usuário durante a sessão
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  // Modais
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [parsedDataForDiff, setParsedDataForDiff] = useState<any>(null);
  const [delegarModalOpen, setDelegarModalOpen] = useState(false);
  const [substitutoId, setSubstitutoId] = useState('');
  const [substitutoAte, setSubstitutoAte] = useState('');
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [novaPergunta, setNovaPergunta] = useState('');
  const [novaResposta, setNovaResposta] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);
  const [registrandoCiencia, setRegistrandoCiencia] = useState(false);

  // Referência do scroll da página
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitorar Scroll para barra de leitura
  useEffect(() => {
    const handleScroll = () => {
      const el = containerRef.current || document.documentElement;
      const totalHeight = el.scrollHeight - el.clientHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (el.scrollTop / totalHeight) * 100));
        setScrollProgress(progress);
      }
    };

    const target = isFullscreen && containerRef.current ? containerRef.current : window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [isFullscreen]);

  // Atalhos de teclado (F = Tela Cheia, Esc = Sair) + Fullscreen API
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        toggleFullscreen();
      }
      // Esc é tratado nativamente pela Fullscreen API
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Entra em tela cheia usando o container do componente
      const el = containerRef.current;
      if (el && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          // Fallback CSS se a API falhar
          setIsFullscreen(prev => !prev);
        });
      } else {
        setIsFullscreen(prev => !prev);
      }
    } else {
      document.exitFullscreen().catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Toggle do passo no checklist
  const toggleStep = (ordem: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(ordem)) next.delete(ordem);
      else next.add(ordem);
      return next;
    });
  };

  // Registrar Ciência
  const handleRegistrarCiencia = async () => {
    setRegistrandoCiencia(true);
    try {
      await registrarCienciaIt(it.id, it.versao);
      toast.success(`Ciência registrada com sucesso na versão v${it.versao}!`);
      setData((prev) => ({
        ...prev,
        minhaCiencia: {
          status: 'ciente',
          cienteEm: new Date().toLocaleString('pt-BR'),
        },
      }));
    } catch (err: any) {
      toast.error('Erro ao registrar ciência: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setRegistrandoCiencia(false);
    }
  };

  // Copiar Hash SHA256
  const copyHash = () => {
    if (!it.hashVersao) return;
    navigator.clipboard.writeText(it.hashVersao);
    setCopiedHash(true);
    toast.success('Hash SHA-256 copiado para a área de transferência!');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Salvar Delegação de Férias
  const handleSalvarDelegacao = async () => {
    if (!substitutoId || !substitutoAte) {
      toast.error('Selecione o substituto e a data limite da delegação.');
      return;
    }
    try {
      await delegarGuardiaoTemporario(it.id, substitutoId, substitutoAte);
      const subNome = colegasDepto.find((c) => c.id === substitutoId)?.name;
      toast.success(`Custódia transferida para ${subNome} até ${new Date(substitutoAte).toLocaleDateString('pt-BR')}!`);
      setDelegarModalOpen(false);
      setData((prev) => ({
        ...prev,
        it: {
          ...prev.it,
          substitutoId,
          substitutoNome: subNome,
          substitutoAte,
        },
      }));
    } catch (err: any) {
      toast.error('Erro ao delegar custódia: ' + (err.message || 'Erro desconhecido.'));
    }
  };

  // Adicionar Caso Prático no FAQ
  const handleAdicionarFaq = async () => {
    if (!novaPergunta.trim() || !novaResposta.trim()) {
      toast.error('Preencha a dúvida frequente e a orientação de solução.');
      return;
    }
    try {
      await adicionarFaqExcecao(it.id, novaPergunta, novaResposta);
      toast.success('Caso prático adicionado ao FAQ da IT!');
      setFaqModalOpen(false);
      setData((prev) => ({
        ...prev,
        it: {
          ...prev.it,
          faqExcecoes: [...(prev.it.faqExcecoes || []), { pergunta: novaPergunta, resposta: novaResposta }],
        },
      }));
      setNovaPergunta('');
      setNovaResposta('');
    } catch (err: any) {
      toast.error('Erro ao salvar caso no FAQ: ' + (err.message || 'Erro desconhecido.'));
    }
  };

  // Imprimir Guia de Mesa
  const handlePrint = () => {
    window.print();
  };

  // Cores do Termômetro
  const termometroColor =
    it.diasSemRevisao <= 60
      ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
      : it.diasSemRevisao <= 120
      ? 'text-amber-400 bg-amber-950/40 border-amber-500/30'
      : 'text-rose-400 bg-rose-950/40 border-rose-500/30 animate-pulse';

  const termometroTexto =
    it.diasSemRevisao <= 60
      ? 'Rotina Vigente & Conforme'
      : it.diasSemRevisao <= 120
      ? 'Atenção: Revisão Sugerida'
      : 'Urgente: Revisão Vencida (> 120 dias)';

  // Cálculos de Ciências da Equipe
  const totalEquipe = equipeCiencias.length;
  const cientesCount = equipeCiencias.filter((c) => c.status === 'ciente').length;
  const porcentagemCiencia = totalEquipe > 0 ? Math.round((cientesCount / totalEquipe) * 100) : 100;

  return (
    <div
      ref={containerRef}
      className={`relative min-h-screen text-white transition-all ${
        isFullscreen ? 'fixed inset-0 z-[9999] bg-[#070A12] overflow-y-auto p-4 sm:p-8' : 'p-4 sm:p-6 lg:p-8'
      }`}
    >
      {/* Barra de Progresso Fina no Topo (Leitura) */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-800 z-50">
        <div
          className="h-full bg-emerald-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Barra de Controles Superiores (Zen Bar quando Fullscreen ou Barra Padrão) */}
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
            {it.codigo}
          </span>
          <span className="text-xs text-zinc-400 font-mono">v{it.versao}</span>
          <span className="text-xs text-zinc-600">•</span>
          <span className="text-xs text-zinc-400">{it.departamento}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador Modo A4 vs Checklist */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                viewMode === 'a4'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Modo A4 Oficial
            </button>
            <button
              onClick={() => setViewMode('checklist')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                viewMode === 'checklist'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Checklist de Bancada
            </button>
          </div>

          {/* Alternador de Tema Claro / Escuro da Folha */}
          <button
            onClick={() => setReaderTheme((prev) => (prev === 'paper' ? 'dark' : 'paper'))}
            title={readerTheme === 'paper' ? 'Mudar para Tema Escuro' : 'Mudar para Papel A4 Claro'}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            {readerTheme === 'paper' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Controles de Zoom */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-400 gap-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(85, z - 10))}
              className="hover:text-white px-1 font-mono"
            >
              A-
            </button>
            <span className="text-[10px] text-zinc-500 font-mono">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="hover:text-white px-1 font-mono"
            >
              A+
            </button>
          </div>

          {/* Imprimir Guia de Mesa */}
          <button
            onClick={handlePrint}
            title="Imprimir Guia Rápido de Mesa"
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Botão Tela Cheia */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white gap-1.5"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" /> Sair (Esc)
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" /> Tela Cheia (F)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Card do Guardião e Status de Vigência */}
      <div className="max-w-4xl mx-auto mb-6 bg-[#121212] border border-zinc-800 rounded-2xl p-5 shadow-lg print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              {it.guardiaoNome ? it.guardiaoNome.slice(0, 2).toUpperCase() : '7R'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Guardião Oficial:
                </span>
                <span className="text-sm font-bold text-white">{it.guardiaoNome}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isGuardiao
                  ? 'Você é o responsável direto pela excelência e atualização contínua desta IT.'
                  : `Colaborador responsável pela custódia desta rotina no 7º RI SP.`}
              </p>
              {it.substitutoNome && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5" /> Substituto em exercício: {it.substitutoNome} até{' '}
                  {it.substitutoAte ? new Date(it.substitutoAte).toLocaleDateString('pt-BR') : 'período de férias'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
            {/* Termômetro de Revisão */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${termometroColor}`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{it.diasSemRevisao}d sem revisão</span>
              <span className="text-[10px] opacity-75">({termometroTexto})</span>
            </span>

            {/* Ações do Guardião */}
            {isGuardiao && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDelegarModalOpen(true)}
                  className="text-xs border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Modo Férias
                </Button>

                <Button
                  size="sm"
                  onClick={() => setUploaderOpen((prev) => !prev)}
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-md shadow-emerald-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Propor Nova Versão
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Barra de Ciência Operacional da Equipe do Departamento */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Ciência da Equipe ({it.departamento}):</span>
            <span className="font-bold text-emerald-400">{porcentagemCiencia}% cientes</span>
            <span className="text-zinc-500">
              ({cientesCount} de {totalEquipe} colaboradores)
            </span>
          </div>

          <div className="w-full sm:w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${porcentagemCiencia}%` }}
            />
          </div>
        </div>
      </div>

      {/* Uploader Universal Expansível */}
      {uploaderOpen && (
        <div className="max-w-4xl mx-auto mb-6">
          <UniversalITUploader
            onCancel={() => setUploaderOpen(false)}
            onParseSuccess={(res) => {
              setUploaderOpen(false);
              setParsedDataForDiff(res);
              setDiffModalOpen(true);
            }}
          />
        </div>
      )}

      {/* CANVAS A4 ANTI-FADIGA (DOCUMENTO PRINCIPAL) */}
      <div
        style={{ fontSize: `${zoomLevel}%` }}
        className={`max-w-4xl mx-auto rounded-2xl p-8 sm:p-12 shadow-2xl transition-colors ${
          readerTheme === 'paper'
            ? 'bg-[#FAF9F6] text-[#0F172A] border border-slate-200/90 shadow-black/40'
            : 'bg-[#18181B] text-[#E4E4E7] border border-zinc-800 shadow-black/60'
        }`}
      >
        {/* BANNER AMARELO DE AUDITORIA NOTARIAL */}
        <div className="rounded-xl border border-[#F59E0B]/50 bg-[#FEF3C7] text-[#92400E] p-4 mb-8 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  Nota de Auditoria & Conformidade Regulatória (7º RI SP)
                </p>
                <p className="text-xs mt-0.5 leading-relaxed text-[#78350F]">
                  Este documento representa o registro oficial das rotinas operacionais da serventia. Alterações
                  geram nova versão com log imutável WORM nos termos do CNJ.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-[11px] text-[#92400E]">
                  <span className="font-bold">Hash SHA-256:</span>
                  <span className="bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 select-all truncate max-w-xs sm:max-w-md">
                    {it.hashVersao || 'Não gerado'}
                  </span>
                  <button
                    onClick={copyHash}
                    title="Copiar Hash"
                    className="hover:text-amber-950 p-0.5 rounded transition-colors"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <span>•</span>
                  <span>Versão Oficial: v{it.versao}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TÍTULO E CABEÇALHO DO DOCUMENTO JURÍDICO */}
        <div className="border-b pb-6 mb-8 border-slate-300 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            <span>7º Registro de Imóveis da Comarca de São Paulo</span>
            <span>Norma Interna Operacional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-slate-900 dark:text-white">
            {it.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-zinc-400">
            <span>
              <strong>Código:</strong> {it.codigo}
            </span>
            <span>•</span>
            <span>
              <strong>Setor Responsável:</strong> {it.departamento}
            </span>
            <span>•</span>
            <span>
              <strong>Tempo de Leitura:</strong> ~{it.tempoLeituraMin} min
            </span>
            <span>•</span>
            <span>
              <strong>Vigência:</strong> {new Date(it.vigencia).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {/* CONTEÚDO DA IT */}
        {viewMode === 'a4' ? (
          /* MODO A4 OFICIAL */
          <div className="space-y-8 text-sm leading-relaxed">
            {/* 1. Objetivo */}
            <section>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Objetivo do Procedimento
              </h2>
              <p className="pl-8 text-slate-700 dark:text-zinc-300 leading-relaxed bg-slate-100/50 dark:bg-zinc-900/40 p-3 rounded-lg border border-slate-200/60 dark:border-zinc-800">
                {it.objetivo || 'Padronizar a rotina operacional para garantir celeridade e segurança jurídica.'}
              </p>
            </section>

            {/* 2. Quando Usar / Gatilho */}
            <section>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Quando Usar / Gatilho Operacional
              </h2>
              <p className="pl-8 text-slate-700 dark:text-zinc-300 leading-relaxed">
                {it.quandoUsar || 'Aplicável em todos os atendimentos e exames de títulos deste departamento.'}
              </p>
            </section>

            {/* 3. Passo a Passo Procedimental */}
            <section>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Passo a Passo de Execução
              </h2>
              <div className="pl-8 space-y-3">
                {(it.passoAPasso || []).map((passo, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-sm"
                  >
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                      {passo.ordem}. {passo.titulo}
                    </h3>
                    <p className="text-slate-600 dark:text-zinc-300 text-xs leading-relaxed">{passo.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Checklist Obrigatório */}
            {it.checklist && it.checklist.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-xs flex items-center justify-center font-bold">
                    4
                  </span>
                  Checklist de Conformidade
                </h2>
                <ul className="pl-8 list-disc list-inside space-y-1.5 text-slate-700 dark:text-zinc-300 text-xs">
                  {it.checklist.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 5. Alertas & Erros Comuns */}
            {it.errosComuns && it.errosComuns.length > 0 && (
              <section>
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 p-4 text-xs text-rose-900 dark:text-rose-300">
                  <h3 className="font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4" /> Alertas & Pontos de Atenção (Evitar Devoluções):
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {it.errosComuns.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        ) : (
          /* MODO CHECKLIST DE BANCADA INTERATIVO */
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between mb-4">
              <span>
                Marque os itens conforme for executando o exame registral para garantir conformidade 100%.
              </span>
              <span className="font-bold font-mono">
                {checkedSteps.size} de {it.passoAPasso?.length || 0} concluídos
              </span>
            </div>

            {(it.passoAPasso || []).map((passo) => {
              const isChecked = checkedSteps.has(passo.ordem);
              return (
                <div
                  key={passo.ordem}
                  onClick={() => toggleStep(passo.ordem)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                    isChecked
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 text-slate-800 dark:text-emerald-100 shadow-sm'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isChecked
                        ? 'bg-emerald-500 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-zinc-700 bg-transparent'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <h3
                      className={`font-bold text-sm mb-1 ${
                        isChecked
                          ? 'line-through text-slate-500 dark:text-emerald-400/80'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {passo.ordem}. {passo.titulo}
                    </h3>
                    <p
                      className={`text-xs leading-relaxed ${
                        isChecked ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {passo.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SEÇÃO FAQ DE CASOS PRÁTICOS & EXCEÇÕES DE BALCÃO */}
        <div className="mt-12 pt-8 border-t border-slate-300 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Casos Práticos & Exceções de Balcão ("O que fazer se...?")
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Memória viva das dúvidas do setor resolvidas pela equipe e pelo Oficial Substituto.
              </p>
            </div>
            {isGuardiao && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFaqModalOpen(true)}
                className="text-xs border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-black dark:hover:text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Caso
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {(it.faqExcecoes || []).map((faq, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-xs"
              >
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">❓ {faq.pergunta}</h4>
                <p className="text-slate-700 dark:text-zinc-300 leading-relaxed pl-4 border-l-2 border-emerald-500">
                  {faq.resposta}
                </p>
              </div>
            ))}
            {(!it.faqExcecoes || it.faqExcecoes.length === 0) && (
              <p className="text-xs text-slate-500 italic">Nenhum caso atípico cadastrado ainda para este setor.</p>
            )}
          </div>
        </div>

        {/* RODAPÉ DO DOCUMENTO COM CIÊNCIA OPERACIONAL */}
        <div className="mt-12 pt-6 border-t border-slate-300 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Última atualização: {new Date(it.updatedAt).toLocaleString('pt-BR')} • Custódia WORM 7º RI SP
          </div>

          {minhaCiencia.status === 'ciente' ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-600">
              <UserCheck className="w-4 h-4" />
              <span>Ciência Confirmada em {minhaCiencia.cienteEm || 'Data recente'}</span>
            </div>
          ) : (
            <Button
              onClick={handleRegistrarCiencia}
              disabled={registrandoCiencia}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 animate-bounce"
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              {registrandoCiencia ? 'Registrando...' : `✓ Li e Estou Ciente da v${it.versao}`}
            </Button>
          )}
        </div>
      </div>

      {/* MODAL PASSAR BASTÃO (FÉRIAS) */}
      {delegarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold mb-1">Passagem de Bastão (Modo Férias)</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Transfira a custódia desta IT temporariamente para um colega durante seu afastamento.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Colega Substituto:</label>
                <select
                  value={substitutoId}
                  onChange={(e) => setSubstitutoId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                >
                  <option value="">Selecione o substituto...</option>
                  {colegasDepto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.cargo || 'Escrevente'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Válido até:</label>
                <input
                  type="date"
                  value={substitutoAte}
                  onChange={(e) => setSubstitutoAte(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDelegarModalOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSalvarDelegacao} className="bg-emerald-500 text-black font-bold">
                  Confirmar Delegação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR FAQ CASO PRÁTICO */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold mb-1">Adicionar Caso Prático / Dúvida de Balcão</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Registre a conduta padrão adotada pelo 7º RI SP para uma exceção frequente.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Dúvida / Hipótese de Exceção:</label>
                <input
                  type="text"
                  value={novaPergunta}
                  onChange={(e) => setNovaPergunta(e.target.value)}
                  placeholder="Ex: E se o apresentante trouxer procuração emitida no exterior?"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Conduta / Solução Oficial:</label>
                <textarea
                  value={novaResposta}
                  onChange={(e) => setNovaResposta(e.target.value)}
                  placeholder="Ex: Exigir Apostilamento de Haia e tradução juramentada por tradutor público juramentado..."
                  className="w-full h-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setFaqModalOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAdicionarFaq} className="bg-emerald-500 text-black font-bold">
                  Salvar no FAQ
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DIFF DE VERSÕES */}
      {diffModalOpen && parsedDataForDiff && (
        <ItDiffModal
          itId={it.id}
          codigo={it.codigo}
          titulo={it.titulo}
          versaoAtual={it.versao}
          novaVersaoSugerida={`1.${parseInt(it.versao.split('.')[1] || '0') + 1}`}
          dadosAtuais={{
            objetivo: it.objetivo,
            quandoUsar: it.quandoUsar,
            procedimento: it.passoAPasso,
            checklist: it.checklist,
          }}
          novosDados={parsedDataForDiff.itensExtraidos}
          hashArquivoOriginal={parsedDataForDiff.hashSha256}
          onClose={() => setDiffModalOpen(false)}
          onSuccess={(novaVersao) => {
            setDiffModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
