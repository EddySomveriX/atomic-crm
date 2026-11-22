import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import { insertMessage } from "../_shared/channels/delivery.ts";
import {
  loadBusiness,
  makeBookingDeps,
  type BusinessInfo,
} from "../_shared/channels/bookingDeps.ts";
import {
  DAYS_AHEAD,
  addDays,
  dayIn,
  firstPerTime,
} from "../_shared/bot/bookingFlow.ts";
import { botText, formatWhen } from "../_shared/bot/botTexts.ts";
import { publicLimitResponse } from "../_shared/rateLimit.ts";
import { hasFeature } from "../_shared/subscription.ts";

/**
 * The public API of the website widget (TZ section 5.2): a visitor of the
 * business site books a service or writes a message, which reaches the chat
 * center. The widget is identified by the public key of its channel, the
 * visitor by a random id kept in their browser. No session: everything is
 * scoped to that one widget and that one visitor.
 *
 * POST { action, key, visitor, ... }
 *   init                                   → business name, services, specialists
 *   days     { service_id, sales_id }      → days with free time
 *   slots    { service_id, sales_id, day } → free times of a day
 *   book     { service_id, slot, name, phone, consent }
 *   send     { text, name }
 *   messages { after_id }                  → the conversation of the visitor
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAYS_SHOWN = 7;
/** A visitor writes at most this many messages a minute */
const MESSAGES_PER_MINUTE = 10;

interface WidgetChannel {
  id: number;
  business_id: string;
}

type Payload = Record<string, unknown>;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const positiveInt = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const languageOf = (
  business: BusinessInfo & { country_code?: string | null },
) => (business.country_code === "UA" || !business.country_code ? "uk" : "en");

async function findChannel(key: unknown): Promise<WidgetChannel | null> {
  if (typeof key !== "string" || !UUID.test(key)) return null;
  const { data } = await supabaseAdmin
    .from("channels")
    .select("id, business_id")
    .eq("public_key", key)
    .eq("kind", "widget")
    .eq("enabled", true)
    .maybeSingle();
  return data;
}

async function visitorConversation(
  channel: WidgetChannel,
  visitor: string,
  create: { title?: string; language?: "uk" | "en" } | null,
) {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id, business_id, channel_id, external_id, client_id, phone, title")
    .eq("channel_id", channel.id)
    .eq("external_id", visitor)
    .maybeSingle();
  if (existing || !create) return existing;
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .upsert(
      {
        business_id: channel.business_id,
        channel_id: channel.id,
        external_id: visitor,
        title: create.title || null,
        language: create.language ?? "uk",
      },
      { onConflict: "channel_id,external_id" },
    )
    .select("id, business_id, channel_id, external_id, client_id, phone, title")
    .single();
  if (error) throw error;
  return data;
}

