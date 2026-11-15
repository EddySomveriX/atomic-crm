import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import {
  deleteWebhook,
  getMe,
  isBotToken,
  setWebhook,
} from "../../../connectors/telegram/index.ts";

/**
 * Connects the Telegram bot of the owner's current business (TZ section 5.2).
 *
 * POST { token }: checks the token with Telegram, stores it on the server
 * (channel_secrets, never readable by members) and points Telegram at the
 * webhook of this channel. Without a public address (TELEGRAM_WEBHOOK_BASE_URL
 * empty, a developer machine) the webhook is removed instead and messages are
 * fetched by channels_poll.
 *   → { username, mode: "webhook" | "polling" }
 * DELETE: disconnects the bot and forgets its token.
 */

const webhookBase = () => {
  const base = Deno.env.get("TELEGRAM_WEBHOOK_BASE_URL") ?? "";
  return base.startsWith("https://") ? base.replace(/\/$/, "") : null;
};

const randomSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

async function connect(req: Request, businessId: string) {
  let payload: { token?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!isBotToken(token)) return createErrorResponse(400, "invalid_token");

  const context = { fetch, settings: { botToken: token } };
  let username: string;
  try {
    const bot = await getMe(context);
    username = bot.username ?? String(bot.id);
  } catch {
    return createErrorResponse(400, "token_refused");
  }

  const { data: channel, error } = await supabaseAdmin
    .from("channels")
    .upsert(
      {
        business_id: businessId,
        kind: "telegram",
        name: username,
        enabled: true,
      },
      { onConflict: "business_id,kind" },
    )
    .select("id")
    .single();
  if (error) return createErrorResponse(500, "Could not save the channel");

  const webhookSecret = randomSecret();
  const { error: secretError } = await supabaseAdmin
    .from("channel_secrets")
    .upsert(
      {
        channel_id: channel.id,
        bot_token: token,
        webhook_secret: webhookSecret,
        update_offset: 0,
      },
      { onConflict: "channel_id" },
    );
  if (secretError)
    return createErrorResponse(500, "Could not save the channel");

  const base = webhookBase();
  try {
    if (base) {
      await setWebhook(
        `${base}/telegram_webhook?channel=${channel.id}`,
        webhookSecret,
        context,
      );
    } else {
      await deleteWebhook(context);
    }
  } catch {
    return createErrorResponse(502, "webhook_failed");
  }
  return jsonResponse({ username, mode: base ? "webhook" : "polling" });
}

async function disconnect(businessId: string) {
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id, channel_secrets(bot_token)")
    .eq("business_id", businessId)
    .eq("kind", "telegram")
    .maybeSingle();
  if (!channel) return jsonResponse({ ok: true });
  const secrets = Array.isArray(channel.channel_secrets)
    ? channel.channel_secrets[0]
    : channel.channel_secrets;
  if (secrets?.bot_token) {
    await deleteWebhook({
      fetch,
      settings: { botToken: secrets.bot_token },
    }).catch(() => null);
  }
  // Conversations stay in the chat center; only the bot and its token go
  await supabaseAdmin
    .from("channel_secrets")
    .delete()
    .eq("channel_id", channel.id);
  await supabaseAdmin
    .from("channels")
    .update({ enabled: false })
    .eq("id", channel.id);
  return jsonResponse({ ok: true });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        const context = user ? await getBusinessContext(user.id) : null;
        if (!context || context.role !== "owner") {
          return createErrorResponse(403, "Only the owner connects channels");
        }
        if (req.method === "POST") return connect(req, context.business_id);
        if (req.method === "DELETE") return disconnect(context.business_id);
        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
