'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Database, 
  FileSpreadsheet, 
  Target, 
  Layers3, 
  RotateCcw, 
  Printer, 
  Activity, 
  ExternalLink, 
  Layers, 
  Copy, 
  Check, 
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import type { IncrementalModuleStatus, BatchHistoryItem } from '@/lib/health/types';
import { BatchHistoryModal } from './BatchHistoryModal';

interface Props {
  modules: IncrementalModuleStatus[];
  recentBatches?: Record<string, BatchHistoryItem[]>;
}

interface ProcedureMeta {
  key: string;
  name: string;
  procedureSql: string;
  description: string;
  category: string;
  targetTable: string;
  dashboardUrl: string;
  dashboardLabel: string;
  icon: React.ElementType;
  colorScheme: {
    bgLight: string;
    borderLight: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    accentColor: string;
  };
  isNew?: boolean;
}

const PROCEDURES_CATALOG: ProcedureMeta[] = [
  {
    key: 'bi',
    name: 'Módulo BI & Protocolos',
    procedureSql: 'dbo.pr_Fiorix_BI_Incremental',
    description: 'Protocolos em andamento, títulos, prenotações e status de processos no cartório.',
    category: 'Core Operacional',
    targetTable: 'fiorix_bi_imports / protocolos',
    dashboardUrl: '/bi',
    dashboardLabel: 'Dashboard BI',
    icon: Database,
    colorScheme: {
      bgLight: 'bg-cyan-500/10',
      borderLight: 'border-cyan-500/20',
      badgeBg: 'bg-cyan-500/10',
      badgeText: 'text-cyan-400',
      badgeBorder: 'border-cyan-500/20',
      accentColor: '#06b6d4',
    }
  },
  {
    key: 'produtividade',
    name: 'Produtividade de Escreventes',
    procedureSql: 'dbo.pr_Fiorix_BI_Produtividade',
    description: 'Controle de atos praticados por funcionário, tempos operacionais e desempenho diário.',
    category: 'Recursos Humanos',
    targetTable: 'fiorix_produtividade_imports',
    dashboardUrl: '/bi/produtividade',
    dashboardLabel: 'Painel Produtividade',
    icon: FileSpreadsheet,
    colorScheme: {
      bgLight: 'bg-emerald-500/10',
      borderLight: 'border-emerald-500/20',
      badgeBg: 'bg-emerald-500/10',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/20',
      accentColor: '#10b981',
    }
  },
  {
    key: 'metas',
    name: 'Metas & Reconciliação',
    procedureSql: 'dbo.pr_Fiorix_BI_METAS',
    description: 'Acompanhamento de metas estratégicas de atendimento, registros concluídos e prazos legais.',
    category: 'Gestão Estratégica',
    targetTable: 'fiorix_metas_imports',
    dashboardUrl: '/bi/metas',
    dashboardLabel: 'Dashboard Metas',
    icon: Target,
    colorScheme: {
      bgLight: 'bg-amber-500/10',
      borderLight: 'border-amber-500/20',
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/20',
      accentColor: '#f59e0b',
    }
  },
  {
    key: 'tarefas',
    name: 'Tarefas & Backlog',
    procedureSql: 'dbo.pr_Fiorix_BI_TAREFAS',
    description: 'Fila de pendências internas, distribuição de backlog e prazos de resolução entre equipes.',
    category: 'Fluxo de Trabalho',
    targetTable: 'fiorix_tarefas_imports',
    dashboardUrl: '/bi/tarefas',
    dashboardLabel: 'Gestão Tarefas',
    icon: Layers3,
    colorScheme: {
      bgLight: 'bg-purple-500/10',
      borderLight: 'border-purple-500/20',
      badgeBg: 'bg-purple-500/10',
      badgeText: 'text-purple-400',
      badgeBorder: 'border-purple-500/20',
      accentColor: '#a855f7',
    }
  },
  {
    key: 'retornos',
    name: 'Retornos & Devolutivas',
    procedureSql: 'dbo.pr_Fiorix_BI_Retornos',
    description: 'Gestão de notas devolutivas, reentradas de títulos corrigidos e motivos de devolução.',
    category: 'Qualidade Notarial',
    targetTable: 'fiorix_retornos_imports',
    dashboardUrl: '/bi/retornos',
    dashboardLabel: 'Painel Retornos',
    icon: RotateCcw,
    isNew: true,
    colorScheme: {
      bgLight: 'bg-blue-500/10',
      borderLight: 'border-blue-500/20',
      badgeBg: 'bg-blue-500/10',
      badgeText: 'text-blue-400',
      badgeBorder: 'border-blue-500/20',
      accentColor: '#3b82f6',
    }
  },
  {
    key: 'impressoes',
    name: 'Impressões (Livro & Certidão)',
    procedureSql: 'dbo.pr_Fiorix_BI_Impressoes',
    description: 'Auditoria de folhas impressas, livro de registro, certidões emitidas e consumo de material.',
    category: 'Controle Gráfico',
    targetTable: 'fiorix_impressoes_imports',
    dashboardUrl: '/controle-impressoes',
    dashboardLabel: 'Controle Impressões',
    icon: Printer,
    isNew: true,
    colorScheme: {
      bgLight: 'bg-orange-500/10',
      borderLight: 'border-orange-500/20',
      badgeBg: 'bg-orange-500/10',
      badgeText: 'text-orange-400',
      badgeBorder: 'border-orange-500/20',
      accentColor: '#f97316',
    }
  },
];

