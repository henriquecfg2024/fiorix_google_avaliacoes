"use client";

import { useMemo } from "react";
import { Award, Zap, Users, ShieldAlert, Laptop, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const CAIXAS_DIGITAIS = ["eProtocolo", "GuilhermeM", "Rafael", "Intimação", "Intimacao"];

const normalizeNome = (valor: string) =>
  (valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isDigital = (nome: string) =>
  CAIXAS_DIGITAIS.some((item) => normalizeNome(nome).includes(normalizeNome(item)));

interface KpiCardsProps {
  data: Array<{
    QUANTIDADE?: number;
    DIA_SEMANA?: string;
    HORA?: string;
    NOME?: string;
    TIPO_PEDIDO?: string;
  }>;
  totalCaixas?: number;
  digitalCount?: number;
  presencialCount?: number;
}

export function KpiCards({
  data,
  totalCaixas: propTotalCaixas,
  digitalCount: propDigitalCount,
  presencialCount: propPresencialCount,
}: KpiCardsProps) {
  const kpis = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalAutenticacoes: 0,
        digitalCount: 0,
        presencialCount: 0,
        digitalPct: "0.0",
        presencialPct: "0.0",
        picoFila: { dayTime: "Sem dados", countText: "", isCritico: false },
        usuarioTop: { name: "Sem dados", detail: "" },
        tipoDominante: { name: "Sem dados", detail: "" },
      };
    }

    const totalAutenticacoes =
      propTotalCaixas !== undefined
        ? propTotalCaixas
        : data.reduce((acc, row) => acc + (row.QUANTIDADE || 0), 0);

    const digitalCount =
      propDigitalCount !== undefined
        ? propDigitalCount
        : data.reduce((acc, row) => {
            if (!isDigital(String(row.NOME || ""))) return acc;
            return acc + Number(row.QUANTIDADE || 0);
          }, 0);

    const presencialCount =
      propPresencialCount !== undefined
        ? propPresencialCount
        : data.reduce((acc, row) => {
            if (isDigital(String(row.NOME || ""))) return acc;
            return acc + Number(row.QUANTIDADE || 0);
          }, 0);

    const totalCalculado = digitalCount + presencialCount || totalAutenticacoes || 1;
    const digitalPct = ((digitalCount / totalCalculado) * 100).toFixed(1);
    const presencialPct = ((presencialCount / totalCalculado) * 100).toFixed(1);

    // Pico de Fila
    const filaGroups: { [key: string]: { count: number; day: string; time: string } } = {};
    data.forEach((row) => {
      const key = `${row.DIA_SEMANA || ""} ${row.HORA || ""}`;
      if (!filaGroups[key]) {
        filaGroups[key] = { count: 0, day: row.DIA_SEMANA || "", time: row.HORA || "" };
      }
      filaGroups[key].count += row.QUANTIDADE || 0;
    });

    let maxFilaCount = 0;
    let maxFilaKey = "";
    Object.keys(filaGroups).forEach((key) => {
      if (filaGroups[key].count > maxFilaCount) {
        maxFilaCount = filaGroups[key].count;
        maxFilaKey = key;
      }
    });

    let picoFilaDayTime = "Sem dados";
    let picoFilaCountText = "";
    let isCritico = false;
    if (maxFilaKey) {
      const g = filaGroups[maxFilaKey];
      const daysPt: { [key: string]: string } = {
        Monday: "Segunda",
        Tuesday: "Terça",
        Wednesday: "Quarta",
        Thursday: "Quinta",
        Friday: "Sexta",
        Saturday: "Sábado",
        Sunday: "Domingo",
      };
      const dayPt = daysPt[g.day] || g.day;
      picoFilaDayTime = `${dayPt} às ${g.time}`;
      picoFilaCountText = `${g.count.toLocaleString("pt-BR")} autenticações`;
      isCritico = g.count > 20;
    }

    // Usuário Top
    const userCounts: { [key: string]: number } = {};
    data.forEach((row) => {
      const nomeLimpo = (row.NOME ? String(row.NOME).trim() : "") || "Não identificado";
      userCounts[nomeLimpo] = (userCounts[nomeLimpo] || 0) + (row.QUANTIDADE || 0);
    });

    let topUser = "";
    let topUserCount = 0;
    Object.keys(userCounts).forEach((nome) => {
      if (userCounts[nome] > topUserCount) {
        topUserCount = userCounts[nome];
        topUser = nome;
      }
    });

    const topUserPercent =
      totalAutenticacoes > 0 ? Math.round((topUserCount / totalAutenticacoes) * 100) : 0;
    const usuarioTopName = topUser || "Sem dados";
    const usuarioTopDetail = topUser
      ? `${topUserCount.toLocaleString("pt-BR")} aut. (${topUserPercent}%)`
      : "";

    // Tipo Dominante
    const tipoCounts: { [key: string]: number } = {};
    data.forEach((row) => {
      const tipoLimpo = (row.TIPO_PEDIDO ? String(row.TIPO_PEDIDO).trim() : "") || "Não classificado";
      tipoCounts[tipoLimpo] = (tipoCounts[tipoLimpo] || 0) + (row.QUANTIDADE || 0);
    });

    let topTipo = "";
    let topTipoCount = 0;
    Object.keys(tipoCounts).forEach((tipo) => {
      if (tipoCounts[tipo] > topTipoCount) {
        topTipoCount = tipoCounts[tipo];
        topTipo = tipo;
      }
    });

    const topTipoPercent =
      totalAutenticacoes > 0 ? Math.round((topTipoCount / totalAutenticacoes) * 100) : 0;
    const tipoDominanteName = topTipo || "Sem dados";
    const tipoDominanteDetail = topTipo
      ? `${topTipoCount.toLocaleString("pt-BR")} aut. (${topTipoPercent}%)`
      : "";

    return {
      totalAutenticacoes,
      digitalCount,
      presencialCount,
      digitalPct,
      presencialPct,
      picoFila: { dayTime: picoFilaDayTime, countText: picoFilaCountText, isCritico },
      usuarioTop: { name: usuarioTopName, detail: usuarioTopDetail },
      tipoDominante: { name: tipoDominanteName, detail: tipoDominanteDetail },
    };
  }, [data, propTotalCaixas, propDigitalCount, propPresencialCount]);

  const cardsData = [
    {
      title: "Total Autenticações",
      primaryValue: kpis.totalAutenticacoes.toLocaleString("pt-BR"),
      secondaryValue: null,
      subText: "Volume total processado no período",
      icon: Award,
      iconBox: "border-white/20 bg-cyan-500/10",
      iconColor: "text-cyan-300",
      valueColor: "text-white",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
    {
      title: "Digital ONR",
      primaryValue: kpis.digitalCount.toLocaleString("pt-BR"),
      secondaryValue: `(${kpis.digitalPct}%)`,
      subText: "RIDigital / Gestão de escala do ONR",
      icon: Laptop,
      iconBox: "border-white/20 bg-emerald-500/10",
      iconColor: "text-emerald-300",
      valueColor: "text-emerald-300",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
    {
      title: "Presencial",
      primaryValue: kpis.presencialCount.toLocaleString("pt-BR"),
      secondaryValue: `(${kpis.presencialPct}%)`,
      subText: "Recepção / Balanço operacional presencial",
      icon: Users,
      iconBox: "border-white/20 bg-sky-500/10",
      iconColor: "text-sky-300",
      valueColor: "text-sky-300",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
    {
      title: "Pico de Fila",
      primaryValue: kpis.picoFila.dayTime,
      secondaryValue: kpis.picoFila.countText ? `• ${kpis.picoFila.countText}` : null,
      subText: "Momento com maior acúmulo de requisições",
      icon: ShieldAlert,
      badge: kpis.picoFila.isCritico ? "CRÍTICO" : null,
      iconBox: "border-white/20 bg-rose-500/10",
      iconColor: "text-rose-300",
      valueColor: "text-white",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
    {
      title: "Usuário Top",
      primaryValue: kpis.usuarioTop.name,
      secondaryValue: kpis.usuarioTop.detail ? `• ${kpis.usuarioTop.detail}` : null,
      subText: "Colaborador com maior produtividade",
      icon: UserCheck,
      iconBox: "border-white/20 bg-purple-500/10",
      iconColor: "text-purple-300",
      valueColor: "text-purple-300",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
    {
      title: "Tipo Dominante",
      primaryValue: kpis.tipoDominante.name,
      secondaryValue: kpis.tipoDominante.detail ? `• ${kpis.tipoDominante.detail}` : null,
      subText: "Serviço mais demandado na operação",
      icon: Zap,
      iconBox: "border-white/20 bg-amber-500/10",
      iconColor: "text-amber-300",
      valueColor: "text-amber-300",
      border: "border-white/20",
      hoverBorder: "hover:border-white/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cardsData.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={cn(
              "group relative flex min-h-[135px] flex-col justify-between overflow-hidden rounded-[20px] border bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all",
              card.border,
              card.hoverBorder
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-white/80">
                  {card.title}
                </span>
                {card.badge && (
                  <span className="rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-300">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className={cn("rounded-xl border p-2 transition-all group-hover:brightness-110", card.iconBox)}>
                <Icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </div>

            <div className="mt-auto space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={cn("text-3xl sm:text-4xl font-extrabold tracking-tight", card.valueColor)}>
                  {card.primaryValue}
                </span>
                {card.secondaryValue && (
                  <span className="text-sm sm:text-base font-bold text-white/75">
                    {card.secondaryValue}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-[13px] font-medium text-white/70">{card.subText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
