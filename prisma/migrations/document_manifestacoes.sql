-- Gestão Documental: fila "Formulários em Conferência com o Oficial" + histórico de Manifestações finalizadas.
-- Apenas ACRESCENTA uma tabela (não altera nenhuma existente). Aplicar com: npx tsx scripts/apply-manifestacoes-table.ts
-- Nenhum byte de documento é armazenado aqui: somente os dados do formulário e o texto da manifestação.
CREATE TABLE IF NOT EXISTS "DocumentManifestacao" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "fichaId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'conferencia' CHECK ("status" IN ('conferencia', 'finalizada')),
  "versao" INTEGER NOT NULL DEFAULT 1 CHECK ("versao" >= 1),
  "versaoAnteriorId" TEXT REFERENCES "DocumentManifestacao"("id") ON DELETE RESTRICT,
  "numeroProcesso" TEXT,
  "requerente" TEXT,
  "matricula" TEXT,
  "subdistrito" TEXT,
  "escrevente" TEXT,
  "dados" JSONB NOT NULL,
  "arquivoOrigem" JSONB,
  "minuta" JSONB,
  "textoFinal" TEXT,
  "hashSha256" TEXT,
  "criadoPorId" TEXT NOT NULL,
  "criadoPorNome" TEXT,
  "atualizadoPorId" TEXT,
  "atualizadoPorNome" TEXT,
  "finalizadoPorId" TEXT,
  "finalizadoPorNome" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizadoEm" TIMESTAMPTZ,
  CHECK ("status" <> 'finalizada' OR ("minuta" IS NOT NULL AND "textoFinal" IS NOT NULL AND "hashSha256" IS NOT NULL AND "finalizadoEm" IS NOT NULL))
);

-- Uma única ficha em conferência por formulário
CREATE UNIQUE INDEX IF NOT EXISTS "doc_manifestacao_ficha_conferencia"
  ON "DocumentManifestacao" ("tenantId", "fichaId") WHERE "status" = 'conferencia';
CREATE INDEX IF NOT EXISTS "doc_manifestacao_lista"
  ON "DocumentManifestacao" ("tenantId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "doc_manifestacao_processo"
  ON "DocumentManifestacao" ("tenantId", "numeroProcesso");

-- Manifestação finalizada é imutável: nem UPDATE nem DELETE (correções geram nova versão)
CREATE OR REPLACE FUNCTION "doc_manifestacao_imutavel"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'finalizada' THEN
    RAISE EXCEPTION 'Manifestação finalizada não pode ser alterada nem excluída (id %).', OLD."id";
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "doc_manifestacao_imutavel_trg" ON "DocumentManifestacao";
CREATE TRIGGER "doc_manifestacao_imutavel_trg"
  BEFORE UPDATE OR DELETE ON "DocumentManifestacao"
  FOR EACH ROW EXECUTE FUNCTION "doc_manifestacao_imutavel"();

-- Sem acesso direto pelos papéis do cliente Supabase: somente pelas rotas autenticadas do servidor
ALTER TABLE "DocumentManifestacao" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "DocumentManifestacao" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "DocumentManifestacao" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "DocumentManifestacao" FROM authenticated;
  END IF;
END $$;
