import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-none border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#1e1e1e] bg-[#111111] text-[#00ff88]",
        muted: "border-[#2a2a2a] bg-[#0d0d0d] text-[#8a8a8a]",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        danger: "border-red-500/40 bg-red-500/10 text-red-300",
        info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
        outline: "border-[#00ff88]/40 bg-transparent text-[#00ff88]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
