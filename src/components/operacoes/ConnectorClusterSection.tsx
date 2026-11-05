'use client';

import React, { useState } from 'react';
import {
  Server,
  Plus,
  ArrowLeftRight,
  PauseCircle,
  PlayCircle,
  Settings2,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  HardDrive,
  Database,
  FolderCheck,
  Sparkles,
  RefreshCw,
  Terminal,
  X,
  Eye,
  Trash2,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ConnectorClusterInfo,
  ConnectorClusterNodeSummary,
} from '@/lib/health/types';

interface Props {
  cluster?: ConnectorClusterInfo;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string) => void;
  onClusterMutated: () => Promise<void> | void;
}

interface EditableRoot {
  id: string;
  label: string;
  path: string;
}

const DEFAULT_CARTORIO_ROOTS: EditableRoot[] = [
  { id: 'minutas', label: 'Minutas & Usucapião', path: 'W:\\USUCAPIAO' },
  { id: 'processos', label: 'Processos E-mail', path: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL' },
  { id: 'imagens', label: 'Imagens & Matrículas', path: 'K:\\IMAGENS' },
  { id: 'livro2', label: 'Livro 2 — Transcrições', path: 'K:\\IMAGENS\\LV2' },
];

const UNC_SRVFILES_ROOTS: EditableRoot[] = [
  { id: 'minutas', label: 'Minutas & Usucapião', path: '\\\\srvfiles\\DEPTOS\\USUCAPIAO' },
  { id: 'processos', label: 'Processos E-mail', path: '\\\\srvfiles\\VOL1\\PROCESSOS - ENVIADOS POR E-MAIL' },
  { id: 'imagens', label: 'Imagens & Matrículas', path: '\\\\srvfiles\\IMAGENS\\IMAGENS' },
  { id: 'livro2', label: 'Livro 2 — Transcrições', path: '\\\\srvfiles\\IMAGENS\\IMAGENS\\LV2' },
];

export function ConnectorClusterSection({
  cluster,
  selectedConnectorId,
  onSelectConnector,
  onClusterMutated,
}: Props) {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Modal: Adicionar Servidor Connector (Padrão SaaS)
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollName, setEnrollName] = useState('SRVFILES — Principal');
  const [enrollRole, setEnrollRole] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');
  const [enrollLanUrl, setEnrollLanUrl] = useState('http://srvfiles:8765');
  const [enrollSqlHost, setEnrollSqlHost] = useState('localhost');
  const [enrollSqlDb, setEnrollSqlDb] = useState('WEBRI');
  const [enrollRoots, setEnrollRoots] = useState<EditableRoot[]>([]);
  const [generatedEnroll, setGeneratedEnroll] = useState<{
    rawToken: string;
    connectorName: string;
    initialState: 'ACTIVE' | 'STANDBY';
    expiresAt: string;
    installPs1Command: string;
    downloadBatUrl: string;
  } | null>(null);
  const [copiedPs1, setCopiedPs1] = useState(false);

  // Modal: Configuração Remota de um Nó
  const [editingNode, setEditingNode] = useState<ConnectorClusterNodeSummary | null>(null);
  const [cfgName, setCfgName] = useState('');
  const [cfgRole, setCfgRole] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');
  const [cfgLanUrl, setCfgLanUrl] = useState('');
  const [cfgSqlHost, setCfgSqlHost] = useState('');
  const [cfgSqlDb, setCfgSqlDb] = useState('');
  const [cfgNotes, setCfgNotes] = useState('');
  const [cfgRoots, setCfgRoots] = useState<EditableRoot[]>([]);

  const nodes = cluster?.nodes ?? [];
  const failoverMode = cluster?.failoverMode ?? 'MANUAL';
  const latestVersion = cluster?.latestReleaseVersion ?? null;
  const rollingUpdate = cluster?.rollingUpdate ?? null;

  const hasOutdatedOnlineNode = Boolean(
    latestVersion && nodes.some((n) => n.isOnline && n.version !== latestVersion),
  );

  async function postConnectorAction(payload: Record<string, unknown>, busyKey: string) {
    setBusyAction(busyKey);
    try {
      const res = await fetch('/api/v1/operacoes/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao executar comando.');
      }
      await onClusterMutated();
      return data;
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePromote(node: ConnectorClusterNodeSummary) {
    if (!node.isOnline) {
      const proceed = window.confirm(
        `O servidor "${node.name}" está sem sinal recente (${
          node.heartbeatAgoSeconds !== null ? `há ${node.heartbeatAgoSeconds}s` : 'offline'
        }). Deseja promovê-lo a ATIVO mesmo assim?`,
      );
      if (!proceed) return;
    }

    try {
      await postConnectorAction(
        { action: 'promote', connectorId: node.connectorId },
        `promote:${node.connectorId}`,
      );
      onSelectConnector(node.connectorId);
      toast.success(`Servidor Ativo alterado para ${node.name}`, {
        description:
          'Os demais servidores entraram automaticamente em Hot-Standby sem perda de cursores.',
      });
    } catch (err: any) {
      toast.error('Não foi possível alterar o Connector ativo', {
        description: err.message,
      });
    }
  }

  async function handlePause(node: ConnectorClusterNodeSummary) {
    const standbyCandidate = nodes.find(
      (n) =>
        n.connectorId !== node.connectorId &&
        n.operationalState === 'STANDBY' &&
        n.isOnline,
    );

    const confirmMsg =
      node.operationalState === 'ACTIVE'
        ? standbyCandidate
          ? `Colocar "${node.name}" em PAUSA / MANUTENÇÃO?\n\nO servidor reserva online "${standbyCandidate.name}" assumirá automaticamente como ATIVO sem interromper o cartório.`
          : `ATENÇÃO: Não há outro servidor em Hot-Standby online no momento.\n\nDeseja realmente PAUSAR "${node.name}" (Parada de Emergência)? As sincronizações SQL e buscas documentais ficarão retidas até reativá-lo.`
        : `Colocar "${node.name}" em modo PAUSADO / MANUTENÇÃO?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const result = await postConnectorAction(
        {
          action: 'pause',
          connectorId: node.connectorId,
          promoteStandbyIfActive: true,
        },
        `pause:${node.connectorId}`,
      );
      if (result.promotedConnectorId) {
        onSelectConnector(result.promotedConnectorId);
        toast.success(`${node.name} pausado · Reserva assumiu como ATIVO`, {
          description: 'Chaveamento automático concluído sem interrupção operacional.',
        });
      } else {
        toast.warning(`${node.name} colocado em Pausa / Manutenção`, {
          description: 'Sincronizações SQL e fila documental pausadas neste servidor.',
        });
      }
    } catch (err: any) {
      toast.error('Falha ao pausar servidor', { description: err.message });
    }
  }

  async function handleResume(node: ConnectorClusterNodeSummary) {
    try {
      const result = await postConnectorAction(
        { action: 'resume', connectorId: node.connectorId },
        `resume:${node.connectorId}`,
      );
      toast.success(`${node.name} reativado (${result.newState === 'ACTIVE' ? 'ATIVO' : 'HOT-STANDBY'})`, {
        description:
          result.newState === 'ACTIVE'
            ? 'Nenhum outro servidor estava ativo; este servidor assumiu a operação.'
            : 'Servidor pronto em Hot-Standby acompanhando cursores em tempo real.',
      });
    } catch (err: any) {
      toast.error('Falha ao reativar servidor', { description: err.message });
    }
  }

  async function handleFailoverModeChange(nextMode: 'MANUAL' | 'AUTO') {
    if (nextMode === failoverMode) return;
    try {
      await postConnectorAction(
        { action: 'set_failover_mode', failoverMode: nextMode, autoFailoverTimeoutSec: 180 },
        `failover:${nextMode}`,
      );
      toast.success(
        nextMode === 'AUTO'
          ? 'Failover Automático (3 min) ativado'
          : 'Modo de Chaveamento Manual ativado',
        {
          description:
            nextMode === 'AUTO'
              ? 'Se o servidor ATIVO ficar mais de 3 min sem sinal, o Hot-Standby online assumirá sozinho.'
              : 'A troca entre Principal e Secundário ocorrerá somente quando acionada manualmente por você.',
        },
      );
    } catch (err: any) {
      toast.error('Falha ao alterar modo de failover', { description: err.message });
    }
  }

  async function handleTriggerNodeUpdate(node: ConnectorClusterNodeSummary) {
    try {
      const result = await postConnectorAction(
        { action: 'trigger_update', connectorId: node.connectorId, safeSwitchFirst: true },
        `update:${node.connectorId}`,
      );
      toast.success(`Atualização remota enviada para ${node.name}`, {
        description: result.switchedToConnectorId
          ? `Tráfego chaveado preventivamente para o servidor reserva enquanto ${node.name} atualiza para ${result.targetVersion}.`
          : `No próximo batimento (até 20s), ${node.name} validará o pacote SHA-256 e reiniciará em ${result.targetVersion}.`,
      });
    } catch (err: any) {
      toast.error('Falha ao solicitar atualização remota', { description: err.message });
    }
  }

  async function handleRollingUpdate() {
    try {
      const result = await postConnectorAction({ action: 'rolling_update' }, 'rolling_update');
      toast.success('Atualização sem Parada (Rolling Update) iniciada', {
        description: result.rollingState?.message || 'Atualizando servidores em sequência segura.',
      });
    } catch (err: any) {
      toast.error('Falha ao iniciar Rolling Update', { description: err.message });
    }
  }

  async function handleCancelRollingUpdate() {
    try {
      await postConnectorAction({ action: 'cancel_rolling_update' }, 'cancel_rolling_update');
      toast.success('Rolling Update encerrado e limpo');
    } catch (err: any) {
      toast.error('Falha ao cancelar Rolling Update', { description: err.message });
    }
  }

  async function handleDeleteNode(node: ConnectorClusterNodeSummary) {
    if (node.operationalState === 'ACTIVE') return;
    const ok = window.confirm(
      `Deseja remover o servidor "${node.name}" (${node.hostname || node.connectorId}) da lista do cartório?`,
    );
    if (!ok) return;

    try {
      await postConnectorAction(
        { action: 'delete_node', connectorId: node.connectorId },
        `delete:${node.connectorId}`,
      );
      toast.success(`Servidor "${node.name}" removido com sucesso.`);
    } catch (err: any) {
      toast.error('Falha ao remover servidor', { description: err.message });
    }
  }

  function openCreateEnrollModal() {
    const hasPrimaryAlready = nodes.some((n) => n.role === 'PRIMARY' && n.name.toUpperCase().includes('SRVFILES'));
    setEnrollName(hasPrimaryAlready ? 'Servidor Reserva — Secundário' : 'SRVFILES — Principal');
    setEnrollRole(hasPrimaryAlready ? 'SECONDARY' : 'PRIMARY');
    setEnrollLanUrl(hasPrimaryAlready ? '' : 'http://srvfiles:8765');
    setEnrollSqlHost('srvsql');
    setEnrollSqlDb('WEBRI');
    setEnrollRoots(UNC_SRVFILES_ROOTS.map((r) => ({ ...r })));
    setGeneratedEnroll(null);
    setCopiedPs1(false);
    setShowEnrollModal(true);
  }

  async function handleGenerateEnrollmentToken(e: React.FormEvent) {
    e.preventDefault();
    try {
      const cleanRoots = enrollRoots
        .map((r) => ({ id: r.id.trim().toLowerCase(), label: r.label.trim(), path: r.path.trim() }))
        .filter((r) => r.id && r.path);

      const data = await postConnectorAction(
        {
          action: 'create_enrollment',
          connectorName: enrollName.trim(),
          intendedRole: enrollRole,
          remoteConfig: {
            ...(enrollLanUrl.trim() ? { lanUrl: enrollLanUrl.trim() } : {}),
            ...(enrollSqlHost.trim() ? { sqlHost: enrollSqlHost.trim() } : {}),
            ...(enrollSqlDb.trim() ? { sqlDatabase: enrollSqlDb.trim() } : {}),
            ...(cleanRoots.length > 0 ? { documentRoots: cleanRoots } : {}),
          },
        },
        'create_enrollment',
      );

      setGeneratedEnroll({
        rawToken: data.rawToken,
        connectorName: data.connectorName,
        initialState: data.initialState,
        expiresAt: data.expiresAt,
        installPs1Command: data.installPs1Command,
        downloadBatUrl: data.downloadBatUrl,
      });
      toast.success('Token de pareamento gerado (válido por 15 min)');
    } catch (err: any) {
      toast.error('Falha ao gerar token de instalação', { description: err.message });
    }
  }

  function openRemoteConfigModal(node: ConnectorClusterNodeSummary) {
    setEditingNode(node);
    setCfgName(node.name);
    setCfgRole(node.role);
    setCfgLanUrl(node.lanUrl ?? node.remoteConfig?.lanUrl ?? '');
    setCfgSqlHost(node.remoteConfig?.sqlHost ?? '');
    setCfgSqlDb(node.remoteConfig?.sqlDatabase ?? '');
    setCfgNotes(node.remoteConfig?.notes ?? '');
    const existingRoots = node.remoteConfig?.documentRoots ?? [];
    setCfgRoots(
      existingRoots.map((r) => ({
        id: r.id,
        label: r.label ?? r.id,
        path: r.path,
      })),
    );
  }

  async function handleSaveRemoteConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNode) return;

    const cleanRoots = cfgRoots
      .map((r) => ({ id: r.id.trim().toLowerCase(), label: r.label.trim(), path: r.path.trim() }))
      .filter((r) => r.id && r.path);

    try {
      await postConnectorAction(
        {
          action: 'update_config',
          connectorId: editingNode.connectorId,
          name: cfgName.trim(),
          role: cfgRole,
          priority: cfgRole === 'PRIMARY' ? 1 : 20,
          lanUrl: cfgLanUrl.trim() || null,
          remoteConfig: {
            lanUrl: cfgLanUrl.trim() || null,
            sqlHost: cfgSqlHost.trim() || null,
            sqlDatabase: cfgSqlDb.trim() || null,
            notes: cfgNotes.trim() || null,
            documentRoots: cleanRoots,
          },
        },
        `config:${editingNode.connectorId}`,
      );
      setEditingNode(null);
      toast.success('Configuração remota salva', {
        description: 'O agente aplicará as novas rotas/pastas automaticamente no próximo batimento (até 20s).',
      });
    } catch (err: any) {
      toast.error('Falha ao salvar configuração remota', { description: err.message });
    }
  }

  async function copyCommand(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPs1(true);
      toast.success('Comando PowerShell copiado!');
      setTimeout(() => setCopiedPs1(false), 2500);
    } catch {
      toast.error('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0B1020]/95 backdrop-blur-xl p-5 shadow-xl space-y-4">
      {/* Cabeçalho Executivo HA & Provisionamento SaaS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Server className="h-4 w-4" />
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Redundância & Seletor de Servidores Connector
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-mono">
              {nodes.length} {nodes.length === 1 ? 'Servidor' : 'Servidores'}
            </span>
            {latestVersion && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10 font-mono">
                Release SaaS {latestVersion}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Opere com servidor Principal (<span className="text-slate-200 font-medium">SRVFILES</span>) e Reserva (<span className="text-slate-200 font-medium">Hot-Standby</span>) sincronizados por cursores em nuvem, com chaveamento manual em 1 clique ou parada de emergência.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor Manual vs Failover Automático */}
          <div
            className="inline-flex items-center rounded-xl bg-[#070A14] p-1 border border-white/10 text-[11px]"
            role="group"
            aria-label="Modo de chaveamento"
          >
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleFailoverModeChange('MANUAL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                failoverMode === 'MANUAL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Seletor Manual
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleFailoverModeChange('AUTO')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                failoverMode === 'AUTO'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Promove automaticamente o Hot-Standby se o servidor Ativo ficar sem sinal por 3 minutos"
            >
              Auto-Failover (3m)
            </button>
          </div>

          {hasOutdatedOnlineNode && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleRollingUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
              <span>Atualizar Todos ({latestVersion})</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateEnrollModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/35 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-300" />
            <span>Adicionar Servidor Connector</span>
          </button>
        </div>
      </div>

      {/* Faixa de Rolling Update em andamento */}
      {rollingUpdate?.active && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
            <span>
              <strong>Rolling Update em execução ({rollingUpdate.targetVersion}):</strong>{' '}
              {rollingUpdate.message || 'Atualizando servidores sem interromper a operação.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
              {rollingUpdate.phase}
            </span>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleCancelRollingUpdate}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 cursor-pointer disabled:opacity-50"
              title="Encerrar e limpar faixa de Rolling Update"
            >
              <X className="h-3 w-3" />
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      )}

      {/* Aviso de transição única para agentes instalados originalmente na v2.6.0 */}
      {latestVersion &&
        latestVersion !== 'v2.6.0' &&
        nodes.some((n) => n.isOnline && n.version === 'v2.6.0') && (
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-100">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-200">
                  Transição única do v2.6.0 → {latestVersion} pendente em{' '}
                  {nodes
                    .filter((n) => n.isOnline && n.version === 'v2.6.0')
                    .map((n) => n.hostname || n.name)
                    .join(', ')}
                  :
                </strong>{' '}
                execute o mesmo ativador único <code className="text-amber-200">.BAT</code> neste(s)
                servidor(es) restante(s) para concluir a migração do binário antigo{' '}
                <code className="text-amber-200">v2.6.0</code>.
              </div>
            </div>
            <a
              href="/api/v1/connector/install.ps1?format=activate-bat"
              download="Ativar-FIORIX-v2.6.2.bat"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-bold text-amber-100 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-amber-300" />
              <span>Baixar Ativador Único {latestVersion} (.BAT)</span>
            </a>
          </div>
        )}

      {/* Cards Lado a Lado dos Servidores Connector */}
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center space-y-3">
          <p className="text-sm text-slate-300 font-medium">
            Nenhum servidor Connector provisionado neste cartório ainda.
          </p>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Clique em <strong>Adicionar Servidor Connector</strong> para gerar um Token de Pareamento de uso único e instalar o agente portátil Windows em menos de 1 minuto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {nodes.map((node) => {
            const isSelected = selectedConnectorId === node.connectorId;
            const isActive = node.operationalState === 'ACTIVE';
            const isPaused = node.operationalState === 'PAUSED';
            const isUpdating =
              node.updateStatus === 'PENDING' ||
              node.updateStatus === 'DOWNLOADING' ||
              node.updateStatus === 'VERIFYING' ||
              node.updateStatus === 'APPLYING';
            const canUpdate = Boolean(
              latestVersion && node.isOnline && node.version !== latestVersion && !isUpdating,
            );

            const smbRoots = node.telemetry.subsystems?.smbRoots ?? [];
            const accessibleSmb = smbRoots.filter((r) => r.accessible === true).length;
            const sqlConnected = node.telemetry.subsystems?.sqliteAndResilience.governance.sqlConnected;

            const cardBorder = isActive
              ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/20 via-[#111729] to-[#0B1020]'
              : isPaused
              ? 'border-amber-500/35 bg-gradient-to-br from-amber-950/15 via-[#111729] to-[#0B1020]'
              : !node.isOnline
              ? 'border-rose-500/30 bg-[#111729]/80'
              : 'border-cyan-500/25 bg-[#111729]';

            const stateBadge = isUpdating
              ? {
                  label: `ATUALIZANDO (${node.targetVersion || latestVersion || ''})`,
                  cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
                }
              : isActive && node.isOnline
              ? {
                  label: 'ATIVO EM PRODUÇÃO',
                  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
                }
              : isActive && !node.isOnline
              ? {
                  label: 'ATIVO · SEM SINAL RECENTE',
                  cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
                }
              : isPaused
              ? {
                  label: 'PAUSADO / MANUTENÇÃO',
                  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
                }
              : node.isOnline
              ? {
                  label: 'HOT-STANDBY PRONTO',
                  cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                }
              : {
                  label: 'RESERVA OFFLINE',
                  cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                };

            return (
              <div
                key={node.connectorId}
                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between gap-4 ${cardBorder} ${
                  isSelected ? 'ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-950/30' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Topo do Card */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{node.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border font-mono ${
                            node.role === 'PRIMARY'
                              ? 'bg-white/10 text-white border-white/20'
                              : 'bg-slate-800/80 text-slate-300 border-white/10'
                          }`}
                        >
                          {node.role === 'PRIMARY' ? 'Principal' : 'Secundário'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span>Host: {node.hostname || 'Aguardando sinal'}</span>
                        <span>·</span>
                        <span>Versão: {node.version || 'legado'}</span>
                        {node.lanUrl && (
                          <>
                            <span>·</span>
                            <span className="text-cyan-400 inline-flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              {node.lanUrl}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border font-mono ${stateBadge.cls}`}
                    >
                      {stateBadge.label}
                    </span>
                  </div>

                  {/* Mini-grade de Telemetria em Tempo Real do Nó */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="rounded-xl bg-[#070A14]/70 border border-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Último Sinal</div>
                      <div
                        className={`text-xs font-mono font-semibold mt-0.5 ${
                          node.isOnline ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {node.heartbeatAgoSeconds !== null
                          ? `há ${node.heartbeatAgoSeconds}s`
                          : 'sem sinal'}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#070A14]/70 border border-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> CPU / RAM
                      </div>
                      <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                        {node.telemetry.cpuPercent !== null && node.telemetry.cpuPercent !== undefined
                          ? `${node.telemetry.cpuPercent.toFixed(0)}%`
                          : '—'}{' '}
                        ·{' '}
                        {node.telemetry.ramMb ? `${node.telemetry.ramMb} MB` : '—'}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#070A14]/70 border border-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Database className="h-3 w-3" /> SQL WEBRI
                      </div>
                      <div
                        className={`text-xs font-mono font-semibold mt-0.5 ${
                          sqlConnected === false
                            ? 'text-rose-400'
                            : node.isOnline
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {sqlConnected === false
                          ? 'Falha SQL'
                          : node.isOnline
                          ? 'Conectado'
                          : 'Aguardando'}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#070A14]/70 border border-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <FolderCheck className="h-3 w-3" /> Acervo SMB
                      </div>
                      <div className="text-xs font-mono font-semibold text-cyan-300 mt-0.5">
                        {smbRoots.length > 0 && smbRoots[0].provenance === 'live'
                          ? `${accessibleSmb}/${smbRoots.length} pastas`
                          : node.isOnline
                          ? 'Pronto'
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Mensagem de status de auto-update quando houver */}
                  {node.updateMessage && node.updateStatus !== 'IDLE' && (
                    <div
                      className={`rounded-xl px-3 py-1.5 text-[11px] border flex items-center justify-between gap-2 ${
                        node.updateStatus === 'ROLLED_BACK' || node.updateStatus === 'FAILED'
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                          : node.updateStatus === 'SUCCEEDED'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-blue-500/10 border-blue-500/25 text-blue-200'
                      }`}
                    >
                      <span className="truncate">{node.updateMessage}</span>
                      <span className="font-mono text-[10px] uppercase shrink-0">
                        {node.updateStatus}
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra de Ações Operacionais */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive && !isPaused && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handlePromote(node)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/35 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Tornar Principal Ativo</span>
                      </button>
                    )}

                    {isPaused ? (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleResume(node)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/35 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Reativar Servidor</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handlePause(node)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/25 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Pausa sincronizações SQL e buscas documentais neste servidor (promovendo o reserva se ativo)"
                      >
                        <PauseCircle className="h-3.5 w-3.5 text-amber-300" />
                        <span>{isActive ? 'Pausar / Manutenção' : 'Pausar'}</span>
                      </button>
                    )}

                    {canUpdate && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleTriggerNodeUpdate(node)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                        <span>Atualizar ({latestVersion})</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openRemoteConfigModal(node)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all cursor-pointer"
                      title="Configurar URL LAN :8765, Host SQL e Pastas SMB remotamente"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      <span>Configurar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectConnector(node.connectorId)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/35'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{isSelected ? 'Inspecionando' : 'Inspecionar'}</span>
                    </button>

                    {!isActive && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleDeleteNode(node)}
                        className="inline-flex items-center justify-center p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                        title="Remover este servidor reserva/inativo do painel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
           MODAL 1: ADICIONAR SERVIDOR CONNECTOR (PADRÃO SaaS MULTI-CLIENTE)
           ════════════════════════════════════════════════════════════════════════ */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0B1020] p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="h-4.5 w-4.5 text-emerald-400" />
                  Provisionar Novo Servidor Connector (Padrão SaaS)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Instalador portátil com Node.js LTS embutido, NSSM, CLI Rust e validação SHA-256 — sem precisar instalar Node, Git ou editar código no servidor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!generatedEnroll ? (
              <form onSubmit={handleGenerateEnrollmentToken} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Nome de Identificação do Servidor
                    </label>
                    <input
                      type="text"
                      required
                      value={enrollName}
                      onChange={(e) => setEnrollName(e.target.value)}
                      placeholder="Ex.: SRVFILES — Principal"
                      className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Papel na Redundância
                    </label>
                    <select
                      value={enrollRole}
                      onChange={(e) => setEnrollRole(e.target.value as 'PRIMARY' | 'SECONDARY')}
                      className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="PRIMARY">Principal (ex.: SRVFILES)</option>
                      <option value="SECONDARY">Secundário / Reserva (Hot-Standby)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      URL Rede Interna LAN (:8765 para PDFs rápidos)
                    </label>
                    <input
                      type="text"
                      value={enrollLanUrl}
                      onChange={(e) => setEnrollLanUrl(e.target.value)}
                      placeholder="http://srvfiles:8765"
                      className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Host SQL Padrão
                      </label>
                      <input
                        type="text"
                        value={enrollSqlHost}
                        onChange={(e) => setEnrollSqlHost(e.target.value)}
                        placeholder="localhost"
                        className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Banco SQL
                      </label>
                      <input
                        type="text"
                        value={enrollSqlDb}
                        onChange={(e) => setEnrollSqlDb(e.target.value)}
                        placeholder="WEBRI"
                        className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Pastas SMB Opcionais já pré-configuradas na nuvem */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">
                      Pastas Documentais do Servidor (editáveis remotamente depois)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEnrollRoots(UNC_SRVFILES_ROOTS.map((r) => ({ ...r })))}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        Padrão UNC (\\srvfiles)
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => setEnrollRoots(DEFAULT_CARTORIO_ROOTS.map((r) => ({ ...r })))}
                        className="text-[11px] text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
                      >
                        W: / H: / K:
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEnrollRoots((prev) => [
                            ...prev,
                            { id: `pasta${prev.length + 1}`, label: 'Nova Pasta', path: '' },
                          ])
                        }
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                      >
                        + Adicionar caminho
                      </button>
                    </div>
                  </div>

                  {enrollRoots.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Padrão automático habilitado (W:\USUCAPIAO, H:\PROCESSOS, K:\IMAGENS, K:\IMAGENS\LV2). Para caminhos UNC (ex.: \\SRVFILES\...), clique em &ldquo;Carregar padrão&rdquo; e ajuste.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {enrollRoots.map((r, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            value={r.id}
                            onChange={(e) =>
                              setEnrollRoots((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, id: e.target.value } : it)),
                              )
                            }
                            placeholder="id"
                            className="col-span-3 rounded-lg bg-[#070A14] border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                          <input
                            type="text"
                            value={r.path}
                            onChange={(e) =>
                              setEnrollRoots((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, path: e.target.value } : it)),
                              )
                            }
                            placeholder="D:\IMAGENS ou \\SRVFILES\IMAGENS"
                            className="col-span-8 rounded-lg bg-[#070A14] border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setEnrollRoots((prev) => prev.filter((_, i) => i !== idx))}
                            className="col-span-1 p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-[11px] text-slate-300 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    {nodes.some((n) => n.operationalState === 'ACTIVE')
                      ? 'Como já existe um Connector ATIVO em produção, o novo servidor entrará inicialmente em modo HOT-STANDBY seguro (sem interromper o atual) até você clicar em "Tornar Principal Ativo".'
                      : 'Este será o primeiro Connector ativo do cartório e iniciará automaticamente em produção.'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEnrollModal(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === 'create_enrollment'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar Token & Instalador Portátil</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3.5 text-xs text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>Token de uso único gerado para: {generatedEnroll.connectorName}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                      Expira em 15 min
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90">
                    Modo inicial após instalação: <strong>{generatedEnroll.initialState}</strong>. A senha do SQL Server será solicitada localmente na tela do servidor e jamais trafega pela nuvem.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Opção 1 (Recomendada): Executar no PowerShell como Administrador no servidor
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCommand(generatedEnroll.installPs1Command)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 text-xs font-semibold cursor-pointer"
                    >
                      {copiedPs1 ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedPs1 ? 'Copiado!' : 'Copiar Comando'}</span>
                    </button>
                  </div>
                  <pre className="rounded-xl bg-[#050811] border border-white/10 p-3.5 text-[11px] text-cyan-300 font-mono overflow-x-auto whitespace-pre-wrap break-all select-all">
                    {generatedEnroll.installPs1Command}
                  </pre>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">
                      Opção 2: Instalador Portátil em 1 Clique (.BAT)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Baixe e execute no servidor Windows (solicita permissão de Administrador automaticamente).
                    </div>
                  </div>
                  <a
                    href={generatedEnroll.downloadBatUrl}
                    download="Instalar-FIORIX-Connector.bat"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Baixar Instalador (.BAT)</span>
                  </a>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEnrollModal(false);
                      onClusterMutated();
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
           MODAL 2: CONFIGURAÇÃO REMOTA DO SERVIDOR CONNECTOR
           ════════════════════════════════════════════════════════════════════════ */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0B1020] p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings2 className="h-4.5 w-4.5 text-cyan-400" />
                  Configuração Remota · {editingNode.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Alterações são sincronizadas automaticamente via heartbeat (Config v{editingNode.configVersion}) sem precisar acessar o servidor via RDP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRemoteConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Servidor no Painel
                  </label>
                  <input
                    type="text"
                    required
                    value={cfgName}
                    onChange={(e) => setCfgName(e.target.value)}
                    className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Papel Designado
                  </label>
                  <select
                    value={cfgRole}
                    onChange={(e) => setCfgRole(e.target.value as 'PRIMARY' | 'SECONDARY')}
                    className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="PRIMARY">Principal (Prioridade 1)</option>
                    <option value="SECONDARY">Secundário / Reserva</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    URL LAN (:8765) para Streaming Direto de PDFs
                  </label>
                  <input
                    type="text"
                    value={cfgLanUrl}
                    onChange={(e) => setCfgLanUrl(e.target.value)}
                    placeholder="Ex.: http://srvfiles:8765"
                    className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Host SQL Server
                    </label>
                    <input
                      type="text"
                      value={cfgSqlHost}
                      onChange={(e) => setCfgSqlHost(e.target.value)}
                      placeholder="Padrao local (.env)"
                      className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Banco SQL
                    </label>
                    <input
                      type="text"
                      value={cfgSqlDb}
                      onChange={(e) => setCfgSqlDb(e.target.value)}
                      placeholder="WEBRI"
                      className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Editor Remoto de Pastas SMB / Discos Locais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Pastas do Acervo Documental (Caminhos Locais ou UNC deste Servidor)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCfgRoots(UNC_SRVFILES_ROOTS.map((r) => ({ ...r })))}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      Padrão UNC (\\srvfiles)
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() => setCfgRoots(DEFAULT_CARTORIO_ROOTS.map((r) => ({ ...r })))}
                      className="text-[11px] text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
                    >
                      W: / H: / K:
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCfgRoots((prev) => [
                          ...prev,
                          { id: `pasta${prev.length + 1}`, label: 'Nova Pasta', path: '' },
                        ])
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                    >
                      + Adicionar pasta
                    </button>
                  </div>
                </div>

                {cfgRoots.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-[#070A14]/60 p-3 text-[11px] text-slate-400">
                    Usando mapeamento local padrão do servidor (<code className="text-slate-300">.env.production</code>). Adicione pastas acima caso queira sobrescrever remotamente (ex.: <code className="text-cyan-300">D:\IMAGENS</code> no SRVFILES).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {cfgRoots.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={r.id}
                          onChange={(e) =>
                            setCfgRoots((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, id: e.target.value } : it)),
                            )
                          }
                          placeholder="id (ex: imagens)"
                          className="col-span-3 rounded-lg bg-[#070A14] border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                        <input
                          type="text"
                          value={r.label}
                          onChange={(e) =>
                            setCfgRoots((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)),
                            )
                          }
                          placeholder="Rótulo"
                          className="col-span-3 rounded-lg bg-[#070A14] border border-white/10 px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={r.path}
                          onChange={(e) =>
                            setCfgRoots((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, path: e.target.value } : it)),
                            )
                          }
                          placeholder="Caminho local ou UNC"
                          className="col-span-5 rounded-lg bg-[#070A14] border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setCfgRoots((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observações Operacionais
                </label>
                <input
                  type="text"
                  value={cfgNotes}
                  onChange={(e) => setCfgNotes(e.target.value)}
                  placeholder="Ex.: Servidor dedicado Windows Server na sala de cofres"
                  className="w-full rounded-xl bg-[#070A14] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  Credenciais/senhas SQL permanecem isoladas apenas no arquivo local do servidor.
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingNode(null)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === `config:${editingNode.connectorId}`}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Salvar Configuração Remota
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

