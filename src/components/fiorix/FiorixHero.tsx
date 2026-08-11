import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, BarChart2 } from "lucide-react";
import Link from "next/link";

interface FiorixHeroProps {
  onUpdate: () => void;
  onImport: () => void;
  isUpdating?: boolean;
  userRole?: string;
}

export function FiorixHero({ onUpdate, onImport, isUpdating = false, userRole }: FiorixHeroProps) {
  const canImport = userRole !== 'USER';
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 p-8 shadow-sm">
      {/* Background Gradient & Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A] to-[#1E293B]" />
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
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              className="bg-[#00C950] text-white hover:bg-[#00A844] border-0"
              onClick={onUpdate}
              disabled={isUpdating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Atualizando...' : 'Atualizar Dados'}
            </Button>
            {canImport && (
              <Button 
                className="bg-[#00C950] text-white hover:bg-[#00A844] shadow-sm"
                onClick={onImport}
              >
                <Plus className="mr-2 h-4 w-4" />
                Importar Novos Dados
              </Button>
            )}
          </div>

          <Link href="/bi/produtividade" passHref>
            <Button className="bg-[#2B7FFF] text-white hover:bg-blue-600 shadow-sm gap-2 font-semibold">
              <BarChart2 className="h-4 w-4" />
              Ver Produtividade de Caixa
            </Button>
          </Link>
        </div>

      </div>
    </Card>
  );
}
