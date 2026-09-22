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
  id?: number | string;
  tarefa?: string | null;
  data_finalizacao?: string | Date | null;
  data_abertura?: string | Date | null;
  data_cadastro_tarefa?: string | Date | null;
  data_servico?: string | Date | null;
  data_entrada?: string | Date | null;
  situacao_tarefa?: string | null;
  responsavel?: string | null;
  natureza?: string | null;
  tipo?: string | null;
  status_previsao?: string | null;
  dt_devolucao?: string | Date | null;
  dt_retirada?: string | Date | null;
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
  for (let i = tarefas.length - 1; i >= 0; i--) {
    const t = tarefas[i];
    if (!t.tarefa) continue;
    const nameUpper = t.tarefa.toUpperCase();
    const matchesPattern = patterns.some(p => nameUpper.includes(p.toUpperCase()));
    if (!matchesPattern) continue;
    if (requireFinished) {
      const situacaoUpper = (t.situacao_tarefa || '').toUpperCase();
      const isFinished =
        situacaoUpper === 'FINALIZADA' ||
        situacaoUpper === 'CONCLUÍDA' ||
        situacaoUpper === 'CONCLUIDA' ||
        Boolean(t.data_finalizacao);
      if (!isFinished) continue;
    }
    return t;
  }
  return undefined;
}

/**
 * Consolidação de tarefas repetidas para a mesma etapa/nome:
 * Quando houver tarefas com o mesmo nome para a mesma etapa (ex: uma em aberto e outra finalizada),
 * o sistema exibe apenas a tarefa consolidada mais recente (priorizando Finalizada),
 * evitando itens repetidos no quadro.
 */
