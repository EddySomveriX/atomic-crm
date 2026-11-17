import { fetchWithTimeout, type ConnectorContext } from "../types.ts";
import {
  hmacSha256Hex,
  sameSignature,
  type Choice,
  type InboundEvent,
} from "../messaging.ts";

/**
 * Viber bot (Viber REST Bot API). The token of the bot comes in
 * context.settings.access_token; it authorizes calls (X-Viber-Auth-Token)
 * and signs deliveries: X-Viber-Content-Signature is the HMAC-SHA256 of the
 * raw body with the token. Since 5 February 2024 Viber creates new bots on
 * commercial terms only, so a business brings the token of its paid bot.
 */

export const VIBER_API_URL = "https://chatapi.viber.com/pa";
export const SIGNATURE_HEADER = "X-Viber-Content-Signature";
/** Viber shows the name of the sender with every message: up to 28 characters */
export const MAX_SENDER_NAME = 28;

export class ViberError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
  ) {
    super(`Viber ${method} failed (${status}): ${description}`);
    this.name = "ViberError";
  }
}

export const verifySignature = async (
  rawBody: string,
  header: string | null,
  token: string | null | undefined,
): Promise<boolean> => {
  if (!header || !token) return false;
  return sameSignature(
    header.toLowerCase(),
    await hmacSha256Hex(token, rawBody),
  );
};

async function callViber<
  T extends { status?: number; status_message?: string },
>(
  method: string,
  body: Record<string, unknown>,
  context: ConnectorContext,
): Promise<T> {
  const token = context.settings?.access_token;
  if (!token || token.length < 20) {
    throw new ViberError(method, 0, "no bot token");
  }
  let response: Response;
  try {
    response = await fetchWithTimeout(context, `${VIBER_API_URL}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Viber-Auth-Token": token,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ViberError(
      method,
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  const answer = (await response.json().catch(() => null)) as T | null;
  // Viber answers 200 with its own status: 0 is success
  if (!response.ok || !answer || answer.status !== 0) {
    throw new ViberError(
      method,
      answer?.status ?? response.status,
      answer?.status_message ?? "no answer",
    );
  }
  return answer;
}

/** The bot a token opens. */
export const getAccount = async (
  context: ConnectorContext,
): Promise<{ id: string; name: string }> => {
  const info = await callViber<{
    status?: number;
    status_message?: string;
    id?: string;
    name?: string;
    uri?: string;
  }>("get_account_info", {}, context);
  return {
    id: String(info.id ?? info.uri ?? ""),
    name: info.name ?? info.uri ?? "Viber",
  };
};

/** Viber will POST messages to the url; an empty url removes the webhook. */
export const setWebhook = (url: string, context: ConnectorContext) =>
  callViber(
    "set_webhook",
    url
      ? { url, event_types: ["message", "conversation_started"] }
      : { url: "" },
    context,
  );

/** Sends a text with a keyboard of reply buttons; returns the message token. */
export const sendText = async (
  {
    chatId,
    text,
    senderName,
    buttons = null,
  }: {
    chatId: string;
    text: string;
    /** Shown above the message: the name of the business */
    senderName: string;
    buttons?: Choice[] | null;
  },
  context: ConnectorContext,
): Promise<string | null> => {
  const answer = await callViber<{
    status?: number;
    status_message?: string;
    message_token?: number | string;
  }>(
    "send_message",
    {
      receiver: chatId,
      type: "text",
      text,
      sender: { name: senderName.slice(0, MAX_SENDER_NAME) || "CRM" },
      ...(buttons?.length
        ? {
            keyboard: {
              Type: "keyboard",
              DefaultHeight: false,
              Buttons: buttons.map((button) => ({
                ActionType: "reply",
                ActionBody: button.data,
                Text: button.label,
                Columns: buttons.length > 6 ? 3 : 6,
                Rows: 1,
              })),
            },
          }
        : {}),
    },
    context,
  );
  return answer.message_token != null ? String(answer.message_token) : null;
};

interface ViberCallback {
  event?: string;
  message_token?: number | string;
  sender?: { id?: string; name?: string; language?: string };
  user?: { id?: string; name?: string; language?: string };
  message?: {
    type?: string;
    text?: string;
    media?: string;
    file_name?: string;
    size?: number;
    contact?: { phone_number?: string; name?: string };
  };
}

/**
 * The client's message in a delivery; a pressed button arrives as a text
 * with the code of the button. Delivery and read marks give nothing.
 */
export const parseWebhook = (payload: unknown): InboundEvent[] => {
  const body = payload as ViberCallback | null;
  if (!body?.event) return [];
  if (body.event === "conversation_started" && body.user?.id) {
    return [
      {
        accountId: null,
        chatId: body.user.id,
        eventId: `started:${body.message_token ?? body.user.id}`,
        senderName: body.user.name ?? null,
        phone: null,
        language: body.user.language,
        text: "",
        isStart: true,
      },
    ];
  }
  if (body.event !== "message" || !body.sender?.id || !body.message) return [];
  const message = body.message;
  const base = {
    accountId: null,
    chatId: body.sender.id,
    eventId: String(body.message_token ?? ""),
    senderName: body.sender.name ?? null,
    phone: message.contact?.phone_number
      ? `+${message.contact.phone_number.replace(/\D/g, "")}`
      : null,
    language: body.sender.language,
  };
  if (!base.eventId) return [];
  if (message.type === "picture" && message.media) {
    return [
      {
        ...base,
        text: message.text ?? "",
        attachment: {
          kind: "photo",
          url: message.media,
          file_name: `photo-${base.eventId.slice(-12)}.jpg`,
          mime_type: "image/jpeg",
          size: message.size ?? null,
        },
      },
    ];
  }
  if (message.type === "file" && message.media) {
    return [
      {
        ...base,
        text: "",
        attachment: {
          kind: "document",
          url: message.media,
          file_name: (message.file_name ?? "file").slice(0, 255),
          mime_type: "application/octet-stream",
          size: message.size ?? null,
        },
      },
    ];
  }
  if (message.type === "contact" && base.phone) {
    return [{ ...base, text: base.phone }];
  }
  return [{ ...base, text: message.text ?? "" }];
};
