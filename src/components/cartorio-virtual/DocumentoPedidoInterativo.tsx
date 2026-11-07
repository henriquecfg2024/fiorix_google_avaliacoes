"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Highlighter,
  Type,
  MousePointer,
  Trash2,
  Smile,
  Check,
  X,
  Edit3,
  Undo2,
  Move,
  ArrowLeftRight,
} from "lucide-react";
import { SIPLAN_7RI_HEADER_PNG_BASE64 } from "@/lib/cartorio-virtual/assets/siplan-7ri-header-png";
import {
  ALTURA_PAGINA_SIPLAN_PT,
  CODE39_PATTERNS,
  formatarMoedaBrl,
  LARGURA_PAGINA_SIPLAN_PT,
  type AnotacaoImpressaoPedido,
} from "@/lib/cartorio-virtual/siplan-constants";
import {
  obterPrenotacoesContraditorioDoPedido,
  type CorGrifoDocumento,
  type CorTextoDocumento,
  type MarcacaoVisualDocumentoPedido,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";
import {
  LinkMatriculaLv2,
  LinkPrenotacaoWebri,
  renderizarTextoComLinksMatriculaLv2,
} from "./LinkMatriculaLv2";

export const OPCOES_CORES_GRIFO: Array<{
  codigo: CorGrifoDocumento;
  rotulo: string;
  bgCss: string;
  borderCss: string;
  swatchHex: string;
}> = [
    {
      codigo: "AMARELO",
      rotulo: "Amarelo",
      bgCss: "rgba(250, 204, 21, 0.40)",
      borderCss: "rgba(202, 138, 4, 0.85)",
      swatchHex: "#FACC15",
    },
    {
      codigo: "VERDE",
      rotulo: "Verde",
      bgCss: "rgba(74, 222, 128, 0.38)",
      borderCss: "rgba(22, 163, 74, 0.85)",
      swatchHex: "#4ADE80",
    },
    {
      codigo: "AZUL",
      rotulo: "Azul / Ciano",
      bgCss: "rgba(56, 189, 248, 0.38)",
      borderCss: "rgba(2, 132, 199, 0.85)",
      swatchHex: "#38BDF8",
    },
    {
      codigo: "ROSA",
      rotulo: "Rosa",
      bgCss: "rgba(244, 114, 182, 0.38)",
      borderCss: "rgba(219, 39, 119, 0.85)",
      swatchHex: "#F472B6",
    },
    {
      codigo: "LARANJA",
      rotulo: "Laranja",
      bgCss: "rgba(251, 146, 60, 0.40)",
      borderCss: "rgba(234, 88, 12, 0.85)",
      swatchHex: "#FB923C",
    },
    {
      codigo: "LILAS",
      rotulo: "Lilás",
      bgCss: "rgba(192, 132, 252, 0.38)",
      borderCss: "rgba(147, 51, 234, 0.85)",
      swatchHex: "#C084FC",
    },
  ];

export const OPCOES_CORES_TEXTO: Array<{
  codigo: CorTextoDocumento;
  rotulo: string;
  hex: string;
}> = [
    { codigo: "AZUL_ESCURO", rotulo: "Azul Escrevente", hex: "#0D3F9E" },
    { codigo: "PRETO", rotulo: "Preto", hex: "#0F172A" },
    { codigo: "VERMELHO", rotulo: "Vermelho Alerta", hex: "#BD1724" },
    { codigo: "VERDE_ESCURO", rotulo: "Verde Conferência", hex: "#0A7042" },
    { codigo: "ROXO", rotulo: "Roxo Destaque", hex: "#6B24A8" },
  ];

const EMOTICONS_DOCUMENTO = [
  "✅",
  "✔️",
  "⚠️",
  "🚨",
  "📌",
  "🔍",
  "⏳",
  "❌",
  "❗",
  "📄",
  "📋",
  "🔒",
  "🔓",
  "💬",
  "✍️",
  "👍",
  "👎",
  "👀",
  "😊",
  "🤔",
  "⭐",
] as const;

export type FerramentaDocumento = "SELECIONAR" | "GRIFAR" | "TEXTO";

interface RetanguloPt {
  xPt: number;
  yTopoPt: number;
  larguraPt: number;
  alturaPt: number;
}

function BarcodeCode39Svg({ valor }: { valor: string }) {
  const limpo = String(valor || "0")
    .toUpperCase()
    .replace(/[^0-9A-Z\-.\s$/+%]/g, "");
  const codificado = `*${limpo || "0"}*`;
  const estreito = 1.02;
  const largo = estreito * 2.4;

  const barras: Array<{ x: number; w: number }> = [];
  let cursor = 0;
  for (let idx = 0; idx < codificado.length; idx++) {
    const padrao = CODE39_PATTERNS[codificado[idx]] || CODE39_PATTERNS["0"];
    for (let i = 0; i < padrao.length; i++) {
      const w = padrao[i] === "w" ? largo : estreito;
      if (i % 2 === 0) {
        barras.push({ x: cursor, w });
      }
      cursor += w;
    }
    if (idx < codificado.length - 1) cursor += estreito;
  }

  return (
    <div className="flex flex-col items-end select-none">
      <svg
        viewBox={`0 0 ${cursor} 28`}
        className="w-[24cqi] min-w-[115px] max-w-[270px] h-auto overflow-visible"
        aria-label={`Código de barras ${codificado}`}
      >
        {barras.map((b, idx) => (
          <rect key={idx} x={b.x} y={0} width={b.w} height={28} fill="#000000" />
        ))}
      </svg>
    </div>
  );
}

function MarcaDaguaStatusDiagonal({
  tipo,
  operadorNome,
  dataHoraBr,
}: {
  tipo: "CONFERIDO" | "DEVOLVIDO";
  operadorNome?: string | null;
  dataHoraBr?: string | null;
}) {
  const isDevolvido = tipo === "DEVOLVIDO";
  const corBordaRgba = isDevolvido ? "rgba(190, 18, 60, 0.24)" : "rgba(10, 138, 86, 0.24)";
  const corOutlineRgba = isDevolvido ? "rgba(190, 18, 60, 0.18)" : "rgba(10, 138, 86, 0.18)";
  const corTextoRgba = isDevolvido ? "rgba(190, 18, 60, 0.21)" : "rgba(8, 122, 75, 0.21)";

  const subtitulo = operadorNome
    ? `7º RI-SP • ${operadorNome.toUpperCase()}${dataHoraBr ? ` • ${dataHoraBr}` : ""}`
    : isDevolvido
      ? "7º REGISTRO DE IMÓVEIS DE SÃO PAULO • PEDIDO DEVOLVIDO"
      : "7º REGISTRO DE IMÓVEIS DE SÃO PAULO • CONFERÊNCIA DO ESCREVENTE";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
      style={{ mixBlendMode: "multiply" }}
    >
      <div
        className="flex flex-col items-center justify-center px-[5%] py-[1.8%] rounded-[6px]"
        style={{
          transform: "rotate(-34deg)",
          border: `3px solid ${corBordaRgba}`,
          outline: `1.2px solid ${corOutlineRgba}`,
          outlineOffset: "-6px",
          width: "76%",
        }}
      >
        <span
          style={{ color: corTextoRgba }}
          className="font-sans font-black tracking-[0.18em] text-[clamp(28px,8.6cqi,94px)] leading-none uppercase whitespace-nowrap pl-[0.18em]"
        >
          {tipo}
        </span>
        <span
          style={{ color: corTextoRgba }}
          className="mt-[0.8%] font-sans font-bold tracking-[0.13em] text-[clamp(7px,1.2cqi,14px)] uppercase text-center leading-tight truncate max-w-full"
        >
          {subtitulo}
        </span>
      </div>
    </div>
  );
}

