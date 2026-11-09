"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  EyeOff,
  Printer,
  Loader2,
} from "lucide-react";
import type { PedidoCertidaoDetalheDTO } from "@/lib/cartorio-virtual/types";
import {
  obterAtendentePedidoWebri,
  obterObservacaoOriginalWebri,
  pedidoEhQuatroHorasLv2,
} from "@/lib/cartorio-virtual/types";
import { gerarLoteImpressaoAction } from "@/app/actions/cartorio-virtual";
import { useCartorioVirtualTopoVisivel } from "@/components/cartorio-virtual/CartorioVirtualTopBar";

export interface EstadoFiltrosAvancadosWebri {
  dataInicialIso: string; // YYYY-MM-DD ou ""
  dataFinalIso: string; // YYYY-MM-DD ou ""
  numeroPedido: string;
  dataCertidaoIso: string; // YYYY-MM-DD ou ""
  assinaCertidao: string;
  verificaCertidao: string;
  confereCertidao: string;
  digitaCertidao: string;
  natureza: string;
  divisor: string;
  modelo: string;
  opcaoImpressao: string;
  guiasRecolhimento: string;
  resultadoFiltro: "TODAS" | "SOMENTE_NEGATIVAS" | "SOMENTE_POSITIVAS";
  magneticos: boolean;
  imprimirEmPdf: boolean;
  assinaOnr: boolean;
  todasAsImpressoes: boolean;
  jaImpressas: boolean;
}

export const ESTADO_INICIAL_FILTROS_WEBRI: EstadoFiltrosAvancadosWebri = {
  dataInicialIso: "",
  dataFinalIso: "",
  numeroPedido: "",
  dataCertidaoIso: "",
  assinaCertidao: "ADEMAR FIORANELLI",
  verificaCertidao: "ADEMAR FIORANELLI",
  confereCertidao: "ADEMAR FIORANELLI",
  digitaCertidao: "ADEMAR FIORANELLI",
  natureza: "TODOS",
  divisor: "CUSTAS_INTEGRAIS",
  modelo: "4 HORAS LV2",
  opcaoImpressao: "Nenhuma",
  guiasRecolhimento: "",
  resultadoFiltro: "TODAS",
  magneticos: false,
  imprimirEmPdf: false,
  assinaOnr: false,
  todasAsImpressoes: true,
  jaImpressas: false,
};

export function temFiltroAvancadoWebriAtivo(
  filtros: EstadoFiltrosAvancadosWebri
): boolean {
  return (
    filtros.dataInicialIso !== "" ||
    filtros.dataFinalIso !== "" ||
    filtros.numeroPedido.trim() !== "" ||
    filtros.dataCertidaoIso !== "" ||
    filtros.natureza !== "TODOS" ||
    filtros.divisor !== "CUSTAS_INTEGRAIS" ||
    filtros.modelo !== "4 HORAS LV2" ||
    filtros.opcaoImpressao !== "Nenhuma" ||
    filtros.guiasRecolhimento.trim() !== "" ||
    filtros.resultadoFiltro !== "TODAS" ||
    filtros.magneticos !== false ||
    filtros.assinaOnr !== false ||
    filtros.jaImpressas !== false ||
    filtros.todasAsImpressoes !== true
  );
}