async function handle(payload: Payload): Promise<Response> {
  const channel = await findChannel(payload.key);
  if (!channel) return createErrorResponse(404, "Unknown widget");
  // The site chat is a messenger: part of the Business and Pro plans
  if (!(await hasFeature(channel.business_id, "messengers"))) {
    return createErrorResponse(404, "Unknown widget");
  }
  const visitor = typeof payload.visitor === "string" ? payload.visitor : "";
  if (!UUID.test(visitor))
    return createErrorResponse(400, "visitor is required");

  const { data: businessRow } = await supabaseAdmin
    .from("businesses")
    .select("id, name, timezone, country_code")
    .eq("id", channel.business_id)
    .single();
  const business = businessRow as BusinessInfo & {
    country_code: string | null;
  };
  const language = languageOf(business);
  const conversation = await visitorConversation(channel, visitor, null);
  const deps = makeBookingDeps(await loadBusiness(channel.business_id), {
    source: "widget",
    conversationId: conversation?.id ?? null,
  });

  switch (payload.action) {
    case "init": {
      const services = await deps.services();
      const specialists = services.length
        ? await deps.specialists(services[0].id)
        : [];
      return jsonResponse({
        business: business.name,
        language,
        currency: deps.currency,
        services,
        specialists,
      });
    }

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
        if ((await deps.freeSlots(serviceId, day, salesId)).length)
          days.push(day);
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
      return jsonResponse({ slots, timezone: business.timezone });
    }

    case "book": {
      const serviceId = positiveInt(payload.service_id);
      const slot = payload.slot as
        { sales_id?: unknown; starts_at?: unknown } | undefined;
      const salesId = positiveInt(slot?.sales_id);
      const startsAt = text(slot?.starts_at, 40);
      const name = text(payload.name, 100);
      const phone = text(payload.phone, 32);
      if (
        !serviceId ||
        !salesId ||
        Number.isNaN(Date.parse(startsAt)) ||
        !name
      ) {
        return createErrorResponse(400, "service, time and name are required");
      }
      if (payload.consent !== true)
        return createErrorResponse(400, "consent_required");
      if (phone.replace(/\D/g, "").length < 7) {
        return createErrorResponse(400, "invalid_phone");
      }
      const clientId = await deps.findOrCreateClient(name, phone);
      const open = await visitorConversation(channel, visitor, {
        title: name,
        language,
      });
      await supabaseAdmin
        .from("conversations")
        .update({
          client_id: open!.client_id ?? clientId,
          phone: `+${phone.replace(/\D/g, "")}`,
          title: open!.title ?? name,
          consent_at: new Date().toISOString(),
        })
        .eq("id", open!.id);
      const bookingDeps = makeBookingDeps(
        await loadBusiness(channel.business_id),
        {
          source: "widget",
          conversationId: open!.id,
        },
      );
      const outcome = await bookingDeps.book({
        serviceId,
        salesId,
        startsAt: new Date(startsAt).toISOString(),
        clientId,
      });
      if (outcome === "taken") return jsonResponse({ status: "taken" });

      const services = await bookingDeps.services();
      const specialists = await bookingDeps.specialists(serviceId);
      const confirmation = botText(language, "booked_site", {
        service: services.find((item) => item.id === serviceId)?.name ?? "",
        when: formatWhen(new Date(startsAt), business.timezone, language),
        specialist: specialists.find((item) => item.id === salesId)?.name ?? "",
      });
      await insertMessage({
        business_id: channel.business_id,
        conversation_id: open!.id,
        direction: "out",
        body: confirmation,
        status: "sent",
      });
      return jsonResponse({ status: "booked", message: confirmation });
    }

    case "send": {
      const body = text(payload.text, 4096);
      if (!body) return createErrorResponse(400, "text is required");
      const open = await visitorConversation(channel, visitor, {
        title: text(payload.name, 100),
        language,
      });
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", open!.id)
        .eq("direction", "in")
        .gte("created_at", since);
      if ((count ?? 0) >= MESSAGES_PER_MINUTE) {
        return createErrorResponse(429, "Too many messages");
      }
      await insertMessage({
        business_id: channel.business_id,
        conversation_id: open!.id,
        direction: "in",
        body,
        status: "received",
      });
      return jsonResponse({ status: "received" });
    }

    case "messages": {
      if (!conversation) return jsonResponse({ messages: [] });
      const { data } = await supabaseAdmin
        .from("messages")
        .select("id, direction, body, created_at")
        .eq("conversation_id", conversation.id)
        .gt("id", positiveInt(payload.after_id) ?? 0)
        .in("status", ["received", "sent"])
        .order("id")
        .limit(100);
      return jsonResponse({ messages: data ?? [] });
    }

    default:
      return createErrorResponse(400, "Unknown action");
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST")
      return createErrorResponse(405, "Method Not Allowed");
    let payload: Payload;
    try {
      payload = await req.json();
    } catch {
      return createErrorResponse(400, "Expected a JSON body");
    }
    const limited = await publicLimitResponse(req, "widget", payload?.action);
    if (limited) return limited;
    try {
      return await handle(payload);
    } catch (error) {
      console.error(
        "widget request failed:",
        error instanceof Error ? error.message : error,
      );
      return createErrorResponse(500, "Request failed");
    }
  }),
);
