/**
 * Dicionário Canônico de Mapeamento SIPLAN/WEBRI -> FIORIX (Seções 15.3, 18, 19 e 20)
 * Baseado estritamente nas evidências verificadas:
 *  - Modelo_Pedido_de_Certidão.rtf (19 marcadores oficiais)
 *  - Pedido_certidão_nº_1321013.pdf (2 páginas A4 [595 x 842 pt])
 *  - Capturas SSMS SRVSQL\WEBRI (tblWRICertidao, tblWRICertidaoItens, tblWRIReal, tblWRIRecepcao)
 */

import { mascararCpfLgpd, limparCpfReal, formatarCpfCompleto } from "@/lib/ferias/idade-calculator";
import type { ParticipantePedido } from "./types";

export type NivelConfirmacaoCampo =
  | "CONFIRMADO_MODELO_E_SQL"
  | "CONFIRMADO_MODELO_RTF_PDF"
  | "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR";

export interface MapeamentoMarcadorSiplan {
  marcadorRtf: string;
  paginaPdf: 1 | 2;
  campoFiorix: string;
  origemSqlIdentificada: string;
  nivelConfirmacao: NivelConfirmacaoCampo;
  regraSaneamentoSentinela: string;
}

/**
 * Todos os 19 marcadores extraídos de `Modelo_Pedido_de_Certidão.rtf` com rastreabilidade explícita.
 */
