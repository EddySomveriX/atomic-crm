import {
  Bell,
  CalendarDays,
  ListTodo,
  Megaphone,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { addDays, dayIn, zonedDateTime } from "../booking/bookingTime";
import { useBusinessTimeZone } from "../booking/useBookingData";
import { useModules } from "../modules/useModules";

/** How often the counts are fetched again */
const REFRESH_MS = 60_000;
const ONE = { page: 1, perPage: 1 } as const;
const BY_ID = { field: "id", order: "ASC" } as const;

interface Item {
  key: string;
  icon: LucideIcon;
  count: number;
  to: string;
  /** Asks for an action, not only tells */
  isUrgent: boolean;
}

/** How many records match a filter, refreshed every minute; 0 when off. */
const useCount = (
  resource: string,
  filter: Record<string, unknown>,
  enabled: boolean,
): number =>
  useGetList(
    resource,
    { pagination: ONE, sort: BY_ID, filter },
    { enabled, refetchInterval: REFRESH_MS },
  ).total ?? 0;

/**
 * What needs attention, in one place: clients waiting for an answer, visits
 * of today, overdue tasks and posts that did not go out. The number on the
 * bell counts only what asks for an action.
 */
export const NotificationsBell = ({ className }: { className?: string }) => {
  const translate = useTranslate();
  const { isOn } = useModules();
  const timeZone = useBusinessTimeZone();
  const [open, setOpen] = useState(false);
  const today = dayIn(new Date(), timeZone);
  const dayStart = zonedDateTime(today, "00:00", timeZone).toISOString();
  const dayEnd = zonedDateTime(
    addDays(today, 1),
    "00:00",
    timeZone,
  ).toISOString();
  const now = new Date().toISOString();

  const items: Item[] = [
    {
      key: "waiting",
      icon: MessageCircle,
      count: useCount(
        "conversations",
        { "waiting_since@not.is": null },
        isOn("chats"),
      ),
      to: "/chats",
      isUrgent: true,
    },
    {
      key: "overdue",
      icon: ListTodo,
      count: useCount(
        "tasks",
        { "due_date@lt": now, "done_date@is": null },
        isOn("tasks"),
      ),
      to: "/tasks",
      isUrgent: true,
    },
    {
      key: "failed_posts",
      icon: Megaphone,
      count: useCount(
        "posts",
        { "status@in": "(failed,partly)" },
        isOn("marketing"),
      ),
      to: "/marketing",
      isUrgent: true,
    },
    {
      key: "visits_today",
      icon: CalendarDays,
      count: useCount(
        "bookings",
        { "starts_at@gte": dayStart, "starts_at@lt": dayEnd, status: "booked" },
        isOn("booking"),
      ),
      to: "/calendar",
      isUrgent: false,
    },
  ];
  const shown = items.filter((item) => item.count > 0);
  const urgent = items
    .filter((item) => item.isUrgent)
    .reduce((sum, item) => sum + item.count, 0);
  const label = translate("crm.notifications.title");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
            aria-label={
              urgent > 0
                ? translate("crm.notifications.label_count", {
                    smart_count: urgent,
                  })
                : label
            }
          />
        }
      >
        <Bell />
        {urgent > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
            {urgent > 99 ? "99+" : urgent}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pb-2 pt-1 text-sm font-semibold">{label}</p>
        {shown.length === 0 ? (
          <p className="px-2 pb-2 text-sm text-muted-foreground">
            {translate("crm.notifications.empty")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      item.isUrgent
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="flex-1">
                    {translate(`crm.notifications.items.${item.key}`, {
                      smart_count: item.count,
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
