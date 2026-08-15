-- Resumos persistentes usados pelo Modulo BI.
-- Os dados brutos permanecem em fiorix_bi_data; estas tabelas apenas evitam
-- varrer mais de um milhao de linhas a cada abertura de grafico.

CREATE TABLE IF NOT EXISTS fiorix_bi_daily_agg (
  tenant_id text NOT NULL DEFAULT '',
  import_id text NOT NULL REFERENCES fiorix_bi_imports(id) ON DELETE CASCADE,
  day date NOT NULL,
  tipo_prenotacao text NOT NULL DEFAULT '',
  natureza text NOT NULL DEFAULT 'Outros',
  is_exception boolean NOT NULL DEFAULT false,
  total_records bigint NOT NULL DEFAULT 0,
  total_registered bigint NOT NULL DEFAULT 0,
  registered_no_prazo bigint NOT NULL DEFAULT 0,
  registered_atrasado bigint NOT NULL DEFAULT 0,
  registered_devolucao bigint NOT NULL DEFAULT 0,
  devolucao_all bigint NOT NULL DEFAULT 0,
  delay_1_3 bigint NOT NULL DEFAULT 0,
  delay_4_7 bigint NOT NULL DEFAULT 0,
  delay_8_15 bigint NOT NULL DEFAULT 0,
  delay_16_plus bigint NOT NULL DEFAULT 0,
  delay_sem_atraso bigint NOT NULL DEFAULT 0,
  daily_no_prazo bigint NOT NULL DEFAULT 0,
  daily_atrasado bigint NOT NULL DEFAULT 0,
  daily_devolucao bigint NOT NULL DEFAULT 0,
  sum_dias_prometidos bigint NOT NULL DEFAULT 0,
  sum_dias_corridos bigint NOT NULL DEFAULT 0,
  metric_count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, import_id, day, tipo_prenotacao, natureza, is_exception)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_bi_daily_agg_day
  ON fiorix_bi_daily_agg(tenant_id, day);
CREATE INDEX IF NOT EXISTS idx_fiorix_bi_daily_agg_import_day
  ON fiorix_bi_daily_agg(tenant_id, import_id, day);
CREATE INDEX IF NOT EXISTS idx_fiorix_bi_daily_agg_tipo_day
  ON fiorix_bi_daily_agg(tenant_id, tipo_prenotacao, day);

