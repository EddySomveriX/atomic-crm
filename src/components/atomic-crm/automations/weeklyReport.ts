import type { Identifier } from "ra-core";

/** The weekly report in Telegram (supabase/schemas/29_weekly_report.sql). */
export interface WeeklyReportSettings {
  enabled: boolean;
  /** 1 = Monday ... 7 = Sunday */
  weekday: number;
  hour: number;
  /** Members (sales ids) who receive the report */
  recipients: Identifier[];
}

export type WeeklyReportSendResult =
  | { sent: number; failed: number; no_chat: number }
  | { status: "no_recipients" | "no_bot" };

export const DEFAULT_WEEKLY_REPORT: WeeklyReportSettings = {
  enabled: false,
  weekday: 1,
  hour: 9,
  recipients: [],
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Adds or removes a member from the recipients, keeping the order. */
export const toggleRecipient = (
  recipients: Identifier[],
  id: Identifier,
): Identifier[] =>
  recipients.some((item) => String(item) === String(id))
    ? recipients.filter((item) => String(item) !== String(id))
    : [...recipients, id];

/** "Monday" in the language of the interface, from 1 = Monday. */
export const weekdayName = (weekday: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    // 2024-01-01 was a Monday
    new Date(Date.UTC(2024, 0, weekday)),
  );
