import { fetchWithTimeout, type ConnectorContext } from "../types.ts";
import {
  WHATSAPP_REPLY_BUTTONS,
  hmacSha256Hex,
  sameSignature,
  type Choice,
  type InboundAttachment,
  type InboundEvent,
} from "../messaging.ts";

/**
 * Messaging through Meta: Instagram Direct (Instagram API with Instagram
 * Login, graph.instagram.com), Facebook Messenger (a Page, graph.facebook.com)
 * and WhatsApp (Cloud API, graph.facebook.com). The three share the shape of
 * their deliveries and their signature: every POST carries
 * X-Hub-Signature-256, the HMAC-SHA256 of the raw body with the app secret.
 * The access token comes in context.settings.access_token and is never
 * written into errors or logs.
 */

export type MetaKind = "instagram" | "messenger" | "whatsapp";

export const META_API_VERSION = "v23.0";
export const SIGNATURE_HEADER = "X-Hub-Signature-256";

const HOSTS: Record<MetaKind, string> = {
  instagram: "https://graph.instagram.com",
  messenger: "https://graph.facebook.com",
  whatsapp: "https://graph.facebook.com",
};

export class MetaError extends Error {
  constructor(
    readonly step: string,
    readonly status: number,
    readonly description: string,
    /** 190: the token expired or was revoked */
    readonly code?: number,
  ) {
    super(`Meta ${step} failed (${status}): ${description}`);
    this.name = "MetaError";
  }
}

/** Whether a delivery was signed with the secret of the app. */
export const verifySignature = async (
  rawBody: string,
  header: string | null,
  appSecret: string | null | undefined,
): Promise<boolean> => {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = await hmacSha256Hex(appSecret, rawBody);
  return sameSignature(header.slice("sha256=".length).toLowerCase(), expected);
};

const tokenOf = (step: string, context: ConnectorContext): string => {
  const token = context.settings?.access_token;
  if (!token || token.length < 20) {
    throw new MetaError(step, 0, "no access token");
  }
  return token;
};

