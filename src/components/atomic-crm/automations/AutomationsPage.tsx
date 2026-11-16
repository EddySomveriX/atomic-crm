import { useQueryClient } from "@tanstack/react-query";
import {
  useCreate,
  useGetList,
  useGetMany,
  useLocaleState,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import type { Company } from "../types";
import { AutomationCard, type AutomationChange } from "./AutomationCard";
import {
  AUTOMATION_KINDS,
  type Automation,
  type AutomationKind,
  type AutomationSend,
} from "./types";

/**
 * Automatic messages to clients in Telegram: five ready scenarios with a
 * switch each, and what was sent lately. Each message goes out once, from
 * 9:00 to 20:00, to clients who agreed to the bot's terms; a client stops
 * them by writing "stop".
 */
export const AutomationsPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [create] = useCreate();
  const [update] = useUpdate();
  const { data: automations = [], isPending } = useGetList<Automation>(
    "automations",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const change = (kind: AutomationKind, data: AutomationChange) => {
    const existing = automations.find((item) => item.kind === kind);
    const options = {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["automations"] }),
      onError: () => notify("crm.automations.save_failed", { type: "error" }),
    };
    if (existing) {
      update(
        "automations",
        { id: existing.id, data, previousData: existing },
        options,
      );
    } else {
      create("automations", { data: { kind, ...data } }, options);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-28 pt-2 md:px-0 md:pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {translate("crm.automations.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.automations.hint")}
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {AUTOMATION_KINDS.map((kind) => (
          <AutomationCard
            key={`${kind}-${isPending}`}
            kind={kind}
            automation={automations.find((item) => item.kind === kind)}
            onChange={(data) => change(kind, data)}
            disabled={isPending}
          />
        ))}
      </ul>
      <RecentSends />
    </div>
  );
};

AutomationsPage.path = "/automations";

const RecentSends = () => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { data: sends = [] } = useGetList<AutomationSend>("automation_sends", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "created_at", order: "DESC" },
  });
  const clientIds = [...new Set(sends.flatMap((send) => send.client_id ?? []))];
  const { data: clients = [] } = useGetMany<Company>(
    "companies",
    { ids: clientIds },
    { enabled: clientIds.length > 0 },
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {translate("crm.automations.recent")}
      </h2>
      {sends.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.automations.recent_empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card text-sm">
          {sends.map((send) => {
            const client = clients.find((item) => item.id === send.client_id);
            return (
              <li key={send.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {client ? (
                      <Link
                        to={`/companies/${client.id}/show`}
                        className="hover:underline"
                      >
                        {client.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {translate(`crm.automations.kinds.${send.kind}.name`)},{" "}
                    {new Date(send.created_at).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    send.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                  title={send.error ?? undefined}
                >
                  {translate(`crm.automations.statuses.${send.status}`)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
