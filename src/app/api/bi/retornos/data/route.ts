import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { getFullMockRetornos } from "@/lib/retornos/mock-data";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { RetornoItem, ResponsavelContagem, ResponsavelContagemCompleta, ErroMensal, RetornosResponse } from "@/lib/retornos/types";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  observacao: "observacao",
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

interface RespCompletoRawResult {
  id: string;
  nome: string;
  total: number;
  corrigidos: number;
  sem_marcador: number;
}

interface ErroMensalRawResult {
  mes: string;
  total: number;
  corrigidos: number;
  sem_marcador: number;
}

/** Mapa pt-BR para rótulos curtos de mês */
const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

export async function GET(request: Request) {
  try {
    const user = await requireTenant();

    // 0. Rate limiting por usuário (máximo 40 req/min)
    const rateLimit = checkRateLimit(`retornos:${user.id}`, { windowMs: 60_000, max: 40 });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { success: false, error: "Muitas requisições em pouco tempo. Aguarde alguns segundos." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.retryAfterMs || 1000) / 1000)),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);

    // Sanitização e limitação de comprimento da busca (anti-DoS)
    const rawSearch = searchParams.get("search")?.trim() || "";
    const search = rawSearch.slice(0, 100).replace(/[%_]{3,}/g, "");

    const aba = (searchParams.get("aba") || "ALL").toUpperCase();
    const classificacao = (searchParams.get("classificacao") || "ALL").toUpperCase();
    const idResponsavel = searchParams.get("idResponsavel")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)));
    const sortByParam = searchParams.get("sortBy") || "dataRetorno";
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // Período — filtro de datas com validação estrita (YYYY-MM-DD)
    const rawDateFrom = searchParams.get("dateFrom")?.trim() || "";
    const rawDateTo = searchParams.get("dateTo")?.trim() || "";
    const dateFrom = DATE_REGEX.test(rawDateFrom) ? rawDateFrom : "";
    const dateTo = DATE_REGEX.test(rawDateTo) ? rawDateTo : "";

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

      // Filtro de período (datas)
      if (dateFrom) {
        whereConditions.push(Prisma.sql`data_retorno >= ${dateFrom}::date`);
      }
      if (dateTo) {
        whereConditions.push(Prisma.sql`data_retorno < (${dateTo}::date + INTERVAL '1 day')`);
      }

      const combinedWhere = Prisma.join(whereConditions, " AND ");

      const [kpiRows, respRows, respCompletoRows, errosMensaisRows, itemRows] = await Promise.all([
        // KPIs globais
        prisma.$queryRaw<KpiRawResult[]>(Prisma.sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (295, 296, 297))::int AS corrigidos,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (292, 293, 294))::int AS sem_marcador
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere}
        `),
        // Responsáveis (somente sem marcador — 292,293,294) — backward-compat
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
        // Responsáveis completo (TODOS os 6 tipos: 292-297)
        prisma.$queryRaw<RespCompletoRawResult[]>(Prisma.sql`
          SELECT
            COALESCE(id_usuario_destino, 'SEM_ID') AS id,
            COALESCE(NULLIF(usuario_destino_retorno, ''), 'Não informado') AS nome,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (295, 296, 297))::int AS corrigidos,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (292, 293, 294))::int AS sem_marcador
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere}
          GROUP BY id_usuario_destino, usuario_destino_retorno
          ORDER BY total DESC, nome ASC
        `),
        // Erros mês a mês (todos os 6 tipos)
        prisma.$queryRaw<ErroMensalRawResult[]>(Prisma.sql`
          SELECT
            TO_CHAR(data_retorno, 'YYYY-MM') AS mes,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (295, 296, 297))::int AS corrigidos,
            COUNT(*) FILTER (WHERE id_tipo_retorno IN (292, 293, 294))::int AS sem_marcador
          FROM public.fiorix_retornos_dados
          WHERE ${combinedWhere}
          GROUP BY TO_CHAR(data_retorno, 'YYYY-MM')
          ORDER BY mes ASC
        `),
        // Itens paginados
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

      // Mapear erros mensais com rótulos pt-BR
      const errosMensais: ErroMensal[] = errosMensaisRows.map((row) => {
        const [year, month] = row.mes.split("-");
        const label = `${MONTH_LABELS[month] || month}/${year.slice(2)}`;
        return {
          mes: row.mes,
          mesLabel: label,
          total: row.total,
          corrigidos: row.corrigidos,
          semMarcador: row.sem_marcador,
        };
      });

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
        responsaveisCompleto: respCompletoRows.map((r) => ({
          id: r.id,
          nome: r.nome,
          total: r.total,
          corrigidos: r.corrigidos,
          semMarcador: r.sem_marcador,
        })),
        errosMensais,
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

    // Filtro de período (datas)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((i) => new Date(i.dataRetorno) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      filtered = filtered.filter((i) => new Date(i.dataRetorno) < toDate);
    }

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

    // Responsáveis backward-compat (somente 292, 293, 294)
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

    // Responsáveis completo (todos os 6 tipos)
    const respCompletoMap = new Map<string, ResponsavelContagemCompleta>();
    filtered.forEach((item) => {
      const key = item.idUsuarioDestino || item.usuarioDestinoRetorno;
      const current = respCompletoMap.get(key) || {
        id: item.idUsuarioDestino || key,
        nome: item.usuarioDestinoRetorno || "Não informado",
        total: 0,
        corrigidos: 0,
        semMarcador: 0,
      };
      current.total += 1;
      if ([295, 296, 297].includes(item.idTipoRetorno)) current.corrigidos += 1;
      if ([292, 293, 294].includes(item.idTipoRetorno)) current.semMarcador += 1;
      respCompletoMap.set(key, current);
    });

    const responsaveisCompleto: ResponsavelContagemCompleta[] = Array.from(respCompletoMap.values()).sort(
      (a, b) => b.total - a.total || a.nome.localeCompare(b.nome)
    );

    // Erros mês a mês
    const mesMap = new Map<string, { total: number; corrigidos: number; semMarcador: number }>();
    filtered.forEach((item) => {
      const d = new Date(item.dataRetorno);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const current = mesMap.get(mes) || { total: 0, corrigidos: 0, semMarcador: 0 };
      current.total += 1;
      if ([295, 296, 297].includes(item.idTipoRetorno)) current.corrigidos += 1;
      if ([292, 293, 294].includes(item.idTipoRetorno)) current.semMarcador += 1;
      mesMap.set(mes, current);
    });

    const errosMensais: ErroMensal[] = Array.from(mesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => {
        const [year, month] = mes.split("-");
        const label = `${MONTH_LABELS[month] || month}/${year.slice(2)}`;
        return { mes, mesLabel: label, ...data };
      });

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
        if (sortByParam === "observacao") return item.observacao || "";
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
      responsaveisCompleto,
      errosMensais,
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
