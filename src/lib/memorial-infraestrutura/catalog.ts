import type {
  GovernanceBoundaryItem,
  MemorialInfraEntry,
  ServerTopologySummary,
} from './types';

export const SERVERS_TOPOLOGY_7RI: ServerTopologySummary[] = [
  {
    key: 'SRVSQL',
    name: 'SRVSQL',
    ip: '10.0.0.25',
    roleTitle: 'Banco Principal WEBRI & IIS WebRI',
    specs: 'Windows Server · 10 vCPUs · 72,3 GB RAM · Vol D:\\ SQL (1,6 TB, ~60% livre)',
    engines: 'SQL Server 2012 SP4 (11.0.7507.2) + IIS (w3wp.exe)',
    currentHealthSummary: 'Saudável · CPU ~13% · PLE > 7.900 s · 0 bloqueios pelo FIORIX',
    keyMetrics: [
      { label: 'CPU Total / SQL', value: '~13% (pico anterior: 72%)' },
      { label: 'PLE (Cache RAM)', value: '> 7.900 s' },
      { label: 'Max Server Memory', value: '40.000 MB (Buffer ~49 GB)' },
      { label: 'Acesso FIORIX', value: '[fiorix_connector] Read-Only' },
    ],
  },
  {
    key: 'SRVFILES',
    name: 'SRVFILES',
    ip: '10.0.0.40',
    roleTitle: 'Servidor de Imagens (.KEN/PDF), File Server & FIORIX Connector',
    specs: 'Windows Server · 4 vCPUs · 19,5 GB RAM · C: (120 GB), D: (2 TB), E: (2 TB)',
    engines: 'FIORIX Connector v2.6.24 (NSSM + SQLite WAL + LAN :8765) + MySQL (:3306)',
    currentHealthSummary: 'Saudável · CPU reduzida de 93%–100% para ~33,6%–36% · 0 falhas na fila',
    keyMetrics: [
      { label: 'CPU Local (Expediente)', value: '~33,6%–36% (era 93%–100%)' },
      { label: 'RAM Livre', value: '~11,6 GB / 19,5 GB (60%)' },
      { label: 'Replicação ARISP', value: 'BelowNormal · 2 vCPUs dia / 4 noite' },
      { label: 'Fila SQLite WAL', value: '0 pendentes · 0 falhas' },
    ],
  },
  {
    key: 'SRVSIPLANIA',
    name: 'SRVSIPLANIA',
    ip: '10.0.0.6',
    roleTitle: 'Motor de IA & Índice Full-Text OCR (Livro 2)',
    specs: 'Windows Server · 4 vCPUs · 22 GB RAM · SSD 300 GB NVMe/SATA',
    engines: 'PostgreSQL 18 (Base SiplanIA, 17,8 GB, porta :5432)',
    currentHealthSummary: 'Saudável · 96,6% Cache Hit · Buscas GIN em < 350 ms',
    keyMetrics: [
      { label: 'Acervo OCR Indexado', value: '268.949 matrículas LV2' },
      { label: 'Páginas c/ Coordenadas', value: '867.185 páginas mapeadas' },
      { label: 'Cache Hit PostgreSQL', value: '96,6% · Busca < 350 ms' },
      { label: 'Acesso FIORIX', value: 'fiorix_reader Read-Only' },
    ],
  },
];

export const GOVERNANCE_BOUNDARIES_7RI: GovernanceBoundaryItem[] = [
  {
    id: 'gov-srvsql-ro',
    server: 'SRVSQL',
    subject: 'Login SQL [fiorix_connector] (WEBRI / GESTOR / master)',
    portOrScope: 'TCP 1433 · 10.0.0.25',
    mode: '100% Somente Leitura',
    protection:
      'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED + WITH (NOLOCK) + LOCK_TIMEOUT 2000 ms',
    notes:
      'Possui apenas VIEW SERVER STATE, VIEW ANY DEFINITION, EXECUTE nas procedures de BI/RH e SELECT nas tabelas de Pesquisa/Certidões. Nunca executa procedures da Siplan que escrevam tblWRILogOcorrencias.',
  },
  {
    id: 'gov-siplania-ro',
    server: 'SRVSIPLANIA',
    subject: 'Role PostgreSQL fiorix_reader (SiplanIA)',
    portOrScope: 'TCP 5432 · 10.0.0.6',
    mode: '100% Somente Leitura',
    protection: 'default_transaction_read_only=on · statement_timeout=10000 ms',
    notes:
      'Leitura restrita a public.matricula e public.matricula_pagina com consultas materializadas no índice GIN (LIMIT 250). Portas WMI/WinRM permanecem fechadas no firewall de 10.0.0.6.',
  },
  {
    id: 'gov-srvfiles-connector',
    server: 'SRVFILES',
    subject: 'Serviço FIORIX Connector & File Server LAN',
    portOrScope: 'Windows NSSM · HTTPS LAN :8765 · SQLite WAL',
    mode: 'Serviço Local Colocalizado',
    protection:
      'Tickets de arquivo aleatórios 256 bits (TTL 15 min) + Update OTA validado por SHA-256 + Anti-Traversal NTFS',
    notes:
      'Mantido fisicamente no SRVFILES para ler K:\\IMAGENS (.KEN/.TIF/.PDF) em disco NTFS local sem efeito trombone via SMB e sem misturar carga Node/OCR na VM do PostgreSQL 18.',
  },
  {
    id: 'gov-srvfiles-rsync',
    server: 'SRVFILES',
    subject: 'Governança de Replicação ARISP7RISP (rsync.exe)',
    portOrScope: 'Task Scheduler Windows · E:\\IMAGENS -> backup-remoto5 (:873)',
    mode: 'Controle Não-Invasivo por Tarefas SYSTEM',
    protection:
      'ARISP7RISP com MultipleInstances=IgnoreNew + Teto de 2 vCPUs (BelowNormal) no expediente',
    notes:
      'FIORIX_Governor_Rsync_Expediente (Seg–Sex 07:00–19:00 a cada 30 min) fixa Affinity=12; FIORIX_Governor_Rsync_Noite (19:30) libera Affinity=15 (4 vCPUs). Tarefa original ARISP7RISP intacta com backup XML em C:\\Backup_Tarefas.',
  },
];

