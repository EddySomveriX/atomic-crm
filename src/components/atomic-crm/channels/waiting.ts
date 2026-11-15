/** Minutes a client has waited for a person, rounded down; null when answered. */
export const waitedMinutes = (
  waitingSince: string | null,
  now: Date = new Date(),
): number | null =>
  waitingSince == null
    ? null
    : Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(waitingSince)) / 60_000),
      );

/** How long a client waits, as "12 хв" / "3 год" / "2 дн" (TZ section 5.2: the reply timer). */
export const waitingLabel = (
  minutes: number,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (minutes < 60) {
    return translate("crm.chats.waited_minutes", { count: minutes });
  }
  if (minutes < 24 * 60) {
    return translate("crm.chats.waited_hours", {
      count: Math.floor(minutes / 60),
    });
  }
  return translate("crm.chats.waited_days", {
    count: Math.floor(minutes / (24 * 60)),
  });
};

/** A client waiting longer than this is shown as urgent */
export const URGENT_AFTER_MINUTES = 15;
