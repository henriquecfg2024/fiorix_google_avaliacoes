'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plug,
  History,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  TestTube2,
  PowerOff,
  Eye,
  EyeOff,
  Save,
  Shield,
  Clock,
  RefreshCw,
  Loader2,
  Star,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Aba = 'integracoes' | 'parametros' | 'historico';
type IntegrationStatus = 'CONNECTED' | 'ATTENTION' | 'DISCONNECTED' | 'UNCONFIGURED';

interface IntegrationRecord {
  id: string;
  integrationId: string;
  displayName: string;
  status: IntegrationStatus;
  configMask: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestLatency: number | null;
  lastSyncAt: string | null;
  configuredAt: string | null;
  configuredBy: string | null;
  slaMinutes: number;
  syncIntervalMin: number;
  maxFailures: number;
  maxGapMinutes: number;
  isActive: boolean;
}

interface AuditRecord {
  id: string;
  action: string;
  target: string;
  actorUserName: string;
  result: string;
  detail: string | null;
  createdAt: string;
}

interface GoogleConnectionInfo {
  status: string;
  configuredAt: string;
  updatedAt: string;
}

interface Props {
  initialTab?: string;
  userName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatDateTimeBR(isoStr: string | null): string {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch { return '—'; }
}

function timeAgoBR(isoStr: string | null): string {
  if (!isoStr) return '—';
  try {
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `Há ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Há ${Math.floor(diff / 3600000)}h`;
    return formatDateTimeBR(isoStr);
  } catch { return '—'; }
}

const STATUS_MAP: Record<IntegrationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  CONNECTED: { label: 'Conectada', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  ATTENTION: { label: 'Atenção', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <AlertTriangle className="w-3 h-3" /> },
  DISCONNECTED: { label: 'Indisponível', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: <XCircle className="w-3 h-3" /> },
  UNCONFIGURED: { label: 'Não configurada', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <HelpCircle className="w-3 h-3" /> },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function ParametrosClient({ initialTab, userName }: Props) {
  const [activeAba, setActiveAba] = useState<Aba>(
    (initialTab === 'integracoes' || initialTab === 'parametros' || initialTab === 'historico') ? initialTab : 'integracoes'
  );

  // Estado dos dados reais
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionInfo | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // NextQS Config Modal
  const [showNextqsModal, setShowNextqsModal] = useState(false);
  const [nextqsForm, setNextqsForm] = useState({
    apiUrl: '', orgId: '', apiKey: '', webhookSecret: '', syncIntervalMin: '30',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Parâmetros operacionais
  const [slaMinutos, setSlaMinutos] = useState('15');
  const [syncInterval, setSyncInterval] = useState('30');
  const [maxFalhasAlerta, setMaxFalhasAlerta] = useState('3');
  const [maxJanelaSemSync, setMaxJanelaSemSync] = useState('120');
  const [paramSaved, setParamSaved] = useState(false);
  const [isSavingParams, setIsSavingParams] = useState(false);

  // Carregar dados do servidor
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/integrations');
      if (!res.ok) throw new Error('Falha ao carregar');
      const data = await res.json();
      setIntegrations(data.integrations || []);
      setGoogleConnection(data.googleConnection || null);
      setAuditLogs(data.auditLogs || []);

      // Sincronizar parâmetros operacionais do NextQS se existir
      const nextqs = (data.integrations || []).find((i: IntegrationRecord) => i.integrationId === 'nextqs');
      if (nextqs) {
        setSlaMinutos(String(nextqs.slaMinutes));
        setSyncInterval(String(nextqs.syncIntervalMin));
        setMaxFalhasAlerta(String(nextqs.maxFailures));
        setMaxJanelaSemSync(String(nextqs.maxGapMinutes));
      }
    } catch (err) {
      console.error('Erro ao carregar integrações:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Encontrar NextQS nos dados carregados
  const nextqsRecord = integrations.find((i) => i.integrationId === 'nextqs');
  const nextqsStatus: IntegrationStatus = nextqsRecord?.status || 'UNCONFIGURED';
  const nextqsIsConfigured = nextqsRecord && nextqsRecord.status !== 'UNCONFIGURED';

  // Salvar credenciais NextQS
  const handleSaveNextqs = useCallback(async (andTest: boolean) => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'nextqs',
          displayName: 'NextQS',
          config: {
            apiUrl: nextqsForm.apiUrl,
            orgId: nextqsForm.orgId,
            apiKey: nextqsForm.apiKey,
            webhookSecret: nextqsForm.webhookSecret,
            syncIntervalMin: nextqsForm.syncIntervalMin,
          },
          andTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error || 'Erro ao salvar.' });
        return;
      }

      if (data.testResult) {
        setTestResult(data.testResult);
      } else {
        setTestResult({ ok: true, message: 'Parâmetros salvos com sucesso.' });
      }

      // Limpar campos sensíveis do form
      setNextqsForm((f) => ({ ...f, apiKey: '', webhookSecret: '' }));

      // Recarregar dados
      await fetchData();
    } catch (err) {
      setTestResult({ ok: false, message: 'Erro de rede ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  }, [nextqsForm, fetchData]);

  // Testar conexão isolada
  const handleTestConnection = useCallback(async (integrationId: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', integrationId }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setTestResult({ ok: false, message: data.error || 'Aguarde antes de testar novamente.' });
      } else {
        setTestResult({ ok: data.ok, message: data.message || 'Teste concluído.' });
      }
      await fetchData();
    } catch {
      setTestResult({ ok: false, message: 'Erro de rede ao testar.' });
    } finally {
      setIsTesting(false);
    }
  }, [fetchData]);

  // Salvar parâmetros operacionais
  const handleSaveParams = useCallback(async () => {
    setIsSavingParams(true);
    setParamSaved(false);
    try {
      const res = await fetch('/api/v1/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_params',
          integrationId: 'nextqs',
          params: {
            slaMinutes: Number(slaMinutos),
            syncIntervalMin: Number(syncInterval),
            maxFailures: Number(maxFalhasAlerta),
            maxGapMinutes: Number(maxJanelaSemSync),
          },
        }),
      });
      if (res.ok) {
        setParamSaved(true);
        setTimeout(() => setParamSaved(false), 3000);
        await fetchData();
      }
    } catch {
      console.error('Erro ao salvar parâmetros.');
    } finally {
      setIsSavingParams(false);
    }
  }, [slaMinutos, syncInterval, maxFalhasAlerta, maxJanelaSemSync, fetchData]);

