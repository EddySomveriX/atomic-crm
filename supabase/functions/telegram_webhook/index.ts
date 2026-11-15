import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { jsonResponse, sameSecret } from "../_shared/channels/http.ts";
import type { ChannelRow } from "../_shared/channels/delivery.ts";
import { handleTelegramUpdate } from "../_shared/channels/telegramUpdates.ts";
import {
  WEBHOOK_SECRET_HEADER,
  type TelegramUpdate,
} from "../../../connectors/telegram/index.ts";

/**
 * Webhook of a business bot: Telegram POSTs every update to
 * /telegram_webhook?channel=<id> with the secret of that channel in a header
 * (set by telegram_connect). A wrong secret is refused; a repeated delivery
 * is processed once (channel_events).
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return createErrorResponse(405, "Method Not Allowed");
  const channelId = Number(new URL(req.url).searchParams.get("channel"));
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return createErrorResponse(400, "channel is required");
  }

  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id, business_id, kind, name, enabled")
    .eq("id", channelId)
    .eq("kind", "telegram")
    .maybeSingle();
  const { data: secrets } = await supabaseAdmin
    .from("channel_secrets")
    .select("bot_token, webhook_secret")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (
    !channel ||
    !secrets?.bot_token ||
    !sameSecret(req.headers.get(WEBHOOK_SECRET_HEADER), secrets.webhook_secret)
  ) {
    return createErrorResponse(401, "Unauthorized");
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  try {
    await handleTelegramUpdate(
      channel as ChannelRow,
      secrets.bot_token,
      update,
    );
  } catch (error) {
    // No personal data in logs: the channel and the error only
    console.error(`telegram update failed for channel ${channelId}:`, error);
    return createErrorResponse(500, "Update failed");
  }
  return jsonResponse({ ok: true });
});