export const DICIONARIO_MARCADORES_SIPLAN: MapeamentoMarcadorSiplan[] = [
  {
    marcadorRtf: "<Protocolo/>",
    paginaPdf: 1,
    campoFiorix: "numeroPedido",
    origemSqlIdentificada: "dbo.tblWRICertidao.Pk_NrPedido (código de barras Code 39 *<Protocolo/>*)",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Pk_NrPedido = 0 é registro técnico/sentinela; protocolo externo usa ProtocoloEntidade quando <> '0'.",
  },
  {
    marcadorRtf: "<DataEntrada/>",
    paginaPdf: 1,
    campoFiorix: "dataPedidoBr",
    origemSqlIdentificada: "dbo.tblWRICertidao.DataPedido",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Datas 1900-01-01 / 1899-12-30 tratadas como nulas; datas históricas reais (ex: 1997-01-02) preservadas.",
  },
  {
    marcadorRtf: "<HoraEntrada/>",
    paginaPdf: 1,
    campoFiorix: "horaPedidoBr",
    origemSqlIdentificada: "dbo.tblWRICertidao.DataPedido (componente HH:mm:ss)",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Quando 00:00:00 em registro legado sem hora, exibe 00:00:00 fiel ao banco sem inventar horário.",
  },
  {
    marcadorRtf: "<DataPrevista/>",
    paginaPdf: 1,
    campoFiorix: "prazoPrevistoBr",
    origemSqlIdentificada: "dbo.tblWRICertidaoItens.DataPrevisao / tblWRICertidao.DataFinalRetir...",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "1900-01-01 convertido para null ('Não informada').",
  },
  {
    marcadorRtf: "<FormaEntrega/>",
    paginaPdf: 1,
    campoFiorix: "formaEntregaExibicao",
    origemSqlIdentificada: "dbo.tblWRICertidao.Enviar_Correio + indicador de meio de entrega do item ('M' = Meio Magnético)",
    nivelConfirmacao: "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR",
    regraSaneamentoSentinela: "Exibe 'Meio Magnético (M)' ou 'Balcão / Presencial' sem presumir que 'M' signifique Inteiro Teor.",
  },
  {
    marcadorRtf: "<Solicitante/>",
    paginaPdf: 1,
    campoFiorix: "requerente.nome",
    origemSqlIdentificada: "dbo.tblWRICertidao.NomeRequerente",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Entidade independente de Apresentante e Destinatário da Nota.",
  },
  {
    marcadorRtf: "<Email/>",
    paginaPdf: 1,
    campoFiorix: "requerente.email",
    origemSqlIdentificada: "dbo.tblWRICertidao.EmailRequerente",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "String vazia ou '0' convertida para null.",
  },
  {
    marcadorRtf: "<Cpf/>",
    paginaPdf: 1,
    campoFiorix: "requerente.documentoFormatado",
    origemSqlIdentificada: "Documento do requerente em tblWRICertidao (além da borda direita do print SSMS) / tblWRICertidaoItens.NumeroDocto",
    nivelConfirmacao: "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR",
    regraSaneamentoSentinela: "Classifica CPF (11 dígitos) vs CNPJ (14 dígitos) sem truncar nem forçar máscara incorreta.",
  },
  {
    marcadorRtf: "<Telefone/>",
    paginaPdf: 1,
    campoFiorix: "requerente.telefone",
    origemSqlIdentificada: "dbo.tblWRICertidao.FoneRequerente",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Preserva ramal/contato quando presente em registros legados e higieniza espaços.",
  },
  {
    marcadorRtf: "<Observacoes/>",
    paginaPdf: 1,
    campoFiorix: "observacoesOrigem",
    origemSqlIdentificada: "Observações do pedido em dbo.tblWRICertidao",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Motivação não é exigida universalmente; aviso CNJ 134/2022 exibido conforme modelo oficial.",
  },
  {
    marcadorRtf: "<Escrevente/>",
    paginaPdf: 1,
    campoFiorix: "escreventeRecepcao",
    origemSqlIdentificada: "Operador vinculado via dbo.tblSIPUsuarios (NomeCompletoUser)",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Nunca confunde operador de recepção com aprovador registral.",
  },
  {
    marcadorRtf: "<Lista/>",
    paginaPdf: 1,
    campoFiorix: "itens[]",
    origemSqlIdentificada: "dbo.tblWRICertidaoItens JOIN dbo.tblWRINaturezaCertidao / dbo.tblWRILivro",
    nivelConfirmacao: "CONFIRMADO_MODELO_E_SQL",
    regraSaneamentoSentinela: "Num_Livro = 0 ou 99999999 tratado como sentinela (não é número real de matrícula).",
  },
  {
    marcadorRtf: "<ValorServico/>",
    paginaPdf: 1,
    campoFiorix: "valores.valorServico",
    origemSqlIdentificada: "dbo.tblWRICertidao.VlrTotCert1 / dbo.tblWRICertidaoCotas",
    nivelConfirmacao: "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR",
    regraSaneamentoSentinela: "Valores monetários em centavos exatos, sem cobrança automática no piloto.",
  },
  {
    marcadorRtf: "<ValorDespesa/>",
    paginaPdf: 1,
    campoFiorix: "valores.valorDespesa",
    origemSqlIdentificada: "dbo.tblWRICertidaoDespesasAcessorias / VlrTotCert2",
    nivelConfirmacao: "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR",
    regraSaneamentoSentinela: "Zero quando inexistente.",
  },
  {
    marcadorRtf: "<TotalDeposito/>",
    paginaPdf: 1,
    campoFiorix: "valores.totalDeposito",
    origemSqlIdentificada: "Total depositado do pedido em tblWRICertidao / tblTempControleDepositoCertidao",
    nivelConfirmacao: "PARCIAL_SQL_EXIGE_TABELA_AUXILIAR",
    regraSaneamentoSentinela: "Exibido apenas para espelhamento documental do recibo RPS.",
  },
  {
    marcadorRtf: "<Apresentante/>",
    paginaPdf: 1,
    campoFiorix: "apresentante.nome",
    origemSqlIdentificada: "Campos de apresentante do pedido / recepção",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Mantido separado de Solicitante e Destinatário da Nota.",
  },
  {
    marcadorRtf: "<CpfCnpjApresentante/>",
    paginaPdf: 1,
    campoFiorix: "apresentante.documentoFormatado",
    origemSqlIdentificada: "Documento do apresentante (CPF 11 ou CNPJ 14 dígitos)",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Suporta CPF e CNPJ nativamente.",
  },
  {
    marcadorRtf: "<DestinatarioNota/>",
    paginaPdf: 1,
    campoFiorix: "destinatarioNota.nome",
    origemSqlIdentificada: "Tomador / destinatário RPS (dbo.tblWRITomadoresNfe / tblWRICertidao)",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Mantido separado de Solicitante e Apresentante.",
  },
  {
    marcadorRtf: "<CpfCnpjDestinatarioNota/>",
    paginaPdf: 1,
    campoFiorix: "destinatarioNota.documentoFormatado",
    origemSqlIdentificada: "CPF/CNPJ do destinatário da nota RPS",
    nivelConfirmacao: "CONFIRMADO_MODELO_RTF_PDF",
    regraSaneamentoSentinela: "Suporta CPF e CNPJ nativamente.",
  },
];

/**
 * Normaliza datas vindas do SQL Server 2012 (WEBRI):
 * - Datas sentinelas `1900-01-01` e `1899-12-30` retornam `null` (Seção 19).
 * - Datas históricas reais (ex: `1997-01-02`) são preservadas integralmente.
 */
export function normalizarDataSentinelaSql(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  const dt = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(dt.getTime())) return null;
  const isoDate = dt.toISOString().slice(0, 10);
  if (isoDate === "1900-01-01" || isoDate === "1899-12-30" || isoDate === "1753-01-01") {
    return null;
  }
  return dt;
}

