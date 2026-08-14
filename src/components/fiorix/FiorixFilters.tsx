"use client";

import { Card } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FiorixFiltersProps {
  tiposPrenotacao: string[];
  filters: any;
  onFilterChange: (key: string, value: string) => void;
}

export function FiorixFilters({ tiposPrenotacao, filters, onFilterChange }: FiorixFiltersProps) {
  return (
    <Card className="p-5 rounded-2xl bg-[#151C2F] border border-white/10 shadow-sm text-white">
      <div className="flex items-center gap-2 mb-5">
        <Filter className="w-5 h-5 text-white/60" />
        <h2 className="text-base font-semibold text-white">Filtros de Análise:</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DATA INICIAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
            Data Inicial
          </label>
          <Input 
            type="date" 
            value={filters.startDate || ""}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
            className="h-10 bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-0 focus:border-white/20 [color-scheme:dark]" 
          />
        </div>

        {/* DATA FINAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
            Data Final
          </label>
          <Input 
            type="date" 
            value={filters.endDate || ""}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
            className="h-10 bg-white/5 border border-white/10 text-white rounded-xl shadow-sm focus:ring-0 focus:border-white/20 [color-scheme:dark]" 
          />
        </div>

        {/* TIPO PRENOTAÇÃO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
            Tipo Prenotação
          </label>
          <Select 
            value={filters.tipoPrenotacao || "ALL"} 
            onValueChange={(val) => onFilterChange("tipo", val)}
          >
            <SelectTrigger className="h-10 bg-white/5 border border-white/10 text-white rounded-xl text-sm shadow-sm focus:ring-0 focus:border-white/20">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent className="bg-[#151C2F] border-white/10 text-white">
              <SelectItem value="ALL">Todos os Tipos</SelectItem>
              {tiposPrenotacao.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
