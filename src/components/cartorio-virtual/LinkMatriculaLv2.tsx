"use client";

import React from "react";
import {
  abrirMatriculaLv2EmOutroMonitor,
  construirUrlVisualizadorMatriculaLv2,
  construirUrlWebriContraditorio,
} from "@/lib/documental/janelasDocumento";

export function LinkMatriculaLv2({
  numeroMatricula,
  prefixo,
  variante = "dark",
  className = "",
}: {
  numeroMatricula: string | number;
  prefixo?: string;
  variante?: "dark" | "papel" | "badge";
  className?: string;
}) {
  const digitos = String(numeroMatricula ?? "").replace(/\D+/g, "");
  if (!digitos) {
    return <span>{prefixo ? `${prefixo}${numeroMatricula}` : String(numeroMatricula)}</span>;
  }

  const href = construirUrlVisualizadorMatriculaLv2(digitos);

  const estiloVariante =
    variante === "papel"
      ? "text-[#0B4F8A] hover:text-[#0284C7] underline decoration-[#0B4F8A]/65 hover:decoration-[#0284C7] decoration-2 underline-offset-2 font-black print:text-[#111827] print:no-underline"
      : variante === "badge"
      ? "px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-400/50 text-[10px] font-mono font-extrabold text-cyan-200 hover:text-white underline decoration-cyan-400/70 underline-offset-2 transition"
      : "text-cyan-300 hover:text-cyan-100 underline decoration-cyan-400/70 hover:decoration-cyan-200 decoration-1 underline-offset-2 font-mono font-extrabold transition";

  return (
    <a
      href={href}
      target="fiorix-visualizador-lv2"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        abrirMatriculaLv2EmOutroMonitor(digitos);
      }}
      title={`Abrir Matrícula nº ${digitos} (Livro 2 - LV2) no Visualizador FIORIX em janela separada / outro monitor`}
      className={`cursor-pointer inline-flex items-baseline gap-0.5 ${estiloVariante} ${className}`}
    >
      {prefixo ? <span>{prefixo}</span> : null}
      <span>{digitos}</span>
    </a>
  );
}

export function LinkPrenotacaoWebri({
  numeroPrenotacao,
  seqTitulo = 1,
  variante = "dark",
  className = "",
}: {
  numeroPrenotacao: string | number;
  seqTitulo?: number;
  variante?: "dark" | "papel";
  className?: string;
}) {
  const digitos = String(numeroPrenotacao ?? "").replace(/\D+/g, "");
  if (!digitos) {
    return <span>{String(numeroPrenotacao)}</span>;
  }

  const href = construirUrlWebriContraditorio(digitos, seqTitulo);

  const estiloVariante =
    variante === "papel"
      ? "text-[#7C2D12] hover:text-[#B45309] underline decoration-[#92400E]/75 hover:decoration-[#B45309] decoration-2 underline-offset-2 font-black text-[1.12em] print:text-[#111827] print:no-underline"
      : "text-amber-200 hover:text-white underline decoration-amber-300/80 hover:decoration-white decoration-2 underline-offset-2 font-mono font-black text-[12px] transition";

  return (
    <a
      href={href}
      target="_blank"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
      }}
      title={`Abrir Prenotação nº ${digitos} diretamente no WEBRI (Recepção de Títulos)`}
      className={`cursor-pointer inline-flex items-baseline ${estiloVariante} ${className}`}
    >
      {digitos}
    </a>
  );
}

/**
 * Transforma menções de matrícula dentro de textos livres (ex.: "Matrícula nº 247360",
 * "Matrícula livro n. 247360", "MAT 224985") em hiperlinks clicáveis para o LV2 no Visualizador.
 */
export function renderizarTextoComLinksMatriculaLv2(
  texto: string | null | undefined,
  variante: "dark" | "papel" = "papel"
): React.ReactNode {
  if (!texto) return texto;
  const regex = /\b(Matr[íi]cula(?:\s+livro)?\s*(?:n[º°o.]*|\b)\s*|MAT\.?\s+)(\d{1,8})\b/gi;
  const partes: React.ReactNode[] = [];
  let ultimoIndice = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimoIndice) {
      partes.push(texto.slice(ultimoIndice, match.index));
    }
    const prefixoTexto = match[1];
    const numeroMat = match[2];
    partes.push(
      <React.Fragment key={`mat-${match.index}-${numeroMat}`}>
        {prefixoTexto}
        <LinkMatriculaLv2 numeroMatricula={numeroMat} variante={variante} />
      </React.Fragment>
    );
    ultimoIndice = regex.lastIndex;
  }

  if (partes.length === 0) return texto;
  if (ultimoIndice < texto.length) {
    partes.push(texto.slice(ultimoIndice));
  }
  return partes;
}