export function ProceduresOverviewSection({ modules, recentBatches }: Props) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<{ name: string; key: string } | null>(null);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(sql);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Stored Procedures Integradas
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    6 Rotinas Ativas
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Mapeamento oficial das procedures do SQL Server (WebRI) para o FIORIX SaaS com monitoramento de lotes
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/bi/importacoes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-white transition-all active:scale-95"
            >
              <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
              <span>Painel de Importações</span>
            </Link>
          </div>
        </div>

        {/* Grid de Cards das 7 Procedures */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {PROCEDURES_CATALOG.map((proc) => {
            const Icon = proc.icon;
            const moduleStatus = modules.find((m) => m.key === proc.key);
            const batches = recentBatches?.[proc.key] ?? [];
            const lastBatch = batches[0];
            const recordsCount = lastBatch ? lastBatch.recordsReceived : (moduleStatus?.recordsCount ?? 0);
            const isCopied = copiedSql === proc.procedureSql;

            return (
              <div
                key={proc.key}
                className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-[#0B1020]/90 dark:shadow-xl backdrop-blur-xl transition-all hover:border-white/20 group"
              >
                {/* Badge de "Nova" ou Categoria */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${proc.colorScheme.bgLight} border ${proc.colorScheme.borderLight}`}>
                      <Icon className="h-4 w-4" style={{ color: proc.colorScheme.accentColor }} />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-white/40 block">
                        {proc.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {proc.name}
                      </h4>
                    </div>
                  </div>

                  {proc.isNew && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/30">
                      <Sparkles className="h-2.5 w-2.5 text-blue-400" />
                      Nova
                    </span>
                  )}
                </div>

                {/* Descrição */}
                <p className="text-xs text-slate-600 dark:text-white/60 mb-4 line-clamp-2 leading-relaxed">
                  {proc.description}
                </p>

                {/* Bloco de Código da Procedure */}
                <div className="mb-4 rounded-xl bg-slate-100 p-2.5 dark:bg-white/[0.03] border border-slate-200 dark:border-white/6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-white/90 truncate">
                      {proc.procedureSql}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(proc.procedureSql)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                      title="Copiar comando SQL"
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-white/40">
                    <span>Destino:</span>
                    <span className="font-mono text-slate-700 dark:text-white/70 truncate max-w-[160px]">
                      {proc.targetTable}
                    </span>
                  </div>
                </div>

                {/* Métricas do Módulo (Última Execução / Registros) */}
                <div className="grid grid-cols-2 gap-2 mb-4 pt-3 border-t border-slate-200 dark:border-white/6 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-white/40 block">Última Carga</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-white/90 text-[11px] truncate block">
                      {moduleStatus?.lastSyncAt ?? 'Recentemente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-white/40 block">Último Lote</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                      {recordsCount ? `${recordsCount.toLocaleString('pt-BR')} reg.` : '0 reg.'}
                    </span>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/6">
                  <button
                    type="button"
                    onClick={() => setSelectedModule({ name: proc.name, key: proc.key })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/8 text-slate-700 dark:text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95"
                  >
                    <Layers className="h-3 w-3 text-blue-400" />
                    <span>Ver Lotes</span>
                  </button>

                  <Link
                    href={proc.dashboardUrl}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold transition-all active:scale-95 hover:border-blue-500/40"
                    title={`Acessar ${proc.dashboardLabel}`}
                  >
                    <span>{proc.dashboardLabel}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Histórico de Lotes */}
      {selectedModule && (
        <BatchHistoryModal
          isOpen={!!selectedModule}
          onClose={() => setSelectedModule(null)}
          moduleName={selectedModule.name}
          moduleKey={selectedModule.key}
          batches={recentBatches?.[selectedModule.key] ?? []}
        />
      )}
    </>
  );
}
