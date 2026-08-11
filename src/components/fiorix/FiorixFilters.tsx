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
  imports: any[];
  tiposPrenotacao: string[];
  filters: any;
  onFilterChange: (key: string, value: string) => void;
}

export function FiorixFilters({ imports, tiposPrenotacao, filters, onFilterChange }: FiorixFiltersProps) {
  return (
    <Card className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] text-[var(--text)]">
      <div className="flex items-center gap-2 mb-5">
        <Filter className="w-5 h-5 text-[var(--muted)]" />
        <h2 className="text-base font-semibold text-[var(--text)]">Filtros de Análise:</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* LOTE IMPORTADO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold">
            Lote Importado
          </label>
          <Select 
            value={filters.importId || "ALL"} 
            onValueChange={(val) => onFilterChange("importId", val)}
          >
            <SelectTrigger className="h-10 bg-[var(--mini-bg)] border border-[var(--mini-border)] text-[var(--text)] rounded-xl text-sm shadow-sm truncate focus:ring-0 focus:border-[var(--card-border)]">
              <SelectValue placeholder="Selecione um lote..." />
            </SelectTrigger>
            <SelectContent className="bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text)]">
              <SelectItem value="ALL">Todos os lotes</SelectItem>
              {imports.map((imp) => (
                <SelectItem key={imp.id} value={imp.id}>
                  {imp.filename} ({new Date(imp.importedAt).toLocaleDateString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* DATA INICIAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold">
            Data Inicial
          </label>
          <Input 
            type="date" 
            value={filters.startDate || ""}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
            className="h-10 bg-[var(--mini-bg)] border border-[var(--mini-border)] text-[var(--text)] rounded-xl shadow-sm focus:ring-0 focus:border-[var(--card-border)] [color-scheme:dark]" 
          />
        </div>

        {/* DATA FINAL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold">
            Data Final
          </label>
          <Input 
            type="date" 
            value={filters.endDate || ""}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
            className="h-10 bg-[var(--mini-bg)] border border-[var(--mini-border)] text-[var(--text)] rounded-xl shadow-sm focus:ring-0 focus:border-[var(--card-border)] [color-scheme:dark]" 
          />
        </div>

        {/* TIPO PRENOTAÇÃO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold">
            Tipo Prenotação
          </label>
          <Select 
            value={filters.tipoPrenotacao || "ALL"} 
            onValueChange={(val) => onFilterChange("tipo", val)}
          >
            <SelectTrigger className="h-10 bg-[var(--mini-bg)] border border-[var(--mini-border)] text-[var(--text)] rounded-xl text-sm shadow-sm focus:ring-0 focus:border-[var(--card-border)]">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent className="bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text)]">
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