async function callMeta<T>(
  kind: MetaKind,
  step: string,
  path: string,
  context: ConnectorContext,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = tokenOf(step, context);
  const url = `${HOSTS[kind]}/${META_API_VERSION}${path}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(context, url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new MetaError(
      step,
      0,
      error instanceof Error ? error.name : "network error",
    );
  }
  const answer = (await response.json().catch(() => null)) as
    (T & { error?: { message?: string; code?: number } }) | null;
  if (!response.ok || !answer || answer.error) {
    throw new MetaError(
      step,
      response.status,
      answer?.error?.message ?? "no answer",
      answer?.error?.code,
    );
  }
  return answer;
}

/** The account a token opens: its id in the messenger and its name. */
export const getAccount = async (
  kind: MetaKind,
  context: ConnectorContext,
  /** WhatsApp: the id of the phone number, from the app dashboard */
  phoneNumberId?: string,
): Promise<{ id: string; name: string }> => {
  if (kind === "instagram") {
    const me = await callMeta<{ user_id: string; username: string }>(
      kind,
      "account",
      "/me?fields=user_id,username",
      context,
    );
    return { id: String(me.user_id), name: me.username };
  }
  if (kind === "messenger") {
    const page = await callMeta<{ id: string; name: string }>(
      kind,
      "account",
      "/me?fields=id,name",
      context,
    );
    return { id: String(page.id), name: page.name };
  }
  if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) {
    throw new MetaError("account", 0, "no phone number id");
  }
  const phone = await callMeta<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
  }>(
    kind,
    "account",
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    context,
  );
  return {
    id: String(phone.id),
    name: phone.display_phone_number ?? phone.verified_name ?? phoneNumberId,
  };
};

/** Name of a client who wrote in Instagram or Messenger; null when hidden. */
export const getProfileName = async (
  kind: "instagram" | "messenger",
  userId: string,
  context: ConnectorContext,
): Promise<{ name: string | null; username: string | null }> => {
  try {
    const profile = await callMeta<{
      name?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    }>(
      kind,
      "profile",
      kind === "instagram"
        ? `/${userId}?fields=name,username`
        : `/${userId}?fields=first_name,last_name`,
      context,
    );
    const name =
      profile.name ??
      ([profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        null);
    return { name: name || null, username: profile.username ?? null };
  } catch {
    return { name: null, username: null };
  }
};

const quickReplies = (buttons: Choice[]) =>
  buttons.map((button) => ({
    content_type: "text",
    title: button.label,
    payload: button.data,
  }));

const whatsappBody = (to: string, text: string, buttons: Choice[] | null) => {
  const base = { messaging_product: "whatsapp", to };
  if (!buttons?.length) {
    return { ...base, type: "text", text: { body: text } };
  }
  if (buttons.length <= WHATSAPP_REPLY_BUTTONS) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.map((button) => ({
            type: "reply",
            reply: { id: button.data, title: button.label },
          })),
        },
      },
    };
  }
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text },
      action: {
        button: "…",
        sections: [
          {
            rows: buttons.map((button) => ({
              id: button.data,
              title: button.label,
            })),
          },
        ],
      },
    },
  };
};

/**
 * Sends a text, with buttons when the messenger shows them (fit them with
 * renderReply first). Returns the id of the message in the messenger.
 */
export const sendText = async (
  {
    kind,
    accountId,
    chatId,
    text,
    buttons = null,
  }: {
    kind: MetaKind;
    /** Instagram user id, Page id or WhatsApp phone number id */
    accountId: string;
    chatId: string;
    text: string;
    buttons?: Choice[] | null;
  },
  context: ConnectorContext,
): Promise<string | null> => {
  if (kind === "whatsapp") {
    const answer = await callMeta<{ messages?: { id: string }[] }>(
      kind,
      "send",
      `/${accountId}/messages`,
      context,
      whatsappBody(chatId, text, buttons),
    );
    return answer.messages?.[0]?.id ?? null;
  }
  const answer = await callMeta<{ message_id?: string }>(
    kind,
    "send",
    `/${accountId}/messages`,
    context,
    {
      recipient: { id: chatId },
      ...(kind === "messenger" ? { messaging_type: "RESPONSE" } : {}),
      message: {
        text,
        ...(buttons?.length ? { quick_replies: quickReplies(buttons) } : {}),
      },
    },
  );
  return answer.message_id ?? null;
};

/** Where WhatsApp serves a media file for a few minutes (fetched with the token). */
export const whatsappMediaUrl = async (
  mediaId: string,
  context: ConnectorContext,
): Promise<string> => {
  const media = await callMeta<{ url?: string }>(
    "whatsapp",
    "media",
    `/${mediaId}`,
    context,
  );
  if (!media.url) throw new MetaError("media", 0, "the file is not available");
  return media.url;
};

/** A fresh long-lived Instagram token (60 days). */
export const refreshInstagramToken = async (
  context: ConnectorContext,
): Promise<{ access_token: string; expires_in: number }> => {
  const token = tokenOf("refresh", context);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      context,
      `${HOSTS.instagram}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    );
  } catch {
    throw new MetaError("refresh", 0, "network error");
  }
  const answer = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: number };
  } | null;
  if (!response.ok || !answer?.access_token) {
    throw new MetaError(
      "refresh",
      response.status,
      answer?.error?.message ?? "no answer",
      answer?.error?.code,
    );
  }
  return {
    access_token: answer.access_token,
    expires_in: answer.expires_in ?? 0,
  };
};

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

interface MessagingEntry {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
  postback?: { mid?: string; payload?: string; title?: string };
}

interface WhatsAppMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: {
    id?: string;
    mime_type?: string;
    filename?: string;
    caption?: string;
  };
}

interface WebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    messaging?: MessagingEntry[];
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WhatsAppMessage[];
      };
    }[];
  }[];
}

const OBJECTS: Record<MetaKind, string> = {
  instagram: "instagram",
  messenger: "page",
  whatsapp: "whatsapp_business_account",
};