export function consolidarTarefas<T extends RawTarefa>(tarefas: T[]): T[] {
  if (!tarefas || tarefas.length === 0) return [];

  const grupos = new Map<string, T[]>();

  for (const t of tarefas) {
    if (!t.tarefa) continue;
    const key = t.tarefa.trim().toUpperCase();
    const list = grupos.get(key) ?? [];
    list.push(t);
    grupos.set(key, list);
  }

  const isFinalizada = (t: T) => {
    const sit = (t.situacao_tarefa || '').toUpperCase();
    return (
      sit === 'FINALIZADA' ||
      sit === 'CONCLUÍDA' ||
      sit === 'CONCLUIDA' ||
      Boolean(t.data_finalizacao)
    );
  };

  const getTimestamp = (t: T) => {
    const raw = t.data_finalizacao || t.data_abertura || t.data_cadastro_tarefa || t.data_servico || t.data_entrada;
    if (!raw) return 0;
    return new Date(raw).getTime();
  };

  const resultado: T[] = [];

  for (const [, grupo] of grupos.entries()) {
    if (grupo.length === 1) {
      resultado.push(grupo[0]);
      continue;
    }

    const finalizadas = grupo.filter(isFinalizada);
    const emAberto = grupo.filter(t => !isFinalizada(t));

    // Se houver ao menos uma finalizada, descarta as duplicatas em aberto
    // e mantém a finalizada mais recente.
    if (finalizadas.length > 0) {
      finalizadas.sort((a, b) => getTimestamp(b) - getTimestamp(a));
      resultado.push(finalizadas[0]);
    } else {
      // Se todas estiverem em aberto, mantém a mais recente
      emAberto.sort((a, b) => getTimestamp(b) - getTimestamp(a));
      resultado.push(emAberto[0]);
    }
  }

  // Ordena cronologicamente para exibição coerente da trajetória
  return resultado.sort((a, b) => getTimestamp(a) - getTimestamp(b));
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
  const dtDevolucaoTarefa = [...tarefas].reverse().find(t => t.dt_devolucao)?.dt_devolucao;
  const dtRetiradaTarefa = [...tarefas].reverse().find(t => t.dt_retirada)?.dt_retirada;
  const primeiraComData = tarefas.find(t => t.data_entrada || t.data_servico);

  // Identifica a última tarefa de devolução no fluxo
  const lastDevIdx = tarefas
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => {
      const nomeUpper = (t.tarefa || '').toUpperCase();
      return nomeUpper.includes('DEVOLV') || nomeUpper.includes('DEVOLU');
    })
    .pop()?.idx ?? -1;

  // Verifica se há tarefas de fluxo subsequentes na sequência de tarefas
  const hasSubsequentTasksInArray =
    lastDevIdx >= 0 &&
    tarefas.slice(lastDevIdx + 1).some(t => {
      const nomeUpper = (t.tarefa || '').toUpperCase();
      return (
        nomeUpper.includes('SCAN') ||
        nomeUpper.includes('CONTRADIT') ||
        nomeUpper.includes('EXTRATO') ||
        nomeUpper.includes('QUALIFICA') ||
        nomeUpper.includes('CÁLCULO') ||
        nomeUpper.includes('CALCULO') ||
        nomeUpper.includes('CUSTAS') ||
        nomeUpper.includes('PAGAMENTO') ||
        nomeUpper === 'REGISTRO'
      );
    });

  // Timestamp da devolução mais recente identificada (se houver)
  const dtDevolucaoIso =
    toIso(metas?.d_balcao_devolvido) ||
    toIso(dtDevolucaoTarefa) ||
    toIso(tarefaDevolucao?.data_finalizacao) ||
    toIso(tarefaDevolucao?.data_abertura) ||
    toIso(tarefaDevolucao?.data_cadastro_tarefa);

  const devDay = dtDevolucaoIso ? dtDevolucaoIso.split('T')[0] : null;
  const hasSubsequentTasksAfterDevDay = devDay
    ? tarefas.some(t => {
        const nomeUpper = (t.tarefa || '').toUpperCase();
        if (nomeUpper.includes('DEVOLV') || nomeUpper.includes('DEVOLU')) return false;
        const ts = t.data_cadastro_tarefa || t.data_servico || t.data_abertura || t.data_finalizacao;
        if (!ts) return false;
        const day = toIso(ts)?.split('T')[0];
        return day && day > devDay;
      })
    : false;

  const hasSubsequentTasksAfterDevolucao = hasSubsequentTasksInArray || hasSubsequentTasksAfterDevDay;

  // 1. Identificar se há registro formalizado
  const hasTarefaRegistro = tarefas.some(t =>
    t.tarefa?.toUpperCase() === 'REGISTRO' &&
    ((t.situacao_tarefa || '').toUpperCase() === 'FINALIZADA' || Boolean(t.data_finalizacao))
  );

  const isRegistrado =
    bi?.IsRegistrado === true ||
    Boolean(metas?.d_balcao_registrado) ||
    Boolean(metas?.d8_impressao) ||
    metas?.status === 'REGISTRADO' ||
    hasTarefaRegistro;

  // 2. Identificar se está em devolução (apenas se não registrado e sem reingresso subsequente)
  const isDevolvido =
    !isRegistrado &&
    !hasSubsequentTasksAfterDevolucao &&
    (
      bi?.IsDevolucao === true ||
      Boolean(metas?.d_balcao_devolvido) ||
      metas?.status === 'DEVOLVIDO' ||
      Boolean(tarefaDevolucao) ||
      Boolean(dtDevolucaoTarefa)
    );

  // Mapeamento multi-origem das evidências dos 11 setores
  const evSetor1 =
    toIso(metas?.d1_protocolo) ||
    toIso(metas?.data_apresentado) ||
    toIso(primeiraComData?.data_servico) ||
    toIso(primeiraComData?.data_entrada);

  const tSetor2 = findTarefa(tarefas, ['SCANNER', 'ESCANEADO', 'ESCANER']);
  const evSetor2 =
    toIso(metas?.d1_escaneamento) ||
    toIso(tSetor2?.data_finalizacao) ||
    toIso(tSetor2?.data_abertura) ||
    toIso(tSetor2?.data_cadastro_tarefa);

  const tSetor3 = findTarefa(tarefas, ['CONTRADIT']);
  const evSetor3 =
    toIso(metas?.d2_contraditorio) ||
    toIso(tSetor3?.data_finalizacao) ||
    toIso(tSetor3?.data_abertura) ||
    toIso(tSetor3?.data_cadastro_tarefa);

  const tSetor4 = findTarefa(tarefas, ['EXTRATO']);
  const evSetor4 =
    toIso(metas?.d3_extrato) ||
    toIso(tSetor4?.data_finalizacao) ||
    toIso(tSetor4?.data_abertura) ||
    toIso(tSetor4?.data_cadastro_tarefa);

  const tSetor5 = findTarefa(tarefas, ['QUALIFICA']);
  const evSetor5 =
    toIso(metas?.d4_qualificacao) ||
    toIso(tSetor5?.data_finalizacao) ||
    toIso(tSetor5?.data_abertura) ||
    toIso(tSetor5?.data_cadastro_tarefa);

  const tSetor6 = findTarefa(tarefas, ['CÁLCULO', 'CALCULO', 'CUSTAS', 'PAGAMENTO']);
  const evSetor6 =
    toIso(metas?.d5_calculo) ||
    toIso(tSetor6?.data_finalizacao) ||
    toIso(tSetor6?.data_abertura) ||
    toIso(tSetor6?.data_cadastro_tarefa);

  const tSetor7 = findTarefa(tarefas, ['REGISTRO']);
  const evSetor7 =
    toIso(metas?.d_balcao_registrado) ||
    toIso(tSetor7?.data_finalizacao) ||
    toIso(tSetor7?.data_abertura) ||
    toIso(tSetor7?.data_cadastro_tarefa) ||
    (bi?.IsRegistrado ? 'sem_ts' : null);

  // Setor 8 só tem evidência ativa se o desfecho atual do título for DEVOLVIDO
  const evSetor8 = isDevolvido
    ? (
        dtDevolucaoIso ||
        (bi?.IsDevolucao ? 'sem_ts' : null)
      )
    : null;

  const tSetor9 = findTarefa(tarefas, ['IMPRESS']);
  const evSetor9 =
    toIso(metas?.d8_impressao) ||
    toIso(tSetor9?.data_finalizacao) ||
    toIso(tSetor9?.data_abertura) ||
    toIso(tSetor9?.data_cadastro_tarefa);

  const tSetor10 = findTarefa(tarefas, ['PREPAR', 'CONFER']);
  const evSetor10 =
    toIso(metas?.d9_preparacao) ||
    toIso(metas?.d9_conferencia) ||
    toIso(tSetor10?.data_finalizacao) ||
    toIso(tSetor10?.data_abertura) ||
    toIso(tSetor10?.data_cadastro_tarefa);

  const tSetor11 = findTarefa(tarefas, ['SAÍDA', 'SAIDA', 'ENTREGA']);
  const evSetor11 =
    toIso(metas?.d10_entrega) ||
    (isRegistrado || isDevolvido ? toIso(dtRetiradaTarefa) : null) ||
    toIso(tSetor11?.data_finalizacao) ||
    toIso(tSetor11?.data_abertura) ||
    toIso(tSetor11?.data_cadastro_tarefa);

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

  // Identificar evidência preliminar mais avançada
  let rawUltimoNum = 0;
  for (const { num, val } of evidencias) {
    if (val) rawUltimoNum = num;
  }

  let desfecho: DesfechoTitulo = 'EM_ANALISE';
  if (isDevolvido) {
    desfecho = 'DEVOLVIDO';
  } else if (isRegistrado) {
    desfecho = 'REGISTRADO';
  } else if (rawUltimoNum >= 7) {
    if (rawUltimoNum === 8 && !hasSubsequentTasksAfterDevolucao) {
      desfecho = 'DEVOLVIDO';
    } else if (rawUltimoNum !== 8) {
      desfecho = 'REGISTRADO';
    }
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
