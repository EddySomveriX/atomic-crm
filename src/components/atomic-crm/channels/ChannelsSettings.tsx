import { useMutation } from "@tanstack/react-query";
import {
  useCreate,
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CrmDataProvider } from "../providers/types";
import { MessengersSettings } from "./MessengersSettings";
import type { Channel } from "./types";
import { widgetSnippet } from "./widgetSnippet";

/**
 * Channels of the business (TZ section 5.2), for its owner: the Telegram bot
 * and the widget of the website. The bot token is typed here by the owner
 * and goes straight to the server, which keeps it out of reach of the
 * interface.
 */
export const ChannelsSettings = () => {
  const translate = useTranslate();
  const { data: channels = [], refetch } = useGetList<Channel>("channels", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "id", order: "ASC" },
  });
  const telegram = channels.find(
    (channel) => channel.kind === "telegram" && channel.enabled,
  );
  const widget = channels.find((channel) => channel.kind === "widget");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">
          {translate("crm.channels.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate("crm.channels.hint")}
        </p>
      </div>
      <TelegramChannel connected={telegram} onChange={() => refetch()} />
      <MessengersSettings channels={channels} onChange={() => refetch()} />
      <WidgetChannel widget={widget} onChange={() => refetch()} />
    </section>
  );
};

const TelegramChannel = ({
  connected,
  onChange,
}: {
  connected: Channel | undefined;
  onChange: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [token, setToken] = useState("");

  const connect = useMutation({
    mutationFn: () => dataProvider.connectTelegram(token.trim()),
    onSuccess: ({ username }) => {
      setToken("");
      notify("crm.channels.telegram_connected", {
        type: "success",
        messageArgs: { username },
      });
      onChange();
    },
    onError: (error: Error) =>
      notify(
        error.message === "invalid_token" || error.message === "token_refused"
          ? "crm.channels.token_refused"
          : "crm.channels.telegram_failed",
        { type: "error" },
      ),
  });
  const disconnect = useMutation({
    mutationFn: () => dataProvider.disconnectTelegram(),
    onSuccess: onChange,
    onError: () => notify("crm.channels.telegram_failed", { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (token.trim()) connect.mutate();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="font-semibold">Telegram</h3>
      {connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Check className="size-4 text-primary" />
            {translate("crm.channels.telegram_on", {
              username: connected.name,
            })}
          </span>
          <a
            href={`https://t.me/${connected.name}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline"
          >
            t.me/{connected.name}
          </a>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            {translate("crm.channels.disconnect")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{translate("crm.channels.step_botfather")}</li>
            <li>{translate("crm.channels.step_newbot")}</li>
            <li>{translate("crm.channels.step_token")}</li>
          </ol>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telegram-token">
              {translate("crm.channels.token")}
            </Label>
            <Input
              id="telegram-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="self-start"
            disabled={!token.trim() || connect.isPending}
          >
            {translate("crm.channels.connect")}
          </Button>
        </form>
      )}
    </div>
  );
};

const WidgetChannel = ({
  widget,
  onChange,
}: {
  widget: Channel | undefined;
  onChange: () => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create, { isPending }] = useCreate<Channel>();
  const [copied, setCopied] = useState(false);
  const snippet = widget ? widgetSnippet(widget.public_key) : "";

  const enable = () =>
    create(
      "channels",
      { data: { kind: "widget" } },
      {
        onSuccess: () => {
          onChange();
          refresh();
        },
        onError: () => notify("crm.channels.widget_failed", { type: "error" }),
      },
    );

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="font-semibold">{translate("crm.channels.widget")}</h3>
      <p className="text-sm text-muted-foreground">
        {translate("crm.channels.widget_hint")}
      </p>
      {widget ? (
        <>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {snippet}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {translate(copied ? "crm.channels.copied" : "crm.channels.copy")}
            </Button>
            <a
              href={`/widget/demo.html?key=${widget.public_key}&api=${encodeURIComponent(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget_api`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-sm font-medium underline"
            >
              {translate("crm.channels.widget_demo")}
            </a>
          </div>
        </>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          onClick={enable}
          disabled={isPending}
        >
          {translate("crm.channels.widget_enable")}
        </Button>
      )}
    </div>
  );
};
