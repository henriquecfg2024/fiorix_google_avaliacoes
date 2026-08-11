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
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Total de Títulos Analisados"
          value={formatNumber(data.total.value)}
          subtitle={data.total.label}
          variant="default"
          icon={FileText}
          trend={{ value: "2.4%", isUp: true, isGood: true }}
        />
      </motion.div>
      
      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Entregues no Prazo"
          value={`${data.noPrazo.percentage}%`}
          subtitle={data.noPrazo.label}
          variant="success"
          icon={CheckCircle2}
          trend={{ value: "0.8%", isUp: true, isGood: true }}
        />
      </motion.div>

      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Entregues em Atraso"
          value={`${data.emAtraso.percentage}%`}
          subtitle={data.emAtraso.label}
          variant="danger"
          icon={Clock}
          trend={{ value: "1.5%", isUp: false, isGood: true }}
        />
      </motion.div>

      <motion.div variants={item}>
        <FiorixKpiCard 
          title="Devoluções / Exigências"
          value={`${data.devolucoes.percentage}%`}
          subtitle={data.devolucoes.label}
          variant="warning"
          icon={AlertTriangle}
          trend={{ value: "0.5%", isUp: false, isGood: true }}
        />
      </motion.div>
    </motion.div>
  );
}
