import { supabaseAdmin } from "../supabaseAdmin.ts";
import {
  sendMessage,
  type ReplyMarkup,
} from "../../../../connectors/telegram/index.ts";
import {
  MetaError,
  sendText as sendMetaText,
} from "../../../../connectors/meta/index.ts";
import { sendText as sendViberText } from "../../../../connectors/viber/index.ts";
import {
  isMessengerKind,
  renderReply,
  type Choice,
  type MessengerKind,
} from "../../../../connectors/messaging.ts";
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
  kind: "telegram" | "widget" | MessengerKind;
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
  attachment?: Record<string, unknown> | null;
  document_id?: number | null;
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

/** Hours Instagram, Messenger and WhatsApp let a business answer a client */
export const REPLY_WINDOW_HOURS = 24;
const WINDOWED: readonly string[] = ["instagram", "messenger", "whatsapp"];

/** Buttons of a bot reply as a flat list, for the messengers. */
export const choicesOf = (reply: BotReply): Choice[] =>
  (reply.buttons ?? []).flat().map((button) => ({
    data: button.data,
    label: button.text,
  }));

/**
 * Sends through Instagram, Messenger, WhatsApp or Viber. Refuses with
 * "window_closed" when Meta's 24 hours since the client's last message have
 * passed. Remembers the buttons it offered, so a typed answer is understood.
 */
const sendToMessenger = async (
  kind: MessengerKind,
  conversation: { id: number; channel_id: number; external_id: string },
  text: string,
  buttons: Choice[],
): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select(
      "last_inbound_at, channels(external_id, enabled, channel_secrets(access_token)), businesses(name)",
    )
    .eq("id", conversation.id)
    .single();
  if (error) throw error;
  const channel = one(
    data.channels as unknown as {
      external_id: string | null;
      enabled: boolean;
      channel_secrets:
        | { access_token: string | null }
        | { access_token: string | null }[]
        | null;
    },
  );
  const token = one(channel?.channel_secrets ?? null)?.access_token;
  if (!channel?.enabled || !token) throw new Error("channel_off");
  if (
    WINDOWED.includes(kind) &&
    !(
      data.last_inbound_at &&
      Date.now() - new Date(data.last_inbound_at).getTime() <
        REPLY_WINDOW_HOURS * 3600 * 1000
    )
  ) {
    throw new Error("window_closed");
  }
  const rendered = renderReply(kind, text, buttons);
  const context = { fetch, settings: { access_token: token } };
  const externalId =
    kind === "viber"
      ? await sendViberText(
          {
            chatId: conversation.external_id,
            text: rendered.text,
            senderName:
              one(data.businesses as unknown as { name: string })?.name ?? "",
            buttons: rendered.buttons,
          },
          context,
        )
      : await sendMetaText(
          {
            kind,
            accountId: channel.external_id ?? "",
            chatId: conversation.external_id,
            text: rendered.text,
            buttons: rendered.buttons,
          },
          context,
        );
  const { error: choicesError } = await supabaseAdmin
    .from("conversations")
    .update({ reply_choices: rendered.choices })
    .eq("id", conversation.id);
  if (choicesError) throw choicesError;
  return externalId;
};

/** Inline buttons written for Telegram, as a flat list for the messengers. */
const choicesOfMarkup = (markup: ReplyMarkup | undefined): Choice[] =>
  markup && "inline_keyboard" in markup
    ? markup.inline_keyboard
        .flat()
        .flatMap((button) =>
          button.callback_data
            ? [{ data: button.callback_data, label: button.text }]
            : [],
        )
    : [];

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/** Why a messenger refused, as a code the chat shows in plain words. */
const failureOf = (error: unknown): string => {
  if (error instanceof MetaError && error.code === 190) return "token_expired";
  if (error instanceof Error) return error.message;
  return "send failed";
};

/**
 * Sends a text to the client of a conversation through its channel and
 * records it. A message of Telegram or a messenger goes out at once; a
 * widget message waits for the visitor's page to fetch it. The message is
 * recorded as failed, with the reason, when the channel refuses it.
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
    /** Buttons for the messengers (Telegram takes replyMarkup) */
    buttons?: Choice[];
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
  } else if (isMessengerKind(channel.kind)) {
    try {
      externalId = await sendToMessenger(
        channel.kind,
        conversation,
        text,
        options.buttons ?? choicesOfMarkup(options.replyMarkup),
      );
    } catch (error) {
      status = "failed";
      failure = failureOf(error);
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