function extrairDataIsoDoPedido(pedido: PedidoCertidaoDetalheDTO): string {
  if (pedido.dataPedidoIso && /^\d{4}-\d{2}-\d{2}$/.test(pedido.dataPedidoIso)) {
    return pedido.dataPedidoIso;
  }
  const m = (pedido.dataPedidoBr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return "";
}

function extrairDataPrevisaoIsoDoPedido(pedido: PedidoCertidaoDetalheDTO): string {
  for (const item of pedido.itens) {
    const m = (item.dataPrevisaoBr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return extrairDataIsoDoPedido(pedido);
}

function itemEhPositivoWebri(pedido: PedidoCertidaoDetalheDTO): boolean {
  if (pedido.itens.length === 0) return false;
  return pedido.itens.some((it) => {
    if (it.resultadoPesquisaSistema === 2) return true;
    if (it.resultadoPesquisaSistema === 1) return false;
    const numMat = Number(String(it.numeroMatricula || "").replace(/\D/g, ""));
    return Number.isFinite(numMat) && numMat > 0;
  });
}

function itemEhNegativoWebri(pedido: PedidoCertidaoDetalheDTO): boolean {
  if (pedido.itens.length === 0) return true;
  return pedido.itens.some((it) => {
    if (it.resultadoPesquisaSistema === 1) return true;
    if (it.resultadoPesquisaSistema === 2) return false;
    const numMat = Number(String(it.numeroMatricula || "").replace(/\D/g, ""));
    return !numMat || numMat === 0;
  });
}

export function correspondeFiltrosAvancadosWebri(
  pedido: PedidoCertidaoDetalheDTO,
  filtros: EstadoFiltrosAvancadosWebri
): boolean {
  const dataIso = extrairDataIsoDoPedido(pedido);

  // 1. Data Inicial e Data Final
  if (filtros.dataInicialIso && dataIso && dataIso < filtros.dataInicialIso) {
    return false;
  }
  if (filtros.dataFinalIso && dataIso && dataIso > filtros.dataFinalIso) {
    return false;
  }

  // 2. N. Pedido (aceita número exato, parcial, protocolo ONR ou matrícula)
  if (filtros.numeroPedido.trim()) {
    const q = filtros.numeroPedido.trim().replace(/^#+/, "").replace(/\./g, "").toLowerCase();
    const bateNumero =
      pedido.numeroPedido.toLowerCase().includes(q) ||
      (pedido.protocoloExterno || "").toLowerCase().includes(q) ||
      pedido.itens.some((it) => String(it.numeroMatricula || "").toLowerCase().includes(q));
    if (!bateNumero) return false;
  }

  // 3. Data Certidão (compara com a data do pedido ou previsão de entrega)
  if (filtros.dataCertidaoIso) {
    const prevIso = extrairDataPrevisaoIsoDoPedido(pedido);
    if (dataIso !== filtros.dataCertidaoIso && prevIso !== filtros.dataCertidaoIso) {
      return false;
    }
  }

  // 4. Assina / Verifica / Confere / Digita Certidão (quando selecionado um atendente específico diferente do padrão titular/Todos)
  const filtroUsuarioEspecifico = (valor: string) =>
    valor && valor !== "TODOS" && valor !== "ADEMAR FIORANELLI";

  if (
    filtroUsuarioEspecifico(filtros.assinaCertidao) ||
    filtroUsuarioEspecifico(filtros.verificaCertidao) ||
    filtroUsuarioEspecifico(filtros.confereCertidao) ||
    filtroUsuarioEspecifico(filtros.digitaCertidao)
  ) {
    const atendente = (obterAtendentePedidoWebri(pedido) || "").toLowerCase();
    const conferente = (pedido.conferidoPorNome || "").toLowerCase();
    const alvos = [
      filtros.assinaCertidao,
      filtros.verificaCertidao,
      filtros.confereCertidao,
      filtros.digitaCertidao,
    ]
      .filter(filtroUsuarioEspecifico)
      .map((s) => s.toLowerCase());

    const bateAlguem = alvos.every(
      (alvo) => atendente.includes(alvo) || conferente.includes(alvo)
    );
    if (!bateAlguem) return false;
  }

  // 5. Natureza WEBRI
  if (filtros.natureza && filtros.natureza !== "TODOS") {
    const natFiltro = filtros.natureza.toLowerCase();
    const bateNat =
      pedido.especieSolicitada.toLowerCase().includes(natFiltro) ||
      pedido.itens.some(
        (it) =>
          (it.naturezaOriginalWebri || "").toLowerCase().includes(natFiltro) ||
          (it.naturezaDescricao || "").toLowerCase().includes(natFiltro)
      );
    if (!bateNat) return false;
  }

  // 6. Divisor
  if (
    filtros.divisor &&
    filtros.divisor !== "TODOS" &&
    filtros.divisor !== "CUSTAS_INTEGRAIS"
  ) {
    const divPedido = String(pedido.webriMeta?.divisorId ?? "1");
    if (divPedido !== filtros.divisor) return false;
  }

  // 7. Modelo e Opção de impressão ("TODOS menos as de 04 HORAS LV2")
  if (
    filtros.modelo === "TODOS_MENOS_04_HORAS_LV2" ||
    filtros.opcaoImpressao === "TODOS_MENOS_04_HORAS_LV2"
  ) {
    if (pedidoEhQuatroHorasLv2(pedido)) return false;
  } else if (filtros.modelo === "SOMENTE_04_HORAS_LV2") {
    if (!pedidoEhQuatroHorasLv2(pedido)) return false;
  } else if (
    filtros.modelo &&
    filtros.modelo !== "TODOS" &&
    filtros.modelo !== "4 HORAS LV2"
  ) {
    const mod = filtros.modelo.toLowerCase();
    const bateMod =
      pedido.especieSolicitada.toLowerCase().includes(mod) ||
      pedido.itens.some((it) => (it.naturezaDescricao || "").toLowerCase().includes(mod));
    if (!bateMod) return false;
  }

  // 8. Guias de recolhimento (pesquisa nas observações, RPS, protocolo ou código de acesso)
  if (filtros.guiasRecolhimento.trim()) {
    const g = filtros.guiasRecolhimento.trim().toLowerCase();
    const obs = (obterObservacaoOriginalWebri(pedido) || "").toLowerCase();
    const rps = String(pedido.webriMeta?.numRps || "").toLowerCase();
    const cod = String(pedido.webriMeta?.codigoAcesso || "").toLowerCase();
    if (
      !obs.includes(g) &&
      !rps.includes(g) &&
      !cod.includes(g) &&
      !pedido.numeroPedido.toLowerCase().includes(g)
    ) {
      return false;
    }
  }

  // 9. Radio: Somente Negativas vs Somente Positivas
  if (filtros.resultadoFiltro === "SOMENTE_NEGATIVAS") {
    if (!itemEhNegativoWebri(pedido)) return false;
  } else if (filtros.resultadoFiltro === "SOMENTE_POSITIVAS") {
    if (!itemEhPositivoWebri(pedido)) return false;
  }

  // 10. Checkbox: Magnéticos
  if (filtros.magneticos) {
    const ehMagnetico =
      pedido.origem === "ONR" ||
      Boolean(pedido.protocoloExterno && pedido.protocoloExterno !== "0") ||
      pedido.itens.some((it) =>
        (it.naturezaDescricao || "").toLowerCase().includes("magnetico")
      );
    if (!ehMagnetico) return false;
  }

  // 11. Checkbox: Assina ONR
  if (filtros.assinaOnr) {
    const temAssinaOnr =
      pedido.itens.some(
        (it) =>
          Boolean(it.assinaOnr) ||
          (it.naturezaDescricao || "").toLowerCase().includes("certidão digital")
      ) || pedido.origem === "ONR";
    if (!temAssinaOnr) return false;
  }

  // 12. Checkbox: Já impressas vs Todas as impressões
  if (filtros.jaImpressas) {
    const foiImpresso =
      Boolean(pedido.conferidoPeloEscrevente) ||
      pedido.itens.some((it) => Number(it.qtdeImpressao || 0) > 0);
    if (!foiImpresso) return false;
  } else if (!filtros.todasAsImpressoes) {
    // Quando desmarca "Todas as impressões" e não marca "Já impressas", exibe apenas as não impressas ("Não")
    const jaImpressoNoWebri = pedido.itens.some((it) => Number(it.qtdeImpressao || 0) > 0);
    if (jaImpressoNoWebri) return false;
  }

  return true;
}

export function BarraFiltrosWebriCartorioVirtual({
  filtros,
  onChange,
  pedidosBase,
  pedidosFiltrados,
  compacto = false,
  abertoPorPadrao = true,
}: {
  filtros: EstadoFiltrosAvancadosWebri;
  onChange: (novosFiltros: EstadoFiltrosAvancadosWebri) => void;
  pedidosBase: PedidoCertidaoDetalheDTO[];
  pedidosFiltrados?: PedidoCertidaoDetalheDTO[];
  compacto?: boolean;
  abertoPorPadrao?: boolean;
}) {
  const [expandido, setExpandido] = useState<boolean>(abertoPorPadrao);
  const [imprimindoLoteFiltrado, setImprimindoLoteFiltrado] = useState<boolean>(false);
  const { tresLinhasVisiveis, alternarTresLinhas } = useCartorioVirtualTopoVisivel();

  const listaFiltradaAtiva = React.useMemo(() => {
    if (pedidosFiltrados) return pedidosFiltrados;
    return pedidosBase.filter((p) => correspondeFiltrosAvancadosWebri(p, filtros));
  }, [pedidosFiltrados, pedidosBase, filtros]);

  const pedidosSem4HorasLv2 = React.useMemo(() => {
    return pedidosBase.filter(
      (p) =>
        !pedidoEhQuatroHorasLv2(p) &&
        correspondeFiltrosAvancadosWebri(p, {
          ...filtros,
          modelo: "TODOS_MENOS_04_HORAS_LV2",
        })
    );
  }, [pedidosBase, filtros]);

  const handleImprimirFiltrados = async () => {
    if (listaFiltradaAtiva.length === 0) {
      toast.error("Nenhum pedido encontrado na listagem filtrada atual para imprimir.");
      return;
    }

    setImprimindoLoteFiltrado(true);
    try {
      const ids = listaFiltradaAtiva.map((p) => p.id);
      const res = await gerarLoteImpressaoAction({
        modoSelecao: "SELECIONADOS",
        pedidosIds: ids,
        duplexFrenteNovaFolha: true,
        modoDadosImpressao: "ATUAL_RECONSTRUIDO",
        criterioOrdenacao: "NUMERO_PEDIDO_ASC",
      });
      const urlPdf = `/api/cartorio-virtual/impressao/${res.lote.id}/pdf`;
      toast.success(
        `Lote ${res.lote.codigoLote} gerado com ${res.lote.totalPedidos} Pedido(s) da listagem filtrada.`
      );
      window.open(urlPdf, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar lote de impressão dos pedidos filtrados.");
    } finally {
      setImprimindoLoteFiltrado(false);
    }
  };

  // Extrai naturezas originais do WEBRI e atendentes presentes nos pedidos carregados
  const naturezasDisponiveis = React.useMemo(() => {
    const set = new Set<string>([
      "Incluido por meio Magnetico (M)",
      "Certidão Digital <=<=",
      "Certidão Solicitada por Endereço (Meio Magnético)",
    ]);
    for (const p of pedidosBase) {
      for (const it of p.itens) {
        if (it.naturezaOriginalWebri?.trim()) {
          set.add(it.naturezaOriginalWebri.trim());
        } else if (it.naturezaDescricao?.trim()) {
          set.add(it.naturezaDescricao.trim());
        }
      }
    }
    return Array.from(set);
  }, [pedidosBase]);

  const usuariosDisponiveis = React.useMemo(() => {
    const set = new Set<string>(["ADEMAR FIORANELLI"]);
    for (const p of pedidosBase) {
      const at = obterAtendentePedidoWebri(p);
      if (at && at.trim()) set.add(at.trim());
      if (p.conferidoPorNome?.trim()) set.add(p.conferidoPorNome.trim());
    }
    return Array.from(set);
  }, [pedidosBase]);

  const atualizarCampo = <K extends keyof EstadoFiltrosAvancadosWebri>(
    chave: K,
    valor: EstadoFiltrosAvancadosWebri[K]
  ) => {
    onChange({
      ...filtros,
      [chave]: valor,
    });
  };

  const ativo = temFiltroAvancadoWebriAtivo(filtros);

  return (
    <div className="w-full rounded-2xl border border-cyan-500/25 bg-[#080D1A]/90 px-3 py-2 space-y-2">
      {/* Cabeçalho do Painel de Filtros WEBRI */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-cyan-300 hover:text-cyan-200 cursor-pointer"
        >
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>FILTROS DE PESQUISA WEBRI (IMPRESSÃO DE CERTIDÕES EM LOTE)</span>
          {ativo && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-400/50 text-[10px] text-cyan-200">
              Filtro WEBRI Ativo
            </span>
          )}
          {expandido ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={imprimindoLoteFiltrado || listaFiltradaAtiva.length === 0}
            onClick={handleImprimirFiltrados}
            className="h-7 px-3 rounded-lg border border-emerald-400/50 bg-emerald-600/25 hover:bg-emerald-600/35 disabled:opacity-45 text-[11px] font-extrabold text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer transition"
            title="Imprimir todos os pedidos filtrados que aparecem na listagem abaixo"
          >
            {imprimindoLoteFiltrado ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>IMPRIMIR ({listaFiltradaAtiva.length})</span>
          </button>
          <button
            type="button"
            onClick={alternarTresLinhas}
            className="h-7 px-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-[11px] font-bold text-cyan-200 inline-flex items-center gap-1 cursor-pointer transition"
            title={
              tresLinhasVisiveis
                ? "Ocultar as 3 linhas superiores (Abas + 2 linhas de filtros rápidos) de uma vez"
                : "Exibir novamente as 3 linhas superiores (Abas + 2 linhas de filtros rápidos)"
            }
          >
            {tresLinhasVisiveis ? (
              <>
                <EyeOff className="w-3 h-3 text-cyan-300" />
                <span>Ocultar 3 Linhas do Topo</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-cyan-300" />
                <span>Exibir 3 Linhas do Topo</span>
              </>
            )}
          </button>
          {ativo && (
            <button
              type="button"
              onClick={() => onChange(ESTADO_INICIAL_FILTROS_WEBRI)}
              className="h-7 px-2.5 rounded-lg border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar Filtros WEBRI
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="h-7 px-2.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-semibold text-slate-300 cursor-pointer"
          >
            {expandido ? "Recolher" : "Expandir Filtros WEBRI"}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          {/* LINHA 1 DO WEBRI: Data Inicial | Data Final | N. Pedido | Data Certidão */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 ${
              compacto ? "gap-1.5" : "gap-2"
            }`}
          >
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">Data Inicial</span>
              <input
                type="date"
                value={filtros.dataInicialIso}
                onChange={(e) => atualizarCampo("dataInicialIso", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">Data Final</span>
              <input
                type="date"
                value={filtros.dataFinalIso}
                onChange={(e) => atualizarCampo("dataFinalIso", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">N. Pedido</span>
              <div className="relative">
                <input
                  type="text"
                  value={filtros.numeroPedido}
                  onChange={(e) => atualizarCampo("numeroPedido", e.target.value)}
                  placeholder="Ex.: 1332403 ou S26..."
                  className="w-full h-8 pl-2 pr-7 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-cyan-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">Data Certidão</span>
              <input
                type="date"
                value={filtros.dataCertidaoIso}
                onChange={(e) => atualizarCampo("dataCertidaoIso", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>
          </div>

          {/* LINHA 2 DO WEBRI: Natureza | Divisor | Modelo | Opção de impressão */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 ${
              compacto ? "gap-1.5" : "gap-2"
            }`}
          >
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">Natureza</span>
              <select
                value={filtros.natureza}
                onChange={(e) => atualizarCampo("natureza", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
              >
                <option value="TODOS" className="bg-[#080D1A] text-white">
                  Certidão(s) (Todas)
                </option>
                {naturezasDisponiveis.map((nat) => (
                  <option key={nat} value={nat} className="bg-[#080D1A] text-white">
                    {nat}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-rose-300">Divisor</span>
              <select
                value={filtros.divisor}
                onChange={(e) => atualizarCampo("divisor", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
              >
                <option value="CUSTAS_INTEGRAIS" className="bg-[#080D1A] text-white">
                  Custas Integrais
                </option>
                <option value="TODOS" className="bg-[#080D1A] text-white">
                  Todos os Divisores
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">Modelo</span>
              <select
                value={filtros.modelo}
                onChange={(e) => atualizarCampo("modelo", e.target.value)}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
              >
                <option value="4 HORAS LV2" className="bg-[#080D1A] text-white">
                  4 HORAS LV2
                </option>
                <option
                  value="TODOS_MENOS_04_HORAS_LV2"
                  className="bg-[#080D1A] text-emerald-300 font-bold"
                >
                  TODOS menos as de 04 HORAS LV2 ({pedidosSem4HorasLv2.length})
                </option>
                <option value="SOMENTE_04_HORAS_LV2" className="bg-[#080D1A] text-white">
                  Somente 04 HORAS LV2
                </option>
                <option value="TODOS" className="bg-[#080D1A] text-white">
                  Todos os Modelos
                </option>
                <option value="Inteiro Teor" className="bg-[#080D1A] text-white">
                  CERTIDÃO INTEIRO TEOR LV2
                </option>
                <option value="Endereço" className="bg-[#080D1A] text-white">
                  BUSCA POR ENDEREÇO / INDICADOR REAL
                </option>
                <option value="Proprietário" className="bg-[#080D1A] text-white">
                  BUSCA POR PROPRIETÁRIO (INDICADOR PESSOAL)
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-slate-200">
                Opção de impressão
              </span>
              <select
                value={filtros.opcaoImpressao}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "TODOS_MENOS_04_HORAS_LV2") {
                    onChange({
                      ...filtros,
                      modelo: "TODOS_MENOS_04_HORAS_LV2",
                      opcaoImpressao: val,
                    });
                  } else {
                    atualizarCampo("opcaoImpressao", val);
                  }
                }}
                className="h-8 px-2 rounded-lg bg-[#0B1224] border border-white/20 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
              >
                <option value="Nenhuma" className="bg-[#080D1A] text-white">
                  Nenhuma
                </option>
                <option
                  value="TODOS_MENOS_04_HORAS_LV2"
                  className="bg-[#080D1A] text-emerald-300 font-bold"
                >
                  Imprimir TODOS menos as de 04 HORAS LV2 ({pedidosSem4HorasLv2.length})
                </option>
                <option value="Frente e Verso (Duplex)" className="bg-[#080D1A] text-white">
                  Frente e Verso (Duplex)
                </option>
                <option value="Somente Frente" className="bg-[#080D1A] text-white">
                  Somente Frente (Pág. 1)
                </option>
                <option value="Somente Verso" className="bg-[#080D1A] text-white">
                  Somente Verso (Pág. 2)
                </option>
              </select>
            </label>
          </div>

          {/* LINHA 4 DO WEBRI: Radios (Todas / Somente Negativas / Somente Positivas) + Checkboxes (Magnéticos, Imprimir em PDF, Assina ONR, Todas as impressões, Já impressas) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-200">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="radio"
                name="webri-resultado-filtro"
                checked={filtros.resultadoFiltro === "TODAS"}
                onChange={() => atualizarCampo("resultadoFiltro", "TODAS")}
                className="accent-cyan-400 cursor-pointer"
              />
              <span>Todas (Positivas e Negativas)</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="radio"
                name="webri-resultado-filtro"
                checked={filtros.resultadoFiltro === "SOMENTE_NEGATIVAS"}
                onChange={() => atualizarCampo("resultadoFiltro", "SOMENTE_NEGATIVAS")}
                className="accent-cyan-400 cursor-pointer"
              />
              <span>Somente Negativas</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="radio"
                name="webri-resultado-filtro"
                checked={filtros.resultadoFiltro === "SOMENTE_POSITIVAS"}
                onChange={() => atualizarCampo("resultadoFiltro", "SOMENTE_POSITIVAS")}
                className="accent-cyan-400 cursor-pointer"
              />
              <span>Somente Positivas</span>
            </label>

            <span className="text-white/20 hidden sm:inline">|</span>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={filtros.magneticos}
                onChange={(e) => atualizarCampo("magneticos", e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Magnéticos</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={filtros.imprimirEmPdf}
                onChange={(e) => atualizarCampo("imprimirEmPdf", e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Imprimir em PDF</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={filtros.assinaOnr}
                onChange={(e) => atualizarCampo("assinaOnr", e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Assina ONR</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={filtros.todasAsImpressoes}
                onChange={(e) => atualizarCampo("todasAsImpressoes", e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Todas as impressões</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={filtros.jaImpressas}
                onChange={(e) => atualizarCampo("jaImpressas", e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Já impressas</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
