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
      // 1. Obtém URL assinada para upload no Supabase
      const urlRes = await getITUploadSignedUrl(
        `${currentIt.codigo}_v${nextVersao}_${selectedFile.name}`,
        'application/pdf'
      );

      if (!urlRes.success || !urlRes.signedUrl) {
        throw new Error(urlRes.error || 'Falha ao autorizar upload no armazenamento.');
      }

      const { signedUrl, storagePath } = urlRes;

      // 2. Faz o upload binário direto via PUT
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error(`Falha no upload do arquivo (HTTP ${uploadRes.status})`);
      }

      // 3. Registra a nova versão no banco de dados e reseta ciências
      const pubRes = await publicarNovaVersaoIT({
        itId: currentIt.id,
        codigo: currentIt.codigo,
        novaVersao: nextVersao,
        pdfPath: storagePath,
        hashSha256: fileHash || currentIt.hashVersao,
        resumoMudancas,
      });

      if (!pubRes.success) {
        throw new Error(pubRes.error || 'Erro ao publicar nova versão.');
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
      <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-4 shadow-sm">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">
          Nenhuma Instrução de Trabalho sob sua responsabilidade
        </h1>
        <p className="text-sm text-[#6b7280] max-w-md mb-6 leading-relaxed">
          Você ainda não foi designado como Responsável Técnico por nenhuma instrução de trabalho oficial.
          Suas instruções atribuídas aparecerão diretamente aqui quando o RH realizar a designação.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-full bg-[#111827] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
        >
          Voltar para o Painel Geral
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827] flex flex-col font-sans">
      {/* ── Header Top Clean (56px) ─────────────────────────────── */}
      <header className="h-14 bg-white border-b border-[#e5e7eb] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="font-semibold text-[#111827]">{cartorioNome}</span>
          <span className="text-[#9ca3af]">•</span>
          <span className="text-[#6b7280]">{cartorioUnidade}</span>
          <span className="ml-1 px-2 py-0.5 rounded-md bg-[#10b981]/10 text-[#10b981] font-semibold text-[10px]">
            Em dia
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-[#111827] leading-tight">{currentUser.name}</div>
            <div className="text-[11px] text-[#6b7280]">
              Responsável Técnico • {currentIt.departamento}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Área Principal (Documento Centralizado 800px + Sidebar 320px) ─ */}
      <div className="flex-1 flex justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-[1160px] flex flex-col lg:flex-row gap-8 items-start justify-center">

          {/* ── Documento Branco Centralizado (800px) ─────────────── */}
          <main className="w-full lg:w-[800px] flex-shrink-0 bg-white border border-[#e5e7eb] rounded-2xl p-6 sm:p-12 shadow-sm relative">

            {/* Barra Controle de Versão Minimalista (36px) */}
            <div className="h-9 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg flex items-center justify-between text-[11px] text-[#6b7280] mb-8 select-none">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold tracking-wider text-[10px] text-zinc-500 uppercase">Controle de Versão</span>
                <span>•</span>
                <span className="font-mono text-zinc-600">
                  Hash SHA-256: {currentIt.hashVersao.slice(0, 10)}...
                </span>
                <span>•</span>
                <span className="font-medium text-zinc-700">Versão Oficial v{currentIt.versao}</span>
              </div>

              <button
                onClick={handleCopyHash}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-zinc-200/70 text-[#111827] font-medium transition-colors cursor-pointer text-[11px]"
                title="Copiar Hash SHA-256 completo"
              >
                {copiedHash ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-[#10b981]">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#6b7280]" />
                    <span>Copiar Hash</span>
                  </>
                )}
              </button>
            </div>

            {/* Header Documento: Dropdown minimalista de custódia + Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#e5e7eb]/80">
              <div className="relative inline-flex items-center">
                {itsCustodia.length > 1 ? (
                  <div className="relative flex items-center">
                    <select
                      value={currentIt.codigo}
                      onChange={(e) => handleSelectIt(e.target.value)}
                      disabled={isPending}
                      className="appearance-none bg-transparent hover:bg-zinc-50 pr-8 pl-1 py-1 rounded-lg text-sm font-bold text-[#111827] focus:outline-none cursor-pointer border border-transparent hover:border-zinc-200 transition-colors"
                    >
                      {itsCustodia.map((it) => (
                        <option key={it.id} value={it.codigo} className="bg-white text-zinc-900 font-medium">
                          {it.codigo} • {it.titulo}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-sm font-bold text-[#111827]">
                    {currentIt.codigo} • {currentIt.titulo}
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25 text-[11px] font-semibold tracking-wide shadow-xs">
                <Shield className="w-3 h-3" />
                <span>MEU PDF VIGENTE</span>
              </div>
            </div>

            {/* Título Serif H1 */}
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#111827] tracking-tight leading-tight mb-8 font-serif">
              {currentIt.titulo} • {currentIt.codigo} v{currentIt.versao}
            </h1>

            {/* Corpo do Documento */}
            <div className="space-y-8 text-[15px] text-[#111827] leading-relaxed">

              {/* 1. OBJETIVO */}
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider font-bold text-[#6b7280] pb-1 border-b border-[#e5e7eb]">
                  1. Objetivo
                </h2>
                <p className="text-[#111827] pt-1">
                  {currentIt.objetivo}
                </p>
              </section>

              {/* 2. QUANDO USAR */}
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider font-bold text-[#6b7280] pb-1 border-b border-[#e5e7eb]">
                  2. Quando Usar
                </h2>
                <p className="text-[#111827] pt-1">
                  {currentIt.quandoUsar}
                </p>
              </section>

              {/* 3. PASSO A PASSO (RESPONSABILIDADE TÉCNICA) */}
              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-wider font-bold text-[#6b7280] pb-1 border-b border-[#e5e7eb]">
                  3. Passo a Passo (Responsabilidade Técnica)
                </h2>

                <div className="space-y-3 pt-1">
                  {currentIt.passoAPasso.length > 0 ? (
                    currentIt.passoAPasso.map((item, idx) => {
                      const isString = typeof item === 'string';
                      const titulo = isString ? item : item.titulo;
                      const desc = isString ? '' : item.desc;

                      return (
                        <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#f9fafb] border border-[#e5e7eb]/70 hover:border-zinc-300 transition-colors">
                          <span className="w-6 h-6 rounded-full bg-white border border-[#e5e7eb] font-bold text-xs text-[#111827] flex items-center justify-center flex-shrink-0 shadow-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-[#111827]">{titulo}</div>
                            {desc && <div className="text-xs text-[#6b7280] mt-0.5 leading-normal">{desc}</div>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-zinc-500 italic">Nenhum passo a passo cadastrado para esta rotina.</div>
                  )}
                </div>
              </section>

              {/* 4. Cards do Rodapé do Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#e5e7eb]">
                {/* Checklist Obrigatório */}
                <div className="p-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] space-y-2">
                  <div className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>Checklist Obrigatório</span>
                  </div>
                  <ul className="text-xs text-[#4b5563] space-y-1.5 list-disc list-inside">
                    {currentIt.checklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Orientações Práticas */}
                <div className="p-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] space-y-2">
                  <div className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>Orientações Práticas</span>
                  </div>
                  <ul className="text-xs text-[#4b5563] space-y-1.5 list-disc list-inside">
                    {currentIt.casosPraticos.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Link para PDF Original (se houver) */}
              {currentIt.pdfUrl && (
                <div className="pt-2 flex justify-end">
                  <a
                    href={currentIt.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#111827] font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Visualizar PDF do Documento</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </main>

          {/* ── Sidebar Direita Minimal (320px) ────────────────────── */}
          <aside className="w-full lg:w-[320px] flex-shrink-0 space-y-6">

            {/* Box 1: CIÊNCIA CONFIRMADA */}
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#10b981]">
                    Ciência Confirmada
                  </div>
                  <div className="text-xs font-semibold text-[#111827] mt-0.5">
                    em {currentIt.responsavelCienteEm}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6b7280]">Adesão da Equipe</span>
                  <span className="font-bold text-[#111827]">{currentIt.adesaoPercentual}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#10b981] rounded-full transition-all duration-500"
                    style={{ width: `${currentIt.adesaoPercentual}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#6b7280]">
                  Você já deu ciência automática. {currentIt.pendentesCount} colaboradores pendentes.
                </div>
              </div>

              {/* Botão Principal: Atualizar Meu PDF Vigente */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full h-11 bg-[#10b981] hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs rounded-full shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Atualizar Meu PDF Vigente</span>
              </button>
            </div>

            {/* Box 2: EQUIPE • CIÊNCIAS */}
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Equipe • Ciências
                </div>
                <span className="text-xs font-mono font-semibold text-[#111827]">
                  {currentIt.totalCientes}/{currentIt.totalColaboradores}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {currentIt.equipeCiencias.map((colab) => (
                  <div
                    key={colab.usuarioId}
                    className="flex items-center justify-between text-xs py-1 border-b border-[#f3f4f6] last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {colab.ciente ? (
                        <div className="w-4 h-4 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center flex-shrink-0" />
                      )}
                      <span className={`truncate ${colab.isCurrentUser ? 'font-bold text-[#111827]' : 'text-[#4b5563]'}`}>
                        {colab.nome}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#9ca3af] font-mono flex-shrink-0">
                      {colab.ciente ? 'Ciente' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Modal Clean: Atualizar Meu PDF Vigente ────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#e5e7eb] shadow-xl p-6 space-y-5 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e7eb]">
              <div>
                <h3 className="text-base font-bold text-[#111827]">
                  Atualizar Meu PDF Vigente
                </h3>
                <p className="text-xs text-[#6b7280]">Responsável Técnico: {currentIt.codigo}</p>
              </div>
              <button
                onClick={() => !isUploading && setIsModalOpen(false)}
                disabled={isUploading}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso Neutro */}
            <div className="p-3.5 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] text-xs text-[#4b5563] space-y-1">
              <div className="font-semibold text-[#111827]">Controle de Versão Oficial</div>
              <p>
                Este documento representa o registro oficial das rotinas da sua área. Ao publicar um novo PDF, será gerada a versão <strong>v{nextVersao}</strong> e um novo Hash criptográfico SHA-256.
              </p>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Versão v{nextVersao} publicada com sucesso! Atualizando tela...</span>
              </div>
            )}

            {/* Dropzone PDF */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111827]">
                Selecione o PDF Atualizado
              </label>
              <label className="border-2 border-dashed border-[#d1d5db] hover:border-[#10b981] rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#f9fafb]/50">
                <Upload className="w-7 h-7 text-zinc-400" />
                <span className="text-xs text-[#4b5563] font-medium text-center">
                  {selectedFile ? (
                    <strong className="text-[#10b981]">{selectedFile.name}</strong>
                  ) : (
                    'Clique para selecionar ou arraste seu PDF atualizado'
                  )}
                </span>
                <span className="text-[10px] text-[#9ca3af]">Apenas arquivos .pdf</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {fileHash && (
                <div className="text-[10px] font-mono text-[#6b7280] truncate bg-zinc-50 p-2 rounded border border-zinc-200">
                  Hash SHA-256 gerado: {fileHash}
                </div>
              )}
            </div>

            {/* O que mudou nesta versão? */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111827]">
                O que mudou nesta versão?
              </label>
              <textarea
                value={resumoMudancas}
                onChange={(e) => setResumoMudancas(e.target.value)}
                placeholder="Ex: Atualização do fluxo de conferência de certidões e prazos de resposta..."
                disabled={isUploading}
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-[#e5e7eb] focus:border-[#10b981] focus:outline-none transition-colors"
              />
            </div>

            {/* Checkbox de Responsabilidade Técnica */}
            <label className="flex items-start gap-2.5 text-xs text-[#4b5563] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmouRevisao}
                onChange={(e) => setConfirmouRevisao(e.target.checked)}
                disabled={isUploading}
                className="mt-0.5 w-4 h-4 rounded border-[#d1d5db] text-[#10b981] focus:ring-0 cursor-pointer"
              />
              <span>
                Confirmo que revisei o documento e sou o <strong>Responsável Técnico</strong> oficial por esta versão.
              </span>
            </label>

            {/* Rodapé e Botões */}
            <div className="pt-3 border-t border-[#e5e7eb] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isUploading}
                className="text-xs text-[#6b7280] hover:text-[#111827] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handlePublishVersion}
                disabled={isUploading || !selectedFile || !confirmouRevisao}
                className="h-10 px-5 rounded-xl bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
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

            <div className="text-[11px] text-zinc-500 text-center">
              A ciência da equipe será reiniciada para 0% — os colaboradores precisarão confirmar ciência nesta versão.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