export const OFFICIAL_INFRA_MEMORIAL_ENTRIES: MemorialInfraEntry[] = [
  {
    id: 'imp-2026-11-19-srvsql-siplania-central-reurb-onr',
    source: 'OFICIAL_CODIGO',
    server: 'GERAL',
    category: 'IA_OCR_PESQUISA',
    status: 'ATIVO',
    title: 'Central REURB Integrada (WEBRI + OCR SiplanIA) & Exportador ONR v1.4 Somente Leitura',
    implementedAt: '2026-11-19',
    connectorVersion: 'v2.6.25',
    summarySimple:
      'Criamos a Central REURB no FIORIX integrada em modo estritamente somente leitura ao SRVSQL (WEBRI) e ao OCR das matrículas no SRVSIPLANIA (PostgreSQL 18). Agora a equipe acompanha regularizações fundiárias por painel mensal/anual, consulta matrículas derivadas, identifica pendências antes do envio e gera arquivos JSON validados conforme o Manual ONR v1.4 — sempre revalidando ao vivo pelo Connector e bloqueando a exportação se o serviço local estiver indisponível.',
    problemBefore:
      'A conferência de lotes de Regularização Fundiária Urbana (REURB-S, REURB-E e art. 69) para o Ofício Eletrônico do ONR exigia execução manual de scripts SQL no SSMS, leitura manual de imagens/OCR de matrículas para separar áreas públicas (APMs e sistema viário) das unidades autônomas, ausência de painel histórico mensal/anual e risco de inconsistência com as regras do Manual ONR v1.4 (tipoLocalizacao, limite de 30 caracteres em bairro, datas opcionais em derivadas e remoção de derivados não autônomos).',
    solutionApplied:
      '1) No fiorix-connector (SRVFILES): consolidamos sql/reurb_onr_importar_em_lote.sql com @ModoCentral=1 e src/db/reurb-readonly.ts lendo SRVSQL\\WEBRI (readOnlyIntent, READ UNCOMMITTED, NOLOCK, LOCK_TIMEOUT 2000, gravação restrita a #temp em tempdb) e SRVSIPLANIA\\SiplanIA (fiorix_reader, default_transaction_read_only=on, busca indexada numero=ANY($1)), adicionando source opt-in reurb_regularizacoes e job reurb_revalidar; 2) No FIORIX: modelamos 5 tabelas isoladas por tenant com RLS Deny-by-Default, módulo completo Painel/Consulta/Relatórios/Exportações em /reurb, geração única/lote com revalidação obrigatória fail-closed no Connector, confirmação manual separada de protocolo no ONR e relatórios Excel (.xlsx) sanitizados.',
    metricBefore: 'Extração manual em SSMS · Sem painel/histórico · Sem validação cruzada WEBRI+OCR automática',
    metricAfter: 'Central REURB + Exportador ONR v1.4 · Revalidação WEBRI+SiplanIA ao vivo (3 registros ref. validados sem lock)',
    impactBadge: 'Central REURB + ONR v1.4 Ativos',
    technicalDetails:
      'Consultas ao SRVSQL\\WEBRI filtram atos de regularização (negócios 947 e 616) e aberturas derivadas (negócio 72) combinados à leitura indexada no SRVSIPLANIA (tabela public.matriculas via fiorix_reader) para confirmar empreendimento, bairro, exclusão de APMs/vias públicas/condomínios intermediários e sinalização de campos para revisão humana. No pacote standalone OTA v2.6.25 publicado para o SRVFILES (index.js.gz), o script canônico reurb_onr_importar_em_lote.sql vai embutido automaticamente em src/db/reurb-sql-embedded.ts durante o build:release, eliminando dependência de pasta sql/ externa. No FIORIX, todas as permissões seguem o catálogo NavPermissions V2 (reurb_central, reurb_exportar_json e reurb_confirmar_importacao), mantendo VISITANTE estritamente somente leitura.',
    commandsSnippet: `-- Verificação somente leitura das sessões de leitura REURB no SRVSQL e SRVSIPLANIA:
-- SRVSQL (WEBRI): isolamento READ UNCOMMITTED, LOCK_TIMEOUT 2000 e apenas tabelas #temp no tempdb.
SELECT session_id, status, transaction_isolation_level
FROM sys.dm_exec_sessions
WHERE program_name LIKE N'%fiorix%' OR login_name = N'fiorix_connector';

-- SRVSIPLANIA (SiplanIA PostgreSQL 18): usuário fiorix_reader em transação read-only.
SELECT usename, state, LEFT(query, 90) AS consulta
FROM pg_stat_activity
WHERE datname = 'SiplanIA' AND usename = 'fiorix_reader';`,
    rollbackPlan:
      'Desativar a flag de sincronização automática REURB no runtime directive do Connector e restringir a rota /reurb no catálogo de permissões do tenant (as tabelas fiorix_reurb_* no PostgreSQL são estritamente aditivas e o acesso ao WEBRI/SiplanIA é 100% somente leitura sem objetos persistentes).',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-19T19:15:00.000Z',
  },
  {
    id: 'imp-2026-11-18-srvsql-planguide-indices-arisp-indisp',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Plan Guide em Endereços (WEBRI) e 5 Índices Nonclustered em Tokens ARISP (ECKSISTEMAS) e Indisponibilidade CNIB',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.24',
    summarySimple:
      'Sem alterar uma única linha do sistema Siplan ou do integrador ARISP, destravamos a consulta de endereços mais pesada do WEBRI usando um guia nativo do SQL Server (Plan Guide) e criamos 5 índices cirúrgicos em tabelas de milhões de linhas de Tokens ARISP e Indisponibilidade CNIB que antes liam as tabelas inteiras do início ao fim.',
    problemBefore:
      '1) WEBRI.dbo.pr_PesquisarEnderecosPessoa (0xF76CC746F3E97A60) consumia 5,04 bilhões de leituras lógicas (869.649 páginas e 1.148 ms por chamada em 5.798 execuções = 6.391 s de CPU) por usar filtros catch-all CASE sem OPTION (RECOMPILE), ignorando o índice coberto IX_Perf_EnderecosPessoa_Cover; 2) ECKSISTEMAS.dbo.TOKENS_ARISP_RESPOSTAS (~6,55M linhas) estava em HEAP sem nenhum índice, forçando Table Scans de 23.021 páginas (192 ms a 1.085 ms por chamada, > 7.980 s de CPU acumulada); 3) WEBRI.ind.tblWRIProcessaIndisponibilidade (3,15M linhas) não possuía índice em FK_tblWRIAtualizacoesRecepcao_Id (472 ms e 31.431 páginas por chamada em 4.637 execuções).',
    solutionApplied:
      'Aplicado fora do horário de pico em 59 segundos (18:28 BRT) sem alterar procedures da Siplan: 1) Plan Guide PG_Perf_PesquisarEnderecosPessoa_Recompile (OBJECT, OPTION (RECOMPILE)) validado via sys.fn_validate_plan_guide; 2) Três índices Nonclustered em ECKSISTEMAS.dbo.TOKENS_ARISP_RESPOSTAS (IX_Perf_TokensArisp_Token, IX_Perf_TokensArisp_SnUtilizado, IX_Perf_TokensArisp_IdTabela); 3) Dois índices Nonclustered em WEBRI.ind (IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao e IX_Perf_AtualizacoesRecepcao_Protocolo) com SORT_IN_TEMPDB = ON e MAXDOP = 2.',
    metricBefore: 'Endereços: 1.148 ms (869k págs) · ARISP: 192–1.085 ms (HEAP 6,55M) · CNIB: 472 ms (31k págs)',
    metricAfter: 'Plan Guide VALIDADO + 5 índices IX_Perf_* ATIVOS (Index Seek direto < 1–3 ms; plano genérico expurgado)',
    impactBadge: '1 Plan Guide + 5 Índices em 59s',
    technicalDetails:
      'Diagnóstico executado por query_hash e XML de planos em sys.dm_exec_query_stats / sys.dm_db_missing_index_details. Script versionado em fiorix-connector/sql/otimizacao_srvsql_queries_arisp_enderecos_indisp.sql. Em WEBRI, a extração exata com CRLF final foi validada byte a byte em sys.fn_validate_plan_guide (create_date 2026-11-18 18:26:36), expurgando imediatamente o plano genérico anterior do cache; em ind.tblWRIProcessaIndisponibilidade a coluna ExecutarProcedure (tipo TEXT) foi mantida fora de INCLUDE por compatibilidade SQL Server.',
    commandsSnippet: `-- Conferência do Plan Guide e índices IX_Perf_* em SRVSQL (somente leitura):
USE [WEBRI];
SELECT pg.name, pg.is_disabled, (SELECT COUNT(*) FROM sys.fn_validate_plan_guide(pg.plan_guide_id)) AS erros_validacao
FROM sys.plan_guides pg WHERE pg.name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
SELECT OBJECT_SCHEMA_NAME(object_id) + '.' + OBJECT_NAME(object_id) AS tabela, name, type_desc
FROM sys.indexes WHERE name LIKE N'IX_Perf_%';`,
    rollbackPlan:
      'Remover o Plan Guide via sp_control_plan_guide @operation = N\'DROP\', @name = N\'PG_Perf_PesquisarEnderecosPessoa_Recompile\' e executar DROP INDEX nas 5 estruturas IX_Perf_* (bloco comentado em otimizacao_srvsql_queries_arisp_enderecos_indisp.sql; reversão instantânea em < 1s).',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T18:30:00.000Z',
  },
  {
    id: 'imp-2026-11-18-srvsql-spcm-epp-log-simple',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Saneamento do Transaction Log do Banco SPCM_EPP (75,3% LOG_BACKUP → 1,0% SIMPLE/NOTHING)',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.24',
    summarySimple:
      'O banco auxiliar SPCM_EPP (de apenas 8 MB) estava configurado para guardar todo o histórico detalhado de alterações esperando um backup de log que não existia na rotina noturna, o que mantinha o arquivo de log em 75,3% de ocupação. Fizemos um backup prévio de segurança e alinhamos o banco ao modo simples (igual ao WEBRI e ao GESTOR), baixando o uso para 1,0% em menos de 1 segundo e sem travar nenhuma estação.',
    problemBefore:
      'Banco auxiliar SPCM_EPP (8 MB de dados, 72 MB de log) criado em 11/08/2023 com RECOVERY FULL herdado do model, enquanto a política do SRVSQL executa apenas Backup FULL diário às 20:00 em E:\\Backup_SQL\\Diario\\SPCM_EPP.BAK (zero backups tipo L no msdb), mantendo log_reuse_wait = LOG_BACKUP e 75,3% (54,2 MB) do log preso.',
    solutionApplied:
      '1) Backup completo COPY_ONLY prévio (SPCM_EPP_PreAjuste_20261118.BAK) e BACKUP LOG final (SPCM_EPP_LogFinal_20261118.TRN) em E:\\Backup_SQL\\Diario\\; 2) ALTER DATABASE [SPCM_EPP] SET RECOVERY SIMPLE WITH NO_WAIT seguido de CHECKPOINT, preservando os 72 MB alocados sem DBCC SHRINKFILE para evitar fragmentação de VLFs.',
    metricBefore: 'Log em uso: 75,3% (54,2 / 72 MB) · FULL · LOG_BACKUP',
    metricAfter: 'Log em uso: 1,0% (0,82 / 71,99 MB) · SIMPLE · NOTHING',
    impactBadge: 'Log 75,3% → 1,0% em 1s',
    technicalDetails:
      'Inspeção somente leitura em sys.databases, sys.master_files e msdb.dbo.backupset confirmou rotina diária exclusivamente tipo D (20:00) em SRVSQL sem job de BACKUP LOG. A conversão para SIMPLE com backup prévio COPY_ONLY + LOG preservou integralmente a cadeia de recuperação anterior e liberou os VLFs internos via CHECKPOINT instantâneo.',
    commandsSnippet: `-- Executado com segurança no SSMS (SRVSQL):
BACKUP DATABASE [SPCM_EPP] TO DISK = N'E:\\Backup_SQL\\Diario\\SPCM_EPP_PreAjuste_20261118.BAK' WITH COPY_ONLY, INIT, STATS = 25;
BACKUP LOG [SPCM_EPP] TO DISK = N'E:\\Backup_SQL\\Diario\\SPCM_EPP_LogFinal_20261118.TRN' WITH INIT;
ALTER DATABASE [SPCM_EPP] SET RECOVERY SIMPLE WITH NO_WAIT;
USE [SPCM_EPP]; CHECKPOINT;`,
    rollbackPlan:
      'ALTER DATABASE [SPCM_EPP] SET RECOVERY FULL WITH NO_WAIT; seguido de BACKUP DATABASE completo caso futuramente seja implantada rotina agendada de BACKUP LOG.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T17:08:00.000Z',
  },
  {
    id: 'imp-2026-11-18-srvfiles-briefing-cpu-isolation',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'OBSERVABILIDADE',
    status: 'ATIVO',
    title: 'Isolamento da Medição de CPU do SRVFILES no Briefing Matinal & Reconciliação Ao Vivo (OTA v2.6.24)',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.24',
    summarySimple:
      'Mesmo depois de controlar o rsync.exe no servidor de arquivos, o painel do Briefing Matinal ainda mostrava falso alerta de 97,5% de CPU porque o próprio conector media a CPU exatamente no milissegundo em que disparava dois comandos PowerShell em paralelo. Separamos essa leitura para rodar antes dos comandos e atualizamos a reconciliação automática do painel.',
    problemBefore:
      'Em collectAndSendInfraBriefing(), SRVSQL, SRVFILES e SRVSIPLANIA iniciavam juntos em Promise.all. Os dois powershell.exe -EncodedCommand locais abertos no SRVFILES somavam carga momentânea de spawn + antivírus Kaspersky/Acronis sobre os 450 ms de sampleLocalCpuPercent(), produzindo falsos 97,5%–100% mesmo com o servidor real em ~34%. Além disso, o briefing oficial das 07:15 preservava o status CRITICAL antigo no card principal durante o restante do dia.',
    solutionApplied:
      '1) No FIORIX Connector v2.6.24 (infra-briefing-telemetry.ts), criada sampleIsolatedLocalCpuPercent(600) com 2 janelas consecutivas (mínimo filtrado) executada estritamente ANTES do Promise.all dos probes PowerShell; 2) No FIORIX SaaS (infra-briefing/store.ts), ingestInfraBriefingSample e loadInfraBriefingDashboard passaram a reconciliar automaticamente o overallStatus do dia corrente quando telemetria mais recente altera a severidade, preservando o selo Briefing Oficial 07:15.',
    metricBefore: 'Leitura pontual 97,5%–100% (falso crítico no Briefing Matinal)',
    metricAfter: 'Leitura isolada ~33%–36% em janela limpa pré-PowerShell (Status Saudável)',
    impactBadge: 'Fim de falso crítico de CPU no SRVFILES',
    technicalDetails:
      'Em SRVFILES (4 vCPUs) com rsync.exe em teto de 2 vCPUs (~34% global), spawns simultâneos de powershell.exe consomem o restante das 2 vCPUs livres por ~500 ms sob inspeção AMSI/AV. O pré-sampling antes de Promise.all elimina a interferência cruzada entre seções do coletor.',
    commandsSnippet: `# Ordem garantida no coletor v2.6.24 (src/services/infra-briefing-telemetry.ts):
# 1) preSampledSrvfilesCpu = await sampleIsolatedLocalCpuPercent(600)
# 2) Promise.all([collectSrvsqlSection(), collectSrvfilesSection(db, preSampledSrvfilesCpu), collectSrvsiplaniaSection()])`,
    rollbackPlan:
      'Reverter o manifesto OTA no repositório fiorix para v2.6.23 caso necessário retornar ao comportamento anterior de coleta paralela.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T16:30:00.000Z',
  },
  {
    id: 'imp-2026-11-18-supabase-ddl-telemetry-tuning',
    source: 'OFICIAL_CODIGO',
    server: 'GERAL',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Blindagem de DDLs em Cold Start, Índice no Expurgo SQL e Retenção de 48h no Supabase (fiorix-db)',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.23',
    summarySimple:
      'A cada inicialização rápida na nuvem (Vercel), o sistema repetia comandos de criação de estrutura no banco mesmo quando as tabelas já existiam, gerando recargas desnecessárias e varreduras pesadas ao limpar gráficos antigos. Passamos a checar antes se as tabelas já existem e otimizamos a limpeza automática, reduzindo travamentos e consumo de espaço no Supabase.',
    problemBefore:
      'Em 24h no Supabase Observability (fiorix-db): 63 slow queries (>1s) e 2,4% de erros pontuais no PostgreSQL causados por ~330 cold starts repetindo CREATE/ALTER TABLE IF NOT EXISTS (incluindo ALTER TABLE details JSONB com lock ACCESS EXCLUSIVE de até 20,47s), acionando pgrst_ddl_watch 1.153 vezes (~160s gastos em pg_timezone_names/base_types), além de 7.029 Sequential Scans no DELETE com OR em srvsql_perf_samples e 488 MB acumulados em fiorix_connector_telemetry.',
    solutionApplied:
      '1) Criada guarda somente leitura allPublicTablesExist() via pg_class nos 8 módulos de bootstrap para pular DDLs quando as tabelas já existem; 2) Flag detailsColumnInitialized corrigida para evitar ALTER TABLE em cold starts; 3) Expurgo de srvsql_perf_samples passou a rodar a cada 15 min com 2 DELETEs separados indexados por (tenant_id, observed_at DESC), e fiorix_operations_health_samples passou a filtrar tenant_id; 4) Retenção de fiorix_connector_telemetry ajustada para 48h em lotes ordenados de 1.000 linhas com limpeza em lotes e ANALYZE em produção.',
    metricBefore: '63 slow queries/24h · 1.153 reloads PostgREST · 7.029 Seq Scans em srvsql_perf_samples · telemetria 488 MB',
    metricAfter: 'Cold starts sem DDL/lock nem reload PostgREST · expurgo 100% indexado · histórico enxugado em lotes (janela 48h)',
    impactBadge: 'Zero locks DDL e Seq Scans no expurgo',
    technicalDetails:
      'Implementado helper central em src/lib/db/ddl-guard.ts consultando pg_class + pg_namespace sem disparar o event trigger ddl_command_end (pgrst_ddl_watch). Aplicado em alert-storage, ha-manager, auth-helpers, health-samples, srvsql-performance, infra-briefing, ferias-repository e memorial-infraestrutura. Em srvsql_perf_samples a remoção do filtro OR id IN (...) libera o índice composto idx_srvsql_perf_samples_tenant_observed.',
    commandsSnippet: `-- Verificação somente leitura usada pela guarda allPublicTablesExist():
SELECT COUNT(*)::int AS cnt
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname = ANY($1::text[]);

-- Limpeza em lote indexado de telemetria antiga (> 48h):
DELETE FROM public.fiorix_connector_telemetry
WHERE id IN (
  SELECT id FROM public.fiorix_connector_telemetry
  WHERE created_at < NOW() - INTERVAL '48 hours'
  ORDER BY created_at ASC
  LIMIT 1000
);`,
    rollbackPlan:
      'Reverter as alterações em src/lib/db/ddl-guard.ts e nos 8 módulos que chamam allPublicTablesExist() caso alguma migração futura dependa de DDL automático em runtime.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T15:35:00.000Z',
  },
  {
    id: 'imp-2026-11-18-srvfiles-rsync-cpu',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Saneamento Definitivo de CPU no SRVFILES (93%–100% → 33,6%–36%) e Governança Automática do Rsync ARISP',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.23',
    summarySimple:
      'O servidor de arquivos ficava lento durante o dia porque dois processos antigos do envio ARISP (rsync.exe) ficavam travados ao mesmo tempo consumindo quase toda a CPU. Encerramos apenas o processo órfão, impedimos o encavalamento às 23:50 e criamos uma regra automática para usar no máximo metade do processador durante o expediente.',
    problemBefore:
      'A tarefa ARISP7RISP estava configurada com MultipleInstances = StopExisting. Às 23:50 de 17/11/2026, o Windows encerrou apenas o processo pai de 16/11 (PID 17540) e deixou o rsync.exe filho (PID 11760) órfão rodando por > 38h junto com a nova execução (PID 14808), somando 93%–100% de CPU e elevando o consumo do Kaspersky e do SMB.',
    solutionApplied:
      '1) Backup XML fiel da tarefa ARISP7RISP em C:\\Backup_Tarefas\\; 2) Alteração na aba Settings de StopExisting para Do not start a new instance (IgnoreNew); 3) Encerramento seguro apenas do processo órfão PID 11760 preservando o envio oficial PID 14808; 4) Criação das tarefas SYSTEM FIORIX_Governor_Rsync_Expediente (Seg–Sex 07:00–19:00 a cada 30 min: BelowNormal + Affinity 12 = 2 vCPUs) e FIORIX_Governor_Rsync_Noite (19:30: Affinity 15 = 4 vCPUs).',
    metricBefore: 'CPU SRVFILES 93%–100% (2 rsync.exe paralelos)',
    metricAfter: 'CPU SRVFILES 33,6%–36% (1 rsync.exe controlado; SMB System 0,7%; Kaspersky 0,3%)',
    impactBadge: '-60% de CPU no expediente',
    technicalDetails:
      'Diagnóstico executado via Get-CimInstance Win32_Process e Get-NetTCPConnection provou ambos PIDs (11760 e 14808) conectados em 150.230.89.73:873 concorrendo no volume E:\\IMAGENS. As tarefas criadas atuam estritamente sobre processos rsync.exe já em execução sem modificar o script regulatório da ARISP. Observação lateral registrada: SyncL2 (criada em 27/10/2017 com C:\\DeltaCopy\\SyncL2.dcp) falha com 0x800702E4 em Session 0.',
    commandsSnippet: `# 1. Backup XML prévio e conferência (somente leitura)
Export-ScheduledTask -TaskName "ARISP7RISP" | Out-File "C:\\Backup_Tarefas\\ARISP7RISP_backup.xml" -Encoding utf8
Get-ScheduledTask -TaskName "FIORIX_Governor_*","ARISP7RISP" | Select-Object TaskName, State, @{N='MultipleInstances';E={$_.Settings.MultipleInstances}}

# 2. Afinidade aplicada no expediente (vCPUs 2 e 3 = máscara 12, prioridade BelowNormal)
Get-Process -Name rsync -ErrorAction SilentlyContinue | ForEach-Object {
  $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
  $_.ProcessorAffinity = [IntPtr]12
}`,
    rollbackPlan:
      'Desativar ou remover FIORIX_Governor_Rsync_Expediente e FIORIX_Governor_Rsync_Noite no Agendador de Tarefas, devolver ProcessorAffinity = [IntPtr]15 no rsync ativo e, se necessário, restaurar o XML salvo em C:\\Backup_Tarefas\\.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T14:10:00.000Z',
  },
  {
    id: 'imp-2026-11-18-srvsql-grant-pesquisa-registral',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'SEGURANCA_ACESSO',
    status: 'ATIVO',
    title: 'Liberação Granular GRANT SELECT em 29 Tabelas do WEBRI para Pesquisa Registral Híbrida',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.23',
    summarySimple:
      'Liberamos permissão estritamente de leitura nas tabelas de catálogos, localizações e pessoas do WEBRI para o login do FIORIX. Com isso, a nova tela Pesquisa Registral consulta Contribuinte, Rua, Condomínio, CPF e Contraditório direto na base oficial do cartório em milissegundos, sem gravar logs nem bloquear gravações.',
    problemBefore:
      'O login [fiorix_connector] possuía SELECT apenas em tblWRIReal, tblWRIImovel e títulos/recepção, retornando erro SQL 229 nas tabelas auxiliares (tblWRILogradouros, tblWRILocalizacao, tblWRIPessoas, tblWRIDocumentos, tblWRILivro) e impedindo o filtro estruturado completo do Indicador Real e Pessoal.',
    solutionApplied:
      'Executado em SRVSQL\\WEBRI o script fiorix-connector/sql/grant_select_pesquisa_registral_webri.sql concedendo GRANT SELECT exclusivamente em 29 tabelas auxiliares de catálogos, localizações, confrontantes, medidas, CAR, pessoas e atos ao login [fiorix_connector], mantendo isolamento READ UNCOMMITTED, WITH (NOLOCK) e LOCK_TIMEOUT 2000.',
    metricBefore: 'Erro SQL 229 em tabelas de rua/pessoa (catálogos estáticos)',
    metricAfter: '36 livros + 121 tipos carregados do WEBRI · CPF em 11 ms · Indisponibilidade em 63 ms',
    impactBadge: '100% Read-Only · 0 locks',
    technicalDetails:
      'A camada pesquisa-registral-readonly.ts nunca chama stored procedures legadas da Siplan que escrevem em tblWRILogOcorrencias (como pr_PesquisarNoIndicadorPessoal_Atual). Além disso, corrigiu o ID fallback de Transcrição para id=1 (TRA) conforme tblWRILivro real, adicionou deduplicação determinística por participação em qPessoas e travou o botão Visualizar para livros físicos (IDC/TRA/HIP/RD).',
    commandsSnippet: `-- Script oficial aplicado em SRVSQL (fiorix-connector/sql/grant_select_pesquisa_registral_webri.sql)
USE [WEBRI];
GRANT SELECT ON [dbo].[tblWRILivro] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoImovel] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRILocalizacao] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRILogradouros] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIPessoas] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIDocumentos] TO [fiorix_connector];
-- (Total de 29 tabelas estritamente SELECT para Indicador Real, Pessoal e Catálogos)`,
    rollbackPlan:
      'Executar REVOKE SELECT ON [dbo].<tabela> TO [fiorix_connector]; caso deseje revogar qualquer tabela — o sistema volta automaticamente para o modo fallback SQL 229 via SiplanIA OCR sem erro para o usuário.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T13:19:00.000Z',
  },
  {
    id: 'imp-2026-11-18-siplania-gin-materialized-pesquisa',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSIPLANIA',
    category: 'IA_OCR_PESQUISA',
    status: 'ATIVO',
    title: 'Otimização GIN Anti-TOAST (MATERIALIZED LIMIT 250) e Separação Visualizador × Pesquisa Registral',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.23',
    summarySimple:
      'Separamos a pesquisa completa de endereços, nomes e CPFs para uma nova tela dedicada (/gestao-documental/pesquisa) deixando o Visualizador focado em matrículas/arquivos. Também corrigimos um gargalo no PostgreSQL do SiplanIA quando o usuário busca palavras muito comuns (como "MOOCA"), derrubando o tempo de 10 segundos para menos de 0,2 segundo.',
    problemBefore:
      'Ao pesquisar termos de altíssima frequência no acervo de 268.949 matrículas, o PostgreSQL calculava ts_rank_cd() descomprimindo colunas TOAST textotsvector de milhares de linhas antes do LIMIT, atingindo timeout de 10.000 ms (10.278 ms na busca Contribuinte + MOOCA + A-6). Na busca lateral do Visualizador, termos textuais também traziam falso-positivos fora do arquivo digitado.',
    solutionApplied:
      '1) Reescritas as queries GIN em siplania-readonly.ts usando CTE raw_cands AS MATERIALIZED (... LIMIT 250) antes do JOIN para ordenação por ts_rank_cd e checagem de página; 2) Sempre incluir o número do Contribuinte formatado no critério FTS em pesquisa-registral-readonly.ts; 3) Removida expansão FTS automática de document-search.ts mantendo destaque amarelo OCR palavra-a-palavra e deep linking direto para a página do acerto (?matricula=...&q=...&pagina=...).',
    metricBefore: 'Contribuinte + MOOCA + A-6 em 10.278 ms (timeout parcial GIN)',
    metricAfter: 'Mesma busca em 187 ms (55x mais rápida) · Endereço completo em 341 ms',
    impactBadge: '55x mais rápido (187 ms)',
    technicalDetails:
      'Em pesquisa por logradouro+número ("Jerônimo de Mendonça 165"), a busca retorna 21 matrículas enriquecidas em 341 ms unificando resultados exclusivos do WEBRI (4), exclusivos do OCR SiplanIA (16) e confirmados em ambos (1), apontando diretamente para a ficha exata (ex.: Ficha 2 / Página 2 da Matrícula 36.931).',
    commandsSnippet: `-- Padrão de CTE adotado em public.matricula (PostgreSQL 18 / SiplanIA Read-Only)
WITH q AS (
  SELECT websearch_to_tsquery('portuguese', unaccent($1)) AS tsq
),
raw_cands AS MATERIALIZED (
  SELECT m.id::bigint AS id, m.numero::int AS numero, m.qtdpaginas::int AS qtdpaginas
  FROM public.matricula m, q
  WHERE q.tsq <> ''::tsquery AND m.textotsvector @@ q.tsq
  LIMIT 250
)
SELECT rc.id, rc.numero, rc.qtdpaginas
FROM raw_cands rc
JOIN public.matricula m2 ON m2.id = rc.id, q
ORDER BY ts_rank_cd(m2.textotsvector, q.tsq, 32) DESC LIMIT 40;`,
    rollbackPlan:
      'Reverter os commits e416d56 / 4270bd1 no branch connector-main e republicar o bundle OTA v2.6.21 se necessário.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T13:18:00.000Z',
  },
  {
    id: 'imp-2026-11-18-arquitetura-colocalizacao-connector',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'ARQUITETURA_REDE',
    status: 'DECISAO_ARQUITETURAL',
    title: 'Decisão Arquitetural: Manter FIORIX Connector Colocalizado no SRVFILES e WMI Fechado no SRVSIPLANIA',
    implementedAt: '2026-11-18',
    connectorVersion: 'v2.6.22',
    summarySimple:
      'Avaliamos tecnicamente mover o Connector do SRVFILES para o SRVSIPLANIA. Concluímos que ele DEVE permanecer no SRVFILES ao lado dos discos das imagens (.KEN e PDFs), resolvendo a CPU pelo controle do rsync. Também decidimos manter as portas administrativas WMI/WinRM fechadas no SRVSIPLANIA por segurança.',
    problemBefore:
      'Havia dúvida se migrar o Connector para o SRVSIPLANIA (10.0.0.6) eliminaria os reflexos da CPU alta do SRVFILES (93%) e se abrir WMI/WinRM entre os servidores traria ganho suficiente para compensar a exposição administrativa.',
    solutionApplied:
      'Decisão formal registrada: manter o Connector em 10.0.0.40 (consumo real de apenas ~0%–2% de CPU / ~371 MB RAM) garante leitura NTFS local sem tráfego SMB dobrado (efeito trombone) nem quebra da telemetria local MySQL :3306 / File Server :8765. Em 10.0.0.6, a observabilidade permanece exclusivamente via PostgreSQL fiorix_reader (:5432), mantendo WMI/DCOM/WinRM fechados.',
    metricBefore: 'Risco de efeito trombone SMB e mistura com VM do PostgreSQL 18',
    metricAfter: 'I/O local NTFS preservado em 10.0.0.40 + isolamento total de 10.0.0.6',
    impactBadge: 'Decisão Validada · Risco Zero',
    technicalDetails:
      'Mover o Node.js para 10.0.0.6 exigiria conta de domínio AD dedicada para leitura SMB de K:\\IMAGENS (que tem vários TB e não cabe no SSD de 300 GB de 10.0.0.6), quebraria collectSrvfilesSection (localhost / :3306 / :8765) e faria picos de decodificação UTIF/OCR competirem com o PostgreSQL 18.',
    commandsSnippet: null,
    rollbackPlan: 'Decisão arquitetural documental; nenhuma alteração destrutiva foi executada.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-18T13:25:00.000Z',
  },
  {
    id: 'imp-2026-11-17-siplania-ocr-coordenadas-gin',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSIPLANIA',
    category: 'IA_OCR_PESQUISA',
    status: 'ATIVO',
    title: 'Integração PostgreSQL 18 Read-Only (fiorix_reader), Destaque Amarelo Instantâneo LV2 e Proximidade GIN',
    implementedAt: '2026-11-17',
    connectorVersion: 'v2.6.21',
    summarySimple:
      'Conectamos o FIORIX diretamente à base de inteligência do SiplanIA (somente leitura) para reaproveitar o OCR já pronto de quase 270 mil matrículas. Quando o escrevente abre uma matrícula, os termos pesquisados acendem em amarelo na hora, sem esperar o servidor processar a imagem novamente.',
    problemBefore:
      'Sem acesso ao índice de coordenadas pré-processado, abrir e destacar termos em matrículas grandes exigia executar OCR página a página sob demanda, além de buscas com "nº" ou nomes de logradouro sofrerem colisões ou perda de precisão.',
    solutionApplied:
      'Criada role somente-leitura fiorix_reader no PostgreSQL 18 (10.0.0.6:5432), módulo siplania-readonly.ts (parse de coordenadas JSON Palavras normalizadas [0..1] por página, proximidade léxica tsquery_phrase até distância 4 no GIN e limpeza de termos como "nº"), aliado ao motor ocr_document_pages (WinRT/UTIF para páginas eventuais sem cache no banco).',
    metricBefore: 'OCR sob demanda por página + colisões numéricas em busca textual',
    metricAfter: '268.949 matrículas / 867.185 páginas disponíveis em milissegundos',
    impactBadge: 'OCR Instantâneo · 867k págs',
    technicalDetails:
      'Conexão protegida por options: -c default_transaction_read_only=on e statement_timeout=10000 ms, além de whitelist deveConsultarFullTextSiplanIa que impede consultas FTS para números puros de matrícula, CNJ, protocolo ou códigos AC/PH/IN.',
    commandsSnippet: `-- Parâmetros estritos da pool PostgreSQL 18 no FIORIX Connector
-- Host: 10.0.0.6 | Porta: 5432 | Banco: SiplanIA | User: fiorix_reader
-- Options: -c default_transaction_read_only=on -c statement_timeout=10000`,
    rollbackPlan:
      'Definir SIPLANIA_POSTGRES_ENABLED="false" no .env do Connector para desligar imediatamente a integração com o PostgreSQL 18 mantendo fallback WinRT local.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-17T22:10:00.000Z',
  },
  {
    id: 'imp-2026-11-16-briefing-matinal-3-servidores',
    source: 'OFICIAL_CODIGO',
    server: 'GERAL',
    category: 'OBSERVABILIDADE',
    status: 'ATIVO',
    title: 'Briefing Matinal Consolidado dos 3 Servidores (07:15 BRT) com Calibração Real de Memória e Bloqueios',
    implementedAt: '2026-11-16',
    connectorVersion: 'v2.6.20',
    summarySimple:
      'Criamos o painel diário de saúde da infraestrutura às 07:15 da manhã (com atualização manual a qualquer momento), reunindo SRVSQL, SRVFILES e SRVSIPLANIA em uma só tela com comparação contra o dia anterior e recomendações preventivas claras.',
    problemBefore:
      'O acompanhamento de manhã exigia abrir RDP em três servidores separados para checar SQL Server, espaços em disco, IIS, MySQL, PostgreSQL e filas, e os primeiros alertas confundiam picos momentâneos de WMI, espera ociosa (< 5s) ou buffer do SQL Server com incidentes graves.',
    solutionApplied:
      'Implementado coletor infra-briefing-telemetry.ts + engine src/lib/infra-briefing/engine.ts com calibração real do 7º RI: média móvel das 3 últimas amostras de CPU via sys.dm_os_ring_buffers, filtro de bloqueios reais >= 5s (ignorando micros bloqueios passageiros), barra de RAM dedicada mostrando reserva segura do Windows no SRVSQL (~8,1 GB livres / Buffer 40–49 GB) e sanitização de comandos WinRM/WMI.',
    metricBefore: 'Checagem manual por RDP + falsos alertas de RAM SQL e espera < 5s',
    metricAfter: 'Relatório automático 07:15 BRT comparativo D-1 em /sistema/briefing-matinal',
    impactBadge: '3 Servidores · 07:15 BRT',
    technicalDetails:
      'Coleta paralela por trigger STARTUP, SCHEDULED_0715, PERIODIC e MANUAL_REFRESH enviando snapshot ao FIORIX SaaS sem expor dados sigilosos nem textos SQL sensíveis.',
    commandsSnippet: null,
    rollbackPlan: 'Desabilitar coleta ou ajustar limiares diretamente na engine src/lib/infra-briefing/engine.ts.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-16T19:00:00.000Z',
  },
  {
    id: 'imp-2026-11-15-srvfiles-busca-cruzada-titulos',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Busca Cruzada em TITULOS-VISUALIZA e Titulos_Online + Cruzamento Protocolo → Matrícula LV2',
    implementedAt: '2026-11-15',
    connectorVersion: 'v2.6.17',
    summarySimple:
      'Ao pesquisar pelo número do protocolo no Visualizador, o sistema agora cruza automaticamente o banco do WEBRI para apontar também qual é a matrícula LV2 ligada àquele título e encontra arquivos dentro das subpastas de títulos digitais e plantas fiscais de SETORES.',
    problemBefore:
      'Buscas por protocolo de título não revelavam diretamente a matrícula do Livro 2 vinculada, e buscas repetidas podiam retornar cache antigo de até 24 horas no banco do SaaS.',
    solutionApplied:
      'Adicionado cruzamento read-only via titulos-cruzados-readonly.ts (tblWRIRecepcao / tblWRITitulosReal -> LV2), mapeamento direto de plantas em K:\\IMAGENS\\SETORES, ordenação por relevância, retenção reduzida para 2 minutos em buscas normais e botão/opção de leitura fresca forceFresh.',
    metricBefore: 'Busca isolada por nome de arquivo e cache rígido de buscas',
    metricAfter: 'Resolução automática Protocolo → Matrícula LV2 e TTL de 2 min no cache',
    impactBadge: 'Cruzamento WEBRI + K:\\',
    technicalDetails:
      'Compatível com caminhos K:\\IMAGENS\\TITULOS-VISUALIZA, K:\\IMAGENS\\Titulos_Online, K:\\IMAGENS\\LV2, K:\\IMAGENS\\LV3 e K:\\IMAGENS\\SETORES.',
    commandsSnippet: null,
    rollbackPlan: 'Parâmetros isolados no conector document-search.ts; reversível via deploy OTA.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-15T18:30:00.000Z',
  },
  {
    id: 'imp-2026-11-14-srvsql-performance-dmvs',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'OBSERVABILIDADE',
    status: 'ATIVO',
    title: 'Módulo Performance do SRVSQL, Permissão VIEW SERVER STATE e Histerese de Alertas',
    implementedAt: '2026-11-14',
    connectorVersion: 'v2.6.13',
    summarySimple:
      'Entregamos o painel contínuo de saúde do SQL Server do WEBRI mostrando consultas mais pesadas, latência real dos arquivos de banco (.mdf/.ldf), tamanho dos logs de transação, cadeias de bloqueio e serviços do Windows, tudo com zero impacto para quem está lavrando atos no sistema.',
    problemBefore:
      'Sem VIEW SERVER STATE nem coletor por deltas, não havia histórico de gargalos no SQL Server 2012 SP4 (SRVSQL), tampouco correlação de bloqueios por sessão WebRI/SSMS ou filtragem de esperas ociosas normais.',
    solutionApplied:
      'Concedida permissão mínima somente-leitura VIEW SERVER STATE + VIEW ANY DEFINITION ao login [fiorix_connector] (sem sysadmin); implementadas DMVs compatíveis com SQL Server 2012 SP4 (READ UNCOMMITTED, TOP 150, LOCK_TIMEOUT 2000), cálculo por delta de Wait Stats e File I/O, filtro de >70 waits benignos (BENIGN_IDLE_WAIT_TYPES), alertas com histerese dinâmica e retenção automática de 14 dias no PostgreSQL do FIORIX.',
    metricBefore: 'Sem telemetria histórica DMV nem visibilidade de cadeias de bloqueio',
    metricAfter: 'Amostragem leve de ~25–38 ms com histórico de 14 dias e histerese anti-ruído',
    impactBadge: 'Coleta DMV em ~38 ms',
    technicalDetails:
      'Consultas no painel do FIORIX leem apenas o cache próprio (tabelas srvsql_perf_samples, srvsql_perf_incidents e srvsql_perf_config protegidas com RLS deny-all externo) sem disparar queries por usuário no SRVSQL.',
    commandsSnippet: `-- Permissões mínimas aplicadas em SRVSQL (somente leitura, sem sysadmin)
USE [master];
GRANT VIEW SERVER STATE TO [fiorix_connector];
GRANT VIEW ANY DEFINITION TO [fiorix_connector];`,
    rollbackPlan: 'Executar REVOKE VIEW SERVER STATE / VIEW ANY DEFINITION TO [fiorix_connector] em master.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-14T20:00:00.000Z',
  },
  {
    id: 'imp-2026-11-13-connector-realtime-signed-storage-bundle',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'ALTA_DISPONIBILIDADE',
    status: 'ATIVO',
    title: 'Canal Realtime Wakeup, Offload por Signed Storage e Empacotamento Único ESM (v2.6.16)',
    implementedAt: '2026-11-13',
    connectorVersion: 'v2.6.16',
    summarySimple:
      'Eliminamos o atraso de espera por polling periódico conectando o Connector em canal de despertar em tempo real, adicionamos transferência via Storage assinado para acesso externo seguro e unificamos o executável em arquivo único para o serviço Windows nunca falhar por arquivo quebrado.',
    problemBefore:
      'Consultas de documentos dependiam de ciclos fixos de polling quando o servidor estava ocioso, e builds divididos em chunk-*.js podiam causar inconsistência durante atualizações automáticas via NSSM.',
    solutionApplied:
      'Adicionado realtime-wakeup-client.ts, pipeline ephemeral-storage.ts com URLs temporárias assinadas e limpeza garantida, além da configuração tsup --no-splitting gerando exclusivamente dist/index.js único sem chunk-*.js.',
    metricBefore: 'Espera fixa de polling + risco de chunks órfãos no update OTA',
    metricAfter: 'Despertar instantâneo Realtime + bundle único ESM validado em CI',
    impactBadge: 'Latência sub-segundo + Bundle único',
    technicalDetails:
      'O script build-release-bundle.mjs empacota o arquivo único com hash SHA-256 em src/lib/connector/release-artifact/manifest.json.',
    commandsSnippet: null,
    rollbackPlan: 'Promover artefato anterior validado no painel /sistema/operacoes.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-13T21:00:00.000Z',
  },
  {
    id: 'imp-2026-11-12-srvsql-memoria-indices-deltahash',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Calibração de Memória SQL (40.000 MB), Índices IX_Perf_* e Sync Delta-Hash de Certidões',
    implementedAt: '2026-11-12',
    connectorVersion: 'v2.6.12',
    summarySimple:
      'Mantivemos o limite seguro de memória no SQL Server para sobrar RAM livre para o Windows e o WebRI, acompanhamos o uso dos índices de performance IX_Perf_* e reduzimos drasticamente o tráfego de rede enviando apenas pedidos de certidão que realmente mudaram (Delta-Hash).',
    problemBefore:
      'Sem cálculo de hash incremental em certidões, grandes lotes até 1.500 registros reenviavam pedidos inalterados a cada ciclo, e era preciso garantir reserva confortável de sistema operacional acima dos 40 GB alocados ao SQL Server.',
    solutionApplied:
      'Confirmado max server memory = 40.000 MB (mantendo ~8,1 GB livres no Windows do SRVSQL e PLE saudável > 7.000 s), monitoramento contínuo de seeks em sys.indexes LIKE IX_Perf_% e introdução de hash por registro em cartorio_virtual_certidoes evitando reenvios redundantes ao FIORIX SaaS.',
    metricBefore: 'Reenvio integral de lotes certidões e falta de medição IX_Perf_*',
    metricAfter: 'PLE > 7.900 s · 0 memoryGrantsPending · Sync incremental apenas de deltas',
    impactBadge: 'PLE > 7.900s · Economia de rede',
    technicalDetails:
      'Diagnósticos de memória seguem a regra de evidência comprovada (memoryGrantsPending > 0, RESOURCE_SEMAPHORE ou processPhysicalMemoryLow), sem confundir alocação normal do Buffer Pool (80–88%) com falta de RAM.',
    commandsSnippet: null,
    rollbackPlan: 'Ajustável via FORCE_FULL_SYNC ou janela de reconciliação no .env do Connector.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-12T19:00:00.000Z',
  },
  {
    id: 'imp-2026-11-10-srvsql-cartorio-virtual-rh-2012',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'SEGURANCA_ACESSO',
    status: 'ATIVO',
    title: 'Extração Somente-Leitura do Cartório Virtual (Certidões/Contraditório) e Procedure RH no GESTOR',
    implementedAt: '2026-11-10',
    connectorVersion: 'v2.6.6',
    summarySimple:
      'Automatizamos a leitura segura de pedidos de certidão, cotas (tblWRICertidaoCotas) e alertas de contraditório direto do WEBRI para o módulo Cartório Virtual do FIORIX, além da sincronização de colaboradores da base GESTOR compatível com SQL Server 2012.',
    problemBefore:
      'Equipes precisavam consultar manualmente no WebRI o andamento de cotas e contraditório de cada pedido, e a procedure inicial do GESTOR falhava no SQL Server 2012 SP4 por diferenças de esquema/sintaxe.',
    solutionApplied:
      'Implementado extrator read-only cartorio_virtual_certidoes com enriquecimento de metadados (NumRPS, GerarNfe, CodigoAcesso, Atendente, AssinaONR, Contraditório e Cotas sem falso represamento em trânsito) e ajustada fiorix-connector/sql/pr_Fiorix_RH_Colaboradores.sql para compatibilidade exata com SQL Server 2012 SP4.',
    metricBefore: 'Falha SQL 421 / incompatibilidade 2012 SP4 e consulta manual de certidões',
    metricAfter: 'Lote estável até 1.500 registros c/ detalhes de contraditório e RH automático',
    impactBadge: 'SQL 2012 SP4 · Lote 1.500',
    technicalDetails:
      'Caso falte permissão GRANT SELECT no GESTOR, o agendador do RH entra em modo silencioso sem degradar a saúde geral do Connector.',
    commandsSnippet: null,
    rollbackPlan: 'Desabilitar fonte específica no scheduler sem afetar o módulo documental nem o BI.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-10T18:00:00.000Z',
  },
  {
    id: 'imp-2026-11-08-srvfiles-ha-hot-standby-updater',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'ALTA_DISPONIBILIDADE',
    status: 'ATIVO',
    title: 'Arquitetura Hot-Standby HA, Diretivas Remotas e Auto-Updater Assinado SHA-256 (v2.6.0–v2.6.2)',
    implementedAt: '2026-11-08',
    connectorVersion: 'v2.6.2',
    summarySimple:
      'Implementamos suporte a múltiplos conectores (Ativo + Reserva Hot-Standby), controle remoto seguro pela Central de Operações e atualização automática validada criptograficamente por SHA-256 sem risco do serviço se matar no meio da troca de versão.',
    problemBefore:
      'Atualizar o Connector exigia acesso remoto manual no SRVFILES, e tentativas de reiniciar o serviço NSSM de dentro do próprio processo filho podiam deixar o serviço parado no meio do update.',
    solutionApplied:
      'Criados ha-manager.ts, runtime-directive.ts e self-updater.ts com verificação strict SHA-256 contra o manifest oficial, backup automático antes da substituição e disparo isolado via Win32_Process.Create fora da árvore NSSM, além de proteção contra BOM UTF-8 ao ler update-status.json.',
    metricBefore: 'Deploy 100% manual via RDP + risco de serviço travado no restart NSSM',
    metricAfter: 'Auto-update OTA verificado por SHA-256 + Failover Hot-Standby disponível',
    impactBadge: 'OTA Seguro SHA-256',
    technicalDetails:
      'Apenas um nó em estado ACTIVE dispara extrações agendadas e telemetria, enquanto nós em STANDBY mantêm heartbeat pronto para promoção automática ou manual.',
    commandsSnippet: null,
    rollbackPlan: 'Utilizar pacote anterior ou restaurador local em scripts de contingência no SRVFILES.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-08T17:00:00.000Z',
  },
  {
    id: 'imp-2026-11-05-srvfiles-sqlite-wal-lan-server',
    source: 'OFICIAL_CODIGO',
    server: 'SRVFILES',
    category: 'PERFORMANCE',
    status: 'ATIVO',
    title: 'Banco Local SQLite em Modo WAL, Índice em Memória de Pastas e File Server LAN (:8765)',
    implementedAt: '2026-11-05',
    connectorVersion: 'v2.5.0',
    summarySimple:
      'Eliminamos travamentos locais do banco de fila ativando o modo WAL no SQLite, aceleramos buscas de arquivos na rede mantendo índice em memória e criamos um servidor local rápido (:8765) para abrir PDFs pesados de 10 a 200 MB direto na rede interna do cartório sem trafegar pela internet.',
    problemBefore:
      'Leitura e escrita concorrente na fila SQLite geravam erros "database is locked"; percorrer milhões de arquivos em K:\\IMAGENS sob demanda demorava demais; e PDFs de processos judiciais excediam o limite de payload da nuvem.',
    solutionApplied:
      'Ativado PRAGMA journal_mode=WAL com conexão SQLite compartilhada; implementado índice em memória das pastas do acervo + renderização sob demanda das primeiras 4 fichas de matrículas .KEN em < 1s com carga em segundo plano das demais; criado document-file-server.ts em HTTPS/HTTP LAN :8765 com tickets aleatórios de 256 bits e expiração em 15 minutos + fallback em blocos para Safari/Chrome.',
    metricBefore: 'Erros database is locked + leitura lenta de diretórios e PDFs pesados',
    metricAfter: '0 locks SQLite · Primeiras 4 fichas .KEN em < 1s · Streaming LAN direto :8765',
    impactBadge: 'Abertura .KEN < 1s',
    technicalDetails:
      'Inclui suporte nativo a decodificação TIFF/.KEN via UTIF/UPNG, proteção estrita isWithinRoot anti-path-traversal, filtro contra arquivos temporários ~$*.doc (162 bytes do Word) e limpeza de timbres/cabeçalhos na extração de petições.',
    commandsSnippet: null,
    rollbackPlan: 'Ajustável por variáveis DOCUMENTAL_FILE_SERVER_ENABLED / modo HTTPS chunked.',
    authorName: 'Henrique C. F. Gama + Antigravity',
    updatedAtIso: '2026-11-05T19:00:00.000Z',
  },
  {
    id: 'imp-2026-11-01-srvsql-implantacao-bi-incremental',
    source: 'OFICIAL_CODIGO',
    server: 'SRVSQL',
    category: 'PERFORMANCE',
    status: 'HISTORICO',
    title: 'Implantação Inicial do FIORIX no SRVSQL: Procedures Incrementais e Login Dedicado Somente Leitura',
    implementedAt: '2026-11-01',
    connectorVersion: 'v2.4.0',
    summarySimple:
      'Na implantação inicial do FIORIX, separamos um usuário dedicado com privilégios mínimos e criamos rotinas incrementais escalonadas (em horários diferentes por módulo) para alimentar os painéis de BI, Metas, Prazos, Retornos e Impressões sem pesar o servidor do WebRI.',
    problemBefore:
      'Havia o risco clássico de ferramentas externas dispararem consultas pesadas simultâneas em tabelas inteiras do WEBRI durante o atendimento do balcão.',
    solutionApplied:
      'Criadas procedures parametrizadas incrementais (pr_Fiorix_BI, pr_Fiorix_Produtividade, pr_Fiorix_Tarefas, pr_Fiorix_Metas, pr_Fiorix_Retornos, pr_Fiorix_Impressoes), executadas pelo scheduler em offsets defasados (0s, 10s, 20s, 30s, 40s, 50s) em chunks de 500 registros, com overlap de 5 min e reconciliação de 7 dias.',
    metricBefore: 'Sem integração automatizada de BI/Produtividade/Metas no FIORIX',
    metricAfter: 'Sincronismo contínuo escalonado em chunks idempotentes sem travar balcão',
    impactBadge: 'Base Inicial Auditada',
    technicalDetails:
      'Cada lote é versionado com batchId e record_key determinístico garantindo idempotência no ingest Supabase/PostgreSQL (API /api/v1/connector/sync). Scripts SQL mantidos em fiorix-connector/sql/.',
    commandsSnippet: null,
    rollbackPlan: 'Alternar AUTO_SYNC_ENABLED ou pausar o conector pela Central de Operações.',
    authorName: 'Henrique C. F. Gama + FIORIX Team',
    updatedAtIso: '2026-11-01T12:00:00.000Z',
  },
];
