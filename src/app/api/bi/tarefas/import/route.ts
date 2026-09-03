import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { ensureTarefasImportsTable } from "@/lib/import-history";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTenant();
    const body = await request.json();

    if (body.action === "mark_failed") {
      const { importMeta, errorMessage } = body;
      if (importMeta?.importKey) {
        await prisma.$executeRaw(
          Prisma.sql`
            UPDATE public.fiorix_tarefas_imports
            SET status = 'FAILED', error_message = ${errorMessage || "Falha na importação"}
            WHERE tenant_id = ${user.tenantId} AND import_key = ${importMeta.importKey}
          `
        );
      }
      return NextResponse.json({ success: true });
    }

    const { rows, importMeta } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhum registro para importar" }, { status: 400 });
    }

    // Evita repetir CREATE/ALTER/INDEX em todos os lotes do mesmo CSV.
    if (!importMeta?.batchNumber || importMeta.batchNumber === 1) {
      await ensureTarefasImportsTable();
    }

    let importId: number | null = null;
    if (importMeta?.importKey) {
      const periodoStr = `${importMeta.periodStart || ""}|${importMeta.periodEnd || ""}`;
      const existingImport: any[] = await prisma.$queryRaw(
        Prisma.sql`
          SELECT id FROM public.fiorix_tarefas_imports 
          WHERE tenant_id = ${user.tenantId} AND import_key = ${importMeta.importKey}
          LIMIT 1
        `
      );

      if (existingImport && existingImport.length > 0) {
        importId = existingImport[0].id;
      } else {
        const insertedImport: any[] = await prisma.$queryRaw(
          Prisma.sql`
            INSERT INTO public.fiorix_tarefas_imports (
              tenant_id, import_key, arquivo, periodo, linhas, inseridas, importado_por, status
            ) VALUES (
              ${user.tenantId}, ${importMeta.importKey}, ${importMeta.fileName || "tarefas.csv"},
              ${periodoStr}, ${importMeta.totalRows || rows.length}, ${rows.length},
              ${importMeta.importedBy || "Manual CSV"}, 'PROCESSING'
            ) RETURNING id
          `
        );
        importId = insertedImport[0]?.id || null;
      }
    }

    const parseDateStr = (val: any) => {
      if (!val) return null;
      const str = String(val).trim();
      if (!str) return null;

      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str;

      const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (brMatch) {
        const timePart = str.split(" ")[1] || "00:00:00";
        return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T${timePart}`;
      }

      const date = new Date(str);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };

    const normalizeRow = (row: any) => {
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
            return String(row[k]).trim();
          }
        }
        return null;
      };

      const idTarefa = getVal("ID_TAREFA", "id_tarefa", "idTarefa", "NUMERO_SERVICO", "numero_servico") || `tar-${Math.random().toString(36).substring(2, 9)}`;

      return {
        tenantId: user.tenantId,
        protocolo: Number(getVal("PROTOCOLO", "protocolo", "Protocolo") || 0),
        seqTitulo: Number(getVal("SEQ_TITULO", "seq_titulo", "seqTitulo") || 1),
        dataEntrada: parseDateStr(getVal("DATA_ENTRADA", "data_entrada", "dataEntrada")),
        dtPrevisao: parseDateStr(getVal("DT_PREVISAO", "dt_previsao", "dtPrevisao")),
        diasParaPrevisao: Number(getVal("DIAS_PARA_PREVISAO", "dias_para_previsao", "diasParaPrevisao") || 0),
        statusPrevisao: getVal("STATUS_PREVISAO", "status_previsao", "statusPrevisao") || "NO PRAZO",
        nivelRisco: getVal("NIVEL_RISCO", "nivel_risco", "nivelRisco") || "NORMAL",
        idServico: getVal("ID_SERVICO", "id_servico", "idServico"),
        numeroServico: getVal("NUMERO_SERVICO", "numero_servico", "numeroServico"),
        itemServico: getVal("ITEM_SERVICO", "item_servico", "itemServico"),
        dataServico: parseDateStr(getVal("DATA_SERVICO", "data_servico", "dataServico")),
        vencimentoServico: parseDateStr(getVal("VENCIMENTO_SERVICO", "vencimento_servico", "vencimentoServico")),
        idTarefa,
        tarefa: getVal("TAREFA", "tarefa", "Tarefa") || "Geral",
        dataCadastroTarefa: parseDateStr(getVal("DATA_CADASTRO_TAREFA", "data_cadastro_tarefa", "dataCadastroTarefa")),
        statusTarefa: getVal("STATUS_TAREFA", "status_tarefa", "statusTarefa"),
        dataAbertura: parseDateStr(getVal("DATA_ABERTURA", "data_abertura", "dataAbertura")),
        dataFinalizacao: parseDateStr(getVal("DATA_FINALIZACAO", "data_finalizacao", "dataFinalizacao")),
        situacaoTarefa: getVal("SITUACAO_TAREFA", "situacao_tarefa", "situacaoTarefa") || "EM ANDAMENTO",
        idUsuario: getVal("ID_USUARIO", "id_usuario", "idUsuario"),
        responsavel: getVal("RESPONSAVEL", "responsavel", "Responsavel") || "Não Atribuído",
        tipo: getVal("TIPO", "tipo", "Tipo") || "",
        natureza: getVal("NATUREZA", "natureza", "Natureza") || "",
        importId,
      };
    };

    const normalizedRows = rows.map(normalizeRow).filter((r) => r.protocolo > 0);

    if (normalizedRows.length > 0) {
      const valuesSql = normalizedRows
        .map(
          (r) => Prisma.sql`(
            ${r.tenantId}, ${r.protocolo}, ${r.seqTitulo},
            ${r.dataEntrada ? new Date(r.dataEntrada) : null},
            ${r.dtPrevisao ? new Date(r.dtPrevisao) : null},
            ${r.diasParaPrevisao}, ${r.statusPrevisao}, ${r.nivelRisco},
            ${r.idServico}, ${r.numeroServico}, ${r.itemServico},
            ${r.dataServico ? new Date(r.dataServico) : null},
            ${r.vencimentoServico ? new Date(r.vencimentoServico) : null},
            ${r.idTarefa}, ${r.tarefa},
            ${r.dataCadastroTarefa ? new Date(r.dataCadastroTarefa) : null},
            ${r.statusTarefa},
            ${r.dataAbertura ? new Date(r.dataAbertura) : null},
            ${r.dataFinalizacao ? new Date(r.dataFinalizacao) : null},
            ${r.situacaoTarefa}, ${r.idUsuario}, ${r.responsavel},
            ${r.tipo}, ${r.natureza}, ${r.importId}
          )`
        );

      await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO public.fiorix_tarefas_dados (
            tenant_id, PROTOCOLO, SEQ_TITULO, DATA_ENTRADA, DT_PREVISAO,
            DIAS_PARA_PREVISAO, STATUS_PREVISAO, NIVEL_RISCO, ID_SERVICO,
            NUMERO_SERVICO, ITEM_SERVICO, DATA_SERVICO, VENCIMENTO_SERVICO,
            ID_TAREFA, TAREFA, DATA_CADASTRO_TAREFA, STATUS_TAREFA,
            DATA_ABERTURA, DATA_FINALIZACAO, SITUACAO_TAREFA, ID_USUARIO,
            RESPONSAVEL, TIPO, NATUREZA, import_id
          )
          VALUES ${Prisma.join(valuesSql)}
          ON CONFLICT (tenant_id, id_tarefa) DO UPDATE SET
            PROTOCOLO = EXCLUDED.PROTOCOLO,
            DT_PREVISAO = EXCLUDED.DT_PREVISAO,
            STATUS_PREVISAO = EXCLUDED.STATUS_PREVISAO,
            NIVEL_RISCO = EXCLUDED.NIVEL_RISCO,
            TAREFA = EXCLUDED.TAREFA,
            STATUS_TAREFA = EXCLUDED.STATUS_TAREFA,
            DATA_FINALIZACAO = EXCLUDED.DATA_FINALIZACAO,
            SITUACAO_TAREFA = EXCLUDED.SITUACAO_TAREFA,
            RESPONSAVEL = EXCLUDED.RESPONSAVEL;
        `
      );
    }

    if (importId && importMeta?.batchNumber === importMeta?.totalBatches) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_tarefas_imports
          SET status = 'Concluído', inseridas = ${normalizedRows.length}
          WHERE id = ${importId} AND tenant_id = ${user.tenantId}
        `
      );
    }

    return NextResponse.json({
      success: true,
      count: normalizedRows.length,
    });
  } catch (error: any) {
    console.error("Erro na API /api/bi/tarefas/import:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao salvar tarefas" },
      { status: 500 }
    );
  }
}
