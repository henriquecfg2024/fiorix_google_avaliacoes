"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, Info } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FiorixDataTableProps {
  data: any[];
  totalAtrasadosCount?: number;
}

const DELAY_RANGES = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "1–3 dias", min: 1, max: 3 },
  { label: "4–7 dias", min: 4, max: 7 },
  { label: "8–15 dias", min: 8, max: 15 },
  { label: "16–30 dias", min: 16, max: 30 },
  { label: "31+ dias", min: 31, max: Infinity },
];

export function FiorixDataTable({ data, totalAtrasadosCount }: FiorixDataTableProps) {
  const [activeRange, setActiveRange] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'no_prazo':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">No Prazo</Badge>;
      case 'atrasado':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">Atrasado</Badge>;
      case 'devolvido':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">Devolvido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const range = DELAY_RANGES[activeRange];
  const filteredData = data.filter((row) => {
    const atraso = Number(row.atraso) || 0;
    const inRange = atraso >= range.min && atraso <= range.max;
    const matchesSearch = searchTerm === "" || String(row.protocolo).toLowerCase().includes(searchTerm.toLowerCase());
    return inRange && matchesSearch;
  });

  // Count how many items fall in each range (for the badges)
  const rangeCounts = DELAY_RANGES.map((r) =>
    data.filter((row) => {
      const a = Number(row.atraso) || 0;
      return a >= r.min && a <= r.max;
    }).length
  );

  const formattedTotalOverall = totalAtrasadosCount ? totalAtrasadosCount.toLocaleString("pt-BR") : null;

  return (
    <Card className="rounded-2xl shadow-sm border-gray-100 dark:border-border mt-4 overflow-hidden">
      {/* Sample Banner Notification */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-amber-900 dark:text-amber-200">
        <div className="flex items-center gap-2 font-medium">
          <Info size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Amostra dos 100 maiores atrasos:</strong> Esta tabela lista os 100 casos com maior tempo de extrapolação do prazo legal
            {formattedTotalOverall && <> (de um total de <strong>{formattedTotalOverall}</strong> títulos em atraso no filtro selecionado)</>}.
          </span>
        </div>
        <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold text-[11px]">
          Top 100 Atrasados
        </Badge>
      </div>

      <CardHeader className="pb-4 border-b border-gray-100 dark:border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Títulos em Atraso (Drill-down)</CardTitle>
            <CardDescription>Detalhamento dos protocolos críticos com estouro de prazo legal</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar protocolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-gray-50 dark:bg-accent border-gray-200 dark:border-border rounded-lg shadow-sm"
            />
          </div>
        </div>

        {/* Filtro por faixa de dias */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium mr-1">Dias de atraso:</span>
          {DELAY_RANGES.map((r, i) => (
            <Button
              key={r.label}
              variant={activeRange === i ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs rounded-full px-3 transition-all ${
                activeRange === i
                  ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                  : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
              }`}
              onClick={() => setActiveRange(i)}
            >
              {r.label}
              <span className={`ml-1.5 text-[10px] font-bold ${
                activeRange === i ? "text-slate-300" : "text-muted-foreground/60"
              }`}>
                {rangeCounts[i]}
              </span>
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/50 dark:bg-accent/50">
            <TableRow>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Protocolo</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Atraso (Dias)</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Data Entrada</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground text-right">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row) => (
              <TableRow key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-accent/50 transition-colors">
                <TableCell className="font-medium">{row.protocolo}</TableCell>
                <TableCell>{getStatusBadge(row.status)}</TableCell>
                <TableCell className="text-red-600 font-medium">+{row.atraso}d</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.data.split('-').reverse().join('/')}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{row.tipo}</TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum título atrasado encontrado na amostra {activeRange > 0 ? `para a faixa "${range.label}"` : "nos filtros atuais"}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé com esclarecimento explicito */}
      <div className="px-6 py-3 border-t border-gray-100 dark:border-border bg-gray-50/30 dark:bg-accent/30 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Exibindo <strong className="text-foreground">{filteredData.length}</strong> resultados da amostra de <strong className="text-foreground">{data.length}</strong> maiores atrasos
          {formattedTotalOverall && <> (de um total geral de <strong className="text-foreground">{formattedTotalOverall}</strong> títulos atrasados)</>}
          {activeRange > 0 && <span> · Faixa: <strong className="text-foreground">{range.label}</strong></span>}
        </p>
        <span className="text-[11px] text-muted-foreground/70 italic">
          * Amostra ordenada por gravidade (maior atraso em dias)
        </span>
      </div>
    </Card>
  );
}
