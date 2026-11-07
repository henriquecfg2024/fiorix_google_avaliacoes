-- ============================================================================
-- MIGRAÇÃO PREPARADA (NÃO EXECUTADA EM PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA)
-- Módulo: Cartório Virtual (Piloto de Certidões - 7º RI de São Paulo / Multi-Serventia)
-- Inclui também colunas probatórias de Ciência Eletrônica em fiorix_holerites
-- ============================================================================

-- 1. Colunas probatórias de Ciência Eletrônica em fiorix_holerites (retrocompatível)
ALTER TABLE public.fiorix_holerites
  ADD COLUMN IF NOT EXISTS ciencia_confirmada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ciencia_ip TEXT,
  ADD COLUMN IF NOT EXISTS ciencia_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ciencia_comprovante_hash TEXT;

-- 2. Autorizações e Competências Registrais por Serventia (separadas de ADMIN técnico)
CREATE TABLE IF NOT EXISTS public.fiorix_cv_autorizacoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  papel_registral TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  pode_consultar BOOLEAN NOT NULL DEFAULT TRUE,
  pode_conferir BOOLEAN NOT NULL DEFAULT FALSE,
  pode_anotar BOOLEAN NOT NULL DEFAULT TRUE,
  pode_solicitar_atualizacao BOOLEAN NOT NULL DEFAULT FALSE,
  pode_aprovar_revisao BOOLEAN NOT NULL DEFAULT FALSE,
  pode_imprimir BOOLEAN NOT NULL DEFAULT FALSE,
  pode_solicitar_assinatura BOOLEAN NOT NULL DEFAULT FALSE,
  pode_configurar_regras BOOLEAN NOT NULL DEFAULT FALSE,
  pode_auditar_historico BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  atribuido_por_id TEXT,
  atribuido_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_autorizacoes_tenant ON public.fiorix_cv_autorizacoes (tenant_id);
ALTER TABLE public.fiorix_cv_autorizacoes ENABLE ROW LEVEL SECURITY;

-- 3. Regras e Modelos Versionados por Serventia
CREATE TABLE IF NOT EXISTS public.fiorix_cv_regras_versoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  codigo_regra TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  especie_alvo TEXT NOT NULL DEFAULT 'INTEIRO_TEOR_MATRICULA',
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  validada_juridicamente BOOLEAN NOT NULL DEFAULT FALSE,
  texto_modelo TEXT,
  parametros_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  aprovado_por_id TEXT,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, codigo_regra, versao)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_regras_tenant_ativa ON public.fiorix_cv_regras_versoes (tenant_id, codigo_regra, ativa);
ALTER TABLE public.fiorix_cv_regras_versoes ENABLE ROW LEVEL SECURITY;

-- 4. Pedidos de Certidão (Cabeçalho)
CREATE TABLE IF NOT EXISTS public.fiorix_cv_pedidos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  numero_pedido TEXT NOT NULL,
  protocolo_externo TEXT,
  origem TEXT NOT NULL,
  canal_recebimento TEXT NOT NULL,
  especie_solicitada TEXT NOT NULL,
  subtipo_confirmado TEXT,
  criterio_solicitacao TEXT NOT NULL,
  estado_operacional TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'NORMAL',
  data_pedido TIMESTAMPTZ NOT NULL,
  prazo_previsto TIMESTAMPTZ,
  versao_dados_fonte_hash TEXT NOT NULL,
  dados_invalidados_mudanca BOOLEAN NOT NULL DEFAULT FALSE,
  pausado_por_ato_processamento BOOLEAN NOT NULL DEFAULT FALSE,
  prenotacao_vinculada TEXT,
  requerente_json JSONB NOT NULL,
  apresentante_json JSONB,
  destinatario_nota_json JSONB,
  valores_json JSONB,
  observacoes_origem TEXT,
  pdf_original_webri_path TEXT,
  modo_comparacao_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  resultado_proposto_fiorix TEXT,
  procedimento_real_equipe TEXT,
  status_comparacao TEXT NOT NULL DEFAULT 'AGUARDANDO_EQUIPE',
  divergencia_classificacao TEXT,
  ambiente_sintetico BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_sincronismo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero_pedido)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_pedidos_estado ON public.fiorix_cv_pedidos (tenant_id, estado_operacional);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_pedidos_data ON public.fiorix_cv_pedidos (tenant_id, data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_pedidos_origem ON public.fiorix_cv_pedidos (tenant_id, origem);
ALTER TABLE public.fiorix_cv_pedidos ENABLE ROW LEVEL SECURITY;

-- 5. Itens do Pedido de Certidão
CREATE TABLE IF NOT EXISTS public.fiorix_cv_pedido_itens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT NOT NULL REFERENCES public.fiorix_cv_pedidos(id) ON DELETE CASCADE,
  sequencia_item INTEGER NOT NULL,
  natureza_codigo INTEGER,
  natureza_descricao TEXT NOT NULL,
  livro_codigo INTEGER,
  livro_descricao TEXT,
  numero_matricula INTEGER,
  transcricao_ou_loteamento TEXT,
  endereco_pesquisa TEXT,
  tipo_documento_codigo INTEGER,
  documento_pesquisado_mascarado TEXT,
  meio_entrega_codigo TEXT,
  meio_entrega_descricao TEXT,
  data_previsao TIMESTAMPTZ,
  elegivel_piloto BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_encaminhamento_humano TEXT,
  status_item TEXT NOT NULL DEFAULT 'AGUARDANDO_CONFERENCIA',
  acervo_snapshot_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pedido_id, sequencia_item)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_itens_matricula ON public.fiorix_cv_pedido_itens (tenant_id, numero_matricula);
