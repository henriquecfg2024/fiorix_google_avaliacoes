'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Database,
  Edit2,
  FileText,
  HardDrive,
  History,
  Info,
  Layers,
  Loader2,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  MemorialCategory,
  MemorialInfraEntry,
  MemorialInfraSnapshot,
  MemorialServerKey,
  MemorialStatus,
} from '@/lib/memorial-infraestrutura/types';

interface MemorialInfraestruturaClientProps {
  initialSnapshot: MemorialInfraSnapshot;
  masterName: string;
}

type ActiveTab = 'timeline' | 'comparativo' | 'governanca' | 'automacao';

interface FormState {
  server: MemorialServerKey;
  category: MemorialCategory;
  status: MemorialStatus;
  title: string;
  implementedAt: string;
  connectorVersion: string;
  impactBadge: string;
  summarySimple: string;
  metricBefore: string;
  metricAfter: string;
  problemBefore: string;
  solutionApplied: string;
  technicalDetails: string;
  commandsSnippet: string;
  rollbackPlan: string;
}

const SERVER_LABELS: Record<MemorialServerKey, string> = {
  SRVSQL: 'SRVSQL (10.0.0.25)',
  SRVFILES: 'SRVFILES (10.0.0.40)',
  SRVSIPLANIA: 'SRVSIPLANIA (10.0.0.6)',
  GERAL: 'Infraestrutura 3 Servidores',
};

const SERVER_BADGE_CLASS: Record<MemorialServerKey, string> = {
  SRVSQL: 'border-cyan-500/35 bg-cyan-500/15 text-cyan-200',
  SRVFILES: 'border-amber-500/35 bg-amber-500/15 text-amber-200',
  SRVSIPLANIA: 'border-violet-500/35 bg-violet-500/15 text-violet-200',
  GERAL: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200',
};

const SERVER_CARD_ACCENT: Record<'SRVSQL' | 'SRVFILES' | 'SRVSIPLANIA', string> = {
  SRVSQL: 'from-cyan-500/15 via-slate-900/80 to-[#0B101E] border-cyan-500/25',
  SRVFILES: 'from-amber-500/15 via-slate-900/80 to-[#0B101E] border-amber-500/25',
  SRVSIPLANIA: 'from-violet-500/15 via-slate-900/80 to-[#0B101E] border-violet-500/25',
};

const CATEGORY_LABELS: Record<MemorialCategory, string> = {
  PERFORMANCE: 'Performance',
  SEGURANCA_ACESSO: 'Segurança & Acesso',
  IA_OCR_PESQUISA: 'IA, OCR & Pesquisa',
  OBSERVABILIDADE: 'Observabilidade',
  ALTA_DISPONIBILIDADE: 'Alta Disponibilidade',
  ARQUITETURA_REDE: 'Arquitetura & Rede',
};

const STATUS_LABELS: Record<MemorialStatus, string> = {
  ATIVO: 'Em Produção',
  MONITORANDO: 'Em Monitoramento',
  DECISAO_ARQUITETURAL: 'Decisão Arquitetural',
  HISTORICO: 'Base Histórica',
};

const STATUS_BADGE_CLASS: Record<MemorialStatus, string> = {
  ATIVO: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  MONITORANDO: 'border-amber-500/35 bg-amber-500/15 text-amber-200',
  DECISAO_ARQUITETURAL: 'border-sky-500/35 bg-sky-500/15 text-sky-200',
  HISTORICO: 'border-slate-700 bg-slate-800/70 text-slate-300',
};

