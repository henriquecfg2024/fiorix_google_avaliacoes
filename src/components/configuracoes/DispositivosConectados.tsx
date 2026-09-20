'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface DeviceItem {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
}

export function DispositivosConectados() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/push/subscribe');
      const data = await res.json();
      if (res.ok && data.devices) {
        setDevices(data.devices);
      }
    } catch {
      toast.error('Erro ao carregar lista de dispositivos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Deseja realmente revogar as notificações Push deste dispositivo?')) return;
    try {
      setRevokingId(id);
      const res = await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: id }),
      });

      if (res.ok) {
        toast.success('Dispositivo revogado com sucesso.');
        loadDevices();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Falha ao revogar.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center text-slate-400 text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white">Dispositivos Conectados (Web Push / PWA)</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Aparelhos autorizados a receber notificações corporativas em segundo plano.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
          {devices.filter((d) => d.isActive).length} ativo(s)
        </span>
      </div>

      {devices.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 rounded-2xl border border-white/5 bg-slate-950/20">
          Nenhum dispositivo registrado ainda para Web Push. Ative as notificações no painel acima para registrar este aparelho.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map((device) => {
            const isPwa = device.deviceName?.includes('(PWA)');
            const isMobile =
              device.deviceName?.toLowerCase().includes('iphone') ||
              device.deviceName?.toLowerCase().includes('android');

            return (
              <div
                key={device.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  device.isActive
                    ? 'bg-[#151C2F] border-white/10 shadow-sm'
                    : 'bg-white/[0.01] border-white/5 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                          device.isActive
                            ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-500 border-white/5'
                        }`}
                      >
                        {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {device.deviceName || 'Navegador Web'}
                          {isPwa && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              PWA
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {device.isActive ? (
                            <span className="text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                          ) : (
                            <span className="text-slate-500 inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Revogado
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {device.isActive && (
                      <button
                        onClick={() => handleRevoke(device.id)}
                        disabled={revokingId === device.id}
                        title="Revogar este dispositivo"
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition"
                      >
                        {revokingId === device.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 mt-3 pt-2 border-t border-white/5 font-mono">
                    <p>
                      Último uso:{' '}
                      <span className="text-slate-300">
                        {new Date(device.lastUsedAt).toLocaleString([], {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                    <p>
                      Inscrito em:{' '}
                      <span className="text-slate-300">
                        {new Date(device.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
