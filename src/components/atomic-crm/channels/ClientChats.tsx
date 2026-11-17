import { useGetList, useTranslate, type Identifier } from "ra-core";
import { Link } from "react-router";

import { ChannelIcon } from "./ChannelIcon";
import type { Channel, Conversation } from "./types";

/**
 * The chats of a client in every messenger, on their card: one press opens
 * the chat to write in.
 */
export const ClientChats = ({ clientId }: { clientId: Identifier }) => {
  const translate = useTranslate();
  const { data: conversations = [] } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "last_message_at", order: "DESC" },
      filter: { client_id: clientId },
    },
  );
  const { data: channels = [] } = useGetList<Channel>(
    "channels",
    {
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: conversations.length > 0 },
  );
  if (conversations.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-muted-foreground">
        {translate("crm.chats.client_chats")}
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {conversations.map((conversation) => {
          const kind = channels.find(
            (channel) => channel.id === conversation.channel_id,
          )?.kind;
          return (
            <li key={conversation.id}>
              <Link
                to={`/chats?id=${conversation.id}`}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 hover:bg-accent/60"
              >
                <ChannelIcon kind={kind} className="size-4" />
                {kind ? translate(`crm.chats.channels.${kind}`) : ""}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
