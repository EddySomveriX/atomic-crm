import { supabaseAdmin } from "../supabaseAdmin.ts";
import { botText } from "../bot/botTexts.ts";
import {
  WITH_BOOK_BUTTON,
  automationMessage,
  type AutomationKind,
} from "../bot/automationText.ts";
import {
  CONVERSATION_COLUMNS,
  deliverText,
  type ChannelRow,
  type ConversationRow,
} from "./delivery.ts";

/**
 * Automatic messages to clients (supabase/schemas/22_automations.sql): the
 * text of a claimed message, its buttons, and its delivery.
 */

export interface ClaimedAutomation {
  send_id: number;
  kind: AutomationKind;
  client_id: number | null;
  booking_id: number | null;
  conversation_id: number;
}

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/** Sends one claimed message and writes the outcome in its log row. */
export const sendClaimedAutomation = async (
  claimed: ClaimedAutomation,
): Promise<"sent" | "failed"> => {
  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `${CONVERSATION_COLUMNS}, channels(kind, enabled), businesses(name)`,
    )
    .eq("id", claimed.conversation_id)
    .single();
  if (error) throw error;
  const row = conversation as unknown as ConversationRow;
  const channel = one(
    conversation.channels as unknown as Pick<ChannelRow, "kind" | "enabled">,
  );
  const business = one(conversation.businesses as unknown as { name: string });

  const { data: automation } = await supabaseAdmin
    .from("automations")
    .select("custom_text, link")
    .eq("business_id", row.business_id)
    .eq("kind", claimed.kind)
    .maybeSingle();
  const { data: client } = claimed.client_id
    ? await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", claimed.client_id)
        .maybeSingle()
    : { data: null };
  const { data: booking } = claimed.booking_id
    ? await supabaseAdmin
        .from("bookings")
        .select("products(name, rebook_days)")
        .eq("id", claimed.booking_id)
        .maybeSingle()
    : { data: null };
  const product = one(
    (booking?.products ?? null) as unknown as {
      name: string;
      rebook_days: number | null;
    } | null,
  );

  const name = (row.title ?? client?.name ?? "").split(" ")[0] || "";
  const text = automationMessage(row.language, {
    kind: claimed.kind,
    customText: automation?.custom_text ?? null,
    link: claimed.kind === "review" ? (automation?.link ?? null) : null,
    values: {
      name,
      business: business?.name ?? "",
      service: product?.name ?? "",
      days: product?.rebook_days ?? "",
    },
  });

  let status: "sent" | "failed" = "failed";
  let failure: string | null = "the bot is off";
  if (channel?.kind === "telegram" && channel.enabled) {
    const result = await deliverText(row, channel, text, {
      replyMarkup: WITH_BOOK_BUTTON.includes(claimed.kind)
        ? {
            inline_keyboard: [
              [
                {
                  text: botText(row.language, "book_button"),
                  callback_data: "book",
                },
              ],
            ],
          }
        : undefined,
    });
    status = result.status;
    failure = result.error ?? null;
  }
  const { error: logError } = await supabaseAdmin
    .from("automation_sends")
    .update({
      status,
      error: failure,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", claimed.send_id);
  if (logError) throw logError;
  return status;
};
