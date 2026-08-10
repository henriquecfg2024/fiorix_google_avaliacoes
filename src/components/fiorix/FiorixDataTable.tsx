"use client";

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
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FiorixDataTableProps {
  data: any[];
}

export function FiorixDataTable({ data }: FiorixDataTableProps) {
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

  return (
    <Card className="rounded-2xl shadow-sm border-gray-100 dark:border-border mt-4 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-border">
        <div>
          <CardTitle className="text-base font-semibold">Títulos em Atraso (Drill-down)</CardTitle>
          <CardDescription>Amostra dos protocolos que estouraram o prazo legal</CardDescription>
        </div>
        <div className="relative mt-4 sm:mt-0 w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar protocolo..."
            className="pl-8 bg-gray-50 dark:bg-accent border-gray-200 dark:border-border rounded-lg shadow-sm"
          />
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
            {data.map((row) => (
              <TableRow key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-accent/50 transition-colors">
                <TableCell className="font-medium">{row.protocolo}</TableCell>
                <TableCell>{getStatusBadge(row.status)}</TableCell>
                <TableCell className="text-red-600 font-medium">+{row.atraso}d</TableCell>
                <TableCell className="text-muted-foreground">
                  {/* format YYYY-MM-DD to DD/MM/YYYY */}
                  {row.data.split('-').reverse().join('/')}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{row.tipo}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum título atrasado encontrado nos filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
