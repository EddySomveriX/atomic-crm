import {
  useGetList,
  useGetMany,
  useGetIdentity,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Globe, Send } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Company } from "../types";
import { ConversationView } from "./ConversationView";
import type { Channel, Conversation } from "./types";
import { URGENT_AFTER_MINUTES, waitedMinutes, waitingLabel } from "./waiting";

/** The feed refreshes itself this often */
const REFRESH_MS = 5_000;

type Filter = "all" | "waiting" | "mine";

/** Re-renders every half minute so that the waiting timers move. */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

/**
 * The chat center (TZ section 5.2): every channel in one feed, the clients
 * waiting for an answer first in mind, with how long they wait. On a phone
 * the feed and an open conversation take the screen in turn. The open
 * conversation is in the URL (?id=).
 */
export const ChatsPage = () => {
  const translate = useTranslate();
  const now = useNow();
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = Number(searchParams.get("id")) || null;
  const [filter, setFilter] = useState<Filter>("all");

  const { data: conversations = [], isPending } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_message_at", order: "DESC" },
      filter:
        filter === "waiting"
          ? { "waiting_since@not.is": null }
          : filter === "mine" && identity
            ? { assigned_to: identity.id }
            : {},
    },
    { refetchInterval: REFRESH_MS },
  );
  const { data: channels = [] } = useGetList<Channel>("channels", {
    pagination: { page: 1, perPage: 10 },
    sort: { field: "id", order: "ASC" },
  });
  const clientIds = [
    ...new Set(conversations.flatMap((item) => item.client_id ?? [])),
  ];
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );
  const open = conversations.find((item) => item.id === openId);

  const nameOf = (conversation: Conversation) =>
    clients.find((client) => client.id === conversation.client_id)?.name ??
    conversation.title ??
    conversation.phone ??
    translate("crm.chats.unknown_client");
  const channelOf = (conversation: Conversation) =>
    channels.find((channel) => channel.id === conversation.channel_id)?.kind;

  const select = (id: Identifier | null) =>
    setSearchParams(id == null ? {} : { id: String(id) });

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-6xl gap-4 px-4 pb-4 pt-4 md:px-0">
      <aside
        className={cn(
          "flex w-full flex-col gap-3 md:w-80 md:shrink-0",
          open ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {translate("crm.chats.title")}
          </h1>
          <Link
            to="/automations"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {translate("crm.nav.automations")}
          </Link>
        </div>
        <div className="flex gap-1" role="tablist">
          {(["all", "waiting", "mine"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                filter === item
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {translate(`crm.chats.filters.${item}`)}
            </button>
          ))}
        </div>
        <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto rounded-lg border bg-card">
          {!isPending && conversations.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {translate(
                channels.some((channel) => channel.enabled)
                  ? "crm.chats.empty"
                  : "crm.chats.no_channels",
              )}
            </li>
          ) : null}
          {conversations.map((conversation) => {
            const waited = waitedMinutes(conversation.waiting_since, now);
            return (
              <li key={String(conversation.id)}>
                <button
                  type="button"
                  onClick={() => select(conversation.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50",
                    conversation.id === openId && "bg-muted",
                  )}
                >
                  <ChannelIcon kind={channelOf(conversation)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {nameOf(conversation)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {conversation.status === "closed"
                        ? translate("crm.chats.closed")
                        : conversation.last_message_at
                          ? new Date(
                              conversation.last_message_at,
                            ).toLocaleString()
                          : ""}
                    </span>
                  </span>
                  {waited != null ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        waited >= URGENT_AFTER_MINUTES
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {waitingLabel(waited, translate)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          open ? "flex" : "hidden md:flex",
        )}
      >
        {open ? (
          <ConversationView
            key={String(open.id)}
            conversation={open}
            name={nameOf(open)}
            channelKind={channelOf(open)}
            onBack={() => select(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {translate("crm.chats.choose")}
          </div>
        )}
      </section>
    </div>
  );
};

export const ChannelIcon = ({ kind }: { kind?: Channel["kind"] }) =>
  kind === "widget" ? (
    <Globe
      className="size-5 shrink-0 text-muted-foreground"
      aria-label="Website"
    />
  ) : (
    <Send className="size-5 shrink-0 text-sky-600" aria-label="Telegram" />
  );

ChatsPage.path = "/chats";
