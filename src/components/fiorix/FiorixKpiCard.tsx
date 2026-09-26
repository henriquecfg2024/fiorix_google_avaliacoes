import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  onClick?: () => void;
  isActive?: boolean;
}

const variantStyles: Record<
  KpiVariant,
  { text: string; icon: string; iconBox: string; border: string; hoverBorder: string }
> = {
  default: {
    text: "text-cyan-700 dark:text-cyan-400",
    icon: "text-cyan-600 dark:text-cyan-300",
    iconBox: "border-cyan-500/30 bg-cyan-500/10 dark:border-cyan-500/20 dark:bg-cyan-500/10",
    border: "border-cyan-500/30 dark:border-cyan-500/25",
    hoverBorder: "hover:border-cyan-500/60 dark:hover:border-cyan-400/50",
  },
  success: {
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-300",
    iconBox: "border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    border: "border-emerald-500/30 dark:border-emerald-500/25",
    hoverBorder: "hover:border-emerald-500/60 dark:hover:border-emerald-400/50",
  },
  danger: {
    text: "text-rose-700 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-300",
    iconBox: "border-rose-500/30 bg-rose-500/10 dark:border-rose-500/20 dark:bg-rose-500/10",
    border: "border-rose-500/30 dark:border-rose-500/25",
    hoverBorder: "hover:border-rose-500/60 dark:hover:border-rose-400/50",
  },
  warning: {
    text: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-300",
    iconBox: "border-amber-500/30 bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-500/10",
    border: "border-amber-500/30 dark:border-amber-500/25",
    hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/50",
  },
};

export function FiorixKpiCard({
  title,
  value,
  subtitle,
  variant,
  icon: Icon,
  trend,
  onClick,
  isActive = false,
}: FiorixKpiCardProps) {
  const styles = variantStyles[variant];
  const formattedValue = typeof value === "number" ? value.toLocaleString("pt-BR") : value;

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? isActive : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-[28px] border bg-white dark:bg-[#0B1020]/72 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all",
        styles.border,
        styles.hoverBorder,
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#070A12]",
        isActive && "-translate-y-0.5 ring-2 ring-indigo-500 dark:ring-white/70 ring-offset-2 ring-offset-white dark:ring-offset-[#070A12] shadow-md dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
      )}
    >
      
      <div className="flex justify-between items-start w-full mb-3">
        <h3 className="w-[80%] text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
          {title}
        </h3>
        <div className={cn("rounded-xl border p-2 transition-all group-hover:brightness-110", styles.iconBox)}>
          <Icon className={cn("w-4 h-4", styles.icon)} />
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div className="flex flex-col space-y-1">
          <span className={`text-3xl font-extrabold ${styles.text} tracking-tight`}>
            {formattedValue}
          </span>
          {trend && (
            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
              <span className={trend.isGood ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
                {trend.isUp ? "↑" : "↓"} {trend.value}
              </span>
              <span className="text-slate-400 dark:text-white/40">vs mês anterior</span>
            </div>
          )}
        </div>
        
        <Tooltip>
          {/* @ts-expect-error Radix UI asChild type mismatch */}
          <TooltipTrigger asChild>
            <button
              className="p-1 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors"
              onClick={(event) => event.stopPropagation()}
            >
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] border-slate-800/80 bg-[#0B1020]/90 text-center text-xs leading-relaxed text-slate-800 dark:text-white shadow-md">
            {subtitle}
          </TooltipContent>
        </Tooltip>
      </div>

    </Card>
  );
}
