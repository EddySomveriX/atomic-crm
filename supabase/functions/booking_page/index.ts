import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import {
  loadBusiness,
  makeBookingDeps,
} from "../_shared/channels/bookingDeps.ts";
import { makeClientBookingDeps } from "../_shared/channels/clientBookings.ts";
import {
  DAYS_AHEAD,
  addDays,
  dayIn,
  firstPerTime,
} from "../_shared/bot/bookingFlow.ts";
import {
  isSmsConfigured,
  phoneDigits,
  sendSms,
} from "../../../connectors/sms/index.ts";
import { publicLimitResponse } from "../_shared/rateLimit.ts";

/**
 * The public booking page of a business (/book/<slug>). No sign-in: the page
 * is found by its slug and works only while the owner keeps it on. A client
 * proves their phone with a one-time SMS code and gets a key for 30 days;
 * booking, "my bookings" and cancelling need that key.
 *
 * POST { action, slug, ... }
 *   page                                     → business, texts, price list, specialists, offers
 *   days    { service_id, sales_id }         → days with free time
 *   slots   { service_id, sales_id, day }    → free times of a day
 *   send_code   { phone }                    → { status: "sent" | "too_many" }
 *   verify_code { phone, code }              → { token } | { status: "wrong" | "expired" }
 *   book    { token, service_id, slot, name, consent } → { status: "booked" | "taken" }
 *   my      { token }                        → upcoming bookings of the phone
 *   cancel  { token, booking_id }            → { status: "cancelled" | "not_found" }
 */

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_SHOWN = 14;
const CODE_MINUTES = 10;
const CODE_ATTEMPTS = 5;
const CODES_PER_HOUR = 3;
const SESSION_DAYS = 30;
const MINUTE_MS = 60_000;

type Payload = Record<string, unknown>;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const positiveInt = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const sha256 = async (value: string): Promise<string> =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

const randomCode = (): string =>
  String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(
    6,
    "0",
  );

const randomToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const smsContext = () => ({
  fetch,
  settings: {
    token: Deno.env.get("SMS_TOKEN"),
    sender: Deno.env.get("SMS_SENDER"),
  },
});

interface PageRow {
  business_id: string;
  slug: string;
  about: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
}

const findPage = async (slug: unknown): Promise<PageRow | null> => {
  if (typeof slug !== "string" || !SLUG.test(slug)) return null;
  const { data } = await supabaseAdmin
    .from("booking_pages")
    .select("business_id, slug, about, address, phone, instagram")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  return data;
};

/** The phone a key was given to; null when the key is wrong or old. */
const sessionPhone = async (
  businessId: string,
  token: unknown,
): Promise<string | null> => {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await supabaseAdmin
    .from("booking_sessions")
    .select("phone")
    .eq("business_id", businessId)
    .eq("token_hash", await sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.phone ?? null;
};

/** Clients of the business with this phone number (digits compared). */
const clientsOfPhone = async (
  businessId: string,
  phone: string,
): Promise<number[]> => {
  const { data, error } = await supabaseAdmin.rpc("find_client_by_phone", {
    p_business_id: businessId,
    p_phone: phone,
  });
  if (error) throw error;
  return data == null ? [] : [data as number];
};

async function describePage(page: PageRow) {
  const business = await loadBusiness(page.business_id);
  const deps = makeBookingDeps(business, {
    source: "page",
    conversationId: null,
  });
  const [{ data: info }, { data: products }, { data: offers }, { data: bot }] =
    await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select("name, country_code")
        .eq("id", page.business_id)
        .single(),
      supabaseAdmin
        .from("products")
        .select(
          "id, name, category, description, duration_minutes, price, sort_order",
        )
        .eq("business_id", page.business_id)
        .eq("kind", "service")
        .eq("archived", false)
        .eq("show_online", true)
        .eq("is_addon", false)
        .not("duration_minutes", "is", null)
        .order("sort_order")
        .order("name"),
      supabaseAdmin
        .from("promotions")
        .select(
          "id, kind, name, percent, product_ids, weekdays, time_from, time_to, within_hours, valid_to",
        )
        .eq("business_id", page.business_id)
        .eq("active", true)
        .neq("kind", "promo_code"),
      supabaseAdmin
        .from("channels")
        .select("name")
        .eq("business_id", page.business_id)
        .eq("kind", "telegram")
        .eq("enabled", true)
        .maybeSingle(),
    ]);
  const today = dayIn(new Date(), business.timezone);
  return {
    business: info?.name ?? "",
    language: !info?.country_code || info.country_code === "UA" ? "uk" : "en",
    currency: deps.currency,
    timezone: business.timezone,
    about: page.about,
    address: page.address,
    phone: page.phone,
    instagram: page.instagram,
    telegram_bot: bot?.name ?? null,
    services: products ?? [],
    specialists: await deps.specialists(0),
    offers: (offers ?? []).filter(
      (offer) => !offer.valid_to || offer.valid_to >= today,
    ),
    sms: isSmsConfigured(smsContext()),
  };
}

