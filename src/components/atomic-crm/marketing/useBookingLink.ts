import { useGetList } from "ra-core";

import type { Channel } from "../channels/types";

/** Where clients book: the business's Telegram bot; null when it has none. */
export const useBookingLink = (): string | null => {
  const { data: channels = [] } = useGetList<Channel>("channels", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
    filter: { kind: "telegram" },
  });
  const bot = channels.find((channel) => channel.enabled && channel.name);
  return bot ? `https://t.me/${bot.name}` : null;
};
