/* =============================================================================
   REURB -> JSON "Importar em Lote" do Ofício Eletrônico (ONR) — Manual v1.4, cap. 6
   Banco: SRVSQL\WEBRI (SQL Server 2012 SP4 — sem FOR JSON / STRING_AGG / STRING_SPLIT)
   OCR auxiliar: SRVSIPLANIA\SiplanIA (PostgreSQL, injetado via scripts/reurb-onr-export.cjs)
   100% SOMENTE LEITURA no WEBRI: só SELECT com NOLOCK; grava apenas em #temp (tempdb).

   SAÍDAS (5 result sets):
     1) json_importacao  -> SOMENTE o JSON {"regularizacoes":[...]} com registros APTOS
     2) alertas          -> alertas (BLOQUEIA/ALTA/MEDIA/INFO) e exclusões (EXCLUIDA)
     3) rascunho         -> regularizações pendentes (Apto = 0) com sugestões de revisão
     4) resumo           -> contadores de auditoria, vínculos e exclusões
     5) origens          -> mapeamento campo a campo (valor + fonte + trecho OCR)

   VERIFICAÇÕES ESTRUTURAIS COMPROVADAS NO WEBRI (19/11/2026):
     - Livro 2 (Matrícula): dbo.tblWRILivro.PK_Id = 2 (Sigla 'LV2', SequenciaInicialAtos = 0).
       tblWRIReal.PK_Num_Livro só representa nº de matrícula quando FK_tblWRILivro_Id = 2;
       vínculos internos entre atos/títulos/imóveis usam sempre tblWRIReal.PK_Id.
     - Datas de prenotação: DtPrenotacao = DtRecep em 100% das 147 prenotações REURB (13/27) >= 2017;
       usa-se DtPrenotacao como primária (DtRecep validada como igual; alerta ALTA se divergir).
     - DataUltimoRegistro: existe apenas em tblWRITitulos/views de protocolo (não em tblWRIReal) e
       reflete o último registro do título/protocolo como um todo — NÃO é usada em derivadas[].dataRegistro.
     - Abertura de derivadas: deve filtrar ab.PK_SeqAto = 0 (não apenas negócio 72), pois matrículas
       como 244252..244316 (prenotação 572013) foram lançadas com SeqAto = 0 e negócio 946.

   REGRAS PENDENTES DE CONFIRMAÇÃO NO PDF DO MANUAL ONR v1.4 (parametrizadas abaixo):
     - Separação entre derivadas[] (@IncluirAreasPublicasEmDerivadas = 0) e quantidadeUnidades
       (@IncluirAreasPublicasEmQtdUnidades = 0) para APMs, vias públicas, áreas institucionais/verdes/remanescentes.
     - Regra oficial de abreviação de bairro > 30 chars (@PermitirAbreviacaoBairro = 0 -> mantém bloqueado).
     - Código 3 (art. 69 da Lei 13.465/2017 / dispensa de CRF): mantido pendente no 1º lote (@IncluirArt69 = 0).
     - tipoLocalizacao: enviado como 'U'/'R' conforme layout verificado em consulta anterior ao manual.
   ============================================================================= */
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET LOCK_TIMEOUT 2000;

/* ------------------------------ PARÂMETROS ------------------------------ */
DECLARE @PrenotacaoDe                     INT          = NULL;        -- ex.: 572013 (NULL = sem filtro)
DECLARE @PrenotacaoAte                    INT          = NULL;
DECLARE @PrenotacoesLista                 VARCHAR(MAX) = NULL;        -- ex.: '572013,574613,610478,612623,640441,482245'
DECLARE @DataRegistroDe                   DATE         = '2017-07-11';-- vigência Lei 13.465/2017 (NULL = sem filtro)
DECLARE @DataRegistroAte                  DATE         = NULL;
DECLARE @DataPrenotacaoDe                 DATE         = NULL;
DECLARE @DataPrenotacaoAte                DATE         = NULL;
DECLARE @IncluirCondominio616             BIT          = 1;           -- 1 = inclui negócio 616 sem ato 947 quando REURB comprovada
DECLARE @IncluirArt69                     BIT          = 0;           -- 0 = mantém casos art. 69 pendentes (BLOQUEIA) no 1º lote
DECLARE @IncluirAreasPublicasEmDerivadas  BIT          = 0;           -- 0 = exclui APMs/vias/institucionais da lista derivadas[]
DECLARE @IncluirAreasPublicasEmQtdUnidades BIT         = 0;           -- 0 = exclui APMs/vias/institucionais de quantidadeUnidades
DECLARE @PermitirAbreviacaoBairro         BIT          = 0;           -- 0 = não abrevia bairro > 30 chars sem regra oficial aprovada
DECLARE @UsarFiliacao                     BIT          = 1;           -- 1 = tenta tblWRIRealFiliacao (degrada seguro sem GRANT)
DECLARE @UsarClienteRecepcao              BIT          = 1;           -- 1 = último fallback de agente via vwWRIRecepcao
DECLARE @ModoCentral                      BIT          = 0;           -- 1 = emite saídas extras (derivadas_central e atos_vinculados) p/ FIORIX

/* ---------- COMPLEMENTO MANUAL (dados conferidos na CRF/matrícula) ----------
   Preencha só o que precisar; NULL = mantém o valor do banco.
   tipoAgente: 1 = Poder Público | 2 = Particular                                   */
IF OBJECT_ID('tempdb..#Manual') IS NOT NULL DROP TABLE #Manual;
CREATE TABLE #Manual (
  Prenotacao INT,
  Matricula INT,
  Bairro NVARCHAR(100),
  Agente NVARCHAR(150),
  TipoAgente INT,
  Distrito NVARCHAR(60),
  Municipio NVARCHAR(100),
  FonteDocumento NVARCHAR(200)
);
-- INSERT #Manual VALUES (572013, 188228, N'NOME DO BAIRRO', N'MUNICIPALIDADE DE SÃO PAULO', 1, NULL, NULL, N'CRF de 17/09/2024');

/* ------------------------------ FILTRO LISTA ---------------------------- */
IF OBJECT_ID('tempdb..#PrenFiltro') IS NOT NULL DROP TABLE #PrenFiltro;
CREATE TABLE #PrenFiltro (Prenotacao INT NOT NULL PRIMARY KEY);
IF NULLIF(LTRIM(RTRIM(@PrenotacoesLista)), '') IS NOT NULL
BEGIN
  DECLARE @xmlPren XML = CAST('<x>' + REPLACE(REPLACE(@PrenotacoesLista, ' ', ''), ',', '</x><x>') + '</x>' AS XML);
  INSERT INTO #PrenFiltro (Prenotacao)
  SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
  FROM @xmlPren.nodes('/x') AS t(n)
  WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;
END;
DECLARE @TemPrenFiltro BIT = CASE WHEN EXISTS (SELECT 1 FROM #PrenFiltro) THEN 1 ELSE 0 END;

/* ------------------------------ ESTRUTURAS OCR -------------------------- */
IF OBJECT_ID('tempdb..#OcrMatriz') IS NOT NULL DROP TABLE #OcrMatriz;
CREATE TABLE #OcrMatriz (
  Prenotacao          INT,
  Matricula           INT,
  NegId               INT,
  Classificacao       VARCHAR(40),
  TemReurb            BIT,
  TemCrf              BIT,
  TemArt69            BIT,
  TipoInteresseOcr    INT NULL,
  AgenteOcr           NVARCHAR(200),
  TipoAgenteOcr       INT NULL,
  BairroExpressoOcr   NVARCHAR(200),
  BairroSugestaoOcr   NVARCHAR(200),
  MotivoClassificacao NVARCHAR(400),
  DocumentoOcr         NVARCHAR(120),
  TrechoAgente         NVARCHAR(450),
  TrechoBairro         NVARCHAR(450),
  TrechoClassificacao  NVARCHAR(450),
  EmpreendimentoOcr    NVARCHAR(200) NULL,
  TrechoEmpreendimento NVARCHAR(450) NULL
);
-- @@OCR_MATRIZ@@

IF OBJECT_ID('tempdb..#OcrOrigem') IS NOT NULL DROP TABLE #OcrOrigem;
CREATE TABLE #OcrOrigem (
  Prenotacao        INT,
  MatriculaDerivada INT,
  MatriculaMatriz   INT,
  Metodo            VARCHAR(40),
  DocumentoOcr      NVARCHAR(120),
  TrechoOcr         NVARCHAR(400)
);
-- @@OCR_ORIGEM@@

IF OBJECT_ID('tempdb..#OcrDerivada') IS NOT NULL DROP TABLE #OcrDerivada;
CREATE TABLE #OcrDerivada (
  Matricula      INT NOT NULL PRIMARY KEY,
  Categoria      VARCHAR(30),
  EhAreaPublica  BIT,
  MotivoExclusao NVARCHAR(400),
  DocumentoOcr   NVARCHAR(120),
  TrechoOcr      NVARCHAR(400)
);
-- @@OCR_DERIVADA@@

/* ------------------------------ TABELAS TEMP ---------------------------- */
IF OBJECT_ID('tempdb..#Alerta') IS NOT NULL DROP TABLE #Alerta;
IF OBJECT_ID('tempdb..#PrenMeta') IS NOT NULL DROP TABLE #PrenMeta;
IF OBJECT_ID('tempdb..#RegCand') IS NOT NULL DROP TABLE #RegCand;
IF OBJECT_ID('tempdb..#Reg') IS NOT NULL DROP TABLE #Reg;
IF OBJECT_ID('tempdb..#LocRaw') IS NOT NULL DROP TABLE #LocRaw;
IF OBJECT_ID('tempdb..#LocBairroMaj') IS NOT NULL DROP TABLE #LocBairroMaj;
IF OBJECT_ID('tempdb..#Cli') IS NOT NULL DROP TABLE #Cli;
IF OBJECT_ID('tempdb..#Der') IS NOT NULL DROP TABLE #Der;
IF OBJECT_ID('tempdb..#Fil') IS NOT NULL DROP TABLE #Fil;
IF OBJECT_ID('tempdb..#Emp') IS NOT NULL DROP TABLE #Emp;

CREATE TABLE #Alerta (
  Prenotacao             INT,
  MatriculaRegularizacao INT NULL,
  MatriculaDerivada      INT NULL,
  Campo                  VARCHAR(40),
  Severidade             VARCHAR(12),
  Motivo                 NVARCHAR(1000),
  Fonte                  NVARCHAR(1000),
  AcaoNecessaria         NVARCHAR(500)
);

CREATE TABLE #RegCand (
  Flag               INT NOT NULL,
  Prenotacao         INT NOT NULL,
  TipoPrenotacao     INT NOT NULL,
  RealId             INT NOT NULL,
  Matricula          INT NOT NULL,
  ComplMatricula     VARCHAR(20) NULL,
  ImovelBase         INT NULL,
  NegId              INT NOT NULL,
  AtoId              INT NOT NULL,
  AtoNegId           INT NOT NULL,
  QtdAtos            INT NOT NULL,
  DataRegistro       DATETIME NULL,
  DtPrenotacao       DATETIME NULL,
  DtRecep            DATETIME NULL,
  TemAdquirente71    INT NOT NULL,
  AbertaMesmaPren    INT NOT NULL,
  ClassificacaoFinal VARCHAR(40) NULL,
  MotivoExclusao     NVARCHAR(500) NULL,
  FonteClassificacao NVARCHAR(1000) NULL,
  AcaoClassificacao  NVARCHAR(500) NULL
);

CREATE TABLE #Reg (
  Flag                      INT NOT NULL,
  Prenotacao                INT NOT NULL,
  TipoPrenotacao            INT NOT NULL,
  RealId                    INT NOT NULL,
  Matricula                 INT NOT NULL,
  ComplMatricula            VARCHAR(20) NULL,
  ImovelBase                INT NULL,
  NegId                     INT NOT NULL,
  AtoId                     INT NOT NULL,
  AtoNegId                  INT NOT NULL,
  QtdAtos                   INT NOT NULL,
  DataRegistro              DATETIME NULL,
  DtPrenotacao              DATETIME NULL,
  DtRecep                   DATETIME NULL,
  ClassificacaoFinal        VARCHAR(40) NOT NULL,
  FonteClassificacao        NVARCHAR(1000) NULL,
  ImovelVersao              INT NULL,
  Municipio                 NVARCHAR(200) NULL,
  QtdMunicipios             INT NULL,
  FonteMunicipio            VARCHAR(40) NULL,
  Distrito                  NVARCHAR(200) NULL,
  FonteDistrito             VARCHAR(40) NULL,
  Subdistrito               NVARCHAR(200) NULL,
  FonteSubdistrito          VARCHAR(40) NULL,
  TipoLocalizacao           CHAR(1) NULL,
  FonteTipoLocalizacao      VARCHAR(40) NULL,
  Bairro                    NVARCHAR(200) NULL,
  QtdBairros                INT NULL,
  FonteBairro               VARCHAR(40) NULL,
  BairroSugerido            NVARCHAR(200) NULL,
  FonteBairroSugerido       NVARCHAR(500) NULL,
  TipoInteresse             INT NULL,
  EhArt69                   BIT NOT NULL DEFAULT 0,
  FonteTipoInteresse        VARCHAR(40) NULL,
  Agente                    NVARCHAR(300) NULL,
  FonteAgente               VARCHAR(50) NULL,
  TipoAgente                INT NULL,
  FonteTipoAgente           VARCHAR(50) NULL,
  DocumentoOcr              NVARCHAR(120) NULL,
  TrechoAgenteOcr           NVARCHAR(450) NULL,
  TrechoBairroOcr           NVARCHAR(450) NULL,
  TrechoClassificacaoOcr    NVARCHAR(450) NULL,
  Empreendimento            NVARCHAR(250) NULL,
  FonteEmpreendimento       NVARCHAR(120) NULL,
  TrechoEmpreendimentoOcr   NVARCHAR(450) NULL,
  QtdUnidades               INT NULL,
  QtdDerivadasLista         INT NULL,
  QtdDerivadasTotal         INT NULL,
  QtdAreasPublicasExcluidas INT NULL,
  QtdMatrizesPrenotacao     INT NULL,
  Apto                      BIT NULL
);

