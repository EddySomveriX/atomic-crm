import type { LucideIcon } from "lucide-react";
import { useTranslate } from "ra-core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { initials, tokens, type ZoneKey } from "./boardLogic";

/**
 * The pieces of the business board: a zone (a square of the board game)
 * and the tokens standing on it.
 */

/** Where each zone sits on the board: phone (2 columns) and computer. */
const AREA: Record<ZoneKey, string> = {
  entrance: "[grid-area:entrance]",
  hall: "[grid-area:hall]",
  cash: "[grid-area:cash]",
  stock: "[grid-area:stock]",
  return: "[grid-area:return]",
};

export const BOARD_LAYOUT =
  "grid gap-3 [grid-template-areas:'entrance_return'_'hall_hall'_'cash_stock'] grid-cols-2 md:grid-cols-[1fr_1.6fr_1fr_1fr] md:[grid-template-areas:'entrance_hall_cash_return'_'entrance_hall_stock_return']";

export const Zone = ({
  zone,
  step,
  icon: Icon,
  title,
  status,
  needsAttention,
  isSelected,
  onSelect,
  children,
}: {
  zone: ZoneKey;
  /** Place of the zone on the path of a client, from 1 */
  step: number;
  icon: LucideIcon;
  title: string;
  status: ReactNode;
  needsAttention: boolean;
  isSelected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) => {
  const translate = useTranslate();
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={cn(
        AREA[zone],
        "relative flex min-h-32 flex-col gap-2 rounded-2xl border-2 border-dashed bg-card p-3 text-left transition-colors",
        "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "border-solid border-primary",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {step}
        </span>
        <Icon className="size-4 text-primary" aria-hidden />
        <span className="font-semibold">{title}</span>
        {needsAttention ? (
          <span
            className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            title={translate("crm.business_map.attention")}
            aria-label={translate("crm.business_map.attention")}
          >
            !
          </span>
        ) : null}
      </span>
      <span className="text-sm text-muted-foreground">{status}</span>
      {children ? (
        <span className="mt-auto flex flex-wrap gap-1.5">{children}</span>
      ) : null}
    </button>
  );
};

/** A round token with initials: a member of the team or a client. */
export const Token = ({
  name,
  kind,
  isBusy = false,
  badge,
  animated,
}: {
  name: string;
  kind: "team" | "client";
  /** A member with a client right now */
  isBusy?: boolean;
  /** A small number on the token, such as today's bookings */
  badge?: number;
  animated: boolean;
}) => (
  <span
    title={name}
    className={cn(
      "relative flex size-8 items-center justify-center rounded-full text-[11px] font-semibold",
      kind === "team"
        ? "bg-primary text-primary-foreground"
        : "border bg-background text-foreground",
      isBusy && "ring-2 ring-primary ring-offset-2 ring-offset-card",
      animated && "motion-safe:animate-in motion-safe:zoom-in-50",
    )}
  >
    {initials(name)}
    {badge ? (
      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border bg-background text-[10px] text-foreground tabular-nums">
        {badge}
      </span>
    ) : null}
  </span>
);

/** Tokens for a list of names, with "+N" for what does not fit. */
export const TokenRow = ({
  names,
  total,
  animated,
}: {
  names: string[];
  /** All of them, when the list holds only the first ones */
  total?: number;
  animated: boolean;
}) => {
  const { shown } = tokens(names.length);
  const more = Math.max(0, (total ?? names.length) - shown);
  return (
    <>
      {names.slice(0, shown).map((name, index) => (
        <Token
          key={`${name}-${index}`}
          name={name}
          kind="client"
          animated={animated}
        />
      ))}
      {more > 0 ? (
        <span className="flex h-8 items-center px-1 text-xs text-muted-foreground tabular-nums">
          +{more}
        </span>
      ) : null}
    </>
  );
};
