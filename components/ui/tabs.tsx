"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  orientation: "horizontal" | "vertical";
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error(`${component} must be used within <Tabs>.`);
  }

  return context;
}

const tabsListVariants = cva(
  "inline-flex items-center gap-1 rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-1",
  {
    variants: {
      orientation: {
        horizontal: "flex-row",
        vertical: "flex-col items-stretch",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

const tabsTriggerVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-none border border-transparent px-3 py-2",
    "font-mono text-[11px] uppercase tracking-[0.22em] transition-colors outline-none",
    "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
    "focus-visible:border-[var(--color-accent)] focus-visible:text-[var(--color-foreground)]",
    "disabled:pointer-events-none disabled:opacity-40",
    "data-[state=active]:border-[var(--color-accent)] data-[state=active]:bg-[var(--color-accent)]/10",
    "data-[state=active]:text-[var(--color-accent)]",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 text-[10px]",
        default: "h-10",
        lg: "h-11 px-4 text-xs",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      fullWidth: false,
    },
  },
);

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  const contextValue = React.useMemo(
    () => ({
      value: currentValue,
      setValue,
      orientation,
    }),
    [currentValue, setValue, orientation],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {}

function TabsList({
  className,
  orientation,
  children,
  ...props
}: TabsListProps) {
  const context = useTabsContext("TabsList");
  const resolvedOrientation = orientation ?? context.orientation;

  return (
    <div
      data-slot="tabs-list"
      data-orientation={resolvedOrientation}
      role="tablist"
      aria-orientation={resolvedOrientation}
      className={cn(
        tabsListVariants({ orientation: resolvedOrientation }),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  value: string;
}

function TabsTrigger({
  className,
  value,
  size,
  fullWidth,
  onClick,
  children,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext("TabsTrigger");
  const isActive = context.value === value;

  return (
    <button
      type="button"
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      role="tab"
      aria-selected={isActive}
      className={cn(
        tabsTriggerVariants({ size, fullWidth }),
        className,
      )}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          context.setValue(value);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

function TabsContent({
  className,
  value,
  forceMount = false,
  children,
  ...props
}: TabsContentProps) {
  const context = useTabsContext("TabsContent");
  const isActive = context.value === value;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      data-slot="tabs-content"
      data-state={isActive ? "active" : "inactive"}
      role="tabpanel"
      hidden={!isActive}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
