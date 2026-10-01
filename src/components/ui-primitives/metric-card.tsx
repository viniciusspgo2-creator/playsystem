"use client";

import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: number; // percentage
  trendLabel?: string;
  variant?: "default" | "income" | "expense" | "warning" | "brand" | "blue";
  delay?: number;
}

const VARIANTS: Record<string, string> = {
  default: "from-card to-card",
  income: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
  expense: "from-rose-500/10 to-rose-500/5 border-rose-500/20",
  warning: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
  brand: "from-primary/15 to-primary/5 border-primary/20",
  blue: "from-accent-blue/15 to-accent-blue/5 border-accent-blue/20",
};

const ICON_COLORS: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  income: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  expense: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  brand: "bg-primary/15 text-primary",
  blue: "bg-accent-blue/15 text-accent-blue",
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  variant = "default",
  delay = 0,
}: MetricCardProps) {
  const trendUp = (trend ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-shadow hover:shadow-md",
        VARIANTS[variant]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1 animate-count-up">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              ICON_COLORS[variant]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          <div
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
              trendUp
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            )}
          >
            {trendUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
          {trendLabel && (
            <span className="text-[10px] text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
