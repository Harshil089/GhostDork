import * as React from "react";

import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  ),
);

CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "font-mono text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]",
        className,
      )}
      {...props}
    />
  ),
);

CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-6 text-[var(--color-muted-foreground)]", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-4 py-4 sm:px-5", className)} {...props} />
  ),
);

CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  ),
);

CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
