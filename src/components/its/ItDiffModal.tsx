'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { salvarNovaVersaoComDiff } from '@/app/actions/its';

interface ItDiffModalProps {
  itId: string;
  codigo: string;
  titulo: string;
  versaoAtual: string;
  novaVersaoSugerida: string;
  dadosAtuais: {
    objetivo?: string;
    quandoUsar?: string;
    procedimento?: Array<{ ordem: number; titulo: string; desc: string }>;
    checklist?: string[];
  };
  novosDados: {
    objetivo: string;
    responsavel: string;
    quandoUsar?: string;
    procedimento: Array<{ ordem: number; titulo: string; desc: string }>;
    checklist: string[];
    errosComuns: string[];
  };
  hashArquivoOriginal?: string;
  onClose: () => void;
  onSuccess: (novaVersao: string) => void;
}

export function ItDiffModal({
  itId,
  codigo,
  titulo,
  versaoAtual,
  novaVersaoSugerida,
  dadosAtuais,
  novosDados,
  hashArquivoOriginal,
  onClose,
  onSuccess,
}: ItDiffModalProps) {
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    if (!confirmado) {
      toast.error('É obrigatório marcar a confirmação de conformidade jurídica.');
      return;
    }
    if (!motivo.trim()) {
      toast.error('Informe o motivo ou provimento da alteração para registro no log de auditoria.');
      return;
    }

    setSalvando(true);
    try {
      const res = await salvarNovaVersaoComDiff({
        itId,
        novaVersao: novaVersaoSugerida,
        objetivo: novosDados.objetivo,
        quandoUsar: novosDados.quandoUsar,
        procedimento: novosDados.procedimento,
        checklist: novosDados.checklist,
        errosComuns: novosDados.errosComuns,
        motivo,
      });

      toast.success(`Versão ${novaVersaoSugerida} registrada com sucesso! Hash WORM gravado.`);
      onSuccess(novaVersaoSugerida);
    } catch (err: any) {
      toast.error('Erro ao salvar nova versão: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header Escuro com Metadados */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0A0F1D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-wider">{codigo}</span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400">Comparador de Versões WORM</span>
              </div>
              <h2 className="text-base font-bold text-white truncate max-w-xl">{titulo}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono">
              <span className="text-slate-400">v{versaoAtual}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">v{novaVersaoSugerida}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Split View em Canvas Claro A4 */}
        <div className="p-6 bg-slate-950/60 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna Esquerda: Versão Atual */}
            <div className="bg-[#FAF9F6] border border-slate-300/80 rounded-xl p-5 text-slate-900 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Versão Atual (v{versaoAtual})
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                  Ativa no Cartório
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Objetivo:</h4>
                  <p className="text-slate-800 bg-white/70 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    {dadosAtuais.objetivo || 'Não informado.'}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Quando Usar:</h4>
                  <p className="text-slate-800 bg-white/70 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    {dadosAtuais.quandoUsar || 'Rotina diária do departamento.'}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Passo a Passo de Bancada:
                  </h4>
                  <div className="space-y-2">
                    {(dadosAtuais.procedimento || []).map((p, idx) => (
                      <div key={idx} className="bg-white/70 p-2 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-900">
                          {p.ordem}. {p.titulo}:
                        </span>{' '}
                        <span className="text-slate-700">{p.desc}</span>
                      </div>
                    ))}
                    {(!dadosAtuais.procedimento || dadosAtuais.procedimento.length === 0) && (
                      <p className="text-slate-500 italic">Nenhum passo anterior registrado.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Nova Versão Detectada */}
            <div className="bg-[#FAF9F6] border-2 border-emerald-500/40 rounded-xl p-5 text-slate-900 shadow-md relative">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Nova Versão (v{novaVersaoSugerida})
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  Proposta pela IA / Uploader
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Novo Objetivo:
                  </h4>
                  <p className="text-slate-900 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                    {novosDados.objetivo}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Quando Usar:</h4>
                  <p className="text-slate-900 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                    {novosDados.quandoUsar || 'Rotina operacional atualizada.'}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Novo Procedimento (Destaque das Etapas):
                  </h4>
                  <div className="space-y-2">
                    {novosDados.procedimento.map((p, idx) => (
                      <div
                        key={idx}
                        className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 hover:border-emerald-400 transition-colors"
                      >
                        <span className="font-bold text-emerald-900">
                          {p.ordem}. {p.titulo}:
                        </span>{' '}
                        <span className="text-slate-800">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {novosDados.checklist && novosDados.checklist.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                      Checklist Atualizado:
                    </h4>
                    <ul className="list-disc pl-4 space-y-1 text-slate-800">
                      {novosDados.checklist.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Confirmação e Registro de Auditoria */}
        <div className="p-6 bg-[#0A0F1D] border-t border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Motivo da Alteração / Base Jurídica (Obrigatório para Auditoria do CNJ):
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Atualização do procedimento de qualificação registral conforme Provimento CGJ nº 150/2026..."
              className="w-full h-20 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span>
                Confirmo a atualização das rotinas e geração da versão{' '}
                <strong className="text-emerald-400 font-mono">v{novaVersaoSugerida}</strong> com carimbo imutável WORM.
              </span>
            </label>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={salvando}
                className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={salvando || !confirmado || !motivo.trim()}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs shadow-lg shadow-emerald-500/20"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Gravando WORM...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1.5" /> Confirmar e Gerar v{novaVersaoSugerida}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
