import { supabaseAdmin } from "../supabaseAdmin.ts";
import type {
  Choice,
  InboundEvent,
  MessengerKind,
} from "../../../../connectors/messaging.ts";
import { getProfileName } from "../../../../connectors/meta/index.ts";
import { runBookingFlow, type BotState } from "../bot/bookingFlow.ts";
import { bodyOf, botInputOf } from "./inboundInput.ts";
import { botLanguageOf, botText, isStopWord } from "../bot/botTexts.ts";
import { loadBusiness, makeBookingDeps } from "./bookingDeps.ts";
import {
  CONVERSATION_COLUMNS,
  choicesOf,
  deliverText,
  insertMessage,
  type ChannelRow,
  type ConversationRow,
} from "./delivery.ts";

/**
 * One message or button press of a client in Instagram, Messenger, WhatsApp
 * or Viber: recorded once, answered by the booking dialog, and kept in the
 * chat center with the bot's replies, the same way as a Telegram update
 * (telegramUpdates.ts). A repeated delivery of the same event does nothing.
 */

type MessengerChannel = ChannelRow & { kind: MessengerKind };
type Conversation = ConversationRow & { reply_choices: Choice[] };

const COLUMNS = `${CONVERSATION_COLUMNS}, reply_choices`;

/** The client a new chat belongs to, when the CRM already knows them. */
const knownClient = async (
  channel: MessengerChannel,
  event: InboundEvent,
  username: string | null,
): Promise<number | null> => {
  if (event.phone) {
    const { data, error } = await supabaseAdmin.rpc("find_client_by_phone", {
      p_business_id: channel.business_id,
      p_phone: event.phone,
    });
    if (error) throw error;
    if (data != null) return data as number;
  }
  if (username) {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("business_id", channel.business_id)
      .ilike("instagram", username.replace(/[%_\\]/g, "\\$&"))
      .order("id")
      .limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0].id as number;
  }
  return null;
};

const findOrOpenConversation = async (
  channel: MessengerChannel,
  event: InboundEvent,
  accessToken: string,
): Promise<Conversation> => {
  const { data: existing, error } = await supabaseAdmin
    .from("conversations")
    .select(COLUMNS)
    .eq("channel_id", channel.id)
    .eq("external_id", event.chatId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as unknown as Conversation;

  // Instagram and Messenger send an id only: the name is asked once
  const profile =
    channel.kind === "instagram" || channel.kind === "messenger"
      ? await getProfileName(channel.kind, event.chatId, {
          fetch,
          settings: { access_token: accessToken },
        })
      : { name: null, username: null };
  const title =
    event.senderName ??
    profile.name ??
    (profile.username ? `@${profile.username}` : null);
  const { data: created, error: createError } = await supabaseAdmin
    .from("conversations")
    .upsert(
      {
        business_id: channel.business_id,
        channel_id: channel.id,
        external_id: event.chatId,
        title: title?.slice(0, 200) ?? null,
        phone: event.phone,
        client_id: await knownClient(channel, event, profile.username),
        language: botLanguageOf(event.language),
      },
      { onConflict: "channel_id,external_id" },
    )
    .select(COLUMNS)
    .single();
  if (createError) throw createError;
  return created as unknown as Conversation;
};

const answer = async (
  channel: MessengerChannel,
  event: InboundEvent,
  accessToken: string,
): Promise<void> => {
  const conversation = await findOrOpenConversation(
    channel,
    event,
    accessToken,
  );
  const { input, button } = botInputOf(event, conversation);
  const body = bodyOf(event, button);
  const isStop = input.kind === "text" && isStopWord(input.text);

  const business = await loadBusiness(channel.business_id);
  const result = isStop
    ? null
    : await runBookingFlow(
        input,
        {
          language: conversation.language,
          hasConsent: conversation.consent_at != null,
          clientId: conversation.client_id,
          phone: conversation.phone,
          title: conversation.title,
          isWaiting: conversation.waiting_since != null,
          state: conversation.bot_state as BotState,
        },
        makeBookingDeps(business, {
          source: channel.kind,
          conversationId: conversation.id,
        }),
      );

  // Recorded first: it opens the time in which the business may answer
  await insertMessage({
    business_id: channel.business_id,
    conversation_id: conversation.id,
    direction: "in",
    body,
    handled_by_bot: result?.handledByBot ?? true,
    external_id: event.eventId,
    status: "received",
    attachment: event.attachment
      ? { ...event.attachment, channel: channel.kind }
      : null,
  });

  const { error: updateError } = await supabaseAdmin
    .from("conversations")
    .update(
      result
        ? {
            bot_state: result.state,
            ...(result.consentGiven
              ? { consent_at: new Date().toISOString() }
              : {}),
            ...(result.phone ? { phone: result.phone } : {}),
            ...(result.clientId && conversation.client_id == null
              ? { client_id: result.clientId }
              : {}),
          }
        : { automations_off_at: new Date().toISOString() },
    )
    .eq("id", conversation.id);
  if (updateError) throw updateError;

  const replies = result
    ? result.replies
    : [{ text: botText(conversation.language, "auto_stopped") }];
  for (const reply of replies) {
    await deliverText(
      conversation,
      channel,
      // Only Telegram has a button that shares the number
      reply.askPhone
        ? botText(conversation.language, "ask_phone_typed")
        : reply.text,
      { buttons: choicesOf(reply) },
    );
  }
};

export const handleInboundEvent = async (
  channel: MessengerChannel,
  event: InboundEvent,
  accessToken: string,
): Promise<void> => {
  if (!channel.enabled) return;
  const { error: seenError } = await supabaseAdmin
    .from("channel_events")
    .insert({ channel_id: channel.id, event_id: event.eventId.slice(0, 500) });
  if (seenError?.code === "23505") return;
  if (seenError) throw seenError;
  try {
    await answer(channel, event, accessToken);
  } catch (error) {
    // Forget the event so that the messenger's retry processes it again
    await supabaseAdmin
      .from("channel_events")
      .delete()
      .eq("channel_id", channel.id)
      .eq("event_id", event.eventId.slice(0, 500));
    throw error;
  }
};
