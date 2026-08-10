import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";

interface FiorixHeroProps {
  onUpdate: () => void;
  onImport: () => void;
  isUpdating?: boolean;
}

export function FiorixHero({ onUpdate, onImport, isUpdating = false }: FiorixHeroProps) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border-0 p-8 shadow-sm">
      {/* Background Gradient & Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F2040] to-[#1E3A8A]" />
      <div 
        className="absolute inset-0 opacity-5" 
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col gap-6">
        
        {/* Top Row Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur-sm">
            7º REGISTRO DE IMÓVEIS DE SP
          </Badge>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            SUPABASE ONLINE
          </Badge>
        </div>

        {/* Text Content */}
        <div className="max-w-3xl space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            FIORIX BI · Módulo de Inteligência & Prazos
          </h1>
          <p className="text-blue-100/80 leading-relaxed text-sm sm:text-base">
            Análise operacional de prazos e identificação científica de gargalos para redução de reclamações do Google Business.
            <span className="block mt-2 font-mono text-xs text-blue-200/50">Fonte: dbo.pr_Fiorix_BI</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button 
            variant="secondary" 
            className="bg-white/10 text-white hover:bg-white/20 border border-white/20"
            onClick={onUpdate}
            disabled={isUpdating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Atualizando...' : 'Atualizar Dados'}
          </Button>
          <Button 
            className="bg-[#10B981] text-white hover:bg-[#059669] shadow-sm"
            onClick={onImport}
          >
            <Plus className="mr-2 h-4 w-4" />
            Importar Novos Dados
          </Button>
        </div>

      </div>
    </Card>
  );
}
