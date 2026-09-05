/**
 * FIORIX — Descarregamento de Staging para Tabelas Finais de Dashboard
 */
import { prisma } from '../lib/prisma';

const TENANT_ID = 'cms3xd0wm00002pw9j2k0ahan';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIORIX — DESCARREGAMENTO DE STAGING → DASHBOARD TABLES');
  console.log(`  Tenant: ${TENANT_ID}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. PRODUTIVIDADE
  console.log('1️⃣ Processando PRODUTIVIDADE...');
  const prodStart = Date.now();
  const prodResult = await prisma.$executeRawUnsafe(`
    WITH deduped AS (
      SELECT DISTINCT ON (s."tenantId", (item->>'pedido')::int, (item->>'data')::date)
        s."tenantId" AS tenant_id,
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
      FROM public."ConnectorSyncStaging" s,
      LATERAL jsonb_array_elements(s.records) AS item
      WHERE s.source = 'produtividade'
        AND item->>'pedido' IS NOT NULL
        AND item->>'data' IS NOT NULL
      ORDER BY s."tenantId", (item->>'pedido')::int, (item->>'data')::date, s."createdAt" DESC
    )
    INSERT INTO public.fiorix_produtividade_dados (
      tenant_id, data, hora, dia_semana, hora_num, pedido, nome, tipo, tipo_pedido, tipo_detalhado, quantidade
    )
    SELECT * FROM deduped
    ON CONFLICT (tenant_id, pedido, data) DO UPDATE SET
      hora = EXCLUDED.hora,
      dia_semana = EXCLUDED.dia_semana,
      hora_num = EXCLUDED.hora_num,
      nome = EXCLUDED.nome,
      tipo = EXCLUDED.tipo,
      tipo_pedido = EXCLUDED.tipo_pedido,
      tipo_detalhado = EXCLUDED.tipo_detalhado,
      quantidade = EXCLUDED.quantidade;
  `);
  console.log(`  ✅ Produtividade OK em ${Date.now() - prodStart}ms — Linhas afetadas: ${prodResult}`);

  // 2. TAREFAS
  console.log('\n2️⃣ Processando TAREFAS...');
  const tarStart = Date.now();
  const tarResult = await prisma.$executeRawUnsafe(`
    WITH deduped AS (
      SELECT DISTINCT ON (s."tenantId", item->>'ID_TAREFA')
        s."tenantId" AS tenant_id,
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
        COALESCE(item->>'NATUREZA', '') AS natureza
      FROM public."ConnectorSyncStaging" s,
      LATERAL jsonb_array_elements(s.records) AS item
      WHERE s.source = 'tarefas'
        AND item->>'ID_TAREFA' IS NOT NULL
      ORDER BY s."tenantId", item->>'ID_TAREFA', s."createdAt" DESC
    )
    INSERT INTO public.fiorix_tarefas_dados (
      tenant_id, protocolo, seq_titulo, data_entrada, dt_previsao,
      dias_para_previsao, status_previsao, nivel_risco, id_servico,
      numero_servico, item_servico, data_servico, vencimento_servico,
      id_tarefa, tarefa, data_cadastro_tarefa, status_tarefa,
      data_abertura, data_finalizacao, situacao_tarefa, id_usuario,
      responsavel, tipo, natureza
    )
    SELECT * FROM deduped
    ON CONFLICT (tenant_id, id_tarefa) DO UPDATE SET
      protocolo = EXCLUDED.protocolo,
      dt_previsao = EXCLUDED.dt_previsao,
      dias_para_previsao = EXCLUDED.dias_para_previsao,
      status_previsao = EXCLUDED.status_previsao,
      nivel_risco = EXCLUDED.nivel_risco,
      tarefa = EXCLUDED.tarefa,
      status_tarefa = EXCLUDED.status_tarefa,
      data_finalizacao = EXCLUDED.data_finalizacao,
      situacao_tarefa = EXCLUDED.situacao_tarefa,
      responsavel = EXCLUDED.responsavel;
  `);
  console.log(`  ✅ Tarefas OK em ${Date.now() - tarStart}ms — Linhas afetadas: ${tarResult}`);

  // 3. METAS
  console.log('\n3️⃣ Processando METAS...');
  const metasStart = Date.now();
  const metasResult = await prisma.$executeRawUnsafe(`
    WITH deduped AS (
      SELECT DISTINCT ON (s."tenantId", (item->>'PROTOCOLO')::int)
        s."tenantId" AS tenant_id,
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
      FROM public."ConnectorSyncStaging" s,
      LATERAL jsonb_array_elements(s.records) AS item
      WHERE s.source = 'metas'
        AND item->>'PROTOCOLO' IS NOT NULL
      ORDER BY s."tenantId", (item->>'PROTOCOLO')::int, s."createdAt" DESC
    )
    INSERT INTO public.fiorix_metas_dados (
      tenant_id, protocolo, data_apresentado, dt_previsao, dt_entrega_real,
      status, status_meta, natureza, tipo, id_natureza, magnetico,
      atraso_dias, dias_atraso, dias_corridos,
      d1_protocolo, d1_escaneamento, d2_contraditorio, d3_extrato,
      d4_qualificacao, d5_calculo, d8_impressao, d9_preparacao,
      d9_conferencia, d10_entrega, qtd_retrabalho
    )
    SELECT * FROM deduped
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
  `);
  console.log(`  ✅ Metas OK em ${Date.now() - metasStart}ms — Linhas afetadas: ${metasResult}`);

  // 4. MÓDULO BI
  console.log('\n4️⃣ Processando MÓDULO BI...');
  const biStart = Date.now();
  await prisma.fiorixBiImport.upsert({
    where: { id: 'connector-bi-sync-retroativo' },
    update: { rowsCount: 4162, status: 'SUCCESS' },
    create: {
      id: 'connector-bi-sync-retroativo',
      fileName: 'FIORIX Connector — Carga Retroativa',
      rowsCount: 4162,
      importedBy: 'FIORIX Connector',
      tenantId: TENANT_ID,
      status: 'SUCCESS'
    }
  });

  await prisma.$executeRawUnsafe(`
    DELETE FROM public.fiorix_bi_data WHERE import_id = 'connector-bi-sync-retroativo' AND tenant_id = '${TENANT_ID}';
  `);

  const biResult = await prisma.$executeRawUnsafe(`
    INSERT INTO public.fiorix_bi_data (
      id, import_id, tenant_id, "Protocolo", "DtProtocolo", "Natureza", "TipoPrenotacao",
      "DiasAtraso", "SituacaoPrazo", "IsDevolucao", "IsRegistrado", "IdAndamento"
    )
    SELECT
      gen_random_uuid()::text,
      'connector-bi-sync-retroativo',
      s."tenantId",
      COALESCE((item->>'PROTOCOLO')::text, ''),
      CASE WHEN item->>'DATA_ENTRADA' IS NOT NULL AND item->>'DATA_ENTRADA' <> '' THEN (item->>'DATA_ENTRADA')::timestamp ELSE NULL END,
      COALESCE(item->>'TIPO', ''),
      COALESCE(item->>'TIPO', ''),
      COALESCE((item->>'ATRASO_DIAS')::int, 0),
      COALESCE(item->>'STATUS', 'Em dia'),
      (item->>'SERVICO' = 'DEVOLVIDO'),
      (item->>'SERVICO' = 'REGISTRADO'),
      ROW_NUMBER() OVER ()
    FROM public."ConnectorSyncStaging" s,
    LATERAL jsonb_array_elements(s.records) AS item
    WHERE s.source = 'bi';
  `);
  console.log(`  ✅ BI OK em ${Date.now() - biStart}ms — Linhas inseridas: ${biResult}`);

  // 5. CONTAGEM FINAL NAS TABELAS
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  CONTAGEM FINAL NAS TABELAS DE DASHBOARD');
  console.log('═══════════════════════════════════════════════════════════');
  const counts = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint as count FROM public.fiorix_produtividade_dados'),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint as count FROM public.fiorix_tarefas_dados'),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint as count FROM public.fiorix_metas_dados'),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint as count FROM public.fiorix_bi_data'),
  ]);

  console.log(`  📊 fiorix_produtividade_dados : ${counts[0][0].count}`);
  console.log(`  📊 fiorix_tarefas_dados       : ${counts[1][0].count}`);
  console.log(`  📊 fiorix_metas_dados         : ${counts[2][0].count}`);
  console.log(`  📊 fiorix_bi_data             : ${counts[3][0].count}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('ERRO NO DESCARREGAMENTO:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
