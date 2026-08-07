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
      const timeoutId = window.setTimeout(() => controller.abort(), 45_000);

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
        ? 'A sincronização excedeu 45 segundos. O Google não respondeu a tempo; tente novamente.'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          style={{
            background: isSyncing ? '#93c5fd' : '#2563eb',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw
            size={16}
            style={{
              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {isSyncing ? 'SINCRONIZANDO COM AVALIAÇÕES DO GOOGLE' : 'Sincronizar Avaliações Agora'}
        </button>
      </div>

      {syncResult && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: syncResult.success ? '#dcfce7' : '#fee2e2',
            color: syncResult.success ? '#166534' : '#991b1b',
            border: `1px solid ${syncResult.success ? '#86efac' : '#fca5a5'}`,
            marginTop: '4px',
          }}
        >
          {syncResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{syncResult.message}</span>
        </div>
      )}

      {/* Embedded CSS animation for spin */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
