"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
  showValueLabel?: boolean;
  labelFormatter?: (percentage: number, value: number, max: number) => string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Progress({
  className,
  value = 0,
  max = 100,
  indicatorClassName,
  showValueLabel = false,
  labelFormatter,
  ...props
}: ProgressProps) {
  const safeMax = max <= 0 ? 100 : max;
  const safeValue = clamp(value, 0, safeMax);
  const percentage = clamp((safeValue / safeMax) * 100, 0, 100);
  const label = labelFormatter
    ? labelFormatter(percentage, safeValue, safeMax)
    : `${Math.round(percentage)}%`;

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-label={label}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-none border border-[var(--color-border)] bg-[var(--color-surface)]",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-[var(--color-accent)] transition-all duration-300 ease-out",
            indicatorClassName,
          )}
          style={{ width: `${percentage}%` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] opacity-60" />
      </div>

      {showValueLabel ? (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-[var(--color-muted-foreground)]">
          <span>Progress</span>
          <span>{label}</span>
        </div>
      ) : null}
    </div>
  );
}

export default Progress;