/**
 * Normaliza `ProtocoloEntidade` do SQL (`'0'` ou vazio -> `null`, `'YM023820780'` -> `'YM023820780'`).
 */
export function normalizarProtocoloExternoSql(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const limpo = String(raw).trim();
  if (!limpo || limpo === "0" || /^0+$/.test(limpo)) {
    return null;
  }
  return limpo;
}

/**
 * Saneia `Num_Livro` em `dbo.tblWRICertidaoItens` (Seção 19):
 * `0` e `99999999` são sentinelas do WEBRI para pedidos sem número de matrícula confirmado
 * (ex: busca por endereço, CPF/CNPJ, transcrição ou loteamento) e NUNCA devem ser tratados como matrícula real.
 */
export function normalizarNumeroMatriculaSql(raw: number | string | null | undefined): {
  matriculaValida: number | null;
  sentinelaDetectada: "ZERO" | "NOVES_99999999" | "INVALIDO" | null;
} {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { matriculaValida: null, sentinelaDetectada: "INVALIDO" };
  }
  const num = Number(String(raw).trim());
  if (!Number.isInteger(num) || num < 0) {
    return { matriculaValida: null, sentinelaDetectada: "INVALIDO" };
  }
  if (num === 0) {
    return { matriculaValida: null, sentinelaDetectada: "ZERO" };
  }
  if (num === 99999999 || num >= 9999999) {
    return { matriculaValida: null, sentinelaDetectada: "NOVES_99999999" };
  }
  return { matriculaValida: num, sentinelaDetectada: null };
}

export function formatarCnpjCompleto(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function mascararCnpjLgpd(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return "—";
  return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
}

/**
 * Classifica documento de participante (CPF de 11 dígitos vs CNPJ de 14 dígitos),
 * sem assumir apenas pessoa física (Seções 19 e 20).
 */
export function classificarDocumentoCpfCnpj(raw: string | null | undefined): {
  tipo: "CPF" | "CNPJ" | "OUTRO" | "NAO_INFORMADO";
  digitos: string | null;
  formatado: string | null;
  mascarado: string | null;
} {
  if (!raw) {
    return { tipo: "NAO_INFORMADO", digitos: null, formatado: null, mascarado: null };
  }
  const digits = String(raw).replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) {
    return { tipo: "NAO_INFORMADO", digitos: null, formatado: null, mascarado: null };
  }

  if (digits.length === 11) {
    const cpfOk = limparCpfReal(digits);
    const fmt = cpfOk ? formatarCpfCompleto(cpfOk) : `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    const masc = mascararCpfLgpd(digits) || `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    return { tipo: "CPF", digitos: digits, formatado: fmt, mascarado: masc };
  }

  if (digits.length === 14) {
    return {
      tipo: "CNPJ",
      digitos: digits,
      formatado: formatarCnpjCompleto(digits),
      mascarado: mascararCnpjLgpd(digits),
    };
  }

  return {
    tipo: "OUTRO",
    digitos: digits,
    formatado: String(raw).trim(),
    mascarado: `***${digits.slice(-4)}`,
  };
}

export function construirParticipanteSeguro(params: {
  nome?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  enderecoResumo?: string | null;
}): ParticipantePedido {
  const doc = classificarDocumentoCpfCnpj(params.documento);
  const emailLimpo =
    params.email && String(params.email).trim() && String(params.email).trim() !== "0"
      ? String(params.email).trim()
      : null;
  const foneLimpo =
    params.telefone && String(params.telefone).trim() && String(params.telefone).trim() !== "0"
      ? String(params.telefone).trim()
      : null;

  return {
    nome: (params.nome || "").trim() || "Não informado",
    tipoDocumento: doc.tipo,
    documentoMascarado: doc.mascarado,
    documentoFormatado: doc.formatado,
    email: emailLimpo,
    telefone: foneLimpo,
    enderecoResumo: params.enderecoResumo?.trim() || null,
  };
}

/**
 * Regra Seção 3 & 19:
 * Não presume que "Certidão Digital" ou meio "M" ("Meio Magnético") seja automaticamente
 * certidão de Inteiro Teor por número de matrícula. Exige confirmação explícita da espécie/subtipo,
 * Livro 2 (Registro Geral) e matrícula numérica válida.
 */
