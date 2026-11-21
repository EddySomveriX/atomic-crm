import { supabaseAdmin } from "./supabaseAdmin.ts";
import { createErrorResponse } from "./utils.ts";

/**
 * Limits of the public endpoints (no sign-in): how often one IP address may
 * call an action, so a script cannot flood a business with bookings,
 * messages or paid SMS codes. Counted in the database (take_rate_limit).
 */

export type PublicEndpoint = "widget" | "booking_page";

interface Limit {
  max: number;
  windowSeconds: number;
}

const MINUTES_10 = 600;
const HOUR = 3600;

/** Reading free time and the like: generous, only stops scripts */
const READ_LIMIT: Limit = { max: 300, windowSeconds: MINUTES_10 };

const LIMITS: Record<PublicEndpoint, Record<string, Limit>> = {
  widget: {
    book: { max: 5, windowSeconds: HOUR },
    send: { max: 30, windowSeconds: MINUTES_10 },
  },
  booking_page: {
    // Every code is a paid SMS
    send_code: { max: 10, windowSeconds: HOUR },
    verify_code: { max: 30, windowSeconds: HOUR },
    book: { max: 10, windowSeconds: HOUR },
    cancel: { max: 20, windowSeconds: HOUR },
  },
};

export const limitFor = (endpoint: PublicEndpoint, action: string): Limit =>
  LIMITS[endpoint][action] ?? READ_LIMIT;

/** The address of the caller as the proxy in front of the functions saw it. */
export const clientIp = (headers: Headers): string => {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    headers.get("cf-connecting-ip") ??
    (forwarded || null) ??
    headers.get("x-real-ip") ??
    "unknown"
  ).slice(0, 64);
};

/** One more hit of a key; false once it is over its limit. */
export const takeLimit = async (
  key: string,
  { max, windowSeconds }: Limit,
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin.rpc("take_rate_limit", {
    p_key: key.slice(0, 200),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // A broken counter must not close the business: let the call through
    console.error("rate limit check failed:", error.message);
    return true;
  }
  return data === true;
};

/**
 * Checks the limit of an action for the caller's address; a 429 response
 * when it is over, null when the call may go on.
 */
export const publicLimitResponse = async (
  req: Request,
  endpoint: PublicEndpoint,
  action: unknown,
): Promise<Response | null> => {
  const name = typeof action === "string" ? action.slice(0, 40) : "unknown";
  const allowed = await takeLimit(
    `${endpoint}:${name}:ip:${clientIp(req.headers)}`,
    limitFor(endpoint, name),
  );
  return allowed ? null : createErrorResponse(429, "too_many_requests");
};
