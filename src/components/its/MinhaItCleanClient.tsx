'use client';

import React, { useState, useEffect, useTransition, useId } from 'react';
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
} from 'lucide-react';
import { MinhaItPageData, MinhaItCustodiaItem, publicarNovaVersaoIT } from '@/app/actions/minha-it';
import { getITUploadSignedUrl } from '@/app/actions/its';
import { AlertaResponsavelTecnico } from './AlertaResponsavelTecnico';

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

  const { hasCustodia, currentUser, cartorioNome, cartorioUnidade, itsCustodia, currentIt } = initialData;

  // Estado de cópia do Hash
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

  // Estado Vazio: Colaborador sem nenhuma IT atribuída
  if (!hasCustodia || !currentIt) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
            <FileText className="w-8 h-8 text-emerald-400/70" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Nenhuma Instrução de Trabalho sob sua responsabilidade
          </h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Você ainda não foi designado como Responsável Técnico por nenhuma instrução de trabalho oficial.
            Suas instruções atribuídas aparecerão diretamente aqui quando o RH realizar a designação.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors shadow-sm cursor-pointer"
          >
            Voltar para o Painel Geral
          </button>
        </div>
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

      {/* ── Breadcrumbs & Top Info (FIORIX Dark Standard) ────── */}
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Meu Espaço (Pessoal)</span>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400">Minha IT</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                Minha Instrução de Trabalho
              </h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                RESPONSÁVEL TÉCNICO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {cartorioNome} • {cartorioUnidade} • Gestão oficial e custódia de versão do setor {currentIt.departamento}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">
              Versão Oficial Homologada
            </span>
          </div>
        </div>

        {/* ── Alerta Amarelo Vibrante do Responsável Técnico ── */}
        {alertaVisible && (
          <div className="mt-4">
            <AlertaResponsavelTecnico
              codigo={currentIt.codigo}
              onDismiss={() => setAlertaVisible(false)}
            />
          </div>
        )}
      </div>

      {/* ── Área Principal (Documento Centralizado + Sidebar 320px) ─ */}
      <div className="relative flex-1 flex justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-[1200px] flex flex-col lg:flex-row gap-6 items-start justify-center">

          {/* ── Documento Centralizado Folha A4 Marfim (820px) ─────────────── */}
          <main className="w-full lg:w-[820px] flex-shrink-0 rounded-[20px] bg-[#FAF8F5] text-[#1C1A17] border border-[#E7E2D8] p-6 sm:p-12 shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.2)] relative">

            {/* Barra Controle de Versão Minimalista (36px) */}
            <div className="h-9 px-4 bg-[#EFECE6] border border-[#DDD7CD] rounded-xl flex items-center justify-between text-[11px] text-[#635D54] mb-8 select-none shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold tracking-wider text-[10px] text-[#756E63] uppercase">Controle de Versão</span>
                <span className="text-[#A39B8E]">•</span>
                <span className="font-mono text-[#423E37]">
                  Hash SHA-256: {currentIt.hashVersao.slice(0, 10)}...
                </span>
                <span className="text-[#A39B8E]">•</span>
                <span className="font-semibold text-emerald-700">Versão Oficial v{currentIt.versao}</span>
              </div>

              <button
                onClick={handleCopyHash}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#E2DDD3] text-[#2C2824] font-medium transition-colors cursor-pointer text-[11px]"
                title="Copiar Hash SHA-256 completo"
              >
                {copiedHash ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-emerald-700 font-semibold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#756E63]" />
                    <span>Copiar Hash</span>
                  </>
                )}
              </button>
            </div>

            {/* Header Documento: Dropdown minimalista de custódia + Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E8E2D8]">
              <div className="relative inline-flex items-center">
                {itsCustodia.length > 1 ? (
                  <div className="relative flex items-center">
                    <select
                      value={currentIt.codigo}
                      onChange={(e) => handleSelectIt(e.target.value)}
                      disabled={isPending}
                      className="appearance-none bg-[#EFECE6] hover:bg-[#E8E4DC] text-[#1C1A17] border border-[#DDD7CD] pr-8 pl-3 py-1.5 rounded-xl text-sm font-bold focus:border-emerald-600 focus:outline-none cursor-pointer transition-colors shadow-xs"
                    >
                      {itsCustodia.map((it) => (
                        <option key={it.id} value={it.codigo} className="bg-[#FAF8F5] text-[#1C1A17] font-medium">
                          {it.codigo} • {it.titulo}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#756E63] absolute right-2.5 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-sm font-bold text-[#1C1A17]">
                    {currentIt.codigo} • {currentIt.titulo}
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-800 border border-emerald-600/25 text-[11px] font-bold tracking-wide shadow-xs">
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                <span>MEU PDF VIGENTE</span>
              </div>
            </div>

            {/* Título Serif H1 */}
            <h2 className="text-2xl sm:text-[28px] font-bold text-[#1C1A17] tracking-tight leading-tight mb-8 font-serif">
              {currentIt.titulo} • {currentIt.codigo} v{currentIt.versao}
            </h2>

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

              {/* 2. QUANDO USAR */}
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-[#756E63] pb-1.5 border-b border-[#E8E2D8]">
                  2. Quando Usar
                </h3>
                <p className="text-[#2D2A26] pt-1 leading-relaxed">
                  {currentIt.quandoUsar}
                </p>
              </section>

              {/* 3. PASSO A PASSO (RESPONSABILIDADE TÉCNICA) */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-bold text-[#756E63] pb-1.5 border-b border-[#E8E2D8]">
                  3. Passo a Passo (Responsabilidade Técnica)
                </h3>

                <div className="space-y-3 pt-1">
                  {currentIt.passoAPasso.length > 0 ? (
                    currentIt.passoAPasso.map((item, idx) => {
                      const isString = typeof item === 'string';
                      const titulo = isString ? item : item.titulo;
                      const desc = isString ? '' : item.desc;

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3.5 p-4 rounded-xl bg-white/75 border border-[#E8E2D8] hover:border-emerald-600/40 hover:bg-white transition-all shadow-xs"
                        >
                          <span className="w-7 h-7 rounded-full bg-emerald-700/10 border border-emerald-700/20 font-bold text-xs text-emerald-800 flex items-center justify-center flex-shrink-0 shadow-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-[#1C1A17]">{titulo}</div>
                            {desc && <div className="text-xs text-[#5C564D] mt-1 leading-relaxed">{desc}</div>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-[#756E63] italic">Nenhum passo a passo cadastrado para esta rotina.</div>
                  )}
                </div>
              </section>

              {/* 4. Cards do Rodapé do Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E8E2D8]">
                {/* Checklist Obrigatório */}
                <div className="p-4 rounded-xl border border-[#E8E2D8] bg-white/75 space-y-2 shadow-xs">
                  <div className="text-xs font-bold text-[#1C1A17] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Checklist Obrigatório</span>
                  </div>
                  <ul className="text-xs text-[#474138] space-y-1.5 list-disc list-inside">
                    {currentIt.checklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Orientações Práticas */}
                <div className="p-4 rounded-xl border border-[#E8E2D8] bg-white/75 space-y-2 shadow-xs">
                  <div className="text-xs font-bold text-[#1C1A17] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Orientações Práticas</span>
                  </div>
                  <ul className="text-xs text-[#474138] space-y-1.5 list-disc list-inside">
                    {currentIt.casosPraticos.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Botão de Visualização na Íntegra (PDF) */}
              <div className="pt-6 flex justify-end">
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
                  className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#FFD000] via-[#FFB800] to-[#FFA000] text-[#0A0A0A] font-bold text-[12.5px] sm:text-[13px] tracking-[0.08em] shadow-[0_10px_25px_-5px_rgba(255,170,0,0.48),0_4px_10px_-2px_rgba(255,170,0,0.25)] hover:shadow-[0_16px_35px_-4px_rgba(255,160,0,0.65),0_6px_14px_-2px_rgba(255,160,0,0.35)] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] transition-all duration-300 cursor-pointer select-none"
                >
                  {/* Ícone Olho com Pupila Preenchida */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>

                  <span>VISUALIZAR NA ÍNTEGRA ESTA IT</span>

                  {/* Ícone Seta Horizontal → que desloca no hover */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </div>
            </div>
          </main>

          {/* ── Sidebar Direita Minimal (320px) ────────────────────── */}
          <aside className="w-full lg:w-[320px] flex-shrink-0 space-y-6">

            {/* Box 1: CIÊNCIA CONFIRMADA */}
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Ciência Confirmada
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    em {currentIt.responsavelCienteEm}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Adesão da Equipe</span>
                  <span className="font-bold text-white font-mono">{currentIt.adesaoPercentual}%</span>
                </div>
                <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-500"
                    style={{ width: `${currentIt.adesaoPercentual}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Você já deu ciência automática. {currentIt.pendentesCount} colaboradores pendentes.
                </div>
              </div>

              {/* Botão Principal: Atualizar Meu PDF Vigente */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-400/20"
              >
                <Upload className="w-4 h-4" />
                <span>Atualizar Meu PDF Vigente</span>
              </button>
            </div>

            {/* Box 2: EQUIPE • CIÊNCIAS */}
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-white/8">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Equipe • Ciências
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {currentIt.totalCientes}/{currentIt.totalColaboradores}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {currentIt.equipeCiencias.map((colab) => (
                  <div
                    key={colab.usuarioId}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {colab.ciente ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0" />
                      )}
                      <span className={`truncate ${colab.isCurrentUser ? 'font-bold text-white' : 'text-slate-300'}`}>
                        {colab.nome}
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono flex-shrink-0 ${colab.ciente ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                      {colab.ciente ? 'Ciente' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
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
                <p className="text-xs text-slate-400">Responsável Técnico: {currentIt.codigo}</p>
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
    </div>
  );
}