  // Desativar integração
  const handleDeactivate = useCallback(async (integrationId: string) => {
    if (!confirm('Deseja realmente desativar esta integração?')) return;
    try {
      await fetch('/api/v1/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', integrationId }),
      });
      await fetchData();
    } catch {
      console.error('Erro ao desativar.');
    }
  }, [fetchData]);

  const abasDef: { key: Aba; label: string; icon: React.ReactNode }[] = [
    { key: 'integracoes', label: 'Integrações', icon: <Plug className="w-3.5 h-3.5" /> },
    { key: 'parametros', label: 'Parâmetros operacionais', icon: <Settings2 className="w-3.5 h-3.5" /> },
    { key: 'historico', label: 'Histórico e auditoria', icon: <History className="w-3.5 h-3.5" /> },
  ];

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Breadcrumb + Header */}
        <div className="pb-4 border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span className="text-slate-600">/</span>
            <span>Sistema</span>
            <span className="text-slate-600">/</span>
            <Link href="/configuracoes" className="hover:text-white transition-colors">Configurações</Link>
            <span className="text-slate-600">/</span>
            <span className="text-amber-300">Parâmetros</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>SISTEMA & TECNOLOGIA</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Parâmetros</h1>
              <p className="text-xs text-white/50 mt-1">Configure as integrações e os parâmetros operacionais da sua organização.</p>
            </div>
            <Link href="/configuracoes" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar para Configurações</span>
            </Link>
          </div>
        </div>

        {/* Abas */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 pb-2">
          {abasDef.map((a) => (
            <button key={a.key} type="button" onClick={() => setActiveAba(a.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeAba === a.key
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25 border border-amber-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}>
              {a.icon}{a.label}
            </button>
          ))}
        </div>

        {/* ═══ ABA: INTEGRAÇÕES ═══ */}
        {activeAba === 'integracoes' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-slate-400">
              Gerencie as integrações externas da sua organização. A arquitetura suporta conectores futuros (SIPLAN, SMTP, WhatsApp, etc.).
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Card NextQS ── */}
              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/[0.01] rounded-full -mr-8 -mt-8 pointer-events-none" />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <Layers className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">NextQS</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Gestão de filas, senhas e indicadores de espera.</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${STATUS_MAP[nextqsStatus].color}`}>
                    {STATUS_MAP[nextqsStatus].icon}
                    {STATUS_MAP[nextqsStatus].label}
                  </span>
                </div>

                {/* Metadados (apenas se configurada) */}
                {nextqsIsConfigured && nextqsRecord && (
                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                    {nextqsRecord.lastSyncAt && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Última sinc.: {timeAgoBR(nextqsRecord.lastSyncAt)}
                      </span>
                    )}
                    {nextqsRecord.configuredAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Configurado em: {formatDateTimeBR(nextqsRecord.configuredAt)}
                      </span>
                    )}
                    {nextqsRecord.lastTestLatency && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Latência: {nextqsRecord.lastTestLatency}ms
                      </span>
                    )}
                    {nextqsRecord.configMask && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Chave: {nextqsRecord.configMask}
                      </span>
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
                  {!nextqsIsConfigured ? (
                    <button type="button" onClick={() => { setShowNextqsModal(true); setTestResult(null); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer">
                      <Settings2 className="w-3.5 h-3.5" /><span>Configurar</span>
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setShowNextqsModal(true); setTestResult(null); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer">
                        <Settings2 className="w-3.5 h-3.5" /><span>Gerenciar conexão</span>
                      </button>
                      <button type="button" onClick={() => handleTestConnection('nextqs')} disabled={isTesting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40">
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                        <span>{isTesting ? 'Testando...' : 'Testar conexão'}</span>
                      </button>
                      <button type="button" onClick={() => handleDeactivate('nextqs')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer">
                        <PowerOff className="w-3.5 h-3.5" /><span>Desativar</span>
                      </button>
                    </>
                  )}
                </div>

                {testResult && (
                  <div className={`rounded-xl border p-3 text-xs ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                    {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" /> : <XCircle className="w-3.5 h-3.5 inline mr-1.5" />}
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* ── Card Google Avaliações ── */}
              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/[0.01] rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <Star className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Google Avaliações</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Integração com Google Meu Negócio e reputação.</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                    googleConnection ? STATUS_MAP.CONNECTED.color : STATUS_MAP.UNCONFIGURED.color
                  }`}>
                    {googleConnection ? STATUS_MAP.CONNECTED.icon : STATUS_MAP.UNCONFIGURED.icon}
                    {googleConnection ? 'Conectada' : 'Não configurada'}
                  </span>
                </div>

                {googleConnection && (
                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Configurado em: {formatDateTimeBR(googleConnection.configuredAt)}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
                  <Link href="/configuracoes" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all">
                    <ExternalLink className="w-3.5 h-3.5" /><span>Gerenciar conexão</span>
                  </Link>
                </div>
              </div>

              {/* Card placeholder */}
              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.01] backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/8">
                  <Plug className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">Mais integrações em breve</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">SIPLAN · SMTP · WhatsApp · Conectores customizados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ABA: PARÂMETROS OPERACIONAIS ═══ */}
        {activeAba === 'parametros' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Gestão de Espera / NextQS</h3>
                {!nextqsIsConfigured && (
                  <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">Configure o NextQS primeiro</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">SLA padrão de espera (minutos)</label>
                  <p className="text-[10px] text-slate-500">Senha dentro do SLA quando chamada em até o limite configurado, inclusive.</p>
                  <input type="number" min="1" max="120" value={slaMinutos} onChange={(e) => setSlaMinutos(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Intervalo de sincronização (minutos)</label>
                  <p className="text-[10px] text-slate-500">Frequência com que o FIORIX consulta a API do NextQS.</p>
                  <input type="number" min="5" max="1440" value={syncInterval} onChange={(e) => setSyncInterval(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Falhas consecutivas antes de alerta</label>
                  <p className="text-[10px] text-slate-500">Número de falhas consecutivas para gerar alerta na Central de Operações.</p>
                  <input type="number" min="1" max="20" value={maxFalhasAlerta} onChange={(e) => setMaxFalhasAlerta(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Janela máxima sem sincronização (minutos)</label>
                  <p className="text-[10px] text-slate-500">Tempo máximo aceitável sem dados antes de marcar como indisponível.</p>
                  <input type="number" min="10" max="10080" value={maxJanelaSemSync} onChange={(e) => setMaxJanelaSemSync(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                <button type="button" onClick={handleSaveParams} disabled={isSavingParams}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-40">
                  {isSavingParams ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar parâmetros</span>
                </button>
                {paramSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in duration-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />Salvo com sucesso
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-indigo-500/15 bg-indigo-500/5 backdrop-blur-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-indigo-300">Segurança e isolamento</h4>
              </div>
              <p className="text-[11px] text-indigo-200/70 leading-relaxed">
                Todos os parâmetros são isolados por organização/tenant. Credenciais são criptografadas no servidor antes de persistir. Valores mascarados são exibidos na interface — nunca a credencial original. Alterações são registradas na aba de auditoria.
              </p>
            </div>
          </div>
        )}

        {/* ═══ ABA: HISTÓRICO E AUDITORIA ═══ */}
        {activeAba === 'historico' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Registro de Auditoria</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">{auditLogs.length} registros</span>
                  <button type="button" onClick={fetchData} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
                  Nenhum registro de auditoria encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                      <tr>
                        <th className="py-3 px-4">Data/hora</th>
                        <th className="py-3 px-3">Ação</th>
                        <th className="py-3 px-3">Alvo</th>
                        <th className="py-3 px-3">Responsável</th>
                        <th className="py-3 px-3">Resultado</th>
                        <th className="py-3 px-4">Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6 text-slate-300">
                      {auditLogs.map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{formatDateTimeBR(rec.createdAt)}</td>
                          <td className="py-3 px-3 text-white font-semibold">{rec.action}</td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{rec.target}</span>
                          </td>
                          <td className="py-3 px-3 text-white">{rec.actorUserName}</td>
                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              rec.result === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : rec.result === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {rec.result === 'success' ? 'Sucesso' : rec.result === 'warning' ? 'Atenção' : 'Falha'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{rec.detail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══ MODAL: Configuração NextQS ═══ */}
      {showNextqsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNextqsModal(false)} />
          <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl">
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/10 bg-[#0B1020]/95 backdrop-blur-xl rounded-t-[24px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <Layers className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{nextqsIsConfigured ? 'Gerenciar NextQS' : 'Configurar NextQS'}</h2>
                  <p className="text-[11px] text-slate-400">Gestão de filas, senhas e indicadores de espera.</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info de máscara para configurações existentes */}
              {nextqsIsConfigured && nextqsRecord?.configMask && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Credencial salva e ativa: <span className="font-mono font-bold text-white">{nextqsRecord.configMask}</span> — preencha o campo abaixo apenas se desejar alterá-la.</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">URL / Base da API</label>
                <input type="url" value={nextqsForm.apiUrl} onChange={(e) => setNextqsForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  placeholder="https://api.nextqs.com.br/v1"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Identificador da unidade / organização</label>
                <input type="text" value={nextqsForm.orgId} onChange={(e) => setNextqsForm((f) => ({ ...f, orgId: e.target.value }))}
                  placeholder="Ex: cartorio-1ri-sp"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Token / Chave de API</label>
                <div className="relative">
                  <input type={showApiKey ? 'text' : 'password'} value={nextqsForm.apiKey}
                    onChange={(e) => setNextqsForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder="Cole a chave de autenticação"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono" />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" />Após salvar, somente o valor mascarado será exibido.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Segredo de webhook <span className="text-slate-500 normal-case">(opcional)</span></label>
                <div className="relative">
                  <input type={showWebhookSecret ? 'text' : 'password'} value={nextqsForm.webhookSecret}
                    onChange={(e) => setNextqsForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    placeholder="Segredo para validação de webhooks"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono" />
                  <button type="button" onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Intervalo de sincronização (minutos)</label>
                <input type="number" min="5" max="1440" value={nextqsForm.syncIntervalMin}
                  onChange={(e) => setNextqsForm((f) => ({ ...f, syncIntervalMin: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono" />
              </div>

              {testResult && (
                <div className={`rounded-xl border p-3 text-xs ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                  {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" /> : <XCircle className="w-3.5 h-3.5 inline mr-1.5" />}
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 px-6 py-4 border-t border-white/10 bg-[#0B1020]/95 backdrop-blur-xl rounded-b-[24px] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleSaveNextqs(false)} disabled={isSaving || isTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-40">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar parâmetros</span>
                </button>
                <button type="button" onClick={() => handleSaveNextqs(true)} disabled={isSaving || isTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-40">
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                  <span>Salvar e testar conexão</span>
                </button>
              </div>
              <button type="button" onClick={() => setShowNextqsModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
