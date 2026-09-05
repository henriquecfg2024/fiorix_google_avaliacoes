'use client';

import React from 'react';
import { X, Layers, Clock, CheckCircle2, AlertTriangle, XCircle, ArrowUpDown } from 'lucide-react';
import { BatchHistoryItem } from '@/lib/health/operations-service';

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Concluído
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl rounded-2xl border border-white/12 bg-[#0B1020]/95 p-6 shadow-2xl backdrop-blur-2xl text-white space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Histórico de Lotes — {moduleName}
              </h3>
              <p className="text-xs text-white/50">
                Últimos lotes recebidos via conector para a fonte <span className="font-mono text-white/80">{moduleKey}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabela de Lotes */}
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          {batches && batches.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0B1020] border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                <tr>
                  <th className="pb-3 pt-1">Identificador</th>
                  <th className="pb-3 pt-1">Horário</th>
                  <th className="pb-3 pt-1">Registros</th>
                  <th className="pb-3 pt-1">Duração</th>
                  <th className="pb-3 pt-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 font-mono text-white/80">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-[11px] text-white/50">
                      {batch.batchId ? `${batch.batchId.slice(0, 8)}...${batch.batchId.slice(-4)}` : batch.id}
                    </td>
                    <td className="py-3 text-white/90">
                      {batch.receivedAt}
                    </td>
                    <td className="py-3 font-semibold text-emerald-400">
                      {batch.recordsReceived.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-white/60">
                      {batch.durationMs !== null ? `${(batch.durationMs / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="py-3 text-right">
                      {getStatusBadge(batch.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-white/40 text-xs space-y-2">
              <Clock className="h-8 w-8 mx-auto text-white/20" />
              <p>Nenhum lote recente registrado para esta fonte nas últimas 24 horas.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/8 text-xs text-white/40">
          <span>Total de lotes listados: {batches?.length ?? 0}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
