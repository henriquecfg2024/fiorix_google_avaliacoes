'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 50_000);

      const res = await fetch('/api/sync-reviews', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`Servidor retornou erro ${res.status}: ${res.statusText}`);
      }

      if (res.ok && data.success !== false) {
        const count = data.count ?? 0;
        setSyncResult({
          success: true,
          message: `Sincronização concluída com sucesso! ${count} avaliações obtidas do Google.`,
        });
      } else {
        const errMsg = data?.error;
        let finalMsg = 'Erro ao comunicar com a API do Google.';
        if (typeof errMsg === 'string') {
          finalMsg = errMsg;
        } else if (errMsg && typeof errMsg === 'object') {
          finalMsg = errMsg.message || JSON.stringify(errMsg);
        }
        setSyncResult({
          success: false,
          message: finalMsg,
        });
      }
    } catch (err: any) {
      console.error('Sync error caught in button:', err);
      const errMsg = err?.name === 'AbortError'
        ? 'A sincronização excedeu 50 segundos. O Google não respondeu a tempo; tente novamente.'
        : err?.message || err;
      let finalMsg = 'Erro de conexão ao sincronizar avaliações.';
      if (typeof errMsg === 'string') {
        finalMsg = errMsg;
      } else if (errMsg && typeof errMsg === 'object') {
        finalMsg = errMsg.message || JSON.stringify(errMsg);
      }
      setSyncResult({
        success: false,
        message: finalMsg,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-semibold transition-all shadow-md shadow-blue-600/20 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={16}
            className={isSyncing ? 'animate-spin' : ''}
          />
          {isSyncing ? 'Sincronizando com Google...' : 'Sincronizar Avaliações Agora'}
        </button>
      </div>

      {syncResult && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            syncResult.success
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          {syncResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{syncResult.message}</span>
        </div>
      )}
    </div>
  );
}
