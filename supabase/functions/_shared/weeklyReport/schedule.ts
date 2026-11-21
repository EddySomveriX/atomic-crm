import { addDays, dayIn } from "../bot/flowShared.ts";

/**
 * When the weekly report goes out and which days it covers, in the time zone
 * of the business (supabase/schemas/29_weekly_report.sql).
 */

/** Days a report covers: firstDay included, endDay excluded ("2030-01-07"). */
export interface ReportPeriod {
  firstDay: string;
  endDay: string;
}

export interface ReportSchedule {
  /** 1 = Monday ... 7 = Sunday */
  weekday: number;
  hour: number;
  /** firstDay of the last period a report was sent about */
  last_sent_week: string | null;
}

/** From this hour on, the send day itself belongs to the report. */
const EVENING_HOUR = 18;
/** A report not sent within this time after its moment is skipped. */
const LATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const isoWeekday = (day: string): number => {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

const hourIn = (date: Date, timeZone: string): number =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );

/** How far the clock of a time zone is ahead of UTC at a moment, in ms. */
const offsetAt = (date: Date, timeZone: string): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** The moment a calendar day starts in a time zone. */
export const startOfDay = (day: string, timeZone: string): Date => {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const first = offsetAt(new Date(guess), timeZone);
  const second = offsetAt(new Date(guess - first), timeZone);
  return new Date(guess - second);
};

/**
 * The seven days a report sent on sendDay covers: the week before that day,
 * or, for an evening report, the week ending with that day.
 */
export const periodFor = (sendDay: string, hour: number): ReportPeriod => {
  const endDay = hour >= EVENING_HOUR ? addDays(sendDay, 1) : sendDay;
  return { firstDay: addDays(endDay, -7), endDay };
};

/** The last seven days up to and including today, for "send now". */
export const lastSevenDays = (now: Date, timeZone: string): ReportPeriod => {
  const endDay = addDays(dayIn(now, timeZone), 1);
  return { firstDay: addDays(endDay, -7), endDay };
};

/**
 * The period whose report is due now, or null: its moment (the chosen day
 * and hour) has come, it was not sent yet, and it is not over a day late.
 */
export const duePeriod = (
  now: Date,
  schedule: ReportSchedule,
  timeZone: string,
): ReportPeriod | null => {
  const today = dayIn(now, timeZone);
  let sendDay = addDays(
    today,
    -((isoWeekday(today) - schedule.weekday + 7) % 7),
  );
  if (sendDay === today && hourIn(now, timeZone) < schedule.hour) {
    sendDay = addDays(sendDay, -7);
  }
  const moment =
    startOfDay(sendDay, timeZone).getTime() + schedule.hour * HOUR_MS;
  if (now.getTime() - moment > LATE_LIMIT_MS) return null;
  const period = periodFor(sendDay, schedule.hour);
  return schedule.last_sent_week === period.firstDay ? null : period;
};