ALTER TABLE public.fiorix_cv_pedido_itens ENABLE ROW LEVEL SECURITY;

-- 6. Conferências de Identificação, Contraditório e Acervo
CREATE TABLE IF NOT EXISTS public.fiorix_cv_conferencias (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT NOT NULL REFERENCES public.fiorix_cv_pedidos(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES public.fiorix_cv_pedido_itens(id) ON DELETE SET NULL,
  versao_regra_aplicada TEXT NOT NULL,
  versao_dados_fonte_hash TEXT NOT NULL,
  identificacao_status TEXT NOT NULL,
  vinculo_serventia BOOLEAN NOT NULL DEFAULT FALSE,
  contraditorio_status TEXT NOT NULL,
  prenotacoes_encontradas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  texto_certidao_sugerido TEXT,
  atualidade_matricula_status TEXT NOT NULL,
  decisao_proposta TEXT NOT NULL,
  invalidada_por_mudanca BOOLEAN NOT NULL DEFAULT FALSE,
  executado_por_tipo TEXT NOT NULL,
  executado_por_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_conferencias_pedido ON public.fiorix_cv_conferencias (tenant_id, pedido_id);
ALTER TABLE public.fiorix_cv_conferencias ENABLE ROW LEVEL SECURITY;

-- 7. Pendências de Atualização de Matrícula, Digitalização ou Pesquisa
CREATE TABLE IF NOT EXISTS public.fiorix_cv_pendencias (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT NOT NULL REFERENCES public.fiorix_cv_pedidos(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES public.fiorix_cv_pedido_itens(id) ON DELETE SET NULL,
  tipo_pendencia TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTA',
  prenotacao_ref TEXT,
  numero_matricula INTEGER,
  responsavel_id TEXT,
  responsavel_nome TEXT,
  prazo_limite TIMESTAMPTZ,
  evidencia_conclusao TEXT,
  resolvida_por_id TEXT,
  resolvida_por_nome TEXT,
  resolvida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_pendencias_status ON public.fiorix_cv_pendencias (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_pendencias_pedido ON public.fiorix_cv_pendencias (tenant_id, pedido_id);
ALTER TABLE public.fiorix_cv_pendencias ENABLE ROW LEVEL SECURITY;

-- 8. Central de Anotações e Tarefas (com Histórico Não Destrutivo e Retenção por Tempo Indeterminado)
CREATE TABLE IF NOT EXISTS public.fiorix_cv_anotacoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT REFERENCES public.fiorix_cv_pedidos(id) ON DELETE SET NULL,
  item_id TEXT REFERENCES public.fiorix_cv_pedido_itens(id) ON DELETE SET NULL,
  numero_matricula INTEGER,
  parent_id TEXT,
  tipo_registro TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'CONFERENCIA',
  prioridade TEXT NOT NULL DEFAULT 'NORMAL',
  visibilidade TEXT NOT NULL DEFAULT 'EQUIPE_INTERNA',
  status TEXT NOT NULL DEFAULT 'ABERTA',
  titulo TEXT NOT NULL,
  conteudo_atual TEXT NOT NULL,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  autor_id TEXT NOT NULL,
  autor_nome TEXT NOT NULL,
  autor_papel TEXT NOT NULL,
  atribuido_para_id TEXT,
  atribuido_para_nome TEXT,
  setor_destino TEXT,
  prazo_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  concluida_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_anotacoes_status ON public.fiorix_cv_anotacoes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_anotacoes_pedido ON public.fiorix_cv_anotacoes (tenant_id, pedido_id);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_anotacoes_matricula ON public.fiorix_cv_anotacoes (tenant_id, numero_matricula);
ALTER TABLE public.fiorix_cv_anotacoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fiorix_cv_anotacoes_versoes (
  id TEXT PRIMARY KEY,
  anotacao_id TEXT NOT NULL REFERENCES public.fiorix_cv_anotacoes(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  motivo_edicao TEXT,
  editado_por_id TEXT NOT NULL,
  editado_por_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (anotacao_id, versao)
);
ALTER TABLE public.fiorix_cv_anotacoes_versoes ENABLE ROW LEVEL SECURITY;

-- 9. Revisões e Aprovações por Pessoa Autorizada
CREATE TABLE IF NOT EXISTS public.fiorix_cv_revisoes_decisoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT NOT NULL REFERENCES public.fiorix_cv_pedidos(id) ON DELETE CASCADE,
  motivo_revisao TEXT NOT NULL,
  evidencias_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_revisao TEXT NOT NULL DEFAULT 'PENDENTE',
  decisao_humana TEXT,
  justificativa TEXT,
  limites_aprovacao TEXT,
  versao_dados_fonte_hash TEXT NOT NULL,
  decidido_por_id TEXT,
  decidido_por_nome TEXT,
  papel_registral_no_ato TEXT,
  decidido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_revisoes_status ON public.fiorix_cv_revisoes_decisoes (tenant_id, status_revisao);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_revisoes_pedido ON public.fiorix_cv_revisoes_decisoes (tenant_id, pedido_id);
ALTER TABLE public.fiorix_cv_revisoes_decisoes ENABLE ROW LEVEL SECURITY;

-- 10. Central Avançada de Impressão e Eventos de Lote
CREATE TABLE IF NOT EXISTS public.fiorix_cv_lotes_impressao (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  codigo_lote TEXT NOT NULL,
  modo_selecao TEXT NOT NULL,
  modo_dados_impressao TEXT NOT NULL DEFAULT 'ORIGINAL_CONGELADO',
  duplex_frente_nova_folha BOOLEAN NOT NULL DEFAULT TRUE,
  incluir_anexo_pesquisa BOOLEAN NOT NULL DEFAULT TRUE,
  criterio_ordenacao TEXT NOT NULL DEFAULT 'NUMERO_PEDIDO_ASC',
  filtros_aplicados_json JSONB,
  pedidos_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_pedidos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_pedidos INTEGER NOT NULL,
  total_paginas INTEGER NOT NULL,
  paginas_branco_duplex INTEGER NOT NULL DEFAULT 0,
  arquivo_hash_sha256 TEXT NOT NULL,
  status_lote TEXT NOT NULL DEFAULT 'GERADO',
  lote_origem_reimpressao_id TEXT,
  motivo_reimpressao TEXT,
  criado_por_id TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, codigo_lote)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_lotes_created ON public.fiorix_cv_lotes_impressao (tenant_id, created_at DESC);
ALTER TABLE public.fiorix_cv_lotes_impressao ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fiorix_cv_lotes_impressao_eventos (
  id TEXT PRIMARY KEY,
  lote_id TEXT NOT NULL REFERENCES public.fiorix_cv_lotes_impressao(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  observacao TEXT,
  operador_id TEXT NOT NULL,
  operador_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_lote_eventos ON public.fiorix_cv_lotes_impressao_eventos (lote_id);
ALTER TABLE public.fiorix_cv_lotes_impressao_eventos ENABLE ROW LEVEL SECURITY;

-- 11. Fila Durável e Idempotente de Processamento / Agentes Virtuais
CREATE TABLE IF NOT EXISTS public.fiorix_cv_fila_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  chave_idempotencia TEXT NOT NULL,
  agente_virtual TEXT NOT NULL,
  tipo_job TEXT NOT NULL,
  pedido_id TEXT,
  status_job TEXT NOT NULL DEFAULT 'PENDENTE',
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 4,
  proxima_execucao_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bloqueado_ate TIMESTAMPTZ,
  worker_id TEXT,
  ultimo_erro TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_fila_exec ON public.fiorix_cv_fila_jobs (tenant_id, status_job, proxima_execucao_em);
ALTER TABLE public.fiorix_cv_fila_jobs ENABLE ROW LEVEL SECURITY;

-- 12. Histórico Imutável de Operações (WORM / Rastreabilidade)
CREATE TABLE IF NOT EXISTS public.fiorix_cv_historico_operacoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  pedido_id TEXT REFERENCES public.fiorix_cv_pedidos(id) ON DELETE SET NULL,
  item_id TEXT,
  lote_id TEXT,
  ator_tipo TEXT NOT NULL,
  ator_id TEXT NOT NULL,
  ator_nome TEXT NOT NULL,
  papel_registral TEXT,
  evento TEXT NOT NULL,
  estado_anterior TEXT,
  estado_novo TEXT,
  resumo TEXT NOT NULL,
  detalhes_json JSONB,
  hash_integridade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_historico_tenant_data ON public.fiorix_cv_historico_operacoes (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiorix_cv_historico_pedido ON public.fiorix_cv_historico_operacoes (tenant_id, pedido_id);
ALTER TABLE public.fiorix_cv_historico_operacoes ENABLE ROW LEVEL SECURITY;

