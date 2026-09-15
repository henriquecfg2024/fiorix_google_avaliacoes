'use client';



import React, { useState, useEffect, useTransition, useId, useRef } from 'react';

import { useRouter } from 'next/navigation';

import {

  CheckCircle2,

  Upload,

  Copy,

  Check,

  FileText,

  Clock,

  ChevronDown,

  X,

  AlertCircle,

  ExternalLink,

  Shield,

  Layers,

  ArrowUpRight,
  Eye,
  Plus,
  XCircle,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  ArrowLeftRight,
  Search,
  BadgeCheck,
  Bell,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';

import { MinhaItPageData, MinhaItCustodiaItem, ItEnviadaColaborador, publicarNovaVersaoIT, submeterItColaborador } from '@/app/actions/minha-it';

import { getITUploadSignedUrl, cancelarEnvioIt, excluirRascunhoIt, getParticipantesIt, adicionarParticipanteIt, removerParticipanteIt, transferirResponsabilidadeIt, buscarColaboradoresParaVincular, ItParticipante, PapelNaIt, criarPropostaAtualizacao, getPropostasIt, responderPropostaAtualizacao, cancelarProposta, ItProposta, getNotificacoesUsuario, marcarNotificacaoLida, marcarTodasNotificacoesLidas, FiorixNotificacao } from '@/app/actions/its';

import { AlertaResponsavelTecnico } from './AlertaResponsavelTecnico';
import { CienciasDrawer } from './CienciasDrawer';
import { GerenciarResponsaveisModal } from './GerenciarResponsaveisModal';

function formatTituloPrincipal(titulo?: string): string {
  if (!titulo) return '';
  return titulo
    .replace(/\s*•\s*[A-Z0-9_\-]+\s*(v\d+(\.\d+)?)?/gi, '')
    .replace(/\s*•\s*v?\d+(\.\d+)?/gi, '')
    .trim();
}

interface MinhaItCleanClientProps {

  initialData: MinhaItPageData;

}



export function MinhaItCleanClient({ initialData }: MinhaItCleanClientProps) {

  const [mounted, setMounted] = useState(false);

  const router = useRouter();

  const [isPending, startTransition] = useTransition();



  useEffect(() => {

    setMounted(true);

  }, []);



  const { hasCustodia, currentUser, cartorioNome, cartorioUnidade, itsCustodia, currentIt, isSupervisao, responsavelRealNome, itsByParticipation } = initialData;

  // Papel do usuário na IT selecionada (via participants)
  const [gerenciarItId, setGerenciarItId] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<ItParticipante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [buscaParticipante, setBuscaParticipante] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Array<{ id: string; nome: string; email: string; departamento: string; cargo: string; mesmoSetor: boolean }>>([]);
  const [buscandoUser, setBuscandoUser] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);
  const [gerenciarError, setGerenciarError] = useState('');
  const [gerenciarSuccess, setGerenciarSuccess] = useState('');
  const [transferirModal, setTransferirModal] = useState(false);
  const [transferirParaId, setTransferirParaId] = useState('');
  const [transferirMotivo, setTransferirMotivo] = useState('');
  const [transferirManter, setTransferirManter] = useState(true);

  async function abrirGerenciarModal(itId: string) {
    setGerenciarItId(itId);
    setGerenciarError('');
    setGerenciarSuccess('');
    setBuscaParticipante('');
    setResultadosBusca([]);
    setLoadingParticipantes(true);
    const res = await getParticipantesIt(itId);
    setParticipantes(res.participantes || []);
    setLoadingParticipantes(false);
  }

  async function handleBuscarUser(itId: string) {
    if (!buscaParticipante.trim()) return;
    setBuscandoUser(true);
    const res = await buscarColaboradoresParaVincular(itId, buscaParticipante);
    setResultadosBusca(res.usuarios || []);
    setBuscandoUser(false);
  }

  async function handleAdicionarParticipante(itId: string, usuarioId: string, papel: PapelNaIt) {
    setAdicionandoId(usuarioId);
    setGerenciarError('');
    const res = await adicionarParticipanteIt({ itId, usuarioId, papel });
    if (res.success) {
      setGerenciarSuccess('Participante adicionado com sucesso.');
      setResultadosBusca([]);
      setBuscaParticipante('');
      const reload = await getParticipantesIt(itId);
      setParticipantes(reload.participantes || []);
    } else {
      setGerenciarError(res.error || 'Erro ao adicionar.');
    }
    setAdicionandoId(null);
  }

  async function handleRemoverParticipante(itId: string, usuarioId: string, nome: string) {
    const motivo = prompt(`Motivo para remover ${nome} desta IT (obrigatório):`);
    if (!motivo?.trim()) return;
    setGerenciarError('');
    const res = await removerParticipanteIt(itId, usuarioId, motivo);
    if (res.success) {
      setGerenciarSuccess('Participante removido.');
      const reload = await getParticipantesIt(itId);
      setParticipantes(reload.participantes || []);
    } else {
      setGerenciarError(res.error || 'Erro ao remover.');
    }
  }

  async function handleTransferirResponsabilidade(itId: string) {
    if (!transferirParaId || !transferirMotivo.trim()) {
      setGerenciarError('Selecione o novo responsável e informe o motivo.');
      return;
    }
    const res = await transferirResponsabilidadeIt({ itId, novoResponsavelId: transferirParaId, motivo: transferirMotivo, manterComoCorresponsavel: transferirManter });
    if (res.success) {
      setTransferirModal(false);
      setGerenciarSuccess('Responsabilidade transferida com sucesso.');
      const reload = await getParticipantesIt(itId);
      setParticipantes(reload.participantes || []);
      router.refresh();
    } else {
      setGerenciarError(res.error || 'Erro ao transferir.');
    }
  }

  // ── FASE 3: Propostas de atualização ──────────────────────────
  const [propostaModal, setPropostaModal] = useState(false);
  const [propostaItId, setPropostaItId] = useState<string | null>(null);
  const [propostaMotivo, setPropostaMotivo] = useState('');
  const [propostaResumo, setPropostaResumo] = useState('');
  const [propostaObs, setPropostaObs] = useState('');
  const [propostaEnviando, setPropostaEnviando] = useState(false);
  const [propostaError, setPropostaError] = useState('');
  const [propostaSuccess, setPropostaSuccess] = useState('');

  const [listaPropostas, setListaPropostas] = useState<ItProposta[]>([]);
  const [propostasLoading, setPropostasLoading] = useState(false);
  const [propostaRespondendoId, setPropostaRespondendoId] = useState<string | null>(null);
  const [propostaResposta, setPropostaResposta] = useState('');
  const [propostaRespostaError, setPropostaRespostaError] = useState('');

  async function abrirPropostaModal(itId: string) {
    setPropostaItId(itId);
    setPropostaMotivo('');
    setPropostaResumo('');
    setPropostaObs('');
    setPropostaError('');
    setPropostaSuccess('');
    setPropostaModal(true);
  }

  async function handleEnviarProposta() {
    if (!propostaItId) return;
    setPropostaEnviando(true);
    setPropostaError('');
    const res = await criarPropostaAtualizacao({ itId: propostaItId, motivo: propostaMotivo, resumo: propostaResumo, observacoes: propostaObs });
    if (res.success) {
      setPropostaSuccess('Proposta enviada ao responsável principal!');
      setPropostaMotivo(''); setPropostaResumo(''); setPropostaObs('');
      setTimeout(() => setPropostaModal(false), 1800);
    } else {
      setPropostaError(res.error || 'Erro ao enviar proposta.');
    }
    setPropostaEnviando(false);
  }

  async function carregarPropostas(itId: string) {
    setPropostasLoading(true);
    const res = await getPropostasIt(itId);
    setListaPropostas(res.propostas || []);
    setPropostasLoading(false);
  }

  async function handleResponderProposta(propostaId: string, acao: 'aceita' | 'recusada' | 'esclarecimento') {
    if (!propostaResposta.trim()) { setPropostaRespostaError('A resposta é obrigatória.'); return; }
    const res = await responderPropostaAtualizacao({ propostaId, acao, resposta: propostaResposta });
    if (res.success) {
      setPropostaRespondendoId(null);
      setPropostaResposta('');
      setPropostaRespostaError('');
      if (currentIt) await carregarPropostas(currentIt.id);
    } else {
      setPropostaRespostaError(res.error || 'Erro ao responder.');
    }
  }

  // ── FASE 4: Notificações ──────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<FiorixNotificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  async function carregarNotificacoes() {
    setNotifLoading(true);
    const res = await getNotificacoesUsuario();
    setNotificacoes(res.notificacoes || []);
    setNaoLidas(res.naoLidas || 0);
    setNotifLoading(false);
  }

  async function handleMarcarLida(id: string) {
    await marcarNotificacaoLida(id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setNaoLidas(prev => Math.max(0, prev - 1));
  }

  async function handleMarcarTodasLidas() {
    await marcarTodasNotificacoesLidas();
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    setNaoLidas(0);
  }

  // Carregar notificações na montagem
  useEffect(() => { carregarNotificacoes(); }, []);

  const [copiedHash, setCopiedHash] = useState(false);



  // Modal de Upload de Nova Versão

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [fileHash, setFileHash] = useState<string>('');

  const [resumoMudancas, setResumoMudancas] = useState('');

  const [confirmouRevisao, setConfirmouRevisao] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const [uploadError, setUploadError] = useState('');

  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Título da IT na nova versão (Renomeação controlada)
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoTituloError, setNovoTituloError] = useState('');

  useEffect(() => {
    if (isModalOpen && currentIt?.titulo) {
      setNovoTitulo(formatTituloPrincipal(currentIt.titulo));
      setNovoTituloError('');
    }
  }, [isModalOpen, currentIt?.titulo]);

  // Modal de Cadastro de IT pelo Colaborador
  const [isCadastroOpen, setIsCadastroOpen] = useState(false);
  const [cadastroTitulo, setCadastroTitulo] = useState('');
  const [cadastroObjetivo, setCadastroObjetivo] = useState('');
  const [cadastroFile, setCadastroFile] = useState<File | null>(null);
  const [cadastroError, setCadastroError] = useState('');
  const [cadastroSubmitting, setCadastroSubmitting] = useState(false);
  const [cadastroSuccess, setCadastroSuccess] = useState(false);

  // Drawer Lateral de Ciências da Equipe
  const [cienciasDrawerOpen, setCienciasDrawerOpen] = useState(false);
  const cienciasButtonRef = useRef<HTMLButtonElement | null>(null);

  // Permissão para gerenciar responsáveis
  const isGestao = ['ADMIN', 'MASTER'].includes(currentUser.role);
  const papelItemCustodia = itsCustodia.find(i => i.id === currentIt?.id)?.papelNaIt;
  const isRespPrincipal = papelItemCustodia === 'RESPONSAVEL_PRINCIPAL' || (!isSupervisao && hasCustodia);
  const podeGerenciar = (isGestao || isRespPrincipal) && Boolean(currentIt);
  const papelLabel = papelItemCustodia === 'RESPONSAVEL_PRINCIPAL'
    ? 'Responsável técnico'
    : papelItemCustodia === 'CORRESPONSAVEL'
    ? 'Corresponsável'
    : papelItemCustodia === 'LEITOR'
    ? 'Colaborador'
    : hasCustodia
    ? 'Responsável técnico'
    : isSupervisao
    ? 'Supervisão'
    : 'Colaborador';

  // Estado do Alerta Amarelo de Responsabilidade Técnica (sempre visível ao entrar em Minha IT)

  const [alertaVisible, setAlertaVisible] = useState(true);



  useEffect(() => {

    // Garante que o alerta abra sempre que o colaborador entrar em Minha IT ou trocar de IT

    setAlertaVisible(true);



    const handleReopen = () => setAlertaVisible(true);

    window.addEventListener('fiorix-minha-it-open', handleReopen);

    return () => window.removeEventListener('fiorix-minha-it-open', handleReopen);

  }, [currentIt?.codigo]);



  if (!mounted) {

    return (

      <div className="min-h-screen bg-[#070A12] text-white p-6 sm:p-8">

        <div className="mx-auto max-w-[1600px] space-y-6">

          <div className="h-8 w-64 rounded-xl bg-white/5 animate-pulse" />

          <div className="h-96 rounded-[28px] border border-white/8 bg-[#0B1020]/72 animate-pulse" />

          <div className="h-64 rounded-[28px] border border-white/8 bg-[#0B1020]/72 animate-pulse" />

        </div>

      </div>

    );

  }



  // Helper para copiar Hash

  function handleCopyHash() {

    if (!currentIt?.hashVersao) return;

    navigator.clipboard.writeText(currentIt.hashVersao);

    setCopiedHash(true);

    setTimeout(() => setCopiedHash(false), 2000);

  }



  // Troca de IT via dropdown

  function handleSelectIt(codigo: string) {

    startTransition(() => {

      router.push(`/minha-it?codigo=${codigo}`);

    });

  }



  // Cálculo de SHA-256 no browser

  async function computeSHA256(file: File): Promise<string> {

    const buffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  }



  // Manipulação de seleção de arquivo

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];

    if (!file) return;



    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {

      setUploadError('Por favor, selecione um arquivo no formato PDF.');

      return;

    }



    setUploadError('');

    setSelectedFile(file);

    try {

      const hash = await computeSHA256(file);

      setFileHash(hash);

    } catch {

      setUploadError('Erro ao calcular Hash SHA-256 do arquivo.');

    }

  }



  // Próxima versão calculada (1.0 -> 1.1)

  const currentVersaoNum = parseFloat(currentIt?.versao || '1.0');

  const nextVersao = (isNaN(currentVersaoNum) ? 1.0 : currentVersaoNum + 0.1).toFixed(1);



  // Envio de nova versão

  async function handlePublishVersion() {

    if (!selectedFile || !currentIt) {

      setUploadError('Selecione o arquivo PDF da nova versão.');

      return;

    }



    if (!confirmouRevisao) {

      setUploadError('Você deve confirmar que revisou e é o responsável técnico por esta versão.');

      return;

    }

    const tituloLimpo = novoTitulo.trim();
    if (!tituloLimpo) {
      setNovoTituloError('O título da Instrução de Trabalho é obrigatório.');
      setUploadError('Informe o título da Instrução de Trabalho.');
      return;
    }
    if (tituloLimpo.length > 120) {
      setNovoTituloError('O título deve conter no máximo 120 caracteres.');
      setUploadError('O título não pode exceder 120 caracteres.');
      return;
    }
    setNovoTituloError('');

    setIsUploading(true);

    setUploadError('');



    try {

      const formData = new FormData();

      formData.append('file', selectedFile);

      formData.append('itId', currentIt.id);

      formData.append('codigo', currentIt.codigo);

      formData.append('novaVersao', nextVersao);

      formData.append('hashSha256', fileHash || currentIt.hashVersao);

      formData.append('resumoMudancas', resumoMudancas);

      formData.append('titulo', tituloLimpo.toUpperCase());



      const res = await fetch('/api/its/upload', {

        method: 'POST',

        body: formData,

      });



      const data = await res.json();

      if (!res.ok || !data.success) {

        throw new Error(data.error || 'Falha ao processar publicação da nova versão.');

      }



      setUploadSuccess(true);

      setTimeout(() => {

        setIsModalOpen(false);

        setSelectedFile(null);

        setFileHash('');

        setResumoMudancas('');

        setConfirmouRevisao(false);

        setUploadSuccess(false);

        router.refresh();

      }, 1500);

    } catch (err: any) {

      console.error('Erro na publicação:', err);

      setUploadError(err?.message || 'Erro inesperado durante a publicação.');

    } finally {

      setIsUploading(false);

    }

  }



  // Handlers do Cadastro pelo Colaborador
  async function handleCadastroFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) { setCadastroError('O arquivo está vazio ou corrompido.'); return; }
    if (file.size > 20 * 1024 * 1024) { setCadastroError('O arquivo excede 20MB.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setCadastroError('Apenas arquivos no formato PDF são aceitos.'); return;
    }
    setCadastroError('');
    setCadastroFile(file);
  }

  async function handleCadastroSubmit() {
    if (!cadastroTitulo.trim()) { setCadastroError('Informe o título da IT.'); return; }
    if (!cadastroFile) { setCadastroError('Selecione o arquivo PDF.'); return; }
    setCadastroSubmitting(true);
    setCadastroError('');
    try {
      const fd = new FormData();
      fd.append('file', cadastroFile);
      fd.append('codigo', 'COL-NOVO');
      const uploadRes = await fetch('/api/its/upload-pdf', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) throw new Error(uploadData.error || 'Falha no upload do PDF.');
      const result = await submeterItColaborador({
        titulo: cadastroTitulo.trim(),
        objetivo: cadastroObjetivo.trim(),
        pdfPath: uploadData.storagePath,
        pdfUrl: uploadData.publicUrl,
      });
      if (!result.success) throw new Error(result.error || 'Erro ao submeter a IT.');
      setCadastroSuccess(true);
      setTimeout(() => {
        setIsCadastroOpen(false); setCadastroSuccess(false); setCadastroTitulo('');
        setCadastroObjetivo(''); setCadastroFile(null); router.refresh();
      }, 2000);
    } catch (err: any) {
      setCadastroError(err?.message || 'Erro inesperado.');
    } finally {
      setCadastroSubmitting(false);
    }
  }

  const colaboradorItEnviada = initialData.colaboradorItEnviada ?? null;
  const isColaborador = currentUser.role === 'COLABORADOR';

  const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    rascunho: { label: 'Rascunho', color: 'text-slate-300', bg: 'bg-slate-500/20 border-slate-500/30' },
    enviada_para_analise: { label: 'Enviada para análise', color: 'text-indigo-300', bg: 'bg-indigo-500/20 border-indigo-500/30' },
    correcao_solicitada: { label: 'Correção solicitada', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30' },
    aprovada: { label: 'Aprovada', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30' },
    publicada: { label: 'Publicada', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30' },
    rejeitada: { label: 'Rejeitada', color: 'text-red-300', bg: 'bg-red-500/20 border-red-500/30' },
  };

  // Estado Vazio: usuário sem nenhuma IT atribuída
  if (!hasCustodia || !currentIt) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-[900px] px-4 pt-6 pb-12">
          <div className="mb-6">
            <p className="text-xs font-bold tracking-widest text-teal-400 uppercase mb-1">MEU ESPAÇO</p>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Minha Instrução de Trabalho</h1>
                <p className="text-sm text-slate-400 mt-0.5">Cadastre e acompanhe a IT sob sua responsabilidade.</p>
              </div>
              <div className="flex items-center gap-3">
                {isColaborador && (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 rounded-full">
                    Perfil: COLABORADOR
                  </span>
                )}
                {/* Sino de notificações */}
                <button onClick={() => { setNotifOpen(true); carregarNotificacoes(); }}
                  className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                  <Bell className="w-5 h-5" />
                  {naoLidas > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          {colaboradorItEnviada ? (
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/70 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Instrução de Trabalho</p>
                  <h2 className="text-lg font-bold text-white">{colaboradorItEnviada.titulo}</h2>
                  {colaboradorItEnviada.codigo && (
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{colaboradorItEnviada.codigo} • versão {colaboradorItEnviada.versao}</p>
                  )}
                </div>
                {(() => {
                  const s = statusLabel[colaboradorItEnviada.status] || { label: colaboradorItEnviada.status, color: 'text-slate-300', bg: 'bg-slate-500/20 border-slate-500/30' };
                  return <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${s.bg} ${s.color}`}>{s.label}</span>;
                })()}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/4 rounded-xl p-3"><p className="text-slate-500 mb-0.5">Setor</p><p className="text-slate-200 font-medium">{colaboradorItEnviada.departamento}</p></div>
                <div className="bg-white/4 rounded-xl p-3"><p className="text-slate-500 mb-0.5">Versão</p><p className="text-slate-200 font-medium">{colaboradorItEnviada.versao}</p></div>
                <div className="bg-white/4 rounded-xl p-3"><p className="text-slate-500 mb-0.5">Enviado em</p><p className="text-slate-200 font-medium">{colaboradorItEnviada.dataEnvio}</p></div>
                {colaboradorItEnviada.pdfNome && (
                  <div className="bg-white/4 rounded-xl p-3"><p className="text-slate-500 mb-0.5">Arquivo</p><p className="text-slate-200 font-medium truncate">{colaboradorItEnviada.pdfNome}</p></div>
                )}
              </div>
              {colaboradorItEnviada.status === 'correcao_solicitada' && colaboradorItEnviada.motivoCorrecao && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
                  <p className="text-xs font-bold text-amber-300 mb-1">Motivo da devolução</p>
                  <p className="text-sm text-amber-200/80">{colaboradorItEnviada.motivoCorrecao}</p>
                  {colaboradorItEnviada.responsavelAnalise && (
                    <p className="text-xs text-amber-300/60 mt-2">Por: {colaboradorItEnviada.responsavelAnalise} • {colaboradorItEnviada.dataAnalise}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                {colaboradorItEnviada.pdfUrl && (
                  <a href={colaboradorItEnviada.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Visualizar PDF
                  </a>
                )}
                {colaboradorItEnviada.status === 'correcao_solicitada' && (
                  <button onClick={() => setIsCadastroOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors">
                    Corrigir e reenviar
                  </button>
                )}
                {colaboradorItEnviada.status === 'enviada_para_analise' && (
                  <>
                    <p className="text-xs text-slate-400 italic">Aguardando análise do responsável...</p>
                    <button
                      onClick={async () => {
                        if (!confirm('Cancelar o envio? A IT voltará ao estado de rascunho.')) return;
                        const res = await cancelarEnvioIt(colaboradorItEnviada.id);
                        if (res.success) { router.refresh(); }
                        else { alert(res.error || 'Erro ao cancelar.'); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-red-500/15 hover:border-red-500/30 text-slate-400 hover:text-red-300 text-xs font-semibold transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancelar envio
                    </button>
                  </>
                )}
                {(['rascunho', 'correcao_solicitada', 'rejeitada'] as string[]).includes(colaboradorItEnviada.status) && (
                  <button
                    onClick={async () => {
                      const motivo = prompt('Motivo da exclusão (obrigatório):');
                      if (!motivo?.trim()) return;
                      if (!confirm(`Excluir "${colaboradorItEnviada.titulo}"? Esta ação não pode ser desfeita.`)) return;
                      const res = await excluirRascunhoIt(colaboradorItEnviada.id, motivo);
                      if (res.success) { router.refresh(); }
                      else { alert(res.error || 'Erro ao excluir.'); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/8 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                <FileText className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Você ainda não cadastrou sua Instrução de Trabalho</h2>
              <p className="text-sm text-slate-400 mb-7 max-w-sm leading-relaxed">
                Envie o documento em PDF para análise e aprovação do responsável pelo seu setor.
              </p>
              {isColaborador && (
                <button onClick={() => setIsCadastroOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-900/40 mb-8">
                  <Plus className="w-4 h-4" /> Cadastrar minha IT
                </button>
              )}
              <div className="flex items-center gap-1 sm:gap-3 text-xs text-slate-500 flex-wrap justify-center">
                <div className="flex items-center gap-1.5 border border-white/8 bg-white/3 px-3 py-2 rounded-lg">
                  <span className="w-4 h-4 rounded-full bg-indigo-600/50 text-indigo-300 text-[10px] flex items-center justify-center font-bold">1</span>
                  Preencha os dados
                </div>
                <span className="text-slate-700">→</span>
                <div className="flex items-center gap-1.5 border border-white/8 bg-white/3 px-3 py-2 rounded-lg">
                  <span className="w-4 h-4 rounded-full bg-indigo-600/50 text-indigo-300 text-[10px] flex items-center justify-center font-bold">2</span>
                  Envie o PDF
                </div>
                <span className="text-slate-700">→</span>
                <div className="flex items-center gap-1.5 border border-white/8 bg-white/3 px-3 py-2 rounded-lg">
                  <span className="w-4 h-4 rounded-full bg-indigo-600/50 text-indigo-300 text-[10px] flex items-center justify-center font-bold">3</span>
                  Acompanhe a análise
                </div>
              </div>
            </div>
          )}

          {/* Participação em outras ITs (CORRESPONSAVEL / LEITOR) */}
          {itsByParticipation && itsByParticipation.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Participação em outras ITs</p>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 divide-y divide-white/6">
                {itsByParticipation.map((it) => {
                  const papelConfig = {
                    CORRESPONSAVEL: { label: 'Corresponsável', color: 'text-violet-300', bg: 'bg-violet-500/15 border-violet-500/30' },
                    LEITOR: { label: 'Leitura', color: 'text-slate-300', bg: 'bg-slate-500/15 border-slate-500/30' },
                    RESPONSAVEL_PRINCIPAL: { label: 'Responsável', color: 'text-indigo-300', bg: 'bg-indigo-500/15 border-indigo-500/30' },
                  }[it.papelNaIt || 'LEITOR'] || { label: 'Participante', color: 'text-slate-300', bg: 'bg-slate-500/15 border-slate-500/30' };
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{it.titulo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{it.codigo} • versão {it.versao}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${papelConfig.bg} ${papelConfig.color}`}>
                        {papelConfig.label}
                      </span>
                      {it.papelNaIt === 'CORRESPONSAVEL' && (
                        <button
                          onClick={() => abrirPropostaModal(it.id)}
                          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                          title="Propor atualização"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => abrirGerenciarModal(it.id)}
                        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                        title="Gerenciar responsáveis"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal — Propor Atualização */}
        {propostaModal && propostaItId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !propostaEnviando && setPropostaModal(false)} />
            <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Propor atualização</h3>
                    <p className="text-xs text-slate-400">Sua sugestão será enviada ao responsável principal</p>
                  </div>
                </div>
                <button onClick={() => !propostaEnviando && setPropostaModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {propostaError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{propostaError}</div>}
                {propostaSuccess && <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">{propostaSuccess}</div>}
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Motivo da alteração *</label>
                  <input type="text" placeholder="Ex.: Processo desatualizado após nova norma"
                    value={propostaMotivo} onChange={e => setPropostaMotivo(e.target.value)} disabled={propostaEnviando}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition-all disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Resumo da sugestão *</label>
                  <textarea placeholder="Descreva o que deve ser alterado e como..." rows={4}
                    value={propostaResumo} onChange={e => setPropostaResumo(e.target.value)} disabled={propostaEnviando}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition-all resize-none disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Observações (opcional)</label>
                  <textarea placeholder="Informações adicionais..." rows={2}
                    value={propostaObs} onChange={e => setPropostaObs(e.target.value)} disabled={propostaEnviando}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition-all resize-none disabled:opacity-50" />
                </div>
                <button onClick={handleEnviarProposta} disabled={propostaEnviando || !propostaMotivo.trim() || !propostaResumo.trim()}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  {propostaEnviando ? 'Enviando...' : 'Enviar proposta'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Painel de Notificações */}
        {notifOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16">
            <div className="absolute inset-0" onClick={() => setNotifOpen(false)} />
            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-white/8 shrink-0">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white text-sm">Notificações</span>
                  {naoLidas > 0 && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold">{naoLidas}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {naoLidas > 0 && (
                    <button onClick={handleMarcarTodasLidas} className="text-[10px] text-slate-400 hover:text-white transition-colors">
                      Marcar todas como lidas
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {notifLoading ? (
                  <div className="py-8 text-center text-slate-500 text-xs">Carregando...</div>
                ) : notificacoes.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notificacoes.map(n => (
                      <div key={n.id} onClick={() => !n.lida && handleMarcarLida(n.id)}
                        className={`px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${!n.lida ? 'bg-indigo-500/5' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          {!n.lida && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />}
                          <div className={`flex-1 ${n.lida ? 'pl-4' : ''}`}>
                            <p className={`text-xs font-semibold ${n.lida ? 'text-slate-400' : 'text-white'}`}>{n.titulo}</p>
                            {n.mensagem && <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.mensagem}</p>}
                            <p className="text-[10px] text-slate-600 mt-1">{n.criadoEm}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal GerenciarResponsáveis */}
        <GerenciarResponsaveisModal
          isOpen={Boolean(gerenciarItId)}
          itId={gerenciarItId}
          currentUser={currentUser}
          onClose={() => setGerenciarItId(null)}
          onSuccess={() => router.refresh()}
        />

        {isCadastroOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !cadastroSubmitting && setIsCadastroOpen(false)} />
            <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D1424] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/8">
                <div>
                  <h3 className="font-bold text-white">Cadastrar minha IT</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Preencha os dados e envie o PDF para análise.</p>
                </div>
                <button onClick={() => !cadastroSubmitting && setIsCadastroOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Título da IT *</label>
                  <input type="text" placeholder="Ex.: Abertura de Protocolo Digital"
                    value={cadastroTitulo} onChange={(e) => setCadastroTitulo(e.target.value)} disabled={cadastroSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Setor</label>
                  <div className="px-4 py-2.5 rounded-xl border border-white/6 bg-white/3 text-sm text-slate-400">
                    {currentUser.departamento || 'Geral'}
                    <span className="ml-2 text-xs text-slate-600">(preenchido automaticamente)</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Descrição breve / Objetivo</label>
                  <textarea placeholder="Descreva brevemente o objetivo desta instrução..."
                    value={cadastroObjetivo} onChange={(e) => setCadastroObjetivo(e.target.value)}
                    disabled={cadastroSubmitting} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all resize-none disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Arquivo PDF *</label>
                  <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed transition-all cursor-pointer ${cadastroFile ? 'border-emerald-500/40 bg-emerald-500/8' : 'border-white/15 bg-white/3 hover:border-indigo-500/40 hover:bg-white/5'}`}>
                    <Upload className={`w-5 h-5 shrink-0 ${cadastroFile ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      {cadastroFile ? (
                        <><p className="text-sm text-emerald-300 font-medium truncate">{cadastroFile.name}</p>
                        <p className="text-xs text-slate-400">{(cadastroFile.size / 1024).toFixed(0)} KB</p></>
                      ) : <p className="text-sm text-slate-400">Clique para selecionar o PDF</p>}
                    </div>
                    <input type="file" accept="application/pdf,.pdf" onChange={handleCadastroFileSelect} disabled={cadastroSubmitting} className="hidden" />
                  </label>
                </div>
                {cadastroError && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />{cadastroError}
                  </div>
                )}
                {cadastroSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />IT enviada para análise com sucesso!
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 p-6 border-t border-white/8">
                <button onClick={() => !cadastroSubmitting && setIsCadastroOpen(false)} disabled={cadastroSubmitting || cadastroSuccess}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleCadastroSubmit} disabled={cadastroSubmitting || cadastroSuccess || !cadastroTitulo.trim() || !cadastroFile}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {cadastroSubmitting ? <><Clock className="w-4 h-4 animate-spin" /> Enviando...</> : <><ArrowUpRight className="w-4 h-4" /> Enviar para análise</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#070A12] text-white selection:bg-emerald-500/30 transition-colors duration-300 relative overflow-hidden pb-16 font-sans">

      {/* Background Ambient Glows */}

      <div className="pointer-events-none absolute inset-0">

        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      </div>



      {/* ── Container Unificado Centralizado (Cabeçalho + Alerta + Card Folha A4) ── */}

      <div className="relative mx-auto w-full max-w-[1060px] px-4 sm:px-6 pt-6 pb-12 space-y-5">

        {/* Banner de Supervisão */}

        {isSupervisao && (

          <div className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-5 py-3.5">

            <Eye className="w-5 h-5 text-sky-400 shrink-0" />

            <div className="flex-1">

              <p className="text-sm font-bold text-sky-300">MODO SUPERVISÃO</p>

              <p className="text-xs text-sky-300/70 mt-0.5">

                Você está visualizando as ITs como {currentUser.role === 'SUBSTITUTO' ? 'Oficial Substituto' : currentUser.role}.

                {responsavelRealNome && <> O responsável técnico desta IT é <strong className="text-sky-200">{responsavelRealNome}</strong>.</>}

              </p>

            </div>

          </div>

        )}



        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/6">

          <div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">

              <span>Dashboard</span>

              <span className="text-slate-600">/</span>

              <span>Meu Espaço</span>

              <span className="text-slate-600">/</span>

              <span className="text-emerald-400">{isSupervisao ? 'Supervisão ITs' : 'Minha IT'}</span>

            </div>

            <div className="flex items-center gap-3 mt-1.5">

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">

                {isSupervisao ? 'Supervisão de Instruções de Trabalho' : 'Minha Instrução de Trabalho'}

              </h1>

              {!isSupervisao && (() => {
                const cfg = papelItemCustodia === 'RESPONSAVEL_PRINCIPAL'
                  ? { label: 'RESPONSÁVEL TÉCNICO', dot: 'bg-emerald-400', cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-xs' }
                  : papelItemCustodia === 'CORRESPONSAVEL'
                  ? { label: 'CORRESPONSÁVEL', dot: 'bg-violet-400', cls: 'border-violet-500/30 bg-violet-500/15 text-violet-300 shadow-xs' }
                  : papelItemCustodia === 'LEITOR'
                  ? { label: 'COLABORADOR', dot: 'bg-slate-400', cls: 'border-slate-500/30 bg-slate-500/15 text-slate-300 shadow-xs' }
                  : hasCustodia
                  ? { label: 'RESPONSÁVEL TÉCNICO', dot: 'bg-emerald-400', cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-xs' }
                  : null;
                return cfg ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${cfg.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                ) : null;
              })()}

              {isSupervisao && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-300 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  SOMENTE LEITURA
                </span>
              )}

            </div>

            <p className="text-xs text-slate-400 mt-1">
              {isSupervisao
                ? `${cartorioNome} • ${cartorioUnidade} • Visão de supervisão`
                : `${cartorioNome} • ${currentIt.departamento}`}
            </p>

          </div>

        </div>



        {/* ── Alerta Elegante de Atualização da IT (Padrão Preventivo Internacional) ── */}

        {!isSupervisao && alertaVisible && (

          <div>

            <AlertaResponsavelTecnico

              codigo={currentIt.codigo}

              titulo="Mantenha sua Instrução de Trabalho atualizada"

              descricao="Revise esta IT sempre que houver mudança nas atividades, procedimentos, sistemas ou na forma de execução do trabalho."

              dataUltimaRevisao={currentIt.updatedAt}

              estado={['enviada_para_analise', 'correcao_solicitada', 'rascunho'].includes(currentIt.status) ? 'em_analise' : 'preventivo'}

              podeCriarNovaVersao={

                ['publicada', 'vigente'].includes(currentIt.status) &&

                (itsCustodia.find(i => i.id === currentIt.id)?.papelNaIt === 'RESPONSAVEL_PRINCIPAL' || !isSupervisao)

              }

              onCriarNovaVersao={() => setIsModalOpen(true)}

              onDismiss={() => setAlertaVisible(false)}

            />

          </div>

        )}



        {/* ── Documento Centralizado Folha A4 Marfim ─────────────── */}

        <main className="w-full rounded-[20px] bg-[#FAF8F5] text-[#1C1A17] border border-[#E7E2D8] p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.2)] relative">



            {/* Seletor de custódia (apenas quando há múltiplas ITs) */}
            {itsCustodia.length > 1 && (
              <div className="mb-5 flex items-center gap-3 bg-[#EFECE6] border border-[#DDD7CD] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 shrink-0">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-[#756E63] uppercase tracking-wide">Suas ITs</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full">{itsCustodia.length}</span>
                </div>
                <div className="relative flex-1 min-w-0">
                  <select
                    value={currentIt.codigo}
                    onChange={(e) => handleSelectIt(e.target.value)}
                    disabled={isPending}
                    className="w-full appearance-none bg-white hover:bg-[#FAFAF8] text-[#1C1A17] border border-[#DDD7CD] pr-8 pl-3 py-2 rounded-xl text-sm font-bold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none cursor-pointer transition-all shadow-xs"
                  >
                    {itsCustodia.map((it) => (
                      <option key={it.id} value={it.codigo} className="bg-white text-[#1C1A17] font-medium">
                        {it.titulo} — {it.departamento} • v{it.versao}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#756E63] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Cabeçalho: Título + Selo de versão oficial */}
            <div className="mb-6 pb-5 border-b border-[#E8E2D8]">
              <div className="flex flex-wrap items-start gap-3 mb-1.5">
                <h2 className="text-2xl sm:text-[28px] font-bold text-[#1C1A17] tracking-tight leading-tight flex-1 min-w-0 font-serif">
                  {formatTituloPrincipal(currentIt.titulo)}
                </h2>
                {(['publicada', 'vigente'] as string[]).includes(currentIt.status) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold tracking-wide shadow-xs whitespace-nowrap shrink-0 mt-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-700" />
                    Versão oficial {currentIt.versao}&nbsp;•&nbsp;Somente leitura
                  </span>
                )}
              </div>
              <p className="text-xs text-[#756E63] font-medium tracking-wide">
                {currentIt.departamento} • {papelLabel}
              </p>
            </div>



            {/* Corpo do Documento */}

            <div className="space-y-8 text-[15px] leading-relaxed">



              {/* 1. OBJETIVO */}

              <section className="space-y-2">

                <h3 className="text-xs uppercase tracking-wider font-bold text-[#756E63] pb-1.5 border-b border-[#E8E2D8]">

                  1. Objetivo

                </h3>

                <p className="text-[#2D2A26] pt-1 leading-relaxed">

                  {currentIt.objetivo}

                </p>

              </section>




              {/* ── Rodapé de Ações do Documento ── */}
              <div className="pt-6 border-t border-[#E8E2D8] flex flex-col gap-3 select-none">

                {/* Linha 1 — Botão amarelo full-width */}
                <a
                  href={currentIt.pdfUrl || '#'}
                  target={currentIt.pdfUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!currentIt.pdfUrl) {
                      e.preventDefault();
                      alert('O documento PDF original desta IT ainda não foi anexado.');
                    }
                  }}
                  className="group w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#FFC200] via-[#FFB100] to-[#FFA000] text-[#1A1200] font-bold text-[13px] tracking-wider shadow-[0_8px_22px_-3px_rgba(255,174,0,0.45)] hover:shadow-[0_12px_28px_-3px_rgba(255,174,0,0.6)] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#1A1200] flex-shrink-0 stroke-[2.5]" />
                  <span>VISUALIZAR NA ÍNTEGRA ESTA IT</span>
                  <ArrowRight className="w-4 h-4 text-[#1A1200] flex-shrink-0 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-1 ml-auto" />
                </a>

                {/* Linha 2 — Dois botões secundários de mesma largura */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Gerenciar responsáveis — visível para todos; permissões gerenciadas dentro do modal */}
                  <button
                    type="button"
                    id="btn-gerenciar-responsaveis"
                    onClick={() => abrirGerenciarModal(currentIt.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-[#F7F5F0] text-[#1C1A17] border border-[#D8D2C6] hover:border-[#C4BCAD] text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  >
                    <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span>Gerenciar responsáveis</span>
                    {participantes.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                        {participantes.length}
                      </span>
                    )}
                  </button>

                  {/* Ver ciências — abre Drawer lateral */}
                  <button
                    ref={cienciasButtonRef}
                    type="button"
                    id="btn-ver-ciencias"
                    onClick={() => setCienciasDrawerOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#ECFDF5] hover:bg-[#D1FAE5] text-emerald-900 border border-emerald-300/90 hover:border-emerald-400 text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>Ver ciências</span>
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-200/80 text-[11px] font-bold text-emerald-800 font-mono">
                      {currentIt.totalCientes}/{currentIt.totalColaboradores > 0 ? currentIt.totalColaboradores : '—'}
                    </span>
                  </button>

                </div>
              </div>

            </div>

          </main>

        </div>



      {/* ── Modal Clean: Atualizar Meu PDF Vigente (FIORIX Dark) ────────────────── */}

      {isModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">

          <div className="bg-[#0B1020] w-full max-w-lg rounded-3xl border border-white/12 shadow-[0_25px_70px_rgba(0,0,0,0.6)] p-6 space-y-5 relative text-white animate-in fade-in zoom-in-95 duration-200">

            {/* Header Modal */}

            <div className="flex items-center justify-between pb-3 border-b border-white/10">

              <div>

                <h3 className="text-base font-bold text-white">

                  Atualizar Meu PDF Vigente

                </h3>

                <p className="text-xs text-slate-400">
                  Responsável Técnico:{' '}
                  <span className="text-slate-200 font-medium">
                    {currentIt.responsavelNome || currentUser.name}
                  </span>
                  <span className="text-slate-500 ml-1.5 font-mono">({currentIt.codigo})</span>
                </p>

              </div>

              <button

                onClick={() => !isUploading && setIsModalOpen(false)}

                disabled={isUploading}

                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"

              >

                <X className="w-5 h-5" />

              </button>

            </div>



            {/* Aviso Neutro */}

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-xs text-slate-300 space-y-1">

              <div className="font-semibold text-white">Controle de Versão Oficial</div>

              <p className="text-slate-400 leading-relaxed">

                Este documento representa o registro oficial das rotinas da sua área. Ao publicar um novo PDF, será gerada a versão <strong className="text-emerald-400">v{nextVersao}</strong> e um novo Hash criptográfico SHA-256.

              </p>

            </div>



            {uploadError && (

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">

                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />

                <span>{uploadError}</span>

              </div>

            )}



            {uploadSuccess && (

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">

                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />

                <span>Versão v{nextVersao} publicada com sucesso! Atualizando tela...</span>

              </div>

            )}

            {/* Campo: Título da Instrução de Trabalho (Editável no fluxo de nova versão) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="input-novo-titulo" className="font-semibold text-slate-200 flex items-center gap-1">
                  <span>Título da Instrução de Trabalho</span>
                  <span className="text-amber-400 font-bold" title="Campo obrigatório">*</span>
                </label>
                <span className={`text-[11px] font-mono ${novoTitulo.length > 120 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                  {novoTitulo.length}/120
                </span>
              </div>
              <input
                id="input-novo-titulo"
                type="text"
                value={novoTitulo}
                onChange={(e) => {
                  setNovoTitulo(e.target.value);
                  if (novoTituloError) setNovoTituloError('');
                }}
                maxLength={120}
                placeholder="Ex: NOÇÕES BÁSICAS..."
                disabled={isUploading}
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl bg-white/[0.03] border ${
                  novoTituloError ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40' : 'border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40'
                } text-white placeholder-slate-500 focus:outline-none transition-all uppercase tracking-wide font-medium`}
              />
              {novoTituloError ? (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{novoTituloError}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A alteração será publicada após a aprovação desta versão.
                </p>
              )}
            </div>

            {/* Dropzone PDF */}

            <div className="space-y-2">

              <label className="block text-xs font-semibold text-slate-300">

                Selecione o PDF Atualizado

              </label>

              <label className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]">

                <Upload className="w-7 h-7 text-slate-400" />

                <span className="text-xs text-slate-300 font-medium text-center">

                  {selectedFile ? (

                    <strong className="text-emerald-400">{selectedFile.name}</strong>

                  ) : (

                    'Clique para selecionar ou arraste seu PDF atualizado'

                  )}

                </span>

                <span className="text-[10px] text-slate-500">Apenas arquivos .pdf</span>

                <input

                  type="file"

                  accept="application/pdf"

                  onChange={handleFileSelect}

                  disabled={isUploading}

                  className="hidden"

                />

              </label>



              {fileHash && (

                <div className="text-[11px] font-mono text-slate-300 truncate bg-white/[0.03] p-2.5 rounded-xl border border-white/8">

                  Hash SHA-256 gerado: <span className="text-emerald-400">{fileHash}</span>

                </div>

              )}

            </div>



            {/* O que mudou nesta versão? */}

            <div className="space-y-2">

              <label className="block text-xs font-semibold text-slate-300">

                O que mudou nesta versão?

              </label>

              <textarea

                value={resumoMudancas}

                onChange={(e) => setResumoMudancas(e.target.value)}

                placeholder="Ex: Atualização do fluxo de conferência de certidões e prazos de resposta..."

                disabled={isUploading}

                rows={3}

                className="w-full text-xs p-3.5 rounded-xl bg-white/[0.03] border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-white placeholder-slate-500 focus:outline-none transition-all"

              />

            </div>



            {/* Checkbox de Responsabilidade Técnica */}

            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">

              <input

                type="checkbox"

                checked={confirmouRevisao}

                onChange={(e) => setConfirmouRevisao(e.target.checked)}

                disabled={isUploading}

                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"

              />

              <span className="leading-relaxed">

                Confirmo que revisei o documento e sou o <strong className="text-emerald-400">Responsável Técnico</strong> oficial por esta versão.

              </span>

            </label>



            {/* Rodapé e Botões */}

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">

              <button

                type="button"

                onClick={() => setIsModalOpen(false)}

                disabled={isUploading}

                className="text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"

              >

                Cancelar

              </button>



              <button

                type="button"

                onClick={handlePublishVersion}

                disabled={isUploading || !selectedFile || !confirmouRevisao}

                className="h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer border border-emerald-400/20"

              >

                {isUploading ? (

                  <span>Publicando versão v{nextVersao}...</span>

                ) : (

                  <>

                    <Upload className="w-3.5 h-3.5" />

                    <span>Publicar Nova Versão v{nextVersao} + Gerar Hash</span>

                  </>

                )}

              </button>

            </div>



            <div className="text-[11px] text-slate-500 text-center">

              A ciência da equipe será reiniciada para 0% — os colaboradores precisarão confirmar ciência nesta versão.

            </div>

          </div>

        </div>

      )}

      {/* Drawer Lateral de Ciências da Equipe */}
      {currentIt && (
        <CienciasDrawer
          isOpen={cienciasDrawerOpen}
          onClose={() => setCienciasDrawerOpen(false)}
          itId={currentIt.id}
          codigo={currentIt.codigo}
          titulo={currentIt.titulo}
          versao={currentIt.versao}
          responsavelCienteEm={currentIt.responsavelCienteEm}
          adesaoPercentual={currentIt.adesaoPercentual}
          totalCientes={currentIt.totalCientes}
          totalColaboradores={currentIt.totalColaboradores}
          pendentesCount={currentIt.pendentesCount}
          equipeCiencias={currentIt.equipeCiencias}
          podeGerenciar={podeGerenciar}
          onEquipeUpdated={() => router.refresh()}
          triggerButtonRef={cienciasButtonRef}
        />
      )}


      {/* Modal de Gerenciamento de Responsáveis */}
      <GerenciarResponsaveisModal
        isOpen={Boolean(gerenciarItId)}
        itId={gerenciarItId}
        currentUser={currentUser}
        onClose={() => setGerenciarItId(null)}
        onSuccess={() => router.refresh()}
      />

    </div>

  );

}

