import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { jsonResponse, sameSecret } from "../_shared/channels/http.ts";
import { handleInboundEvent } from "../_shared/channels/inbound.ts";
import type { ChannelRow } from "../_shared/channels/delivery.ts";
import {
  isMessengerKind,
  type InboundEvent,
  type MessengerKind,
} from "../../../connectors/messaging.ts";
import * as meta from "../../../connectors/meta/index.ts";
import * as viber from "../../../connectors/viber/index.ts";

/**
 * Receives the deliveries of Instagram, Messenger, WhatsApp and Viber at
 * /channel_webhook?channel=<id>.
 *
 * GET (Meta, once): confirms the address by echoing hub.challenge when
 *   hub.verify_token is the one of the channel.
 * POST: the body must be signed (Meta: the app secret, Viber: the bot
 *   token); a wrong signature is refused. Each message is processed once
 *   (channel_events). A delivery for another account of the same app is
 *   ignored.
 */

/** Deliveries are small: anything larger is not a message */
const MAX_BODY_BYTES = 1024 * 1024;

const loadChannel = async (channelId: number) => {
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id, business_id, kind, name, enabled, external_id")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel || !isMessengerKind(channel.kind)) return null;
  const { data: secrets } = await supabaseAdmin
    .from("channel_secrets")
    .select("access_token, app_secret, verify_token")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!secrets?.access_token) return null;
  return {
    channel: channel as ChannelRow & {
      kind: MessengerKind;
      external_id: string | null;
    },
    secrets,
  };
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const channelId = Number(url.searchParams.get("channel"));
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return createErrorResponse(400, "channel is required");
  }
  const loaded = await loadChannel(channelId);
  if (!loaded) return createErrorResponse(401, "Unauthorized");
  const { channel, secrets } = loaded;

  if (req.method === "GET") {
    const challenge = url.searchParams.get("hub.challenge");
    if (
      channel.kind === "viber" ||
      url.searchParams.get("hub.mode") !== "subscribe" ||
      !challenge ||
      !sameSecret(
        url.searchParams.get("hub.verify_token"),
        secrets.verify_token,
      )
    ) {
      return createErrorResponse(403, "Forbidden");
    }
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return createErrorResponse(413, "Too large");
  }
  const isSigned =
    channel.kind === "viber"
      ? await viber.verifySignature(
          rawBody,
          req.headers.get(viber.SIGNATURE_HEADER),
          secrets.access_token,
        )
      : await meta.verifySignature(
          rawBody,
          req.headers.get(meta.SIGNATURE_HEADER),
          secrets.app_secret,
        );
  if (!isSigned) return createErrorResponse(401, "Unauthorized");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const events: InboundEvent[] =
    channel.kind === "viber"
      ? viber.parseWebhook(payload)
      : meta
          .parseWebhook(channel.kind, payload)
          // One app may serve several accounts: only the one of this channel
          .filter((event) => event.accountId === channel.external_id);
  try {
    for (const event of events) {
      await handleInboundEvent(channel, event, secrets.access_token);
    }
  } catch (error) {
    // No personal data in logs: the channel and the error only
    console.error(`delivery failed for channel ${channelId}:`, error);
    return createErrorResponse(500, "Delivery failed");
  }
  return jsonResponse({ ok: true, events: events.length });
});
