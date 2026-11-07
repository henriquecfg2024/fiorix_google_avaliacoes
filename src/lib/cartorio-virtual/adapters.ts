/**
 * Adaptadores de Integração e Diagnóstico Operacional — Cartório Virtual (Seções 4, 5, 7 e 16)
 *
 * Classificação estrita e transparente:
 * 1. Recurso existente e utilizável (Connector Heartbeat + Gestão Documental Livro 2).
 * 2. Recurso preparado com interface de adaptação somente leitura (Consultas SQL WEBRI Certidões,
 *    aguardando GRANT SELECT nas tabelas tblWRICertidao* / tblWRIReal / tblWRIRecepcao).
 * 3. Dependências externas mantidas explicitamente DESABILITADAS no piloto (eREG/ONR escrita,
 *    Assinador externo A1/A3, Entrega WhatsApp Balcão, Prefeitura, Receita Federal, ARISP, CDT).
 */

import { prisma } from "@/lib/prisma";

export type ClassificacaoDependenciaPiloto =
  | "EXISTENTE_UTILIZAVEL"
  | "IMPLEMENTADO_AGUARDANDO_GRANT_OU_ATIVACAO"
  | "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO";

export type EstadoOperacionalAdaptador =
  | "ONLINE"
  | "ATRASADO"
  | "SEM_PERMISSAO_SELECT"
  | "DESABILITADO_NO_PILOTO"
  | "OFFLINE"
  | "NAO_CONFIGURADO";

export interface DiagnosticoAdaptadorIntegracao {
  id:
    | "WEBRI_SQL_CERTIDOES"
    | "ACERVO_LIVRO2_CONNECTOR"
    | "EREG_ONR_RECEPCAO"
    | "ASSINADOR_EXTERNO_A1_A3"
    | "ENTREGA_WHATSAPP_BALCAO"
    | "PREFEITURA_MUNICIPAL"
    | "RECEITA_FEDERAL"
    | "ARISP_CENTRAL"
    | "CDT_PROTESTO_NOTAS";
  nome: string;
  sistemaAlvo: string;
  modoOperacao: "SOMENTE_LEITURA" | "ORQUESTRACAO_EXTERNA_DESABILITADA" | "DESABILITADO";
  classificacao: ClassificacaoDependenciaPiloto;
  habilitadoNoPiloto: boolean;
  estado: EstadoOperacionalAdaptador;
  ultimaSincronizacaoIso: string | null;
  atrasoMinutos: number | null;
  mensagemOperacional: string;
  acaoRecomendadaTI: string | null;
}

/**
 * Contrato de Orquestração Externa de Assinatura A1/A3 (Seção 16):
 * O FIORIX JAMAIS recebe, solicita ou armazena chaves privadas, senhas ou PINs de certificado digital.
 * Apenas prepara metadados auditáveis para o assinador homologado da serventia quando habilitado em fase futura.
 */
export interface SolicitacaoOrquestracaoAssinaturaExterna {
  tenantId: string;
  pedidoId: string;
  numeroPedido: string;
  documentoHashSha256: string;
  modalidadeSolicitada: "INDIVIDUAL" | "LOTE";
  tipoCertificadoHomologado: "A1_LOCAL_SERVENTIA" | "A3_TOKEN_FISICO";
  solicitadoPorUserId: string;
  solicitadoPorPapelRegistral: string;
}

export function prepararSolicitacaoAssinaturaExternaPiloto(
  _req: SolicitacaoOrquestracaoAssinaturaExterna
): { enviado: false; motivoDesabilitado: string } {
  return {
    enviado: false,
    motivoDesabilitado:
      "Assinatura automática/integrada explicitamente desabilitada no escopo do piloto (Seção 3 e Seção 16). Nenhuma chave privada, senha ou PIN é armazenado pelo FIORIX.",
  };
}

/**
 * Tabelas SQL do WEBRI (SRVSQL\WEBRI — SQL Server 2012 SP4) requeridas em modo estritamente SOMENTE LEITURA
 * pelo login [fiorix_connector] para ativação da leitura real de pedidos de certidão e contraditório de prenotações.
 */
export const TABELAS_SQL_SOMENTE_LEITURA_CERTIDOES = [
  "dbo.tblWRICertidao",
  "dbo.tblWRICertidaoItens",
  "dbo.tblWRICertidaoItensImovel",
  "dbo.tblWRICertidaoResultadoContraditorio",
  "dbo.tblWRINaturezaCertidao",
  "dbo.tblWRITipoPedidoCertidao",
  "dbo.tblWRIRecepcao_CertidoesONR",
  "dbo.tblWRIRecepcao",
  "dbo.tblWRITitulos",
  "dbo.tblWRITipoPrenotacao",
  "dbo.tblWRITitulosReal",
  "dbo.tblWRIReal",
  "dbo.tblWRIImovelBase",
  "dbo.tblWRIImovel",
  "dbo.tblWRIAtosTitulos",
] as const;

