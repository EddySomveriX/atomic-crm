import type { Identifier, RaRecord } from "ra-core";

/** Scenarios of automatic messages (supabase/schemas/22_automations.sql). */
export const AUTOMATION_KINDS = [
  "review",
  "rebook",
  "no_show",
  "reactivation",
  "birthday",
] as const;
export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

export const DEFAULT_REACTIVATION_DAYS = 60;

export interface Automation extends RaRecord {
  kind: AutomationKind;
  enabled: boolean;
  /** reactivation: days without a visit */
  days: number | null;
  /** review: where to leave a review */
  link: string | null;
  custom_text: string | null;
}

export interface AutomationSend extends RaRecord {
  created_at: string;
  kind: AutomationKind;
  client_id: Identifier | null;
  booking_id: Identifier | null;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
}

/** A review link is an https address. */
export const isReviewLink = (value: string): boolean =>
  /^https:\/\/\S{4,500}$/.test(value.trim());