function normalizarSemAcento(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDateBr(yyyyMmDd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) return yyyyMmDd;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function escapeHtmlText(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmptyForm(): FormState {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    server: 'SRVFILES',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: '',
    implementedAt: todayIso,
    connectorVersion: 'v2.6.23',
    impactBadge: '',
    summarySimple: '',
    metricBefore: '',
    metricAfter: '',
    problemBefore: '',
    solutionApplied: '',
    technicalDetails: '',
    commandsSnippet: '',
    rollbackPlan: '',
  };
}

function formFromEntry(entry: MemorialInfraEntry): FormState {
  return {
    server: entry.server,
    category: entry.category,
    status: entry.status,
    title: entry.title,
    implementedAt: entry.implementedAt,
    connectorVersion: entry.connectorVersion || '',
    impactBadge: entry.impactBadge,
    summarySimple: entry.summarySimple,
    metricBefore: entry.metricBefore,
    metricAfter: entry.metricAfter,
    problemBefore: entry.problemBefore,
    solutionApplied: entry.solutionApplied,
    technicalDetails: entry.technicalDetails,
    commandsSnippet: entry.commandsSnippet || '',
    rollbackPlan: entry.rollbackPlan || '',
  };
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700/80 bg-[#0A0F1D] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/40';

const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-300 mb-1';

export function MemorialInfraestruturaClient({
  initialSnapshot,
  masterName,
}: MemorialInfraestruturaClientProps) {
  const [snapshot, setSnapshot] = useState<MemorialInfraSnapshot>(initialSnapshot);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [serverFilter, setServerFilter] = useState<'TODOS' | MemorialServerKey>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<'TODAS' | MemorialCategory>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modal Criar / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(buildEmptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const recarregarMemorial = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/master/memorial-infraestrutura', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao atualizar o Memorial.');
      setSnapshot(data as MemorialInfraSnapshot);
      setFeedbackMsg(null);
    } catch (err) {
      setFeedbackMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao atualizar dados.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const contadoresPorServidor = useMemo(() => {
    const counts: Record<MemorialServerKey, number> = {
      SRVSQL: 0,
      SRVFILES: 0,
      SRVSIPLANIA: 0,
      GERAL: 0,
    };
    for (const item of snapshot.entries) {
      counts[item.server] = (counts[item.server] || 0) + 1;
    }
    return counts;
  }, [snapshot.entries]);

  const entradasFiltradas = useMemo(() => {
    const q = normalizarSemAcento(searchQuery.trim());
    return snapshot.entries.filter((entry) => {
      if (serverFilter !== 'TODOS' && entry.server !== serverFilter) return false;
      if (categoryFilter !== 'TODAS' && entry.category !== categoryFilter) return false;
      if (!q) return true;
      const blob = normalizarSemAcento(
        [
          entry.title,
          entry.server,
          entry.category,
          entry.connectorVersion || '',
          entry.summarySimple,
          entry.problemBefore,
          entry.solutionApplied,
          entry.metricBefore,
          entry.metricAfter,
          entry.technicalDetails,
          entry.commandsSnippet || '',
        ].join(' '),
      );
      return blob.includes(q);
    });
  }, [categoryFilter, searchQuery, serverFilter, snapshot.entries]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copiarComando = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      setFeedbackMsg({ type: 'err', text: 'Não foi possível copiar para a área de transferência.' });
    }
  };

  const abrirNovaMelhoria = () => {
    setEditingId(null);
    setFormState(buildEmptyForm());
    setModalError('');
    setModalOpen(true);
  };

  const abrirEdicao = (entry: MemorialInfraEntry) => {
    setEditingId(entry.id);
    setFormState(formFromEntry(entry));
    setModalError('');
    setModalOpen(true);
  };

  const salvarMelhoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setModalError('');

    const payload = {
      server: formState.server,
      category: formState.category,
      status: formState.status,
      title: formState.title,
      implementedAt: formState.implementedAt,
      connectorVersion: formState.connectorVersion.trim() || null,
      impactBadge: formState.impactBadge,
      summarySimple: formState.summarySimple,
      metricBefore: formState.metricBefore,
      metricAfter: formState.metricAfter,
      problemBefore: formState.problemBefore,
      solutionApplied: formState.solutionApplied,
      technicalDetails: formState.technicalDetails,
      commandsSnippet: formState.commandsSnippet.trim() || null,
      rollbackPlan: formState.rollbackPlan.trim() || null,
    };

    try {
      const res = await fetch('/api/master/memorial-infraestrutura', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, data: payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível salvar a melhoria.');
      }
      setModalOpen(false);
      await recarregarMemorial();
      setFeedbackMsg({
        type: 'ok',
        text: editingId
          ? 'Registro de melhoria atualizado com sucesso.'
          : 'Nova melhoria registrada no Memorial dos Servidores.',
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erro ao salvar melhoria.');
    } finally {
      setIsSaving(false);
    }
  };

  const excluirMelhoria = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/master/memorial-infraestrutura?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao excluir registro.');
      }
      setConfirmDeleteId(null);
      await recarregarMemorial();
      setFeedbackMsg({ type: 'ok', text: 'Registro removido do Memorial.' });
    } catch (err) {
      setFeedbackMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao excluir registro.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const imprimirDossiePdf = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=800');
    if (!win) {
      setFeedbackMsg({
        type: 'err',
        text: 'Pop-up bloqueado pelo navegador. Autorize pop-ups para imprimir/salvar o PDF.',
      });
      return;
    }

    const linhasHtml = entradasFiltradas
      .map(
        (item) => `
        <article class="entry">
          <div class="meta">
            <span class="badge">${escapeHtmlText(formatDateBr(item.implementedAt))}</span>
            <span class="badge">${escapeHtmlText(SERVER_LABELS[item.server])}</span>
            <span class="badge">${escapeHtmlText(CATEGORY_LABELS[item.category])}</span>
            ${item.connectorVersion ? `<span class="badge">${escapeHtmlText(item.connectorVersion)}</span>` : ''}
            <span class="badge impact">${escapeHtmlText(item.impactBadge)}</span>
          </div>
          <h3>${escapeHtmlText(item.title)}</h3>
          <p class="simple"><strong>Resumo Executivo:</strong> ${escapeHtmlText(item.summarySimple)}</p>
          <div class="compare">
            <div><strong>Antes:</strong> ${escapeHtmlText(item.metricBefore)}</div>
            <div><strong>Depois:</strong> ${escapeHtmlText(item.metricAfter)}</div>
          </div>
          <p><strong>Problema:</strong> ${escapeHtmlText(item.problemBefore)}</p>
          <p><strong>Solução:</strong> ${escapeHtmlText(item.solutionApplied)}</p>
          ${item.rollbackPlan ? `<p><strong>Rollback:</strong> ${escapeHtmlText(item.rollbackPlan)}</p>` : ''}
        </article>`,
      )
      .join('\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Memorial dos Servidores 7º RI — Exclusivo MASTER</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; line-height: 1.45; }
    h1 { margin: 0 0 4px 0; font-size: 20px; }
    .sub { color: #475569; font-size: 12px; margin-bottom: 18px; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
    .entry { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .entry h3 { margin: 6px 0; font-size: 14px; color: #0f172a; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
    .badge { background: #e2e8f0; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .badge.impact { background: #d1fae5; color: #065f46; }
    .simple { background: #f8fafc; border-left: 3px solid #0284c7; padding: 6px 10px; font-size: 12px; }
    .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f1f5f9; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin: 8px 0; }
    p { margin: 5px 0; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Memorial Técnico e Executivo dos Servidores — 7º RI da Capital</h1>
  <div class="sub">Emitido por ${escapeHtmlText(masterName)} em ${escapeHtmlText(new Date().toLocaleString('pt-BR'))} · ${entradasFiltradas.length} registro(s) exibido(s) · SRVSQL (10.0.0.25), SRVFILES (10.0.0.40) e SRVSIPLANIA (10.0.0.6)</div>
  ${linhasHtml}
</body>
</html>`;

    win.document.open();
    win.document.write(htmlDoc);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Executivo da Documentação + Ações */}
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0D1426] via-[#0B101E] to-[#080C17] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300 font-semibold">
              <Server className="h-4 w-4" />
              <span>Base Documental Contínua · SRVSQL · SRVFILES · SRVSIPLANIA</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Memorial de Melhorias, Arquitetura e Segurança dos Servidores do 7º RI
            </h2>
            <p className="text-xs text-slate-300 max-w-4xl leading-relaxed">
              Histórico completo em linguagem simples e técnica desde a implantação do FIORIX até a versão{' '}
              <strong className="text-amber-300">v2.6.23</strong>. Toda nova melhoria realizada nos servidores é registrada aqui automaticamente no código e pode receber apontamentos manuais do MASTER.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void recarregarMemorial()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={imprimirDossiePdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={abrirNovaMelhoria}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Melhoria</span>
            </button>
          </div>
        </div>

        {/* Faixa de KPIs */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-800 bg-[#080C17] px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Total Documentado</div>
            <div className="mt-0.5 text-lg font-bold text-white">{snapshot.entries.length} registros</div>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3.5 py-2.5">
            <div className="text-[11px] text-cyan-300/90">SRVSQL (10.0.0.25)</div>
            <div className="mt-0.5 text-lg font-bold text-white">{contadoresPorServidor.SRVSQL} melhorias</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3.5 py-2.5">
            <div className="text-[11px] text-amber-300/90">SRVFILES (10.0.0.40)</div>
            <div className="mt-0.5 text-lg font-bold text-white">{contadoresPorServidor.SRVFILES} melhorias</div>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-3.5 py-2.5">
            <div className="text-[11px] text-violet-300/90">SRVSIPLANIA (10.0.0.6)</div>
            <div className="mt-0.5 text-lg font-bold text-white">{contadoresPorServidor.SRVSIPLANIA} melhorias</div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2.5">
            <div className="text-[11px] text-emerald-300/90">Notas do MASTER</div>
            <div className="mt-0.5 text-lg font-bold text-white">{snapshot.dbPersistedCount} no banco</div>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs ${
            feedbackMsg.type === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Cards Interativos dos 3 Servidores (clique filtra a linha do tempo) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {snapshot.servers.map((srv) => {
          const isSelected = serverFilter === srv.key;
          return (
            <button
              key={srv.key}
              type="button"
              onClick={() => {
                setServerFilter((prev) => (prev === srv.key ? 'TODOS' : srv.key));
                if (activeTab === 'governanca' || activeTab === 'automacao') {
                  setActiveTab('timeline');
                }
              }}
              className={`text-left rounded-2xl border bg-gradient-to-br p-4 transition-all cursor-pointer ${
                SERVER_CARD_ACCENT[srv.key]
              } ${
                isSelected
                  ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/10'
                  : 'hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-wide text-white">{srv.name}</span>
                    <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                      {srv.ip}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-200">{srv.roleTitle}</div>
                </div>
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  {isSelected ? 'Filtro Ativo' : 'Filtrar'}
                </span>
              </div>

              <div className="mt-2.5 text-[11px] text-slate-400">{srv.specs}</div>
              <div className="mt-0.5 text-[11px] text-slate-300">{srv.engines}</div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {srv.keyMetrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">{m.label}</div>
                    <div className="text-[11px] font-semibold text-white truncate" title={m.value}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navegação por Abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Linha do Tempo &amp; Melhorias ({entradasFiltradas.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('comparativo')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'comparativo'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Comparativo Antes vs. Depois</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('governanca')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'governanca'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-white'
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>Governança, Contas &amp; Segurança</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automacao')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'automacao'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Evolução Contínua</span>
        </button>
      </div>

      {/* Barra de Busca e Filtros para Abas de Histórico */}
      {(activeTab === 'timeline' || activeTab === 'comparativo') && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0D1322]/90 p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar melhoria por termo, servidor, versão (ex: rsync, GRANT, MOOCA, 40000 MB, WAL)..."
                className="w-full rounded-xl border border-slate-700/80 bg-[#070A12] pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['TODOS', 'SRVSQL', 'SRVFILES', 'SRVSIPLANIA', 'GERAL'] as const).map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setServerFilter(srv)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    serverFilter === srv
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {srv === 'TODOS' ? 'Todos os Servidores' : srv}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('TODAS')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                categoryFilter === 'TODAS'
                  ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas as Categorias
            </button>
            {(Object.keys(CATEGORY_LABELS) as MemorialCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                    : 'border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ABA 1: LINHA DO TEMPO & MELHORIAS */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {entradasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0B101E] p-10 text-center text-xs text-slate-400">
              Nenhuma melhoria encontrada para os filtros selecionados.
            </div>
          ) : (
            entradasFiltradas.map((entry) => {
              const expanded = Boolean(expandedIds[entry.id]);
              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-slate-800/90 bg-[#0C1221]/95 p-5 shadow-lg space-y-4 hover:border-slate-700/90 transition-colors"
                >
                  {/* Linha de Metadados */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                        {formatDateBr(entry.implementedAt)}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SERVER_BADGE_CLASS[entry.server]}`}
                      >
                        {SERVER_LABELS[entry.server]}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] text-slate-200">
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[entry.status]}`}
                      >
                        {STATUS_LABELS[entry.status]}
                      </span>
                      {entry.connectorVersion && (
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-200">
                          {entry.connectorVersion}
                        </span>
                      )}
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          entry.source === 'REGISTRO_MASTER'
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {entry.source === 'REGISTRO_MASTER' ? 'Registro MASTER' : 'Oficial no Código'}
                      </span>
                    </div>

                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
                      {entry.impactBadge}
                    </span>
                  </div>

                  {/* Título */}
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {entry.title}
                  </h3>

                  {/* Explicação Simples (acessível) */}
                  <div className="rounded-xl border border-slate-800 border-l-4 border-l-cyan-400 bg-[#080D19] px-4 py-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Explicação Simples</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {entry.summarySimple}
                    </p>
                  </div>

                  {/* Faixa Antes vs Depois */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-11 items-stretch">
                    <div className="md:col-span-5 rounded-xl border border-rose-500/25 bg-rose-950/20 px-3.5 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                        Cenário Anterior (Antes)
                      </div>
                      <div className="mt-1 text-xs font-medium text-rose-100">{entry.metricBefore}</div>
                    </div>

                    <div className="hidden md:flex md:col-span-1 items-center justify-center text-slate-500">
                      <ArrowRight className="h-4 w-4 text-emerald-400" />
                    </div>

                    <div className="md:col-span-5 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3.5 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Cenário Atual (Depois)
                      </div>
                      <div className="mt-1 text-xs font-semibold text-emerald-100">{entry.metricAfter}</div>
                    </div>
                  </div>

                  {/* Rodapé de Ações */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(entry.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Terminal className="h-3.5 w-3.5 text-cyan-300" />
                      <span>
                        {expanded
                          ? 'Ocultar Detalhes Técnicos & Scripts'
                          : 'Ver Detalhes Técnicos, Scripts & Rollback'}
                      </span>
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>Autor: {entry.authorName}</span>
                      {entry.source === 'REGISTRO_MASTER' && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirEdicao(entry)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Editar</span>
                          </button>

                          {confirmDeleteId === entry.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deletingId === entry.id}
                                onClick={() => void excluirMelhoria(entry.id)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                              >
                                {deletingId === entry.id ? 'Excluindo...' : 'Confirmar Exclusão'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Excluir</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Seção Expansível Técnica */}
                  {expanded && (
                    <div className="mt-2 rounded-xl border border-slate-800 bg-[#070B15] p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="font-bold text-rose-300">Causa Raiz / Problema Identificado</div>
                          <p className="text-slate-300 leading-relaxed">{entry.problemBefore}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="font-bold text-emerald-300">Solução Aplicada</div>
                          <p className="text-slate-300 leading-relaxed">{entry.solutionApplied}</p>
                        </div>
                      </div>

                      {entry.technicalDetails && (
                        <div className="space-y-1 border-t border-slate-800/80 pt-3">
                          <div className="font-bold text-cyan-300">Notas de Engenharia &amp; Evidências</div>
                          <p className="text-slate-300 leading-relaxed">{entry.technicalDetails}</p>
                        </div>
                      )}

                      {entry.commandsSnippet && (
                        <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300">
                              Comandos / Scripts Referência (Somente Leitura / Sanitizados)
                            </span>
                            <button
                              type="button"
                              onClick={() => void copiarComando(entry.id, entry.commandsSnippet!)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:text-white cursor-pointer"
                            >
                              {copiedId === entry.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-black/60 p-3 font-mono text-[11px] text-emerald-200 leading-relaxed">
                            {entry.commandsSnippet}
                          </pre>
                        </div>
                      )}

                      {entry.rollbackPlan && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-amber-100/90">
                          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                          <div>
                            <span className="font-bold text-amber-300">Plano de Rollback Seguro: </span>
                            <span>{entry.rollbackPlan}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* ABA 2: COMPARATIVO ANTES VS. DEPOIS */}
      {activeTab === 'comparativo' && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0B101E] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-[#080C18] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Data / Versão</th>
                  <th className="px-4 py-3">Servidor</th>
                  <th className="px-4 py-3">Melhoria Implantada</th>
                  <th className="px-4 py-3">Antes</th>
                  <th className="px-4 py-3">Depois</th>
                  <th className="px-4 py-3 text-right">Impacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {entradasFiltradas.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/35 align-top">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      <div>{formatDateBr(entry.implementedAt)}</div>
                      {entry.connectorVersion && (
                        <div className="text-amber-300 font-semibold">{entry.connectorVersion}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SERVER_BADGE_CLASS[entry.server]}`}
                      >
                        {entry.server}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="font-bold text-white">{entry.title}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{CATEGORY_LABELS[entry.category]}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[260px] text-rose-200/90">{entry.metricBefore}</td>
                    <td className="px-4 py-3 max-w-[260px] text-emerald-200 font-medium">
                      {entry.metricAfter}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                        {entry.impactBadge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: GOVERNANÇA, CONTAS & SEGURANÇA */}
      {activeTab === 'governanca' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {snapshot.governance.map((gov) => (
            <div
              key={gov.id}
              className="rounded-2xl border border-slate-800/90 bg-[#0C1221]/95 p-5 space-y-3 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${SERVER_BADGE_CLASS[gov.server]}`}
                >
                  {SERVER_LABELS[gov.server]}
                </span>
                <span className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  {gov.mode}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{gov.subject}</h3>
                <div className="mt-0.5 font-mono text-[11px] text-cyan-300">{gov.portOrScope}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#080C18] p-3 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Blindagem Técnica Aplicada
                </div>
                <div className="mt-1 font-medium text-slate-100">{gov.protection}</div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{gov.notes}</p>
            </div>
          ))}
        </div>
      )}

      {/* ABA 4: EVOLUÇÃO CONTÍNUA */}
      {activeTab === 'automacao' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-500/30 bg-[#0C1221]/95 p-5 space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
              <Cpu className="h-4 w-4" />
              <span>1. Atualização Automática Versionada no Código</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O repositório possui regra permanente sempre ativa (<code className="text-cyan-200">AGENTS.md</code> e{' '}
              <code className="text-cyan-200">.agents/rules/memorial-infraestrutura-7ri.md</code>). Toda vez que uma melhoria de banco, índice SQL, tarefa agendada, rede ou atualização do{' '}
              <code className="text-amber-200">fiorix-connector</code> for aplicada em qualquer um dos três servidores do 7º RI, o histórico oficial em{' '}
              <code className="text-cyan-200">src/lib/memorial-infraestrutura/catalog.ts</code> é atualizado na mesma entrega.
            </p>
            <div className="rounded-xl border border-slate-800 bg-[#070B15] p-3 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>Proteção de Credenciais Integrada</span>
              </div>
              <p>
                Nenhum script ou registro aceita senhas reais, tokens ou connection strings privadas. Comandos exibidos aqui servem estritamente como referência auditável e segura para o MASTER.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-[#0C1221]/95 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Layers className="h-4 w-4" />
              <span>2. Registro Direto pelo MASTER (+ Nova Melhoria)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Quando você realizar ajustes manuais diretamente via RDP, Windows Task Scheduler, Firewall, Hyper-V, SQL Server Management Studio ou manutenção física de hardware nos servidores{' '}
              <strong>SRVSQL</strong>, <strong>SRVFILES</strong> ou <strong>SRVSIPLANIA</strong>, clique em{' '}
              <strong className="text-amber-300">+ Nova Melhoria</strong> nesta tela.
            </p>
            <div className="rounded-xl border border-slate-800 bg-[#070B15] p-3 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-amber-300" />
                <span>Persistência Auditada e RLS Estrito</span>
              </div>
              <p>
                Cada registro manual é salvo na tabela isolada <code className="text-cyan-200">fiorix_infra_memorial_entries</code> com auditoria em <code className="text-cyan-200">fiorix_audit_logs</code>, acessível e editável exclusivamente pela conta <strong>MASTER</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR / EDITAR MELHORIA */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0D1322] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingId
                    ? 'Editar Registro de Melhoria'
                    : 'Registrar Nova Melhoria nos Servidores (7º RI)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={salvarMelhoria} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="mem-server" className={LABEL_CLASS}>
                    Servidor
                  </label>
                  <select
                    id="mem-server"
                    value={formState.server}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, server: e.target.value as MemorialServerKey }))
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="SRVSQL">SRVSQL (10.0.0.25)</option>
                    <option value="SRVFILES">SRVFILES (10.0.0.40)</option>
                    <option value="SRVSIPLANIA">SRVSIPLANIA (10.0.0.6)</option>
                    <option value="GERAL">Geral (3 Servidores)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="mem-cat" className={LABEL_CLASS}>
                    Categoria
                  </label>
                  <select
                    id="mem-cat"
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, category: e.target.value as MemorialCategory }))
                    }
                    className={INPUT_CLASS}
                  >
                    {(Object.keys(CATEGORY_LABELS) as MemorialCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mem-status" className={LABEL_CLASS}>
                    Status
                  </label>
                  <select
                    id="mem-status"
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, status: e.target.value as MemorialStatus }))
                    }
                    className={INPUT_CLASS}
                  >
                    {(Object.keys(STATUS_LABELS) as MemorialStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mem-date" className={LABEL_CLASS}>
                    Data (AAAA-MM-DD)
                  </label>
                  <input
                    id="mem-date"
                    type="date"
                    required
                    value={formState.implementedAt}
                    onChange={(e) => setFormState((p) => ({ ...p, implementedAt: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label htmlFor="mem-title" className={LABEL_CLASS}>
                    Título da Melhoria
                  </label>
                  <input
                    id="mem-title"
                    type="text"
                    required
                    minLength={5}
                    value={formState.title}
                    onChange={(e) => setFormState((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Ajuste de afinidade do processo de backup..."
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="mem-ver" className={LABEL_CLASS}>
                    Versão Connector (opcional)
                  </label>
                  <input
                    id="mem-ver"
                    type="text"
                    value={formState.connectorVersion}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, connectorVersion: e.target.value }))
                    }
                    placeholder="Ex: v2.6.23"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="mem-badge" className={LABEL_CLASS}>
                    Selo de Impacto
                  </label>
                  <input
                    id="mem-badge"
                    type="text"
                    required
                    minLength={2}
                    value={formState.impactBadge}
                    onChange={(e) => setFormState((p) => ({ ...p, impactBadge: e.target.value }))}
                    placeholder="Ex: -60% CPU"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mem-simple" className={LABEL_CLASS}>
                  Explicação Simples (para leitura rápida executiva)
                </label>
                <textarea
                  id="mem-simple"
                  rows={2}
                  required
                  minLength={10}
                  value={formState.summarySimple}
                  onChange={(e) => setFormState((p) => ({ ...p, summarySimple: e.target.value }))}
                  placeholder="Explique de forma clara o que foi feito e qual benefício trouxe no dia a dia..."
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mem-before" className={LABEL_CLASS}>
                    Métrica / Cenário Antes
                  </label>
                  <input
                    id="mem-before"
                    type="text"
                    required
                    value={formState.metricBefore}
                    onChange={(e) => setFormState((p) => ({ ...p, metricBefore: e.target.value }))}
                    placeholder="Ex: CPU em 93% durante o expediente"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="mem-after" className={LABEL_CLASS}>
                    Métrica / Cenário Depois
                  </label>
                  <input
                    id="mem-after"
                    type="text"
                    required
                    value={formState.metricAfter}
                    onChange={(e) => setFormState((p) => ({ ...p, metricAfter: e.target.value }))}
                    placeholder="Ex: CPU estabilizada em 33,6%"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mem-prob" className={LABEL_CLASS}>
                    Problema / Causa Raiz
                  </label>
                  <textarea
                    id="mem-prob"
                    rows={3}
                    required
                    minLength={5}
                    value={formState.problemBefore}
                    onChange={(e) => setFormState((p) => ({ ...p, problemBefore: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="mem-sol" className={LABEL_CLASS}>
                    Solução Aplicada
                  </label>
                  <textarea
                    id="mem-sol"
                    rows={3}
                    required
                    minLength={5}
                    value={formState.solutionApplied}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, solutionApplied: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mem-tech" className={LABEL_CLASS}>
                  Detalhes Técnicos Adicionais (opcional)
                </label>
                <textarea
                  id="mem-tech"
                  rows={2}
                  value={formState.technicalDetails}
                  onChange={(e) => setFormState((p) => ({ ...p, technicalDetails: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mem-cmd" className={LABEL_CLASS}>
                    Comandos / Script Sanitizado (jamais informe senhas)
                  </label>
                  <textarea
                    id="mem-cmd"
                    rows={3}
                    value={formState.commandsSnippet}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, commandsSnippet: e.target.value }))
                    }
                    placeholder="Ex: Get-Process -Name rsync ..."
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>
                <div>
                  <label htmlFor="mem-rb" className={LABEL_CLASS}>
                    Plano de Rollback Seguro (opcional)
                  </label>
                  <textarea
                    id="mem-rb"
                    rows={3}
                    value={formState.rollbackPlan}
                    onChange={(e) => setFormState((p) => ({ ...p, rollbackPlan: e.target.value }))}
                    placeholder="Como desfazer com segurança se necessário..."
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Por segurança, o servidor bloqueia gravação caso detecte senhas, secrets ou tokens em qualquer campo.
                </span>
              </div>

              {modalError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>{isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Gravar no Memorial'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
