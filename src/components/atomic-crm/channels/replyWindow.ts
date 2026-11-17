import type { ChannelKind } from "./types";

/**
 * Instagram, Messenger and WhatsApp let a business write only within 24
 * hours of the last message of the client (the same rule as
 * public.chat_reachable in the database).
 */
export const REPLY_WINDOW_HOURS = 24;
const WINDOWED: readonly ChannelKind[] = ["instagram", "messenger", "whatsapp"];

export interface ReplyWindow {
  /** The channel has the 24-hour rule */
  isLimited: boolean;
  isOpen: boolean;
  /** Whole hours left to answer; null when there is no limit or it is over */
  hoursLeft: number | null;
}

export const replyWindow = (
  kind: ChannelKind | undefined,
  lastInboundAt: string | null | undefined,
  now: Date,
): ReplyWindow => {
  if (!kind || !WINDOWED.includes(kind)) {
    return { isLimited: false, isOpen: true, hoursLeft: null };
  }
  const left = lastInboundAt
    ? REPLY_WINDOW_HOURS * 3600_000 -
      (now.getTime() - new Date(lastInboundAt).getTime())
    : 0;
  return left > 0
    ? { isLimited: true, isOpen: true, hoursLeft: Math.floor(left / 3600_000) }
    : { isLimited: true, isOpen: false, hoursLeft: null };
};
