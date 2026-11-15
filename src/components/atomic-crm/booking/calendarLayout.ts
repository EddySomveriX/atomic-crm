import type { Identifier } from "ra-core";

import { minutesIn, minutesOf } from "./bookingTime";
import type { Booking, WorkingHours } from "./types";

/** The day view shows 08:00-20:00 unless working hours or bookings go further. */
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 20 * 60;
const HOUR = 60;

export interface DayRange {
  /** First minute shown, on a full hour */
  start: number;
  /** Last minute shown, on a full hour */
  end: number;
}

/** Hours of the day view: the working hours and bookings of that day fit in. */
export const dayRange = (
  hours: Pick<WorkingHours, "starts_at" | "ends_at">[],
  bookings: Pick<Booking, "starts_at" | "ends_at">[],
  timeZone: string,
): DayRange => {
  const starts = [
    DEFAULT_START,
    ...hours.map((item) => minutesOf(item.starts_at)),
    ...bookings.map((item) => minutesIn(new Date(item.starts_at), timeZone)),
  ];
  const ends = [
    DEFAULT_END,
    ...hours.map((item) => minutesOf(item.ends_at)),
    ...bookings.map((item) => {
      const end = minutesIn(new Date(item.ends_at), timeZone);
      // A booking past midnight ends at the bottom of the day
      return end === 0 ? 24 * HOUR : end;
    }),
  ];
  return {
    start: Math.floor(Math.min(...starts) / HOUR) * HOUR,
    end: Math.min(24 * HOUR, Math.ceil(Math.max(...ends) / HOUR) * HOUR),
  };
};

export interface Placement {
  /** Percent of the column height from the top */
  top: number;
  /** Percent of the column height */
  height: number;
}

/** Where a time span sits in a column showing a day range. */
export const placeSpan = (
  startMinutes: number,
  endMinutes: number,
  range: DayRange,
): Placement => {
  const total = range.end - range.start;
  const from = Math.max(startMinutes, range.start);
  const to = Math.min(Math.max(endMinutes, from), range.end);
  return {
    top: ((from - range.start) / total) * 100,
    height: ((to - from) / total) * 100,
  };
};

/**
 * The specialists shown on a day: those working that day or with a booking,
 * in the order of the list of specialists.
 */
export const columnsOfDay = (
  specialistIds: Identifier[],
  hours: Pick<WorkingHours, "sales_id">[],
  bookings: Pick<Booking, "sales_id">[],
): Identifier[] => {
  const busy = new Set(
    [...hours, ...bookings].map((item) => String(item.sales_id)),
  );
  return specialistIds.filter((id) => busy.has(String(id)));
};
