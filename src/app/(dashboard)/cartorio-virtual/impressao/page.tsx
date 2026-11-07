import React from "react";
import { exigirAcessoRotaCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import {
  listarAnotacoesCartorioVirtual,
  listarLotesImpressaoCartorioVirtual,
  listarPedidosCartorioVirtual,
} from "@/lib/cartorio-virtual/repository";
import { CentralImpressaoClient } from "@/components/cartorio-virtual/CentralImpressaoClient";
import type {
  EstadoOperacionalPedido,
  FiltroConferenciaEscrevente,
} from "@/lib/cartorio-virtual/types";

export default async function CartorioVirtualImpressaoPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const ctx = await exigirAcessoRotaCartorioVirtual("/cartorio-virtual/impressao");
  const sp = searchParams ? await Promise.resolve(searchParams) : {};

  const tipoInicial = typeof sp.tipo === "string" && sp.tipo ? sp.tipo : "TODOS";
  const origemRaw = typeof sp.origem === "string" ? sp.origem.trim().toUpperCase() : "";
  const origemInicial: "ONR" | "BALCAO" | "TODAS" =
    origemRaw === "ONR"
      ? "ONR"
      : origemRaw === "BALCAO" || origemRaw === "PRESENCIAL"
        ? "BALCAO"
        : "TODAS";
  const estadoInicial =
    typeof sp.estado === "string" && sp.estado
      ? (sp.estado as EstadoOperacionalPedido | "TODOS")
      : "TODOS";
  const buscaInicial = typeof sp.busca === "string" ? sp.busca : "";
  const dataInicial = typeof sp.data === "string" && sp.data.trim() ? sp.data.trim() : "TODAS";
  const pedidoInicial = typeof sp.pedido === "string" ? sp.pedido : "";
  const selecaoInicial = typeof sp.selecao === "string" ? sp.selecao : "";
  const confRaw =
    typeof sp.conferencia === "string" && sp.conferencia.trim()
      ? sp.conferencia.trim().toUpperCase()
      : "NAO_CONFERIDO";
  const conferenciaInicial: FiltroConferenciaEscrevente =
    confRaw === "TODOS" ||
    confRaw === "CONFERIDO" ||
    confRaw === "NAO_CONFERIDO" ||
    confRaw === "DEVOLVIDO"
      ? confRaw
      : "NAO_CONFERIDO";

  const [{ pedidos }, lotes, anotacoes] = await Promise.all([
    listarPedidosCartorioVirtual(ctx.tenantId),
    listarLotesImpressaoCartorioVirtual(ctx.tenantId),
    listarAnotacoesCartorioVirtual(ctx.tenantId),
  ]);

  return (
    <CentralImpressaoClient
      pedidos={pedidos}
      lotesIniciais={lotes}
      anotacoesIniciais={anotacoes}
      pedidoInicialQuery={pedidoInicial}
      selecaoInicialQuery={selecaoInicial}
      filtrosIniciais={{
        tipoCertidao: tipoInicial,
        origem: origemInicial,
        dataPedido: dataInicial,
        estadoOperacional: estadoInicial,
        busca: buscaInicial,
        statusConferencia: conferenciaInicial,
      }}
    />
  );
}
