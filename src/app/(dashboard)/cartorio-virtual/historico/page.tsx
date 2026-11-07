import React from "react";
import Link from "next/link";
import { Search, ShieldCheck, Bot, User, Server, ArrowRight } from "lucide-react";
import { exigirAcessoRotaCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import { listarHistoricoCartorioVirtual } from "@/lib/cartorio-virtual/repository";

export default async function CartorioVirtualHistoricoPage({
  searchParams,
}: {
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const ctx = await exigirAcessoRotaCartorioVirtual("/cartorio-virtual/historico");
  const sp = await Promise.resolve(searchParams);
  const busca = typeof sp.busca === "string" ? sp.busca : "";

  const historicoBruto = await listarHistoricoCartorioVirtual(ctx.tenantId, busca);

  // Remove repetição de registros do mesmo Pedido na trilha (mantendo o andamento mais recente por nº de pedido)
  const pedidosVistos = new Set<string>();
  const lotesEventosVistos = new Set<string>();
  const historico = historicoBruto.filter((h) => {
    if (h.numeroPedido) {
      if (pedidosVistos.has(h.numeroPedido)) return false;
      pedidosVistos.add(h.numeroPedido);
      return true;
    }
    const chaveSemPedido = `${h.evento}:${h.resumo}`;
    if (lotesEventosVistos.has(chaveSemPedido)) return false;
    lotesEventosVistos.add(chaveSemPedido);
    return true;
  });

  const formatarEstadoTransicao = (estado: string | null) => {
    if (!estado) return null;
    if (estado === "EM_REVISAO_HUMANA") return "EM REVISÃO COM O ESCREVENTE";
    return estado;
  };

  const formatarResumoAndamento = (resumoOriginal: string, numeroPedido: string | null) => {
    let texto = resumoOriginal.replace(
      /Em revisão humana/gi,
      "EM REVISÃO COM O ESCREVENTE"
    );

    if (numeroPedido) {
      const numEscapado = numeroPedido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      texto = texto
        .replace(new RegExp(`^Status do Pedido n[ºo°]?\\s*#?${numEscapado}\\s+`, "i"), "Status ")
        .replace(new RegExp(`^Pedido n[ºo°]?\\s*#?${numEscapado}\\s+`, "i"), "")
        .replace(new RegExp(`\\s+para o pedido n[ºo°]?\\s*#?${numEscapado}`, "i"), "")
        .replace(new RegExp(`\\s*[—\\-]\\s*Pedido\\s*#?${numEscapado}`, "gi"), "")
        .replace(new RegExp(`\\bPedido n[ºo°]?\\s*#?${numEscapado}\\b\\s*`, "gi"), "")
        .trim();

      if (texto.length > 0) {
        texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      }
    }

    return texto;
  };

  const badgeAtor = (tipo: string) => {
    if (tipo === "HUMANO") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (tipo === "AGENTE_VIRTUAL") return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    if (tipo === "CONNECTOR") return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  };

  const rotuloAtor = (tipo: string) => {
    if (tipo === "HUMANO") return "ESCREVENTE";
    return tipo;
  };

  return (
    <div className="space-y-5">
      {/* Filtro e pesquisa auditável (sem o filtro Tipo de Ator) */}
      <form
        method="GET"
        className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 flex flex-col md:flex-row gap-3 md:items-end"
      >
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Pesquisar nos Andamentos (WORM)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="busca"
              defaultValue={busca}
              placeholder="Pedido, prenotação, operador, transição ou andamento..."
              className="w-full rounded-xl bg-white/[0.04] border border-white/15 pl-10 pr-3 py-2 text-xs text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs py-2 px-5 transition cursor-pointer"
          >
            Filtrar
          </button>
          <Link
            href="/cartorio-virtual/historico"
            className="rounded-xl border border-white/15 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            Limpar
          </Link>
        </div>
      </form>

      {/* Trilha de andamentos */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">
              Andamentos da Serventia ({historico.length} registro(s))
            </h2>
          </div>
        </div>

        {historico.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Nenhum evento operacional registrado para os critérios informados.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {historico.map((h) => (
              <div key={h.id} className="px-6 py-4 hover:bg-white/[0.02] transition space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeAtor(
                        h.atorTipo
                      )}`}
                    >
                      {h.atorTipo === "AGENTE_VIRTUAL" ? (
                        <Bot className="w-3 h-3" />
                      ) : h.atorTipo === "HUMANO" ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Server className="w-3 h-3" />
                      )}
                      {rotuloAtor(h.atorTipo)}
                    </span>

                    <span className="text-xs font-bold text-white">{h.evento}</span>

                    {h.pedidoId && h.numeroPedido && (
                      <Link
                        href={`/cartorio-virtual/impressao?pedido=${h.numeroPedido}`}
                        className="text-xs font-semibold text-cyan-400 hover:underline"
                      >
                        Pedido nº {h.numeroPedido}
                      </Link>
                    )}

                    {h.estadoAnterior && h.estadoNovo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
                        {formatarEstadoTransicao(h.estadoAnterior)}{" "}
                        <ArrowRight className="w-3 h-3 text-cyan-400" />{" "}
                        {formatarEstadoTransicao(h.estadoNovo)}
                      </span>
                    )}
                  </div>

                  <span className="text-sm sm:text-base font-mono font-extrabold text-cyan-200 bg-cyan-500/12 border border-cyan-500/35 px-3 py-1 rounded-xl shrink-0">
                    {h.criadoEmBr}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  {formatarResumoAndamento(h.resumo, h.numeroPedido)}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>
                    Responsável: <strong className="text-slate-300">{h.atorNome}</strong>
                    {h.papelRegistral ? ` (${h.papelRegistral})` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

