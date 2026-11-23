'use client';

import { useState } from 'react';
import { BarChart3, Building2, FileJson, LayoutDashboard, Search } from 'lucide-react';
import type { ReurbConsultaFiltros } from '@/lib/reurb/types';
import { ConsultaReurbTab } from './ConsultaReurbTab';
import { ExportacoesReurbTab } from './ExportacoesReurbTab';
import { PainelReurbTab, type PainelKpiDrillType } from './PainelReurbTab';
import { ProcessoDetalheModal } from './ProcessoDetalheModal';
import { RelatoriosReurbTab } from './RelatoriosReurbTab';

type ReurbTabKey = 'painel' | 'consulta' | 'relatorios' | 'exportacoes';

interface CentralReurbClientProps {
  initialAno: number;
  initialMes: number;
  demoMode: boolean;
  permissoes: {
    canExportJson: boolean;
    canConfirmImport: boolean;
    isReadOnly: boolean;
  };
  userRole: string;
}

export function CentralReurbClient({
  initialAno,
  initialMes,
  demoMode,
  permissoes,
}: CentralReurbClientProps) {
  const [abaAtiva, setAbaAtiva] = useState<ReurbTabKey>('painel');
  const [ano, setAno] = useState<number>(initialAno);
  const [mes, setMes] = useState<number | 'todos'>(initialMes);
  const [consultaFiltros, setConsultaFiltros] = useState<ReurbConsultaFiltros>({
    ano: initialAno,
    mes: initialMes,
    tipoData: 'registro',
    modalidade: 'TODAS',
    situacao: 'TODAS',
    page: 1,
    pageSize: 20,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleChangePeriodo(nextAno: number, nextMes: number | 'todos') {
    setAno(nextAno);
    setMes(nextMes);
    setConsultaFiltros((prev) => ({
      ...prev,
      ano: nextAno,
      mes: nextMes,
      dataDe: null,
      dataAte: null,
      page: 1,
    }));
  }

  function handleDrillDown(tipo: PainelKpiDrillType) {
    setConsultaFiltros((prev) => ({
      ...prev,
      ano,
      mes,
      dataDe: null,
      dataAte: null,
      tipoData: tipo === 'derivadasAbertas' ? 'abertura_derivada' : 'registro',
      situacao: tipo === 'aptas' ? 'APTO' : tipo === 'pendencias' ? 'PENDENTE' : 'TODAS',
      modalidade: 'TODAS',
      page: 1,
    }));
    setAbaAtiva('consulta');
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectMany(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return Array.from(next);
    });
  }

  const tabs: Array<{ id: ReurbTabKey; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard },
    { id: 'consulta', label: 'Consulta', icon: Search },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'exportacoes', label: 'Exportações', icon: FileJson },
  ];

  return (
    <div className="space-y-6">
      {/* Header Central REURB */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Building2 className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Central REURB</h1>
            {demoMode && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                Modo demonstração controlado
              </span>
            )}
            {permissoes.isReadOnly && (
              <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                Somente leitura
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Regularização Fundiária Urbana (WEBRI + OCR SiplanIA) · Leiaute Importar em Lote do Ofício Eletrônico v1.4
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAbaAtiva('exportacoes')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30"
        >
          <FileJson className="h-4 w-4" />
          Gerar lote ({selectedIds.length})
        </button>
      </div>

      {/* Navegação em 4 abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas */}
      {abaAtiva === 'painel' && (
        <PainelReurbTab
          ano={ano}
          mes={mes}
          refreshKey={refreshKey}
          onChangePeriodo={handleChangePeriodo}
          onDrillDown={handleDrillDown}
          onOpenDetalhe={(id) => setDetalheId(id)}
        />
      )}

      {abaAtiva === 'consulta' && (
        <ConsultaReurbTab
          filtros={consultaFiltros}
          selectedIds={selectedIds}
          refreshKey={refreshKey}
          onUpdateFiltros={(patch) => setConsultaFiltros((prev) => ({ ...prev, ...patch }))}
          onToggleSelect={handleToggleSelect}
          onSelectMany={handleSelectMany}
          onClearSelection={() => setSelectedIds([])}
          onOpenDetalhe={(id) => setDetalheId(id)}
          onIrParaExportacoes={() => setAbaAtiva('exportacoes')}
        />
      )}

      {abaAtiva === 'relatorios' && (
        <RelatoriosReurbTab
          ano={ano}
          mes={mes}
          refreshKey={refreshKey}
          onChangePeriodo={handleChangePeriodo}
          onOpenDetalhe={(id) => setDetalheId(id)}
        />
      )}

      {abaAtiva === 'exportacoes' && (
        <ExportacoesReurbTab
          selectedIds={selectedIds}
          canExportJson={permissoes.canExportJson}
          canConfirmImport={permissoes.canConfirmImport}
          isReadOnly={permissoes.isReadOnly}
          refreshKey={refreshKey}
          onToggleSelect={handleToggleSelect}
          onClearSelection={() => setSelectedIds([])}
          onOpenDetalhe={(id) => setDetalheId(id)}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <ProcessoDetalheModal
        regularizacaoId={detalheId}
        canExportJson={permissoes.canExportJson}
        isReadOnly={permissoes.isReadOnly}
        onClose={() => setDetalheId(null)}
        onExportSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
