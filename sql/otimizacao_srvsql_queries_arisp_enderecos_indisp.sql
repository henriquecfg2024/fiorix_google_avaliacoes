/*
===============================================================================
  SRVSQL (10.0.0.25 · SQL Server 2012 SP4 Standard)
  Script Seguro de Otimizacao das Queries #2, #4, #5 e Indisponibilidade CNIB
===============================================================================
  SEGURANCA:
  - Nao altera uma linha de codigo/procedure da Siplan ou ECKSISTEMAS.
  - Zero risco de quebra de compatibilidade com aplicacoes ou procedures.
  - BLOCO 1 (Plan Guide em WEBRI): zero lock de tabela (< 0,1s) — pode rodar agora.
  - BLOCO 2 (Indices em ECKSISTEMAS e WEBRI.ind): SQL 2012 Standard nao possui
    ONLINE = ON; recomenda-se executar apos o fechamento do atendimento (18h-19h),
    com LOCK_TIMEOUT 10000 e MAXDOP = 2 para protecao das estacoes.
  - BLOCO 3: Conferencia imediata e script de rollback (comentado no rodape).
===============================================================================
*/

SET NOCOUNT ON;
GO

/* ============================================================================
   BLOCO 1 — PLAN GUIDE NAO-INVASIVO EM WEBRI.dbo.pr_PesquisarEnderecosPessoa
   Resolve: 0xF76CC746F3E97A60 (~1.148 ms / 869.649 paginas por execucao)
   Destrava o uso do indice coberto IX_Perf_EnderecosPessoa_Cover via RECOMPILE
   ============================================================================ */
USE [WEBRI];
GO

