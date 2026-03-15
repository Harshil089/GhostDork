import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border",
    "font-mono text-xs uppercase tracking-[0.22em] transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff88]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "select-none",
  ],
  {
    variants: {
      variant: {
        default:
          "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88] shadow-[0_0_0_1px_rgba(0,255,136,0.08)] hover:border-[#00ff88]/70 hover:bg-[#00ff88]/16 hover:text-[#b8ffd8]",
        secondary:
          "border-[#2a2a2a] bg-[#111111] text-[#d4d4d4] hover:border-[#3a3a3a] hover:bg-[#151515] hover:text-white",
        outline:
          "border-[#1e1e1e] bg-transparent text-[#d4d4d4] hover:border-[#00ff88]/40 hover:bg-[#00ff88]/8 hover:text-[#00ff88]",
        ghost:
          "border-transparent bg-transparent text-[#9ca3af] hover:border-[#1e1e1e] hover:bg-[#111111] hover:text-[#f4f4f5]",
        danger:
          "border-[#ff3333]/40 bg-[#ff3333]/10 text-[#ff6666] hover:border-[#ff3333]/70 hover:bg-[#ff3333]/16 hover:text-[#ff9a9a]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 py-1.5 text-[11px]",
        lg: "h-12 px-6 py-3 text-sm",
        icon: "h-10 w-10 p-0",
      },
      glow: {
        true: "shadow-[0_0_18px_rgba(0,255,136,0.14)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  glow,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? ("span" as const) : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, glow, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
