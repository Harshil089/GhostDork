import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "flex min-h-28 w-full rounded-none border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)] shadow-none outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          "selection:bg-[var(--accent)] selection:text-black",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
