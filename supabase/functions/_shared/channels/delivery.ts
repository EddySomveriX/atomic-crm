import { supabaseAdmin } from "../supabaseAdmin.ts";
import {
  sendMessage,
  type ReplyMarkup,
} from "../../../../connectors/telegram/index.ts";
import type { BotReply } from "../bot/bookingFlow.ts";

export interface ConversationRow {
  id: number;
  business_id: string;
  channel_id: number;
  external_id: string;
  title: string | null;
  phone: string | null;
  client_id: number | null;
  language: "uk" | "en";
  consent_at: string | null;
  waiting_since: string | null;
  bot_state: Record<string, unknown>;
}

export interface ChannelRow {
  id: number;
  business_id: string;
  kind: "telegram" | "widget";
  name: string | null;
  enabled: boolean;
}

export const CONVERSATION_COLUMNS =
  "id, business_id, channel_id, external_id, title, phone, client_id, language, consent_at, waiting_since, bot_state";

/** The bot token of a channel; null when the channel has none. Server only. */
export const loadBotToken = async (
  channelId: number,
): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("channel_secrets")
    .select("bot_token")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) throw error;
  return data?.bot_token ?? null;
};

/** Buttons of a reply as Telegram markup. */
export const toReplyMarkup = (
  reply: BotReply,
  phoneButtonText: string,
): ReplyMarkup | undefined => {
  if (reply.askPhone) {
    return {
      keyboard: [[{ text: phoneButtonText, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }
  if (reply.buttons?.length) {
    return {
      inline_keyboard: reply.buttons.map((row) =>
        row.map((button) => ({
          text: button.text,
          callback_data: button.data,
        })),
      ),
    };
  }
  return undefined;
};

export const insertMessage = async (message: {
  business_id: string;
  conversation_id: number;
  direction: "in" | "out";
  body: string;
  sales_id?: number | null;
  handled_by_bot?: boolean;
  external_id?: string | null;
  status: "received" | "pending" | "sent" | "failed";
  error?: string | null;
}): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({ ...message, body: message.body.slice(0, 4096) })
    .select("id")
    .single();
  // The same channel message delivered twice is stored once
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data.id as number;
};

/**
 * Sends a text to the client of a conversation through its channel and
 * records it. A Telegram message goes out at once; a widget message waits
 * for the visitor's page to fetch it. The message is recorded as failed,
 * with the reason, when Telegram refuses it.
 */
export const deliverText = async (
  conversation: Pick<
    ConversationRow,
    "id" | "business_id" | "channel_id" | "external_id"
  >,
  channel: Pick<ChannelRow, "kind">,
  text: string,
  options: {
    salesId?: number | null;
    replyMarkup?: ReplyMarkup;
    botToken?: string | null;
  } = {},
): Promise<{
  id: number | null;
  status: "sent" | "failed";
  error?: string;
}> => {
  let status: "sent" | "failed" = "sent";
  let externalId: string | null = null;
  let failure: string | undefined;
  if (channel.kind === "telegram") {
    const botToken =
      options.botToken ?? (await loadBotToken(conversation.channel_id));
    try {
      const sent = await sendMessage(
        conversation.external_id,
        text,
        options.replyMarkup,
        { fetch, settings: { botToken: botToken ?? undefined } },
      );
      externalId = String(sent.message_id);
    } catch (error) {
      status = "failed";
      failure = error instanceof Error ? error.message : "send failed";
    }
  }
  const id = await insertMessage({
    business_id: conversation.business_id,
    conversation_id: conversation.id,
    direction: "out",
    body: text,
    sales_id: options.salesId ?? null,
    external_id: externalId,
    status,
    error: failure ?? null,
  });
  return { id, status, error: failure };
};
