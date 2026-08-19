"use client";

import { useMemo } from "react";
import { Award, Zap, Users, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KpiCardsProps {
  data: Array<{
    QUANTIDADE?: number;
    DIA_SEMANA?: string;
    HORA?: string;
    NOME?: string;
    TIPO_PEDIDO?: string;
  }>;
}

export function KpiCards({ data }: KpiCardsProps) {
  const kpis = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalAutenticacoes: 0,
        picoFila: { text: "Sem dados", isCritico: false },
        usuarioTop: "Sem dados",
        tipoDominante: "Sem dados",
      };
    }

    const totalAutenticacoes = data.reduce((acc, row) => acc + (row.QUANTIDADE || 0), 0);

    const filaGroups: { [key: string]: { count: number; day: string; time: string } } = {};
    data.forEach((row) => {
      const key = `${row.DIA_SEMANA} ${row.HORA}`;
      if (!filaGroups[key]) {
        filaGroups[key] = { count: 0, day: row.DIA_SEMANA, time: row.HORA };
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

    let picoFilaText = "Sem dados";
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
      picoFilaText = `${dayPt} às ${g.time} - ${g.count} autenticações`;
      isCritico = g.count > 20;
    }

    const userCounts: { [key: string]: number } = {};
    data.forEach((row) => {
      userCounts[row.NOME] = (userCounts[row.NOME] || 0) + (row.QUANTIDADE || 0);
    });

    let topUser = "";
    let topUserCount = 0;
    Object.keys(userCounts).forEach((nome) => {
      if (userCounts[nome] > topUserCount) {
        topUserCount = userCounts[nome];
        topUser = nome;
      }
    });

    const topUserPercent = totalAutenticacoes > 0 ? Math.round((topUserCount / totalAutenticacoes) * 100) : 0;
    const usuarioTopText = topUser ? `${topUser} - ${topUserPercent}%` : "Sem dados";

    const tipoCounts: { [key: string]: number } = {};
    data.forEach((row) => {
      tipoCounts[row.TIPO_PEDIDO] = (tipoCounts[row.TIPO_PEDIDO] || 0) + (row.QUANTIDADE || 0);
    });

    let topTipo = "";
    let topTipoCount = 0;
    Object.keys(tipoCounts).forEach((tipo) => {
      if (tipoCounts[tipo] > topTipoCount) {
        topTipoCount = tipoCounts[tipo];
        topTipo = tipo;
      }
    });

    const topTipoPercent = totalAutenticacoes > 0 ? Math.round((topTipoCount / totalAutenticacoes) * 100) : 0;
    const tipoDominanteText = topTipo ? `${topTipo} - ${topTipoPercent}%` : "Sem dados";

    return {
      totalAutenticacoes,
      picoFila: { text: picoFilaText, isCritico },
      usuarioTop: usuarioTopText,
      tipoDominante: tipoDominanteText,
    };
  }, [data]);

  const cardsData = [
    {
      title: "Total Autenticações",
      value: kpis.totalAutenticacoes.toLocaleString("pt-BR"),
      subText: "Volume total processado no período",
      icon: Award,
      color: "from-cyan-400 to-emerald-400",
    },
    {
      title: "Pico de Fila",
      value: kpis.picoFila.text,
      subText: "Momento com maior acúmulo de requisições",
      icon: ShieldAlert,
      badge: kpis.picoFila.isCritico ? "CRÍTICO" : null,
      color: "from-rose-500 to-amber-500",
    },
    {
      title: "Usuário Top",
      value: kpis.usuarioTop,
      subText: "Colaborador com maior produtividade",
      icon: Users,
      color: "from-sky-400 to-violet-500",
    },
    {
      title: "Tipo Dominante",
      value: kpis.tipoDominante,
      subText: "Serviço mais demandado",
      icon: Zap,
      color: "from-amber-400 to-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cardsData.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-[24px] border border-white/8 bg-[#0B1020]/78 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:border-white/15"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                {card.title}
              </span>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition-all group-hover:bg-white/[0.08]">
                <Icon className="h-4 w-4 text-white/80" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold tracking-tight text-white">
                {card.title === "Total Autenticações" ? (
                  <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                    {card.value}
                  </span>
                ) : (
                  card.value
                )}
              </h3>
              <p className="text-xs text-white/42">{card.subText}</p>
            </div>

            {card.badge && (
              <div className="absolute right-6 top-6">
                <Badge
                  variant="destructive"
                  className="border border-white/10 bg-rose-500/90 text-[10px] font-bold text-white shadow-lg shadow-rose-500/20"
                >
                  {card.badge}
                </Badge>
              </div>
            )}

            <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${card.color} opacity-80`} />
          </div>
        );
      })}
    </div>
  );
}