/**
 * Consulta SQL Canônica Somente Leitura (SELECT) para extração do Número da Prenotação em Contraditório
 * a partir das tabelas oficiais do SIPLAN WEBRI:
 * tblWRIRecepcao, tblWRITitulos, tblWRICertidaoResultadoContraditorio, tblWRITipoPrenotacao,
 * tblWRITitulosReal, tblWRIReal, tblWRIImovelBase, tblWRIImovel.
 */
export const CONSULTA_SQL_CONTRADITORIO_PRENOTACOES_WEBRI = `
SELECT
    Recp.PK_FlagRecepcao            AS PK_FlagRecepcao,
    Recp.PK_Recepcao                AS PK_Recepcao,
    ISNULL(Recp.NumPrenotacao, Recp.PK_Recepcao) AS NumPrenotacao,
    Recp.ProtocoloEntidade          AS ProtocoloMagnetico,
    Recp.DtRecep                    AS DtRecep,
    Recp.DtPrenotacao               AS DtPrenotacao,
    Recp.TipoPrenotacao             AS TipoPrenotacaoCodigo,
    Tp.TipoPrenotacao               AS TipoPrenotacaoDescricao,
    Tit.PK_SeqTitulo                AS PK_SeqTitulo,
    Tit.DataDoTituloApresentado     AS DataTituloApresentado,
    Tit.DtPrevisaoEntrega           AS DtPrevisaoEntrega,
    RealMat.NumLivro                AS NumeroMatriculaReal,
    ImvBase.NumeroMatricula         AS NumeroMatriculaImovelBase,
    Imv.Matricula                   AS NumeroMatriculaImovel,
    Contra.Pk_NrPedido              AS NumeroPedidoCertidao
FROM dbo.tblWRIRecepcao Recp WITH (NOLOCK)
INNER JOIN dbo.tblWRITitulos Tit WITH (NOLOCK)
    ON Tit.FK_tblWRIRecepcaoFlagRecepcao = Recp.PK_FlagRecepcao
   AND Tit.FK_tblWRIRecepcaoRecepcao     = Recp.PK_Recepcao
LEFT JOIN dbo.tblWRITipoPrenotacao Tp WITH (NOLOCK)
    ON Tp.PK_ID = Recp.TipoPrenotacao
LEFT JOIN dbo.tblWRITitulosReal TitReal WITH (NOLOCK)
    ON TitReal.FK_tblWRIRecepcaoFlagRecepcao = Tit.FK_tblWRIRecepcaoFlagRecepcao
   AND TitReal.FK_tblWRIRecepcaoRecepcao     = Tit.FK_tblWRIRecepcaoRecepcao
   AND TitReal.FK_tblWRITitulosSeqTitulo     = Tit.PK_SeqTitulo
LEFT JOIN dbo.tblWRIReal RealMat WITH (NOLOCK)
    ON RealMat.PK_Real = TitReal.FK_tblWRIRealReal
LEFT JOIN dbo.tblWRIImovelBase ImvBase WITH (NOLOCK)
    ON ImvBase.PK_ImovelBase = RealMat.FK_tblWRIImovelBase
LEFT JOIN dbo.tblWRIImovel Imv WITH (NOLOCK)
    ON Imv.FK_tblWRIImovelBase = ImvBase.PK_ImovelBase
LEFT JOIN dbo.tblWRICertidaoResultadoContraditorio Contra WITH (NOLOCK)
    ON Contra.NumPrenotacao = Recp.NumPrenotacao
WHERE ISNULL(Recp.FlagCancelamento, 'N') <> 'S'
  AND ISNULL(Recp.FlagRetirada, 'N') <> 'S'
  AND Tit.DtRetirada IS NULL;
`.trim();

export function gerarScriptGrantSelectSomenteLeitura(loginSql = "fiorix_connector"): string {
  const linhas = [
    "-- Script DBA de Permissão Estritamente SOMENTE LEITURA (SELECT) no banco WEBRI",
    "-- Nenhuma procedure, view, tabela, trigger ou índice é criado no SQL da serventia.",
    "USE [WEBRI];",
    "GO",
    ...TABELAS_SQL_SOMENTE_LEITURA_CERTIDOES.map(
      (tabela) => `GRANT SELECT ON OBJECT::${tabela} TO [${loginSql}];`
    ),
    "GO",
  ];
  return linhas.join("\n");
}

/**
 * Consulta o estado real dos conectores e fontes da serventia para exibir alertas honestos
 * tanto nas páginas operacionais afetadas quanto em Sistema & Tecnologia.
 */
