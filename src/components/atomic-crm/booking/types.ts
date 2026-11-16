import type { Identifier, RaRecord } from "ra-core";

export const BOOKING_STATUSES = [
  "booked",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingSource = "crm" | "telegram" | "widget";

export interface Booking extends RaRecord {
  /** The specialist (sales id) */
  sales_id: Identifier;
  /** The service (product id) */
  product_id: Identifier;
  /** The client (counterparty id) */
  client_id: Identifier | null;
  starts_at: string;
  ends_at: string;
  blocked_until: string;
  status: BookingStatus;
  source: BookingSource;
  note: string | null;
  conversation_id?: Identifier | null;
  cancelled_at?: string | null;
  cancelled_by?: "client" | "business" | null;
  late_cancel?: boolean;
  reschedule_count?: number;
  late_reschedules?: number;
  /** Minutes the client came late, marked by the specialist */
  late_minutes?: number | null;
  /** The client confirmed the visit from the reminder */
  confirmed_at?: string | null;
}

export interface WorkingHours extends RaRecord {
  sales_id: Identifier;
  /** ISO weekday: 1 Monday .. 7 Sunday */
  weekday: number;
  /** "09:00:00" */
  starts_at: string;
  ends_at: string;
}

/** An active member of the business who can take bookings. */
export interface Specialist extends RaRecord {
  first_name: string;
  last_name: string;
  role: string;
}

export const specialistName = (specialist: Specialist | undefined): string =>
  specialist ? `${specialist.first_name} ${specialist.last_name}`.trim() : "";

/** The message of a refused save: the time is taken, or a generic failure. */
export const bookingErrorKey = (error: unknown): string =>
  error instanceof Error && error.message.includes("bookings_no_overlap")
    ? "crm.booking.time_taken"
    : "crm.booking.save_failed";
