"use client";

import { useMemo } from "react";
import { Award, Zap, Users, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KpiCardsProps {
  data: any[];
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

    // 1. Total Autenticações
    const totalAutenticacoes = data.reduce((acc, row) => acc + (row.QUANTIDADE || 0), 0);

    // 2. Pico de Fila: Group by HORA + DIA_SEMANA
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
      // Translate Day to Portuguese
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
      isCritico = g.count > 20; // Critical if > 20 in that minutes/hour block
    }

    // 3. Usuário Top
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

    // 4. Tipo Dominante
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
      color: "from-[#00C950] to-[#2B7FFF]",
    },
    {
      title: "Pico de Fila",
      value: kpis.picoFila.text,
      subText: "Momento com maior acúmulo de requisições",
      icon: ShieldAlert,
      badge: kpis.picoFila.isCritico ? "CRÍTICO" : null,
      color: "from-red-500 to-amber-500",
    },
    {
      title: "Usuário Top",
      value: kpis.usuarioTop,
      subText: "Colaborador com maior produtividade",
      icon: Users,
      color: "from-[#2B7FFF] to-purple-600",
    },
    {
      title: "Tipo Dominante",
      value: kpis.tipoDominante,
      subText: "Serviço mais demandado",
      icon: Zap,
      color: "from-amber-400 to-[#00C950]",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cardsData.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl hover:border-white/20 transition-all group"
          >
            {/* Top Row */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-white/60">{card.title}</span>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
                <Icon className="h-4 w-4 text-white/80" />
              </div>
            </div>

            {/* Value (with gradient text) */}
            <div className="space-y-1.5">
              <h3 className={`text-2xl font-bold tracking-tight text-white`}>
                {card.title === "Total Autenticações" ? (
                  <span className="bg-gradient-to-r from-[#00C950] to-[#2B7FFF] bg-clip-text text-transparent">
                    {card.value}
                  </span>
                ) : (
                  card.value
                )}
              </h3>
              <p className="text-xs text-white/40">{card.subText}</p>
            </div>

            {/* Critical Badge */}
            {card.badge && (
              <div className="absolute top-6 right-16">
                <Badge variant="destructive" className="bg-red-600/90 text-white font-bold text-[10px] animate-pulse">
                  {card.badge}
                </Badge>
              </div>
            )}

            {/* Glowing Accent Bottom Border */}
            <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${card.color} opacity-70`} />
          </div>
        );
      })}
    </div>
  );
}

