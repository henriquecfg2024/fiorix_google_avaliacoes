import { createHash } from "crypto";

/**
 * Gera o SHA-256 de um buffer, string ou JSON.
 */
export function generateHash(content: string | Buffer | object): string {
  const data = typeof content === "object" && !Buffer.isBuffer(content) 
    ? JSON.stringify(content) 
    : content;
    
  return createHash("sha256").update(data as string | Buffer).digest("hex");
}

/**
 * Monta um payload canônico para registrar a ciência de um comunicado
 * e retorna o hash.
 */
export function generateCienciaHash(params: {
  comunicadoId: string;
  usuarioId: string;
  timestamp: string;
  comunicadoHash: string;
  ip: string;
  userAgent: string;
}): string {
  // Concatenação canônica de chaves críticas
  const payload = `${params.comunicadoId}:${params.usuarioId}:${params.timestamp}:${params.comunicadoHash}:${params.ip}:${params.userAgent}`;
  return generateHash(payload);
}
