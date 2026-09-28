'use client';

import React, { useState, useCallback } from 'react';
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
  Power,
  PowerOff,
  Eye,
  EyeOff,
  Save,
  Shield,
  Clock,
  RefreshCw,
  Loader2,
  ChevronRight,
  Star,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Aba = 'integracoes' | 'parametros' | 'historico';

type IntegrationStatus = 'connected' | 'attention' | 'disconnected' | 'unconfigured';

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  statusLabel: string;
  icon: React.ReactNode;
  lastSync?: string;
  configuredAt?: string;
}

interface AuditRecord {
  id: string;
  action: string;
  target: string;
  user: string;
  timestamp: string;
  result: 'success' | 'failure' | 'warning';
  detail: string;
}

interface Props {
  initialTab?: string;
  userName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS DEMONSTRATIVOS
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'nextqs',
    name: 'NextQS',
    description: 'Gestão de filas, senhas e indicadores de espera.',
    status: 'unconfigured',
    statusLabel: 'Não configurada',
    icon: <Layers className="w-5 h-5 text-indigo-400" />,
  },
  {
    id: 'google-reviews',
    name: 'Google Avaliações',
    description: 'Integração com Google Meu Negócio e reputação.',
    status: 'connected',
    statusLabel: 'Conectada',
    icon: <Star className="w-5 h-5 text-amber-400" />,
    lastSync: 'Há 12 minutos',
    configuredAt: '15/09/2026',
  },
];

