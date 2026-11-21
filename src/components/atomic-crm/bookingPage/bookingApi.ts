import { getSupabaseClient } from "../providers/supabase/supabase";

/** What the public booking page shows (supabase/functions/booking_page). */
export interface PageService {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  /** Minor units */
  price: number | null;
}

export interface PageOffer {
  id: number;
  kind: "happy_hours" | "last_minute" | "first_visit";
  name: string;
  percent: number;
  weekdays: number[];
  time_from: string | null;
  time_to: string | null;
  within_hours: number | null;
  valid_to: string | null;
}

export interface PageInfo {
  business: string;
  language: "uk" | "en";
  currency: string;
  timezone: string;
  about: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  telegram_bot: string | null;
  services: PageService[];
  specialists: { id: number; name: string }[];
  offers: PageOffer[];
  /** A real SMS provider is connected; otherwise codes are only logged */
  sms: boolean;
}

export interface PageSlot {
  sales_id: number;
  starts_at: string;
}

export interface PageBooking {
  id: number;
  serviceName: string;
  specialistName: string;
  startsAt: string;
}

/** Calls the public booking page function; throws with its error code. */
export const callBookingPage = async <T>(
  slug: string,
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke<T>(
    "booking_page",
    { body: { slug, action, ...body } },
  );
  if (error || data == null) {
    const context = (error as { context?: Response } | null)?.context;
    const answer =
      context && typeof context.json === "function"
        ? await context.json().catch(() => null)
        : null;
    throw new Error(answer?.message ?? "failed");
  }
  return data;
};

const keyName = (slug: string) => `booking-page:${slug}`;

/** The key of a proven phone, kept in this browser for 30 days. */
export const savedToken = (slug: string): string | null => {
  try {
    return localStorage.getItem(keyName(slug));
  } catch {
    return null;
  }
};

export const saveToken = (slug: string, token: string | null): void => {
  try {
    if (token) localStorage.setItem(keyName(slug), token);
    else localStorage.removeItem(keyName(slug));
  } catch {
    // Private mode: the client proves the phone again next time
  }
};

/** "2026-11-23" → "пн, 23 листопада" in the page language. */
export const dayLabel = (day: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
