import type { Identifier } from "ra-core";

/** A line of the team report (public.team_report). Money in minor units. */
export interface TeamReportRow {
  sales_id: Identifier;
  first_name: string;
  last_name: string;
  visits: number;
  no_shows: number;
  revenue: number;
  commission_percent: number | null;
  commission: number;
}

/** Totals of a closed day (public.close_day). */
export interface DayTotals {
  visits: number;
  no_shows: number;
  cancelled: number;
  revenue: number;
  commission: number;
  specialists: {
    sales_id: Identifier;
    name: string;
    visits: number;
    revenue: number;
    commission: number;
  }[];
}

export interface DayClosing {
  id: Identifier;
  day: string;
  closed_at: string;
  closed_by: string | null;
  totals: DayTotals;
}

export const COMMISSION_MAX = 100;

/** "40" or "37,5" typed by a person → a percent; null when empty or wrong. */
export const parsePercent = (text: string): number | null => {
  const cleaned = text.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value <= COMMISSION_MAX ? value : null;
};
