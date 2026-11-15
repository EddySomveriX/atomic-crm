import { useGetList, useGetMany, useTranslate } from "ra-core";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import type { Company } from "../types";
import type { Conversation } from "./types";
import { URGENT_AFTER_MINUTES, waitedMinutes, waitingLabel } from "./waiting";

const REFRESH_MS = 30_000;
const SHOWN = 5;

/**
 * Clients waiting for an answer, on the start screen (TZ section 4.1: new
 * messages come first), the longest wait first. Hidden when nobody waits.
 */
export const TodayMessages = () => {
  const translate = useTranslate();
  const { data: waiting = [], total = 0 } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: SHOWN },
      sort: { field: "waiting_since", order: "ASC" },
      filter: { "waiting_since@not.is": null },
    },
    { refetchInterval: REFRESH_MS },
  );
  const clientIds = [
    ...new Set(waiting.flatMap((item) => item.client_id ?? [])),
  ];
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );

  if (waiting.length === 0) return null;
  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">
          {translate("crm.today.messages", { smart_count: total })}
        </h2>
        <Link to="/chats" className="text-sm font-medium hover:underline">
          {translate("crm.chats.title")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {waiting.map((conversation) => {
          const waited = waitedMinutes(conversation.waiting_since, now) ?? 0;
          return (
            <li key={String(conversation.id)}>
              <Link
                to={`/chats?id=${conversation.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {clients.find(
                    (client) => client.id === conversation.client_id,
                  )?.name ??
                    conversation.title ??
                    conversation.phone ??
                    translate("crm.chats.unknown_client")}
                </span>
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
