import * as React from "react";

import { cn } from "@/lib/utils";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  glow?: boolean;
  inset?: boolean;
};

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, glow = false, inset = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden border border-[--color-border] bg-[--color-surface] text-[--color-foreground] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
          inset && "bg-black/40",
          glow &&
            "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.85),transparent)] before:content-['']",
          className,
        )}
        {...props}
      />
    );
  },
);

Panel.displayName = "Panel";

const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start justify-between gap-4 border-b border-[--color-border] px-4 py-3 sm:px-5",
          className,
        )}
        {...props}
      />
    );
  },
);

PanelHeader.displayName = "PanelHeader";

const PanelTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          "font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[--color-accent]",
          className,
        )}
        {...props}
      />
    );
  },
);

PanelTitle.displayName = "PanelTitle";

const PanelDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("max-w-2xl text-sm text-white/60", className)}
      {...props}
    />
  );
});

PanelDescription.displayName = "PanelDescription";

const PanelContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
  },
);

PanelContent.displayName = "PanelContent";

const PanelFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-t border-[--color-border] px-4 py-3 sm:px-5",
          className,
        )}
        {...props}
      />
    );
  },
);

PanelFooter.displayName = "PanelFooter";

export {
  Panel,
  PanelContent,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
};
