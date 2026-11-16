import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getBusinessContext } from "../_shared/businessContext.ts";
import { jsonResponse } from "../_shared/channels/http.ts";
import { loadBotToken } from "../_shared/channels/delivery.ts";
import {
  getChat,
  getChatMember,
  getMe as getBot,
} from "../../../connectors/telegram/index.ts";
import { getMe as getInstagramAccount } from "../../../connectors/instagram/index.ts";

/**
 * Connects a marketing account of the current business (owner or manager).
 *
 * POST { kind: "telegram_channel", channel: "@salon_news" }: the business bot
 *   must be an administrator of the channel allowed to post.
 * POST { kind: "instagram", access_token }: a long-lived token of an
 *   Instagram business or creator account (made in the Meta app dashboard);
 *   checked with Instagram and kept on the server only (marketing_secrets).
 * → { name } or an error code: no_bot, channel_not_found, bot_not_admin,
 *   token_refused, invalid_input.
 */

/** A long-lived Instagram token lives 60 days; refreshed before it ends. */
const TOKEN_DAYS = 60;

const saveAccount = async (
  businessId: string,
  kind: "telegram_channel" | "instagram",
  name: string,
  externalId: string,
) => {
  const { data, error } = await supabaseAdmin
    .from("marketing_accounts")
    .upsert(
      {
        business_id: businessId,
        kind,
        name,
        external_id: externalId,
        enabled: true,
      },
      { onConflict: "business_id,kind,external_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
};

async function connectChannel(businessId: string, channel: string) {
  const { data: botChannel } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("business_id", businessId)
    .eq("kind", "telegram")
    .eq("enabled", true)
    .maybeSingle();
  const token = botChannel ? await loadBotToken(botChannel.id) : null;
  if (!token) return createErrorResponse(400, "no_bot");
  const context = { fetch, settings: { botToken: token } };
  const chatRef = /^-?\d+$/.test(channel)
    ? channel
    : `@${channel.replace(/^@|^https?:\/\/t\.me\//, "")}`;
  let chat;
  try {
    chat = await getChat(chatRef, context);
  } catch {
    return createErrorResponse(400, "channel_not_found");
  }
  try {
    const bot = await getBot(context);
    const member = await getChatMember(chat.id, bot.id, context);
    if (
      member.status !== "administrator" ||
      member.can_post_messages === false
    ) {
      return createErrorResponse(400, "bot_not_admin");
    }
  } catch {
    return createErrorResponse(400, "bot_not_admin");
  }
  const name = chat.username ? `@${chat.username}` : (chat.title ?? chatRef);
  await saveAccount(businessId, "telegram_channel", name, String(chat.id));
  return jsonResponse({ name });
}

async function connectInstagram(businessId: string, token: string) {
  let account;
  try {
    account = await getInstagramAccount({
      fetch,
      settings: { access_token: token },
    });
  } catch {
    return createErrorResponse(400, "token_refused");
  }
  const accountId = await saveAccount(
    businessId,
    "instagram",
    account.username,
    String(account.user_id),
  );
  const { error } = await supabaseAdmin.from("marketing_secrets").upsert(
    {
      account_id: accountId,
      access_token: token,
      token_expires_at: new Date(
        Date.now() + TOKEN_DAYS * 24 * 3600 * 1000,
      ).toISOString(),
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );
  if (error) return createErrorResponse(500, "Could not save the account");
  return jsonResponse({ name: account.username });
}

async function connect(req: Request, businessId: string) {
  let payload: { kind?: unknown; channel?: unknown; access_token?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "invalid_input");
  }
  if (
    payload.kind === "telegram_channel" &&
    typeof payload.channel === "string"
  ) {
    const channel = payload.channel.trim();
    if (!channel || channel.length > 200) {
      return createErrorResponse(400, "invalid_input");
    }
    return connectChannel(businessId, channel);
  }
  if (
    payload.kind === "instagram" &&
    typeof payload.access_token === "string"
  ) {
    const token = payload.access_token.trim();
    if (token.length < 20 || token.length > 1000 || /\s/.test(token)) {
      return createErrorResponse(400, "invalid_input");
    }
    return connectInstagram(businessId, token);
  }
  return createErrorResponse(400, "invalid_input");
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user?: User) => {
        const context = user ? await getBusinessContext(user.id) : null;
        if (!context || !["owner", "manager"].includes(context.role)) {
          return createErrorResponse(
            403,
            "Owners and managers connect accounts",
          );
        }
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await connect(req, context.business_id);
        } catch (failure) {
          console.error("marketing_connect failed:", failure);
          return createErrorResponse(500, "Could not save the account");
        }
      }),
    ),
  ),
);
