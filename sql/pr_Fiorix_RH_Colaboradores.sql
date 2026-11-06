-- =========================================================================================
-- Script Oficial FIORIX: Integração Somente-Leitura GESTOR -> FIORIX (Módulo RH / Férias)
-- Servidor: SRVSQL (Bancos: GESTOR e WEBRI)
-- Permissão concedida: SOMENTE LEITURA (CONNECT + SELECT via db_datareader em GESTOR
--                      e EXECUTE na procedure WEBRI.dbo.pr_Fiorix_RH_Colaboradores).
-- Nenhuma tabela do GESTOR sofre INSERT, UPDATE ou DELETE.
-- =========================================================================================

-- 1) Conceder acesso SOMENTE LEITURA ao usuário [fiorix_connector] no banco [GESTOR]
USE [GESTOR];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'fiorix_connector')
BEGIN
    CREATE USER [fiorix_connector] FOR LOGIN [fiorix_connector];
END;
GO

ALTER ROLE [db_datareader] ADD MEMBER [fiorix_connector];
GO

-- 2) Criar procedure de leitura dinâmica e resiliente no banco [WEBRI]
USE [WEBRI];
GO

CREATE OR ALTER PROCEDURE dbo.pr_Fiorix_RH_Colaboradores
AS
BEGIN
    SET NOCOUNT ON;

    -- Resolução automática dos nomes exatos das colunas de GESTOR.dbo.tblColaborador
    -- para máxima compatibilidade entre versões do banco GESTOR.
    DECLARE @ColRegistro SYSNAME,
            @ColNome SYSNAME,
            @ColApelido SYSNAME,
            @ColCpf SYSNAME,
            @ColDataNasc SYSNAME,
            @ColDataAdm SYSNAME,
            @ColAtivo SYSNAME,
            @ColFkSexo SYSNAME,
            @ColFkEstCivil SYSNAME,
            @ColFkCidade SYSNAME,
            @ColFkNac SYSNAME,
            @ColUfDireta SYSNAME;

    SELECT TOP 1 @ColRegistro = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name IN (N'Registro', N'PK_Colaborador', N'PK_Id', N'IdColaborador', N'ID', N'Codigo')
           OR c.is_identity = 1)
    ORDER BY CASE c.name
        WHEN N'Registro' THEN 1
        WHEN N'PK_Colaborador' THEN 2
        WHEN N'PK_Id' THEN 3
        WHEN N'IdColaborador' THEN 4
        ELSE 5 END;

    SELECT TOP 1 @ColNome = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name IN (N'NomeCompleto', N'Nome', N'Colaborador', N'Descricao')
    ORDER BY CASE c.name WHEN N'NomeCompleto' THEN 1 WHEN N'Nome' THEN 2 ELSE 3 END;

    SELECT TOP 1 @ColApelido = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name IN (N'ConhecidoComo', N'Apelido', N'NomeCurto', N'NomeSocial')
           OR c.name LIKE N'%Conhecido%' OR c.name LIKE N'%Apelido%');

    SELECT TOP 1 @ColCpf = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name IN (N'CPF', N'Cpf', N'NumCPF', N'DocumentoCPF') OR c.name LIKE N'%CPF%');

    SELECT TOP 1 @ColDataNasc = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name IN (N'DataNascimento', N'DtNascimento', N'Nascimento') OR c.name LIKE N'DataNasc%');

    SELECT TOP 1 @ColDataAdm = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name IN (N'DataAdmissao', N'DtAdmissao', N'Admissao') OR c.name LIKE N'%Admiss%');

    SELECT TOP 1 @ColAtivo = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name IN (N'Ativo', N'FlagAtivo', N'Situacao');

    SELECT TOP 1 @ColFkSexo = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name LIKE N'%Sexo%';

    SELECT TOP 1 @ColFkEstCivil = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name LIKE N'%EstadoCivil%';

    SELECT TOP 1 @ColFkCidade = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND (c.name LIKE N'%Natural%' OR c.name LIKE N'FK_tblGESCida%')
    ORDER BY CASE WHEN c.name LIKE N'%Natural%' THEN 1 ELSE 2 END;

    SELECT TOP 1 @ColFkNac = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name LIKE N'%Naci%';

    SELECT TOP 1 @ColUfDireta = c.name
    FROM GESTOR.sys.columns c
    WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
      AND c.name IN (N'UFNaturalidade', N'UF_Naturalidade');

    -- Resolução opcional de tabelas auxiliares (Sexo, Estado Civil, Cidade/Naturalidade, Nacionalidade)
    DECLARE @JoinSexo NVARCHAR(MAX) = N'', @ExprSexo NVARCHAR(MAX) = N'NULL';
    DECLARE @JoinEstCivil NVARCHAR(MAX) = N'', @ExprEstCivil NVARCHAR(MAX) = N'NULL';
    DECLARE @JoinCidade NVARCHAR(MAX) = N'', @ExprCidade NVARCHAR(MAX) = N'NULL', @ExprUf NVARCHAR(MAX) = N'NULL';
    DECLARE @JoinNac NVARCHAR(MAX) = N'', @ExprNac NVARCHAR(MAX) = N'NULL';

    IF @ColFkSexo IS NOT NULL
    BEGIN
        DECLARE @TblSexo SYSNAME, @PkSexo SYSNAME, @DescSexo SYSNAME;
        SELECT TOP 1 @TblSexo = t.name
        FROM GESTOR.sys.tables t
        WHERE t.name IN (N'tblGESSexo', N'tblSexo') OR t.name LIKE N'%GESSexo%';

        IF @TblSexo IS NOT NULL
        BEGIN
            SELECT TOP 1 @PkSexo = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblSexo))
              AND (c.name LIKE N'PK_%' OR c.name IN (N'Id', N'ID', N'Codigo') OR c.is_identity = 1);
            SELECT TOP 1 @DescSexo = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblSexo))
              AND c.name IN (N'Descricao', N'Sexo', N'Nome');

            IF @PkSexo IS NOT NULL AND @DescSexo IS NOT NULL
            BEGIN
                SET @JoinSexo = N' LEFT JOIN GESTOR.dbo.' + QUOTENAME(@TblSexo) + N' sx WITH (NOLOCK) ON sx.' + QUOTENAME(@PkSexo) + N' = c.' + QUOTENAME(@ColFkSexo);
                SET @ExprSexo = N'sx.' + QUOTENAME(@DescSexo);
            END
        END

        IF @ExprSexo = N'NULL'
        BEGIN
            SET @ExprSexo = N'CASE CAST(c.' + QUOTENAME(@ColFkSexo) + N' AS VARCHAR(20)) WHEN ''1'' THEN ''Masculino'' WHEN ''2'' THEN ''Feminino'' ELSE CAST(c.' + QUOTENAME(@ColFkSexo) + N' AS VARCHAR(30)) END';
        END
    END;

    IF @ColFkEstCivil IS NOT NULL
    BEGIN
        DECLARE @TblEst SYSNAME, @PkEst SYSNAME, @DescEst SYSNAME;
        SELECT TOP 1 @TblEst = t.name
        FROM GESTOR.sys.tables t
        WHERE t.name IN (N'tblGESEstadoCivil', N'tblEstadoCivil') OR t.name LIKE N'%EstadoCivil%';

        IF @TblEst IS NOT NULL
        BEGIN
            SELECT TOP 1 @PkEst = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblEst))
              AND (c.name LIKE N'PK_%' OR c.name IN (N'Id', N'ID', N'Codigo') OR c.is_identity = 1);
            SELECT TOP 1 @DescEst = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblEst))
              AND c.name IN (N'Descricao', N'EstadoCivil', N'Nome');

            IF @PkEst IS NOT NULL AND @DescEst IS NOT NULL
            BEGIN
                SET @JoinEstCivil = N' LEFT JOIN GESTOR.dbo.' + QUOTENAME(@TblEst) + N' ec WITH (NOLOCK) ON ec.' + QUOTENAME(@PkEst) + N' = c.' + QUOTENAME(@ColFkEstCivil);
                SET @ExprEstCivil = N'ec.' + QUOTENAME(@DescEst);
            END
        END
    END;

    IF @ColFkCidade IS NOT NULL
    BEGIN
        DECLARE @TblCid SYSNAME, @PkCid SYSNAME, @DescCid SYSNAME, @UfCid SYSNAME;
        SELECT TOP 1 @TblCid = t.name
        FROM GESTOR.sys.tables t
        WHERE t.name IN (N'tblGESCidade', N'tblGESCidades', N'tblCidade', N'tblCidades') OR t.name LIKE N'tblGESCida%';

        IF @TblCid IS NOT NULL
        BEGIN
            SELECT TOP 1 @PkCid = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblCid))
              AND (c.name LIKE N'PK_%' OR c.name IN (N'Id', N'ID', N'Codigo') OR c.is_identity = 1);
            SELECT TOP 1 @DescCid = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblCid))
              AND c.name IN (N'Nome', N'Cidade', N'Descricao', N'Municipio');
            SELECT TOP 1 @UfCid = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblCid))
              AND c.name IN (N'UF', N'SiglaUF', N'Estado', N'Sigla');

            IF @PkCid IS NOT NULL AND @DescCid IS NOT NULL
            BEGIN
                SET @JoinCidade = N' LEFT JOIN GESTOR.dbo.' + QUOTENAME(@TblCid) + N' cid WITH (NOLOCK) ON cid.' + QUOTENAME(@PkCid) + N' = c.' + QUOTENAME(@ColFkCidade);
                SET @ExprCidade = N'cid.' + QUOTENAME(@DescCid);
                IF @UfCid IS NOT NULL
                    SET @ExprUf = N'cid.' + QUOTENAME(@UfCid);
            END
        END
    END;

    IF @ExprUf = N'NULL' AND @ColUfDireta IS NOT NULL
        SET @ExprUf = N'c.' + QUOTENAME(@ColUfDireta);

    IF @ColFkNac IS NOT NULL
    BEGIN
        DECLARE @TblNac SYSNAME, @PkNac SYSNAME, @DescNac SYSNAME;
        SELECT TOP 1 @TblNac = t.name
        FROM GESTOR.sys.tables t
        WHERE t.name IN (N'tblGESNacionalidade', N'tblGESNacionalidades', N'tblNacionalidade') OR t.name LIKE N'%Nacionalidade%';

        IF @TblNac IS NOT NULL
        BEGIN
            SELECT TOP 1 @PkNac = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblNac))
              AND (c.name LIKE N'PK_%' OR c.name IN (N'Id', N'ID', N'Codigo') OR c.is_identity = 1);
            SELECT TOP 1 @DescNac = c.name FROM GESTOR.sys.columns c
            WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.' + QUOTENAME(@TblNac))
              AND c.name IN (N'Descricao', N'Nacionalidade', N'Nome');

            IF @PkNac IS NOT NULL AND @DescNac IS NOT NULL
            BEGIN
                SET @JoinNac = N' LEFT JOIN GESTOR.dbo.' + QUOTENAME(@TblNac) + N' nac WITH (NOLOCK) ON nac.' + QUOTENAME(@PkNac) + N' = c.' + QUOTENAME(@ColFkNac);
                SET @ExprNac = N'nac.' + QUOTENAME(@DescNac);
            END
        END
    END;

    DECLARE @Sql NVARCHAR(MAX) = N'
        SELECT
            ' + CASE WHEN @ColRegistro IS NOT NULL THEN N'CAST(c.' + QUOTENAME(@ColRegistro) + N' AS INT)' ELSE N'ROW_NUMBER() OVER (ORDER BY (SELECT NULL))' END + N' AS Registro,
            ' + CASE WHEN @ColNome IS NOT NULL THEN N'LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColNome) + N' AS NVARCHAR(200))))' ELSE N'NULL' END + N' AS Nome,
            ' + CASE WHEN @ColApelido IS NOT NULL THEN N'NULLIF(LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColApelido) + N' AS NVARCHAR(120)))), '''')' ELSE N'NULL' END + N' AS Apelido,
            ' + CASE WHEN @ColCpf IS NOT NULL THEN N'NULLIF(LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColCpf) + N' AS VARCHAR(30)))), '''')' ELSE N'NULL' END + N' AS CPF,
            ' + CASE WHEN @ColDataNasc IS NOT NULL THEN N'CONVERT(VARCHAR(10), TRY_CAST(c.' + QUOTENAME(@ColDataNasc) + N' AS DATE), 23)' ELSE N'NULL' END + N' AS DataNascimento,
            ' + CASE WHEN @ColDataAdm IS NOT NULL THEN N'CONVERT(VARCHAR(10), TRY_CAST(c.' + QUOTENAME(@ColDataAdm) + N' AS DATE), 23)' ELSE N'NULL' END + N' AS DataAdmissao,
            ' + @ExprSexo + N' AS Sexo,
            ' + @ExprEstCivil + N' AS EstadoCivil,
            ' + @ExprCidade + N' AS Naturalidade,
            ' + @ExprUf + N' AS UF,
            ' + @ExprNac + N' AS Nacionalidade,
            ' + CASE WHEN @ColAtivo IS NOT NULL THEN N'CAST(CASE WHEN c.' + QUOTENAME(@ColAtivo) + N' IN (1, ''1'', ''S'', ''A'', ''Ativo'') THEN 1 ELSE 0 END AS BIT)' ELSE N'CAST(1 AS BIT)' END + N' AS Ativo
        FROM GESTOR.dbo.tblColaborador c WITH (NOLOCK)'
        + @JoinSexo
        + @JoinEstCivil
        + @JoinCidade
        + @JoinNac
        + CASE WHEN @ColNome IS NOT NULL THEN N' WHERE c.' + QUOTENAME(@ColNome) + N' IS NOT NULL AND LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColNome) + N' AS NVARCHAR(200)))) <> ''''' ELSE N'' END
        + CASE WHEN @ColRegistro IS NOT NULL THEN N' ORDER BY c.' + QUOTENAME(@ColRegistro) + N' ASC;' ELSE N';' END;

    EXEC sp_executesql @Sql;
END;
GO

GRANT EXECUTE ON dbo.pr_Fiorix_RH_Colaboradores TO [fiorix_connector];
GO