CREATE TABLE IF NOT EXISTS fiorix_bi_return_note_agg (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT '',
  import_id text NOT NULL REFERENCES fiorix_bi_imports(id) ON DELETE CASCADE,
  day date NOT NULL,
  tipo_prenotacao text NOT NULL DEFAULT '',
  texto text NOT NULL,
  occurrences bigint NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_fiorix_bi_return_note_import_day
  ON fiorix_bi_return_note_agg(tenant_id, import_id, day);
CREATE INDEX IF NOT EXISTS idx_fiorix_bi_return_note_tipo_day
  ON fiorix_bi_return_note_agg(tenant_id, tipo_prenotacao, day);

CREATE OR REPLACE FUNCTION refresh_fiorix_bi_aggregates(p_import_id text, p_tenant_id text DEFAULT '')
RETURNS TABLE(daily_rows bigint, note_rows bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_import_id));

  DELETE FROM fiorix_bi_daily_agg WHERE import_id = p_import_id AND (p_tenant_id = '' OR tenant_id = p_tenant_id);
  DELETE FROM fiorix_bi_return_note_agg WHERE import_id = p_import_id AND (p_tenant_id = '' OR tenant_id = p_tenant_id);

  INSERT INTO fiorix_bi_daily_agg (
    tenant_id, import_id, day, tipo_prenotacao, natureza, is_exception,
    total_records, total_registered, registered_no_prazo,
    registered_atrasado, registered_devolucao, devolucao_all,
    delay_1_3, delay_4_7, delay_8_15, delay_16_plus,
    delay_sem_atraso, daily_no_prazo, daily_atrasado,
    daily_devolucao, sum_dias_prometidos, sum_dias_corridos,
    metric_count
  )
  WITH classified AS (
    SELECT
      COALESCE("tenant_id", p_tenant_id) AS tenant_id,
      "import_id",
      COALESCE("DtProtocolo"::date, DATE '1900-01-01') AS day,
      COALESCE(TRIM("TipoPrenotacao"), '') AS tipo_prenotacao,
      COALESCE(TRIM("Natureza"), 'Outros') AS natureza,
      TRANSLATE(
        UPPER(COALESCE(TRIM("Natureza"), '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ) IN (
        'INTIMACAO', 'INTIMACAO ONLINE', 'OFICIO - INDISPONIBILIDADE',
        'PETICAO - RETIFICACAO DE AREA', 'PETICAO - USUCAPIAO EXTRAJUDICIAL',
        'PETICAO-ADJUDICACAO COMPULSORIA', 'REGULARIZACAO FUNDIARIA'
      ) AS is_exception,
      ("CodProcessamento" IN (5, 6) OR "IsRegistrado" = true) AS is_registered,
      (
        COALESCE("IsDevolucao", false) = true
        OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%'
      ) AS is_devolucao,
      (
        COALESCE("DiasAtraso", 0) > 0
        OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%atrasad%'
      ) AS is_atrasado,
      COALESCE("IsDevolucao", false) AS is_devolucao_flag,
      COALESCE("DiasAtraso", 0) AS dias_atraso,
      COALESCE("DiasPrometidos", 0) AS dias_prometidos,
      COALESCE("DiasCorridos", 0) AS dias_corridos
    FROM fiorix_bi_data
    WHERE "import_id" = p_import_id
      AND (p_tenant_id = '' OR "tenant_id" = p_tenant_id)
  )
  SELECT
    tenant_id, import_id, day, tipo_prenotacao, natureza, is_exception,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE is_registered)::bigint,
    COUNT(*) FILTER (WHERE is_registered AND NOT is_devolucao AND NOT is_atrasado)::bigint,
    COUNT(*) FILTER (WHERE is_registered AND NOT is_devolucao AND is_atrasado)::bigint,
    COUNT(*) FILTER (WHERE is_registered AND is_devolucao)::bigint,
    COUNT(*) FILTER (WHERE is_devolucao)::bigint,
    COUNT(*) FILTER (WHERE (dias_atraso > 0 OR is_devolucao OR is_atrasado) AND dias_atraso BETWEEN 1 AND 3)::bigint,
    COUNT(*) FILTER (WHERE (dias_atraso > 0 OR is_devolucao OR is_atrasado) AND dias_atraso BETWEEN 4 AND 7)::bigint,
    COUNT(*) FILTER (WHERE (dias_atraso > 0 OR is_devolucao OR is_atrasado) AND dias_atraso BETWEEN 8 AND 15)::bigint,
    COUNT(*) FILTER (WHERE (dias_atraso > 0 OR is_devolucao OR is_atrasado) AND dias_atraso >= 16)::bigint,
    COUNT(*) FILTER (WHERE (dias_atraso > 0 OR is_devolucao OR is_atrasado) AND dias_atraso <= 0)::bigint,
    COUNT(*) FILTER (WHERE dias_atraso <= 0 AND NOT is_devolucao_flag)::bigint,
    COUNT(*) FILTER (WHERE dias_atraso > 0 AND NOT is_devolucao_flag)::bigint,
    COUNT(*) FILTER (WHERE is_devolucao_flag)::bigint,
    SUM(dias_prometidos)::bigint,
    SUM(dias_corridos)::bigint,
    COUNT(*)::bigint
  FROM classified
  GROUP BY tenant_id, import_id, day, tipo_prenotacao, natureza, is_exception;

  GET DIAGNOSTICS daily_rows = ROW_COUNT;

  INSERT INTO fiorix_bi_return_note_agg (
    tenant_id, import_id, day, tipo_prenotacao, texto, occurrences
  )
  SELECT
    COALESCE("tenant_id", p_tenant_id),
    "import_id",
    COALESCE("DtProtocolo"::date, DATE '1900-01-01'),
    COALESCE(TRIM("TipoPrenotacao"), ''),
    TRIM("TextoNotaDevolucao"),
    COUNT(*)::bigint
  FROM fiorix_bi_data
  WHERE "import_id" = p_import_id
    AND (p_tenant_id = '' OR "tenant_id" = p_tenant_id)
    AND TRANSLATE(
      UPPER(COALESCE(TRIM("Natureza"), '')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ) NOT IN (
      'INTIMACAO', 'INTIMACAO ONLINE', 'OFICIO - INDISPONIBILIDADE',
      'PETICAO - RETIFICACAO DE AREA', 'PETICAO - USUCAPIAO EXTRAJUDICIAL',
      'PETICAO-ADJUDICACAO COMPULSORIA', 'REGULARIZACAO FUNDIARIA'
    )
    AND (
      COALESCE("IsDevolucao", false) = true
      OR LOWER(COALESCE("SituacaoPrazo", '')) LIKE '%devolucao%'
    )
    AND "TextoNotaDevolucao" IS NOT NULL
    AND LENGTH(TRIM("TextoNotaDevolucao")) > 5
  GROUP BY 1, 2, 3, 4, 5;

  GET DIAGNOSTICS note_rows = ROW_COUNT;
  RETURN NEXT;
END;
$$;

