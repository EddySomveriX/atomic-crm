import type { Identifier, RaRecord } from "ra-core";

export interface Channel extends RaRecord {
  kind: "telegram" | "widget";
  /** Telegram: the username of the bot */
  name: string | null;
  /** Public key of the website widget */
  public_key: string;
  enabled: boolean;
}

export interface Conversation extends RaRecord {
  channel_id: Identifier;
  external_id: string;
  title: string | null;
  phone: string | null;
  client_id: Identifier | null;
  assigned_to: Identifier | null;
  status: "open" | "closed";
  language: "uk" | "en";
  last_message_at: string | null;
  /** Since when the client waits for a person (empty: answered) */
  waiting_since: string | null;
}

export interface Message extends RaRecord {
  conversation_id: Identifier;
  created_at: string;
  direction: "in" | "out";
  /** The member who wrote an outgoing message; empty for the bot */
  sales_id: Identifier | null;
  body: string;
  handled_by_bot: boolean;
  status: "received" | "pending" | "sent" | "failed";
  error: string | null;
}

export interface ReplyTemplate extends RaRecord {
  title: string;
  body: string;
}