/* 1) Candidatos a Regularização (atos 947 e 616 em Livro 2 / REURB 13, 27) --- */
INSERT INTO #RegCand (
  Flag, Prenotacao, TipoPrenotacao, RealId, Matricula, ComplMatricula, ImovelBase,
  NegId, AtoId, AtoNegId, QtdAtos, DataRegistro, DtPrenotacao, DtRecep,
  TemAdquirente71, AbertaMesmaPren
)
SELECT
  rc.PK_FlagRecepcao AS Flag,
  rc.PK_Recepcao     AS Prenotacao,
  rc.TipoPrenotacao,
  r.PK_Id            AS RealId,
  r.PK_Num_Livro     AS Matricula,
  r.PK_Compl_Num_Livro AS ComplMatricula,
  r.FK_tblWRIImovelBase_Id AS ImovelBase,
  an.FK_tblWRINegocios_Id AS NegId,
  MIN(a.PK_Id)       AS AtoId,
  MIN(an.PK_ID)      AS AtoNegId,
  COUNT(DISTINCT a.PK_Id) AS QtdAtos,
  MIN(a.DataAto)     AS DataRegistro,
  MAX(rc.DtPrenotacao) AS DtPrenotacao,
  MAX(rc.DtRecep)    AS DtRecep,
  0                  AS TemAdquirente71,
  0                  AS AbertaMesmaPren
FROM dbo.tblWRIAtos a WITH (NOLOCK)
JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id AND an.FK_tblWRINegocios_Id IN (947, 616)
JOIN dbo.tblWRIReal r WITH (NOLOCK)          ON r.PK_Id = a.FK_tblWRIReal_Id AND r.FK_tblWRILivro_Id = 2
JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK)  ON at.FK_tblWRIAtos_Id = a.PK_Id
JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)     ON rc.PK_FlagRecepcao = at.FK_tblWRIRecepcaoFlagRecepcao
                                            AND rc.PK_Recepcao     = at.FK_tblWRIRecepcaoRecepcao
WHERE rc.TipoPrenotacao IN (13, 27)
  AND (@PrenotacaoDe      IS NULL OR rc.PK_Recepcao >= @PrenotacaoDe)
  AND (@PrenotacaoAte     IS NULL OR rc.PK_Recepcao <= @PrenotacaoAte)
  AND (@TemPrenFiltro     = 0     OR EXISTS (SELECT 1 FROM #PrenFiltro pf WHERE pf.Prenotacao = rc.PK_Recepcao))
  AND (@DataPrenotacaoDe  IS NULL OR rc.DtPrenotacao >= @DataPrenotacaoDe)
  AND (@DataPrenotacaoAte IS NULL OR rc.DtPrenotacao < DATEADD(DAY, 1, @DataPrenotacaoAte))
GROUP BY
  rc.PK_FlagRecepcao, rc.PK_Recepcao, rc.TipoPrenotacao,
  r.PK_Id, r.PK_Num_Livro, r.PK_Compl_Num_Livro, r.FK_tblWRIImovelBase_Id,
  an.FK_tblWRINegocios_Id;

/* Filtro de data de registro; preserva atos sem DataAto quando existe filtro (vai p/ alerta BLOQUEIA) */
DELETE FROM #RegCand
WHERE (@DataRegistroDe  IS NOT NULL AND DataRegistro IS NOT NULL AND CONVERT(date, DataRegistro) < @DataRegistroDe)
   OR (@DataRegistroAte IS NOT NULL AND DataRegistro IS NOT NULL AND CONVERT(date, DataRegistro) > @DataRegistroAte)
   OR (@DataRegistroDe  IS NOT NULL AND DataRegistro IS NULL AND (DtPrenotacao IS NULL OR CONVERT(date, DtPrenotacao) < @DataRegistroDe))
   OR (@DataRegistroAte IS NOT NULL AND DataRegistro IS NULL AND (DtPrenotacao IS NULL OR CONVERT(date, DtPrenotacao) > @DataRegistroAte));

UPDATE c
SET TemAdquirente71 = CASE WHEN EXISTS (
      SELECT 1 FROM dbo.tblWRIAtosParticipantes p WITH (NOLOCK)
      WHERE p.FK_tblWRIAtosNegocios_Id = c.AtoNegId AND p.FK_tblWRITpParticipacao_Id = 71
    ) THEN 1 ELSE 0 END,
    AbertaMesmaPren = CASE WHEN EXISTS (
      SELECT 1 FROM dbo.tblWRIAtos a0 WITH (NOLOCK)
      JOIN dbo.tblWRIAtosTitulos at0 WITH (NOLOCK) ON at0.FK_tblWRIAtos_Id = a0.PK_Id
      WHERE a0.FK_tblWRIReal_Id = c.RealId AND a0.PK_SeqAto = 0
        AND at0.FK_tblWRIRecepcaoFlagRecepcao = c.Flag AND at0.FK_tblWRIRecepcaoRecepcao = c.Prenotacao
    ) THEN 1 ELSE 0 END
FROM #RegCand c;

/* Metadados por prenotação (aberturas Livro 2 com SeqAto = 0) */
SELECT
  c.Flag,
  c.Prenotacao,
  ISNULL((
    SELECT COUNT(DISTINCT ab.FK_tblWRIReal_Id)
    FROM dbo.tblWRIAtosTitulos at0 WITH (NOLOCK)
    JOIN dbo.tblWRIAtos ab WITH (NOLOCK) ON ab.PK_Id = at0.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0
    JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2
    WHERE at0.FK_tblWRIRecepcaoFlagRecepcao = c.Flag AND at0.FK_tblWRIRecepcaoRecepcao = c.Prenotacao
  ), 0) AS QtdSeq0Pren,
  0 AS TemMatriz947
INTO #PrenMeta
FROM (SELECT DISTINCT Flag, Prenotacao FROM #RegCand) c;

/* Classificação inicial de atos 947 (separa matriz REURB vs titulação individual vs condomínio simples intermediário) */
UPDATE c
SET ClassificacaoFinal = CASE
      WHEN om.Classificacao = 'CONDOMINIO_SIMPLES_INTERMEDIARIO' AND c.AbertaMesmaPren = 1 THEN 'CONDOMINIO_SIMPLES_INTERMEDIARIO'
      WHEN om.Classificacao = 'TITULACAO_INDIVIDUAL_947' THEN 'TITULACAO_INDIVIDUAL_947'
      WHEN om.Classificacao = 'MATRIZ_947' THEN 'MATRIZ_947'
      WHEN om.Matricula IS NULL AND c.TemAdquirente71 = 1 AND (pm.QtdSeq0Pren = 0 OR c.AbertaMesmaPren = 1) THEN 'TITULACAO_INDIVIDUAL_947'
      ELSE 'MATRIZ_947'
    END,
    MotivoExclusao = CASE
      WHEN om.Classificacao = 'CONDOMINIO_SIMPLES_INTERMEDIARIO' AND c.AbertaMesmaPren = 1 THEN ISNULL(om.MotivoClassificacao, N'Matrícula intermediária de Condomínio Urbano Simples encerrada na mesma prenotação')
      WHEN om.Classificacao = 'TITULACAO_INDIVIDUAL_947' THEN ISNULL(om.MotivoClassificacao, N'Ato 947 é titulação individual por legitimação fundiária')
      WHEN om.Matricula IS NULL AND c.TemAdquirente71 = 1 AND (pm.QtdSeq0Pren = 0 OR c.AbertaMesmaPren = 1) THEN N'Ato 947 com adquirente (71) sem abertura de loteamento ou aberta na própria prenotação (titulação individual)'
      ELSE NULL
    END,
    FonteClassificacao = CASE
      WHEN om.Matricula IS NOT NULL THEN ISNULL(om.DocumentoOcr, N'SiplanIA.matricula') + N': ' + ISNULL(om.TrechoClassificacao, N'classificado via OCR')
      ELSE N'WEBRI tblWRIAtosNegocios(947) / tblWRIAtosParticipantes(71)'
    END,
    AcaoClassificacao = CASE
      WHEN om.Classificacao = 'CONDOMINIO_SIMPLES_INTERMEDIARIO' AND c.AbertaMesmaPren = 1
        THEN N'Excluída de #Reg e de derivadas[] (unidades finais já vinculadas à matriz de perímetro; evita dupla contagem)'
      WHEN om.Classificacao = 'TITULACAO_INDIVIDUAL_947' OR (om.Matricula IS NULL AND c.TemAdquirente71 = 1 AND (pm.QtdSeq0Pren = 0 OR c.AbertaMesmaPren = 1))
        THEN N'Excluída de #Reg (preservada como derivada para dataRegistro de titulação)'
      ELSE NULL
    END
FROM #RegCand c
JOIN #PrenMeta pm ON pm.Flag = c.Flag AND pm.Prenotacao = c.Prenotacao
LEFT JOIN #OcrMatriz om ON om.Prenotacao = c.Prenotacao AND om.Matricula = c.Matricula AND om.NegId = 947
WHERE c.NegId = 947;

UPDATE pm
SET TemMatriz947 = CASE WHEN EXISTS (
      SELECT 1 FROM #RegCand c
      WHERE c.Flag = pm.Flag AND c.Prenotacao = pm.Prenotacao AND c.ClassificacaoFinal = 'MATRIZ_947'
    ) THEN 1 ELSE 0 END
FROM #PrenMeta pm;

/* Classificação de condomínios negócio 616 */
UPDATE c
SET ClassificacaoFinal = CASE
      WHEN @IncluirCondominio616 = 0 THEN 'CONDOMINIO_616_FORA_ESCOPO'
      WHEN pm.TemMatriz947 = 1 THEN 'CONDOMINIO_616_INTERMEDIARIO'
      WHEN om.Classificacao IN ('CONDOMINIO_616_REURB', 'CONDOMINIO_616_INCONCLUSIVO', 'CONDOMINIO_616_NAO_REURB') THEN om.Classificacao
      ELSE 'CONDOMINIO_616_INCONCLUSIVO'
    END,
    MotivoExclusao = CASE
      WHEN @IncluirCondominio616 = 0 THEN N'Condomínio negócio 616 fora do escopo (@IncluirCondominio616 = 0)'
      WHEN pm.TemMatriz947 = 1 THEN N'Matrícula intermediária de condomínio na mesma prenotação já coberta por matriz 947 (evita dupla contagem)'
      WHEN om.Classificacao = 'CONDOMINIO_616_NAO_REURB' THEN ISNULL(om.MotivoClassificacao, N'Ato 616 sem evidência de REURB/CRF no OCR')
      ELSE NULL
    END,
    FonteClassificacao = CASE
      WHEN om.Matricula IS NOT NULL THEN ISNULL(om.DocumentoOcr, N'SiplanIA.matricula') + N': ' + ISNULL(om.TrechoClassificacao, N'classificado via OCR')
      ELSE N'WEBRI tblWRIAtosNegocios(616) (sem OCR)'
    END,
    AcaoClassificacao = CASE
      WHEN pm.TemMatriz947 = 1 THEN N'Excluída de #Reg (unidades vinculadas pela matriz 947 ou tratadas como subcondomínio)'
      WHEN om.Classificacao = 'CONDOMINIO_616_NAO_REURB' THEN N'Excluída de #Reg por ausência de evidência REURB/CRF'
      WHEN @IncluirCondominio616 = 0 THEN N'Habilitar @IncluirCondominio616 = 1 caso deseje incluir'
      ELSE NULL
    END
FROM #RegCand c
JOIN #PrenMeta pm ON pm.Flag = c.Flag AND pm.Prenotacao = c.Prenotacao
LEFT JOIN #OcrMatriz om ON om.Prenotacao = c.Prenotacao AND om.Matricula = c.Matricula AND om.NegId = 616
WHERE c.NegId = 616;

/* Registrar todas as matrículas excluídas por regra de escopo/classificação */
INSERT INTO #Alerta (Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo, Severidade, Motivo, Fonte, AcaoNecessaria)
SELECT
  c.Prenotacao,
  c.Matricula,
  NULL,
  'escopo_classificacao',
  'EXCLUIDA',
  N'[' + c.ClassificacaoFinal + N'] ' + ISNULL(c.MotivoExclusao, N'Excluída por regra de escopo/classificação'),
  c.FonteClassificacao,
  ISNULL(c.AcaoClassificacao, N'Nenhuma ação necessária se classificação correta')
FROM #RegCand c
WHERE c.ClassificacaoFinal NOT IN ('MATRIZ_947', 'CONDOMINIO_616_REURB', 'CONDOMINIO_616_INCONCLUSIVO');

/* Popular #Reg apenas com matrizes válidas ou inconclusivas para revisão */
INSERT INTO #Reg (
  Flag, Prenotacao, TipoPrenotacao, RealId, Matricula, ComplMatricula, ImovelBase,
  NegId, AtoId, AtoNegId, QtdAtos, DataRegistro, DtPrenotacao, DtRecep,
  ClassificacaoFinal, FonteClassificacao
)
SELECT
  c.Flag, c.Prenotacao, c.TipoPrenotacao, c.RealId, c.Matricula, c.ComplMatricula, c.ImovelBase,
  c.NegId, c.AtoId, c.AtoNegId, c.QtdAtos, c.DataRegistro, c.DtPrenotacao, c.DtRecep,
  c.ClassificacaoFinal, c.FonteClassificacao
FROM #RegCand c
WHERE c.ClassificacaoFinal IN ('MATRIZ_947', 'CONDOMINIO_616_REURB', 'CONDOMINIO_616_INCONCLUSIVO');

/* Alertas de classificação para registros em #Reg */
INSERT INTO #Alerta (Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo, Severidade, Motivo, Fonte, AcaoNecessaria)
SELECT g.Prenotacao, g.Matricula, NULL, 'escopo_classificacao', 'BLOQUEIA',
       N'Condomínio negócio 616 com OCR inconclusivo/contraditório ou ausente — confirmar se é REURB antes de exportar',
       g.FonteClassificacao,
       N'Conferir ato registral/CRF e confirmar vínculo REURB'
FROM #Reg g
WHERE g.ClassificacaoFinal = 'CONDOMINIO_616_INCONCLUSIVO';

INSERT INTO #Alerta (Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo, Severidade, Motivo, Fonte, AcaoNecessaria)
SELECT g.Prenotacao, g.Matricula, NULL, 'escopo_classificacao', 'INFO',
       N'Condomínio negócio 616 incluído por evidência REURB/CRF no OCR',
       g.FonteClassificacao,
       N'Informativo — registro rastreado'
FROM #Reg g
WHERE g.ClassificacaoFinal = 'CONDOMINIO_616_REURB';

/* 2) Enriquecimento de dados da matriz (WEBRI + OCR + #Manual) -------------- */
UPDATE g
SET ImovelVersao = a.FK_tblWRIImovel_Versao
FROM #Reg g
JOIN dbo.tblWRIAtos a WITH (NOLOCK) ON a.PK_Id = g.AtoId;

UPDATE g
SET Distrito             = NULLIF(LTRIM(RTRIM(d.Distrito)), ''),
    FonteDistrito        = CASE WHEN NULLIF(LTRIM(RTRIM(d.Distrito)), '') IS NOT NULL THEN 'WEBRI_DISTRITOS' ELSE NULL END,
    Subdistrito          = NULLIF(LTRIM(RTRIM(s.Descricao)), ''),
    FonteSubdistrito     = CASE WHEN NULLIF(LTRIM(RTRIM(s.Descricao)), '') IS NOT NULL THEN 'WEBRI_SUBDISTRITOS' ELSE NULL END,
    TipoLocalizacao      = CASE WHEN i.FK_tblWRITipoIMovel_Id = 8 OR NULLIF(LTRIM(RTRIM(i.Incra)), '') IS NOT NULL THEN 'R' ELSE 'U' END,
    FonteTipoLocalizacao = 'WEBRI_IMOVEL_TIPO_INCRA',
    Empreendimento       = NULLIF(LTRIM(RTRIM(i.Denominacao)), ''),
    FonteEmpreendimento  = CASE WHEN NULLIF(LTRIM(RTRIM(i.Denominacao)), '') IS NOT NULL THEN 'WEBRI_IMOVEL_DENOMINACAO' ELSE NULL END
FROM #Reg g
JOIN dbo.tblWRIImovel i WITH (NOLOCK) ON i.FK_tblWRIImovelBase_Id = g.ImovelBase
     AND i.PK_Versao = ISNULL(g.ImovelVersao, (SELECT MAX(i2.PK_Versao) FROM dbo.tblWRIImovel i2 WITH (NOLOCK) WHERE i2.FK_tblWRIImovelBase_Id = g.ImovelBase))
LEFT JOIN dbo.tblWRIDistritos d WITH (NOLOCK)    ON d.PK_ID = i.FK_tblWRIDistritos_Id
LEFT JOIN dbo.tblWRISubdistritos s WITH (NOLOCK) ON s.PK_ID = i.FK_tblWRISubdistritos_Id;

/* Localizações do imóvel (usa versão do ato quando preenchida e com linhas; caso contrário todas as versões) */
SELECT
  g.RealId,
  g.Prenotacao,
  l.FK_tblWRIImovel_Versao AS LocVersao,
  NULLIF(LTRIM(RTRIM(c.Cidade)), '')          AS Cidade,
  NULLIF(LTRIM(RTRIM(lt.Bairro)), '')         AS BairroLot,
  NULLIF(LTRIM(RTRIM(lg.Bairro)), '')         AS BairroLog,
  NULLIF(LTRIM(RTRIM(lt.Loteamento)), '')     AS LoteamentoNome,
  NULLIF(LTRIM(RTRIM(cd.Condominio)), '')     AS CondominioNome
INTO #LocRaw
FROM #Reg g
JOIN dbo.tblWRILocalizacao l WITH (NOLOCK) ON l.FK_tblWRIImovelBase_Id = g.ImovelBase
LEFT JOIN dbo.tblWRICidades c WITH (NOLOCK)     ON c.PK_Id = l.FK_tblWRICidades_Id
LEFT JOIN dbo.tblWRILoteamento lt WITH (NOLOCK) ON lt.PK_Id = l.FK_tblWRILoteamento_Id
LEFT JOIN dbo.tblWRICondominio cd WITH (NOLOCK) ON cd.PK_ID = l.FK_tblWRICondominio_Id
LEFT JOIN dbo.tblWRILogradouros lg WITH (NOLOCK) ON lg.PK_Id = l.FK_tblWRILogradouros_Id
WHERE g.ImovelVersao IS NULL
   OR l.FK_tblWRIImovel_Versao = g.ImovelVersao
   OR NOT EXISTS (
        SELECT 1 FROM dbo.tblWRILocalizacao l2 WITH (NOLOCK)
        WHERE l2.FK_tblWRIImovelBase_Id = g.ImovelBase AND l2.FK_tblWRIImovel_Versao = g.ImovelVersao
      );

;WITH agg AS (
  SELECT
    RealId,
    Prenotacao,
    COUNT(DISTINCT Cidade)    AS QtdMun,
    MIN(Cidade)               AS Mun,
    COUNT(DISTINCT BairroLot) AS QtdLot,
    MIN(BairroLot)            AS BLot,
    COUNT(DISTINCT BairroLog) AS QtdLog,
    MIN(BairroLog)            AS BLog,
    MIN(LoteamentoNome)       AS LotNome,
    MIN(CondominioNome)       AS CondNome
  FROM #LocRaw
  GROUP BY RealId, Prenotacao
)
UPDATE g
SET Municipio      = UPPER(a.Mun),
    QtdMunicipios  = a.QtdMun,
    FonteMunicipio = CASE WHEN a.QtdMun = 1 AND a.Mun IS NOT NULL THEN 'WEBRI_CIDADES' ELSE NULL END,
    Bairro         = CASE
                       WHEN a.QtdLot = 1 THEN a.BLot
                       WHEN om.BairroExpressoOcr IS NOT NULL THEN om.BairroExpressoOcr
                       WHEN a.QtdLot = 0 AND a.QtdLog = 1 THEN a.BLog
                       ELSE NULL
                     END,
    QtdBairros     = CASE WHEN a.QtdLot >= 1 THEN a.QtdLot ELSE a.QtdLog END,
    FonteBairro    = CASE
                       WHEN a.QtdLot = 1 THEN 'WEBRI_LOTEAMENTO'
                       WHEN om.BairroExpressoOcr IS NOT NULL THEN 'OCR_MATRICULA_EXPRESSO'
                       WHEN a.QtdLot = 0 AND a.QtdLog = 1 THEN 'WEBRI_LOGRADOURO_UNICO'
                       ELSE NULL
                     END,
    Empreendimento = COALESCE(g.Empreendimento, a.LotNome, a.CondNome, om.EmpreendimentoOcr),
    FonteEmpreendimento = COALESCE(
      g.FonteEmpreendimento,
      CASE WHEN a.LotNome IS NOT NULL THEN 'WEBRI_LOTEAMENTO' END,
      CASE WHEN a.CondNome IS NOT NULL THEN 'WEBRI_CONDOMINIO' END,
      CASE WHEN om.EmpreendimentoOcr IS NOT NULL THEN 'OCR_SIPLANIA' END
    ),
    TrechoEmpreendimentoOcr = om.TrechoEmpreendimento
FROM #Reg g
LEFT JOIN agg a ON a.RealId = g.RealId AND a.Prenotacao = g.Prenotacao
LEFT JOIN #OcrMatriz om ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId;

/* Bairro majoritário dos logradouros (apenas sugestão para revisão quando Bairro estiver vazio/ambíguo) */
;WITH cnt_raw AS (
  SELECT
    lr.RealId,
    lr.Prenotacao,
    lr.BairroLog,
    COUNT(*) AS Qtd,
    CASE WHEN UPPER(lr.BairroLog) = UPPER(ISNULL(g.Distrito, '')) THEN 1 ELSE 0 END AS EhIgualDistrito
  FROM #LocRaw lr
  JOIN #Reg g ON g.RealId = lr.RealId AND g.Prenotacao = lr.Prenotacao
  WHERE lr.BairroLog IS NOT NULL
  GROUP BY lr.RealId, lr.Prenotacao, lr.BairroLog, CASE WHEN UPPER(lr.BairroLog) = UPPER(ISNULL(g.Distrito, '')) THEN 1 ELSE 0 END
), ranked AS (
  SELECT
    RealId,
    Prenotacao,
    BairroLog,
    Qtd,
    SUM(Qtd) OVER (PARTITION BY RealId, Prenotacao) AS TotalComBairro,
    ROW_NUMBER() OVER (PARTITION BY RealId, Prenotacao ORDER BY EhIgualDistrito ASC, Qtd DESC, BairroLog ASC) AS rn
  FROM cnt_raw
)
SELECT RealId, Prenotacao, BairroLog AS BairroMaj, Qtd, TotalComBairro
INTO #LocBairroMaj
FROM ranked
WHERE rn = 1;

UPDATE g
SET BairroSugerido = CASE
      WHEN g.Bairro IS NULL THEN COALESCE(lm.BairroMaj, om.BairroSugestaoOcr)
      ELSE NULL
    END,
    FonteBairroSugerido = CASE
      WHEN g.Bairro IS NOT NULL THEN NULL
      WHEN lm.BairroMaj IS NOT NULL AND om.BairroSugestaoOcr IS NOT NULL
        THEN N'WEBRI_LOGRADOURO_MAJORITARIO (' + CAST(lm.Qtd AS NVARCHAR(10)) + N'/' + CAST(lm.TotalComBairro AS NVARCHAR(10)) + N': ' + lm.BairroMaj + N') | OCR (' + om.BairroSugestaoOcr + N')'
      WHEN lm.BairroMaj IS NOT NULL
        THEN N'WEBRI_LOGRADOURO_MAJORITARIO (' + CAST(lm.Qtd AS NVARCHAR(10)) + N'/' + CAST(lm.TotalComBairro AS NVARCHAR(10)) + N')'
      WHEN om.BairroSugestaoOcr IS NOT NULL
        THEN N'OCR_LOTEAMENTO_NUCLEO (' + ISNULL(om.DocumentoOcr, N'SiplanIA') + N')'
      ELSE NULL
    END
FROM #Reg g
LEFT JOIN #LocBairroMaj lm ON lm.RealId = g.RealId AND lm.Prenotacao = g.Prenotacao
LEFT JOIN #OcrMatriz om    ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId;

/* Cópia dos metadados OCR em #Reg para auditoria / origens */
UPDATE g
SET DocumentoOcr           = om.DocumentoOcr,
    TrechoAgenteOcr        = om.TrechoAgente,
    TrechoBairroOcr        = om.TrechoBairro,
    TrechoClassificacaoOcr = om.TrechoClassificacao
FROM #Reg g
JOIN #OcrMatriz om ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId;

/* Agente: 1) Participante 572 (requerente) -> 2) Participante 273 (transmitente) -> 3) OCR -> 4) vwWRIRecepcao */
;WITH req572 AS (
  SELECT
    g.RealId, g.Prenotacao, ps.Nome,
    ROW_NUMBER() OVER (PARTITION BY g.RealId, g.Prenotacao ORDER BY p.PK_ID) AS rn,
    COUNT(*)     OVER (PARTITION BY g.RealId, g.Prenotacao) AS qtd
  FROM #Reg g
  JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK)      ON an.FK_tblWRIAtos_Id = g.AtoId AND an.FK_tblWRINegocios_Id = g.NegId
  JOIN dbo.tblWRIAtosParticipantes p WITH (NOLOCK) ON p.FK_tblWRIAtosNegocios_Id = an.PK_ID AND p.FK_tblWRITpParticipacao_Id = 572
  JOIN dbo.tblWRIPessoas ps WITH (NOLOCK)          ON ps.PK_Id = p.FK_tblWRIPessoas_Id
  WHERE NULLIF(LTRIM(RTRIM(ps.Nome)), '') IS NOT NULL
)
UPDATE g
SET Agente      = LTRIM(RTRIM(q.Nome)),
    FonteAgente = CASE WHEN q.qtd > 1 THEN 'WEBRI_REQUERENTE_MULTIPLO' ELSE 'WEBRI_REQUERENTE_572' END
FROM #Reg g
JOIN req572 q ON q.RealId = g.RealId AND q.Prenotacao = g.Prenotacao AND q.rn = 1;

;WITH trans273 AS (
  SELECT
    g.RealId, g.Prenotacao, ps.Nome,
    ROW_NUMBER() OVER (PARTITION BY g.RealId, g.Prenotacao ORDER BY p.PK_ID) AS rn
  FROM #Reg g
  JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK)      ON an.FK_tblWRIAtos_Id = g.AtoId AND an.FK_tblWRINegocios_Id = g.NegId
  JOIN dbo.tblWRIAtosParticipantes p WITH (NOLOCK) ON p.FK_tblWRIAtosNegocios_Id = an.PK_ID AND p.FK_tblWRITpParticipacao_Id = 273
  JOIN dbo.tblWRIPessoas ps WITH (NOLOCK)          ON ps.PK_Id = p.FK_tblWRIPessoas_Id
  WHERE NULLIF(LTRIM(RTRIM(ps.Nome)), '') IS NOT NULL
)
UPDATE g
SET Agente      = LTRIM(RTRIM(t.Nome)),
    FonteAgente = 'WEBRI_TRANSMITENTE_273'
