import { AlertCircle, type LucideIcon } from "lucide-react";
import { useTranslate } from "ra-core";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The three states every screen shares, so they look and read the same
 * everywhere: nothing yet (an invitation to act), loading (grey placeholders
 * instead of a blank page) and an error (what happened and what to do).
 */

export const EmptyState = ({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  /** The one thing to do next: a button or a link */
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center",
      className,
    )}
  >
    <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
      <Icon className="size-6" aria-hidden />
    </span>
    <div className="flex max-w-sm flex-col gap-1">
      <p className="font-semibold">{title}</p>
      {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
    </div>
    {action}
  </div>
);

/** Placeholders shaped like a list of rows while the data loads. */
export const LoadingRows = ({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) => {
  const translate = useTranslate();
  return (
    <div
      role="status"
      aria-label={translate("crm.states.loading")}
      className={cn("flex flex-col gap-2", className)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
};

export const ErrorState = ({
  message,
  onRetry,
  className,
}: {
  /** What happened, in plain words; a general message when empty */
  message?: string;
  onRetry?: () => void;
  className?: string;
}) => {
  const translate = useTranslate();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-destructive/40 px-6 py-8 text-center",
        className,
      )}
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden />
      <p className="max-w-sm text-sm">
        {message ?? translate("crm.states.error")}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {translate("crm.states.retry")}
        </Button>
      ) : null}
    </div>
  );
};
