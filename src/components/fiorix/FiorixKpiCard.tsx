import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type KpiVariant = "default" | "success" | "danger" | "warning";

interface FiorixKpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  variant: KpiVariant;
  icon: React.ElementType;
  trend?: {
    value: string;
    isUp: boolean;
    isGood: boolean;
  };
}

const variantStyles: Record<KpiVariant, { text: string; icon: string; border: string }> = {
  default: {
    text: "text-cyan-400",
    icon: "text-cyan-400",
    border: "border-l-4 border-l-cyan-400",
  },
  success: {
    text: "text-emerald-400",
    icon: "text-emerald-400",
    border: "border-l-4 border-l-emerald-400",
  },
  danger: {
    text: "text-red-400",
    icon: "text-red-400",
    border: "border-l-4 border-l-red-500",
  },
  warning: {
    text: "text-amber-400",
    icon: "text-amber-400",
    border: "border-l-4 border-l-amber-400",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon, trend }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={`relative flex min-h-[145px] flex-col justify-between rounded-2xl border border-white/8 bg-[#0B1020]/78 p-5 text-white shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:border-white/12 hover:bg-[#0B1020]/84 ${styles.border}`}>
      
      <div className="flex justify-between items-start w-full">
        <h3 className="w-[80%] text-xs font-bold uppercase tracking-widest text-white/52">
          {title}
        </h3>
        <div className="rounded-lg border border-white/8 bg-white/[0.04] p-2">
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex flex-col">
          <span className={`text-3xl font-extrabold ${styles.text} tracking-tight`}>
            {value}
          </span>
          {trend && (
            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
              <span className={trend.isGood ? "text-emerald-300" : "text-red-300"}>
                {trend.isUp ? "↑" : "↓"} {trend.value}
              </span>
              <span className="text-white/40">vs mês anterior</span>
            </div>
          )}
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 text-white/40 transition-colors hover:text-white/80">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] border-white/8 bg-[#0B1020] text-center text-xs leading-relaxed text-white">
            {subtitle}
          </TooltipContent>
        </Tooltip>
      </div>

    </Card>
  );
}
