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
    <Card className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-2">
        <Filter className="h-5 w-5 text-amber-300" />
        <h2 className="text-base font-semibold text-white">Filtros de Análise</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DATA INICIAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Data Inicial
          </label>
          <Input 
            type="date" 
            value={filters.startDate || ""}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
            className="h-10 rounded-xl border border-white/8 bg-[#0C1323] text-white shadow-sm [color-scheme:dark] focus:border-amber-400 focus:ring-0" 
          />
        </div>

        {/* DATA FINAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Data Final
          </label>
          <Input 
            type="date" 
            value={filters.endDate || ""}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
            className="h-10 rounded-xl border border-white/8 bg-[#0C1323] text-white shadow-sm [color-scheme:dark] focus:border-amber-400 focus:ring-0" 
          />
        </div>

        {/* TIPO PRENOTAÇÃO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Tipo Prenotação
          </label>
          <Select 
            value={filters.tipoPrenotacao || "ALL"} 
            onValueChange={(val) => onFilterChange("tipo", val)}
          >
            <SelectTrigger className="h-10 rounded-xl border border-white/8 bg-[#0C1323] text-sm text-white shadow-sm focus:border-amber-400 focus:ring-0">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent className="border-white/8 bg-[#0B1020] text-white">
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