FROM #Reg g
JOIN trans273 t ON t.RealId = g.RealId AND t.Prenotacao = g.Prenotacao AND t.rn = 1
WHERE g.Agente IS NULL;

UPDATE g
SET Agente          = LTRIM(RTRIM(om.AgenteOcr)),
    FonteAgente     = 'OCR_ATO_REGISTRO',
    TipoAgente      = om.TipoAgenteOcr,
    FonteTipoAgente = CASE WHEN om.TipoAgenteOcr IN (1, 2) THEN 'OCR_ATO_REGISTRO' ELSE NULL END
FROM #Reg g
JOIN #OcrMatriz om ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId
WHERE g.Agente IS NULL AND NULLIF(LTRIM(RTRIM(om.AgenteOcr)), '') IS NOT NULL;

/* Fallback de Agente via dbo.tblWRIRecepcao.Outorgante (somente entes públicos comprovados) */
;WITH outorgante_pub AS (
  SELECT
    g.RealId,
    g.Prenotacao,
    UPPER(LTRIM(RTRIM(rc.Outorgante))) AS OutUp,
    LEFT(LTRIM(RTRIM(rc.Outorgante)), 100) AS OutRaw
  FROM #Reg g
  JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK) ON rc.PK_FlagRecepcao = g.Flag AND rc.PK_Recepcao = g.Prenotacao
  WHERE g.Agente IS NULL
    AND NULLIF(LTRIM(RTRIM(rc.Outorgante)), '') IS NOT NULL
)
UPDATE g
SET Agente = CASE
      WHEN o.OutUp LIKE N'%SEHAB%' OR o.OutUp LIKE N'%SECRETARIA%HABITA%S_O PAULO%' OR o.OutUp LIKE N'%SECRET_RIA%HABITA%'
        THEN N'SECRETARIA MUNICIPAL DA HABITAÇÃO DA PREFEITURA DE SÃO PAULO - SEHAB'
      WHEN o.OutUp LIKE N'%CDHU%' OR o.OutUp LIKE N'%COMPANHIA%DESENVOL%HABITA%'
        THEN N'COMPANHIA DE DESENVOLVIMENTO HABITACIONAL E URBANO DO ESTADO DE SÃO PAULO - CDHU'
      WHEN o.OutUp LIKE N'%COHAB%' OR o.OutUp LIKE N'%COMPANHIA METROPOLITANA%HABITA%'
        THEN N'COMPANHIA METROPOLITANA DE HABITAÇÃO DE SÃO PAULO - COHAB/SP'
      WHEN o.OutUp LIKE N'%MUNICIPALIDADE DE S_O PAULO%' OR o.OutUp LIKE N'%MUNIC_PIO DE S_O PAULO%' OR o.OutUp = N'PMSP'
        THEN N'MUNICIPALIDADE DE SÃO PAULO'
      ELSE o.OutRaw
    END,
    FonteAgente = 'WEBRI_RECEPCAO_OUTORGANTE',
    TipoAgente = 1,
    FonteTipoAgente = 'WEBRI_RECEPCAO_OUTORGANTE'
