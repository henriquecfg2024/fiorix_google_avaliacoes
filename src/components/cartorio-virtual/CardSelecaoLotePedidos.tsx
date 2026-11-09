"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Search,
  ListChecks,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";
import { gerarLoteImpressaoAction } from "@/app/actions/cartorio-virtual";
import {
  interpretarSelecaoPedidosLote,
  pedidoEhQuatroHorasLv2,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";

interface CardSelecaoLotePedidosProps {
  pedidos: PedidoCertidaoDetalheDTO[];
  contagemAnotacoesPorPedido?: Record<string, number>;
  selecaoInicialLista?: string;
  modoCompactoModal?: boolean;
  onAplicarSelecaoNaMesa?: (idsSelecionados: string[], expressao: string) => void;
  onFecharModal?: () => void;
  onLoteGerado?: (urlPdfLote: string, codigoLote: string) => void;
}

export function CardSelecaoLotePedidos({
  pedidos,
  contagemAnotacoesPorPedido = {},
  selecaoInicialLista = "",
  modoCompactoModal = false,
  onAplicarSelecaoNaMesa,
  onFecharModal,
  onLoteGerado,
}: CardSelecaoLotePedidosProps) {
  const router = useRouter();

  const [modoEntrada, setModoEntrada] = useState<"PONTO_E_VIRGULA" | "FAIXA_DE_ATE">(
    "FAIXA_DE_ATE"
  );
  const [faixaInicio, setFaixaInicio] = useState("");
  const [faixaFim, setFaixaFim] = useState("");
  const [listaPontoEVirgula, setListaPontoEVirgula] = useState(selecaoInicialLista);
  const [pesquisaSubmetida, setPesquisaSubmetida] = useState<boolean>(
    Boolean(selecaoInicialLista.trim())
  );

  const [duplex, setDuplex] = useState(true);
  const [ordenacaoLote, setOrdenacaoLote] = useState<"NUMERO_PEDIDO_ASC" | "ORDEM_DIGITADA">(
    "NUMERO_PEDIDO_ASC"
  );
  const [imprimindoLote, setImprimindoLote] = useState(false);

  // Avaliação reativa da seleção digitada pelo Escrevente
  const resultado = useMemo(() => {
    return interpretarSelecaoPedidosLote({
      pedidosDisponiveis: pedidos,
      faixaInicio: modoEntrada === "FAIXA_DE_ATE" ? faixaInicio : "",
      faixaFim: modoEntrada === "FAIXA_DE_ATE" ? faixaFim : "",
      listaPontoEVirgula: modoEntrada === "PONTO_E_VIRGULA" ? listaPontoEVirgula : "",
    });
  }, [pedidos, modoEntrada, faixaInicio, faixaFim, listaPontoEVirgula]);

  const expressaoQuery = useMemo(() => {
    if (resultado.numerosEncontrados.length === 0) return "";
    return resultado.numerosEncontrados.join(";");
  }, [resultado.numerosEncontrados]);

  const handlePesquisarSelecao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultado.temEntradaValida) {
      toast.error(
        modoEntrada === "FAIXA_DE_ATE"
          ? "Informe o número inicial e final dos Pedidos (ex: de 9901001 até 9901006)."
          : "Digite os números dos Pedidos separados por ponto e vírgula (ex: 9901001; 9901003; 9901005)."
      );
      return;
    }

    setPesquisaSubmetida(true);

    if (resultado.pedidosEncontrados.length === 0) {
      toast.error("Nenhum Pedido foi localizado para os números informados.");
      return;
    }

    toast.success(
      `${resultado.pedidosEncontrados.length} Pedido(s) selecionado(s) e prontos para impressão em lote.`
    );

    if (onAplicarSelecaoNaMesa) {
      onAplicarSelecaoNaMesa(resultado.idsEncontrados, expressaoQuery);
    }
  };

  const handleImprimirSelecaoEmLote = async () => {
    if (resultado.idsEncontrados.length === 0) {
      toast.error("Pesquise e selecione ao menos 1 Pedido válido antes de imprimir o lote.");
      return;
    }

    setPesquisaSubmetida(true);
    setImprimindoLote(true);
    try {
      const res = await gerarLoteImpressaoAction({
        modoSelecao: "SELECIONADOS",
        pedidosIds: resultado.idsEncontrados,
        duplexFrenteNovaFolha: duplex,
        modoDadosImpressao: "ATUAL_RECONSTRUIDO",
        criterioOrdenacao:
          modoEntrada === "PONTO_E_VIRGULA" ? ordenacaoLote : "NUMERO_PEDIDO_ASC",
      });

      const urlPdf = `/api/cartorio-virtual/impressao/${res.lote.id}/pdf`;
      toast.success(
        `Lote ${res.lote.codigoLote} gerado com ${res.lote.totalPedidos} Pedido(s) (${res.lote.totalPaginas} páginas SIPLAN 595×842 pt).`
      );

      if (onLoteGerado) {
        onLoteGerado(urlPdf, res.lote.codigoLote);
      } else {
        window.open(urlPdf, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar o PDF em lote dos Pedidos selecionados.");
    } finally {
      setImprimindoLote(false);
    }
  };

  const limparSelecao = () => {
    setFaixaInicio("");
    setFaixaFim("");
    setListaPontoEVirgula("");
    setPesquisaSubmetida(false);
    if (onAplicarSelecaoNaMesa) {
      onAplicarSelecaoNaMesa([], "");
    }
  };

  const primeiroNumExemplo = pedidos[0]?.numeroPedido || "9901001";
  const ultimoNumExemplo =
    pedidos[Math.min(pedidos.length - 1, 5)]?.numeroPedido || "9901006";

  const alternarPedidoNaSelecaoRapida = (numPedido: string) => {
    setModoEntrada("PONTO_E_VIRGULA");
    setPesquisaSubmetida(true);
    const atuais = listaPontoEVirgula
      .split(/[;,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (atuais.includes(numPedido)) {
      setListaPontoEVirgula(atuais.filter((x) => x !== numPedido).join("; "));
    } else {
      setListaPontoEVirgula([...atuais, numPedido].join("; "));
    }
  };

  const pedidosSem4HorasLv2 = useMemo(
    () => pedidos.filter((p) => !pedidoEhQuatroHorasLv2(p)),
    [pedidos]
  );

  const selecionarTodosDaFila = () => {
    if (pedidos.length === 0) return;
    setModoEntrada("PONTO_E_VIRGULA");
    setPesquisaSubmetida(true);
    setListaPontoEVirgula(pedidos.map((p) => p.numeroPedido).join("; "));
  };

  const selecionarTodosMenos4HorasLv2 = () => {
    if (pedidosSem4HorasLv2.length === 0) {
      toast.error("Não há pedidos fora de 04 HORAS LV2 na lista atual.");
      return;
    }
    setModoEntrada("PONTO_E_VIRGULA");
    setPesquisaSubmetida(true);
    const lista = pedidosSem4HorasLv2.map((p) => p.numeroPedido).join("; ");
    setListaPontoEVirgula(lista);
    toast.success(
      `${pedidosSem4HorasLv2.length} Pedido(s) (TODOS menos 04 HORAS LV2) selecionados.`
    );
  };

  const handleImprimirDiretoTodosMenos4HorasLv2 = async () => {
    if (pedidosSem4HorasLv2.length === 0) {
      toast.error("Não há pedidos fora de 04 HORAS LV2 para imprimir.");
      return;
    }
    setModoEntrada("PONTO_E_VIRGULA");
    setPesquisaSubmetida(true);
    setListaPontoEVirgula(pedidosSem4HorasLv2.map((p) => p.numeroPedido).join("; "));
    setImprimindoLote(true);
    try {
      const ids = pedidosSem4HorasLv2.slice(0, 150).map((p) => p.id);
      const res = await gerarLoteImpressaoAction({
        modoSelecao: "SELECIONADOS",
        pedidosIds: ids,
        duplexFrenteNovaFolha: duplex,
        modoDadosImpressao: "ATUAL_RECONSTRUIDO",
        criterioOrdenacao: "NUMERO_PEDIDO_ASC",
      });
      const urlPdf = `/api/cartorio-virtual/impressao/${res.lote.id}/pdf`;
      toast.success(
        `Lote ${res.lote.codigoLote} gerado com ${res.lote.totalPedidos} Pedido(s) (TODOS menos 04 HORAS LV2).`
      );
      if (onLoteGerado) {
        onLoteGerado(urlPdf, res.lote.codigoLote);
      } else {
        window.open(urlPdf, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao imprimir lote sem 04 HORAS LV2.");
    } finally {
      setImprimindoLote(false);
    }
  };

  return (
    <section className="rounded-[24px] border-2 border-cyan-500/45 bg-[#090F1E] p-5 shadow-2xl space-y-4">
      {/* Cabeçalho Elegante */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 inline-flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              Seleção Rápida de Pedidos para Impressão em Lote
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Intervalo ou Ponto e Vírgula
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Digite os Pedidos <strong className="text-slate-200">de tanto a tanto</strong> ou{" "}
            <strong className="text-slate-200">separados por ponto e vírgula (;)</strong>, ou clique nos números disponíveis abaixo para imprimir em lote.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Alternador Elegante de Modo */}
          <div className="inline-flex rounded-xl border border-white/15 bg-[#070B16] p-1 text-xs">
            <button
              type="button"
              onClick={() => setModoEntrada("FAIXA_DE_ATE")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                modoEntrada === "FAIXA_DE_ATE"
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              De Tanto a Tanto (Faixa)
            </button>
            <button
              type="button"
              onClick={() => setModoEntrada("PONTO_E_VIRGULA")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                modoEntrada === "PONTO_E_VIRGULA"
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Ponto e Vírgula (;)
            </button>
          </div>

          {modoCompactoModal && onFecharModal && (
            <button
              type="button"
              onClick={onFecharModal}
              className="p-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 cursor-pointer"
              title="Fechar seleção em lote"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Atalho Rápido de Pedidos Disponíveis na Fila (evita erro de digitação) */}
      {pedidos.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#060A14] px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">
              Pedidos disponíveis (clique p/ marcar):
            </span>
            {pedidos.slice(0, 12).map((ped) => {
              const selecionado = resultado.idsEncontrados.includes(ped.id);
              return (
                <button
                  key={ped.id}
                  type="button"
                  onClick={() => alternarPedidoNaSelecaoRapida(ped.numeroPedido)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                    selecionado
                      ? "bg-emerald-600 text-white border-emerald-400 shadow-xs"
                      : "bg-[#0B1224] text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/20"
                  }`}
                  title={`${ped.especieSolicitada} — Clique para incluir ou remover do lote`}
                >
                  #{ped.numeroPedido}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={imprimindoLote || pedidosSem4HorasLv2.length === 0}
              onClick={handleImprimirDiretoTodosMenos4HorasLv2}
              className="px-2.5 py-1 rounded-lg border border-emerald-400/50 bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-200 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              {imprimindoLote ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Printer className="w-3 h-3" />
              )}
              Imprimir TODOS menos 04 HORAS LV2 ({pedidosSem4HorasLv2.length})
            </button>
            <button
              type="button"
              onClick={selecionarTodosMenos4HorasLv2}
              className="px-2.5 py-1 rounded-lg border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-[11px] font-bold cursor-pointer"
            >
              Selecionar s/ 04 HORAS LV2 ({pedidosSem4HorasLv2.length})
            </button>
            <button
              type="button"
              onClick={selecionarTodosDaFila}
              className="px-2.5 py-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-[11px] font-bold cursor-pointer"
            >
              Selecionar Todos ({pedidos.length})
            </button>
          </div>
        </div>
      )}

      {/* Formulário de Digitação */}
      <form
        onSubmit={handlePesquisarSelecao}
        className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
      >
        {modoEntrada === "FAIXA_DE_ATE" ? (
          <>
            <div className="lg:col-span-3 space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Do Pedido nº (Inicial)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={faixaInicio}
                onChange={(e) => setFaixaInicio(e.target.value)}
                placeholder={`Ex: ${primeiroNumExemplo}`}
                className="w-full h-11 px-3.5 rounded-xl bg-[#060A14] border border-cyan-500/35 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="lg:col-span-3 space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Até o Pedido nº (Final)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={faixaFim}
                onChange={(e) => setFaixaFim(e.target.value)}
                placeholder={`Ex: ${ultimoNumExemplo}`}
                className="w-full h-11 px-3.5 rounded-xl bg-[#060A14] border border-cyan-500/35 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>
          </>
        ) : (
          <div className="lg:col-span-6 space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              Números dos Pedidos Separados por Ponto e Vírgula (;)
            </label>
            <input
              type="text"
              value={listaPontoEVirgula}
              onChange={(e) => setListaPontoEVirgula(e.target.value)}
              placeholder={`Ex: ${primeiroNumExemplo}; ${ultimoNumExemplo} (também aceita faixas ex: ${primeiroNumExemplo}-${ultimoNumExemplo}; 9901008)`}
              className="w-full h-11 px-3.5 rounded-xl bg-[#060A14] border border-cyan-500/35 text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>
        )}

        {/* Opções de Duplex e Ordem */}
        <div className="lg:col-span-3 flex flex-col justify-end gap-1.5">
          {modoEntrada === "PONTO_E_VIRGULA" && (
            <select
              aria-label="Ordem de impressão do lote"
              value={ordenacaoLote}
              onChange={(e) => setOrdenacaoLote(e.target.value as any)}
              className="w-full h-8 px-2.5 rounded-lg bg-[#060A14] border border-white/15 text-xs text-slate-200"
            >
              <option value="NUMERO_PEDIDO_ASC">Ordem: Nº Crescente</option>
              <option value="ORDEM_DIGITADA">Ordem: Exata Digitada (;)</option>
            </select>
          )}
          <label className="h-11 px-3 rounded-xl border border-white/12 bg-[#060A14] inline-flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="rounded border-white/25 bg-[#0B1020]"
            />
            <span className="font-semibold">Frente e Verso (Duplex SIPLAN)</span>
          </label>
        </div>

        {/* Botões Pesquisar + Limpar */}
        <div className="lg:col-span-3 flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold uppercase tracking-wide inline-flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            Pesquisar Seleção
          </button>
          {resultado.temEntradaValida && (
            <button
              type="button"
              onClick={limparSelecao}
              className="h-11 px-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 text-xs font-semibold cursor-pointer"
              title="Limpar números digitados"
            >
              Limpar
            </button>
          )}
        </div>
      </form>

      {/* Painel de Resultado da Seleção Recém-Pesquisada + Botão Imprimir Lote */}
      {(pesquisaSubmetida || resultado.temEntradaValida) && (
        <div className="rounded-2xl border border-emerald-500/30 bg-[#060B17]/95 p-4 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {resultado.pedidosEncontrados.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {resultado.pedidosEncontrados.length} Pedido(s) recém-pesquisado(s) prontos para impressão em lote
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Nenhum Pedido encontrado na fila para os números digitados
                  </span>
                )}

                {resultado.naoLocalizados.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 border border-amber-500/35 text-amber-200">
                    Não localizado(s): {resultado.naoLocalizados.join("; ")}
                  </span>
                )}
              </div>

              {/* Chips clicáveis dos Pedidos selecionados */}
              {resultado.pedidosEncontrados.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 max-h-24 overflow-y-auto">
                  {resultado.pedidosEncontrados.slice(0, 40).map((ped) => {
                    const qtdNotas = contagemAnotacoesPorPedido[ped.id] || 0;
                    return (
                      <Link
                        key={ped.id}
                        href={`/cartorio-virtual/impressao?pedido=${ped.numeroPedido}&selecao=${encodeURIComponent(
                          expressaoQuery
                        )}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-[11px] font-mono text-cyan-200 transition"
                        title={`${ped.especieSolicitada} — Clique para ler e anotar antes de imprimir`}
                      >
                        <span className="font-bold text-white">#{ped.numeroPedido}</span>
                        <span className="text-[10px] text-slate-300">{ped.origem}</span>
                        {qtdNotas > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300 font-sans font-bold">
                            <BookmarkCheck className="w-3 h-3" />
                            {qtdNotas}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {resultado.pedidosEncontrados.length > 40 && (
                    <span className="text-xs text-slate-400 px-2">
                      +{resultado.pedidosEncontrados.length - 40} pedido(s)…
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Botões de Ação Direta sobre os Pedidos Recém-Pesquisados */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              {!modoCompactoModal && resultado.pedidosEncontrados.length > 0 && (
                <Link
                  href={`/cartorio-virtual/impressao?selecao=${encodeURIComponent(expressaoQuery)}`}
                  className="h-10 px-3.5 rounded-xl border border-cyan-500/35 bg-cyan-500/12 hover:bg-cyan-500/22 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ler & Anotar Seleção ({resultado.pedidosEncontrados.length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              {modoCompactoModal &&
                onAplicarSelecaoNaMesa &&
                resultado.pedidosEncontrados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onAplicarSelecaoNaMesa(resultado.idsEncontrados, expressaoQuery);
                      if (onFecharModal) onFecharModal();
                    }}
                    className="h-10 px-3.5 rounded-xl border border-cyan-500/35 bg-cyan-500/12 hover:bg-cyan-500/22 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Carregar na Mesa ({resultado.pedidosEncontrados.length})
                  </button>
                )}

              <button
                type="button"
                disabled={imprimindoLote || resultado.pedidosEncontrados.length === 0}
                onClick={handleImprimirSelecaoEmLote}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold uppercase tracking-wide inline-flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                {imprimindoLote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Imprimir Seleção em Lote ({resultado.pedidosEncontrados.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

