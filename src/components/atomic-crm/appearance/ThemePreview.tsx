import { CalendarDays, Home, MessageCircle } from "lucide-react";
import { useTranslate } from "ra-core";
import type { CSSProperties } from "react";

import { themeVariables, type ThemeColors, type ThemeMode } from "./theme";

/**
 * A small copy of the "Today" screen painted with the chosen colors: the
 * menu, the page, a card with a booking, a chip on a panel and a button.
 * The colors are set on this element only, so the rest of the page keeps
 * the saved theme until the owner saves.
 */
export const ThemePreview = ({
  mode,
  colors,
}: {
  mode: ThemeMode;
  colors: ThemeColors;
}) => {
  const translate = useTranslate();
  const style = themeVariables(mode, colors) as CSSProperties;
  const items = [
    { icon: Home, label: translate("crm.nav.today"), active: true },
    { icon: MessageCircle, label: translate("crm.nav.chats"), active: false },
    { icon: CalendarDays, label: translate("crm.nav.booking"), active: false },
  ];

  return (
    <div
      style={style}
      aria-hidden
      className="flex h-56 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm"
    >
      <div className="flex w-28 shrink-0 flex-col gap-1 bg-sidebar p-2 text-sidebar-foreground">
        {items.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={
              active
                ? "flex items-center gap-1.5 rounded-md bg-sidebar-primary px-2 py-1.5 text-xs font-medium text-sidebar-primary-foreground"
                : "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs"
            }
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-semibold">{translate("crm.nav.today")}</p>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 text-card-foreground">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums">10:00</span>
            <span className="truncate text-xs">
              {translate("crm.appearance.preview.booking")}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {translate("crm.appearance.preview.hint")}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
              {translate("crm.appearance.preview.chip")}
            </span>
            <span className="text-xs font-medium text-primary underline">
              {translate("crm.appearance.preview.link")}
            </span>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {translate("crm.appearance.preview.button")}
          </span>
          <span className="h-7 flex-1 rounded-md border border-input bg-card" />
        </div>
      </div>
    </div>
  );
};
