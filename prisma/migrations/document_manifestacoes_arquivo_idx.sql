-- Gestão Documental / Aba ARQUIVO: índices compostos para ordenação decrescente por data de arquivamento
-- com desempate estável por id e busca rápida por requerente e matrícula por tenant.
-- Não altera nem migra forçadamente registros existentes.

CREATE INDEX IF NOT EXISTS "doc_manifestacao_arquivo_ord_idx"
  ON "DocumentManifestacao" ("tenantId", "status", "finalizadoEm" DESC NULLS LAST, "id" DESC);

CREATE INDEX IF NOT EXISTS "doc_manifestacao_requerente_idx"
  ON "DocumentManifestacao" ("tenantId", "requerente");

CREATE INDEX IF NOT EXISTS "doc_manifestacao_matricula_idx"
  ON "DocumentManifestacao" ("tenantId", "matricula");

