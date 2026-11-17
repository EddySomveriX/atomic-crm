/**
 * What the messengers have in common (Instagram Direct, Facebook Messenger,
 * WhatsApp, Viber): an incoming delivery becomes a list of InboundEvent, the
 * buttons of a bot reply are fitted to what each messenger can show, and a
 * delivery is trusted only with a valid HMAC signature.
 * Plain TypeScript: runs in a Supabase Edge Function (Deno) and in Vitest.
 */

export const MESSENGER_KINDS = [
  "instagram",
  "messenger",
  "whatsapp",
  "viber",
] as const;
export type MessengerKind = (typeof MESSENGER_KINDS)[number];

export const isMessengerKind = (value: unknown): value is MessengerKind =>
  typeof value === "string" &&
  (MESSENGER_KINDS as readonly string[]).includes(value);

/** A file or photo a client sent, as messages.attachment keeps it. */
export interface InboundAttachment {
  kind: "photo" | "document";
  /** Where the messenger serves the file (Instagram, Messenger, Viber) */
  url?: string;
  /** WhatsApp: the id of the media, exchanged for a link when it is saved */
  media_id?: string;
  file_name: string;
  mime_type: string;
  size: number | null;
}

/** One message or button press of a client, the same for every messenger. */
export interface InboundEvent {
  /** The account the delivery is for: must be the channel's own */
  accountId: string | null;
  /** The client's id in the messenger: where answers go */
  chatId: string;
  /** Unique per delivery: a repeated delivery is processed once */
  eventId: string;
  senderName: string | null;
  /** WhatsApp gives the client's number */
  phone: string | null;
  language?: string;
  text: string;
  /** A pressed button: its code and what it said */
  button?: Choice;
  /** The client opened the chat for the first time (Viber) */
  isStart?: boolean;
  attachment?: InboundAttachment;
}

export interface Choice {
  data: string;
  label: string;
}

/** How many buttons a messenger shows under a message, and how long a title is */
export const BUTTON_LIMITS: Record<
  MessengerKind,
  { count: number; title: number }
> = {
  instagram: { count: 13, title: 20 },
  messenger: { count: 13, title: 20 },
  // Up to 3 reply buttons, else a list of up to 10 rows (titles of 24)
  whatsapp: { count: 10, title: 20 },
  viber: { count: 24, title: 40 },
};
export const WHATSAPP_REPLY_BUTTONS = 3;
export const WHATSAPP_LIST_TITLE = 24;

const shorten = (label: string, length: number): string =>
  label.length <= length ? label : `${label.slice(0, length - 1)}…`;

export interface RenderedReply {
  /** The text to send: with a numbered list when buttons do not fit */
  text: string;
  /** Buttons to send natively, titles shortened; null: none */
  buttons: Choice[] | null;
  /** What the client may answer with: kept to read a typed number or label */
  choices: Choice[];
}

/**
 * Fits the buttons of a bot reply to a messenger. When there are more than
 * it shows, they become a numbered list in the text and the client answers
 * with a number.
 */
export const renderReply = (
  kind: MessengerKind,
  text: string,
  buttons: Choice[],
): RenderedReply => {
  if (buttons.length === 0) return { text, buttons: null, choices: [] };
  const limit = BUTTON_LIMITS[kind];
  if (buttons.length > limit.count) {
    const list = buttons
      .map((button, index) => `${index + 1}. ${button.label}`)
      .join("\n");
    return { text: `${text}\n\n${list}`, buttons: null, choices: buttons };
  }
  const title =
    kind === "whatsapp" && buttons.length > WHATSAPP_REPLY_BUTTONS
      ? WHATSAPP_LIST_TITLE
      : limit.title;
  return {
    text,
    buttons: buttons.map((button) => ({
      data: button.data,
      label: shorten(button.label, title),
    })),
    choices: buttons,
  };
};

/**
 * The button a typed answer means: its number in the list, its code (Viber
 * sends the code of a pressed button as text) or its label.
 */
export const matchChoice = (
  text: string,
  choices: readonly Choice[],
): Choice | null => {
  const typed = text.trim();
  if (!typed || choices.length === 0) return null;
  const byCode = choices.find((choice) => choice.data === typed);
  if (byCode) return byCode;
  if (/^\d{1,2}\.?$/.test(typed)) {
    return choices[Number.parseInt(typed, 10) - 1] ?? null;
  }
  const lower = typed.toLowerCase();
  return (
    choices.find((choice) => choice.label.toLowerCase() === lower) ??
    choices.find(
      (choice) =>
        choice.label.length > 1 &&
        lower === shorten(choice.label, 20).toLowerCase(),
    ) ??
    null
  );
};

/** A typed phone number: "+380 67 123 45 67" → "+380671234567"; null otherwise. */
export const typedPhone = (text: string): string | null => {
  const trimmed = text.trim();
  if (!/^[+\d][\d\s().-]{6,24}$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/** HMAC-SHA256 of a body with a secret, as lowercase hex. */
export const hmacSha256Hex = async (
  secret: string,
  body: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
};

/** Compares two signatures without telling where they differ. */
export const sameSignature = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
};
