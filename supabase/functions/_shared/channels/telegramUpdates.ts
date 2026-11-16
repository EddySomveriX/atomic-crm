import { supabaseAdmin } from "../supabaseAdmin.ts";
import {
  answerCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
  type TelegramUser,
} from "../../../../connectors/telegram/index.ts";
import {
  runBookingFlow,
  type BotInput,
  type BotState,
} from "../bot/bookingFlow.ts";
import { botLanguageOf, botText } from "../bot/botTexts.ts";
import { loadBusiness, makeBookingDeps } from "./bookingDeps.ts";
import {
  CONVERSATION_COLUMNS,
  deliverText,
  insertMessage,
  toReplyMarkup,
  type ChannelRow,
  type ConversationRow,
} from "./delivery.ts";

const nameOf = (user: TelegramUser | undefined): string | null =>
  user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      null
    : null;

interface ParsedUpdate {
  chatId: string;
  from: TelegramUser | undefined;
  input: BotInput;
  /** What the client sent, as text for the chat center */
  body: string;
  externalId: string;
  callbackId?: string;
  /** A file or photo the client sent, kept until a member saves it */
  attachment?: ChatAttachment;
}

/** A file of a Telegram message, as messages.attachment keeps it. */
export interface ChatAttachment {
  kind: "document" | "photo";
  file_id: string;
  file_name: string;
  mime_type: string;
  size: number | null;
}

const attachmentOf = (message: TelegramMessage): ChatAttachment | null => {
  if (message.document) {
    return {
      kind: "document",
      file_id: message.document.file_id,
      file_name: (message.document.file_name ?? "file").slice(0, 255),
      mime_type: message.document.mime_type ?? "application/octet-stream",
      size: message.document.file_size ?? null,
    };
  }
  const photo = message.photo?.at(-1);
  if (photo) {
    return {
      kind: "photo",
      file_id: photo.file_id,
      file_name: `photo-${message.message_id}.jpg`,
      mime_type: "image/jpeg",
      size: photo.file_size ?? null,
    };
  }
  return null;
};

/** The client's input in an update, or null for updates the CRM ignores. */
export const parseUpdate = (update: TelegramUpdate): ParsedUpdate | null => {
  const callback = update.callback_query;
  if (callback?.message && callback.data) {
    const label =
      callback.message.reply_markup?.inline_keyboard
        ?.flat()
        .find((button) => button.callback_data === callback.data)?.text ??
      callback.data;
    return {
      chatId: String(callback.message.chat.id),
      from: callback.from,
      input: { kind: "button", data: callback.data },
      body: `[${label}]`,
      externalId: `callback:${callback.id}`,
      callbackId: callback.id,
    };
  }
  const message = update.message;
  if (!message || message.chat.type !== "private") return null;
  const base = {
    chatId: String(message.chat.id),
    from: message.from,
    externalId: String(message.message_id),
  };
  if (message.contact) {
    return {
      ...base,
      input: {
        kind: "contact",
        phone: message.contact.phone_number,
        name: message.contact.first_name,
      },
      body: message.contact.phone_number,
    };
  }
  if (message.text?.startsWith("/start")) {
    return { ...base, input: { kind: "start" }, body: message.text };
  }
  if (message.text) {
    return {
      ...base,
      input: { kind: "text", text: message.text },
      body: message.text,
    };
  }
  // Files and photos reach a person, who may save them to the documents
  // (recognition of their fields comes with stage 5); stickers just reach a person
  const attachment = attachmentOf(message);
  if (attachment) {
    const caption = message.caption?.trim() ?? "";
    const label =
      attachment.kind === "photo"
        ? "[photo]"
        : `[file] ${attachment.file_name}`;
    return {
      ...base,
      input: { kind: "text", text: caption },
      body: caption
        ? `${label}
${caption}`
        : label,
      attachment,
    };
  }
  return { ...base, input: { kind: "text", text: "" }, body: "[attachment]" };
};

const findOrOpenConversation = async (
  channel: ChannelRow,
  parsed: ParsedUpdate,
): Promise<ConversationRow> => {
  const { data: existing, error } = await supabaseAdmin
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("channel_id", channel.id)
    .eq("external_id", parsed.chatId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as ConversationRow;
  const { data: created, error: createError } = await supabaseAdmin
    .from("conversations")
    .upsert(
      {
        business_id: channel.business_id,
        channel_id: channel.id,
        external_id: parsed.chatId,
        title: nameOf(parsed.from),
        language: botLanguageOf(parsed.from?.language_code),
      },
      { onConflict: "channel_id,external_id" },
    )
    .select(CONVERSATION_COLUMNS)
    .single();
  if (createError) throw createError;
  return created as ConversationRow;
};

/**
 * One Telegram update of a business bot (TZ section 5.2): recorded once,
 * answered by the booking dialog, and kept in the chat center with the
 * bot's replies. A repeated delivery of the same update does nothing.
 */
export const handleTelegramUpdate = async (
  channel: ChannelRow,
  botToken: string,
  update: TelegramUpdate,
): Promise<void> => {
  const { error: seenError } = await supabaseAdmin
    .from("channel_events")
    .insert({ channel_id: channel.id, event_id: String(update.update_id) });
  if (seenError?.code === "23505") return;
  if (seenError) throw seenError;

  try {
    await answerUpdate(channel, botToken, update);
  } catch (error) {
    // Forget the update so that Telegram's retry processes it again
    await supabaseAdmin
      .from("channel_events")
      .delete()
      .eq("channel_id", channel.id)
      .eq("event_id", String(update.update_id));
    throw error;
  }
};

const answerUpdate = async (
  channel: ChannelRow,
  botToken: string,
  update: TelegramUpdate,
): Promise<void> => {
  const parsed = parseUpdate(update);
  if (!parsed || !channel.enabled) return;
  const context = { fetch, settings: { botToken } };
  if (parsed.callbackId) {
    // Stops the spinner on the button; a failure here changes nothing else
    await answerCallbackQuery(parsed.callbackId, context).catch(() => null);
  }

  const conversation = await findOrOpenConversation(channel, parsed);
  const business = await loadBusiness(channel.business_id);
  const deps = makeBookingDeps(business, {
    source: "telegram",
    conversationId: conversation.id,
  });
  const result = await runBookingFlow(
    parsed.input,
    {
      language: conversation.language,
      hasConsent: conversation.consent_at != null,
      clientId: conversation.client_id,
      phone: conversation.phone,
      title: conversation.title,
      isWaiting: conversation.waiting_since != null,
      state: conversation.bot_state as BotState,
    },
    deps,
  );

  await insertMessage({
    business_id: channel.business_id,
    conversation_id: conversation.id,
    direction: "in",
    body: parsed.body,
    handled_by_bot: result.handledByBot,
    external_id: parsed.externalId,
    status: "received",
    attachment: parsed.attachment ?? null,
  });

  const { error: updateError } = await supabaseAdmin
    .from("conversations")
    .update({
      bot_state: result.state,
      ...(result.consentGiven ? { consent_at: new Date().toISOString() } : {}),
      ...(result.phone ? { phone: result.phone } : {}),
      ...(result.clientId && conversation.client_id == null
        ? { client_id: result.clientId }
        : {}),
    })
    .eq("id", conversation.id);
  if (updateError) throw updateError;

  const phoneButton = botText(conversation.language, "phone_button");
  for (const reply of result.replies) {
    await deliverText(conversation, channel, reply.text, {
      replyMarkup: toReplyMarkup(reply, phoneButton),
      botToken,
    });
  }
};
