import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-10 w-full rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] shadow-none outline-none transition-colors",
          "placeholder:text-[var(--color-muted-foreground)]",
          "selection:bg-[var(--color-accent)] selection:text-black",
          "focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-foreground)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
