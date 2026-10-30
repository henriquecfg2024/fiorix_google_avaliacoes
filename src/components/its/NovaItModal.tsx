'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  Plus,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Shield,
  Hash,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { criarItRapida, ITItem } from '@/app/actions/its';
import { uploadItPdfDirectly } from '@/lib/it-upload-helper';

export interface ColaboradorOption {
  id: string;
  name: string;
  email: string;
  departamento: string;
  cargo: string;
}

export interface NovaItModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setoresDisponiveis: string[];
  setorInicial?: string;
  colaboradores?: ColaboradorOption[];
  currentUserId: string;
  currentUserName?: string | null;
  itsExistentes: ITItem[];
}

function gerarPrefixoSetor(setor: string): string {
  const limpo = setor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (limpo.length >= 3) {
    return `IT-${limpo.slice(0, 3)}-`;
  }
  return 'IT-GER-';
}

function sugerirProximoCodigo(prefixo: string, its: ITItem[]): string {
  const regex = new RegExp(`^${prefixo}(\\d+)`, 'i');
  let maxNum = 0;

  for (const it of its) {
    const match = it.codigo?.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const proximo = maxNum + 1;
  const numFormatado = String(proximo).padStart(3, '0');
  return `${prefixo}${numFormatado}`;
}

export function NovaItModal({
  isOpen,
  onClose,
  onSuccess,
  setoresDisponiveis,
  setorInicial,
  colaboradores = [],
  currentUserId,
  currentUserName,
  itsExistentes,
}: NovaItModalProps) {
  const setoresFiltrados = setoresDisponiveis.filter((s) => s && s !== 'TODOS');
  const setorPadrao =
    setorInicial && setorInicial !== 'TODOS'
      ? setorInicial
      : setoresFiltrados[0] || 'Qualificação';

  const [departamento, setDepartamento] = useState(setorPadrao);
  const [isNovoSetor, setIsNovoSetor] = useState(false);
  const [novoSetorNome, setNovoSetorNome] = useState('');

  const [codigo, setCodigo] = useState('');
  const [codigoEditadoManualmente, setCodigoEditadoManualmente] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [tempoLeituraMin, setTempoLeituraMin] = useState(5);
  const [guardiaoId, setGuardiaoId] = useState(currentUserId || '');

  // Upload PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfHash, setPdfHash] = useState('');
  const [isCalculandoHash, setIsCalculandoHash] = useState(false);

  // Estados de envio
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Inicializar e recalcular sugestão de código quando o setor mudar (se o usuário não editou manualmente)
  useEffect(() => {
    if (!isOpen) return;

    const setorAtual = isNovoSetor ? novoSetorNome.trim() : departamento;
    if (!codigoEditadoManualmente && setorAtual) {
      const prefixo = gerarPrefixoSetor(setorAtual);
      const sugestao = sugerirProximoCodigo(prefixo, itsExistentes);
      setCodigo(sugestao);
    }
  }, [isOpen, departamento, isNovoSetor, novoSetorNome, codigoEditadoManualmente, itsExistentes]);

  // Reset ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess(false);
      setSubmitting(false);
      setStatusMsg('');
      setCodigoEditadoManualmente(false);
      setTitulo('');
      setObjetivo('');
      setTempoLeituraMin(5);
      setPdfFile(null);
      setPdfHash('');
      setGuardiaoId(currentUserId || '');
      setIsNovoSetor(false);
      setNovoSetorNome('');
      const depto =
        setorInicial && setorInicial !== 'TODOS'
          ? setorInicial
          : setoresFiltrados[0] || 'Qualificação';
      setDepartamento(depto);
      const prefixo = gerarPrefixoSetor(depto);
      setCodigo(sugerirProximoCodigo(prefixo, itsExistentes));
    }
  }, [isOpen, setorInicial]);

  // Cálculo de SHA-256 no browser
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo no formato PDF (.pdf).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('O arquivo excede o limite máximo permitido de 20MB.');
      return;
    }

    setError('');
    setPdfFile(file);
    setIsCalculandoHash(true);

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setPdfHash(hashHex);
    } catch {
      setPdfHash('');
    } finally {
      setIsCalculandoHash(false);
    }
  };

  const handleRemoverPdf = () => {
    setPdfFile(null);
    setPdfHash('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const deptoFinal = (isNovoSetor ? novoSetorNome : departamento).trim();
    const codigoFinal = codigo.trim().toUpperCase();
    const tituloFinal = titulo.trim().toUpperCase();

    if (!codigoFinal) {
      setError('Informe o código da IT (ex.: IT-QUA-001).');
      return;
    }
    if (!deptoFinal) {
      setError('Informe ou selecione o departamento / setor.');
      return;
    }
    if (!tituloFinal || tituloFinal.length < 3) {
      setError('Informe um título válido com pelo menos 3 caracteres.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let pdfOriginalUrl: string | undefined;
      let pdfPath: string | undefined;

      if (pdfFile) {
        setStatusMsg('Enviando documento PDF com carimbo de integridade...');
        const uploadRes = await uploadItPdfDirectly(pdfFile, codigoFinal);
        if (!uploadRes.success || !uploadRes.publicUrl) {
          throw new Error(uploadRes.error || 'Falha ao realizar upload do arquivo PDF.');
        }
        pdfOriginalUrl = uploadRes.publicUrl;
        pdfPath = uploadRes.storagePath;
      }

      setStatusMsg('Cadastrando Instrução de Trabalho no acervo oficial...');
      const res = await criarItRapida({
        codigo: codigoFinal,
        titulo: tituloFinal,
        departamento: deptoFinal,
        guardiaoId: guardiaoId || currentUserId,
        objetivo: objetivo.trim() || undefined,
        tempoLeituraMin: Number(tempoLeituraMin) || 5,
        pdfOriginalUrl,
        pdfPath,
      });

      if (!res.success) {
        throw new Error('Não foi possível cadastrar a IT.');
      }

      setSuccess(true);
      toast.success(`IT ${codigoFinal} cadastrada com sucesso!`, {
        description: `"${tituloFinal}" agora faz parte do acervo de Instruções de Trabalho.`,
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao criar a Instrução de Trabalho.');
    } finally {
      setSubmitting(false);
      setStatusMsg('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={() => !submitting && onClose()}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl my-8 rounded-[24px] border border-white/20 bg-[#0B1020]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10 bg-gradient-to-r from-purple-950/30 via-transparent to-indigo-950/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Criar Nova Instrução de Trabalho
                </h2>
                <p className="text-xs text-slate-400">
                  Cadastre uma nova IT operacional com controle de versão e ciência de equipe.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1">Instrução de Trabalho criada com sucesso! Atualizando catálogo...</div>
            </div>
          )}

          {/* Linha 1: Código + Setor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Código da IT *</span>
                <span className="text-[10px] text-purple-300 font-mono">Único no cartório</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => {
                    setCodigoEditadoManualmente(true);
                    setCodigo(e.target.value.toUpperCase());
                  }}
                  placeholder="Ex.: IT-QUA-001"
                  disabled={submitting || success}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 font-mono text-sm text-purple-200 placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-all uppercase disabled:opacity-50"
                />
                <Hash className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Setor / Departamento *</label>
                <button
                  type="button"
                  onClick={() => setIsNovoSetor(!isNovoSetor)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
                >
                  {isNovoSetor ? 'Selecionar existente' : '+ Criar novo setor'}
                </button>
              </div>

              {isNovoSetor ? (
                <input
                  type="text"
                  value={novoSetorNome}
                  onChange={(e) => setNovoSetorNome(e.target.value)}
                  placeholder="Nome do novo setor (ex.: Certidões)"
                  disabled={submitting || success}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-all disabled:opacity-50"
                />
              ) : (
                <select
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  disabled={submitting || success}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-[#121828] text-sm text-white focus:outline-none focus:border-purple-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  {setoresFiltrados.map((s) => (
                    <option key={s} value={s} className="bg-[#0B1020] text-white">
                      {s}
                    </option>
                  ))}
                  {setoresFiltrados.length === 0 && (
                    <option value="Qualificação">Qualificação</option>
                  )}
                </select>
              )}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Título da Instrução de Trabalho *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: PROCEDIMENTO OPERACIONAL DE EXAME E CÁLCULO"
              disabled={submitting || success}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white uppercase placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-all disabled:opacity-50"
            />
          </div>

          {/* Objetivo / Escopo */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Objetivo e Quando Usar <span className="text-slate-500 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Descreva a finalidade desta instrução de trabalho e em que circunstâncias ela se aplica..."
              disabled={submitting || success}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Linha: Tempo Estimado + Guardião Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Tempo de Leitura Estimado
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={tempoLeituraMin}
                  onChange={(e) => setTempoLeituraMin(Math.max(1, parseInt(e.target.value, 10) || 5))}
                  disabled={submitting || success}
                  className="w-24 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white text-center focus:outline-none focus:border-purple-400 transition-all disabled:opacity-50"
                />
                <span className="text-xs text-slate-400">minutos</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Guardião da IT
              </label>
              <select
                value={guardiaoId}
                onChange={(e) => setGuardiaoId(e.target.value)}
                disabled={submitting || success}
                className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-[#121828] text-xs text-white focus:outline-none focus:border-purple-400 transition-all cursor-pointer disabled:opacity-50"
              >
                <option value={currentUserId} className="bg-[#0B1020] text-white">
                  {currentUserName ? `${currentUserName} (Eu mesmo)` : 'Eu mesmo (Gestor)'}
                </option>
                {colaboradores
                  .filter((c) => c.id !== currentUserId)
                  .map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0B1020] text-white">
                      {c.name} — {c.departamento} ({c.cargo})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Upload de Documento PDF */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                Documento Oficial em PDF
              </span>
              <span className="text-[10px] text-slate-400">Recomendado • máx 20MB</span>
            </label>

            {!pdfFile ? (
              <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-purple-500/40 hover:bg-white/[0.04] transition-all cursor-pointer group">
                <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-purple-400 mb-2 transition-colors" />
                <span className="text-xs font-semibold text-slate-200">
                  Clique para selecionar o PDF oficial
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  O documento será carimbado com integridade SHA-256 no envio
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfChange}
                  disabled={submitting || success}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{pdfFile.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-300">
                        {(pdfFile.size / 1024).toFixed(0)} KB
                      </span>
                      {isCalculandoHash ? (
                        <span className="text-[10px] text-purple-300 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Gerando hash...
                        </span>
                      ) : pdfHash ? (
                        <span className="text-[10px] text-emerald-300 font-mono flex items-center gap-1" title={pdfHash}>
                          <Sparkles className="w-2.5 h-2.5" /> SHA-256: {pdfHash.slice(0, 10)}...
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoverPdf}
                  disabled={submitting || success}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer Status */}
          {submitting && statusMsg && (
            <div className="flex items-center gap-2 text-xs text-purple-300 py-1">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/40 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Criar Instrução de Trabalho</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
