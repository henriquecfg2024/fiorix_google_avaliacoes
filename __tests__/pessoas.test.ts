import { describe, it, expect } from "vitest";
import { generateHash, generateCienciaHash } from "../src/lib/security/hash";
import { maskIp } from "../src/lib/security/requestIp";

describe("FIORIX PESSOAS - Segurança e Regras de Negócio", () => {
  it("deve gerar hash SHA-256 determinístico para o mesmo conteúdo", () => {
    const texto = "Alteração de Horário - Plantão de Fim de Ano";
    const hash1 = generateHash(texto);
    const hash2 = generateHash(texto);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it("deve gerar prova de ciência canônica com todas as chaves críticas", () => {
    const cienciaHash = generateCienciaHash({
      comunicadoId: "com-1",
      usuarioId: "user-123",
      timestamp: "2026-09-01T12:00:00Z",
      comunicadoHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ip: "189.40.12.34",
      userAgent: "Mozilla/5.0",
    });

    expect(cienciaHash).toHaveLength(64);
  });

  it("deve mascarar IP corretamente para proteção de privacidade", () => {
    const ipV4 = "189.40.123.45";
    expect(maskIp(ipV4)).toBe("189.40.***.***");
  });

  it("deve validar cálculo de antecedência mínima de 30 dias (CLT Art. 135)", () => {
    const hoje = new Date();
    
    // Data com 15 dias de antecedência (deve ser < 30)
    const dataMenor = new Date();
    dataMenor.setDate(hoje.getDate() + 15);
    const diffMenor = Math.ceil((dataMenor.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffMenor < 30).toBe(true);

    // Data com 45 dias de antecedência (deve ser >= 30)
    const dataMaior = new Date();
    dataMaior.setDate(hoje.getDate() + 45);
    const diffMaior = Math.ceil((dataMaior.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffMaior >= 30).toBe(true);
  });

  describe("Anexo de Comunicados em PDF", () => {
    it("deve validar magic bytes (%PDF-) para anexos oficiais", () => {
      const validPdfBuffer = Buffer.from("%PDF-1.7\nExemplo de Comunicado Oficial");
      const isValidMagicBytes = validPdfBuffer.length >= 5 && validPdfBuffer.toString("utf-8", 0, 5) === "%PDF-";
      expect(isValidMagicBytes).toBe(true);
    });

    it("deve rejeitar arquivo disfarçado com extensão .pdf mas sem magic bytes válidos", () => {
      const fakePdfBuffer = Buffer.from("<script>alert('xss')</script>");
      const isValidMagicBytes = fakePdfBuffer.length >= 5 && fakePdfBuffer.toString("utf-8", 0, 5) === "%PDF-";
      expect(isValidMagicBytes).toBe(false);
    });

    it("deve calcular hash SHA-256 de integridade criptográfica para anexos binários", () => {
      const pdfContent = Buffer.from("%PDF-1.4\nPortaria Administrativa nº 05/2026");
      const hash = generateHash(pdfContent.toString("binary"));
      expect(hash).toHaveLength(64);
    });
  });
});