const DEMO_AUDIT: AuditRecord[] = [
  { id: 'a1', action: 'Teste de conexão', target: 'Google Avaliações', user: 'Henrique', timestamp: '28/09/2026 14:32', result: 'success', detail: 'Conexão validada com sucesso (latência: 142ms).' },
  { id: 'a2', action: 'Alteração de parâmetro', target: 'SLA de Espera', user: 'Henrique', timestamp: '27/09/2026 09:15', result: 'success', detail: 'SLA alterado de 20 min para 15 min.' },
  { id: 'a3', action: 'Teste de conexão', target: 'NextQS', user: 'Ana Paula', timestamp: '26/09/2026 16:44', result: 'failure', detail: 'Timeout na conexão (>5000ms). Verifique as credenciais e a disponibilidade do serviço.' },
  { id: 'a4', action: 'Criação de integração', target: 'Google Avaliações', user: 'Henrique', timestamp: '15/09/2026 10:00', result: 'success', detail: 'Integração configurada e conexão validada.' },
  { id: 'a5', action: 'Alteração de parâmetro', target: 'Intervalo de sincronização', user: 'Henrique', timestamp: '14/09/2026 08:30', result: 'success', detail: 'Intervalo alterado de 60 min para 30 min.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function maskValue(value: string): string {
  if (!value || value.length < 6) return '••••••••';
  return '••••••••' + value.slice(-4);
}

function StatusBadge({ status, label }: { status: IntegrationStatus; label: string }) {
  const colors: Record<IntegrationStatus, string> = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    attention: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    disconnected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    unconfigured: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  const icons: Record<IntegrationStatus, React.ReactNode> = {
    connected: <CheckCircle2 className="w-3 h-3" />,
    attention: <AlertTriangle className="w-3 h-3" />,
    disconnected: <XCircle className="w-3 h-3" />,
    unconfigured: <HelpCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${colors[status]}`}>
      {icons[status]}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function ParametrosClient({ initialTab, userName }: Props) {
  const [activeAba, setActiveAba] = useState<Aba>(
    (initialTab === 'integracoes' || initialTab === 'parametros' || initialTab === 'historico') ? initialTab : 'integracoes'
  );

  // NextQS Config Modal
  const [showNextqsModal, setShowNextqsModal] = useState(false);
  const [nextqsForm, setNextqsForm] = useState({
    apiUrl: '',
    orgId: '',
    apiKey: '',
    webhookSecret: '',
    syncIntervalMin: '30',
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

  const handleTestConnection = useCallback(async (integrationId: string) => {
    setIsTesting(true);
    setTestResult(null);
    // Simulação de teste
    await new Promise((r) => setTimeout(r, 1800));
    if (integrationId === 'google-reviews') {
      setTestResult({ ok: true, message: 'Conexão validada com sucesso (latência: 138ms).' });
    } else {
      setTestResult({ ok: false, message: 'Não foi possível conectar. Verifique as credenciais e a URL da API.' });
    }
    setIsTesting(false);
  }, []);

  const handleSaveNextqs = useCallback(async (andTest: boolean) => {
    setIsSaving(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSaving(false);

    if (andTest) {
      setIsTesting(true);
      await new Promise((r) => setTimeout(r, 1800));
      if (nextqsForm.apiUrl && nextqsForm.apiKey) {
        setTestResult({ ok: true, message: 'Parâmetros salvos e conexão validada com sucesso.' });
      } else {
        setTestResult({ ok: false, message: 'Parâmetros salvos, mas a conexão falhou. Verifique os dados informados.' });
      }
      setIsTesting(false);
    } else {
      setTestResult({ ok: true, message: 'Parâmetros salvos com sucesso. A conexão não foi testada.' });
    }
  }, [nextqsForm]);

  const handleSaveParams = useCallback(() => {
    setParamSaved(true);
    setTimeout(() => setParamSaved(false), 3000);
  }, []);

  const abas: { key: Aba; label: string; icon: React.ReactNode }[] = [
    { key: 'integracoes', label: 'Integrações', icon: <Plug className="w-3.5 h-3.5" /> },
    { key: 'parametros', label: 'Parâmetros operacionais', icon: <Settings2 className="w-3.5 h-3.5" /> },
    { key: 'historico', label: 'Histórico e auditoria', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
      {/* Background */}
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Parâmetros
              </h1>
              <p className="text-xs text-white/50 mt-1">
                Configure as integrações e os parâmetros operacionais da sua organização.
              </p>
            </div>
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar para Configurações</span>
            </Link>
          </div>
        </div>

        {/* Abas */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 pb-2">
          {abas.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setActiveAba(a.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeAba === a.key
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25 border border-amber-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ABA: INTEGRAÇÕES
        ═══════════════════════════════════════════════════════════════════ */}
        {activeAba === 'integracoes' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-slate-400">
              Gerencie as integrações externas da sua organização. A arquitetura suporta conectores futuros (SIPLAN, SMTP, WhatsApp, etc.).
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {DEMO_INTEGRATIONS.map((integration) => (
                <div
                  key={integration.id}
                  className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-white/[0.01] rounded-full -mr-8 -mt-8 pointer-events-none" />

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                        {integration.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{integration.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{integration.description}</p>
                      </div>
                    </div>
                    <StatusBadge status={integration.status} label={integration.statusLabel} />
                  </div>

                  {/* Metadados */}
                  {(integration.lastSync || integration.configuredAt) && (
                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                      {integration.lastSync && (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Última sinc.: {integration.lastSync}
                        </span>
                      )}
                      {integration.configuredAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Configurado em: {integration.configuredAt}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
                    {integration.id === 'nextqs' && integration.status === 'unconfigured' && (
                      <button
                        type="button"
                        onClick={() => { setShowNextqsModal(true); setTestResult(null); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Configurar</span>
                      </button>
                    )}

                    {integration.id === 'nextqs' && integration.status !== 'unconfigured' && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setShowNextqsModal(true); setTestResult(null); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Configurar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('nextqs')}
                          disabled={isTesting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                        >
                          <TestTube2 className="w-3.5 h-3.5" />
                          <span>Testar conexão</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          <span>Desativar</span>
                        </button>
                      </>
                    )}

                    {integration.id === 'google-reviews' && (
                      <>
                        <Link
                          href="/configuracoes"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Gerenciar conexão</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('google-reviews')}
                          disabled={isTesting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                        >
                          {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                          <span>{isTesting ? 'Testando...' : 'Testar conexão'}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Resultado do teste inline */}
                  {testResult && (
                    <div className={`rounded-xl border p-3 text-xs ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" /> : <XCircle className="w-3.5 h-3.5 inline mr-1.5" />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              ))}

              {/* Card placeholder para futuras integrações */}
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

        {/* ═══════════════════════════════════════════════════════════════════
            ABA: PARÂMETROS OPERACIONAIS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeAba === 'parametros' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Seção: Gestão de Espera / NextQS */}
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Gestão de Espera / NextQS</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* SLA de espera */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                    SLA padrão de espera (minutos)
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Senha dentro do SLA quando chamada em até o limite configurado, inclusive.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={slaMinutos}
                    onChange={(e) => setSlaMinutos(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                  />
                </div>

                {/* Intervalo de sincronização */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                    Intervalo de sincronização (minutos)
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Frequência com que o FIORIX consulta a API do NextQS.
                  </p>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                  />
                </div>

                {/* Falhas consecutivas */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                    Falhas consecutivas antes de alerta
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Número de falhas consecutivas para gerar alerta na Central de Operações.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxFalhasAlerta}
                    onChange={(e) => setMaxFalhasAlerta(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                  />
                </div>

                {/* Janela máxima sem sincronização */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                    Janela máxima sem sincronização (minutos)
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Tempo máximo aceitável sem dados antes de marcar como indisponível.
                  </p>
                  <input
                    type="number"
                    min="10"
                    max="10080"
                    value={maxJanelaSemSync}
                    onChange={(e) => setMaxJanelaSemSync(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                <button
                  type="button"
                  onClick={handleSaveParams}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar parâmetros</span>
                </button>

                {paramSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in duration-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Salvo com sucesso
                  </span>
                )}
              </div>
            </div>

            {/* Informativo de segurança */}
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

        {/* ═══════════════════════════════════════════════════════════════════
            ABA: HISTÓRICO E AUDITORIA
        ═══════════════════════════════════════════════════════════════════ */}
        {activeAba === 'historico' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Registro de Auditoria</h3>
                </div>
                <span className="text-[11px] text-slate-500">{DEMO_AUDIT.length} registros</span>
              </div>

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
                    {DEMO_AUDIT.map((rec) => (
                      <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{rec.timestamp}</td>
                        <td className="py-3 px-3 text-white font-semibold">{rec.action}</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            {rec.target}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-white">{rec.user}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            rec.result === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : rec.result === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {rec.result === 'success' ? 'Sucesso' : rec.result === 'warning' ? 'Atenção' : 'Falha'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{rec.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Configuração NextQS
      ═══════════════════════════════════════════════════════════════════════ */}
      {showNextqsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowNextqsModal(false)}
          />

          {/* Conteúdo */}
          <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl">
            {/* Header do Modal */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/10 bg-[#0B1020]/95 backdrop-blur-xl rounded-t-[24px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <Layers className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Configurar NextQS</h2>
                  <p className="text-[11px] text-slate-400">Gestão de filas, senhas e indicadores de espera.</p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="p-6 space-y-5">
              {/* URL da API */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                  URL / Base da API
                </label>
                <input
                  type="url"
                  value={nextqsForm.apiUrl}
                  onChange={(e) => setNextqsForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  placeholder="https://api.nextqs.com.br/v1"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>

              {/* ID da Organização */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                  Identificador da unidade / organização
                </label>
                <input
                  type="text"
                  value={nextqsForm.orgId}
                  onChange={(e) => setNextqsForm((f) => ({ ...f, orgId: e.target.value }))}
                  placeholder="Ex: cartorio-1ri-sp"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>

              {/* Token / Chave de API */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                  Token / Chave de API
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={nextqsForm.apiKey}
                    onChange={(e) => setNextqsForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder="Cole a chave de autenticação"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Após salvar, somente o valor mascarado será exibido ({maskValue('exemplo1234ABCD')}).
                </p>
              </div>

              {/* Segredo de webhook */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                  Segredo de webhook <span className="text-slate-500 normal-case">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showWebhookSecret ? 'text' : 'password'}
                    value={nextqsForm.webhookSecret}
                    onChange={(e) => setNextqsForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    placeholder="Segredo para validação de webhooks"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Intervalo de sincronização */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                  Intervalo de sincronização (minutos)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={nextqsForm.syncIntervalMin}
                  onChange={(e) => setNextqsForm((f) => ({ ...f, syncIntervalMin: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all font-mono"
                />
              </div>

              {/* Resultado do teste */}
              {testResult && (
                <div className={`rounded-xl border p-3 text-xs ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                  {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" /> : <XCircle className="w-3.5 h-3.5 inline mr-1.5" />}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="sticky bottom-0 px-6 py-4 border-t border-white/10 bg-[#0B1020]/95 backdrop-blur-xl rounded-b-[24px] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveNextqs(false)}
                  disabled={isSaving || isTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Salvar parâmetros</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveNextqs(true)}
                  disabled={isSaving || isTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                  <span>Salvar e testar conexão</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowNextqsModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
