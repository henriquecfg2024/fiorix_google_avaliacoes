/**
 * Fila Durável, Idempotência, Controle de Concorrência, Backoff Exponencial
 * e Proteção contra Timeout Externo com Resultado Desconhecido (Seção 12 & 23).
 */

import { createHash } from "crypto";
import type { AgenteVirtualId } from "./types";

export type StatusFilaJob =
  | "PENDENTE"
  | "PROCESSANDO"
  | "PAUSADO"
  | "CONCLUIDO"
  | "FALHA_RETENTAVEL"
  | "RESULTADO_EXTERNO_DESCONHECIDO"
  | "CANCELADO";

export function gerarChaveIdempotenciaJob(params: {
  tenantId: string;
  agenteVirtual: AgenteVirtualId;
  tipoJob: string;
  referenciaAlvoId: string;
  versaoDadosHash: string;
}): string {
  const raw = `${params.tenantId}|${params.agenteVirtual}|${params.tipoJob}|${params.referenciaAlvoId}|${params.versaoDadosHash}`;
  return `cvjob_${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 40)}`;
}

/**
 * Calcula espera exponencial com teto determinístico (ex: 5s, 15s, 45s, 135s...).
 */
export function calcularBackoffExponencialMs(tentativa: number, baseMs = 5_000, maxMs = 300_000): number {
  const exp = Math.max(0, tentativa - 1);
  return Math.min(maxMs, baseMs * Math.pow(3, exp));
}

/**
 * Classifica falhas de execução em segundo plano (Seção 12):
 * - Timeout após envio externo cujo efeito colateral não pode ser confirmado NUNCA é marcado como sucesso
 *   nem reexecutado às cegas: entra em `RESULTADO_EXTERNO_DESCONHECIDO` para reconciliação/verificação humana!
 */
export function classificarFalhaExecucaoJob(params: {
  erroMensagem: string;
  codigoErro?: string | null;
  operacaoExternaComEfeitoColateral: boolean;
  tentativasAtuais: number;
  maxTentativas: number;
}): {
  novoStatus: StatusFilaJob;
  proximaExecucaoDelayMs: number | null;
  exigeVerificacaoHumanaImediata: boolean;
} {
  const msgUpper = (params.erroMensagem || "").toUpperCase();
  const codUpper = (params.codigoErro || "").toUpperCase();

  const isTimeoutOuQuedaAposEnvio =
    codUpper === "ETIMEDOUT" ||
    codUpper === "ECONNRESET" ||
    codUpper === "ESOCKETTIMEDOUT" ||
    msgUpper.includes("TIMEOUT") ||
    msgUpper.includes("RESULTADO_INCERTO");

  if (params.operacaoExternaComEfeitoColateral && isTimeoutOuQuedaAposEnvio) {
    return {
      novoStatus: "RESULTADO_EXTERNO_DESCONHECIDO",
      proximaExecucaoDelayMs: null,
      exigeVerificacaoHumanaImediata: true,
    };
  }

  if (params.tentativasAtuais >= params.maxTentativas) {
    return {
      novoStatus: "FALHA_RETENTAVEL",
      proximaExecucaoDelayMs: null,
      exigeVerificacaoHumanaImediata: true,
    };
  }

  return {
    novoStatus: "PENDENTE",
    proximaExecucaoDelayMs: calcularBackoffExponencialMs(params.tentativasAtuais),
    exigeVerificacaoHumanaImediata: false,
  };
}

export function detectarJobsTravados<
  T extends { id: string; statusJob: string; bloqueadoAte?: Date | string | null }
>(jobs: T[], referenciaAgora: Date = new Date()): T[] {
  const nowMs = referenciaAgora.getTime();
  return jobs.filter((j) => {
    if (j.statusJob !== "PROCESSANDO" || !j.bloqueadoAte) return false;
    const lockMs = new Date(j.bloqueadoAte).getTime();
    return !isNaN(lockMs) && lockMs < nowMs;
  });
}

