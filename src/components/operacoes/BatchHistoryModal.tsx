'use client';

import React from 'react';
import { X, Layers, Clock, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import type { BatchHistoryItem } from '@/lib/health/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  moduleKey: string;
  batches: BatchHistoryItem[];
}

export function BatchHistoryModal({ isOpen, onClose, moduleName, moduleKey, batches }: Props) {
  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            <CheckCircle2 className="h-3 w-3" />
            OK
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg h-full border-l border-[#1E293B] bg-[#111729] p-6 shadow-2xl text-[#F1F5F9] flex flex-col justify-between animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#3B82F6]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-[#F1F5F9] flex items-center gap-2">
                Histórico de Lotes
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {moduleName} • <span className="font-mono text-[#F1F5F9]">{moduleKey}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#151A2C] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lotes List / Table */}
        <div className="flex-1 overflow-y-auto my-4 pr-1">
          {batches && batches.length > 0 ? (
            <div className="space-y-2.5">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="p-3 rounded-xl bg-[#070A14] border border-[#1E293B] hover:border-slate-700 transition-colors flex items-center justify-between text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#94A3B8] font-sans font-medium">
                        {batch.batchId ? `${batch.batchId.slice(0, 8)}...` : batch.id}
                      </span>
                      {getStatusBadge(batch.status)}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {batch.receivedAt}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="font-semibold text-[#10B981] block">
                      {batch.recordsReceived.toLocaleString('pt-BR')} reg{batch.recordsReceived > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-[#64748B] block font-sans">
                      {batch.durationMs !== null ? `${(batch.durationMs / 1000).toFixed(2)}s` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-[#64748B] text-xs space-y-2">
              <Clock className="h-8 w-8 mx-auto text-[#1E293B]" />
              <p>Nenhum lote recente registrado nas últimas 24 horas.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1E293B] text-xs text-[#94A3B8]">
          <span>Total: <strong className="text-[#F1F5F9] font-mono">{batches?.length ?? 0}</strong> lotes</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] border border-[#1E293B] text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
