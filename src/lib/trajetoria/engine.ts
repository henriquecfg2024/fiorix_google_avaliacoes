// ─── Raw types (read-only queries) ───────────────────────────────────────────

export interface RawMetas {
  protocolo: number;
  natureza: string | null;
  tipo: string | null;
  status: string | null;
  data_apresentado: string | Date | null;
  d1_protocolo: string | Date | null;
  d1_escaneamento: string | Date | null;
  d2_contraditorio: string | Date | null;
  d3_extrato: string | Date | null;
  d4_qualificacao: string | Date | null;
  d5_calculo: string | Date | null;
  d8_impressao: string | Date | null;
  d9_preparacao: string | Date | null;
  d9_conferencia: string | Date | null;
  d10_entrega: string | Date | null;
  d_balcao_registrado: string | Date | null;
  d_balcao_devolvido: string | Date | null;
  qtd_retrabalho: number | null;
}

export interface RawBi {
  IsRegistrado: boolean | null;
  IsDevolucao: boolean | null;
  SituacaoPrazo: string | null;
}

export interface RawTarefa {
  id?: number;
  tarefa: string | null;
  data_finalizacao: string | Date | null;
  data_abertura: string | Date | null;
  data_cadastro_tarefa: string | Date | null;
  data_servico: string | Date | null;
  data_entrada: string | Date | null;
  situacao_tarefa: string | null;
  responsavel: string | null;
  natureza: string | null;
  tipo: string | null;
  status_previsao: string | null;
  dt_devolucao: string | Date | null;
  dt_retirada: string | Date | null;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type DesfechoTitulo = 'REGISTRADO' | 'DEVOLVIDO' | 'EM_ANALISE';

export interface SetorTrajetoria {
  num: number;
  label: string;
  sublabel: string;
  status: 'PERCORRIDO' | 'ATUAL' | 'FUTURO' | 'NAO_APLICAVEL';
  /** ISO timestamp da evidência — null quando a evidência é apenas um flag booleano */
  evidencia: string | null;
}

export interface TarefaDetalhe {
  tarefa: string;
  responsavel: string | null;
  data: string | null;
  situacao: string;
  setorNum?: number;
}

export interface TrajetoriaData {
  protocolo: number;
  natureza: string;
  tipo: string;
  status: string;
  desfecho: DesfechoTitulo;
  dataEntrada: string | null;
  dtDevolucao: string | null;
  dtRetirada: string | null;
  ultimoSetorNum: number;    // 1–11; 0 quando sem evidência alguma
  ultimoSetorLabel: string;
  ultimoSetorEvidencia: string | null;
  temReingresso: boolean;
  setores: SetorTrajetoria[];
  tarefas?: TarefaDetalhe[];
}

// ─── Setor definitions ────────────────────────────────────────────────────────

export const SETORES_DEF: { num: number; label: string; sublabel: string }[] = [
  { num: 1,  label: 'Entrada',             sublabel: '(Caixas)'  },
  { num: 2,  label: 'Digitalização',       sublabel: '(Escaner)' },
  { num: 3,  label: 'Contraditório',       sublabel: ''          },
  { num: 4,  label: 'Extrato',             sublabel: ''          },
  { num: 5,  label: 'Qualificação',        sublabel: ''          },
  { num: 6,  label: 'Pré-Cálculo',         sublabel: ''          },
  { num: 7,  label: 'Registro',            sublabel: ''          },
  { num: 8,  label: 'Devolução',           sublabel: ''          },
  { num: 9,  label: 'Impressão Matrícula', sublabel: ''          },
  { num: 10, label: 'Preparação',          sublabel: ''          },
  { num: 11, label: 'Saída',               sublabel: '(Caixas)'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const s = String(val).trim();
  return s || null;
}

export function findTarefa(
  tarefas: RawTarefa[],
  patterns: string[],
  requireFinished = false
): RawTarefa | undefined {
  return tarefas.find(t => {
    if (!t.tarefa) return false;
    const nameUpper = t.tarefa.toUpperCase();
    const matchesPattern = patterns.some(p => nameUpper.includes(p.toUpperCase()));
    if (!matchesPattern) return false;
    if (requireFinished) {
      const situacaoUpper = (t.situacao_tarefa || '').toUpperCase();
      return (
        situacaoUpper === 'FINALIZADA' ||
        situacaoUpper === 'CONCLUÍDA' ||
        situacaoUpper === 'CONCLUIDA' ||
        Boolean(t.data_finalizacao)
      );
    }
    return true;
  });
}

// ─── Core derivation (read-only, pure function) ──────────────────────────────

export function deriveTrajetoria(
  metas: RawMetas | null,
  bi: RawBi | null,
  tarefas: RawTarefa[] = []
): {
  setores: SetorTrajetoria[];
  ultimoSetorNum: number;
  ultimoSetorEvidencia: string | null;
  desfecho: DesfechoTitulo;
} {
  const tarefaDevolucao = findTarefa(tarefas, ['DEVOLV', 'DEVOLU']);
  const dtDevolucaoTarefa = tarefas.find(t => t.dt_devolucao)?.dt_devolucao;
  const dtRetiradaTarefa = tarefas.find(t => t.dt_retirada)?.dt_retirada;
  const primeiraComData = tarefas.find(t => t.data_entrada || t.data_servico);

  // Mapeamento multi-origem das evidências dos 11 setores
  const evSetor1 =
    toIso(metas?.d1_protocolo) ||
    toIso(metas?.data_apresentado) ||
    toIso(primeiraComData?.data_servico) ||
    toIso(primeiraComData?.data_entrada);

  const evSetor2 =
    toIso(metas?.d1_escaneamento) ||
    toIso(findTarefa(tarefas, ['SCANNER', 'ESCANEADO', 'ESCANER'], true)?.data_finalizacao) ||
    toIso(findTarefa(tarefas, ['SCANNER', 'ESCANEADO', 'ESCANER'])?.data_abertura);

  const evSetor3 =
    toIso(metas?.d2_contraditorio) ||
    toIso(findTarefa(tarefas, ['CONTRADIT'], true)?.data_finalizacao) ||
    toIso(findTarefa(tarefas, ['CONTRADIT'])?.data_abertura);

  const evSetor4 =
    toIso(metas?.d3_extrato) ||
    toIso(findTarefa(tarefas, ['EXTRATO'], true)?.data_finalizacao) ||
    toIso(findTarefa(tarefas, ['EXTRATO'])?.data_abertura);

  const evSetor5 =
    toIso(metas?.d4_qualificacao) ||
    toIso(findTarefa(tarefas, ['QUALIFICA'], true)?.data_finalizacao) ||
    toIso(findTarefa(tarefas, ['QUALIFICA'])?.data_abertura);

  const evSetor6 =
    toIso(metas?.d5_calculo) ||
    toIso(findTarefa(tarefas, ['CÁLCULO', 'CALCULO', 'CUSTAS'], true)?.data_finalizacao) ||
    toIso(findTarefa(tarefas, ['CÁLCULO', 'CALCULO', 'CUSTAS'])?.data_abertura);

  const evSetor7 =
    toIso(metas?.d_balcao_registrado) ||
    (bi?.IsRegistrado ? 'sem_ts' : null) ||
    toIso(findTarefa(tarefas, ['REGISTRO'], true)?.data_finalizacao);

  const evSetor8 =
    toIso(metas?.d_balcao_devolvido) ||
    toIso(dtDevolucaoTarefa) ||
    toIso(tarefaDevolucao?.data_finalizacao) ||
    toIso(tarefaDevolucao?.data_cadastro_tarefa) ||
    (bi?.IsDevolucao ? 'sem_ts' : null);

  const evSetor9 =
    toIso(metas?.d8_impressao) ||
    toIso(findTarefa(tarefas, ['IMPRESS'], true)?.data_finalizacao);

  const evSetor10 =
    toIso(metas?.d9_preparacao) ||
    toIso(metas?.d9_conferencia) ||
    toIso(findTarefa(tarefas, ['PREPAR', 'CONFER'], true)?.data_finalizacao);

  const evSetor11 =
    toIso(metas?.d10_entrega) ||
    toIso(dtRetiradaTarefa) ||
    toIso(findTarefa(tarefas, ['SAÍDA', 'SAIDA', 'ENTREGA'], true)?.data_finalizacao);

  // Ordered map: setor number → { evidencia ISO | 'sem_ts' (boolean flag) | null }
  const evidencias: { num: number; val: string | 'sem_ts' | null }[] = [
    { num: 1,  val: evSetor1 },
    { num: 2,  val: evSetor2 },
    { num: 3,  val: evSetor3 },
    { num: 4,  val: evSetor4 },
    { num: 5,  val: evSetor5 },
    { num: 6,  val: evSetor6 },
    { num: 7,  val: evSetor7 },
    { num: 8,  val: evSetor8 },
    { num: 9,  val: evSetor9 },
    { num: 10, val: evSetor10 },
    { num: 11, val: evSetor11 },
  ];

  // 1. Identificar evidência preliminar mais avançada
  let rawUltimoNum = 0;
  for (const { num, val } of evidencias) {
    if (val) rawUltimoNum = num;
  }

  // 2. Determinar desfecho cartorial (REGISTRADO vs DEVOLVIDO vs EM_ANALISE)
  const hasTarefaDevolucao = tarefas.some(t =>
    Boolean(t.dt_devolucao) ||
    t.tarefa?.toUpperCase().includes('DEVOLV') ||
    t.tarefa?.toUpperCase().includes('DEVOLU')
  );

  const isDevolvido =
    bi?.IsDevolucao === true ||
    Boolean(metas?.d_balcao_devolvido) ||
    metas?.status === 'DEVOLVIDO' ||
    hasTarefaDevolucao ||
    evSetor8 !== null;

  const hasTarefaRegistro = tarefas.some(t =>
    t.tarefa?.toUpperCase() === 'REGISTRO' &&
    ((t.situacao_tarefa || '').toUpperCase() === 'FINALIZADA' || Boolean(t.data_finalizacao))
  );

  const isRegistrado =
    !isDevolvido && (
      bi?.IsRegistrado === true ||
      Boolean(metas?.d_balcao_registrado) ||
      Boolean(metas?.d8_impressao) ||
      metas?.status === 'REGISTRADO' ||
      hasTarefaRegistro ||
      rawUltimoNum === 7 ||
      rawUltimoNum === 9 ||
      (rawUltimoNum >= 10 && !isDevolvido)
    );

  let desfecho: DesfechoTitulo = 'EM_ANALISE';
  if (isDevolvido) {
    desfecho = 'DEVOLVIDO';
  } else if (isRegistrado) {
    desfecho = 'REGISTRADO';
  } else if (rawUltimoNum >= 7) {
    desfecho = rawUltimoNum === 8 ? 'DEVOLVIDO' : 'REGISTRADO';
  }

  // 3. Sequência de setores ativos conforme o desfecho
  // REGISTRADO: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]  (Setor 8 Devolução NÃO percorrido)
  // DEVOLVIDO:   [1, 2, 3, 4, 5, 6, 8, 10, 11]     (Setores 7 Registro e 9 Impressão NÃO percorridos)
  // EM_ANALISE:  [1, 2, 3, 4, 5, 6]                 (Setores 7 a 11 futuros)
  const sequenciaAtiva: number[] =
    desfecho === 'DEVOLVIDO'
      ? [1, 2, 3, 4, 5, 6, 8, 10, 11]
      : desfecho === 'REGISTRADO'
      ? [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]
      : [1, 2, 3, 4, 5, 6];

  // 4. Identificar o último setor da sequência ativa que possui evidência
  let ultimoSetorNum = 0;
  let ultimoSetorEvidencia: string | null = null;

  for (const num of sequenciaAtiva) {
    const ev = evidencias.find(e => e.num === num);
    if (!ev?.val) continue;
    ultimoSetorNum = num;
    ultimoSetorEvidencia = ev.val !== 'sem_ts' ? ev.val : null;
  }

  // 5. Mapear status de cada um dos 11 setores
  const idxUltimo = sequenciaAtiva.indexOf(ultimoSetorNum);

  const setores: SetorTrajetoria[] = SETORES_DEF.map(({ num, label, sublabel }) => {
    const ev = evidencias.find(e => e.num === num);
    const evidencia = ev?.val && ev.val !== 'sem_ts' ? ev.val : null;

    // Se o setor não pertence ao fluxo deste título:
    if (!sequenciaAtiva.includes(num)) {
      if (desfecho === 'EM_ANALISE') {
        return { num, label, sublabel, status: 'FUTURO', evidencia };
      }
      return { num, label, sublabel, status: 'NAO_APLICAVEL', evidencia: null };
    }

    // O setor pertence ao fluxo ativo:
    const idxCurrent = sequenciaAtiva.indexOf(num);
    let status: SetorTrajetoria['status'] = 'FUTURO';

    if (ultimoSetorNum === 0) {
      status = 'FUTURO';
    } else if (idxCurrent < idxUltimo) {
      status = 'PERCORRIDO';
    } else if (idxCurrent === idxUltimo) {
      status = 'ATUAL';
    } else {
      status = 'FUTURO';
    }

    return { num, label, sublabel, status, evidencia };
  });

  return { setores, ultimoSetorNum, ultimoSetorEvidencia, desfecho };
}
