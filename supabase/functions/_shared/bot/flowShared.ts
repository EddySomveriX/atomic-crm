import type { BotLanguage } from "./botTexts.ts";

/**
 * Types and helpers shared by the parts of the bot dialog: booking a service
 * (bookingFlow.ts) and managing one's bookings (myBookings.ts).
 */

/** Days ahead the bot looks for free time */
export const DAYS_AHEAD = 14;
/** Days with free time shown as buttons */
export const DAYS_SHOWN = 7;
/** Free times shown for a day */
export const TIMES_SHOWN = 24;
export const TIMES_PER_ROW = 4;

export interface BotService {
  id: number;
  name: string;
  duration_minutes: number;
}

export interface BotSpecialist {
  id: number;
  name: string;
}

export interface FreeSlot {
  sales_id: number;
  starts_at: string;
}

export interface BookingRequest {
  serviceId: number;
  salesId: number;
  startsAt: string;
  clientId: number;
}

/** A booking of the client still ahead, as the bot lists it. */
export interface UpcomingBooking {
  id: number;
  serviceId: number;
  serviceName: string;
  salesId: number;
  specialistName: string;
  startsAt: string;
}

export type ReliabilityLevel = "reliable" | "regular" | "watch" | "unreliable";

export interface BookingPolicy {
  /** Hours before the visit when a cancellation stops being free */
  freeCancelHours: number;
  /** Unreliable clients book through a person, not through the bot */
  blockUnreliable: boolean;
}

export interface BotDeps {
  businessName: string;
  timeZone: string;
  policy: BookingPolicy;
  now: () => Date;
  services: () => Promise<BotService[]>;
  /** Specialists who work and can do the service */
  specialists: (serviceId: number) => Promise<BotSpecialist[]>;
  freeSlots: (
    serviceId: number,
    day: string,
    salesId: number | null,
  ) => Promise<FreeSlot[]>;
  /** "taken" when the time was booked by someone else meanwhile */
  book: (request: BookingRequest) => Promise<"booked" | "taken">;
  findOrCreateClient: (name: string, phone: string) => Promise<number>;
  /** Bookings of the client still ahead, soonest first */
  upcoming: (clientId: number) => Promise<UpcomingBooking[]>;
  /** The client cancels one of their bookings */
  cancel: (
    bookingId: number,
    clientId: number,
  ) => Promise<"cancelled" | "not_found">;
  /** The client confirms they will come */
  confirm: (
    bookingId: number,
    clientId: number,
  ) => Promise<"confirmed" | "not_found">;
  /** The client moves one of their bookings to an offered time */
  reschedule: (
    bookingId: number,
    clientId: number,
    slot: FreeSlot,
  ) => Promise<"moved" | "taken" | "not_found">;
  reliability: (clientId: number) => Promise<ReliabilityLevel>;
}

export interface BotState {
  step?: "service" | "specialist" | "day" | "time" | "phone" | "confirm";
  serviceId?: number;
  salesId?: number | "any";
  day?: string;
  slot?: FreeSlot;
  /** The booking being moved, when the client reschedules */
  rescheduleId?: number;
}

export interface BotConversation {
  language: BotLanguage;
  hasConsent: boolean;
  clientId: number | null;
  phone: string | null;
  title: string | null;
  isWaiting: boolean;
  state: BotState;
}

export type BotInput =
  | { kind: "start" }
  | { kind: "text"; text: string }
  | { kind: "button"; data: string }
  | { kind: "contact"; phone: string; name: string };

export interface BotButton {
  text: string;
  data: string;
}

export interface BotReply {
  text: string;
  buttons?: BotButton[][];
  /** Show the "send my phone number" keyboard */
  askPhone?: boolean;
}

export interface BotResult {
  replies: BotReply[];
  state: BotState;
  /** The bot answered by itself: the client does not wait for a person */
  handledByBot: boolean;
  consentGiven?: boolean;
  phone?: string;
  clientId?: number;
  bookedAt?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The calendar day of a moment in a time zone: "2030-01-07". */
export const dayIn = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const addDays = (day: string, days: number): string => {
  const [year, month, date] = day.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + days));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
};

/** Noon of a day: a safe moment to name the day in any time zone. */
export const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);

export const rows = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

/** One free time per moment: the first specialist free then. */
export const firstPerTime = (slots: FreeSlot[]): FreeSlot[] => {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = new Date(slot.starts_at).toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const slotData = (slot: FreeSlot) =>
  `slot:${slot.sales_id}:${Math.floor(Date.parse(slot.starts_at) / 1000)}`;

export const parseSlot = (data: string): FreeSlot | null => {
  const match = /^slot:(\d+):(\d+)$/.exec(data);
  return match
    ? {
        sales_id: Number(match[1]),
        starts_at: new Date(Number(match[2]) * 1000).toISOString(),
      }
    : null;
};