FROM #Reg g
JOIN outorgante_pub o ON o.RealId = g.RealId AND o.Prenotacao = g.Prenotacao
WHERE o.OutUp LIKE N'%SEHAB%'
   OR o.OutUp LIKE N'%SECRETARIA%HABITA%'
   OR o.OutUp LIKE N'%SECRET_RIA%HABITA%'
   OR o.OutUp LIKE N'%CDHU%'
   OR o.OutUp LIKE N'%COMPANHIA%DESENVOL%HABITA%'
   OR o.OutUp LIKE N'%COHAB%'
   OR o.OutUp LIKE N'%COMPANHIA METROPOLITANA%HABITA%'
   OR o.OutUp LIKE N'%MUNICIPALIDADE DE S_O PAULO%'
   OR o.OutUp LIKE N'%MUNIC_PIO DE S_O PAULO%'
   OR o.OutUp = N'PMSP'
   OR o.OutUp LIKE N'%PREFEITURA%'
   OR o.OutUp LIKE N'%COORDENADORIA DE REGULARIZA%'
   OR o.OutUp LIKE N'%CORDENADORIA DE REGULARIZA%'
   OR o.OutUp LIKE N'%GOVERNO DO ESTADO%'
   OR o.OutUp LIKE N'%FAZENDA DO ESTADO%'
   OR o.OutUp LIKE N'%UNI_O FEDERAL%';

CREATE TABLE #Cli (Flag INT, Prenotacao INT, Nome NVARCHAR(300));
IF @UsarClienteRecepcao = 1
BEGIN TRY
  INSERT #Cli EXEC (N'SELECT DISTINCT v.PK_FlagRecepcao, v.PK_Recepcao, v.Nome
                     FROM dbo.vwWRIRecepcao v WITH (NOLOCK)
                     JOIN #Reg g ON g.Flag = v.PK_FlagRecepcao AND g.Prenotacao = v.PK_Recepcao');
END TRY
BEGIN CATCH
  INSERT #Alerta VALUES (NULL, NULL, NULL, 'agente', 'INFO',
    N'Fallback do cliente indisponível: ' + ERROR_MESSAGE(),
    N'dbo.vwWRIRecepcao',
    N'Nenhuma ação necessária quando agente vem do ato/OCR');
END CATCH;

UPDATE g
SET Agente      = LTRIM(RTRIM(c.Nome)),
    FonteAgente = 'WEBRI_CLIENTE_PRENOTACAO'
FROM #Reg g
JOIN #Cli c ON c.Flag = g.Flag AND c.Prenotacao = g.Prenotacao
WHERE g.Agente IS NULL AND NULLIF(LTRIM(RTRIM(c.Nome)), '') IS NOT NULL;

/* TipoAgente (1 = Poder Público quando comprovado pelo nome; caso contrário fica NULL -> rascunho) */
UPDATE #Reg
SET TipoAgente      = 1,
    FonteTipoAgente = ISNULL(FonteTipoAgente, 'PADRAO_NOME_ENTE_PUBLICO')
WHERE TipoAgente IS NULL
  AND (
       Agente LIKE N'%PREFEITURA%'
    OR Agente LIKE N'%MUNICIPALIDADE%'
    OR Agente LIKE N'%MUNIC[IÍ]PIO DE%'
    OR Agente LIKE N'%SECRETARIA%'
    OR Agente LIKE N'%SEHAB%'
    OR Agente LIKE N'%COHAB%'
    OR Agente LIKE N'%CDHU%'
    OR Agente LIKE N'%COMPANHIA DE DESENVOLVIMENTO HABITACIONAL%'
    OR Agente LIKE N'%COMPANHIA METROPOLITANA DE HABITA%'
    OR Agente LIKE N'%GOVERNO DO ESTADO%'
    OR Agente LIKE N'%FAZENDA DO ESTADO%'
    OR Agente LIKE N'%UNI[AÃ]O FEDERAL%'
    OR Agente LIKE N'%COORDENADORIA DE REGULARIZA%'
    OR Agente LIKE N'%PODER P_BLICO%'
    OR Agente LIKE N'%C_MARA MUNICIPAL%'
  );

/* TipoInteresse (13 -> 1, 27 -> 2; art. 69 -> 3 parametrizado) */
UPDATE g
SET TipoInteresse = CASE
      WHEN om.TemArt69 = 1 THEN 3
      WHEN g.TipoPrenotacao = 13 THEN 1
      WHEN g.TipoPrenotacao = 27 THEN 2
      ELSE NULL
    END,
    EhArt69 = ISNULL(om.TemArt69, 0),
    FonteTipoInteresse = CASE
      WHEN om.TemArt69 = 1 THEN 'OCR_ART69_LEI_13465'
      ELSE 'WEBRI_TIPO_PRENOTACAO'
    END
FROM #Reg g
LEFT JOIN #OcrMatriz om ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId;

/* Aplicar #Manual por cima do que foi informado manualmente */
UPDATE g
SET Bairro          = ISNULL(NULLIF(LTRIM(RTRIM(m.Bairro)), ''),    g.Bairro),
    FonteBairro     = CASE WHEN NULLIF(LTRIM(RTRIM(m.Bairro)), '') IS NOT NULL THEN 'MANUAL' ELSE g.FonteBairro END,
    Agente          = ISNULL(NULLIF(LTRIM(RTRIM(m.Agente)), ''),    g.Agente),
    FonteAgente     = CASE WHEN NULLIF(LTRIM(RTRIM(m.Agente)), '') IS NOT NULL THEN 'MANUAL' ELSE g.FonteAgente END,
    TipoAgente      = CASE WHEN m.TipoAgente IN (1, 2) THEN m.TipoAgente ELSE g.TipoAgente END,
    FonteTipoAgente = CASE WHEN m.TipoAgente IN (1, 2) THEN 'MANUAL' ELSE g.FonteTipoAgente END,
    Distrito        = ISNULL(NULLIF(LTRIM(RTRIM(m.Distrito)), ''),  g.Distrito),
    FonteDistrito   = CASE WHEN NULLIF(LTRIM(RTRIM(m.Distrito)), '') IS NOT NULL THEN 'MANUAL' ELSE g.FonteDistrito END,
    Municipio       = ISNULL(UPPER(NULLIF(LTRIM(RTRIM(m.Municipio)), '')), g.Municipio),
    FonteMunicipio  = CASE WHEN NULLIF(LTRIM(RTRIM(m.Municipio)), '') IS NOT NULL THEN 'MANUAL' ELSE g.FonteMunicipio END,
    QtdMunicipios   = CASE WHEN NULLIF(LTRIM(RTRIM(m.Municipio)), '') IS NOT NULL THEN 1 ELSE g.QtdMunicipios END
FROM #Reg g
JOIN #Manual m ON m.Prenotacao = g.Prenotacao AND m.Matricula = g.Matricula;

/* Abreviação opcional de bairro (somente quando @PermitirAbreviacaoBairro = 1) */
IF @PermitirAbreviacaoBairro = 1
BEGIN
  UPDATE #Reg
  SET Bairro = LTRIM(RTRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          Bairro,
          N'Conjunto Habitacional ', N'Cj.Hab.'),
          N'CONJUNTO HABITACIONAL ', N'Cj.Hab.'),
          N'Jardim ', N'Jd.'),
          N'JARDIM ', N'Jd.'),
          N'Vila ', N'Vl.'),
          N'Parque ', N'Pq.')
      ))
  WHERE Bairro IS NOT NULL AND LEN(Bairro) > 30;
END;

UPDATE g
SET QtdMatrizesPrenotacao = x.n
FROM #Reg g
JOIN (SELECT Flag, Prenotacao, COUNT(*) AS n FROM #Reg GROUP BY Flag, Prenotacao) x
  ON x.Flag = g.Flag AND x.Prenotacao = g.Prenotacao;

/* 3) Derivadas (aberturas PK_SeqAto = 0 na mesma prenotação) ---------------- */
CREATE TABLE #Der (
  Flag                      INT NOT NULL,
  Prenotacao                INT NOT NULL,
  RealId                    INT NOT NULL,
  Matricula                 INT NOT NULL,
  ComplMatricula            VARCHAR(20) NULL,
  DataAbertura              DATETIME NULL,
  TipoPrenotacao            INT NOT NULL,
  MatrizRealId              INT NULL,
  DataRegistro              DATETIME NULL,
  Vinculo                   VARCHAR(40) NULL,
  VinculoAmbiguo            BIT NOT NULL DEFAULT 0,
  EhCondominioIntermediario BIT NOT NULL DEFAULT 0,
  Categoria                 VARCHAR(40) NOT NULL DEFAULT 'UNIDADE',
  EhAreaPublica             BIT NOT NULL DEFAULT 0,
  MotivoExclusao            NVARCHAR(400) NULL,
  DocumentoOcr              NVARCHAR(120) NULL,
  TrechoOcr                 NVARCHAR(400) NULL,
  IncluirNaListaDerivadas   BIT NOT NULL DEFAULT 1,
  ContarEmQtdUnidades       BIT NOT NULL DEFAULT 1
);

INSERT INTO #Der (Flag, Prenotacao, RealId, Matricula, ComplMatricula, DataAbertura, TipoPrenotacao)
SELECT
  g.Flag,
  g.Prenotacao,
  rd.PK_Id             AS RealId,
  rd.PK_Num_Livro      AS Matricula,
  rd.PK_Compl_Num_Livro AS ComplMatricula,
  MIN(ab.DataAto)      AS DataAbertura,
  rc.TipoPrenotacao
FROM (SELECT DISTINCT Flag, Prenotacao FROM #Reg) g
JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = g.Flag AND at.FK_tblWRIRecepcaoRecepcao = g.Prenotacao
JOIN dbo.tblWRIAtos ab WITH (NOLOCK)        ON ab.PK_Id = at.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0
JOIN dbo.tblWRIReal rd WITH (NOLOCK)        ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2
JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)    ON rc.PK_FlagRecepcao = g.Flag AND rc.PK_Recepcao = g.Prenotacao
GROUP BY g.Flag, g.Prenotacao, rd.PK_Id, rd.PK_Num_Livro, rd.PK_Compl_Num_Livro, rc.TipoPrenotacao;

/* A própria matriz não é derivada de si mesma */
DELETE d
FROM #Der d
JOIN #Reg g ON g.RealId = d.RealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao;

/* Derivada que recebeu negócio 616 na mesma prenotação é matrícula-terreno intermediária (não é unidade final) */
UPDATE d
SET EhCondominioIntermediario = 1,
    Categoria = 'CONDOMINIO_INTERMEDIARIO',
    MotivoExclusao = N'Matrícula intermediária com ato 616 (Especificação de Condomínio) na mesma prenotação'
FROM #Der d
WHERE EXISTS (
  SELECT 1 FROM dbo.tblWRIAtos a6 WITH (NOLOCK)
  JOIN dbo.tblWRIAtosNegocios an6 WITH (NOLOCK) ON an6.FK_tblWRIAtos_Id = a6.PK_Id AND an6.FK_tblWRINegocios_Id = 616
  JOIN dbo.tblWRIAtosTitulos at6 WITH (NOLOCK)  ON at6.FK_tblWRIAtos_Id = a6.PK_Id
  WHERE a6.FK_tblWRIReal_Id = d.RealId
    AND at6.FK_tblWRIRecepcaoFlagRecepcao = d.Flag
    AND at6.FK_tblWRIRecepcaoRecepcao = d.Prenotacao
);

/* Derivada intermediária de Condomínio Urbano Simples (arts. 61/62 Lei 13.465/2017) encerrada após abrir unidades finais */
UPDATE d
SET EhCondominioIntermediario = 1,
    Categoria = 'CONDOMINIO_SIMPLES_INTERMEDIARIO',
    MotivoExclusao = N'Matrícula intermediária de Condomínio Urbano Simples encerrada após abertura das unidades finais'
FROM #Der d
WHERE d.EhCondominioIntermediario = 0
  AND EXISTS (
    SELECT 1 FROM #RegCand c
    WHERE c.RealId = d.RealId AND c.Flag = d.Flag AND c.Prenotacao = d.Prenotacao
      AND c.ClassificacaoFinal = 'CONDOMINIO_SIMPLES_INTERMEDIARIO'
  );

/* 3a) Vínculo por filiação (tblWRIRealFiliacao — protegido por TRY/CATCH) */
CREATE TABLE #Fil (RealId INT, OrigemId INT);
IF @UsarFiliacao = 1
BEGIN TRY
  INSERT #Fil EXEC (N'SELECT DISTINCT f.FK_tblWRIReal_Id, f.FK_tblWRIReal_Origem
                     FROM dbo.tblWRIRealFiliacao f WITH (NOLOCK)
                     WHERE f.FK_tblWRIReal_Id IN (SELECT RealId FROM #Der)');
END TRY
BEGIN CATCH
  SET @UsarFiliacao = 0;
  INSERT #Alerta VALUES (NULL, NULL, NULL, 'derivadas', 'ALTA',
    N'Sem GRANT SELECT em tblWRIRealFiliacao; vínculos em prenotações multimatrícula dependem de OCR/empreendimentos: ' + ERROR_MESSAGE(),
    N'dbo.tblWRIRealFiliacao',
    N'Manter OCR do SRVSIPLANIA habilitado ou conceder SELECT em tblWRIRealFiliacao');
END CATCH;

;WITH fil_match AS (
  SELECT d.Flag, d.Prenotacao, d.RealId,
         COUNT(DISTINCT g.RealId) AS QtdMatrizes,
         MIN(g.RealId) AS MatrizRealId
  FROM #Der d
  JOIN #Fil f ON f.RealId = d.RealId
  JOIN #Reg g ON g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao AND g.RealId = f.OrigemId
  GROUP BY d.Flag, d.Prenotacao, d.RealId
)
UPDATE d
SET MatrizRealId   = CASE WHEN m.QtdMatrizes = 1 THEN m.MatrizRealId ELSE NULL END,
    Vinculo        = CASE WHEN m.QtdMatrizes = 1 THEN 'FILIACAO' ELSE NULL END,
    VinculoAmbiguo = CASE WHEN m.QtdMatrizes > 1 THEN 1 ELSE d.VinculoAmbiguo END
