import {
  matchChoice,
  typedPhone,
  type Choice,
  type InboundEvent,
} from "../../../../connectors/messaging.ts";
import type { BotInput } from "../bot/flowShared.ts";

/**
 * Turns a message of a messenger into what the booking dialog understands
 * and into the line the chat center shows. No database or network here.
 */

/** What the client did, for the booking dialog. */
export const botInputOf = (
  event: InboundEvent,
  conversation: { reply_choices: Choice[]; bot_state: Record<string, unknown> },
): { input: BotInput; button: Choice | null } => {
  if (event.isStart) return { input: { kind: "start" }, button: null };
  const button =
    event.button ?? matchChoice(event.text, conversation.reply_choices);
  if (button) {
    return { input: { kind: "button", data: button.data }, button };
  }
  // The messengers have no "send my number" button: the number is typed
  const phone =
    conversation.bot_state.step === "phone" ? typedPhone(event.text) : null;
  if (phone) {
    return {
      input: { kind: "contact", phone, name: event.senderName ?? "" },
      button: null,
    };
  }
  return { input: { kind: "text", text: event.text }, button: null };
};

/** What the client sent, as text for the chat center. */
export const bodyOf = (event: InboundEvent, button: Choice | null): string => {
  if (button) return `[${button.label}]`;
  if (event.attachment) {
    const label =
      event.attachment.kind === "photo"
        ? "[photo]"
        : `[file] ${event.attachment.file_name}`;
    return event.text.trim() ? `${label}\n${event.text.trim()}` : label;
  }
  if (event.isStart) return "/start";
  return event.text || "[attachment]";
};