export function classificarSubtipoElegibilidadePiloto(params: {
  especieDescricao: string;
  subtipoExplicito?: string | null;
  livroCodigo?: number | null;
  numeroMatriculaRaw?: number | string | null;
  enderecoPesquisa?: string | null;
  transcricaoOuLoteamento?: string | null;
}): {
  subtipoConfirmado: "INTEIRO_TEOR_MATRICULA" | "NAO_CONFIRMADO" | "OUTRA_ESPECIE";
  criterioSolicitacao:
    | "MATRICULA"
    | "ENDERECO"
    | "TRANSCRICAO"
    | "LOTEAMENTO"
    | "CPF_CNPJ"
    | "NAO_IDENTIFICADO";
  elegivelPiloto: boolean;
  motivoEncaminhamentoHumano: string | null;
} {
  const mat = normalizarNumeroMatriculaSql(params.numeroMatriculaRaw);
  const descNorm = (params.especieDescricao || "").toLowerCase();
  const subNorm = (params.subtipoExplicito || "").toLowerCase();

  if (params.transcricaoOuLoteamento) {
    const isLoteamento = params.transcricaoOuLoteamento.toLowerCase().includes("loteamento");
    return {
      subtipoConfirmado: "OUTRA_ESPECIE",
      criterioSolicitacao: isLoteamento ? "LOTEAMENTO" : "TRANSCRICAO",
      elegivelPiloto: false,
      motivoEncaminhamentoHumano: isLoteamento
        ? "Pedido por loteamento: encaminhado à análise humana assistida (fora do escopo automático inicial)."
        : "Pedido por transcrição: encaminhado à análise humana assistida (acervo físico/imagem requer pesquisa específica).",
    };
  }

  if (params.enderecoPesquisa && !mat.matriculaValida) {
    return {
      subtipoConfirmado: "OUTRA_ESPECIE",
      criterioSolicitacao: "ENDERECO",
      elegivelPiloto: false,
      motivoEncaminhamentoHumano:
        "Pedido solicitado por endereço sem matrícula confirmada: encaminhado à pesquisa humana assistida de indicadores.",
    };
  }

  if (!mat.matriculaValida) {
    return {
      subtipoConfirmado: "NAO_CONFIRMADO",
      criterioSolicitacao: mat.sentinelaDetectada ? "CPF_CNPJ" : "NAO_IDENTIFICADO",
      elegivelPiloto: false,
      motivoEncaminhamentoHumano: mat.sentinelaDetectada
        ? `Sentinela cadastral detectada em Num_Livro (${mat.sentinelaDetectada}): requer identificação humana.`
        : "Número de matrícula ausente ou inválido: requer identificação humana.",
    };
  }

  if (params.livroCodigo !== undefined && params.livroCodigo !== null && params.livroCodigo !== 2) {
    return {
      subtipoConfirmado: "OUTRA_ESPECIE",
      criterioSolicitacao: "MATRICULA",
      elegivelPiloto: false,
      motivoEncaminhamentoHumano: `Item vinculado ao Livro ${params.livroCodigo} (piloto inicial restrito ao Livro 2 - Registro Geral).`,
    };
  }

  const confirmaInteiroTeor =
    subNorm === "inteiro_teor_matricula" ||
    descNorm.includes("inteiro teor") ||
    descNorm.includes("matrícula - inteiro teor");

  if (!confirmaInteiroTeor) {
    // Ex: apenas "Certidão Digital" ou "Certidão de Ônus" sem confirmação explícita de Inteiro Teor
    return {
      subtipoConfirmado: descNorm.includes("certidão digital") || descNorm.includes("certidao digital")
        ? "NAO_CONFIRMADO"
        : "OUTRA_ESPECIE",
      criterioSolicitacao: "MATRICULA",
      elegivelPiloto: false,
      motivoEncaminhamentoHumano:
        descNorm.includes("certidão digital") || descNorm.includes("certidao digital")
          ? 'Classificação genérica "Certidão Digital" sem confirmação cadastral de Inteiro Teor (Seção 3): encaminhado à conferência humana.'
          : `Espécie "${params.especieDescricao}" exige regras próprias validadas antes de automação.`,
    };
  }

  return {
    subtipoConfirmado: "INTEIRO_TEOR_MATRICULA",
    criterioSolicitacao: "MATRICULA",
    elegivelPiloto: true,
    motivoEncaminhamentoHumano: null,
  };
}

/**
 * Regra Seção 20 (Motivação e LGPD — Provimento CNJ nº 134/2022):
 * A motivação NÃO é exigida universalmente para certidão pública de inteiro teor por matrícula;
 * somente quando uma regra específica da espécie/acesso restrito exigir.
 */
export function verificarExigenciaMotivacao(params: {
  subtipoConfirmado: string | null;
  regraExigeMotivacaoExplicita?: boolean;
}): boolean {
  if (params.regraExigeMotivacaoExplicita) return true;
  return false;
}