FROM #Der d
JOIN fil_match m ON m.Flag = d.Flag AND m.Prenotacao = d.Prenotacao AND m.RealId = d.RealId;

/* 3b) Vínculo por empreendimento (tblWRIEmpreendimentos — protegido por TRY/CATCH) */
CREATE TABLE #Emp (RealId INT, OrigemId INT);
BEGIN TRY
  INSERT #Emp EXEC (N'SELECT DISTINCT u.FK_tblWRIReal_Id, e.FK_tblWRIReal_Id
                     FROM dbo.tblWRIEmpreendimentosUnidades u WITH (NOLOCK)
                     JOIN dbo.tblWRIEmpreendimentos e WITH (NOLOCK) ON e.PK_Id = u.FK_tblWRIEmpreendimentos_Id
                     WHERE u.FK_tblWRIReal_Id IN (SELECT RealId FROM #Der WHERE MatrizRealId IS NULL)
                       AND e.FK_tblWRIReal_Id IN (SELECT RealId FROM #Reg)');
END TRY
BEGIN CATCH
  INSERT #Alerta VALUES (NULL, NULL, NULL, 'derivadas', 'INFO',
    N'Sem acesso a tblWRIEmpreendimentos/Unidades: ' + ERROR_MESSAGE(),
    N'dbo.tblWRIEmpreendimentos/Unidades',
    N'Informativo — fallback via OCR/filiação ativo');
END CATCH;

;WITH emp_match AS (
  SELECT d.Flag, d.Prenotacao, d.RealId,
         COUNT(DISTINCT g.RealId) AS QtdMatrizes,
         MIN(g.RealId) AS MatrizRealId
  FROM #Der d
  JOIN #Emp e ON e.RealId = d.RealId
  JOIN #Reg g ON g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao AND g.RealId = e.OrigemId
  WHERE d.MatrizRealId IS NULL AND d.VinculoAmbiguo = 0
  GROUP BY d.Flag, d.Prenotacao, d.RealId
)
UPDATE d
SET MatrizRealId   = CASE WHEN m.QtdMatrizes = 1 THEN m.MatrizRealId ELSE NULL END,
    Vinculo        = CASE WHEN m.QtdMatrizes = 1 THEN 'EMPREENDIMENTO' ELSE NULL END,
    VinculoAmbiguo = CASE WHEN m.QtdMatrizes > 1 THEN 1 ELSE d.VinculoAmbiguo END
FROM #Der d
JOIN emp_match m ON m.Flag = d.Flag AND m.Prenotacao = d.Prenotacao AND m.RealId = d.RealId;

/* 3c) Vínculo por OCR — faixa da averbação de abertura na matriz (AV_FAIXA_MATRIZ) */
;WITH av_match AS (
  SELECT d.Flag, d.Prenotacao, d.RealId,
         COUNT(DISTINCT g.RealId) AS QtdMatrizes,
         MIN(g.RealId) AS MatrizRealId
  FROM #Der d
  JOIN #OcrOrigem o ON o.Prenotacao = d.Prenotacao AND o.MatriculaDerivada = d.Matricula AND o.Metodo = 'AV_FAIXA_MATRIZ'
  JOIN #Reg g ON g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao AND g.Matricula = o.MatriculaMatriz
  WHERE d.MatrizRealId IS NULL AND d.VinculoAmbiguo = 0
  GROUP BY d.Flag, d.Prenotacao, d.RealId
)
UPDATE d
SET MatrizRealId   = CASE WHEN m.QtdMatrizes = 1 THEN m.MatrizRealId ELSE NULL END,
    Vinculo        = CASE WHEN m.QtdMatrizes = 1 THEN 'AV_FAIXA_MATRIZ' ELSE NULL END,
    VinculoAmbiguo = CASE WHEN m.QtdMatrizes > 1 THEN 1 ELSE d.VinculoAmbiguo END
FROM #Der d
JOIN av_match m ON m.Flag = d.Flag AND m.Prenotacao = d.Prenotacao AND m.RealId = d.RealId;

/* 3d) Vínculo por OCR — matrícula de origem / registro anterior na derivada (OCR_MATRICULA_ORIGEM) */
;WITH ocr_match AS (
  SELECT d.Flag, d.Prenotacao, d.RealId,
         COUNT(DISTINCT g.RealId) AS QtdMatrizes,
         MIN(g.RealId) AS MatrizRealId
  FROM #Der d
  JOIN #OcrOrigem o ON o.Prenotacao = d.Prenotacao AND o.MatriculaDerivada = d.Matricula AND o.Metodo = 'OCR_MATRICULA_ORIGEM'
  JOIN #Reg g ON g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao AND g.Matricula = o.MatriculaMatriz
  WHERE d.MatrizRealId IS NULL AND d.VinculoAmbiguo = 0
  GROUP BY d.Flag, d.Prenotacao, d.RealId
)
UPDATE d
SET MatrizRealId   = CASE WHEN m.QtdMatrizes = 1 THEN m.MatrizRealId ELSE NULL END,
    Vinculo        = CASE WHEN m.QtdMatrizes = 1 THEN 'OCR_MATRICULA_ORIGEM' ELSE NULL END,
    VinculoAmbiguo = CASE WHEN m.QtdMatrizes > 1 THEN 1 ELSE d.VinculoAmbiguo END
FROM #Der d
JOIN ocr_match m ON m.Flag = d.Flag AND m.Prenotacao = d.Prenotacao AND m.RealId = d.RealId;

/* 3e) Vínculo direto: prenotação com uma única matriz e sem conflito */
UPDATE d
SET MatrizRealId = g.RealId,
    Vinculo      = 'PRENOTACAO_UNICA_MATRIZ'
FROM #Der d
JOIN #Reg g ON g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao AND g.QtdMatrizesPrenotacao = 1
WHERE d.MatrizRealId IS NULL
  AND d.VinculoAmbiguo = 0
  AND NOT EXISTS (
    SELECT 1 FROM #Fil f
    WHERE f.RealId = d.RealId AND f.OrigemId <> g.RealId
      AND f.OrigemId IN (SELECT RealId FROM #Reg)
  );

/* 3e.1) Fallback de Distrito via derivadas vinculadas (unânime) ou matrículas anteriores da prenotação */
;WITH der_dist AS (
  SELECT
    d.Flag,
    d.Prenotacao,
    d.MatrizRealId,
    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(dt.Distrito)), '')) AS QtdDistritos,
    MIN(NULLIF(LTRIM(RTRIM(dt.Distrito)), '')) AS DistritoUnico
  FROM #Der d
  JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = d.RealId
  JOIN dbo.tblWRIImovel i WITH (NOLOCK) ON i.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id
       AND i.PK_Versao = (SELECT MAX(i2.PK_Versao) FROM dbo.tblWRIImovel i2 WITH (NOLOCK) WHERE i2.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id)
  JOIN dbo.tblWRIDistritos dt WITH (NOLOCK) ON dt.PK_ID = i.FK_tblWRIDistritos_Id
  WHERE d.MatrizRealId IS NOT NULL
    AND NULLIF(LTRIM(RTRIM(dt.Distrito)), '') IS NOT NULL
  GROUP BY d.Flag, d.Prenotacao, d.MatrizRealId
)
UPDATE g
SET Distrito = dd.DistritoUnico,
    FonteDistrito = 'WEBRI_DERIVADAS_DISTRITO'
FROM #Reg g
JOIN der_dist dd ON dd.Flag = g.Flag AND dd.Prenotacao = g.Prenotacao AND dd.MatrizRealId = g.RealId
WHERE NULLIF(LTRIM(RTRIM(g.Distrito)), '') IS NULL
  AND dd.QtdDistritos = 1
  AND dd.DistritoUnico IS NOT NULL;

;WITH orig_dist AS (
  SELECT
    g.Flag,
    g.Prenotacao,
    g.RealId,
    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(dt.Distrito)), '')) AS QtdDistritos,
    MIN(NULLIF(LTRIM(RTRIM(dt.Distrito)), '')) AS DistritoUnico
  FROM #Reg g
  JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = g.Flag AND at.FK_tblWRIRecepcaoRecepcao = g.Prenotacao
  JOIN dbo.tblWRIAtos a WITH (NOLOCK) ON a.PK_Id = at.FK_tblWRIAtos_Id AND a.PK_SeqAto > 0
  JOIN dbo.tblWRIReal r WITH (NOLOCK) ON r.PK_Id = a.FK_tblWRIReal_Id AND r.FK_tblWRILivro_Id = 2 AND r.PK_Num_Livro < g.Matricula
  JOIN dbo.tblWRIImovel i WITH (NOLOCK) ON i.FK_tblWRIImovelBase_Id = r.FK_tblWRIImovelBase_Id
       AND i.PK_Versao = ISNULL(a.FK_tblWRIImovel_Versao, (SELECT MAX(i2.PK_Versao) FROM dbo.tblWRIImovel i2 WITH (NOLOCK) WHERE i2.FK_tblWRIImovelBase_Id = r.FK_tblWRIImovelBase_Id))
  JOIN dbo.tblWRIDistritos dt WITH (NOLOCK) ON dt.PK_ID = i.FK_tblWRIDistritos_Id
  WHERE NULLIF(LTRIM(RTRIM(g.Distrito)), '') IS NULL
    AND NULLIF(LTRIM(RTRIM(dt.Distrito)), '') IS NOT NULL
  GROUP BY g.Flag, g.Prenotacao, g.RealId
)
UPDATE g
SET Distrito = od.DistritoUnico,
    FonteDistrito = 'WEBRI_ORIGEM_DISTRITO'
FROM #Reg g
JOIN orig_dist od ON od.Flag = g.Flag AND od.Prenotacao = g.Prenotacao AND od.RealId = g.RealId
WHERE NULLIF(LTRIM(RTRIM(g.Distrito)), '') IS NULL
  AND od.QtdDistritos = 1
  AND od.DistritoUnico IS NOT NULL;

/* Regra ONR para Guaianases: quando distrito é GUAIANAZES/GUAIANASES e subdistrito está vazio */
UPDATE #Reg
SET Subdistrito = N'GUAIANASES',
    FonteSubdistrito = 'REGRA_ONR_GUAIANASES'
WHERE NULLIF(LTRIM(RTRIM(Subdistrito)), '') IS NULL
  AND UPPER(LTRIM(RTRIM(Distrito))) IN (N'GUAIANAZES', N'GUAIANASES');

/* 3e.1b) Fallback de Municipio via derivadas vinculadas (unânime) */
;WITH der_mun AS (
  SELECT
    d.Flag,
    d.Prenotacao,
    d.MatrizRealId,
    COUNT(DISTINCT UPPER(NULLIF(LTRIM(RTRIM(c.Cidade)), ''))) AS QtdCidades,
    MIN(UPPER(NULLIF(LTRIM(RTRIM(c.Cidade)), ''))) AS CidadeUnica
  FROM #Der d
  JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = d.RealId
  JOIN dbo.tblWRILocalizacao l WITH (NOLOCK) ON l.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id
  JOIN dbo.tblWRICidades c WITH (NOLOCK) ON c.PK_Id = l.FK_tblWRICidades_Id
  WHERE d.MatrizRealId IS NOT NULL
    AND NULLIF(LTRIM(RTRIM(c.Cidade)), '') IS NOT NULL
  GROUP BY d.Flag, d.Prenotacao, d.MatrizRealId
)
UPDATE g
SET Municipio = dm.CidadeUnica,
    QtdMunicipios = 1,
    FonteMunicipio = 'WEBRI_DERIVADAS_MUNICIPIO'
FROM #Reg g
JOIN der_mun dm ON dm.Flag = g.Flag AND dm.Prenotacao = g.Prenotacao AND dm.MatrizRealId = g.RealId
WHERE (NULLIF(LTRIM(RTRIM(g.Municipio)), '') IS NULL OR ISNULL(g.QtdMunicipios, 0) = 0)
  AND dm.QtdCidades = 1
  AND dm.CidadeUnica IS NOT NULL;

/* 3e.1c) Desempate de Bairro majoritário confirmado por empreendimento ou maioria (>= 60%) nas derivadas vinculadas */
;WITH der_bairro_cnt AS (
  SELECT
    d.Flag,
    d.Prenotacao,
    d.MatrizRealId,
    NULLIF(LTRIM(RTRIM(lg.Bairro)), '') AS BairroDer,
    COUNT(DISTINCT d.RealId) AS QtdDerBairro
  FROM #Der d
  JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = d.RealId
  JOIN dbo.tblWRILocalizacao l WITH (NOLOCK) ON l.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id
  JOIN dbo.tblWRILogradouros lg WITH (NOLOCK) ON lg.PK_Id = l.FK_tblWRILogradouros_Id
  WHERE d.MatrizRealId IS NOT NULL
    AND NULLIF(LTRIM(RTRIM(lg.Bairro)), '') IS NOT NULL
  GROUP BY d.Flag, d.Prenotacao, d.MatrizRealId, NULLIF(LTRIM(RTRIM(lg.Bairro)), '')
), der_bairro_tot AS (
  SELECT
    Flag, Prenotacao, MatrizRealId, BairroDer, QtdDerBairro,
    SUM(QtdDerBairro) OVER (PARTITION BY Flag, Prenotacao, MatrizRealId) AS TotalDerComBairro
  FROM der_bairro_cnt
)
UPDATE g
SET Bairro = lm.BairroMaj,
    FonteBairro = 'WEBRI_LOGRADOURO_CONFIRMADO',
    BairroSugerido = NULL,
    FonteBairroSugerido = NULL
FROM #Reg g
JOIN #LocBairroMaj lm ON lm.RealId = g.RealId AND lm.Prenotacao = g.Prenotacao
LEFT JOIN der_bairro_tot dbt
  ON dbt.Flag = g.Flag AND dbt.Prenotacao = g.Prenotacao AND dbt.MatrizRealId = g.RealId
 AND dbt.BairroDer COLLATE Latin1_General_CI_AI = lm.BairroMaj COLLATE Latin1_General_CI_AI
