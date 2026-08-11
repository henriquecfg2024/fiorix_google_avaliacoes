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
    text: "text-[var(--text)]",
    bg: "bg-[var(--mini-bg)]",
    icon: "text-[var(--text)]",
  },
  success: {
    text: "text-[var(--green)]",
    bg: "bg-[var(--green)]/10",
    icon: "text-[var(--green)]",
  },
  danger: {
    text: "text-[var(--red)]",
    bg: "bg-[var(--red)]/10",
    icon: "text-[var(--red)]",
  },
  warning: {
    text: "text-[var(--amber)]",
    bg: "bg-[var(--amber)]/10",
    icon: "text-[var(--amber)]",
  },
};

export function FiorixKpiCard({ title, value, subtitle, variant, icon: Icon }: FiorixKpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className="relative p-5 rounded-2xl shadow-[var(--card-shadow)] bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--mini-bg)] transition-all group flex flex-col justify-between min-h-[140px]">
      
      <div className="flex justify-between items-start w-full">
        <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--muted)] w-[80%]">
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
            <button className="text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] text-xs leading-relaxed text-center bg-[var(--card-bg)] text-[var(--text)] border-[var(--card-border)]">
            {subtitle}
          </TooltipContent>
        </Tooltip>
      </div>

    </Card>
  );
}