async function sendCode(page: PageRow, payload: Payload) {
  const phone = phoneDigits(text(payload.phone, 32));
  if (!phone) return createErrorResponse(400, "invalid_phone");
  const { count } = await supabaseAdmin
    .from("phone_codes")
    .select("id", { count: "exact", head: true })
    .eq("business_id", page.business_id)
    .eq("phone", phone)
    .gte("created_at", new Date(Date.now() - 60 * MINUTE_MS).toISOString());
  if ((count ?? 0) >= CODES_PER_HOUR) {
    return jsonResponse({ status: "too_many" });
  }
  const code = randomCode();
  const { error } = await supabaseAdmin.from("phone_codes").insert({
    business_id: page.business_id,
    phone,
    code_hash: await sha256(`${phone}:${code}`),
    expires_at: new Date(Date.now() + CODE_MINUTES * MINUTE_MS).toISOString(),
  });
  if (error) throw error;
  const context = smsContext();
  if (isSmsConfigured(context)) {
    const { data: info } = await supabaseAdmin
      .from("businesses")
      .select("name")
      .eq("id", page.business_id)
      .single();
    try {
      await sendSms(
        phone,
        `${code} — ${info?.name ?? ""}`.slice(0, 140),
        context,
      );
    } catch {
      return createErrorResponse(502, "sms_failed");
    }
  } else {
    // No SMS provider yet (a developer machine): the code goes to the log,
    // and to the page itself when SMS_DEV_SHOW_CODE is on (never in production)
    console.warn(`booking page code for …${phone.slice(-4)}: ${code}`);
    if (Deno.env.get("SMS_DEV_SHOW_CODE") === "true") {
      return jsonResponse({ status: "sent", dev_code: code });
    }
  }
  return jsonResponse({ status: "sent" });
}

async function verifyCode(page: PageRow, payload: Payload) {
  const phone = phoneDigits(text(payload.phone, 32));
  const code = text(payload.code, 6);
  if (!phone || !/^\d{6}$/.test(code)) {
    return createErrorResponse(400, "invalid_input");
  }
  const { data: latest } = await supabaseAdmin
    .from("phone_codes")
    .select("id, code_hash, expires_at, attempts, used_at")
    .eq("business_id", page.business_id)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    !latest ||
    latest.used_at ||
    latest.attempts >= CODE_ATTEMPTS ||
    Date.parse(latest.expires_at) < Date.now()
  ) {
    return jsonResponse({ status: "expired" });
  }
  if (latest.code_hash !== (await sha256(`${phone}:${code}`))) {
    await supabaseAdmin
      .from("phone_codes")
      .update({ attempts: latest.attempts + 1 })
      .eq("id", latest.id);
    return jsonResponse({ status: "wrong" });
  }
  await supabaseAdmin
    .from("phone_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", latest.id);
  const token = randomToken();
  const { error } = await supabaseAdmin.from("booking_sessions").insert({
    business_id: page.business_id,
    phone,
    token_hash: await sha256(token),
    expires_at: new Date(
      Date.now() + SESSION_DAYS * 24 * 60 * MINUTE_MS,
    ).toISOString(),
  });
  if (error) throw error;
  return jsonResponse({ status: "verified", token });
}

