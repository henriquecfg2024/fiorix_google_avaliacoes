import React from "react";
import { exigirAcessoRotaCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import {
  listarAnotacoesCartorioVirtual,
  listarPedidosCartorioVirtual,
  obterResumoVisaoGeralCartorioVirtual,
} from "@/lib/cartorio-virtual/repository";
import type { FiltroConferenciaEscrevente } from "@/lib/cartorio-virtual/types";
import {
  VisaoGeralDinamicaClient,
  type FiltroKpiVisaoGeral,
} from "@/components/cartorio-virtual/VisaoGeralDinamicaClient";

export default async function CartorioVirtualVisaoGeralPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const ctx = await exigirAcessoRotaCartorioVirtual("/cartorio-virtual");
  const sp = searchParams ? await Promise.resolve(searchParams) : {};

  const kpiParam = typeof sp.kpi === "string" ? sp.kpi.toUpperCase() : "TODOS";
  const kpiInicial: FiltroKpiVisaoGeral = (
    ["TODOS", "REVISAO", "ATUALIZACAO", "DEVOLVIDO"] as const
  ).includes(kpiParam as any)
    ? (kpiParam as FiltroKpiVisaoGeral)
    : "TODOS";

  const confParam = typeof sp.conferencia === "string" ? sp.conferencia.toUpperCase() : "TODOS";
  const conferenciaInicial: FiltroConferenciaEscrevente =
    confParam === "CONFERIDO" || confParam === "NAO_CONFERIDO" || confParam === "DEVOLVIDO"
      ? confParam
      : "TODOS";

  const buscaInicial = typeof sp.busca === "string" ? sp.busca : "";

  const [resumo, { pedidos }, anotacoes] = await Promise.all([
    obterResumoVisaoGeralCartorioVirtual(ctx.tenantId),
    listarPedidosCartorioVirtual(ctx.tenantId),
    listarAnotacoesCartorioVirtual(ctx.tenantId),
  ]);

  const contagemObj: Record<string, number> = {};
  for (const a of anotacoes) {
    if (!a.pedidoId) continue;
    contagemObj[a.pedidoId] = (contagemObj[a.pedidoId] || 0) + 1;
  }

  return (
    <VisaoGeralDinamicaClient
      resumo={resumo}
      pedidos={pedidos}
      contagemAnotacoesPorPedido={contagemObj}
      kpiInicial={kpiInicial}
      conferenciaInicial={conferenciaInicial}
      buscaInicial={buscaInicial}
    />
  );
}
