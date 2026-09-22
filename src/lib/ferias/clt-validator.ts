/**
 * Utilitário de validação das regras legais de férias segundo a CLT (Consolidação das Leis do Trabalho)
 * e normas da Corregedoria Geral da Justiça.
 */

export interface PeriodoFeriasInput {
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
  dias: number;
}

export interface CLTValidationResult {
  valido: boolean;
  erros: string[];
  alertas: string[];
}

/**
 * Valida os períodos de férias de um colaborador conforme os artigos 134 e 135 da CLT:
 * - Art. 134 §1º: Desde que haja concordância do empregado, as férias poderão ser usufruídas em até 3 períodos,
 *   sendo que um deles não poderá ser inferior a 14 dias corridos e os demais não poderão ser inferiores a 5 dias corridos cada um.
 * - Art. 134 §3º: É vedado o início das férias no período de 2 dias que antecede feriado ou dia de repouso semanal remunerado (DSR).
 * - Soma total dos períodos deve ser compatível (normalmente até 30 dias corridos).
 */
export function validarRegrasCLTFerias(periodos: PeriodoFeriasInput[]): CLTValidationResult {
  const erros: string[] = [];
  const alertas: string[] = [];

  const periodosAtivos = periodos.filter((p) => p.inicio && p.fim && p.dias > 0);

  if (periodosAtivos.length === 0) {
    return {
      valido: false,
      erros: ['Pelo menos um período de férias deve ser informado.'],
      alertas: [],
    };
  }

  // 1. Limite de períodos (máximo 3)
  if (periodosAtivos.length > 3) {
    erros.push('A CLT (Art. 134 §1º) permite o fracionamento em no máximo 3 períodos.');
  }

  // 2. Regra de duração mínima dos períodos (Art. 134 §1º)
  if (periodosAtivos.length > 1) {
    const temAoMenos14Dias = periodosAtivos.some((p) => p.dias >= 14);
    if (!temAoMenos14Dias) {
      erros.push('Art. 134 §1º da CLT: No fracionamento, pelo menos um dos períodos não pode ser inferior a 14 dias corridos.');
    }

    const algumMenorQue5 = periodosAtivos.some((p) => p.dias < 5);
    if (algumMenorQue5) {
      erros.push('Art. 134 §1º da CLT: Nenhum dos períodos fracionados pode ser inferior a 5 dias corridos.');
    }
  }

  // 3. Regra de início que antecede repouso semanal (Art. 134 §3º)
  for (let i = 0; i < periodosAtivos.length; i++) {
    const p = periodosAtivos[i];
    const dataInicio = new Date(`${p.inicio}T12:00:00Z`);
    const diaSemana = dataInicio.getUTCDay(); // 0 = Domingo, 4 = Quinta, 5 = Sexta, 6 = Sábado

    // Se o repouso semanal for Sábado e Domingo, quinta (4) e sexta (5) antecedem em 2 dias
    if (diaSemana === 5) {
      alertas.push(`Período ${i + 1}: Início em uma Sexta-feira. Atenção ao Art. 134 §3º da CLT (vedado início nos 2 dias que antecedem DSR/final de semana).`);
    } else if (diaSemana === 4) {
      alertas.push(`Período ${i + 1}: Início em uma Quinta-feira. Avalie conformidade com o Art. 134 §3º da CLT.`);
    }
  }

  // 4. Soma total de dias
  const totalDias = periodosAtivos.reduce((acc, p) => acc + p.dias, 0);
  if (totalDias > 30) {
    erros.push(`A soma dos períodos (${totalDias} dias) excede o limite anual legal de 30 dias de férias.`);
  } else if (totalDias < 30) {
    alertas.push(`A programação totaliza ${totalDias} dias (restam ${30 - totalDias} dias de saldo para programação futura).`);
  }

  return {
    valido: erros.length === 0,
    erros,
    alertas,
  };
}
