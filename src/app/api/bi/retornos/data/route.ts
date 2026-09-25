import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { getFullMockRetornos } from "@/lib/retornos/mock-data";
import { RetornoItem, ResponsavelContagem, RetornosResponse } from "@/lib/retornos/types";

export const dynamic = "force-dynamic";

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  numeroPrenotacao: "numero_prenotacao",
  formaTitulo: "forma_titulo",
  tipoRetorno: "tipo_retorno",
  siglaRetorno: "sigla_retorno",
  seqTitulo: "seq_titulo",
  dataRetorno: "data_retorno",
  usuarioDestino: "usuario_destino_retorno",
  usuarioOrigem: "usuario_origem",
  classificacao: "classificacao",
};

interface KpiRawResult {
  total: number;
  corrigidos: number;
  sem_marcador: number;
}

interface RespRawResult {
  id: string;
  nome: string;
  quantidade: number;
}

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const aba = (searchParams.get("aba") || "ALL").toUpperCase();
    const classificacao = (searchParams.get("classificacao") || "ALL").toUpperCase();
    const idResponsavel = searchParams.get("idResponsavel")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)));
    const sortByParam = searchParams.get("sortBy") || "dataRetorno";
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // 1. Verificar última sincronização do conector
    let lastSyncAt: string | null = null;
    try {
      const lastBatch = await prisma.connectorSyncBatch.findFirst({
        where: {
          tenantId: user.tenantId,
          source: "retornos",
        },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      });
      if (lastBatch?.receivedAt) {
        lastSyncAt = lastBatch.receivedAt.toISOString();
      }
    } catch {
      // Falha não-crítica na busca de telemetria
    }

    // 2. Tentar buscar dados reais do Postgres
    let isDbPopulated = false;
    try {
      const countCheck = await prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*) FROM public.fiorix_retornos_dados WHERE tenant_id = ${user.tenantId}`
      );
      if (countCheck && countCheck[0] && Number(countCheck[0].count) > 0) {
        isDbPopulated = true;
      }
    } catch {
      isDbPopulated = false;
    }

    if (isDbPopulated) {
      const sortColumnSql = ALLOWED_SORT_COLUMNS[sortByParam] || "data_retorno";
      const sortDirectionSql = sortOrderParam === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      const whereConditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${user.tenantId}`];

      if (search) {
        const searchPattern = `%${search}%`;
        const searchNumber = !isNaN(Number(search)) ? Number(search) : null;
        if (searchNumber !== null) {
          whereConditions.push(Prisma.sql`(
            numero_prenotacao = ${searchNumber}
            OR usuario_origem ILIKE ${searchPattern}
            OR usuario_destino_retorno ILIKE ${searchPattern}
            OR observacao ILIKE ${searchPattern}
          )`);
        } else {
          whereConditions.push(Prisma.sql`(
            usuario_origem ILIKE ${searchPattern}
            OR usuario_destino_retorno ILIKE ${searchPattern}
            OR observacao ILIKE ${searchPattern}
          )`);
        }
      }

      if (aba === "PESSOAL") {
        whereConditions.push(Prisma.sql`id_tipo_retorno IN (294, 296)`);
      } else if (aba === "REAL") {
        whereConditions.push(Prisma.sql`id_tipo_retorno IN (293, 297)`);
      } else if (aba === "RECEPCAO") {
        whereConditions.push(Prisma.sql`id_tipo_retorno IN (292, 295)`);
      }

      if (classificacao === "CORRIGIDO") {
        whereConditions.push(Prisma.sql`id_tipo_retorno IN (295, 296, 297)`);
      } else if (classificacao === "SEM_MARCADOR") {
        whereConditions.push(Prisma.sql`id_tipo_retorno IN (292, 293, 294)`);
      }

      if (idResponsavel) {
        whereConditions.push(Prisma.sql`id_usuario_destino = ${idResponsavel}`);
      }

      const combinedWhere = Prisma.join(whereConditions, " AND ");

      const [kpiRows, respRows, itemRows] = await Promise.all([
        prisma.$queryRaw<KpiRawResult[]>(Prisma.sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (295, 296, 297))::int AS corrigidos,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (292, 293, 294))::int AS sem_marcador
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere}
        `),
        prisma.$queryRaw<RespRawResult[]>(Prisma.sql`
          SELECT
            COALESCE(id_usuario_destino, 'SEM_ID') AS id,
            COALESCE(NULLIF(usuario_destino_retorno, ''), 'Não informado') AS nome,
            COUNT(*)::int AS quantidade
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere} AND id_tipo_retorno IN (292, 293, 294)
          GROUP BY id_usuario_destino, usuario_destino_retorno
          ORDER BY quantidade DESC, nome ASC
        `),
        prisma.$queryRaw<RetornoItem[]>(Prisma.sql`
          SELECT
            id_andamento::text AS "idAndamento",
            id_recepcao AS "idRecepcao",
            numero_prenotacao AS "numeroPrenotacao",
            data_recepcao::text AS "dataRecepcao",
            tipo_recepcao AS "tipoRecepcao",
            forma_titulo AS "formaTitulo",
            id_tipo_retorno AS "idTipoRetorno",
            sigla_retorno AS "siglaRetorno",
            tipo_retorno AS "tipoRetorno",
            familia_retorno AS "familiaRetorno",
            classificacao AS "classificacao",
            data_retorno::text AS "dataRetorno",
            id_usuario_origem AS "idUsuarioOrigem",
            usuario_origem AS "usuarioOrigem",
            id_usuario_destino AS "idUsuarioDestino",
            usuario_destino_retorno AS "usuarioDestinoRetorno",
            observacao AS "observacao",
            seq_titulo AS "seqTitulo"
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere}
          ORDER BY ${Prisma.raw(sortColumnSql)} ${sortDirectionSql}, id_andamento DESC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        `),
      ]);

      const total = kpiRows[0]?.total || 0;
      const response: RetornosResponse = {
        success: true,
        kpis: {
          total,
          corrigidos: kpiRows[0]?.corrigidos || 0,
          semMarcador: kpiRows[0]?.sem_marcador || 0,
        },
        responsaveis: respRows.map((r) => ({
          id: r.id,
          nome: r.nome,
          quantidade: r.quantidade,
        })),
        items: itemRows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        lastSyncAt,
      };

      return NextResponse.json(response);
    }

    // 3. Fallback com Mock Data
    let filtered = getFullMockRetornos();

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.numeroPrenotacao.toString().includes(q) ||
          item.usuarioOrigem.toLowerCase().includes(q) ||
          item.usuarioDestinoRetorno.toLowerCase().includes(q) ||
          item.observacao.toLowerCase().includes(q)
      );
    }

    if (aba === "PESSOAL") {
      filtered = filtered.filter((i) => [294, 296].includes(i.idTipoRetorno));
    } else if (aba === "REAL") {
      filtered = filtered.filter((i) => [293, 297].includes(i.idTipoRetorno));
    } else if (aba === "RECEPCAO") {
      filtered = filtered.filter((i) => [292, 295].includes(i.idTipoRetorno));
    }

    if (classificacao === "CORRIGIDO") {
      filtered = filtered.filter((i) => [295, 296, 297].includes(i.idTipoRetorno));
    } else if (classificacao === "SEM_MARCADOR") {
      filtered = filtered.filter((i) => [292, 293, 294].includes(i.idTipoRetorno));
    }

    const respMap = new Map<string, { id: string; nome: string; quantidade: number }>();
    filtered
      .filter((i) => [292, 293, 294].includes(i.idTipoRetorno))
      .forEach((item) => {
        const key = item.idUsuarioDestino || item.usuarioDestinoRetorno;
        const current = respMap.get(key) || {
          id: item.idUsuarioDestino || key,
          nome: item.usuarioDestinoRetorno || "Não informado",
          quantidade: 0,
        };
        current.quantidade += 1;
        respMap.set(key, current);
      });

    const responsaveis: ResponsavelContagem[] = Array.from(respMap.values()).sort(
      (a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome)
    );

    if (idResponsavel) {
      filtered = filtered.filter((i) => i.idUsuarioDestino === idResponsavel || i.usuarioDestinoRetorno === idResponsavel);
    }

    filtered.sort((a, b) => {
      const getVal = (item: RetornoItem): string | number => {
        if (sortByParam === "dataRetorno") return new Date(item.dataRetorno).getTime();
        if (sortByParam === "numeroPrenotacao") return item.numeroPrenotacao;
        if (sortByParam === "formaTitulo") return item.formaTitulo || "";
        if (sortByParam === "tipoRetorno") return item.tipoRetorno || "";
        if (sortByParam === "siglaRetorno") return item.siglaRetorno || "";
        if (sortByParam === "usuarioDestino") return item.usuarioDestinoRetorno || "";
        if (sortByParam === "usuarioOrigem") return item.usuarioOrigem || "";
        if (sortByParam === "classificacao") return item.classificacao || "";
        return item.numeroPrenotacao;
      };

      const valA = getVal(a);
      const valB = getVal(b);

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrderParam === "asc"
          ? valA.localeCompare(valB, "pt-BR")
          : valB.localeCompare(valA, "pt-BR");
      }

      if (valA < valB) return sortOrderParam === "asc" ? -1 : 1;
      if (valA > valB) return sortOrderParam === "asc" ? 1 : -1;
      return Number(b.idAndamento) - Number(a.idAndamento);
    });

    const total = filtered.length;
    const paginatedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

    const response: RetornosResponse = {
      success: true,
      kpis: {
        total,
        corrigidos: filtered.filter((i) => [295, 296, 297].includes(i.idTipoRetorno)).length,
        semMarcador: filtered.filter((i) => [292, 293, 294].includes(i.idTipoRetorno)).length,
      },
      responsaveis,
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      lastSyncAt: lastSyncAt || new Date().toISOString(),
      isMockData: true,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("API_RETORNOS_DATA_ERROR:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
