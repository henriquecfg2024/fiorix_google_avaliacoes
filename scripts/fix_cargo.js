const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check the 189 protocols without any finalization
  // What does their data look like?
  const protos = await p.$queryRawUnsafe(`
    SELECT DISTINCT t.protocolo::int as protocolo, 
           min(t.dt_previsao) as previsao,
           min(t.data_entrada) as entrada,
           count(*)::int as num_tarefas,
           min(t.status_previsao) as status,
           min(t.data_servico) as data_servico
    FROM public.fiorix_tarefas_dados t
    WHERE t.protocolo NOT IN (
      SELECT DISTINCT protocolo FROM public.fiorix_tarefas_dados WHERE data_finalizacao IS NOT NULL
    )
    AND t.protocolo NOT IN (
      SELECT DISTINCT protocolo FROM public.fiorix_tarefas_dados WHERE situacao_tarefa = 'FINALIZADA'
    )
    AND (t.status_previsao = 'ATRASADO' OR t.status_previsao = 'ESTOURADO')
    GROUP BY t.protocolo
    ORDER BY t.protocolo
    LIMIT 50
  `);
  
  console.log('Protocolos sem nenhuma finalização E atrasados:');
  protos.forEach(p => {
    const prev = p.previsao ? new Date(p.previsao).toISOString().split('T')[0] : 'NULL';
    const ent = p.entrada ? new Date(p.entrada).toISOString().split('T')[0] : 'NULL';
    console.log(`  ${p.protocolo} | previsão: ${prev} | entrada: ${ent} | tarefas: ${p.num_tarefas} | status: ${p.status}`);
  });
  
  console.log('\nTotal encontrados:', protos.length);

  // NOW: Check if protocol 644123 has FINALIZADA tasks
  const check644 = await p.$queryRawUnsafe(`
    SELECT DISTINCT situacao_tarefa, count(*)::int as total, 
           bool_or(data_finalizacao IS NOT NULL) as tem_data_fin
    FROM public.fiorix_tarefas_dados 
    WHERE protocolo = 644123
    GROUP BY situacao_tarefa
  `);
  console.log('\n644123 breakdown por situação:');
  check644.forEach(r => console.log(`  ${r.situacao_tarefa}: ${r.total} tarefas, tem data_fin: ${r.tem_data_fin}`));

  await p.$disconnect();
})();
