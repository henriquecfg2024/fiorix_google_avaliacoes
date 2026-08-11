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
}

const variantStyles: Record<KpiVariant, { text: string; bg: string; icon: string }> = {
  default: {
    text: "text-white",
    bg: "bg-white/10",
    icon: "text-white",
  },
  success: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: "text-emerald-400",
  },
  danger: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    icon: "text-red-400",
  },
  warning: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    icon: "text-amber-400",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className="relative p-5 rounded-2xl shadow-lg bg-white/[0.05] backdrop-blur-xl border border-white/10 hover:bg-white/[0.08] transition-all group flex flex-col justify-between min-h-[140px]">
      
      <div className="flex justify-between items-start w-full">
        <h3 className="text-xs uppercase tracking-widest font-bold text-white/60 w-[80%]">
          {title}
        </h3>
        <div className={`p-2 rounded-lg ${styles.bg}`}>
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="flex flex-col">
          <span className={`text-3xl font-black ${styles.text} tracking-tight`}>
            {value}
          </span>
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
