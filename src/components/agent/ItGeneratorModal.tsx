'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  FileCheck2,
  Send,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Split,
  Eye,
  FileText,
} from 'lucide-react';
import { criarPropostaAtualizacao } from '@/app/actions/its';

export interface ItGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  itId?: string;
  itCodigo?: string;
  itTitulo?: string;
  itVersao?: string;
  textoAtual?: string;
  onSuccess?: () => void;
}

export function ItGeneratorModal({
  isOpen,
  onClose,
  itId,
  itCodigo,
  itTitulo,
  itVersao,
  textoAtual = '',
  onSuccess,
}: ItGeneratorModalProps) {
  const [rotinaMudou, setRotinaMudou] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Resultado da IA
  const [novoTexto, setNovoTexto] = useState('');
  const [resumoMudancas, setResumoMudancas] = useState('');
  const [modoVisualizacao, setModoVisualizacao] = useState<'lado-a-lado' | 'novo'>('novo');
  const [enviandoProposta, setEnviandoProposta] = useState(false);

  if (!isOpen) return null;

  async function handleGerarIt() {
    if (!rotinaMudou.trim() || rotinaMudou.trim().length < 5) {
      setErro('Por favor, descreva em detalhes o que mudou no seu procedimento.');
      return;
    }

    setGerando(true);
    setErro('');
    setSucesso('');

    try {
      const res = await fetch('/api/fiorix-generate-it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rotinaAlterada: rotinaMudou.trim(),
          textoAtual,
          itTitulo,
          itCodigo,
          itVersao,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar atualização com IA.');
      }

      setNovoTexto(data.novoTexto);
      setResumoMudancas(data.resumoMudancas || 'Procedimento reestruturado com sucesso.');
    } catch (err: any) {
      setErro(err?.message || 'Erro inesperado na geração com IA.');
    } finally {
      setGerando(false);
    }
  }

  async function handleEnviarProposta() {
    if (!itId || !novoTexto) {
      setErro('IT não identificada ou texto não gerado.');
      return;
    }

    setEnviandoProposta(true);
    setErro('');
    setSucesso('');

    try {
      const res = await criarPropostaAtualizacao({
        itId,
        motivo: rotinaMudou.trim(),
        resumo: resumoMudancas.trim() || 'Atualização de rotina gerada via FIORIX • IA',
        observacoes: `Proposta gerada automaticamente pelo Copiloto IA em conformidade com o Provimento 213/2026.\n\nConteúdo Proposto:\n${novoTexto}`,
      });

      if (!res.success) {
        throw new Error(res.error || 'Erro ao submeter proposta.');
      }

      setSucesso('Proposta enviada com sucesso para homologação do Oficial Substituto!');
      onSuccess?.();
      setTimeout(() => {
        onClose();
        setNovoTexto('');
        setRotinaMudou('');
        setSucesso('');
      }, 2000);
    } catch (err: any) {
      setErro(err?.message || 'Falha ao registrar proposta.');
    } finally {
      setEnviandoProposta(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop escuro com desfoque */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => !gerando && !enviandoProposta && onClose()}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl rounded-3xl border border-white/12 bg-[#0B1020] shadow-[0_25px_70px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[90vh] text-white animate-in zoom-in-95 duration-200">
        
        {/* Header com gradiente */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-[#0E1626] to-[#121A2F] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
              <Sparkles className="w-5 h-5 fill-black stroke-none" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">Atualizar IT com IA</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Assistente IA
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {itCodigo ? `${itCodigo} • ` : ''}
                {itTitulo || 'Instrução de Trabalho'}
                {itVersao ? ` (v${itVersao})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={gerando || enviandoProposta}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer disabled:opacity-50"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          
          {/* Alertas */}
          {erro && (
            <div className="flex items-start gap-2.5 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="flex-1">{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="flex-1">{sucesso}</span>
            </div>
          )}

          {/* Etapa 1: Formulário de Entrada */}
          {!novoTexto && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Como funciona a escrita com IA:
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Descreva em linguagem natural o que foi modificado ou adicionado na rotina do setor. O FIORIX estruturará automaticamente as etapas, os erros comuns e a fundamentação formal baseada no Provimento CNJ 213/2026.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Descreva o que mudou na sua rotina operacional: *
                </label>
                <textarea
                  rows={4}
                  placeholder="Ex: Agora também realizamos a verificação prévia de indisponibilidade de bens no sistema CNIB antes de emitir a prenotação, anexando o extrato ao protocolo..."
                  value={rotinaMudou}
                  onChange={(e) => setRotinaMudou(e.target.value)}
                  disabled={gerando}
                  className="w-full p-3.5 rounded-2xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 resize-none transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleGerarIt}
                disabled={gerando || !rotinaMudou.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {gerando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>O FIORIX está estruturando sua IT...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-black" />
                    <span>Gerar Nova Versão da IT com IA</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Etapa 2: Resultado e Visualizador de Diff */}
          {novoTexto && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Resumo da Alteração */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Revisão Estruturada com Sucesso
                  </span>
                  <button
                    type="button"
                    onClick={() => setNovoTexto('')}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Alterar descrição
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{resumoMudancas}</p>
              </div>

              {/* Seletor de Modo de Visualização */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Documento Proposto
                </span>
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao('novo')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      modoVisualizacao === 'novo' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Texto Completo
                  </button>
                  {textoAtual && (
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao('lado-a-lado')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        modoVisualizacao === 'lado-a-lado' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Split className="w-3.5 h-3.5" />
                      Lado a Lado
                    </button>
                  )}
                </div>
              </div>

              {/* Área do Documento */}
              {modoVisualizacao === 'novo' ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto select-text">
                  {novoTexto}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 font-mono text-[11px] text-rose-200/90 whitespace-pre-wrap">
                    <p className="text-xs font-bold text-rose-400 mb-2 pb-1 border-b border-rose-500/20 uppercase tracking-wider">
                      Texto Vigente Anterior
                    </p>
                    {textoAtual}
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap">
                    <p className="text-xs font-bold text-emerald-400 mb-2 pb-1 border-b border-emerald-500/20 uppercase tracking-wider">
                      Nova Versão Proposta
                    </p>
                    {novoTexto}
                  </div>
                </div>
              )}

              {/* Ações Finais */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleEnviarProposta}
                  disabled={enviandoProposta}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {enviandoProposta ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Enviar Proposta ao Oficial Substituto</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(novoTexto);
                    setSucesso('Texto copiado para a área de transferência!');
                    setTimeout(() => setSucesso(''), 2500);
                  }}
                  className="px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Copiar Markdown
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer com Aviso Legal */}
        <div className="p-4 border-t border-white/8 bg-[#0E1626]/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span>Provimento CNJ nº 213/2026 • Proposta sujeita a homologação formal</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
