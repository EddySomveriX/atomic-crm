import { addDays, isoWeekday } from "../booking/bookingTime";

export const TEAM_PERIODS = ["month", "last_month", "week"] as const;
export type TeamPeriod = (typeof TEAM_PERIODS)[number];

/** First and last day (included) of a period, from today "YYYY-MM-DD". */
export const periodDays = (
  period: TeamPeriod,
  today: string,
): { from: string; to: string } => {
  if (period === "week") {
    return { from: addDays(today, 1 - isoWeekday(today)), to: today };
  }
  const monthStart = `${today.slice(0, 8)}01`;
  if (period === "month") return { from: monthStart, to: today };
  const lastMonthEnd = addDays(monthStart, -1);
  return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd };
};
