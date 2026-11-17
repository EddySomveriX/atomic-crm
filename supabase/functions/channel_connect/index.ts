import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import {
  isMessengerKind,
  type MessengerKind,
} from "../../../connectors/messaging.ts";
import * as meta from "../../../connectors/meta/index.ts";
import * as viber from "../../../connectors/viber/index.ts";

/**
 * Connects a messenger of the current business to the chat center (owner).
 *
 * POST { kind, access_token, app_secret?, phone_number_id? }
 *   instagram: a token of the Instagram business account + the app secret;
 *   messenger: a Page access token + the app secret;
 *   whatsapp: a permanent token, the phone number id + the app secret;
 *   viber: the token of the bot.
 *   The token is checked with the messenger and kept on the server only.
 *   → { name, webhook_url, verify_token }: what the owner enters in the Meta
 *   app dashboard (Viber gets its webhook from the server itself);
 *   webhook_url is null while the server has no public address.
 * DELETE { kind }: disconnects the messenger and forgets its secrets;
 *   conversations stay in the chat center.
 * Errors: invalid_input, token_refused, webhook_failed.
 */

/** A long-lived Instagram token lives 60 days; it is refreshed before it ends */
const INSTAGRAM_TOKEN_DAYS = 60;

const webhookBase = () => {
  const base =
    Deno.env.get("WEBHOOK_BASE_URL") ??
    Deno.env.get("TELEGRAM_WEBHOOK_BASE_URL") ??
    "";
  return base.startsWith("https://") ? base.replace(/\/$/, "") : null;
};

const randomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const isSecret = (value: unknown, max = 1000): value is string =>
  typeof value === "string" &&
  value.trim().length >= 20 &&
  value.trim().length <= max &&
  !/\s/.test(value.trim());

async function connect(req: Request, businessId: string) {
  let payload: {
    kind?: unknown;
    access_token?: unknown;
    app_secret?: unknown;
    phone_number_id?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "invalid_input");
  }
  const { kind } = payload;
  if (!isMessengerKind(kind) || !isSecret(payload.access_token)) {
    return createErrorResponse(400, "invalid_input");
  }
  const token = payload.access_token.trim();
  const isMeta = kind !== "viber";
  if (isMeta && !isSecret(payload.app_secret, 200)) {
    return createErrorResponse(400, "invalid_input");
  }
  const phoneNumberId =
    typeof payload.phone_number_id === "string"
      ? payload.phone_number_id.trim()
      : "";
  if (kind === "whatsapp" && !/^\d{5,30}$/.test(phoneNumberId)) {
    return createErrorResponse(400, "invalid_input");
  }

  const context = { fetch, settings: { access_token: token } };
  let account: { id: string; name: string };
  try {
    account =
      kind === "viber"
        ? await viber.getAccount(context)
        : await meta.getAccount(kind, context, phoneNumberId);
  } catch {
    return createErrorResponse(400, "token_refused");
  }

  const { data: channel, error } = await supabaseAdmin
    .from("channels")
    .upsert(
      {
        business_id: businessId,
        kind,
        name: account.name.slice(0, 100),
        external_id: account.id || null,
        enabled: true,
      },
      { onConflict: "business_id,kind" },
    )
    .select("id")
    .single();
  if (error) return createErrorResponse(500, "Could not save the channel");

  const verifyToken = isMeta ? randomSecret() : null;
  const now = new Date();
  const { error: secretError } = await supabaseAdmin
    .from("channel_secrets")
    .upsert(
      {
        channel_id: channel.id,
        access_token: token,
        app_secret: isMeta ? (payload.app_secret as string).trim() : null,
        verify_token: verifyToken,
        token_expires_at:
          kind === "instagram"
            ? new Date(
                now.getTime() + INSTAGRAM_TOKEN_DAYS * 24 * 3600 * 1000,
              ).toISOString()
            : null,
        refreshed_at: now.toISOString(),
      },
      { onConflict: "channel_id" },
    );
  if (secretError) {
    return createErrorResponse(500, "Could not save the channel");
  }

  const base = webhookBase();
  const webhookUrl = base
    ? `${base}/channel_webhook?channel=${channel.id}`
    : null;
  if (kind === "viber" && webhookUrl) {
    try {
      await viber.setWebhook(webhookUrl, context);
    } catch {
      return createErrorResponse(502, "webhook_failed");
    }
  }
  return jsonResponse({
    name: account.name,
    webhook_url: webhookUrl,
    verify_token: verifyToken,
  });
}

async function disconnect(req: Request, businessId: string) {
  const payload = (await req.json().catch(() => null)) as {
    kind?: unknown;
  } | null;
  if (!isMessengerKind(payload?.kind)) {
    return createErrorResponse(400, "invalid_input");
  }
  const kind: MessengerKind = payload.kind;
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id, channel_secrets(access_token)")
    .eq("business_id", businessId)
    .eq("kind", kind)
    .maybeSingle();
  if (!channel) return jsonResponse({ ok: true });
  const secrets = Array.isArray(channel.channel_secrets)
    ? channel.channel_secrets[0]
    : channel.channel_secrets;
  if (kind === "viber" && secrets?.access_token) {
    await viber
      .setWebhook("", {
        fetch,
        settings: { access_token: secrets.access_token },
      })
      .catch(() => null);
  }
  // Conversations stay in the chat center; only the secrets go
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
        if (req.method === "DELETE") {
          return disconnect(req, context.business_id);
        }
        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