async function handle(payload: Payload): Promise<Response> {
  const page = await findPage(payload.slug);
  if (!page) return createErrorResponse(404, "not_found");
  const business = await loadBusiness(page.business_id);
  const deps = makeBookingDeps(business, {
    source: "page",
    conversationId: null,
  });

  switch (payload.action) {
    case "page":
      return jsonResponse(await describePage(page));

    case "days": {
      const serviceId = positiveInt(payload.service_id);
      if (!serviceId) return createErrorResponse(400, "service_id is required");
      const salesId = positiveInt(payload.sales_id);
      const today = dayIn(new Date(), business.timezone);
      const days: string[] = [];
      for (
        let offset = 0;
        offset < DAYS_AHEAD && days.length < DAYS_SHOWN;
        offset++
      ) {
        const day = addDays(today, offset);
        if ((await deps.freeSlots(serviceId, day, salesId)).length) {
          days.push(day);
        }
      }
      return jsonResponse({ days });
    }

    case "slots": {
      const serviceId = positiveInt(payload.service_id);
      const day = text(payload.day, 10);
      if (!serviceId || !DAY.test(day)) {
        return createErrorResponse(400, "service_id and day are required");
      }
      const slots = firstPerTime(
        await deps.freeSlots(serviceId, day, positiveInt(payload.sales_id)),
      );
      return jsonResponse({ slots });
    }

    case "send_code":
      return sendCode(page, payload);

    case "verify_code":
      return verifyCode(page, payload);

    case "book": {
      const phone = await sessionPhone(page.business_id, payload.token);
      if (!phone) return createErrorResponse(401, "verify_phone");
      const serviceId = positiveInt(payload.service_id);
      const slot = payload.slot as
        { sales_id?: unknown; starts_at?: unknown } | undefined;
      const salesId = positiveInt(slot?.sales_id);
      const startsAt = text(slot?.starts_at, 40);
      const name = text(payload.name, 100);
      if (
        !serviceId ||
        !salesId ||
        Number.isNaN(Date.parse(startsAt)) ||
        !name
      ) {
        return createErrorResponse(400, "service, time and name are required");
      }
      if (payload.consent !== true) {
        return createErrorResponse(400, "consent_required");
      }
      const clientId = await deps.findOrCreateClient(name, `+${phone}`);
      const outcome = await deps.book({
        serviceId,
        salesId,
        startsAt: new Date(startsAt).toISOString(),
        clientId,
      });
      return jsonResponse({ status: outcome });
    }

    case "my": {
      const phone = await sessionPhone(page.business_id, payload.token);
      if (!phone) return createErrorResponse(401, "verify_phone");
      const own = makeClientBookingDeps(page.business_id);
      const bookings = [];
      for (const clientId of await clientsOfPhone(page.business_id, phone)) {
        bookings.push(...(await own.upcoming(clientId)));
      }
      return jsonResponse({ bookings });
    }

    case "cancel": {
      const phone = await sessionPhone(page.business_id, payload.token);
      if (!phone) return createErrorResponse(401, "verify_phone");
      const bookingId = positiveInt(payload.booking_id);
      if (!bookingId) return createErrorResponse(400, "booking_id is required");
      const own = makeClientBookingDeps(page.business_id);
      for (const clientId of await clientsOfPhone(page.business_id, phone)) {
        if ((await own.cancel(bookingId, clientId)) === "cancelled") {
          return jsonResponse({ status: "cancelled" });
        }
      }
      return jsonResponse({ status: "not_found" });
    }

    default:
      return createErrorResponse(400, "Unknown action");
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }
    let payload: Payload;
    try {
      payload = await req.json();
    } catch {
      return createErrorResponse(400, "Expected a JSON body");
    }
    const limited = await publicLimitResponse(
      req,
      "booking_page",
      payload?.action,
    );
    if (limited) return limited;
    try {
      return await handle(payload);
    } catch (error) {
      console.error(
        "booking page request failed:",
        error instanceof Error ? error.message : error,
      );
      return createErrorResponse(500, "Request failed");
    }
  }),
);
