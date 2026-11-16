import { HttpError, type Identifier } from "ra-core";

import { getSupabaseClient } from "./supabase";

export interface TelegramConnection {
  username: string;
  /** webhook on a server with a public address, polling on a developer machine */
  mode: "webhook" | "polling";
}

export type ReminderResult = "sent" | "no_chat" | "failed";

/** The message of a refused function call, as the function wrote it. */
const reasonOf = async (error: unknown): Promise<string> => {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    const body = await context.json().catch(() => null);
    if (body?.message) return String(body.message);
  }
  return error instanceof Error ? error.message : "failed";
};

export const invoke = async <T>(
  name: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke<T>(name, {
    method,
    body,
  });
  if (error || data == null) {
    const reason = await reasonOf(error);
    throw new HttpError(reason, 400, { message: reason });
  }
  return data;
};

/** Channels and the chat center (TZ section 5.2), through the server. */
export const channelMethods = {
  /** Checks a bot token with Telegram and connects the bot to the business. */
  connectTelegram(token: string): Promise<TelegramConnection> {
    return invoke<TelegramConnection>("telegram_connect", "POST", { token });
  },

  async disconnectTelegram(): Promise<void> {
    await invoke("telegram_connect", "DELETE");
  },

  /** Sends an answer to the client of a conversation through its channel. */
  sendChatMessage(
    conversationId: Identifier,
    text: string,
  ): Promise<{ status: "sent" | "failed"; error?: string }> {
    return invoke("chat_send", "POST", {
      conversation_id: conversationId,
      text,
    });
  },

  /** Sends a reminder of a booking to the client's Telegram chat now. */
  async sendBookingReminder(bookingId: Identifier): Promise<ReminderResult> {
    const { result } = await invoke<{ result: ReminderResult }>(
      "booking_reminders",
      "POST",
      { booking_id: bookingId },
    );
    return result;
  },
};
