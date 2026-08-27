# Procedimento de Backup, Contingência e Resposta a Incidentes - Fiorix

Este documento detalha o plano de contingência, continuidade de negócios, política de backup/restore e protocolo de resposta a incidentes do sistema **Fiorix**.

---

## 1. Política de Backup e Rotação

### RPO (Recovery Point Objective)
- **RPO Alvo**: **1 hora**.
- Em caso de desastre, a perda máxima tolerada de dados é de no máximo 1 hora de transações de reviews/BI.

### RTO (Recovery Time Objective)
- **RTO Alvo**: **2 horas**.
- O tempo total de recuperação do sistema e restauração completa de serviços deve ser inferior a 2 horas.

### Rotinas de Backup
1. **Backups Automatizados Diários**: Realizados via rotina automatizada do Supabase / PostgreSQL (`pg_dump` completo de schema + dados).
2. **Retenção de Backups**:
   - Backups diários: Retidos por 30 dias.
   - Snapshots mensais: Retidos por 12 meses.
3. **Local de Armazenamento**: Armazenados em storage geograficamente redundante com criptografia em repouso (AES-256).

---

## 2. Procedimento Passo a Passo de Restore

Em caso de necessidade de restauração de banco de dados:

### Passo 1: Obter o arquivo de backup mais recente
```bash
# Baixar o dump do backup criptografado do ambiente de armazenamento seguro
pg_dump -h <DB_HOST> -U postgres -d postgres -F c -b -v -f fiorix_backup_latest.dump
```

### Passo 2: Preparar o Banco de Dados de Destino / Staging
```bash
# Criar um novo banco de dados limpo para testes de restauração
createdb -h <DB_HOST> -U postgres fiorix_restore_test
```

### Passo 3: Executar a Restauração
```bash
# Executar a restauração via pg_restore
pg_restore -h <DB_HOST> -U postgres -d fiorix_restore_test -v fiorix_backup_latest.dump
```

### Passo 4: Aplicar Migrações e Backfill se Necessário
```bash
# Rodar o script de backfill de tenant caso esteja restaurando banco legado
psql -h <DB_HOST> -U postgres -d fiorix_restore_test -f prisma/backfill_bi_tenants.sql
```

### Passo 5: Teste de Integridade Pós-Restore
1. Validar a contagem de tabelas e registros:
   ```sql
   SELECT count(*) FROM public.fiorix_bi_data;
   SELECT count(*) FROM public."User";
   ```
2. Alterar a string `DATABASE_URL` na Vercel / `.env.local` para apontar para a instância restaurada e validar a execução do aplicativo.

---

## 3. Rotação de Segredos e Credenciais

Caso ocorra suspeita de vazamento de segredos:

1. **Google OAuth**:
   - Acesse o Google Cloud Console > APIs & Services > Credentials.
   - Clique em **Reset Secret** em `GOOGLE_CLIENT_SECRET`.
   - Atualize a variável `GOOGLE_CLIENT_SECRET` na Vercel e no `.env.local`.

2. **Supabase / Banco de Dados**:
   - Acesse Supabase > Project Settings > Database.
   - Clique em **Reset Database Password**.
   - Atualize a variável `DATABASE_URL` no painel de administração da Vercel.

3. **NextAuth Secret**:
   - Gerar nova chave segura: `openssl rand -base64 32`
   - Atualizar `AUTH_SECRET` / `NEXTAUTH_SECRET` na Vercel.

---

## 4. Plano de Resposta a Incidentes (IRP)

1. **Identificação**: Detectar comportamento anômalo (erros 401/403 em massa, pico de acessos, logs de violação de CSRF ou vazamento).
2. **Contenção**:
   - Bloquear imediatamente o IP ou usuário comprometido.
   - Se necessário, ativar página de manutenção temporária na Vercel.
3. **Erradicação**:
   - Rotacionar todos os tokens OAuth, credenciais de banco e segredos de sessão.
   - Revogar tokens JWT ativos.
4. **Recuperação**:
   - Restaurar backup consistente verificado.
   - Validar logs do sistema para assegurar a eliminação do vetor de ataque.
5. **Pós-Mortem**:
   - Registrar relatório formal do incidente contendo causa raiz, tempo de contenção e ações corretivas preventivas.
