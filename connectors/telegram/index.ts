import { fetchWithTimeout, type ConnectorContext } from "../types.ts";

/**
 * Telegram Bot API (TZ section 5.2): each business connects its own bot, made
 * with @BotFather. The token is a secret the caller passes in the context
 * settings (botToken); it is never written into errors or logs.
 *
 * Only the calls the CRM needs: check a token, receive updates (webhook or,
 * on a developer machine without a public address, polling), send messages
 * with buttons.
 */

export const TELEGRAM_API_URL = "https://api.telegram.org";

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
  contact?: { phone_number: string; first_name: string; user_id?: number };
  reply_markup?: { inline_keyboard?: InlineButton[][] };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export type ReplyMarkup =
  | { inline_keyboard: InlineButton[][] }
  | {
      keyboard: { text: string; request_contact?: boolean }[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    }
  | { remove_keyboard: true };

/** A refused call: Telegram's description, never the token. */
export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    description: string,
  ) {
    super(`Telegram ${method} failed (${code}): ${description}`);
    this.name = "TelegramError";
  }
}

/** A bot token as @BotFather gives it: "123456789:AA..." */
export const isBotToken = (value: unknown): value is string =>
  typeof value === "string" && /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/.test(value);

export async function callTelegram<T>(
  method: string,
  params: Record<string, unknown>,
  context: ConnectorContext,
): Promise<T> {
  const token = context.settings?.botToken;
  if (!isBotToken(token)) {
    throw new TelegramError(method, 0, "no valid bot token");
  }
  let response: Response;
  try {
    response = await fetchWithTimeout(
      context,
      `${TELEGRAM_API_URL}/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );
  } catch (error) {
    throw new TelegramError(
      method,
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  const answer = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
    error_code?: number;
  } | null;
  if (!answer?.ok) {
    throw new TelegramError(
      method,
      answer?.error_code ?? response.status,
      answer?.description ?? "no answer",
    );
  }
  return answer.result as T;
}

export const getMe = (context: ConnectorContext) =>
  callTelegram<TelegramUser>("getMe", {}, context);

export const sendMessage = (
  chatId: string | number,
  text: string,
  replyMarkup: ReplyMarkup | undefined,
  context: ConnectorContext,
) =>
  callTelegram<TelegramMessage>(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
    context,
  );

export const answerCallbackQuery = (id: string, context: ConnectorContext) =>
  callTelegram<boolean>(
    "answerCallbackQuery",
    { callback_query_id: id },
    context,
  );

/** Updates after an offset, without waiting (polling on a developer machine). */
export const getUpdates = (offset: number, context: ConnectorContext) =>
  callTelegram<TelegramUpdate[]>(
    "getUpdates",
    { offset, timeout: 0, allowed_updates: ["message", "callback_query"] },
    context,
  );

/** Telegram will POST each update to the url with the secret in a header. */
export const setWebhook = (
  url: string,
  secretToken: string,
  context: ConnectorContext,
) =>
  callTelegram<boolean>(
    "setWebhook",
    {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
    },
    context,
  );

export const deleteWebhook = (context: ConnectorContext) =>
  callTelegram<boolean>("deleteWebhook", {}, context);

/** Header Telegram sends with every webhook delivery. */
export const WEBHOOK_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