export async function diagnosticarAdaptadoresCartorioVirtual(
  tenantId: string
): Promise<DiagnosticoAdaptadorIntegracao[]> {
  let connectorAtivo: {
    id: string;
    name: string;
    status: string;
    lastSeenAt: Date | null;
    version: string | null;
  } | null = null;
  let sourceCertidoes: {
    status: string;
    lastSuccessAt: Date | null;
    lastErrorMessage: string | null;
  } | null = null;

  try {
    connectorAtivo = await prisma.connector.findFirst({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        lastSeenAt: true,
        version: true,
      },
    });

    if (connectorAtivo) {
      const statusRow = await prisma.connectorSourceStatus.findUnique({
        where: {
          tenantId_connectorId_source: {
            tenantId,
            connectorId: connectorAtivo.id,
            source: "cartorio_virtual_certidoes",
          },
        },
        select: {
          status: true,
          lastSuccessAt: true,
          lastError: true,
        },
      });
      if (statusRow) {
        sourceCertidoes = {
          status: statusRow.status,
          lastSuccessAt: statusRow.lastSuccessAt,
          lastErrorMessage: statusRow.lastError,
        };
      }
    }
  } catch {
    // Resiliência caso tabelas de connector não respondam momentaneamente
  }

  const agoraMs = Date.now();
  const atrasoHeartbeatMin = connectorAtivo?.lastSeenAt
    ? Math.max(0, Math.round((agoraMs - connectorAtivo.lastSeenAt.getTime()) / 60000))
    : null;

  const connectorOnline =
    Boolean(connectorAtivo) && atrasoHeartbeatMin !== null && atrasoHeartbeatMin <= 10;

  let estadoSqlCertidoes: EstadoOperacionalAdaptador = "NAO_CONFIGURADO";
  let msgSqlCertidoes =
    "Fonte somente leitura 'cartorio_virtual_certidoes' aguardando ativação e permissão SELECT nas tabelas tblWRICertidao* no SQL da serventia.";

  if (!connectorAtivo) {
    estadoSqlCertidoes = "NAO_CONFIGURADO";
    msgSqlCertidoes = "Nenhum FIORIX Connector registrado para esta serventia.";
  } else if (!connectorOnline) {
    estadoSqlCertidoes = atrasoHeartbeatMin !== null && atrasoHeartbeatMin <= 60 ? "ATRASADO" : "OFFLINE";
    msgSqlCertidoes = `Connector '${connectorAtivo.name}' sem batimento recente (${atrasoHeartbeatMin ?? "?"} min).`;
  } else if (sourceCertidoes) {
    const errLower = (sourceCertidoes.lastErrorMessage || "").toLowerCase();
    if (errLower.includes("229") || errLower.includes("select permission")) {
      estadoSqlCertidoes = "SEM_PERMISSAO_SELECT";
      msgSqlCertidoes =
        "Connector conectado ao SQL Server, porém o login de leitura aguarda GRANT SELECT nas tabelas tblWRICertidao* / tblWRIReal (erro SQL 229).";
    } else if (sourceCertidoes.status === "SUCCESS") {
      estadoSqlCertidoes = "ONLINE";
      msgSqlCertidoes = "Consulta somente leitura de pedidos de certidão sincronizada com sucesso.";
    } else {
      estadoSqlCertidoes = "ATRASADO";
      msgSqlCertidoes =
        sourceCertidoes.lastErrorMessage ||
        "Fonte de certidões reportou pendência na última leitura.";
    }
  } else {
    estadoSqlCertidoes = "SEM_PERMISSAO_SELECT";
  }

  return [
    {
      id: "WEBRI_SQL_CERTIDOES",
      nome: "Consulta SQL WEBRI — Pedidos, Matrículas e Contraditório",
      sistemaAlvo: "SIPLAN WEBRI (SRVSQL\\WEBRI — SQL Server 2012 SP4)",
      modoOperacao: "SOMENTE_LEITURA",
      classificacao: "IMPLEMENTADO_AGUARDANDO_GRANT_OU_ATIVACAO",
      habilitadoNoPiloto: true,
      estado: estadoSqlCertidoes,
      ultimaSincronizacaoIso:
        sourceCertidoes?.lastSuccessAt?.toISOString() ??
        connectorAtivo?.lastSeenAt?.toISOString() ??
        null,
      atrasoMinutos: atrasoHeartbeatMin,
      mensagemOperacional: msgSqlCertidoes,
      acaoRecomendadaTI:
        estadoSqlCertidoes === "ONLINE"
          ? null
          : "Aplicar script GRANT SELECT somente leitura para [fiorix_connector] e habilitar CARTORIO_VIRTUAL_SQL_ENABLED=true no serviço local.",
    },
    {
      id: "ACERVO_LIVRO2_CONNECTOR",
      nome: "Inspeção de Acervo Digitalizado (Livro 2 / Matrículas)",
      sistemaAlvo: "FIORIX Connector — Document Worker (Raiz livro2)",
      modoOperacao: "SOMENTE_LEITURA",
      classificacao: "EXISTENTE_UTILIZAVEL",
      habilitadoNoPiloto: true,
      estado: connectorOnline ? "ONLINE" : connectorAtivo ? "ATRASADO" : "NAO_CONFIGURADO",
      ultimaSincronizacaoIso: connectorAtivo?.lastSeenAt?.toISOString() ?? null,
      atrasoMinutos: atrasoHeartbeatMin,
      mensagemOperacional: connectorOnline
        ? "Worker documental ativo em modo somente leitura para verificação de PDFs/imagens de matrículas."
        : "Aguardando comunicação ativa com o Document Worker do FIORIX Connector.",
      acaoRecomendadaTI: connectorOnline
        ? null
        : "Verificar serviço FIORIX Connector e mapeamento da sessão 'livro2' em Cadastro de Sessões do Acervo.",
    },
    {
      id: "EREG_ONR_RECEPCAO",
      nome: "Devolução e Automação eREG / ONR (RI Digital)",
      sistemaAlvo: "SIPLAN eREG / Operador Nacional do Sistema de Registro Eletrônico",
      modoOperacao: "ORQUESTRACAO_EXTERNA_DESABILITADA",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional:
        "Leitura de protocolo externo ONR suportada via espelho SQL; devolução/entrega automática ao ONR permanece desabilitada no piloto.",
      acaoRecomendadaTI: "Manter devolução pelo fluxo atual eREG/WEBRI até homologação do Oficial.",
    },
    {
      id: "ASSINADOR_EXTERNO_A1_A3",
      nome: "Orquestrador de Assinatura Externa ICP-Brasil (A1 / A3)",
      sistemaAlvo: "Assinador Homologado da Serventia (Certificados A1 e A3)",
      modoOperacao: "ORQUESTRACAO_EXTERNA_DESABILITADA",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional:
        "Desabilitado no piloto (Seções 3 e 16). Nunca armazena chaves privadas, senhas ou PINs no FIORIX.",
      acaoRecomendadaTI: null,
    },
    {
      id: "ENTREGA_WHATSAPP_BALCAO",
      nome: "Entrega Assistida de Link por WhatsApp (Pedidos de Balcão)",
      sistemaAlvo: "Canal Oficial de Atendimento da Recepção",
      modoOperacao: "ORQUESTRACAO_EXTERNA_DESABILITADA",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional:
        "Envio automático de link ao solicitante desabilitado no piloto conforme diretriz da Seção 3.",
      acaoRecomendadaTI: null,
    },
    {
      id: "PREFEITURA_MUNICIPAL",
      nome: "Consulta Cadastral Imobiliária (SQL / IPTU)",
      sistemaAlvo: "Prefeitura do Município de São Paulo",
      modoOperacao: "DESABILITADO",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional:
        "Fora do escopo inicial de certidão de inteiro teor por matrícula; pedidos por endereço seguem para análise humana assistida.",
      acaoRecomendadaTI: null,
    },
    {
      id: "RECEITA_FEDERAL",
      nome: "Consulta Externa CPF / CNPJ",
      sistemaAlvo: "Receita Federal do Brasil",
      modoOperacao: "DESABILITADO",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional:
        "Validação matemática local ativa; integração externa desabilitada por ausência de finalidade no piloto.",
      acaoRecomendadaTI: null,
    },
    {
      id: "ARISP_CENTRAL",
      nome: "Integração Legada Central ARISP",
      sistemaAlvo: "ARISP",
      modoOperacao: "DESABILITADO",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional: "Mantida desabilitada no piloto; pedidos digitais operam via ONR/eREG.",
      acaoRecomendadaTI: null,
    },
    {
      id: "CDT_PROTESTO_NOTAS",
      nome: "Integração CDT",
      sistemaAlvo: "Centro de Distribuição de Títulos",
      modoOperacao: "DESABILITADO",
      classificacao: "DEPENDENCIA_EXTERNA_DESABILITADA_PILOTO",
      habilitadoNoPiloto: false,
      estado: "DESABILITADO_NO_PILOTO",
      ultimaSincronizacaoIso: null,
      atrasoMinutos: null,
      mensagemOperacional: "Mantida desabilitada no piloto (sem uso na certidão de inteiro teor por matrícula).",
      acaoRecomendadaTI: null,
    },
  ];
}

