import { addDays, dayIn, zonedDateTime } from "../booking/bookingTime";

/** Periods of the analytics page; the default is the current month. */
export const PERIODS = ["month", "last_month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

export interface PeriodRange {
  from: Date;
  to: Date;
}

const firstOfMonth = (day: string, monthsBack: number): string => {
  const [year, month] = day.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

/**
 * The moments a period starts and ends, in the business time zone: this
 * month so far, the whole previous month, the last three months or the last
 * twelve months, each up to the end of today.
 */
export const periodRange = (
  period: Period,
  timeZone: string,
  now: Date = new Date(),
): PeriodRange => {
  const today = dayIn(now, timeZone);
  const endOfToday = zonedDateTime(addDays(today, 1), "00:00", timeZone);
  const start = (day: string) => zonedDateTime(day, "00:00", timeZone);
  switch (period) {
    case "last_month":
      return {
        from: start(firstOfMonth(today, 1)),
        to: start(firstOfMonth(today, 0)),
      };
    case "quarter":
      return { from: start(firstOfMonth(today, 2)), to: endOfToday };
    case "year":
      return { from: start(firstOfMonth(today, 11)), to: endOfToday };
    default:
      return { from: start(firstOfMonth(today, 0)), to: endOfToday };
  }
};

/** "лист." or "Nov" for a "2026-11" month, in the interface language. */
export const monthLabel = (month: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
