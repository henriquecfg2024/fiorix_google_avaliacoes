'use client';

import React from 'react';
import {
  FileSearch,
  FolderOpen,
  Server,
  Terminal,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Lock,
  Wifi,
} from 'lucide-react';
import type { ConnectorSubsystemsSnapshot } from '@/lib/health/types';

interface Props {
  subsystems?: ConnectorSubsystemsSnapshot;
  connectorOnline: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ConnectorSubsystemsSection({ subsystems, connectorOnline }: Props) {
  if (!subsystems) return null;

  const { documental, smbRoots, indexCache, transferAndCli, sqliteAndResilience } = subsystems;
  const isLive = subsystems.provenance === 'live';

  const cursorPreviewEntries = Object.entries(sqliteAndResilience.checkpoints.cursorsBySource).slice(0, 4);

  return (
    <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-5">
      {/* Header da Seção */}
      <div className="flex flex-col sm:items-center sm:flex-row justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
              Monitoramento Completo dos Subsistemas do Connector
            </h3>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${
                isLive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
              }`}
              title={
                isLive
                  ? 'Telemetria interna recebida diretamente do serviço Windows FIORIXConnector'
                  : 'Métricas consolidadas em tempo real pelo PostgreSQL SaaS; telemetria interna detalhada ativa no próximo reinício do serviço local'
              }
            >
              {isLive ? 'TELEMETRIA INTERNA • LIVE' : 'CONSOLIDADO SAAS • CALCULADO'}
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Worker Documental 24/7, compartilhamentos SMB do 7º RI, servidor interno (:8765) / blocos HTTPS, motor Rust CLI e fila SQLite WAL
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[11px] font-mono text-[#94A3B8] shrink-0">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span>Documental 24/7 · SQL 07h–19h</span>
        </div>
      </div>

      {/* Grid 2x2 dos 4 Subsistemas Principais */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 1. WORKER DE GESTÃO DOCUMENTAL 24/7 */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1323] p-4 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-[#151A2C] text-cyan-400 border border-[#1E293B]">
                  <FileSearch className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Worker de Gestão Documental 24/7</h4>
                  <p className="text-[11px] text-[#64748B] font-mono">{documental.pollIntervalLabel}</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  !documental.workerEnabled
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : connectorOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                }`}
              >
                {!documental.workerEnabled ? 'PAUSADO' : connectorOnline ? '24/7 ATIVO' : 'STANDBY'}
              </span>
            </div>

            {/* KPIs Rápidos do Worker */}
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Fila Ativa</span>
                <span className={`text-sm font-bold ${documental.activeQueueCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {documental.activeQueueCount}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Jobs (24h)</span>
                <span className="text-sm font-bold text-[#F1F5F9]">{documental.jobs24hTotal}</span>
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Falhas (24h)</span>
                <span
                  className={`text-sm font-bold ${
                    (documental.jobs24hFailedActive ?? documental.jobs24hFailed) > 0
                      ? 'text-rose-400'
                      : documental.jobs24hFailed > 0
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {documental.jobs24hFailed}
                </span>
                {documental.jobs24hFailed > 0 && (
                  <span className="text-[9px] text-[#94A3B8] block font-sans leading-tight mt-0.5">
                    {(documental.jobs24hFailedActive ?? 0) > 0
                      ? `${documental.jobs24hFailedActive} pendente(s)`
                      : `${documental.jobs24hFailedResolved ?? documental.jobs24hFailed} corrigida(s)`}
                  </span>
                )}
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Média Job</span>
                <span className="text-sm font-bold text-cyan-400">
                  {documental.avgJobDurationMs !== null ? `${documental.avgJobDurationMs}ms` : '—'}
                </span>
              </div>
            </div>

            {/* Breakdown dos 6 tipos de Job */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Buscas Acervo</span>
                <span className="text-[#F1F5F9] font-semibold">{documental.jobsByType.search}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Leitura KEN/DOC</span>
                <span className="text-[#F1F5F9] font-semibold">{documental.jobsByType.read_document_text}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Blocos HTTPS</span>
                <span className="text-cyan-400 font-semibold">{documental.jobsByType.read_document_chunk}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Petição Inicial</span>
                <span className="text-[#F1F5F9] font-semibold">{documental.jobsByType.extract_petition}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Assinaturas ICP</span>
                <span className="text-[#F1F5F9] font-semibold">{documental.jobsByType.analyze_signatures}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans truncate pr-1">Listagem Pastas</span>
                <span className="text-[#F1F5F9] font-semibold">{documental.jobsByType.list_directory}</span>
              </div>
            </div>

            {/* Diagnóstico sempre visível de falhas do Worker Documental (identificação + status de correção) */}
            <div className="rounded-lg bg-[#111827] border border-[#1E293B] p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                  {(documental.jobs24hFailedActive ?? 0) > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                  Diagnóstico de Falhas (24h)
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {documental.jobs24hFailedResolved ?? 0} corrigida(s)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      (documental.jobs24hFailedActive ?? 0) > 0
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 font-bold'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {documental.jobs24hFailedActive ?? 0} pendente(s)
                  </span>
                </div>
              </div>

              {!documental.recentFailures || documental.recentFailures.length === 0 ? (
                <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                  Nenhuma falha registrada nas últimas 24h — buscas, leituras KEN/PDF, extrações e validações operam sem pendências.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {documental.recentFailures.map((fail) => (
                    <div
                      key={fail.id}
                      className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 ${
                        fail.resolved
                          ? 'bg-[#0F172A]/80 border-emerald-500/20'
                          : 'bg-rose-950/20 border-rose-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-[#1E293B] text-[#CBD5E1] font-mono text-[10px] shrink-0">
                            {fail.typeLabel}
                          </span>
                          <span className="text-[#F1F5F9] font-medium truncate" title={fail.target}>
                            {fail.target}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                          <span className="text-[#64748B]">{fail.failedAtFormatted}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold border ${
                              fail.resolved
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/35'
                            }`}
                          >
                            {fail.resolved ? 'CORRIGIDA' : 'NÃO CORRIGIDA'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[#CBD5E1] font-mono text-[10px] break-words">
                        Motivo: {fail.error}
                      </p>
                      <p className={`text-[10px] ${fail.resolved ? 'text-emerald-400/90' : 'text-amber-300/90'}`}>
                        {fail.resolutionReason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-[#94A3B8]">
              Manifestações:{' '}
              <strong className="text-amber-300 font-mono">{documental.manifestacoes.conferencia}</strong> em conferência ·{' '}
              <strong className="text-emerald-400 font-mono">{documental.manifestacoes.finalizada}</strong> finalizadas
            </span>
            <span className="text-[#64748B] font-mono">
              Último job: {documental.lastJobAt ?? 'Sem registro'}
            </span>
          </div>
        </div>

        {/* 2. MAPEAMENTOS SMB DO CARTÓRIO & ÍNDICE EM MEMÓRIA */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1323] p-4 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-[#151A2C] text-emerald-400 border border-[#1E293B]">
                  <FolderOpen className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Mapeamentos SMB & Índice RAM</h4>
                  <p className="text-[11px] text-[#64748B] font-mono">
                    {indexCache.totalIndexedFiles > 0
                      ? `${indexCache.totalIndexedFiles.toLocaleString('pt-BR')} arquivos indexados · TTL ${Math.round(indexCache.ttlMs / 1000)}s`
                      : `${smbRoots.length} compartilhamentos oficiais · TTL ${Math.round(indexCache.ttlMs / 1000)}s`}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#151A2C] text-[#94A3B8] border border-[#1E293B]">
                {smbRoots.length} UNIDADES
              </span>
            </div>

            <div className="space-y-2">
              {smbRoots.map((root) => {
                const isOk = root.accessible === true;
                const isFail = root.provenance === 'live' && root.accessible === false;
                return (
                  <div
                    key={root.id}
                    className="px-3 py-2 rounded-lg bg-[#151A2C] border border-[#1E293B] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isFail ? (
                          <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        ) : isOk ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <HardDrive className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        )}
                        <span className="font-semibold text-[#F1F5F9] truncate">{root.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#64748B] block truncate pl-5">
                        {root.uncOrDrivePath}
                      </span>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      {isFail ? (
                        <span className="text-[10px] text-rose-400 font-semibold">INACESSÍVEL</span>
                      ) : isOk ? (
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          {root.latencyMs !== null ? `${root.latencyMs} ms` : 'ACESSÍVEL'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#94A3B8]">MAPEADO</span>
                      )}
                      {root.indexedFilesCount !== null && root.indexedFilesCount > 0 && (
                        <span className="block text-[10px] text-[#64748B]">
                          {root.indexedFilesCount.toLocaleString('pt-BR')} arqs
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#64748B]">
            <span>
              Índice RAM: <strong className="text-[#F1F5F9]">{indexCache.indexedRootsCount}/{smbRoots.length}</strong> raízes
              {indexCache.refreshingRootsCount > 0 ? ` (${indexCache.refreshingRootsCount} atualizando)` : ''}
            </span>
            <span>Build: {indexCache.lastBuiltAt ?? 'Sob demanda'}</span>
          </div>
        </div>

        {/* 3. SERVIDOR INTERNO (:8765), BLOCOS HTTPS & MOTOR RUST CLI */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1323] p-4 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-[#151A2C] text-indigo-400 border border-[#1E293B]">
                  <Terminal className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Servidor Interno (:8765), HTTPS Chunks & CLI Rust</h4>
                  <p className="text-[11px] text-[#64748B] font-mono">
                    Streaming LAN Range 206 + Transferência universal Safari/Chrome/iOS
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                :{transferAndCli.fileServer.port} · {transferAndCli.fileServer.protocol}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Subbloco File Server + Chunks HTTPS */}
              <div className="p-3 rounded-lg bg-[#151A2C] border border-[#1E293B] space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-[#F1F5F9] pb-1 border-b border-[#1E293B]">
                  <span className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-cyan-400" />
                    File Server & Streaming
                  </span>
                  <span className={transferAndCli.fileServer.active ? 'text-emerald-400 text-[10px] font-mono' : 'text-slate-400 text-[10px] font-mono'}>
                    {transferAndCli.fileServer.active ? 'ATIVO' : 'STANDBY'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">Tickets 256-bit ativos</span>
                  <span className="text-[#F1F5F9]">
                    {transferAndCli.fileServer.activeTicketsCount} ({transferAndCli.fileServer.ticketsIssuedTotal} total)
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">HTTP 206 Range / Servido</span>
                  <span className="text-[#F1F5F9]">
                    {transferAndCli.fileServer.rangeRequestsTotal} reqs · {formatBytes(transferAndCli.fileServer.bytesServedTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">Blocos HTTPS (2,4 MB)</span>
                  <span className="text-cyan-400 font-semibold">{transferAndCli.fileServer.httpsChunks24h} (24h)</span>
                </div>
              </div>

              {/* Subbloco Motor Nativo Rust CLI */}
              <div className="p-3 rounded-lg bg-[#151A2C] border border-[#1E293B] space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-[#F1F5F9] pb-1 border-b border-[#1E293B]">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-amber-400" />
                    {transferAndCli.rustCli.binaryName}
                  </span>
                  <span
                    className={
                      transferAndCli.rustCli.available === false
                        ? 'text-rose-400 text-[10px] font-mono'
                        : 'text-emerald-400 text-[10px] font-mono'
                    }
                  >
                    {transferAndCli.rustCli.available === false
                      ? 'AUSENTE'
                      : transferAndCli.rustCli.available === true
                      ? 'PRONTO'
                      : 'INTEGRADO'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">Petições PDF / DOCX</span>
                  <span className="text-[#F1F5F9]">
                    {transferAndCli.rustCli.petitionsExtractedTotal} PDF · {transferAndCli.rustCli.docxExtractedTotal} DOCX
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">Assinaturas ICP-Brasil</span>
                  <span className="text-[#F1F5F9]">{transferAndCli.rustCli.signaturesAnalyzedTotal} análises</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#64748B] font-sans">Última execução CLI</span>
                  <span className="text-emerald-400">
                    {transferAndCli.rustCli.lastDurationMs !== null ? `${transferAndCli.rustCli.lastDurationMs} ms` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] font-mono">
            <span>Compatibilidade: Chrome · Safari · iOS · Edge · Firefox</span>
            {transferAndCli.rustCli.lastError ? (
              <span className="text-amber-400 truncate max-w-[260px]" title={transferAndCli.rustCli.lastError}>
                Alerta CLI: {transferAndCli.rustCli.lastError}
              </span>
            ) : (
              <span className="text-emerald-400">Sem erros de extração</span>
            )}
          </div>
        </div>

        {/* 4. PERSISTÊNCIA SQLITE WAL, CHUNKS SHA-256, CHECKPOINTS & GOVERNANÇA */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1323] p-4 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-[#151A2C] text-purple-400 border border-[#1E293B]">
                  <Database className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Fila SQLite WAL, Chunks SHA-256 & Governança</h4>
                  <p className="text-[11px] text-[#64748B] font-mono">
                    queue_production.db · lotes de até {sqliteAndResilience.chunks.chunkSizeLimit} regs com hash SHA-256
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  sqliteAndResilience.queue.quarantined > 0
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    : sqliteAndResilience.queue.failed > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                }`}
              >
                {sqliteAndResilience.queue.quarantined > 0
                  ? `${sqliteAndResilience.queue.quarantined} QUARENTENA`
                  : sqliteAndResilience.queue.failed > 0
                  ? `EM RETRY (${sqliteAndResilience.queue.failed})`
                  : 'WAL ÍNTEGRO'}
              </span>
            </div>

            {/* Contadores da Fila SQLite */}
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Pendentes</span>
                <span className="text-sm font-bold text-[#F1F5F9]">{sqliteAndResilience.queue.pending}</span>
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Enviando</span>
                <span className="text-sm font-bold text-cyan-400">{sqliteAndResilience.queue.sending}</span>
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Com Erro</span>
                <span className={`text-sm font-bold ${sqliteAndResilience.queue.failed > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {sqliteAndResilience.queue.failed}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[#151A2C] border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block font-sans">Quarentena</span>
                <span className={`text-sm font-bold ${sqliteAndResilience.queue.quarantined > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sqliteAndResilience.queue.quarantined}
                </span>
              </div>
            </div>

            {/* Diagnóstico sempre visível da Fila SQLite WAL (identificação + status de correção) */}
            <div className="rounded-lg bg-[#111827] border border-[#1E293B] p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                  {(sqliteAndResilience.failedActiveCount ?? sqliteAndResilience.queue.failed + sqliteAndResilience.queue.quarantined) > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                  Diagnóstico da Fila SQLite WAL (24h)
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {sqliteAndResilience.failedResolved24hCount ?? 0} corrigido(s)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border ${
                      (sqliteAndResilience.failedActiveCount ?? sqliteAndResilience.queue.failed + sqliteAndResilience.queue.quarantined) > 0
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/25 font-bold'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {sqliteAndResilience.failedActiveCount ?? sqliteAndResilience.queue.failed + sqliteAndResilience.queue.quarantined} ativo(s)
                  </span>
                </div>
              </div>

              {(!sqliteAndResilience.recentFailures || sqliteAndResilience.recentFailures.length === 0) ? (
                <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                  Nenhum lote com falha nas últimas 24h — 0 pend · 0 erros na fila SQLite WAL.
                </p>
              ) : (
                <>
                  {(sqliteAndResilience.failedActiveCount ?? 0) === 0 && (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 text-[11px] text-emerald-300">
                      Resolvido: todos os {sqliteAndResilience.failedResolved24hCount ?? sqliteAndResilience.recentFailures.length} lote(s) com falha nas últimas 24h foram reprocessados e a fila SQLite WAL está zerada (0 pend · 0 erros).
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {sqliteAndResilience.recentFailures.map((fail) => {
                      const isResolved = fail.resolutionStatus === 'RESOLVED';
                      const isQuarantined = fail.resolutionStatus === 'QUARANTINED';
                      const timeLabel = new Date(fail.lastFailedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      });
                      return (
                        <div
                          key={fail.batchId}
                          className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 ${
                            isResolved
                              ? 'bg-[#0F172A]/80 border-emerald-500/20'
                              : isQuarantined
                              ? 'bg-rose-950/20 border-rose-500/30'
                              : 'bg-amber-950/15 border-amber-500/25'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-[#1E293B] text-cyan-300 font-mono text-[10px] shrink-0">
                                {fail.batchId.slice(0, 8)}
                              </span>
                              <span className="text-[#F1F5F9] font-medium truncate">
                                {fail.moduleLabel}
                              </span>
                              <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                                {fail.recordsCount !== null ? `${fail.recordsCount} regs` : ''} · {fail.attempts}x
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                              <span className="text-[#64748B]">{timeLabel}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold border ${
                                  isResolved
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : isQuarantined
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/35'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                                }`}
                              >
                                {isResolved ? 'CORRIGIDO' : isQuarantined ? 'QUARENTENA' : 'EM RETRY'}
                              </span>
                            </div>
                          </div>
                          <p className="text-[#CBD5E1] font-mono text-[10px] break-words">
                            Motivo: {fail.lastError}
                          </p>
                          <p className={`text-[10px] ${isResolved ? 'text-emerald-400/90' : isQuarantined ? 'text-rose-300' : 'text-amber-300/90'}`}>
                            {fail.resolutionNote}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Governança, Chunks e Checkpoints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans">Planos Chunks SHA-256</span>
                <span className="text-[#F1F5F9]">
                  {sqliteAndResilience.chunks.activePlans} ativos · {sqliteAndResilience.chunks.confirmedChunks} ok
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans">Checkpoints / Cursores</span>
                <span className="text-[#F1F5F9]">
                  {sqliteAndResilience.checkpoints.persistedCount} salvos
                  {sqliteAndResilience.checkpoints.stagedCandidates > 0
                    ? ` (+${sqliteAndResilience.checkpoints.stagedCandidates} stage)`
                    : ''}
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-400" />
                  SingleInstance / Shadow
                </span>
                <span className="text-emerald-400">
                  {sqliteAndResilience.governance.singleInstanceLock ? 'Lock OK' : 'Sem Lock'} ·{' '}
                  {sqliteAndResilience.governance.shadowMode ? 'Shadow' : 'Prod'}
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-[#151A2C]/70 border border-[#1E293B]/80 flex items-center justify-between">
                <span className="text-[#94A3B8] font-sans flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-cyan-400" />
                  Reconexão {sqliteAndResilience.governance.morningReconnectTime.slice(0, 5)} / Proxy
                </span>
                <span className="text-[#F1F5F9]">
                  {sqliteAndResilience.governance.proxyEnabled
                    ? `Proxy (${sqliteAndResilience.governance.proxyFallbackCount} fb)`
                    : 'Direto HTTPS'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#64748B]">
            <span>
              Locks SQL ativos:{' '}
              <strong className="text-[#F1F5F9]">
                {sqliteAndResilience.governance.activeLocks.length > 0
                  ? sqliteAndResilience.governance.activeLocks.join(', ')
                  : 'Nenhum (livre)'}
              </strong>
            </span>
            {cursorPreviewEntries.length > 0 ? (
              <span className="truncate max-w-[260px]">
                Cursores: {cursorPreviewEntries.map(([k, v]) => `${k}=${v.cursorValue}`).join(' · ')}
              </span>
            ) : (
              <span>Catch-up inicial: {sqliteAndResilience.governance.startupCatchupCount} rotinas</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
