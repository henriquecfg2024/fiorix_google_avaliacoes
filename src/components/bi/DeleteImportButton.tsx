"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteImportRecord } from "@/app/(dashboard)/bi/importacoes/actions";
import { Button } from "@/components/ui/button";

export function DeleteImportButton({ id, source }: { id: string; source: "BI" | "PRODUTIVIDADE" | "METAS" }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta importação? Todos os dados associados serão apagados permanentemente.")) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const res = await deleteImportRecord(id, source);
      
      if (res.error) {
        toast.error(`Erro ao excluir: ${res.error}`);
      } else {
        toast.success("Importação excluída com sucesso.");
      }
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
      onClick={handleDelete}
      disabled={isDeleting}
      title="Excluir Importação"
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
