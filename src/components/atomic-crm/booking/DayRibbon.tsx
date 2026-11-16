import { useGetMany, useTranslate, type Identifier } from "ra-core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import type { Product } from "../products/types";
import type { Company } from "../types";
import { minutesIn, minutesOf, timeOfMinutes } from "./bookingTime";
import { dayRange, freeGaps, placeSpan } from "./calendarLayout";
import {
  specialistName,
  type Booking,
  type Specialist,
  type WorkingHours,
} from "./types";

/** Free stretches shorter than this are not worth showing */
const SHOWN_GAP_MINUTES = 60;

/** Re-renders every minute so that the "now" line moves. */
const useNowMinutes = (timeZone: string) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return minutesIn(now, timeZone);
};

/**
 * Today as a ribbon of time (the start screen on a computer): one row per
 * specialist working today, the bookings as blocks, the free stretches of an
 * hour or more as dashed outlines, and a line at the current time. A click on
 * a block or a free stretch opens the calendar.
 */
export const DayRibbon = ({
  bookings,
  hours,
  specialists,
  timeZone,
}: {
  bookings: Booking[];
  hours: WorkingHours[];
  specialists: Specialist[];
  timeZone: string;
}) => {
  const translate = useTranslate();
  const nowMinutes = useNowMinutes(timeZone);
  const productIds = [...new Set(bookings.map((item) => item.product_id))];
  const clientIds = [
    ...new Set(bookings.flatMap((item) => item.client_id ?? [])),
  ];
  const { data: products = [] } = useGetMany<Product>(
    "products",
    { ids: productIds },
    { enabled: productIds.length > 0 },
  );
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );

  const range = dayRange(hours, bookings, timeZone);
  const rowIds = [
    ...new Set([...hours, ...bookings].map((item) => String(item.sales_id))),
  ];
  const rowsOf = specialists.filter((item) => rowIds.includes(String(item.id)));
  if (rowsOf.length === 0) return null;

  const ticks: number[] = [];
  for (let minute = range.start; minute <= range.end; minute += 120) {
    ticks.push(minute);
  }
  const showNow = nowMinutes >= range.start && nowMinutes <= range.end;
  const nameOf = (id: Identifier | null) =>
    clients.find((item) => item.id === id)?.name ??
    products.find((item) => item.id === id)?.name ??
    "";

  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-3">
      {rowsOf.map((person) => {
        const own = bookings.filter((item) => item.sales_id === person.id);
        const spans = own.map((item) => ({
          booking: item,
          start: minutesIn(new Date(item.starts_at), timeZone),
          end:
            minutesIn(new Date(item.starts_at), timeZone) +
            (Date.parse(item.ends_at) - Date.parse(item.starts_at)) / 60_000,
          blockedEnd:
            minutesIn(new Date(item.starts_at), timeZone) +
            (Date.parse(item.blocked_until) - Date.parse(item.starts_at)) /
              60_000,
        }));
        const gaps = freeGaps(
          hours
            .filter((item) => item.sales_id === person.id)
            .map((item) => ({
              start: minutesOf(item.starts_at),
              end: minutesOf(item.ends_at),
            })),
          spans.map((span) => ({ start: span.start, end: span.blockedEnd })),
          SHOWN_GAP_MINUTES,
        ).filter((gap) => gap.end > nowMinutes);

        return (
          <div key={String(person.id)} className="flex items-center gap-3">
            {rowsOf.length > 1 ? (
              <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                {specialistName(person)}
              </span>
            ) : null}
            <div className="relative h-11 min-w-0 flex-1">
              {gaps.map((gap) => {
                const place = placeSpan(
                  Math.max(gap.start, nowMinutes),
                  gap.end,
                  range,
                );
                const length = gap.end - Math.max(gap.start, nowMinutes);
                return (
                  <Link
                    key={`${gap.start}`}
                    to="/calendar"
                    className="absolute inset-y-1 flex items-center overflow-hidden rounded-md border border-dashed border-primary/40 px-2 text-xs text-primary hover:bg-accent"
                    style={{ left: `${place.top}%`, width: `${place.height}%` }}
                  >
                    <span className="truncate">
                      {translate("crm.today.free_for", {
                        time: formatLength(length, translate),
                      })}
                    </span>
                  </Link>
                );
              })}
              {spans.map(({ booking, start, end }) => {
                const place = placeSpan(start, end, range);
                return (
                  <Link
                    key={String(booking.id)}
                    to="/calendar"
                    title={`${timeOfMinutes(start)} ${nameOf(booking.client_id) || nameOf(booking.product_id)}`}
                    className={cn(
                      "absolute inset-y-1 flex flex-col justify-center overflow-hidden rounded-md px-2 text-xs leading-tight",
                      booking.status === "completed"
                        ? "bg-primary/25 text-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                    style={{ left: `${place.top}%`, width: `${place.height}%` }}
                  >
                    <span className="truncate font-medium">
                      {timeOfMinutes(start)}
                    </span>
                    <span className="truncate">
                      {nameOf(booking.client_id) || nameOf(booking.product_id)}
                    </span>
                  </Link>
                );
              })}
              {showNow ? (
                <div
                  className="pointer-events-none absolute -inset-y-0.5 w-0.5 rounded bg-destructive"
                  style={{
                    left: `${placeSpan(nowMinutes, nowMinutes, range).top}%`,
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        {rowsOf.length > 1 ? <span className="w-20 shrink-0" /> : null}
        <div className="relative h-4 min-w-0 flex-1 text-[11px] text-muted-foreground">
          {ticks.map((minute) => (
            <span
              key={minute}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${placeSpan(minute, minute, range).top}%` }}
            >
              {timeOfMinutes(minute)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const formatLength = (
  minutes: number,
  translate: (key: string, options?: Record<string, unknown>) => string,
) =>
  minutes >= 60
    ? translate("crm.today.hours_short", {
        count: Math.round((minutes / 60) * 2) / 2,
      })
    : translate("crm.booking.minutes", { count: Math.round(minutes) });
