import type { ClientReliability } from "./types";

/** "2 неявки, 1 пізня відміна за рік" — what the level is made of. */
export const reliabilityReasons = (
  reliability: ClientReliability,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (reliability.reliability_override) {
    return translate("crm.reliability.set_by_hand");
  }
  const parts = [
    ["visits", reliability.visits],
    ["no_shows", reliability.no_shows],
    ["late_cancels", reliability.late_cancels],
    ["late_reschedules", reliability.late_reschedules],
    ["late_arrivals", reliability.late_arrivals],
  ]
    .filter(([, count]) => Number(count) > 0)
    .map(([key, count]) =>
      translate(`crm.reliability.counts.${key}`, { smart_count: count }),
    );
  return parts.length
    ? translate("crm.reliability.over_year", { list: parts.join(", ") })
    : translate("crm.reliability.no_history");
};