export function DocumentoPedidoInterativo({
  pedido,
  paginaAtiva,
  onMudarPaginaAtiva,
  escalaZoom,
  anotacoesLegadas = [],
  marcacoes,
  salvandoMarcacoes,
  onSalvarMarcacoes,
  ferramentaExterna,
  onMudarFerramentaExterna,
}: {
  pedido: PedidoCertidaoDetalheDTO;
  paginaAtiva: 1 | 2;
  onMudarPaginaAtiva?: (novaPagina: 1 | 2) => void;
  /** "FitH" ajusta à largura do contêiner; número = percentual (100, 115, 130, 150, 175) */
  escalaZoom: "FitH" | number;
  anotacoesLegadas?: AnotacaoImpressaoPedido[];
  marcacoes: MarcacaoVisualDocumentoPedido[];
  salvandoMarcacoes?: boolean;
  onSalvarMarcacoes: (novasMarcacoes: MarcacaoVisualDocumentoPedido[]) => void;
  ferramentaExterna?: FerramentaDocumento;
  onMudarFerramentaExterna?: (f: FerramentaDocumento) => void;
}) {
  const [ferramentaInterna, setFerramentaInterna] =
    useState<FerramentaDocumento>("SELECIONAR");
  const ferramenta = ferramentaExterna ?? ferramentaInterna;
  const setFerramenta = (f: FerramentaDocumento) => {
    setFerramentaInterna(f);
    onMudarFerramentaExterna?.(f);
  };

  const [corGrifoAtiva, setCorGrifoAtiva] = useState<CorGrifoDocumento>("AMARELO");
  const [corTextoAtiva, setCorTextoAtiva] = useState<CorTextoDocumento>("AZUL_ESCURO");
  const [tamanhoFonteAtivo, setTamanhoFonteAtivo] = useState<number>(10);

  const folhaRef = useRef<HTMLDivElement | null>(null);
  const inputTextoEditorRef = useRef<HTMLTextAreaElement | null>(null);

  // Estado de arraste (desenho de retângulo para GRIFAR ou TEXTO)
  const [arrasteInicio, setArrasteInicio] = useState<{ xPt: number; yTopoPt: number } | null>(
    null
  );
  const [arrasteAtual, setArrasteAtual] = useState<RetanguloPt | null>(null);

  // Estado de movimentação livre de uma marcação já existente para qualquer parte da folha
  const [movendoMarcacao, setMovendoMarcacao] = useState<{
    id: string;
    offsetXPt: number;
    offsetYPt: number;
    xAtualPt: number;
    yAtualPt: number;
  } | null>(null);

  // Estado de movimentação livre do Card flutuante "Adicionar Texto no Documento"
  const [movendoCardEditor, setMovendoCardEditor] = useState<{
    inicioClientX: number;
    inicioClientY: number;
    xInicialPt: number;
    yInicialPt: number;
  } | null>(null);

  // Estado de redimensionamento (esticar na lateral e/ou altura) de uma marcação de TEXTO existente
  const [redimensionandoMarcacao, setRedimensionandoMarcacao] = useState<{
    id: string;
    eixo: "LATERAL" | "ALTURA" | "AMBOS";
    inicioClientX: number;
    inicioClientY: number;
    larguraInicialPt: number;
    alturaInicialPt: number;
    larguraAtualPt: number;
    alturaAtualPt: number;
  } | null>(null);

  // Seleção nativa de texto pelo mouse no modo SELECIONAR
  const [selecaoTextoNativo, setSelecaoTextoNativo] = useState<{
    rectPt: RetanguloPt;
    trecho: string;
  } | null>(null);

  // Editor flutuante para criar ou editar texto desejado na posição selecionada do documento (Frente ou Verso)
  const [editorTextoAberto, setEditorTextoAberto] = useState<{
    modo: "CRIAR" | "EDITAR";
    idExistente?: string;
    paginaAlvo: 1 | 2;
    rectPt: RetanguloPt;
    texto: string;
    corTexto: CorTextoDocumento;
    corGrifoOpcional: CorGrifoDocumento | null;
    tamanhoFontePt: number;
    trechoSelecionado: string | null;
    mostrarEmoticons: boolean;
    larguraCardPx: number;
    alturaTextareaPx: number;
    redimensionadoManualmente: boolean;
  } | null>(null);

  // Arraste das bordas do Card "Adicionar Texto no Documento" (lateral, altura ou canto)
  const [redimensionandoCardEditor, setRedimensionandoCardEditor] = useState<{
    eixo: "LATERAL" | "ALTURA" | "AMBOS";
    inicioClientX: number;
    inicioClientY: number;
    larguraInicialPx: number;
    alturaInicialPx: number;
  } | null>(null);

  // Marcação clicada/selecionada para ações rápidas (mudar cor, editar ou excluir)
  const [marcacaoSelecionadaId, setMarcacaoSelecionadaId] = useState<string | null>(null);

  const marcacoesDaPagina = useMemo(
    () => marcacoes.filter((m) => (m.pagina || 1) === paginaAtiva),
    [marcacoes, paginaAtiva]
  );

  const converterClientParaPt = useCallback(
    (clientX: number, clientY: number): { xPt: number; yTopoPt: number } | null => {
      const el = folhaRef.current;
      if (!el) return null;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return null;
      const xPt = ((clientX - box.left) / box.width) * LARGURA_PAGINA_SIPLAN_PT;
      const yTopoPt = ((clientY - box.top) / box.height) * ALTURA_PAGINA_SIPLAN_PT;
      return {
        xPt: Math.max(6, Math.min(LARGURA_PAGINA_SIPLAN_PT - 6, xPt)),
        yTopoPt: Math.max(6, Math.min(ALTURA_PAGINA_SIPLAN_PT - 6, yTopoPt)),
      };
    },
    []
  );

  const abrirEditorNovoTexto = (
    rectPt: RetanguloPt,
    trechoSelecionado: string | null = null,
    comGrifoInicial: CorGrifoDocumento | null = null
  ) => {
    setSelecaoTextoNativo(null);
    setEditorTextoAberto({
      modo: "CRIAR",
      paginaAlvo: paginaAtiva,
      rectPt,
      texto: "",
      corTexto: corTextoAtiva,
      corGrifoOpcional: comGrifoInicial,
      tamanhoFontePt: tamanhoFonteAtivo,
      trechoSelecionado,
      mostrarEmoticons: false,
      larguraCardPx: 380,
      alturaTextareaPx: 92,
      redimensionadoManualmente: false,
    });
    setTimeout(() => inputTextoEditorRef.current?.focus(), 20);
  };

  const alternarFolhaEditorTexto = (novaFolha: 1 | 2) => {
    setEditorTextoAberto((prev) => (prev ? { ...prev, paginaAlvo: novaFolha } : null));
    onMudarPaginaAtiva?.(novaFolha);
  };

  const moverMarcacaoParaOutraFolha = (id: string, novaFolha: 1 | 2) => {
    setMarcacaoSelecionadaId(id);
    onSalvarMarcacoes(
      marcacoes.map((m) => (m.id === id ? { ...m, pagina: novaFolha } : m))
    );
    onMudarPaginaAtiva?.(novaFolha);
  };

  // Listeners globais para mover e esticar na lateral/altura o Card Editor ou uma Marcação de Texto salva
  useEffect(() => {
    if (
      !redimensionandoCardEditor &&
      !redimensionandoMarcacao &&
      !movendoCardEditor &&
      !movendoMarcacao
    ) {
      return;
    }

    const onMove = (ev: MouseEvent) => {
      if (movendoCardEditor && folhaRef.current) {
        const box = folhaRef.current.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) {
          const dxPt =
            ((ev.clientX - movendoCardEditor.inicioClientX) / box.width) *
            LARGURA_PAGINA_SIPLAN_PT;
          const dyPt =
            ((ev.clientY - movendoCardEditor.inicioClientY) / box.height) *
            ALTURA_PAGINA_SIPLAN_PT;
          const novoXPt = Math.max(
            4,
            Math.min(
              LARGURA_PAGINA_SIPLAN_PT - 30,
              Math.round((movendoCardEditor.xInicialPt + dxPt) * 10) / 10
            )
          );
          const novoYPt = Math.max(
            4,
            Math.min(
              ALTURA_PAGINA_SIPLAN_PT - 24,
              Math.round((movendoCardEditor.yInicialPt + dyPt) * 10) / 10
            )
          );
          setEditorTextoAberto((prev) =>
            prev
              ? {
                ...prev,
                rectPt: {
                  ...prev.rectPt,
                  xPt: novoXPt,
                  yTopoPt: novoYPt,
                },
              }
              : null
          );
        }
      }

      if (movendoMarcacao && folhaRef.current) {
        const pt = converterClientParaPt(ev.clientX, ev.clientY);
        if (pt) {
          const novoX = Math.max(
            4,
            Math.min(
              LARGURA_PAGINA_SIPLAN_PT - 24,
              Math.round((pt.xPt - movendoMarcacao.offsetXPt) * 10) / 10
            )
          );
          const novoY = Math.max(
            4,
            Math.min(
              ALTURA_PAGINA_SIPLAN_PT - 18,
              Math.round((pt.yTopoPt - movendoMarcacao.offsetYPt) * 10) / 10
            )
          );
          setMovendoMarcacao((prev) =>
            prev ? { ...prev, xAtualPt: novoX, yAtualPt: novoY } : null
          );
        }
      }

      if (redimensionandoCardEditor) {
        const dx = ev.clientX - redimensionandoCardEditor.inicioClientX;
        const dy = ev.clientY - redimensionandoCardEditor.inicioClientY;
        setEditorTextoAberto((prev) => {
          if (!prev) return prev;
          const novaLargura =
            redimensionandoCardEditor.eixo === "LATERAL" ||
              redimensionandoCardEditor.eixo === "AMBOS"
              ? Math.max(280, Math.min(920, redimensionandoCardEditor.larguraInicialPx + dx))
              : prev.larguraCardPx;
          const novaAltura =
            redimensionandoCardEditor.eixo === "ALTURA" ||
              redimensionandoCardEditor.eixo === "AMBOS"
              ? Math.max(64, Math.min(540, redimensionandoCardEditor.alturaInicialPx + dy))
              : prev.alturaTextareaPx;
          return {
            ...prev,
            larguraCardPx: Math.round(novaLargura),
            alturaTextareaPx: Math.round(novaAltura),
            redimensionadoManualmente: true,
          };
        });
      }

      if (redimensionandoMarcacao && folhaRef.current) {
        const box = folhaRef.current.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return;
        const dxPt =
          ((ev.clientX - redimensionandoMarcacao.inicioClientX) / box.width) *
          LARGURA_PAGINA_SIPLAN_PT;
        const dyPt =
          ((ev.clientY - redimensionandoMarcacao.inicioClientY) / box.height) *
          ALTURA_PAGINA_SIPLAN_PT;

        const novaLarguraPt =
          redimensionandoMarcacao.eixo === "LATERAL" ||
            redimensionandoMarcacao.eixo === "AMBOS"
            ? Math.max(
              45,
              Math.min(
                LARGURA_PAGINA_SIPLAN_PT - 20,
                Math.round((redimensionandoMarcacao.larguraInicialPt + dxPt) * 10) / 10
              )
            )
            : redimensionandoMarcacao.larguraInicialPt;

        const novaAlturaPt =
          redimensionandoMarcacao.eixo === "ALTURA" ||
            redimensionandoMarcacao.eixo === "AMBOS"
            ? Math.max(
              16,
              Math.min(
                ALTURA_PAGINA_SIPLAN_PT - 20,
                Math.round((redimensionandoMarcacao.alturaInicialPt + dyPt) * 10) / 10
              )
            )
            : redimensionandoMarcacao.alturaInicialPt;

        setRedimensionandoMarcacao((prev) =>
          prev
            ? {
              ...prev,
              larguraAtualPt: novaLarguraPt,
              alturaAtualPt: novaAlturaPt,
            }
            : null
        );
      }
    };

    const onUp = () => {
      if (movendoCardEditor) {
        setMovendoCardEditor(null);
      }
      if (movendoMarcacao) {
        const { id, xAtualPt, yAtualPt } = movendoMarcacao;
        setMovendoMarcacao(null);
        onSalvarMarcacoes(
          marcacoes.map((m) =>
            m.id === id
              ? {
                ...m,
                xPt: xAtualPt,
                yTopoPt: yAtualPt,
              }
              : m
          )
        );
      }
      if (redimensionandoCardEditor) {
        setRedimensionandoCardEditor(null);
      }
      if (redimensionandoMarcacao) {
        const { id, larguraAtualPt, alturaAtualPt } = redimensionandoMarcacao;
        setRedimensionandoMarcacao(null);
        onSalvarMarcacoes(
          marcacoes.map((m) =>
            m.id === id
              ? {
                ...m,
                larguraPt: larguraAtualPt,
                alturaPt: alturaAtualPt,
              }
              : m
          )
        );
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    redimensionandoCardEditor,
    redimensionandoMarcacao,
    movendoCardEditor,
    movendoMarcacao,
    converterClientParaPt,
    marcacoes,
    onSalvarMarcacoes,
  ]);

  const handleMouseDownFolha = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (editorTextoAberto) return;

    // Se clicou sobre um controle interativo existente, não inicia novo retângulo
    if ((e.target as HTMLElement).closest("[data-marcacao-interativa='true']")) {
      return;
    }

    setMarcacaoSelecionadaId(null);

    if (ferramenta === "SELECIONAR") {
      setSelecaoTextoNativo(null);
      return;
    }

    const pt = converterClientParaPt(e.clientX, e.clientY);
    if (!pt) return;
    e.preventDefault();
    setSelecaoTextoNativo(null);
    setArrasteInicio(pt);
    setArrasteAtual({
      xPt: pt.xPt,
      yTopoPt: pt.yTopoPt,
      larguraPt: 2,
      alturaPt: 2,
    });
  };

  const handleMouseMoveFolha = (e: React.MouseEvent<HTMLDivElement>) => {
    if (movendoMarcacao || movendoCardEditor) {
      return;
    }

    if (!arrasteInicio) return;
    const pt = converterClientParaPt(e.clientX, e.clientY);
    if (!pt) return;

    const xMin = Math.min(arrasteInicio.xPt, pt.xPt);
    const yMin = Math.min(arrasteInicio.yTopoPt, pt.yTopoPt);
    const larguraPt = Math.max(4, Math.abs(pt.xPt - arrasteInicio.xPt));
    const alturaPt = Math.max(4, Math.abs(pt.yTopoPt - arrasteInicio.yTopoPt));

    setArrasteAtual({
      xPt: xMin,
      yTopoPt: yMin,
      larguraPt,
      alturaPt,
    });
  };

  const handleMouseUpFolha = (_e: React.MouseEvent<HTMLDivElement>) => {
    if (movendoMarcacao || movendoCardEditor) {
      return;
    }

    if (ferramenta === "SELECIONAR") {
      // Verifica se o Escrevente selecionou algum trecho de texto nativamente no documento
      const sel = window.getSelection();
      const textoSel = sel?.toString().trim() || "";
      if (sel && textoSel && sel.rangeCount > 0 && folhaRef.current) {
        const range = sel.getRangeAt(0);
        if (folhaRef.current.contains(range.commonAncestorContainer)) {
          const r = range.getBoundingClientRect();
          const box = folhaRef.current.getBoundingClientRect();
          if (r.width > 2 && box.width > 0) {
            const xPt = ((r.left - box.left) / box.width) * LARGURA_PAGINA_SIPLAN_PT;
            const yTopoPt = ((r.top - box.top) / box.height) * ALTURA_PAGINA_SIPLAN_PT;
            const larguraPt = (r.width / box.width) * LARGURA_PAGINA_SIPLAN_PT;
            const alturaPt = Math.max(
              12,
              (r.height / box.height) * ALTURA_PAGINA_SIPLAN_PT
            );
            setSelecaoTextoNativo({
              rectPt: {
                xPt: Math.round(xPt * 10) / 10,
                yTopoPt: Math.round(yTopoPt * 10) / 10,
                larguraPt: Math.round(larguraPt * 10) / 10,
                alturaPt: Math.round(alturaPt * 10) / 10,
              },
              trecho: textoSel,
            });
          }
        }
      }
      return;
    }

    if (!arrasteInicio || !arrasteAtual) return;
    const rectFinal = arrasteAtual;
    setArrasteInicio(null);
    setArrasteAtual(null);

    if (ferramenta === "GRIFAR") {
      // Se foi só um clique rápido ou arraste curto, cria grifo padrão sobre a linha; se arrastou, usa a caixa exata
      const larguraFinal = rectFinal.larguraPt < 14 ? 130 : rectFinal.larguraPt;
      const alturaFinal = rectFinal.alturaPt < 8 ? 14 : rectFinal.alturaPt;
      const nova: MarcacaoVisualDocumentoPedido = {
        id: `grifo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pagina: paginaAtiva,
        tipo: "GRIFO",
        xPt: Math.round(rectFinal.xPt * 10) / 10,
        yTopoPt: Math.round(rectFinal.yTopoPt * 10) / 10,
        larguraPt: Math.round(larguraFinal * 10) / 10,
        alturaPt: Math.round(alturaFinal * 10) / 10,
        corGrifo: corGrifoAtiva,
        autorNome: "Escrevente",
        criadoEmBr: new Date().toLocaleString("pt-BR"),
      };
      onSalvarMarcacoes([...marcacoes, nova]);
      return;
    }

    if (ferramenta === "TEXTO") {
      const selecionouArea = rectFinal.larguraPt >= 18 && rectFinal.alturaPt >= 10;
      abrirEditorNovoTexto(
        {
          xPt: Math.round(rectFinal.xPt * 10) / 10,
          yTopoPt: Math.round(rectFinal.yTopoPt * 10) / 10,
          larguraPt: selecionouArea ? Math.round(rectFinal.larguraPt * 10) / 10 : 190,
          alturaPt: selecionouArea ? Math.round(rectFinal.alturaPt * 10) / 10 : 18,
        },
        null,
        selecionouArea ? corGrifoAtiva : null
      );
    }
  };

  const grifarTrechoNativoSelecionado = (cor: CorGrifoDocumento) => {
    if (!selecaoTextoNativo) return;
    const nova: MarcacaoVisualDocumentoPedido = {
      id: `grifo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pagina: paginaAtiva,
      tipo: "GRIFO",
      xPt: selecaoTextoNativo.rectPt.xPt,
      yTopoPt: selecaoTextoNativo.rectPt.yTopoPt,
      larguraPt: selecaoTextoNativo.rectPt.larguraPt,
      alturaPt: selecaoTextoNativo.rectPt.alturaPt,
      corGrifo: cor,
      trechoSelecionado: selecaoTextoNativo.trecho,
      autorNome: "Escrevente",
      criadoEmBr: new Date().toLocaleString("pt-BR"),
    };
    setCorGrifoAtiva(cor);
    setSelecaoTextoNativo(null);
    window.getSelection()?.removeAllRanges();
    onSalvarMarcacoes([...marcacoes, nova]);
  };

  const confirmarEditorTexto = () => {
    if (!editorTextoAberto) return;
    const limpo = editorTextoAberto.texto.trim();
    if (!limpo) {
      setEditorTextoAberto(null);
      return;
    }

    let larguraSalvaPt = editorTextoAberto.rectPt.larguraPt;
    let alturaSalvaPt = editorTextoAberto.rectPt.alturaPt;
    if (editorTextoAberto.redimensionadoManualmente && folhaRef.current) {
      const box = folhaRef.current.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        larguraSalvaPt = Math.max(
          60,
          Math.min(
            LARGURA_PAGINA_SIPLAN_PT - editorTextoAberto.rectPt.xPt - 10,
            Math.round(((editorTextoAberto.larguraCardPx - 24) / box.width) * LARGURA_PAGINA_SIPLAN_PT * 10) / 10
          )
        );
        alturaSalvaPt = Math.max(
          18,
          Math.min(
            ALTURA_PAGINA_SIPLAN_PT - editorTextoAberto.rectPt.yTopoPt - 10,
            Math.round((editorTextoAberto.alturaTextareaPx / box.height) * ALTURA_PAGINA_SIPLAN_PT * 10) / 10
          )
        );
      }
    }

    if (editorTextoAberto.modo === "EDITAR" && editorTextoAberto.idExistente) {
      const atualizadas = marcacoes.map((m) =>
        m.id === editorTextoAberto.idExistente
          ? {
            ...m,
            pagina: editorTextoAberto.paginaAlvo,
            xPt: editorTextoAberto.rectPt.xPt,
            yTopoPt: editorTextoAberto.rectPt.yTopoPt,
            texto: limpo,
            corTexto: editorTextoAberto.corTexto,
            corGrifo: editorTextoAberto.corGrifoOpcional ?? undefined,
            tamanhoFontePt: editorTextoAberto.tamanhoFontePt,
            larguraPt: editorTextoAberto.redimensionadoManualmente ? larguraSalvaPt : m.larguraPt,
            alturaPt: editorTextoAberto.redimensionadoManualmente ? alturaSalvaPt : m.alturaPt,
          }
          : m
      );
      onSalvarMarcacoes(atualizadas);
      if (editorTextoAberto.paginaAlvo !== paginaAtiva) {
        onMudarPaginaAtiva?.(editorTextoAberto.paginaAlvo);
      }
    } else {
      const nova: MarcacaoVisualDocumentoPedido = {
        id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pagina: editorTextoAberto.paginaAlvo,
        tipo: "TEXTO",
        xPt: editorTextoAberto.rectPt.xPt,
        yTopoPt: editorTextoAberto.rectPt.yTopoPt,
        larguraPt: larguraSalvaPt,
        alturaPt: alturaSalvaPt,
        corGrifo: editorTextoAberto.corGrifoOpcional ?? undefined,
        texto: limpo,
        corTexto: editorTextoAberto.corTexto,
        tamanhoFontePt: editorTextoAberto.tamanhoFontePt,
        trechoSelecionado: editorTextoAberto.trechoSelecionado,
        autorNome: "Escrevente",
        criadoEmBr: new Date().toLocaleString("pt-BR"),
      };
      onSalvarMarcacoes([...marcacoes, nova]);
      if (editorTextoAberto.paginaAlvo !== paginaAtiva) {
        onMudarPaginaAtiva?.(editorTextoAberto.paginaAlvo);
      }
    }

    setCorTextoAtiva(editorTextoAberto.corTexto);
    setTamanhoFonteAtivo(editorTextoAberto.tamanhoFontePt);
    setEditorTextoAberto(null);
  };

  const excluirMarcacao = (id: string) => {
    setMarcacaoSelecionadaId(null);
    onSalvarMarcacoes(marcacoes.filter((m) => m.id !== id));
  };

  const alterarCorGrifoExistente = (id: string, novaCor: CorGrifoDocumento) => {
    onSalvarMarcacoes(
      marcacoes.map((m) => (m.id === id ? { ...m, corGrifo: novaCor } : m))
    );
  };

  const desfazerUltimaMarcacaoPagina = () => {
    const daPag = marcacoes.filter((m) => (m.pagina || 1) === paginaAtiva);
    if (daPag.length === 0) return;
    const ultimaId = daPag[daPag.length - 1].id;
    onSalvarMarcacoes(marcacoes.filter((m) => m.id !== ultimaId));
  };

  const inserirEmoticonNoEditor = (emoji: string) => {
    if (!editorTextoAberto) return;
    const el = inputTextoEditorRef.current;
    if (!el) {
      setEditorTextoAberto({
        ...editorTextoAberto,
        texto: `${editorTextoAberto.texto}${emoji}`,
      });
      return;
    }
    const ini = el.selectionStart ?? editorTextoAberto.texto.length;
    const fim = el.selectionEnd ?? editorTextoAberto.texto.length;
    const proximo =
      editorTextoAberto.texto.slice(0, ini) +
      emoji +
      editorTextoAberto.texto.slice(fim);
    setEditorTextoAberto({ ...editorTextoAberto, texto: proximo });
    requestAnimationFrame(() => {
      el.focus();
      const pos = ini + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Dados estruturados fiéis ao SIPLAN para renderização da Folha 595 x 842
  const reqDoc =
    pedido.requerente.documentoFormatado ||
    pedido.requerente.documentoMascarado ||
    "Não informado";
  const apresNome = pedido.apresentante?.nome || pedido.requerente.nome;
  const apresDoc =
    pedido.apresentante?.documentoFormatado ||
    pedido.apresentante?.documentoMascarado ||
    reqDoc;
  const destNome = pedido.destinatarioNota?.nome || apresNome;
  const destDoc =
    pedido.destinatarioNota?.documentoFormatado ||
    pedido.destinatarioNota?.documentoMascarado ||
    apresDoc;
  const prenotacoesContraditorio = useMemo(
    () => obterPrenotacoesContraditorioDoPedido(pedido),
    [pedido]
  );

  const larguraCssFolha =
    escalaZoom === "FitH"
      ? "100%"
      : `${Math.round((595 * escalaZoom) / 100)}px`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Barra de Ferramentas de Marcação Direta no Documento (Centralizada) */}
      <div className="px-3 py-2 bg-[#0B1222] border-b border-white/10 flex flex-wrap items-center justify-center gap-3 text-xs shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex rounded-xl border border-white/15 bg-[#060A14] p-0.5">
            <button
              type="button"
              onClick={() => setFerramenta("SELECIONAR")}
              className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${ferramenta === "SELECIONAR"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-300 hover:text-white"
                }`}
              title="Selecionar texto do documento ou clicar em marcações existentes"
            >
              <MousePointer className="w-3.5 h-3.5" />
              Selecionar Trecho
            </button>

            <button
              type="button"
              onClick={() => setFerramenta("GRIFAR")}
              className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${ferramenta === "GRIFAR"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-300 hover:text-white"
                }`}
              title="Arraste sobre o documento para grifar com a cor escolhida"
            >
              <Highlighter className="w-3.5 h-3.5" />
              Grifar Documento
            </button>

            <button
              type="button"
              onClick={() => setFerramenta("TEXTO")}
              className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${ferramenta === "TEXTO"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:text-white"
                }`}
              title="Selecione uma área ou clique no documento para adicionar o texto desejado"
            >
              <Type className="w-3.5 h-3.5" />
              + Adicionar Texto
            </button>
          </div>

          {/* Paleta de Cores do Marca-Texto (Grifo) */}
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl border border-white/12 bg-[#060A14]">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-0.5">
              Grifo:
            </span>
            {OPCOES_CORES_GRIFO.map((c) => {
              const ativa = corGrifoAtiva === c.codigo;
              return (
                <button
                  key={c.codigo}
                  type="button"
                  onClick={() => {
                    setCorGrifoAtiva(c.codigo);
                    if (ferramenta === "SELECIONAR") setFerramenta("GRIFAR");
                  }}
                  title={`Grifar em ${c.rotulo}`}
                  className={`w-5 h-5 rounded-full transition cursor-pointer ${ativa
                      ? "ring-2 ring-white scale-110"
                      : "opacity-80 hover:opacity-100"
                    }`}
                  style={{ backgroundColor: c.swatchHex }}
                />
              );
            })}
          </div>

          {/* Paleta rápida de Cor do Texto quando em modo TEXTO */}
          {ferramenta === "TEXTO" && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl border border-indigo-500/30 bg-indigo-950/30">
              <span className="text-[10px] font-bold uppercase text-indigo-200 mr-0.5">
                Cor Texto:
              </span>
              {OPCOES_CORES_TEXTO.map((ct) => (
                <button
                  key={ct.codigo}
                  type="button"
                  onClick={() => setCorTextoAtiva(ct.codigo)}
                  title={ct.rotulo}
                  className={`w-4 h-4 rounded-full cursor-pointer ${corTextoAtiva === ct.codigo ? "ring-2 ring-white scale-110" : "opacity-80"
                    }`}
                  style={{ backgroundColor: ct.hex }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {ferramenta === "GRIFAR"
              ? "Arraste o mouse sobre qualquer parte do documento para grifar"
              : ferramenta === "TEXTO"
                ? "Selecione uma parte do documento ou clique onde deseja escrever"
                : "Selecione qualquer texto para grifar/anotar ou clique em uma marcação"}
          </span>

          {marcacoesDaPagina.length > 0 && (
            <button
              type="button"
              onClick={desfazerUltimaMarcacaoPagina}
              className="px-2.5 py-1 rounded-lg border border-white/15 bg-[#060A14] hover:bg-white/10 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              title="Desfazer última marcação desta página"
            >
              <Undo2 className="w-3 h-3 text-amber-300" />
              Desfazer ({marcacoesDaPagina.length})
            </button>
          )}

          {salvandoMarcacoes && (
            <span className="text-[10px] font-mono text-cyan-300">Salvando...</span>
          )}
        </div>
      </div>

      {/* Área Rolável da Folha Oficial 595 x 842 pt aproveitando 100% da largura disponível */}
      <div className="flex-1 overflow-auto bg-[#151C2C] p-2 sm:p-2.5 flex justify-center items-start">
        <div
          ref={folhaRef}
          onMouseDown={handleMouseDownFolha}
          onMouseMove={handleMouseMoveFolha}
          onMouseUp={handleMouseUpFolha}
          style={{
            width: larguraCssFolha,
            aspectRatio: `${LARGURA_PAGINA_SIPLAN_PT} / ${ALTURA_PAGINA_SIPLAN_PT}`,
            containerType: "inline-size",
          }}
          className={`relative bg-white text-[#111827] shadow-[0_18px_50px_rgba(0,0,0,0.55)] border border-slate-300 shrink-0 ${ferramenta === "GRIFAR"
              ? "cursor-crosshair select-none"
              : ferramenta === "TEXTO"
                ? "cursor-text select-none"
                : "cursor-auto"
            }`}
        >
          {/* Marca d'água elegante na diagonal quando o Pedido foi CONFERIDO (verde) ou DEVOLVIDO (vermelho/rosa) */}
          {pedido.conferidoPeloEscrevente && (
            <MarcaDaguaStatusDiagonal
              tipo="CONFERIDO"
              operadorNome={pedido.conferidoPorNome}
              dataHoraBr={pedido.conferidoEmBr}
            />
          )}
          {!pedido.conferidoPeloEscrevente && pedido.devolvidoPeloEscrevente && (
            <MarcaDaguaStatusDiagonal
              tipo="DEVOLVIDO"
              operadorNome={pedido.devolvidoPorNome}
              dataHoraBr={pedido.devolvidoEmBr}
            />
          )}

          {/* Conteúdo Oficial SIPLAN proporcional 595 x 842 */}
          <div className="w-full h-full px-[5.7%] py-[3.3%] flex flex-col justify-between font-sans text-[clamp(9px,1.51cqi,23px)] leading-snug">
            {paginaAtiva === 1 ? (
              <div className="space-y-[1.4%]">
                {/* Cabeçalho Oficial 7º RI-SP + Código de Barras Code 39 */}
                <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-900">
                  <img
                    src={`data:image/png;base64,${SIPLAN_7RI_HEADER_PNG_BASE64}`}
                    alt="7º Registro de Imóveis de São Paulo - SP"
                    className="w-[58%] h-auto object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                  <div className="flex flex-col items-end pt-0.5">
                    <BarcodeCode39Svg valor={pedido.numeroPedido} />
                    {pedido.protocoloExterno && (
                      <div className="text-[1.64em] font-black text-[#1E3F73] mt-1 leading-none tracking-tight">
                        {pedido.protocoloExterno}
                      </div>
                    )}
                  </div>
                </div>

                {/* Faixa PEDIDO DE CERTIDÃO — Número do Pedido com o dobro do tamanho */}
                <div className="bg-[#EFF2F7] border border-[#BFC7D1] py-1.5 px-3 text-center font-black tracking-tight text-[#0D0E14] flex flex-wrap items-baseline justify-center gap-2 leading-none">
                  <span className="text-[1.45em] font-extrabold">
                    PEDIDO DE CERTIDÃO Nº
                  </span>
                  <span className="text-[2.24em] font-black tracking-tight">
                    {pedido.numeroPedido}
                  </span>
                </div>

                {/* Bloco 1: Entrada, Previsão e Origem */}
                <div className="border border-[#B8BFCC] px-2.5 py-1.5 space-y-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[#14141A]">
                    <span>
                      Data de Entrada: {pedido.dataPedidoBr} &nbsp; Hora:{" "}
                      {pedido.horaPedidoBr}
                    </span>
                    <span>
                      Previsão de Entrega:{" "}
                      {pedido.prazoPrevistoBr || "Conforme prazo legal"}
                    </span>
                  </div>
                  <div className="text-[0.94em] text-[#2E2E38]">
                    Origem: {pedido.origem} ({pedido.canalRecebimento}) &nbsp; Forma de
                    Entrega: {pedido.formaEntregaExibicao}
                  </div>
                </div>

                {/* Bloco 2: Solicitante / Requerente */}
                <div className="border border-[#B8BFCC] px-2.5 py-1.5 space-y-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-[#101014]">
                      Solicitante: {pedido.requerente.nome}
                    </span>
                    <span className="text-[#1F1F26]">
                      {pedido.requerente.tipoDocumento === "CNPJ" ? "CNPJ" : "CPF/CNPJ"}:{" "}
                      {reqDoc}
                    </span>
                  </div>
                  <div className="text-[0.94em] text-[#33333D]">
                    E-mail: {pedido.requerente.email || "—"} &nbsp;|&nbsp; Fone:{" "}
                    {pedido.requerente.telefone || "—"}
                  </div>
                </div>

                {/* Tabela de Itens Solicitados */}
                <div className="border border-[#AEB8C7]">
                  <div className="grid grid-cols-12 bg-[#E8EDF5] border-b border-[#AEB8C7] px-2 py-1 font-bold text-[0.9em]">
                    <div className="col-span-1">Item</div>
                    <div className="col-span-5">Espécie / Natureza da Certidão</div>
                    <div className="col-span-4">Identificação (Matrícula / Critério)</div>
                    <div className="col-span-2">Entrega / Previsão</div>
                  </div>
                  {(pedido.itens.length > 0
                    ? pedido.itens
                    : [
                      {
                        id: "item-padrao",
                        sequenciaItem: 1,
                        naturezaDescricao: pedido.especieSolicitada,
                        livroDescricao: "Livro 2 - Registro Geral",
                        numeroMatricula: null,
                        enderecoPesquisa: null,
                        transcricaoOuLoteamento: null,
                        meioEntregaCodigo: "M",
                        dataPrevisaoBr: pedido.prazoPrevistoBr,
                      },
                    ]
                  ).map((item) => {
                    const identFallback = item.enderecoPesquisa
                      ? `Endereço: ${item.enderecoPesquisa}`
                      : item.transcricaoOuLoteamento
                        ? `Transcrição/Loteamento: ${item.transcricaoOuLoteamento}`
                        : `Critério: ${pedido.criterioSolicitacao}`;
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 px-2 py-1.5 text-[0.94em] border-b last:border-b-0 border-[#D1D6E0]"
                      >
                        <div className="col-span-1 font-bold">
                          {String(item.sequenciaItem).padStart(2, "0")}
                        </div>
                        <div className="col-span-5 pr-2">{item.naturezaDescricao}</div>
                        <div className="col-span-4 font-bold pr-2">
                          {item.numeroMatricula ? (
                            <>
                              Matrícula nº{" "}
                              <LinkMatriculaLv2
                                numeroMatricula={item.numeroMatricula}
                                variante="papel"
                              />{" "}
                              ({item.livroDescricao || "Livro 2 - Registro Geral"})
                            </>
                          ) : (
                            renderizarTextoComLinksMatriculaLv2(identFallback, "papel")
                          )}
                        </div>
                        <div className="col-span-2 text-[0.92em]">
                          {item.meioEntregaCodigo || "M"} -{" "}
                          {item.dataPrevisaoBr || pedido.prazoPrevistoBr || "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bloco Contraditório: Número da Prenotação em Contraditório (quando houver) */}
                {prenotacoesContraditorio.length > 0 && (
                  <div className="border-2 border-[#B45309] bg-[#FFFBEB] px-2.5 py-1.5 space-y-0.5 text-[0.92em]">
                    <div className="font-black text-[#78350F] flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex flex-wrap items-baseline gap-1.5">
                        <span>PRENOTAÇÃO EM CONTRADITÓRIO Nº</span>
                        {prenotacoesContraditorio.map((pr, idxH) => (
                          <React.Fragment key={`h-${pr.numeroPrenotacao}-${idxH}`}>
                            {idxH > 0 && <span>/</span>}
                            <LinkPrenotacaoWebri
                              numeroPrenotacao={pr.numeroPrenotacao}
                              variante="papel"
                            />
                          </React.Fragment>
                        ))}
                      </span>
                      <span className="text-[0.78em] font-mono text-[#92400E]">
                        Fonte SQL: tblWRIRecepcao • tblWRITitulos •
                        tblWRICertidaoResultadoContraditorio • tblWRITipoPrenotacao •
                        tblWRITitulosReal • tblWRIReal • tblWRIImovelBase • tblWRIImovel
                      </span>
                    </div>
                    {prenotacoesContraditorio.map((pr, idxP) => (
                      <div
                        key={`${pr.numeroPrenotacao}-${idxP}`}
                        className="text-[#1F2937] font-semibold"
                      >
                        Prenotação nº{" "}
                        <LinkPrenotacaoWebri
                          numeroPrenotacao={pr.numeroPrenotacao}
                          variante="papel"
                        />{" "}
                        • Tipo:{" "}
                        <strong>{pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"}</strong> •
                        Natureza: <strong>{pr.naturezaTitulo}</strong>
                        {pr.livroContraditorio ? (
                          <>
                            {" "}
                            • Livro:{" "}
                            {renderizarTextoComLinksMatriculaLv2(
                              pr.livroContraditorio,
                              "papel"
                            )}
                          </>
                        ) : null}
                        {pr.protocoloMagnetico ? ` • Protocolo: ${pr.protocoloMagnetico}` : ""}{" "}
                        • Entrada: {pr.dataApresentacaoBr} ({pr.etapaAtual})
                      </div>
                    ))}
                  </div>
                )}

                {/* Bloco 3: Dados para Emissão de RPS / Nota Fiscal */}
                <div className="border border-[#B8BFCC] px-2.5 py-1.5 space-y-0.5 text-[0.92em]">
                  <div className="font-bold text-[#26334D] text-[0.94em]">
                    DADOS PARA EMISSÃO DE RPS / NOTA FISCAL
                  </div>
                  <div>
                    Apresentante: {apresNome} ({apresDoc})
                  </div>
                  <div className="font-bold">
                    Destinatário da Nota (RPS): {destNome} ({destDoc})
                  </div>
                </div>

                {/* Bloco 4: Observações */}
                <div className="border border-[#C7CCD6] px-2.5 py-1 text-[0.9em]">
                  {pedido.observacoesOrigem ? (
                    <>
                      Observações:{" "}
                      {renderizarTextoComLinksMatriculaLv2(
                        pedido.observacoesOrigem,
                        "papel"
                      )}
                    </>
                  ) : (
                    "Observações: Sem ressalvas adicionais no ato do protocolo."
                  )}
                </div>

                {/* Bloco 5: LGPD CNJ 134/2022 */}
                <div className="bg-[#F7F7FA] border border-[#CCCEDB] px-2.5 py-1 text-[0.8em] text-[#40404D] leading-tight">
                  AVISO DE PRIVACIDADE (Provimento CNJ nº 134/2022 e Lei nº 13.709/2018 -
                  LGPD): Os dados pessoais coletados neste pedido destinam-se
                  exclusivamente à prática dos atos registrais, emissão de certidões,
                  controle fiscal (RPS) e cumprimento das normas da Corregedoria Geral da
                  Justiça de São Paulo e do CNJ.
                </div>

                {/* Bloco 6: Escrevente / Assinatura + Quadro de Valores */}
                <div className="grid grid-cols-12 gap-2.5 pt-1">
                  <div className="col-span-7 border border-[#B8BFCC] p-2.5 flex flex-col justify-between min-h-[72px]">
                    <div className="font-bold text-[0.92em]">
                      Escrevente / Recepção: {pedido.escreventeRecepcao}
                    </div>
                    <div className="pt-5 text-center">
                      <div className="border-t border-slate-500 mx-6 pt-0.5 text-[0.82em] text-slate-600">
                        Assinatura do Apresentante / Solicitante
                      </div>
                    </div>
                  </div>
                  <div className="col-span-5 bg-[#F2F5FA] border border-[#A6B2C2] p-2.5 flex flex-col justify-between text-[0.92em]">
                    <div className="flex justify-between">
                      <span>Valor Serviço:</span>
                      <span>{formatarMoedaBrl(pedido.valores.valorServico)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Despesas / Remessa:</span>
                      <span>{formatarMoedaBrl(pedido.valores.valorDespesa)}</span>
                    </div>
                    <div className="border-t border-[#8C94A3] pt-1 mt-1 flex justify-between font-extrabold">
                      <span>Total Depósito:</span>
                      <span>{formatarMoedaBrl(pedido.valores.totalDeposito)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PÁGINA 2: FICHA OPERACIONAL DE CONFERÊNCIA E CONTRADITÓRIO */
              <div className="space-y-[1.6%] flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-900">
                  <img
                    src={`data:image/png;base64,${SIPLAN_7RI_HEADER_PNG_BASE64}`}
                    alt="7º Registro de Imóveis de São Paulo - SP"
                    className="w-[58%] h-auto object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                  <div className="flex flex-col items-end pt-0.5">
                    <BarcodeCode39Svg valor={pedido.numeroPedido} />
                    {pedido.protocoloExterno && (
                      <div className="text-[1.64em] font-black text-[#1E3F73] mt-1 leading-none tracking-tight">
                        {pedido.protocoloExterno}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#EFF2F7] border border-[#BFC7D1] py-1.5 px-3 text-center font-black tracking-tight text-[#0D0E14] flex flex-wrap items-baseline justify-center gap-2 leading-none">
                  <span className="text-[1.45em] font-extrabold">
                    PEDIDO DE CERTIDÃO Nº
                  </span>
                  <span className="text-[2.24em] font-black tracking-tight">
                    {pedido.numeroPedido}
                  </span>
                </div>

                <div className="border border-[#B3BDCC] px-2.5 py-2 space-y-0.5 text-[0.94em]">
                  <div className="font-bold">
                    Situação Operacional no FIORIX: {pedido.estadoOperacionalLabel} &nbsp;|&nbsp;
                    Prioridade: {pedido.prioridade}
                  </div>
                  <div>
                    Subtipo Confirmado:{" "}
                    {pedido.subtipoConfirmado || "Aguardando confirmação humana"} &nbsp;|&nbsp;
                    Critério:{" "}
                    {renderizarTextoComLinksMatriculaLv2(
                      pedido.criterioSolicitacao,
                      "papel"
                    )}
                  </div>
                  <div className="text-[0.85em] text-slate-600 font-mono">
                    Hash Versão dos Dados-Fonte: {pedido.versaoDadosFonteHash.slice(0, 28)}...
                  </div>
                </div>

                <div className="border border-[#B3BDCC]">
                  <div className="bg-[#EBF0F7] px-2.5 py-1 font-bold text-[0.9em] border-b border-[#B3BDCC] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      RESULTADO DA CONSULTA AO CONTRADITÓRIO (PRENOTAÇÕES ATIVAS)
                    </span>
                    <span className="text-[0.76em] font-mono text-slate-600">
                      tblWRIRecepcao • tblWRITitulos • tblWRICertidaoResultadoContraditorio •
                      tblWRITipoPrenotacao • tblWRITitulosReal • tblWRIReal • tblWRIImovelBase •
                      tblWRIImovel
                    </span>
                  </div>
                  <div className="p-2.5 text-[0.94em] min-h-[54px]">
                    {prenotacoesContraditorio.length === 0 ? (
                      <span>
                        {pedido.ultimaConferencia?.contraditorioStatus === "NADA_CONSTA"
                          ? "NADA CONSTA em tramitação para a(s) matrícula(s) conferida(s) nesta versão de dados."
                          : "Consulta ao Contraditório pendente ou encaminhada à verificação manual da equipe."}
                      </span>
                    ) : (
                      <ul className="space-y-1.5">
                        {prenotacoesContraditorio.map((pr, i) => (
                          <li
                            key={i}
                            className={pr.emProcessamentoAtoNaMatricula ? "font-bold" : ""}
                          >
                            <strong>
                              Prenotação nº{" "}
                              <LinkPrenotacaoWebri
                                numeroPrenotacao={pr.numeroPrenotacao}
                                variante="papel"
                              />
                            </strong>{" "}
                            ({pr.dataApresentacaoBr}) • Tipo:{" "}
                            <strong>{pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"}</strong> •
                            Natureza: <strong>{pr.naturezaTitulo}</strong>
                            {pr.livroContraditorio ? (
                              <>
                                {" "}
                                • Livro:{" "}
                                {renderizarTextoComLinksMatriculaLv2(
                                  pr.livroContraditorio,
                                  "papel"
                                )}
                              </>
                            ) : null}
                            {pr.protocoloMagnetico ? ` • Prot.: ${pr.protocoloMagnetico}` : ""}{" "}
                            [
                            {pr.emProcessamentoAtoNaMatricula
                              ? "ATO EM PROCESSAMENTO - PAUSAR"
                              : pr.etapaAtual}
                            ]
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {pedido.ultimaConferencia?.textoCertidaoSugerido && (
                  <div className="bg-[#F7FAF2] border border-[#B3C7AD] px-2.5 py-1.5 text-[0.9em]">
                    {pedido.ultimaConferencia.textoCertidaoSugerido}
                  </div>
                )}

                <div className="border border-[#B8BFC9] flex-1 flex flex-col">
                  <div className="bg-[#EBF0F7] px-2.5 py-1 font-bold text-[0.9em] border-b border-[#B8BFC9]">
                    CONTROLE INTERNO DE BUSCA, ANOTAÇÕES DO ESCREVENTE E CONFERÊNCIA HUMANA
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    {anotacoesLegadas.length > 0 && (
                      <div className="space-y-1.5 mb-2 text-[0.88em]">
                        {anotacoesLegadas.map((an, idx) => (
                          <div key={idx}>
                            <div className="font-bold text-[#1A3866]">
                              [{an.criadoEmBr} - {an.autorNome}] {an.titulo}:
                            </div>
                            <div className="pl-2 text-slate-800">{an.conteudoAtual}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-4 flex-1 pt-2">
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <div key={idx} className="border-b border-slate-200 h-4" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── CAMADA DE MARCAÇÕES SALVAS (GRIFOS EM CORES E TEXTOS NO DOCUMENTO) ── */}
          {marcacoesDaPagina.map((m) => {
            const xEfetivoPt =
              movendoMarcacao?.id === m.id ? movendoMarcacao.xAtualPt : m.xPt;
            const yEfetivoPt =
              movendoMarcacao?.id === m.id ? movendoMarcacao.yAtualPt : m.yTopoPt;
            const leftPct = (xEfetivoPt / LARGURA_PAGINA_SIPLAN_PT) * 100;
            const topPct = (yEfetivoPt / ALTURA_PAGINA_SIPLAN_PT) * 100;
            const widthPct = (m.larguraPt / LARGURA_PAGINA_SIPLAN_PT) * 100;
            const heightPct = (m.alturaPt / ALTURA_PAGINA_SIPLAN_PT) * 100;
            const selecionada = marcacaoSelecionadaId === m.id;
            const infoGrifo =
              OPCOES_CORES_GRIFO.find((c) => c.codigo === (m.corGrifo || "AMARELO")) ||
              OPCOES_CORES_GRIFO[0];
            const infoCorTexto =
              OPCOES_CORES_TEXTO.find((c) => c.codigo === (m.corTexto || "AZUL_ESCURO")) ||
              OPCOES_CORES_TEXTO[0];

            if (m.tipo === "GRIFO") {
              return (
                <div
                  key={m.id}
                  data-marcacao-interativa="true"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setMarcacaoSelecionadaId(selecionada ? null : m.id);
                  }}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: infoGrifo.bgCss,
                    mixBlendMode: "multiply",
                    outline: selecionada ? `2px solid ${infoGrifo.borderCss}` : "none",
                  }}
                  className="absolute rounded-[2px] cursor-pointer transition-shadow hover:ring-1 hover:ring-slate-700/50"
                  title="Clique para trocar a cor do grifo, adicionar texto ou excluir"
                >
                  {selecionada && (
                    <div
                      style={{ mixBlendMode: "normal" }}
                      onClick={(ev) => ev.stopPropagation()}
                      className="absolute -top-9 left-0 z-30 inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-[#090E1B] border border-white/20 shadow-xl text-white"
                    >
                      {OPCOES_CORES_GRIFO.map((cg) => (
                        <button
                          key={cg.codigo}
                          type="button"
                          onClick={() => alterarCorGrifoExistente(m.id, cg.codigo)}
                          className={`w-4 h-4 rounded-full cursor-pointer ${m.corGrifo === cg.codigo ? "ring-2 ring-white" : ""
                            }`}
                          style={{ backgroundColor: cg.swatchHex }}
                          title={`Mudar para ${cg.rotulo}`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setMarcacaoSelecionadaId(null);
                          abrirEditorNovoTexto(
                            {
                              xPt: m.xPt,
                              yTopoPt: Math.min(815, m.yTopoPt + m.alturaPt + 2),
                              larguraPt: Math.max(160, m.larguraPt),
                              alturaPt: 18,
                            },
                            m.trechoSelecionado || null,
                            null
                          );
                        }}
                        className="px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold cursor-pointer ml-1"
                        title="Adicionar texto vinculado a este grifo"
                      >
                        + Texto
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirMarcacao(m.id)}
                        className="p-1 rounded hover:bg-rose-600/30 text-rose-400 cursor-pointer"
                        title="Remover este grifo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Marcação de TEXTO posicionado sobre o documento (esticável na lateral e na altura)
            const larguraEfetivaPt =
              redimensionandoMarcacao?.id === m.id
                ? redimensionandoMarcacao.larguraAtualPt
                : m.larguraPt;
            const alturaEfetivaPt =
              redimensionandoMarcacao?.id === m.id
                ? redimensionandoMarcacao.alturaAtualPt
                : m.alturaPt;
            const temTamanhoCustomizado =
              redimensionandoMarcacao?.id === m.id ||
              larguraEfetivaPt > 40 ||
              alturaEfetivaPt > 22;

            return (
              <React.Fragment key={m.id}>
                {m.corGrifo && (
                  <div
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: infoGrifo.bgCss,
                      border: `1px dashed ${infoGrifo.borderCss}`,
                      mixBlendMode: "multiply",
                    }}
                    className="absolute pointer-events-none rounded-[2px]"
                  />
                )}
                <div
                  data-marcacao-interativa="true"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setMarcacaoSelecionadaId(selecionada ? null : m.id);
                  }}
                  onMouseDown={(ev) => {
                    if (
                      (ev.target as HTMLElement).closest("button") ||
                      (ev.target as HTMLElement).closest("[data-alca-redimensionar='true']")
                    ) {
                      return;
                    }
                    const pt = converterClientParaPt(ev.clientX, ev.clientY);
                    if (!pt) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    setMovendoMarcacao({
                      id: m.id,
                      offsetXPt: pt.xPt - m.xPt,
                      offsetYPt: pt.yTopoPt - m.yTopoPt,
                      xAtualPt: m.xPt,
                      yAtualPt: m.yTopoPt,
                    });
                  }}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: temTamanhoCustomizado
                      ? `${Math.min(98 - leftPct, (larguraEfetivaPt / LARGURA_PAGINA_SIPLAN_PT) * 100)}%`
                      : undefined,
                    minHeight:
                      alturaEfetivaPt > 20
                        ? `${(alturaEfetivaPt / ALTURA_PAGINA_SIPLAN_PT) * 100}%`
                        : undefined,
                    maxWidth: `${Math.max(24, 98 - leftPct)}%`,
                    color: infoCorTexto.hex,
                    borderColor: infoCorTexto.hex,
                    fontSize: `clamp(9px, ${(m.tamanhoFontePt || 10) * 0.168}cqi, 28px)`,
                  }}
                  className={`group/txt absolute z-20 px-2 py-1 rounded bg-[#FFFFF6]/95 border font-bold whitespace-pre-wrap break-words leading-snug shadow-sm cursor-move select-none ${selecionada ? "ring-2 ring-cyan-500" : "hover:ring-1 hover:ring-cyan-500/60"
                    }`}
                  title="Arraste para mover, puxe as bordas/canto para esticar na lateral e altura, ou clique para editar"
                >
                  {m.texto}

                  {/* Alça Lateral Direita (esticar na lateral) */}
                  <div
                    data-alca-redimensionar="true"
                    onMouseDown={(ev) => {
                      ev.stopPropagation();
                      ev.preventDefault();
                      setRedimensionandoMarcacao({
                        id: m.id,
                        eixo: "LATERAL",
                        inicioClientX: ev.clientX,
                        inicioClientY: ev.clientY,
                        larguraInicialPt: m.larguraPt || 180,
                        alturaInicialPt: m.alturaPt || 22,
                        larguraAtualPt: m.larguraPt || 180,
                        alturaAtualPt: m.alturaPt || 22,
                      });
                    }}
                    title="Arraste para esticar na lateral"
                    className="absolute top-0 -right-1.5 bottom-2 w-2.5 cursor-ew-resize opacity-0 group-hover/txt:opacity-100 hover:bg-cyan-400/40 rounded-r transition-opacity"
                  />

                  {/* Alça Inferior (esticar na altura) */}
                  <div
                    data-alca-redimensionar="true"
                    onMouseDown={(ev) => {
                      ev.stopPropagation();
                      ev.preventDefault();
                      setRedimensionandoMarcacao({
                        id: m.id,
                        eixo: "ALTURA",
                        inicioClientX: ev.clientX,
                        inicioClientY: ev.clientY,
                        larguraInicialPt: m.larguraPt || 180,
                        alturaInicialPt: m.alturaPt || 22,
                        larguraAtualPt: m.larguraPt || 180,
                        alturaAtualPt: m.alturaPt || 22,
                      });
                    }}
                    title="Arraste para esticar na altura"
                    className="absolute left-0 right-2 -bottom-1.5 h-2.5 cursor-ns-resize opacity-0 group-hover/txt:opacity-100 hover:bg-cyan-400/40 rounded-b transition-opacity"
                  />

                  {/* Alça de Canto Inferior Direito (esticar na lateral e na altura) */}
                  <div
                    data-alca-redimensionar="true"
                    onMouseDown={(ev) => {
                      ev.stopPropagation();
                      ev.preventDefault();
                      setRedimensionandoMarcacao({
                        id: m.id,
                        eixo: "AMBOS",
                        inicioClientX: ev.clientX,
                        inicioClientY: ev.clientY,
                        larguraInicialPt: m.larguraPt || 180,
                        alturaInicialPt: m.alturaPt || 22,
                        larguraAtualPt: m.larguraPt || 180,
                        alturaAtualPt: m.alturaPt || 22,
                      });
                    }}
                    title="Arraste para esticar na lateral e na altura"
                    className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 cursor-nwse-resize rounded-xs bg-cyan-500/80 border border-white shadow-xs opacity-70 group-hover/txt:opacity-100"
                  />

                  {selecionada && (
                    <div
                      onClick={(ev) => ev.stopPropagation()}
                      className="absolute -top-9 left-0 z-30 inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#090E1B] border border-white/20 shadow-xl text-white text-[11px] font-sans whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                        <Move className="w-3 h-3" /> Arraste / Estique
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          moverMarcacaoParaOutraFolha(
                            m.id,
                            (m.pagina || 1) === 1 ? 2 : 1
                          )
                        }
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                        title={
                          (m.pagina || 1) === 1
                            ? "Mover esta caixa de texto para a Folha Verso (Pág. 2)"
                            : "Mover esta caixa de texto para a Folha Frente (Pág. 1)"
                        }
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        {(m.pagina || 1) === 1
                          ? "Mover p/ Verso (Pág. 2)"
                          : "Mover p/ Frente (Pág. 1)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMarcacaoSelecionadaId(null);
                          const boxW = folhaRef.current?.getBoundingClientRect().width || 800;
                          const boxH = folhaRef.current?.getBoundingClientRect().height || 1100;
                          setEditorTextoAberto({
                            modo: "EDITAR",
                            idExistente: m.id,
                            paginaAlvo: (m.pagina === 2 ? 2 : 1) as 1 | 2,
                            rectPt: {
                              xPt: m.xPt,
                              yTopoPt: m.yTopoPt,
                              larguraPt: m.larguraPt,
                              alturaPt: m.alturaPt,
                            },
                            texto: m.texto || "",
                            corTexto: m.corTexto || "AZUL_ESCURO",
                            corGrifoOpcional: m.corGrifo || null,
                            tamanhoFontePt: m.tamanhoFontePt || 10,
                            trechoSelecionado: m.trechoSelecionado || null,
                            mostrarEmoticons: false,
                            larguraCardPx: Math.max(
                              360,
                              Math.min(820, Math.round((m.larguraPt / LARGURA_PAGINA_SIPLAN_PT) * boxW) + 24)
                            ),
                            alturaTextareaPx: Math.max(
                              88,
                              Math.min(460, Math.round((m.alturaPt / ALTURA_PAGINA_SIPLAN_PT) * boxH))
                            ),
                            redimensionadoManualmente: false,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirMarcacao(m.id)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* Retângulo de Pré-Visualização durante o Arraste do Mouse */}
          {arrasteAtual && (
            <div
              style={{
                left: `${(arrasteAtual.xPt / LARGURA_PAGINA_SIPLAN_PT) * 100}%`,
                top: `${(arrasteAtual.yTopoPt / ALTURA_PAGINA_SIPLAN_PT) * 100}%`,
                width: `${(arrasteAtual.larguraPt / LARGURA_PAGINA_SIPLAN_PT) * 100}%`,
                height: `${(arrasteAtual.alturaPt / ALTURA_PAGINA_SIPLAN_PT) * 100}%`,
                backgroundColor:
                  ferramenta === "GRIFAR"
                    ? OPCOES_CORES_GRIFO.find((c) => c.codigo === corGrifoAtiva)?.bgCss
                    : "rgba(79, 70, 229, 0.16)",
                borderColor:
                  ferramenta === "GRIFAR"
                    ? OPCOES_CORES_GRIFO.find((c) => c.codigo === corGrifoAtiva)?.borderCss
                    : "#4F46E5",
              }}
              className="absolute border-2 border-dashed rounded-[2px] pointer-events-none z-30"
            />
          )}

          {/* Barra Flutuante ao Selecionar Texto Nativamente no Documento */}
          {selecaoTextoNativo && !editorTextoAberto && (
            <div
              data-marcacao-interativa="true"
              onClick={(ev) => ev.stopPropagation()}
              style={{
                left: `${Math.min(
                  58,
                  Math.max(2, (selecaoTextoNativo.rectPt.xPt / LARGURA_PAGINA_SIPLAN_PT) * 100)
                )}%`,
                top: `${Math.max(
                  2,
                  ((selecaoTextoNativo.rectPt.yTopoPt - 34) / ALTURA_PAGINA_SIPLAN_PT) * 100
                )}%`,
              }}
              className="absolute z-40 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#080D1A] border border-cyan-400/50 shadow-2xl text-white text-xs"
            >
              <span className="text-[10px] font-bold text-slate-300">Grifar:</span>
              {OPCOES_CORES_GRIFO.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  onClick={() => grifarTrechoNativoSelecionado(c.codigo)}
                  className="w-4 h-4 rounded-full hover:scale-110 transition cursor-pointer"
                  style={{ backgroundColor: c.swatchHex }}
                  title={`Grifar trecho selecionado em ${c.rotulo}`}
                />
              ))}
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => {
                  const r = selecaoTextoNativo.rectPt;
                  const trecho = selecaoTextoNativo.trecho;
                  window.getSelection()?.removeAllRanges();
                  abrirEditorNovoTexto(
                    {
                      xPt: r.xPt,
                      yTopoPt: Math.min(812, r.yTopoPt + r.alturaPt + 2),
                      larguraPt: Math.max(180, r.larguraPt),
                      alturaPt: 18,
                    },
                    trecho,
                    corGrifoAtiva
                  );
                }}
                className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
              >
                <Type className="w-3 h-3" />
                Adicionar Texto
              </button>
              <button
                type="button"
                onClick={() => setSelecaoTextoNativo(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Popover Editor de Texto Posicionado na Região Selecionada do Documento (móvel para qualquer parte da tela e Folha Verso, e esticável na lateral e na altura) */}
          {editorTextoAberto && (
            <div
              data-marcacao-interativa="true"
              onClick={(ev) => ev.stopPropagation()}
              style={{
                left: `${Math.min(
                  94,
                  Math.max(0.5, (editorTextoAberto.rectPt.xPt / LARGURA_PAGINA_SIPLAN_PT) * 100)
                )}%`,
                top: `${Math.min(
                  94,
                  Math.max(0.5, (editorTextoAberto.rectPt.yTopoPt / ALTURA_PAGINA_SIPLAN_PT) * 100)
                )}%`,
                width: `${editorTextoAberto.larguraCardPx}px`,
                maxWidth: "96%",
              }}
              className="absolute z-50 rounded-2xl bg-[#080D1A] border-2 border-cyan-400/60 p-3 shadow-2xl text-white flex flex-col gap-2 text-xs font-sans"
            >
              {/* Alça Lateral Direita do Card (esticar na lateral) */}
              <div
                onMouseDown={(ev) => {
                  ev.stopPropagation();
                  ev.preventDefault();
                  setRedimensionandoCardEditor({
                    eixo: "LATERAL",
                    inicioClientX: ev.clientX,
                    inicioClientY: ev.clientY,
                    larguraInicialPx: editorTextoAberto.larguraCardPx,
                    alturaInicialPx: editorTextoAberto.alturaTextareaPx,
                  });
                }}
                title="Arraste para esticar o card na lateral"
                className="absolute top-3 -right-1.5 bottom-5 w-3 cursor-ew-resize hover:bg-cyan-400/35 rounded-r transition-colors"
              />

              {/* Alça Inferior do Card (esticar na altura) */}
              <div
                onMouseDown={(ev) => {
                  ev.stopPropagation();
                  ev.preventDefault();
                  setRedimensionandoCardEditor({
                    eixo: "ALTURA",
                    inicioClientX: ev.clientX,
                    inicioClientY: ev.clientY,
                    larguraInicialPx: editorTextoAberto.larguraCardPx,
                    alturaInicialPx: editorTextoAberto.alturaTextareaPx,
                  });
                }}
                title="Arraste para esticar o card na altura"
                className="absolute left-3 right-5 -bottom-1.5 h-3 cursor-ns-resize hover:bg-cyan-400/35 rounded-b transition-colors"
              />

              {/* Alça de Canto Inferior Direito do Card (esticar na lateral e na altura) */}
              <div
                onMouseDown={(ev) => {
                  ev.stopPropagation();
                  ev.preventDefault();
                  setRedimensionandoCardEditor({
                    eixo: "AMBOS",
                    inicioClientX: ev.clientX,
                    inicioClientY: ev.clientY,
                    larguraInicialPx: editorTextoAberto.larguraCardPx,
                    alturaInicialPx: editorTextoAberto.alturaTextareaPx,
                  });
                }}
                title="Arraste para esticar na lateral e na altura"
                className="absolute -right-1.5 -bottom-1.5 w-5 h-5 cursor-nwse-resize rounded-br-xl bg-cyan-500/30 hover:bg-cyan-400/60 border border-cyan-300/60 flex items-center justify-center text-[10px] text-cyan-200 select-none"
              >
                ◢
              </div>

              {/* Barra Superior de Arraste para Mover a Caixa para Qualquer Parte da Tela + Seletor Frente / Verso */}
              <div
                onMouseDown={(ev) => {
                  if ((ev.target as HTMLElement).closest("button")) return;
                  ev.stopPropagation();
                  ev.preventDefault();
                  setMovendoCardEditor({
                    inicioClientX: ev.clientX,
                    inicioClientY: ev.clientY,
                    xInicialPt: editorTextoAberto.rectPt.xPt,
                    yInicialPt: editorTextoAberto.rectPt.yTopoPt,
                  });
                }}
                title="Arraste esta barra para mover a caixa de texto para qualquer parte da folha"
                className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/10 cursor-move select-none"
              >
                <span className="font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-cyan-400" />
                  <Type className="w-3.5 h-3.5" />
                  {editorTextoAberto.modo === "EDITAR"
                    ? "Editar Texto no Documento"
                    : "Adicionar Texto no Documento"}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-lg border border-cyan-400/40 bg-[#050811] p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => alternarFolhaEditorTexto(1)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition ${editorTextoAberto.paginaAlvo === 1
                          ? "bg-cyan-600 text-white"
                          : "text-slate-300 hover:text-white"
                        }`}
                      title="Posicionar na Folha Frente (Pág. 1 • Pedido)"
                    >
                      Pág. 1 • Frente
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarFolhaEditorTexto(2)}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer transition ${editorTextoAberto.paginaAlvo === 2
                          ? "bg-cyan-600 text-white"
                          : "text-slate-300 hover:text-white"
                        }`}
                      title="Mover e posicionar na Folha Verso (Pág. 2 • Ficha Operacional)"
                    >
                      Pág. 2 • Verso
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorTextoAberto(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editorTextoAberto.trechoSelecionado && (
                <div className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[10px] text-slate-300 truncate">
                  Trecho: &ldquo;{editorTextoAberto.trechoSelecionado}&rdquo;
                </div>
              )}

              <div className="relative w-full">
                <textarea
                  ref={inputTextoEditorRef}
                  value={editorTextoAberto.texto}
                  onChange={(e) =>
                    setEditorTextoAberto({ ...editorTextoAberto, texto: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      confirmarEditorTexto();
                    } else if (e.key === "Escape") {
                      setEditorTextoAberto(null);
                    }
                  }}
                  style={{
                    height: `${editorTextoAberto.alturaTextareaPx}px`,
                  }}
                  placeholder="Digite o texto desejado para gravar neste local do Pedido..."
                  className="w-full p-2.5 rounded-xl bg-[#0E1528] border border-white/20 text-white text-xs focus:outline-none focus:border-cyan-400 resize-none"
                />
                {/* Alça interna no canto do campo de texto que também estica na lateral e na altura */}
                <div
                  onMouseDown={(ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    setRedimensionandoCardEditor({
                      eixo: "AMBOS",
                      inicioClientX: ev.clientX,
                      inicioClientY: ev.clientY,
                      larguraInicialPx: editorTextoAberto.larguraCardPx,
                      alturaInicialPx: editorTextoAberto.alturaTextareaPx,
                    });
                  }}
                  title="Arraste para esticar na lateral e na altura"
                  className="absolute right-1.5 bottom-2.5 w-4 h-4 cursor-nwse-resize rounded bg-cyan-500/20 hover:bg-cyan-400/50 text-cyan-300 flex items-center justify-center text-[9px] select-none"
                >
                  ◢
                </div>
              </div>

              {/* Barra rápida de Emoticons dentro do Editor do Documento */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {EMOTICONS_DOCUMENTO.slice(0, 7).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => inserirEmoticonNoEditor(em)}
                        className="w-6 h-6 rounded-md bg-[#0E1528] hover:bg-white/15 border border-white/10 text-xs inline-flex items-center justify-center cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditorTextoAberto({
                        ...editorTextoAberto,
                        mostrarEmoticons: !editorTextoAberto.mostrarEmoticons,
                      })
                    }
                    className="px-2 py-0.5 rounded-lg border border-cyan-500/35 bg-cyan-500/15 text-cyan-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Smile className="w-3 h-3" />
                    Mais
                  </button>
                </div>

                {editorTextoAberto.mostrarEmoticons && (
                  <div className="p-1.5 rounded-xl bg-[#050811] border border-white/15 grid grid-cols-7 gap-1">
                    {EMOTICONS_DOCUMENTO.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => inserirEmoticonNoEditor(em)}
                        className="h-6 rounded hover:bg-white/15 text-sm inline-flex items-center justify-center cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cor do Texto + Tamanho da Fonte */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold">Cor:</span>
                  {OPCOES_CORES_TEXTO.map((ct) => (
                    <button
                      key={ct.codigo}
                      type="button"
                      onClick={() =>
                        setEditorTextoAberto({
                          ...editorTextoAberto,
                          corTexto: ct.codigo,
                        })
                      }
                      className={`w-4 h-4 rounded-full cursor-pointer ${editorTextoAberto.corTexto === ct.codigo
                          ? "ring-2 ring-white scale-110"
                          : "opacity-80"
                        }`}
                      style={{ backgroundColor: ct.hex }}
                      title={ct.rotulo}
                    />
                  ))}
                </div>

                <div className="inline-flex rounded-lg border border-white/15 bg-[#0E1528] p-0.5 text-[10px]">
                  {[
                    { pt: 8.5, lb: "P" },
                    { pt: 10, lb: "M" },
                    { pt: 12, lb: "G" },
                  ].map((sz) => (
                    <button
                      key={sz.lb}
                      type="button"
                      onClick={() =>
                        setEditorTextoAberto({
                          ...editorTextoAberto,
                          tamanhoFontePt: sz.pt,
                        })
                      }
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer ${editorTextoAberto.tamanhoFontePt === sz.pt
                          ? "bg-cyan-600 text-white"
                          : "text-slate-300"
                        }`}
                    >
                      {sz.lb}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditorTextoAberto(null)}
                  className="px-2.5 py-1.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/10 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEditorTexto}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Gravar no Documento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

