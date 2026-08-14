"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteImportRecord(id: string, source: "BI" | "PRODUTIVIDADE" | "METAS") {
  try {
    if (source === "METAS") {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) throw new Error("ID inválido para METAS");
      await prisma.$executeRawUnsafe(`DELETE FROM public.fiorix_metas_imports WHERE id = ${numericId}`);
    } else if (source === "PRODUTIVIDADE") {
      const safeId = id.replace(/'/g, "''");
      await prisma.$executeRawUnsafe(`DELETE FROM public.fiorix_produtividade_imports WHERE id = '${safeId}'`);
    } else if (source === "BI") {
      await prisma.fiorixBiImport.delete({ where: { id } });
    }
    
    revalidatePath("/bi/importacoes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete import record:", error);
    return { error: error.message };
  }
}
