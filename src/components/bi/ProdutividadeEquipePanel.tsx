"use client";

import React, { useMemo, useState } from "react";
import { Award, CalendarDays, Clock, Trophy, Users, Target, X, ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ProdutividadeRegistro {
  nome: string;
  canal: "Digital ONR" | "Presencial";
  tipo: "TÍTULO" | "CERTIDÃO";
  /** Hora inteira (0–23) ou -1 quando não informada */
  hora: number;
  /** Chave curta do dia ("Seg", "Ter"...) ou null quando não informada */
  diaKey: string | null;
  /** Data ISO (yyyy-mm-dd) ou null quando não informada */
  data: string | null;
  quantidade: number;
}

interface Props {
  registros: ProdutividadeRegistro[];
  filtroCanal: "todos" | "digital" | "presencial";
  filtroHorario: { dia: string | null; hora: number } | null;
  filtroTipo: string;
  colaboradorSelecionado: string;
  onSelecionarColaborador: (nome: string) => void;
  /** Indica que os registros são ilustrativos (sem dados reais carregados) */
  isIlustrativo?: boolean;
}

interface ColaboradorResumo {
  nome: string;
  canal: "Digital ONR" | "Presencial";
  total: number;
  certidoes: number;
  titulos: number;
  porHora: Record<number, number>;
  diasAtivos: number;
  picoHora: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES E UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const LIMITE_RANKING = 10;

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
};

const ESTILO_POSICAO: Record<number, string> = {
  1: "bg-amber-400/20 border-amber-300/60 text-amber-300",
  2: "bg-slate-300/15 border-slate-300/50 text-slate-200",
  3: "bg-orange-500/15 border-orange-400/50 text-orange-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export function ProdutividadeEquipePanel({
  registros,
  filtroCanal,
  filtroHorario,
  filtroTipo,
  colaboradorSelecionado,
  onSelecionarColaborador,
  isIlustrativo = false,
}: Props) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Aplica os filtros globais da página (canal, horário e tipo)
  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroCanal === "digital" && r.canal !== "Digital ONR") return false;
      if (filtroCanal === "presencial" && r.canal !== "Presencial") return false;
      if (filtroTipo !== "TODOS" && r.tipo !== filtroTipo) return false;
      if (filtroHorario) {
        if (r.hora !== filtroHorario.hora) return false;
        if (filtroHorario.dia && r.diaKey !== filtroHorario.dia) return false;
      }
      return true;
    });
  }, [registros, filtroCanal, filtroTipo, filtroHorario]);

  // Agregação por colaborador
  const { ranking, totalGeral, diasEquipe } = useMemo(() => {
    const mapa = new Map<string, ColaboradorResumo & { dias: Set<string> }>();
    const diasGlobais = new Set<string>();

    registrosFiltrados.forEach((r) => {
      const q = Number.isFinite(r.quantidade) && r.quantidade > 0 ? r.quantidade : 1;
      let item = mapa.get(r.nome);
      if (!item) {
        item = {
          nome: r.nome,
          canal: r.canal,
          total: 0,
          certidoes: 0,
          titulos: 0,
          porHora: {},
          diasAtivos: 0,
          picoHora: null,
          dias: new Set<string>(),
        };
        mapa.set(r.nome, item);
      }
      item.total += q;
      if (r.tipo === "CERTIDÃO") item.certidoes += q;
      else item.titulos += q;
      if (r.hora >= 0) item.porHora[r.hora] = (item.porHora[r.hora] || 0) + q;
      if (r.data) {
        item.dias.add(r.data);
        diasGlobais.add(r.data);
      }
    });

    let total = 0;
    const lista: ColaboradorResumo[] = Array.from(mapa.values()).map(({ dias, ...resto }) => {
      total += resto.total;
      let pico: number | null = null;
      let picoValor = 0;
      Object.entries(resto.porHora).forEach(([h, v]) => {
        if (v > picoValor) {
          picoValor = v;
          pico = Number(h);
        }
      });
      return { ...resto, diasAtivos: dias.size, picoHora: pico };
    });

    lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
    return { ranking: lista, totalGeral: total, diasEquipe: diasGlobais.size };
  }, [registrosFiltrados]);

  const lider = ranking[0];
  const maxTotal = lider?.total || 1;
  const top3Total = ranking.slice(0, 3).reduce((acc, p) => acc + p.total, 0);

  const selecionado =
    colaboradorSelecionado !== "TODOS"
      ? ranking.find((p) => p.nome === colaboradorSelecionado) ?? null
      : null;
  const perfil = selecionado ?? lider ?? null;
  const posicaoPerfil = perfil ? ranking.findIndex((p) => p.nome === perfil.nome) + 1 : 0;

  const rankingVisivel = mostrarTodos ? ranking : ranking.slice(0, LIMITE_RANKING);

  const contextoFiltro = [
    filtroCanal === "todos" ? "Todos os canais" : filtroCanal === "digital" ? "Digital ONR" : "Presencial",
    filtroTipo !== "TODOS" ? (filtroTipo === "CERTIDÃO" ? "Certidões" : "Títulos") : null,
    filtroHorario ? `${filtroHorario.dia ? `${filtroHorario.dia} ` : ""}${filtroHorario.hora}h` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── Estado vazio ───────────────────────────────────────────────────────────
  if (ranking.length === 0) {
    return (
      <section
        aria-labelledby="produtividade-equipe-titulo"
        className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-8 shadow-xl text-center space-y-2 animate-in fade-in duration-300"
      >
        <Users className="w-8 h-8 text-slate-500 mx-auto" />
        <h2 id="produtividade-equipe-titulo" className="text-base font-bold text-white">
          Produtividade da equipe
        </h2>
        <p className="text-xs text-slate-400">
          Nenhum registro de produtividade para os filtros selecionados ({contextoFiltro}).
        </p>
      </section>
    );
  }

  const mediaPorColaborador = totalGeral / ranking.length;
  const mediaDiariaEquipe = diasEquipe > 0 ? totalGeral / diasEquipe : null;
  const concentracaoTop3 = totalGeral > 0 ? (top3Total / totalGeral) * 100 : 0;

  const kpis = [
    {
      id: "kpi-colaboradores",
      label: "Colaboradores ativos",
      valor: fmt(ranking.length),
      detalhe: `${fmt(ranking.filter((p) => p.canal === "Digital ONR").length)} digitais · ${fmt(
        ranking.filter((p) => p.canal === "Presencial").length
      )} balcão`,
      icon: Users,
      cor: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
    },
    {
      id: "kpi-media-colaborador",
      label: "Média por colaborador",
      valor: fmt(Math.round(mediaPorColaborador)),
      detalhe: `${fmt(totalGeral)} serviços no recorte`,
      icon: Target,
      cor: "text-indigo-300 bg-indigo-500/10 border-indigo-500/25",
    },
    {
      id: "kpi-media-diaria",
      label: "Média diária da equipe",
      valor: mediaDiariaEquipe !== null ? fmt(Math.round(mediaDiariaEquipe)) : "Sem dados",
      detalhe:
        mediaDiariaEquipe !== null
          ? `${fmt(diasEquipe)} dia${diasEquipe > 1 ? "s" : ""} com registros`
          : "Datas não informadas nos registros",
      icon: CalendarDays,
      cor: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    },
    {
      id: "kpi-concentracao",
      label: "Concentração no top 3",
      valor: fmtPct(concentracaoTop3),
      detalhe: "Parcela do volume feita pelos 3 primeiros",
      icon: Trophy,
      cor: "text-amber-300 bg-amber-500/10 border-amber-500/25",
    },
  ];

  const maxHoraPerfil = perfil ? Math.max(1, ...HORAS.map((h) => perfil.porHora[h] || 0)) : 1;
  const pctCertPerfil = perfil && perfil.total > 0 ? (perfil.certidoes / perfil.total) * 100 : 0;

  return (
    <section aria-labelledby="produtividade-equipe-titulo" className="space-y-5 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
        <div>
          <h2 id="produtividade-equipe-titulo" className="text-lg font-bold text-white tracking-tight">
            Produtividade da equipe
          </h2>
          <p className="text-xs text-slate-300">
            Desempenho individual no recorte <strong className="text-cyan-300">{contextoFiltro}</strong> · clique em
            um colaborador para ver o perfil e filtrar a tabela de serviços
          </p>
        </div>
        {isIlustrativo && (
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Dados ilustrativos · sem registros reais carregados
          </span>
        )}
      </div>

      {/* Faixa de indicadores da equipe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.id}
              id={k.id}
              className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-4 shadow-lg flex items-start gap-3"
            >
              <div className={`p-2 rounded-xl border shrink-0 ${k.cor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k.label}</div>
                <div className="text-2xl font-black font-mono text-white tracking-tight leading-tight">{k.valor}</div>
                <div className="text-[11px] text-slate-400 truncate" title={k.detalhe}>
                  {k.detalhe}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Ranking */}
        <div className="lg:col-span-2 rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Ranking de produtividade</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-400" /> Certidões
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-400" /> Títulos
              </span>
            </div>
          </div>

          <ol className="space-y-1.5">
            {rankingVisivel.map((p, idx) => {
              const posicao = idx + 1;
              const isSel = colaboradorSelecionado === p.nome;
              const larguraTotal = (p.total / maxTotal) * 100;
              const pctCert = p.total > 0 ? (p.certidoes / p.total) * 100 : 0;
              const share = totalGeral > 0 ? (p.total / totalGeral) * 100 : 0;
              return (
                <li key={p.nome}>
                  <button
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => onSelecionarColaborador(p.nome)}
                    title={`${p.nome}: ${fmt(p.total)} serviços (${fmtPct(share)}). Clique para ver o perfil.`}
                    className={`w-full grid grid-cols-[28px_32px_1fr_auto] items-center gap-3 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isSel
                        ? "bg-cyan-500/10 border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.25)]"
                        : "bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10"
                    }`}
                  >
                    <span
                      className={`h-7 w-7 rounded-lg border flex items-center justify-center text-[11px] font-black font-mono ${
                        ESTILO_POSICAO[posicao] ?? "bg-white/[0.03] border-white/10 text-slate-400"
                      }`}
                    >
                      {posicao}
                    </span>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-br ${
                        p.canal === "Digital ONR" ? "from-emerald-500/70 to-teal-700/70" : "from-sky-500/70 to-indigo-700/70"
                      }`}
                      aria-hidden="true"
                    >
                      {iniciais(p.nome)}
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{p.nome}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                            p.canal === "Digital ONR"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-sky-500/10 border-sky-500/30 text-sky-300"
                          }`}
                        >
                          {p.canal === "Digital ONR" ? "Digital" : "Balcão"}
                        </span>
                      </span>
                      <span className="block w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <span
                          className="flex h-full transition-all duration-500"
                          style={{ width: `${Math.max(2, larguraTotal)}%` }}
                        >
                          <span className="h-full bg-cyan-400" style={{ width: `${pctCert}%` }} />
                          <span className="h-full bg-emerald-400" style={{ width: `${100 - pctCert}%` }} />
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xs font-mono font-bold text-white">{fmt(p.total)}</span>
                      <span className="block text-[10px] font-mono text-slate-400">{fmtPct(share)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {ranking.length > LIMITE_RANKING && (
            <button
              type="button"
              onClick={() => setMostrarTodos((v) => !v)}
              aria-expanded={mostrarTodos}
              className="w-full inline-flex items-center justify-center gap-1.5 pt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>{mostrarTodos ? "Mostrar apenas o top 10" : `Ver todos os ${ranking.length} colaboradores`}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mostrarTodos ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Perfil individual */}
        {perfil && (
          <aside
            aria-label={`Perfil de ${perfil.nome}`}
            className="rounded-[24px] border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 to-[#0B1020]/95 backdrop-blur-xl p-5 shadow-xl space-y-4 lg:sticky lg:top-6"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
                {selecionado ? "Colaborador selecionado" : "Líder do recorte"}
              </span>
              {selecionado && (
                <button
                  type="button"
                  onClick={() => onSelecionarColaborador(selecionado.nome)}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  title="Limpar seleção de colaborador"
                >
                  <X className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br ${
                  perfil.canal === "Digital ONR" ? "from-emerald-500 to-teal-700" : "from-sky-500 to-indigo-700"
                }`}
                aria-hidden="true"
              >
                {iniciais(perfil.nome)}
              </span>
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">{perfil.nome}</div>
                <div className="text-xs text-slate-400">
                  {posicaoPerfil}º de {ranking.length} · {perfil.canal === "Digital ONR" ? "Digital ONR" : "Balcão presencial"}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Serviços</dt>
                <dd className="text-lg font-black font-mono text-white">{fmt(perfil.total)}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Participação</dt>
                <dd className="text-lg font-black font-mono text-white">
                  {fmtPct(totalGeral > 0 ? (perfil.total / totalGeral) * 100 : 0)}
                </dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Média por dia</dt>
                <dd className="text-lg font-black font-mono text-white">
                  {perfil.diasAtivos > 0 ? fmt(Math.round(perfil.total / perfil.diasAtivos)) : "—"}
                </dd>
                <dd className="text-[10px] text-slate-500">
                  {perfil.diasAtivos > 0 ? `${perfil.diasAtivos} dia${perfil.diasAtivos > 1 ? "s" : ""} ativo${perfil.diasAtivos > 1 ? "s" : ""}` : "Sem datas"}
                </dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Horário de pico</dt>
                <dd className="text-lg font-black font-mono text-amber-300">
                  {perfil.picoHora !== null ? `${perfil.picoHora}h` : "—"}
                </dd>
                <dd className="text-[10px] text-slate-500">
                  {perfil.picoHora !== null ? `${fmt(perfil.porHora[perfil.picoHora] || 0)} serviços` : "Hora não informada"}
                </dd>
              </div>
            </dl>

            {/* Mix certidões x títulos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-300 font-semibold">Certidões {fmt(perfil.certidoes)}</span>
                <span className="text-emerald-300 font-semibold">Títulos {fmt(perfil.titulos)}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                <div className="bg-cyan-400 transition-all duration-500" style={{ width: `${pctCertPerfil}%` }} />
                <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${100 - pctCertPerfil}%` }} />
              </div>
            </div>

            {/* Ritmo por hora */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Ritmo ao longo do dia</span>
              </div>
              <div className="flex items-end gap-1 h-20" role="img" aria-label={`Distribuição por hora de ${perfil.nome}`}>
                {HORAS.map((h) => {
                  const v = perfil.porHora[h] || 0;
                  const altura = v > 0 ? Math.max(6, (v / maxHoraPerfil) * 100) : 3;
                  const isPico = perfil.picoHora === h && v > 0;
                  const isFiltro = filtroHorario?.hora === h;
                  return (
                    <div key={h} className="flex-1 h-full flex items-end" title={`${h}h: ${fmt(v)} serviços`}>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isFiltro
                            ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.7)]"
                            : isPico
                            ? "bg-amber-400"
                            : v > 0
                            ? "bg-indigo-400/70"
                            : "bg-white/5"
                        }`}
                        style={{ height: `${altura}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 text-[9px] font-mono text-slate-500">
                {HORAS.map((h) => (
                  <span key={h} className="flex-1 text-center">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