WHERE NULLIF(LTRIM(RTRIM(g.Bairro)), '') IS NULL
  AND NULLIF(LTRIM(RTRIM(lm.BairroMaj)), '') IS NOT NULL
  AND LEN(LTRIM(RTRIM(lm.BairroMaj))) <= 30
  AND (
       (NULLIF(LTRIM(RTRIM(g.Empreendimento)), '') IS NOT NULL AND g.Empreendimento COLLATE Latin1_General_CI_AI LIKE N'%' + LTRIM(RTRIM(lm.BairroMaj)) + N'%')
    OR (dbt.TotalDerComBairro > 0 AND (dbt.QtdDerBairro * 100.0 / dbt.TotalDerComBairro) >= 60.0)
  );

/* 3e.1d) Fallback de Bairro unânime nas derivadas da prenotação (quando a matriz não possui bairro cadastrado) */
;WITH pren_der_bairro AS (
  SELECT
    d.Flag,
    d.Prenotacao,
    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(lg.Bairro)), '')) AS QtdBairrosDer,
    MIN(NULLIF(LTRIM(RTRIM(lg.Bairro)), '')) AS BairroUnicoDer
  FROM #Der d
  JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = d.RealId
  JOIN dbo.tblWRILocalizacao l WITH (NOLOCK) ON l.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id
  JOIN dbo.tblWRILogradouros lg WITH (NOLOCK) ON lg.PK_Id = l.FK_tblWRILogradouros_Id
  WHERE NULLIF(LTRIM(RTRIM(lg.Bairro)), '') IS NOT NULL
  GROUP BY d.Flag, d.Prenotacao
)
UPDATE g
SET Bairro = pb.BairroUnicoDer,
    FonteBairro = 'WEBRI_DERIVADAS_BAIRRO',
    BairroSugerido = NULL,
    FonteBairroSugerido = NULL
FROM #Reg g
JOIN pren_der_bairro pb ON pb.Flag = g.Flag AND pb.Prenotacao = g.Prenotacao
WHERE NULLIF(LTRIM(RTRIM(g.Bairro)), '') IS NULL
  AND ISNULL(g.QtdBairros, 0) = 0
  AND pb.QtdBairrosDer = 1
  AND LEN(LTRIM(RTRIM(pb.BairroUnicoDer))) <= 30;

/* 3e.2) Fallback de Empreendimento via tblWRIRecepcao.Outorgado e loteamento majoritário das derivadas */
UPDATE g
SET Empreendimento = NULLIF(LTRIM(RTRIM(rc.Outorgado)), ''),
    FonteEmpreendimento = 'WEBRI_RECEPCAO_OUTORGADO'
FROM #Reg g
JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK) ON rc.PK_FlagRecepcao = g.Flag AND rc.PK_Recepcao = g.Prenotacao
WHERE NULLIF(LTRIM(RTRIM(g.Empreendimento)), '') IS NULL
  AND NULLIF(LTRIM(RTRIM(rc.Outorgado)), '') IS NOT NULL
  AND UPPER(LTRIM(RTRIM(rc.Outorgado))) <> UPPER(LTRIM(RTRIM(ISNULL(rc.Outorgante, ''))))
  AND UPPER(rc.Outorgado) NOT LIKE N'%PREFEIT%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%MUNICIP%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%SECRETAR%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%SEHAB%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%CDHU%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%COHAB%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%COMPANHIA%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%FAZENDA%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%ESTADO%'
  AND UPPER(rc.Outorgado) NOT LIKE N'%UNI_O%';

;WITH lot_cnt AS (
  SELECT
    d.Flag,
    d.Prenotacao,
    d.MatrizRealId,
    NULLIF(LTRIM(RTRIM(lt.Loteamento)), '') AS LoteamentoNome,
    COUNT(*) AS Qtd
  FROM #Der d
  JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = d.RealId
  JOIN dbo.tblWRILocalizacao l WITH (NOLOCK) ON l.FK_tblWRIImovelBase_Id = rd.FK_tblWRIImovelBase_Id
  JOIN dbo.tblWRILoteamento lt WITH (NOLOCK) ON lt.PK_Id = l.FK_tblWRILoteamento_Id
  WHERE d.MatrizRealId IS NOT NULL
    AND NULLIF(LTRIM(RTRIM(lt.Loteamento)), '') IS NOT NULL
  GROUP BY d.Flag, d.Prenotacao, d.MatrizRealId, NULLIF(LTRIM(RTRIM(lt.Loteamento)), '')
), lot_ranked AS (
  SELECT
    Flag, Prenotacao, MatrizRealId, LoteamentoNome,
    ROW_NUMBER() OVER (PARTITION BY Flag, Prenotacao, MatrizRealId ORDER BY Qtd DESC, LoteamentoNome ASC) AS rn
  FROM lot_cnt
)
UPDATE g
SET Empreendimento = lr.LoteamentoNome,
    FonteEmpreendimento = 'WEBRI_DERIVADAS_LOTEAMENTO'
FROM #Reg g
JOIN lot_ranked lr ON lr.Flag = g.Flag AND lr.Prenotacao = g.Prenotacao AND lr.MatrizRealId = g.RealId AND lr.rn = 1
WHERE NULLIF(LTRIM(RTRIM(g.Empreendimento)), '') IS NULL;

/* 3f) Classificação de APMs, vias públicas, áreas institucionais/verdes/remanescentes via #OcrDerivada */
UPDATE d
SET Categoria      = od.Categoria,
    EhAreaPublica  = od.EhAreaPublica,
    MotivoExclusao = od.MotivoExclusao,
    DocumentoOcr   = od.DocumentoOcr,
    TrechoOcr      = od.TrechoOcr
FROM #Der d
JOIN #OcrDerivada od ON od.Matricula = d.Matricula
WHERE d.EhCondominioIntermediario = 0;

/* Regras separadas para derivadas[] vs quantidadeUnidades */
UPDATE #Der
SET IncluirNaListaDerivadas = CASE
      WHEN EhCondominioIntermediario = 1 THEN 0
      WHEN EhAreaPublica = 1 AND @IncluirAreasPublicasEmDerivadas = 0 THEN 0
      ELSE 1
    END,
    ContarEmQtdUnidades = CASE
      WHEN EhCondominioIntermediario = 1 THEN 0
      WHEN EhAreaPublica = 1 AND @IncluirAreasPublicasEmQtdUnidades = 0 THEN 0
      ELSE 1
    END;

/* Alertas de exclusão de áreas públicas / condomínios intermediários vinculados */
INSERT INTO #Alerta (Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo, Severidade, Motivo, Fonte, AcaoNecessaria)
SELECT
  d.Prenotacao,
  g.Matricula,
  d.Matricula,
  'derivadas',
  'EXCLUIDA',
  N'[' + d.Categoria + N'] ' + ISNULL(d.MotivoExclusao, N'Área pública / institucional / não habitacional excluída de derivadas[] e quantidadeUnidades'),
  COALESCE(d.DocumentoOcr + N': ' + d.TrechoOcr, N'WEBRI / OCR SiplanIA'),
  N'Conferir apenas se o Manual ONR v1.4 exigir envio de áreas públicas'
FROM #Der d
JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
WHERE d.IncluirNaListaDerivadas = 0 OR d.ContarEmQtdUnidades = 0;

/* 3g) dataRegistro da derivada: 1º ato R. (TpAto = 54, SeqAto > 0) de titulação/transmissão REURB */
;WITH tit AS (
  SELECT d.RealId, MIN(a.DataAto) AS Dt
  FROM #Der d
  JOIN dbo.tblWRIAtos a WITH (NOLOCK)          ON a.FK_tblWRIReal_Id = d.RealId AND a.PK_SeqAto > 0 AND a.DataAto IS NOT NULL
  JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id
  JOIN dbo.tblWRINegocios n WITH (NOLOCK)      ON n.PK_Id = an.FK_tblWRINegocios_Id AND n.FK_tblWRITipoatos_id = 54
  JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK)  ON at.FK_tblWRIAtos_Id = a.PK_Id
  JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)     ON rc.PK_FlagRecepcao = at.FK_tblWRIRecepcaoFlagRecepcao
                                              AND rc.PK_Recepcao     = at.FK_tblWRIRecepcaoRecepcao
                                              AND rc.TipoPrenotacao IN (13, 27)
  WHERE (
         an.FK_tblWRINegocios_Id IN (765, 973, 488)
      OR (an.FK_tblWRINegocios_Id = 947 AND NOT EXISTS (
            SELECT 1 FROM #Reg g
            WHERE g.RealId = d.RealId AND g.Flag = rc.PK_FlagRecepcao AND g.Prenotacao = rc.PK_Recepcao
         ))
  )
    AND an.FK_tblWRINegocios_Id NOT IN (72, 614, 946, 616, 447, 461)
  GROUP BY d.RealId
)
UPDATE d
SET DataRegistro = t.Dt
FROM #Der d
JOIN tit t ON t.RealId = d.RealId;

/* Sinaliza eventual ato R. em prenotação REURB com negócio fora da lista padrão (apenas revisão INFO) */
INSERT INTO #Alerta (Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo, Severidade, Motivo, Fonte, AcaoNecessaria)
SELECT DISTINCT
  d.Prenotacao,
  g.Matricula,
  d.Matricula,
  'dataRegistro',
  'INFO',
  N'Derivada possui ato R. negócio ' + CAST(an.FK_tblWRINegocios_Id AS NVARCHAR(10)) + N' (' + ISNULL(n.Descricao, N'') + N') fora da lista de titulação automática',
  N'tblWRIAtos / tblWRINegocios (TpAto=54)',
  N'Verificar se o negócio deve preencher derivadas[].dataRegistro'
FROM #Der d
JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
JOIN dbo.tblWRIAtos a WITH (NOLOCK)          ON a.FK_tblWRIReal_Id = d.RealId AND a.PK_SeqAto > 0 AND a.DataAto IS NOT NULL
JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id
JOIN dbo.tblWRINegocios n WITH (NOLOCK)      ON n.PK_Id = an.FK_tblWRINegocios_Id AND n.FK_tblWRITipoatos_id = 54
JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK)  ON at.FK_tblWRIAtos_Id = a.PK_Id
JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)     ON rc.PK_FlagRecepcao = at.FK_tblWRIRecepcaoFlagRecepcao
                                            AND rc.PK_Recepcao     = at.FK_tblWRIRecepcaoRecepcao
                                            AND rc.TipoPrenotacao IN (13, 27)
WHERE d.IncluirNaListaDerivadas = 1
  AND an.FK_tblWRINegocios_Id NOT IN (72, 614, 946, 616, 447, 461, 765, 973, 488, 947);

/* Totais por regularização */
;WITH der_agg AS (
  SELECT
    MatrizRealId, Flag, Prenotacao,
    SUM(CASE WHEN ContarEmQtdUnidades = 1     THEN 1 ELSE 0 END) AS QtdUnid,
    SUM(CASE WHEN IncluirNaListaDerivadas = 1 THEN 1 ELSE 0 END) AS QtdLista,
    COUNT(*)                                                     AS QtdTotal,
    SUM(CASE WHEN EhAreaPublica = 1           THEN 1 ELSE 0 END) AS QtdApms
  FROM #Der
  WHERE MatrizRealId IS NOT NULL
  GROUP BY MatrizRealId, Flag, Prenotacao
)
UPDATE g
SET QtdUnidades               = ISNULL(x.QtdUnid, 0),
    QtdDerivadasLista         = ISNULL(x.QtdLista, 0),
    QtdDerivadasTotal         = ISNULL(x.QtdTotal, 0),
    QtdAreasPublicasExcluidas = ISNULL(x.QtdApms, 0)
FROM #Reg g
LEFT JOIN der_agg x ON x.MatrizRealId = g.RealId AND x.Flag = g.Flag AND x.Prenotacao = g.Prenotacao;

/* 4) Validações / alertas --------------------------------------------------- */
INSERT INTO #Alerta SELECT m.Prenotacao, m.Matricula, NULL, 'complemento_manual', 'INFO',
  N'Valores informados manualmente aplicados', ISNULL(m.FonteDocumento, N'#Manual (sem documento citado)'), N'Conferido manualmente'
FROM #Manual m;

INSERT INTO #Alerta SELECT m.Prenotacao, m.Matricula, NULL, 'complemento_manual', 'ALTA',
  N'Linha manual não corresponde a nenhuma regularização do filtro', N'#Manual', N'Verificar filtro de datas/prenotação'
