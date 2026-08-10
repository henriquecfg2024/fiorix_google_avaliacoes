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
    text: "text-slate-900 dark:text-slate-100",
    bg: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-500",
  },
  success: {
    text: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "text-emerald-500",
  },
  danger: {
    text: "text-red-500",
    bg: "bg-red-50 dark:bg-red-500/10",
    icon: "text-red-500",
  },
  warning: {
    text: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    icon: "text-amber-500",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className="relative p-5 rounded-2xl shadow-sm border-gray-100 dark:border-border hover:shadow-md transition-shadow group flex flex-col justify-between min-h-[140px]">
      
      <div className="flex justify-between items-start w-full">
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground w-[80%]">
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
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] text-xs leading-relaxed text-center">
            {subtitle}
          </TooltipContent>
        </Tooltip>
      </div>

    </Card>
  );
}