const attachmentOf = (
  item: { type?: string; payload?: { url?: string } } | undefined,
  mid: string,
): InboundAttachment | undefined => {
  if (!item?.payload?.url) return undefined;
  const isPhoto = item.type === "image";
  return {
    kind: isPhoto ? "photo" : "document",
    url: item.payload.url,
    file_name: isPhoto
      ? `photo-${mid.slice(-12)}.jpg`
      : `file-${mid.slice(-12)}`,
    mime_type: isPhoto ? "image/jpeg" : "application/octet-stream",
    size: null,
  };
};

const fromMessaging = (
  accountId: string | null,
  item: MessagingEntry,
): InboundEvent | null => {
  const chatId = item.sender?.id;
  if (!chatId) return null;
  if (item.postback?.payload) {
    return {
      accountId,
      chatId,
      eventId: item.postback.mid ?? `postback:${chatId}:${item.timestamp}`,
      senderName: null,
      phone: null,
      text: item.postback.title ?? item.postback.payload,
      button: {
        data: item.postback.payload,
        label: item.postback.title ?? item.postback.payload,
      },
    };
  }
  const message = item.message;
  // An echo is the business's own message coming back
  if (!message?.mid || message.is_echo) return null;
  const text = message.text ?? "";
  return {
    accountId,
    chatId,
    eventId: message.mid,
    senderName: null,
    phone: null,
    text,
    ...(message.quick_reply?.payload
      ? { button: { data: message.quick_reply.payload, label: text } }
      : {}),
    attachment: attachmentOf(message.attachments?.[0], message.mid),
  };
};

const fromWhatsApp = (
  accountId: string | null,
  message: WhatsAppMessage,
  names: Map<string, string>,
): InboundEvent | null => {
  if (!message.from || !message.id) return null;
  const base = {
    accountId,
    chatId: message.from,
    eventId: message.id,
    senderName: names.get(message.from) ?? null,
    phone: `+${message.from.replace(/\D/g, "")}`,
  };
  const reply =
    message.interactive?.button_reply ?? message.interactive?.list_reply;
  if (reply?.id) {
    const label = reply.title ?? reply.id;
    return { ...base, text: label, button: { data: reply.id, label } };
  }
  if (message.button?.payload) {
    const label = message.button.text ?? message.button.payload;
    return {
      ...base,
      text: label,
      button: { data: message.button.payload, label },
    };
  }
  if (message.type === "text") {
    return { ...base, text: message.text?.body ?? "" };
  }
  if (message.type === "image" && message.image?.id) {
    return {
      ...base,
      text: message.image.caption ?? "",
      attachment: {
        kind: "photo",
        media_id: message.image.id,
        file_name: `photo-${message.id.slice(-12)}.jpg`,
        mime_type: message.image.mime_type ?? "image/jpeg",
        size: null,
      },
    };
  }
  if (message.type === "document" && message.document?.id) {
    return {
      ...base,
      text: message.document.caption ?? "",
      attachment: {
        kind: "document",
        media_id: message.document.id,
        file_name: (message.document.filename ?? "file").slice(0, 255),
        mime_type: message.document.mime_type ?? "application/octet-stream",
        size: null,
      },
    };
  }
  // Stickers, voice, locations: they reach a person as a mark in the chat
  return { ...base, text: "" };
};

/**
 * The messages and button presses of clients in a delivery of the given
 * kind; deliveries of another kind, echoes, read marks and statuses give
 * nothing.
 */
export const parseWebhook = (
  kind: MetaKind,
  payload: unknown,
): InboundEvent[] => {
  const body = payload as WebhookPayload | null;
  if (!body || body.object !== OBJECTS[kind]) return [];
  const events: InboundEvent[] = [];
  for (const entry of body.entry ?? []) {
    if (kind === "whatsapp") {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const names = new Map(
          (value?.contacts ?? []).flatMap((contact) =>
            contact.wa_id && contact.profile?.name
              ? [[contact.wa_id, contact.profile.name] as [string, string]]
              : [],
          ),
        );
        for (const message of value?.messages ?? []) {
          const event = fromWhatsApp(
            value?.metadata?.phone_number_id ?? null,
            message,
            names,
          );
          if (event) events.push(event);
        }
      }
      continue;
    }
    for (const item of entry.messaging ?? []) {
      const event = fromMessaging(entry.id ?? null, item);
      if (event) events.push(event);
    }
  }
  return events;
};
