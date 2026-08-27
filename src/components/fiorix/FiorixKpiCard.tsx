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

const variantStyles: Record<KpiVariant, { text: string; icon: string; color: string; border: string; hoverBorder: string }> = {
  default: {
    text: "text-cyan-400",
    icon: "text-cyan-400",
    color: "from-cyan-400 to-blue-500",
    border: "border-cyan-400",
    hoverBorder: "hover:border-cyan-300",
  },
  success: {
    text: "text-emerald-400",
    icon: "text-emerald-400",
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-400",
    hoverBorder: "hover:border-emerald-300",
  },
  danger: {
    text: "text-red-400",
    icon: "text-red-400",
    color: "from-red-500 to-rose-500",
    border: "border-red-400",
    hoverBorder: "hover:border-red-300",
  },
  warning: {
    text: "text-amber-400",
    icon: "text-amber-400",
    color: "from-amber-400 to-orange-500",
    border: "border-amber-400",
    hoverBorder: "hover:border-amber-300",
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
        "group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-[28px] border bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all",
        styles.border,
        styles.hoverBorder,
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A12]",
        isActive && "-translate-y-0.5 ring-2 ring-white/70 ring-offset-2 ring-offset-[#070A12] shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
      )}
    >
      
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
            <button
              className="p-1 text-white/40 transition-colors hover:text-white/80"
              onClick={(event) => event.stopPropagation()}
            >
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