IF OBJECT_ID(N'dbo.pr_PesquisarEnderecosPessoa', N'P') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.plan_guides WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile')
    BEGIN
        EXEC sp_control_plan_guide
            @operation = N'DROP',
            @name      = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
        PRINT N'[BLOCO 1] Plan Guide anterior PG_Perf_PesquisarEnderecosPessoa_Recompile removido para recriacao.';
    END;

    DECLARE @def      NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID(N'dbo.pr_PesquisarEnderecosPessoa'));
    DECLARE @start    INT = CHARINDEX(N'Select' + NCHAR(9) + N'a.*,', @def);
    DECLARE @endMark  NVARCHAR(80) = N'Order' + NCHAR(9) + N'By' + NCHAR(9) + N'a.Adicional' + NCHAR(9) + NCHAR(9) + NCHAR(9) + N'Desc';
    DECLARE @endPos   INT = CHARINDEX(@endMark, @def, @start);

    IF @start > 0 AND @endPos > @start
    BEGIN
        DECLARE @stmtWithCrLf NVARCHAR(MAX) = SUBSTRING(@def, @start, (@endPos + LEN(@endMark) + 2) - @start);
        DECLARE @stmtNoCrLf   NVARCHAR(MAX) = SUBSTRING(@def, @start, (@endPos + LEN(@endMark)) - @start);
        DECLARE @pgId         INT = NULL;
        DECLARE @valErrCount  INT = 0;

        /* Tentativa 1: trecho exato incluindo CRLF final capturado em sys.dm_exec_query_stats */
        BEGIN TRY
            EXEC sp_create_plan_guide
                @name            = N'PG_Perf_PesquisarEnderecosPessoa_Recompile',
                @stmt            = @stmtWithCrLf,
                @type            = N'OBJECT',
                @module_or_batch = N'dbo.pr_PesquisarEnderecosPessoa',
                @params          = NULL,
                @hints           = N'OPTION (RECOMPILE)';

            SELECT @pgId = plan_guide_id
            FROM sys.plan_guides
            WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';

            SELECT @valErrCount = COUNT(*)
            FROM sys.fn_validate_plan_guide(@pgId);

            IF @valErrCount > 0
            BEGIN
                EXEC sp_control_plan_guide @operation = N'DROP', @name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
                SET @pgId = NULL;
            END;
        END TRY
        BEGIN CATCH
            IF EXISTS (SELECT 1 FROM sys.plan_guides WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile')
                EXEC sp_control_plan_guide @operation = N'DROP', @name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
            SET @pgId = NULL;
        END CATCH;

        /* Tentativa 2 (fallback): trecho sem CRLF final caso versao da procedure difira */
        IF @pgId IS NULL
        BEGIN
            BEGIN TRY
                EXEC sp_create_plan_guide
                    @name            = N'PG_Perf_PesquisarEnderecosPessoa_Recompile',
                    @stmt            = @stmtNoCrLf,
                    @type            = N'OBJECT',
                    @module_or_batch = N'dbo.pr_PesquisarEnderecosPessoa',
                    @params          = NULL,
                    @hints           = N'OPTION (RECOMPILE)';

                SELECT @pgId = plan_guide_id
                FROM sys.plan_guides
                WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';

                SELECT @valErrCount = COUNT(*)
                FROM sys.fn_validate_plan_guide(@pgId);

                IF @valErrCount > 0
                BEGIN
                    SELECT N'[BLOCO 1] Falha ao validar Plan Guide — removido automaticamente' AS Status, *
                    FROM sys.fn_validate_plan_guide(@pgId);
                    EXEC sp_control_plan_guide @operation = N'DROP', @name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
                END
                ELSE
                    PRINT N'[BLOCO 1] OK: Plan Guide PG_Perf_PesquisarEnderecosPessoa_Recompile criado e validado (fallback sem CRLF).';
            END TRY
            BEGIN CATCH
                IF EXISTS (SELECT 1 FROM sys.plan_guides WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile')
                    EXEC sp_control_plan_guide @operation = N'DROP', @name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
                PRINT N'[BLOCO 1] AVISO: Nao foi possivel aplicar Plan Guide automaticamente: ' + ERROR_MESSAGE();
            END CATCH;
        END
        ELSE
        BEGIN
            PRINT N'[BLOCO 1] OK: Plan Guide PG_Perf_PesquisarEnderecosPessoa_Recompile criado e validado com sucesso!';
        END;
    END
    ELSE
        PRINT N'[BLOCO 1] AVISO: Trecho esperado nao localizado em dbo.pr_PesquisarEnderecosPessoa.';
END;
GO


/* ============================================================================
   BLOCO 2A — INDICES EM ECKSISTEMAS.dbo.TOKENS_ARISP_RESPOSTAS (~6,55M linhas HEAP)
   Resolve: 0x0788544DD3BFE0D5 (642 ms), 0x4B8F789B03F81349 (192 ms) e 0xF8D8E859211E1C44 (1.085 ms)
   Recomendado executar apos o encerramento do atendimento (18h-19h).
   ============================================================================ */
USE [ECKSISTEMAS];
GO
SET LOCK_TIMEOUT 10000;
GO

IF OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS', N'U') IS NOT NULL
BEGIN
    /* 1) Indice para UPDATE ... WHERE TOKEN = @2 (0x0788544DD3BFE0D5) */
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS')
          AND name = N'IX_Perf_TokensArisp_Token'
    )
    AND EXISTS (
        SELECT 1 FROM sys.columns c
        JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS')
          AND c.name = N'TOKEN'
          AND c.max_length > 0 AND c.max_length <= 900
          AND t.name NOT IN (N'text', N'ntext', N'image', N'xml')
    )
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'SN_UTILIZADO')
            CREATE NONCLUSTERED INDEX [IX_Perf_TokensArisp_Token]
                ON [dbo].[TOKENS_ARISP_RESPOSTAS] ([TOKEN])
                INCLUDE ([SN_UTILIZADO])
                WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);
        ELSE
            CREATE NONCLUSTERED INDEX [IX_Perf_TokensArisp_Token]
                ON [dbo].[TOKENS_ARISP_RESPOSTAS] ([TOKEN])
                WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);

        PRINT N'[BLOCO 2A] OK: Indice IX_Perf_TokensArisp_Token criado.';
    END
    ELSE
        PRINT N'[BLOCO 2A] IX_Perf_TokensArisp_Token ja existe ou coluna TOKEN nao elegivel.';

    /* 2) Indice para SELECT [TOKEN] WHERE [SN_UTILIZADO] = @1 (0x4B8F789B03F81349) */
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS')
          AND name = N'IX_Perf_TokensArisp_SnUtilizado'
    )
    AND EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'SN_UTILIZADO'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_Perf_TokensArisp_SnUtilizado]
            ON [dbo].[TOKENS_ARISP_RESPOSTAS] ([SN_UTILIZADO])
            INCLUDE ([TOKEN])
            WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);

        PRINT N'[BLOCO 2A] OK: Indice IX_Perf_TokensArisp_SnUtilizado criado.';
    END
    ELSE
        PRINT N'[BLOCO 2A] IX_Perf_TokensArisp_SnUtilizado ja existe ou coluna SN_UTILIZADO ausente.';

    /* 3) Indice para INSERT ... SELECT ISNULL(MAX(ID_TABELA), 0) + 1 (0xF8D8E859211E1C44) */
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS')
          AND name = N'IX_Perf_TokensArisp_IdTabela'
    )
    AND EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'ID_TABELA'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_Perf_TokensArisp_IdTabela]
            ON [dbo].[TOKENS_ARISP_RESPOSTAS] ([ID_TABELA] DESC)
            WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);

        PRINT N'[BLOCO 2A] OK: Indice IX_Perf_TokensArisp_IdTabela criado.';
    END
    ELSE
        PRINT N'[BLOCO 2A] IX_Perf_TokensArisp_IdTabela ja existe ou coluna ID_TABELA ausente.';
END;
GO


/* ============================================================================
   BLOCO 2B — INDICES DE INDISPONIBILIDADE CNIB NO WEBRI
   Resolve: 0x5B286FBEBBD44AF8 (3,15M linhas em ind.tblWRIProcessaIndisponibilidade)
            e indice ausente em ind.tblWRIAtualizacoesRecepcao (~1,80M linhas)
   ============================================================================ */
