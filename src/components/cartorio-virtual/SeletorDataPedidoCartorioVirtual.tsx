"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Check, X } from "lucide-react";
import type { PedidoCertidaoDetalheDTO } from "@/lib/cartorio-virtual/types";

const NOMES_MESES: Record<string, string> = {
  "01": "Janeiro",
  "02": "Fevereiro",
  "03": "Março",
  "04": "Abril",
  "05": "Maio",
  "06": "Junho",
  "07": "Julho",
  "08": "Agosto",
  "09": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro",
};

export function extrairIsoDataBr(dataBr: string | null | undefined): string {
  if (!dataBr) return "";
  const partes = dataBr.trim().split("/");
  if (partes.length !== 3) return "";
  const [dd, mm, yyyy] = partes;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function converterIsoParaBr(isoDate: string): string {
  if (!isoDate) return "";
  const partes = isoDate.trim().split("-");
  if (partes.length !== 3) return "";
  const [yyyy, mm, dd] = partes;
  return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
}

/**
 * Avalia se um pedido corresponde ao filtro de data selecionado:
 * - "TODAS": todos os pedidos
 * - "DD/MM/YYYY": data exata
 * - "MES:MM/YYYY": todos os pedidos daquele mês e ano
 * - "ANO:YYYY": todos os pedidos daquele ano
 * - "PERIODO:YYYY-MM-DD..YYYY-MM-DD": intervalo de datas (inclusive)
 */
export function correspondeFiltroDataPedido(
  pedido: Pick<PedidoCertidaoDetalheDTO, "dataPedidoBr" | "dataPedidoIso">,
  filtroData: string
): boolean {
  if (!filtroData || filtroData === "TODAS") return true;
  const dataBr = (pedido.dataPedidoBr || "").trim();
  if (!dataBr) return false;

  if (filtroData.startsWith("MES:")) {
    const mesAno = filtroData.slice(4); // MM/YYYY
    return dataBr.endsWith(`/${mesAno}`);
  }

  if (filtroData.startsWith("ANO:")) {
    const ano = filtroData.slice(4); // YYYY
    return dataBr.endsWith(`/${ano}`);
  }

  if (filtroData.startsWith("PERIODO:")) {
    const [iniIso, fimIso] = filtroData.slice(8).split("..");
    const isoPedido = extrairIsoDataBr(dataBr) || (pedido.dataPedidoIso || "").slice(0, 10);
    if (!isoPedido) return false;
    if (iniIso && isoPedido < iniIso) return false;
    if (fimIso && isoPedido > fimIso) return false;
    return true;
  }

  return dataBr === filtroData;
}

export function SeletorDataPedidoCartorioVirtual({
  valor,
  onChange,
  pedidosBaseParaContagem,
  alturaClasse = "h-9",
}: {
  valor: string;
  onChange: (novoValor: string) => void;
  pedidosBaseParaContagem: PedidoCertidaoDetalheDTO[];
  alturaClasse?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Agrupa datas disponíveis por dia (DD/MM/YYYY), mês/ano (MM/YYYY) e ano (YYYY)
  const agrupamento = useMemo(() => {
    const porDia = new Map<string, number>();
    const porMesAno = new Map<string, number>();
    const porAno = new Map<string, number>();

    for (const p of pedidosBaseParaContagem) {
      const dBr = (p.dataPedidoBr || "").trim();
      if (!dBr) continue;
      porDia.set(dBr, (porDia.get(dBr) || 0) + 1);
      const partes = dBr.split("/");
      if (partes.length === 3) {
        const [, mm, yyyy] = partes;
        const mesAno = `${mm}/${yyyy}`;
        porMesAno.set(mesAno, (porMesAno.get(mesAno) || 0) + 1);
        porAno.set(yyyy, (porAno.get(yyyy) || 0) + 1);
      }
    }

    const diasOrdenados = Array.from(porDia.entries())
      .map(([dataBr, qtd]) => ({
        dataBr,
        iso: extrairIsoDataBr(dataBr),
        qtd,
      }))
      .sort((a, b) => b.iso.localeCompare(a.iso));

    const mesesAnoOrdenados = Array.from(porMesAno.entries())
      .map(([mesAno, qtd]) => {
        const [mm, yyyy] = mesAno.split("/");
        return {
          mesAno,
          mm,
          yyyy,
          chaveOrd: `${yyyy}-${mm}`,
          rotulo: `${NOMES_MESES[mm] || mm}/${yyyy}`,
          qtd,
        };
      })
      .sort((a, b) => b.chaveOrd.localeCompare(a.chaveOrd));

    const anosOrdenados = Array.from(porAno.entries())
      .map(([ano, qtd]) => ({ ano, qtd }))
      .sort((a, b) => b.ano.localeCompare(a.ano));

    return {
      total: pedidosBaseParaContagem.length,
      porDia,
      porMesAno,
      porAno,
      diasOrdenados,
      mesesAnoOrdenados,
      anosOrdenados,
    };
  }, [pedidosBaseParaContagem]);

  const mesAnoPadrao =
    agrupamento.mesesAnoOrdenados[0]?.mesAno ||
    (() => {
      const hj = new Date();
      return `${String(hj.getMonth() + 1).padStart(2, "0")}/${hj.getFullYear()}`;
    })();

  const [mesAnoFoco, setMesAnoFoco] = useState<string>(mesAnoPadrao);
  const [dataCalendarioIso, setDataCalendarioIso] = useState<string>("");

  useEffect(() => {
    if (
      mesAnoFoco !== "TODOS" &&
      agrupamento.mesesAnoOrdenados.length > 0 &&
      !agrupamento.mesesAnoOrdenados.some((m) => m.mesAno === mesAnoFoco)
    ) {
      setMesAnoFoco(agrupamento.mesesAnoOrdenados[0].mesAno);
    }
  }, [agrupamento.mesesAnoOrdenados, mesAnoFoco]);

  useEffect(() => {
    if (!aberto) return;
    const onMouseDown = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setAberto(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  const rotuloAtivo = useMemo(() => {
    if (!valor || valor === "TODAS") {
      return `Todas (${agrupamento.total})`;
    }
    if (valor.startsWith("MES:")) {
      const mesAno = valor.slice(4);
      const [mm, yyyy] = mesAno.split("/");
      const qtd = agrupamento.porMesAno.get(mesAno) || 0;
      return `${NOMES_MESES[mm] || mm}/${yyyy} (${qtd})`;
    }
    if (valor.startsWith("ANO:")) {
      const ano = valor.slice(4);
      const qtd = agrupamento.porAno.get(ano) || 0;
      return `Ano ${ano} (${qtd})`;
    }
    if (valor.startsWith("PERIODO:")) {
      const [iniIso, fimIso] = valor.slice(8).split("..");
      const qtd = pedidosBaseParaContagem.filter((p) =>
        correspondeFiltroDataPedido(p, valor)
      ).length;
      const iniBr = converterIsoParaBr(iniIso);
      const fimBr = converterIsoParaBr(fimIso);
      return `${iniBr || "..."} a ${fimBr || "..."} (${qtd})`;
    }
    const qtdDia = agrupamento.porDia.get(valor) || 0;
    return `${valor} (${qtdDia})`;
  }, [valor, agrupamento, pedidosBaseParaContagem]);

  const diasDoMesEmFoco = useMemo(() => {
    if (mesAnoFoco === "TODOS") return agrupamento.diasOrdenados;
    return agrupamento.diasOrdenados.filter((d) => d.dataBr.endsWith(`/${mesAnoFoco}`));
  }, [agrupamento.diasOrdenados, mesAnoFoco]);

  const selecionar = (novoValor: string) => {
    onChange(novoValor);
    setAberto(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`${alturaClasse} px-3 rounded-xl border border-cyan-400/55 bg-[#080D1A] hover:bg-[#0D162B] inline-flex items-center gap-1.5 cursor-pointer transition`}
        title="Filtrar pedidos por Dia, Mês/Ano ou Calendário"
      >
        <Calendar className="w-4 h-4 text-cyan-300 shrink-0" />
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-cyan-200 whitespace-nowrap">
          DATA DO PEDIDO:
        </span>
        <span className="text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
          {rotuloAtivo}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-cyan-300 transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-1.5 w-[350px] sm:w-[390px] rounded-2xl border border-cyan-400/50 bg-[#080D1A]/98 backdrop-blur-xl shadow-2xl shadow-black/80 p-3.5 z-50 space-y-3 text-left">
          {/* Topo: Todas as Datas + Botão Fechar */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => selecionar("TODAS")}
              className={`flex-1 h-8 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-between transition cursor-pointer ${
                valor === "TODAS"
                  ? "bg-cyan-600 text-white border border-cyan-400"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10"
              }`}
            >
              <span>Todas as Datas</span>
              <span className="font-mono">{agrupamento.total}</span>
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 inline-flex items-center justify-center cursor-pointer"
              title="Fechar seletor de data"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Busca direta por qualquer Dia/Mês/Ano no Calendário */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
              Escolher Dia no Calendário (Qualquer Mês/Ano)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dataCalendarioIso}
                onChange={(e) => {
                  const iso = e.target.value;
                  setDataCalendarioIso(iso);
                  if (iso) {
                    selecionar(converterIsoParaBr(iso));
                  }
                }}
                className="flex-1 h-8 px-2.5 rounded-xl bg-[#0D162B] border border-cyan-400/45 text-xs font-extrabold text-white focus:outline-none focus:border-cyan-300 cursor-pointer"
              />
              {valor !== "TODAS" && (
                <button
                  type="button"
                  onClick={() => {
                    setDataCalendarioIso("");
                    selecionar("TODAS");
                  }}
                  className="h-8 px-2.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] text-[11px] font-bold text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Filtro por Mês / Ano */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                Mês / Ano
              </label>
              {mesAnoFoco !== "TODOS" && (
                <button
                  type="button"
                  onClick={() => selecionar(`MES:${mesAnoFoco}`)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                    valor === `MES:${mesAnoFoco}`
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-400/35"
                  }`}
                >
                  Ver todo o mês ({agrupamento.porMesAno.get(mesAnoFoco) || 0})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {agrupamento.mesesAnoOrdenados.map((m) => {
                const selecionadoMesInteiro = valor === `MES:${m.mesAno}`;
                const emFoco = mesAnoFoco === m.mesAno;
                return (
                  <button
                    key={m.mesAno}
                    type="button"
                    onClick={() => setMesAnoFoco(m.mesAno)}
                    onDoubleClick={() => selecionar(`MES:${m.mesAno}`)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                      selecionadoMesInteiro
                        ? "bg-cyan-600 text-white border-cyan-300"
                        : emFoco
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/60"
                        : "bg-[#0D162B] text-slate-300 border-white/10 hover:bg-white/[0.08]"
                    }`}
                    title="Clique para listar os dias deste mês (ou clique em 'Ver todo o mês')"
                  >
                    <span>{m.rotulo}</span>
                    <span className="text-[11px] opacity-85">({m.qtd})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Dias do Mês selecionado */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
              Dias com Pedidos ({diasDoMesEmFoco.length})
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {diasDoMesEmFoco.map((d) => {
                const ativo = valor === d.dataBr;
                return (
                  <button
                    key={d.dataBr}
                    type="button"
                    onClick={() => selecionar(d.dataBr)}
                    className={`h-8 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center justify-between transition cursor-pointer ${
                      ativo
                        ? "bg-cyan-600 text-white border-cyan-300 shadow-sm shadow-cyan-500/30"
                        : "bg-[#0D162B] hover:bg-cyan-500/15 text-white border-white/10 hover:border-cyan-400/40"
                    }`}
                  >
                    <span>{d.dataBr}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-cyan-200">
                      ({d.qtd})
                      {ativo && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

