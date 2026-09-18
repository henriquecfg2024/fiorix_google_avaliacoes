import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// ─── Raw types (read-only queries) ───────────────────────────────────────────

interface RawMetas {
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

interface RawBi {
  IsRegistrado: boolean | null;
  IsDevolucao: boolean | null;
  SituacaoPrazo: string | null;
}

interface RawTarefa {
  tarefa: string | null;
  data_finalizacao: string | Date | null;
  situacao_tarefa: string | null;
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

export interface TrajetoriaData {
  protocolo: number;
  natureza: string;
  tipo: string;
  status: string;
  desfecho: DesfechoTitulo;
  dataEntrada: string | null;
  ultimoSetorNum: number;    // 1–11; 0 quando sem evidência alguma
  ultimoSetorLabel: string;
  ultimoSetorEvidencia: string | null;
  temReingresso: boolean;
  setores: SetorTrajetoria[];
}

// ─── Setor definitions ────────────────────────────────────────────────────────

const SETORES_DEF: { num: number; label: string; sublabel: string }[] = [
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

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const s = String(val).trim();
  return s || null;
}

// ─── Core derivation (read-only, no side effects) ─────────────────────────────

function deriveTrajetoria(
  metas: RawMetas | null,
  bi: RawBi | null,
): {
  setores: SetorTrajetoria[];
  ultimoSetorNum: number;
  ultimoSetorEvidencia: string | null;
  desfecho: DesfechoTitulo;
} {
  // Ordered map: setor number → { evidencia ISO | 'sem_ts' (boolean flag) | null }
  const evidencias: { num: number; val: string | 'sem_ts' | null }[] = [
    { num: 1,  val: toIso(metas?.d1_protocolo) || toIso(metas?.data_apresentado) },
    { num: 2,  val: toIso(metas?.d1_escaneamento) },
    { num: 3,  val: toIso(metas?.d2_contraditorio) },
    { num: 4,  val: toIso(metas?.d3_extrato) },
    { num: 5,  val: toIso(metas?.d4_qualificacao) },
    { num: 6,  val: toIso(metas?.d5_calculo) },
    {
      num: 7,
      val: toIso(metas?.d_balcao_registrado) || (bi?.IsRegistrado ? 'sem_ts' : null),
    },
    {
      num: 8,
      val: toIso(metas?.d_balcao_devolvido) || (bi?.IsDevolucao ? 'sem_ts' : null),
    },
    { num: 9,  val: toIso(metas?.d8_impressao) },
    { num: 10, val: toIso(metas?.d9_preparacao) || toIso(metas?.d9_conferencia) },
    { num: 11, val: toIso(metas?.d10_entrega) },
  ];

  // 1. Identificar evidência preliminar mais avançada
  let rawUltimoNum = 0;
  for (const { num, val } of evidencias) {
    if (val) rawUltimoNum = num;
  }

  // 2. Determinar desfecho cartorial (REGISTRADO vs DEVOLVIDO vs EM_ANALISE)
  const isDevolvido =
    bi?.IsDevolucao === true ||
    Boolean(metas?.d_balcao_devolvido) ||
    metas?.status === 'DEVOLVIDO' ||
    rawUltimoNum === 8;

  const isRegistrado =
    bi?.IsRegistrado === true ||
    Boolean(metas?.d_balcao_registrado) ||
    Boolean(metas?.d8_impressao) ||
    metas?.status === 'REGISTRADO' ||
    rawUltimoNum === 7 ||
    rawUltimoNum === 9 ||
    (rawUltimoNum >= 10 && !isDevolvido);

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { protocolo: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

    const protocoloNum = parseInt(params.protocolo, 10);

    if (isNaN(protocoloNum) || protocoloNum <= 0 || protocoloNum > 2_147_483_647) {
      return NextResponse.json({ error: 'Número de protocolo inválido' }, { status: 400 });
    }

    const userTenantId = session.user.tenantId;
    const isMaster = session.user.role === 'MASTER';

    const [metasRows, biRows, tarefasRows] = await Promise.all([
      !isMaster && userTenantId
        ? prisma.$queryRawUnsafe<RawMetas[]>(
            `SELECT protocolo, natureza, tipo, status,
                    data_apresentado, d1_protocolo, d1_escaneamento,
                    d2_contraditorio, d3_extrato, d4_qualificacao,
                    d5_calculo, d8_impressao, d9_preparacao, d9_conferencia,
                    d10_entrega, d_balcao_registrado, d_balcao_devolvido, qtd_retrabalho
             FROM public.fiorix_metas_dados
             WHERE protocolo = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
             LIMIT 1`,
            protocoloNum,
            userTenantId
          )
        : prisma.$queryRawUnsafe<RawMetas[]>(
            `SELECT protocolo, natureza, tipo, status,
                    data_apresentado, d1_protocolo, d1_escaneamento,
                    d2_contraditorio, d3_extrato, d4_qualificacao,
                    d5_calculo, d8_impressao, d9_preparacao, d9_conferencia,
                    d10_entrega, d_balcao_registrado, d_balcao_devolvido, qtd_retrabalho
             FROM public.fiorix_metas_dados
             WHERE protocolo = $1
             LIMIT 1`,
            protocoloNum
          ),
      !isMaster && userTenantId
        ? prisma.$queryRawUnsafe<RawBi[]>(
            `SELECT "IsRegistrado", "IsDevolucao", "SituacaoPrazo"
             FROM public.fiorix_bi_data
             WHERE "Protocolo" = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
             LIMIT 1`,
            String(protocoloNum),
            userTenantId
          )
        : prisma.$queryRawUnsafe<RawBi[]>(
            `SELECT "IsRegistrado", "IsDevolucao", "SituacaoPrazo"
             FROM public.fiorix_bi_data
             WHERE "Protocolo" = $1
             LIMIT 1`,
            String(protocoloNum)
          ),
      !isMaster && userTenantId
        ? prisma.$queryRawUnsafe<RawTarefa[]>(
            `SELECT tarefa, data_finalizacao, situacao_tarefa
             FROM public.fiorix_tarefas_dados
             WHERE protocolo = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
            protocoloNum,
            userTenantId
          )
        : prisma.$queryRawUnsafe<RawTarefa[]>(
            `SELECT tarefa, data_finalizacao, situacao_tarefa
             FROM public.fiorix_tarefas_dados
             WHERE protocolo = $1`,
            protocoloNum
          ),
    ]);

    const metas = metasRows[0] ?? null;
    const bi    = biRows[0]   ?? null;

    if (!metas && tarefasRows.length === 0 && !bi) {
      return NextResponse.json(
        { error: `Protocolo ${protocoloNum} não localizado no sistema.` },
        { status: 404 }
      );
    }

    // Detect reingressos via qtd_retrabalho ou tarefas de devolução finalizadas
    const temReingresso =
      (metas?.qtd_retrabalho ?? 0) > 0 ||
      tarefasRows.some(
        t =>
          t.tarefa === 'BALCÃO DEVOLVIDO' ||
          (t.tarefa === 'CUSTAS/DEVOLUÇÃO' && t.situacao_tarefa === 'FINALIZADA')
      );

    const { setores, ultimoSetorNum, ultimoSetorEvidencia, desfecho } = deriveTrajetoria(metas, bi);

    const ultimoSetorDef = SETORES_DEF.find(s => s.num === ultimoSetorNum);
    const ultimoSetorLabel = ultimoSetorDef
      ? [ultimoSetorDef.label, ultimoSetorDef.sublabel].filter(Boolean).join(' ')
      : 'Não identificado';

    const result: TrajetoriaData = {
      protocolo:             protocoloNum,
      natureza:              metas?.natureza              ?? 'Não informada',
      tipo:                  metas?.tipo                  ?? '',
      status:                metas?.status               ?? bi?.SituacaoPrazo ?? 'Não informado',
      desfecho,
      dataEntrada:           toIso(metas?.data_apresentado) || toIso(metas?.d1_protocolo),
      ultimoSetorNum,
      ultimoSetorLabel,
      ultimoSetorEvidencia,
      temReingresso,
      setores,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('API_TRAJETORIA_ERROR:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar trajetória do título.' },
      { status: 500 }
    );
  }
}
