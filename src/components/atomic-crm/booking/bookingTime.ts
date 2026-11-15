import { datePartsIn, offsetMinutes, startOfDay } from "../today/businessDay";

/**
 * Times of the booking calendar are wall-clock times of the business (TZ
 * section 9), whatever the time zone of the browser. A day is written
 * "2030-01-07" and a time "09:30".
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** The calendar day of a moment in a time zone: "2030-01-07". */
export const dayIn = (date: Date, timeZone: string): string => {
  const { year, month, day } = datePartsIn(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
};

const partsOf = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, day: date };
};

/** The day a number of days after another one (negative: before). */
export const addDays = (day: string, days: number): string => {
  const { year, month, day: date } = partsOf(day);
  const moved = new Date(Date.UTC(year, month - 1, date + days));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
};

/** ISO weekday of a day: 1 Monday .. 7 Sunday. */
export const isoWeekday = (day: string): number => {
  const { year, month, day: date } = partsOf(day);
  return ((new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7) + 1;
};

/** Minutes since midnight of "09:30" (or of "09:30:00" as the database writes it). */
export const minutesOf = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** "09:30" from minutes since midnight. */
export const timeOfMinutes = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** The moment of a wall-clock time on a day in a time zone. */
export const zonedDateTime = (
  day: string,
  time: string,
  timeZone: string,
): Date => {
  const midnight = startOfDay(partsOf(day), timeZone);
  const guess = new Date(midnight.getTime() + minutesOf(time) * 60_000);
  // A daylight saving change during the day shifts the wall clock
  const shift =
    offsetMinutes(midnight, timeZone) - offsetMinutes(guess, timeZone);
  return new Date(guess.getTime() + shift * 60_000);
};

/** Minutes since midnight of a moment, on the wall clock of a time zone. */
export const minutesIn = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return get("hour") * 60 + get("minute");
};

/** "09:30" of a moment in a time zone. */
export const timeIn = (date: Date, timeZone: string): string =>
  timeOfMinutes(minutesIn(date, timeZone));
