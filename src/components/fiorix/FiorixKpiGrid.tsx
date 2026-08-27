"use client";

import { motion } from "framer-motion";
import { FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { FiorixKpiCard } from "./FiorixKpiCard";

interface KpiData {
  total: { value: number; label: string };
  noPrazo: { value: number; percentage: number; label: string };
  emAtraso: { value: number; percentage: number; label: string };
  devolucoes: { value: number; percentage: number; label: string };
}

interface FiorixKpiGridProps {
  data: KpiData;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export function FiorixKpiGrid({ data }: FiorixKpiGridProps) {
  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  return (
    <motion.div 
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Total Importado"
          value={formatNumber(data.total.value)}
          subtitle={data.total.label}
          variant="default"
          icon={FileText}
        />
      </motion.div>
      
      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Em dia"
          value={formatNumber(data.noPrazo.value)}
          subtitle={`${data.noPrazo.percentage}% dos títulos analisados`}
          variant="success"
          icon={CheckCircle2}
        />
      </motion.div>

      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Atrasados"
          value={formatNumber(data.emAtraso.value)}
          subtitle={`${data.emAtraso.percentage}% dos títulos analisados`}
          variant="danger"
          icon={Clock}
        />
      </motion.div>

      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Devolvidos"
          value={formatNumber(data.devolucoes.value)}
          subtitle={`${data.devolucoes.percentage}% de devoluções no período`}
          variant="warning"
          icon={AlertTriangle}
        />
      </motion.div>
    </motion.div>
  );
}
