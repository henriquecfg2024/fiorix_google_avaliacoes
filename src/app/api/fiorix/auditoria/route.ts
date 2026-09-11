import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/app/actions/auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type AuditoriaRow = {
  protocolo: number;
  dataApresentado: Date | null;
  dtPrevisao: Date | null;
  dtEntregaReal: Date | null;
  status: string | null;
  natureza: string | null;
  atrasoDias: number | null;
  d1Protocolo: Date | null;
  d1Escaneamento: Date | null;
  d2Contraditorio: Date | null;
  d3Extrato: Date | null;
  d4Qualificacao: Date | null;
  d5Calculo: Date | null;
  d8Impressao: Date | null;
  d9Preparacao: Date | null;
  d9Conferencia: Date | null;
  d10Entrega: Date | null;
  dBalcaoRegistrado: Date | null;
  dBalcaoDevolvido: Date | null;
  hasRegistro: boolean;
  hasDevolucao: boolean;
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

    const rawDados = await prisma.$queryRaw<AuditoriaRow[]>(
      Prisma.sql`
        WITH eventos_bi AS (
          SELECT
            b.tenant_id,
            b."Protocolo" AS protocolo,
            BOOL_OR(COALESCE(b."IsRegistrado", false)) AS has_registro,
            BOOL_OR(COALESCE(b."IsDevolucao", false)) AS has_devolucao
          FROM public.fiorix_bi_data b
          WHERE b.tenant_id = ${user.tenantId}
          GROUP BY b.tenant_id, b."Protocolo"
        ),
        eventos_prod AS (
          SELECT
            p.tenant_id,
            p.pedido::text AS protocolo,
            BOOL_OR(p.tipo_detalhado ILIKE '%Registrado%') AS has_registro,
            BOOL_OR(
              p.tipo_detalhado ILIKE '%Devolver%'
              OR p.tipo_detalhado ILIKE '%Devolu%'
            ) AS has_devolucao
          FROM public.fiorix_produtividade_dados p
          WHERE p.tenant_id = ${user.tenantId}
          GROUP BY p.tenant_id, p.pedido
        ),
        eventos AS (
          SELECT
            tenant_id,
            protocolo,
            BOOL_OR(has_registro) AS has_registro,
            BOOL_OR(has_devolucao) AS has_devolucao
          FROM (
            SELECT * FROM eventos_bi
            UNION ALL
            SELECT * FROM eventos_prod
          ) fontes
          GROUP BY tenant_id, protocolo
        )
        SELECT
          m.protocolo,
          m.data_apresentado AS "dataApresentado",
          m.dt_previsao AS "dtPrevisao",
          m.dt_entrega_real AS "dtEntregaReal",
          m.status,
          m.natureza,
          m.atraso_dias AS "atrasoDias",
          m.d1_protocolo AS "d1Protocolo",
          m.d1_escaneamento AS "d1Escaneamento",
          m.d2_contraditorio AS "d2Contraditorio",
          m.d3_extrato AS "d3Extrato",
          m.d4_qualificacao AS "d4Qualificacao",
          m.d5_calculo AS "d5Calculo",
          m.d8_impressao AS "d8Impressao",
          m.d9_preparacao AS "d9Preparacao",
          m.d9_conferencia AS "d9Conferencia",
          m.d10_entrega AS "d10Entrega",
          m.d_balcao_registrado AS "dBalcaoRegistrado",
          m.d_balcao_devolvido AS "dBalcaoDevolvido",
          e.has_registro AS "hasRegistro",
          e.has_devolucao AS "hasDevolucao"
        FROM public.fiorix_metas_dados m
        JOIN eventos_bi e
          ON e.tenant_id = m.tenant_id
          AND e.protocolo = m.protocolo::text
        WHERE m.tenant_id = ${user.tenantId}
          AND (
            (e.has_registro = true AND m.d_balcao_registrado IS NULL)
            OR (e.has_devolucao = true AND m.d_balcao_devolvido IS NULL)
          )
        ORDER BY m.protocolo ASC
        LIMIT 500
      `
    );

    const mapped = rawDados.map((d) => {
      // Map phase and sector dynamically based on milestones filled
      let fase = "Apresentação";
      let setor = "Qualificação";

      // Compute last milestone to determine phase, sector, and date
      const milestones = [
        { nome: "APRESENTAÇÃO", fase: "Apresentação", data: d.dataApresentado, ordem: 1 },
        { nome: "QUALIFICAÇÃO", fase: "Exame Formal", data: d.d4Qualificacao, ordem: 2 },
        { nome: "IMPRESSÃO", fase: "Impressão", data: d.d8Impressao, ordem: 3 },
        { nome: "PREPARAÇÃO", fase: "Preparação", data: d.d9Preparacao, ordem: 4 },
        { nome: "CONFERÊNCIA", fase: "Conferência", data: d.d9Conferencia, ordem: 5 },
      ]
        .filter((m): m is typeof m & { data: Date } => Boolean(m.data))
        .sort(
          (a, b) =>
            new Date(b.data).getTime() - new Date(a.data).getTime() ||
            b.ordem - a.ordem
        );

      const ultimoAndamento = milestones[0];

      if (ultimoAndamento) {
        fase = ultimoAndamento.fase;
        setor = ultimoAndamento.nome;
      }

      const dataUltAndamento = ultimoAndamento
        ? new Date(ultimoAndamento.data).toLocaleDateString("pt-BR")
        : (d.dataApresentado ? new Date(d.dataApresentado).toLocaleDateString("pt-BR") : "—");

      // Compute days parado (from last milestone to now)
      const lastDate = ultimoAndamento
        ? new Date(ultimoAndamento.data)
        : (d.dataApresentado ? new Date(d.dataApresentado) : new Date());
      const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
      const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      // Use real natureza for display
      const naturezaDisplay = d.natureza?.trim() || "Não informada";

      const badge = d.natureza
        ? d.natureza.slice(0, 2).toUpperCase() + "-" + d.protocolo.toString().slice(-3)
        : "PR-" + d.protocolo.toString().slice(-3);

      return {
        id: String(d.protocolo),
        badge,
        cliente: naturezaDisplay,
        fase,
        falta: d.hasDevolucao && !d.dBalcaoDevolvido ? 75 : 76,
        dias,
        setor,
        responsavel: setor,
        dataUltAndamento,
      };
    });

    return NextResponse.json({
      success: true,
      protocolos: mapped,
    });
  } catch (error: unknown) {
    console.error("Error in auditoria API:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
