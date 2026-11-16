import { useGetOne, useTranslate, type Identifier } from "ra-core";
import { Ban, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

import { reliabilityReasons } from "./reliabilityReasons";
import type { ClientReliability, ReliabilityLevel } from "./types";

const STYLES: Record<
  ReliabilityLevel,
  { icon: typeof ShieldCheck; className: string }
> = {
  reliable: {
    icon: ShieldCheck,
    className: "border-[var(--series-1)]/40 text-[var(--series-1)]",
  },
  regular: { icon: UserRound, className: "text-muted-foreground" },
  watch: {
    icon: ShieldAlert,
    className:
      "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  unreliable: {
    icon: Ban,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

/**
 * The reliability level of a client, for members only: an icon and a word,
 * never color alone, with the reasons in its title.
 */
export const ReliabilityBadge = ({
  reliability,
  compact = false,
}: {
  reliability: ClientReliability | undefined;
  compact?: boolean;
}) => {
  const translate = useTranslate();
  if (!reliability) return null;
  const { icon: Icon, className } = STYLES[reliability.level];
  const label = translate(`crm.reliability.levels.${reliability.level}`);
  return (
    <span
      title={reliabilityReasons(reliability, translate)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
};

/** The badge of one client, loading its reliability. */
export const ClientReliabilityBadge = ({
  clientId,
  compact,
}: {
  clientId: Identifier | null | undefined;
  compact?: boolean;
}) => {
  const { data } = useGetOne<ClientReliability>(
    "client_reliability",
    { id: clientId! },
    { enabled: clientId != null },
  );
  return <ReliabilityBadge reliability={data} compact={compact} />;
};
