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
    text: "text-white",
    icon: "text-white/70",
    border: "border-l-4 border-l-blue-500",
  },
  success: {
    text: "text-emerald-400",
    icon: "text-emerald-400",
    border: "border-l-4 border-l-emerald-500",
  },
  danger: {
    text: "text-red-400",
    icon: "text-red-400",
    border: "border-l-4 border-l-red-500",
  },
  warning: {
    text: "text-amber-400",
    icon: "text-amber-400",
    border: "border-l-4 border-l-amber-500",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon, trend }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={`relative p-5 rounded-2xl shadow-lg bg-white/[0.05] backdrop-blur-xl border border-white/10 ${styles.border} hover:bg-white/[0.08] transition-all group flex flex-col justify-between min-h-[145px] text-white`}>
      
      <div className="flex justify-between items-start w-full">
        <h3 className="text-xs uppercase tracking-widest font-bold text-white/60 w-[80%]">
          {title}
        </h3>
        <div className="p-2 rounded-lg bg-white/5">
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex flex-col">
          <span className={`text-2xl font-black ${styles.text} tracking-tight`}>
            {value}
          </span>
          {trend && (
            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
              <span className={trend.isGood ? "text-emerald-400" : "text-red-400"}>
                {trend.isUp ? "↑" : "↓"} {trend.value}
              </span>
              <span className="text-white/40">vs mês anterior</span>
            </div>
          )}
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-white/40 hover:text-white/70 transition-colors p-1">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] text-xs leading-relaxed text-center bg-[#151C2F] text-white border-white/10">
            {subtitle}
          </TooltipContent>
        </Tooltip>
      </div>

    </Card>
  );
}
