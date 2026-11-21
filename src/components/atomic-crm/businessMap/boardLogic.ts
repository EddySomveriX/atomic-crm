import type { Identifier } from "ra-core";

import type { Analytics } from "../analytics/types";

/**
 * The rules of the business board (the "Карта бізнесу" page): its zones,
 * the level of the business and the tokens drawn in each zone.
 */

/** The path of a client through the business, in this order. */
export const ZONES = ["entrance", "hall", "cash", "stock", "return"] as const;
export type ZoneKey = (typeof ZONES)[number];

/** Points needed for each level; a level never goes back. */
export const LEVEL_POINTS = [
  0, 10, 30, 60, 100, 200, 400, 700, 1000, 1500, 2500, 4000,
] as const;

/** Tokens drawn in a zone before "+N". */
export const MAX_TOKENS = 8;

/** Points of a business: every client and every visit of the last year. */
export const pointsOf = (analytics: Analytics): number =>
  analytics.kpis.clients_total +
  analytics.bookings_by_month.reduce((total, row) => total + row.completed, 0);

/** Level 1 and up for a number of points. */
export const levelOf = (points: number): number =>
  LEVEL_POINTS.filter((threshold) => points >= threshold).length;

/** How far to the next level, 0 to 1; 1 at the last level. */
export const levelProgress = (points: number): number => {
  const level = levelOf(points);
  const start = LEVEL_POINTS[level - 1];
  const next = LEVEL_POINTS[level];
  if (next === undefined) return 1;
  return Math.min(1, Math.max(0, (points - start) / (next - start)));
};

/**
 * The points to show: never fewer than the best ever shown, so the level
 * and its bar never go back (a client merged or a visit cancelled).
 */
export const keepBest = (best: number | undefined, current: number): number =>
  Math.max(best ?? 0, current);

/** "ОТ" for "Олена Тестова", "?" without a name. */
export const initials = (name: string): string => {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase());
  return letters.length > 0 ? letters.join("") : "?";
};

/** Tokens drawn for a count, and how many go into "+N". */
export const tokens = (count: number, max = MAX_TOKENS) => {
  const shown = Math.max(0, Math.min(count, max));
  return { shown, more: Math.max(0, count - shown) };
};

interface TimedBooking {
  sales_id: Identifier | null;
  starts_at: string;
  ends_at: string;
}

/** The specialist has a client at this moment. */
export const isBusyNow = (
  bookings: TimedBooking[],
  salesId: Identifier,
  now: Date,
): boolean =>
  bookings.some(
    (booking) =>
      String(booking.sales_id) === String(salesId) &&
      new Date(booking.starts_at) <= now &&
      now < new Date(booking.ends_at),
  );

/** Zones with something to do, for the "!" mark on the board. */
export const zonesNeedingAttention = (analytics: Analytics): ZoneKey[] => {
  const zones: ZoneKey[] = [];
  if (analytics.kpis.waiting_now > 0) zones.push("entrance");
  if (analytics.stock.out_of_stock > 0) zones.push("stock");
  if (analytics.dormant_clients.length > 0) zones.push("return");
  return zones;
};
