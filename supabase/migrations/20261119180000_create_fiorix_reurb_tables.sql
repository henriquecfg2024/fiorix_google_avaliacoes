-- ==============================================================================
-- FIORIX: Central REURB (Regularização Fundiária Urbana • ONR v1.4)
-- Migration: 20261119180000_create_fiorix_reurb_tables.sql
-- Aditiva, idempotente, multi-tenant, com RLS Deny-by-Default para anon/authenticated
-- e acesso exclusivo via service_role / Prisma (sem FORCE ROW LEVEL SECURITY).
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fiorix_reurb_regularizacoes (
  id                              TEXT NOT NULL PRIMARY KEY,
  tenant_id                       TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  record_key                      TEXT NOT NULL,
  prenotacao                      INTEGER NOT NULL,
  matricula                       INTEGER NOT NULL,
  compl_matricula                 TEXT,
  protocolo                       TEXT NOT NULL,
  empreendimento                  TEXT,
  empreendimento_fonte            TEXT,
  empreendimento_trecho_ocr       TEXT,
  neg_id                          INTEGER NOT NULL DEFAULT 947,
  classificacao_final             TEXT NOT NULL,
  modalidade                      TEXT NOT NULL,
  tipo_interesse                  INTEGER NOT NULL,
  data_registro                   DATE,
  data_prenotacao                 DATE,
  municipio                       TEXT,
  distrito                        TEXT,
  subdistrito                     TEXT,
  bairro                          TEXT,
  bairro_sugerido                 TEXT,
  tipo_localizacao                TEXT NOT NULL DEFAULT 'U',
  quantidade_unidades             INTEGER NOT NULL DEFAULT 0,
  qtd_derivadas_lista             INTEGER NOT NULL DEFAULT 0,
  qtd_areas_publicas_excluidas    INTEGER NOT NULL DEFAULT 0,
  tipo_agente                     INTEGER,
  agente                          TEXT,
  situacao_validacao              TEXT NOT NULL DEFAULT 'PENDENTE',
  qtd_bloqueios                   INTEGER NOT NULL DEFAULT 0,
  qtd_alertas                     INTEGER NOT NULL DEFAULT 0,
  eh_art_69                       BOOLEAN NOT NULL DEFAULT false,
  fontes_json                     JSONB,
  atos_vinculados_json            JSONB,
  ultima_exportacao_em            TIMESTAMP(3),
  ultima_importacao_confirmada_em TIMESTAMP(3),
  synced_at                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_record_key_key
  ON public.fiorix_reurb_regularizacoes (tenant_id, record_key);
CREATE UNIQUE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_pren_mat_key
  ON public.fiorix_reurb_regularizacoes (tenant_id, prenotacao, matricula);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_data_reg_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, data_registro DESC);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_data_pren_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, data_prenotacao DESC);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_situacao_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, situacao_validacao);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_modalidade_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, modalidade);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_matricula_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, matricula);
CREATE INDEX IF NOT EXISTS fiorix_reurb_regularizacoes_tenant_prenotacao_idx
  ON public.fiorix_reurb_regularizacoes (tenant_id, prenotacao);