USE [WEBRI];
GO
SET LOCK_TIMEOUT 10000;
GO

IF OBJECT_ID(N'ind.tblWRIProcessaIndisponibilidade', N'U') IS NOT NULL
BEGIN
    /* Nota: ExecutarProcedure e do tipo TEXT, portanto NAO deve ser incluida no INCLUDE */
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'ind.tblWRIProcessaIndisponibilidade')
          AND name = N'IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao]
            ON [ind].[tblWRIProcessaIndisponibilidade] ([FK_tblWRIAtualizacoesRecepcao_Id])
            WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);

        PRINT N'[BLOCO 2B] OK: Indice IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao criado.';
    END
    ELSE
        PRINT N'[BLOCO 2B] IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao ja existe.';
END;
GO

IF OBJECT_ID(N'ind.tblWRIAtualizacoesRecepcao', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'ind.tblWRIAtualizacoesRecepcao')
          AND name = N'IX_Perf_AtualizacoesRecepcao_Protocolo'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_Perf_AtualizacoesRecepcao_Protocolo]
            ON [ind].[tblWRIAtualizacoesRecepcao] ([FK_tblWRIRecepcaoFlagRecepcao], [FK_tblWRIRecepcaoRecepcao])
            WITH (SORT_IN_TEMPDB = ON, MAXDOP = 2);

        PRINT N'[BLOCO 2B] OK: Indice IX_Perf_AtualizacoesRecepcao_Protocolo criado.';
    END
    ELSE
        PRINT N'[BLOCO 2B] IX_Perf_AtualizacoesRecepcao_Protocolo ja existe.';
END;
GO


/* ============================================================================
   BLOCO 3 — CONFERENCIA DO PLAN GUIDE E DOS 5 INDICES CRIADOS
   ============================================================================ */
USE [WEBRI];
GO

SELECT
    N'WEBRI.plan_guide' AS Escopo,
    pg.name             AS Nome,
    CASE WHEN pg.is_disabled = 0 THEN N'ATIVO' ELSE N'DESABILITADO' END AS Status,
    CASE WHEN EXISTS (SELECT 1 FROM sys.fn_validate_plan_guide(pg.plan_guide_id))
         THEN N'COM ERRO DE VALIDACAO'
         ELSE N'VALIDADO' END AS Validacao
FROM sys.plan_guides pg
WHERE pg.name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile'

UNION ALL

SELECT
    N'WEBRI.ind' AS Escopo,
    i.name       AS Nome,
    N'ATIVO'     AS Status,
    i.type_desc  AS Validacao
FROM sys.indexes i
WHERE i.name LIKE N'IX_Perf_%'
  AND i.object_id IN (
      OBJECT_ID(N'ind.tblWRIProcessaIndisponibilidade'),
      OBJECT_ID(N'ind.tblWRIAtualizacoesRecepcao')
  );
GO

USE [ECKSISTEMAS];
GO

SELECT
    N'ECKSISTEMAS' AS Escopo,
    i.name         AS Nome,
    N'ATIVO'       AS Status,
    i.type_desc    AS Validacao
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS')
  AND i.name LIKE N'IX_Perf_%';
GO


/* ============================================================================
   ROLLBACK INSTANTANEO (DESCOMENTAR SOMENTE SE NECESSARIO REVERTER)
   ============================================================================
USE [WEBRI];
IF EXISTS (SELECT 1 FROM sys.plan_guides WHERE name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile')
    EXEC sp_control_plan_guide @operation = N'DROP', @name = N'PG_Perf_PesquisarEnderecosPessoa_Recompile';
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'ind.tblWRIProcessaIndisponibilidade') AND name = N'IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao')
    DROP INDEX [IX_Perf_ProcessaIndisp_FK_AtualizacoesRecepcao] ON [ind].[tblWRIProcessaIndisponibilidade];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'ind.tblWRIAtualizacoesRecepcao') AND name = N'IX_Perf_AtualizacoesRecepcao_Protocolo')
    DROP INDEX [IX_Perf_AtualizacoesRecepcao_Protocolo] ON [ind].[tblWRIAtualizacoesRecepcao];

USE [ECKSISTEMAS];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'IX_Perf_TokensArisp_Token')
    DROP INDEX [IX_Perf_TokensArisp_Token] ON [dbo].[TOKENS_ARISP_RESPOSTAS];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'IX_Perf_TokensArisp_SnUtilizado')
    DROP INDEX [IX_Perf_TokensArisp_SnUtilizado] ON [dbo].[TOKENS_ARISP_RESPOSTAS];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TOKENS_ARISP_RESPOSTAS') AND name = N'IX_Perf_TokensArisp_IdTabela')
    DROP INDEX [IX_Perf_TokensArisp_IdTabela] ON [dbo].[TOKENS_ARISP_RESPOSTAS];
   ============================================================================ */
