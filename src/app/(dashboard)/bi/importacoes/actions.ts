"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";

export async function deleteImportRecord(
  id: string,
  source: "BI" | "PRODUTIVIDADE" | "METAS" | "TAREFAS" | "RETORNOS" | "IMPRESSOES" | "ANDAMENTOS"
) {
  try {
    const user = await requireRole("ADMIN", "MASTER");

    if (source === "TAREFAS") {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_tarefas_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "METAS") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_metas_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data_apresentado, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) throw new Error("ID inválido para METAS");
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_metas_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "PRODUTIVIDADE") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_produtividade_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_produtividade_imports WHERE id = ${id} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "RETORNOS") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-retornos-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_retornos_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data_retorno, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) throw new Error("ID inválido para RETORNOS");
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_retornos_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "IMPRESSOES") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-impressoes-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_impressoes_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data_impressao, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) throw new Error("ID inválido para IMPRESSOES");
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_impressoes_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "BI") {
      await prisma.fiorixBiImport.deleteMany({
        where: { id, tenantId: user.tenantId },
      });
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM public.fiorix_bi_data WHERE tenant_id = ${user.tenantId}`
      );
    }

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroId: id,
      registroDescricao: `Exclusão de lote de importação ${source} (ID: ${id})`,
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/produtividade");
    revalidatePath("/bi/metas");
    revalidatePath("/bi/tarefas");
    revalidatePath("/bi/retornos");
    revalidatePath("/bi/controle-impressoes");
    revalidatePath("/bi/auditoria");
    revalidatePath("/bi");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete import record:", error);
    return { error: "Erro ao excluir registro de importação" };
  }
}

export async function clearAllProdutividadeData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_produtividade_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_produtividade_imports WHERE tenant_id = ${user.tenantId}`
    );

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroDescricao: "Limpeza total da base de Produtividade",
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/produtividade");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear produtividade data:", error);
    return { error: "Erro ao limpar dados de produtividade" };
  }
}

export async function clearAllMetasData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_metas_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_metas_imports WHERE tenant_id = ${user.tenantId}`
    );

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroDescricao: "Limpeza total da base de Metas",
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/metas");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear metas data:", error);
    return { error: "Erro ao limpar dados de metas" };
  }
}

export async function clearAllTarefasData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_tarefas_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_tarefas_imports WHERE tenant_id = ${user.tenantId}`
    );

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroDescricao: "Limpeza total da base de Tarefas",
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/tarefas");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear tarefas data:", error);
    return { error: "Erro ao limpar dados de tarefas" };
  }
}

export async function clearAllRetornosData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_retornos_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_retornos_imports WHERE tenant_id = ${user.tenantId}`
    );

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroDescricao: "Limpeza total da base de Retornos",
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/retornos");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear retornos data:", error);
    return { error: "Erro ao limpar dados de retornos" };
  }
}

export async function clearAllImpressoesData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_impressoes_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_impressoes_imports WHERE tenant_id = ${user.tenantId}`
    );

    await recordAuditLog({
      modulo: "BI_IMPORTACOES",
      acao: "EXCLUSAO",
      registroDescricao: "Limpeza total da base de Impressões",
      userOverride: user,
    });

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/controle-impressoes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear impressoes data:", error);
    return { error: "Erro ao limpar dados de impressões" };
  }
}