FROM #Manual m
WHERE NOT EXISTS (SELECT 1 FROM #Reg g WHERE g.Prenotacao = m.Prenotacao AND g.Matricula = m.Matricula);

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'dataRegistro', 'BLOQUEIA',
  N'Ato ' + CAST(NegId AS VARCHAR(10)) + N' sem DataAto (registro não concluído)',
  N'WEBRI tblWRIAtos.DataAto (ato ' + CAST(AtoId AS VARCHAR(20)) + N')',
  N'Aguardar conclusão do registro no WEBRI'
FROM #Reg WHERE DataRegistro IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'dataPrenotacao', 'BLOQUEIA',
  N'DtPrenotacao vazia', N'WEBRI tblWRIRecepcao', N'Verificar data de prenotação no WEBRI'
FROM #Reg WHERE DtPrenotacao IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'dataPrenotacao', 'ALTA',
  N'DtPrenotacao difere de DtRecep', N'WEBRI tblWRIRecepcao (DtPrenotacao vs DtRecep)', N'Confirmar data efetiva da prenotação no protocolo'
FROM #Reg WHERE DtPrenotacao IS NOT NULL AND CONVERT(date, DtPrenotacao) <> CONVERT(date, DtRecep);

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'matricula', 'BLOQUEIA',
  N'Matrícula com complemento "' + ComplMatricula + N'" não cabe em inteiro', N'WEBRI tblWRIReal.PK_Compl_Num_Livro', N'Verificar regra de complemento no ONR'
FROM #Reg WHERE NULLIF(LTRIM(RTRIM(ComplMatricula)), '') IS NOT NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'dataRegistro', 'MEDIA',
  N'Mais de um ato ' + CAST(NegId AS VARCHAR(10)) + N' na mesma prenotação; usada a menor data', N'WEBRI tblWRIAtos', N'Conferir se a menor data é a do registro da CRF/especificação'
FROM #Reg WHERE QtdAtos > 1;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'municipio', 'BLOQUEIA',
  CASE WHEN ISNULL(QtdMunicipios, 0) = 0 THEN N'Sem cidade na localização do imóvel' ELSE N'Mais de uma cidade na localização' END,
  N'WEBRI tblWRILocalizacao/tblWRICidades', N'Conferir matrícula/CRF e informar em #Manual'
FROM #Reg WHERE Municipio IS NULL OR QtdMunicipios > 1;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'municipio', 'INFO',
  N'Conferir grafia com o cadastro de municípios do ONR: ' + Municipio,
  N'WEBRI tblWRICidades / Manual ONR 6.3', N'Informativo'
FROM #Reg WHERE Municipio IS NOT NULL AND QtdMunicipios = 1;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'distrito', 'BLOQUEIA',
  N'Distrito não cadastrado no imóvel', N'WEBRI tblWRIImovel.FK_tblWRIDistritos_Id', N'Extrair distrito da matrícula (campo IMÓVEL) e preencher #Manual'
FROM #Reg WHERE NULLIF(LTRIM(RTRIM(Distrito)), '') IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'distrito', 'BLOQUEIA',
  N'Distrito com mais de 30 caracteres', N'WEBRI tblWRIDistritos', N'Ajustar/abreviar em #Manual'
FROM #Reg WHERE LEN(Distrito) > 30;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'subdistrito', 'MEDIA',
  N'Subdistrito > 30 caracteres; omitido', N'WEBRI tblWRISubdistritos', N'Revisar se necessário enviar subdistrito abreviado'
FROM #Reg WHERE LEN(Subdistrito) > 30;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'bairro', 'BLOQUEIA',
  CASE
    WHEN ISNULL(QtdBairros, 0) = 0 THEN N'Bairro não cadastrado (loteamento/logradouro) e não expresso no OCR'
    ELSE N'Mais de um bairro nos logradouros do imóvel (Qtd=' + CAST(QtdBairros AS VARCHAR(10)) + N')'
  END
  + CASE WHEN BairroSugerido IS NOT NULL THEN N' — Sugestão p/ revisão: ' + BairroSugerido ELSE N'' END,
  N'WEBRI tblWRILoteamento/tblWRILogradouros'
  + CASE WHEN FonteBairroSugerido IS NOT NULL THEN N' | ' + FonteBairroSugerido ELSE N'' END
  + CASE WHEN TrechoBairroOcr IS NOT NULL THEN N' | ' + ISNULL(DocumentoOcr, N'OCR') + N': ' + TrechoBairroOcr ELSE N'' END,
  N'Conferir bairro expresso na matrícula/certidão/CRF e preencher em #Manual'
FROM #Reg WHERE Bairro IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'bairro', 'BLOQUEIA',
  N'Bairro com mais de 30 caracteres (' + CAST(LEN(Bairro) AS VARCHAR(10)) + N'): ' + Bairro,
  ISNULL(FonteBairro, N'WEBRI/OCR'),
  N'Informar abreviação aprovada em #Manual (abreviação automática desabilitada)'
FROM #Reg WHERE Bairro IS NOT NULL AND LEN(Bairro) > 30;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'bairro', 'MEDIA',
  N'Bairro obtido do cadastro único de logradouros (loteamento sem bairro): ' + Bairro,
  N'WEBRI tblWRILogradouros.Bairro' + CASE WHEN TrechoBairroOcr IS NOT NULL THEN N' | ' + ISNULL(DocumentoOcr, N'OCR') + N': ' + TrechoBairroOcr ELSE N'' END,
  N'Conferir com matrícula/CRF'
FROM #Reg WHERE Bairro IS NOT NULL AND FonteBairro = 'WEBRI_LOGRADOURO_UNICO';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'bairro', 'MEDIA',
  N'Bairro majoritário confirmado via empreendimento/derivadas ou unânime nas derivadas: ' + Bairro,
  ISNULL(FonteBairro, N'WEBRI'),
  N'Conferir com matrícula/CRF'
FROM #Reg WHERE Bairro IS NOT NULL AND FonteBairro IN ('WEBRI_LOGRADOURO_CONFIRMADO', 'WEBRI_DERIVADAS_BAIRRO');

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'municipio', 'INFO',
  N'Município obtido de forma unânime nas matrículas derivadas vinculadas: ' + Municipio,
  N'WEBRI_DERIVADAS_MUNICIPIO',
  N'Informativo — matriz sem cidade preenchida diretamente'
FROM #Reg WHERE FonteMunicipio = 'WEBRI_DERIVADAS_MUNICIPIO';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'tipoLocalizacao', 'MEDIA',
  N'Classificado como Rural — conferir', N'WEBRI tblWRIImovel (TipoImovel/Incra)', N'Confirmar na matrícula/CRF'
FROM #Reg WHERE TipoLocalizacao = 'R';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'tipoLocalizacao', 'BLOQUEIA',
  N'Imóvel/versão não encontrado', N'WEBRI tblWRIImovel', N'Verificar cadastro do imóvel no WEBRI'
FROM #Reg WHERE TipoLocalizacao IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'BLOQUEIA',
  N'Sem participante 572/273, sem agente no OCR e sem cliente da prenotação',
  N'WEBRI tblWRIAtosParticipantes / OCR SiplanIA / vwWRIRecepcao',
  N'Extrair agente promotor da CRF e preencher em #Manual'
FROM #Reg WHERE NULLIF(Agente, '') IS NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'INFO',
  N'Agente obtido do participante 273 (transmitente) do ato: ' + Agente,
  N'WEBRI tblWRIAtosParticipantes (273)' + CASE WHEN TrechoAgenteOcr IS NOT NULL THEN N' | Confirmado ' + ISNULL(DocumentoOcr, N'OCR') + N': ' + TrechoAgenteOcr ELSE N'' END,
  N'Informativo — origem rastreada'
FROM #Reg WHERE FonteAgente = 'WEBRI_TRANSMITENTE_273';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'INFO',
  N'Agente obtido do texto OCR da matrícula: ' + Agente,
  ISNULL(DocumentoOcr, N'SiplanIA.matricula') + N': ' + ISNULL(TrechoAgenteOcr, N''),
  N'Informativo — confirmar com CRF se necessário'
FROM #Reg WHERE FonteAgente = 'OCR_ATO_REGISTRO';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'INFO',
  N'Agente obtido do Outorgante do protocolo no WEBRI: ' + Agente,
  N'WEBRI tblWRIRecepcao.Outorgante',
  N'Informativo — ente público identificado na prenotação'
FROM #Reg WHERE FonteAgente = 'WEBRI_RECEPCAO_OUTORGANTE';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'distrito', 'INFO',
  N'Distrito obtido de forma unânime nas matrículas derivadas/origem da prenotação: ' + Distrito,
  FonteDistrito,
  N'Informativo — matriz recém-aberta sem distrito preenchido diretamente'
FROM #Reg WHERE FonteDistrito IN ('WEBRI_DERIVADAS_DISTRITO', 'WEBRI_ORIGEM_DISTRITO');

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'subdistrito', 'INFO',
  N'Subdistrito preenchido automaticamente como GUAIANASES (regra ONR para distrito Guaianases)',
  N'REGRA_ONR_GUAIANASES',
  N'Informativo — exigência do validador do Ofício Eletrônico ONR'
FROM #Reg WHERE FonteSubdistrito = 'REGRA_ONR_GUAIANASES';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'ocr_origem', 'INFO',
  N'Matriz recém-aberta ainda sem texto no SiplanIA; metadados complementados via OCR da matrícula de origem vinculada à prenotação',
  ISNULL(DocumentoOcr, N'SiplanIA'),
  N'Informativo — conferência automática por documentação de origem'
FROM #Reg WHERE DocumentoOcr LIKE N'%(origem na prot.%';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'MEDIA',
  N'Agente inferido do cliente da prenotação (pode ser apresentante): ' + Agente,
  N'WEBRI vwWRIRecepcao.Nome',
  N'Confirmar agente promotor na CRF'
FROM #Reg WHERE FonteAgente = 'WEBRI_CLIENTE_PRENOTACAO';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'MEDIA',
  N'Mais de um requerente (572) no ato; usado o primeiro',
  N'WEBRI tblWRIAtosParticipantes (572)', N'Confirmar agente principal na CRF'
FROM #Reg WHERE FonteAgente = 'WEBRI_REQUERENTE_MULTIPLO';

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'agente', 'BLOQUEIA',
  N'Agente excede 100 caracteres (' + CAST(LEN(Agente) AS VARCHAR(10)) + N')',
  ISNULL(FonteAgente, N'—'), N'Informar nome até 100 caracteres em #Manual'
FROM #Reg WHERE LEN(Agente) > 100;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'tipoAgente', 'BLOQUEIA',
  N'Não comprovado como Poder Público; confirmar 1 (Público) ou 2 (Particular) na CRF: ' + Agente,
  ISNULL(FonteAgente, N'nome do agente'), N'Informar TipoAgente (1 ou 2) em #Manual'
FROM #Reg WHERE TipoAgente IS NULL AND NULLIF(Agente, '') IS NOT NULL;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'tipoInteresse',
  CASE WHEN @IncluirArt69 = 0 THEN 'BLOQUEIA' ELSE 'MEDIA' END,
  N'Indício de parcelamento art. 69 Lei 13.465/2017 (pré-19/12/1979) no OCR — mantido '
  + CASE WHEN @IncluirArt69 = 0 THEN N'pendente no 1º lote' ELSE N'habilitado com código 3' END,
  ISNULL(DocumentoOcr, N'SiplanIA') + N': ' + ISNULL(TrechoClassificacaoOcr, N''),
  N'Confirmar certidão municipal / dispensa de CRF e só liberar com --incluir-art69'
FROM #Reg WHERE EhArt69 = 1;

INSERT INTO #Alerta SELECT g.Prenotacao, g.Matricula, NULL, 'tipoInteresse', 'BLOQUEIA',
  N'Divergência entre TipoPrenotacao WEBRI (' + CAST(g.TipoPrenotacao AS VARCHAR(5)) + N') e texto OCR (' + CAST(om.TipoInteresseOcr AS VARCHAR(5)) + N')',
  ISNULL(om.DocumentoOcr, N'SiplanIA') + N': ' + ISNULL(om.TrechoClassificacao, N''),
  N'Conferir modalidade (REURB-S vs REURB-E) na CRF'
FROM #Reg g
JOIN #OcrMatriz om ON om.Prenotacao = g.Prenotacao AND om.Matricula = g.Matricula AND om.NegId = g.NegId
WHERE g.EhArt69 = 0 AND om.TipoInteresseOcr IN (1, 2)
  AND om.TipoInteresseOcr <> CASE g.TipoPrenotacao WHEN 13 THEN 1 WHEN 27 THEN 2 END;

INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'derivadas', 'BLOQUEIA',
  N'Nenhuma unidade/lote habitacional vinculado (ONR exige ao menos uma)',
  N'WEBRI PK_SeqAto=0 + #Fil/#Emp/#OcrOrigem', N'Verificar abertura de derivadas / vínculo à matriz'
FROM #Reg WHERE ISNULL(QtdDerivadasLista, 0) = 0;

/* Manual ONR v1.4 (p. 25): exemplo oficial aceita quantidadeUnidades=15 com 4 derivadas no arquivo */
INSERT INTO #Alerta SELECT Prenotacao, Matricula, NULL, 'quantidadeUnidades', 'MEDIA',
  N'quantidadeUnidades (' + CAST(QtdUnidades AS VARCHAR(10)) + N') difere da quantidade em derivadas[] (' + CAST(QtdDerivadasLista AS VARCHAR(10)) + N'); permitido no Manual ONR v1.4 (p. 25)',
  N'Manual ONR v1.4 p. 25 / WEBRI derivadas', N'Conferir apenas se há unidades pendentes de abertura'
FROM #Reg
WHERE QtdDerivadasLista > 0 AND QtdUnidades <> QtdDerivadasLista
  AND @IncluirAreasPublicasEmDerivadas = @IncluirAreasPublicasEmQtdUnidades;

INSERT INTO #Alerta SELECT d.Prenotacao, NULL, d.Matricula, 'derivadas', 'BLOQUEIA',
  CASE WHEN d.VinculoAmbiguo = 1
       THEN N'Derivada com vínculo ambíguo (aponta para mais de uma matriz na mesma prenotação)'
       ELSE N'Derivada sem vínculo comprovado com matriz (prenotação com várias matrizes)'
  END,
  N'tblWRIRealFiliacao / tblWRIEmpreendimentos / #OcrOrigem',
  N'Conferir matrícula de origem/averbação de abertura na matriz'
FROM #Der d WHERE d.MatrizRealId IS NULL;

INSERT INTO #Alerta SELECT g.Prenotacao, g.Matricula, NULL, 'derivadas', 'BLOQUEIA',
  N'Prenotação possui derivadas sem vínculo ou com vínculo ambíguo; quantidadeUnidades não confiável',
  N'tblWRIRealFiliacao / #OcrOrigem',
  N'Resolver vínculo das derivadas órfãs da prenotação'
FROM #Reg g
WHERE g.QtdMatrizesPrenotacao > 1
  AND EXISTS (SELECT 1 FROM #Der d WHERE d.Flag = g.Flag AND d.Prenotacao = g.Prenotacao AND d.MatrizRealId IS NULL);

INSERT INTO #Alerta SELECT d.Prenotacao, g.Matricula, d.Matricula, 'matricula', 'BLOQUEIA',
  N'Derivada com complemento "' + d.ComplMatricula + N'" não cabe em inteiro',
  N'WEBRI tblWRIReal.PK_Compl_Num_Livro', N'Verificar regra ONR para matrícula com complemento'
FROM #Der d
JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
WHERE d.IncluirNaListaDerivadas = 1 AND NULLIF(LTRIM(RTRIM(d.ComplMatricula)), '') IS NOT NULL;

/* Manual ONR v1.4 (p. 24): dataAbertura nas derivadas é não obrigatória */
INSERT INTO #Alerta SELECT d.Prenotacao, g.Matricula, d.Matricula, 'dataAbertura', 'MEDIA',
  N'Derivada sem DataAto no ato de abertura (PK_SeqAto = 0) — enviada com null (Manual ONR v1.4 p. 24)',
  N'WEBRI tblWRIAtos.DataAto', N'Conferir data de abertura da derivada no WEBRI se aplicável'
FROM #Der d
JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
WHERE d.IncluirNaListaDerivadas = 1 AND d.DataAbertura IS NULL;

INSERT INTO #Alerta SELECT d.Prenotacao, g.Matricula, d.Matricula, 'dataRegistro', 'INFO',
  N'Derivada sem ato de titulação REURB; enviada com null',
  N'WEBRI tblWRIAtos (TpAto=54, negócios 765/973/488/947 individual)', N'Informativo — campo opcional até titulação'
FROM #Der d
JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
WHERE d.IncluirNaListaDerivadas = 1 AND d.DataRegistro IS NULL;

INSERT INTO #Alerta SELECT d.Prenotacao, NULL, d.Matricula, 'derivadas', 'BLOQUEIA',
  N'Derivada vinculada a mais de uma regularização na mesma prenotação',
  N'#Der', N'Corrigir duplicidade de vínculo'
FROM #Der d
WHERE d.MatrizRealId IS NOT NULL
GROUP BY d.Prenotacao, d.Matricula
HAVING COUNT(DISTINCT d.MatrizRealId) > 1;

/* Cálculo de aptidão */
UPDATE g
SET Apto = CASE
      WHEN EXISTS (
        SELECT 1 FROM #Alerta a
        WHERE a.Severidade = 'BLOQUEIA' AND a.Prenotacao = g.Prenotacao AND a.MatriculaRegularizacao = g.Matricula
      ) THEN 0
      ELSE 1
    END
FROM #Reg g;

UPDATE g
SET Apto = 0
FROM #Reg g
WHERE EXISTS (
  SELECT 1 FROM #Alerta a
  JOIN #Der d ON d.Matricula = a.MatriculaDerivada AND d.Flag = g.Flag AND d.Prenotacao = a.Prenotacao
  WHERE a.Severidade = 'BLOQUEIA' AND a.MatriculaRegularizacao IS NULL AND a.Prenotacao = g.Prenotacao AND d.MatrizRealId = g.RealId
);

/* 5) SAÍDA 1: JSON (somente APTOS) ------------------------------------------ */
DECLARE @json NVARCHAR(MAX);
;WITH e AS (
  SELECT g.*,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(g.Municipio  ,'\','\\'),'"','\"'),CHAR(13),' '),CHAR(10),' '),CHAR(9),' ') AS jMun,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(g.Distrito   ,'\','\\'),'"','\"'),CHAR(13),' '),CHAR(10),' '),CHAR(9),' ') AS jDis,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(g.Subdistrito,'\','\\'),'"','\"'),CHAR(13),' '),CHAR(10),' '),CHAR(9),' ') AS jSub,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(g.Bairro     ,'\','\\'),'"','\"'),CHAR(13),' '),CHAR(10),' '),CHAR(9),' ') AS jBai,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(g.Agente     ,'\','\\'),'"','\"'),CHAR(13),' '),CHAR(10),' '),CHAR(9),' ') AS jAge
  FROM #Reg g
  WHERE g.Apto = 1
)
SELECT @json = N'{"regularizacoes":[' + ISNULL(STUFF((
  SELECT N',{"matricula":' + CAST(e.Matricula AS NVARCHAR(20))
       + N',"municipio":"' + e.jMun + N'"'
       + N',"distrito":"' + e.jDis + N'"'
       + CASE WHEN NULLIF(e.jSub, '') IS NOT NULL AND LEN(e.Subdistrito) <= 30 THEN N',"subdistrito":"' + e.jSub + N'"' ELSE N'' END
       + N',"bairro":"' + e.jBai + N'"'
       + N',"tipoLocalizacao":"' + e.TipoLocalizacao + N'"'
       + N',"quantidadeUnidades":' + CAST(e.QtdUnidades AS NVARCHAR(10))
       + N',"dataRegistro":"' + CONVERT(NVARCHAR(10), e.DataRegistro, 23) + N'"'
       + N',"dataPrenotacao":"' + CONVERT(NVARCHAR(10), e.DtPrenotacao, 23) + N'"'
       + N',"tipoInteresse":' + CAST(e.TipoInteresse AS NVARCHAR(2))
       + N',"tipoAgente":' + CAST(e.TipoAgente AS NVARCHAR(2))
       + N',"agente":"' + e.jAge + N'"'
       + N',"derivadas":[' + ISNULL(STUFF((
            SELECT N',{"matricula":' + CAST(d.Matricula AS NVARCHAR(20))
                 + N',"dataAbertura":' + ISNULL(N'"' + CONVERT(NVARCHAR(10), d.DataAbertura, 23) + N'"', N'null')
                 + N',"dataRegistro":' + ISNULL(N'"' + CONVERT(NVARCHAR(10), d.DataRegistro, 23) + N'"', N'null')
                 + N',"tipoInteresse":' + CASE
                     WHEN e.EhArt69 = 1 THEN N'3'
                     WHEN d.TipoPrenotacao = 13 THEN N'1'
                     WHEN d.TipoPrenotacao = 27 THEN N'2'
                     ELSE CAST(e.TipoInteresse AS NVARCHAR(2))
                   END + N'}'
            FROM #Der d
            WHERE d.MatrizRealId = e.RealId AND d.Flag = e.Flag AND d.Prenotacao = e.Prenotacao
              AND d.IncluirNaListaDerivadas = 1
            ORDER BY d.Matricula
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, N''), N'') + N']}'
  FROM e
  ORDER BY e.Prenotacao, e.Matricula
  FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, N''), N'') + N']}';

SELECT @json AS json_importacao;

/* SAÍDA 2: Alertas e matrículas excluídas */
SELECT
  Prenotacao,
  MatriculaRegularizacao,
  MatriculaDerivada,
  Campo,
  Severidade,
  Motivo,
  Fonte,
  AcaoNecessaria
FROM #Alerta
ORDER BY
  CASE Severidade WHEN 'BLOQUEIA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'EXCLUIDA' THEN 4 ELSE 5 END,
  Prenotacao, MatriculaRegularizacao, MatriculaDerivada, Campo;

/* SAÍDA 3: Rascunho (regularizações barradas com sugestões) */
SELECT
  g.Prenotacao,
  g.Matricula,
  g.NegId,
  g.ClassificacaoFinal,
  CONVERT(char(10), g.DataRegistro, 23) AS dataRegistro,
  CONVERT(char(10), g.DtPrenotacao, 23) AS dataPrenotacao,
  g.TipoInteresse,
  g.Municipio,
  g.Distrito,
  g.Subdistrito,
  g.Bairro,
  g.BairroSugerido,
  g.FonteBairroSugerido,
  g.TipoLocalizacao,
  g.QtdUnidades,
  g.QtdDerivadasLista,
  g.QtdAreasPublicasExcluidas,
  g.TipoAgente,
  g.Agente,
  g.FonteAgente,
  (SELECT COUNT(*) FROM #Alerta a WHERE a.Severidade = 'BLOQUEIA' AND a.Prenotacao = g.Prenotacao AND (a.MatriculaRegularizacao = g.Matricula OR a.MatriculaRegularizacao IS NULL)) AS QtdBloqueios
FROM #Reg g
WHERE g.Apto = 0
ORDER BY g.Prenotacao, g.Matricula;

/* SAÍDA 4: Resumo / diagnóstico */
SELECT
  (SELECT COUNT(*) FROM #Reg)                                                       AS regularizacoes,
  (SELECT COUNT(*) FROM #Reg WHERE Apto = 1)                                        AS aptas,
  (SELECT COUNT(*) FROM #Reg WHERE Apto = 0)                                        AS rascunho,
  (SELECT COUNT(*) FROM #RegCand WHERE ClassificacaoFinal = 'TITULACAO_INDIVIDUAL_947') AS excluidas_947_individual,
  (SELECT COUNT(*) FROM #RegCand WHERE ClassificacaoFinal = 'CONDOMINIO_616_INTERMEDIARIO') AS excluidas_616_intermediario,
  (SELECT COUNT(*) FROM #RegCand WHERE ClassificacaoFinal = 'CONDOMINIO_616_NAO_REURB') AS excluidas_616_nao_reurb,
  (SELECT COUNT(*) FROM #Reg WHERE ClassificacaoFinal = 'CONDOMINIO_616_REURB')     AS incluidas_616_reurb,
  (SELECT COUNT(*) FROM #Reg WHERE ClassificacaoFinal = 'CONDOMINIO_616_INCONCLUSIVO') AS pendentes_616_inconclusivo,
  (SELECT COUNT(*) FROM #Reg WHERE EhArt69 = 1)                                     AS casos_art69,
  (SELECT COUNT(*) FROM #Der)                                                       AS derivadas_encontradas,
  (SELECT COUNT(*) FROM #Der WHERE MatrizRealId IS NOT NULL)                        AS derivadas_vinculadas,
  (SELECT COUNT(*) FROM #Der WHERE MatrizRealId IS NOT NULL AND IncluirNaListaDerivadas = 1) AS derivadas_no_json,
  (SELECT COUNT(*) FROM #Der WHERE MatrizRealId IS NOT NULL AND EhAreaPublica = 1)  AS areas_publicas_excluidas,
  @UsarFiliacao                                                                     AS filiacao_disponivel,
  (SELECT COUNT(*) FROM #Fil)                                                       AS linhas_filiacao_lidas,
  (SELECT COUNT(*) FROM #Emp)                                                       AS linhas_empreendimento_lidas,
  (SELECT COUNT(*) FROM #Der WHERE Vinculo = 'FILIACAO')                            AS vinc_filiacao,
  (SELECT COUNT(*) FROM #Der WHERE Vinculo = 'EMPREENDIMENTO')                      AS vinc_empreendimento,
  (SELECT COUNT(*) FROM #Der WHERE Vinculo = 'AV_FAIXA_MATRIZ')                     AS vinc_av_faixa_matriz,
  (SELECT COUNT(*) FROM #Der WHERE Vinculo = 'OCR_MATRICULA_ORIGEM')                AS vinc_ocr_origem,
  (SELECT COUNT(*) FROM #Der WHERE Vinculo = 'PRENOTACAO_UNICA_MATRIZ')             AS vinc_unica_matriz,
  (SELECT COUNT(*) FROM #Der WHERE MatrizRealId IS NULL)                            AS derivadas_sem_vinculo,
  (SELECT COUNT(*) FROM #Reg WHERE FonteAgente = 'WEBRI_TRANSMITENTE_273')          AS agente_por_273,
  (SELECT COUNT(*) FROM #Reg WHERE FonteAgente = 'OCR_ATO_REGISTRO')                AS agente_por_ocr,
  (SELECT COUNT(*) FROM #Reg WHERE FonteAgente = 'WEBRI_CLIENTE_PRENOTACAO')        AS agente_pelo_cliente,
  (SELECT COUNT(*) FROM #Reg WHERE TipoAgente IS NULL AND Agente IS NOT NULL)       AS tipoagente_nao_comprovado;

/* SAÍDA 5: Mapeamento de origens campo a campo por regularização */
SELECT
  g.Apto,
  g.Prenotacao,
  g.Matricula,
  g.NegId,
  g.ClassificacaoFinal,
  g.FonteClassificacao,
  g.Municipio,
  g.FonteMunicipio,
  g.Distrito,
  g.FonteDistrito,
  g.Subdistrito,
  g.FonteSubdistrito,
  g.Bairro,
  g.FonteBairro,
  g.BairroSugerido,
  g.FonteBairroSugerido,
  g.TipoLocalizacao,
  g.FonteTipoLocalizacao,
  g.QtdUnidades,
  g.QtdDerivadasLista,
  g.QtdAreasPublicasExcluidas,
  CONVERT(char(10), g.DataRegistro, 23) AS dataRegistro,
  'WEBRI_TBLWRIATOS_DATAATO'            AS FonteDataRegistro,
  CONVERT(char(10), g.DtPrenotacao, 23) AS dataPrenotacao,
  'WEBRI_TBLWRIRECEPCAO_DTPRENOTACAO'   AS FonteDataPrenotacao,
  g.TipoInteresse,
  g.FonteTipoInteresse,
  g.TipoAgente,
  g.FonteTipoAgente,
  g.Agente,
  g.FonteAgente,
  g.DocumentoOcr,
  g.TrechoAgenteOcr,
  g.TrechoBairroOcr,
  g.TrechoClassificacaoOcr,
  g.Empreendimento,
  g.FonteEmpreendimento,
  g.TrechoEmpreendimentoOcr,
  g.EhArt69,
  g.QtdDerivadasTotal,
  g.ComplMatricula,
  g.TipoPrenotacao
FROM #Reg g
ORDER BY g.Prenotacao, g.Matricula;

/* SAÍDA 6 e 7 (somente quando @ModoCentral = 1): Derivadas completas e Atos vinculados */
IF @ModoCentral = 1
BEGIN
  SELECT
    d.Prenotacao,
    g.Matricula AS MatriculaRegularizacao,
    d.Matricula AS MatriculaDerivada,
    d.ComplMatricula,
    CONVERT(char(10), d.DataAbertura, 23) AS dataAbertura,
    CONVERT(char(10), d.DataRegistro, 23) AS dataRegistro,
    CASE
      WHEN g.EhArt69 = 1 THEN 3
      WHEN d.TipoPrenotacao = 13 THEN 1
      WHEN d.TipoPrenotacao = 27 THEN 2
      ELSE g.TipoInteresse
    END AS tipoInteresse,
    d.IncluirNaListaDerivadas,
    d.ContarEmQtdUnidades,
    d.EhAreaPublica,
    d.EhCondominioIntermediario,
    d.Categoria AS CategoriaArea,
    d.Vinculo AS VinculoMetodo,
    d.MotivoExclusao,
    d.DocumentoOcr,
    d.TrechoOcr
  FROM #Der d
  JOIN #Reg g ON g.RealId = d.MatrizRealId AND g.Flag = d.Flag AND g.Prenotacao = d.Prenotacao
  ORDER BY d.Prenotacao, g.Matricula, d.Matricula;

  SELECT
    g.Prenotacao,
    g.Matricula AS MatriculaRegularizacao,
    a.PK_Id AS AtoId,
    a.PK_SeqAto AS SeqAto,
    ISNULL(ta.Av_Reg, '') AS AvReg,
    ISNULL(ta.Tipo, '') AS TipoAto,
    an.FK_tblWRINegocios_Id AS NegId,
    ISNULL(n.Descricao, '') AS NegocioDescricao,
    CONVERT(char(10), a.DataAto, 23) AS DataAto
  FROM #Reg g
  JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = g.Flag AND at.FK_tblWRIRecepcaoRecepcao = g.Prenotacao
  JOIN dbo.tblWRIAtos a WITH (NOLOCK)        ON a.PK_Id = at.FK_tblWRIAtos_Id AND a.FK_tblWRIReal_Id = g.RealId
  LEFT JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id
  LEFT JOIN dbo.tblWRINegocios n WITH (NOLOCK)  ON n.PK_Id = an.FK_tblWRINegocios_Id
  LEFT JOIN dbo.tblWRITipoAtos ta WITH (NOLOCK) ON ta.PK_Id = n.FK_tblWRITipoatos_id
  ORDER BY g.Prenotacao, g.Matricula, a.PK_SeqAto, a.PK_Id;
END;

/* Execução sem truncar (somente leitura):
   sqlcmd -S SRVSQL -d WEBRI -E -y 0 -i sql/reurb_onr_importar_em_lote.sql -o saida.txt
   (ou use o runner Node scripts/reurb-onr-export.cjs, que lê o OCR do SRVSIPLANIA e grava JSON/CSV validados) */
