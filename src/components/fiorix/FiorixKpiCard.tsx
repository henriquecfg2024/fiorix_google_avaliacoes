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

const variantStyles: Record<KpiVariant, { text: string; icon: string; color: string; border: string; hoverBorder: string }> = {
  default: {
    text: "text-cyan-400",
    icon: "text-cyan-400",
    color: "from-cyan-400 to-blue-500",
    border: "border-cyan-400/50",
    hoverBorder: "hover:border-cyan-400",
  },
  success: {
    text: "text-emerald-400",
    icon: "text-emerald-400",
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-400/50",
    hoverBorder: "hover:border-emerald-400",
  },
  danger: {
    text: "text-red-400",
    icon: "text-red-400",
    color: "from-red-500 to-rose-500",
    border: "border-red-400/50",
    hoverBorder: "hover:border-red-400",
  },
  warning: {
    text: "text-amber-400",
    icon: "text-amber-400",
    color: "from-amber-400 to-orange-500",
    border: "border-amber-400/50",
    hoverBorder: "hover:border-amber-400",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon, trend }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={`group relative overflow-hidden rounded-[28px] border ${styles.border} bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all ${styles.hoverBorder} flex min-h-[145px] flex-col justify-between`}>
      
      <div className="flex justify-between items-start w-full mb-4">
        <h3 className="w-[80%] text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
          {title}
        </h3>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition-all group-hover:bg-white/[0.08]">
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div className="flex flex-col space-y-1.5">
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

      <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${styles.color} opacity-80`} />
    </Card>
  );
}
