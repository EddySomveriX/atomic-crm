import { supabaseAdmin } from "../supabaseAdmin.ts";
import { botText, formatWhen } from "../bot/botTexts.ts";
import {
  CONVERSATION_COLUMNS,
  deliverText,
  type ChannelRow,
  type ConversationRow,
} from "./delivery.ts";

export type ReminderKind = "24h" | "2h" | "now";

const TEXT_KEYS = {
  "24h": "reminder_24h",
  "2h": "reminder_2h",
  now: "reminder_now",
} as const;

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/**
 * Sends a reminder of a booking to the client's chat (TZ section 5.3:
 * 24 hours and 2 hours before). "no_chat" when the client has no Telegram
 * chat with the business or the bot is disconnected.
 */
export const sendBookingReminder = async (
  bookingId: number,
  kind: ReminderKind,
  conversationId: number | null,
): Promise<"sent" | "no_chat" | "failed"> => {
  if (conversationId == null) return "no_chat";
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, starts_at, products(name), sales(first_name, last_name), businesses(timezone)",
    )
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("conversations")
    .select(`${CONVERSATION_COLUMNS}, channels(kind, enabled)`)
    .eq("id", conversationId)
    .single();
  if (conversationError) throw conversationError;
  const channel = one(
    conversation.channels as unknown as Pick<ChannelRow, "kind" | "enabled">,
  );
  if (!channel || channel.kind === "widget" || !channel.enabled) {
    return "no_chat";
  }

  const product = one(booking.products as unknown as { name: string });
  const specialist = one(
    booking.sales as unknown as { first_name: string; last_name: string },
  );
  const business = one(booking.businesses as unknown as { timezone: string });
  const row = conversation as unknown as ConversationRow;
  const text = botText(row.language, TEXT_KEYS[kind], {
    service: product?.name ?? "",
    when: formatWhen(
      new Date(booking.starts_at),
      business?.timezone ?? "Europe/Kyiv",
      row.language,
    ),
    specialist:
      `${specialist?.first_name ?? ""} ${specialist?.last_name ?? ""}`.trim(),
  });
  // The day-before reminder asks for an answer: come, move or cancel
  const replyMarkup =
    kind === "2h"
      ? undefined
      : {
          inline_keyboard: [
            [
              {
                text: botText(row.language, "confirm_visit_button"),
                callback_data: `cnf:${bookingId}`,
              },
            ],
            [
              {
                text: botText(row.language, "reschedule_button"),
                callback_data: `rsc:${bookingId}`,
              },
              {
                text: botText(row.language, "cancel_booking_button"),
                callback_data: `cnl:${bookingId}`,
              },
            ],
          ],
        };
  const result = await deliverText(row, channel, text, { replyMarkup });
  return result.status === "sent" ? "sent" : "failed";
};