CREATE TABLE IF NOT EXISTS public.fiorix_reurb_derivadas (
  id                          TEXT NOT NULL PRIMARY KEY,
  tenant_id                   TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  regularizacao_id            TEXT NOT NULL REFERENCES public.fiorix_reurb_regularizacoes(id) ON DELETE CASCADE,
  matricula_derivada          INTEGER NOT NULL,
  compl_matricula             TEXT,
  data_abertura               DATE,
  data_registro               DATE,
  tipo_interesse              INTEGER NOT NULL,
  incluir_no_json             BOOLEAN NOT NULL DEFAULT true,
  eh_area_publica             BOOLEAN NOT NULL DEFAULT false,
  eh_condominio_intermediario BOOLEAN NOT NULL DEFAULT false,
  categoria_area              TEXT NOT NULL DEFAULT 'UNIDADE_AUTONOMA',
  vinculo_metodo              TEXT,
  motivo_exclusao             TEXT,
  fonte_ocr                   TEXT,
  created_at                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_reurb_derivadas_reg_mat_key
  ON public.fiorix_reurb_derivadas (regularizacao_id, matricula_derivada);
CREATE INDEX IF NOT EXISTS fiorix_reurb_derivadas_tenant_data_abertura_idx
  ON public.fiorix_reurb_derivadas (tenant_id, data_abertura DESC);
CREATE INDEX IF NOT EXISTS fiorix_reurb_derivadas_tenant_mat_idx
  ON public.fiorix_reurb_derivadas (tenant_id, matricula_derivada);
CREATE INDEX IF NOT EXISTS fiorix_reurb_derivadas_reg_incluir_idx
  ON public.fiorix_reurb_derivadas (regularizacao_id, incluir_no_json);

CREATE TABLE IF NOT EXISTS public.fiorix_reurb_pendencias (
  id                 TEXT NOT NULL PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  regularizacao_id   TEXT NOT NULL REFERENCES public.fiorix_reurb_regularizacoes(id) ON DELETE CASCADE,
  matricula_derivada INTEGER,
  campo              TEXT NOT NULL,
  severidade         TEXT NOT NULL,
  motivo             TEXT NOT NULL,
  fonte              TEXT NOT NULL,
  acao_necessaria    TEXT,
  exige_conferencia  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fiorix_reurb_pendencias_tenant_sev_idx
  ON public.fiorix_reurb_pendencias (tenant_id, severidade);
CREATE INDEX IF NOT EXISTS fiorix_reurb_pendencias_reg_sev_idx
  ON public.fiorix_reurb_pendencias (regularizacao_id, severidade);

CREATE TABLE IF NOT EXISTS public.fiorix_reurb_exportacoes (
  id                       TEXT NOT NULL PRIMARY KEY,
  tenant_id                TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  tipo                     TEXT NOT NULL,
  status_geracao           TEXT NOT NULL,
  status_importacao_onr    TEXT NOT NULL DEFAULT 'PENDENTE_CONFIRMACAO',
  nome_arquivo_json        TEXT,
  nome_arquivo_pendencias  TEXT,
  qtd_solicitadas          INTEGER NOT NULL DEFAULT 0,
  qtd_aptas_geradas        INTEGER NOT NULL DEFAULT 0,
  qtd_barradas             INTEGER NOT NULL DEFAULT 0,
  qtd_derivadas_incluidas  INTEGER NOT NULL DEFAULT 0,
  json_payload             TEXT,
  json_sha256              TEXT,
  relatorio_pendencias_json JSONB,
  erro_detalhe             TEXT,
  revalidacao_connector_id TEXT,
  revalidado_em            TIMESTAMP(3),
  ocr_consultado           BOOLEAN NOT NULL DEFAULT false,
  gerado_por_user_id       TEXT NOT NULL,
  gerado_por_nome          TEXT,
  confirmado_importacao_em TIMESTAMP(3),
  confirmado_por_user_id   TEXT,
  confirmado_por_nome      TEXT,
  protocolo_onr_externo    TEXT,
  observacao_confirmacao   TEXT,
  created_at               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fiorix_reurb_exportacoes_tenant_created_idx
  ON public.fiorix_reurb_exportacoes (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fiorix_reurb_exportacoes_tenant_status_ger_idx
  ON public.fiorix_reurb_exportacoes (tenant_id, status_geracao);
CREATE INDEX IF NOT EXISTS fiorix_reurb_exportacoes_tenant_status_imp_idx
  ON public.fiorix_reurb_exportacoes (tenant_id, status_importacao_onr);

CREATE TABLE IF NOT EXISTS public.fiorix_reurb_exportacao_itens (
  id                      TEXT NOT NULL PRIMARY KEY,
  exportacao_id           TEXT NOT NULL REFERENCES public.fiorix_reurb_exportacoes(id) ON DELETE CASCADE,
  regularizacao_id        TEXT REFERENCES public.fiorix_reurb_regularizacoes(id) ON DELETE SET NULL,
  prenotacao              INTEGER NOT NULL,
  matricula               INTEGER NOT NULL,
  protocolo               TEXT NOT NULL,
  empreendimento          TEXT,
  modalidade              TEXT NOT NULL,
  incluida_no_json        BOOLEAN NOT NULL DEFAULT false,
  situacao_no_momento     TEXT NOT NULL,
  qtd_derivadas_incluidas INTEGER NOT NULL DEFAULT 0,
  motivos_bloqueio_json   JSONB,
  created_at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fiorix_reurb_exportacao_itens_exp_incluida_idx
  ON public.fiorix_reurb_exportacao_itens (exportacao_id, incluida_no_json);
CREATE INDEX IF NOT EXISTS fiorix_reurb_exportacao_itens_reg_idx
  ON public.fiorix_reurb_exportacao_itens (regularizacao_id);

-- ==============================================================================
-- RLS & Privilégios (sem FORCE ROW LEVEL SECURITY para preservar service_role)
-- ==============================================================================

REVOKE ALL ON TABLE public.fiorix_reurb_regularizacoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_reurb_derivadas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_reurb_pendencias FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_reurb_exportacoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_reurb_exportacao_itens FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.fiorix_reurb_regularizacoes TO service_role;
GRANT ALL ON TABLE public.fiorix_reurb_derivadas TO service_role;
GRANT ALL ON TABLE public.fiorix_reurb_pendencias TO service_role;
GRANT ALL ON TABLE public.fiorix_reurb_exportacoes TO service_role;
GRANT ALL ON TABLE public.fiorix_reurb_exportacao_itens TO service_role;

ALTER TABLE public.fiorix_reurb_regularizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_reurb_derivadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_reurb_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_reurb_exportacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_reurb_exportacao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_fiorix_reurb_regularizacoes ON public.fiorix_reurb_regularizacoes;
CREATE POLICY deny_all_fiorix_reurb_regularizacoes
  ON public.fiorix_reurb_regularizacoes
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_fiorix_reurb_derivadas ON public.fiorix_reurb_derivadas;
CREATE POLICY deny_all_fiorix_reurb_derivadas
  ON public.fiorix_reurb_derivadas
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_fiorix_reurb_pendencias ON public.fiorix_reurb_pendencias;
CREATE POLICY deny_all_fiorix_reurb_pendencias
  ON public.fiorix_reurb_pendencias
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_fiorix_reurb_exportacoes ON public.fiorix_reurb_exportacoes;
CREATE POLICY deny_all_fiorix_reurb_exportacoes
  ON public.fiorix_reurb_exportacoes
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_fiorix_reurb_exportacao_itens ON public.fiorix_reurb_exportacao_itens;
CREATE POLICY deny_all_fiorix_reurb_exportacao_itens
  ON public.fiorix_reurb_exportacao_itens
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

COMMIT;
