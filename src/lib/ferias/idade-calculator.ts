/**
 * Utilitários puros de cálculo de idade exata (padrão Gestor de Colaboradores:
 * "XX anos, XX meses e XX dias") e formatação/mascaramento LGPD de CPF e datas.
 */

export interface IdadeDetalhada {
  anos: number;
  meses: number;
  dias: number;
  /** Ex.: "25 anos" */
  compacto: string;
  /** Ex.: "25a 10m 11d" */
  curto: string;
  /** Ex.: "25 anos, 10 meses e 11 dias" */
  extenso: string;
}

/**
 * Extrai { year, month, day } de uma string ISO ("YYYY-MM-DD" ou timestamp ISO)
 * ou formato brasileiro ("DD/MM/YYYY").
 */
export function extrairPartesData(valor?: string | null): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!valor || typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (!limpo) return null;

  // YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss...
  const isoMatch = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  // DD/MM/YYYY
  const brMatch = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  return null;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
}

function obterHojeSaoPaulo(referencia: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const isoSp = formatter.format(referencia); // YYYY-MM-DD
  const partes = extrairPartesData(isoSp);
  if (partes) return partes;
  return {
    year: referencia.getUTCFullYear(),
    month: referencia.getUTCMonth() + 1,
    day: referencia.getUTCDate(),
  };
}

/**
 * Calcula a idade exata em anos, meses e dias (idêntico ao cálculo exibido no
 * Gestor de Colaboradores: ex. nasc. 26/12/2000 em 06/11/2026 => 25 anos, 10 meses e 11 dias).
 */
export function calcularIdadeCompleta(
  dataNascimento?: string | null,
  referencia: Date = new Date()
): IdadeDetalhada | null {
  const nasc = extrairPartesData(dataNascimento);
  if (!nasc) return null;

  const hoje = obterHojeSaoPaulo(referencia);

  // Verifica se a data de nascimento está no futuro em relação à referência
  if (
    nasc.year > hoje.year ||
    (nasc.year === hoje.year && nasc.month > hoje.month) ||
    (nasc.year === hoje.year && nasc.month === hoje.month && nasc.day > hoje.day)
  ) {
    return null;
  }

  let anos = hoje.year - nasc.year;
  let meses = hoje.month - nasc.month;
  let dias = hoje.day - nasc.day;

  if (dias < 0) {
    // Empresta os dias do mês imediatamente anterior à data de referência
    const ultimoDiaMesAnterior = new Date(
      Date.UTC(hoje.year, hoje.month - 1, 0)
    ).getUTCDate();
    // Se nasceu dia 31 e o mês anterior tem 28/29/30 dias, ajusta base para não gerar negativo
    const diaBase = Math.min(nasc.day, ultimoDiaMesAnterior);
    dias = ultimoDiaMesAnterior - diaBase + hoje.day;
    meses -= 1;
  }

  if (meses < 0) {
    meses += 12;
    anos -= 1;
  }

  const labelAnos = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  const labelMeses = `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const labelDias = `${dias} ${dias === 1 ? "dia" : "dias"}`;

  return {
    anos,
    meses,
    dias,
    compacto: labelAnos,
    curto: `${anos}a ${meses}m ${dias}d`,
    extenso: `${labelAnos}, ${labelMeses} e ${labelDias}`,
  };
}

/**
 * Formata string de data ISO ou BR para DD/MM/AAAA.
 */
export function formatarDataGestorBr(valor?: string | null): string | null {
  const partes = extrairPartesData(valor);
  if (!partes) return null;
  const dd = String(partes.day).padStart(2, "0");
  const mm = String(partes.month).padStart(2, "0");
  return `${dd}/${mm}/${partes.year}`;
}

/**
 * Normaliza uma data qualquer (ISO timestamp ou DD/MM/YYYY) para YYYY-MM-DD.
 */
export function normalizarDataIso(valor?: string | Date | null): string | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    const y = valor.getUTCFullYear();
    const m = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(valor.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const partes = extrairPartesData(String(valor));
  if (!partes) return null;
  return `${partes.year}-${String(partes.month).padStart(2, "0")}-${String(partes.day).padStart(2, "0")}`;
}

/**
 * Remove pontuação do CPF e descarta CPFs fictícios de seeds antigos (ex.: 100.000.000-XX).
 */
export function limparCpfReal(cpf?: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  // Ignora placeholders sintéticos do script de seed inicial (10000000001..10000000099)
  if (/^100000000\d{2}$/.test(digits)) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;
  return digits;
}

/**
 * Formata CPF válido em 000.000.000-00.
 */
export function formatarCpfCompleto(cpf?: string | null): string | null {
  const digits = limparCpfReal(cpf);
  if (!digits) return null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Aplica máscara padrão LGPD (***.XXX.XXX-**) preservando os 6 dígitos centrais.
 */
export function mascararCpfLgpd(cpf?: string | null): string | null {
  const digits = limparCpfReal(cpf);
  if (!digits) return null;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
