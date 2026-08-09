export type IndicadorTone = 'green' | 'blue' | 'amber' | 'red';

export interface IndicadorReputacao {
  icon: string;
  nome: string;
  /** Shorter label used where horizontal space is tight. */
  nomeCurto: string;
  score: number;
  status: string;
  tone: IndicadorTone;
  /** Part of the "Saúde Operacional" subset. */
  operacional: boolean;
  desc: string;
}

/** Single source of truth for the 10 indicators behind the reputation score. */
export const INDICADORES_REPUTACAO: IndicadorReputacao[] = [
  {
    icon: '🕘',
    nome: 'Horário de Atendimento',
    nomeCurto: 'Horário de Atendimento',
    score: 96,
    status: 'Excelente',
    tone: 'green',
    operacional: true,
    desc: 'Cumprimento dos horários de abertura, atendimento contínuo e pontualidade',
  },
  {
    icon: '💳',
    nome: 'Pagamento',
    nomeCurto: 'Pagamento',
    score: 93,
    status: 'Excelente',
    tone: 'green',
    operacional: true,
    desc: 'Opções de pagamento como PIX, cartão de débito/crédito e agilidade no caixa',
  },
  {
    icon: '🤝',
    nome: 'Qualidade de Atendimento',
    nomeCurto: 'Qualidade de Atendimento',
    score: 91,
    status: 'Excelente',
    tone: 'green',
    operacional: false,
    desc: 'Cordialidade, empatia e presteza da equipe de escreventes na recepção',
  },
  {
    icon: '💡',
    nome: 'Clareza de Informações',
    nomeCurto: 'Clareza de Informações',
    score: 88,
    status: 'Excelente',
    tone: 'green',
    operacional: false,
    desc: 'Orientação precisa ao cliente sobre requisitos e documentos necessários',
  },
  {
    icon: '🌟',
    nome: 'Índice de Recomendação (NPS)',
    nomeCurto: 'Índice de Recomendação',
    score: 85,
    status: 'Muito Bom',
    tone: 'blue',
    operacional: false,
    desc: 'Porcentagem de clientes promotores que elogiam ativamente a serventia',
  },
  {
    icon: '🎯',
    nome: 'Resolução no Primeiro Contato',
    nomeCurto: 'Resolução no 1º Contato',
    score: 82,
    status: 'Muito Bom',
    tone: 'blue',
    operacional: false,
    desc: 'Capacidade de resolver o ato sem exigir retornos adicionais desnecessários',
  },
  {
    icon: '📄',
    nome: 'Documentação',
    nomeCurto: 'Documentação',
    score: 59,
    status: 'Regular',
    tone: 'blue',
    operacional: true,
    desc: 'Clareza na exigência e conferência prévia da documentação apresentada',
  },
  {
    icon: '🌐',
    nome: 'Site / Agendamento',
    nomeCurto: 'Site / Agendamento',
    score: 42,
    status: 'Atenção',
    tone: 'amber',
    operacional: true,
    desc: 'Disponibilidade e facilidade de agendamento presencial no portal online',
  },
  {
    icon: '⏱️',
    nome: 'Prazo de Entrega',
    nomeCurto: 'Prazo de Entrega',
    score: 22,
    status: 'Crítico',
    tone: 'red',
    operacional: true,
    desc: 'Cumprimento do prazo prometido para devolução de títulos e certidões',
  },
  {
    icon: '🕐',
    nome: 'Fila / Espera',
    nomeCurto: 'Fila / Espera',
    score: 18,
    status: 'Crítico',
    tone: 'red',
    operacional: true,
    desc: 'Tempo de espera na fila de triagem e atendimento presencial',
  },
];

export const INDICADORES_OPERACIONAIS = INDICADORES_REPUTACAO.filter((ind) => ind.operacional);

export const SOMA_SCORE_REPUTACAO = INDICADORES_REPUTACAO.reduce((acc, ind) => acc + ind.score, 0);

export const SAUDE_REPUTACAO = Math.round(SOMA_SCORE_REPUTACAO / INDICADORES_REPUTACAO.length);

export function classificarSaude(score: number) {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Muito Bom';
  if (score >= 65) return 'Bom';
  if (score >= 50) return 'Regular';
  return 'Atenção Necessária';
}
