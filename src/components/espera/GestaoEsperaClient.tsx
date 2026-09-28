'use client';

import React, { useState, useMemo } from 'react';
import {
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Search,
  ChevronRight,
  Timer,
  Layers,
  TrendingUp,
  BarChart3,
  Settings,
  Radio,
  Activity,
  ArrowUpDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
type Periodo = 'hoje' | '7d' | 'mes' | 'custom';
type Aba = 'visao_geral' | 'dentro_sla' | 'fora_sla' | 'atendimentos' | 'horarios_pico' | 'agendamentos' | 'qualidade';

interface SenhaRecord {
  id: string;
  senha: string;
  servico: string;
  fila: string;
  emissao: string;
  chamada: string;
  tempoEsperaMin: number;
  guiche: string;
  atendente: string;
  situacao: 'Chamado' | 'Em atendimento' | 'Finalizado' | 'Cancelado' | 'Desistência';
}

interface Props {
  isAdmin?: boolean;
  isConfigured?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS DEMONSTRATIVOS
// ─────────────────────────────────────────────────────────────────────────────
function gerarSenhasDemostrativas(): SenhaRecord[] {
  const servicos = ['1º Registro', '2º Registro', 'Protesto', 'Títulos e Documentos', 'Pessoa Jurídica'];
  const filas = ['Atendimento Geral', 'Preferencial', 'Certidões', 'Retirada'];
  const guiches = ['Guichê 01', 'Guichê 02', 'Guichê 03', 'Guichê 04', 'Guichê 05'];
  const atendentes = ['Ana Paula', 'Carlos Silva', 'Fernanda Lima', 'Marcos Souza', 'Patrícia Costa', 'Ricardo Alves', 'Vanessa Martins'];
  const situacoes: SenhaRecord['situacao'][] = ['Finalizado', 'Finalizado', 'Finalizado', 'Em atendimento', 'Chamado', 'Cancelado', 'Desistência'];

  const now = new Date();
  const records: SenhaRecord[] = [];

  for (let i = 0; i < 120; i++) {
    const emissaoOffset = Math.floor(Math.random() * 480) + 1;
    const emissaoDate = new Date(now.getTime() - emissaoOffset * 60 * 1000);
    const tempoEspera = Math.floor(Math.random() * 35) + 1;
    const chamadaDate = new Date(emissaoDate.getTime() + tempoEspera * 60 * 1000);
    const seqNum = 1000 + i;
    const filaSel = filas[Math.floor(Math.random() * filas.length)];
    const prefixo = filaSel === 'Preferencial' ? 'P' : filaSel === 'Certidões' ? 'C' : filaSel === 'Retirada' ? 'R' : 'A';

    records.push({
      id: `s-${i}`,
      senha: `${prefixo}${seqNum}`,
      servico: servicos[Math.floor(Math.random() * servicos.length)],
      fila: filaSel,
      emissao: emissaoDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      chamada: chamadaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      tempoEsperaMin: tempoEspera,
      guiche: guiches[Math.floor(Math.random() * guiches.length)],
      atendente: atendentes[Math.floor(Math.random() * atendentes.length)],
      situacao: situacoes[Math.floor(Math.random() * situacoes.length)],
    });
  }

  return records;
}

const SLA_LIMIT_MIN = 15;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function GestaoEsperaClient({ isAdmin = false, isConfigured = true }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('hoje');
  const [activeAba, setActiveAba] = useState<Aba>('visao_geral');
  const [filtroServico, setFiltroServico] = useState('');
  const [filtroFila, setFiltroFila] = useState('');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allRecords = useMemo(() => gerarSenhasDemostrativas(), []);

  const dentroSla = useMemo(() => allRecords.filter((r) => r.tempoEsperaMin <= SLA_LIMIT_MIN), [allRecords]);
  const foraSla = useMemo(() => allRecords.filter((r) => r.tempoEsperaMin > SLA_LIMIT_MIN), [allRecords]);

  const tempoMedio = useMemo(() => {
    if (allRecords.length === 0) return 0;
    return Math.round(allRecords.reduce((acc, r) => acc + r.tempoEsperaMin, 0) / allRecords.length);
  }, [allRecords]);

  const percDentroSla = useMemo(() => {
    if (allRecords.length === 0) return 0;
    return Math.round((dentroSla.length / allRecords.length) * 1000) / 10;
  }, [allRecords, dentroSla]);

  // Filtro de tabela
  const filterRecords = (records: SenhaRecord[]) => {
    let filtered = records;
    if (filtroServico) filtered = filtered.filter((r) => r.servico === filtroServico);
    if (filtroFila) filtered = filtered.filter((r) => r.fila === filtroFila);
    if (filtroAtendente) filtered = filtered.filter((r) => r.atendente === filtroAtendente);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) => r.senha.toLowerCase().includes(q) || r.atendente.toLowerCase().includes(q) || r.servico.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const servicosUnicos = useMemo(() => [...new Set(allRecords.map((r) => r.servico))].sort(), [allRecords]);
  const filasUnicas = useMemo(() => [...new Set(allRecords.map((r) => r.fila))].sort(), [allRecords]);
  const atendentesUnicos = useMemo(() => [...new Set(allRecords.map((r) => r.atendente))].sort(), [allRecords]);

  const abas: { key: Aba; label: string }[] = [
    { key: 'visao_geral', label: 'Visão geral' },
    { key: 'dentro_sla', label: 'Senhas dentro do SLA' },
    { key: 'fora_sla', label: 'Senhas fora do SLA' },
    { key: 'atendimentos', label: 'Atendimentos' },
    { key: 'horarios_pico', label: 'Horários de pico' },
    { key: 'agendamentos', label: 'Agendamentos' },
    { key: 'qualidade', label: 'Qualidade e satisfação' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // ESTADO VAZIO: NextQS não configurado
  // ─────────────────────────────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
          {/* Header */}
          <div className="pb-4 border-b border-white/8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>GESTÃO DE PRAZOS · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Gestão de Espera
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Acompanhe o tempo de espera, o desempenho do atendimento e os indicadores da recepção.
            </p>
          </div>

          {/* Card de Estado Vazio */}
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-lg w-full rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-10 text-center space-y-6 shadow-2xl">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Layers className="w-8 h-8 text-indigo-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">
                  Integração NextQS não configurada
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Conecte o NextQS para visualizar os indicadores e relatórios de espera da sua organização.
                </p>
              </div>

              {isAdmin && (
                <a
                  href="/configuracoes/parametros?tab=integracoes"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configurar integração</span>
                </a>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  const renderSenhasTable = (records: SenhaRecord[], defaultSort: 'asc' | 'desc') => {
    const filtered = filterRecords(records);
    const sorted = [...filtered].sort((a, b) =>
      sortDir === 'desc' ? b.tempoEsperaMin - a.tempoEsperaMin : a.tempoEsperaMin - b.tempoEsperaMin
    );

    return (
      <div className="space-y-4">
        {/* Barra de Busca e Filtros da Tabela */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por senha, atendente ou serviço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortDir === 'desc' ? 'Maior espera primeiro' : 'Menor espera primeiro'}</span>
          </button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
              <tr>
                <th className="py-3 px-4">Senha</th>
                <th className="py-3 px-3">Serviço</th>
                <th className="py-3 px-3">Fila</th>
                <th className="py-3 px-3">Emissão</th>
                <th className="py-3 px-3">Chamada</th>
                <th className="py-3 px-3 text-right">Espera</th>
                <th className="py-3 px-3">Guichê</th>
                <th className="py-3 px-3">Atendente</th>
                <th className="py-3 px-4">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-300">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-bold text-white font-mono">{r.senha}</td>
                    <td className="py-3 px-3">{r.servico}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {r.fila}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">{r.emissao}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{r.chamada}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-bold font-mono ${
                          r.tempoEsperaMin <= SLA_LIMIT_MIN ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.tempoEsperaMin} min
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">{r.guiche}</td>
                    <td className="py-3 px-3 text-white">{r.atendente}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.situacao === 'Finalizado'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : r.situacao === 'Em atendimento'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : r.situacao === 'Chamado'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {r.situacao}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500 text-right">
          {sorted.length} de {records.length} registros
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* 1. Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>GESTÃO DE PRAZOS · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Gestão de Espera
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Acompanhe o tempo de espera, o desempenho do atendimento e os indicadores da recepção.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Período */}
            <div className="flex items-center p-0.5 bg-white/[0.03] border border-white/10 rounded-xl">
              {([
                { key: 'hoje', label: 'Hoje' },
                { key: '7d', label: '7 dias' },
                { key: 'mes', label: 'Mês' },
                { key: 'custom', label: 'Personalizado' },
              ] as { key: Periodo; label: string }[]).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodo === p.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Última sincronização */}
            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              Sinc. às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* 2. Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filtros:</span>
          </div>
          <select
            value={filtroServico}
            onChange={(e) => setFiltroServico(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="">Todos os Serviços</option>
            {servicosUnicos.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filtroFila}
            onChange={(e) => setFiltroFila(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="">Todas as Filas</option>
            {filasUnicas.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select
            value={filtroAtendente}
            onChange={(e) => setFiltroAtendente(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="">Todos os Atendentes</option>
            {atendentesUnicos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {(filtroServico || filtroFila || filtroAtendente) && (
            <button
              type="button"
              onClick={() => { setFiltroServico(''); setFiltroFila(''); setFiltroAtendente(''); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* 3. Cards KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Dentro do SLA */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Dentro do SLA (≤15 min)</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">{percDentroSla}%</span>
              <span className="text-xs text-slate-400 mb-1">{dentroSla.length} senhas</span>
            </div>
          </div>

          {/* Card 2: Tempo Médio */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tempo médio de espera</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Timer className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white font-mono">{tempoMedio}</span>
              <span className="text-xs text-slate-400 mb-1">minutos</span>
            </div>
          </div>

          {/* Card 3: Fora do SLA */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Senhas fora do SLA</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-rose-400 font-mono">{foraSla.length}</span>
              <span className="text-xs text-slate-400 mb-1">senhas &gt;15 min</span>
            </div>
          </div>

          {/* Card 4: Total de Atendimentos */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de atendimentos</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white font-mono">{allRecords.length}</span>
              <span className="text-xs text-slate-400 mb-1">senhas emitidas</span>
            </div>
          </div>
        </div>

        {/* 4. Abas */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 pb-2 overflow-x-auto">
          {abas.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setActiveAba(a.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeAba === a.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* 5. Conteúdo da Aba Selecionada */}
        <div className="animate-in fade-in duration-200">
          {activeAba === 'visao_geral' && (
            <div className="space-y-6">
              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Resumo de Atendimento em Tempo Real</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/8 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Em espera agora</span>
                    <p className="text-lg font-black text-amber-400 font-mono">3</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/8 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Em atendimento</span>
                    <p className="text-lg font-black text-blue-400 font-mono">{allRecords.filter(r => r.situacao === 'Em atendimento').length}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/8 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Finalizados hoje</span>
                    <p className="text-lg font-black text-emerald-400 font-mono">{allRecords.filter(r => r.situacao === 'Finalizado').length}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/8 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Desistências</span>
                    <p className="text-lg font-black text-rose-400 font-mono">{allRecords.filter(r => r.situacao === 'Desistência').length}</p>
                  </div>
                </div>
              </div>

              {/* Tabela geral resumida */}
              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white">Últimas Senhas Processadas</h3>
                {renderSenhasTable(allRecords.slice(0, 30), 'desc')}
              </div>
            </div>
          )}

          {activeAba === 'dentro_sla' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Senhas Dentro do SLA (≤ 15 min)</h3>
                <span className="text-xs text-emerald-400 font-mono font-bold">{dentroSla.length} registros</span>
              </div>
              {renderSenhasTable(dentroSla, 'asc')}
            </div>
          )}

          {activeAba === 'fora_sla' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Senhas Fora do SLA (&gt; 15 min)</h3>
                <span className="text-xs text-rose-400 font-mono font-bold">{foraSla.length} registros</span>
              </div>
              {renderSenhasTable(foraSla, 'desc')}
            </div>
          )}

          {activeAba === 'atendimentos' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Todos os Atendimentos</h3>
              </div>
              {renderSenhasTable(allRecords, 'desc')}
            </div>
          )}

          {activeAba === 'horarios_pico' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Horários de Pico</h3>
              </div>
              <p className="text-xs text-slate-400">Análise detalhada de distribuição horária disponível quando a integração NextQS estiver ativa com dados reais.</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h'].map((h, i) => {
                  const intensity = [30, 65, 90, 85, 40, 55, 80, 70, 50, 25][i] || 30;
                  return (
                    <div key={h} className="text-center space-y-1.5">
                      <div
                        className="mx-auto w-full rounded-xl border border-white/10"
                        style={{
                          height: `${Math.max(intensity * 0.8, 20)}px`,
                          background: `linear-gradient(to top, rgba(99,102,241,${intensity / 100 * 0.4}), rgba(99,102,241,${intensity / 100 * 0.1}))`,
                        }}
                      />
                      <span className="text-[10px] text-slate-400 font-mono">{h}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeAba === 'agendamentos' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white">Agendamentos</h3>
              </div>
              <div className="py-12 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
                Módulo de agendamentos disponível quando a integração NextQS estiver ativa.
              </div>
            </div>
          )}

          {activeAba === 'qualidade' && (
            <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Qualidade e Satisfação</h3>
              </div>
              <div className="py-12 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
                Indicadores de satisfação e qualidade do atendimento disponíveis com dados reais.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
