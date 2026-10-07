# supabase/prepared-migrations — NÃO APLICAR

Migrations corretivas **apenas preparadas** (Fase 6.0). Nenhuma foi aplicada em
qualquer ambiente.

- Ficam fora de `supabase/migrations/` de propósito: o Supabase CLI não as
  detecta nem as aplica automaticamente.
- Ordem prevista para homologação futura em **staging**:
  1. `20261007091000_fix_identity_functions_by_id.sql`
  2. `20261007090000_fix_saas_audit_insert_policy.sql`
  3. `20261007160000_fiorix_rls_user_tenant_lockdown.sql` — RLS em `public."User"` e
     `public."Tenant"` (alertas ERROR do Security Advisor) e `search_path` fixo na
     função de trigger da auditoria SaaS. Aborta sozinha se o dono das tabelas não
     for `postgres` ou se houver `FORCE ROW LEVEL SECURITY`.
- Cada arquivo tem um `_rollback.sql` correspondente.
- **Produção:** proibida a aplicação sem registro formal de mudança em
  `docs/governanca/mudancas/` e autorização humana específica do MASTER.

Documentação: `docs/governanca/fase6_0-saneamento-pre-requisitos.md`.
