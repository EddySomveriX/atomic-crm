import { fetchWithTimeout, type ConnectorContext } from "../types.ts";

/**
 * Telegram Bot API (TZ section 5.2): each business connects its own bot, made
 * with @BotFather. The token is a secret the caller passes in the context
 * settings (botToken); it is never written into errors or logs.
 *
 * Only the calls the CRM needs: check a token, receive updates (webhook or,
 * on a developer machine without a public address, polling), send messages
 * with buttons, send a file and download a file a client sent.
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
  caption?: string;
  document?: TelegramFileRef & { file_name?: string; mime_type?: string };
  /** Sizes of one photo, the largest last */
  photo?: (TelegramFileRef & { width: number; height: number })[];
  reply_markup?: { inline_keyboard?: InlineButton[][] };
}

export interface TelegramFileRef {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
}

/** The largest file a bot downloads (Bot API limit). */
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

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
    readonly description: string,
  ) {
    super(`Telegram ${method} failed (${code}): ${description}`);
    this.name = "TelegramError";
  }
}

/** A bot token as @BotFather gives it: "123456789:AA..." */
export const isBotToken = (value: unknown): value is string =>
  typeof value === "string" && /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/.test(value);

const tokenOf = (method: string, context: ConnectorContext): string => {
  const token = context.settings?.botToken;
  if (!isBotToken(token)) {
    throw new TelegramError(method, 0, "no valid bot token");
  }
  return token;
};

export async function callTelegram<T>(
  method: string,
  params: Record<string, unknown> | FormData,
  context: ConnectorContext,
): Promise<T> {
  const token = tokenOf(method, context);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      context,
      `${TELEGRAM_API_URL}/bot${token}/${method}`,
      params instanceof FormData
        ? { method: "POST", body: params }
        : {
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

/** Sends a file with a caption (up to 50 MB, Bot API limit). */
export const sendDocument = (
  chatId: string | number,
  file: Blob,
  fileName: string,
  caption: string | undefined,
  context: ConnectorContext,
) => {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", file, fileName);
  if (caption) form.append("caption", caption.slice(0, 1024));
  return callTelegram<TelegramMessage>("sendDocument", form, context);
};

/**
 * Downloads a file a client sent: asks Telegram where it lies, then fetches
 * it. Files over 20 MB cannot be downloaded by a bot.
 */
export const downloadFile = async (
  fileId: string,
  context: ConnectorContext,
): Promise<Blob> => {
  const file = await callTelegram<{ file_path?: string; file_size?: number }>(
    "getFile",
    { file_id: fileId },
    context,
  );
  if (!file.file_path) {
    throw new TelegramError("getFile", 0, "the file is not available");
  }
  if ((file.file_size ?? 0) > MAX_DOWNLOAD_BYTES) {
    throw new TelegramError("getFile", 0, "the file is over 20 MB");
  }
  const token = tokenOf("getFile", context);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      context,
      `${TELEGRAM_API_URL}/file/bot${token}/${file.file_path}`,
    );
  } catch (error) {
    throw new TelegramError(
      "getFile",
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  if (!response.ok) {
    throw new TelegramError("getFile", response.status, "download failed");
  }
  return await response.blob();
};

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

/** A chat the bot can see: a channel by its @username or id. */
export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export const getChat = (chatId: string | number, context: ConnectorContext) =>
  callTelegram<TelegramChat>("getChat", { chat_id: chatId }, context);

/** The bot's rights in a chat: posting to a channel needs can_post_messages. */
export const getChatMember = (
  chatId: string | number,
  userId: number,
  context: ConnectorContext,
) =>
  callTelegram<{ status: string; can_post_messages?: boolean }>(
    "getChatMember",
    { chat_id: chatId, user_id: userId },
    context,
  );

export interface ChannelMedia {
  file: Blob;
  fileName: string;
  isVideo: boolean;
}

/** Caption limit of a photo or video in Telegram */
export const MAX_MEDIA_CAPTION = 1024;
export const MAX_TEXT_LENGTH = 4096;

/**
 * Posts to a channel: a text, one photo or video with a caption, or an album
 * of up to 10. A text longer than a caption is sent as its own message after
 * the media. Returns the id of the first message.
 */
export const postToChannel = async (
  chatId: string | number,
  text: string,
  media: ChannelMedia[],
  context: ConnectorContext,
): Promise<number> => {
  const fitsCaption = text.length <= MAX_MEDIA_CAPTION;
  const caption = fitsCaption ? text : "";
  let firstId: number;
  if (media.length === 0) {
    const sent = await sendMessage(
      chatId,
      text.slice(0, MAX_TEXT_LENGTH),
      undefined,
      context,
    );
    return sent.message_id;
  }
  if (media.length === 1) {
    const [item] = media;
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(item.isVideo ? "video" : "photo", item.file, item.fileName);
    if (caption) form.append("caption", caption);
    const sent = await callTelegram<TelegramMessage>(
      item.isVideo ? "sendVideo" : "sendPhoto",
      form,
      context,
    );
    firstId = sent.message_id;
  } else {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    const items = media.slice(0, 10).map((item, index) => {
      const name = `file${index}`;
      form.append(name, item.file, item.fileName);
      return {
        type: item.isVideo ? "video" : "photo",
        media: `attach://${name}`,
        ...(index === 0 && caption ? { caption } : {}),
      };
    });
    form.append("media", JSON.stringify(items));
    const sent = await callTelegram<TelegramMessage[]>(
      "sendMediaGroup",
      form,
      context,
    );
    firstId = sent[0].message_id;
  }
  if (!fitsCaption) {
    await sendMessage(
      chatId,
      text.slice(0, MAX_TEXT_LENGTH),
      undefined,
      context,
    );
  }
  return firstId;
};
