import { prisma } from '@/lib/prisma';
import { refreshBiAggregatesForImport } from '@/lib/bi-aggregates';

export async function unpackLiveRecords({
  tenantId,
  source,
  records,
}: {
  tenantId: string;
  source: 'bi' | 'produtividade' | 'metas' | 'tarefas' | 'retornos' | 'impressoes';
  records: any[];
}): Promise<void> {
  if (!records || records.length === 0) return;

  const recordsJson = JSON.stringify(records);

  try {
    if (source === 'produtividade') {
      await prisma.$executeRawUnsafe(
        `
        WITH batch_records AS (
          SELECT DISTINCT ON ((item->>'pedido')::int, (item->>'data')::date)
            $1::text AS tenant_id,
            (item->>'data')::date AS data,
            COALESCE(item->>'hora', '00:00') AS hora,
            COALESCE(item->>'dia_semana', '') AS dia_semana,
            COALESCE((item->>'hora_num')::int, 0) AS hora_num,
            (item->>'pedido')::int AS pedido,
            COALESCE(item->>'nome', '') AS nome,
            COALESCE(item->>'tipo', '') AS tipo,
            COALESCE(item->>'tipo_pedido', '') AS tipo_pedido,
            COALESCE(item->>'tipo_detalhado', '') AS tipo_detalhado,
            COALESCE((item->>'quantidade')::int, 1) AS quantidade
          FROM jsonb_array_elements($2::jsonb) AS item
          WHERE item->>'pedido' IS NOT NULL AND item->>'data' IS NOT NULL
        )
        INSERT INTO public.fiorix_produtividade_dados (
          tenant_id, data, hora, dia_semana, hora_num, pedido, nome, tipo, tipo_pedido, tipo_detalhado, quantidade
        )
        SELECT * FROM batch_records
        ON CONFLICT (tenant_id, pedido, data) DO UPDATE SET
          hora = EXCLUDED.hora,
          dia_semana = EXCLUDED.dia_semana,
          hora_num = EXCLUDED.hora_num,
          nome = EXCLUDED.nome,
          tipo = EXCLUDED.tipo,
          tipo_pedido = EXCLUDED.tipo_pedido,
          tipo_detalhado = EXCLUDED.tipo_detalhado,
          quantidade = EXCLUDED.quantidade;
      `,
        tenantId,
        recordsJson
      );
    } else if (source === 'tarefas') {
      await prisma.$executeRawUnsafe(
        `
        WITH batch_records AS (
          SELECT DISTINCT ON (item->>'ID_TAREFA')
            $1::text AS tenant_id,
            (item->>'PROTOCOLO')::int AS protocolo,
            COALESCE((item->>'SEQ_TITULO')::int, 1) AS seq_titulo,
            CASE WHEN item->>'DATA_ENTRADA' IS NOT NULL AND item->>'DATA_ENTRADA' <> '' THEN (item->>'DATA_ENTRADA')::timestamp ELSE NULL END AS data_entrada,
            CASE WHEN item->>'DT_PREVISAO' IS NOT NULL AND item->>'DT_PREVISAO' <> '' THEN (item->>'DT_PREVISAO')::timestamp ELSE NULL END AS dt_previsao,
            COALESCE((item->>'DIAS_PARA_PREVISAO')::int, 0) AS dias_para_previsao,
            COALESCE(item->>'STATUS_PREVISAO', '') AS status_previsao,
            COALESCE(item->>'NIVEL_RISCO', 'NORMAL') AS nivel_risco,
            COALESCE(item->>'ID_SERVICO', '') AS id_servico,
            COALESCE(item->>'NUMERO_SERVICO', '') AS numero_servico,
            COALESCE(item->>'ITEM_SERVICO', '') AS item_servico,
            CASE WHEN item->>'DATA_SERVICO' IS NOT NULL AND item->>'DATA_SERVICO' <> '' THEN (item->>'DATA_SERVICO')::timestamp ELSE NULL END AS data_servico,
            CASE WHEN item->>'VENCIMENTO_SERVICO' IS NOT NULL AND item->>'VENCIMENTO_SERVICO' <> '' THEN (item->>'VENCIMENTO_SERVICO')::timestamp ELSE NULL END AS vencimento_servico,
            item->>'ID_TAREFA' AS id_tarefa,
            COALESCE(item->>'TAREFA', '') AS tarefa,
            CASE WHEN item->>'DATA_CADASTRO_TAREFA' IS NOT NULL AND item->>'DATA_CADASTRO_TAREFA' <> '' THEN (item->>'DATA_CADASTRO_TAREFA')::timestamp ELSE NULL END AS data_cadastro_tarefa,
            COALESCE(item->>'STATUS_TAREFA', '') AS status_tarefa,
            CASE WHEN item->>'DATA_ABERTURA' IS NOT NULL AND item->>'DATA_ABERTURA' <> '' THEN (item->>'DATA_ABERTURA')::timestamp ELSE NULL END AS data_abertura,
            CASE WHEN item->>'DATA_FINALIZACAO' IS NOT NULL AND item->>'DATA_FINALIZACAO' <> '' THEN (item->>'DATA_FINALIZACAO')::timestamp ELSE NULL END AS data_finalizacao,
            COALESCE(item->>'SITUACAO_TAREFA', '') AS situacao_tarefa,
            COALESCE(item->>'ID_USUARIO', '') AS id_usuario,
            COALESCE(item->>'RESPONSAVEL', '') AS responsavel,
            COALESCE(item->>'TIPO', '') AS tipo,
            COALESCE(item->>'NATUREZA', '') AS natureza,
            CASE WHEN COALESCE(item->>'DtRetirada', item->>'DTRetirda', item->>'dt_retirada', item->>'DT_RETIRADA') IS NOT NULL AND COALESCE(item->>'DtRetirada', item->>'DTRetirda', item->>'dt_retirada', item->>'DT_RETIRADA') <> '' THEN (COALESCE(item->>'DtRetirada', item->>'DTRetirda', item->>'dt_retirada', item->>'DT_RETIRADA'))::timestamp ELSE NULL END AS dt_retirada,
            CASE WHEN COALESCE(item->>'DtDevolucao', item->>'dt_devolucao', item->>'DT_DEVOLUCAO') IS NOT NULL AND COALESCE(item->>'DtDevolucao', item->>'dt_devolucao', item->>'DT_DEVOLUCAO') <> '' THEN (COALESCE(item->>'DtDevolucao', item->>'dt_devolucao', item->>'DT_DEVOLUCAO'))::timestamp ELSE NULL END AS dt_devolucao,
            COALESCE(item->>'NUMERO_LIVRO', item->>'LIVRO', item->>'numero_livro', item->>'MATRICULA', item->>'matricula', NULL) AS numero_livro
          FROM jsonb_array_elements($2::jsonb) AS item
          WHERE item->>'ID_TAREFA' IS NOT NULL
        )
        INSERT INTO public.fiorix_tarefas_dados (
          tenant_id, protocolo, seq_titulo, data_entrada, dt_previsao,
          dias_para_previsao, status_previsao, nivel_risco, id_servico,
          numero_servico, item_servico, data_servico, vencimento_servico,
          id_tarefa, tarefa, data_cadastro_tarefa, status_tarefa,
          data_abertura, data_finalizacao, situacao_tarefa, id_usuario,
          responsavel, tipo, natureza, dt_retirada, dt_devolucao, numero_livro
        )
        SELECT * FROM batch_records
        ON CONFLICT (tenant_id, id_tarefa) DO UPDATE SET
          protocolo = EXCLUDED.protocolo,
          dt_previsao = EXCLUDED.dt_previsao,
          dias_para_previsao = EXCLUDED.dias_para_previsao,
          status_previsao = EXCLUDED.status_previsao,
          nivel_risco = EXCLUDED.nivel_risco,
          tarefa = EXCLUDED.tarefa,
          status_tarefa = EXCLUDED.status_tarefa,
          data_abertura = COALESCE(EXCLUDED.data_abertura, public.fiorix_tarefas_dados.data_abertura),
          data_finalizacao = EXCLUDED.data_finalizacao,
          situacao_tarefa = EXCLUDED.situacao_tarefa,
          responsavel = EXCLUDED.responsavel,
          dt_retirada = EXCLUDED.dt_retirada,
          dt_devolucao = EXCLUDED.dt_devolucao,
          numero_livro = COALESCE(EXCLUDED.numero_livro, public.fiorix_tarefas_dados.numero_livro);
      `,
        tenantId,
        recordsJson
      );
    } else if (source === 'metas') {
      await prisma.$executeRawUnsafe(
        `
        WITH batch_records AS (
          SELECT DISTINCT ON ((item->>'PROTOCOLO')::int)
            $1::text AS tenant_id,
            (item->>'PROTOCOLO')::int AS protocolo,
            CASE WHEN item->>'DataDoTituloApresentado' IS NOT NULL AND item->>'DataDoTituloApresentado' <> '' THEN (item->>'DataDoTituloApresentado')::timestamp ELSE NULL END AS data_apresentado,
            CASE WHEN item->>'DtPrevisaoEntrega' IS NOT NULL AND item->>'DtPrevisaoEntrega' <> '' THEN (item->>'DtPrevisaoEntrega')::timestamp ELSE NULL END AS dt_previsao,
            CASE WHEN item->>'D10_ENTREGA' IS NOT NULL AND item->>'D10_ENTREGA' <> '' THEN (item->>'D10_ENTREGA')::timestamp ELSE NULL END AS dt_entrega_real,
            COALESCE(item->>'STATUS_MEDICAO', item->>'STATUS_META', 'EM ANDAMENTO') AS status,
            COALESCE(item->>'STATUS_META', 'NO PRAZO') AS status_meta,
            COALESCE(item->>'NATUREZA', '') AS natureza,
            COALESCE(item->>'TIPO', '') AS tipo,
            COALESCE((item->>'ID_NATUREZA')::int, 0) AS id_natureza,
            COALESCE(item->>'MAGNETICO', '') AS magnetico,
            COALESCE((item->>'DIAS_ATRASO')::int, 0) AS atraso_dias,
            COALESCE((item->>'DIAS_ATRASO')::int, 0) AS dias_atraso,
            COALESCE((item->>'DIAS_CORRIDOS')::int, 0) AS dias_corridos,
            CASE WHEN item->>'D1_PROTOCOLO' IS NOT NULL AND item->>'D1_PROTOCOLO' <> '' THEN (item->>'D1_PROTOCOLO')::timestamp ELSE NULL END AS d1_protocolo,
            CASE WHEN item->>'D1_ESCANEAMENTO' IS NOT NULL AND item->>'D1_ESCANEAMENTO' <> '' THEN (item->>'D1_ESCANEAMENTO')::timestamp ELSE NULL END AS d1_escaneamento,
            CASE WHEN item->>'D2_CONTRADITORIO' IS NOT NULL AND item->>'D2_CONTRADITORIO' <> '' THEN (item->>'D2_CONTRADITORIO')::timestamp ELSE NULL END AS d2_contraditorio,
            CASE WHEN item->>'D3_EXTRATO' IS NOT NULL AND item->>'D3_EXTRATO' <> '' THEN (item->>'D3_EXTRATO')::timestamp ELSE NULL END AS d3_extrato,
            CASE WHEN item->>'D4_QUALIFICACAO' IS NOT NULL AND item->>'D4_QUALIFICACAO' <> '' THEN (item->>'D4_QUALIFICACAO')::timestamp ELSE NULL END AS d4_qualificacao,
            CASE WHEN item->>'D5_CALCULO' IS NOT NULL AND item->>'D5_CALCULO' <> '' THEN (item->>'D5_CALCULO')::timestamp ELSE NULL END AS d5_calculo,
            CASE WHEN item->>'D8_IMPRESSAO' IS NOT NULL AND item->>'D8_IMPRESSAO' <> '' THEN (item->>'D8_IMPRESSAO')::timestamp ELSE NULL END AS d8_impressao,
            CASE WHEN item->>'D9_PREPARACAO' IS NOT NULL AND item->>'D9_PREPARACAO' <> '' THEN (item->>'D9_PREPARACAO')::timestamp ELSE NULL END AS d9_preparacao,
            CASE WHEN item->>'D9_CONFERENCIA' IS NOT NULL AND item->>'D9_CONFERENCIA' <> '' THEN (item->>'D9_CONFERENCIA')::timestamp ELSE NULL END AS d9_conferencia,
            CASE WHEN item->>'D10_ENTREGA' IS NOT NULL AND item->>'D10_ENTREGA' <> '' THEN (item->>'D10_ENTREGA')::timestamp ELSE NULL END AS d10_entrega,
            COALESCE((item->>'QTD_RETRABALHO')::int, 0) AS qtd_retrabalho
          FROM jsonb_array_elements($2::jsonb) AS item
          WHERE item->>'PROTOCOLO' IS NOT NULL
        )
        INSERT INTO public.fiorix_metas_dados (
          tenant_id, protocolo, data_apresentado, dt_previsao, dt_entrega_real,
          status, status_meta, natureza, tipo, id_natureza, magnetico,
          atraso_dias, dias_atraso, dias_corridos,
          d1_protocolo, d1_escaneamento, d2_contraditorio, d3_extrato,
          d4_qualificacao, d5_calculo, d8_impressao, d9_preparacao,
          d9_conferencia, d10_entrega, qtd_retrabalho
        )
        SELECT * FROM batch_records
        ON CONFLICT (tenant_id, protocolo) DO UPDATE SET
          data_apresentado = EXCLUDED.data_apresentado,
          dt_previsao = EXCLUDED.dt_previsao,
          dt_entrega_real = EXCLUDED.dt_entrega_real,
          status = EXCLUDED.status,
          status_meta = EXCLUDED.status_meta,
          natureza = EXCLUDED.natureza,
          tipo = EXCLUDED.tipo,
          id_natureza = EXCLUDED.id_natureza,
          magnetico = EXCLUDED.magnetico,
          atraso_dias = EXCLUDED.atraso_dias,
          dias_atraso = EXCLUDED.dias_atraso,
          dias_corridos = EXCLUDED.dias_corridos,
          d1_protocolo = EXCLUDED.d1_protocolo,
          d1_escaneamento = EXCLUDED.d1_escaneamento,
          d2_contraditorio = EXCLUDED.d2_contraditorio,
          d3_extrato = EXCLUDED.d3_extrato,
          d4_qualificacao = EXCLUDED.d4_qualificacao,
          d5_calculo = EXCLUDED.d5_calculo,
          d8_impressao = EXCLUDED.d8_impressao,
          d9_preparacao = EXCLUDED.d9_preparacao,
          d9_conferencia = EXCLUDED.d9_conferencia,
          d10_entrega = EXCLUDED.d10_entrega,
          qtd_retrabalho = EXCLUDED.qtd_retrabalho;
      `,
        tenantId,
        recordsJson
      );
    } else if (source === 'bi') {
      const liveImportId = `connector-bi-live-${tenantId}`;
      await prisma.fiorixBiImport.upsert({
        where: { id: liveImportId },
        update: {
          rowsCount: { increment: records.length },
          status: 'SUCCESS',
        },
        create: {
          id: liveImportId,
          fileName: 'FIORIX Connector — Sincronização Contínua',
          rowsCount: records.length,
          importedBy: 'FIORIX Connector',
          tenantId,
          status: 'SUCCESS',
        },
      });

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO public.fiorix_bi_data (
          id, import_id, tenant_id, "Protocolo", "DtProtocolo", "Natureza", "TipoPrenotacao",
          "DiasAtraso", "SituacaoPrazo", "IsDevolucao", "IsRegistrado", "IdAndamento"
        )
        SELECT
          gen_random_uuid()::text,
          $1::text,
          $2::text,
          COALESCE((item->>'PROTOCOLO')::text, ''),
          CASE WHEN item->>'DATA_ENTRADA' IS NOT NULL AND item->>'DATA_ENTRADA' <> '' THEN (item->>'DATA_ENTRADA')::timestamp ELSE NULL END,
          COALESCE(item->>'TIPO', ''),
          COALESCE(item->>'TIPO', ''),
          COALESCE((item->>'ATRASO_DIAS')::int, 0),
          COALESCE(item->>'STATUS', 'Em dia'),
          (item->>'SERVICO' = 'DEVOLVIDO'),
          (item->>'SERVICO' = 'REGISTRADO'),
          1
        FROM jsonb_array_elements($3::jsonb) AS item;
      `,
        liveImportId,
        tenantId,
        recordsJson
      );

      try {
        await refreshBiAggregatesForImport(liveImportId, tenantId);
      } catch (aggErr) {
        console.warn('BI_AGG_REFRESH_WARNING:', aggErr);
      }
    } else if (source === 'retornos') {
      await prisma.$executeRawUnsafe(
        `
        WITH batch_records AS (
          SELECT DISTINCT ON ((item->>'IdAndamento')::bigint)
            $1::text AS tenant_id,
            (item->>'IdAndamento')::bigint AS id_andamento,
            COALESCE((item->>'IdRecepcao')::int, (item->>'id_recepcao')::int, NULL) AS id_recepcao,
            COALESCE((item->>'NumeroPrenotacao')::int, (item->>'numero_prenotacao')::int, 0) AS numero_prenotacao,
            CASE WHEN item->>'DataRecepcao' IS NOT NULL AND item->>'DataRecepcao' <> '' THEN (item->>'DataRecepcao')::timestamptz ELSE NULL END AS data_recepcao,
            COALESCE(item->>'TipoRecepcao', item->>'tipo_recepcao', 'ENTRADA') AS tipo_recepcao,
            COALESCE(item->>'FormaTitulo', item->>'forma_titulo', '') AS forma_titulo,
            COALESCE((item->>'IdTipoRetorno')::int, (item->>'id_tipo_retorno')::int, 0) AS id_tipo_retorno,
            COALESCE(item->>'SiglaRetorno', item->>'sigla_retorno', '') AS sigla_retorno,
            COALESCE(item->>'TipoRetorno', item->>'tipo_retorno', '') AS tipo_retorno,
            CASE 
              WHEN (item->>'IdTipoRetorno')::int IN (292, 295) THEN 'Tela de recepção'
              WHEN (item->>'IdTipoRetorno')::int IN (293, 297) THEN 'Real'
              WHEN (item->>'IdTipoRetorno')::int IN (294, 296) THEN 'Pessoal'
              ELSE COALESCE(item->>'familia_retorno', 'Geral')
            END AS familia_retorno,
            CASE 
              WHEN (item->>'IdTipoRetorno')::int IN (295, 296, 297) THEN 'Corrigido'
              ELSE 'Sem marcador'
            END AS classificacao,
            CASE WHEN item->>'DataRetorno' IS NOT NULL AND item->>'DataRetorno' <> '' THEN (item->>'DataRetorno')::timestamptz ELSE NOW() END AS data_retorno,
            COALESCE(item->>'IdUsuarioOrigem', item->>'id_usuario_origem', NULL) AS id_usuario_origem,
            COALESCE(item->>'UsuarioOrigem', item->>'usuario_origem', '') AS usuario_origem,
            COALESCE(item->>'IdUsuarioDestino', item->>'id_usuario_destino', NULL) AS id_usuario_destino,
            COALESCE(item->>'UsuarioDestinoRetorno', item->>'usuario_destino_retorno', 'Não informado') AS usuario_destino_retorno,
            COALESCE(item->>'Observacao', item->>'observacao', '') AS observacao,
            COALESCE((item->>'SeqTitulo')::int, (item->>'seq_titulo')::int, 1) AS seq_titulo
          FROM jsonb_array_elements($2::jsonb) AS item
          WHERE item->>'IdAndamento' IS NOT NULL
        )
        INSERT INTO public.fiorix_retornos_dados (
          tenant_id, id_andamento, id_recepcao, numero_prenotacao, data_recepcao,
          tipo_recepcao, forma_titulo, id_tipo_retorno, sigla_retorno, tipo_retorno,
          familia_retorno, classificacao, data_retorno, id_usuario_origem, usuario_origem,
          id_usuario_destino, usuario_destino_retorno, observacao, seq_titulo,
          created_at, updated_at
        )
        SELECT 
          tenant_id, id_andamento, id_recepcao, numero_prenotacao, data_recepcao,
          tipo_recepcao, forma_titulo, id_tipo_retorno, sigla_retorno, tipo_retorno,
          familia_retorno, classificacao, data_retorno, id_usuario_origem, usuario_origem,
          id_usuario_destino, usuario_destino_retorno, observacao, seq_titulo,
          NOW(), NOW()
        FROM batch_records
        ON CONFLICT (tenant_id, id_andamento) DO UPDATE SET
          id_recepcao = EXCLUDED.id_recepcao,
          numero_prenotacao = EXCLUDED.numero_prenotacao,
          data_recepcao = EXCLUDED.data_recepcao,
          tipo_recepcao = EXCLUDED.tipo_recepcao,
          forma_titulo = EXCLUDED.forma_titulo,
          id_tipo_retorno = EXCLUDED.id_tipo_retorno,
          sigla_retorno = EXCLUDED.sigla_retorno,
          tipo_retorno = EXCLUDED.tipo_retorno,
          familia_retorno = EXCLUDED.familia_retorno,
          classificacao = EXCLUDED.classificacao,
          data_retorno = EXCLUDED.data_retorno,
          id_usuario_origem = EXCLUDED.id_usuario_origem,
          usuario_origem = EXCLUDED.usuario_origem,
          id_usuario_destino = EXCLUDED.id_usuario_destino,
          usuario_destino_retorno = EXCLUDED.usuario_destino_retorno,
          observacao = EXCLUDED.observacao,
          seq_titulo = EXCLUDED.seq_titulo,
          updated_at = NOW();
      `,
        tenantId,
        recordsJson
      );
    } else if (source === 'impressoes') {
      await prisma.$executeRawUnsafe(
        `
        WITH batch_records AS (
          SELECT DISTINCT ON ((item->>'IdAndamento')::bigint)
            $1::text AS tenant_id,
            (item->>'IdAndamento')::bigint AS id_andamento,
            COALESCE((item->>'IdRecepcao')::int, (item->>'id_recepcao')::int, NULL) AS id_recepcao,
            COALESCE((item->>'NumeroPrenotacao')::int, (item->>'numero_prenotacao')::int, 0) AS numero_prenotacao,
            COALESCE((item->>'SeqTitulo')::int, (item->>'seq_titulo')::int, 1) AS seq_titulo,
            CASE WHEN item->>'DataEntrada' IS NOT NULL AND item->>'DataEntrada' <> '' THEN (item->>'DataEntrada')::timestamptz ELSE NULL END AS data_entrada,
            COALESCE(item->>'TipoPrenotacao', item->>'tipo_prenotacao', '') AS tipo_prenotacao,
            COALESCE(item->>'Natureza', item->>'natureza', '') AS natureza,
            COALESCE(item->>'NumeroLivro', item->>'numero_livro', NULL) AS numero_livro,
            COALESCE((item->>'IdTipoAndamento')::int, (item->>'id_tipo_andamento')::int, 0) AS id_tipo_andamento,
            COALESCE(item->>'SiglaAndamento', item->>'sigla_andamento', '') AS sigla_andamento,
            COALESCE(item->>'TipoAndamento', item->>'tipo_andamento', '') AS tipo_andamento,
            COALESCE(item->>'TipoImpressao', item->>'tipo_impressao', 'LIVRO') AS tipo_impressao,
            CASE WHEN item->>'DataImpressao' IS NOT NULL AND item->>'DataImpressao' <> '' THEN (item->>'DataImpressao')::timestamptz ELSE NOW() END AS data_impressao,
            COALESCE(item->>'IdOperador', item->>'id_operador', NULL) AS id_operador,
            COALESCE(item->>'Operador', item->>'operador', '') AS operador,
            COALESCE(item->>'IdUsuarioDestino', item->>'id_usuario_destino', NULL) AS id_usuario_destino,
            COALESCE(item->>'UsuarioDestino', item->>'usuario_destino', '') AS usuario_destino,
            COALESCE(item->>'Observacao', item->>'observacao', '') AS observacao
          FROM jsonb_array_elements($2::jsonb) AS item
          WHERE item->>'IdAndamento' IS NOT NULL
        )
        INSERT INTO public.fiorix_impressoes_dados (
          tenant_id, id_andamento, id_recepcao, numero_prenotacao, seq_titulo,
          data_entrada, tipo_prenotacao, natureza, numero_livro, id_tipo_andamento,
          sigla_andamento, tipo_andamento, tipo_impressao, data_impressao,
          id_operador, operador, id_usuario_destino, usuario_destino, observacao,
          created_at, updated_at
        )
        SELECT 
          tenant_id, id_andamento, id_recepcao, numero_prenotacao, seq_titulo,
          data_entrada, tipo_prenotacao, natureza, numero_livro, id_tipo_andamento,
          sigla_andamento, tipo_andamento, tipo_impressao, data_impressao,
          id_operador, operador, id_usuario_destino, usuario_destino, observacao,
          NOW(), NOW()
        FROM batch_records
        ON CONFLICT (tenant_id, id_andamento) DO UPDATE SET
          id_recepcao = EXCLUDED.id_recepcao,
          numero_prenotacao = EXCLUDED.numero_prenotacao,
          seq_titulo = EXCLUDED.seq_titulo,
          data_entrada = EXCLUDED.data_entrada,
          tipo_prenotacao = EXCLUDED.tipo_prenotacao,
          natureza = EXCLUDED.natureza,
          numero_livro = EXCLUDED.numero_livro,
          id_tipo_andamento = EXCLUDED.id_tipo_andamento,
          sigla_andamento = EXCLUDED.sigla_andamento,
          tipo_andamento = EXCLUDED.tipo_andamento,
          tipo_impressao = EXCLUDED.tipo_impressao,
          data_impressao = EXCLUDED.data_impressao,
          id_operador = EXCLUDED.id_operador,
          operador = EXCLUDED.operador,
          id_usuario_destino = EXCLUDED.id_usuario_destino,
          usuario_destino = EXCLUDED.usuario_destino,
          observacao = EXCLUDED.observacao,
          updated_at = NOW();
      `,
        tenantId,
        recordsJson
      );
    }
  } catch (err) {
    console.error(`UNPACK_LIVE_RECORDS_ERROR [${source}]:`, err);
  }
}
