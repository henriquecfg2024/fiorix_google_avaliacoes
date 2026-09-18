import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import {
  deriveTrajetoria,
  toIso,
  SETORES_DEF,
  type RawMetas,
  type RawBi,
  type RawTarefa,
  type TrajetoriaData,
  type TarefaDetalhe,
} from '@/lib/trajetoria/engine';

export const dynamic = 'force-dynamic';

export type {
  DesfechoTitulo,
  SetorTrajetoria,
  TarefaDetalhe,
  TrajetoriaData,
} from '@/lib/trajetoria/engine';

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
            `SELECT id, tarefa, data_finalizacao, data_abertura, data_cadastro_tarefa,
                    data_servico, data_entrada, situacao_tarefa, responsavel,
                    natureza, tipo, status_previsao, dt_devolucao, dt_retirada
             FROM public.fiorix_tarefas_dados
             WHERE protocolo = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
             ORDER BY data_servico ASC, data_cadastro_tarefa ASC, id ASC`,
            protocoloNum,
            userTenantId
          )
        : prisma.$queryRawUnsafe<RawTarefa[]>(
            `SELECT id, tarefa, data_finalizacao, data_abertura, data_cadastro_tarefa,
                    data_servico, data_entrada, situacao_tarefa, responsavel,
                    natureza, tipo, status_previsao, dt_devolucao, dt_retirada
             FROM public.fiorix_tarefas_dados
             WHERE protocolo = $1
             ORDER BY data_servico ASC, data_cadastro_tarefa ASC, id ASC`,
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

    // Detect reingressos via qtd_retrabalho ou tarefas de devolução
    const temReingresso =
      (metas?.qtd_retrabalho ?? 0) > 0 ||
      tarefasRows.some(
        t =>
          t.tarefa === 'BALCÃO DEVOLVIDO' ||
          (t.tarefa === 'CUSTAS/DEVOLUÇÃO' && ((t.situacao_tarefa || '').toUpperCase() === 'FINALIZADA' || Boolean(t.data_finalizacao)))
      );

    const { setores, ultimoSetorNum, ultimoSetorEvidencia, desfecho } = deriveTrajetoria(
      metas,
      bi,
      tarefasRows
    );

    const ultimoSetorDef = SETORES_DEF.find(s => s.num === ultimoSetorNum);
    const ultimoSetorLabel = ultimoSetorDef
      ? [ultimoSetorDef.label, ultimoSetorDef.sublabel].filter(Boolean).join(' ')
      : 'Não identificado';

    // Metadados com fallback resiliente em tarefasRows
    const tarefaComNatureza = tarefasRows.find(t => t.natureza && t.natureza.trim() !== '');
    const tarefaComTipo = tarefasRows.find(t => t.tipo && t.tipo.trim() !== '');
    const tarefaComDevolucao = tarefasRows.find(t => t.dt_devolucao);
    const tarefaComRetirada = tarefasRows.find(t => t.dt_retirada);
    const primeiraTarefaComData = tarefasRows.find(t => t.data_entrada || t.data_servico);

    const naturezaFinal = metas?.natureza || tarefaComNatureza?.natureza || 'Não informada';
    const tipoFinal = metas?.tipo || tarefaComTipo?.tipo || '';
    const statusFinal =
      metas?.status ||
      bi?.SituacaoPrazo ||
      (desfecho === 'DEVOLVIDO' ? 'DEVOLVIDO' : desfecho === 'REGISTRADO' ? 'REGISTRADO' : 'Não informado');

    const dataEntradaFinal =
      toIso(metas?.data_apresentado) ||
      toIso(metas?.d1_protocolo) ||
      toIso(primeiraTarefaComData?.data_servico) ||
      toIso(primeiraTarefaComData?.data_entrada);

    const dtDevolucaoFinal = toIso(tarefaComDevolucao?.dt_devolucao) || toIso(metas?.d_balcao_devolvido);
    const dtRetiradaFinal = toIso(tarefaComRetirada?.dt_retirada) || toIso(metas?.d10_entrega);

    // Lista consolidada de tarefas percorridas para visualização detalhada
    const tarefasDetalhes: TarefaDetalhe[] = tarefasRows
      .filter(t => t.tarefa)
      .map(t => {
        const nome = t.tarefa || '';
        const upper = nome.toUpperCase();
        let setorNum: number | undefined;
        if (upper.includes('SCANNER') || upper.includes('ESCANE')) setorNum = 2;
        else if (upper.includes('CONTRADIT')) setorNum = 3;
        else if (upper.includes('EXTRATO')) setorNum = 4;
        else if (upper.includes('QUALIFICA')) setorNum = 5;
        else if (upper.includes('CÁLCULO') || upper.includes('CALCULO') || upper.includes('CUSTAS')) setorNum = 6;
        else if (upper === 'REGISTRO') setorNum = 7;
        else if (upper.includes('DEVOLV') || upper.includes('DEVOLU')) setorNum = 8;
        else if (upper.includes('IMPRESS')) setorNum = 9;
        else if (upper.includes('PREPAR') || upper.includes('CONFER')) setorNum = 10;
        else if (upper.includes('SAÍDA') || upper.includes('SAIDA') || upper.includes('ENTREGA')) setorNum = 11;

        return {
          tarefa: nome,
          responsavel: t.responsavel || null,
          data: toIso(t.data_finalizacao) || toIso(t.data_abertura) || toIso(t.data_cadastro_tarefa),
          situacao: t.situacao_tarefa || (t.data_finalizacao ? 'FINALIZADA' : 'AGUARDANDO'),
          setorNum,
        };
      });

    const result: TrajetoriaData = {
      protocolo:             protocoloNum,
      natureza:              naturezaFinal,
      tipo:                  tipoFinal,
      status:                statusFinal,
      desfecho,
      dataEntrada:           dataEntradaFinal,
      dtDevolucao:           dtDevolucaoFinal,
      dtRetirada:            dtRetiradaFinal,
      ultimoSetorNum,
      ultimoSetorLabel,
      ultimoSetorEvidencia,
      temReingresso,
      setores,
      tarefas:               tarefasDetalhes,
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
