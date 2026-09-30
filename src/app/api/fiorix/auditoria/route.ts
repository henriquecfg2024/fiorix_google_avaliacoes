import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/app/actions/auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type AuditoriaRow = {
  protocolo: number;
  natureza: string | null;
  dataEntrada: Date | null;
  dataUltAndamento: Date | null;
  ultimoOperador: string | null;
  falta_codigo: number;
  falta_descricao: string;
  setor: string;
  fase: string;
};

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionUser.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    const countTotalRaw = await prisma.$queryRaw<{ total: number }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT protocolo)::int AS total
        FROM (
          SELECT protocolo FROM public.fiorix_metas_dados WHERE tenant_id = ${user.tenantId}
          UNION
          SELECT protocolo FROM public.fiorix_andamentos_dados WHERE tenant_id = ${user.tenantId}
        ) t
      `
    ).catch(() => [{ total: 0 }]);
    const totalAuditados = countTotalRaw[0]?.total || 0;

    const rawDados = await prisma.$queryRaw<AuditoriaRow[]>(
      Prisma.sql`
        WITH base_andamentos AS (
          -- Fonte 1: Andamentos diretos da tabela de andamentos do SQL WebRI sincronizada
          SELECT 
            protocolo,
            MAX(natureza) AS natureza,
            MAX(tipo_prenotacao) AS tipo,
            MIN(data_andamento) AS data_entrada,
            BOOL_OR(id_tipo_andamento = 14) AS has_d1_protocolo,
            BOOL_OR(id_tipo_andamento = 86) AS has_d1_escaneamento,
            BOOL_OR(id_tipo_andamento = 106) AS has_d2_contraditorio,
            BOOL_OR(id_tipo_andamento = 265) AS has_d3_extrato,
            BOOL_OR(id_tipo_andamento = 131) AS has_d4_qualificacao,
            BOOL_OR(id_tipo_andamento IN (281, 282)) AS has_d5_calculo,
            BOOL_OR(id_tipo_andamento IN (63, 264)) AS has_d8_impressao,
            BOOL_OR(id_tipo_andamento = 113) AS has_d9_preparacao,
            BOOL_OR(id_tipo_andamento = 76) AS has_d9_conferencia_balcao,
            BOOL_OR(id_tipo_andamento = 75) AS has_balcao_devolvido,
            BOOL_OR(id_tipo_andamento IN (48, 83, 10, 11, 12, 72, 99)) AS has_d10_entrega,
            MAX(data_andamento) AS data_ult_andamento,
            (ARRAY_AGG(COALESCE(usuario_origem, usuario_destino) ORDER BY data_andamento DESC) FILTER (WHERE usuario_origem IS NOT NULL OR usuario_destino IS NOT NULL))[1] AS ultimo_operador
          FROM public.fiorix_andamentos_dados
          WHERE tenant_id = ${user.tenantId}
          GROUP BY protocolo

          UNION ALL

          -- Fonte 2: Mapeamento de marcos e andamentos de tblWRIAndamentos consolidados em metas e impressões
          SELECT 
            m.protocolo,
            m.natureza,
            m.tipo,
            COALESCE(m.data_apresentado, m.d1_protocolo) AS data_entrada,
            (m.d1_protocolo IS NOT NULL) AS has_d1_protocolo,
            (m.d1_escaneamento IS NOT NULL) AS has_d1_escaneamento,
            (m.d2_contraditorio IS NOT NULL) AS has_d2_contraditorio,
            (m.d3_extrato IS NOT NULL) AS has_d3_extrato,
            (m.d4_qualificacao IS NOT NULL) AS has_d4_qualificacao,
            (m.d5_calculo IS NOT NULL) AS has_d5_calculo,
            (m.d8_impressao IS NOT NULL OR imp.has_impressao = true) AS has_d8_impressao,
            (m.d9_preparacao IS NOT NULL) AS has_d9_preparacao,
            (m.d_balcao_registrado IS NOT NULL OR m.d9_conferencia IS NOT NULL) AS has_d9_conferencia_balcao,
            (m.d_balcao_devolvido IS NOT NULL) AS has_balcao_devolvido,
            (m.d10_entrega IS NOT NULL) AS has_d10_entrega,
            COALESCE(
              m.d10_entrega, m.d_balcao_registrado, m.d9_conferencia, m.d_balcao_devolvido,
              m.d9_preparacao, m.d8_impressao, m.d5_calculo,
              m.d4_qualificacao, m.d3_extrato, m.d2_contraditorio,
              m.d1_escaneamento, m.d1_protocolo, m.data_apresentado
            ) AS data_ult_andamento,
            NULL::text AS ultimo_operador
          FROM public.fiorix_metas_dados m
          LEFT JOIN (
            SELECT numero_prenotacao AS protocolo, true AS has_impressao
            FROM public.fiorix_impressoes_dados
            WHERE tenant_id = ${user.tenantId} AND tipo_impressao = 'LIVRO'
            GROUP BY numero_prenotacao
          ) imp ON imp.protocolo = m.protocolo
          WHERE m.tenant_id = ${user.tenantId}
        ),
        consolidados AS (
          SELECT 
            protocolo,
            MAX(natureza) AS natureza,
            MAX(tipo) AS tipo,
            MIN(data_entrada) AS data_entrada,
            BOOL_OR(has_d1_protocolo) AS has_d1_protocolo,
            BOOL_OR(has_d1_escaneamento) AS has_d1_escaneamento,
            BOOL_OR(has_d2_contraditorio) AS has_d2_contraditorio,
            BOOL_OR(has_d3_extrato) AS has_d3_extrato,
            BOOL_OR(has_d4_qualificacao) AS has_d4_qualificacao,
            BOOL_OR(has_d5_calculo) AS has_d5_calculo,
            BOOL_OR(has_d8_impressao) AS has_d8_impressao,
            BOOL_OR(has_d9_preparacao) AS has_d9_preparacao,
            BOOL_OR(has_d9_conferencia_balcao) AS has_d9_conferencia_balcao,
            BOOL_OR(has_balcao_devolvido) AS has_balcao_devolvido,
            BOOL_OR(has_d10_entrega) AS has_d10_entrega,
            MAX(data_ult_andamento) AS data_ult_andamento,
            MAX(ultimo_operador) AS ultimo_operador
          FROM base_andamentos
          GROUP BY protocolo
        )
        SELECT 
          protocolo,
          natureza,
          data_entrada AS "dataEntrada",
          data_ult_andamento AS "dataUltAndamento",
          ultimo_operador AS "ultimoOperador",
          -- Classificação de inconformidade baseada estritamente nas regras operacionais reais do WebRI
          CASE
            -- 1. Impresso ou Preparado, mas não foi encaminhado para Balcão Registrado
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d9_conferencia_balcao = false
              THEN 76
            -- 2. Teve Contraditório/Nota Devolutiva, mas não foi para Balcão Devolvido e não foi registrado
            WHEN has_d2_contraditorio = true AND has_d8_impressao = false AND has_balcao_devolvido = false AND has_d9_conferencia_balcao = false
              THEN 75
            -- 3. Impresso ou Preparado, mas pulou etapa de Qualificação
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d4_qualificacao = false
              THEN 131
            -- 4. Qualificado, mas pulou etapa de Escaneamento
            WHEN has_d4_qualificacao = true AND has_d1_escaneamento = false
              THEN 86
            ELSE NULL
          END AS falta_codigo,
          CASE
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d9_conferencia_balcao = false
              THEN 'Balcão registrado pendente (Cód. 76)'
            WHEN has_d2_contraditorio = true AND has_d8_impressao = false AND has_balcao_devolvido = false AND has_d9_conferencia_balcao = false
              THEN 'Balcão devolvido pendente (Cód. 75)'
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d4_qualificacao = false
              THEN 'Qualificação ausente no fluxo (Cód. 131)'
            WHEN has_d4_qualificacao = true AND has_d1_escaneamento = false
              THEN 'Escaneamento ausente no fluxo (Cód. 86)'
            ELSE NULL
          END AS falta_descricao,
          CASE
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d9_conferencia_balcao = false
              THEN 'Balcão'
            WHEN has_d2_contraditorio = true AND has_d8_impressao = false AND has_balcao_devolvido = false AND has_d9_conferencia_balcao = false
              THEN 'Balcão'
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d4_qualificacao = false
              THEN 'Qualificação'
            WHEN has_d4_qualificacao = true AND has_d1_escaneamento = false
              THEN 'Scanner'
            ELSE 'Geral'
          END AS setor,
          CASE
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d9_conferencia_balcao = false
              THEN 'Apresentação'
            WHEN has_d2_contraditorio = true AND has_d8_impressao = false AND has_balcao_devolvido = false AND has_d9_conferencia_balcao = false
              THEN 'Apresentação'
            WHEN (has_d8_impressao = true OR has_d9_preparacao = true) AND has_d4_qualificacao = false
              THEN 'Exame Formal'
            WHEN has_d4_qualificacao = true AND has_d1_escaneamento = false
              THEN 'Apresentação'
            ELSE 'Apresentação'
          END AS fase
        FROM consolidados
        WHERE 
          ((has_d8_impressao = true OR has_d9_preparacao = true) AND has_d9_conferencia_balcao = false)
          OR (has_d2_contraditorio = true AND has_d8_impressao = false AND has_balcao_devolvido = false AND has_d9_conferencia_balcao = false)
          OR ((has_d8_impressao = true OR has_d9_preparacao = true) AND has_d4_qualificacao = false)
          OR (has_d4_qualificacao = true AND has_d1_escaneamento = false)
        ORDER BY protocolo ASC
        LIMIT 10000
      `
    );

    const mapped = rawDados.map((d) => {
      const diffTime = d.dataUltAndamento
        ? Math.abs(new Date().getTime() - new Date(d.dataUltAndamento).getTime())
        : (d.dataEntrada ? Math.abs(new Date().getTime() - new Date(d.dataEntrada).getTime()) : 0);
      const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      const dataUltAndamento = d.dataUltAndamento
        ? new Date(d.dataUltAndamento).toLocaleDateString("pt-BR")
        : (d.dataEntrada ? new Date(d.dataEntrada).toLocaleDateString("pt-BR") : "—");

      const naturezaDisplay = d.natureza?.trim() || "Não informada";

      const badge = d.natureza
        ? d.natureza.slice(0, 2).toUpperCase() + "-" + d.protocolo.toString().slice(-3)
        : "PR-" + d.protocolo.toString().slice(-3);

      return {
        id: String(d.protocolo),
        badge,
        cliente: naturezaDisplay,
        fase: d.fase,
        falta: d.falta_codigo,
        faltaDescricao: d.falta_descricao,
        dias,
        setor: d.setor,
        responsavel: d.ultimoOperador || d.setor,
        dataUltAndamento,
      };
    });

    return NextResponse.json({
      success: true,
      totalAuditados,
      protocolos: mapped,
    });
  } catch (error: unknown) {
    console.error("Error in auditoria API:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
